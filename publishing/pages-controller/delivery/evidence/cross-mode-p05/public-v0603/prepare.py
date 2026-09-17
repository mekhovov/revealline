from pathlib import Path
import ast,datetime,difflib,hashlib,json,re,subprocess
D=Path(__file__).resolve().parent;R=D.parent.parent;P=D.parent/'p05-practice-public-audit-ece40093';BASE='c7c4ed747636e66c0319a1843140c39fc6d4b38d';SOURCE='a13ab970222498d7c5fa7f62f9fc04fe436979d5';TREE='cf744b1ced9680b2fb4e0c304ddfc4b9f44b3e86';sha=lambda b:hashlib.sha256(b).hexdigest()
def put(p,b):p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
def dump(p,v):put(p,(json.dumps(v,indent=2)+'\n').encode())
def git(n,ref=BASE):return subprocess.check_output(['git','show',ref+':'+n],cwd=R)
assert subprocess.check_output(['git','rev-parse',SOURCE+'^{tree}'],cwd=R).decode().strip()==TREE
catalog=git('publishing/pages-controller/catalog.json');assert len(json.loads(catalog)['releases'])==73;catalogsha=sha(catalog);put(D/'tools/retained-catalog.json',catalog)
for n in ['publication.json','allocations.json','catalog.json']:put(D/'current-before'/n,git('publishing/pages-controller/'+n))
for n in ['package.json','game/build-config.json']:put(D/'source-originals'/n,git(n,SOURCE))
put(D/'current-before/published-release-v0602.original.json',(P/'published-release.original.json').read_bytes())
rootreview=R/'.cache/p05-v0603-archive03-admission/root-retention-review.json';proof=json.loads(rootreview.read_bytes());assert proof['status']=='ROOT_ACCEPTED_SCOPED_ARCHIVE03_RETENTION' and proof['reviewed'] is True
for pin in proof['files']:
 b=Path(pin['path']).read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['sha256']
put(D/'retention-expected/root-review.original.json',rootreview.read_bytes())
rootconfig=R/'.cache/p05-v0603-archive03-admission/root-reviewed/publishing/pages-controller'
for n in ['publication.json','allocations.json']:put(D/'retention-expected'/n,(rootconfig/n).read_bytes())
put(D/'retention-expected/browser-admission.json',(rootconfig/'evidence/archive-03/append-v0602/browser-admission.json').read_bytes())
names=['wrapper_contract.py','intake-live.py','refresh-after-http.py','review-public.py','observe-hosted.failure-retention.py','test_wrappers.py','tools/audit-main.mjs','tools/http-engine.mjs','tools/self-check.mjs']
replacements=[('v0.60.2','v0.60.3'),('ece40093940aabdc3b3659a07394b856f33ad4a1',SOURCE),('32b36e6e8fc605911b2cb98cd8f67c97b8f4e214',TREE),('bc5fa53e9b5911f9725bdeface4a02bc3371b189cdcf5607bb203cadcd19c804',catalogsha)]
pins=[];diff=[]
class Clear(ast.NodeTransformer):
 def visit_Constant(self,n):return ast.copy_location(ast.Constant(value=None),n)
for n in names:
 a=(P/n).read_bytes();put(D/'originals'/n,a);s=a.decode()
 for x,y in replacements:s=s.replace(x,y)
 if n=='tools/self-check.mjs':assert 'releases.length, 72)' in s;s=s.replace('releases.length, 72)','releases.length, 73)')
 b=s.encode();put(D/n,b)
 if n.endswith('.py'):assert ast.dump(Clear().visit(ast.parse(a)))==ast.dump(Clear().visit(ast.parse(b)))
 diff.extend(difflib.unified_diff(a.decode().splitlines(True),s.splitlines(True),fromfile='originals/'+n,tofile=n));pins.append({'path':n,'beforeBytes':len(a),'beforeSha256':sha(a),'afterBytes':len(b),'afterSha256':sha(b),'identical':a==b})
# Preserve the old orchestration body, but every future operational identity/count remains unbound.
a=(P/'run-reviewed-public.py').read_bytes();put(D/'originals/run-reviewed-public.py',a);s=a.decode().replace('082ef33adbb97f3b508a6ec4359294e7ae5e2663','UNBOUND_ACTUAL_PUBLISHER_COMMIT').replace('b91479376a207dad90638793eb916536d8622ed7e7011cafd7210efeee40ec24','UNBOUND_REVIEWED_BINDING_SHA256');s=re.sub(r'(?<!\w)2705(?!\w)',"'UNBOUND_EXPECTED_FILE_COUNT'",s);s=re.sub(r'(?<!\w)639168008(?!\w)',"'UNBOUND_EXPECTED_TOTAL_BYTES'",s);put(D/'run-reviewed-public.py.template',s.encode());assert ast.dump(Clear().visit(ast.parse(a)))==ast.dump(Clear().visit(ast.parse(s)));diff.extend(difflib.unified_diff(a.decode().splitlines(True),s.splitlines(True),fromfile='originals/run-reviewed-public.py',tofile='run-reviewed-public.py.template'));put(D/'adaptation.diff',''.join(diff).encode())
dump(D/'tools/preparation-provenance.json',{'upstream':[{'path':str(P/p['path']),'bytes':p['beforeBytes'],'sha256':p['beforeSha256']} for p in pins]})
dump(D/'intake-request.pending.json',{'format':'revealline-public-intake-request.v1','reviewed':False,'outputLabel':'UNBOUND_INTAKE_LABEL','currentVersion':'v0.60.3','gameSourceRevision':SOURCE,'qualifiedSourceTree':TREE,'controllerCommit':None,'controllerTree':None,'runId':None,'deploymentId':None,'latestSuccessStatusId':None,'receiptArtifact':None,'hostedObservation':None,'publishedRelease':None})
dump(D/'refresh-request.pending.json',{'format':'revealline-public-refresh-request.v1','reviewed':False,'outputLabel':'UNBOUND_REFRESH_LABEL','binding':None,'report':None,'rowReview':None,'hostedObservation':None,'publishedRelease':None})
beforepins=[]
for sub in ['current-before','source-originals','retention-expected']:
 for f in sorted((D/sub).rglob('*')):
  if f.is_file():b=f.read_bytes();beforepins.append({'path':str(f.relative_to(D)),'bytes':len(b),'sha256':sha(b)})
dump(D/'adaptation-pins.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'predecessor':str(P),'sourceRevision':SOURCE,'sourceTree':TREE,'version':'v0.60.3','catalogCommit':BASE,'catalogSha256':catalogsha,'catalogRows':73,'expectedCatalogRowsAfterSingleNewRelease':74,'pins':pins,'originalInputPins':beforepins,'pythonASTIdenticalIgnoringLiterals':True,'identicalHelpers':[p['path'] for p in pins if p['identical']],'operationalRequests':0,'actualPublicBindingsCreated':False,'transportChanges':False,'unknown':['releaseId','tagObject','uploadRun','publisherCommit','publisherTree','publisherPR','pagesRun','deploymentId','statusId','receiptArtifact','artifactInventoryCount','artifactInventoryBytes','reviewedRequestHashes'],'retentionExpected':'Root-reviewed Archive03 retention, six old plus ten new pins, eighteen admissions, only shared archive explorer changed. Main current selector and archive adoption not executed.'})
print(json.dumps({'directory':str(D),'catalogSHA':catalogsha,'identicalHelpers':[p['path'] for p in pins if p['identical']],'changedHelpers':[p['path'] for p in pins if not p['identical']],'diffSha256':sha((D/'adaptation.diff').read_bytes())},indent=2))
