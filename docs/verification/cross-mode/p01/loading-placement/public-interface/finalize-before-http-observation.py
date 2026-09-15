from pathlib import Path
import json,hashlib,collections,datetime,subprocess
R=Path(__file__).resolve().parent
H=lambda b:hashlib.sha256(b).hexdigest()
def read(n):return json.loads((R/n).read_text())
def obs(n):return json.loads(read(n)['stdout'])
def el(d,n):return next(e for e in d['elements'] if e['id']==n)
def storage(d):return {x['key']:x['sha256'] for x in d['storage']}
def pin(p):
 b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':H(b)}
pre=obs('041-before-first-flight.json');back=obs('057-return-visible-state.json');cached=obs('084-retention-result.json')
assert storage(pre)==storage(back)==storage(cached)
for d in [pre,back,cached]:
 assert [el(d,n)['value'] for n in ['theme-select','class-select','body-select']]==['fpv','scout','heavy-lift']
apply=obs('121-controller-applied.json');cancel=obs('131-controller-cancelled.json')
assert storage(apply)==storage(cancel)
assert el(apply,'controller-settings-root-status')['text']=='Controller settings applied.'
assert el(cancel,'controller-settings-root-status')['text']=='Draft cancelled. Current controller settings are unchanged.'
assert el(obs('136-final-title.json'),'soundtrack-summary')['text']=='Quiet Orchard · paused'
health=read('online-1-cdp.jsonl.health.json');assert health['state']=='stopped' and not health['capped']
assert read('139-closure-verification.json')['browserAndObserverClosed']
rows=[json.loads(l) for l in (R/'online-1-cdp.jsonl').read_text().splitlines()]
counts=dict(collections.Counter(x.get('event') for x in rows));capacity=[json.loads(l) for l in (R/'online-1-capacity.jsonl').read_text().splitlines()]
assert not any('exception' in x.get('event','').lower() for x in rows)
assert not any(x.get('event')=='response' and x.get('status',200)>=400 for x in rows)
files=[p for p in sorted(R.iterdir()) if p.is_file() and p.name not in ['review.json','review.md','manifest.json','finalize-review.py']]
assert all(p.stat().st_size<6*1024*1024 for p in files)
review={
 'reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'scope':'Bounded actual public native-interface observations in an isolated Chromium profile; P01 is not accepted and the confirmed craft-loading placement failure remains a published v0.57.1 finding.',
 'authority':read('authorization.json'),
 'outcome':'REQUIRED_CRAFT_FEEDBACK_DEFECT_FOUND; remaining sampled interface operations completed within stated limits',
 'inputs':{'device':'Native browser click, select, scroll and explicit target bringToFront; no physical device','viewports':[[1280,800],[390,844],[844,390]],'nativeZoom':False,'pageTarget':'42A5C65D96BC4675CC1BDCBEE6C2FB9A','visibility':'Early hidden/hasFocus interval excluded; visible-page retests and all subsequent input boundaries explicitly guarded; other browsers closed before final family checks.'},
 'cases':[
  {'id':'selectors-craft','result':'FAIL_REQUIRED_P01','evidence':['029-visible-craft-state.json','030-select-scout.json','031-select-heavy-lift.json','032-craft-changed.json','033-craft.png','034-craft-terminal.json','035-craft-ancestry.json'],'facts':'Actual FPV Heavy Lift selection begins Loading craft and scene artwork with data-state busy. At1280x800 status rect y777.484375..797.78125 is outside the top-layer Missions dialog; its center hits shell-deploy-bar, not status. Selected body remains visible and eventually ready. No injected delay or asset mutation. Screenshot is subsequent placement evidence; DOM observation establishes the busy boundary.','sourceOwner':'Root app/index/game-shell presentation. Frozen source index.html:459 leaves status in arena-panel; app.mjs:1120 binds the single cosmetic presenter; game-shell.mjs moves flight-deck but not this status.','recommendation':'Move the same live status into an explicit Missions top-layer feedback slot while Missions is open, with restored original placement on actual close/destroy and delayed-close fence; preserve renderer generation ownership, pause/focus and native input. Root is correcting this separately; corrected source and public retest not claimed here.'},
  {'id':'first-flight','result':'PASS_BOUNDED','evidence':['041-before-first-flight.json','043-first-flight-entry-state.json','048-lesson-playing.json','049-lesson-playing.png','057-return-visible-state.json','063-cached-course-entry.json','074-cached-playing-exit.json','084-retention-result.json'],'facts':'Cold and repeated cached route entry observed boot-loading then ready and actual running lesson. Native Return after visible course controls restored FPV/scout/heavy-lift, exact library and last-selection byte hashes. Initial offscreen or briefing-obscured locator attempts are retained and excluded; actual return used visible controls after Start and native scroll. No lesson completion or reward claim.','retainedStorage':storage(pre)},
  {'id':'storage-retention','result':'PASS_TRUTHFUL_BROWSER_REFUSAL','evidence':['082-game-data-snapshot.json','083-retention-request.json','084-retention-result.json','085-retention.png'],'facts':'Native Keep downloads request completed with Not granted by this browser. Downloads may be removed; keep backups. Notice visible at y521.56..541.86;44px request button remained reachable. No permission override; transient asking state was too fast to capture.'},
  {'id':'soundtrack','result':'PASS_BOUNDED_BUILTIN_TRANSPORT; DELAYED_MP3_PREPARE_STOP_NOT_EXERCISED','evidence':['089-music-immediate.json','092-music-stop-state.json','094-library-snapshot.json','098-playlist-used-state.json','100-studio-playing.json','101-studio-pause.json','104-studio-portrait.png','105-studio-portrait-state.json','106-studio-status-observe.json','108-studio-closed.json','136-final-title.json'],'facts':'Built-in synth Play reported playing; actual Music Studio Play/Pause and selecting/saving Ambient playlist worked. Portrait studio notice, now-playing and pause/close controls remained readable. Studio Close returned to Settings focus soundtrack-open; final title reports Quiet Orchard paused. The step091 label says stop but clicked ready-state Play again and did not stop; only step101 Pause proves transport stop. Built-in synth library has no eligible MP3 audition; imports expressly excluded in this family. Preparing selected music was sampled in the underlying settings summary at098, but active studio busy-paint geometry was not captured; do not count that as visible delayed-preparation proof. No audibility, hardware codec or master-mute claim.'},
  {'id':'controller-settings','result':'PASS_BOUNDED_APPLY_CANCEL','evidence':['114-controller-draft-state.json','119-controller-apply-visible.json','121-controller-applied.json','122-controller-applied.png','129-controller-landscape-before-cancel.json','131-controller-cancelled.json','132-controller-cancelled.png','136-final-title.json'],'facts':'Native generic→Xbox Apply committed with visible Controller settings applied notice in390x844; reopened PlayStation draft then Cancel at844x390 retained exact committed library/selection hashes and visible cancellation notice. Actions are44px or larger. Form required native container scrolling; Close reachable after scroll-top and returned focus shell-options. Apply/Cancel hide their active button and activeElement ID becomes empty; no keyboard-only or new focus-restoration claim. No physical controller attached.','committedStorageAfterApplyAndCancel':storage(apply)}
 ],
 'limits':['No exhaustive menus, 200% native zoom, physical touch/controller, offline or installed-original media checks in this family. Prior full public byte audit and separate core/source evidence remain separate.','The initial hidden-page interval, malformed select command, offscreen/briefing-obscured locator attempts and wrong default-scroll target are retained; do not treat them as source product failures or accepted visual evidence. No F1/help/settings/zoom/global OS commands; isolation-chronology.json records exact actions and target.','This original public target has the separately documented Library placement defect. This family did not re-exercise Library and does not accept a later fix.','No API or app-state injection, fixtures/imports, storage clearing, permission grants, throttling, source changes or public writes. Existing procedural synth paths are not real MP3 decode/cancel evidence.'],
 'observer':{'counts':counts,'bytes':(R/'online-1-cdp.jsonl').stat().st_size,'runtimeExceptions':0,'httpResponsesAtLeast400':0,'capped':False,'stopReason':health['reason'],'minimumFreeBytes':min(x['freeBytes'] for x in capacity),'maximumProfileBytes':max(x['profileBytes'] for x in capacity),'explicitClosure':read('139-closure-verification.json')},
 'phaseAccepted':False,'correctedSourceAccepted':False,
}
# Resolve descriptive names from exact retained numbered receipts; no omitted originals.
for case in review['cases']:
 fixed=[]
 for name in case['evidence']:
  if (R/name).exists():fixed.append(name);continue
  matches=list(R.glob(name.split('-')[0]+'-*.json'))
  assert len(matches)==1,(name,matches)
  fixed.append(matches[0].name)
 case['evidence']=fixed
