from pathlib import Path
import json,hashlib,zipfile,subprocess,socket,datetime,urllib.request,os,sys
HEAD=sys.argv[1]; PORT=9220
assert len(HEAD)==40 and all(c in '0123456789abcdef' for c in HEAD)
repo=Path('/Volumes/alex/CodexMigrationStaging/fpv-worktrees/fpv-regional-family-library-source-20261016')
temp=Path('/Volumes/alex/CodexMigrationStaging/fpv-temp')
candidate=Path('/Volumes/alex/CodexMigrationStaging/fpv-package-qualification-20261014')/('regional-family-library-'+HEAD[:8])
stage=temp/'regional-family-combined-player-9220'
sha=lambda b:hashlib.sha256(b).hexdigest()
qualification=json.loads((candidate/'qualification-receipt.json').read_text())
assert qualification['sourceRevision']==HEAD and qualification['packagedFamilyAndLabelChecks']['passed']
envelope=json.loads((candidate/'optional-packages.json').read_text())
manifest=json.loads((candidate/'manifest-optional-fpv-worlds.json').read_text())
assert envelope['sourceRevision']==manifest['engineCommit']==HEAD
assert not stage.exists(),'Existing frozen stage preserved; review before continuing'
with socket.socket() as probe:probe.bind(('127.0.0.1',PORT))
site=stage/'web/revealline/practice/fpv-worlds/releases'/envelope['version']/'site'
site.mkdir(parents=True)
files=[]
def keep(target,data,kind):
 target.parent.mkdir(parents=True,exist_ok=True)
 target.write_bytes(data);target.chmod(0o444)
 files.append({'path':target.relative_to(stage/'web').as_posix(),'bytes':len(data),'sha256':sha(data),'kind':kind})
with zipfile.ZipFile(candidate/'distribution-optional-fpv-worlds.zip') as archive:
 for item in archive.infolist():
  assert not item.is_dir()
  target=site/item.filename
  assert target.resolve().is_relative_to(site.resolve())
  keep(target,archive.read(item),'unchanged-normal-qualified-runtime')
normalCount=len(files)
prior=json.loads((temp/'integrated-main-player-9208/integration-review-identity.json').read_text())
appearance=json.loads((temp/'integrated-main-player-9208/integration-appearance-extension-receipt.json').read_text())
names=[row['path'] for row in prior['authoringFiles']]+[row['path'] for row in appearance['addedFiles']]
for name in names:
 raw=subprocess.check_output(['git','show',HEAD+':'+name],cwd=repo)
 keep(stage/'web'/name,raw,'separate-supported-read-only-authoring-tool-or-appearance')
normal=f'http://127.0.0.1:{PORT}/revealline/practice/fpv-worlds/releases/'+envelope['version']+'/site/optional-practice/fpv-worlds/index.html?lang=en#packs'
observer=f'http://127.0.0.1:{PORT}/authoring/fpv-worlds/storage-continuity/index.html'
identity={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'productionSource':HEAD,'sourceTree':qualification['sourceTree'],'packageRevision':manifest['revision'],'cloudRun':qualification['cloudRun'],'artifactId':qualification['artifactId'],'runtimeArchiveSHA256':qualification['runtimeArchiveSHA256'],'githubArtifactSHA256':qualification['githubArtifactSHA256'],'qualificationReceiptSHA256':sha((candidate/'qualification-receipt.json').read_bytes()),'normalPlayerURL':normal,'observerURL':observer,'port':PORT,'normalBootstrap':True,'factoryFacade':False,'runtimeMutations':False,'storageSeeded':False,'browserOpenedByPreparation':False,'nativeAccepted':False,'publicAccepted':False,'regionalRetainedLimitBytes':512*1024*1024,'worldpackDefaultLimitBytes':256*1024*1024,'retainedRevisionLimit':256,'originalMembers':normalCount,'files':files,'acceptedPriorComponent':{'sourceRevision':'8ab04b8d948203090b9ae32da3b2d4e7c1f16bf3','receiptSHA256':'19471dfe2fa8744c5a62c7a2010030ec85d2e9c97ef5f763ad03b6ea84a8c9b1','scope':'Narrow synthetic component native acceptance only; latest combined normal-player acceptance remains separate'},'scope':'Exact combined cloud-qualified normal player plus separately served existing supported read-only continuity diagnostics. Fresh distinct origin; no browser opened, database accessed, data seeded, renderer or flight started by preparation. No change to any package member, worker, launcher or manifest. Root normal-player Library/theme/integration review remains open. No original public persistence repair, all24 native coexistence, offline/browser restart, physical device, endurance or public publication acceptance.'}
(stage/'review-identity.json').write_text(json.dumps(identity,indent=2)+'\n')
control=(temp/'integrated-main-player-9208/server-control.py').read_text().replace('9208',str(PORT))
(stage/'server-control.py').write_text(control)
subprocess.run(['python3',str(stage/'server-control.py'),'start'],check=True,env={**os.environ,'TMPDIR':str(temp),'PYTHONDONTWRITEBYTECODE':'1'})
observations=[]
for row in files:
 with urllib.request.urlopen(f'http://127.0.0.1:{PORT}/'+row['path'],timeout=45) as response:
  raw=response.read()
  assert response.status==200 and len(raw)==row['bytes'] and sha(raw)==row['sha256'],row['path']
  observations.append({'path':row['path'],'status':response.status,'bytes':len(raw),'sha256':sha(raw)})
receipt={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reviewIdentitySHA256':sha((stage/'review-identity.json').read_bytes()),'sourceRevision':HEAD,'normalMembers':normalCount,'additionalAuthoringFiles':len(files)-normalCount,'allHTTPExact':True,'responses':observations,'normalPlayerURL':normal,'observerURL':observer,'nativeAccepted':False,'scope':identity['scope']}
(stage/'http-identity-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'sourceRevision':HEAD,'packageRevision':manifest['revision'],'normalPlayerURL':normal,'observerURL':observer,'stage':str(stage),'httpIdentitySHA256':sha((stage/'http-identity-receipt.json').read_bytes()),'reviewIdentitySHA256':receipt['reviewIdentitySHA256'],'normalMembers':normalCount,'additionalAuthoringFiles':len(files)-normalCount,'allHTTPExact':True,'nativeAccepted':False},indent=2))

