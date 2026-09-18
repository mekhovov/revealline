import os,pathlib,sys,json,hashlib,subprocess,time,selectors,signal
root=pathlib.Path(__file__).resolve().parent
repo=root.parents[1]
source=repo/'.cache/worktrees/p03-studio-guide-v0615'
admin=pathlib.Path(subprocess.check_output(['git','rev-parse','--absolute-git-dir'],cwd=source,text=True).strip())
(root/'tmp').mkdir(exist_ok=True)
reserve=512*1024**2; cap=20*1024**2
node=sys.argv[1]; name=sys.argv[2]; command=sys.argv[3:]
def budget():
 size=sum(p.stat().st_blocks*512 for d in [root,source,admin] for p in d.rglob('*') if p.is_file());free=os.statvfs(root).f_bavail*os.statvfs(root).f_frsize
 assert size<cap and free>=reserve,(size,free)
 return {'allocatedBytes':size,'freeBytes':free}
def inputs():
 return [{'path':str(p.relative_to(source)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(source.rglob('*')) if p.is_file() and not p.is_symlink() and '.git' not in p.relative_to(source).parts and not str(p.relative_to(source)).startswith('docs/verification/')]
def identity():
 return {'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip(),'branch':subprocess.check_output(['git','branch','--show-current'],cwd=source,text=True).strip()}
before=inputs(); ident=identity(); assert ident['branch']=='codex/p03-studio-guide-v0615'; initial=budget(); argv=[node,*command]
start=time.monotonic();process=subprocess.Popen(argv,cwd=source,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,env={**os.environ,'GIT_NO_LAZY_FETCH':'1','TMPDIR':str(root/'tmp')})
sel=selectors.DefaultSelector();sel.register(process.stdout,selectors.EVENT_READ);output=bytearray();reason=None
while sel.get_map():
 if time.monotonic()-start>120: reason='deadline';os.killpg(process.pid,signal.SIGKILL)
 for key,_ in sel.select(timeout=.2):
  chunk=os.read(key.fileobj.fileno(),65536)
  if not chunk: sel.unregister(key.fileobj);continue
  output.extend(chunk)
  if len(output)>1024**2: reason='output cap';os.killpg(process.pid,signal.SIGKILL)
 if reason: break
code=process.wait();elapsed=time.monotonic()-start
assert inputs()==before,'Inputs mutated while testing';assert identity()==ident,'Source identity changed'
(root/(name+'.tap')).write_bytes(output)
receipt={'argv':argv,'cwd':str(source),'identity':ident,'node':subprocess.check_output([node,'--version'],text=True).strip(),'exitCode':code,'reason':reason,'elapsedSeconds':elapsed,'outputBytes':len(output),'outputSha256':hashlib.sha256(output).hexdigest(),'beforeBudget':initial,'afterBudget':budget(),'inputs':before,'inputsUnchanged':True,'exclusions':['.git','symlinks (not followed)','docs/verification/ (later evidence; absent at first snapshot)']}
(root/(name+'.json')).write_text(json.dumps(receipt,indent=2)+'\n');budget()
print(json.dumps({k:v for k,v in receipt.items() if k not in ['inputs','argv']}));print(output.decode()[-1000:])
