from pathlib import Path
import subprocess,json,datetime,time,hashlib,sys,os,traceback
N=Path("[storage-current]")
PLAN_PATH=N/'PACKAGE-QUALIFICATION-PLAN.json'
PLAN=json.loads(PLAN_PATH.read_text());HEAD=PLAN['head'];TREE=PLAN['tree'];RUN=PLAN['run'];ROOT=Path(PLAN['externalRoot'])
sha=lambda b:hashlib.sha256(b).hexdigest()
APPROVAL=json.loads((N/'ROOT-ONCE-CONTROLLER-APPROVAL.json').read_text())
assert APPROVAL['planSHA256']==sha(PLAN_PATH.read_bytes()) and APPROVAL['controllerSHA256']==sha(Path(__file__).read_bytes())
assert APPROVAL['head']==HEAD and APPROVAL['run']==RUN and APPROVAL['tree']==TREE
assert all(os.environ.get(k)==str(N) for k in ('TMPDIR','TMP','TEMP')),'external-only controller environment required'
assert str(Path(sys.executable).resolve())==str(Path(PLAN['python']).resolve())
assert not ROOT.exists(),'fresh exact-head bulk output must not exist'
for pin in PLAN['inputPins']+PLAN['helpers']:
 b=Path(pin['path']).read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['sha256']
OUT=N/'actual-once';OUT.mkdir(exist_ok=False)
start=time.monotonic();counter=0;last=None;remaining=1536*1024**2
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def reserve():
 s=os.statvfs(N);free=s.f_bavail*s.f_frsize
 assert free>=3*1024**3+remaining+32*1024**2,('external reserve plus remaining work',free,remaining)
 return free
def put(path,obj):
 raw=(json.dumps(obj,indent=2)+'\n').encode();assert len(raw)<2*1024**2
 reserve()
 with path.open('xb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
def api(path):return json.loads(subprocess.check_output(['gh','api','repos/mekhovov/revealline/'+path]))
def verify_run():
 run=api('actions/runs/'+str(RUN))
 assert run['head_sha']==HEAD and run['head_commit']['id']==HEAD and run['head_branch']==PLAN['branch']
 assert run['event']=='workflow_dispatch' and run['path']=='.github/workflows/company-edition-candidate.yml'
 return run
def wait(job):
 global counter,last
 while True:
  assert time.monotonic()-start<75*60,'cooperative deadline exceeded; no retry'
  reserve();run=verify_run();meta=api('actions/runs/'+str(RUN)+'/jobs?per_page=100')
  assert meta['total_count']<=100;matches=[j for j in meta['jobs'] if j['name']==job];assert len(matches)<=1
  j=matches[0] if matches else None
  state={'job':job,'runStatus':run['status'],'runConclusion':run['conclusion'],'jobStatus':j['status'] if j else None,'jobConclusion':j['conclusion'] if j else None}
  if state!=last:
   counter+=1;put(OUT/('cloud-state-'+str(counter)+'.json'),{'at':now(),**state});last=state
  if j and j['status']=='completed':
   assert j['conclusion']=='success',state
   if job!='candidate' or run['conclusion']=='success':return
  if run['status']=='completed':raise RuntimeError('run completed without required successful job')
  time.sleep(30)
def stage(name,receipt):
 pin=next(r for r in PLAN['helpers'] if r['role']==name);helper=Path(pin['path']);b=helper.read_bytes()
 assert len(b)==pin['bytes'] and sha(b)==pin['sha256']
 put(OUT/(name+'-intent.json'),{'at':now(),'head':HEAD,'tree':TREE,'run':RUN,'helper':pin,'oneInvocation':True,'externalAvailable':reserve()})
 tempRoot=N if name=='optional' else ROOT
 env={**os.environ,'TMPDIR':str(tempRoot),'TMP':str(tempRoot),'TEMP':str(tempRoot),'PYTHONDONTWRITEBYTECODE':'1','GH_NO_UPDATE_NOTIFIER':'1'}
 result=subprocess.run([sys.executable,'-B',str(helper)],capture_output=True,env=env,cwd='/')
 for stream,body in [('stdout',result.stdout),('stderr',result.stderr)]:
  with (OUT/(name+'.'+stream+'.log')).open('xb') as f:f.write(body);f.flush();os.fsync(f.fileno())
 record={'at':now(),'head':HEAD,'tree':TREE,'run':RUN,'helper':pin,'actualExitCode':result.returncode,'stdoutSHA256':sha(result.stdout),'stderrSHA256':sha(result.stderr)}
 if result.returncode==0:
  path=ROOT/receipt;raw=path.read_bytes();assert len(raw)<2*1024**2
  record['receipt']={'path':str(path),'bytes':len(raw),'sha256':sha(raw)}
 put(OUT/(name+'-terminal.json'),record);print(json.dumps({'stage':name,**record}),flush=True)
 assert result.returncode==0,'stage failed; no automatic retry'
assert api('git/commits/'+HEAD)['tree']['sha']==TREE
put(OUT/'controller-intent.json',{'at':now(),'head':HEAD,'tree':TREE,'run':RUN,'planSHA256':sha(PLAN_PATH.read_bytes()),'controllerSHA256':sha(Path(__file__).read_bytes()),'scope':'Exactly own1382 optional originals then Company originals; no family suite, source tests, downloads from older runs, native or publication','cooperativeDeadlineMinutes':75,'limitation':'A cooperative deadline is not proof of termination if a filesystem/subprocess call blocks.'})
try:
 wait('optional-practice');stage('optional','qualification-original-members-and-closure.json')
 remaining=1024**3
 wait('candidate');stage('company','company-original-members-receipt.json')
 remaining=0
 put(OUT/'controller-result.json',{'at':now(),'head':HEAD,'tree':TREE,'run':RUN,'allTwoStagesPassed':True,'scope':'Exact current own source/artifact/software scope only; no native/full-player/public or future-main acceptance'})
except BaseException as exc:
 put(OUT/'controller-negative.json',{'at':now(),'head':HEAD,'tree':TREE,'run':RUN,'type':type(exc).__name__,'message':str(exc),'traceback':traceback.format_exc(),'noAutomaticRetry':True})
 raise
