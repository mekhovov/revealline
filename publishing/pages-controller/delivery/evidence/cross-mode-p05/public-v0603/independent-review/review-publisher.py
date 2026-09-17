from pathlib import Path
import json,hashlib,subprocess,zipfile,datetime
R=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test'); W=R/'.cache/worktrees/p03-publisher-v0591'; H=R/'.cache/p05-supporting-tools-public-audit-a13ab970'; O=H/'independent-review'; C=W/'publishing/pages-controller'; S='a13ab970222498d7c5fa7f62f9fc04fe436979d5'; HEAD='bf0646b91d2b85c2116a575db4536563faf9ddae'
def git(*a):return subprocess.check_output(['git',*a],cwd=W)
def j(p):return json.loads(p.read_bytes())
def sh(b):return hashlib.sha256(b).hexdigest()
def blob(rev,path):return git('show',rev+':'+path)
assert git('rev-parse','HEAD').decode().strip()==HEAD and not git('status','--porcelain')
parent=git('rev-parse','HEAD^').decode().strip(); assert parent=='d3a7d5c75b20e368536ff2f7398b3a03d8523a5c'
assert git('rev-parse',parent+'^{tree}')==git('rev-parse',S+'^{tree}')
paths=git('diff','--name-only','HEAD^').decode().splitlines();assert len(paths)==19 and all(p.startswith('publishing/pages-controller/') for p in paths)
root=j(H/'retention-expected/root-review.original.json'); rootPaths=[]
for pin in root['files']:
 suffix=pin['path'].split('/root-reviewed/',1)[1];rootPaths.append(suffix)
 raw=(W/suffix).read_bytes(); original=Path(pin['path']).read_bytes();assert len(original)==pin['bytes'] and sh(original)==pin['sha256']
 if suffix.endswith('/publication.json'):
  expected=json.loads(original); actual=json.loads(raw)
  for k in ['currentVersion','catalogSha256','currentSourceQualification']:expected[k]=actual[k]
  assert expected==actual
 else:assert raw==original==blob(HEAD,suffix)
config=j(C/'publication.json'); catalog=j(C/'catalog.json'); old=json.loads(blob('HEAD^','publishing/pages-controller/catalog.json'))
assert len(catalog['releases'])==74 and len(old['releases'])==73 and catalog['releases'][:-1]==old['releases']
assert {k:v for k,v in catalog.items() if k!='releases'}=={k:v for k,v in old.items() if k!='releases'}
assert config['currentVersion']=='v0.60.3' and config['catalogSha256']==sh((C/'catalog.json').read_bytes()) and config['allocationSha256']==sh((C/'allocations.json').read_bytes())
oldconf=json.loads(blob('HEAD^','publishing/pages-controller/publication.json')); before={a['id']:a for a in oldconf['admissions']}; after={a['id']:a for a in config['admissions']};assert len(after)==18 and [k for k in before if before[k]!=after[k]]==['archive-03']
for x in after['archive-03']['evidence']:
 raw=(C/x['path']).read_bytes();assert sh(raw)==x['sha256'] and raw==blob(HEAD,'publishing/pages-controller/'+x['path'])
for x in before['archive-03']['evidence']: assert (C/x['path']).read_bytes()==blob('HEAD^','publishing/pages-controller/'+x['path'])
rel=j(R/'.cache/p05-qualified/supporting-tools-v0603/root-release/published-release.json');assert rel['id']==390725431 and rel['draft'] is False and rel['tag_name']=='v0.60.3'; assets={a['name']:a for a in rel['assets']};assert len(assets)==9
binding=j(R/'.cache/p05-qualified/supporting-tools-v0603/root-release/upload-binding.reviewed.json');assert binding['source']['commit']==S
for x in binding['release']['assets']:assert x['bytes']==assets[x['name']]['size'] and 'sha256:'+x['sha256']==assets[x['name']]['digest']
map={'manifest.json':'metadata/v0.60.3/manifest.json','release.json':'metadata/v0.60.3/release.json','distribution.zip.sha256':'metadata/v0.60.3/distribution.zip.sha256','source-qualification.json':'evidence/current-v0603/source-qualification.json'}
for name,path in map.items():
 raw=(C/path).read_bytes(); assert len(raw)==assets[name]['size'] and 'sha256:'+sh(raw)==assets[name]['digest'];assert raw==blob(HEAD,'publishing/pages-controller/'+path)
row=catalog['releases'][-1];assert row=={'version':'v0.60.3','sourceRevision':S,'tagObject':'04eaf221699a5c1108a2a166b33303ccdae3d8be','recordSha256':assets['release.json']['digest'][7:],'manifestSha256':assets['manifest.json']['digest'][7:],'checksumSha256':assets['distribution.zip.sha256']['digest'][7:]}
assert config['currentSourceQualification']=={'path':map['source-qualification.json'],'sha256':assets['source-qualification.json']['digest'][7:]}
q=j(C/map['source-qualification.json']);assert q['sourceRevision']==S and q['sourceTree']=='cf744b1ced9680b2fb4e0c304ddfc4b9f44b3e86' and q['tests']['pass']==5482 and q['testFiles']==436
z=zipfile.ZipFile(C/'evidence/archive-03/append-v0602/originals.zip');idx=j(C/'evidence/archive-03/append-v0602/originals-index.json'); assert len(z.namelist())==len(idx['files'])==315 and z.testzip() is None
assert set(z.namelist())=={x['path'] for x in idx['files']}
for x in idx['files']:
 raw=z.read(x['path']);assert len(raw)==x['bytes'] and sh(raw)==x['sha256']
expectedpaths=set(rootPaths)|{'publishing/pages-controller/catalog.json','publishing/pages-controller/README.md','publishing/pages-controller/delivery/archive-explorer-review.md'}|{'publishing/pages-controller/'+p for p in map.values()};assert set(paths)==expectedpaths
for p in paths:assert (W/p).read_bytes()==blob(HEAD,p)
report={'status':'PASS_PUBLISHER_CANDIDATE_NO_BLOCKER','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'publisherCommit':HEAD,'publisherTree':git('rev-parse','HEAD^{tree}').decode().strip(),'parent':parent,'sourceRevision':S,'sourceTree':q['sourceTree'],'changedPaths':paths,'trackedCheckoutClean':True,'scope':'19 publication-only paths; no runtime, workflow, frozen-source or version edits.','catalog':{'entries':74,'oldEntriesPreservedExactly':73,'newTagObject':row['tagObject']},'retention':{'rootFilesCompared':12,'archive03PinsRehashed':16,'oldPinsAndBodiesPreserved':6,'otherAdmissionsUnchanged':17,'originalZIPMembersRehashed':315},'release':{'id':rel['id'],'publishedAt':rel['published_at'],'nineDescriptorPinsMatched':True,'fourNewMetadataBodiesMatchOriginalAssetDigests':True},'guidance':'Two related docs require actual historical explorer/main-catalog/Back checks, preserve originals and explicitly avoid claiming game/source/current-deployment acceptance.','findings':[],'limitations':['Read-only static and local byte review; no CI rerun, remote requests, new browser or public acceptance.','Hosted exact-head preview, normal PR merge, sole Pages deployment, full HTTP audit and scoped native public regression remain parent-owned gates.']}
(O/'publisher-bf0646b9-review.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['status','publisherCommit','publisherTree','catalog','retention','findings']},indent=2))
