"""Rebuild PCM masters and compact runtime bank from preserved CC0 sources. Requires ffmpeg."""
import sys

# Scoped regeneration preserves every historical master and unrelated bank row.
if "--destruction" in sys.argv:
    sys.argv.remove("--destruction")
    from produce_destruction import main
    main()
    raise SystemExit(0)

import pathlib, subprocess, shutil, json, hashlib, math, random, wave, struct
ROOT=pathlib.Path(__file__).resolve().parents[3]
HERE=pathlib.Path(__file__).resolve().parent
OUT=ROOT/'game/audio/effects'
OUT.mkdir(parents=True,exist_ok=True)
recipes={
'focus':('interface','tick_001',.12),'confirm':('ui','click1',.1),'cancel':('interface','back_001',.22),
'contact-metal':('impact','impactMetal_light_000',.22),'contact-wood':('impact','impactWood_light_000',.22),
'contact-glass':('impact','impactGlass_light_000',.28),'contact-soft':('impact','impactSoft_medium_000',.22),
'gate':('scifi','doorOpen_001',.6),'impact':('impact','impactPunch_medium_000',.26),
'paper':('interface','scroll_001',.16),'deploy':('scifi','forceField_001',.45),
'attack':('scifi','laserSmall_001',.3),'interference':('scifi','computerNoise_001',.35),
'erosion':('scifi','impactMetal_001',.36),'switch':('interface','switch_002',.22),
'pickup':('interface','pluck_002',.16),'closure':('ui','click4',.09),
}
for name,pack,sources,duration in [('confirm','ui',['click2','click3'],.1),('paper','interface',['scroll_002','scroll_003'],.16),('pickup','interface',['pluck_001','drop_001'],.16)]:
    for index,source in enumerate(sources,1): recipes[f'{name}-{index}']=(pack,source,duration)
for material in ['metal','wood','glass','soft']:
    pack,source,duration=recipes['contact-'+material]
    for variation in [1,2]:
        recipes[f'contact-{material}-{variation}']=(pack,source[:-3]+f'{variation:03d}',duration)
bank={}
for name,(pack,source,duration) in recipes.items():
    original=HERE/'originals'/pack/(source+'.ogg')
    if not original.exists():
        original.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(ROOT/'.cache/audio-sources'/pack/'Audio'/(source+'.ogg'),original)
        shutil.copy2(ROOT/'.cache/audio-sources'/pack/'License.txt',original.parent/'License.txt')
    dest=OUT/(name+'.wav')
    soft=name.split('-')[0] in ['focus','confirm','cancel','paper','pickup','closure','switch']
    cutoff=2400 if soft else 9500
    filters=f'atrim=0:{duration},asetpts=PTS-STARTPTS,highpass=f=65,lowpass=f={cutoff},afade=t=in:d=0.004,afade=t=out:st={max(.005,duration-.04)}:d=0.04,alimiter=limit=0.65:level=false'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(original),'-af',filters,'-ar','32000','-ac','1','-c:a','pcm_s16le',str(dest)],check=True)
    bank[name]={'file':dest.name,'loop':False}
# Original signatures and a quiet environmental flow bed.
# Recorded actor movement is produced separately below.
# These procedural sources are original; no melody is copied from music.
for name in ['flow','warning','start','retry','loss','respawn','win','reveal-small','reveal-medium','reveal-large','neutralized','reactivated']:
    loop=name=='flow'
    duration=4 if loop else {'win':1.35,'loss':.6,'warning':.42,'reveal-small':.2,'reveal-medium':.4,'reveal-large':.65}.get(name,.45)
    sr=32000;n=int(duration*sr); rng=random.Random(724); data=[]; smooth=0
    for i in range(n):
        t=i/sr;u=i/n
        env=1 if loop else min(1,t/.008)*max(0,1-u)**1.7
        smooth=.87*smooth+.13*rng.uniform(-1,1)
        if loop:
            # Environmental flow only; actors use recorded materials below.
            cutoff=700
            alpha=1-math.exp(-2*math.pi*cutoff/sr)
            filtered=alpha*rng.uniform(-1,1)+(1-alpha)*(data[-1] if data else 0)
            value=filtered
        elif name.startswith('reveal-'):
            # A soft brushed seal, with breadth rather than a repeating musical fanfare.
            sweep=math.sin(math.pi*u)**1.5
            value=smooth*.055*sweep
            for j,f in enumerate([196,294,392][:{'reveal-small':1,'reveal-medium':2,'reveal-large':3}[name]]):
                value+=.008*math.sin(2*math.pi*f*t)*math.exp(-t*(18+j*3))*min(1,t/.018)
        else:
            intervals={'start':[0,7,12], 'retry':[7,2,9], 'respawn':[0,12,7,16], 'warning':[1,1], 'loss':[7,3,0,-12], 'win':[0,4,7,12,16,19], 'neutralized':[7,12], 'reactivated':[12,1], 'reveal-small':[0,7], 'reveal-medium':[0,4,12], 'reveal-large':[0,4,7,12,16]}[name]
            value=0
            for j,step in enumerate(intervals):
                onset=j*duration/(len(intervals)+1); dt=t-onset
                if dt>=0:
                    f=({'warning':620,'loss':260,'reactivated':520}.get(name,440))*2**(step/12)
                    value+=(math.sin(2*math.pi*f*dt)+.2*math.sin(2*math.pi*f*(2.37 if name=='warning' else 2.01)*dt))*math.exp(-dt*(17 if name=='warning' else 12))*min(1,dt/.004)*.095
            value+=smooth*.045*math.exp(-t*16)
        data.append(max(-.8,min(.8,value*env)))
    if loop:
        # Equal-power-free linear overlap: no amplitude bump or gap at the seam.
        overlap=int(.08*sr)
        for k in range(overlap):
            blend=k/overlap
            data[k]=data[n-overlap+k]*(1-blend)+data[k]*blend
        data=data[:-overlap]; n=len(data)
    dest=OUT/(name+'.wav')
    with wave.open(str(dest),'wb') as w:
        w.setparams((1,2,sr,n,'NONE','not compressed'));w.writeframes(struct.pack('<'+'h'*n,*[int(v*32767) for v in data]))
    bank[name]={'file':dest.name,'loop':loop}
