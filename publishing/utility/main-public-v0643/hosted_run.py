"""Read-only hosted adapter. Authority and HTTP policies remain in the reviewed donor helpers."""
from pathlib import Path,PurePosixPath
import argparse,datetime,hashlib,json,os,re,shutil,subprocess,sys,time
HERE=Path(__file__).resolve().parent
CAP=32*1024**2;RESERVE=512*1024**2
sha=lambda b:hashlib.sha256(b).hexdigest()
def strict(raw):
 def pairs(items):
  v={}
  for k,x in items:
   if k in v:raise ValueError('Duplicate key')
   v[k]=x
  return v
 return json.loads(raw,object_pairs_hook=pairs)
def safe(value):
 p=PurePosixPath(value)
 if not isinstance(value,str) or value!=p.as_posix() or p.is_absolute() or any(x in ['.','..',''] for x in p.parts) or '\\' in value:raise ValueError('Unsafe payload path')
 return value
def read(root,name,limit=16000000):
 p=root/safe(name)
 if any(x.is_symlink() for x in [p,*p.parents]) or not p.is_file() or p.stat().st_size>limit:raise ValueError('Ordinary bounded file required')
 return p.read_bytes()
def validate_dispatch(raw):
 if len(raw.encode())>64000:raise ValueError('Dispatch binding too large')
 b=strict(raw)
 if b.get('format')!='revealline-final-main-public-binding.v1' or b.get('reviewed') is not True or b.get('currentVersion')!='v0.64.3' or b.get('gameSourceRevision')!='7a9985ec00168b99a86c1d5db0457343ca18ffae' or b.get('qualifiedSourceTree')!='4a5960488f4c19fc8fbd6e784c612b8bdb81596e' or not re.fullmatch('[a-f0-9]{40}',b.get('controllerCommit') or ''):raise ValueError('Exact reviewed actual v643 publisher binding required')
 return b
def guard(root):
 if sum(p.stat().st_size for p in root.rglob('*') if p.is_file())>CAP:raise ValueError('Evidence exceeds32MiB')
 if shutil.disk_usage(root).free<RESERVE:raise ValueError('Reserve below512MiB')
def main():
 p=argparse.ArgumentParser();p.add_argument('--out',required=True,type=Path);args=p.parse_args();raw=os.environ['MAIN_BINDING'];b=validate_dispatch(raw);out=args.out.absolute()
 if out.exists() or any(x.is_symlink() for x in out.parents):raise ValueError('New ordinary output required')
 utility=os.environ.get('UTILITY_WORKFLOW_SHA','')
 if not re.fullmatch('[a-f0-9]{40}',utility):raise ValueError('Actual workflow commit required')
 payload=HERE/'payload';pinraw=read(HERE,'payload-pins.json',2000000);pins=strict(pinraw)
 if not isinstance(pins,list) or not pins or len(pins)>100 or len({x['path'] for x in pins})!=len(pins):raise ValueError('Bounded unique payload required')
 for x in pins:
  body=read(payload,x['path']);assert len(body)==x['bytes'] and sha(body)==x['sha256']
 actual={p.relative_to(payload).as_posix() for p in payload.rglob('*') if p.is_file()};assert actual=={x['path'] for x in pins}
 binding_rel='tools/inputs/'+b['controllerCommit']+'/binding.json';bindingraw=read(payload,binding_rel,64000);assert strict(bindingraw)==b
 if sum(x['bytes'] for x in pins)>8*1024**2 or shutil.disk_usage(HERE).free<RESERVE+CAP:raise ValueError('Payload or free reserve exceeded')
 shutil.copytree(payload,out);guard(out)
 def put(n,j):
  with (out/n).open('x') as f:f.write(json.dumps(j,indent=2)+'\n')
 (out/'utility-runner.py').write_bytes(Path(__file__).read_bytes());(out/'payload-pins.original.json').write_bytes(pinraw);(out/'dispatch-binding.original.json').write_text(raw)
 put('hosted-identity.json',{'utilityWorkflowSha':utility,'hostedRunId':os.environ.get('GITHUB_RUN_ID'),'hostedRunAttempt':os.environ.get('GITHUB_RUN_ATTEMPT'),'controllerCommit':b['controllerCommit'],'gameSourceRevision':b['gameSourceRevision'],'mainBindingSha256':sha(bindingraw),'payloadPinsSha256':sha(pinraw),'outputPath':str(out)})
 binding=str(out/binding_rel);node='node';audit=[node,str(out/'tools/audit-main.mjs'),'--binding',binding,'--binding-sha',sha(bindingraw)];steps=[]
 # The outer deadline bounds utility execution, not transport retry policy. Incomplete output never passes.
 for name,cmd,limit in [('binding',audit+['--check'],60),('audit',audit+['--out','main-full-hosted-r1'],2100),('reconcile',[sys.executable,'-B',str(out/'review-public.py'),b['controllerCommit'],'main-full-hosted-r1'],60)]:
  start=datetime.datetime.now(datetime.timezone.utc).isoformat();deadline=time.monotonic()+limit;failure=None;code=None
  with (out/(name+'.stdout')).open('xb') as stdout,os.fdopen(os.open(out/(name+'.stderr'),os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600),'wb') as stderr:
   child=subprocess.Popen(cmd,cwd=out,stdout=stdout,stderr=stderr,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','PYTHONOPTIMIZE':'0'})
   try:
    while child.poll() is None:
     guard(out)
     if time.monotonic()>deadline:raise TimeoutError('Outer stage deadline')
     time.sleep(.25)
    code=child.wait();guard(out)
   except Exception as e:
    failure=type(e).__name__;child.kill();child.wait()
  steps.append({'name':name,'command':cmd,'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':code,'failureType':failure,'outerTimeoutSeconds':limit})
  if code!=0 or failure:break
 passed=len(steps)==3 and all(x['exitCode']==0 and x['failureType'] is None for x in steps)
 if passed:
  report=strict(read(out,'tools/runs/main-full-hosted-r1/report.json'));mapping=[]
  for pin in report['runnerPins']:
   n=Path(pin['file']).name;relative='tools/'+n
   if n not in ['audit-main.mjs','http-engine.mjs','catalog-cohorts.mjs','retained-catalog.json'] or pin['file']!=str(out/relative):raise ValueError('Unexpected original runner path')
   body=read(out,relative);assert sha(body)==pin['sha256'];mapping.append({'originalFile':pin['file'],'sha256':pin['sha256'],'evidencePath':relative,'bytes':len(body)})
  if len(mapping)!=4 or len({x['evidencePath'] for x in mapping})!=4:raise ValueError('Incomplete helper mapping')
  put('original-runner-path-map.json',{'originalReportPreserved':True,'entries':mapping})
 put('hosted-result.json',{'status':'PASS_HTTP_ROWS_ONLY' if passed else 'FAIL','steps':steps,'authorityPolicyUnchanged':True,'transportPolicy':{'streams':8,'requestTimeoutSeconds':300,'maximumTransientAttempts':3},'outputBudgetBytes':CAP,'budgetMonitorIntervalSeconds':.25,'outerAuditTimeoutSeconds':2100,'nativeAcceptance':False,'liveAfterAuthorityRefresh':False,'publicAdmission':False})
 guard(out);print(json.dumps({'status':'PASS_HTTP_ROWS_ONLY' if passed else 'FAIL','publicAdmission':False}));return 0 if passed else 1
if __name__=='__main__':raise SystemExit(main())
