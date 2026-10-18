from pathlib import Path
import subprocess,json,datetime,time,hashlib,sys,os,traceback
N=Path(__file__).resolve().parent;sha=lambda b:hashlib.sha256(b).hexdigest()
assert len(sys.argv)==3,'exact plan and root approval SHA256 arguments required'
raw=(N/'qualification-plan.json').read_bytes();assert sha(raw)==sys.argv[1];P=json.loads(raw)
approvalRaw=(N/'ROOT-ONCE-CONTROLLER-APPROVAL.json').read_bytes();assert sha(approvalRaw)==sys.argv[2];approval=json.loads(approvalRaw)
assert approval['status']=='APPROVED_ONCE' and approval['planSHA256']==sys.argv[1] and approval['controllerSHA256']==sha(Path(__file__).read_bytes()) and approval['head']==P['head'] and approval['run']==P['run']
HEAD=P['head'];TREE=P['tree'];RUN=P['run'];E=Path(P['externalRoot'])
assert E==N/'qualified-originals' and not E.exists()
assert sys.executable=='/opt/homebrew/opt/python@3.14/bin/python3.14' or Path(sys.executable).resolve()==Path('/opt/homebrew/opt/python@3.14/bin/python3.14').resolve()
for key in ['TMPDIR','TMP','TEMP']:assert os.environ[key]==str(N)
remaining={'optional':P['limits']['optionalRemainingAllowanceBytes'],'packaged':P['limits']['familyRemainingAllowanceBytes'],'company':P['limits']['companyRemainingAllowanceBytes']}
assert remaining=={'optional':512*1024**2,'packaged':128*1024**2,'company':1024**3}
assert P['limits']['externalFloorBytes']==3*1024**3 and P['limits']['smallReportReserveBytes']==65*1024**2
def reserve(additional=0):
 s=os.statvfs(N);free=s.f_bavail*s.f_frsize
 required=P['limits']['externalFloorBytes']+sum(remaining.values())+P['limits']['smallReportReserveBytes']+additional
 assert free>=required,{'externalAvailableBytes':free,'requiredBytes':required,'remainingOperations':dict(remaining),'recordReserveBytes':P['limits']['smallReportReserveBytes']}
 return {'availableBytes':free,'requiredBytes':required,'remainingOperations':dict(remaining)}
reserve()
for pin in P['helpers']:
 path=Path(pin['path']);body=path.read_bytes();assert path.parent==N and not path.is_symlink() and len(body)==pin['bytes'] and sha(body)==pin['SHA256']
for path,pin in P['sourcePins'].items():
 f=Path(pin['local']);b=f.read_bytes();assert f.parent==N/'source-inputs' and not f.is_symlink()
 assert len(b)==pin['bytes'] and sha(b)==pin['sha256'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==pin['gitBlob'] and pin['canonicalSourceRevision']==HEAD
reserve();OUT=N/'actual-once';OUT.mkdir(exist_ok=False);start=time.monotonic();counter=0;last=None
env={**os.environ,'FPV_APPROVED_PLAN_SHA256':sys.argv[1],'PYTHONDONTWRITEBYTECODE':'1'}
def put(p,obj):
 b=(json.dumps(obj,indent=2)+'\n').encode();assert len(b)<2*1024**2;reserve(len(b))
 with p.open('xb')as f:f.write(b);f.flush();os.fsync(f.fileno())
def api(p):
 reserve()
 return json.loads(subprocess.check_output(['/opt/homebrew/bin/gh','api','repos/mekhovov/revealline/'+p],cwd='/',env=env))
def wait(job):
 global counter,last
 while True:
  reserve()
  assert time.monotonic()-start<75*60,'cooperative deadline exceeded; blocked syscalls are not interrupted; no retry'
  run=api('actions/runs/'+str(RUN));assert run['head_sha']==HEAD and run['event']=='workflow_dispatch' and run['path']=='.github/workflows/company-edition-candidate.yml'
  jobs=api('actions/runs/'+str(RUN)+'/jobs')['jobs'];j=next((x for x in jobs if x['name']==job),None)
  steps=[{'name':x['name'],'status':x['status'],'conclusion':x['conclusion']}for x in (j or {}).get('steps',[]) if x['status']=='in_progress']
  state={'job':job,'runStatus':run['status'],'runConclusion':run['conclusion'],'jobStatus':j['status']if j else None,'jobConclusion':j['conclusion']if j else None,'activeSteps':steps,'jobUpdatedAt':(j or {}).get('completed_at')or(j or {}).get('started_at')}
  if state!=last:
   counter+=1;put(OUT/('cloud-state-'+str(counter)+'.json'),{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),**state});last=state
   print(json.dumps(state),flush=True)
  if j and j['status']=='completed':
   assert j['conclusion']=='success',state
   if job!='candidate' or run['conclusion']=='success':return
  if run['status']=='completed':raise RuntimeError('run completed without required successful job')
  time.sleep(30)
