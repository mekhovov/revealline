from pathlib import Path,PurePosixPath
import subprocess,json,hashlib,zipfile,io,base64,os,datetime
HEAD='53338dc73469f866e9289b2b5f74555c68e8231e';RUN=39081155120;ROOT=Path('[STORAGE_5333_EXTERNAL_STAGE]');sha=lambda b:hashlib.sha256(b).hexdigest()
def api(p):return json.loads(subprocess.check_output(['gh','api','repos/mekhovov/revealline/'+p]))
def put(p,b):
 with p.open('xb')as f:f.write(b);f.flush();os.fsync(f.fileno())
def inventory(z,cap):
 rows=z.infolist();assert len(rows)==len({x.filename for x in rows})and len(rows)<=10000 and sum(x.file_size for x in rows)<=cap
 for x in rows:
  p=PurePosixPath(x.filename);assert not p.is_absolute()and'..'not in p.parts and not x.is_dir()and((x.external_attr>>16)&0o170000)!=0o120000 and not(x.flag_bits&1)
 return rows
run=api('actions/runs/'+str(RUN));assert run['event']=='workflow_dispatch' and run['path']=='.github/workflows/company-edition-candidate.yml';assert run['head_sha']==HEAD and run['conclusion']=='success'
jobs=api('actions/runs/'+str(RUN)+'/jobs')['jobs'];assert next(x for x in jobs if x['name']=='candidate')['conclusion']=='success'
rows=api('actions/runs/'+str(RUN)+'/artifacts')['artifacts'];selected=[x for x in rows if x['name']=='company-candidate-'+HEAD and not x['expired']];assert len(selected)==1
meta=api('actions/artifacts/'+str(selected[0]['id']));assert meta['workflow_run']['head_sha']==HEAD and meta['workflow_run']['id']==RUN and 0<meta['size_in_bytes']<256*1024**2 and meta['name']=='company-candidate-'+HEAD and not meta['expired'] and isinstance(meta['digest'],str) and len(meta['digest'])==71 and meta['digest'].startswith('sha256:')
s=os.statvfs(ROOT);free=s.f_bavail*s.f_frsize;assert free>=3*1024**3+1024**3
put(ROOT/'github-company-artifact-metadata.json',(json.dumps(meta,indent=2)+'\n').encode());put(ROOT/'company-start.json',(json.dumps({'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':HEAD,'run':RUN,'externalFreeBytes':free},indent=2)+'\n').encode())
partial=ROOT/'github-company-artifact.downloading';env={**os.environ,'TMPDIR':str(ROOT),'TMP':str(ROOT),'TEMP':str(ROOT)}
with partial.open('xb')as f:
 r=subprocess.run(['gh','api','--allow-escape-sequences','repos/mekhovov/revealline/actions/artifacts/'+str(meta['id'])+'/zip'],stdout=f,stderr=subprocess.PIPE,env=env);f.flush();os.fsync(f.fileno())
