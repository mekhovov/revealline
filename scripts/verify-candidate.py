import argparse, hashlib, json, os, re, subprocess, tarfile, time
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Verify exact committed RevealLine source and preserve previous releases/tags. Never publishes, creates a tag or changes the working tree.')
parser.add_argument('--commit', required=True)
parser.add_argument('--version', required=True)
args=parser.parse_args()
if not re.fullmatch(r'[0-9a-f]{40}',args.commit):raise ValueError('Supply the complete candidate commit SHA.')
if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+',args.version):raise ValueError('Supply a numeric semantic version without the v prefix.')
COMMIT=args.commit
VERSION=args.version
DIR=ROOT/f'.cache/releases/verification-{COMMIT[:12]}'
SOURCE=ROOT/f'.cache/releases/source-{COMMIT[:12]}'
GATES=[('test',['npm','test']),('lint',['npm','run','lint']),('format',['npm','run','format:check']),('native-format',['npm','run','format:native:check']),('validate',['npm','run','validate']),('motion-lab-syntax',['node','--check','authoring/motion-lab/app.js'])]
def now(): return datetime.now(timezone.utc).isoformat()
def sha(data): return hashlib.sha256(data).hexdigest()
def hashfile(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def save(name,data):
 p=DIR/name
 if p.exists():raise RuntimeError(f'Refusing to overwrite {p}')
 p.write_text(json.dumps(data,indent=2)+'\n')
def files(root):
 entries=[]
 for base,dirs,names in os.walk(root,followlinks=False):
  for name in dirs+names:
   if (Path(base)/name).is_symlink():raise RuntimeError('Unexpected inventory link')
  for name in sorted(names):
   p=Path(base)/name
   if not p.is_file():raise RuntimeError('Unexpected special file')
   entries.append({'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashfile(p)})
 return sorted(entries,key=lambda v:v['path'])
def tags():
 out=[]
 for name in git('tag','--list').splitlines():
  obj=git('rev-parse',f'refs/tags/{name}');kind=git('cat-file','-t',obj)
  raw=subprocess.check_output(['git','cat-file',kind,obj],cwd=ROOT)
  out.append({'name':name,'object':obj,'kind':kind,'peeled':git('rev-parse',f'refs/tags/{name}^{{}}'),'objectBytes':len(raw),'objectSha256':sha(raw)})
 return out
def releases():
 return [{'name':p.name,'files':files(p)} for p in sorted((ROOT/'releases').iterdir()) if p.is_dir() and not p.name.startswith('.')]
def source_inventory(names):
 return [{'path':name,'bytes':(SOURCE/name).stat().st_size,'sha256':hashfile(SOURCE/name)} for name in names]
def main():
 DIR.mkdir(parents=True,exist_ok=True)
 assert git('rev-parse',f'{COMMIT}^{{commit}}')==COMMIT
 if SOURCE.exists():raise RuntimeError('Archive directory already exists')
 if (ROOT/f'releases/v{VERSION}').exists() or f'v{VERSION}' in git('tag','--list').splitlines():raise RuntimeError('Milestone already exists')
 baseline={'at':now(),'releases':releases(),'tags':tags()};save('preservation-before.json',baseline)
 tar=DIR/'source.tar'
 subprocess.run(['git','archive','--format=tar',f'--output={tar}',COMMIT],cwd=ROOT,check=True)
 with tar.open('rb') as f:assert subprocess.check_output(['git','get-tar-commit-id'],stdin=f,cwd=ROOT,text=True).strip()==COMMIT
 SOURCE.mkdir()
 names=[]
 with tarfile.open(tar) as archive:
  seen=set()
  for member in archive:
   p=PurePosixPath(member.name)
   if p.is_absolute() or '..' in p.parts or '.git' in p.parts or '\\' in member.name or any(ord(c)<32 for c in member.name) or str(p) in seen:raise RuntimeError('Unsafe or duplicate archive entry')
   seen.add(str(p))
   if member.isdir():continue
   if not member.isfile():raise RuntimeError('Archive links/special files are unsupported')
   if member.size>64*1024*1024:raise RuntimeError('Unexpected source file budget')
   target=SOURCE/str(p);target.parent.mkdir(parents=True,exist_ok=True)
   with archive.extractfile(member) as incoming:target.write_bytes(incoming.read())
   target.chmod(member.mode & 0o777)
   names.append(str(p))
 names.sort()
 expected=git('ls-tree','-r','--name-only',COMMIT).splitlines();assert names==expected
 initial=source_inventory(names);save('source-inputs-before.json',initial)
 assert json.loads((SOURCE/'package.json').read_text())['version']==VERSION
 assert json.loads((SOURCE/'game/build-config.json').read_text())['version']==VERSION
 for relative in ['game/mp3.mjs','game/soundtrack.mjs','game/soundtrack-store.mjs','game/soundtrack-bundle.mjs','game/ui/soundtrack-player.mjs','game/ui/soundtrack-panel.mjs','game/ui/soundtrack-panel.css','game/test/mp3.test.mjs','game/test/soundtrack.test.mjs','game/test/soundtrack-store.test.mjs','game/test/soundtrack-player.test.mjs','game/test/soundtrack-panel.test.mjs','game/test/soundtrack-host.test.mjs','docs/soundtrack-studio.md']:
  assert (SOURCE/relative).is_file(),f'Missing P3 input: {relative}'
 assert 'attachSoundtrackPanel' in (SOURCE/'game/app.mjs').read_text()
 assert (SOURCE/'game/core/classic-definition.mjs').exists()
 assert (SOURCE/'game/content/packs/fpv-arcade-r2.json').exists()
 assert (SOURCE/'game/ui/pixel-theme.css').exists()
 assert (SOURCE/'game/ui/fonts/OFL.txt').exists()
 assert 'WIDE_VERSIONS' in (SOURCE/'game/core/versions.mjs').read_text()
 os.symlink(ROOT/'node_modules',SOURCE/'node_modules',target_is_directory=True)
 runtime=subprocess.check_output(['mise','exec','node@22.22.2','--','node','-p','JSON.stringify({node:process.version,execPath:process.execPath})'],cwd=SOURCE,text=True).strip()
 runner={'path':str(Path(__file__).relative_to(ROOT)),'sha256':hashfile(Path(__file__))}
 report={'sourceCommit':COMMIT,'source':str(SOURCE.relative_to(ROOT)),'startedAt':now(),'archive':{'path':str(tar.relative_to(ROOT)),'bytes':tar.stat().st_size,'sha256':hashfile(tar)},'runtime':json.loads(runtime),'dependencyLink':{'path':'node_modules','target':str((ROOT/'node_modules').resolve()),'purpose':'tooling only; never archived or frozen'},'sourceFiles':len(initial),'sourceBytes':sum(f['bytes'] for f in initial),'sourceInventorySha256':hashfile(DIR/'source-inputs-before.json'),'runner':runner,'gates':[]}
 save('preflight.json',report)
 for name,args in GATES:
  started=now();start=time.monotonic();log=DIR/f'{name}.log'
  with log.open('xb') as out:process=subprocess.run(['mise','exec','node@22.22.2','--',*args],cwd=SOURCE,stdout=out,stderr=subprocess.STDOUT)
  record={'name':name,'command':['mise','exec','node@22.22.2','--',*args],'cwd':str(SOURCE.relative_to(ROOT)),'startedAt':started,'durationMs':round((time.monotonic()-start)*1000),'exitCode':process.returncode,'log':str(log.relative_to(ROOT)),'bytes':log.stat().st_size,'sha256':hashfile(log)}
  if name=='test':
   text=log.read_text();record['tap']={key:int(re.findall(rf'^# {key} (\d+)$',text,re.M)[-1]) for key in ['tests','pass','fail','cancelled','skipped','todo']}
   record['tapAccepted']=record['tap']['tests']>2012 and record['tap']['pass']==record['tap']['tests'] and all(record['tap'][key]==0 for key in ['fail','cancelled','skipped','todo'])
  record['sourceUnchanged']=source_inventory(names)==initial
  report['gates'].append(record)
  print(json.dumps(record),flush=True)
 after=source_inventory(names);save('source-inputs-after.json',after)
 final={'at':now(),'releases':releases(),'tags':tags()};save('preservation-after-gates.json',final)
 report.update({'finishedAt':now(),'sourceUnchanged':after==initial,'runnerUnchanged':hashfile(Path(__file__))==runner['sha256'],'priorReleasesUnchanged':final['releases']==baseline['releases'],'priorTagsUnchanged':final['tags']==baseline['tags']})
 report['passed']=all(g['exitCode']==0 and g['sourceUnchanged'] and g.get('tapAccepted',True) for g in report['gates']) and all(report[k] for k in ['sourceUnchanged','runnerUnchanged','priorReleasesUnchanged','priorTagsUnchanged'])
 save('source-gates.json',report)
 print(json.dumps({'passed':report['passed'],'tests':report['gates'][0].get('tap'),'releases':len(baseline['releases']),'tags':len(baseline['tags']),'report':str((DIR/'source-gates.json').relative_to(ROOT))}),flush=True)
 raise SystemExit(0 if report['passed'] else 1)
if __name__=='__main__':main()
