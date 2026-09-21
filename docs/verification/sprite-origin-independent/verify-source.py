from pathlib import Path
import json,hashlib,subprocess,re
p=Path(__file__).resolve().parent;root=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test');base='8cffb36b29a38013eb9213845efd675c4864c9d8';cache={}
allowed={};rows=[]
for file in (p/'reads').glob('*.jsonl'):
 for line in file.read_text().splitlines():
  r=json.loads(line);key=(r['name'],r['sha256'])
  if key not in cache:
   if r['origin']=='candidate':
    b=(p/'candidate'/r['name']).read_bytes()
    if r['name']=='authoring/asset-studio/studio.mjs' and r['sha256']=='9b86b47d7aa9bbcaaccfd34ffdd93636d32682c8a7e2c360b4639c0b56da9ee3': b=(root/'.cache/shared-device-r1/studio-revision-independent/candidate'/r['name']).read_bytes()
   else:b=subprocess.check_output(['git','show',base+':'+r['name']],cwd=root)
   assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],key
   cache[key]=True
  rows.append({**r,'process':file.stem})
runs=[]
for name in ['initial-final-node22','initial-final-node20','final-node22','final-node20','baseline-node22']:
 log=p/(name+'.log');text=log.read_text();pids=set(re.findall(r'\(node:(\d+)\)',text));reads=[r for r in rows if r['process'] in pids]
 runs.append({'log':log.name,'processes':len(pids),'reads':len(reads),'uniqueBindings':len({(r['name'],r['sha256']) for r in reads}),'counts':{k:int(v) for k,v in re.findall(r'^# (tests|pass|fail|skipped) (\d+)$',text,re.M)},'sha256':hashlib.sha256(log.read_bytes()).hexdigest()})
report={'base':base,'allReadsVerified':len(rows),'allUniqueBindings':len(cache),'runs':runs,'files':rows}
(p/'source-proof.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2))
