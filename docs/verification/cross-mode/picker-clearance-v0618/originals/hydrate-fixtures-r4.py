from pathlib import Path
import subprocess as sp,json,re,hashlib,shutil,posixpath
root=Path.cwd();cache=root/'.cache/p05-picker-clearance-next';wt=root/'.cache/worktrees/p05-picker-clearance-next';source='4fd8e2dac4fdc851d0d2bf0b21e77162d9d405c9'
def git(*a):return sp.check_output(['git',*a],cwd=root)
files=set(git('ls-tree','-r','--name-only',source).decode().splitlines())
sizes={}
for line in git('ls-tree','-r','-l',source,'--','game/content').decode().splitlines():
 info,path=line.split('\t',1);sizes[path]=int(info.split()[-1])
seeds=['game/app.mjs','game/test/still-media-bundle-ui.test.mjs']+[p for p in files if p.startswith('game/content/') and p.endswith('.json') and sizes[p]<1024*1024]
seen={};todo=seeds[:]
while todo:
 p=todo.pop()
 if p in seen:continue
 raw=git('show',f'{source}:{p}');seen[p]=raw
 if p.endswith(('.mjs','.js','.css')):
  for dep in re.findall(r'''(?:from\s*|import\s*\(\s*|import\s+|new URL\(\s*)['"`]([^'"`]+)['"`]''',raw.decode()):
   if not dep.startswith('.') or '${' in dep:continue
   d=posixpath.normpath(posixpath.join(posixpath.dirname(p),dep.split('?')[0]))
   if d in files:todo.append(d)
old=json.loads((cache/'hydration.json').read_text());oldpaths={r['path'] for r in old['files']};add={p:b for p,b in seen.items() if p not in oldpaths}
size=sum(map(len,add.values()));wtbytes=sum(p.stat().st_size for p in wt.rglob('*') if p.is_file());cachebytes=sum(p.stat().st_size for p in cache.rglob('*') if p.is_file())
assert wtbytes+cachebytes+size+1024*1024<16*1024*1024,(size,wtbytes,cachebytes)
assert shutil.disk_usage(root).free>512*1024*1024+size
sp.run(['git','sparse-checkout','add','--stdin'],input=''.join('/'+p+'\n' for p in sorted(add)).encode(),cwd=wt,check=True)
rows=[]
for p,b in sorted(add.items()):assert(wt/p).read_bytes()==b,p;rows.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
record={'reason':'Retained 27 test setup failures require Solo dynamic import and installed-content fixtures; no assertion weakened. Added independent bundle UI suite fixture.','source':source,'files':rows,'addedBytes':size,'previousHydrationBytes':old['actualWorktreeBytes'],'managedCapBytes':16*1024*1024}
(cache/'hydration-r4.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'files':len(add),'bytes':size,'previousWorktreeBytes':wtbytes,'cacheBytes':cachebytes}))
