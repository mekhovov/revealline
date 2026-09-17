"""Fresh explicit dependency fixture from immutable Git; only two admitted patches."""
from pathlib import Path
import subprocess,json,hashlib,time,datetime
D=Path(__file__).resolve().parent;R=D.parents[1];S='822f3290787c704a217e7c185d4b8beb7a527e82';T='88bd680e09210f9bf56ca18465fdb46afb2f1307';P=R/'.cache/p05-practice-playground-170508f1';C=R/'.cache/p05-playground-native-runtime-170508f1'
load=lambda p:json.loads(p.read_bytes());sha=lambda b:hashlib.sha256(b).hexdigest()
def pin(p):
 raw=p.read_bytes();return {'path':str(p),'bytes':len(raw),'sha256':sha(raw)}
def out(name,v):
 (D/name).open('x').write(json.dumps(v,indent=2)+'\n')
assert subprocess.check_output(['git','rev-parse',S+'^{tree}'],cwd=R,text=True).strip()==T
originals=D/'originals';originals.mkdir();f=D/'fixture';f.mkdir()
for dest,p in [('parent.patch',P/'candidate.patch'),('successor.patch',C/'candidate.patch'),('parent-pins.json',P/'candidate-pins.json'),('successor-pins.json',C/'candidate-pins.json'),('dependency-selection.original.json',P/'source-pins.json'),('cohort-selection.original.json',P/'runs/proposal20-01/receipt.json'),('native-README.original.md',R/'.cache/p05-playground-native-c79/README.md')]:
 (originals/dest).write_bytes(p.read_bytes())
assert sha((originals/'parent.patch').read_bytes())=='e674b1ba1234f98a1d957345a7d52bf3caf5930c9df8bf7b6488b3842e00f021'
assert sha((originals/'successor.patch').read_bytes())=='c79fd47750a57a7b3aa27dd211ddb5ec9f4f34c8408169a277d7157877cc5d87'
raw=subprocess.check_output(['git','ls-tree','-rz','--full-tree',S],cwd=R);tree={}
for row in raw.split(b'\0'):
 if not row:continue
 info,name=row.split(b'\t',1);mode,kind,oid=info.decode().split();tree[name.decode()]={'mode':mode,'kind':kind,'blob':oid}
selected=load(originals/'dependency-selection.original.json')['files'];parent=load(originals/'parent-pins.json')['files'];successor=load(originals/'successor-pins.json')['files'];assert len(selected)==896 and len(parent)==12 and len(successor)==2
for r in parent: assert (r['path'] in tree)==(not r['new'])
binary={'.png','.jpg','.mp4','.mp3','.rlstory','.rlmedia','.woff2','.ttf'};records=[];cat=subprocess.Popen(['git','cat-file','--batch'],cwd=R,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
try:
 for row in selected:
  name=row['path'];meta=tree[name];assert meta['kind']=='blob' and meta['mode'] in ['100644','100755'];dst=f/name;dst.parent.mkdir(parents=True,exist_ok=True);old=P/'baseline'/name
  if Path(name).suffix in binary and old.is_file():
   b=old.read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==meta['blob'], 'Old binary does not equal selected exact Git: '+name
   subprocess.run(['cp','-c',str(old),str(dst)],check=True,capture_output=True,timeout=30);method='APFS clone of exact-Git verified binary';assert dst.stat().st_ino!=old.stat().st_ino
  else:
   cat.stdin.write((meta['blob']+'\n').encode());cat.stdin.flush();head=cat.stdout.readline().decode().split();assert head[:2]==[meta['blob'],'blob'];size=int(head[2]);b=cat.stdout.read(size);assert cat.stdout.read(1)==b'\n' and len(b)==size;dst.write_bytes(b);method='Exact Git blob'
  dst.chmod(int(meta['mode'][-3:],8));check=dst.read_bytes();assert check==b
  records.append({'path':name,**meta,'bytes':len(b),'sha256':sha(b),'method':method,'differsFromPriorRecordedDependency':sha(b)!=row['sha256']})
finally:
 cat.stdin.close();assert cat.wait(timeout=20)==0;assert cat.stderr.read()==b''
out('baseline-inputs.json',records)
preimages=[]
for r in parent:
 p=f/r['path'];h=sha(p.read_bytes()) if p.exists() else None;assert h==r['preimageSha256'],r['path'];preimages.append({'path':r['path'],'sourceBlob':tree.get(r['path']),'sha256':h,'matchesParentPreimage':True})
out('preimage-review.json',{'source':S,'tree':T,'checks':preimages,'allTwelveMatch':True})
patch_receipts=[]
for label,expected in [('parent',parent),('successor',successor)]:
 if label=='successor':
  for r in expected:assert sha((f/r['path']).read_bytes())==r['preimageSha256']
 argv=['patch','-p1','--batch','--forward','-i',str(originals/(label+'.patch'))];p=subprocess.run(argv,cwd=f,capture_output=True,timeout=30)
 (originals/(label+'.apply.stdout')).write_bytes(p.stdout);(originals/(label+'.apply.stderr')).write_bytes(p.stderr);patch_receipts.append({'label':label,'argv':argv,'exitCode':p.returncode,'stdout':pin(originals/(label+'.apply.stdout')),'stderr':pin(originals/(label+'.apply.stderr'))});out(label+'-apply.json',patch_receipts[-1]);assert p.returncode==0,(label,p.stderr)
 for r in expected:assert sha((f/r['path']).read_bytes())==r.get('proposalSha256',r.get('sha256')),r['path']
actual=[]
for p in sorted(f.rglob('*')):
 if p.is_file():actual.append({'path':str(p.relative_to(f)),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())})
base={r['path']:r['sha256'] for r in records};diff=[r['path'] for r in actual if base.get(r['path'])!=r['sha256']];assert set(diff)==set(r['path'] for r in parent) and len(actual)==901
out('fixture-inputs.json',actual)
files=[p for p in load(originals/'cohort-selection.original.json')['argv'] if p.startswith('game/test/')];assert len(files)==11;out('cohort.json',files)
out('composition.json',{'source':S,'tree':T,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baselineFileCount':len(records),'fixtureFileCount':len(actual),'fixtureBytes':sum(r['bytes'] for r in actual),'twelvePreimagesMatch':True,'changedPaths':diff,'freshSourceChangesVsOldDependencySelection':[r['path'] for r in records if r['differsFromPriorRecordedDependency']],'inputManifest':pin(D/'fixture-inputs.json'),'patches':[pin(originals/(label+'.patch')) for label in ['parent','successor']],'originals':[pin(p) for p in sorted(originals.iterdir())],'scope':'Fresh exact822f dependencies, two explicitly admitted patches, no source/index/version/remote/build/browser changes. No runtime/native acceptance yet.'})
print(json.dumps({'source':S,'baseline':len(records),'fixture':len(actual),'bytes':sum(r['bytes'] for r in actual),'exactChangedPaths':diff,'freshSourcePaths':sum(r['differsFromPriorRecordedDependency'] for r in records)},indent=2))
