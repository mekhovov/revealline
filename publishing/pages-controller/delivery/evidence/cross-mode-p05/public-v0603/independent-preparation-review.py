from pathlib import Path
import json,hashlib,subprocess,ast,datetime
R=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test'); H=R/'.cache/p05-supporting-tools-public-audit-a13ab970'; O=H/'independent-review'; O.mkdir(exist_ok=False)
S='a13ab970222498d7c5fa7f62f9fc04fe436979d5'; T='cf744b1ced9680b2fb4e0c304ddfc4b9f44b3e86'
def j(p):return json.loads(p.read_bytes())
def sha(b):return hashlib.sha256(b).hexdigest()
def pin(p):
 b=p.read_bytes(); return {'path':p.relative_to(H).as_posix(),'bytes':len(b),'sha256':sha(b)}
def check(p,item,bs='bytes',ss='sha256'):
 b=p.read_bytes();assert len(b)==item[bs] and sha(b)==item[ss],p
m=j(H/'adaptation-pins.json'); pred=Path(m['predecessor'])
for x in m['pins']:
 p=x['path'];check(H/p,x,'afterBytes','afterSha256');check(H/'originals'/p,x,'beforeBytes','beforeSha256');assert (H/'originals'/p).read_bytes()==(pred/p).read_bytes()
for x in m['originalInputPins']:check(H/x['path'],x)
for x in j(H/'handoff-pins.json')['pins']:check(H/x['path'],x)
for stem in ['wrappers','core']:
 q=j(H/f'checks/{stem}.receipt.json');assert q['exitCode']==0
 for part in ['stdout','stderr']:assert sha((H/f'checks/{stem}.{part}').read_bytes())==q[part+'Sha256']
for path in ['package.json','game/build-config.json']:
 assert (H/'source-originals'/path).read_bytes()==subprocess.check_output(['git','show',S+':'+path],cwd=R)
for n in ['catalog.json','publication.json','allocations.json']:
 assert (H/'current-before'/n).read_bytes()==subprocess.check_output(['git','show',m['catalogCommit']+':publishing/pages-controller/'+n],cwd=R)
assert (H/'current-before/catalog.json').read_bytes()==(H/'tools/retained-catalog.json').read_bytes()
assert len(j(H/'tools/retained-catalog.json')['releases'])==73
for p in m['identicalHelpers']:assert (H/p).read_bytes()==(H/'originals'/p).read_bytes()
sub={'v0.60.2':'v0.60.3','ece40093940aabdc3b3659a07394b856f33ad4a1':S,'32b36e6e8fc605911b2cb98cd8f67c97b8f4e214':T,'bc5fa53e9b5911f9725bdeface4a02bc3371b189cdcf5607bb203cadcd19c804':m['catalogSha256']}
for p in ['wrapper_contract.py','test_wrappers.py','tools/audit-main.mjs','tools/self-check.mjs']:
 b=(H/'originals'/p).read_text()
 for a,v in sub.items(): b=b.replace(a,v)
 if p=='tools/self-check.mjs':b=b.replace('releases.length, 72','releases.length, 73')
 assert b==(H/p).read_text(),p
rr=j(H/'retention-expected/root-review.original.json')
for x in rr['files']:check(Path(x['path']),x)
prev=j(H/'current-before/publication.json'); nxt=j(H/'retention-expected/publication.json')
a={x['id']:x for x in prev['admissions']};b={x['id']:x for x in nxt['admissions']};assert len(a)==len(b)==18 and [k for k in a if a[k]!=b[k]]==['archive-03']
assert len(a['archive-03']['evidence'])==6 and len(b['archive-03']['evidence'])==16
for old in a['archive-03']['evidence']:
 new=next(x for x in b['archive-03']['evidence'] if x['path']==old['path']);assert new['sha256']==old['sha256'] and new['kind']=='reference'
