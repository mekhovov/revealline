#!/usr/bin/env python3
"""Read-only bounded exact-source workflow observer. Never reruns or publishes."""
from pathlib import Path
import subprocess,json,datetime,time,hashlib,re
P=Path(__file__).resolve().parent
binding=json.loads((P/'run-binding.json').read_text())
SOURCE=binding['sourceRevision']
TREE=binding['sourceTree']
RUNS=binding['runs']
EXPECTED=binding['expectedIdentity']

def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def save(path,body):
 with path.open('xb') as out:out.write(body)
def api(path):return subprocess.check_output(['gh','api','repos/mekhovov/revealline/'+path],stderr=subprocess.PIPE,timeout=60)
def encode(obj):return (json.dumps(obj,indent=2)+'\n').encode()
def emit(obj):print(json.dumps(obj),flush=True)
for name in RUNS:(P/name).mkdir(exist_ok=True)
previous={};logmap={};last={};deadline=time.monotonic()+70*60
for iteration in range(75):
 started=time.monotonic();stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 allcomplete=True
 for label,run_id in RUNS.items():
  d=P/label
  try:
   raw=api(f'actions/runs/{run_id}');run=json.loads(raw)
   assert run['head_sha']==SOURCE and run['run_attempt']==1
   assert run['event']==binding['events'][label] and run['path'].split('@')[0]==binding['workflowPaths'][label]
   save(d/f'run-{stamp}.json',raw)
   rawjobs=api(f'actions/runs/{run_id}/jobs?per_page=100');jobs=json.loads(rawjobs)
   assert jobs['total_count']==len(jobs['jobs'])
   save(d/f'jobs-{stamp}.json',rawjobs)
   for job in jobs['jobs']:
    assert job['run_id']==run_id
    key=(job['status'],job['conclusion'],tuple((s['name'],s['status'],s['conclusion']) for s in job['steps']))
    if previous.get(job['id'])!=key:
     failed=[s['name'] for s in job['steps'] if s['conclusion']=='failure']
     emit({'at':now(),'run':label,'jobId':job['id'],'job':job['name'],'status':job['status'],'conclusion':job['conclusion'],'failedSteps':failed})
     previous[job['id']]=key
    if job['status']=='completed' and job['conclusion']!='skipped' and job['id'] not in logmap:
     path=d/f'job-{job["id"]}.log';log=api(f'actions/jobs/{job["id"]}/logs');save(path,log)
     logmap[job['id']]={'path':str(path.relative_to(P)),'bytes':len(log),'sha256':hashlib.sha256(log).hexdigest(),'name':job['name'],'run':label,'jobId':job['id']}
     failures=[line for line in log.decode('utf8').splitlines() if re.search(r'not ok|failureType:|Actual host must|##\[error\]',line)]
     if failures:emit({'at':now(),'run':label,'jobId':job['id'],'failureLines':failures[:24]})
   if previous.get(run_id)!=(run['status'],run['conclusion']):
    emit({'at':now(),'run':label,'runId':run_id,'status':run['status'],'conclusion':run['conclusion']});previous[run_id]=(run['status'],run['conclusion'])
   last[label]={'run':run,'jobs':jobs}
   if run['status']!='completed':allcomplete=False
  except Exception as error:
   allcomplete=False
   save(d/f'observer-error-{stamp}.json',encode({'at':now(),'exceptionType':type(error).__name__,'message':str(error)[:1000],'scope':'Read-only observation failed; no workflow rerun.'}))
   emit({'at':now(),'run':label,'observerError':type(error).__name__})
 if allcomplete:
  for label in RUNS:
   save(P/label/'run-final.json',encode(last[label]['run']))
   save(P/label/'jobs-final.json',encode(last[label]['jobs']))
   save(P/label/'artifacts-final.json',api(f'actions/runs/{RUNS[label]}/artifacts?per_page=100'))
  save(P/'pr-final.json',api('pulls/'+str(binding['sourcePR'])))
  identities=[];totals={}
  for jobid,row in sorted(logmap.items()):
   text=(P/row['path']).read_text();row['counts']={k:int(v) for k,v in re.findall(r'# (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)',text)}
   ds=re.findall(r'# duration_ms ([\d.]+)',text)
   if ds:row['tapDurationMs']=float(ds[-1])
   if re.fullmatch(r'test \([1-4]\)',row['name']):
    target=totals.setdefault(row['run'],{})
    for key,val in row['counts'].items():target[key]=target.get(key,0)+val
   for line_no,line in enumerate(text.splitlines(),1):
    if '{"format":"revealline-source-identity.v1"' in line:
     identity=json.loads(line[line.index('{'):]);valid=identity['sourceRevision']==SOURCE and identity['sourceTree']==TREE and identity['allTrackedSourceContentsAndModesMatch'] is True and all(identity[k]==v for k,v in EXPECTED.items())
     identities.append({'path':row['path'],'line':line_no,'matchesExpected':valid,'identity':identity})
  save(P/'log-receipts.json',encode(list(logmap.values())))
  save(P/'source-identities.json',encode(identities))
  summary={'format':'revealline-hosted-workflow-observation.v1','observedAt':now(),'sourceRevision':SOURCE,'sourceTree':TREE,'expectedIdentity':EXPECTED,'runs':{k:{'id':v['run']['id'],'event':v['run']['event'],'conclusion':v['run']['conclusion']} for k,v in last.items()},'sourceTestTotals':totals,'identityObservations':len(identities),'allObservedIdentitiesMatch':bool(identities) and all(x['matchesExpected'] for x in identities),'scope':'Workflow/API/log observation; not a frozen-artifact verification or successful source-qualification receipt.'}
  save(P/'completion-summary.json',encode(summary));emit(summary);break
 if time.monotonic()>deadline:emit({'status':'OBSERVER_TIME_BOUND_REACHED','last':{k:v['run']['status'] for k,v in last.items()}});break
 time.sleep(max(1,60-(time.monotonic()-started)))
