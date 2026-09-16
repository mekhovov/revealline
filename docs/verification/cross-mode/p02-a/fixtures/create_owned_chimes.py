import sys, wave, math, struct, hashlib, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'audio-tool'))
import lameenc
rows=[]
for name,notes in [('rising-chime',(440,660)),('falling-chime',(660,440))]:
 pcm=b''.join(struct.pack('<h',int(6000*math.sin(2*math.pi*notes[i//44100]*i/44100)*min(1,i/1000,(88200-i)/1000))) for i in range(88200))
 enc=lameenc.Encoder(); enc.set_bit_rate(128); enc.set_in_sample_rate(44100); enc.set_channels(1); enc.set_quality(2)
 body=bytes(enc.encode(pcm))+bytes(enc.flush())
 p=Path(__file__).parent/(name+'.mp3'); p.write_bytes(body)
 rows.append({'file':p.name,'sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body),'notesHz':notes,'samples':88200,'sampleRate':44100,'peakPcm':6000,'rights':'Original programmatically generated test signal, CC0. Not an album track.','encoder':'lameenc1.8.4'})
(Path(__file__).parent/'owned-media.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(rows))
