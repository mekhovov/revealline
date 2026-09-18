from pathlib import Path
import subprocess as sp,json,hashlib,datetime,time,re,shutil
r=Path.cwd();c=r/'.cache/p05-picker-v0618-integration';w=r/'.cache/worktrees/p05-picker-clearance-v0618';d=c/'checks';d.mkdir(exist_ok=True)
assert shutil.disk_usage(r).free>512*1024**2
paths=sp.check_output(['git','diff','--name-only'],cwd=w).decode().splitlines()
expected=['authoring/skills/xonix-runtime-maintainer/SKILL.md','docs/still-media-workshop.md','game/test/focus-clearance.test.mjs','game/test/still-media-panel.test.mjs','game/ui/focus-clearance.mjs','game/ui/still-media-panel.mjs','package.json','package-lock.json','game/build-config.json']
assert sorted(paths)==sorted(expected),paths
results=[]
def run(name,cmd):
 assert not (d/(name+'.json')).exists();t=time.monotonic();start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=sp.run(cmd,cwd=w,capture_output=True,timeout=90);elapsed=time.monotonic()-t
 for suffix,b in [('stdout',p.stdout),('stderr',p.stderr)]: (d/(name+'.'+suffix)).write_bytes(b)
 a={'name':name,'command':cmd,'cwd':str(w),'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':round(elapsed,3),'exitCode':p.returncode,'stdout':{'bytes':len(p.stdout),'sha256':hashlib.sha256(p.stdout).hexdigest()},'stderr':{'bytes':len(p.stderr),'sha256':hashlib.sha256(p.stderr).hexdigest()}}
 if '--test' in cmd:a['counts']={key:int(v)for key,v in re.findall(r'^# (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$',p.stdout.decode(),re.M)}
 (d/(name+'.json')).write_text(json.dumps(a,indent=2)+'\n');results.append(a);assert p.returncode==0,(name,p.stdout[-2000:],p.stderr[-1000:]);print(name,'PASS',a.get('counts',''),flush=True)
for v in ['20.19.5','22.22.2']:
 run('focused-node'+v,[str(Path.home()/'.local/share/mise/installs/node'/v/'bin/node'),'--test','game/test/focus-clearance.test.mjs','game/test/still-media-panel.test.mjs'])
node=str(Path.home()/'.local/share/mise/installs/node/22.22.2/bin/node')
run('format',[node,str(r/'node_modules/prettier/bin/prettier.cjs'),'--check',*paths])
run('lint',[node,str(r/'node_modules/eslint/bin/eslint.js'),'--config',str(c/'eslint.config.mjs'),*filter(lambda x:x.endswith('.mjs'),paths)])
run('diff-check',['git','diff','--check'])
(c/'verification-summary.json').write_text(json.dumps({'status':'INTEGRATED_FOCUSED_CHECKS_PASS','checks':results,'donorSixFile104EachPreservedSeparately':True,'fullSourceGatesRun':False,'nativeRetestedByThisAgent':False},indent=2)+'\n')
