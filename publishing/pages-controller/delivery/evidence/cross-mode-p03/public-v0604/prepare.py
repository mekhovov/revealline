from pathlib import Path
import ast,datetime,difflib,hashlib,json,subprocess
D=Path(__file__).resolve().parent;R=D.parent.parent;P=D.parent/'p05-supporting-tools-public-audit-a13ab970';BASE='65a6efcb3bfabf8458702cca452c8120fa756471';SOURCE='d77ea4f5c2aeccf2ba3bdf483a3f25531f8095b6';TREE='f3a02f9d9e38650f2f9f61ddacd358dfc1f64333';sha=lambda b:hashlib.sha256(b).hexdigest()
def put(p,b):p.parent.mkdir(parents=True,exist_ok=True);p.open('xb').write(b)
def dump(p,v):put(p,(json.dumps(v,indent=2)+'\n').encode())
def git(n,ref=BASE):return subprocess.check_output(['git','show',ref+':'+n],cwd=R)
assert subprocess.check_output(['git','rev-parse',SOURCE+'^{tree}'],cwd=R).decode().strip()==TREE
catalog=git('publishing/pages-controller/catalog.json');assert len(json.loads(catalog)['releases'])==74;catalogsha=sha(catalog);put(D/'tools/retained-catalog.json',catalog)
for n in ['publication.json','allocations.json','catalog.json']:put(D/'current-before'/n,git('publishing/pages-controller/'+n))
for n in ['package.json','game/build-config.json']:
 b=git(n,SOURCE);put(D/'source-originals'/n,b);assert '0.60.4' in b.decode()
ret=R/'.cache/p03-recovery-v0604-archive19-admission';rootaccept=R/'.cache/p03-archive19-public-audit/root-acceptance.json';proof=json.loads(rootaccept.read_bytes());assert proof['status']=='ROOT_ACCEPTED_ARCHIVE19_V0603_RETENTION_ONLY'
put(D/'retention-expected/root-acceptance.original.json',rootaccept.read_bytes())
for n in ['publication.json','allocations.json']:put(D/'retention-expected'/n,(ret/'proposed/publishing/pages-controller'/n).read_bytes())
for n in ['proposal-manifest.json','handoff-pins.json','copy-verification.json']:put(D/'retention-expected'/n,(ret/n).read_bytes())
put(D/'retention-expected/browser-admission.json',(ret/'proposed/publishing/pages-controller/evidence/archive-19/initial-v0603/browser-admission.json').read_bytes())
names=['wrapper_contract.py','intake-live.py','refresh-after-http.py','review-public.py','observe-hosted.failure-retention.py','test_wrappers.py','tools/audit-main.mjs','tools/http-engine.mjs','tools/self-check.mjs']
replacements=[('v0.60.3','v0.60.4'),('a13ab970222498d7c5fa7f62f9fc04fe436979d5',SOURCE),('cf744b1ced9680b2fb4e0c304ddfc4b9f44b3e86',TREE),('410638862e82688c335b4c658d70eee1abf45f150ea2cb6832fe09d6f2f0594d',catalogsha)]
pins=[];diff=[]
class Clear(ast.NodeTransformer):
 def visit_Constant(self,n):return ast.copy_location(ast.Constant(value=None),n)
for n in names:
 a=(P/n).read_bytes();put(D/'originals'/n,a);s=a.decode()
 for x,y in replacements:s=s.replace(x,y)
 if n=='tools/self-check.mjs':assert 'releases.length, 73)' in s;s=s.replace('releases.length, 73)','releases.length, 74)')
 b=s.encode();put(D/n,b)
 if n.endswith('.py'):assert ast.dump(Clear().visit(ast.parse(a)))==ast.dump(Clear().visit(ast.parse(b)))
 diff.extend(difflib.unified_diff(a.decode().splitlines(True),s.splitlines(True),fromfile='originals/'+n,tofile=n));pins.append({'path':n,'beforeBytes':len(a),'beforeSha256':sha(a),'afterBytes':len(b),'afterSha256':sha(b),'identical':a==b})
# The predecessor template already leaves every future operational identity unbound.
a=(P/'run-reviewed-public.py.template').read_bytes();put(D/'originals/run-reviewed-public.py.template',a);put(D/'run-reviewed-public.py.template',a);assert b'UNBOUND_ACTUAL_PUBLISHER_COMMIT' in a and b'UNBOUND_REVIEWED_BINDING_SHA256' in a and b'UNBOUND_EXPECTED_FILE_COUNT' in a and b'UNBOUND_EXPECTED_TOTAL_BYTES' in a
put(D/'adaptation.diff',''.join(diff).encode())
dump(D/'tools/preparation-provenance.json',{'upstream':[{'path':str(P/p['path']),'bytes':p['beforeBytes'],'sha256':p['beforeSha256']} for p in pins]})
dump(D/'intake-request.pending.json',{'format':'revealline-public-intake-request.v1','reviewed':False,'outputLabel':'UNBOUND_INTAKE_LABEL','currentVersion':'v0.60.4','gameSourceRevision':SOURCE,'qualifiedSourceTree':TREE,'controllerCommit':None,'controllerTree':None,'runId':None,'deploymentId':None,'latestSuccessStatusId':None,'receiptArtifact':None,'hostedObservation':None,'publishedRelease':None})
dump(D/'refresh-request.pending.json',{'format':'revealline-public-refresh-request.v1','reviewed':False,'outputLabel':'UNBOUND_REFRESH_LABEL','binding':None,'report':None,'rowReview':None,'hostedObservation':None,'publishedRelease':None})
originalpins=[]
for sub in ['current-before','source-originals','retention-expected']:
 for f in sorted((D/sub).rglob('*')):
  if f.is_file():b=f.read_bytes();originalpins.append({'path':str(f.relative_to(D)),'bytes':len(b),'sha256':sha(b)})
dump(D/'adaptation-pins.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'predecessor':str(P),'sourceRevision':SOURCE,'sourceTree':TREE,'version':'v0.60.4','catalogCommit':BASE,'catalogSha256':catalogsha,'catalogRows':74,'expectedCatalogRowsAfterSingleNewRelease':75,'pins':pins,'originalInputPins':originalpins,'pythonASTIdenticalIgnoringLiterals':True,'identicalHelpers':[p['path'] for p in pins if p['identical']],'orchestrationTemplateIdentical':True,'operationalRequests':0,'actualPublicBindingsCreated':False,'transportChanges':False,'unknown':['releaseId','tagObject','uploadRun','publisherCommit','publisherTree','publisherPR','pagesRun','deploymentId','statusId','receiptArtifact','artifactInventoryCount','artifactInventoryBytes','reviewedRequestHashes'],'retentionExpected':'Root accepted Archive19 v0.60.3 retention; cache-only admission proposal retains all18 previous admissions/517pins. No publisher adoption or selector change is asserted.'})
print(json.dumps({'directory':str(D),'catalogSHA':catalogsha,'identicalHelpers':[p['path'] for p in pins if p['identical']],'changedHelpers':[p['path'] for p in pins if not p['identical']],'diffSha256':sha((D/'adaptation.diff').read_bytes())},indent=2))
