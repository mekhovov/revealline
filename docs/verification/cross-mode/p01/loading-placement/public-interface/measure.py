from pathlib import Path
import sys,subprocess,datetime,json
P=Path(__file__).resolve().parent;name=sys.argv[1];assert name.replace('-','').isalnum() and not(P/(name+'.json')).exists()
r=subprocess.run(['python3',str(P.parents[2]/'control-family.py'),'--family','interface','eval','--stdin'],input=(P/'measure-interface.js').read_text(),capture_output=True,text=True,timeout=35)
d={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr}
with (P/(name+'.json')).open('x') as f:json.dump(d,f,indent=2);f.write('\n')
if r.returncode:print(r.stderr);raise SystemExit(r.returncode)
x=json.loads(r.stdout);print(json.dumps({k:x[k] for k in ['url','active','viewport','body','dialogs']}));print('Evidence',name+'.json')
