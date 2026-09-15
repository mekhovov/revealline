import sys,subprocess,json,datetime
from pathlib import Path
P=Path(__file__).resolve().parent
name,*action=sys.argv[1:]
assert name.replace('-','').isalnum() and action and not (P/(name+'.json')).exists()
wrapper=P.parents[2]/'control-family.py'
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
r=subprocess.run(['python3',str(wrapper),'--family','interface',*action],capture_output=True,text=True,timeout=35)
data={'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'session':'p01-public-v0571-interface','action':action,'exitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr}
assert len(json.dumps(data))<250000
with (P/(name+'.json')).open('x') as f:json.dump(data,f,indent=2);f.write('\n')
print(r.stdout);print(r.stderr,file=sys.stderr);raise SystemExit(r.returncode)