# Real material movement replaces the five synthetic actor noise beds.
from recorded_movement import build as build_recorded_movement, RECIPES as MOVEMENT_RECIPES
build_recorded_movement(HERE, OUT)
for name in MOVEMENT_RECIPES: bank[name]={'file':name+'.wav','loop':True}
# Original short ESC-style motor-resonance sequence. Not a hardware recording or branded tune.
for name, notes in [('esc-start', [(0,523.25,.12),(.17,659.25,.12),(.34,783.99,.14),(.58,1046.5,.18)]), ('esc-retry', [(0,783.99,.09),(.14,1046.5,.12)])]:
    sr=32000; n=int((notes[-1][0]+notes[-1][2]+.025)*sr); data=[]
    for i in range(n):
        t=i/sr; value=0
        for onset,freq,duration in notes:
            dt=t-onset
            if 0 <= dt < duration:
                env=min(1,dt/.004,(duration-dt)/.012)
                # Slightly detuned motor resonances with limited odd harmonics.
                for detune in [0.997,1.003]:
                    phase=2*math.pi*freq*detune*dt
                    value+=.085*env*(math.sin(phase)+.24*math.sin(3*phase)+.08*math.sin(5*phase))
        data.append(int(max(-.8,min(.8,value))*32767))
    dest=OUT/(name+'.wav')
    with wave.open(str(dest),'wb') as w:
        w.setparams((1,2,sr,n,'NONE','not compressed'));w.writeframes(struct.pack('<'+'h'*n,*data))
    bank[name]={'file':dest.name,'loop':False}
# Official EdgeTX speech is separately GPL-2.0 licensed, not part of the CC0 ingredients.
for locale in ['en','uk']:
    name='radio-armed-'+locale; dest=OUT/(name+'.wav')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(HERE/'originals/edgetx'/('armed-'+locale+'.wav')),
        '-af','highpass=f=100,lowpass=f=6500,afade=t=in:d=0.003,alimiter=limit=0.65:level=false',
        '-ar','32000','-ac','1','-c:a','pcm_s16le',str(dest)],check=True)
    bank[name]={'file':dest.name,'loop':False}
# Full-bank short-window calibration, including speech, ESC and action effects.
from normalize_bank import normalize
calibration={name:normalize(OUT/entry['file'],name,entry['loop']) for name,entry in bank.items()}
(HERE/'loudness-report.json').write_text(json.dumps(calibration,indent=2)+'\n')
for name,entry in bank.items():
    file=OUT/entry['file'];entry['bytes']=file.stat().st_size;entry['sha256']=hashlib.sha256(file.read_bytes()).hexdigest()
    master=HERE/'masters'/file.name;master.parent.mkdir(exist_ok=True);shutil.copy2(file,master)
(OUT/'bank.mjs').write_text('// Generated by authoring/audio/revealline-v1/produce.py.\nexport const EFFECT_BANK = '+json.dumps(bank,indent=2)+';\n')
(HERE/'recipes.json').write_text(json.dumps(recipes,indent=2)+'\n')
print('Bank:',len(bank),'assets,',sum(v['bytes'] for v in bank.values()),'bytes')
# A full rebuild also appends the newer material-specific destruction bank.
from produce_destruction import main as produce_destruction
produce_destruction()
