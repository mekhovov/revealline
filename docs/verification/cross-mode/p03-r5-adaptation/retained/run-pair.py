from pathlib import Path
import hashlib,json,subprocess,time,datetime,shutil
root=Path.cwd();cache=root/'.cache/r5-adaptation'
assert shutil.disk_usage(root).free>=256*1024*1024
setup=json.loads((root/'.cache/finite-setup/admission.json').read_text())
paths=sorted({r['path'] for r in setup['paths']}|{'game/test/couch-initial-focus.test.mjs'})
def inputs():
 out=[]
 for p in paths:
  b=(root/p).read_bytes();out.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 return out
before=inputs();(cache/'execution-inputs.json').write_text(json.dumps({'paths':before},indent=2)+'\n')
files=['couch-initial-focus','couch-shell','couch-navigation','couch-departure','couch-input','controller-navigation','mode-return-host']
runs=[]
for label,version in [('node22','22.22.2'),('node20','20.19.5')]:
 assert inputs()==before
 node=f'/Users/oleksandr.mekhovov/.local/share/mise/installs/node/{version}/bin/node'
 command=[node,'--test',*[f'game/test/{f}.test.mjs' for f in files]]
 started=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
 with (cache/f'{label}-whole.log').open('xb') as log:
  result=subprocess.run(command,cwd=root,stdout=log,stderr=subprocess.STDOUT)
 raw=(cache/f'{label}-whole.log').read_bytes();after=inputs();stable=after==before
 row={'runtime':subprocess.check_output([node,'--version']).decode().strip(),'command':command,'startedAt':started,'seconds':time.monotonic()-t,'exitCode':result.returncode,'inputPinsUnchanged':stable,'log':{'path':f'{label}-whole.log','bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},'rawSummary':[l for l in raw.decode().splitlines() if l.startswith(('# tests ','# pass ','# fail ','# skipped ','# cancelled ','# duration_ms ','ℹ tests ','ℹ pass ','ℹ fail ','ℹ cancelled ','ℹ skipped ','ℹ duration_ms '))]}
 runs.append(row);(cache/'execution.json').write_text(json.dumps({'base':setup['base'],'inputCount':len(before),'runs':runs},indent=2)+'\n');print(json.dumps(row),flush=True)
 if result.returncode or not stable:break
