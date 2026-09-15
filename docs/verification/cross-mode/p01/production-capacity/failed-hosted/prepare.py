from pathlib import Path
import subprocess,json,hashlib,re,ast
R=Path.cwd().resolve();P=Path(__file__).resolve().parent;old=R/'.cache/cross-mode/p01/v0571/hosted';S='69195ddd1d21a7bc3f863cf7589069a735301a03';T='6dea75eef274c3625d7a7e9c251b20d587a42191'
def sha(b):return hashlib.sha256(b).hexdigest()
def write(p,b):
 p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('xb') as f:f.write(b)
def js(o):return (json.dumps(o,indent=2)+'\n').encode()
def pin(p):
 b=p.read_bytes();return {'path':str(p.relative_to(R)),'bytes':len(b),'sha256':sha(b)}
raw=(P.parent/'exact-source/before.json').read_bytes();identity=json.loads(raw);assert identity['sourceRevision']==S and identity['sourceTree']==T and identity['allTrackedSourceContentsAndModesMatch']
assert subprocess.check_output(['git','rev-parse',S+'^{tree}'],text=True).strip()==T
write(P/'local-before-original.json',raw)
expected={k:identity[k] for k in ['files','bytes','aggregateSha256']}
binding={'sourceRevision':S,'sourceTree':T,'expectedIdentity':expected,'sourcePR':61,'runs':{'manual':34982876952,'pr-source':34982794201,'publisher-preview':34982794078},'workflowPaths':{'manual':'.github/workflows/qualify-release-source.yml','pr-source':'.github/workflows/deploy-pages.yml','publisher-preview':'.github/workflows/publish-frozen-pages.yml'},'events':{'manual':'workflow_dispatch','pr-source':'pull_request','publisher-preview':'pull_request'},'actualParentAuthorities':[pin(P/n) for n in ['manual-dispatch.json','branch-runs-first.json']], 'localIdentityAuthority':pin(P.parent/'exact-source/before.json'),'automationRevision':None,'scope':'Actual parent-observed IDs; verify every actual API head before collection. PR automation remains unknown until the original completed checkout proves it. No dispatch, source execution, artifact-body download or publication.'}
write(P/'run-binding.json',js(binding))
paths=['.github/workflows/qualify-release-source.yml','.github/workflows/deploy-pages.yml','.github/workflows/publish-frozen-pages.yml','scripts/run-test-shard.mjs','scripts/check-source-identity.mjs','game/ui/library-panel.mjs','game/ui/focus-clearance.mjs','game/ui/game-shell.mjs','game/ui/controller-settings.mjs','game/ui/backup-set-panel.mjs','game/test/focus-clearance.test.mjs','game/test/attempt-export-panel.test.mjs','game/test/controller-settings.test.mjs','game/test/field-kit-flow.test.mjs','game/test/gallery-focus.test.mjs','game/test/helpers/solo-dom.mjs']
rows=[]
for rel in paths:
 b=subprocess.check_output(['git','show',S+':'+rel]);name=rel.replace('/','__');write(P/'source-executed'/name,b);blob=subprocess.check_output(['git','rev-parse',S+':'+rel],text=True).strip();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==blob;rows.append({'sourcePath':rel,'evidencePath':name,'bytes':len(b),'sha256':sha(b),'gitBlob':blob})
write(P/'source-executed/receipt.json',js({'sourceRevision':S,'sourceTree':T,'files':rows,'scope':'Pinned selected Git blobs, not executed code evidence until actual checkout logs bind these revisions.'}))
runner=(P/'source-executed/scripts__run-test-shard.mjs').read_bytes();prior=(old/'source-executed/scripts__run-test-shard.mjs').read_bytes();assert runner==prior
roots=['scripts','game','authoring/motion-lab','platforms/desktop/test','platforms/ios/test'];test=re.compile(r'(?:^|/)(?:test-[^/]+|[^/]+\.test)\.mjs$')
treeBytes=subprocess.check_output(['git','ls-tree','-rz','--full-tree',S]);files=[];blobs={}
for row in treeBytes.split(b'\0'):
 if not row:continue
 header,p=row.split(b'\t',1);mode,kind,oid=header.decode().split();rel=p.decode();
 if kind=='blob' and any(rel.startswith(root+'/') for root in roots) and test.search(rel):
  assert mode in ['100644','100755'];files.append(rel);blobs[rel]={'mode':mode,'gitBlob':oid}
