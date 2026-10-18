from pathlib import Path, PurePosixPath
import subprocess,json,zipfile,hashlib,base64,os,datetime,re
N=Path(__file__).resolve().parent;P=json.loads((N/'qualification-plan.json').read_text());HEAD=P['head'];TREE=P['tree'];RUN=P['run'];ROOT=Path(P['externalRoot']);STAGE=ROOT/'functional-family-label-check';sha=lambda b:hashlib.sha256(b).hexdigest()
assert os.environ['FPV_APPROVED_PLAN_SHA256']==sha((N/'qualification-plan.json').read_bytes())
def put(p,b):
 p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('xb')as f:f.write(b);f.flush();os.fsync(f.fileno())
def source(path):
 pin=P['sourcePins'][path];p=Path(pin['local']);assert p.parent==N/'source-inputs' and not p.is_symlink()
 b=p.read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['sha256']
 assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==pin['gitBlob']
 assert pin['canonicalSourceRevision']==HEAD
 return b
s=os.statvfs(ROOT);assert s.f_bavail*s.f_frsize>=3*1024**3+128*1024**2
accepted=json.loads((ROOT/'qualification-original-members-and-closure.json').read_text());assert accepted['sourceRevision']==HEAD and accepted['sourceTree']==TREE and accepted['run']==RUN
archive=ROOT/'distribution-optional-fpv-worlds.zip';expected=next(x for x in accepted['archives']if x['id']=='fpv-worlds'and x['kind']=='distribution');assert sha(archive.read_bytes())==expected['archiveSHA256']
STAGE.mkdir(exist_ok=False)
with zipfile.ZipFile(archive)as z:
 assert expected['limits']=={'files':210,'bytes':20*1024**2}
 assert 0<len(z.infolist())==expected['verifiedMembers']<=expected['limits']['files']
 assert sum(x.file_size for x in z.infolist())==expected['uncompressedBytes']<=expected['limits']['bytes']
 for item in z.infolist():
  p=PurePosixPath(item.filename);assert not p.is_absolute()and'..'not in p.parts and not item.is_dir();put(STAGE/item.filename,z.read(item))
files=['game/test/fpv-regional-library-families.test.mjs','game/test/fpv-regional-library-labels.test.mjs','game/test/helpers/couch-dom.mjs','game/test/fixtures/fpv-regional-labels-metadata.json'];pins=[]
for f in files:
 b=source(f);put(STAGE/f,b);pins.append({'path':f,'bytes':len(b),'SHA256':sha(b)})
assert (STAGE/'game/vendor/i18next-26.4.2.min.js').is_file()
put(STAGE/'fixture-node-prelude.mjs',b"import i18next from './game/vendor/i18next-26.4.2.min.js';\nglobalThis.i18next=i18next;\n")
command=[P['node'],'--import',str(STAGE/'fixture-node-prelude.mjs'),'--test',str(STAGE/files[0]),str(STAGE/files[1])];env={**os.environ,'TMPDIR':str(ROOT),'TMP':str(ROOT),'TEMP':str(ROOT)}
r=subprocess.run(command,capture_output=True,env=env);log=r.stdout+r.stderr;put(ROOT/'packaged-family-label-checks.tap',log)
summary={k:int(re.findall(r'^# '+k+r' (\d+)$',log.decode(),re.M)[-1])for k in['tests','pass','fail','cancelled','skipped','todo']}
unchanged=True
with zipfile.ZipFile(archive)as z:
 for item in z.infolist():assert (STAGE/item.filename).read_bytes()==z.read(item)
receipt={'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRevision':HEAD,'sourceTree':accepted['sourceTree'],'run':RUN,'artifactId':accepted['artifactId'],'runtimeArchiveSHA256':expected['archiveSHA256'],'tests':pins,'command':command,'actualExitCode':r.returncode,'summary':summary,'logSHA256':sha(log),'runtimeBytesUnchanged':True,'runtimeVerifiedMembers':expected['verifiedMembers'],'runtimeDecodedBytes':expected['uncompressedBytes'],'committedRuntimeLimits':expected['limits'],'hostSetup':'Shipped i18next engine loaded before generated bootstrap; original package modules and exact source tests unchanged.','scope':'Packaged family/label software tests using isolated deterministic DOM and metadata callbacks; no database, rendering, flight, native input, storage repair or public claim.'}
put(ROOT/'packaged-family-label-receipt.json',(json.dumps(receipt,indent=2)+'\n').encode());print(json.dumps(receipt,indent=2));assert r.returncode==0 and summary=={'tests':24,'pass':24,'fail':0,'cancelled':0,'skipped':0,'todo':0}
