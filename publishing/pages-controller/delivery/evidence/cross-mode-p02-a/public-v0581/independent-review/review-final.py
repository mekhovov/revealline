from pathlib import Path
import json,hashlib,urllib.parse,subprocess,datetime
R=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test');N=R/'.cache/p02a-team-note/public-native';A=R/'.cache/p02a-team-note/public-audit';O=R/'.cache/p02a-team-note/public-correction-independent-review'
sha=lambda b:hashlib.sha256(b).hexdigest();load=lambda p:json.loads(p.read_bytes())
n=load(N/'review.json');assert n['observations']==14 and len(n['originals'])==36 and n['phaseAcceptance'] is False
for p in n['originals']:
 b=(N/p['path']).read_bytes();assert len(b)==p['bytes'] and sha(b)==p['sha256']
assert {p.name for p in N.iterdir() if p.is_file()}=={p['path'] for p in n['originals']}|{'review.json'}
obs={p.name[:2]:load(p) for p in N.glob('[0-9]*.json')};assert len(obs)==14
for k,d in obs.items():
 ax=(N/next(p['path'] for p in n['originals'] if p['path'].startswith(k+'-') and p['path'].endswith('.ax.txt'))).read_text()
 if int(k)>2:assert d['note'].strip()=='Shared with Solo, Versus and previews. This Team chapter currently uses visual feedback.' and d['warning']=='' and d['clock']=='0:00'
 if int(k)>7:assert 'PAUSED' in ax or 'Both players paused' in ax
assert 'V0.58.1' in (N/'01-public-title.ax.txt').read_text()
for key,value,action in [('03','0.13','Unmute sound'),('04','0.13','Mute sound'),('05','0.14','Mute sound'),('06','0.13','Unmute sound'),('07','0.13','Unmute sound'),('09','0.14','Mute sound'),('10','0.13','Unmute sound')]:assert obs[key]['volume']==value and obs[key]['audioAction']==action
assert obs['14']['focus']['id']=='coop-options-toggle'
for key in ['06','11','12','13']:
 d=obs[key];r=d['noteRect'];v=d['viewport'];assert 0<=r['x'] and r['x']+r['width']<=v['width'] and 0<=r['y'] and r['y']+r['height']<=v['height']
report=load(A/'tools/runs/complete-1/report.json');inv=load(A/'tools/runs/complete-1/inventory.json');inputs=A/'tools/inputs/a1a5d0c5295196024af1a158c53acedc2f817c1a';binding=load(inputs/'binding.json');receipt=load(inputs/'receipt.json');results=[json.loads(l) for l in (A/'tools/runs/complete-1/results.jsonl').read_text().splitlines()];attempts=[json.loads(l) for l in (A/'tools/runs/complete-1/attempts.jsonl').read_text().splitlines()]
expected={r['path']:r for r in receipt['files']};assert len(expected)==len(results)==len(attempts)==2530 and sum(r['bytes'] for r in expected.values())==637630752
assert inv['fullInventory']==receipt['files'] and inv['selectedPaths']==[r['path'] for r in receipt['files']] and inv['mode']=='full'
assert report['status']=='PASS' and report['mode']=='full' and report['completedFiles']==report['fullInventoryFiles']==2530 and report['verifiedBytes']==report['expectedBytes']==637630752 and not report['failures'] and not report['skipped'] and report['failedFiles']==report['uninspectedFiles']==report['retries']==0
assert {r['path'] for r in results}==set(expected) and results==attempts
for r in results:
 e=expected[r['path']];assert r['attempt']==1 and r['status']==200 and r['ok'] and r['bytesMatch'] and r['hashMatch'] and r['contentTypeAccepted'];assert r['url']==binding['base']+urllib.parse.quote(r['path'],safe="/-_.!~*'()") and r['expectedBytes']==r['bytes']==e['bytes'] and r['expectedSha256']==r['sha256']==e['sha256']
for p in binding['pins'].values():
 b=(inputs/p['path']).read_bytes();assert len(b)==p['bytes'] and sha(b)==p['sha256']
for p in report['runnerPins']:assert sha(Path(p['file']).read_bytes())==p['sha256']
for name in ['public-row-review.json','after-http-review.json']:
 for p in load(A/name)['pins']:
  b=(A/p['path']).read_bytes();assert len(b)==p['bytes'] and sha(b)==p['sha256']
