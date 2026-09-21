"""Bounded, deterministic offline synthesis, mastering and encoded verification.

Requires already-installed NumPy/SciPy/pyloudnorm/lameenc and macOS afconvert.
No network, samples, model weights, hosted generation or runtime publication.
"""
import argparse
import hashlib
import importlib.metadata
import json
import math
import os
import resource
from pathlib import Path
import shutil
import subprocess
import sys
import time
import wave
from collections import OrderedDict

import numpy as np
from scipy import signal
from scipy.io import wavfile
import pyloudnorm as pyln

ROOT = Path(__file__).resolve().parent
VERSION = "sample-free-renderer.1.1"
SR = 48000
BLOCK = SR // 2
MIB = 1024 ** 2
GIB = 1024 ** 3
INSTRUMENTS = {"pad", "keys", "bass", "pluck", "clean", "guitar", "lead", "wind",
               "kick", "snare", "clap", "hat", "ride", "crash", "tom", "rim", "hand"}


def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as stream:
        for part in iter(lambda: stream.read(MIB), b""):
            h.update(part)
    return h.hexdigest()


def tree_bytes(path):
    return sum(p.stat().st_size for p in path.rglob("*") if p.is_file()) if path.exists() else 0


def resource_guard(scratch, future=0):
    free = shutil.disk_usage(ROOT).free
    if free - future < GIB:
        raise RuntimeError("Production stopped: preserve at least 1 GiB free disk.")
    if tree_bytes(scratch) + future > 256 * MIB:
        raise RuntimeError("Production stopped: scratch exceeds 256 MiB.")
    if tree_bytes(ROOT) + tree_bytes(scratch) + future > 650 * MIB:
        raise RuntimeError("Production stopped: active production exceeds 650 MiB.")


def validate(score):
    assert score["format"] == "revealline-local-score.v1"
    assert score["status"] == "candidate-unreviewed"
    assert score["sampleRate"] == SR and 50 <= score["bpm"] <= 220
    assert score["events"] and len(score["events"]) < 20000
    for e in score["events"]:
        assert e["instrument"] in INSTRUMENTS
        assert 0 <= e["beat"] < score["bars"] * score.get("beatsPerBar", 4)
        assert 0 < e["durationBeats"] <= 8 and 0 <= e["pitch"] <= 120
        assert 0 < e["gain"] <= 1 and -1 <= e["pan"] <= 1
    assert [s["startBar"] for s in score["sections"]] == sorted(s["startBar"] for s in score["sections"])
    assert sum(s["bars"] for s in score["sections"]) == score["bars"]


def envelope(t, held, attack=.006, release=.12):
    return np.minimum(1, t / attack) * np.clip((held + release - t) / release, 0, 1)


def lowpass(x, hz, sr, order=2):
    return signal.sosfilt(signal.butter(order, hz, fs=sr, output="sos"), x)


