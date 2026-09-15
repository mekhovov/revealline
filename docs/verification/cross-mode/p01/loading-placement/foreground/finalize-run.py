from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parent;R=P/'run';H=lambda b:hashlib.sha256(b).hexdigest();events=[json.loads(x) for x in (R/'native-events.jsonl').read_text().splitlines()];craft=[];library=[]
for event in events:
 m=event.get('measurement')
 if not m:continue
 e={v['id']:v for v in m['elements']}
 if e['craft-preparation-status'].get('text'):craft.append({'at':event['at'],'measurement':m})
 if e['save-status'].get('state')=='busy':library.append({'at':event['at'],'measurement':m})
(R/'craft-busy-original-observations.json').write_text(json.dumps(craft,indent=2)+'\n');(R/'library-busy-original-observations.json').write_text(json.dumps(library,indent=2)+'\n')
guards=[json.loads(x) for x in (R/'foreground-checks.jsonl').read_text().splitlines()];assert all(x.get('state',{}).get('visibility')=='visible' and x['state']['hasFocus'] and not x.get('unexpectedPages') for x in guards)
prior=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test_cross_mode/.cache/cross-mode/p01/v0571/library-rail-r3-native/run/review.json');closure=json.loads((R/'closure.json').read_text())
review={
'format':'p01-candidate-library-craft-native.v1','scope':'Actual source browser on candidate0.57.2/r20. No built release metadata, ordinary/frozen/public qualification or P01 acceptance.',
'result':'LIBRARY_FOREGROUND_CLOSURE_PASS; CRAFT_VISIBILITY_BLOCKED',
'sourceAtClosure':closure['sourcePins'],
'foreground':{'session':'p01-library-r3-foreground','browser':'Chrome153.0.8010.37','profile':'Fresh run/profile','target':'9EBC601FD4277A3A1DE92F091C4A4489','url':'http://127.0.0.1:52171/game/','explicitPageBringToFront':True,'successfulBeforeAfterGuards':len(guards),'allVisibleAndFocused':True,'unexpectedPages':False,'nativeViewport':'390×844 and844×390 CSS viewport; not physical-device evidence'},
'libraryChecks':[
 {'case':'Portrait full detail keyboard read','passed':True,'evidence':['01-library-portrait-before.json','02-library-portrait-terminal.json','03-library-detail-focused.json','04-library-detail-pagedown.json'],'result':'Actual native game-data export. Foreground focused region PageDown moves0→25 for363px content/338px client; bottom is reached. Same original status in rail. Message horizontal scrollWidth=clientWidth314; label284=284; no horizontal overflow. Vertical clipping is intentional bounded reading area.'},
 {'case':'Keyboard Close and Escape','passed':True,'evidence':['05-library-keyboard-close-focus.json','06-library-escaped.json'],'result':'Native ArrowDown moves to Close;44px control is fully in viewport and center-hit reachable. Escape closes Library, restores settings-saves focus, parks save-status in library-saves and hides rail.'},
 {'case':'Reopen clears old presentation','passed':True,'evidence':['07-library-reopened.json'],'result':'Native Settings Saves trigger reopens Library. Rail remains hidden; original save-status remains library-saves. Exact page visible and focused before/after every action.'},
 {'case':'Real active phase visibility','passed':True,'evidence':['library-busy-original-observations.json','native-events.jsonl','downloads/revealline-complete-backup.json'],'result':'Native reading/verification/download phases retained. Actual completed export bytes preserved. Busy transient observation is not a busy screenshot or consumed Cancel claim.'}
],
'craftDefect':{'required':True,'evidence':['craft-busy-original-observations.json','craft-stacking-state.json','native-events.jsonl','08-craft-large-portrait-setup.json','09-craft-large-portrait-result.json','10-craft-large-portrait-setup-focus.json','11-craft-large-landscape-result.json'],'actual':'Real browser form selection of atlas-pottery-courier-v1 at390×844 and atlas-carved-chest-v1 at844×390 produces Loading craft and scene artwork. Status is correctly relocated into Missions but remains under the existing opaque sticky heading. Both slots use top0; heading z-index5 covers craft slot z-index3. Pointer-events are auto, so failed hit test is actual covering content, not deliberate click-through.','portrait':{'at':'2026-09-15T14:07:49.218Z','labelBounds':'x37/y25–51.09375','slotBounds':'y16–60.09375','centerHit':'shell-missions-context','firstEnabledSetupControl':'pack-select y274.34375–319.34375; center hit pack-select; active unchanged'},'landscape':{'at':'2026-09-15T14:08:22.925Z','labelBounds':'x55/y33–59.09375','centerHit':'shell-missions-context','firstEnabledSetupControl':'pack-select y274.34375–319.34375; center hit pack-select; active unchanged'},'qualificationLimit':'Busy phases are actual passive DOM/geometry observations. Ordinary screenshots were taken after completion and do not visually display the short loading interval. No synthetic delays/state or forced error. The repeat at second viewport establishes same native overlap; no further matrix after confirmation.'},
'reusedCleanLandscapeProof':{'path':str(prior),'sha256':H(prior.read_bytes()),'scope':'FinalR3 landscape Export focus/hit-test, full PageDown, resize and manual-wheel non-snap checks; later provisional subsection remains excluded.'},
'unperformedOrLimited':['Craft Standard cells, deliberately failed load, cached-result geometry and direct-brief transition were stopped after required overlap. Normal successful preparation clears/hides status; no terminal error was manufactured.','No native200%zoom, physical controller/touch, consumed Cancel/Stop, transfer/recovery or earned-artwork acceptance in this source trial.','Productionr20 screen-recipe acceptance blocked by craft geometry. Library success does not approve other screens.','No tracked edits, build, Git, release or production mutation by reviewer. Root now owns corrective patch.'],
'closure':'closure.json:all14 source pins match launch; Chrome32679 and observer33042 exited0, server32505 exited143,ports52171/52172closed. Profile excluded.','rootNextStep':'Root plans craft row inside existing sticky heading; new source/tests/GO required before retry.'}
(R/'review.json').write_text(json.dumps(review,indent=2)+'\n')
(R/'review.md').write_text('''# Candidate0.57.2/r20: Library passed; craft feedback blocked

The final Library foreground gap is closed. At390×844 Large/Plain/Reduced, native PageDown reaches the complete363px message in its338px reading area. There is no horizontal overflow (message314/314, label284/284). Native keyboard Close is44px and reachable; Escape restores the Settings trigger and original status parent, and reopening leaves no stale rail. Every exact-target before/after guard recorded visible+focused, with no extra page.

Craft feedback still has a required defect. During actual artwork preparation in both390×844 and844×390, its label is covered by the existing opaque sticky Missions heading. Native center hit resolves to shell-missions-context. The heading is top0/z5; the new slot is top0/z3. The first enabled setup selector remains clear. The original transient DOM measurements establish the overlap; terminal screenshots miss the naturally short loading phase and are not busy-image evidence.

Stopped the remaining craft matrix. No fake waits, status, release flags or app state. Standard/error/cached/direct-brief cases remain unqualified. All owned processes are closed and14 launch source pins rehashed unchanged. Root may apply the next correction. This source trial is not an ordinary/frozen/public release qualification or P01 acceptance.
''')
rows=[]
for f in sorted(P.rglob('*')):
 if not f.is_file() or 'profile' in f.relative_to(P).parts or f.name=='evidence-manifest.json':continue
 b=f.read_bytes();rows.append({'path':f.relative_to(P).as_posix(),'bytes':len(b),'sha256':H(b)})
m={'scope':review['scope'],'result':review['result'],'files':rows,'fileCount':len(rows),'totalBytes':sum(x['bytes'] for x in rows),'excludes':['run/profile/**'],'preserves':['r2 originals','firstR3 originals','pre-go preparation manifest']};(R/'evidence-manifest.json').write_text(json.dumps(m,indent=2)+'\n')
for row in rows:
 b=(P/row['path']).read_bytes();assert H(b)==row['sha256'] and len(b)==row['bytes']
print(json.dumps({'fileCount':len(rows),'totalBytes':m['totalBytes'],'guards':len(guards),'reviewSha256':H((R/'review.json').read_bytes()),'manifestSha256':H((R/'evidence-manifest.json').read_bytes())},indent=2))
