#!/usr/bin/env python3
"""Review PR partition execution from actual runner bytes, identities and log markers."""
from pathlib import Path
import json,re,hashlib
P=Path(__file__).resolve().parent
expected=json.loads((P/'expected-test-partitions.json').read_bytes());source=expected['sourceRevision'];tree=expected['sourceTree']
auto=json.loads((P/'pr-automation/receipt.json').read_bytes())
runner=P/'pr-automation/scripts__run-test-shard.mjs';rawrunner=runner.read_bytes()
assert rawrunner==(P/'source-executed/scripts__run-test-shard.mjs').read_bytes()
# Retained runner contract is the reviewed roots/predicate/sort/modulo implementation.
assert hashlib.sha256(rawrunner).hexdigest()==expected['runnerSha256']
jobs=json.loads((P/'pr-source/jobs-final.json').read_bytes())['jobs'];rows=[]
for shard in expected['shards']:
 index=shard['shard'];job=next(j for j in jobs if j['name']==f'test ({index})')
 assert job['status']=='completed'
 path=P/'pr-source'/f'job-{job["id"]}.log';raw=path.read_bytes();lines=[re.sub(r'^\d{4}-\d\d-\d\dT[\d:.]+Z ','',x) for x in raw.decode().splitlines()]
 marker=f'Running {len(shard["files"])}/{expected["count"]} test files in shard {index}/4.'
 assert lines.count(marker)==1
 assert auto['observedAutomationRef'] in lines
 observations=[json.loads(line[line.index('{'):]) for line in lines if '{"format":"revealline-source-identity.v1"' in line]
 assert len(observations)==2 and all(o['sourceRevision']==source and o['sourceTree']==tree and o['allTrackedSourceContentsAndModesMatch'] is True for o in observations)
 step=next(s for s in job['steps'] if s['name']==f'Run test shard {index}/4')
 assert step['status']=='completed'
 rows.append({'shard':index,'jobId':job['id'],'conclusion':job['conclusion'],'count':len(shard['files']),'runnerSelectionMatchesPinnedGit':True,'files':shard['files'],'log':str(path.relative_to(P)),'logSha256':hashlib.sha256(raw).hexdigest(),'actualRunnerMarkerLine':lines.index(marker)+1,'actualStep':step})
receipt={'format':'revealline-pr-partition-review.v1','sourceRevision':source,'sourceTree':tree,'automationRevision':auto['observedAutomationRef'],'count':expected['count'],'allFourRunnerSelectionsMatch':True,'runnerSha256':hashlib.sha256(rawrunner).hexdigest(),'shards':rows,'scope':'Actual PR start markers, completed steps, exact executed runner bytes and before/after tracked identities establish the deterministic four source selections. PR logs do not emit every selected path; these lists are inferred from the pinned runner contract, not per-file execution event traces. Manual partition-coverage.json separately verifies all explicit ordered file lists.'}
with (P/'pr-partition-coverage.json').open('x') as out:json.dump(receipt,out,indent=2);out.write('\n')
print(json.dumps({'shards':len(rows),'files':expected['count'],'sha256':hashlib.sha256((P/'pr-partition-coverage.json').read_bytes()).hexdigest()}))
