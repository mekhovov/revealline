from pathlib import Path
import subprocess,json,datetime,time,hashlib,sys,os
N=Path('[STORAGE_5333_PREPARATION]');PLAN=json.loads((N/'PACKAGE-QUALIFICATION-PLAN-v2.json').read_text());HEAD=PLAN['head'];RUN=PLAN['run'];E=Path(PLAN['externalRoot']);APPROVAL=json.loads((N/'ROOT-ONCE-CONTROLLER-APPROVAL.json').read_text());assert APPROVAL['planSHA256']==hashlib.sha256((N/'PACKAGE-QUALIFICATION-PLAN-v2.json').read_bytes()).hexdigest() and APPROVAL['controllerSHA256']==hashlib.sha256(Path(__file__).read_bytes()).hexdigest() and APPROVAL['head']==HEAD and APPROVAL['run']==RUN;OUT=N/'actual-once';OUT.mkdir(exist_ok=False);start=time.monotonic();counter=0;last=None
sha=lambda b:hashlib.sha256(b).hexdigest()
def put(p,obj):
 b=(json.dumps(obj,indent=2)+'\n').encode();assert len(b)<2*1024**2;s=os.statvfs(N);assert s.f_bavail*s.f_frsize>=65*1024**2+len(b)
 with p.open('xb')as f:f.write(b);f.flush();os.fsync(f.fileno())
def api(p):return json.loads(subprocess.check_output(['gh','api','repos/mekhovov/revealline/'+p]))
def wait(job):
 global counter,last
 while True:
  assert time.monotonic()-start<75*60,'cooperative deadline exceeded; no retry'
  run=api('actions/runs/'+str(RUN));assert run['head_sha']==HEAD and run['event']=='workflow_dispatch' and run['path']=='.github/workflows/company-edition-candidate.yml'
  jobs=api('actions/runs/'+str(RUN)+'/jobs')['jobs'];j=next((j for j in jobs if j['name']==job),None)
  state={'job':job,'runStatus':run['status'],'runConclusion':run['conclusion'],'jobStatus':j['status']if j else None,'jobConclusion':j['conclusion']if j else None}
  if state!=last:
   counter+=1;put(OUT/('cloud-state-'+str(counter)+'.json'),{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),**state});last=state
  if j and j['status']=='completed':
   assert j['conclusion']=='success',state
   if job!='candidate' or run['conclusion']=='success':return
  if run['status']=='completed':raise RuntimeError('run completed without required successful job')
  time.sleep(30)
def stage(name,helper,receipt):
 pin=next(x for x in PLAN['helpers']if Path(x['path']).name==helper);h=Path(pin['path']);b=h.read_bytes();assert len(b)==pin['bytes']and sha(b)==pin['SHA256'];put(OUT/(name+'-intent.json'),{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':HEAD,'run':RUN,'helper':pin,'oneInvocation':True})
 result=subprocess.run([sys.executable,str(h)],capture_output=True)
 with (OUT/(name+'.stdout.log')).open('xb')as f:f.write(result.stdout)
 with (OUT/(name+'.stderr.log')).open('xb')as f:f.write(result.stderr)
 record={'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':HEAD,'run':RUN,'helper':pin,'actualExitCode':result.returncode,'stdoutSHA256':sha(result.stdout),'stderrSHA256':sha(result.stderr)}
 if result.returncode==0:
  p=E/receipt;raw=p.read_bytes();assert len(raw)<2*1024**2
  with (OUT/receipt).open('xb')as f:f.write(raw)
  record['receipt']={'originalPath':str(p),'internalCopy':str(OUT/receipt),'bytes':len(raw),'SHA256':sha(raw)}
 put(OUT/(name+'-terminal.json'),record);print(json.dumps({'stage':name,**record}),flush=True);assert result.returncode==0,'stage failure preserved; no retry'
put(OUT/'controller-intent.json',{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':HEAD,'run':RUN,'planSHA256':sha((N/'PACKAGE-QUALIFICATION-PLAN-v2.json').read_bytes()),'controllerSHA256':sha(Path(__file__).read_bytes()),'scope':'Exactly storage5333 optional original then Company original. No family suite, duplicate dispatch/download/build, old7842 or Library qualification.'})
try:
 wait('optional-practice');stage('optional','qualify-storage-optional-v2.py','qualification-original-members-and-closure.json');wait('candidate');stage('company','qualify-storage-company-v2.py','company-original-members-receipt.json')
 put(OUT/'controller-result.json',{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':HEAD,'run':RUN,'allTwoStagesPassed':True,'scope':'Exact source artifact/software gates only; no native/player/public or future-main acceptance'})
except BaseException as e:
 put(OUT/'controller-negative.json',{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':HEAD,'run':RUN,'type':type(e).__name__,'message':str(e),'noAutomaticRetry':True});raise
