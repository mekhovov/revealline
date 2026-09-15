from pathlib import Path
import json,hashlib,datetime,subprocess,os,socket,shutil
P=Path(__file__).resolve().parent;R=P/'run';root=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test_cross_mode')
sha=lambda b:hashlib.sha256(b).hexdigest()
pidfile=Path.home()/'.agent-browser/p01-library-rail-r3.pid';daemon=[]
if pidfile.exists():
 pid=int(pidfile.read_text());cmd=subprocess.run(['ps','-p',str(pid),'-o','command='],capture_output=True,text=True).stdout.strip();daemon.append({'pid':pid,'command':cmd,'action':'SIGTERM owned attached daemon after Browser.close'})
 if cmd.endswith('/agent-browser/bin/agent-browser-darwin-arm64'):os.kill(pid,15)
files=json.loads((P/'config.json').read_text())['files'];pins=[]
for f in files:
 b=(root/f['path']).read_bytes();h=sha(b);expected='9fc7ae8e3bd699cabb17681e4d1fd5203f08fd3beb53db609640635fb1b8b3b5' if f['path'].endswith('/library-panel.mjs') else f['candidateSha256'];assert h==expected
 pins.append({'path':f['path'],'bytes':len(b),'sha256':h,'finalSourceUnchanged':True})
processes=[]
for pid in [1222,1343,1680,3045]:
 q=subprocess.run(['ps','-p',str(pid),'-o','command='],capture_output=True,text=True);assert not q.stdout.strip();processes.append({'pid':pid,'alive':False})
ports=[]
for port in [51549,51551]:
 with socket.socket() as s:s.settimeout(.5);connected=s.connect_ex(('127.0.0.1',port))==0
 assert not connected;ports.append({'port':port,'acceptsConnections':False})
