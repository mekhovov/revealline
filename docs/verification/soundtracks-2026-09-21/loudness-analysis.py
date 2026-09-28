"""Reproduce with the isolated audio-analysis Python environment, from repository root."""
import gc
import hashlib
import importlib.metadata
import json
import math
import platform
import subprocess
import warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import scipy
from scipy.io import wavfile
from scipy.signal import resample_poly

ROOT = Path.cwd()
BASE = ROOT / 'authoring/library/licensed-audio'
OUTPUT = ROOT / 'docs/verification/soundtracks-2026-09-21'
CACHE = ROOT / '.cache/soundtrack-implementation/audio-analysis'
TEMPORARY = CACHE / 'current-decode.wav'
PRIOR = json.loads((OUTPUT / 'decode-receipt.json').read_text())
MANIFEST = json.loads((BASE / 'sources.json').read_text())
OVERSAMPLE = 8
CHUNK = 65536
OVERLAP = 256
WINDOW = ('kaiser', 8.6)


def sha256(file):
    result = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1048576), b''):
            result.update(block)
    return result.hexdigest()


def oversampled_peak(data):
    """Trim overlap so internal block edges never act as signal boundaries."""
    peak = 0.0
    for start in range(0, data.shape[0], CHUNK):
        end = min(start + CHUNK, data.shape[0])
        lo, hi = max(0, start - OVERLAP), min(data.shape[0], end + OVERLAP)
        block = np.asarray(data[lo:hi], dtype=np.float64)
        interpolated = resample_poly(block, OVERSAMPLE, 1, axis=0,
                                     window=WINDOW, padtype='constant')
        trim_start = (start - lo) * OVERSAMPLE
        retained = interpolated[trim_start:trim_start + (end - start) * OVERSAMPLE]
        peak = max(peak, float(np.max(np.abs(retained))))
    return peak


def db(value):
    return float(20 * math.log10(value)) if value > 0 else None


rng = np.random.default_rng(31770)
check = rng.uniform(-0.5, 0.5, size=(CHUNK * 2 + 137, 2))
whole_peak = float(np.max(np.abs(resample_poly(check, OVERSAMPLE, 1, axis=0,
                                              window=WINDOW, padtype='constant'))))
