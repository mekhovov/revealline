#!/usr/bin/env python3
"""Observe the exact main v0.57 publication; no writes to GitHub."""
from pathlib import Path
import subprocess,json,datetime,time,hashlib,re
P=Path(__file__).resolve().parent
RUN=34965929587
SHA='74f289510617603c28768bb3f6bfd8e9f7a72cdd'
def api(path):return subprocess.check_output(['gh','api','repos/mekhovov/revealline/'+path],stderr=subprocess.PIPE,timeout=60)
def save(name,b):
 with (P/name).open('xb') as f:f.write(b)
def emit(value):print(json.dumps(value),flush=True)
previous={};logs=set()
for attempt in range(35):
 started=time.monotonic();stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 try:
  rr=api(f'actions/runs/{RUN}');run=json.loads(rr);assert run['head_sha']==SHA and run['run_attempt']==1 and run['event']=='push';save('run-'+stamp+'.json',rr)
  jj=api(f'actions/runs/{RUN}/jobs?per_page=100');jobs=json.loads(jj);assert jobs['total_count']==len(jobs['jobs']);save('jobs-'+stamp+'.json',jj)
  for job in jobs['jobs']:
   assert job['run_id']==RUN
   state=(job['status'],job['conclusion'],tuple((s['name'],s['status'],s['conclusion']) for s in job['steps']))
   if previous.get(job['id'])!=state:
    emit({'observedAt':stamp,'jobId':job['id'],'name':job['name'],'status':job['status'],'conclusion':job['conclusion'],'activeStep':next((s['name'] for s in job['steps'] if s['status']=='in_progress'),None),'failedSteps':[s['name'] for s in job['steps'] if s['conclusion']=='failure']});previous[job['id']]=state
   if job['status']=='completed' and job['conclusion']!='skipped' and job['id'] not in logs:
    b=api(f'actions/jobs/{job["id"]}/logs');assert len(b)<16_000_000;save(f'job-{job["id"]}.log',b);logs.add(job['id'])
    failed=[line for line in b.decode().splitlines() if '##[error]' in line or re.search(r'^\S+ not ok ',line)]
    if failed:emit({'jobId':job['id'],'failureLines':failed[:25]})
  if run['status']=='completed':
   assert all(j['status']=='completed' for j in jobs['jobs'])
   save('run.json',rr);save('jobs.json',jj);save('artifacts.json',api(f'actions/runs/{RUN}/artifacts?per_page=100'))
   emit({'completed':True,'runId':RUN,'controllerRevision':SHA,'conclusion':run['conclusion'],'scope':'Main v0.57 production publication. Public body/browser qualification remains separate.'});break
 except Exception as e:
  save('observation-error-'+stamp+'.json',(json.dumps({'type':type(e).__name__,'scope':'Read-only observation; no workflow rerun'})+'\n').encode());emit({'observationError':type(e).__name__,'at':stamp})
 time.sleep(max(1,60-(time.monotonic()-started)))
else:emit({'observerTimeBoundReached':True})
