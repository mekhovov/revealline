from pathlib import Path
import subprocess as sp,json,hashlib,shutil,datetime
r=Path.cwd();c=r/'.cache/p05-picker-clearance-next';d=c/'label-clearance-r3';w=r/'.cache/worktrees/p05-picker-clearance-next';source='4fd8e2dac4fdc851d0d2bf0b21e77162d9d405c9';tree='d16edac0127fc96139445ae2365cc74499f80921'
paths=['authoring/skills/xonix-runtime-maintainer/SKILL.md','docs/still-media-workshop.md','game/test/focus-clearance.test.mjs','game/test/still-media-panel.test.mjs','game/ui/focus-clearance.mjs','game/ui/still-media-panel.mjs']
def sha(b):return hashlib.sha256(b).hexdigest()
def git(*a):return sp.check_output(['git',*a],cwd=w)
def pin(p):b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':sha(b)}
def put(p,b):
 used=sum(q.stat().st_size for base in[w,c]for q in base.rglob('*')if q.is_file());assert used+len(b)+65536<16*1024**2;assert shutil.disk_usage(r).free>512*1024**2+len(b)+65536;assert not p.exists();p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
def obj(p,v):put(p,(json.dumps(v,indent=2)+'\n').encode())
assert git('rev-parse','HEAD').decode().strip()==source;assert git('rev-parse','HEAD^{tree}').decode().strip()==tree;assert git('diff','--cached','--name-only')==b'';assert sorted(git('diff','--name-only').decode().splitlines())==paths
node=str(Path.home()/'.local/share/mise/installs/node/22.22.2/bin/node');q=sp.run([node,str(r/'node_modules/prettier/bin/prettier.cjs'),'--check',*paths],cwd=w,capture_output=True,timeout=60);put(d/'format-final.log',q.stdout+q.stderr);assert q.returncode==0
q=sp.run(['git','diff','--check'],cwd=w,capture_output=True);put(d/'diff-check-final.log',q.stdout+q.stderr);assert q.returncode==0
put(d/'candidate.diff',git('diff','--',*paths));put(d/'source-status.txt',git('status','--porcelain'))
rows=[]
for p in paths:
 b=(w/p).read_bytes();original=git('show',source+':'+p);put(d/'candidate'/p,b);put(d/'git-preimage'/p,original);rows.append({'path':p,'mode':'100644','bytes':len(b),'sha256':sha(b),'gitPreimageBlob':git('rev-parse',source+':'+p).decode().strip(),'preimageBytes':len(original),'preimageSha256':sha(original)})
obj(d/'candidate-pins.json',{'source':source,'tree':tree,'paths':rows})
put(d/'root-native-r1.original.json',(c/'root-native-r1.json').read_bytes())
for name in ['binding.json','runtime-overrides.json','serve.py']:
 put(d/'native-r3-server'/name,(c/'native-server-r3'/name).read_bytes())
records=[]
for v in ['20.19.5','22.22.2']:
 q=json.loads((d/f'focused-final-node{v}.json').read_text());assert q['exitCode']==0 and q['counts']=={'tests':104,'pass':104,'fail':0,'cancelled':0,'skipped':0,'todo':0};records.append({**q,'original':pin(d/f'focused-final-node{v}.log')})
obj(d/'verification-summary.json',{'status':'EXACT_PORTRAIT_AND_LANDSCAPE_SOURCE_REGRESSIONS_PASS_NATIVE_REVIEW_PENDING','tests':records,'retainedRed':pin(d/'oversize-regression-red-node22.log'),'originalNativeFinding':pin(d/'root-native-r1.original.json'),'originalR1Candidate':pin(c/'ready.json'),'originalR2Candidate':pin(c/'label-clearance-r2/ready.json'),'nativeCandidateRunByThisAgent':False,'fullSuiteRun':False,'buildRun':False,'sourceVersionChanged':False})
evidence=[pin(q) for q in sorted(d.rglob('*'))if q.is_file() and q.name not in['ready.json','evidence-pins.json']];obj(d/'evidence-pins.json',{'files':evidence})
ready={'status':'R3_LABEL_AND_CONTROL_CLEARANCE_READY_FOR_ROOT_REVIEW','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'base':{'commit':source,'tree':tree,'version':'v0.61.6'},'worktree':str(w),'branch':'codex/p05-picker-clearance-next','changedPaths':6,'candidatePins':pin(d/'candidate-pins.json'),'diff':pin(d/'candidate.diff'),'evidencePins':pin(d/'evidence-pins.json'),'verification':pin(d/'verification-summary.json'),'runtimeChange':'Opt-in includeControlLabel defaults false; Still Media uses complete containing label within its dialog as measured reveal target when it fits; otherwise preserve the focused control visibility. Existing sticky operation owner, focus and ordinary-scroll behavior remain.','nativeURL':json.loads((c/'native-server-r3/binding.json').read_text())['url'],'r1HistoryPreserved':True,'remaining':['Root independent source/evidence review and actual r3 label/control focus paint and hit targets.','Version allocation, exact-source qualification and public release.','Separate Close local connections return-focus issue remains open.'],'managedBytes':sum(q.stat().st_size for base in[c,w]for q in base.rglob('*')if q.is_file()),'limits':{'managedCapBytes':16*1024**2,'freeReserveBytes':512*1024**2},'sourceExistingUnchanged':True,'sourceIndexUnstaged':True,'remoteMutation':False,'browserRunByThisAgent':False}
obj(d/'ready.json',ready);print(json.dumps({'ready':pin(d/'ready.json'),'candidatePins':pin(d/'candidate-pins.json'),'managedBytes':ready['managedBytes']}))
