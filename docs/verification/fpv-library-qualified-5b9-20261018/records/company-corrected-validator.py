from pathlib import Path, PurePosixPath
import os,sys,json,hashlib,zipfile,io,datetime,stat
D=Path(__file__).resolve().parent
P=json.loads((D/'company-correction-plan.json').read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
def put(path,body):
 with path.open('xb') as f:f.write(body);f.flush();os.fsync(f.fileno())
def load_input(name):
 pin=P['inputs'][name];path=Path(pin['path'])
 assert path.parent==D/'inputs' and not path.is_symlink()
 body=path.read_bytes();assert len(body)==pin['bytes'] and sha(body)==pin['sha256'],name
 return body
def inventory(z,cap):
 rows=z.infolist()
 assert len(rows)==len({x.filename for x in rows}) and len(rows)<=10000
 assert sum(x.file_size for x in rows)<=cap
 for x in rows:
  p=PurePosixPath(x.filename)
  assert not p.is_absolute() and '..' not in p.parts and not x.is_dir()
  assert ((x.external_attr>>16)&0o170000)!=0o120000 and not(x.flag_bits&1)
 return rows
def state(p):
 s=p.stat()
 return (s.st_dev,s.st_ino,s.st_mode,s.st_size,s.st_mtime_ns)
HEAD=P['head'];TREE=P['tree'];RUN=P['run']
for key in ['TMPDIR','TMP','TEMP']:assert os.environ[key]==str(D)
s=os.statvfs(D);free=s.f_bavail*s.f_frsize
assert free>=P['externalReserveBytes']+P['remainingAllowanceBytes']
# Existing small pinned sources/negative receipts are consumed, never regenerated.
for name in P['inputs']:load_input(name)
meta=json.loads(load_input('github-company-artifact-metadata.json'))
assert meta['id']==12119292608 and meta['size_in_bytes']==78427399
assert meta['workflow_run']['head_sha']==HEAD and meta['workflow_run']['id']==RUN
assert meta['name']=='company-candidate-'+HEAD
assert meta['digest']=='sha256:528c1748e2105086c022cb33f2046cc4cd0d1315474423ac767dd800571d00fc'
assert json.loads(load_input('company-download-terminal.json'))['exitCode']==0
cloud=json.loads(load_input('completed-candidate-cloud-state.json'))
assert cloud['job']=='candidate' and cloud['jobStatus']==cloud['runStatus']=='completed'
assert cloud['jobConclusion']==cloud['runConclusion']=='success'
identity=json.loads(load_input('canonical-source-identity.json'))
assert identity['head']==HEAD and identity['tree']==TREE and identity['canonicalRefParentsTreeVerified']
assert json.loads(load_input('original-company-terminal.json'))['actualExitCode']==1
assert json.loads(load_input('original-controller-terminal.json'))['exitCode']==1
optional=json.loads(load_input('optional-accepted-receipt.json'))
ot=json.loads(load_input('optional-actual-terminal.json'))
assert ot['actualExitCode']==0 and ot['receipt']['SHA256']==P['inputs']['optional-accepted-receipt.json']['sha256']
assert optional['sourceRevision']==HEAD and optional['sourceTree']==TREE and optional['run']==RUN
proofs=optional['newAircraftModuleIdentities'];assert len(proofs)==8
assert {(r['package'],r['role'],r['path']) for r in proofs}=={
 (package,role,module) for package in ['civilian-fpv','fpv-worlds']
 for role in ['distribution','source'] for module in P['separatelyAcceptedOptionalModules']}
for row in proofs:
 assert {k:row[k] for k in ['bytes','sha256','gitBlob']}==P['separatelyAcceptedOptionalModules'][row['path']]
policy=load_input('source-package-budget.mjs')
assert sha(policy)=='0b8191091e2868194ab372aca3c5d130f9b61c18db9711062fb418869138262e'
assert b'maxFiles: 2000' in policy and b'maxBytes: 80 * 1024 * 1024' in policy
archive=Path(P['existingOriginalArchive']['path'])
assert archive.parent==D.parent and not archive.is_symlink() and stat.S_ISREG(archive.stat().st_mode)
before=state(archive);assert before[3]==meta['size_in_bytes']
raw=archive.read_bytes()
assert len(raw)==meta['size_in_bytes'] and 'sha256:'+sha(raw)==meta['digest']
receipts=[];positive_proofs=[]
with zipfile.ZipFile(io.BytesIO(raw)) as z:
 outer=inventory(z,1024**3)
 assert {x.filename for x in outer}==set(P['outerMembers'])
 checks=json.loads(z.read('checksums.json'))
 checkpaths=[r['path'] for r in checks['files']]
 assert len(checkpaths)==len(set(checkpaths))==7
 assert set(checkpaths)==set(P['outerMembers'])-{'checksums.json'}
 # Reading every declared member verifies its ZIP CRC, length and SHA.
 for row in checks['files']:
  body=z.read(row['path']);assert len(body)==row['bytes'] and sha(body)==row['sha256']
 for name,pin in P['namedMetadataPins'].items():
  body=z.read(name);assert len(body)==pin['bytes'] and sha(body)==pin['sha256']
 verification=json.loads(z.read('candidate-verification.json'));envelope=json.loads(z.read('editions.json'))
 assert verification['sourceRevision']==envelope['sourceRevision']==HEAD
 assert verification['sourceTree']==envelope['sourceTree']==TREE
 assert verification['version']==envelope['version']=='v0.151.1'
 assert verification['reproducibleBuilds']==2 and not verification['publicEligible']
 assert sha(z.read('editions.json'))==verification['envelopeSha256']
 assert len(envelope['editions'])==1 and envelope['editions'][0]['id']=='fpv-learning'
 edition=envelope['editions'][0];admission=verification['admission']
 assert admission['sourceRevision']==HEAD and admission['sourceTree']==TREE
 assert admission['status']=='verified-candidate-members' and admission['zipMembersVerified'] is True
 assert admission['publicEligible'] is False and len(admission['editions'])==1
 assert admission['editions'][0]['id']=='fpv-learning'
 roles=[('runtime','distribution','manifest','edition-manifest.json'),('source','sourceArchive','sourceInventory','source-inventory.json')]
 for role,archiveKey,tableKey,embedded in roles:
  archivePin=edition[archiveKey];tablePin=edition[tableKey]
  body=z.read(archivePin['path']);tableBody=z.read(tablePin['path'])
  assert len(body)==archivePin['bytes'] and sha(body)==archivePin['sha256']
  assert len(tableBody)==tablePin['bytes'] and sha(tableBody)==tablePin['sha256']
  table=json.loads(tableBody)
  assert table['sourceRevision']==HEAD and table['sourceTree']==TREE
  assert table['editionId']=='fpv-learning' and table['version']=='v0.151.1'
  if role=='runtime':assert table['entry']=='game/company.html'
  with zipfile.ZipFile(io.BytesIO(body)) as q:
   actual=inventory(q,512*1024**2)
   paths=[f['path'] for f in table['files']];expected=set(paths)
   assert len(paths)==len(expected)==1140
   assert len(actual)==len(expected)+1 and expected<=set(q.namelist())
   extra=set(q.namelist())-expected;assert len(extra)==1
   embeddedName=next(iter(extra))
   assert embeddedName in [embedded,'company-manifest.json','manifest.json','source-inventory.json']
   assert json.loads(q.read(embeddedName))==table
   for f in table['files']:
    value=q.read(f['path'])
    assert len(value)==f['bytes'] and sha(value)==f['sha256'],(role,f['path'])
   assert sum(f['bytes'] for f in table['files'])==table['totalBytes']
   projected={f['path']:f for f in table['files']}
   for pin in P['namedMetadataPins'][tablePin['path']]['positiveProjectedRows']:
    assert projected[pin['path']]==pin
    # Hashes above are actual packaged/projected bytes, never raw-source SHA.
    positive_proofs.append({'role':role,**pin})
   total=sum(x.file_size for x in actual)
   if role=='runtime':
    assert len(actual)<=2000 and total<=80*1024**2 and total<=72*1024**2
   receipts.append({'role':role,'files':len(actual),'contentBytesIncludingMetadata':total,
    'archiveBytes':len(body),'archiveSHA256':sha(body),'embeddedMetadata':embeddedName,
    'allDeclaredMemberHashesAndCRC':True,'exactInventory':True})
assert len(positive_proofs)==10 and state(archive)==before
receipt={'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'status':'PASS_CORRECTED_COMPANY_SCOPE_ORIGINAL_ARCHIVE_ONLY',
 'sourceRevision':HEAD,'sourceTree':TREE,'run':RUN,'artifactId':meta['id'],
 'githubArtifactBytes':len(raw),'githubArtifactSHA256':sha(raw),'artifactExpiresAt':meta['expires_at'],
 'topLevelChecksums':len(checks['files']),'allMemberHashes':True,'archives':receipts,
 'positiveCompanyProjectedIdentities':positive_proofs,
 'separateOptionalEightProofs':{'receiptSHA256':P['inputs']['optional-accepted-receipt.json']['sha256'],
 'terminalSHA256':P['inputs']['optional-actual-terminal.json']['sha256'],
 'scope':'Reused already accepted eight optional module identities only; no optional archive replay'},
 'originalCompanyFailurePreserved':{'terminalSHA256':P['inputs']['original-company-terminal.json']['sha256'],
 'stderrSHA256':P['inputs']['original-company.stderr.log']['sha256']},
 'existingCompanyRuntimeLimits':{'files':2000,'bytes':80*1024**2,'policySHA256':sha(policy)},
 'runtimeAlsoUnder72MiB':True,'cloudReproducibleBuilds':2,'publicEligible':False,
 'externalAvailableBytesAtStart':free,
 'scope':'One corrected Company-only validation of existing original runtime/source archives. No GET, build, extraction, controller restart, optional replay, product mutation, native/player/public or later-main acceptance. Source inventory uses projected hashes and is not assigned runtime budget.'}
put(D/'actual-once'/'company-corrected-original-members-receipt.json',(json.dumps(receipt,indent=2)+'\n').encode())
print(json.dumps(receipt,indent=2))
