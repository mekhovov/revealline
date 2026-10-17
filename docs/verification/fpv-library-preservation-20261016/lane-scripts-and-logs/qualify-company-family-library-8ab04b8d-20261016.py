from pathlib import Path
import json,subprocess,zipfile,hashlib,datetime,os,io
HEAD='8ab04b8d948203090b9ae32da3b2d4e7c1f16bf3';RUN=38840697239
repo=Path('/Volumes/alex/CodexMigrationStaging/fpv-worktrees/fpv-regional-family-library-source-20261016')
root=Path('/Volumes/alex/CodexMigrationStaging/fpv-package-qualification-20261014/regional-family-library-8ab04b8d')
temp=Path('/Volumes/alex/CodexMigrationStaging/fpv-temp');env={**os.environ,'TMPDIR':str(temp)}
api=lambda endpoint:json.loads(subprocess.check_output(['gh','api',endpoint],env=env));sha=lambda b:hashlib.sha256(b).hexdigest()
def source(name):
 import base64
 return base64.b64decode(api('repos/mekhovov/revealline/contents/'+name+'?ref='+HEAD)['content'])
run=api(f'repos/mekhovov/revealline/actions/runs/{RUN}');assert run['head_sha']==HEAD and run['conclusion']=='success'
rows=api(f'repos/mekhovov/revealline/actions/runs/{RUN}/artifacts')['artifacts']
metadata=next(row for row in rows if row['name']=='company-candidate-'+HEAD and not row['expired'])
metadata=api(f"repos/mekhovov/revealline/actions/artifacts/{metadata['id']}")
assert metadata['workflow_run']['head_sha']==HEAD
archive=root/'company-original-artifact.zip'
if not archive.exists():
 partial=root/'github-company-artifact.downloading';assert not partial.exists(),'Preserve partial pending inspection'
 with partial.open('wb') as out:subprocess.run(['gh','api',f"repos/mekhovov/revealline/actions/artifacts/{metadata['id']}/zip"],stdout=out,check=True,env=env)
 assert zipfile.is_zipfile(partial)
 assert metadata['digest']=='sha256:'+sha(partial.read_bytes())
 partial.rename(archive)
(root/'github-company-artifact-metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
assert archive.stat().st_size==metadata['size_in_bytes']
assert metadata['digest']=='sha256:'+sha(archive.read_bytes())
receipts=[]
with zipfile.ZipFile(archive) as z:
 assert len(z.namelist())==len(set(z.namelist()))
 checks=json.loads(z.read('checksums.json'))
 for row in checks['files']:
  raw=z.read(row['path']);assert len(raw)==row['bytes'] and sha(raw)==row['sha256'],row['path']
 verification=json.loads(z.read('candidate-verification.json'));envelope=json.loads(z.read('editions.json'))
 tree=api('repos/mekhovov/revealline/git/commits/'+HEAD)['tree']['sha']
 assert verification['sourceRevision']==envelope['sourceRevision']==HEAD
 assert verification['sourceTree']==envelope['sourceTree']==tree
 assert verification['reproducibleBuilds']==2 and not verification['publicEligible']
 for role,archiveName,tableName,embedded in [('runtime','distribution-fpv-learning.zip','manifest-fpv-learning.json','edition-manifest.json'),('source','source-fpv-learning.zip','source-inventory-fpv-learning.json','source-inventory.json')]:
  raw=z.read(archiveName);table=json.loads(z.read(tableName))
  assert table['sourceRevision']==HEAD and table['sourceTree']==tree
  with zipfile.ZipFile(io.BytesIO(raw)) as q:
   expected={f['path'] for f in table['files']};extra=set(q.namelist())-expected
   assert len(extra)==1,(role,extra)
   embeddedName=next(iter(extra));assert embeddedName in [embedded,'company-manifest.json','manifest.json','source-inventory.json'],(role,embeddedName)
   assert json.loads(q.read(embeddedName))==table
   assert len(q.namelist())==len(expected)+1
   for item in table['files']:
    data=q.read(item['path']);assert len(data)==item['bytes'] and sha(data)==item['sha256'],(role,item['path'])
   total=sum(item.file_size for item in q.infolist())
   if role=='runtime':assert len(q.namelist())<=2000 and total<=80*1024*1024 and total<=72*1024*1024
   receipts.append({'role':role,'files':len(q.namelist()),'contentBytesIncludingMetadata':total,'archiveBytes':len(raw),'archiveSHA256':sha(raw)})
 for name in z.namelist():
  if not name.endswith('.zip'):(root/('company-'+name)).write_bytes(z.read(name))
sourcePolicy=source('game/editions/package-budget.mjs')
priorPolicy=json.loads(Path('/Volumes/alex/CodexMigrationStaging/fpv-package-qualification-20261014/regional-capacity-fac28c1d/company-original-members-receipt.json').read_text())['existingCompanyRuntimeLimits']
assert sha(sourcePolicy)==priorPolicy['sourceSHA256'], 'Existing Company budget policy changed; review required'
receipt={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRevision':HEAD,'sourceTree':tree,'run':RUN,'artifactId':metadata['id'],'githubArtifactSHA256':sha(archive.read_bytes()),'topLevelChecksums':len(checks['files']),'allMemberHashes':True,'archives':receipts,'existingCompanyRuntimeLimits':{'files':2000,'bytes':80*1024*1024,'sourceSHA256':sha(sourcePolicy)},'runtimeAlsoUnder72MiB':True,'companyBudgetPolicyByteIdenticalToPriorFac28Qualification':True,'cloudReproducibleBuilds':2,'publicEligible':False,'scope':'Exact regional family-card candidate only; 24 unchanged offered identities; no browser heap/time or public closing/zero-saved cause or fix claim. Every exact downloaded original Company top-level checksum and runtime/source ZIP member length/hash checked externally. Existing Company policy is unchanged; source inventory is separately hashed, not assigned runtime limits. This source predates merged metadata-listing #1537; combined-main qualification remains distinct. Actual runtime also remains below72MiB. Optional package qualification has its own receipt. No native/player data, offline/restart, original-public-profile persistence, or publication acceptance.'}
(root/'company-original-members-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
(root/'cloud-job-final-state.json').write_text(json.dumps(api(f'repos/mekhovov/revealline/actions/runs/{RUN}/jobs'),indent=2)+'\n')
print(json.dumps(receipt,indent=2))
