from pathlib import Path, PurePosixPath
import subprocess,json,hashlib,zipfile,io,os,datetime,base64
HEAD='53338dc73469f866e9289b2b5f74555c68e8231e';RUN=39081155120
BASE=Path('[EXTERNAL_QUALIFICATION_BASE]')
ROOT=BASE/'storage-observer-53338dc7-combined-a3db-20261018'
sha=lambda b:hashlib.sha256(b).hexdigest()
def api(p): return json.loads(subprocess.check_output(['gh','api','repos/mekhovov/revealline/'+p]))
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
 d=api('contents/'+path+'?ref='+HEAD);b=base64.b64decode(d['content'])
 assert len(b)==d['size'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==d['sha']
 return b
policy_source=source('publishing/optional-package-policy.mjs');assert sha(policy_source)=='b1afd3ccb30d9af2c3527e94ce458f95662e619626ca424636ec3add80e194e3'
expected_limits={'civilian-flight':{'files':98,'bytes':8*1024**2},'civilian-fpv':{'files':141,'bytes':12*1024**2+256*1024},'fpv-worlds':{'files':200,'bytes':20*1024**2}}
run=api('actions/runs/'+str(RUN));assert run['event']=='workflow_dispatch' and run['path']=='.github/workflows/company-edition-candidate.yml';assert run['head_sha']==HEAD
jobs=api('actions/runs/'+str(RUN)+'/jobs')['jobs'];assert next(x for x in jobs if x['name']=='optional-practice')['conclusion']=='success'
available=api('actions/runs/'+str(RUN)+'/artifacts')['artifacts'];selected=[x for x in available if x['name']=='optional-flight-candidate-'+HEAD and not x['expired']];assert len(selected)==1;AID=selected[0]['id'];meta=api('actions/artifacts/'+str(AID));assert meta['workflow_run']['head_sha']==HEAD and meta['workflow_run']['id']==RUN and not meta['expired']
assert meta['name']=='optional-flight-candidate-'+HEAD and 0<meta['size_in_bytes']<=64*1024**2 and isinstance(meta['digest'],str) and len(meta['digest'])==71 and meta['digest'].startswith('sha256:')
free=reserve();ROOT.mkdir(exist_ok=False);put(ROOT/'github-artifact-metadata.json',(json.dumps(meta,indent=2)+'\n').encode())
put(ROOT/'start.json',(json.dumps({'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':HEAD,'run':RUN,'externalFreeBytes':free,'originalsUntouched':True},indent=2)+'\n').encode())
env={**os.environ,'TMPDIR':str(ROOT),'TMP':str(ROOT),'TEMP':str(ROOT)}
partial=ROOT/'github-artifact.downloading'
with partial.open('xb') as f:
 result=subprocess.run(['gh','api','--allow-escape-sequences','repos/mekhovov/revealline/actions/artifacts/'+str(AID)+'/zip'],stdout=f,stderr=subprocess.PIPE,env=env)
 f.flush();os.fsync(f.fileno())
put(ROOT/'download-terminal.json',(json.dumps({'exitCode':result.returncode,'stderr':result.stderr.decode(),'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n').encode());assert result.returncode==0
b=partial.read_bytes();assert len(b)==meta['size_in_bytes'] and 'sha256:'+sha(b)==meta['digest'];archive=ROOT/'github-artifact.zip';partial.rename(archive)
NEW_MODULES={'optional-practice/civilian-fpv/aircraft-appearance.mjs': {'bytes': 1018, 'sha256': 'eac3ae9df81f7fc4f96da3dc55023797895034e096b02ba62a480a2efb3ae09e', 'gitBlob': '74b2be0436d3aaec04ef1707e4c95f5ac4f1040b'}, 'optional-practice/civilian-fpv/aircraft-preview.mjs': {'bytes': 7063, 'sha256': '07ac999bc60dcef1a23a4a1a905d6e322c4c522aeeae466110b416bdc2a0a27c', 'gitBlob': 'f5aa83735433d1bee11649dc9d75920e658fc87a'}}
rows=[];new_module_proofs=[]
with zipfile.ZipFile(archive) as outer:
 inventory(outer,512*1024**2)
 checks=json.loads(outer.read('optional-checksums.json'));declared=[r['path'] for r in checks['files']];assert len(declared)==len(set(declared)) and set(outer.namelist())==set(declared)|{'optional-checksums.json'}
 for row in checks['files']:
  x=outer.read(row['path']);assert len(x)==row['bytes'] and sha(x)==row['sha256']
 envelope=json.loads(outer.read('optional-packages.json'));verification=json.loads(outer.read('optional-candidate-verification.json'));tree=api('git/commits/'+HEAD)['tree']['sha'];assert tree=='7b1cb82c32146448ef4d6b6710233a73b88f74f4'
 assert envelope['sourceRevision']==verification['sourceRevision']==HEAD and envelope['sourceTree']==verification['sourceTree']==tree
 assert verification['reproducibleBuilds']==2 and verification['committedInputsVerified'] and not verification['publicEligible']
 assert {x['id']for x in envelope['packages']}=={'civilian-flight','civilian-fpv','fpv-worlds'}
 for item in envelope['packages']:
  ident=item['id'];manifest=json.loads(outer.read('manifest-optional-'+ident+'.json'));inv=json.loads(outer.read('source-inventory-optional-'+ident+'.json'))
  assert manifest['limits']==expected_limits[ident]
  assert manifest['engineCommit']==inv['sourceRevision']==HEAD and manifest['engineTree']==inv['sourceTree']==tree and manifest['revision']==inv['packageRevision']==item['revision']
  for kind,table,metadata in [('distribution',manifest,'optional-package.json'),('source',inv,'source-inventory.json')]:
   name=kind+'-optional-'+ident+'.zip';raw=outer.read(name)
   with zipfile.ZipFile(io.BytesIO(raw)) as z:
    actual=inventory(z,128*1024**2);expected={f['path']for f in table['files']}|{metadata}
    assert len(actual)==len(expected) and set(z.namelist())==expected
    for f in table['files']:
     data=z.read(f['path']);assert len(data)==f['bytes'] and sha(data)==f['sha256'],(name,f['path'])
    assert json.loads(z.read(metadata))==table
    if ident in ['civilian-fpv','fpv-worlds']:
     for module,pin in NEW_MODULES.items():
      assert module in expected
      body=z.read(module);blob=hashlib.sha1(b'blob '+str(len(body)).encode()+b'\0'+body).hexdigest()
      assert len(body)==pin['bytes'] and sha(body)==pin['sha256'] and blob==pin['gitBlob'],(ident,kind,module)
      new_module_proofs.append({'package':ident,'role':kind,'path':module,**pin})
    total=sum(x.file_size for x in actual);assert total<=manifest['limits']['bytes'] and len(actual)<=manifest['limits']['files']
    rows.append({'id':ident,'kind':kind,'verifiedMembers':len(actual),'uncompressedBytes':total,'limits':manifest['limits'],'archiveBytes':len(raw),'archiveSHA256':sha(raw)})
   put(ROOT/name,raw)
 for item in outer.infolist():
  if not item.filename.endswith('.zip'):put(ROOT/item.filename,outer.read(item))
assert len(new_module_proofs)==8
validator=ROOT/'validator'
for name in ['publishing/edition-zip.mjs','publishing/optional-module-closure.mjs','publishing/optional-package-policy.mjs','publishing/optional-import-capabilities.mjs','publishing/vendor/acorn-8.18.0.mjs']:put(validator/name,policy_source if name=='publishing/optional-package-policy.mjs' else source(name))
program="import {readFile,writeFile} from 'node:fs/promises';import {readEditionZip} from './publishing/edition-zip.mjs';import {validateOptionalModuleClosure} from './publishing/optional-module-closure.mjs';import {OPTIONAL_PACKAGE_POLICIES} from './publishing/optional-package-policy.mjs';const root=process.argv[2],rows=[];for(const id of ['civilian-flight','civilian-fpv','fpv-worlds']){const files=readEditionZip(await readFile(root+'/distribution-optional-'+id+'.zip'));rows.push({id,...validateOptionalModuleClosure(files,OPTIONAL_PACKAGE_POLICIES[id])});}await writeFile(root+'/archive-import-closure-receipt.json',JSON.stringify({validatorSource:'"+HEAD+"',packages:rows,scope:'Finished original archive imports only; no checkout source fallback or execution'},null,2)+'\\n',{flag:'wx'});console.log(JSON.stringify(rows));"
put(validator/'verify.mjs',program.encode());run=subprocess.run(['node',str(validator/'verify.mjs'),str(ROOT)],capture_output=True,env=env);put(ROOT/'import-closure.log',run.stdout+run.stderr);assert run.returncode==0,'closure failure retained'
receipt={'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRevision':HEAD,'sourceTree':tree,'run':RUN,'artifactId':AID,'archiveBytes':meta['size_in_bytes'],'archiveSHA256':sha(b),'topLevelChecksums':len(checks['files']),'archives':rows,'newAircraftModuleIdentities':new_module_proofs,'moduleClosure':json.loads((ROOT/'archive-import-closure-receipt.json').read_text()),'scope':'Exact optional original artifact, all six original source/runtime inventories and member hashes/budgets, finished import closures. No native/player/public acceptance. Combined source includes exact main a3db2c95. This is new storage53338dc7 evidence; old7842, Library and earlier evidence are not inherited.'}
put(ROOT/'qualification-original-members-and-closure.json',(json.dumps(receipt,indent=2)+'\n').encode());print(json.dumps({'root':str(ROOT),'receipt':receipt},indent=2))
