from pathlib import Path
import subprocess,json,hashlib,sys,datetime,os
r=Path.cwd(); o=r/'.cache/full-team-source-r1'; candidate=r.parent/'team-presentation-test-fixtures'; major=sys.argv[1]
version={'20':'20.19.5','22':'22.22.2'}[major]; node=f'/Users/oleksandr.mekhovov/.local/share/mise/installs/node/{version}/bin/node'
source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=candidate,text=True).strip()
m=json.loads((o/'candidate-map.json').read_text()); mapping={}
for p in m:
 data=(candidate/p).read_bytes(); committed=subprocess.check_output(['git','show',f'{source}:{p}'],cwd=candidate); assert data==committed,p
 mapping[(r/p).as_uri()]={'file':(candidate/p).as_uri(),'sha256':hashlib.sha256(data).hexdigest()}
mapfile=o/f'final-map-{major}.json'; mapfile.write_text(json.dumps(mapping,indent=2))
tests=[p for p in m if p.endswith('.test.mjs')]+['game/test/coop-owned-presentation.test.mjs']
log=o/f'final-node{major}.tap'; modules=o/f'final-node{major}-modules.jsonl'; status=o/f'final-node{major}-status.json'
record={'source':source,'runtimeBase':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'node':version,'tests':tests,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'running','log':str(log),'boundary':'Exact committed test modules over unchanged runtime source; finite DOM/Canvas, not browser or hardware acceptance.'}
status.write_text(json.dumps(record,indent=2)); env=dict(os.environ,REVEALLINE_FIXTURE_MAP=str(mapfile),REVEALLINE_FIXTURE_MODULES=str(modules))
with log.open('w') as f: result=subprocess.run([node,'--import','./.cache/full-team-source-r1/final-register.mjs','--test','--test-concurrency=1',*tests],stdout=f,stderr=subprocess.STDOUT,env=env)
record.update(status='complete',exitCode=result.returncode,completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),logSha256=hashlib.sha256(log.read_bytes()).hexdigest()); status.write_text(json.dumps(record,indent=2)); print(json.dumps(record));sys.exit(result.returncode)
