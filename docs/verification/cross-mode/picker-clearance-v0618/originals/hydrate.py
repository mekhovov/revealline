from pathlib import Path,PurePosixPath
import subprocess as sp,json,re,hashlib,shutil,datetime
root=Path.cwd(); cache=root/'.cache/p05-picker-clearance-next'; wt=root/'.cache/worktrees/p05-picker-clearance-next'
source='4fd8e2dac4fdc851d0d2bf0b21e77162d9d405c9';branch='codex/p05-picker-clearance-next'
def git(*args): return sp.check_output(['git',*args],cwd=root)
files=set(git('ls-tree','-r','--name-only',source).decode().splitlines())
seeds=['game/ui/still-media-panel.mjs','game/ui/still-media-panel.css','game/ui/focus-clearance.mjs','game/test/still-media-panel.test.mjs','game/test/still-media-host.test.mjs','game/test/focus-clearance.test.mjs','game/test/operation-focus-host.test.mjs','game/test/still-story-panel.test.mjs','authoring/skills/xonix-runtime-maintainer/SKILL.md','docs/presentation-loading.md','docs/operation-focus.md','docs/still-media-workshop.md','package.json','.prettierrc.json']
assert all(p in files for p in seeds),[p for p in seeds if p not in files]
seen={};todo=seeds[:]
while todo:
 p=todo.pop()
 if p in seen:continue
 raw=git('show',f'{source}:{p}');seen[p]=raw
 if p.endswith(('.mjs','.js','.css')):
  for dep in re.findall(r'''(?:from\s*|import\s*\(\s*|import\s+|new URL\(\s*)['"]([^'"]+)['"]''',raw.decode()):
   if not dep.startswith('.'):continue
   import posixpath
   d=posixpath.normpath(posixpath.join(posixpath.dirname(p),dep))
   if d in files:todo.append(d)
total=sum(map(len,seen.values())); assert total<=12*1024*1024,total
assert shutil.disk_usage(root).free>=512*1024*1024+total*3
assert not wt.exists()
sp.run(['git','worktree','add','--no-checkout','-b',branch,str(wt),source],check=True,cwd=root)
sp.run(['git','sparse-checkout','set','--no-cone','--stdin'],input=''.join('/'+p+'\n' for p in sorted(seen)).encode(),check=True,cwd=wt)
sp.run(['git','checkout'],check=True,cwd=wt)
assert not sp.check_output(['git','status','--porcelain'],cwd=wt)
rows=[]
for p,b in sorted(seen.items()):
 actual=(wt/p).read_bytes();assert actual==b,p
 rows.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
actual=sum(q.stat().st_size for q in wt.rglob('*') if q.is_file());assert actual<=16*1024*1024
record={'source':source,'tree':git('rev-parse',source+'^{tree}').decode().strip(),'branch':branch,'worktree':str(wt),'files':rows,'hydratedBodyBytes':total,'actualWorktreeBytes':actual,'managedCapBytes':16*1024*1024,'reserveBytes':512*1024*1024,'seeds':seeds,'status':'CLEAN_EXACT_SOURCE_HYDRATED'}
(cache/'hydration.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({k:v for k,v in record.items() if k not in ['files','seeds']}))
