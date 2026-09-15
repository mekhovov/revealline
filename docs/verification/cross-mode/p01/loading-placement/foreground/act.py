from pathlib import Path
import subprocess,sys,json,datetime
P=Path(__file__).resolve().parent
r=subprocess.run(['python3',str(P/'control.py'),*sys.argv[1:]],capture_output=True,text=True)
with (P/'run/actions.jsonl').open('a') as f:f.write(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'args':sys.argv[1:],'exitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr})+'\n')
print(r.stdout,end='')
if r.returncode:print(r.stderr,file=sys.stderr)
raise SystemExit(r.returncode)
