from pathlib import Path
import os,sys,json,subprocess,hashlib,zipfile,io,shutil,datetime
assert len(sys.argv)==4 and sys.argv[1]=='--collect-terminal'
assert len(sys.argv[2])==40 and all(c in '0123456789abcdef' for c in sys.argv[2])
assert sys.argv[3].isdigit()
home=Path(__file__).resolve().parent
revision=sys.argv[2]
head='fe1169291ed726a5c4cd0bc59df4e08583de1156'
runid=int(sys.argv[3])
out=home/'inputs'/revision
assert not out.exists() and shutil.disk_usage(home).free>272*1024**2
out.mkdir(parents=True)
def put(name,raw):
 assert len(raw)<=16_000_000
 (out/name).write_bytes(raw)
 return json.loads(raw)
def api(name,endpoint,limit=4_000_000):
 r=subprocess.run(['gh','api','repos/mekhovov/revealline/'+endpoint],capture_output=True,timeout=60)
 assert len(r.stdout)<=limit and len(r.stderr)<20000
 (out/(name+'.stderr.private')).write_bytes(r.stderr)
 assert r.returncode==0,(name,r.returncode)
 return put(name+'.json',r.stdout)
run=api('run','actions/runs/'+str(runid))
assert run['head_sha']==revision and run['status']=='completed' and run['conclusion']=='success'
assert run['path']=='.github/workflows/publish-frozen-pages.yml'
current=api('main','git/ref/heads/main');assert current['object']['sha']==revision
commit=api('controller','git/commits/'+revision)
assert commit['tree']['sha']=='118d12df9f0eb488cc9362c62e6697c859a8f5bb'
arts=api('artifacts','actions/runs/'+str(runid)+'/artifacts?per_page=100')
assert arts['total_count']==len(arts['artifacts'])
a=[a for a in arts['artifacts'] if a['name']=='frozen-pages-receipts'];assert len(a)==1
a=a[0];assert not a['expired'] and a['size_in_bytes']<4_000_000
r=subprocess.run(['gh','api','repos/mekhovov/revealline/actions/artifacts/'+str(a['id'])+'/zip'],capture_output=True,timeout=120)
assert len(r.stdout)<4_000_000 and len(r.stderr)<20000
(out/'artifact-download.stderr.private').write_bytes(r.stderr)
assert r.returncode==0
raw=r.stdout
assert len(raw)==a['size_in_bytes'] and 'sha256:'+hashlib.sha256(raw).hexdigest()==a['digest']
(out/'original-receipts.zip').write_bytes(raw)
z=zipfile.ZipFile(io.BytesIO(raw));assert len(z.infolist())<=10 and sum(i.file_size for i in z.infolist())<8_000_000
assert z.testzip() is None
members=[]
for info in z.infolist():
 assert Path(info.filename).name==info.filename and info.filename.endswith('-receipt.json')
 b=z.read(info);put('original-'+info.filename,b)
 members.append({'path':info.filename,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
put('members.json',(json.dumps(members,indent=2)+'\n').encode())
receipt=put('receipt.json',z.read('artifact-receipt.json'))
assert receipt['controllerCommit']==revision and receipt['currentVersion']=='v0.69.3'
deps=api('deployments','deployments?sha='+revision+'&environment=github-pages&per_page=100')
assert len(deps)==1,(len(deps),'ambiguous deployment')
d=deps[0];dep=api('deployment','deployments/'+str(d['id']))
statuses=api('statuses','deployments/'+str(d['id'])+'/statuses?per_page=100')
assert statuses[0]['state']=='success'
env={k:v for k,v in os.environ.items() if not k.startswith('GIT_')};env.update(GIT_NO_LAZY_FETCH='1',GIT_OPTIONAL_LOCKS='0')
paths={'catalog':'catalog.json','configuration':'publication.json','manifest':'metadata/v0.69.3/manifest.json','record':'metadata/v0.69.3/release.json','qualification':'evidence/current-v0693/source-qualification.json'}
for key,p in paths.items():
 r=subprocess.run(['git','--no-lazy-fetch','show',head+':publishing/pages-controller/'+p],env=env,capture_output=True,timeout=20,check=True)
 put(key+'.json',r.stdout)
pins={}
for key in ['receipt','deployment','statuses','run','manifest','record','qualification','catalog','configuration']:
 b=(out/(key+'.json')).read_bytes();pins[key]={'path':key+'.json','bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
# Node JSON serialization is the auditor's canonical inventory convention.
# Recomputed below using equivalent ASCII-only JSON: paths and hashes are validated ASCII in this release.
serialized=(json.dumps(receipt['files'],indent=2,ensure_ascii=False)+'\n').encode()
inventorysha=hashlib.sha256(serialized).hexdigest()
# Compare using the authoritative JS serializer, without relying on Python formatting.
js="import{createHash}from'node:crypto';let t='';for await(const c of process.stdin)t+=c;console.log(createHash('sha256').update(JSON.stringify(JSON.parse(t),null,2)+String.fromCharCode(10)).digest('hex'))"
p=subprocess.run(['/Users/oleksandr.mekhovov/.local/share/mise/installs/node/22.22.2/bin/node','--input-type=module','-e',js],input=json.dumps(receipt['files']).encode(),capture_output=True,check=True)
assert inventorysha==p.stdout.decode().strip()
binding={'format':'revealline-final-main-public-binding.v1','reviewed':True,'base':'https://mekhovov.github.io/revealline/','currentVersion':'v0.69.3','gameSourceRevision':'406637f36c039f991e83d241cb49d4568a871109','qualifiedSourceTree':'5d3604419aadc2d023c6814bc965310f645c2973','controllerCommit':revision,'controllerTree':commit['tree']['sha'],'deploymentId':d['id'],'runId':runid,'inventorySha256':inventorysha,'pins':pins}
raw=(json.dumps(binding,indent=2)+'\n').encode();put('binding.json',raw)
print(json.dumps({'binding':str(out/'binding.json'),'sha256':hashlib.sha256(raw).hexdigest(),'files':len(receipt['files']),'bytes':receipt['totalBytes'],'deployment':d['id']}))
