from pathlib import Path
import os,sys,json,hashlib,datetime,subprocess
N=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
raw=(N/'COMPANY-ONLY-CONTINUATION-PLAN.json').read_bytes();plan=json.loads(raw)
HEAD=plan['head'];RUN=plan['run']
approval=json.loads((N/'ROOT-COMPANY-ONLY-ONCE-APPROVAL.json').read_text())
peer=(N/'COMPANY-ONLY-PEER-REVIEW.json').read_bytes()
assert approval['decision']=='APPROVE_ONE_COMPANY_ONLY_OPERATION'
assert approval['head']==HEAD and approval['run']==RUN
assert approval['planSHA256']==sha(raw) and approval['runnerSHA256']==sha(Path(__file__).read_bytes())
assert approval['helperSHA256']==plan['helper']['SHA256'] and approval['peerReviewSHA256']==sha(peer)
for pin in [plan['helper'],plan['runner'],plan['acceptedOptionalReceipt'],plan['acceptedOptionalTerminal'],plan['priorHelper'],plan['retainedControllerToolOutput'],plan['retainedControllerAttribution']]:
 b=Path(pin['path']).read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['SHA256']
assert plan['previousController']['reportedToolExitCode']==1 and plan['previousController']['companyStageEntered'] is False
assert all(os.environ.get(k)==str(N) for k in ('TMPDIR','TMP','TEMP')),'external temporary directories required'
s=os.statvfs(N);free=s.f_bavail*s.f_frsize
assert free>=3*1024**3+1024**3,'external reserve plus remaining Company allowance required'
OUT=N/'actual-once';OUT.mkdir(exist_ok=False)
env={**os.environ,'TMPDIR':str(OUT),'TMP':str(OUT),'TEMP':str(OUT),'PYTHONDONTWRITEBYTECODE':'1'}
def put(name,b):
 if not isinstance(b,bytes):b=(json.dumps(b,indent=2)+'\n').encode()
 with (OUT/name).open('xb')as f:f.write(b);f.flush();os.fsync(f.fileno())
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
put('company-only-intent.json',{'UTC':stamp(),'head':HEAD,'run':RUN,'planSHA256':sha(raw),'runnerSHA256':sha(Path(__file__).read_bytes()),'helper':plan['helper'],'rootApprovalSHA256':sha((N/'ROOT-COMPANY-ONLY-ONCE-APPROVAL.json').read_bytes()),'peerReviewSHA256':sha(peer),'externalFreeBytes':free,'scope':'One fresh Company original operation; no old controller restart, optional replay, native or publication','noAutomaticRetry':True})
result=None
try:
 result=subprocess.run([sys.executable,'-B',plan['helper']['path']],capture_output=True,env=env,cwd=OUT)
 put('company.stdout.log',result.stdout);put('company.stderr.log',result.stderr)
 terminal={'UTC':stamp(),'head':HEAD,'run':RUN,'actualChildExitCode':result.returncode,'stdoutSHA256':sha(result.stdout),'stderrSHA256':sha(result.stderr),'noAutomaticRetry':True}
 if result.returncode==0:
  p=OUT/'company-original-members-receipt.json';b=p.read_bytes();r=json.loads(b)
  assert r['sourceRevision']==HEAD and r['run']==RUN
  terminal['receipt']={'path':str(p),'bytes':len(b),'SHA256':sha(b)}
 put('company-only-terminal.json',terminal)
 print(json.dumps(terminal,indent=2),flush=True)
 if result.returncode:sys.exit(result.returncode)
except Exception as e:
 record={'UTC':stamp(),'head':HEAD,'run':RUN,'type':type(e).__name__,'message':str(e),'actualChildExitCode':result.returncode if result is not None else None,'noAutomaticRetry':True}
 print(json.dumps({'operationFailure':record}),file=sys.stderr,flush=True)
 try:put('company-only-negative.json',record)
 except Exception as recordError:print(json.dumps({'secondaryRecordFailure':{'type':type(recordError).__name__,'message':str(recordError)}}),file=sys.stderr,flush=True)
 raise
