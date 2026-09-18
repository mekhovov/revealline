from pathlib import Path
import subprocess as sp,json,hashlib,shutil,datetime,re
root=Path.cwd();c=root/'.cache/p05-picker-clearance-next';w=root/'.cache/worktrees/p05-picker-clearance-next';source='4fd8e2dac4fdc851d0d2bf0b21e77162d9d405c9';tree='d16edac0127fc96139445ae2365cc74499f80921'
paths=['authoring/skills/xonix-runtime-maintainer/SKILL.md','docs/still-media-workshop.md','game/test/still-media-panel.test.mjs','game/ui/still-media-panel.mjs']
def sha(b):return hashlib.sha256(b).hexdigest()
def git(*a):return sp.check_output(['git',*a],cwd=w)
def put(p,b):
 used=sum(q.stat().st_size for base in [w,c] for q in base.rglob('*') if q.is_file());assert used+len(b)<16*1024**2;assert shutil.disk_usage(root).free>512*1024**2+len(b)
 assert not p.exists();p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
def obj(p,v):put(p,(json.dumps(v,indent=2)+'\n').encode())
def pin(p):b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':sha(b)}
assert git('rev-parse','HEAD').decode().strip()==source and git('rev-parse','HEAD^{tree}').decode().strip()==tree
assert git('diff','--cached','--name-only')==b''
assert sorted(git('diff','--name-only').decode().splitlines())==paths
r=sp.run([str(Path.home()/'.local/share/mise/installs/node/22.22.2/bin/node'),str(root/'node_modules/prettier/bin/prettier.cjs'),'--check',*paths],cwd=w,capture_output=True,timeout=60);put(c/'format-final.log',r.stdout+r.stderr);assert r.returncode==0
r=sp.run(['git','diff','--check'],cwd=w,capture_output=True);put(c/'diff-check-final.log',r.stdout+r.stderr);assert r.returncode==0
put(c/'candidate.diff',git('diff','--',*paths));put(c/'source-status.txt',git('status','--porcelain'))
rows=[]
for p in paths:
 b=(w/p).read_bytes();before=git('show',source+':'+p)
 put(c/'preimage'/p,before);put(c/'candidate'/p,b)
 rows.append({'path':p,'mode':'100644','bytes':len(b),'sha256':sha(b),'gitPreimageBlob':git('rev-parse',source+':'+p).decode().strip(),'preimageBytes':len(before),'preimageSha256':sha(before)})
obj(c/'candidate-pins.json',{'source':source,'tree':tree,'paths':rows})
original=root/'.cache/p05-public-audit-a7a4e2d7/native-picker-occlusion-finding.json';put(c/'native-finding.original.json',original.read_bytes())
obj(c/'native-geometry.context.json',{'source':'Parent-provided measured public v0.61.1 geometry, not a new candidate browser run','portrait':{'viewport':[390,844],'dialog':{'x':21,'y':16,'width':348,'height':812,'scrollTop':881.5},'operations':{'x':36,'y':31,'width':318,'height':205.59375},'focusedFile':{'x':36,'y':45.375,'width':318,'height':64}},'rotation':[844,390],'unchangedObservedFlow':'Preview succeeded and restored focus; Escape Close workshop returned Open local media. No assignment write.','separateUnfixedFinding':'Close local connections drops focus to BODY; kept outside this correction.'})
failures=[]
for name in ['focused-node20.19.5.log','focused-node22.22.2.log','focused-r2-node20.19.5.log','focused-r2-node22.22.2.log']:
 b=(c/name).read_text();blocks=[x for x in b.split('# Subtest: ')[1:]if '\nnot ok 'in x];assert len(blocks)==27
 expected='/game/app.mjs' if '-r2-'not in name else '/authoring/motion-lab/presets.json'
 assert all(expected in x and ('ERR_MODULE_NOT_FOUND' in x or 'ENOENT' in x) for x in blocks)
 failures.append({'original':pin(c/name),'failures':27,'scope':'Sparse local fixture inputs missing; retained originals. No runtime/test assertion changed to resolve.'})
obj(c/'verification-summary.json',{'status':'FOCUSED_SOURCE_REGRESSIONS_PASS_NATIVE_CANDIDATE_REVIEW_PENDING','tests':[{**json.loads((c/f'focused-final-node{v}.json').read_text()),'original':pin(c/f'focused-final-node{v}.log')}for v in ['20.19.5','22.22.2']],'red':pin(c/'regression-red-node22.log'),'redTests':3,'setupFailures':failures,'nativeBrowserRun':False,'fullSuiteRun':False,'buildRun':False,'versionChanged':False,'commitCreated':False})
evidence=[pin(p) for p in sorted(c.rglob('*'))if p.is_file() and p.name not in ['ready.json','evidence-pins.json']]
obj(c/'evidence-pins.json',{'records':evidence})
ready={'status':'LOCAL_PICKER_CLEARANCE_CANDIDATE_READY_FOR_ROOT_REVIEW','preparedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'base':{'commit':source,'tree':tree,'version':'v0.61.6'},'worktree':str(w),'branch':'codex/p05-picker-clearance-next','changedPaths':len(paths),'productionChange':'Reuse existing measured focus clearance for still-picture dialog; preserve sticky operations and all transaction/focus ownership.','candidatePins':pin(c/'candidate-pins.json'),'diff':pin(c/'candidate.diff'),'evidencePins':pin(c/'evidence-pins.json'),'verification':pin(c/'verification-summary.json'),'scope':['Current focused form control clears measured sticky feedback after focus or resize/reflow.','No ordinary-scroll following, refocusing, decoder, assignment, stored media or game changes.','One attached owner across reopen; closed callbacks inert, disposal retires callbacks and resets insets.','Original public finding and expected-red regression retained.'],'remaining':['Root independent code/evidence review.','Actual candidate portrait/landscape, Large/Plain and zoom hit/focus checks.','Version allocation, exact committed source gates, release/Pages and public acceptance by root.','Separate Close local connections return-focus finding remains open.'],'limits':{'managedCapBytes':16*1024**2,'managedBytes':sum(q.stat().st_size for base in [w,c]for q in base.rglob('*')if q.is_file()),'reserveBytes':512*1024**2,'freeBytes':shutil.disk_usage(root).free,'sourceExistingUnchanged':True,'indexUnstaged':True,'remoteMutation':False,'browserRun':False}}
obj(c/'ready.json',ready);print(json.dumps({'ready':pin(c/'ready.json'),'candidatePins':pin(c/'candidate-pins.json'),'paths':paths,'managedBytes':ready['limits']['managedBytes'],'freeBytes':ready['limits']['freeBytes']},indent=2))