files.sort();parts=[{'shard':i+1,'total':4,'files':files[i::4]} for i in range(4)]
# List-only invocation has no test execution. It corroborates pinned Git selection against current exact checkout.
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==S
for sh in parts:
 b=subprocess.check_output(['node','scripts/run-test-shard.mjs','--shard',str(sh['shard'])+'/4','--list']);ls=b.decode().splitlines();assert ls[0]==f'Running {len(sh["files"])}/{len(files)} test files in shard {sh["shard"]}/4.' and ls[1:]==sh['files'];write(P/f'partition-list-{sh["shard"]}.log',b)
write(P/'expected-test-partitions.json',js({'sourceRevision':S,'sourceTree':T,'basis':'Current pinned Git blob paths, exact retained runner roots/predicate/lexical sort/modulo, corroborated by actual --list only. No source tests executed. Subtest TAP totals are deliberately unknown until all real shard logs finish.','count':len(files),'runnerSha256':sha(runner),'roots':roots,'shards':parts,'gitBlobs':blobs,'expectedSubtestTotal':None}))
originals=[]
for name in ['observe.py','finalize.py','review-checkouts.py','bind-observed-automation.py','review-pr-partitions.py']:
 b=(old/name).read_bytes();write(P/'template-originals'/name,b);originals.append({'path':name,'bytes':len(b),'sha256':sha(b)})
 s=b.decode()
 s=s.replace("SOURCE='4c85277ac7393eeeabab035387d4d4ae8734aba1'\nTREE='d3549d0efd15529f71f4cff9a940bdda5e84f3a6'", "binding=json.loads((P/'run-binding.json').read_text())\nSOURCE=binding['sourceRevision']\nTREE=binding['sourceTree']")
 s=s.replace("RUNS={'manual':34968674253,'pr-source':34968653240,'publisher-preview':34968653164}","RUNS=binding['runs']")
 s=s.replace("EXPECTED={'files':4884,'bytes':819778358,'aggregateSha256':'9f10381f3577b561c3505540b916a6cf9e966218665df60e9f5fa5a6321f085e'}", "EXPECTED=binding['expectedIdentity']")
 s=s.replace("api('pulls/59')", "api('pulls/'+str(binding['sourcePR']))")
 s=s.replace("job['run_id']==34968653240", "job['run_id']==binding['runs']['pr-source']")
 s=s.replace("assert hashlib.sha256(rawrunner).hexdigest()=='dec7c80967cb23c6873968ef28f4c948203539e482c27787713e5f4c1ffc6730'", "assert hashlib.sha256(rawrunner).hexdigest()==expected['runnerSha256']")
 if name=='observe.py':
  s=s.replace("assert run['head_sha']==SOURCE and run['run_attempt']==1", "assert run['head_sha']==SOURCE and run['run_attempt']==1\n   assert run['event']==binding['events'][label] and run['path'].split('@')[0]==binding['workflowPaths'][label]")
  s=s.replace("'exceptionType':type(error).__name__,'scope'", "'exceptionType':type(error).__name__,'message':str(error)[:1000],'scope'")
 # Keep complete original failure collection; immutable outputs and normal helper syntax checks only.
 ast.parse(s);write(P/name,s.encode())
write(P/'preparation-review.json',js({'status':'READY_FOR_ACTUAL_OBSERVATION','sourceRevision':S,'sourceTree':T,'identity':expected,'runs':binding['runs'],'testFileCountDerived':len(files),'shardFileCounts':[len(x['files']) for x in parts],'expectedSubtestTotal':None,'automationRevision':None,'retainedTemplateTools':originals,'newPythonToolsSyntaxChecked':5,'sourceTestsExecuted':False,'listOnlyCorroborations':4,'sourceOrRemoteMutations':False,'phaseAccepted':False}))
print(json.dumps({'files':len(files),'shards':[len(x['files']) for x in parts],'expectedIdentity':expected,'runs':binding['runs']}))
