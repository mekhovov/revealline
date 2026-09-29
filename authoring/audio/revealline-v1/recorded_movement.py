"""Deterministic edits of licensed, preserved Freesound HQ preview recordings."""
import array
import json
import math
import pathlib
import struct
import subprocess
import wave

SR = 32000
# Keep motor/rolling microstructure; remove rumble and the most fatiguing top end.
RECIPES = {
    'rotor': {'start': 16, 'duration': 6.25, 'highpass': 100, 'lowpass': 3200, 'overlap': .25},
    'motor': {'start': .7, 'duration': 3.55, 'highpass': 100, 'lowpass': 2800, 'overlap': .25},
    'wheels': {'start': 1.5, 'duration': 2.5, 'highpass': 90, 'lowpass': 3600, 'overlap': .25},
    'wings': {'start': .01, 'duration': .52, 'highpass': 130, 'lowpass': 4200, 'length': 5.6,
              'gestures': [(0.10, 1, 1), (.82, .85, 1.06), (1.58, .94, .96), (2.37, .80, 1.03), (3.18, .92, 1), (4.05, .78, .98), (4.85, .88, 1.04)]},
    'grain': {'start': .75, 'duration': 3.1, 'highpass': 160, 'lowpass': 3400, 'length': 6.4,
              'gestures': [(0.1, .85, 1, 0, .36), (1.22, .66, .96, .58, .28), (2.63, .76, 1.04, 1.35, .42), (4.17, .62, 1, 2.10, .32), (5.36, .80, .98, 2.65, .36)]},
}

def build(here, out):
    sources = json.loads((here / 'originals/freesound/sources.json').read_text())
    for name, recipe in RECIPES.items():
        source = here / 'originals/freesound' / sources[name]['file']
        filters = f"atrim=start={recipe['start']}:duration={recipe['duration']},asetpts=PTS-STARTPTS,highpass=f={recipe['highpass']},lowpass=f={recipe['lowpass']}"
        pcm = array.array('f', subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(source), '-af', filters, '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-']))
        if 'gestures' in recipe:
            data = [0.0] * round(recipe['length'] * SR)
            for gesture in recipe['gestures']:
                onset, gain, rate = gesture[:3]
                start, duration = gesture[3:] if len(gesture) > 3 else (0, len(pcm) / SR)
                count = int(duration * SR / rate)
                for i in range(count):
                    index = round(start * SR + i * rate)
                    dest = round(onset * SR) + i
                    if index >= len(pcm) or dest >= len(data): break
                    # Preserve the recorded attack; gently taper the edit, with silence between gestures.
                    envelope = min(1, i / (SR * .018), (count - 1 - i) / (SR * .055))
                    data[dest] += pcm[index] * gain * max(0, envelope)
        else:
            data = list(pcm)
            overlap = round(recipe['overlap'] * SR)
            for i in range(overlap):
                blend = .5 - .5 * math.cos(math.pi * i / (overlap - 1))
                data[i] = data[-overlap+i] * (1-blend) + data[i] * blend
            data = data[:-overlap]
        # Lift quiet source recordings before PCM16 quantization; role RMS is applied by produce.py.
        # Tame isolated handling spikes without turning up the quiet gaps.
        rms = math.sqrt(sum(v*v for v in data) / len(data))
        knee = max(1e-9, rms * 4)
        data = [.5 * math.tanh(v / knee) for v in data]
        with wave.open(str(out / (name + '.wav')), 'wb') as output:
            output.setparams((1, 2, SR, len(data), 'NONE', 'not compressed'))
            output.writeframes(struct.pack('<' + 'h' * len(data), *[round(max(-.95, min(.95, v)) * 32767) for v in data]))
    (here / 'movement-recipes.json').write_text(json.dumps(RECIPES, indent=2) + '\n')
