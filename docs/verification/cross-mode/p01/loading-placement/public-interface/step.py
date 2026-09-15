import sys,subprocess,json,datetime
from pathlib import Path
P=Path(__file__).resolve().parent
name,*action=sys.argv[1:]
assert name.replace('-','').isalnum() and action and not (P/(name+'.json')).exists()
wrapper=P.parents[2]/'control-family.py'
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
guard=subprocess.run(['python3',str(wrapper),'--family','interface','eval','({url:location.href,visibilityState:document.visibilityState,hasFocus:document.hasFocus()})'],capture_output=True,text=True,timeout=10)
visible=json.loads(guard.stdout) if guard.returncode==0 else {}
if visible.get('visibilityState')!='visible':
 with (P/(name+'.json')).open('x') as f:json.dump({'refused':'Owned page is not visible','action':action,'guard':visible,'stderr':guard.stderr},f,indent=2)
 raise SystemExit('No native action: page is not visible')
r=subprocess.run(['python3',str(wrapper),'--family','interface',*action],capture_output=True,text=True,timeout=35)
data={'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'session':'p01-public-v0571-interface','visibilityBefore':visible,'action':action,'exitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr}
assert len(json.dumps(data))<250000
with (P/(name+'.json')).open('x') as f:json.dump(data,f,indent=2);f.write('\n')
print(r.stdout);print(r.stderr,file=sys.stderr);raise SystemExit(r.returncode)
