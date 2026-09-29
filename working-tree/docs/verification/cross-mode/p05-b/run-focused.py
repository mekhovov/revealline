import hashlib,json,subprocess,time,datetime,shutil,resource,sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
out=root/'.cache/p05b'
files=['menu-style-preferences','menu-appearance','menu-style-host','display-preferences-host','couch-shell','couch-navigation','coop-host','title-entry-host']
paths=sorted(p for folder in ['game','authoring/motion-lab','authoring/production'] for p in (root/folder).rglob('*') if p.is_file() and not p.is_symlink())
def pins():
 return [{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]
def save(name,value):
 p=out/name
 with p.open('x') as f:json.dump(value,f,indent=2);f.write('\n')
def limit():resource.setrlimit(resource.RLIMIT_FSIZE,(8*1024*1024,8*1024*1024))
assert shutil.disk_usage(root).free>256*1024*1024
before=pins();save('focused-inputs-before.json',before)
runs=[]
for version in ['22.22.2','20.19.5']:
 node=f'/Users/oleksandr.mekhovov/.local/share/mise/installs/node/{version}/bin/node'
 log=out/f'whole-final-node{version[:2]}.log';command=[node,'--test','--test-concurrency=2',*[f'game/test/{name}.test.mjs' for name in files]]
 start=time.monotonic();at=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with log.open('xb') as f:result=subprocess.run(command,cwd=root,stdout=f,stderr=subprocess.STDOUT,preexec_fn=limit)
 runs.append({'node':version,'command':command,'startedAt':at,'seconds':round(time.monotonic()-start,6),'exitCode':result.returncode,'log':str(log.relative_to(root)),'logBytes':log.stat().st_size,'logSha256':hashlib.sha256(log.read_bytes()).hexdigest()})
 print(json.dumps(runs[-1]),flush=True)
 if result.returncode:break
after=pins();save('focused-inputs-after.json',after)
save('focused-execution.json',{'files':files,'runs':runs,'inputCount':len(before),'inputBytes':sum(p['bytes'] for p in before),'inputsUnchanged':before==after,'sourceScope':'Eight complete actual files; finite DOM/Canvas boundary, not native/browser/public qualification.'})
sys.exit(0 if len(runs)==2 and all(r['exitCode']==0 for r in runs) and before==after else 1)
