from pathlib import Path,PurePosixPath
import subprocess,json,hashlib,zipfile,io,os,datetime
N=Path(__file__).resolve().parent;P=json.loads((N/'qualification-plan.json').read_text());HEAD=P['head'];TREE=P['tree'];RUN=P['run'];ROOT=Path(P['externalRoot'])
sha=lambda b:hashlib.sha256(b).hexdigest()
assert os.environ['FPV_APPROVED_PLAN_SHA256']==sha((N/'qualification-plan.json').read_bytes())
def api(p):return json.loads(subprocess.check_output(['/opt/homebrew/bin/gh','api','repos/mekhovov/revealline/'+p],cwd='/'))
def put(p,b):
 with p.open('xb')as f:f.write(b);f.flush();os.fsync(f.fileno())
def inventory(z,cap):
 rows=z.infolist();assert len(rows)==len({x.filename for x in rows}) and len(rows)<=10000 and sum(x.file_size for x in rows)<=cap
 for x in rows:
  p=PurePosixPath(x.filename);assert x.filename and not p.is_absolute() and '..'not in p.parts and '\\'not in x.filename and not x.is_dir() and ((x.external_attr>>16)&0o170000)!=0o120000 and not(x.flag_bits&1)
 return rows
def source(path):
 pin=P['sourcePins'][path];p=Path(pin['local']);assert p.parent==N/'source-inputs' and not p.is_symlink()
 b=p.read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['sha256'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==pin['gitBlob']
 assert pin['canonicalSourceRevision']==HEAD
 return b
run=api('actions/runs/'+str(RUN));assert run['head_sha']==HEAD and run['event']=='workflow_dispatch' and run['path']=='.github/workflows/company-edition-candidate.yml' and run['conclusion']=='success'
assert api('git/commits/'+HEAD)['tree']['sha']==TREE
jobs=api('actions/runs/'+str(RUN)+'/jobs')['jobs'];job=next(x for x in jobs if x['name']=='candidate');assert job['conclusion']=='success'
rows=api('actions/runs/'+str(RUN)+'/artifacts')['artifacts'];selected=[x for x in rows if x['name']=='company-candidate-'+HEAD and not x['expired']];assert len(selected)==1
meta=api('actions/artifacts/'+str(selected[0]['id']));assert meta['workflow_run']['head_sha']==HEAD and meta['workflow_run']['id']==RUN and not meta['expired']
assert meta['name']=='company-candidate-'+HEAD and 0<meta['size_in_bytes']<=256*1024**2 and isinstance(meta['digest'],str) and len(meta['digest'])==71 and meta['digest'].startswith('sha256:')
s=os.statvfs(ROOT);free=s.f_bavail*s.f_frsize;assert free>=3*1024**3+1024**3
optional=json.loads((ROOT/'qualification-original-members-and-closure.json').read_text())
assert optional['sourceRevision']==HEAD and optional['sourceTree']==TREE and optional['run']==RUN
assert len(optional['newAircraftModuleIdentities'])==8 and len(optional['newTuningModuleIdentities'])==38
optionalTerminal=json.loads((N/'actual-once'/'optional-terminal.json').read_text())
assert optionalTerminal['actualExitCode']==0 and optionalTerminal['receipt']['SHA256']==sha((ROOT/'qualification-original-members-and-closure.json').read_bytes())
policy=source('game/editions/package-budget.mjs')
assert sha(policy)=='0b8191091e2868194ab372aca3c5d130f9b61c18db9711062fb418869138262e'
assert b'maxFiles: 2000'in policy and b'maxBytes: 80 * 1024 * 1024'in policy
put(ROOT/'github-company-artifact-metadata.json',(json.dumps(meta,indent=2)+'\n').encode())
put(ROOT/'company-start.json',(json.dumps({'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':HEAD,'tree':TREE,'run':RUN,'externalFreeBytes':free},indent=2)+'\n').encode())
partial=ROOT/'github-company-artifact.downloading';env={**os.environ,'TMPDIR':str(ROOT),'TMP':str(ROOT),'TEMP':str(ROOT)}
with partial.open('xb')as f:
 r=subprocess.run(['/opt/homebrew/bin/gh','api','--allow-escape-sequences','repos/mekhovov/revealline/actions/artifacts/'+str(meta['id'])+'/zip'],stdout=f,stderr=subprocess.PIPE,env=env,cwd='/');f.flush();os.fsync(f.fileno())
put(ROOT/'company-download-terminal.json',(json.dumps({'exitCode':r.returncode,'stderr':r.stderr.decode(),'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n').encode());assert r.returncode==0
raw=partial.read_bytes();assert len(raw)==meta['size_in_bytes'] and 'sha256:'+sha(raw)==meta['digest'];archive=ROOT/'company-original-artifact.zip';partial.rename(archive)
receipts=[];positive=[]
with zipfile.ZipFile(io.BytesIO(raw))as z:
 outer=inventory(z,1024**3);checks=json.loads(z.read('checksums.json'));paths=[x['path']for x in checks['files']]
 assert len(paths)==len(set(paths))==7 and set(z.namelist())==set(paths)|{'checksums.json'}
 for row in checks['files']:
  b=z.read(row['path']);assert len(b)==row['bytes'] and sha(b)==row['sha256']
 verification=json.loads(z.read('candidate-verification.json'));envelope=json.loads(z.read('editions.json'))
 assert verification['sourceRevision']==envelope['sourceRevision']==HEAD and verification['sourceTree']==envelope['sourceTree']==TREE
 assert verification['version']==envelope['version']==P['version']
 assert verification['reproducibleBuilds']==2 and not verification['publicEligible']
 assert sha(z.read('editions.json'))==verification['envelopeSha256']
 assert len(envelope['editions'])==1 and envelope['editions'][0]['id']=='fpv-learning'
 edition=envelope['editions'][0];admission=verification['admission']
 assert admission['sourceRevision']==HEAD and admission['sourceTree']==TREE
 assert admission['status']=='verified-candidate-members' and admission['zipMembersVerified'] is True and admission['publicEligible'] is False
 assert len(admission['editions'])==1 and admission['editions'][0]['id']=='fpv-learning'
 for role,archiveKey,tableKey,embedded in [('runtime','distribution','manifest','edition-manifest.json'),('source','sourceArchive','sourceInventory','source-inventory.json')]:
  archivePin=edition[archiveKey];tablePin=edition[tableKey];body=z.read(archivePin['path']);tableBody=z.read(tablePin['path'])
  assert len(body)==archivePin['bytes'] and sha(body)==archivePin['sha256']
  assert len(tableBody)==tablePin['bytes'] and sha(tableBody)==tablePin['sha256']
  table=json.loads(tableBody);assert table['sourceRevision']==HEAD and table['sourceTree']==TREE
  assert table['editionId']=='fpv-learning' and table['version']==P['version']
  if role=='runtime':assert table['entry']=='game/company.html'
  with zipfile.ZipFile(io.BytesIO(body))as q:
   actual=inventory(q,512*1024**2);paths=[f['path']for f in table['files']];expected=set(paths)
   assert len(paths)==len(expected) and len(actual)==len(expected)+1 and expected<=set(q.namelist())
   extra=set(q.namelist())-expected;assert len(extra)==1
   metadata=next(iter(extra));assert metadata in[embedded,'company-manifest.json','manifest.json','source-inventory.json'] and json.loads(q.read(metadata))==table
   for f in table['files']:
    value=q.read(f['path']);assert len(value)==f['bytes'] and sha(value)==f['sha256'],(role,f['path'])
   assert sum(f['bytes']for f in table['files'])==table['totalBytes']
   projected={f['path']:f for f in table['files']}
   for path in P['positiveCompanyPaths']:
    assert path in projected;positive.append({'role':role,**projected[path]})
   total=sum(x.file_size for x in actual)
   if role=='runtime':assert len(actual)<=2000 and total<=80*1024**2 and total<=72*1024**2
   receipts.append({'role':role,'files':len(actual),'declaredFiles':len(paths),'contentBytesIncludingMetadata':total,'archiveBytes':len(body),'archiveSHA256':sha(body),'embeddedMetadata':metadata,'allDeclaredMemberHashesAndCRC':True,'exactInventory':True})
 for name in z.namelist():
  if not name.endswith('.zip'):put(ROOT/('company-'+name),z.read(name))
assert len(positive)==10
receipt={'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRevision':HEAD,'sourceTree':TREE,'run':RUN,'event':'workflow_dispatch','artifactId':meta['id'],'githubArtifactBytes':len(raw),'githubArtifactSHA256':sha(raw),'artifactExpiresAt':meta['expires_at'],'topLevelChecksums':len(checks['files']),'allMemberHashes':True,'archives':receipts,'positiveCompanyProjectedIdentities':positive,'separateOptionalReceiptSHA256':sha((ROOT/'qualification-original-members-and-closure.json').read_bytes()),'separateOptionalProofCounts':{'aircraft':8,'tuning':38},'existingCompanyRuntimeLimits':{'files':2000,'bytes':80*1024**2,'policySHA256':sha(policy)},'runtimeAlsoUnder72MiB':True,'cloudReproducibleBuilds':2,'publicEligible':False,'cloudTestStepStates':[{'name':x['name'],'status':x['status'],'conclusion':x['conclusion']}for x in job.get('steps',[])],'scope':'Exact current Company original projected runtime/source inventories and CRC/hash/budgets. Positive Company entry/launcher/catalogue/panel identities use actual projected metadata, never raw source SHA. Optional aircraft/tuning identities remain separate. Old failed Company guard and all earlier records remain unchanged. No native/player/public or later-main acceptance.'}
put(ROOT/'company-original-members-receipt.json',(json.dumps(receipt,indent=2)+'\n').encode());print(json.dumps(receipt,indent=2))
