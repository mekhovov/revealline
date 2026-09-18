from pathlib import Path
import subprocess,os,json,datetime,hashlib,time,sys
r=Path.cwd();b=r/'.cache/p03-motion-focus-rotation-4fd8';w=r/'.cache/worktrees/p03-motion-focus-rotation';name=sys.argv[1];node=sys.argv[2];args=sys.argv[3:];o=b/name;o.mkdir()
def pin(p):
 raw=p.read_bytes();return {'path':str(p),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
cmd=[node,*args];start=time.time();began=datetime.datetime.now(datetime.timezone.utc).isoformat()
inputs=[pin(w/p) for p in ['authoring/motion-lab/display.mjs','game/test/motion-lab-display-host.test.mjs','game/test/motion-lab-display-restoration.test.mjs']]
with (o/'stdout').open('xb') as so,(o/'stderr').open('xb') as se:result=subprocess.run(cmd,cwd=w,env={**os.environ,'GIT_NO_LAZY_FETCH':'1'},stdout=so,stderr=se,timeout=60)
record={'command':cmd,'cwd':str(w),'startedAt':began,'seconds':time.time()-start,'exitCode':result.returncode,'inputs':inputs,'stdout':pin(o/'stdout'),'stderr':pin(o/'stderr')}
(o/'receipt.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record));print((o/'stdout').read_text()[-1200:]);print((o/'stderr').read_text()[-1200:]);sys.exit(result.returncode)
