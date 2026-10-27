from pathlib import Path
import json,subprocess,hashlib,datetime,os
C=Path(__file__).parent;P=C/'private-family';D=C/'expanded-main-source-closure';A=C.with_name('source-preservation-audit-20261016');repo='mekhovov/revealline';branch='codex/preservation-fpv-source-audit-20261016';rows=json.loads((P/'all423-recorded-main-HEAD-current-GitHub-classification.json').read_text())['rows'];pub=[r['sha'] for r in rows if r['GitHubPublicCommit']];assert len(pub)==5

def api(path,payload=None):
 a=['gh','api','repos/'+repo+'/'+path]
 if payload is not None:a+=['--input','-']
 return json.loads(subprocess.run(a,input=json.dumps(payload) if payload is not None else None,capture_output=True,text=True,check=True,timeout=120).stdout)
checks=[]
for h in pub:
 v=api('git/commits/'+h);assert v['sha']==h;checks.append({'sha':h,'tree':v['tree']['sha'],'parents':[r['sha'] for r in v['parents']]})
prior=api('git/ref/heads/'+branch)['object']['sha'];assert prior==json.loads((A/'central-publication.json').read_text())['head'];tree=api('git/commits/'+prior)['tree']['sha'];head=api('git/commits',{'tree':tree,'parents':[prior]+pub,'message':'Anchor five existing public app worktree heads found by complete index metadata reconciliation'})['sha'];api('git/refs/heads/'+branch,{'sha':head,'force':False});assert api('git/commits/'+head)['parents']==[{'sha':x,'url':'https://api.github.com/repos/'+repo+'/git/commits/'+x,'html_url':'https://github.com/'+repo+'/commit/'+x} for x in [prior]+pub]
old=json.loads((A/'central-publication.json').read_text());old.update(head=head,parent=prior,createdUTC=datetime.datetime.now(datetime.timezone.utc).isoformat());(A/'central-publication.json').write_text(json.dumps(old,indent=2)+'\n');anchor={'createdUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'parent':prior,'head':head,'branch':branch,'existingPublicCommitMetadata':checks,'sourceIndexWorkingPathsNotIncluded':True,'appTreeUnchanged':True};(D/'five-public-index-HEAD-anchor-receipt-v1.json').write_text(json.dumps(anchor,indent=2)+'\n');print(json.dumps({'publicHeadsAnchored':5,'head':head}),flush=True)
bare=D/'GitHub-five-index-HEADs-baseline-v1.git';assert not bare.exists();env={k:v for k,v in os.environ.items() if not k.startswith('GIT_')};env.update(GIT_TERMINAL_PROMPT='0',GIT_CONFIG_GLOBAL='/dev/null',GIT_CONFIG_NOSYSTEM='1');cmd=['git','--git-dir='+str(bare)];subprocess.run(['git','init','--bare',str(bare)],capture_output=True,env=env,check=True);subprocess.run(cmd+['config','remote.origin.url','https://github.com/'+repo+'.git'],check=True,env=env);subprocess.run(cmd+['config','remote.origin.promisor','true'],check=True,env=env);subprocess.run(cmd+['config','remote.origin.partialclonefilter','blob:none'],check=True,env=env)
fetch=subprocess.run(cmd+['fetch','--depth=1','--no-tags','--filter=blob:none','origin']+pub,capture_output=True,env=env,timeout=600);assert fetch.returncode==0,fetch.stderr[-1000:];subprocess.run(cmd+['config','remote.origin.url','https://example.invalid/no-lazy-fetch'],check=True,env=env);env['GIT_NO_LAZY_FETCH']='1';assert not (bare/'objects/info/alternates').exists();pending={r['tree'] for r in checks};seen=set();leaves=set();links=set();journal=[];proc=subprocess.Popen(cmd+['cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env=env)
try:
 while pending:
  h=pending.pop()
  if h in seen:continue
  proc.stdin.write((h+'\n').encode());proc.stdin.flush();a=proc.stdout.readline().split();assert len(a)==3 and a[0].decode()==h and a[1]==b'tree';n=int(a[2]);b=proc.stdout.read(n);assert proc.stdout.read(1)==b'\n' and hashlib.sha1(b'tree '+str(n).encode()+b'\0'+b).hexdigest()==h;seen.add(h);journal.append({'sha':h,'bytes':n,'SHA256':hashlib.sha256(b).hexdigest()});i=0
  while i<n:
   j=b.index(b' ',i);m=b[i:j];k=b.index(b'\0',j);oid=b[k+1:k+21].hex();i=k+21
   if m in [b'40000',b'040000']:pending.add(oid)
   elif m==b'160000':links.add(oid)
   else:assert m in [b'100644',b'100755',b'120000'];leaves.add(oid)
finally:proc.stdin.close();proc.wait(timeout=30)
assert proc.returncode==0;leaf=D/'GitHub-five-public-index-HEAD-typed-blob-IDs-v1.txt';leaf.write_text('\n'.join(sorted(leaves))+'\n');jf=D/'GitHub-five-public-index-HEAD-tree-readback-v1.json';jf.write_text(json.dumps(journal,separators=(',',':'))+'\n');uncovered=json.loads((P/'all423-index-source-coverage-reconciliation-v1.json').read_text())['uncoveredObjects'];resolved=[r['sha'] for r in uncovered if r['sha'] in leaves];out={'createdUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'anchoredPublicHeads':checks,'anchorHead':head,'rawTreeSHA1Verified':len(seen),'typedPublicBlobIDs':len(leaves),'setSHA256':hashlib.sha256(leaf.read_bytes()).hexdigest(),'treeReadbackSHA256':hashlib.sha256(jf.read_bytes()).hexdigest(),'gitlinks':sorted(links),'noBlobBodiesRead':True,'GitHubOnlyNoAlternatesRemoteInvalidNoLazy':True,'previous406IndexIDsResolved':len(resolved),'resolvedIndexIDs':resolved,'allVolumeComplete':False};(D/'GitHub-five-public-index-HEAD-projection-receipt-v1.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'typedPublicBlobIDs':len(leaves),'previous406IDsResolved':len(resolved),'treeCount':len(seen)}),flush=True)
