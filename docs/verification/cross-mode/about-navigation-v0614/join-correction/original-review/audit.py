"""Read-only exact About commit and retained evidence audit. Reviewer output only."""
from pathlib import Path
import hashlib,json,subprocess,re,datetime,stat
R=Path.cwd();C=R/'.cache/p03-about-controller-v0614';W=R/'.cache/worktrees/p03-about-controller-v0614';O=R/'.cache/v0614-root-independent-review'
S='61cf9c14e8f4a97eae81e7c30d0191029adc817a';T='d39a9a200294dfb1a68460dfdc59c5f575708d6e';P='58ff1b1da3c5487412e168ce34539866ac2f4970'
sha=lambda raw:hashlib.sha256(raw).hexdigest()
def git(*a):return subprocess.check_output(['git','-C',str(W),*a])
def read(p):
 assert p.is_file() and not any(q.is_symlink() for q in [p,*p.parents]) and p.stat().st_size<8*1024**2,p
 return p.read_bytes()
def obj(p):return json.loads(read(p))
def pin(p):
 raw=read(p);return {'path':str(p),'bytes':len(raw),'sha256':sha(raw)}
def write(p,j):
 with p.open('x') as f:f.write(json.dumps(j,indent=2)+'\n')
def state():return {'head':git('rev-parse','HEAD').decode().strip(),'tree':git('rev-parse','HEAD^{tree}').decode().strip(),'status':git('status','--porcelain','--untracked-files=normal').decode(),'index':git('diff','--cached','--name-only').decode()}
before=state();assert before=={'head':S,'tree':T,'status':'','index':''};assert git('rev-parse',S+'^').decode().strip()==P
receipt=obj(C/'commit-receipt.json');manifest=obj(C/'staged-index-manifest.json');assert pin(C/'staged-index-manifest.json')['sha256']=='b7d59f5af5019bf2f944d0d3f790ab7449d794c52e6b2e403d3169803fc047cc'
rows=manifest['files'];assert len(rows)==manifest['stagedPathCount']==receipt['paths']==162 and len({x['path'] for x in rows})==162
assert {x['path'] for x in rows}==set(git('diff','--name-only',P,S).decode().splitlines())
tree={}
for item in git('ls-tree','-r','-z',S,'--',*[x['path'] for x in rows]).decode().split('\0'):
 if not item:continue
 meta,path=item.split('\t');mode,kind,blob=meta.split();tree[path]=(mode,kind,blob)
checked=[]
for row in rows:
 path=row['path'];mode,kind,blob=tree[path];assert kind=='blob' and mode==row['mode']
 raw=git('cat-file','blob',blob);assert len(raw)==row['bytes'] and sha(raw)==row['sha256'],path
 physical=W/path;assert read(physical)==raw,path
 assert bool(physical.stat().st_mode&stat.S_IXUSR)==(mode=='100755'),path
 checked.append({**row,'gitBlob':blob,'committedAndWorkingBodyEqual':True})
sourcepaths=manifest['sourcePaths'];versions=['game/build-config.json','package-lock.json','package.json'];features=sorted(set(sourcepaths)-set(versions))
assert len(features)==14 and len(sourcepaths)==17 and len(rows)-len(sourcepaths)==145
patch=git('diff','--binary',P,S,'--',*sourcepaths);assert patch==read(C/'versioned-feature.patch') and sha(patch)==receipt['featurePatch']['sha256']
package=obj(W/'package.json');lock=obj(W/'package-lock.json');build=obj(W/'game/build-config.json')
assert package['version']==lock['version']==lock['packages']['']['version']==build['version']=='0.61.4'
inputs=obj(C/'versioned-source-inputs.json');assert len(inputs)==287 and len({x['path'] for x in inputs})==287
for row in inputs:
 raw=git('show',S+':'+row['path']);assert len(raw)==row['bytes'] and sha(raw)==row['sha256'],row['path']
