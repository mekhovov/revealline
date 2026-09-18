from pathlib import Path
import subprocess, json, sys, hashlib, time, os
ROOT=Path(__file__).resolve().parents[2]
P=Path(__file__).resolve().parent
W=ROOT/'.cache/worktrees/p08-versus-footprint'
family=sys.argv[1]
node={'20':'/Users/oleksandr.mekhovov/.local/share/mise/installs/node/20.19.5/bin/node','22':'/Users/oleksandr.mekhovov/.local/share/mise/installs/node/22.22.2/bin/node'}[family]
paths=json.loads((P/'cohort-paths.json').read_text())
def pins():
 files=[p for p in W.rglob('*') if p.is_file() and p.name!='.git']
 return [{'path':str(p.relative_to(W)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(files)]
before=pins();cmd=[node,'--max-old-space-size=1024','--test','--test-concurrency='+str(int(sys.argv[2]) if len(sys.argv)>2 else 1),*paths]
out=P/f'cohort-node{family}.stdout';err=P/f'cohort-node{family}.stderr'
start=time.monotonic();stopped=None
with out.open('xb') as stdout, err.open('xb') as stderr:
 proc=subprocess.Popen(cmd,cwd=W,stdout=stdout,stderr=stderr,env={**os.environ,'GIT_NO_LAZY_FETCH':'1'})
 while proc.poll() is None:
  if time.monotonic()-start>600 or out.stat().st_size+err.stat().st_size>8_000_000:
   stopped='bounded time/output limit';proc.terminate();break
  time.sleep(.2)
 try:code=proc.wait(timeout=5)
 except subprocess.TimeoutExpired:proc.kill();code=proc.wait()
after=pins()
receipt={'command':cmd,'cwd':str(W),'node':subprocess.check_output([node,'--version'],text=True).strip(),'exitCode':code,'seconds':time.monotonic()-start,'stopped':stopped,'sourceInputs':before,'inputsUnchanged':before==after,'scope':'Scoped23-file host-consumer and geometry cohort; not six full source gates, build, native or public acceptance.'}
(P/f'cohort-node{family}.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:receipt[k] for k in ['node','exitCode','seconds','stopped','inputsUnchanged']}))
print('\n'.join(out.read_text().splitlines()[-12:]))
