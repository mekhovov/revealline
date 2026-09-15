from pathlib import Path
import subprocess,json,sys,re,hashlib
R=Path(__file__).resolve().parent;P=R.parent;label=sys.argv[1]
r=subprocess.run(['python3',str(P/'control.py'),'eval',(P/'measure.js').read_text()],capture_output=True,text=True);assert r.returncode==0,(r.stdout,r.stderr)
value=json.loads(r.stdout);(R/(label+'.json')).write_text(json.dumps(value,indent=2)+'\n')
s=subprocess.run(['python3',str(P/'control.py'),'screenshot'],capture_output=True,text=True);assert s.returncode==0,(s.stdout,s.stderr)
match=re.search(r'(/Users/[^\n]+\.png)',s.stdout);assert match,s.stdout;source=Path(match[1]);assert '/.agent-browser/tmp/screenshots/' in str(source)
b=source.read_bytes();(R/(label+'.png')).write_bytes(b)
with (R/'screenshot-origins.jsonl').open('a') as f:f.write(json.dumps({'label':label,'original':str(source),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})+'\n')
ids=['library-operation-rail','library-operation-message','library-operation-cancel','save-status','save-status-label','save-status-count','export-backup','library-close','backup-set-status','cancel-backup-set','download-backup-game']
print(json.dumps({'label':label,'at':value['at'],'viewport':value['viewport'],'active':value['active'],'elements':[{k:e.get(k) for k in ['id','text','rect','fullyInViewport','fullyInsideAncestorClip','hidden','statusId','state','scrollTop','scrollHeight','clientHeight']} for e in value['elements'] if e['id'] in ids]},indent=2))