with (R/'review.json').open('x') as f:json.dump(review,f,indent=2);f.write('\n')
md='''# Public v0.57.1 interface sample\n\nOne required P01 defect was found: craft-loading feedback remains behind the Missions modal. Native retests after page visibility was restored prove the loading owner runs and the notice is obscured. Root owns the correction; this report does not qualify the corrected source or accept P01.\n\nFirstFlight cold/cached entry and actual lesson return preserved exact game setup and library/selection bytes. Storage retention returned a visible browser refusal. Built-in soundtrack Play/Pause, playlist selection and portrait notices worked; real delayed MP3 preparation/cancel was not exercised because imports were excluded and the fresh library exposes procedural tracks. Controller Apply/Cancel retained the committed settings with readable portrait/landscape results.\n\nNative Chromium viewports:1280×800,390×844,844×390. Physical devices, audible quality, native zoom, offline and exhaustive input navigation are outside this sample. Initial hidden-page and offscreen/obscured locator attempts are preserved and excluded. Step091 is labelled stop but its ready-state Play action did not stop playback; step101 is the actual Pause proof.\n\nThe observer remained healthy and uncapped; no runtime exception or HTTP response>=400 was observed. Exact owned browser/collector/session are closed, profile game data retained. `review.json` contains the precise evidence map, authority, byte comparisons and limitations; `manifest.json` pins all retained small originals and helper source.\n'''
with (R/'review.md').open('x') as f:f.write(md)
files += [R/'review.json',R/'review.md',R/'finalize-review.py']
manifest={'createdAt':review['reviewedAt'],'scope':'All completed top-level interface originals/helpers; no profile, payload, current browser state or prior public audit duplication.','files':[pin(p) for p in sorted(files)],'filesCount':len(files),'totalBytes':sum(p.stat().st_size for p in files)}
with (R/'manifest.json').open('x') as f:json.dump(manifest,f,indent=2);f.write('\n')
for q in manifest['files']:
 b=Path(q['path']).read_bytes();assert len(b)==q['bytes'] and H(b)==q['sha256']
print(json.dumps({'review':pin(R/'review.json'),'manifest':pin(R/'manifest.json'),'files':manifest['filesCount'],'bytes':manifest['totalBytes']}))
