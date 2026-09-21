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
VERSION = "sample-free-direction-renderer.3"
SR = 48000
BLOCK = SR // 2
MIB = 1024 ** 2
GIB = 1024 ** 3
INSTRUMENTS = {"bassA","bassB","sub","leadA","leadB","stab","arp",
               "kick","snare","hat","openhat","crash","tom"}
DRUMS = {"kick","snare","hat","openhat","crash","tom"}



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
    assert score["status"] == "sketch-unreviewed"
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
    """New patches for the two directions. All periodic sources are synthesized;
    no sampled instruments, downloaded waveforms or legacy-chip fidelity claim.
    """
    rng=np.random.default_rng(seed)
    f=440*2**((pitch-69+cents/100)/12)
    osamp=2 if inst not in DRUMS else 1
    sr=SR*osamp
    duration={"kick":.4,"snare":.32,"hat":.1,"openhat":.32,"crash":1.6,"tom":.42}.get(inst,held+.12)
    t=np.arange(round(duration*sr),dtype=np.float64)/sr
    phase=2*np.pi*f*t
    def saw(detune=0, width=None):
        out=np.zeros_like(t)
        for h in range(1,min(36,int(sr*.42/f))+1):
            amplitude=1/h if width is None else 2*np.sin(np.pi*h*width)/h
            out+=np.sin(phase*h*(1+detune)+(.2 if detune else 0))*amplitude
        return out*(2/np.pi)
    if inst=='bassA':
        x=.58*saw()+.27*saw(.0022,.38)+.16*np.sin(phase)
        x=np.tanh(x*2.7)/1.7
        x=lowpass(x,3400,sr,3)
        x*=envelope(t,held,.0015,.026)*(.8+.2*np.exp(-t/.035))
    elif inst=='bassB':
        x=.5*saw(.0018,.28)+.40*np.sin(phase+1.4*np.sin(phase*2))
        x=np.tanh(x*3)/1.65
        x=lowpass(x,4200,sr,3)
        x*=envelope(t,held,.0015,.028)
    elif inst=='sub':
        x=.85*np.sin(phase)*envelope(t,held,.004,.04)
    elif inst=='leadA':
        # Broad, stable harmonic body and modest detune replace a fading FM bell.
        x=.48*saw(-.0023)+.42*saw(.0023,.34)+.08*np.sin(phase/2)
        x=np.tanh(x*2.0)/1.4
        x=lowpass(x,6500,sr,3)
        x*=envelope(t,held,.003,.07)*(.8+.2*np.exp(-t/.055))
    elif inst=='leadB':
        # Sustained four-operator FM brass rather than a fast-decaying index.
        op4=.45*np.sin(phase*3)
        op3=np.sin(phase*2+op4)
        op2=(1.8+1.1*np.exp(-t/.08))*op3
        x=.72*np.sin(phase+op2)+.22*saw(0,.5)
        x=lowpass(np.tanh(x*1.8)/1.4,6900,sr)
        x*=envelope(t,held,.003,.045)
    elif inst=='stab':
        x=.52*saw(-.003,.42)+.4*saw(.003)
        x=lowpass(x,4600,sr,3)
        x*=np.exp(-t/.28)*envelope(t,held,.004,.065)
    elif inst=='arp':
        x=.52*saw(0,.25)+.3*np.sin(phase+1.1*np.sin(phase*2))
        x=lowpass(x,5600,sr,2)
        x*=np.exp(-t/.11)*envelope(t,held,.002,.035)
    elif inst=='kick':
        p=2*np.pi*(51*t+(156-51)*.016*(1-np.exp(-t/.016)))
        x=np.sin(p)*np.exp(-t/.105)+.23*np.sin(2*p)*np.exp(-t/.027)
        click=signal.sosfilt(signal.butter(2,[1800,6500],'bandpass',fs=sr,output='sos'),rng.normal(0,1,len(t)))
        x+=click*.40*np.exp(-t/.006)
        x=np.tanh(x*1.4)/1.15
    elif inst=='snare':
        noise=signal.sosfilt(signal.butter(2,[950,10500],'bandpass',fs=sr,output='sos'),rng.normal(0,1,len(t)))
        p=2*np.pi*(185*t+20*.012*(1-np.exp(-t/.012)))
        x=.58*np.sin(p)*np.exp(-t/.065)+.22*np.sin(p*1.78)*np.exp(-t/.032)
        gate=np.minimum(1,np.maximum(0,.15-t)/.035)
        x+=.67*noise*np.exp(-t/.065)*gate
        x=np.tanh(x*1.6)/1.2
    elif inst in {'hat','openhat','crash'}:
        x=.6*rng.normal(0,1,len(t))
        for hz in [3109,4217,5531,6949,8339]: x+=.1*np.sin(2*np.pi*hz*t)
        x=signal.sosfilt(signal.butter(2,5200 if inst!='crash' else 3200,'highpass',fs=sr,output='sos'),x)
        x*=np.exp(-t/{'hat':.024,'openhat':.115,'crash':.39}[inst])
    else:
        p=2*np.pi*f*(t+.03*(1-np.exp(-t/.02)))
        x=np.sin(p)*np.exp(-t/.13)+.14*rng.normal(0,1,len(t))*np.exp(-t/.011)
    if osamp>1: x=signal.resample_poly(x,1,osamp)
    edge=min(24,len(x)//2)
    x[:edge]*=np.linspace(0,1,edge)
    x[-edge:]*=np.linspace(1,0,edge)
    return np.asarray(x,dtype=np.float32)


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
    kick_times=np.array([e["beat"]*60/score["bpm"] for e in events if e["instrument"]=="kick"])
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
        drums = np.zeros_like(dry)
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
            wet = {'bassA':0,'bassB':0,'sub':0,'kick':0,'hat':0,'snare':.065,
                   'leadA':.10,'leadB':.09,'stab':.10,'arp':.13}.get(e['instrument'],.10)
            active.append((pos,cache[key],gains,wet,e['instrument']))
            cursor += 1
        keep = []
        for start, samples, gains, wet, inst in active:
            a,b = max(offset,start),min(offset+count,start+len(samples))
            if b>a:
                stereo = samples[a-start:b-start,None]*gains
                if inst in DRUMS:
                    drums[a-offset:b-offset] += stereo
                else:
                    # Short deterministic kick ducking preserves attack space.
                    times=(a+np.arange(b-a))/SR
                    duck=np.ones(len(times))
                    for onset in kick_times[(kick_times<=times[-1]) & (kick_times>=times[0]-.16)]:
                        elapsed=times-onset
                        duck=np.minimum(duck,np.where(elapsed>=0,1-.40*np.exp(-np.maximum(0,elapsed)/.045),1))
                    dry[a-offset:b-offset] += stereo*duck[:,None]
                send[a-offset:b-offset] += stereo*wet
            if start+len(samples)>offset+count:
                keep.append((start,samples,gains,wet,inst))
        active = keep
        dry += 1.05*np.tanh(drums/1.05)
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
    composer_hash = digest(ROOT/'compose_directions.py')
    score = json.loads(score_path.read_text())
    validate(score)
    scratch.mkdir(parents=True,exist_ok=True)
    out = ROOT/'sketches'/score['slug']
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
    if (renderer_hash != digest(Path(__file__)) or score_hash != digest(score_path)
            or composer_hash != digest(ROOT/'compose_directions.py')):
        raise RuntimeError('Production source changed during rendering; no receipt issued.')
    receipt = dict(format='revealline-local-recording.v1',status='sketch-unreviewed',
        title=score['title'],id='sketch.'+score['slug'],rendererVersion=VERSION,
        rendererSha256=renderer_hash,scoreSha256=score_hash,composerSha256=composer_hash,seed=score['seed'],
        sources=dict(renderer=Path(__file__).name,composer='compose_directions.py',score=str(score_path.relative_to(ROOT))),
        tools=dict(python=sys.version.split()[0],numpy=np.__version__,
                   scipy=importlib.metadata.version('scipy'),pyloudnorm=importlib.metadata.version('pyloudnorm'),
                   encoder='lameenc '+importlib.metadata.version('lameenc'),converter='/usr/bin/afconvert'),
        master=dict(path='master.flac',bytes=flac_path.stat().st_size,sha256=digest(flac_path),
                    bitsPerSample=24,pcm24Sha256=pcm_hash.hexdigest(),losslessRoundTripVerified=True,**master_metrics),
        mp3=dict(path='preview.mp3',bytes=mp3_path.stat().st_size,sha256=digest(mp3_path),
                 bitrateKbps=256,**encoded_metrics),
        measurementMethod='pyloudnorm BS.1770 integrated loudness; scipy resample_poly 4x overlapping peak estimate, not a certified true-peak meter.',
        compositionCountContribution=0,
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
