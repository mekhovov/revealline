#!/usr/bin/env python3
"""Review completed checkout logs only; never infers workflow code from PR head."""
from pathlib import Path
import json,re,hashlib
P=Path(__file__).resolve().parent
binding=json.loads((P/'run-binding.json').read_text())
SOURCE=binding['sourceRevision']
TREE=binding['sourceTree']
automation=json.loads((P/'pr-automation/receipt.json').read_text())
auto=automation['observedAutomationRef']; rows=[]
for label in ['manual','pr-source','publisher-preview']:
 jobs=json.loads((P/label/'jobs-final.json').read_text())['jobs']
 for job in jobs:
  if job['conclusion']=='skipped': continue
  path=P/label/f'job-{job["id"]}.log'; raw=path.read_bytes()
  lines=[re.sub(r'^\d{4}-\d\d-\d\dT[\d:.]+Z ','',s) for s in raw.decode().splitlines()]
  checkout=[]
  for i,line in enumerate(lines[:-1]):
   if line=='[command]/usr/bin/git log -1 --format=%H':
    assert re.fullmatch('[0-9a-f]{40}',lines[i+1]), (path,i,lines[i+1])
    checkout.append({'sha':lines[i+1],'line':i+2})
  expected=[SOURCE] if label=='manual' else [SOURCE,auto] if label=='pr-source' else [auto]
  assert [x['sha'] for x in checkout]==expected,(label,job['name'],checkout,expected)
  treeLines=[i+1 for i,line in enumerate(lines) if line==TREE]
  if label=='manual' and job['name']!='freeze': assert treeLines,job['name']
  rows.append({'run':label,'jobId':job['id'],'jobName':job['name'],'conclusion':job['conclusion'],'originalLog':str(path.relative_to(P)),'logSha256':hashlib.sha256(raw).hexdigest(),'checkoutCommits':checkout,'explicitSourceTreeLines':treeLines,'actualSourceCheckoutMatches':label!='publisher-preview','publisherPreviewScope':'Synthetic controller checkout, not product source qualification' if label=='publisher-preview' else None})
record={'format':'revealline-hosted-checkout-review.v1','sourceRevision':SOURCE,'sourceTree':TREE,'automationRevision':auto,'automationTree':json.loads((P/'pr-automation/commit.json').read_text())['commit']['tree']['sha'],'allCheckoutLogsMatchExpected':True,'jobs':rows,'scope':'Actual emitted checkout commits and raw source-tree lines; raw source content/mode identities remain in source-identities.json.'}
with (P/'checkout-review.json').open('x') as f:json.dump(record,f,indent=2);f.write('\n')
print(json.dumps({'jobs':len(rows),'checkoutReviewSha256':hashlib.sha256((P/'checkout-review.json').read_bytes()).hexdigest()}))
