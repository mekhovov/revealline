from pathlib import Path
import subprocess,json,os,hashlib
p=Path(__file__).resolve().parent;repo=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test');files=['combat-definition','combat-patrols','combat-collisions','combat-transport'];receipts=[]
for name in files:(p/'source/game/test'/f'{name}.test.mjs').write_bytes(subprocess.check_output(['git','show',f'851a2100:game/test/{name}.test.mjs'],cwd=repo))
for v in ['20.19.5','22.22.2']:
 node=f'/Users/oleksandr.mekhovov/.local/share/mise/installs/node/{v}/bin/node';cmd=[node,'--max-old-space-size=512','--experimental-loader',str(p/'loader.mjs'),'--test','--test-concurrency=1']+[str(p/'source/game/test'/f'{name}.test.mjs') for name in files]
 with (p/f'node{v[:2]}.tap').open('w') as out:r=subprocess.run(cmd,cwd=repo,stdout=out,stderr=subprocess.STDOUT,env={**os.environ,'RL_COMBAT_READS':str(p/f'node{v[:2]}-reads.jsonl')})
 receipts.append({'runtime':v,'exitCode':r.returncode,'argv':cmd,'logSha256':hashlib.sha256((p/f'node{v[:2]}.tap').read_bytes()).hexdigest()});print(json.dumps(receipts[-1]),flush=True)
 if r.returncode:break
(p/'runs.json').write_text(json.dumps(receipts,indent=2)+'\n')
