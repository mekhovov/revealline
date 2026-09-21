from pathlib import Path
import subprocess,json,hashlib,os,re
p=Path(__file__).resolve().parent
files=['presentation-studio', 'studio-transfer-history', 'studio-slot-history', 'sprite-editor', 'asset-studio-host-loading', 'published-studio', 'asset-studio-helpers', 'sprite-edit-origin']
results=[]
for version in ['22.22.2','20.19.5']:
 node=f'/Users/oleksandr.mekhovov/.local/share/mise/installs/node/{version}/bin/node'
 cmd=[node,'--experimental-loader',str(p/'loader.mjs'),'--test','--test-concurrency=2']+[str(p/'candidate/game/test'/f'{n}.test.mjs') for n in files]
 log=p/f'final-node{version[:2]}.log'
 with log.open('w') as out:r=subprocess.run(cmd,stdout=out,stderr=subprocess.STDOUT,env={**os.environ,'NODE_OPTIONS':'--max-old-space-size=512'})
 counts={key:int(value) for key,value in re.findall(r'^# (tests|pass|fail|skipped) (\d+)$',log.read_text(),re.M)}
 results.append({'counts':counts,'node':version,'exitCode':r.returncode,'log':log.name,'sha256':hashlib.sha256(log.read_bytes()).hexdigest()})
 print(json.dumps(results[-1]),flush=True)
 if r.returncode or counts != {'tests':60,'pass':60,'fail':0,'skipped':0}:break
(p/'final-cohort.json').write_text(json.dumps({'files':files,'results':results},indent=2)+'\n')