H=A/'hosted-observation-03';publisher='a1a5d0c5295196024af1a158c53acedc2f817c1a';source='c93019a344f6f4c6ac03940c77ea09c81122d911'
assert load(H/'main.json')['object']['sha']==publisher and load(H/'run.json')['head_sha']==publisher and load(H/'run.json')['status']=='completed' and load(H/'run.json')['conclusion']=='success'
assert load(H/'deployment.json')['id']==6474632693 and load(H/'deployment.json')['sha']==publisher and load(H/'statuses.json')[0]['state']=='success' and load(H/'statuses.json')[0]['id']==18409175675
assert load(H/'wrapper.json')['tree']['sha']=='71798f41b597138a6a0fbf40624d949b5cf90324'
release=load(A/'after-http-authorities/release.json');oldrelease=load(R/'.cache/p02a-team-note/publish/response.json');fields=lambda a:[(x['id'],x['name'],x['size'],x['digest']) for x in sorted(a['assets'],key=lambda x:x['name'])];assert release['id']==389657437 and release['tag_name']=='v0.58.1' and not release['draft'] and fields(release)==fields(oldrelease) and len(release['assets'])==9
assert load(A/'after-http-authorities/tag-object.json')['object']['sha']==source and load(A/'after-http-authorities/tag.json')['object']['sha']=='a055a08d6f53600276abdf8291d08313c3baf413'
keyrows=[]
frozenManifest=load(inputs/'manifest.json');assert frozenManifest['sourceRevision']==source and frozenManifest['version']=='v0.58.1'
frozen={r['path']:r for r in frozenManifest['files']}
for file in ['game/couch/relay-rescue.html','game/couch/relay-rescue.mjs']:
 raw=subprocess.check_output(['git','show',source+':'+file],cwd=R);digest=sha(raw)
 versioned=expected['releases/v0.58.1/site/'+file];assert versioned['sha256']==frozen[file]['sha256'] and versioned['bytes']==frozen[file]['bytes']
 keyrows.append({**versioned,'basis':'Exact published frozen manifest row, already checked against its actual HTTP result'})
 if file.endswith('.mjs'):
  for path in [file,'releases/v0.58.1/site/'+file]:assert expected[path]['sha256']==digest and expected[path]['bytes']==len(raw)
  keyrows.append({**expected[file],'basis':'Root and versioned JavaScript both equal c930 Git source'})
 else:keyrows.append({**expected[file],'basis':'Root HTML is a generated compatibility bridge, distinct from source and built versioned HTML; checked against exact hosted inventory and actual HTTP result'})
rec={'status':'PASS_INDEPENDENT_SCOPED_CORRECTION_REVIEW','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'v0.58.1','source':source,'publisher':publisher,'deployment':6474632693,'nativeOriginals':36,'nativeObservations':14,'allNativeOriginalHashesVerified':True,'keyImagesActuallyViewed':['06-team-muted-note-visible.png','10-paused-muted13-note.png','11-paused-note-scrolled-visible.png','12-portrait-paused-note.png','13-short-landscape-paused-note.png'],'scopedCorrectionBlockers':[],'acceptanceRecommendation':'No blocker to closing the scoped P02-A correction when composed with separately retained original v0.58.0 P02-A evidence and c930 source qualification. Root owns phase acceptance; this review does not write acceptance.','publicByteProof':{'files':2530,'bytes':637630752,'attempts':2530,'failedOrRetriedOrSkipped':0,'everyRecordedRowReconciled':True,'retainedAuthoritiesMatch':True,'keySourceAndPublicRows':keyrows},'observationLimits':['Before-scroll note was offscreen or clipped, including screenshot10. Screenshot11 shows it after actual inner panel scroll. No claim that all explanatory text is always visible.','DOM/AX state confirms displayed PAUSED and 0:00, not private simulation checkpoint equality.','Keyboard edits, pointer entry and native mouse scrolling; viewport changes are not physical hardware.','No new browser, test, listening, media-volume measurement, storage-refusal injection or offline run by this reviewer.','P03/P07 story exit focus; P03/P05 scroll/layout/native presentation; P02-B Team producer/custom playlists/album/offline media; P18 physical hardware and broad qualification remain separate.'],'originalReviewHash':sha((N/'review.json').read_bytes()),'publicReportHash':sha((A/'tools/runs/complete-1/report.json').read_bytes()),'newBrowserOrTests':False,'phaseAcceptanceWritten':False,'priorReviewAttempt':'Read-only check initially assumed REST commit shape for the retained Git commit API wrapper; stopped at KeyError commit. Corrected to actual top-level tree. A later source-row assertion correctly stopped when comparing generated root HTML/built HTML with raw Git HTML. Fixed the comparison to the exact frozen manifest for versioned HTML and hosted inventory for the root compatibility bridge; JS still matches raw c930 source. No original evidence or source changes.'}
(O/'review.json').open('x').write(json.dumps(rec,indent=2)+'\n');print(json.dumps({k:v for k,v in rec.items() if k!='publicByteProof'},indent=2))
