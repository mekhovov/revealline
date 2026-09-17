"""Run exactly the reviewed whole-file cohort once per named bounded runtime."""
from pathlib import Path
import json,hashlib,subprocess,sys,time,re,os,signal
D=Path(__file__).resolve().parent;version=sys.argv[1];assert version in ['20.19.5','22.22.2'];F=D/'fixture';O=D/'runs'/version;O.mkdir(parents=True,exist_ok=False)
node=Path.home()/'.local/share/mise/installs/node'/version/'bin/node';sha=lambda raw:hashlib.sha256(raw).hexdigest()
def snapshot():return [{'path':str(p.relative_to(F)),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(F.rglob('*')) if p.is_file()]
before=snapshot();assert before==json.loads((D/'fixture-inputs.json').read_text());(O/'inputs.json').write_text(json.dumps(before,indent=2)+'\n');files=json.loads((D/'cohort.json').read_text());assert len(files)==11
argv=[str(node),'--max-old-space-size=1024','--test','--test-concurrency=1',*files];started=time.monotonic();process=subprocess.Popen(argv,cwd=F,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True);timed=False
try:raw=process.communicate(timeout=180)[0]
except subprocess.TimeoutExpired:
 timed=True;os.killpg(process.pid,signal.SIGKILL);raw=process.communicate()[0]
elapsed=time.monotonic()-started;(O/'stdout.log').write_bytes(raw);after=snapshot();(O/'outputs.json').write_text(json.dumps(after,indent=2)+'\n');text=raw.decode(errors='replace');counts={k:int(v) for k,v in re.findall(r'^# (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)$',text,re.M)}
receipt={'source':'822f3290787c704a217e7c185d4b8beb7a527e82','runtime':subprocess.check_output([str(node),'--version'],text=True).strip(),'argv':argv,'cwd':str(F),'v8OldSpaceMiB':1024,'timeoutSeconds':180,'timedOut':timed,'exitCode':process.returncode,'elapsedSeconds':round(elapsed,3),'testFiles':len(files),'counts':counts,'failureNames':re.findall(r'^\s*not ok \d+ - (.*)$',text,re.M),'inputCount':len(before),'inputsUnchanged':before==after,'logBytes':len(raw),'logSha256':sha(raw),'processTerminal':process.poll() is not None,'scope':'Exactly11 complete files on the fresh822f+e674+c79 fixture; bounded modeled evidence only, not native/hardware/build/public acceptance.'}
(O/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2));
if process.returncode!=0:print(text[-18000:])
sys.exit(process.returncode)
