from pathlib import Path
import sys,json,subprocess,hashlib,wave,datetime,importlib.metadata
root=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test');p=root/'.cache/round47/audio-expansion';sys.path.insert(0,str(p/'encoder/packages'));import lameenc
out=p/'mp3-derivatives';out.mkdir(exist_ok=False);originals=p/'punk-resume/originals';rows=[]
files=json.loads((p/'punk-resume/originals.json').read_text());info={'package':'lameenc','version':importlib.metadata.version('lameenc'),'wheelSha256':'fb0d5bb76b09d8bf4e27f4824a72e4acd659bd4ec8dac2879fd5744f3d6d88fc','bitRateKbps':256,'sampleRate':44100,'channels':2,'quality':2,'transform':'Full duration, no trim/gain/normalization/fade/remix; OGG masters retained. Lossy derivative has normal MP3 frame padding.'}
for i,f in enumerate(x for x in files if x['name'].endswith('.ogg')):
 src=originals/f['name'];assert hashlib.sha256(src.read_bytes()).hexdigest()==f['sha256'];dst=out/(src.stem+'.mp3');pcm=out/(str(i)+'-input.wav');back=out/(str(i)+'-decoded.wav');row={'name':dst.name,'sourceName':f['name'],'sourceBytes':f['bytes'],'sourceSha256':f['sha256']}
 cmd=['/usr/bin/afconvert','-f','WAVE','-d','LEI16',str(src),str(pcm)];r=subprocess.run(cmd,capture_output=True,text=True,timeout=90);(out/(str(i)+'-decode-original.txt')).write_text(r.stdout+r.stderr);assert r.returncode==0,r.stderr
 encoder=lameenc.Encoder();encoder.set_bit_rate(256);encoder.set_in_sample_rate(44100);encoder.set_channels(2);encoder.set_quality(2);encoder.silence()
 with wave.open(str(pcm),'rb') as wav, dst.open('xb') as target:
  assert (wav.getnchannels(),wav.getframerate(),wav.getsampwidth())==(2,44100,2);frames=wav.getnframes();assert frames/44100<=720;row['sourceDecodedFrames']=frames;row['sourceDecodedDurationSeconds']=frames/44100
  while True:
   data=wav.readframes(16384)
   if not data:break
   target.write(encoder.encode(data));assert target.tell()<=32*1024*1024
  target.write(encoder.flush())
 b=dst.read_bytes();row['bytes']=len(b);row['sha256']=hashlib.sha256(b).hexdigest();assert row['bytes']<=32*1024*1024
 r=subprocess.run(['/usr/bin/afconvert','-f','WAVE','-d','LEI16',str(dst),str(back)],capture_output=True,text=True,timeout=90);(out/(str(i)+'-decode-mp3.txt')).write_text(r.stdout+r.stderr);assert r.returncode==0,r.stderr
 with wave.open(str(back),'rb') as wav:
  assert (wav.getnchannels(),wav.getframerate(),wav.getsampwidth())==(2,44100,2);row['mp3DecodedFrames']=wav.getnframes();row['mp3DecodedDurationSeconds']=wav.getnframes()/44100;assert abs(row['mp3DecodedDurationSeconds']-row['sourceDecodedDurationSeconds'])<0.2
 pcm.unlink();back.unlink();rows.append(row);(out/'receipt.json').write_text(json.dumps({'format':'revealline-authored-mp3-derivatives.v1','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'encoder':info,'tracks':rows,'limits':['Complete decode and duration/frame checks, not musical audition, seamless loops, loudness, mix or native/game playback acceptance.','Only owned temporary decoded WAV files removed after successful comparison; original OGG files unchanged.']},indent=2)+'\n');print(i+1,dst.name,row['bytes'],flush=True)
