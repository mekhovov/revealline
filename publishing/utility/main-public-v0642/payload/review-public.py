from pathlib import Path
import json,hashlib,datetime,urllib.parse,sys,re
assert len(sys.argv)==3, 'Use: review-public.py ACTUAL_PUBLISHER_COMMIT UNIQUE_AUDIT_RUN_NAME'
publisher,run_name=sys.argv[1:];assert re.fullmatch(r'[a-f0-9]{40}',publisher) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,95}',run_name)
home=Path(__file__).resolve().parent;run=home/'tools/runs'/run_name;inputs=home/'tools/inputs'/publisher;sha=lambda b:hashlib.sha256(b).hexdigest();load=lambda p:json.loads(p.read_bytes());report=load(run/'report.json');binding=load(inputs/'binding.json');receipt=load(inputs/'receipt.json');inventory=load(run/'inventory.json');rows=receipt['files'];expected={r['path']:r for r in rows};results=[json.loads(x) for x in (run/'results.jsonl').read_bytes().splitlines()];attempts=[json.loads(x) for x in (run/'attempts.jsonl').read_bytes().splitlines()]
assert report['status']=='PASS' and report['files']==report['completedFiles']==report['fullInventoryFiles']==len(rows)
assert report['verifiedBytes']==report['expectedBytes']==receipt['totalBytes']==sum(r['bytes'] for r in rows)
assert report['failedFiles']==report['uninspectedFiles']==0 and report['skipped']==report['changedAuthorities']==report['failures']==[] and report['allArtifactBodiesVerified'] is True and report['sourcePinsUnchanged'] is True
assert inventory['fullInventory']==rows and inventory['selectedPaths']==[x['path'] for x in rows] and inventory['mode']=='full'
assert len(results)==len(expected) and set(r['path'] for r in results)==set(expected)
parse=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00'));start=parse(report['startedAt']);end=parse(report['finishedAt']);byattempt={}
for a in attempts:
 assert a['path'] in expected;byattempt.setdefault(a['path'],[]).append(a)
 assert start<=parse(a['startedAt'])<=parse(a['finishedAt'])<=end
for r in results:
 e=expected[r['path']];url=binding['base']+urllib.parse.quote(r['path'],safe="/-_.!~*'()")
 assert r['url']==url and r['expectedBytes']==r['bytes']==e['bytes'] and r['expectedSha256']==r['sha256']==e['sha256']
 assert r['status']==200 and r['ok'] is True and r['bytesMatch'] is True and r['hashMatch'] is True and r['contentTypeAccepted'] is True
 attemptsForPath=byattempt[r['path']];assert attemptsForPath[-1]==r and [a['attempt'] for a in attemptsForPath]==list(range(1,len(attemptsForPath)+1)) and len(attemptsForPath)<=3
assert set(byattempt)==set(expected) and report['retries']==len(attempts)-len(rows)
for key in ['base','currentVersion','gameSourceRevision','qualifiedSourceTree','controllerCommit','controllerTree','deploymentId','runId']:
 assert report[key]==binding[key]
assert report['bindingSha256']==sha((inputs/'binding.json').read_bytes()) and report['expectedInventorySha256']==binding['inventorySha256']
for p in binding['pins'].values():
 b=(inputs/p['path']).read_bytes();assert len(b)==p['bytes'] and sha(b)==p['sha256']
for p in report['runnerPins']:assert sha(Path(p['file']).read_bytes())==p['sha256']
catalog=load(inputs/binding['pins']['catalog']['path']);retained=load(home/'tools/retained-catalog.json')
current_versions=sorted(row['version'] for row in catalog['releases']);retained_versions=sorted(row['version'] for row in retained['releases']);new_versions=sorted(set(current_versions)-set(retained_versions))
assert len(current_versions)==len(set(current_versions)) and len(retained_versions)==len(set(retained_versions)) and set(retained_versions)<=set(current_versions)
cohorts={'retainedCatalogAuthorities':len(retained_versions),'newCatalogAuthorities':len(new_versions),'totalCatalogAuthorities':len(current_versions),'retainedCatalogVersions':retained_versions,'newCatalogVersions':new_versions,'historicalHTTPBodyPreservationClaimed':False}
assert report['catalogCohorts']==inventory['catalogCohorts']==cohorts
assert report['archiveAdmissions']==inventory['archiveAdmissions']=={'total':32,'retainedUnchanged':31,'updated':['archive-32'],'externalBodiesReaudited':False}
record={'status':'PASS_ALL_PUBLIC_RESULT_ROWS_RECONCILED','reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'controllerCommit':binding['controllerCommit'],'deploymentId':binding['deploymentId'],'runId':binding['runId'],'gameSourceRevision':binding['gameSourceRevision'],'version':binding['currentVersion'],'files':len(rows),'bytes':report['verifiedBytes'],'attempts':len(attempts),'failedAttempts':sum(not a['ok'] for a in attempts),'retries':report['retries'],'catalogCohorts':cohorts,'canonicalRequestURLsVerified':True,'originalInputsAndRunnerPinsUnchanged':True,'noPublicPayloadFiles':True,'reportSha256':sha((run/'report.json').read_bytes()),'pins':[],'scope':'Every complete result and attempt compared to exact hosted inventory; MIME acceptance is the unchanged reviewed transport policy. Live authority refresh and independent peer review remain separate. No browser/offline/physical-device or phase acceptance.'}
for name in ['report.json','inventory.json','results.jsonl','attempts.jsonl']:
 p=run/name;b=p.read_bytes();record['pins'].append({'path':p.relative_to(home).as_posix(),'bytes':len(b),'sha256':sha(b)})
with (home/('public-row-review-'+run_name+'.json')).open('x') as f:f.write(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:record[k] for k in ['status','files','bytes','attempts','failedAttempts','retries','reportSha256']}))
