EXECUTION_REQUEST_SHA = 'e3cce9d3079639ad5282cdf973c375f9580cd77f5e9ebee00bb3c3138614227f'
from pathlib import Path
import datetime,hashlib,json,subprocess,time
D=Path(__file__).resolve().parent;O=D/'execution-originals';O.mkdir(exist_ok=False)
raw=(D/'execution-request.reviewed.json').read_bytes();assert hashlib.sha256(raw).hexdigest()==EXECUTION_REQUEST_SHA;assert json.loads(raw)['reviewed'] is True
commands=[('before',['python3','-B',str(D/'collect-live.py'),'before'],120),('audit',['python3','-B',str(D/'http-tools/http_audit.py'),'--run','--workers','6'],1900),('after',['python3','-B',str(D/'collect-live.py'),'after'],120)]
for name,cmd,timeout in commands:
 started=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic();timed=False
 with (O/(name+'.stdout')).open('xb') as stdout,(O/(name+'.stderr')).open('xb') as stderr:
  try:p=subprocess.run(cmd,stdout=stdout,stderr=stderr,timeout=timeout);code=p.returncode
  except subprocess.TimeoutExpired:code=None;timed=True
 receipt={'command':cmd,'startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'seconds':time.monotonic()-t,'exitCode':code,'timedOut':timed}
 (O/(name+'.receipt.json')).write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'step':name,**receipt}),flush=True)
 if name=='before' and code!=0:raise SystemExit('Before authorities failed; audit not started')
 if name=='audit' and timed:raise SystemExit('Audit process timeout; preserve outputs and diagnose before any continuation')
