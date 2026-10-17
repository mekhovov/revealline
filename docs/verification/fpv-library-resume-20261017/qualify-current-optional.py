from pathlib import Path, PurePosixPath
import subprocess,json,hashlib,zipfile,io,os,datetime,base64
HEAD='9e97eeb7c192f6d6252b99dcd83e1718e1c78d35';RUN=39045136739;AID=12105567729
BASE=Path('/Volumes/alex/CodexMigrationStaging/fpv-package-qualification-20261014')
ROOT=BASE/'regional-family-library-9e97eeb7-resume-20261017'
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
run=api('actions/runs/'+str(RUN));assert run['head_sha']==HEAD
jobs=api('actions/runs/'+str(RUN)+'/jobs')['jobs'];assert next(x for x in jobs if x['name']=='optional-practice')['conclusion']=='success'
meta=api('actions/artifacts/'+str(AID));assert meta['workflow_run']['head_sha']==HEAD and meta['workflow_run']['id']==RUN and not meta['expired']
assert meta['name']=='optional-flight-candidate-'+HEAD and meta['size_in_bytes']==26831450 and meta['digest']=='sha256:c8720bb587b70663df91c410280a95c063a2781704116f0084e29eadda5b12ce'
free=reserve();ROOT.mkdir(exist_ok=False);put(ROOT/'github-artifact-metadata.json',(json.dumps(meta,indent=2)+'\n').encode())
put(ROOT/'start.json',(json.dumps({'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':HEAD,'run':RUN,'externalFreeBytes':free,'originalsUntouched':True},indent=2)+'\n').encode())
env={**os.environ,'TMPDIR':str(ROOT),'TMP':str(ROOT),'TEMP':str(ROOT)}
partial=ROOT/'github-artifact.downloading'
with partial.open('xb') as f:
 result=subprocess.run(['gh','api','--allow-escape-sequences','repos/mekhovov/revealline/actions/artifacts/'+str(AID)+'/zip'],stdout=f,stderr=subprocess.PIPE,env=env)
 f.flush();os.fsync(f.fileno())
put(ROOT/'download-terminal.json',(json.dumps({'exitCode':result.returncode,'stderr':result.stderr.decode(),'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n').encode());assert result.returncode==0
b=partial.read_bytes();assert len(b)==meta['size_in_bytes'] and 'sha256:'+sha(b)==meta['digest'];archive=ROOT/'github-artifact.zip';partial.rename(archive)
rows=[]
with zipfile.ZipFile(archive) as outer:
 inventory(outer,512*1024**2)
 checks=json.loads(outer.read('optional-checksums.json'))
 for row in checks['files']:
  x=outer.read(row['path']);assert len(x)==row['bytes'] and sha(x)==row['sha256']
 envelope=json.loads(outer.read('optional-packages.json'));verification=json.loads(outer.read('optional-candidate-verification.json'));tree=api('git/commits/'+HEAD)['tree']['sha']
 assert envelope['sourceRevision']==verification['sourceRevision']==HEAD and envelope['sourceTree']==verification['sourceTree']==tree
 assert verification['reproducibleBuilds']==2 and verification['committedInputsVerified'] and not verification['publicEligible']
 assert {x['id']for x in envelope['packages']}=={'civilian-flight','civilian-fpv','fpv-worlds'}
 for item in envelope['packages']:
  ident=item['id'];manifest=json.loads(outer.read('manifest-optional-'+ident+'.json'));inv=json.loads(outer.read('source-inventory-optional-'+ident+'.json'))
  assert manifest['engineCommit']==inv['sourceRevision']==HEAD and manifest['engineTree']==inv['sourceTree']==tree and manifest['revision']==inv['packageRevision']==item['revision']
  for kind,table,metadata in [('distribution',manifest,'optional-package.json'),('source',inv,'source-inventory.json')]:
   name=kind+'-optional-'+ident+'.zip';raw=outer.read(name)
   with zipfile.ZipFile(io.BytesIO(raw)) as z:
    actual=inventory(z,128*1024**2);expected={f['path']for f in table['files']}|{metadata}
    assert len(actual)==len(expected) and set(z.namelist())==expected
    for f in table['files']:
     data=z.read(f['path']);assert len(data)==f['bytes'] and sha(data)==f['sha256'],(name,f['path'])
    assert json.loads(z.read(metadata))==table
    total=sum(x.file_size for x in actual);assert total<=manifest['limits']['bytes'] and len(actual)<=manifest['limits']['files']
    rows.append({'id':ident,'kind':kind,'verifiedMembers':len(actual),'uncompressedBytes':total,'limits':manifest['limits'],'archiveBytes':len(raw),'archiveSHA256':sha(raw)})
   put(ROOT/name,raw)
 for item in outer.infolist():
  if not item.filename.endswith('.zip'):put(ROOT/item.filename,outer.read(item))
validator=ROOT/'validator'
for name in ['publishing/edition-zip.mjs','publishing/optional-module-closure.mjs','publishing/optional-package-policy.mjs','publishing/vendor/acorn-8.18.0.mjs']:put(validator/name,source(name))
program="import {readFile,writeFile} from 'node:fs/promises';import {readEditionZip} from './publishing/edition-zip.mjs';import {validateOptionalModuleClosure} from './publishing/optional-module-closure.mjs';import {OPTIONAL_PACKAGE_POLICIES} from './publishing/optional-package-policy.mjs';const root=process.argv[2],rows=[];for(const id of ['civilian-flight','civilian-fpv','fpv-worlds']){const files=readEditionZip(await readFile(root+'/distribution-optional-'+id+'.zip'));rows.push({id,...validateOptionalModuleClosure(files,OPTIONAL_PACKAGE_POLICIES[id])});}await writeFile(root+'/archive-import-closure-receipt.json',JSON.stringify({validatorSource:'"+HEAD+"',packages:rows,scope:'Finished original archive imports only; no checkout source fallback or execution'},null,2)+'\\n',{flag:'wx'});console.log(JSON.stringify(rows));"
put(validator/'verify.mjs',program.encode());run=subprocess.run(['node',str(validator/'verify.mjs'),str(ROOT)],capture_output=True,env=env);put(ROOT/'import-closure.log',run.stdout+run.stderr);assert run.returncode==0,'closure failure retained'
receipt={'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRevision':HEAD,'sourceTree':tree,'run':RUN,'artifactId':AID,'archiveBytes':meta['size_in_bytes'],'archiveSHA256':sha(b),'topLevelChecksums':len(checks['files']),'archives':rows,'moduleClosure':json.loads((ROOT/'archive-import-closure-receipt.json').read_text()),'scope':'Exact optional original artifact, all six original source/runtime inventories and member hashes/budgets, finished import closures. No native/player/public acceptance. Combined source uses mainfb3; newer3e/d8 integration remains separate.'}
put(ROOT/'qualification-original-members-and-closure.json',(json.dumps(receipt,indent=2)+'\n').encode());print(json.dumps({'root':str(ROOT),'receipt':receipt},indent=2))