def voice(inst, pitch, held, seed, articulation="normal", cents=0):
    """Modal strings retain independent partial damping and pick-position excitation.

    Distorted strings are synthesized at 4x sample rate before nonlinear drive
    and cabinet filtering, then polyphase downsampled. This remains a synthetic
    instrument, not an acoustic-instrument authenticity or realism certificate.
    """
    rng = np.random.default_rng(seed)
    frequency = 440 * 2 ** ((pitch - 69 + cents / 100) / 12)
    oversample = 4 if inst == "guitar" else 1
    sr = SR * oversample
    tail = .65 if inst in {"pluck", "clean", "keys"} else .25
    seconds = min(8.2, held + tail)
    if inst in {"crash", "ride"}: seconds = min(2.8, held + 1)
    if inst in {"kick", "snare", "clap", "tom", "hand", "rim", "hat"}:
        seconds = {"kick":.42,"snare":.38,"clap":.28,"tom":.55,"hand":.25,"rim":.15,"hat":.16}[inst]
    t = np.arange(max(2, round(seconds * sr)), dtype=np.float64) / sr
    if inst in {"guitar", "clean", "pluck"}:
        muted = articulation == "mute"
        fundamental_decay = .105 if muted else .9 if inst == "guitar" else 1.55 if inst == "pluck" else 2.5
        pick = .12 + rng.uniform(-.018, .018)
        x = np.zeros_like(t)
        limit = min(48 if inst == "guitar" else 26, int(sr * .45 / frequency))
        for h in range(1, limit + 1):
            stiff = 1 + (0.000013 if inst == "pluck" else .000003) * h * h
            decay = fundamental_decay / (1 + .1 * h ** 1.3)
            amplitude = np.sin(np.pi * h * pick) / h ** (1.0 if inst == "guitar" else 1.35)
            x += amplitude * np.sin(2 * np.pi * frequency * h * stiff * t) * np.exp(-t / decay)
        x *= envelope(t, held, .0015, .035 if muted else .1)
        if inst == "guitar":
            # Short pick transient and asymmetric drive, then speaker bandwidth.
            x += .055 * rng.normal(0, 1, len(t)) * np.exp(-t / .005)
            x = np.tanh(x * 5.5 + .08) - math.tanh(.08)
            x = signal.sosfilt(signal.butter(2, 80, "highpass", fs=sr, output="sos"), x)
            x = lowpass(x, 5600, sr, 3)
            x = signal.resample_poly(x, 1, oversample)
        else:
            x = lowpass(x, 8500 if inst == "pluck" else 5600, sr)
    elif inst == "pad":
        x = np.zeros_like(t)
        for detune in [-.0025, .0025]:
            for h in range(1, 7):
                x += np.sin(2*np.pi*frequency*(1+detune)*h*t + h*.37) / (h ** 1.7 * 2)
        x *= envelope(t, held, .45, .25) * (.8 + .2*np.sin(t*2*np.pi*.31))
    elif inst == "keys":
        modulation = 2.3 * np.exp(-t / .3) + .18
        x = np.sin(2*np.pi*frequency*t + modulation*np.sin(2*np.pi*frequency*2*t))
        x += .22*np.sin(2*np.pi*frequency*3*t)*np.exp(-t/.22)
        x *= np.exp(-t/1.2)*envelope(t,held,.003,.45)
    elif inst == "lead":
        phase = 2*np.pi*frequency*t + .028*np.sin(2*np.pi*5.4*t)*np.minimum(1,t/.35)
        x = np.sin(phase + (1.1 + 1.7*np.exp(-t/.075))*np.sin(phase*2))
        x += .22*np.sin(phase*.5)
        x = lowpass(x, 6200, sr)
        x *= envelope(t,held,.012,.1) * (.8 + .2*np.exp(-t/.08))
    elif inst == "wind":
        vibrato = .028 * np.sin(2*np.pi*5.2*t) * np.minimum(1,t/.3)
        phase = 2*np.pi*frequency*t + vibrato
        x = np.sin(phase) + .25*np.sin(phase*2)+.11*np.sin(phase*3)
        x += lowpass(rng.normal(0,1,len(t)), 4200, sr)*.065
        x *= envelope(t,held,.028,.10) * (.9+.1*np.sin(2*np.pi*1.7*t))
    elif inst == "bass":
        phase = 2*np.pi*frequency*t
        x = np.sin(phase)+.34*np.sin(phase*2)+.15*np.sin(phase*3)*np.exp(-t/.13)
        x *= envelope(t,held,.006,.065)*(.72+.28*np.exp(-t/.09))
    elif inst == "kick":
        phase = 2*np.pi*(46*t + (125-46)*.023*(1-np.exp(-t/.023)))
        x = np.sin(phase)*np.exp(-t/.13)
        x += .2*rng.normal(0,1,len(t))*np.exp(-t/.002)
    elif inst in {"snare", "clap"}:
        noise = rng.normal(0,1,len(t))
        noise = signal.sosfilt(signal.butter(2,[1300,11000],"bandpass",fs=sr,output="sos"),noise)
        if inst == "snare":
            x = .52*noise*np.exp(-t/.085)+.50*np.sin(2*np.pi*185*t)*np.exp(-t/.065)
            x += .12*np.sin(2*np.pi*330*t)*np.exp(-t/.045)
        else:
            bursts = sum(np.where(t>p,np.exp(-np.maximum(0,t-p)/.018),0) for p in [0,.012,.025])
            x = noise*(bursts*.26 + .22*np.exp(-t/.055))
    elif inst in {"hat", "ride", "crash"}:
        noise = rng.normal(0,1,len(t))
        x = noise*.65
        for hz in [3217,4381,5693,7319,9103]:
            x += np.sin(2*np.pi*hz*t + rng.uniform(0,6.28))*.11
        x = signal.sosfilt(signal.butter(2,6000 if inst=="hat" else 3200,"highpass",fs=sr,output="sos"),x)
        x *= np.exp(-t/({"hat":.037,"ride":.36,"crash":.7}[inst]))
    elif inst in {"tom", "hand"}:
        f = frequency if inst=="tom" else 180
        phase = 2*np.pi*f*(t+.018*(1-np.exp(-t/.035)))
        x = np.sin(phase)*np.exp(-t/(.16 if inst=="tom" else .065))
        x += .25*rng.normal(0,1,len(t))*np.exp(-t/.008)
    else:  # Rim: damped wood resonances and a very short noise tick.
        x = (np.sin(2*np.pi*1700*t)+.7*np.sin(2*np.pi*2400*t))*np.exp(-t/.013)
        x += .12*rng.normal(0,1,len(t))*np.exp(-t/.002)
    # Every event has a zero-edge attack/release, including synthesized cymbals.
    edge = min(240,len(x)//2)
    x[:edge] *= np.linspace(0,1,edge)
    x[-edge:] *= np.linspace(1,0,edge)
    return np.asarray(x, dtype=np.float32)


class Room:
    """Stereo early reflections and diffuse late taps; bounded 0.8s send buffer."""
    def __init__(self):
        self.history = np.zeros((round(.8*SR),2),np.float32)
    def apply(self, source):
        joined = np.concatenate([self.history,source])
        n = len(self.history)
        result = np.zeros_like(source)
        for i, seconds in enumerate([.031,.047,.071,.109,.151,.211,.283,.359,.443,.557,.677,.761]):
            delay = round(seconds*SR)
            reflected = joined[n-delay:n-delay+len(source)]
            result += reflected[:,::-1] * ((-1 if i%3==0 else 1)*.19*math.exp(-seconds*3))
        self.history = joined[-n:].copy()
        return result


def render(score, raw_path, scratch):
    validate(score)
    seconds = score["bars"] * score.get("beatsPerBar", 4) * 60 / score["bpm"] + score["tailSeconds"]
    frames = round(seconds*SR)
    resource_guard(scratch,frames*8)
    output = np.memmap(raw_path,dtype="float32",mode="w+",shape=(frames,2))
    events = score["events"]
    cursor = 0
    active = []
    room = Room()
    cache = OrderedDict()
    cache_bytes = 0
    beat_seconds = 60/score["bpm"]
    hp = signal.butter(2,28,"highpass",fs=SR,output="sos")
    zi = np.zeros((len(hp),2,2))
    for offset in range(0,frames,BLOCK):
        count = min(BLOCK,frames-offset)
        dry = np.zeros((count,2),np.float32)
        send = np.zeros_like(dry)
        while cursor<len(events) and round(events[cursor]["beat"]*beat_seconds*SR)<offset+count:
            e = events[cursor]
            variation = cursor % 5
            key = (e['instrument'],e['pitch'],e['durationBeats'],e['articulation'],e.get('cents',0),variation)
            if key not in cache:
                samples = voice(e['instrument'],e['pitch'],e['durationBeats']*beat_seconds,
                                score['seed']*100+variation,e['articulation'],e.get('cents',0))
                while cache and cache_bytes+samples.nbytes>24*MIB:
                    _, previous = cache.popitem(last=False)
                    cache_bytes -= previous.nbytes
                cache[key] = samples
                cache_bytes += samples.nbytes
            else:
                cache.move_to_end(key)
            pos = round(e['beat']*beat_seconds*SR)
            pan = (e['pan']+1)*np.pi/4
            gains = np.array([np.cos(pan),np.sin(pan)],dtype=np.float32)*e['gain']
            wet = .0 if e['instrument'] in {'bass','kick','hat'} else .20 if e['instrument']=='guitar' else .45
            active.append((pos,cache[key],gains,wet))
            cursor += 1
        keep = []
        for start, samples, gains, wet in active:
            a,b = max(offset,start),min(offset+count,start+len(samples))
            if b>a:
                stereo = samples[a-start:b-start,None]*gains
                dry[a-offset:b-offset] += stereo
                send[a-offset:b-offset] += stereo*wet
            if start+len(samples)>offset+count:
                keep.append((start,samples,gains,wet))
        active = keep
        dry += room.apply(send)
        dry,zi = signal.sosfilt(hp,dry,axis=0,zi=zi)
        # Gentle bus saturation before final calibrated loudness/ceiling treatment.
        dry = .9*np.tanh(dry/.9)
        times = (offset+np.arange(count))/SR
        fade = np.minimum(1,times/.025)*np.minimum(1,np.maximum(0,seconds-times)/1.2)
        output[offset:offset+count] = dry*fade[:,None]
        if offset % (SR*20)==0:
            output.flush()
            resource_guard(scratch)
            print(f"render {score['slug']}: {offset/SR:.0f}/{seconds:.0f}s",flush=True)
    output.flush()
    return output


def true_peak(data):
    """4x scipy resample_poly estimate, with overlapping 128-frame margins."""
    peak = 0.0
    for offset in range(0,len(data),SR):
        start = max(0,offset-128)
        end = min(len(data),offset+SR+128)
        block = signal.resample_poly(np.asarray(data[start:end],dtype=np.float64),4,1,axis=0)
        a = (offset-start)*4
        b = min(len(block),(min(len(data),offset+SR)-start)*4)
        peak = max(peak,float(np.max(np.abs(block[a:b]))))
    return 20*np.log10(max(peak,1e-12))


def metrics(data):
    if not np.isfinite(data).all():
        raise ValueError("Non-finite PCM")
    loudness = float(pyln.Meter(SR).integrated_loudness(data))
    return dict(integratedLufs=round(loudness,3),estimatedTruePeakDbtp=round(true_peak(data),3),
                samplePeakDbfs=round(20*np.log10(max(float(np.max(np.abs(data))),1e-12)),3),
                durationSeconds=round(len(data)/SR,5),sampleRate=SR,channels=2,
                rmsDbfs=round(20*np.log10(max(float(np.sqrt(np.mean(np.square(data,dtype=np.float64)))),1e-12)),3))


def pcm24(data):
    integer = np.rint(np.clip(data,-1,1-2**-23)*8388608).astype(np.int32)
    return np.column_stack([(integer.reshape(-1)>>s)&255 for s in [0,8,16]]).astype(np.uint8).tobytes()


def read_pcm(path):
    rate,data = wavfile.read(path)
    if rate!=SR or data.ndim!=2 or data.shape[1]!=2:
        raise ValueError("Expected stereo 48 kHz decoded PCM")
    if np.issubdtype(data.dtype,np.integer):
        data = data.astype(np.float32)/(-float(np.iinfo(data.dtype).min))
    return np.asarray(data,dtype=np.float32)


def convert(*args):
    subprocess.run(['/usr/bin/afconvert',*map(str,args)],check=True,capture_output=True)


def produce(score_path, scratch, encoder_path):
    renderer_hash = digest(Path(__file__))
    score_hash = digest(score_path)
    composer_hash = digest(ROOT/'compose.py')
    score = json.loads(score_path.read_text())
    validate(score)
    scratch.mkdir(parents=True,exist_ok=True)
    out = ROOT/'candidates'/score['slug']
    out.mkdir(parents=True,exist_ok=True)
    receipt_path = out/'receipt.json'
    if receipt_path.exists():
        raise RuntimeError(f"Existing candidate receipt: {receipt_path}; preserve it before a new revision.")
    resource_guard(scratch,100*MIB)
    raw_path,wav_path,decoded_path = [scratch/n for n in ['render.f32','master.wav','decoded.wav']]
    if any(p.exists() for p in [raw_path,wav_path,decoded_path]):
        raise RuntimeError("Scratch already contains an unfinished render; inspect before continuing.")
    started = time.time()
    data = render(score,raw_path,scratch)
    raw_lufs = float(pyln.Meter(SR).integrated_loudness(data))
    gain = 10**((-16-raw_lufs)/20)
    ceiling = .78
    # Calibrate bounded soft limiting by integrated loudness, preserving musical dynamics.
    for _ in range(4):
        mastered = ceiling*np.tanh(np.asarray(data)*gain/ceiling)
        achieved = float(pyln.Meter(SR).integrated_loudness(mastered))
        gain *= 10**((-16-achieved)/20)
        if abs(achieved+16)<.05:
            break
    master_metrics = metrics(mastered)
    resource_guard(scratch,len(data)*6)
    pcm_hash = hashlib.sha256()
    with wave.open(str(wav_path),'wb') as wav:
        wav.setnchannels(2); wav.setsampwidth(3); wav.setframerate(SR)
        for offset in range(0,len(mastered),BLOCK):
            body = pcm24(mastered[offset:offset+BLOCK])
            pcm_hash.update(body)
            wav.writeframesraw(body)
    del data,mastered
    raw_path.unlink()
    resource_guard(scratch,wav_path.stat().st_size*2)
    flac_path = out/'master.flac'
    convert(wav_path,flac_path,'-f','flac','-d','flac','-q','127')
    convert(flac_path,decoded_path,'-f','WAVE','-d','LEI24')
    with wave.open(str(decoded_path),'rb') as wav:
        decoded_hash = hashlib.sha256(wav.readframes(wav.getnframes())).hexdigest()
    if decoded_hash!=pcm_hash.hexdigest():
        raise RuntimeError("FLAC round-trip PCM hash mismatch")
    decoded_path.unlink()
    sys.path.insert(0,str(encoder_path))
    import lameenc
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(256); encoder.set_in_sample_rate(SR)
    encoder.set_channels(2); encoder.set_quality(2)
    mp3_path = out/'preview.mp3'
    quantizer = np.random.default_rng(score['seed']+999)
    source = read_pcm(wav_path)
    with open(mp3_path,'wb') as mp3:
        for offset in range(0,len(source),BLOCK):
            block = source[offset:offset+BLOCK]
            dither = (quantizer.random(block.shape)-quantizer.random(block.shape)) / 65536
            integer = np.rint(np.clip(block+dither,-1,.999969)*32768).astype('<i2')
            mp3.write(encoder.encode(integer.tobytes()))
        mp3.write(encoder.flush())
    del source
    wav_path.unlink()
    convert(mp3_path,decoded_path,'-f','WAVE','-d','LEF32')
    decoded = read_pcm(decoded_path)
    encoded_metrics = metrics(decoded)
    del decoded
    decoded_path.unlink()
    if not -17<=encoded_metrics['integratedLufs']<=-15 or encoded_metrics['estimatedTruePeakDbtp']>-1:
        raise RuntimeError(f"Encoded audio misses target: {encoded_metrics}")
    resource_guard(scratch)
    if renderer_hash != digest(Path(__file__)) or score_hash != digest(score_path):
        raise RuntimeError('Production source changed during rendering; no receipt issued.')
    receipt = dict(format='revealline-local-recording.v1',status='candidate-unreviewed',
        title=score['title'],id='original.'+score['slug'],rendererVersion=VERSION,
        rendererSha256=renderer_hash,scoreSha256=score_hash,composerSha256=composer_hash,seed=score['seed'],
        tools=dict(python=sys.version.split()[0],numpy=np.__version__,
                   scipy=importlib.metadata.version('scipy'),pyloudnorm=importlib.metadata.version('pyloudnorm'),
                   encoder='lameenc '+importlib.metadata.version('lameenc'),converter='/usr/bin/afconvert'),
        master=dict(path='master.flac',bytes=flac_path.stat().st_size,sha256=digest(flac_path),
                    bitsPerSample=24,pcm24Sha256=pcm_hash.hexdigest(),losslessRoundTripVerified=True,**master_metrics),
        mp3=dict(path='preview.mp3',bytes=mp3_path.stat().st_size,sha256=digest(mp3_path),
                 bitrateKbps=256,**encoded_metrics),
        measurementMethod='pyloudnorm BS.1770 integrated loudness; scipy resample_poly 4x overlapping peak estimate, not a certified true-peak meter.',
        review=dict(fullListening='pending',inGameMix='pending',culturalAccuracy=score['culturalReview'],
                    technical='measured-pass',originality='original authored score; independent review pending',publication='not-approved'),
        provenance='Only authored score and local synthesis. No external recordings, samples, models or hosted generation.',
        productionBytes=tree_bytes(ROOT),maximumResidentBytes=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        elapsedSeconds=round(time.time()-started,2))
    receipt_path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(receipt,ensure_ascii=False),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('score',type=Path)
    parser.add_argument('--scratch',type=Path,required=True)
    parser.add_argument('--encoder-path',type=Path,required=True)
    args=parser.parse_args()
    produce(args.score.resolve(),args.scratch.resolve(),args.encoder_path.resolve())
