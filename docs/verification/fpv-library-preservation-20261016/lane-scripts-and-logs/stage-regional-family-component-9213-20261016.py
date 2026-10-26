from pathlib import Path
import json,hashlib,subprocess,socket
stage=Path('/Volumes/alex/CodexMigrationStaging/fpv-temp/regional-family-component-review-9213');stage.mkdir(exist_ok=False)
web=stage/'web';web.mkdir();runtime=Path('/Volumes/alex/CodexMigrationStaging/fpv-package-qualification-20261014/regional-family-library-81c0d658/functional-check');assert (runtime/'optional-practice/civilian-fpv/regional-library.mjs').is_file();(web/'runtime').symlink_to(runtime,target_is_directory=True)
html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="default-src 'self';script-src 'self';style-src 'self';img-src 'self' data:;connect-src 'none';object-src 'none';worker-src 'none';frame-src 'none';base-uri 'none';form-action 'none'"><title>Regional Library — synthetic component review</title><link rel="stylesheet" href="./runtime/optional-practice/civilian-fpv/world-style.css"><link rel="stylesheet" href="./preview.css"><script src="./runtime/game/vendor/i18next-26.4.2.min.js"></script><script type="module" src="./preview.mjs"></script></head><body class="field-kit"><main id="component-review"><h1>Regional Library component review</h1><p><strong>SYNTHETIC METADATA ONLY</strong> — exact packaged UI and stylesheet; no scenery, WebGL, database, real flight or persistence. Actions below only change this page's in-memory fixture and report requests.</p><div class="fixture-tools"><label>Language <select id="fixture-language"><option value="en">English</option><option value="uk">Українська</option></select></label><label>Fixture metadata <select id="fixture-scenario"><option value="retained">Two Desert editions saved, plus retained examples</option><option value="empty">No editions saved</option><option value="all">All offered editions saved (synthetic)</option></select></label><button id="fixture-reset" type="button">Reset synthetic metadata</button><button id="fixture-defer" type="button">Deferred refresh: preserve current Fly (5s)</button><button id="fixture-missing" type="button">Deferred refresh: current Fly unavailable (5s)</button></div><p id="fixture-phase" role="status">Preparing fixture…</p><p id="fixture-layout"></p><output id="fixture-focus">No Library action focused.</output><div id="library-boundary"><div id="library-host"></div></div><details id="fixture-log"><summary>Fixture action log</summary><pre id="fixture-actions">No actions requested.</pre></details><p>Use native Tab/Shift+Tab, Enter/Space on Versions, and the SIM's Arrow-key menu navigation. Deferred refresh first focuses the current Desert Fly, temporarily disables actions and resolves five seconds later. Keep focus still to test restoration, or move to Versions/another control to test cancellation. A subsequent confirm must keep the exact old identity or open Versions safely.</p><p>Source 81c0d6587cdb582835a64e3d69c4c130460fb11a. Normal full-player, theme, storage, offline/restart, physical hardware and public acceptance remain separate.</p></main></body></html>'''
css='''#component-review { max-width: 1120px; margin: 0 auto; padding: 12px; } #component-review h1 { font-size: 1.35rem; } #component-review .fixture-tools { display: flex; flex-wrap: wrap; align-items: end; gap: 8px; } #component-review .fixture-tools label { min-width: 0; max-width: 100%; } #component-review .fixture-tools select { max-width: 100%; } #component-review .fixture-tools button { min-height: 44px; } #fixture-focus { display: block; overflow-wrap: anywhere; border: 1px solid var(--fk-line); padding: 8px; } #component-review pre { white-space: pre-wrap; overflow-wrap: anywhere; } #library-boundary { min-width: 0; } #component-review #fixture-log > summary { min-height: 44px; padding: 10px 0; }'''
js='''import { REGIONAL_LIBRARY_PINS, mountRegionalLibrary } from './runtime/optional-practice/civilian-fpv/regional-library.mjs';
import { createFlightMenuNavigation } from './runtime/optional-practice/civilian-fpv/input.mjs';
const $ = id => document.getElementById(id), copy = value => structuredClone(value), pins = REGIONAL_LIBRARY_PINS,
  desert = pins.filter(row => row.id === 'desert-expedition-study'), actions = [];
let locale = 'en', records = [], ui, nav, pendingRead = null, timer = null, generation = 1;
const saved = (pin, active = false) => ({ id: pin.id, sha256: pin.pin.sha256, active, bytes: pin.bytes,
  descriptor: { id: pin.id, revision: 'fixture-' + pin.pin.sha256.slice(0,8), title: copy(pin.title) } });
const retained = id => ({ id, sha256: (id === 'personal-landscape' ? 'e' : 'f').repeat(64), active: false, bytes: 123,
  descriptor: { id, revision: 'fixture-retained-r1', title: { en: 'My retained landscape', uk: 'Моя збережена місцевість' } } });
const txt = (en,uk) => locale === 'uk' ? uk : en;
function log(action, id = '', hash = '') { actions.push([action,id,hash].filter(Boolean).join(' · ')); $('fixture-actions').textContent = actions.slice(-12).join('\\n'); }
function focusStatus() {
  const node = document.activeElement, root = document.getElementById('regional-world-library'),
    version = node?.closest?.('[data-region-key]'), primary = node?.closest?.('[data-region-primary]');
  $('fixture-focus').textContent = root?.contains(node) ? [
    'Actual DOM focus:', node.tagName === 'SUMMARY' ? 'Versions disclosure' : (node.dataset.regionAction ?? node.textContent),
    version?.dataset.regionId ?? primary?.dataset.regionPrimaryId ?? '',
    version?.dataset.regionKey ?? primary?.dataset.regionPrimary ?? '',
    node.isConnected ? 'connected' : 'DISCONNECTED', node.disabled ? 'disabled' : 'enabled',
  ].filter(Boolean).join(' · ') : 'No Library action focused (actual active element: ' + (node?.tagName ?? 'none') + ').';
  $('fixture-layout').textContent = 'Viewport ' + innerWidth + ' × ' + innerHeight + ' · document width ' + document.documentElement.scrollWidth + ' · ' + (document.documentElement.scrollWidth > innerWidth ? 'HORIZONTAL OVERFLOW' : 'no document horizontal overflow');
}
function baseRecords() {
  if ($('fixture-scenario').value === 'empty') return [];
  if ($('fixture-scenario').value === 'all') return pins.map((pin,i) => saved(pin, !pins.slice(i+1).some(other => other.id === pin.id)));
  return [saved(desert[0]), saved(desert.at(-1), true), retained(desert[0].id), retained('personal-landscape')];
}
const store = {
  list: async () => pendingRead ? pendingRead.promise : copy(records),
  inspect: async pin => { log('Fixture inspect request', '', pin.sha256); return { descriptor: saved(pins.find(row => row.pin.sha256 === pin.sha256)).descriptor }; },
  install: async pin => { const row = pins.find(row => row.pin.sha256 === pin.sha256); log('Fixture install request (no download)', row.id, pin.sha256);
    for (const other of records) if (other.id === row.id) other.active = false;
    records = records.filter(other => other.id !== row.id || other.sha256 !== pin.sha256); records.push(saved(row, true)); generation++; },
  load: async (id,{sha256}) => { log('Fixture load request (no asset bytes)', id, sha256);
    return { manifest: { spawns: [] }, source: { baseURL: location.href } }; },
  repair: async (pin,{id}) => { log('Fixture repair request (no byte replacement)', id, pin.sha256); generation++; },
  removalSnapshot: async (id,{sha256}={}) => { const rows = records.filter(row => row.id === id && (!sha256 || row.sha256 === sha256));
    log('Fixture removal review only', id, sha256 ?? 'all'); return { id,generation,sha256,revision: rows[0]?.descriptor.revision,revisions:rows.map(row=>({sha256:row.sha256})),bytes:rows.reduce((n,row)=>n+row.bytes,0) }; },
  removeRevision: async (id,hash) => { log('Fixture remove revision (memory only)',id,hash); records = records.filter(row=>row.id!==id || row.sha256!==hash);generation++; },
  remove: async id => { log('Fixture remove exact world ID (memory only)',id); records=records.filter(row=>row.id!==id);generation++; },
  close() { log('Fixture closed (no database connection)'); },
};
function mount() {
  clearTimeout(timer); timer = null; if (pendingRead) { pendingRead.resolve(copy(records)); pendingRead=null; }
  nav?.dispose(); ui?.dispose(); records=baseRecords(); generation++;
  ui=mountRegionalLibrary({ parent:$('library-host'),pins,window,txt,openLibrary:async()=>store,
    el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;},
    fly:async(configuration,row)=>log('Fixture Fly requested — NO FLIGHT STARTED',row.id,row.sha256), });
  nav=createFlightMenuNavigation({document,window,locale:()=>locale,getContext:()=>({root:document.getElementById('regional-world-library'),key:'synthetic-regional-component'})});
  ui.open(); $('fixture-phase').textContent='Synthetic fixture ready: 24 exact offers. Saved metadata is made up and not verified scenery.';
  $('fixture-defer').disabled=$('fixture-missing').disabled=$('fixture-scenario').value!=='retained';
  focusStatus();
}
function deferred(missing) {
  if(pendingRead)return;
  const family=[...document.querySelectorAll('[data-region-family]')].find(node=>node.dataset.regionFamily==='desert'),
    primary=family?.querySelector('[data-region-primary]'), oldHash=primary?.dataset.regionPrimary,
    old=records.find(row=>row.id===desert[0].id && row.sha256===oldHash), next=desert.find(row=>row.pin.sha256!==oldHash);
  if(!old || !next) { $('fixture-phase').textContent='Reset the retained fixture before this scenario.'; return; }
  let resolve; const promise=new Promise(done=>resolve=done); pendingRead={promise,resolve};
  primary.querySelector('[data-region-action="fly"]').focus(); ui.open();
  $('fixture-phase').textContent='Deferred metadata read pending (5s). No install, activation, removal or flight requested.';
  timer=setTimeout(()=>{const read=pendingRead;if(!read)return;
    records=records.filter(row=>!missing || row.id!==old.id || row.sha256!==oldHash);
    for(const row of records)if(row.id===old.id)row.active=row.sha256===next.pin.sha256;
    if(!records.some(row=>row.id===next.id && row.sha256===next.pin.sha256))records.push(saved(next,true));
    pendingRead=null;read.resolve(copy(records));
    log('Fixture metadata changed only',next.id,next.pin.sha256);
    $('fixture-phase').textContent=missing?'Metadata resolved: old Fly not listed; confirmation must go to Versions safely. No removal performed.':'Metadata resolved: another saved edition is now active; exact prior Fly must remain intended unless you moved focus.';
  },5000);
}
$('fixture-language').addEventListener('change',event=>{locale=event.target.value;document.documentElement.lang=locale;ui.refresh();focusStatus();});
$('fixture-scenario').addEventListener('change',mount);$('fixture-reset').addEventListener('click',mount);
$('fixture-defer').addEventListener('click',()=>deferred(false));$('fixture-missing').addEventListener('click',()=>deferred(true));
document.addEventListener('focusin',focusStatus);window.addEventListener('resize',focusStatus);
new MutationObserver(focusStatus).observe($('library-boundary'),{childList:true,subtree:true});
window.addEventListener('pagehide',()=>{clearTimeout(timer);nav?.dispose();ui?.dispose();});
mount();
'''
for name,data in [('index.html',html),('preview.css',css),('preview.mjs',js)]: (web/name).write_text(data)
control='''#!/usr/bin/env python3
import pathlib,subprocess,sys,os,signal
root=pathlib.Path(__file__).resolve().parent
pidfile=root/'server.pid'
command=[sys.executable,'-m','http.server','9213','--bind','127.0.0.1','--directory',str(root/'web')]
def current():
 if not pidfile.exists():return None
 pid=int(pidfile.read_text());p=subprocess.run(['ps','-p',str(pid),'-o','command='],capture_output=True,text=True)
 if p.returncode:return None
 if 'http.server 9213 --bind 127.0.0.1 --directory '+str(root/'web') not in p.stdout:raise RuntimeError('PID identity mismatch; refusing to touch it')
 return pid
op=sys.argv[1] if len(sys.argv)>1 else 'status';pid=current()
if op=='start':
 if not pid:
  with open(root/'server.log','ab') as log:p=subprocess.Popen(command,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
  pid=p.pid;pidfile.write_text(str(pid)+'\\n')
 print('running',pid)
elif op=='stop':
 if pid:os.kill(pid,signal.SIGTERM)
 print('stopped',pid)
elif op=='status':print('running' if pid else 'stopped',pid)
else:raise ValueError('Use start, stop or status')
'''
(stage/'server-control.py').write_text(control)
# Binding tests the reserved port before starting; never evict another process.
with socket.socket() as probe:probe.bind(('127.0.0.1',9213))
files=[]
for name in ['index.html','preview.css','preview.mjs']:
 data=(web/name).read_bytes();files.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
identity={'sourceRevision':'81c0d6587cdb582835a64e3d69c4c130460fb11a','runtimeRoot':str(runtime),'url':'http://127.0.0.1:9213/index.html','fixtureFiles':files,'scope':'Synthetic callback-only component; exact packaged Library/input/CSS. No scenery/WebGL/default DB/player storage/real flight/persistence. Not full-player/theme/physical/public acceptance. CSP disallows connection fetches. Native not yet inspected.'}
(stage/'review-identity.json').write_text(json.dumps(identity,indent=2)+'\n')
subprocess.run(['node','--check',str(web/'preview.mjs')],check=True)
subprocess.run(['python3',str(stage/'server-control.py'),'start'],check=True)
print(json.dumps(identity,indent=2))
