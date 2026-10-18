from pathlib import Path
import os,sys,hashlib,json,subprocess,datetime
D=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def put(path,body):
 with path.open('xb') as f:f.write(body);f.flush();os.fsync(f.fileno())
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
assert len(sys.argv)==3 and all(len(x)==64 and all(c in '0123456789abcdef' for c in x) for x in sys.argv[1:])
planBody=(D/'company-correction-plan.json').read_bytes();assert sha(planBody)==sys.argv[1]
plan=json.loads(planBody);approval=D/'ROOT-ONCE-COMPANY-CORRECTION-APPROVAL.json'
assert not approval.is_symlink() and sha(approval.read_bytes())==sys.argv[2]
for name in ['helper','launcher']:
 pin=plan[name];path=Path(pin['path'])
 assert path.parent==D and not path.is_symlink()
 b=path.read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['sha256']
s=os.statvfs(D);assert s.f_bavail*s.f_frsize>=plan['externalReserveBytes']+plan['remainingAllowanceBytes']
A=D/'actual-once';A.mkdir()
env={**os.environ,'TMPDIR':str(D),'TMP':str(D),'TEMP':str(D),'PYTHONDONTWRITEBYTECODE':'1'}
command=[sys.executable,'-B',plan['helper']['path']]
put(A/'ACTUAL-INTENT.json',(json.dumps({'UTC':now(),'planSHA256':sys.argv[1],
 'approvalSHA256':sys.argv[2],'head':plan['head'],'artifactId':12119292608,
 'command':command,'launcherPid':os.getpid(),'noAutomaticRetry':True},indent=2)+'\n').encode())
child=None;code=None
try:
 with (A/'ACTUAL.stdout.log').open('xb') as out,(A/'ACTUAL.stderr.log').open('xb') as err:
  child=subprocess.Popen(command,stdout=out,stderr=err,cwd=D,env=env)
  code=child.wait()
  out.flush();os.fsync(out.fileno());err.flush();os.fsync(err.fileno())
 terminal={'UTC':now(),'actualExitCode':code,'childPid':child.pid,'noAutomaticRetry':True}
 for name in ['ACTUAL.stdout.log','ACTUAL.stderr.log']:
  b=(A/name).read_bytes();terminal[name]={'bytes':len(b),'sha256':sha(b)}
 receipt=A/'company-corrected-original-members-receipt.json'
 terminal['receiptExists']=receipt.exists()
 if receipt.exists():
  b=receipt.read_bytes();terminal['receipt']={'path':str(receipt),'bytes':len(b),'sha256':sha(b)}
 put(A/'ACTUAL-TERMINAL.json',(json.dumps(terminal,indent=2)+'\n').encode())
 print(json.dumps(terminal))
 assert code==0 and receipt.exists(),'Corrected validation failed; original retained; no retry'
except BaseException as error:
 put(A/'WRAPPER-NEGATIVE.json',(json.dumps({'UTC':now(),'error':repr(error),
 'childPid':None if child is None else child.pid,'actualChildExitCode':code,'noAutomaticRetry':True},indent=2)+'\n').encode())
 raise
