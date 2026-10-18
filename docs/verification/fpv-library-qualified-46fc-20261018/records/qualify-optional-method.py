from pathlib import Path, PurePosixPath
import subprocess,json,hashlib,zipfile,io,os,datetime,base64
N=Path(__file__).resolve().parent
P=json.loads((N/'qualification-plan.json').read_text())
HEAD=P['head'];TREE=P['tree'];RUN=P['run'];ROOT=Path(P['externalRoot']);BASE=N
sha=lambda b:hashlib.sha256(b).hexdigest()
assert os.environ['FPV_APPROVED_PLAN_SHA256']==sha((N/'qualification-plan.json').read_bytes())
def api(p): return json.loads(subprocess.check_output(['/opt/homebrew/bin/gh','api','repos/mekhovov/revealline/'+p]))
def reserve():
 s=os.statvfs(BASE); free=s.f_bavail*s.f_frsize
 assert free>=3*1024**3+512*1024**2, ('external reserve',free)
 return free
def put(p,b):
 p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('xb') as f:f.write(b);f.flush();os.fsync(f.fileno())
def safe(name):
 p=PurePosixPath(name);return bool(name) and not p.is_absolute() and '..' not in p.parts and '\\' not in name
def inventory(z,cap):
 rows=z.infolist();assert len(rows)==len({x.filename for x in rows})
 assert len(rows)<=5000 and sum(x.file_size for x in rows)<=cap
 for x in rows:assert safe(x.filename) and not x.is_dir() and ((x.external_attr>>16)&0o170000)!=0o120000 and not (x.flag_bits&1)
 return rows
def source(path):
 pin=P['sourcePins'][path];p=Path(pin['local']);assert p.parent==N/'source-inputs' and not p.is_symlink()
 b=p.read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['sha256']
 assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==pin['gitBlob']
 assert pin['canonicalSourceRevision']==HEAD
 return b
policy_source=source('publishing/optional-package-policy.mjs');assert sha(policy_source)=='21622f40aba00736d1cd3424fe880fc33522ca6e541cb8bce3e36d3beeadbd72'
expected_limits={'civilian-flight':{'files':98,'bytes':8*1024**2},'civilian-fpv':{'files':150,'bytes':12*1024**2+512*1024},'fpv-worlds':{'files':210,'bytes':20*1024**2}}
run=api('actions/runs/'+str(RUN));assert run['event']=='workflow_dispatch' and run['path']=='.github/workflows/company-edition-candidate.yml';assert run['head_sha']==HEAD
jobs=api('actions/runs/'+str(RUN)+'/jobs')['jobs'];assert next(x for x in jobs if x['name']=='optional-practice')['conclusion']=='success'
available=api('actions/runs/'+str(RUN)+'/artifacts')['artifacts'];selected=[x for x in available if x['name']=='optional-flight-integration-'+HEAD+'-head-'+HEAD and not x['expired']];assert len(selected)==1;AID=selected[0]['id'];meta=api('actions/artifacts/'+str(AID));assert meta['workflow_run']['head_sha']==HEAD and meta['workflow_run']['id']==RUN and not meta['expired']
assert meta['name']=='optional-flight-integration-'+HEAD+'-head-'+HEAD and 0<meta['size_in_bytes']<=64*1024**2 and isinstance(meta['digest'],str) and len(meta['digest'])==71 and meta['digest'].startswith('sha256:')
free=reserve();ROOT.mkdir(exist_ok=False);put(ROOT/'github-artifact-metadata.json',(json.dumps(meta,indent=2)+'\n').encode())
put(ROOT/'start.json',(json.dumps({'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':HEAD,'run':RUN,'externalFreeBytes':free,'originalsUntouched':True},indent=2)+'\n').encode())
env={**os.environ,'TMPDIR':str(ROOT),'TMP':str(ROOT),'TEMP':str(ROOT)}
partial=ROOT/'github-artifact.downloading'
with partial.open('xb') as f:
 result=subprocess.run(['/opt/homebrew/bin/gh','api','--allow-escape-sequences','repos/mekhovov/revealline/actions/artifacts/'+str(AID)+'/zip'],stdout=f,stderr=subprocess.PIPE,env=env)
 f.flush();os.fsync(f.fileno())
