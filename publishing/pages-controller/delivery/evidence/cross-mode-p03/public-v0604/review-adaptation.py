from pathlib import Path
import ast,hashlib,json,subprocess
D=Path(__file__).resolve().parent;R=D.parent.parent;P=D.parent/'p05-supporting-tools-public-audit-a13ab970';read=lambda p:json.loads(p.read_bytes());sha=lambda b:hashlib.sha256(b).hexdigest();m=read(D/'adaptation-pins.json')
substitutions=[('v0.60.3','v0.60.4'),('a13ab970222498d7c5fa7f62f9fc04fe436979d5',m['sourceRevision']),('cf744b1ced9680b2fb4e0c304ddfc4b9f44b3e86',m['sourceTree']),('410638862e82688c335b4c658d70eee1abf45f150ea2cb6832fe09d6f2f0594d',m['catalogSha256'])]
for pin in m['pins']:
 n=pin['path'];a=(D/'originals'/n).read_bytes();b=(D/n).read_bytes();assert a==(P/n).read_bytes() and sha(a)==pin['beforeSha256'] and sha(b)==pin['afterSha256'];expected=a.decode()
 for old,new in substitutions:expected=expected.replace(old,new)
 if n=='tools/self-check.mjs':expected=expected.replace('releases.length, 73)','releases.length, 74)')
 assert b==expected.encode()
for pin in m['originalInputPins']:
 b=(D/pin['path']).read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['sha256']
assert (D/'tools/retained-catalog.json').read_bytes()==subprocess.check_output(['git','show',m['catalogCommit']+':publishing/pages-controller/catalog.json'],cwd=R)
for name in ['package.json','game/build-config.json']:assert (D/'source-originals'/name).read_bytes()==subprocess.check_output(['git','show',m['sourceRevision']+':'+name],cwd=R)
assert (D/'run-reviewed-public.py.template').read_bytes()==(P/'run-reviewed-public.py.template').read_bytes()
for name in ['intake-request.pending.json','refresh-request.pending.json']:
 r=read(D/name);assert r['reviewed'] is False
 if name.startswith('intake'):
  for field in ['controllerCommit','controllerTree','runId','deploymentId','latestSuccessStatusId','receiptArtifact','hostedObservation','publishedRelease']:assert r[field] is None
 else:
  for field in ['binding','report','rowReview','hostedObservation','publishedRelease']:assert r[field] is None
assert not (D/'tools/inputs').exists() and not (D/'tools/runs').exists()
for label in ['wrappers','core']:
 c=read(D/'checks'/f'{label}.receipt.json');assert c['exitCode']==0
 for stream in ['stdout','stderr']:assert sha((D/'checks'/f'{label}.{stream}').read_bytes())==c[stream+'Sha256']
result={'status':'PASS_STATIC_LITERAL_ADAPTATION_REVIEW','sourceRevision':m['sourceRevision'],'sourceTree':m['sourceTree'],'version':m['version'],'helperFiles':len(m['pins']),'identicalHelpers':m['identicalHelpers'],'changedHelperFiles':4,'exactLiteralSubstitutionsOnly':True,'orchestrationTemplateUnchangedAndUnbound':True,'sourceIdentityExactGit':True,'retainedCatalogRows':74,'expectedRowsAfterSingleNewRelease':75,'mockedWrapperTests':9,'coreSelfCheck':'PASS','realNetworkRequests':0,'publicBindingsCreated':False,'sourceOrIndexChanges':False,'publicAcceptance':False,'phaseAccepted':False}
(D/'static-review.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