def stage(name,helper,receipt):
 reserve();assert name in remaining
 pin=next(x for x in P['helpers']if Path(x['path']).name==helper);h=Path(pin['path']);body=h.read_bytes();assert len(body)==pin['bytes'] and sha(body)==pin['SHA256']
 put(OUT/(name+'-intent.json'),{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':HEAD,'tree':TREE,'run':RUN,'helper':pin,'oneInvocation':True,'aggregateReserve':reserve()})
 result=subprocess.run([sys.executable,'-B',str(h)],capture_output=True,cwd='/',env=env)
 for suffix,content in [('stdout',result.stdout),('stderr',result.stderr)]:
  reserve(len(content))
  with (OUT/(name+'.'+suffix+'.log')).open('xb')as f:f.write(content);f.flush();os.fsync(f.fileno())
 record={'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':HEAD,'tree':TREE,'run':RUN,'helper':pin,'actualExitCode':result.returncode,'stdoutSHA256':sha(result.stdout),'stderrSHA256':sha(result.stderr)}
 if result.returncode==0:
  p=E/receipt;b=p.read_bytes();assert len(b)<2*1024**2;reserve(len(b))
  with (OUT/receipt).open('xb')as f:f.write(b);f.flush();os.fsync(f.fileno())
  record['receipt']={'originalPath':str(p),'externalCopy':str(OUT/receipt),'bytes':len(b),'SHA256':sha(b)}
 put(OUT/(name+'-terminal.json'),record);print(json.dumps({'stage':name,**record}),flush=True)
 assert result.returncode==0,'stage failure retained; no retry'
 del remaining[name]
 put(OUT/(name+'-accepted-reserve.json'),{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualAcceptedStage':name,'terminalSHA256':sha((OUT/(name+'-terminal.json')).read_bytes()),'aggregateReserve':reserve()})
put(OUT/'controller-intent.json',{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':HEAD,'tree':TREE,'run':RUN,'planSHA256':sys.argv[1],'approvalSHA256':sys.argv[2],'controllerSHA256':sha(Path(__file__).read_bytes()),'scope':'One current optional original then packaged family then Company original; external only; no retry/old replay/native'})
try:
 commit=api('git/commits/'+HEAD);assert commit['sha']==HEAD and commit['tree']['sha']==TREE and [x['sha']for x in commit['parents']]==P['parents']
 put(OUT/'canonical-candidate-identity.json',commit)
 wait('optional-practice');stage('optional','qualify-combined-optional.py','qualification-original-members-and-closure.json')
 stage('packaged','qualify-combined-family-labels.py','packaged-family-label-receipt.json')
 wait('candidate');stage('company','qualify-combined-company.py','company-original-members-receipt.json')
 put(OUT/'controller-result.json',{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':HEAD,'tree':TREE,'run':RUN,'allThreeStagesPassed':True,'scope':'Current package/software evidence only'})
 put(OUT/'controller-terminal.json',{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':0})
except BaseException as e:
 put(OUT/'controller-negative.json',{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'type':type(e).__name__,'message':str(e),'traceback':traceback.format_exc(),'noAutomaticRetry':True})
 put(OUT/'controller-terminal.json',{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':1})
 raise
