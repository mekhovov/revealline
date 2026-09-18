from pathlib import Path
import subprocess,json,hashlib,sys,time,datetime
root=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test');out=Path(__file__).resolve().parent;wt=root/'.cache/worktrees/p03-backup-feedback';version=sys.argv[1];name=sys.argv[2];dest=out/'runs'/name;dest.mkdir(parents=True,exist_ok=False)
files=['game/test/backup-content-feedback-host.test.mjs','game/test/text-size-host.test.mjs','game/test/chapter-download-host.test.mjs','game/test/backup-storage.test.mjs','game/test/field-kit-flow.test.mjs','game/test/modal-navigation.test.mjs','game/test/practice-brief-host.test.mjs']
sha=lambda b:hashlib.sha256(b).hexdigest()
paths=set(subprocess.check_output(['git','ls-files','-z'],cwd=wt).decode().split('\0'));paths.discard('');paths.add('game/test/backup-content-feedback-host.test.mjs')
inputs=[]
for p in sorted(paths):
 f=wt/p
 if f.is_file():
  assert not f.is_symlink();body=f.read_bytes();inputs.append({'path':p,'bytes':len(body),'sha256':sha(body)})
(dest/'inputs.json').write_text(json.dumps(inputs,indent=2)+'\n');cmd=[str(Path('/Users/oleksandr.mekhovov/.local/share/mise/installs/node')/version/'bin/node'),'--max-old-space-size=1024','--test','--test-concurrency=1',*files];start=time.monotonic()
with (dest/'stdout').open('wb') as stdout,(dest/'stderr').open('wb') as stderr:
 try:proc=subprocess.run(cmd,cwd=wt,stdout=stdout,stderr=stderr,timeout=600);code=proc.returncode
 except subprocess.TimeoutExpired:code=124
changed=[p['path'] for p in inputs if not (wt/p['path']).is_file() or sha((wt/p['path']).read_bytes())!=p['sha256']]
receipt={'command':cmd,'cwd':str(wt),'base':subprocess.check_output(['git','rev-parse','HEAD'],cwd=wt,text=True).strip(),'exitCode':code,'elapsedSeconds':time.monotonic()-start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'inputCount':len(inputs),'inputBytes':sum(x['bytes'] for x in inputs),'inputManifestSha256':sha((dest/'inputs.json').read_bytes()),'unchangedAfter':not changed,'changedInputs':changed,'stdoutSha256':sha((dest/'stdout').read_bytes()),'stderrSha256':sha((dest/'stderr').read_bytes())};(dest/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt));print((dest/'stdout').read_text()[-2500:]);print((dest/'stderr').read_text()[-1000:]);sys.exit(code)