put(ROOT/'company-download-terminal.json',(json.dumps({'exitCode':r.returncode,'stderr':r.stderr.decode(),'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n').encode());assert r.returncode==0
NEW_MODULES={'optional-practice/civilian-fpv/aircraft-appearance.mjs': {'bytes': 1018, 'sha256': 'eac3ae9df81f7fc4f96da3dc55023797895034e096b02ba62a480a2efb3ae09e', 'gitBlob': '74b2be0436d3aaec04ef1707e4c95f5ac4f1040b'}, 'optional-practice/civilian-fpv/aircraft-preview.mjs': {'bytes': 7063, 'sha256': '07ac999bc60dcef1a23a4a1a905d6e322c4c522aeeae466110b416bdc2a0a27c', 'gitBlob': 'f5aa83735433d1bee11649dc9d75920e658fc87a'}}
new_module_proofs=[]
raw=partial.read_bytes();assert len(raw)==meta['size_in_bytes']and'sha256:'+sha(raw)==meta['digest'];archive=ROOT/'company-original-artifact.zip';partial.rename(archive);receipts=[]
with zipfile.ZipFile(archive)as z:
 inventory(z,1024**3);checks=json.loads(z.read('checksums.json'));declared=[r['path'] for r in checks['files']];assert len(declared)==len(set(declared)) and set(z.namelist())==set(declared)|{'checksums.json'}
 for row in checks['files']:
  b=z.read(row['path']);assert len(b)==row['bytes']and sha(b)==row['sha256']
 verification=json.loads(z.read('candidate-verification.json'));envelope=json.loads(z.read('editions.json'));tree=api('git/commits/'+HEAD)['tree']['sha'];assert tree=='7b1cb82c32146448ef4d6b6710233a73b88f74f4'
 assert verification['sourceRevision']==envelope['sourceRevision']==HEAD and verification['sourceTree']==envelope['sourceTree']==tree
 assert verification['reproducibleBuilds']==2 and not verification['publicEligible'];assert {i['id'] for i in envelope['editions']}=={'fpv-learning'}
 for role,archiveName,tableName,embedded in [('runtime','distribution-fpv-learning.zip','manifest-fpv-learning.json','edition-manifest.json'),('source','source-fpv-learning.zip','source-inventory-fpv-learning.json','source-inventory.json')]:
  b=z.read(archiveName);table=json.loads(z.read(tableName));assert table['sourceRevision']==HEAD and table['sourceTree']==tree
  with zipfile.ZipFile(io.BytesIO(b))as q:
   actual=inventory(q,512*1024**2);expected={f['path']for f in table['files']};extra=set(q.namelist())-expected
   assert len(extra)==1 and len(actual)==len(expected)+1
   embeddedName=next(iter(extra));assert embeddedName in[embedded,'company-manifest.json','manifest.json','source-inventory.json']and json.loads(q.read(embeddedName))==table
   for f in table['files']:
    v=q.read(f['path']);assert len(v)==f['bytes']and sha(v)==f['sha256']
   for module,pin in NEW_MODULES.items():
    assert module in expected
    body=q.read(module);blob=hashlib.sha1(b'blob '+str(len(body)).encode()+b'\0'+body).hexdigest()
    assert len(body)==pin['bytes'] and sha(body)==pin['sha256'] and blob==pin['gitBlob'],(role,module)
    new_module_proofs.append({'role':role,'path':module,**pin})
   total=sum(x.file_size for x in actual)
   if role=='runtime':assert len(actual)<=2000 and total<=80*1024**2 and total<=72*1024**2
   receipts.append({'role':role,'files':len(actual),'contentBytesIncludingMetadata':total,'archiveBytes':len(b),'archiveSHA256':sha(b)})
 for n in z.namelist():
  if not n.endswith('.zip'):put(ROOT/('company-'+n),z.read(n))
assert len(new_module_proofs)==4
p='game/editions/package-budget.mjs';d=api('contents/'+p+'?ref='+HEAD);policy=base64.b64decode(d['content']);assert len(policy)==d['size']and hashlib.sha1(b'blob '+str(len(policy)).encode()+b'\0'+policy).hexdigest()==d['sha'];put(ROOT/'company-package-budget-source.mjs',policy)
assert sha(policy)=='0b8191091e2868194ab372aca3c5d130f9b61c18db9711062fb418869138262e'
assert b'maxFiles: 2000'in policy and b'maxBytes: 80 * 1024 * 1024'in policy
receipt={'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRevision':HEAD,'sourceTree':tree,'run':RUN,'artifactId':meta['id'],'githubArtifactBytes':len(raw),'githubArtifactSHA256':sha(raw),'topLevelChecksums':len(checks['files']),'allMemberHashes':True,'archives':receipts,'newAircraftModuleIdentities':new_module_proofs,'existingCompanyRuntimeLimits':{'files':2000,'bytes':80*1024**2,'policySHA256':sha(policy),'gitBlob':d['sha']},'runtimeAlsoUnder72MiB':True,'cloudReproducibleBuilds':2,'publicEligible':False,'scope':'Current exact 53338dc7 original Company runtime/source member sets,lengths,hashes and unchanged existing runtime budget. Source inventory separately hashed, not assigned runtime budget. No native/player/public/later-main integration acceptance. Optional originals have their own receipt.'}
put(ROOT/'company-original-members-receipt.json',(json.dumps(receipt,indent=2)+'\n').encode());print(json.dumps(receipt,indent=2))
