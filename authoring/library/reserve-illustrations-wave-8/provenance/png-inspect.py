"""Read-only PNG/manifest inspection; prints JSON and never changes original pixels."""
import hashlib
import json
import struct
import zlib
from pathlib import Path
from PIL import Image


def main():
    cohort = Path(__file__).resolve().parent.parent
    manifest = json.loads((cohort / 'manifest.json').read_text())
    rows = []
    for row in manifest['entries']:
        path = cohort / row['file']
        raw = path.read_bytes()
        assert len(raw) == row['bytes']
        assert hashlib.sha256(raw).hexdigest() == row['sha256']
        assert raw[:8] == b'\x89PNG\r\n\x1a\n'
        offset = 8
        while offset < len(raw):
            size = struct.unpack('>I', raw[offset:offset + 4])[0]
            tag = raw[offset + 4:offset + 8]
            data = raw[offset + 8:offset + 8 + size]
            expected = struct.unpack('>I', raw[offset + 8 + size:offset + 12 + size])[0]
            assert zlib.crc32(tag + data) & 0xffffffff == expected
            offset += 12 + size
            if tag == b'IEND':
                break
        assert tag == b'IEND' and offset == len(raw)
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            image.load()
            assert image.size == (row['width'], row['height'])
            assert image.width == image.height * 2 and image.mode == 'RGB'
            assert raw[24] == 8
            rows.append({'id': row['id'], 'sha256': row['sha256'], 'bytes': len(raw),
                         'width': image.width, 'height': image.height, 'mode': image.mode,
                         'bitDepth': raw[24], 'decode': 'PASS', 'chunkCRCs': 'PASS'})
    print(json.dumps({'pillowVersion': Image.__version__, 'entries': rows}, indent=2))


if __name__ == '__main__':
    main()
