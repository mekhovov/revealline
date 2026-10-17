from pathlib import Path, PurePosixPath
import subprocess,json,zipfile,hashlib,base64,os,datetime,re
HEAD='a105e0fa4697930030fbb3afce3d6c0771d02d54';ROOT=Path('/Volumes/alex/CodexMigrationStaging/fpv-package-qualification-20261014/regional-family-library-a105e0fa-combined-20261017');STAGE=ROOT/'functional-family-label-check';sha=lambda b:hashlib.sha256(b).hexdigest()
def put(p,b):
 p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('xb')as f:f.write(b);f.flush();os.fsync(f.fileno())
def source(p):
 d=json.loads(subprocess.check_output(['gh','api','repos/mekhovov/revealline/contents/'+p+'?ref='+HEAD]));b=base64.b64decode(d['content']);assert len(b)==d['size'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==d['sha'];return b
s=os.statvfs(ROOT);assert s.f_bavail*s.f_frsize>=3*1024**3+128*1024**2
accepted=json.loads((ROOT/'qualification-original-members-and-closure.json').read_text());assert accepted['sourceRevision']==HEAD
archive=ROOT/'distribution-optional-fpv-worlds.zip';expected=next(x for x in accepted['archives']if x['id']=='fpv-worlds'and x['kind']=='distribution');assert sha(archive.read_bytes())==expected['archiveSHA256']
prior=json.loads((ROOT/'packaged-family-label-receipt.json').read_text());assert prior['sourceRevision']==HEAD and prior['actualExitCode']==0 and prior['summary']['pass']==24
assert STAGE.is_dir()
with zipfile.ZipFile(archive)as z:
 assert len(z.infolist())==178 and sum(x.file_size for x in z.infolist())<=20*1024**2
 for item in z.infolist():assert (STAGE/item.filename).read_bytes()==z.read(item)
files=['game/test/fpv-advanced-practice.test.mjs','game/test/helpers/couch-dom.mjs','game/test/helpers/wait-for.mjs'];pins=[]
for f in files:
 b=source(f)
 if (STAGE/f).exists():assert (STAGE/f).read_bytes()==b
 else:put(STAGE/f,b)
 pins.append({'path':f,'bytes':len(b),'SHA256':sha(b)})
assert (STAGE/'game/vendor/i18next-26.4.2.min.js').is_file()
assert (STAGE/'fixture-node-prelude.mjs').read_bytes()==b"import i18next from './game/vendor/i18next-26.4.2.min.js';\nglobalThis.i18next=i18next;\n"
command=['node','--import',str(STAGE/'fixture-node-prelude.mjs'),'--test','--test-name-pattern=unavailable radio|radio input becoming',str(STAGE/files[0])];env={**os.environ,'TMPDIR':str(ROOT),'TMP':str(ROOT),'TEMP':str(ROOT)}
r=subprocess.run(command,capture_output=True,env=env);log=r.stdout+r.stderr;put(ROOT/'packaged-input-recovery-checks.tap',log)
summary={k:int(re.findall(r'^# '+k+r' (\d+)$',log.decode(),re.M)[-1])for k in['tests','pass','fail','cancelled','skipped','todo']}
unchanged=True
with zipfile.ZipFile(archive)as z:
 for item in z.infolist():assert (STAGE/item.filename).read_bytes()==z.read(item)
receipt={'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRevision':HEAD,'sourceTree':accepted['sourceTree'],'artifactId':accepted['artifactId'],'runtimeArchiveSHA256':expected['archiveSHA256'],'tests':pins,'command':command,'actualExitCode':r.returncode,'summary':summary,'logSHA256':sha(log),'runtimeBytesUnchanged':True,'hostSetup':'Shipped i18next engine loaded before generated bootstrap; original package modules and exact source tests unchanged.','scope':'Five existing Advanced unavailable-input tests against exact newly packaged modules, using deterministic DOM/worker and stub renderer. Nineteen unrelated tests intentionally skipped by name filter, including accelerated duration/capacity. No physical input, WebGL/browser, player storage, endurance, public or full Advanced-suite acceptance.'}
put(ROOT/'packaged-input-recovery-receipt.json',(json.dumps(receipt,indent=2)+'\n').encode());print(json.dumps(receipt,indent=2));assert r.returncode==0 and summary=={'tests':24,'pass':5,'fail':0,'cancelled':0,'skipped':19,'todo':0}
