from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parent;R=P/'run';H=lambda b:hashlib.sha256(b).hexdigest();events=[json.loads(l) for l in (R/'native-events.jsonl').read_text().splitlines()];busy=[]
for x in events:
 m=x.get('measurement')
 if not m:continue
 e={v['id']:v for v in m['elements']}
 if e['craft-preparation-status'].get('text'):busy.append({'at':x['at'],'measurement':m})
(R/'busy-original-observations.json').write_text(json.dumps(busy,indent=2)+'\n')
checks=[]
for row in busy:
 m=row['measurement'];e={v['id']:v for v in m['elements']};checks.append({'at':row['at'],'viewport':m['viewport'],'preferences':m['preferences'],'visibility':m['visibility'],'hasFocus':m['hasFocus'],'active':m['active'],'targets':[{k:e[n].get(k) for k in ['id','text','rect','centerHit','centerHitWithin','interiorHits','clientWidth','scrollWidth']} for n in ['craft-preparation-status','pack-select','shell-missions-back','craft-sticky-heading']]})
(R/'busy-geometry-summary.json').write_text(json.dumps(checks,indent=2)+'\n')
guards=[json.loads(l) for l in (R/'foreground-checks.jsonl').read_text().splitlines()];assert all(x.get('state',{}).get('visibility')=='visible' and x['state']['hasFocus'] for x in guards)
old=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test_cross_mode/.cache/cross-mode/p01/v0571/library-rail-r3-foreground-preparation/run/review.json')
review={'format':'p01-craft-heading-row-native.v1','scope':'Actual candidate0.57.2/r21 source browser, not ordinary/frozen/public qualification or P01 acceptance.','result':'LABEL_AND_BACK_PASS; LARGE_FOCUSED_SELECTOR_PARTIALLY_OBSCURED',
'actualLaunchScope':'launch.json inherited preparation caption says unlaunched; actual rootGO in pre-launch-manifest/PLAN plus server/PID/target/guards prove this authorized run. Original caption preserved, not a fictional release identity.',
'sourcePinsAtClosure':json.loads((R/'source-closure.json').read_text())['source'],
'browser':{'version':'Chrome153.0.8010.37','session':'p01-craft-heading-row','target':'19AEB6F1C36F38D69FBEDF4B78ED2DBD','url':'http://127.0.0.1:52589/game/','freshProfile':True,'explicitPageBringToFront':True,'successfulForegroundGuards':len(guards),'allVisibleFocused':True,'unexpectedPage':False,'closed':True},
'actualSelections':[{'viewport':'390×844','preferences':'Standard/Theme/full effects','body':'atlas-pottery-courier-v1','busyAt':'2026-09-15T14:12:38.372Z','evidence':['01-standard-portrait-setup.json','02-standard-portrait-completed.json','03-standard-portrait-selector-focus.json']},{'viewport':'844×390','preferences':'Standard/Theme/full effects','body':'atlas-carved-chest-v1','busyAt':'2026-09-15T14:12:41.969Z','evidence':['04-standard-landscape-completed.json','05-standard-landscape-selector-focus.json']},{'viewport':'844×390','preferences':'Large/Plain/Reduced','body':'atlas-bell-warden-v1','busyAt':'2026-09-15T14:13:50.917Z','evidence':['06-large-landscape-setup.json','07-large-landscape-completed.json','08-large-landscape-selector-focus.json']},{'viewport':'390×844','preferences':'Large/Plain/Reduced','body':'atlas-woven-basket-v1','busyAt':'2026-09-15T14:13:55.309Z','evidence':['09-large-portrait-completed.json','10-large-portrait-selector-focus.json']},{'viewport':'390×844','preferences':'Large/Plain/Reduced','body':'atlas-pottery-courier-v1 (previously selected)','busyAt':'2026-09-15T14:13:58.257Z','evidence':['11-large-portrait-cached-return.json'],'limit':'Actual return to previously used body. Native work/cleared terminal observed; HTTP cache-hit not measured and not claimed.'}],
'passed':[
 'Heading-row correction makes actual Loading craft and scene artwork label visible at all four viewport/preferences cells and repeated body selection. Center and all four interior corner hits belong to original status; Back likewise visible with44px Standard/47px Large size.',
 'Standard first enabled pack selector after native Flight setup stays fully clear: all four interior corners and center hit original select at both sizes. Original activeElement remains pack-select.',
 'Natural completion clears/hides status. No synthetic busy/error state, artificial latency or app mutation used.',
],
'requiredRemainingDefects':[{'case':'Large portrait heading expansion covers focused selector top','evidence':['busy-original-observations.json','busy-geometry-summary.json'],'at':['2026-09-15T14:13:55.309Z','2026-09-15T14:13:58.257Z'],'geometry':'Header y16–294.359375; focused pack-select y274.34375–319.34375,height45. Its top interior corners y278.34375 hit shell-craft-feedback. Center/lower points reach select, but approximately20px of focused control is covered.','impact':'The newly visible feedback shares the heading correctly, but expanding that heading still requires keeping the focused field fully in the available content region.'},{'case':'Large landscape footer covers focused selector bottom','at':'2026-09-15T14:13:50.917Z','geometry':'Focused pack-select y274.34375–319.34375,height45. Its lower interior corners y315.34375 hit shell-deploy-bar; top and center remain select. Heading ends200.578125.','impact':'Focus placement needs to respect the actual space between heading and sticky deploy footer, not only the top edge.'}],
'evidenceCategories':{'busy':'Five original actual status MutationObserver measurements with geometry/hit-tests/visible focused target. Not busy screenshots.','screenshots':'11 ordinary original browser screenshots are independently timed after actions; short busy work normally completed before capture. No image alteration.','keyboardAndSelection':'Browser UI activation/selection, explicit original selector focus and native Enter on Flight setup. No physical device/controller claim.','sourceTests':'Root reports59focusedtests PASS; no tests run by this reviewer, native error/stale branches not synthesized.'},
'stopped':['Direct brief entry not attempted after required focus obstruction found.','No further exploration, native error/cancel/zoom or expanded matrix after inspecting failed Large interior hits.','Library final foreground proof reused, not replayed.'],
'libraryProof':{'path':str(old),'sha256':H(old.read_bytes()),'scope':'Successful portrait detail/Close/reopen subsection; previous craft failure remains separate history.'},
'closure':'source-closure.json/process-closure.json/exit.json:14sourcepinsunchanged; Chrome27416+observer28068exit0, server27367exit143;52589/52593closed. No tracked edits/build/Git/release.','rootFollowup':'Measured focus-visible placement between shared heading and deploy bar, or equivalent correction, requires new source/tests/GO. No recipe/P01 acceptance claimed.'}
(R/'review.json').write_text(json.dumps(review,indent=2)+'\n')
(R/'review.md').write_text('''# Craft heading-row retest — label fixed, focus still blocked

Actual loading feedback and Back are now visible at390×844 and844×390 in Standard and Large/Plain/Reduced. All status/Back center and corner hits pass. Standard first-selector focus is fully clear.

Large text exposes remaining focused-control overlap. Portrait heading expansion ends at294.36px while focused Pack begins274.34px; its top corners hit the feedback row. Landscape Pack ends319.34px and its lower corners hit the sticky deploy bar. Its center remains clickable, but the entire focused control is not visible. Five actual transient preparation measurements, including a return to a previously selected body, preserve the geometry. Screenshots were taken after actions and do not claim to show the naturally short busy interval.

Stopped before the direct brief case. All foreground guards passed; no unexpected page. All owned browser/server/observer processes are closed and14 launch source pins match at closure. No source edits or builds. The earlier successful Library closure is reused. Candidate0.57.2/r21 remains unqualified for this remaining focus issue; no P01/public acceptance is claimed.
''')
rows=[]
for f in sorted(P.rglob('*')):
 if not f.is_file() or 'profile' in f.relative_to(P).parts or f.name=='evidence-manifest.json':continue
 b=f.read_bytes();rows.append({'path':f.relative_to(P).as_posix(),'bytes':len(b),'sha256':H(b)})
manifest={'scope':review['scope'],'result':review['result'],'files':rows,'fileCount':len(rows),'totalBytes':sum(x['bytes'] for x in rows),'excluded':['run/profile/**']};(R/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for row in rows:
 b=(P/row['path']).read_bytes();assert H(b)==row['sha256'] and len(b)==row['bytes']
print(json.dumps({'fileCount':len(rows),'totalBytes':manifest['totalBytes'],'foregroundGuards':len(guards),'reviewSha256':H((R/'review.json').read_bytes()),'manifestSha256':H((R/'evidence-manifest.json').read_bytes())},indent=2))
