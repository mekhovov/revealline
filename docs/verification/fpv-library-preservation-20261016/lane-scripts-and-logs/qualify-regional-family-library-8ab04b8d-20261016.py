from pathlib import Path
import json,subprocess,zipfile,hashlib,os,datetime
HEAD='8ab04b8d948203090b9ae32da3b2d4e7c1f16bf3';RUN=38840608785
root=Path('/Volumes/alex/CodexMigrationStaging/fpv-package-qualification-20261014/regional-family-library-8ab04b8d')
repo=Path('/Volumes/alex/CodexMigrationStaging/fpv-worktrees/fpv-regional-family-library-source-20261016')
temp=Path('/Volumes/alex/CodexMigrationStaging/fpv-temp')
env={**os.environ,'TMPDIR':str(temp),'TMP':str(temp),'TEMP':str(temp)}
sha=lambda b:hashlib.sha256(b).hexdigest()
def api(endpoint):return json.loads(subprocess.check_output(['gh','api',endpoint],env=env))
def source(name):return subprocess.check_output(['gh','api','repos/mekhovov/revealline/contents/'+name+'?ref='+HEAD,'-H','Accept: application/vnd.github.raw+json'],env=env)
def keep(path,data):
 path.parent.mkdir(parents=True,exist_ok=True)
 if path.exists():assert path.read_bytes()==data,str(path)
 else:path.write_bytes(data)
metadata=json.loads((root/'github-artifact-metadata.json').read_text()); archive=root/'github-artifact.zip'
assert metadata['workflow_run']['head_sha']==HEAD and metadata['workflow_run']['id']==RUN and not metadata['expired']
assert archive.stat().st_size==metadata['size_in_bytes'] and metadata['digest']=='sha256:'+sha(archive.read_bytes())
with zipfile.ZipFile(archive) as z:
 assert len(z.namelist())==len(set(z.namelist()))
 for item in z.infolist():
  if item.is_dir():continue
  target=root/item.filename;assert target.resolve().is_relative_to(root.resolve());keep(target,z.read(item))
checks=json.loads((root/'optional-checksums.json').read_text())
for row in checks['files']:
 raw=(root/row['path']).read_bytes();assert len(raw)==row['bytes'] and sha(raw)==row['sha256'],row['path']
envelope=json.loads((root/'optional-packages.json').read_text());verification=json.loads((root/'optional-candidate-verification.json').read_text())
tree=api('repos/mekhovov/revealline/git/commits/'+HEAD)['tree']['sha']
assert envelope['sourceRevision']==verification['sourceRevision']==HEAD and envelope['sourceTree']==verification['sourceTree']==tree
assert verification['reproducibleBuilds']==2 and verification['committedInputsVerified'] and not verification['publicEligible']
subprocess.run(['python3','/Volumes/alex/CodexMigrationStaging/fpv-package-qualification-20261014/verify-all-package-members.py',str(root)],env=env,check=True)
validator=root/'validator'
for name in ['publishing/edition-zip.mjs','publishing/optional-module-closure.mjs','publishing/optional-package-policy.mjs','publishing/vendor/acorn-8.18.0.mjs']:keep(validator/name,source(name))
verify="""import {readFile,writeFile} from 'node:fs/promises';import {readEditionZip} from './publishing/edition-zip.mjs';import {validateOptionalModuleClosure} from './publishing/optional-module-closure.mjs';import {OPTIONAL_PACKAGE_POLICIES} from './publishing/optional-package-policy.mjs';const root=process.argv[2],rows=[];for(const id of ['civilian-flight','civilian-fpv','fpv-worlds']){const files=readEditionZip(await readFile(root+'/distribution-optional-'+id+'.zip'));rows.push({id,...validateOptionalModuleClosure(files,OPTIONAL_PACKAGE_POLICIES[id])});}await writeFile(root+'/archive-import-closure-receipt.json',JSON.stringify({validatorSource:'"""+HEAD+"""',packages:rows,scope:'Finished archive imports only; no checkout source fallback or execution'},null,2)+String.fromCharCode(10));console.log(JSON.stringify(rows));"""
keep(validator/'verify.mjs',verify.encode());subprocess.run(['node',str(validator/'verify.mjs'),str(root)],env=env,check=True)
functional=root/'functional-check'; manifest=json.loads((root/'manifest-optional-fpv-worlds.json').read_text()); world=root/'distribution-optional-fpv-worlds.zip'
with zipfile.ZipFile(world) as z:
 for item in z.infolist():
  if item.is_dir():continue
  target=functional/item.filename;assert target.resolve().is_relative_to(functional.resolve());keep(target,z.read(item))
files=['game/test/fpv-regional-library-families.test.mjs','game/test/fpv-regional-library-labels.test.mjs','game/test/helpers/couch-dom.mjs','game/test/fixtures/fpv-regional-labels-metadata.json']
for name in files:keep(functional/name,source(name))
keep(functional/'fixture-node-prelude.mjs',b"import i18next from './game/vendor/i18next-26.4.2.min.js';\nglobalThis.i18next=i18next;\n")
result=subprocess.run(['node','--import',str(functional/'fixture-node-prelude.mjs'),'--test',str(functional/files[0]),str(functional/files[1])],capture_output=True,text=True,env=env)
keep(root/'packaged-family-label-checks-with-host-bootstrap.tap',(result.stdout+result.stderr).encode());assert result.returncode==0,'Packaged UI/label checks failed; output retained'
with zipfile.ZipFile(world) as z:
 for item in z.infolist():
  if not item.is_dir():assert (functional/item.filename).read_bytes()==z.read(item),item.filename
receipt={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRevision':HEAD,'sourceTree':tree,'cloudRun':RUN,'artifactId':metadata['id'],'packageRevision':manifest['revision'],'runtimeArchiveSHA256':sha(world.read_bytes()),'githubArtifactSHA256':sha(archive.read_bytes()),'topLevelChecksums':len(checks['files']),'allArchiveReceipt':'all-package-members-receipt.json','importClosureReceipt':'archive-import-closure-receipt.json','packagedFamilyAndLabelChecks':{'passed':True,'cases':24,'tests':[{'path':n,'sha256':sha((functional/n).read_bytes())} for n in files],'runtimeBytesUnchanged':True,'sourceAdaptations':[],'hostSetup':'Shipped i18next engine loaded before generated bootstrap, matching its documented browser host dependency. The prior81 standalone host omission remains preserved in its separate qualification folder; this source is tested with its standard host engine from the start.'},'nativeAccepted':False,'publicAccepted':False,'scope':'Exact optional cloud package, six source/distribution archive member inventories/hashes/budgets and three finished import closures checked. Twenty-four exact-source software groups exercise shipped Library/UI/input modules using isolated synthetic metadata/callbacks and deterministic DOM. No player data, real assets loaded, runtime renderer, native DOM, physical device, offline/restart/public acceptance, storage failure diagnosis or budget change.'}
keep(root/'qualification-receipt.json',(json.dumps(receipt,indent=2)+'\n').encode());print(json.dumps(receipt,indent=2))
