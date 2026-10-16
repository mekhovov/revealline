#!/usr/bin/env python3
"""Measure captured reading-twin pixels; never modifies the source screenshot.

Usage: python3 sample-appearance-contrast.py CAPTURE_DIR --output REPORT.json
Each PNG/JPEG capture needs matching fixture measurement JSON. PNG uses only the
standard library. JPEG is decoded by macOS sips to a disposable temporary PNG;
that preserves the captured JPEG pixels, not the original lossless browser paint.
JPEG passes require an additional 0.2 contrast margin, reported separately.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import subprocess
import tempfile
import zlib

PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'


def png_pixels(blob):
    if not blob.startswith(PNG_SIGNATURE):
        raise ValueError('Expected PNG data')
    offset, packed, header = 8, [], None
    while offset < len(blob):
        length, kind = struct.unpack_from('>I4s', blob, offset)
        body = blob[offset + 8:offset + 8 + length]
        if len(body) != length or offset + 12 + length > len(blob):
            raise ValueError('Truncated PNG chunk')
        crc = struct.unpack_from('>I', blob, offset + 8 + length)[0]
        if zlib.crc32(kind + body) & 0xffffffff != crc:
            raise ValueError('Invalid PNG checksum')
        offset += length + 12
        if kind == b'IHDR':
            header = struct.unpack('>IIBBBBB', body)
        elif kind == b'IDAT':
            packed.append(body)
        elif kind == b'IEND':
            break
    if header is None:
        raise ValueError('PNG header missing')
    width, height, depth, color, compression, filtering, interlace = header
    if depth != 8 or color not in (2, 6) or compression or filtering or interlace:
        raise ValueError('Only non-interlaced 8-bit RGB/RGBA screenshots are supported')
    if not 0 < width * height <= 48_000_000:
        raise ValueError('Screenshot dimensions exceed the sampler bound')
    channels = 3 if color == 2 else 4
    stride = width * channels
    expected = (stride + 1) * height
    decoder = zlib.decompressobj()
    raw = decoder.decompress(b''.join(packed), expected + 1)
    if len(raw) != expected or not decoder.eof:
        raise ValueError('Invalid PNG raster size')
    pixels = bytearray(stride * height)
    previous = bytearray(stride)
    for y in range(height):
        start = y * (stride + 1)
        method = raw[start]
        row = bytearray(raw[start + 1:start + 1 + stride])
        if method == 1:
            for x in range(channels, stride):
                row[x] = (row[x] + row[x - channels]) & 255
        elif method == 2:
            row = bytearray((value + previous[x]) & 255 for x, value in enumerate(row))
        elif method == 3:
            for x in range(stride):
                left = row[x - channels] if x >= channels else 0
                row[x] = (row[x] + ((left + previous[x]) // 2)) & 255
        elif method == 4:
            for x in range(stride):
                left = row[x - channels] if x >= channels else 0
                above = previous[x]
                upper_left = previous[x - channels] if x >= channels else 0
                prediction = left + above - upper_left
                a, b, c = abs(prediction - left), abs(prediction - above), abs(prediction - upper_left)
                nearest = left if a <= b and a <= c else above if b <= c else upper_left
                row[x] = (row[x] + nearest) & 255
        elif method != 0:
            raise ValueError('Unknown PNG filter')
        pixels[y * stride:(y + 1) * stride] = row
        previous = row
    return width, height, channels, pixels


def decode_capture(path):
    source = path.read_bytes()
    if source.startswith(PNG_SIGNATURE):
        return (*png_pixels(source), 'PNG', 0.0)
    if source.startswith(b'\xff\xd8\xff'):
        with tempfile.TemporaryDirectory(prefix='appearance-pixels-') as scratch:
            decoded = Path(scratch) / 'decoded.png'
            subprocess.run(['/usr/bin/sips', '-s', 'format', 'png', str(path), '--out', str(decoded)],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            return (*png_pixels(decoded.read_bytes()), 'JPEG', 0.2)
    raise ValueError('Screenshot is neither PNG nor JPEG')


def rgb(value):
    match = re.fullmatch(r'rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(1(?:\.0*)?))?\s*\)', value)
    if not match:
        raise ValueError(f'Expected opaque computed RGB color, got {value!r}')
    result = tuple(float(match.group(index)) for index in (1, 2, 3))
    if any(channel < 0 or channel > 255 for channel in result):
        raise ValueError('RGB channel outside 0–255')
    return result


def luminance(color):
    linear = []
    for channel in color:
        value = channel / 255
        linear.append(value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4)
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722


def measure(path, metadata):
    width, height, channels, pixels, encoding, margin = decode_capture(path)
    scale = width / metadata['viewport']['width']
    if not 0.25 <= scale <= 4:
        raise ValueError('Screenshot and viewport scales disagree')
    samples = []
    for sample in metadata['samples']:
        if not sample.get('twin'):
            continue
        if float(sample.get('opacity', '1')) != 1:
            raise ValueError('Non-opaque control needs foreground compositing')
        rect = sample['documentReadingRectangle']
        x0, y0 = math.ceil(rect['x'] * scale), math.ceil(rect['y'] * scale)
        x1, y1 = math.floor((rect['x'] + rect['width']) * scale), math.floor((rect['y'] + rect['height']) * scale)
        if not (0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height):
            raise ValueError(f"{sample['id']} reading rectangle is outside the full-page screenshot")
        colors = {}
        for y in range(y0, y1):
            for x in range(x0, x1):
                offset = (y * width + x) * channels
                if channels == 4 and pixels[offset + 3] != 255:
                    raise ValueError('Transparent screenshot pixels need an explicit backdrop')
                color = bytes(pixels[offset:offset + 3])
                if color not in colors:
                    colors[color] = [x, y]
        foreground = luminance(rgb(sample['foreground']))
        worst, background = 22, None
        for color in colors:
            value = luminance(color)
            ratio = (max(foreground, value) + 0.05) / (min(foreground, value) + 0.05)
            if ratio < worst:
                worst, background = ratio, color
        threshold = 7 if metadata.get('highContrast') else 3 if 'disabled' in sample['case'] else 4.5
        status = 'fail' if worst < threshold else 'margin' if worst < threshold + margin else 'pass'
        samples.append({
            'id': sample['id'], 'case': sample['case'], 'status': status,
            'foreground': sample['foreground'], 'minimumContrast': round(worst, 4),
            'threshold': threshold, 'compressionMargin': margin,
            'worstBackgroundRGB': list(background), 'worstPixel': colors[background],
            'nativeHover': sample.get('nativeHover', False), 'nativeActive': sample.get('nativeActive', False),
            'pixelsSampled': (x1 - x0) * (y1 - y0), 'uniqueBackgroundColors': len(colors),
        })
    if not samples:
        raise ValueError('Capture has no reading twins')
    return {
        'capture': path.name, 'family': metadata['family'], 'outer': metadata.get('outer'),
        'ornaments': metadata.get('ornaments'), 'highContrast': metadata.get('highContrast', False),
        'reducedEffects': metadata.get('reducedEffects', False), 'forcedColors': metadata.get('forcedColors', False),
        'screenshotEncoding': encoding, 'sourceSHA256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'width': width, 'height': height, 'scale': scale, 'samples': samples,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--pattern', default='*')
    args = parser.parse_args()
    captures, errors = [], []
    for path in sorted(args.directory.glob(args.pattern)):
        if path.suffix.lower() not in ('.png', '.jpg', '.jpeg'):
            continue
        measurements = path.with_suffix('.json')
        if not measurements.is_file():
            continue
        metadata = json.loads(measurements.read_text())
        if not isinstance(metadata, dict) or not isinstance(metadata.get('samples'), list):
            continue
        try:
            result = measure(path, metadata)
            result['measurementSHA256'] = hashlib.sha256(measurements.read_bytes()).hexdigest()
            captures.append(result)
            failures = [sample for sample in result['samples'] if sample['status'] != 'pass']
            print(json.dumps({'capture': path.name, 'encoding': result['screenshotEncoding'],
                              'samples': len(result['samples']), 'concerns': failures}), flush=True)
        except (ValueError, OSError, KeyError, subprocess.CalledProcessError) as error:
            errors.append({'capture': path.name, 'error': str(error)})
    all_samples = [sample for capture in captures for sample in capture['samples']]
    report = {
        'format': 'appearance-captured-pixel-contrast.v1',
        'method': 'Every captured RGB pixel inside textless reading twins; no screenshot correction or retouching. JPEG is lossy and requires an additional 0.2 passing margin; this is captured-pixel evidence, not a guarantee of lossless browser paint.',
        'captureCount': len(captures), 'sampleCount': len(all_samples),
        'failureCount': sum(sample['status'] == 'fail' for sample in all_samples),
        'marginCount': sum(sample['status'] == 'margin' for sample in all_samples),
        'captures': captures, 'errors': errors,
    }
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ['captureCount', 'sampleCount', 'failureCount', 'marginCount', 'errors']}))
    return 1 if errors or not captures or report['failureCount'] or report['marginCount'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
