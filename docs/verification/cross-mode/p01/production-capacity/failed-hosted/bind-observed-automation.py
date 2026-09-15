#!/usr/bin/env python3
"""Bind only actual completed PR preflight checkout; GET original APIs, no mutation."""
from pathlib import Path
import base64,hashlib,json,re,subprocess
P=Path(__file__).resolve().parent
binding=json.loads((P/'run-binding.json').read_text())
SOURCE=binding['sourceRevision']
TREE=binding['sourceTree']
EXPECTED=binding['expectedIdentity']
def save(path,data):
 with path.open('xb') as out:out.write(data)
def encode(data):return (json.dumps(data,indent=2)+'\n').encode()
def api(path):return subprocess.check_output(['gh','api','repos/mekhovov/revealline/'+path],stderr=subprocess.PIPE,timeout=60)
snap=sorted((P/'pr-source').glob('jobs-20*.json'))[-1]
jobs=json.loads(snap.read_bytes());job=next(j for j in jobs['jobs'] if j['name']=='preflight')
assert job['status']=='completed' and job['conclusion']=='success' and job['run_id']==binding['runs']['pr-source']
logpath=P/'pr-source'/f'job-{job["id"]}.log';raw=logpath.read_bytes()
lines=[re.sub(r'^\d{4}-\d\d-\d\dT[\d:.]+Z ','',line) for line in raw.decode().splitlines()]
checkouts=[]
for i,line in enumerate(lines[:-1]):
 if line=='[command]/usr/bin/git log -1 --format=%H':
  assert re.fullmatch('[0-9a-f]{40}',lines[i+1]);checkouts.append((i+2,lines[i+1]))
assert len(checkouts)==2 and checkouts[0][1]==SOURCE
auto=checkouts[1][1];assert auto!=SOURCE
refs=[i+1 for i,line in enumerate(lines) if line=='  ref: '+auto];assert len(refs)==1
identities=[]
for line in lines:
 if '{"format":"revealline-source-identity.v1"' in line:
  record=json.loads(line[line.index('{'):]);assert record['sourceRevision']==SOURCE and record['sourceTree']==TREE and record['allTrackedSourceContentsAndModesMatch'] is True and all(record[k]==v for k,v in EXPECTED.items());identities.append(record)
assert len(identities)==2
out=P/'pr-automation';out.mkdir()
rawcommit=api('commits/'+auto);save(out/'commit.json',rawcommit);commit=json.loads(rawcommit);assert commit['sha']==auto
rows=[]
for path in ['.github/workflows/deploy-pages.yml','.github/workflows/publish-frozen-pages.yml','scripts/run-test-shard.mjs','scripts/check-source-identity.mjs']:
 name=path.replace('/','__');rawapi=api('contents/'+path+'?ref='+auto);save(out/(name+'.api.json'),rawapi);record=json.loads(rawapi)
 assert record['path']==path and record['encoding']=='base64' and record['html_url']==f'https://github.com/mekhovov/revealline/blob/{auto}/{path}'
 data=base64.b64decode(record['content']);save(out/name,data)
 assert len(data)==record['size'] and hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==record['sha']
 assert data==(P/'source-executed'/name).read_bytes()
 rows.append({'path':path,'gitBlob':record['sha'],'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'byteEqualToPinnedProductSource':True})
receipt={'observedAutomationRef':auto,'observedAutomationTree':commit['commit']['tree']['sha'],'observedInLog':'../'+str(logpath.relative_to(P)),'observedAtLine':refs[0],'actualCheckoutCommitLine':checkouts[1][0],'workflowShaBasis':'Workflow selects github.workflow_sha; original completed checkout log records requested ref and actual git log -1 result.','sourceUnderTest':SOURCE,'sourceTree':TREE,'preflightIdentityObservations':identities,'files':rows}
save(out/'receipt.json',encode(receipt))
print(json.dumps({'automationRevision':auto,'automationTree':receipt['observedAutomationTree'],'receiptSha256':hashlib.sha256((out/'receipt.json').read_bytes()).hexdigest(),'files':len(rows)}))
