EXECUTION_REQUEST_SHA = 'ecb73415aa2f7505500a0482564178641f9b65195a9c0b3a1ed5a48337d87906'
"""One-shot read-only reconciliation of completed originals; never requests bodies."""
from pathlib import Path,PurePosixPath
from collections import Counter,defaultdict
from urllib.parse import quote
import datetime,hashlib,json,sys
D=Path(__file__).resolve().parent;sys.path.insert(0,str(D/'http-tools'));import http_audit
sha=lambda b:hashlib.sha256(b).hexdigest();read=lambda p:json.loads(p.read_bytes());reqraw=(D/'execution-request.reviewed.json').read_bytes();req=json.loads(reqraw);assert sha(reqraw)==EXECUTION_REQUEST_SHA
reports=list((D/'http').glob('*/http-report.json'));assert len(reports)==1;RP=reports[0];H=RP.parent;report=read(RP);inv=read(H/'expected-inventory.json')['files'];results=[json.loads(x) for x in (H/'http-results.jsonl').read_text().splitlines()];attempts=[json.loads(x) for x in (H/'http-attempts.jsonl').read_text().splitlines()]
assert report['status']=='PASS';assert len(inv)==len(results)==1421;expected={r['path']:r for r in inv};assert len(expected)==1421
assert Counter(r['path'] for r in results)==Counter(r['path'] for r in inv)
byattempt=defaultdict(list)
for r in attempts:
 assert r['path'] in expected;byattempt[r['path']].append(r)
assert set(byattempt)==set(expected)
for r in results:
 e=expected[r['path']];group=byattempt[r['path']];assert 1<=len(group)<=3;assert [v['attempt'] for v in group]==list(range(1,len(group)+1));assert r==group[-1];url=http_audit.BASE+quote(r['path'],safe='/')
 assert r['status']=='PASS' and r['statusCode']==200 and r['requestStarted'] is True and r['url']==r['finalURL']==url
 assert r['bytes']==r['expectedBytes']==e['bytes'] and r['sha256']==r['expectedSha256']==e['sha256'];mime=r['contentType'].split(';')[0].strip().lower();assert mime in http_audit.MIMES[PurePosixPath(r['path']).suffix.lower()]
# Independently classify prior paths against actual final rows, not report literals.
priorraw=(D/'inputs/prior-expected-inventory.json').read_bytes();assert sha(priorraw)==__import__('audit_binding').PRIOR_INVENTORY_SHA
prior=read(D/'inputs/prior-expected-inventory.json')['files'];previous={r['path']:r for r in prior};assert len(previous)==len(prior)==712
unchanged={p for p,r in previous.items() if expected.get(p)==r};changed=set(previous)-unchanged;added=set(expected)-set(previous)
release={p for p in unchanged if p.startswith('releases/v0.64.1/')};support=unchanged-release
assert len(unchanged)==711 and len(release)==709 and support=={'.nojekyll','releases/index.html'} and changed=={'index.html'} and len(added)==709
assert report['priorInventoryRows']==len(previous) and report['preservedOldCanonicalRows']==len(unchanged) and report['preservedPriorReleaseRows']==len(release) and report['preservedRootSupportRows']==len(support)
assert report['preservedRootSupportPaths']==sorted(support) and report['changedPriorPaths']==sorted(changed) and report['newRows']==len(added) and report['newBytes']==sum(expected[p]['bytes'] for p in added)==313568451
assert expected['index.html']['bytes']-previous['index.html']['bytes']==79
assert (H/'prior-expected-inventory.json').read_bytes()==priorraw
assert sum(r['bytes'] for r in results)==report['verifiedBytes']==report['expectedBytes']==627136217
assert report['attempts']==len(attempts);assert report['failedAttempts']==sum(r['status']!='PASS' for r in attempts);assert report['retriedFiles']==sum(len(rs)>1 for rs in byattempt.values());assert not report['failedFiles'] and not report['skipped'] and report['sourcePinsUnchanged'] and report['allFinalURLsExact']
for name in ['archiveCommit','archiveTree','sourceCheckoutCommit','runId','deploymentId','deploymentStatusId','receiptArtifactId']:assert report[name]==req[name]
assert report['executionRequestSha256']==sha(reqraw);assert (H/'execution-request.json').read_bytes()==reqraw
assert (H/'expected-inventory.json').read_bytes()==(D/'inputs/expected-inventory.json').read_bytes();assert (H/'auditor.py').read_bytes()==(D/'http-tools/http_audit.py').read_bytes();assert (H/'audit_binding.py').read_bytes()==(D/'http-tools/audit_binding.py').read_bytes()
# Check every exact admitted authority original, not only outcome summaries.
A=D.parent/'intake';pins=[]
for role,p in req['pins'].items():
 src=A/p['path'];body=src.read_bytes();assert len(body)==p['bytes'] and sha(body)==p['sha256'];assert (H/'authority-originals'/(role+('.zip' if role=='receiptZIP' else '.json'))).read_bytes()==body