put(ROOT/'download-terminal.json',(json.dumps({'exitCode':result.returncode,'stderr':result.stderr.decode(),'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n').encode());assert result.returncode==0
b=partial.read_bytes();assert len(b)==meta['size_in_bytes'] and 'sha256:'+sha(b)==meta['digest'];archive=ROOT/'github-artifact.zip';partial.rename(archive)
NEW_MODULES=P['scopedOptionalModules']
rows=[];new_module_proofs=[]
with zipfile.ZipFile(archive) as outer:
 inventory(outer,512*1024**2)
 checks=json.loads(outer.read('optional-checksums.json'));declared=[r['path'] for r in checks['files']];assert len(declared)==len(set(declared))==15 and set(outer.namelist())==set(declared)|{'optional-checksums.json'}
 for row in checks['files']:
  x=outer.read(row['path']);assert len(x)==row['bytes'] and sha(x)==row['sha256']
 envelope=json.loads(outer.read('optional-packages.json'));verification=json.loads(outer.read('optional-candidate-verification.json'));tree=api('git/commits/'+HEAD)['tree']['sha'];assert tree==TREE
 assert envelope['sourceRevision']==verification['sourceRevision']==HEAD and envelope['sourceTree']==verification['sourceTree']==tree
 assert verification['reproducibleBuilds']==2 and verification['committedInputsVerified'] and not verification['publicEligible']
 assert len(envelope['packages'])==3
 assert {x['id']for x in envelope['packages']}=={'civilian-flight','civilian-fpv','fpv-worlds'}
 for item in envelope['packages']:
  ident=item['id'];manifest=json.loads(outer.read('manifest-optional-'+ident+'.json'));inv=json.loads(outer.read('source-inventory-optional-'+ident+'.json'))
  assert manifest['limits']==expected_limits[ident]
  assert manifest['engineCommit']==inv['sourceRevision']==HEAD and manifest['engineTree']==inv['sourceTree']==tree and manifest['revision']==inv['packageRevision']==item['revision']
  for kind,table,metadata in [('distribution',manifest,'optional-package.json'),('source',inv,'source-inventory.json')]:
   name=kind+'-optional-'+ident+'.zip';raw=outer.read(name)
   with zipfile.ZipFile(io.BytesIO(raw)) as z:
    actual=inventory(z,128*1024**2);declaredPaths=[f['path']for f in table['files']];assert len(declaredPaths)==len(set(declaredPaths));expected=set(declaredPaths)|{metadata}
    assert len(actual)==len(expected) and set(z.namelist())==expected
    for f in table['files']:
     data=z.read(f['path']);assert len(data)==f['bytes'] and sha(data)==f['sha256'],(name,f['path'])
    assert json.loads(z.read(metadata))==table
    if ident in ['civilian-fpv','fpv-worlds']:
     for module,pin in NEW_MODULES.items():
      if ident not in pin['packages']:continue
      assert module in expected
      body=z.read(module);blob=hashlib.sha1(b'blob '+str(len(body)).encode()+b'\0'+body).hexdigest()
      assert len(body)==pin['bytes'] and sha(body)==pin['sha256'] and blob==pin['gitBlob'],(ident,kind,module)
      new_module_proofs.append({'package':ident,'role':kind,'path':module,**pin})
    total=sum(x.file_size for x in actual);assert total<=manifest['limits']['bytes'] and len(actual)<=manifest['limits']['files']
    rows.append({'id':ident,'kind':kind,'verifiedMembers':len(actual),'uncompressedBytes':total,'limits':manifest['limits'],'archiveBytes':len(raw),'archiveSHA256':sha(raw)})
   put(ROOT/name,raw)
 for item in outer.infolist():
  if not item.filename.endswith('.zip'):put(ROOT/item.filename,outer.read(item))
assert len(new_module_proofs)==46 and len({(x['package'],x['role'],x['path'])for x in new_module_proofs})==46
assert sum(x['group']=='tuning'for x in new_module_proofs)==38 and sum(x['group']=='aircraft'for x in new_module_proofs)==8
validator=ROOT/'validator'
for name in ['publishing/edition-zip.mjs','publishing/optional-module-closure.mjs','publishing/optional-package-policy.mjs','publishing/optional-import-capabilities.mjs','publishing/vendor/acorn-8.18.0.mjs']:put(validator/name,policy_source if name=='publishing/optional-package-policy.mjs' else source(name))
program="import {readFile,writeFile} from 'node:fs/promises';import {readEditionZip} from './publishing/edition-zip.mjs';import {validateOptionalModuleClosure} from './publishing/optional-module-closure.mjs';import {OPTIONAL_PACKAGE_POLICIES} from './publishing/optional-package-policy.mjs';const root=process.argv[2],rows=[];for(const id of ['civilian-flight','civilian-fpv','fpv-worlds']){const files=readEditionZip(await readFile(root+'/distribution-optional-'+id+'.zip'));rows.push({id,...validateOptionalModuleClosure(files,OPTIONAL_PACKAGE_POLICIES[id])});}await writeFile(root+'/archive-import-closure-receipt.json',JSON.stringify({validatorSource:'"+HEAD+"',packages:rows,scope:'Finished original archive imports only; no checkout source fallback or execution'},null,2)+'\\n',{flag:'wx'});console.log(JSON.stringify(rows));"
put(validator/'verify.mjs',program.encode());run=subprocess.run([P['node'],str(validator/'verify.mjs'),str(ROOT)],capture_output=True,env=env);put(ROOT/'import-closure.log',run.stdout+run.stderr);assert run.returncode==0,'closure failure retained'
receipt={'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRevision':HEAD,'sourceTree':tree,'run':RUN,'artifactId':AID,'archiveBytes':meta['size_in_bytes'],'archiveSHA256':sha(b),'topLevelChecksums':len(checks['files']),'archives':rows,'newAircraftModuleIdentities':[x for x in new_module_proofs if x['group']=='aircraft'],'newTuningModuleIdentities':[x for x in new_module_proofs if x['group']=='tuning'],'artifactExpiresAt':meta['expires_at'],'event':'workflow_dispatch','artifactName':meta['name'],'moduleClosure':json.loads((ROOT/'archive-import-closure-receipt.json').read_text()),'scope':'Exact optional original artifact, all six original source/runtime inventories and member hashes/budgets, finished import closures. No native/player/public acceptance. Combined source includes pinned main56e29fd2; actual canonical candidate tree is independently bound. Academy sourceInput budget is distinct and is not used to loosen source/runtime archive caps. New current Library evidence; no prior package/native evidence is inherited.'}
put(ROOT/'qualification-original-members-and-closure.json',(json.dumps(receipt,indent=2)+'\n').encode());print(json.dumps({'root':str(ROOT),'receipt':receipt},indent=2))
