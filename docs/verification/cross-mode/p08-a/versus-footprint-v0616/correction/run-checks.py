from pathlib import Path
import subprocess,json,hashlib,datetime,shutil,sys,time,os
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent;WORK=ROOT/'.cache/worktrees/p08-versus-footprint-v0616';SOURCE='d34e283819376eb43e4942287d9767b22a4f6487';LIMIT=64*1024*1024;RESERVE=512*1024*1024
NODES={20:'/Users/oleksandr.mekhovov/.local/share/mise/installs/node/20.19.5/bin/node',22:'/Users/oleksandr.mekhovov/.local/share/mise/installs/node/22.22.2/bin/node'}
sha=lambda b:hashlib.sha256(b).hexdigest()
def size():return sum(p.stat().st_size for b in (HERE,WORK) for p in b.rglob('*') if p.is_file() and not p.is_symlink())
def guard():
 assert size()<LIMIT and shutil.disk_usage(ROOT).free>RESERVE,'Managed capacity/reserve exceeded'
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=WORK).decode().strip()==SOURCE
 assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=WORK),'Index has staged changes'
def pins():
 return {str(p.relative_to(WORK)):sha(p.read_bytes()) for p in WORK.rglob('*') if p.is_file() and '.git' not in p.parts and '.cache' not in p.relative_to(WORK).parts}
label=sys.argv[1];node=NODES[int(sys.argv[2])];args=sys.argv[3:];guard();out=HERE/'checks'/label;assert not out.exists();out.mkdir(parents=True);before=pins();start=datetime.datetime.now(datetime.timezone.utc).isoformat();clock=time.monotonic();command=[node,*args]
with (out/'stdout').open('wb') as stdout,(out/'stderr').open('wb') as stderr:
 p=subprocess.run(command,cwd=WORK,stdout=stdout,stderr=stderr,env={**os.environ,'GIT_NO_LAZY_FETCH':'1'},timeout=180)
receipt={'label':label,'command':command,'cwd':str(WORK),'base':SOURCE,'startedAt':start,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':time.monotonic()-clock,'exitCode':p.returncode,'inputsUnchanged':before==pins(),'inputs':before,'outputs':{k:{'bytes':(out/k).stat().st_size,'sha256':sha((out/k).read_bytes())} for k in ('stdout','stderr')},'managedBytes':size(),'freeBytes':shutil.disk_usage(ROOT).free};(out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');guard();assert receipt['inputsUnchanged'];print(json.dumps({k:v for k,v in receipt.items() if k!='inputs'}));sys.exit(p.returncode)
