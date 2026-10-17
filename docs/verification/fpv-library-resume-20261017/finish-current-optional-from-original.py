from pathlib import Path
import json,subprocess,zipfile,io,hashlib,base64,os,datetime
HEAD='9e97eeb7c192f6d6252b99dcd83e1718e1c78d35';ROOT=Path('/Volumes/alex/CodexMigrationStaging/fpv-package-qualification-20261014/regional-family-library-9e97eeb7-resume-20261017');sha=lambda b:hashlib.sha256(b).hexdigest()
def put(p,b):
 with p.open('xb') as f:f.write(b);f.flush();os.fsync(f.fileno())
def api(p):return json.loads(subprocess.check_output(['gh','api','repos/mekhovov/revealline/'+p]))
s=os.statvfs(ROOT);assert s.f_bavail*s.f_frsize>=3*1024**3+512*1024**2
negative={'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'session':62065,'actualExitCode':1,'helperSHA256':sha(Path('/tmp/fpv-library-resume-20261017/qualify-current-optional.py').read_bytes()),'logSHA256':sha((ROOT/'import-closure.log').read_bytes()),'failure':'Validator bootstrap ERR_MODULE_NOT_FOUND for exact-head optional-import-capabilities.mjs. No finished closure result produced. Original download and archives retained.','remainingVerificationUsesSameDownloadedOriginal':True,'newGET':False}
put(ROOT/'initial-qualification-negative.json',(json.dumps(negative,indent=2)+'\n').encode())
d=api('contents/publishing/optional-import-capabilities.mjs?ref='+HEAD);b=base64.b64decode(d['content']);assert len(b)==d['size'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==d['sha'];put(ROOT/'validator/publishing/optional-import-capabilities.mjs',b)
meta=json.loads((ROOT/'github-artifact-metadata.json').read_text());artifact=(ROOT/'github-artifact.zip').read_bytes();assert len(artifact)==meta['size_in_bytes'] and 'sha256:'+sha(artifact)==meta['digest']
rows=[]
with zipfile.ZipFile(io.BytesIO(artifact)) as outer:
 envelope=json.loads(outer.read('optional-packages.json'));verification=json.loads(outer.read('optional-candidate-verification.json'));checks=json.loads(outer.read('optional-checksums.json'))
 assert envelope['sourceRevision']==verification['sourceRevision']==HEAD and verification['committedInputsVerified'] and verification['reproducibleBuilds']==2 and not verification['publicEligible']
 for row in checks['files']:
  raw=outer.read(row['path']);assert len(raw)==row['bytes'] and sha(raw)==row['sha256']
 for item in envelope['packages']:
  ident=item['id'];manifest=json.loads(outer.read('manifest-optional-'+ident+'.json'));inventory=json.loads(outer.read('source-inventory-optional-'+ident+'.json'))
  assert manifest['engineCommit']==inventory['sourceRevision']==HEAD and manifest['engineTree']==inventory['sourceTree']==envelope['sourceTree'] and manifest['revision']==inventory['packageRevision']==item['revision']
  for kind,table,embedded in [('distribution',manifest,'optional-package.json'),('source',inventory,'source-inventory.json')]:
   name=kind+'-optional-'+ident+'.zip';raw=outer.read(name);assert (ROOT/name).read_bytes()==raw
   with zipfile.ZipFile(io.BytesIO(raw)) as z:
    expected={f['path']for f in table['files']}|{embedded};assert len(z.namelist())==len(expected) and set(z.namelist())==expected
    for f in table['files']:
     data=z.read(f['path']);assert len(data)==f['bytes'] and sha(data)==f['sha256']
    assert json.loads(z.read(embedded))==table
    total=sum(x.file_size for x in z.infolist());assert total<=manifest['limits']['bytes'] and len(expected)<=manifest['limits']['files']
    rows.append({'id':ident,'kind':kind,'verifiedMembers':len(expected),'uncompressedBytes':total,'limits':manifest['limits'],'archiveBytes':len(raw),'archiveSHA256':sha(raw)})
env={**os.environ,'TMPDIR':str(ROOT),'TMP':str(ROOT),'TEMP':str(ROOT)}
r=subprocess.run(['node',str(ROOT/'validator/verify.mjs'),str(ROOT)],capture_output=True,env=env);put(ROOT/'import-closure-completed.log',r.stdout+r.stderr);assert r.returncode==0,'closure result failure retained'
receipt={'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRevision':HEAD,'sourceTree':envelope['sourceTree'],'run':39045136739,'artifactId':meta['id'],'archiveBytes':meta['size_in_bytes'],'archiveSHA256':sha(artifact),'topLevelChecksums':len(checks['files']),'archives':rows,'moduleClosure':json.loads((ROOT/'archive-import-closure-receipt.json').read_text()),'validatorDependencyAddition':{'path':'publishing/optional-import-capabilities.mjs','bytes':len(b),'SHA256':sha(b),'gitBlob':d['sha']},'preservedInitialNegativeSHA256':sha((ROOT/'initial-qualification-negative.json').read_bytes()),'scope':'Exact9e97 original optional artifact, six original inventories/member hashes/budgets, three finished import closures. Uses one existing downloaded original; no second GET/build. No packaged functional/native/public acceptance. Latest main integration remains separate.'}
put(ROOT/'qualification-original-members-and-closure.json',(json.dumps(receipt,indent=2)+'\n').encode());print(json.dumps(receipt,indent=2))
