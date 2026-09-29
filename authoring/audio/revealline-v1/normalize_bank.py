"""House calibration for short effects; 50 ms RMS, not an integrated LUFS claim."""
import math
import struct
import wave

# Maximum rolling 50 ms RMS targets in dBFS. Silence cannot inflate gain.
TARGETS = {
    'focus': -37, 'confirm': -34, 'cancel': -34, 'paper': -36,
    'pickup': -34, 'closure': -35, 'switch': -34, 'contact': -33,
    'reveal': -35, 'gate': -32, 'impact': -31, 'deploy': -32,
    'attack': -31, 'interference': -33, 'erosion': -32,
    'warning': -29, 'start': -32, 'retry': -32, 'loss': -31,
    'respawn': -32, 'win': -31, 'neutralized': -33, 'reactivated': -32,
    'esc': -32, 'radio': -31,
    # Quieter playback buses/near gains already place movement below one-shots.
    'rotor': -26, 'motor': -26, 'wheels': -27, 'wings': -25, 'grain': -26, 'flow': -29,
}

def read(path):
    with wave.open(str(path), 'rb') as file:
        assert file.getnchannels() == 1 and file.getsampwidth() == 2
        rate = file.getframerate()
        data = [v / 32768 for v in struct.unpack('<' + 'h' * file.getnframes(), file.readframes(file.getnframes()))]
    return rate, data

def short_rms(data, rate):
    size = min(len(data), round(rate * .05))
    squared = [v*v for v in data]
    total = sum(squared[:size]); maximum = total
    for i in range(size, len(data)):
        total += squared[i] - squared[i-size]
        maximum = max(maximum, total)
    return math.sqrt(maximum / size)

def measure(path):
    rate, data = read(path)
    db = lambda v: 20 * math.log10(max(v, 1e-12))
    return {'rmsDbfs': db(math.sqrt(sum(v*v for v in data)/len(data))),
            'max50msDbfs': db(short_rms(data, rate)),
            'samplePeakDbfs': db(max(map(abs, data))), 'duration': len(data)/rate}

def normalize(path, name, loop):
    family = name.split('-')[0]
    target = TARGETS[family]  # New cues must get an explicit policy, never silently skip.
    rate, data = read(path)
    before = measure(path)
    amplitude = 10**(target/20)
    scale = amplitude / max(short_rms(data, rate), 1e-12)
    data = [v * scale for v in data]
    # Retain approved movement timbres. On one-shots, soften exceptional handling
    # spikes before final scalar calibration; do not hard clip transients.
    ceiling = 10**((-16 if loop else -20)/20)
    if not loop:
        knee = min(ceiling * .5, amplitude * 2.5)
        data = [knee * math.tanh(v / knee) for v in data]
    scale = min(amplitude / max(short_rms(data, rate), 1e-12), ceiling / max(max(map(abs, data)), 1e-12))
    data = [v * scale for v in data]
    with wave.open(str(path), 'wb') as file:
        file.setparams((1, 2, rate, len(data), 'NONE', 'not compressed'))
        file.writeframes(struct.pack('<' + 'h' * len(data), *[round(v * 32767) for v in data]))
    return {'target50msDbfs': target, 'before': before, 'after': measure(path)}
