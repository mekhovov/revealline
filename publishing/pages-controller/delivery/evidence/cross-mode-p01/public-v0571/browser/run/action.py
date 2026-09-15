#!/usr/bin/env python3
"""Log explicit CLI actions after verifying the exact live owned Chrome endpoint."""
import argparse,json,os,subprocess,sys,urllib.request,datetime
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--attempt',default='online-1');p.add_argument('--name',required=True);p.add_argument('--script',type=Path);p.add_argument('action',nargs=argparse.REMAINDER);a=p.parse_args()
f=Path(__file__).resolve().parent
out=f/(a.name+'.json')
if out.exists():p.error('Action receipt already exists')
launch=json.loads((f/(a.attempt+'-launch.json')).read_text());os.kill(launch['pid'],0)
v=json.load(urllib.request.urlopen('http://127.0.0.1:'+str(launch['port'])+'/json/version',timeout=3))
if v['webSocketDebuggerUrl']!=launch['endpoint']:p.error('Owned endpoint changed')
args=a.action or (['eval','--stdin'] if a.script else [])
if not args:p.error('Explicit action required')
t=datetime.datetime.now(datetime.timezone.utc).isoformat()
r=subprocess.run([sys.executable,str(f.parent/'control.py'),*args],input=a.script.read_text() if a.script else None,text=True,capture_output=True)
receipt={'time':t,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'attempt':a.attempt,'pid':launch['pid'],'endpoint':launch['endpoint'],'action':args,'script':str(a.script) if a.script else None,'exitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr}
out.write_text(json.dumps(receipt,indent=2)+'\n');print(r.stdout);print(r.stderr,file=sys.stderr);raise SystemExit(r.returncode)