closure={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourcePins':pins,'processes':processes,'ports':ports,'daemon':daemon,'freeBytes':shutil.disk_usage(P).free,'noTrackedEditsByReviewer':True}
(R/'closure.json').write_text(json.dumps(closure,indent=2)+'\n')
phases=json.loads((R/'final-native-busy-phases.json').read_text());capacities=[json.loads(s) for s in (R/'capacity.jsonl').read_text().splitlines()]
review={
'scope':'Bounded actual source-browser R3 correction trial. Not ordinary-build/frozen/public qualification; not P01 acceptance.',
'result':'FOCUS_CORRECTION_PASSED_IN_CLEAN_LANDSCAPE_PHASE; LATE_FOREGROUND_CHECKS_PROVISIONAL',
'root':'/Users/oleksandr.mekhovov/work/my_projects/go_test_cross_mode','sourcePins':pins,
'sourceTransition':'01–03 used preliminary R3 SHA2ee2ced9; source-transition.json records root final clamp before owned-page reload. 04 onward loaded final SHA9fc7ae8e. Preliminary results are not final-candidate claims.',
'browser':{'version':'Chrome153.0.8010.37','profile':'Fresh owned run/profile (not r2 reused)','session':'p01-library-rail-r3','url':'http://127.0.0.1:51549/game/','pageTarget':'28DE98CF2CFE53A93DCB238231B89A9C','closed':True},
'passedCleanChecks':[
 {'case':'Same failing Large Plain Reduced 844×390 export/refocus','evidence':['04-final-large-landscape-before.json','05-final-large-landscape-terminal.json','06-final-large-landscape-refocused.json','06-whole-target-hit-test.json'],'actual':'Focused original export-backup y288.421875–335.421875, rail ends225.75. All four corners and center hit original button. Active node stays export-backup; dialog scrollTop431.'},
 {'case':'Landscape full terminal keyboard reading','evidence':['07-final-keyboard-detail-pagedown.json','08-final-keyboard-detail-arrow.json'],'actual':'Native focus on existing detail region then PageDown reaches scrollTop9 for165px content/156px client. ArrowDown exits to native Close navigation.'},
 {'case':'Resize final terminal to390×844 and back844×390','evidence':['09-final-resized-large-portrait.json','10-final-resized-large-landscape.json','10-resize-stability-frames.json'],'actual':'Original Export remains focused, visible and center-hit reachable in both sizes. Landscape button y233.421875–280.421875 vs rail bottom225.75. 60 consecutive animation frames retain scrollTop486 and same focus; no oscillation.'},
 {'case':'Manual native wheel does not snap back','evidence':['native-wheel-input.json','11-final-manual-wheel.json','11-manual-wheel-stability-frames.json'],'actual':'Exact-owned CDP native mouseWheel at700,320 deltaY200 moves dialog486→686.90 frames remain686; focused original Export unchanged. Deliberate manual scroll is not undone.'},
 {'case':'Real active feedback landscape','evidence':['final-native-events.jsonl','final-native-busy-phases.json','final-landscape-export-original.json'],'actual':'Real reading→verification→download phases,47px Cancel/Stop inside viewport at y88.75–135.75. Original native download795bytes. Busy lasted approximately155ms; passive real DOM observations, no busy screenshot/Cancel-consumption claim.'}
],
'lateProvisionalChecks':[
 {'case':'Escape and reopen','evidence':['12-final-native-escape.json','13-final-native-reopen.json'],'observed':'Exact target Escape closes Library and restores settings-saves focus, original save-status parent library-saves and rail.hidden true. Reopen remains clear. Native foreground status at these instants was not captured, so not claimed as clean foreground qualification.'},
 {'case':'Portrait real export/terminal/refocus','evidence':['14-final-large-portrait-before.json','15-final-large-portrait-terminal.json','16-final-large-portrait-refocused.json','final-portrait-export-original.json'],'observed':'Exact target real export795bytes; active Cancel47px at y213.484375–260.484375; terminal rail visible; refocused original Export y652.453125–699.453125 below rail393.59375. Foreground state is unproven after unexpected tab, so geometry/native-input outputs retained without clean foreground-focus pass.'}
],
'limitsAndFailedAttempts':[
 '17 portrait PageDown left detail scrollTop0 for363px content/338px client. 18 requestAnimationFrame sampler stalled. Direct owned CDP18-direct-read-only-state.json proves game visibility hidden although document.hasFocus true. targets-at-close.json contains unexpected chrome://settings/help tab. Its creation time/cause was not observed; no agent command in this run intentionally opened it. Do not infer product keyboard defect or full portrait reading pass.',
 'Landscape completed frame samples through13:50:40 demonstrate normal rendering for prior clean checks. Later foreground checks remain provisional; exact contamination onset is unknown.',
 'Stopped hanging read-only client with retained interruption receipt, preserved empty partial frames file. No additional input matrix after discovery.',
 'No native200% zoom, Cancel/Stop consumption, touch gesture, physical controller, saved-attempt export, Packs/transfer or five-file backup readiness tested in this trial.',
 'Standard styling was not repeated in R3; r2 Standard geometry remains historical evidence only. No fake delay, cached status, seeded game state or intercepted API used.',
 'Screenshots and JSON are separate samples with actual timestamps; they need not capture identical intermediate native counts/phases.'
],
'capacities':{'maxProfileBytes':max(x['profileBytes'] for x in capacities),'minProjectedReserveBytes':min(x['projectedReserveBytes'] for x in capacities),'requiredReserveBytes':536870912},
'closure':'closure.json and exit.json; exact owned browser/server/observers closed; four final runtime bodies unchanged.',
'finalClaim':'R2 blocking focus obstruction is corrected for the exact clean Large landscape sequence, with resize and manual-scroll corroboration. Remaining foreground portrait/close/zoom/Cancel requirements are not silently treated as passed.'}
(R/'review.json').write_text(json.dumps(review,indent=2)+'\n')
(R/'review.md').write_text('''# R3 Library operation rail: bounded native correction trial

The original Large landscape focus obstruction is corrected in final source SHA `9fc7ae8e…1b8b3b5`. The focused Export button is entirely below the rail, all four corners and center hit the same original button, resizing preserves focus and visibility, and a real mouse-wheel scroll is not snapped back. Landscape PageDown reaches the final line of the bounded detail region.

This is an uncommitted source-browser trial, not ordinary/frozen/public qualification or P01 acceptance. Root changed the preliminary R3 clamp after the first three captures; those originals are retained, and only captures04 onward use the final source after an owned-page reload.

The later portrait/close/reopen results are provisional. Exact-target screenshots and native exports exist, but the portrait frame-reading sample stalled because the actual game page became hidden. Closure retained an unexpected About Chrome tab in the owned profile. Its origin and precise creation time are unknown. No product keyboard defect is inferred, and no clean foreground portrait reading, native zoom, or consumed Cancel pass is claimed. Read `review.json` for exact evidence and bounds.

All owned processes are closed. Runtime bodies were rehashed unchanged at closure. No tracked edits, build, Git or release operations were performed by this reviewer. All originals, including preliminary/partial attempts, are retained; the browser profile is excluded from the manifest.
''')
selected=[]
for f in sorted(P.rglob('*')):
 if not f.is_file() or 'profile' in f.relative_to(P).parts or f.name=='evidence-manifest.json':continue
 b=f.read_bytes();selected.append({'path':f.relative_to(P).as_posix(),'bytes':len(b),'sha256':sha(b)})
manifest={'scope':review['scope'],'result':review['result'],'files':selected,'fileCount':len(selected),'totalBytes':sum(x['bytes'] for x in selected),'excluded':['run/profile/**'],'previousR2EvidenceUntouched':True}
(R/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for x in selected:
 b=(P/x['path']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256']
print(json.dumps({'count':len(selected),'bytes':manifest['totalBytes'],'reviewSha256':sha((R/'review.json').read_bytes()),'manifestSha256':sha((R/'evidence-manifest.json').read_bytes()),'closure':closure},indent=2))