assert nxt['allocationSha256']==sha((H/'retention-expected/allocations.json').read_bytes())=='26c1006fe8aa4a07259d38dd12ac67b546ae972b6ed9e78fbb0d83cdb2a89414'
assert j(H/'retention-expected/browser-admission.json')['infrastructureCommit']==rr['infrastructureCommit']=='1eff31098cc79cf923f4429fe6dd8d97f520972a'
releasepath=R/'.cache/p05-qualified/supporting-tools-v0603/root-release/published-release.json'; release=j(releasepath)
assert release['id']==390725431 and release['tag_name']=='v0.60.3' and release['published_at']=='2026-09-17T13:22:17Z' and release['draft'] is False and release['prerelease'] is False
bind=j(R/'.cache/p05-qualified/supporting-tools-v0603/root-release/upload-binding.reviewed.json'); expected={x['name']:x for x in bind['release']['assets']};assert len(release['assets'])==len(expected)==9
for x in release['assets']:
 p=expected[x['name']];assert x['size']==p['bytes'] and x['digest']=='sha256:'+p['sha256'] and x['state']=='uploaded'
copy=O/'published-release.original.json';copy.write_bytes(releasepath.read_bytes())
request=j(H/'intake-request.pending.json');assert request['reviewed'] is False
request['publishedRelease']=pin(copy)
(O/'intake-request.pending.json').write_text(json.dumps(request,indent=2)+'\n')
report={'status':'PASS_PREPARATION_ONLY_PENDING_ACTUAL_PUBLISHER','reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRevision':S,'sourceTree':T,'version':'v0.60.3','findings':[],'helperPinsVerified':len(m['pins']),'unchangedKernels':m['identicalHelpers'],'modifiedKernels':'Four files exactly reproduced by source/tree/version/catalog literals and self-check retained count only. Optional orchestrator remains UNBOUND.','priorCatalogRows':73,'expectedCatalogRows':74,'retention':{'rootReview':pin(H/'retention-expected/root-review.original.json'),'all12RootFilesRehashed':True,'unchangedOtherAdmissions':17,'oldArchive03PinsPreserved':6,'newArchive03PinCount':16,'allocationSha256':nxt['allocationSha256']},'publishedRelease':pin(copy),'preparedRequest':pin(O/'intake-request.pending.json'),'executionBounds':{'inventoryRows':20000,'inventoryBytes':950000000,'workers':8,'requestTimeoutSeconds':300,'maxAttempts':3,'retry':'transport/429/5xx only','redirects':'refused','savePayloads':False,'smallReceiptCompressedBytesLessThan':10485760,'smallReceiptExpandedBytes':64000000,'smallReceiptExactMembers':2,'apiTimeoutSeconds':35,'apiAcceptedReplyBytesLessThan':2000000},'mockedPredecessorChecks':'Existing nine mocked wrapper checks plus core self-check receipts rehashed; no checks rerun.','notes':['The two evidence/current-v0602 fixture strings are mock paths passed through generic qualification-path handling, not runtime v0603 constants; do not treat them as a production source binding.','Full public auditor does not independently requalify every archive admission; root must compare actual new configuration and allocation against these exact expected pins.','API/ZIP accepted-size checks occur after subprocess collection; they are not streaming transfer cutoffs. Existing timeout and partial-failure retention remain unchanged.'],'operationalRequests':0,'testsRun':False,'publicAcceptance':False,'limits':['Actual publisher commit/tree, Pages run/deployment/status and receipt artifact remain null.','No root-approved request or binding is created by this independent review.','Current source correction affects local-only Production/Viewport tools; proposed public smoke only checks unchanged shared/public player routes and release delivery.']}
(O/'review.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'status':report['status'],'findings':report['findings'],'helpers':report['helperPinsVerified'],'actualPublishedRelease':release['id'],'review':str(O/'review.json'),'template':str(O/'intake-request.pending.json')},indent=2))
