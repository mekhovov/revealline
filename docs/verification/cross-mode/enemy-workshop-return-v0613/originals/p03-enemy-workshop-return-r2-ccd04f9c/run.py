import os,pathlib,sys,json,hashlib,subprocess,time,selectors
root=pathlib.Path(__file__).resolve().parent
source=root/'source'
reserve=512*1024**2; cap=4*1024**2
node=sys.argv[1]; name=sys.argv[2]; tests=sys.argv[3:]
def budget():
 size=sum(p.stat().st_blocks*512 for p in root.rglob('*') if p.is_file());free=os.statvfs(root).f_bavail*os.statvfs(root).f_frsize
 assert size<cap and free>=reserve,(size,free)
 return {'allocatedBytes':size,'freeBytes':free}
def inputs():
 return [{'path':str(p.relative_to(source)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(source.rglob('*')) if p.is_file()]
before=inputs(); initial=budget(); argv=[node,'--max-old-space-size=1024','--test','--test-concurrency=1',*tests]
start=time.monotonic();process=subprocess.Popen(argv,cwd=source,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env={**os.environ,'GIT_NO_LAZY_FETCH':'1'})
sel=selectors.DefaultSelector();sel.register(process.stdout,selectors.EVENT_READ);output=bytearray();reason=None
while sel.get_map():
 if time.monotonic()-start>120: reason='deadline';process.kill()
 for key,_ in sel.select(timeout=.2):
  chunk=os.read(key.fileobj.fileno(),65536)
  if not chunk: sel.unregister(key.fileobj);continue
  output.extend(chunk)
  if len(output)>1024**2: reason='output cap';process.kill()
 if reason: break
code=process.wait();elapsed=time.monotonic()-start
assert inputs()==before,'Inputs mutated while testing'
(root/(name+'.tap')).write_bytes(output)
receipt={'argv':argv,'node':subprocess.check_output([node,'--version'],text=True).strip(),'exitCode':code,'reason':reason,'elapsedSeconds':elapsed,'outputBytes':len(output),'outputSha256':hashlib.sha256(output).hexdigest(),'beforeBudget':initial,'afterBudget':budget(),'inputs':before,'inputsUnchanged':True}
(root/(name+'.json')).write_text(json.dumps(receipt,indent=2)+'\n');budget()
print(json.dumps({k:v for k,v in receipt.items() if k not in ['inputs','argv']}));print(output.decode()[-2200:])
