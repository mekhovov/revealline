#!/usr/bin/env python3
import pathlib,subprocess,sys,os,signal
root=pathlib.Path(__file__).resolve().parent
pidfile=root/'server.pid'
command=[sys.executable,'-m','http.server','9214','--bind','127.0.0.1','--directory',str(root/'web')]
def current():
 if not pidfile.exists():return None
 pid=int(pidfile.read_text());p=subprocess.run(['ps','-p',str(pid),'-o','command='],capture_output=True,text=True)
 if p.returncode:return None
 if 'http.server 9214 --bind 127.0.0.1 --directory '+str(root/'web') not in p.stdout:raise RuntimeError('PID identity mismatch; refusing to touch it')
 return pid
op=sys.argv[1] if len(sys.argv)>1 else 'status';pid=current()
if op=='start':
 if not pid:
  with open(root/'server.log','ab') as log:p=subprocess.Popen(command,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
  pid=p.pid;pidfile.write_text(str(pid)+'\n')
 print('running',pid)
elif op=='stop':
 if pid:os.kill(pid,signal.SIGTERM)
 print('stopped',pid)
elif op=='status':print('running' if pid else 'stopped',pid)
else:raise ValueError('Use start, stop or status')