cohorts=[]
for name,node in [('versioned-node20','v20.19.5'),('versioned-node22','v22.22.2')]:
 record=obj(C/(name+'.json'));raw=read(C/(name+'.tap'));assert len(raw)==record['outputBytes'] and sha(raw)==record['outputSha256']
 assert record['inputs']==inputs and record['inputsUnchanged'] is True and record['exitCode']==0 and record['node']==node
 assert record['identity']['head']==P and record['cwd']==str(W)
 totals={key:int(re.findall(r'^# '+key+r' (\d+)$',raw.decode(),re.M)[-1]) for key in ['tests','pass','fail','cancelled','skipped','todo']}
 assert totals=={'tests':199,'pass':199,'fail':0,'cancelled':0,'skipped':0,'todo':0}
 files=[a for a in record['argv'] if a.endswith('.mjs')];assert len(files)==8
 cohorts.append({'node':node,'counts':totals,'files':files,'record':pin(C/(name+'.json')),'originalOutput':pin(C/(name+'.tap')),'scope':'Actual scoped precommit versioned source cohort; 287 tested input bodies match reviewed commit. Not hosted final-source qualification or a new test execution.'})
fmt=obj(C/'versioned-format.json');raw=read(C/'versioned-format.tap');assert fmt['exitCode']==0 and fmt['inputs']==inputs and fmt['inputsUnchanged'] and sha(raw)==fmt['outputSha256'] and len(raw)==fmt['outputBytes']
history=obj(C/'historical-evidence-intake.json');intake=obj(C/'evidence-intake.json');assert history['totalFiles']==len(history['files'])==103 and intake['totalFiles']==len(intake['files'])==142
for collection in [history,intake]:
 assert sum(x['bytes'] for x in collection['files'])==collection['totalBytes']
 for row in collection['files']:
  destination=row['destination'];data=git('show',S+':'+destination);assert len(data)==row['bytes'] and sha(data)==row['sha256']
  assert tree[destination][0]==row['mode']
  assert read(Path(row['original']))==data,row['original']
unchanged=['game/ui/controller-navigation.mjs','game/ui/controller-router.mjs','game/release-explorer.mjs','game/controller-bindings.mjs','game/ui/field-kit-compiled.css','authoring/library/fpv-field-kit/production.rltheme']
for path in unchanged:assert git('rev-parse',P+':'+path)==git('rev-parse',S+':'+path),path
assert state()==before
write(O/'path-pins.json',{'source':S,'tree':T,'parent':P,'count':162,'bytes':sum(x['bytes'] for x in checked),'featurePaths':features,'versionPaths':versions,'evidencePaths':145,'files':checked})
write(O/'evidence-audit.json',{'status':'PASS_EXACT_COMMIT_AND_ORIGINAL_PINS','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':S,'tree':T,'parent':P,'sourceBeforeAfter':before,'commitReceipt':pin(C/'commit-receipt.json'),'manifest':pin(C/'staged-index-manifest.json'),'featurePatch':pin(C/'versioned-feature.patch'),'sourceInputMap':pin(C/'versioned-source-inputs.json'),'testedInputBodiesGitMatched':287,'cohorts':cohorts,'versionedFormat':pin(C/'versioned-format.json'),'historicalOriginals':103,'historicalBytes':history['totalBytes'],'completeCopiedOriginals':142,'completeCopiedOriginalBytes':intake['totalBytes'],'allOriginalAndCommittedCopiesEqual':True,'unchangedBoundaries':unchanged,'newFullSuite':False,'browserOrPhysicalAcceptance':False,'remoteActions':False,'sourceEdits':False})
print(json.dumps({'status':'PASS_PINS_AND_EVIDENCE','paths':162,'sourceInputBodies':287,'cohorts':'199/8 on each Node20 and22','historicalOriginals':103,'currentSourceFindings':'One P2 controller join focus issue separately reproduced'}))
