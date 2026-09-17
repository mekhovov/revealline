from pathlib import Path
import subprocess,json,hashlib,datetime,time
H=Path(__file__).resolve().parent
NODE='/Users/oleksandr.mekhovov/.local/share/mise/installs/node/20.19.5/bin/node'
PUBLISHER='082ef33adbb97f3b508a6ec4359294e7ae5e2663'
B=H/'tools/inputs'/PUBLISHER/'binding.json';SHA='b91479376a207dad90638793eb916536d8622ed7e7011cafd7210efeee40ec24'
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(B.read_bytes())==SHA and json.loads(B.read_bytes())['reviewed'] is True
assert json.loads((H/'binding-root-review.json').read_bytes())['bindingSha256']==SHA
assert not (H/'tools/runs/complete-1').exists()
args=[NODE,'--max-old-space-size=1024',str(H/'tools/audit-main.mjs'),'--binding',str(B),'--binding-sha',SHA]
def run(label,command):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
 with (H/(label+'.stdout')).open('xb') as out,(H/(label+'.stderr')).open('xb') as err:r=subprocess.run(command,stdout=out,stderr=err)
 record={'command':command,'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'seconds':time.monotonic()-t,'exitCode':r.returncode,'stdoutSha256':sha((H/(label+'.stdout')).read_bytes()),'stderrSha256':sha((H/(label+'.stderr')).read_bytes())}
 with (H/(label+'.exit.json')).open('x') as f:f.write(json.dumps(record,indent=2)+'\n')
 print(json.dumps({'step':label,**record}),flush=True)
 if r.returncode:raise SystemExit(r.returncode)
run('check',args+['--check'])
check=json.loads((H/'check.stdout').read_bytes());assert check['status']=='PREPARED_AUTHORITY_ONLY' and check['files']==2705 and check['expectedBytes']==639168008 and check['networkRequests']==0
run('audit',args+['--out','complete-1'])
report=json.loads((H/'tools/runs/complete-1/report.json').read_bytes());assert report['status']=='PASS' and report['completedFiles']==2705 and report['verifiedBytes']==639168008
run('row-review',['python3','-B',str(H/'review-public.py'),PUBLISHER,'complete-1'])
