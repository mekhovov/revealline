import { REGIONAL_LIBRARY_PINS, mountRegionalLibrary } from './runtime/optional-practice/civilian-fpv/regional-library.mjs';
import { createFlightMenuNavigation } from './runtime/optional-practice/civilian-fpv/input.mjs';
const $ = id => document.getElementById(id), copy = value => structuredClone(value), pins = REGIONAL_LIBRARY_PINS,
  desert = pins.filter(row => row.id === 'desert-expedition-study'), actions = [];
let locale = 'en', records = [], ui, nav, pendingRead = null, timer = null, generation = 1;
const saved = (pin, active = false) => ({ id: pin.id, sha256: pin.pin.sha256, active, bytes: pin.bytes,
  descriptor: { id: pin.id, revision: 'fixture-' + pin.pin.sha256.slice(0,8), title: copy(pin.title) } });
const retained = id => ({ id, sha256: (id === 'personal-landscape' ? 'e' : 'f').repeat(64), active: false, bytes: 123,
  descriptor: { id, revision: 'fixture-retained-r1', title: { en: 'My retained landscape', uk: 'Моя збережена місцевість' } } });
const txt = (en,uk) => locale === 'uk' ? uk : en;
function log(action, id = '', hash = '') { actions.push([action,id,hash].filter(Boolean).join(' · ')); $('fixture-actions').textContent = actions.slice(-12).join('\n'); }
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
