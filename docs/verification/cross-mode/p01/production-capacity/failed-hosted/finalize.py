#!/usr/bin/env python3
"""Finalize already completed read-only observations; no network or test execution."""
from pathlib import Path
import sys,json,hashlib,re,datetime
P=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent
summary=json.loads((P/'completion-summary.json').read_text())
source=summary['sourceRevision'];tree=summary['sourceTree'];selected=[];failures=[]
def pin(path):
 data=path.read_bytes();return {'path':str(path.relative_to(P)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
def save(name,value):
 with (P/name).open('x') as f:json.dump(value,f,indent=2);f.write('\n')

gates={}
for label in ['manual','pr-source','publisher-preview']:
 d=P/label
 for kind in ['run','jobs']:
  final=json.loads((d/f'{kind}-final.json').read_text())
  originals=sorted(d.glob(kind+'-20*.json'))
  assert originals and json.loads(originals[-1].read_text())==final
  with (d/(kind+'.json')).open('xb') as f:f.write(originals[-1].read_bytes())
  selected.append(pin(d/(kind+'.json')))
 run=json.loads((d/'run.json').read_text());jobs=json.loads((d/'jobs.json').read_text())['jobs']
 assert run['status']=='completed' and run['head_sha']==source and run['run_attempt']==1
 gates[label]=[]
 for j in jobs:
  assert j['run_id']==run['id'] and j['status']=='completed' and j.get('head_sha',source)==source
  gates[label].append({'jobId':j['id'],'name':j['name'],'conclusion':j['conclusion'],'steps':j['steps']})
  if j['conclusion'] not in ['success','skipped']:
   log=d/f'job-{j["id"]}.log';rows=[]
   if log.exists():
    lines=log.read_text().splitlines()
    hits=[n for n,line in enumerate(lines) if re.search(r'not ok|##\[error\]|Admitted archive changed',line)]
    for n in hits:
     rows.append({'line':n+1,'context':lines[max(0,n-2):min(len(lines),n+18)]})
   failures.append({'run':label,'jobId':j['id'],'conclusion':j['conclusion'],'failedSteps':[s['name'] for s in j['steps'] if s['conclusion']=='failure'],'excerpts':rows})
 for log in sorted(d.glob('job-*.log')):
  txt=log.read_text();assert not re.search(r'(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|https://[^\s]*[?&](?:sig|X-Amz-Signature)=)',txt)
  selected.append(pin(log))
 selected.append(pin(d/'artifacts-final.json'))

partitions=[]
expected=P/'expected-test-partitions.json'
if expected.exists():
 e=json.loads(expected.read_text());assert e['sourceRevision']==source
 for job in gates['manual']:
  match=re.fullmatch(r'test \(([1-4])\)',job['name'])
  if not match:continue
  index=int(match[1]);log=P/'manual'/f'job-{job["jobId"]}.log'
  files=[]
  for line in log.read_text().splitlines():
   line=re.sub(r'^\d{4}-\d\d-\d\dT[\d:.]+Z ','',line)
   if re.fullmatch(r'(?:scripts|game|authoring|platforms)/[^\s]+\.mjs',line):files.append(line)
  expect=e['shards'][index-1]['files'];assert files==expect
  partitions.append({'shard':index,'jobId':job['jobId'],'count':len(files),'exactOrderedFileListMatchesPinnedGit':True,'files':files})
 assert len(partitions)==4 and sum(len(x['files']) for x in partitions)==e['count']
 save('partition-coverage.json',{'sourceRevision':source,'count':e['count'],'allFourShardsExactlyMatch':True,'shards':partitions})

save('job-step-records.json',gates);save('failures.json',failures)
identity=json.loads((P/'source-identities.json').read_text())
if summary['runs']['pr-source']['conclusion']=='success':assert len(identity)==12 and all(x['matchesExpected'] for x in identity)
review={'format':'revealline-hosted-review.v1','observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRevision':source,'sourceTree':tree,'runs':summary['runs'],'sourceTestTotals':summary['sourceTestTotals'],'sourceIdentityObservations':len(identity),'allObservedIdentitiesMatch':summary['allObservedIdentitiesMatch'],'sourceRunsCompleted':True,'allSourceRunGatesPassed':all(summary['runs'][x]['conclusion']=='success' for x in ['manual','pr-source']),'freezeJobConclusion':next((j['conclusion'] for j in gates['manual'] if j['name']=='freeze'),None),'failureCount':len(failures),'scope':'Original final API snapshots, source gate logs, source identity and partition evidence. Not a source-qualification receipt, original frozen-byte review, or release/public/phase acceptance.'}
save('review.json',review)
with (P/'README.md').open('x') as f:
 f.write('# Exact-source hosted observations\n\n')
 f.write(f'Source `{source}`, tree `{tree}`. Final original API snapshots are `manual/run.json`, `manual/jobs.json`, `pr-source/run.json`, and `pr-source/jobs.json`; publisher preview is kept separately. The timestamped originals remain intact. Each completed non-skipped job has its original `job-ID.log`.\n\n')
 f.write('`review.json` and `job-step-records.json` expose conclusions and actual executed step results. `log-receipts.json` preserves each log hash and TAP count. Source-suite totals count only the four source shards, excluding separate preflight infrastructure tests. `source-identities.json` retains raw before/after content-and-mode identities from PR source jobs. `partition-coverage.json`, when present, compares every ordered manual shard file to the pinned Git source and exact runner contract. `pr-partition-coverage.json` separately binds the PR selections to actual runner bytes, start markers, steps and source identities; the PR logs do not emit per-file execution traces.\n\n')
 f.write('`failures.json` preserves failed/cancelled jobs and raw error excerpts. A successful PR run cannot erase a failed manual run; a failed manual source gate blocks freeze. Publisher preview validates mutable archive admissions separately and does not establish source qualification or public deployment. Artifact JSON is only original GitHub API metadata; payload reception, inner-byte validation, and release admission are separate root-owned checks.\n\n')
 f.write('No workflow rerun, source mutation, PR/tag/release mutation, payload download, or publication was performed by this observer. Earlier source runs retain their own evidence directories. `pr-final.json` is a later PR-state observation and may contain a newer head; actual tested identity comes from each pinned run and checkout log.\n')
for name in ['completion-summary.json','expected-test-partitions.json','log-receipts.json','source-identities.json','pr-final.json','partition-coverage.json','job-step-records.json','failures.json','review.json','README.md','observe.py','finalize.py','review-checkouts.py','checkout-review.json','bind-observed-automation.py','review-pr-partitions.py','pr-partition-coverage.json','run-binding.json','local-before-original.json','preparation-review.json','prepare.py','partition-list-1.log','partition-list-2.log','partition-list-3.log','partition-list-4.log','manual-dispatch.json','branch-runs-first.json']:
 if (P/name).is_file():selected.append(pin(P/name))
for sub in ['source-executed','pr-automation','preview-provenance']:
 if (P/sub).exists():
  for path in sorted((P/sub).iterdir()):
   if path.is_file():selected.append(pin(path))
save('final-evidence-manifest.json',{'format':'revealline-evidence-files.v1','files':selected,'count':len(selected),'bytes':sum(x['bytes'] for x in selected),'scope':'Explicit completed evidence; timestamped observer history is retained outside this compact manifest.'})
print(json.dumps({'review':str(P/'review.json'),'sha256':hashlib.sha256((P/'review.json').read_bytes()).hexdigest(),'files':len(selected),'bytes':sum(x['bytes'] for x in selected),'reviewSummary':review},indent=2))