chunk_peak = oversampled_peak(check)
assert abs(whole_peak - chunk_peak) < 1e-12
report = {
    'format': 'revealline-licensed-audio-loudness.v1',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'manifestSha256': sha256(BASE / 'sources.json'),
    'priorDecodeReceiptSha256': sha256(OUTPUT / 'decode-receipt.json'),
    'tools': {'python': platform.python_version(), 'numpy': np.__version__,
              'scipy': scipy.__version__, 'pyloudnorm': importlib.metadata.version('pyloudnorm'),
              'decoder': '/usr/bin/afconvert (Apple CoreAudio, version 2.0)'},
    'integratedLoudnessMethod': {
        'implementation': 'pyloudnorm.Meter(rate, filter_class="DeMan", block_size=0.400).integrated_loudness(float64_stereo)',
        'algorithm': 'ITU-R BS.1770-4 integrated gated loudness',
        'blockSeconds': 0.4, 'blockOverlap': 0.75,
        'absoluteGateLUFS': -70, 'relativeGateLU': -10,
        'channelOrder': ['left', 'right'],
        'source': 'https://pypi.org/project/pyloudnorm/',
    },
    'truePeakEstimateMethod': {
        'implementation': 'scipy.signal.resample_poly(data, 8, 1, axis=0, window=("kaiser", 8.6), padtype="constant")',
        'oversamplingFactor': OVERSAMPLE, 'chunkFrames': CHUNK, 'overlapFrames': OVERLAP,
        'filter': 'SciPy default-length FIR with Kaiser beta 8.6; maximum absolute sample across both interpolated channels',
        'edges': 'Zero padding only at actual recording boundaries. Internal chunks include 256 input frames of overlap each side, trimmed after interpolation.',
        'unit': 'estimated dBTP (dB relative to digital full scale)',
        'certification': 'Approximate oversampled estimate; not an ITU/EBU-certified true-peak meter.',
        'source': 'https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.resample_poly.html',
    },
    'chunkImplementationCheck': {'seed': 31770, 'stereoFrames': check.shape[0],
                                 'wholeVersusChunkPeakAbsoluteDifference': abs(whole_peak - chunk_peak)},
    'limitations': [
        'These are measurements of the CoreAudio-decoded runtime MP3s, including codec delay/padding as decoded. They do not recover any clipping already present in source or decoder output.',
        'Integrated loudness uses the named published algorithm/library, but this run is not independent formal meter certification.',
        'Estimated true peak depends on the selected interpolation filter and sample rate; it is not a formal compliance assertion.',
        'No gain, normalization, trimming, recomposition or audio changes were applied.',
        'No full listening, musical quality, loop seam, in-game balance or cultural acceptance is claimed.'
    ],
    'tracks': [],
}
del check
for entry in MANIFEST['tracks']:
    file = BASE / entry['runtime']['path']
    prior = next(track for track in PRIOR['tracks'] if track['id'] == entry['id'])
    row = {'id': entry['id'], 'title': entry['title'], 'artist': entry['artist'],
           'runtime': entry['runtime']['path'], 'sha256': entry['runtime']['sha256']}
    pcm = signal = None
    try:
        assert sha256(file) == prior['sha256'] == entry['runtime']['sha256']
        assert file.stat().st_size == prior['bytes'] == entry['runtime']['bytes']
        TEMPORARY.unlink(missing_ok=True)
        decoded = subprocess.run(['/usr/bin/afconvert', '-f', 'WAVE', '-d', 'LEF32',
                                  str(file), str(TEMPORARY)], capture_output=True, text=True)
        assert decoded.returncode == 0, decoded.stderr
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', wavfile.WavFileWarning)
            rate, pcm = wavfile.read(TEMPORARY, mmap=True)
        assert pcm.dtype == np.float32 and pcm.ndim == 2 and pcm.shape[1] == 2
        assert pcm.shape[0] == prior['frames'] and rate == prior['sampleRate']
        signal = np.asarray(pcm, dtype=np.float64)
        assert np.all(np.isfinite(signal))
        meter = pyln.Meter(rate, filter_class='DeMan', block_size=0.4)
        lufs = float(meter.integrated_loudness(signal))
        peak = oversampled_peak(pcm)
        row.update({'status': 'measured', 'sampleRate': int(rate), 'channels': int(pcm.shape[1]),
                    'frames': int(pcm.shape[0]), 'durationSeconds': pcm.shape[0] / rate,
                    'integratedLoudnessLUFS': lufs, 'samplePeakDbFS': prior['samplePeakDbFS'],
                    'estimatedTruePeakDbTP': db(peak), 'estimatedTruePeakLinear': peak,
                    'hashUnchangedAfterMeasurement': sha256(file) == entry['runtime']['sha256']})
        assert row['hashUnchangedAfterMeasurement'] and math.isfinite(lufs)
    except Exception as failure:
        row.update({'status': 'failed', 'error': str(failure)})
    finally:
        signal = None
        if isinstance(pcm, np.memmap):
            pcm._mmap.close()
        pcm = None
        TEMPORARY.unlink(missing_ok=True)
        gc.collect()
    report['tracks'].append(row)
    (OUTPUT / 'loudness-receipt.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f"{len(report['tracks'])}/24 {row['id']}: {row['status']}, {row.get('integratedLoudnessLUFS',0):.2f} LUFS, {row.get('estimatedTruePeakDbTP',0):.2f} estimated dBTP", flush=True)

valid = [track for track in report['tracks'] if track['status'] == 'measured']
report['completedAt'] = datetime.now(timezone.utc).isoformat()
report['summary'] = {
    'registeredTracks': len(MANIFEST['tracks']), 'measuredTracks': len(valid),
    'failedTracks': len(report['tracks']) - len(valid),
    'minimumIntegratedLUFS': min(track['integratedLoudnessLUFS'] for track in valid),
    'maximumIntegratedLUFS': max(track['integratedLoudnessLUFS'] for track in valid),
    'maximumEstimatedTruePeakDbTP': max(track['estimatedTruePeakDbTP'] for track in valid),
    'aboveZeroEstimatedTruePeakTrackIds': [track['id'] for track in valid if track['estimatedTruePeakDbTP'] > 0],
    'temporaryPcmRetained': TEMPORARY.exists(),
}
(OUTPUT / 'loudness-receipt.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report['summary']), flush=True)
assert report['summary']['failedTracks'] == 0
