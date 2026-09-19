from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse,datetime,hashlib,json,subprocess,uuid
root=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('stage',choices=['before','after']);args=parser.parse_args()
request_raw=(root/'execution-request.reviewed.json').read_bytes();request=json.loads(request_raw)
assert request['reviewed'] is True
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
out=root/'live-authorities'/(args.stage+'-'+stamp+'-'+uuid.uuid4().hex[:8]);out.mkdir(parents=True,exist_ok=False)
repo='repos/mekhovov/revealline-archive-30'
paths={'main':repo+'/git/ref/heads/main','run':repo+'/actions/runs/'+str(request['runId']),'deployment':repo+'/deployments/'+str(request['deploymentId']),'statuses':repo+'/deployments/'+str(request['deploymentId'])+'/statuses'}
def collect(item):
 role,endpoint=item;cmd=['python3','-B',str(root/'public_api_get.py'),endpoint]
 started=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with (out/(role+'.json')).open('xb') as stdout,(out/(role+'.stderr')).open('xb') as stderr:
  try:
   p=subprocess.run(cmd,stdout=stdout,stderr=stderr,timeout=45);code=p.returncode;timed=False
  except subprocess.TimeoutExpired:code=None;timed=True
 receipt={'command':cmd,'startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':code,'timedOut':timed}
 (out/(role+'.attempt.json')).write_text(json.dumps(receipt,indent=2)+'\n')
 return role,code,timed
collected=list(ThreadPoolExecutor(max_workers=4).map(collect,paths.items()))
errors=[];docs={}
for role,code,timed in collected:
 if code!=0 or timed:errors.append(role+' API collection failed');continue
 try:docs[role]=json.loads((out/(role+'.json')).read_bytes())
 except Exception as e:errors.append(role+': '+str(e))
if not errors:
 if docs['main']['object']['sha']!=request['archiveCommit']:errors.append('Live main drift')
 run=docs['run']
 if not(run['id']==request['runId'] and run['head_sha']==request['archiveCommit'] and run['status']=='completed' and run['conclusion']=='success'):errors.append('Live run changed')
 dep=docs['deployment']
 if not(dep['id']==request['deploymentId'] and dep['sha']==request['archiveCommit'] and dep['environment']=='github-pages'):errors.append('Live deployment changed')
 status=max(docs['statuses'],key=lambda s:s['id']) if docs['statuses'] else {}
 if not(status.get('id')==request['deploymentStatusId'] and status.get('state')=='success' and status.get('environment_url')=='https://mekhovov.github.io/revealline-archive-30/'):errors.append('Live latest status changed')
pins=[]
for p in sorted(out.iterdir()):
 if p.is_file():
  b=p.read_bytes();pins.append({'path':p.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
result={'status':'FAIL' if errors else 'PASS_LIVE_IDENTITIES_UNCHANGED','stage':args.stage,'directory':str(out),'archiveCommit':request['archiveCommit'],'runId':request['runId'],'deploymentId':request['deploymentId'],'deploymentStatusId':request['deploymentStatusId'],'executionRequestSha256':hashlib.sha256(request_raw).hexdigest(),'errors':errors,'pins':pins,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'attemptsPerEndpoint':1}
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':result['status'],'directory':str(out),'errors':errors}));raise SystemExit(bool(errors))
