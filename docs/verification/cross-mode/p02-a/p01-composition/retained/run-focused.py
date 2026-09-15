import subprocess,pathlib,json,hashlib,time,shutil
W=pathlib.Path.cwd(); C=W/'.cache/p02-p01'
TESTS=json.loads((C/'focused-intake-final.json').read_text())['tests']
def pins():
 rows=[]
 for p in subprocess.check_output(['git','ls-files','-z']).decode().split('\0'):
  f=W/p
  if p and f.is_file():
   b=f.read_bytes(); rows.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 return rows
before=pins(); results=[]
(C/'focused-inputs-before.json').write_text(json.dumps(before,indent=2)+'\n')
for version in ['22.22.2','20.19.5']:
 if shutil.disk_usage(W).free<256*1024**2:raise RuntimeError('Capacity floor')
 node=f'/Users/oleksandr.mekhovov/.local/share/mise/installs/node/{version}/bin/node'
 argv=[node,'--test','--test-concurrency=1',*TESTS]
 log=C/f'whole-node{version.split(".")[0]}-01.log'
 start=time.monotonic()
 with log.open('wb') as f:done=subprocess.run(argv,stdout=f,stderr=subprocess.STDOUT)
 record={'node':subprocess.check_output([node,'--version']).decode().strip(),'argv':argv,'exitCode':done.returncode,'wallSeconds':time.monotonic()-start,'log':log.name,'logBytes':log.stat().st_size,'logSha256':hashlib.sha256(log.read_bytes()).hexdigest()}
 results.append(record);print(json.dumps(record),flush=True)
 after=pins();stable=before==after
 (C/'focused-execution-01.json').write_text(json.dumps({'base':'ac644a99eebb2fef049458f6abf69fa626f81983','incoming':'7945c6d07714d41cee9b6f848059b8dc18aed86c','trackedPhysicalInputCount':len(before),'inputsStable':stable,'results':results,'limits':'Focused whole files only. Eight combined test cases are in working tree beyond staged P01 test merge; physical inputs recorded. Not complete import graph/full CI/native/public acceptance.'},indent=2)+'\n')
 (C/'focused-inputs-after.json').write_text(json.dumps(after,indent=2)+'\n')
 if done.returncode or not stable:break