observations=[]
for stage in ['before','after']:
 matches=list((D/'live-authorities').glob(stage+'-*/result.json'));assert len(matches)==1;rec=read(matches[0]);assert rec['status']=='PASS_LIVE_IDENTITIES_UNCHANGED' and not rec['errors'];assert rec['executionRequestSha256']==sha(reqraw)
 for k in ['archiveCommit','runId','deploymentId','deploymentStatusId']:assert rec[k]==req[k]
 for p in rec['pins']:
  body=(matches[0].parent/p['path']).read_bytes();assert len(body)==p['bytes'] and sha(body)==p['sha256']
 observations.append(matches[0].parent)
assert read(observations[0]/'result.json')['at']<report['startedAt']<report['verifiedAt']<read(observations[1]/'result.json')['at']
assert all((observations[0]/(n+'.json')).read_bytes()==(observations[1]/(n+'.json')).read_bytes() for n in ['main','run','deployment','statuses'])
paths=[D/'execution-request.reviewed.json',D/'internal-review.json',D/'inputs/source-lock.json',D/'collect-live.py',D/'reconcile-completed-rows.py',*sorted(H.rglob('*')),*[p for o in observations for p in sorted(o.rglob('*'))],*sorted((D/'execution-originals').rglob('*'))]
for p in paths:
 if p.is_file():b=p.read_bytes();pins.append({'path':str(p.relative_to(D)),'bytes':len(b),'sha256':sha(b)})
result={'format':'revealline-archive32-public-row-review.v1','status':'PASS','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':1421,'verifiedBytes':627136217,'resultRows':len(results),'uniqueResultPaths':len(expected),'attempts':len(attempts),'uniqueAttemptPaths':len(byattempt),'failedFiles':0,'failedAttempts':report['failedAttempts'],'retries':len(attempts)-len(results),'retriedFiles':report['retriedFiles'],'oldCanonicalRowsPreserved':len(unchanged),'preservedPriorReleaseRows':len(release),'preservedRootSupportRows':len(support),'preservedRootSupportPaths':sorted(support),'changedPriorPaths':sorted(changed),'newRows':len(added),'allExpectedPathsExactlyOnce':True,'allRecordedDescriptorsURLsStatusesMIMEsSizesHashesMatch':True,'sourcePinsUnchanged':True,**{k:req[k] for k in ['archiveCommit','archiveTree','sourceCheckoutCommit','runId','deploymentId','deploymentStatusId','receiptArtifactId']},'executionRequestSha256':sha(reqraw),'expectedInventorySha256':sha((H/'expected-inventory.json').read_bytes()),'authoritySnapshots':[str(p.relative_to(D)) for p in observations],'beforeAfterOriginalAPIBodiesUnchanged':True,'mimeCounts':dict(Counter(r['contentType'].split(';')[0].strip().lower() for r in results)),'errors':[],'evidencePins':pins,'browserAccepted':False,'phaseAccepted':False,'boundary':'Independent reconciliation of completed original report/rows/attempts, exact held inputs, seven authority receipts and before/after live API originals. No network or browser activity by this reviewer; no body payload persisted. Root native admission remains separate.','method':'Path coverage uses explicit path iterables, never descriptor mapping values. Every final result equals its final recorded attempt; all read originals are pinned.'}
with (D/'row-review.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['evidencePins','mimeCounts']}))
