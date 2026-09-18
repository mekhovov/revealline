from pathlib import Path, PurePosixPath
import subprocess, os, re, json, hashlib, posixpath, sys
ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'.cache/worktrees/p08-versus-footprint'
BASE='d34e283819376eb43e4942287d9767b22a4f6487'
ENV={**os.environ,'GIT_NO_LAZY_FETCH':'1'}
def git(*args):
 return subprocess.check_output(['git',*args],cwd=WORK,env=ENV)
assert git('rev-parse','HEAD').decode().strip()==BASE
paths=set(git('ls-tree','-r','--name-only',BASE).decode().splitlines())
queue=list(sys.argv[1:]) or ['game/couch/couch.mjs','game/couch/couch.css','game/test/couch-static-picture-host.test.mjs','game/test/actor-presentation.test.mjs','game/test/host-presentation-size.test.mjs','docs/field-kit-surfaces.md','authoring/skills/xonix-runtime-maintainer/SKILL.md','.cursor/skills/deploy-release-pages/SKILL.md','package.json','package-lock.json','build-config.json','.prettierrc.json','eslint.config.mjs']
seen=set(); pins=[]; total=0
while queue:
 path=queue.pop(0)
 if path in seen or path not in paths: continue
 seen.add(path)
 body=git('show',BASE+':'+path); total+=len(body)
 large={'game/content/packs/fpv-arcade-r5.json','authoring/library/four-worlds-chapters/packs/original-fpv-pressure.json'}
 assert len(body)<(12_000_000 if path in large else 5_000_000) and total<25_000_000
 dest=WORK/path
 if not dest.exists():
  dest.parent.mkdir(parents=True,exist_ok=True); dest.write_bytes(body)
 elif dest.read_bytes()!=body:
  print('Preserving already modified '+path)
 pins.append({'path':path,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()})
 if path.endswith(('.mjs','.js','.html','.css')):
  text=body.decode()
  refs=re.findall(r'(?:from\s*|import\s*\(|import\s*|new URL\s*\()([\'\"])([^\'\"]+)\1',text)
  refs += re.findall(r'(?:src|href)\s*=\s*([\'\"])([^\'\"]+)\1',text)
  for _,ref in refs:
   if ref.startswith(('./','../')):
    q=posixpath.normpath(posixpath.join(posixpath.dirname(path),ref.split('?')[0].split('#')[0]))
    if q in paths: queue.append(q)
record=ROOT/'.cache/p08-versus-footprint-d34e/hydrated.json'
prior=json.loads(record.read_text()) if record.exists() else []
records={p['path']:p for p in prior+pins}
record.write_text(json.dumps(sorted(records.values(),key=lambda p:p['path']),indent=2)+'\n')
print(json.dumps({'count':len(pins),'bytes':total,'totalPins':len(records)}))
