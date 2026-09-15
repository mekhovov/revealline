#!/usr/bin/env python3
"""Bind completed original production receipt to actual GitHub deployment authority."""
from pathlib import Path
import json,subprocess,hashlib,datetime
P=Path(__file__).parent/'production';EXPECTED=json.loads((P/'expected-controller.json').read_bytes());SHA=EXPECTED['commit'];TREE='15963dede1cdcd977486d68fdc69714db9c02892';RUN=EXPECTED['runId'];assert len(SHA)==40 and all(c in '0123456789abcdef' for c in SHA) and isinstance(RUN,int) and RUN>0

def original(name,endpoint):
 b=subprocess.check_output(['gh','api','repos/mekhovov/revealline/'+endpoint],stderr=subprocess.PIPE,timeout=60)
 with (P/name).open('xb') as f:f.write(b)
 return json.loads(b)
r=json.loads((P/'run.json').read_bytes());j=json.loads((P/'jobs.json').read_bytes())['jobs'];rec=json.loads((P/'artifact-receipt.json').read_bytes());assert r['id']==RUN and r['head_sha']==SHA and r['conclusion']=='success' and r['event']=='push' and r['run_attempt']==1
assert len(j)==2 and {x['name'] for x in j}=={'assemble','deploy'} and all(x['conclusion']=='success' for x in j)
assert rec['controllerCommit']==SHA and rec['controllerTree']==TREE and rec['publishable'] and rec['currentVersion']=='v0.57.1' and rec['gameSourceRevision']=='4c85277ac7393eeeabab035387d4d4ae8734aba1' and rec['admittedArchives']==14
for job in j:
 log=(P/f"job-{job['id']}.log").read_text();assert SHA in log and '##[error]' not in log
 if job['name']=='assemble':assert '# tests 36' in log and '# pass 36' in log and '# fail 0' in log and 'Ran 4 tests' in log
c=json.loads((P/'controller-commit.json').read_bytes());assert c['sha']==SHA and c['commit']['tree']['sha']==TREE
found=original('deployments.json',f'deployments?sha={SHA}&environment=github-pages&per_page=100');assert len(found)==1
d=original('deployment.json',f"deployments/{found[0]['id']}");ss=original('deployment-statuses.json',f"deployments/{d['id']}/statuses?per_page=100");assert d['sha']==SHA and d['environment']=='github-pages' and ss and ss[0]['state']=='success' and ss[0]['environment_url']=='https://mekhovov.github.io/revealline/'
dj=next(x for x in j if x['name']=='deploy');assert ss[0]['log_url']==f"https://github.com/mekhovov/revealline/actions/runs/{RUN}/job/{dj['id']}" and ss[0]['deployment_url']==d['url']
ref=original('main-ref-after.json','git/ref/heads/main');assert ref['object']['sha']==SHA
original('checks.json',f'commits/{SHA}/check-runs?per_page=100')
keys=['run.json','artifact-receipt.json','deployment.json','deployment-statuses.json'];pins=[]
for n in keys:
 b=(P/n).read_bytes();pins.append({'path':n,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
review={'status':'PASS','observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runId':RUN,'controllerCommit':SHA,'controllerTree':TREE,'deploymentId':d['id'],'deploymentStatus':ss[0]['state'],'environmentURL':ss[0]['environment_url'],'currentVersion':rec['currentVersion'],'gameSourceRevision':rec['gameSourceRevision'],'qualifiedSourceTree':rec['qualifiedSourceTree'],'publishable':rec['publishable'],'files':len(rec['files']),'bytes':rec['totalBytes'],'historicalBridges':rec['historicalBridges'],'admittedArchives':rec['admittedArchives'],'nodeTestsPassed':36,'pythonTestsPassed':4,'authorityPins':pins,'scope':'Completed exact main publication and original hosted receipt authority only. All-body HTTP audit, native-browser qualification, offline checks, and phase acceptance remain separate.'}
with (P/'review.json').open('x') as f:json.dump(review,f,indent=2);f.write('\n')
files=[]
for file in sorted(P.iterdir()):
 if file.is_file():
  b=file.read_bytes();files.append({'path':file.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
with (P/'manifest.json').open('x') as f:json.dump({'files':files},f,indent=2);f.write('\n')
print(json.dumps(review,indent=2))
