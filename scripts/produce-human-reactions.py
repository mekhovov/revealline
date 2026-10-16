"""Produce eight bounded acted CC0 reactions; no package install or full audio rebuild.
--intake fetches the small source archive once. Other runs use pinned originals only.
"""
from pathlib import Path
import array, base64, hashlib, io, json, math, re, subprocess, sys, wave, zipfile
ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'authoring/audio/human-reactions-v1'
OUT = ROOT / 'game/audio/effects'
PAGE = 'https://opengameart.org/content/death-sounds-0'
ARCHIVE = 'https://opengameart.org/sites/default/files/exewinDeathSoundsPack.zip'
SELECTED = [1, 2, 3, 4, 7, 8, 9, 10]
sha = lambda data: hashlib.sha256(data).hexdigest()
def fetch(url):
    return subprocess.check_output(['curl', '-fLsS', '--max-time', '30', '--max-filesize', '1048576', url])
if '--intake' in sys.argv:
    SOURCE.mkdir(parents=True, exist_ok=True)
    data = fetch(ARCHIVE)
    z = zipfile.ZipFile(io.BytesIO(data))
    page = fetch(PAGE)
    if b'creativecommons.org/publicdomain/zero/1.0/' not in page:
        raise RuntimeError('Source no longer identifies the CC0 license.')
    (SOURCE / 'source-page.html').write_bytes(page)
    license_bytes = fetch('https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt')
    (SOURCE / 'CC0-1.0.txt').write_bytes(license_bytes)
    ledger = dict(author='Exewin', source=PAGE, download=ARCHIVE, license='CC0-1.0',
                  archiveSha256=sha(data), licenseSha256=sha(license_bytes), sourcePageSha256=sha(page), files={})
    for number in SELECTED:
        name = f'{number}.ogg'; original = z.read(f'exewinDeathSoundsPack/{name}')
        (SOURCE / name).write_bytes(original)
        ledger['files'][name] = dict(bytes=len(original), sha256=sha(original))
    (SOURCE / 'sources.json').write_text(json.dumps(ledger, indent=2) + '\n')
ledger = json.loads((SOURCE / 'sources.json').read_text())
for name, key in [('CC0-1.0.txt','licenseSha256'), ('source-page.html','sourcePageSha256')]:
    assert sha((SOURCE/name).read_bytes()) == ledger[key]
report, packed, rows = {}, {}, []
for index, number in enumerate(SELECTED, 1):
    name = f'human-reaction-{index}'; original = (SOURCE / f'{number}.ogg').read_bytes()
    assert sha(original) == ledger['files'][f'{number}.ogg']['sha256']
    decoded = subprocess.run(['ffmpeg','-v','error','-i','pipe:0','-ac','1','-ar','48000','-f','f32le','pipe:1'], input=original, capture_output=True, check=True).stdout
    samples = array.array('f', decoded)
    # Trim recording silence, retain a short lead-in and natural release. The
    # longest take uses at most 5% resampling to meet the shared 700 ms ceiling.
    active = [i for i, value in enumerate(samples) if abs(value) >= 0.015]
    first, last = max(0, active[0]-144), min(len(samples), active[-1]+960)
    samples = samples[first:last]
    if len(samples) > 33600:
        ratio = (len(samples)-1)/33599
        samples = array.array('f', (samples[min(len(samples)-1, round(i*ratio))] for i in range(33600)))
    # Remove sub-bass rumble; bounded edge fades prevent edited clicks.
    high, prior, prior_out = [], 0, 0
    coeff = math.exp(-2*math.pi*80/48000)
    for value in samples:
        out = coeff*(prior_out+value-prior); high.append(out); prior,prior_out=value,out
    count=len(high)
    samples=array.array('f', (v*min(1,i/144,(count-1-i)/960) for i,v in enumerate(high)))
    peak=max(abs(v) for v in samples); win=2400; energy=maximum=0
    for i,v in enumerate(samples):
        energy += v*v
        if i>=win: energy-=samples[i-win]**2
        maximum=max(maximum,energy)
    rms=math.sqrt(maximum/min(win,len(samples)))
    gain=min(.1/peak, 10**(-30/20)/rms)
    pcm=array.array('h',(round(max(-1,min(1,v*gain))*32767) for v in samples))
    buf=io.BytesIO()
    with wave.open(buf,'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(48000);w.writeframes(pcm.tobytes())
    output=buf.getvalue();(OUT/f'{name}.wav').write_bytes(output)
    portable=subprocess.run(['ffmpeg','-v','error','-fflags','+bitexact','-i','pipe:0','-map_metadata','-1','-c:a','libmp3lame','-b:a','64k','-write_xing','0','-flags:a','+bitexact','-f','mp3','pipe:1'],input=output,capture_output=True,check=True).stdout
    packed[name]=dict(mime='audio/mpeg', base64=base64.b64encode(portable).decode(), duration=len(samples)/48000)
    report[name]=dict(source=f'{number}.ogg', sourceSha256=sha(original), sha256=sha(output), bytes=len(output), duration=len(samples)/48000, portableBytes=len(portable), portableSha256=sha(portable), peakDbfs=20*math.log10(peak*gain), maximum50msDbfs=20*math.log10(rms*gain), listeningReview='pending')
    rows.append(f"  '{name}': {{\n    file: '{name}.wav',\n    loop: false,\n    bytes: {len(output)},\n    sha256: '{sha(output)}',\n  }},")
bank=OUT/'bank.mjs';text=bank.read_text();begin='  // BEGIN CC0 human reaction bank';end='  // END CC0 human reaction bank';block=begin+'\n'+'\n'.join(rows)+'\n'+end
if begin in text: text=text[:text.index(begin)]+block+text[text.index(end)+len(end):]
else: text=text.replace('\n};', '\n'+block+'\n};')
bank.write_text(text)
portable=ROOT/'game/audio/human-reactions';portable.mkdir(parents=True,exist_ok=True)
(portable/'portable.mjs').write_text('// Generated by scripts/produce-human-reactions.py. Exewin CC0; see authoring/audio/human-reactions-v1/sources.json.\n// Compact identical performances for existing optional-package source projections.\n// prettier-ignore\nexport const HUMAN_REACTION_BANK = Object.freeze('+json.dumps(packed,separators=(',',':'))+');\n')
report['production']=dict(ffmpeg=subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0], scriptSha256=sha(Path(__file__).read_bytes()), processing='48kHz mono PCM16; trim >0.015 plus3ms/20ms; atmost700ms;80Hz highpass;3ms/20ms fades;peak<=-20dBFS;max50msRMS<=-30dBFS; portableMP3-64kbps')
(SOURCE/'production.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(dict(clips=8, runtimeBytes=sum(v['bytes'] for k,v in report.items() if k!='production'),portableBytes=sum(v['portableBytes'] for k,v in report.items() if k!='production'))))
