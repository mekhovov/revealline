"""Read-only, exact-base composition review; writes cache evidence, never Git state."""
from pathlib import Path
import subprocess,json,hashlib,re,posixpath,datetime
R=Path.cwd();O=R/'.cache/p08a-team-earned-picture-628e95da';W=R/'.cache/worktrees/p08a-team-earned-picture';B='628e95daf403082768cdcf900a8ea1d1ef4629a2'
def git(*args):return subprocess.check_output(['git','-C',str(W),*args])
def pin(b):return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
assert git('rev-parse','HEAD').decode().strip()==B
assert not git('diff','--cached','--name-only')
tracked=git('diff','--name-only').decode().splitlines();added=git('ls-files','--others','--exclude-standard').decode().splitlines();paths=sorted(tracked+added)
assert len(paths)==12,paths
rows=[];patch=git('diff','--binary','HEAD','--',*tracked)
for p in added:
 result=subprocess.run(['git','diff','--no-index','--binary','--','/dev/null',p],cwd=W,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 assert result.returncode==1 and not result.stderr
 patch+=result.stdout
for p in paths:
 before=None if p in added else git('show',f'{B}:{p}')
 rows.append({'path':p,'before':None if before is None else {**pin(before),'gitBlob':git('rev-parse',f'{B}:{p}').decode().strip()},'after':pin((W/p).read_bytes())})
(O/'candidate.patch').write_bytes(patch)
(O/'candidate-pins.json').write_text(json.dumps({'source':B,'sourceTree':git('rev-parse',B+'^{tree}').decode().strip(),'paths':rows,'patch':pin(patch)},indent=2)+'\n')
identityPaths=['game/coop/core.mjs','game/coop/first-connection.mjs','game/coop/relay-yard.mjs','game/coop/recipes.mjs','game/coop/input-policy.mjs','game/couch/coop-picture-bindings.mjs','game/couch/coop-presentation.mjs','game/couch/coop-picture-image.mjs','game/couch/couch-input.mjs','game/presentation/compiled/runtime.json','package.json','package-lock.json','game/build-config.json']
identities=[]
for p in identityPaths:
 b=git('show',f'{B}:{p}'); live=(W/p).read_bytes() if (W/p).exists() else b
 assert live==b,p
 identities.append({'path':p,**pin(b),'gitBlob':git('rev-parse',f'{B}:{p}').decode().strip(),'materialized':(W/p).exists()})
rt=json.loads(git('show',f'{B}:game/presentation/compiled/runtime.json'));assets=[]
review=json.loads((R/'.cache/p08a-existing-arenas-628e95da/identity-review.json').read_text())
for p in ['game/presentation/compiled/assets/53f1206a11a8791892f5c844c0641529acbc2c09c8d558676d0d801d72113850.png','game/presentation/compiled/assets/d76f309d8385cd5d20fc2fff72b7f3abc19299cccdde767d76dd9f4a4960929d.png']:
 b=git('show',f'{B}:{p}');assert (W/p).read_bytes()==b
 assets.append({'path':p,**pin(b),'dimensions':[int.from_bytes(b[16:20],'big'),int.from_bytes(b[20:24],'big')]})
links=[]
for p in [p for p in paths if p.endswith('.md')]:
 for ref in re.findall(r'\]\(([^)]+)\)',(W/p).read_text()):
  ref=ref.strip('<>').split('#')[0]
  if not ref or '://' in ref or ref.startswith('mailto:'):continue
  target=posixpath.normpath(posixpath.join(posixpath.dirname(p),ref))
  if (W/target).is_file():exists=True
  else:exists=subprocess.run(['git','-C',str(W),'cat-file','-e',f'{B}:{target}'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
  links.append({'from':p,'reference':ref,'target':target,'existsInCandidate':exists})
assert all(x['existsInCandidate'] for x in links),[x for x in links if not x['existsInCandidate']]
for p in ['authoring/prompts/cross-mode-delivery.md','authoring/skills/xonix-runtime-maintainer/SKILL.md']:
 assert (W/p).read_bytes().startswith(git('show',f'{B}:{p}'))
subprocess.run(['git','-C',str(W),'diff','--check'],check=True)
check=subprocess.run(['git','-C',str(W),'apply','--reverse','--check',str(O/'candidate.patch')],capture_output=True)
(O/'patch-reverse-check.stdout').write_bytes(check.stdout);(O/'patch-reverse-check.stderr').write_bytes(check.stderr);assert check.returncode==0
out={'status':'PASS_SCOPED_STATIC_COMPOSITION','recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':B,'sourceTree':git('rev-parse',B+'^{tree}').decode().strip(),'branch':git('branch','--show-current').decode().strip(),'changedPaths':paths,'indexEmpty':True,'patch':pin(patch),'pins':pin((O/'candidate-pins.json').read_bytes()),'unchangedContracts':identities,'unchangedImages':assets,'compiledTheme':review['compiledTheme'],'additiveGuidancePreservesEntireParent':True,'relativeLinks':links,'limits':['No full build, production command, browser, rasterization, hardware, release or phase acceptance.','Original historical candidate results are not evidence for this composition.']}
(O/'composition-review.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'paths':len(paths),'patch':pin(patch),'links':len(links),'review':pin((O/'composition-review.json').read_bytes())}))
