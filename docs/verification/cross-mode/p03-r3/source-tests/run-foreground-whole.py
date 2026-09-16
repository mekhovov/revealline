from pathlib import Path
import subprocess,json,hashlib,time,os
cache=Path('.cache/p03r3');base=json.loads((cache/'preparation.json').read_text());extra=json.loads((cache/'additional-test-inputs.json').read_text())
paths=sorted(set(r['path'] for r in base['files']+extra['files'])|{'game/test/library-launch-host.test.mjs'})
def pins():
 out=[]
 for p in paths:
  d=Path(p).read_bytes();out.append({'path':p,'bytes':len(d),'sha256':hashlib.sha256(d).hexdigest()})
 return out
before=pins();(cache/'foreground-whole-before.json').write_text(json.dumps(before,indent=2)+'\n')
tests=['library-launch-host','attempt-export-panel','backup-set-host','gallery-focus'];runs=[]
for version in ['22.22.2','20.19.5']:
 free=os.statvfs('.').f_bavail*os.statvfs('.').f_frsize
 if free<268435456:raise RuntimeError('256MiB reserve refusal')
 assert pins()==before,'Source changed before run'
 node=f'/Users/oleksandr.mekhovov/.local/share/mise/installs/node/{version}/bin/node';args=[node,'--test']+[f'game/test/{n}.test.mjs' for n in tests];name='foreground-whole-node'+version.split('.')[0]+'.log';start=time.monotonic()
 with (cache/name).open('wb') as log:r=subprocess.run(args,stdout=log,stderr=subprocess.STDOUT,timeout=240)
 elapsed=time.monotonic()-start
 after=pins();assert after==before,'Source changed during run'
 row={'node':version,'argv':args,'exitCode':r.returncode,'wallSeconds':elapsed,'freeBefore':free,'log':name};runs.append(row);(cache/'foreground-whole-execution.json').write_text(json.dumps({'before':'foreground-whole-before.json','inputsUnchanged':True,'runs':runs},indent=2)+'\n');print(json.dumps(row),flush=True)
 if r.returncode:break
(cache/'foreground-whole-after.json').write_text(json.dumps(pins(),indent=2)+'\n')
