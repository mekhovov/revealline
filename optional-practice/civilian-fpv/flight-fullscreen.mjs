import { nativeArtReviewURL } from '../../game/ui/art-review-navigation.mjs';

/** Presentation-only fullscreen. The document root includes every modal dialog. */
export function mountFlightFullscreen({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  surface,
  viewport,
  button,
  buttons = [],
  setupButton,
  kind,
  scope = 'flight',
  getFocusTarget = () => (scope === 'application' ? doc.activeElement : viewport),
  locale = () => 'en',
  onPause = () => {},
  secondaryDialogOpen = () => false,
}) {
  let active = false,
    native = false,
    toolsOpen = false,
    disposed = false,
    generation = 0;
  const listeners = [];
  const toggles = [...new Set([button, ...buttons].filter(Boolean))];
  const listen = (node, event, handler, options) => {
    node.addEventListener(event, handler, options);
    listeners.push(() => node.removeEventListener(event, handler, options));
  };
  const bar = doc.createElement('div');
  bar.className = 'flight-immersive-bar';
  bar.dataset.flightImmersiveBar = '';
  bar.setAttribute('role', 'group');
  const notice = doc.createElement('span');
  notice.className = 'flight-immersive-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  const makeButton = (action) => {
    const node = doc.createElement('button');
    node.type = 'button';
    node.dataset.immersiveAction = action;
    bar.append(node);
    return node;
  };
  bar.append(notice);
  const radioButton = makeButton('radio'),
    toolsButton = makeButton('controls'),
    exitButton = makeButton('exit');
  surface.prepend(bar);
  const text = (en, uk) => (locale() === 'uk' ? uk : en);
  function refresh() {
    bar.setAttribute('aria-label', text('Fullscreen controls', 'Повноекранне керування'));
    for (const toggle of toggles) {
      toggle.textContent = active
        ? native
          ? text('Exit fullscreen', 'Вийти з повного екрана')
          : text('Exit full window', 'Вийти з режиму на все вікно')
        : text('Fullscreen', 'Повний екран');
      toggle.setAttribute('aria-pressed', String(active));
      if (surface.id) toggle.setAttribute('aria-controls', surface.id);
    }
    radioButton.textContent = text('Radio setup', 'Налаштувати пульт');
    radioButton.disabled = !setupButton || setupButton.disabled;
    toolsButton.textContent = toolsOpen
      ? text('Hide controls', 'Сховати керування')
      : text('Controls', 'Керування');
    toolsButton.setAttribute('aria-expanded', String(toolsOpen));
    exitButton.textContent = native
      ? text('Exit fullscreen', 'Вийти з повного екрана')
      : text('Exit full window', 'Вийти з режиму на все вікно');
    notice.textContent = active
      ? native
        ? text('Fullscreen · Esc to exit', 'Повний екран · Esc — вихід')
        : text('Full window · Esc to exit', 'На все вікно · Esc — вихід')
      : '';
  }
  function paint() {
    if (active) {
      doc.documentElement.dataset.fpvFullscreen = kind;
      doc.documentElement.dataset.fpvImmersiveScope = scope;
      if (scope !== 'application' || surface.tagName !== 'DIALOG' || surface.open)
        doc.documentElement.dataset.fpvImmersive = kind;
      else delete doc.documentElement.dataset.fpvImmersive;
    } else {
      delete doc.documentElement.dataset.fpvFullscreen;
      delete doc.documentElement.dataset.fpvImmersive;
      delete doc.documentElement.dataset.fpvImmersiveScope;
    }
    surface.dataset.immersiveControls = String(toolsOpen);
    refresh();
    // Both renderers read the actual canvas bounds on their next animation frame.
    win.dispatchEvent(new win.Event('resize'));
  }
  function leaveLocal({ focus = true } = {}) {
    if (!active) return;
    active = false;
    native = false;
    toolsOpen = false;
    onPause();
    paint();
    if (focus) {
      const target = toggles.find((toggle) => toggle.isConnected && toggle.getClientRects().length);
      target?.focus({ preventScroll: true });
    }
  }
  async function exit({ focus = true } = {}) {
    ++generation;
    const owned = active && doc.fullscreenElement === doc.documentElement;
    leaveLocal({ focus });
    if (owned) {
      try {
        await doc.exitFullscreen();
      } catch {
        // An external Escape or browser transition may have already exited.
      }
    }
  }
  async function enter() {
    if (disposed || active) return;
    const owner = ++generation;
    onPause();
    active = true;
    toolsOpen = false;
    paint();
    // Must stay in this user-gesture call stack. A rejected/unsupported request
    // still leaves a usable full-window layout with an explicit exit button.
    try {
      if (typeof doc.documentElement.requestFullscreen === 'function')
        await doc.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      /* in-page immersive fallback */
    }
    if (disposed || owner !== generation || !active) {
      if ((disposed || !active) && doc.fullscreenElement === doc.documentElement) {
        try {
          await doc.exitFullscreen();
        } catch {
          /* already exited */
        }
      }
      return;
    }
    native = doc.fullscreenElement === doc.documentElement;
    paint();
    const target = getFocusTarget();
    if (target?.isConnected) target.focus({ preventScroll: true });
  }
  for (const toggle of toggles) listen(toggle, 'click', () => void (active ? exit() : enter()));
  listen(exitButton, 'click', () => void exit());
  listen(radioButton, 'click', () => {
    onPause();
    setupButton?.click();
  });
  listen(toolsButton, 'click', () => {
    onPause();
    toolsOpen = !toolsOpen;
    paint();
  });
  listen(doc, 'fullscreenchange', () => {
    if (!active) return;
    if (doc.fullscreenElement === doc.documentElement) {
      native = true;
      refresh();
    } else if (native) {
      ++generation;
      leaveLocal();
    }
  });
  listen(
    doc,
    'keydown',
    (event) => {
      if (event.defaultPrevented || event.key !== 'Escape' || !active || secondaryDialogOpen())
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void exit();
    },
    true,
  );
  const setupObserver = new win.MutationObserver(refresh);
  if (setupButton)
    setupObserver.observe(setupButton, { attributes: true, attributeFilter: ['disabled'] });
  const surfaceObserver = new win.MutationObserver(() => {
    if (active) paint();
  });
  if (scope === 'application')
    surfaceObserver.observe(surface, { attributes: true, attributeFilter: ['open', 'hidden'] });
  refresh();
  return {
    active: () => active,
    refresh,
    enter,
    toggle: () => (active ? exit() : enter()),
    closeControls() {
      toolsOpen = false;
      if (active) paint();
    },
    exit,
    snapshot: () => ({ active, mode: active ? (native ? 'native' : 'window') : 'none', toolsOpen }),
    dispose() {
      if (disposed) return;
      void exit({ focus: false });
      disposed = true;
      setupObserver.disconnect();
      surfaceObserver.disconnect();
      for (const remove of listeners) remove();
      bar.remove();
      delete surface.dataset.immersiveControls;
    },
  };
}

/** Destinations derive only from the host's already validated game return. */
export function createSimModeLinks({
  document: doc,
  gameReturn,
  locale = () => 'en',
  setMenuIcon,
}) {
  const nav = doc.createElement('nav');
  nav.className = 'sim-shell-modes';
  let root = null;
  try {
    const accepted = new URL(gameReturn);
    const match =
      /^(.*\/)game\/(?:index\.html|company\.html|couch\/(?:index\.html|relay-rescue\.html)?|snake\/(?:index\.html|play\.html)?)?$/.exec(
        accepted.pathname,
      );
    if (match && !accepted.username && !accepted.password)
      root = { accepted, base: match[1] + 'game/' };
  } catch {
    /* Standalone packages have no implicit arcade destination. */
  }
  if (!root) return nav;
  const actions = {};
  const destinations = [];
  for (const [id, path] of [
    ['solo', root.accepted.pathname.endsWith('/company.html') ? 'company.html' : ''],
    ['team', 'couch/relay-rescue.html'],
    ['versus', 'couch/'],
    ['snake', 'snake/play.html'],
  ]) {
    const element = doc.createElement('a');
    const target = new URL(root.base + path, root.accepted);
    const synchronize = () => {
      target.searchParams.set('lang', locale() === 'uk' ? 'uk' : 'en');
      for (const key of ['appearanceFamily', 'appearanceRevision'])
        if (root.accepted.searchParams.has(key))
          target.searchParams.set(key, root.accepted.searchParams.get(key));
      element.setAttribute('href', nativeArtReviewURL(target.href, root.accepted.href));
    };
    synchronize();
    element.addEventListener('click', synchronize);
    destinations.push(synchronize);
    actions[id] = element;
  }
  const view = renderSimModeChoices({
    root: nav,
    current: 'simulator',
    actions,
    locale: locale(),
    setMenuIcon,
  });
  nav.refresh = () => {
    destinations.forEach((synchronize) => synchronize());
    view.refresh(locale());
  };
  return nav;
}

// BEGIN GENERATED SHARED MODE SHELL
import*as simGlobalI18n from'../../game/i18n/index.mjs';
import*as simGlobalThemes from'../../game/presentation/theme-system.mjs';
import*as simGlobalActorPreferences from'../../game/hunt/preferences.mjs';
const sharedGlobalSettings=(()=>{
const modules=Object.create(null);
modules['game/mission-library/library.mjs']=(()=>{
/** A browsing registry, never a gameplay catalogue or a progression sequence.
     * Only exact registered rows can reach their original owner's adapters. */
const t=simGlobalI18n['t'];

const LIBRARY_COLLECTIONS=Object.freeze(['Journey','Classic','Custom']);
const LIBRARY_MODES=Object.freeze(['solo','versus','team']);
const LIBRARY_LIFECYCLES=Object.freeze(['current','archive']);
const LIBRARY_TAGS=Object.freeze([
...LIBRARY_COLLECTIONS,
'Remix',
'Ukrainian',
'FPV',
'Arcade',
'Tactical',
'Practice',
]);

function text(value,label,maximum=1024){
if(typeof value!=='string'|| !value.trim()||value.length>maximum)
throw new TypeError(
t('errors:missionLibrary.needsField',{
field:t(`errors:missionLibrary.field.${label}`),
}),
);
return value;
}

// Length-delimited JSON components avoid collisions between arbitrary authored
// IDs containing slashes, colons or strings that happen to match edition names.
function libraryMissionId({owner,edition,campaign,mission,revision=''}){
return JSON.stringify([
text(owner,'owner'),
text(edition,'edition'),
text(campaign,'campaign'),
text(mission,'mission'),
typeof revision==='string'?revision:String(revision),
]);
}

function readiness(value){
if(!value|| !['ready','download','unavailable'].includes(value.state))
throw new TypeError(t('errors:missionLibrary.availabilityRequired'));
if(value.state==='download'&&(!Number.isSafeInteger(value.bytes)||value.bytes<=0))
throw new TypeError(t('errors:missionLibrary.downloadBytes'));
if(value.state==='unavailable')text(value.reason,'unavailableReason');
return Object.freeze({
state:value.state,
...(value.state==='download'
?{bytes:value.bytes,...(value.included===true?{included:true}:{})}
:{}),
...(value.state==='unavailable'
?{reason:value.reason,retry:value.retry===true}
:{}),
});
}

/** Each source supplies already validated runtime references or trusted metadata
     * plus adapters that resolve it through the existing host validator. A metadata
     * row is NOT proof that a pack is installed, decoded, owned, or safe to launch. */
function createMissionLibrary(sources=[]){
const owners=new Map(),
authority=new WeakMap(),
pending=new Map(),
failures=new Map();
const listeners=new Set();
const scoped=(store,row,mode)=>store.get(row)?.get(mode);
const setScoped=(store,row,mode,value)=>{
if(!store.has(row))store.set(row,new Map());
store.get(row).set(mode,value);
};
const clearScoped=(store,row,mode)=>{
store.get(row)?.delete(mode);
if(store.get(row)?.size===0)store.delete(row);
};
let rows=Object.freeze([]),
byId=new Map(),
rowsByMode=new Map(LIBRARY_MODES.map((mode)=>[mode,Object.freeze([])])),
disposed=false;
const emit=()=>{
for(const listener of listeners)listener();
};
function requireRow(row,mode){
const binding=authority.get(row);
if(disposed|| !binding||owners.get(binding.owner.id)!==binding.owner)
throw new Error(t('errors:missionLibrary.staleSelection'));
if(mode!==undefined&&(!LIBRARY_MODES.includes(mode)|| !row.modes.includes(mode)))
throw new Error(t('errors:missionLibrary.unsupportedMode'));
return binding;
}
function rebuild(){
rows=Object.freeze(
[...owners.values()]
.flatMap((owner)=>owner.rows)
.sort(
(a,b)=>
LIBRARY_COLLECTIONS.indexOf(a.collection)-
LIBRARY_COLLECTIONS.indexOf(b.collection),
),
);
const numbered=new Map();
for(const row of rows){
if(row.globalLevelNumber===null)continue;
const previous=numbered.get(row.globalLevelNumber);
if(previous&&previous!==row.canonicalLevelKey)
throw new TypeError('Official level number belongs to more than one mission.');
numbered.set(row.globalLevelNumber,row.canonicalLevelKey);
}
// The unified selector asks for exact identities repeatedly while it
// reconciles focus, availability and lazy previews. Keep those lookups
// linear in the number of rendered cards, not quadratic in the complete
// installed catalogue. Rebuild the derived indexes only after the owner
// replacement has been accepted so stale rows never become authoritative.
byId=new Map(rows.map((row)=>[row.id,row]));
rowsByMode=new Map(
LIBRARY_MODES.map((mode)=>[
mode,
Object.freeze(rows.filter((row)=>row.modes.includes(mode))),
]),
);
}
function cancelOwner(owner){
for(const row of owner.rows){
for(const controller of pending.get(row)?.values()??[])controller.abort();
failures.delete(row);
}
}
function register(source){
if(disposed)throw new Error(t('errors:missionLibrary.closed'));
text(source.id,'sourceId');
text(source.editionId,'editionId');
text(source.edition,'editionName',160);
if(source.lifecycle!==undefined&& !LIBRARY_LIFECYCLES.includes(source.lifecycle))
throw new TypeError('Mission source needs a current or archive lifecycle.');
if(
source.automaticContinuation!==undefined&&
typeof source.automaticContinuation!=='boolean'
)
throw new TypeError(t('errors:missionLibrary.automaticContinuationBoolean'));
if(
!LIBRARY_COLLECTIONS.includes(source.collection)||
!Array.isArray(source.entries)||
source.entries.length>4096||
typeof source.describe!=='function'||
typeof source.availability!=='function'||
typeof source.launch!=='function'
)
throw new TypeError(t('errors:missionLibrary.sourceAdapters'));
const owner={...source,rows:[]};
const ids=new Set();
const described=source.entries.map((entry)=>({entry,info:source.describe(entry)}));
const campaignCounts=new Map(),
campaignSizes=new Map();
for(const{info}of described){
text(info.campaignKey,'campaignIdentity');
campaignCounts.set(info.campaignKey,(campaignCounts.get(info.campaignKey)??0)+1);
if(Number.isInteger(info.levelIndex)&&info.levelIndex>=0)
campaignSizes.set(
info.campaignKey,
Math.max(campaignSizes.get(info.campaignKey)??0,info.levelIndex+1),
);
}
for(const{entry,info}of described){
text(info.campaignKey,'campaignIdentity');
const id=libraryMissionId({
owner:source.id,
edition:source.editionId,
campaign:info.campaignKey,
mission:info.id,
revision:info.revision??'',
});
if(ids.has(id))throw new TypeError(t('errors:missionLibrary.duplicateIdentity'));
ids.add(id);
if(
!Array.isArray(info.modes)||
!info.modes.length||
new Set(info.modes).size!==info.modes.length||
info.modes.some((mode)=> !LIBRARY_MODES.includes(mode))
)
throw new TypeError(t('errors:missionLibrary.supportedModes'));
const tags=[...new Set([source.collection,...(info.tags??[])])];
if(
tags.some(
(tag)=>
!LIBRARY_TAGS.includes(tag)||
(LIBRARY_COLLECTIONS.includes(tag)&&tag!==source.collection),
)
)
throw new TypeError(t('errors:missionLibrary.collectionTag'));
if(!Number.isInteger(info.levelIndex)||info.levelIndex<0)
throw new TypeError(t('errors:missionLibrary.authoredPosition'));
const canonicalLevelKey=
info.canonicalLevelKey===undefined
?null
:text(info.canonicalLevelKey,'missionIdentity',2048);
const globalLevelNumber=info.globalLevelNumber??null;
if(
globalLevelNumber!==null&&
(!Number.isSafeInteger(globalLevelNumber)||
globalLevelNumber<1||
!canonicalLevelKey)
)
throw new TypeError(
'An official level number needs a positive number and canonical key.',
);
const campaignLevelCount=
info.campaignLevelCount??
Math.max(campaignCounts.get(info.campaignKey),campaignSizes.get(info.campaignKey));
if(!Number.isSafeInteger(campaignLevelCount)||campaignLevelCount<=info.levelIndex)
throw new TypeError('Mission campaign size must include its authored position.');
const row=Object.freeze({
id,
runtimeId:info.id,
ownerId:source.id,
editionId:source.editionId,
edition:source.edition,
collection:source.collection,
lifecycle:source.lifecycle??'current',
automaticContinuation:source.automaticContinuation!==false,
campaignKey:JSON.stringify([source.id,source.editionId,info.campaignKey]),
campaignTitle:text(info.campaignTitle,'campaignTitle',160),
name:text(info.name,'missionName',160),
levelIndex:info.levelIndex,
canonicalLevelKey,
globalLevelNumber,
campaignLevelNumber:info.levelIndex+1,
campaignLevelCount,
modes:Object.freeze([...info.modes]),
tags:Object.freeze(tags),
rules:typeof info.rules==='string'?info.rules.slice(0,2048):'',
hook:typeof info.hook==='string'?info.hook.slice(0,2048):'',
});
owner.rows.push(row);
authority.set(row,{owner,entry});
}
const count=[...owners.values()]
.filter((item)=>item.id!==source.id)
.reduce((sum,item)=>sum+item.rows.length,owner.rows.length);
if(count>4096)throw new TypeError(t('errors:missionLibrary.tooManyMissions'));
// Build the complete replacement before invalidating the accepted owner.
const previous=owners.get(source.id);
if(previous)cancelOwner(previous);
owners.set(source.id,owner);
rebuild();
emit();
return Object.freeze([...owner.rows]);
}
function availability(row,mode='solo'){
const{owner,entry}=requireRow(row,mode);
if(scoped(pending,row,mode))return Object.freeze({state:'preparing'});
if(scoped(failures,row,mode))
return Object.freeze({
state:'unavailable',
reason:scoped(failures,row,mode),
retry:true,
});
return readiness(owner.availability(entry,mode));
}
function presentation(row){
const{owner,entry}=requireRow(row);
const value=owner.presentation?.(entry);
const translated={};
for(const field of['name','campaignTitle','edition','hook'])
translated[field]=typeof value?.[field]==='string'?value[field]:row[field];
return Object.freeze(translated);
}
for(const source of sources)register(source);
return Object.freeze({
get missions(){
return rows;
},
register,
remove(id){
const owner=owners.get(id);
if(!owner)return false;
cancelOwner(owner);
owners.delete(id);
rebuild();
emit();
return true;
},
find(id){
return byId.get(id)??null;
},
forMode(mode){
if(!LIBRARY_MODES.includes(mode))
throw new TypeError(t('errors:missionLibrary.unknownMode'));
return rowsByMode.get(mode);
},
search(
query='',
{mode='solo',collection='',campaign='',tag='',lifecycle=''}={},
){
if(
!LIBRARY_MODES.includes(mode)||
(collection&& !LIBRARY_COLLECTIONS.includes(collection))||
(lifecycle&& !LIBRARY_LIFECYCLES.includes(lifecycle))
)
throw new TypeError(t('errors:missionLibrary.unknownFilter'));
const words=String(query)
.normalize('NFKC')
.toLocaleLowerCase()
.trim()
.split(/\s+/u)
.filter(Boolean);
return rowsByMode.get(mode).filter((row)=>{
const display=words.length?presentation(row):row;
return(
row.modes.includes(mode)&&
(!lifecycle||row.lifecycle===lifecycle)&&
(!collection||row.collection===collection)&&
(!campaign||row.campaignKey===campaign)&&
(!tag||row.tags.includes(tag))&&
words.every((word)=>
`${display.name} ${display.campaignTitle} ${display.edition} ${display.hook} ${row.name} ${row.campaignTitle} ${row.edition} ${row.tags.join(' ')} ${row.rules} ${row.hook} ${row.globalLevelNumber===null?'':`#${row.globalLevelNumber} ${row.globalLevelNumber}`}`
.normalize('NFKC')
.toLocaleLowerCase()
.includes(word),
)
);
});
},
presentation,
availability,
progress(row,mode){
const{owner,entry}=requireRow(row,mode);
return owner.progress?.(entry,mode)??'';
},
progressState(row,mode){
const{owner,entry}=requireRow(row,mode);
const value=owner.progressState?.(entry,mode)??{state:'new',bestStars:null};
if(
!value||
!['new','skipped','completed'].includes(value.state)||
!(value.bestStars===null||[1,2,3].includes(value.bestStars))||
(value.state!=='completed'&&value.bestStars!==null)
)
throw new TypeError('Mission progress state is invalid.');
return Object.freeze({state:value.state,bestStars:value.bestStars});
},
completion(row,mode){
const{owner,entry}=requireRow(row,mode);
return owner.completion?.(entry,mode)??null;
},
card(row,mode){
const{owner,entry}=requireRow(row,mode);
return owner.card?.(entry,mode)??null;
},
details(row,mode){
const{owner,entry}=requireRow(row,mode);
const value=owner.details?.(entry,mode);
const bounded=(value,fallback='')=>
typeof value==='string'?value.slice(0,2048):fallback;
return Object.freeze({
challenge:bounded(value?.challenge,row.rules),
route:bounded(value?.route,row.hook),
mastery:bounded(value?.mastery),
});
},
async prepare(row,{mode='solo',signal}={}){
const{owner,entry}=requireRow(row,mode);
const state=availability(row,mode);
requireRow(row,mode);// Availability may reconcile an installed owner.
if(state.state==='ready')return state;
if(state.state==='preparing')
throw new Error(t('errors:missionLibrary.alreadyPreparing'));
if(
typeof owner.prepare!=='function'||
(state.state==='unavailable'&& !state.retry)
)
throw new Error(state.reason||t('errors:missionLibrary.cannotPrepare'));
if(signal?.aborted)return{state:'cancelled'};
const controller=new AbortController();
const abort=()=>controller.abort();
signal?.addEventListener('abort',abort,{once:true});
clearScoped(failures,row,mode);
setScoped(pending,row,mode,controller);
emit();
try{
const cancelled=new Promise((resolve)=>
controller.signal.addEventListener('abort',()=>resolve(false),{once:true}),
);
const completed=await Promise.race([
Promise.resolve().then(()=>{
if(controller.signal.aborted)return false;
return Promise.resolve(
owner.prepare(entry,{mode,signal:controller.signal}),
).then(()=>true);
}),
cancelled,
]);
if(!completed||controller.signal.aborted||owners.get(owner.id)!==owner)
return{state:'cancelled'};
return readiness(owner.availability(entry,mode));
}catch(error){
if(controller.signal.aborted||owners.get(owner.id)!==owner)
return{state:'cancelled'};
setScoped(
failures,
row,
mode,
typeof error?.message==='string'
?error.message
:t('errors:missionLibrary.preparationFailed'),
);
throw error;
}finally{
signal?.removeEventListener('abort',abort);
if(scoped(pending,row,mode)===controller)clearScoped(pending,row,mode);
emit();
}
},
cancel(row,{mode}={}){
if(mode!==undefined)scoped(pending,row,mode)?.abort();
else for(const controller of pending.get(row)?.values()??[])controller.abort();
},
launch(row,{mode='solo',...context}={}){
const{owner,entry}=requireRow(row,mode);
if(availability(row,mode).state!=='ready')
throw new Error(t('errors:missionLibrary.prepareBeforePlay'));
requireRow(row,mode);
// The host still owns its runtime validation, departure guard and atomic
// picture adoption. Never pass a lookup-by-name replacement for entry.
return owner.launch(entry,{...context,mode,libraryMissionId:row.id});
},
subscribe(listener){
if(typeof listener!=='function')
throw new TypeError(t('errors:missionLibrary.listenerFunction'));
listeners.add(listener);
return()=>listeners.delete(listener);
},
dispose(){
disposed=true;
for(const owner of owners.values())cancelOwner(owner);
owners.clear();
rows=Object.freeze([]);
byId=new Map();
rowsByMode=new Map(LIBRARY_MODES.map((mode)=>[mode,Object.freeze([])]));
listeners.clear();
},
});
}

return{
LIBRARY_COLLECTIONS,
LIBRARY_MODES,
LIBRARY_LIFECYCLES,
LIBRARY_TAGS,
libraryMissionId,
createMissionLibrary,
};
})();
modules['game/data-json.mjs']=(()=>{
const t=simGlobalI18n['t'];

/** Shared boundary for user-owned files. Does not invoke getters or toJSON. */
const plainObject=(value)=>
value!==null&&
typeof value==='object'&&
!Array.isArray(value)&&
(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const stableId=(value)=>
typeof value==='string'&&
/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value)&&
!['constructor','prototype','__proto__'].includes(value);
function boundedJSON(
source,
{
maxBytes=4*1024*1024,
maxNodes=100000,
maxDepth=16,
maxArray=4096,
maxString=4096,
}={},
){
const encoder=new TextEncoder();
// Repeated field names and short text have identical encoded lengths. Keep
// this scalar-only cache bounded and local to one call: every external graph
// still receives the full descriptor, structure and byte-budget traversal.
const stringBytes=new Map();
const encodedBytes=(value)=>{
const known=stringBytes.get(value);
if(known!==undefined)return known;
const length=encoder.encode(JSON.stringify(value)).byteLength;
if(value.length<=512&&stringBytes.size<512)stringBytes.set(value,length);
return length;
};
if(typeof source==='string'){
if(source.length>maxBytes||encoder.encode(source).byteLength>maxBytes)
throw new TypeError(t('errors:dataJson.fileByteBudget'));
try{
source=JSON.parse(source);
}catch{
throw new TypeError(t('errors:dataJson.invalid'));
}
}
let nodes=0,
size=0;
const ancestors=new Set();
const add=(n)=>{
size+=n;
if(size>maxBytes)throw new TypeError(t('errors:dataJson.byteBudget'));
};
function copy(value,depth){
if(++nodes>maxNodes||depth>maxDepth)
throw new TypeError(t('errors:dataJson.structuralBudget'));
if(value===null||typeof value==='boolean'){
add(value===false?5:4);
return value;
}
if(typeof value==='number'){
if(!Number.isFinite(value))throw new TypeError(t('errors:dataJson.finiteNumbers'));
add(JSON.stringify(value).length);
return value;
}
if(typeof value==='string'){
if(value.length>maxString)throw new TypeError(t('errors:dataJson.stringBudget'));
add(encodedBytes(value));
return value;
}
const array=Array.isArray(value);
if(
!value||
typeof value!=='object'||
(array?Object.getPrototypeOf(value)!==Array.prototype:!plainObject(value))
)
throw new TypeError(t('errors:dataJson.plainData'));
if(ancestors.has(value))throw new TypeError(t('errors:dataJson.cyclesUnsupported'));
if(array&&value.length>maxArray)
throw new TypeError(t('errors:dataJson.arrayItemBudget'));
ancestors.add(value);
add(2);// JSON container delimiters.
const out=array?[]:{},
descriptors=Object.getOwnPropertyDescriptors(value);
let count=0;
for(const key of Reflect.ownKeys(descriptors)){
if(typeof key!=='string')throw new TypeError(t('errors:dataJson.symbolKeys'));
if(array&&key==='length')continue;
if(['__proto__','constructor','prototype'].includes(key))
throw new TypeError(t('errors:dataJson.forbiddenKey',{key}));
const descriptor=descriptors[key];
if(!descriptor.enumerable|| !Object.hasOwn(descriptor,'value'))
throw new TypeError(t('errors:dataJson.ordinaryFields'));
if(key.length>512)throw new TypeError(t('errors:dataJson.fieldNameBudget'));
if(array&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length))
throw new TypeError(t('errors:dataJson.arrayCustomProperties'));
if(count)add(1);// Comma before every subsequent entry.
if(!array)add(encodedBytes(key)+1);// Object key and colon; array indexes are not serialized.
out[key]=copy(descriptor.value,depth+1);
count++;
}
if(array&&count!==value.length)throw new TypeError(t('errors:dataJson.sparseArrays'));
ancestors.delete(value);
return out;
}
const copied=copy(source,0);
if(encoder.encode(JSON.stringify(copied)).byteLength>maxBytes)
throw new TypeError(t('errors:dataJson.encodedByteBudget'));
return copied;
}
function exactKeys(value,allowed,label,messages={}){
if(!plainObject(value))
throw new TypeError(
messages.object?.({label})??t('errors:dataJson.objectRequired',{label}),
);
for(const key of Object.keys(value))
if(!allowed.includes(key))
throw new TypeError(
messages.unsupported?.({label,key})??
t('errors:dataJson.unsupportedField',{path:`${label}.${key}`}),
);
}
function required(condition,message){
if(!condition)throw new TypeError(message);
}
function canonicalJSON(value){
if(Array.isArray(value))return`[${value.map(canonicalJSON).join(',')}]`;
if(plainObject(value))
return`{${Object.keys(value)
.sort()
.map((key)=>`${JSON.stringify(key)}:${canonicalJSON(value[key])}`)
.join(',')}}`;
return JSON.stringify(value);
}
/** Stable local partition identity, not a signature or an anti-cheat service. */
function dataIdentity(value){
let hash=0xcbf29ce484222325n;
for(const byte of new TextEncoder().encode(canonicalJSON(value)))
hash=BigInt.asUintN(64,(hash^BigInt(byte))*0x100000001b3n);
return hash.toString(16).padStart(16,'0');
}

return{plainObject,stableId,boundedJSON,exactKeys,required,canonicalJSON,dataIdentity};
})();
modules['game/edition-context.mjs']=(()=>{
/** Distribution identity is independent of Journey's logical campaign progress. */
const editionPattern= /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const versionPattern= /^v?(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})$/;

// Public addresses may change; stored profiles, content pins and installed app
// IDs keep the original edition identity. This is an alias, never a new edition.
const publicSlugs=Object.freeze({'droneaid-nl-community':'droneaid'});

function editionIdentityId(selector){
validateEditionId(selector);
return Object.keys(publicSlugs).find((id)=>publicSlugs[id]===selector)??selector;
}

function editionPublicSlug(editionId){
validateEditionId(editionId);
return publicSlugs[editionId]??editionId;
}

function validateEditionId(editionId){
if(typeof editionId!=='string'||editionId.length>64|| !editionPattern.test(editionId))
throw new TypeError('Invalid edition identity.');
return editionId;
}

function editionIdFromLocation(locationRef=globalThis.location){
if(!locationRef?.href)return undefined;
const path=new URL(locationRef.href).pathname;
const match= /\/editions\/([^/]+)\//.exec(path);
return match?editionIdentityId(match[1]):undefined;
}

function resolveEditionContext({editionId,version}={}){
if(typeof version!=='string'||(version!=='DEV'&& !versionPattern.test(version)))
throw new TypeError('A stable release version or DEV is required.');
const brand=editionId===undefined?'':`${validateEditionId(editionId)}.`;
const channel=
editionId===undefined
?version==='DEV'
?'dev'
:`release-${version}`
:`edition-${brand}${version==='DEV'?'dev':`release-${version}`}`;
const profileKey=`revealline.library.${channel}.v1`;
return Object.freeze({
...(editionId===undefined?{}:{editionId}),
version,
channel,
profileKey,
packsKey:`revealline.packs.${channel}.v1`,
sessionKey:`revealline.suspended.${channel}.v1`,
writerKey:`${profileKey}.writer`,
lockKey:`${profileKey}.backup-lock`,
journalKey:`${profileKey}.backup-journal`,
indexKey:`${profileKey}.external-chapter-index.v1`,
externalJournalKey:`${profileKey}.external-chapter-journal.v1`,
});
}

function parseEditionChannel(channel){
if(typeof channel!=='string')return null;
const match=
/^edition-([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.(dev|release-(v?\d+\.\d+\.\d+))$/.exec(channel);
if(!match)return null;
try{
return resolveEditionContext({
editionId:match[1],
version:match[2]==='dev'?'DEV':match[3],
});
}catch{
return null;
}
}

function installedStateKey(editionId){
return editionId===undefined
?'revealline.installed-app.v1'
:`revealline.installed-app.edition-${validateEditionId(editionId)}.v1`;
}

/** Stable explicit manifest IDs avoid origin-wide './' identity collisions. */
function editionAppIdentity({editionId,basePath='/'}={}){
validateEditionId(editionId);
if(typeof basePath!=='string'|| !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath))
throw new TypeError('Edition base path must be an absolute directory path.');
const root=`${basePath}editions/${editionPublicSlug(editionId)}/`;
return Object.freeze({
id:`${basePath}editions/${editionId}/`,
start_url:`${root}app/`,
scope:root,
});
}

/** A launcher may select only a retained immutable release of its own edition.
     * Relative current.json pointers are resolved against the document, never a
     * stored origin. This module also ships inside the stable launcher directory. */
function validateCompanyInstallationReference(value,{editionId,baseURL,editionRoot}={}){
validateEditionId(editionId);
if(
!value||
typeof value!=='object'||
Array.isArray(value)||
value.editionId!==editionId||
!versionPattern.test(value.version)||
typeof value.version!=='string'||
typeof value.scope!=='string'||
value.scope.length>2048||
value.entry!=='game/company.html'||
(value.buildId!==undefined&& !/^[a-f0-9]{64}$/.test(value.buildId))
)
throw new TypeError('Edition installation identity differs.');
const base=new URL(baseURL),
scope=new URL(value.scope,base);
const root=
typeof editionRoot==='string'
? /^(\/(?:[A-Za-z0-9_-]+\/)*)editions\/([^/]+)\/$/.exec(editionRoot)
:null;
const aliases=[editionId,editionPublicSlug(editionId)];
if(
!root||
!aliases.includes(root[2])||
!/^https?:$/.test(base.protocol)||
scope.origin!==base.origin||
scope.username||
scope.password||
scope.search||
scope.hash||
!aliases.some(
(slug)=>
scope.pathname===
`${root[1]}editions/${slug}/releases/v${value.version.replace(/^v/,'')}/site/`,
)
)
throw new TypeError('Install from the matching published edition address.');
return Object.freeze({
editionId,
version:value.version,
scope:scope.href,
entry:value.entry,
...(value.buildId===undefined?{}:{buildId:value.buildId}),
});
}

/** Hash caches may share bytes; ownership and removal must remain separate. */
function officialContentOwner({editionId,packId,revision}={}){
if(
typeof packId!=='string'||
!editionPattern.test(packId)||
packId.length>100||
typeof revision!=='string'||
!/^[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/.test(revision)
)
throw new TypeError('Invalid official content ownership.');
return`${editionId===undefined?'default':validateEditionId(editionId)}:${packId}:${revision}`;
}

return{
editionIdentityId,
editionPublicSlug,
validateEditionId,
editionIdFromLocation,
resolveEditionContext,
parseEditionChannel,
installedStateKey,
editionAppIdentity,
validateCompanyInstallationReference,
officialContentOwner,
};
})();
modules['game/mission-library/goal-preferences.mjs']=(()=>{
const boundedJSON=modules['game/data-json.mjs']['boundedJSON'];
const exactKeys=modules['game/data-json.mjs']['exactKeys'];
const required=modules['game/data-json.mjs']['required'];
const validateEditionId=modules['game/edition-context.mjs']['validateEditionId'];
const LIBRARY_MODES=modules['game/mission-library/library.mjs']['LIBRARY_MODES'];

const MISSION_GOAL_FORMAT='revealline-mission-goal.v1';
const MISSION_GOAL_KEY_PREFIX='revealline.mission-goal.v1';
const missionId=(value)=>
value===null||
(typeof value==='string'&&
value.trim().length>0&&
value.length<=2048&&
!/[\u0000-\u001f\u007f-\u009f]/u.test(value)&&
!/[\ud800-\udfff]/u.test(value));
function validateMissionGoal(input,{editionId,mode}){
const value=boundedJSON(input,{
maxBytes:16384,
maxNodes:8,
maxDepth:1,
maxString:2048,
});
exactKeys(value,['format','editionId','mode','missionId'],'Pinned mission goal');
required(
value.format===MISSION_GOAL_FORMAT&&
value.editionId===editionId&&
value.mode===mode&&
missionId(value.missionId),
'Invalid exact edition/mode mission goal.',
);
return Object.freeze(value);
}

/** A convenience preference, never a clear, entitlement, route or download
     * request. Loading does not write; corrupt/future bytes are left recoverable. */
function createMissionGoalPreferences({
editionId='default',
mode='solo',
getStorage=()=>globalThis.localStorage,
window:eventTarget=globalThis,
}={}){
validateEditionId(editionId);
required(LIBRARY_MODES.includes(mode),'Choose a supported mission-goal mode.');
const key=`${MISSION_GOAL_KEY_PREFIX}.${editionId}.${mode}`,
listeners=new Set();
let selected=null,
durable=true,
pending=false,
disposed=false;
const snapshot=()=>Object.freeze({editionId,mode,missionId:selected,durable});
const read=()=>{
const storage=getStorage();
required(storage,'Mission-goal storage is unavailable.');
const raw=storage.getItem(key);
return{
storage,
raw,
value:raw===null?null:validateMissionGoal(raw,{editionId,mode}),
};
};
const notify=()=>{
for(const listener of[...listeners]){
if(disposed|| !listeners.has(listener))continue;
try{
listener(snapshot());
}catch{
/* Preferences cannot stop play. */
}
}
return snapshot();
};
try{
selected=read().value?.missionId??null;
}catch{
durable=false;
}
function refresh(event){
if(
disposed||
pending||
(event.type==='storage'&&event.key!==key)||
(event.type==='pageshow'&&event.persisted!==true)
)
return;
try{
const current=read();
if(
event.type==='storage'&&
(event.storageArea!==current.storage||event.newValue!==current.raw)
)
return;
selected=current.value?.missionId??null;
durable=true;
}catch{
durable=false;
}
notify();
}
function save(){
if(disposed)return snapshot();
try{
const{storage}=read();// Never replace an unreadable/future record.
const raw=JSON.stringify({
format:MISSION_GOAL_FORMAT,
editionId,
mode,
missionId:selected,
});
storage.setItem(key,raw);
required(storage.getItem(key)===raw,'Mission-goal readback failed.');
pending=false;
durable=true;
}catch{
durable=false;
}
return notify();
}
eventTarget?.addEventListener?.('storage',refresh);
eventTarget?.addEventListener?.('pageshow',refresh);
return Object.freeze({
key,
snapshot,
choose(value){
if(disposed)return snapshot();
required(missionId(value),'Choose a bounded mission identity.');
selected=value;
pending=true;
return save();
},
retry(){
if(pending)return save();
refresh({type:'pageshow',persisted:true});
return snapshot();
},
subscribe(listener){
required(
!disposed&&typeof listener==='function',
'Active mission-goal listener required.',
);
listeners.add(listener);
try{
listener(snapshot());
}catch{
/* Keep the choice usable. */
}
return()=>listeners.delete(listener);
},
dispose(){
if(disposed)return;
disposed=true;
listeners.clear();
eventTarget?.removeEventListener?.('storage',refresh);
eventTarget?.removeEventListener?.('pageshow',refresh);
},
});
}

return{
MISSION_GOAL_FORMAT,
MISSION_GOAL_KEY_PREFIX,
validateMissionGoal,
createMissionGoalPreferences,
};
})();
modules['game/ui/mission-library-goal.mjs']=(()=>{
const localizedText=simGlobalI18n['localizedText'];
const t=simGlobalI18n['t'];
const createMissionGoalPreferences=
modules['game/mission-library/goal-preferences.mjs']['createMissionGoalPreferences'];

/** The host owns content and launch. This view can only remember or reveal an
     * existing row; unavailable saved IDs never create a preparation request. */
function attachMissionLibraryGoal({
container,
library,
modes,
getMode,
getSelectedId,
isActive,
reveal,
onIntent=()=>{},
editionId='default',
getStorage,
window=globalThis,
}){
const doc=container.ownerDocument,
node=(tag,id)=>{
const item=doc.createElement(tag);
if(id)item.id=id;
return item;
};
const root=node('section','journey-goal'),
status=node('p','journey-goal-status'),
actionGroup=node('div');
root.className='journey-goal';
actionGroup.className='journey-goal-actions';
status.setAttribute('role','status');
status.setAttribute('aria-live','polite');
const controls={},
stores=new Map(),
subscriptions=[];
let disposed=false;
const active=()=> !disposed&&isActive();
const selected=()=>{
const row=library.find(getSelectedId());
return row?.modes.includes(getMode())?row:null;
};
root.append(status,actionGroup);
for(const key of['pin','find','clear','retry']){
const button=node('button',`journey-goal-${key}`);
button.type='button';
button.className='button secondary';
localizedText(button,()=>t('interface:missionGoal.'+key));
controls[key]=button;
actionGroup.append(button);
}
container.append(root);
const current=()=>stores.get(getMode());
function refresh(){
if(disposed)return;
const state=current()?.snapshot(),
row=state?.missionId&&library.find(state.missionId),
available=row?.modes.includes(getMode());
controls.pin.disabled= !selected();
controls.find.disabled= !available;
controls.clear.disabled= !state?.missionId;
controls.retry.hidden=state?.durable!==false;
localizedText(status,()=>{
const name=available?(library.presentation?.(row)??row).name:'';
return(
(state?.missionId
?available
?t('interface:missionGoal.pinned',{name})
:t('interface:missionGoal.unavailable')
:t('interface:missionGoal.empty'))+
(state?.durable===false?' '+t('interface:missionGoal.session'):'')
);
});
}
controls.pin.onclick=()=>{
const row=selected();
if(active()&&row){
onIntent();
current().choose(row.id);
}
};
controls.find.onclick=()=>{
if(!active())return;
const id=current()?.snapshot().missionId,
row=library.find(id);
if(row?.modes.includes(getMode())){
onIntent();
reveal(id,getMode());
}
};
controls.clear.onclick=()=>{
if(active()){
onIntent();
current().choose(null);
}
};
controls.retry.onclick=()=>{
if(active()){
onIntent();
current().retry();
}
};
for(const mode of modes){
const store=createMissionGoalPreferences({editionId,mode,getStorage,window});
stores.set(mode,store);
subscriptions.push(store.subscribe(refresh));
}
refresh();
return{
element:root,
refresh,
dispose(){
if(disposed)return;
disposed=true;
subscriptions.forEach((stop)=>stop());
stores.forEach((store)=>store.dispose());
Object.values(controls).forEach((button)=>(button.onclick=null));
root.remove();
},
};
}

return{attachMissionLibraryGoal};
})();
modules['game/mission-library/opening-intent.mjs']=(()=>{
/** A lazy menu request owns only the input turn that opened it. Arm after that
     * event finishes so its own bubbling click/Enter is not mistaken for a newer
     * action. Never consume input or prevent a newer screen from handling it. */
function trackMissionLibraryOpening({document:doc=globalThis.document,onRetire}){
const origin=doc.activeElement;
let retired=false,
disposed=false,
armed=false,
claimed=false;
const inputs=['keydown','pointerdown','click'];
function dispose(){
disposed=true;
if(!armed)return;
doc.removeEventListener('focusin',focusChanged,true);
for(const type of inputs)doc.removeEventListener(type,retire,true);
armed=false;
}
function retire(){
if(retired||disposed)return;
retired=true;
dispose();
onRetire?.();
}
function focusChanged(){
if(!claimed&&doc.activeElement!==origin)retire();
}
queueMicrotask(()=>{
if(disposed)return;
armed=true;
if(!claimed)doc.addEventListener('focusin',focusChanged,true);
for(const type of inputs)doc.addEventListener(type,retire,true);
focusChanged();
});
const current=()=> !retired&&(claimed||doc.activeElement===origin);
return{
current,
claim:()=>{
if(!current())return false;
claimed=true;
if(armed)doc.removeEventListener('focusin',focusChanged,true);
return true;
},
dispose,
};
}

return{trackMissionLibraryOpening};
})();
modules['game/ui/level-card.mjs']=(()=>{
const starCount=(value)=>(value===null||value===undefined?null:Number(value));

const SLOT_TAGS=Object.freeze({
campaignHeading:'span',
meta:'span',
number:'span',
position:'span',
title:'strong',
campaign:'span',
progressGroup:'span',
progress:'span',
stars:'span',
status:'span',
preview:'span',
check:'span',
});

const classNames=(...values)=>values.filter(Boolean).join(' ');

/**
     * Creates the common semantic card skeleton used by the mission library and
     * company journeys. Host class aliases keep their layouts brandable without
     * allowing either host to drift into a different information hierarchy.
     */
function createLevelCardView({document,className='',classes={}}){
if(!document?.createElement)throw new TypeError('A document is required for a level card.');
const element=(slot)=>{
const result=document.createElement(SLOT_TAGS[slot]);
result.className=classNames(
`level-card-${slot.replace(/[A-Z]/g,(c)=>`-${c.toLowerCase()}`)}`,
classes[slot],
);
return result;
};
const button=document.createElement('button');
button.type='button';
button.className=classNames('level-card',className);
const view=Object.fromEntries(Object.keys(SLOT_TAGS).map((slot)=>[slot,element(slot)]));
view.campaignHeading.setAttribute('role','heading');
view.campaignHeading.setAttribute('aria-level','3');
view.preview.setAttribute('aria-hidden','true');
view.check.setAttribute('aria-hidden','true');
view.check.textContent='✓';
view.meta.append(view.number,view.position);
view.progressGroup.append(view.progress,view.stars);
button.append(
view.campaignHeading,
view.meta,
view.title,
view.campaign,
view.progressGroup,
view.status,
view.preview,
view.check,
);
return Object.freeze({button,...view});
}

/** Shared, presentation-only level-card state for the core and company hosts. */
function levelCardPresentation({
globalLevelNumber=null,
campaignLevelNumber,
campaignLevelCount,
collection='Journey',
progressState={state:'new',bestStars:null},
}){
if(
!(
globalLevelNumber===null||
(Number.isSafeInteger(globalLevelNumber)&&globalLevelNumber>0)
)||
!Number.isSafeInteger(campaignLevelNumber)||
campaignLevelNumber<1||
!Number.isSafeInteger(campaignLevelCount)||
campaignLevelCount<campaignLevelNumber
)
throw new TypeError('Level-card numbering is invalid.');
const bestStars=starCount(progressState.bestStars);
if(
!['new','skipped','completed'].includes(progressState.state)||
!(bestStars===null||[1,2,3].includes(bestStars))
)
throw new TypeError('Level-card progress is invalid.');
return Object.freeze({
globalLevelNumber,
globalLabel:globalLevelNumber===null?collection:`#${globalLevelNumber}`,
campaignLabel:`${campaignLevelNumber}/${campaignLevelCount}`,
completed:progressState.state==='completed',
progressState:progressState.state,
bestStars,
stars:bestStars===null?'☆☆☆':`${'★'.repeat(bestStars)}${'☆'.repeat(3-bestStars)}`,
});
}

/** Applies host-independent visual state without replacing the card node. */
function applyLevelCardPresentation(view,presentation){
if(!view?.button|| !view.stars)throw new TypeError('A level-card view is required.');
view.button.dataset.completionState=presentation.progressState;
view.button.dataset.bestStars=
presentation.bestStars===null?'':String(presentation.bestStars);
view.button.dataset.levelNumber=
presentation.globalLevelNumber===null?'':String(presentation.globalLevelNumber);
view.stars.textContent=presentation.stars;
return view;
}

return{createLevelCardView,levelCardPresentation,applyLevelCardPresentation};
})();
modules['game/ui/mission-library-browser.mjs']=(()=>{
const attachMissionLibraryGoal=
modules['game/ui/mission-library-goal.mjs']['attachMissionLibraryGoal'];
const t=simGlobalI18n['t'];
const localizedText=simGlobalI18n['localizedText'];
const localizedMessage=simGlobalI18n['localizedMessage'];
const localizedAttribute=simGlobalI18n['localizedAttribute'];
const formatNumber=simGlobalI18n['formatNumber'];
const renderMessage=simGlobalI18n['render'];
const LIBRARY_COLLECTIONS=modules['game/mission-library/library.mjs']['LIBRARY_COLLECTIONS'];
const LIBRARY_MODES=modules['game/mission-library/library.mjs']['LIBRARY_MODES'];
const LIBRARY_LIFECYCLES=modules['game/mission-library/library.mjs']['LIBRARY_LIFECYCLES'];
const trackMissionLibraryOpening=
modules['game/mission-library/opening-intent.mjs']['trackMissionLibraryOpening'];
const applyLevelCardPresentation=
modules['game/ui/level-card.mjs']['applyLevelCardPresentation'];
const createLevelCardView=modules['game/ui/level-card.mjs']['createLevelCardView'];
const levelCardPresentation=modules['game/ui/level-card.mjs']['levelCardPresentation'];

const LIBRARY_TAG_KEYS=Object.freeze({
Journey:'common:collections.journey',
Classic:'common:collections.classic',
Custom:'common:collections.custom',
Remix:'interface:missionLibrary.tag.Remix',
Ukrainian:'interface:missionLibrary.tag.Ukrainian',
FPV:'interface:missionLibrary.tag.FPV',
Arcade:'interface:missionLibrary.tag.Arcade',
Tactical:'interface:missionLibrary.tag.Tactical',
Practice:'interface:missionLibrary.tag.Practice',
});

const modeLabel=(mode)=>
({solo:t('interface:solo2'),versus:t('interface:versus2'),team:t('interface:team')})[
mode
];
const sizeLabel=(bytes)=>
bytes<1024*1024
?`${formatNumber(Math.ceil(bytes/1024))} KiB`
:`${formatNumber(bytes/(1024*1024),{minimumFractionDigits:1,maximumFractionDigits:1})} MiB`;

/** Same flat mission surface across hosts. Owner adapters, not this UI, validate
     * launches, prepare pictures, award progress and decide the next mission. */
function attachMissionLibraryBrowser({
document:doc=globalThis.document,
library,
mode='solo',
onPause,
onReturn,
readState=()=>null,
writeState=()=>{},
launchContext=()=>({}),
getCurrentId=()=>null,
supportedModes=LIBRARY_MODES,
availableCollectionsOnly=false,
goalPreferenceOptions={},
description=localizedMessage(
'interface:allMissionsOneLibraryJourneyClassicAndCustomKeepTheir',
),
random=Math.random,
renderPreview=()=>null,
createArtworkView=null,
retune={},
onSelection=()=>{},
}){
if(
!Array.isArray(supportedModes)||
!supportedModes.includes(mode)||
supportedModes.some((value)=> !LIBRARY_MODES.includes(value))
)
throw new TypeError(t('interface:unknownMissionLibraryMode'));
if(typeof random!=='function')throw new TypeError('A random number source is required.');
const modes=[...new Set(supportedModes)];
const menuRetuneOrigin=retune.origin??(()=>null);
const commitMenuRetune=retune.commit??(()=>{});
const collections=()=>
availableCollectionsOnly
?LIBRARY_COLLECTIONS.filter((value)=>
library.missions.some(
(row)=>row.collection===value&&row.modes.some((item)=>modes.includes(item)),
),
)
:LIBRARY_COLLECTIONS;
const node=(tag,id,text)=>{
const result=doc.createElement(tag);
if(id)result.id=id;
if(text!==undefined)localizedText(result,()=>text);
return result;
};
const dialog=node('dialog','journey-chooser');
let retuneOrigin=null;
dialog.className='journey-chooser mission-library-chooser';
dialog.setAttribute('aria-labelledby','journey-chooser-title');
const heading=node(
'h2',
'journey-chooser-title',
localizedMessage('interface:findYourNextLine'),
);
const copy=node('p',null,description);
copy.className='journey-library-copy';
const filters=node('div');
filters.className='journey-filters';
function field(title,id,type='select',parent=filters){
const label=node('label'),
caption=node('span',null,title),
control=node(type,id);
caption.className='journey-filter-label';
label.append(caption,control);
parent.append(label);
return control;
}
const search=field(
localizedMessage('interface:searchAllMissions'),
'journey-search',
'input',
);
search.parentElement.className='journey-search-field';
search.type='search';
localizedAttribute(search,'placeholder',()=>t('interface:missionCampaignEditionOrTag'));
const searchControls=node('div');
searchControls.className='journey-search-controls';
const clearSearch=node(
'button',
'journey-search-clear',
localizedMessage('interface:clearSearch'),
);
clearSearch.type='button';
clearSearch.className='button secondary';
clearSearch.setAttribute('aria-controls','journey-cards');
search.parentElement.after(searchControls);
searchControls.append(search.parentElement,clearSearch);
const filterDetails=node('details','journey-filter-details');
filterDetails.className='journey-filter-details';
const filterSummary=node(
'summary',
'journey-filter-summary',
localizedMessage('interface:filters'),
);
const filterOptions=node('div');
filterOptions.className='journey-filter-options';
filterDetails.append(filterSummary,filterOptions);
filters.append(filterDetails);
const collection=field(
localizedMessage('interface:collection'),
'journey-collection',
'select',
filterOptions,
);
const lifecycle=field(
localizedMessage('interface:missionLibrary.lifecycle.filter'),
'journey-lifecycle',
'select',
filterOptions,
);
const campaign=field(
localizedMessage('interface:campaign'),
'journey-campaign',
'select',
filterOptions,
);
const modeFilter=field(
localizedMessage('interface:mode'),
'journey-mode',
'select',
filterOptions,
);
const detailLabel=node('label');
detailLabel.className='journey-card-detail-control';
const detailedCards=node('input','journey-detailed-cards');
detailedCards.type='checkbox';
detailLabel.append(
detailedCards,
node('span',null,localizedMessage('interface:detailedMissionCards')),
);
filterOptions.append(detailLabel);
const view=doc.defaultView??globalThis;
const media=view.matchMedia?.('(max-width: 600px), (max-height: 720px)');
let compact=media?.matches===true;
filterDetails.open= !compact;
const option=(title,value)=>{
const result=node('option',null,title);
result.value=value;
return result;
};
collection.append(
option(localizedMessage('interface:all'),''),
...collections().map((value)=>option(()=>t(LIBRARY_TAG_KEYS[value]),value)),
);
collection.value='';
lifecycle.append(
option(localizedMessage('interface:current'),'current'),
option(localizedMessage('interface:missionLibrary.lifecycle.archive'),'archive'),
option(localizedMessage('interface:missionLibrary.lifecycle.all'),''),
);
lifecycle.value='current';
modeFilter.append(...modes.map((value)=>option(()=>modeLabel(value),value)));
modeFilter.value=mode;
modeFilter.parentElement.hidden=modes.length===1;
const status=node('p','journey-chooser-status');
status.setAttribute('role','status');
const campaignRail=node('nav','journey-campaign-rail');
campaignRail.className='journey-campaign-rail';
localizedAttribute(campaignRail,'aria-label',()=>t('interface:campaign'));
const list=node('div','journey-cards');
list.className='journey-cards';
const footer=node('div');
footer.className='journey-footer';
const randomLevel=node(
'button',
'journey-random-level',
localizedMessage('interface:randomLevel'),
);
randomLevel.type='button';
randomLevel.className='button primary';
randomLevel.setAttribute('aria-controls','journey-cards');
localizedAttribute(randomLevel,'title',()=>
t('interface:playRandomLevelFromVisibleResults'),
);
const back=node('button','journey-back',localizedMessage('common:navigation.backToGame'));
back.type='button';
back.className='button secondary';
footer.append(randomLevel,back);
dialog.append(heading,copy,filters,status,campaignRail,list,footer);
doc.body.append(dialog);
const cards=new Map(),
preparations=new Map();
let opener=null,
nativeReturnFocus=null,
selectedId='',
savedScroll=0,
pendingCampaign='',
pendingSelection=null,
visit=0,
destroyed=false,
restoringCardFocus=false,
resizeFrame=null,
resizeAnchor=null,
viewportAnchor=null,
message='';
let goal=null;
let initialOpen=true;
let saved=null;
try{
saved=readState();
}catch{
/* Session-only browsing still works. */
}
if(saved&&typeof saved==='object'){
if(typeof saved.search==='string')search.value=saved.search.slice(0,512);
if(collections().includes(saved.collection))collection.value=saved.collection;
if(saved.lifecycle===''||LIBRARY_LIFECYCLES.includes(saved.lifecycle))
lifecycle.value=saved.lifecycle;
// The caller scopes state by hosting mode. Its browsing filter can point at
// another mode and must survive a round trip back to this same host.
if(modes.includes(saved.mode)){
modeFilter.value=saved.mode;
selectedId=typeof saved.selectedId==='string'?saved.selectedId:'';
savedScroll=Number.isFinite(saved.scroll)?Math.max(0,saved.scroll):0;
pendingCampaign=typeof saved.campaign==='string'?saved.campaign:'';
}
}
function state(){
return{
search:search.value||'',
collection:collection.value||'',
lifecycle:lifecycle.value,
campaign:campaign.value||pendingCampaign,
mode:modeFilter.value,
selectedId,
scroll:dialog.open?list.scrollTop||0:savedScroll,
};
}
function remember({captureFocus=true}={}){
const focusedId=doc.activeElement?.closest('.journey-card')?.dataset.missionId;
if(captureFocus&&focusedId&&list.contains(doc.activeElement))selectedId=focusedId;
if(dialog.open)savedScroll=list.scrollTop||0;
try{
writeState(state());
}catch{
/* Do not block play on browser storage. */
}
}
function retirePreparations({except=null}={}){
for(const[id,preparation]of preparations)
if(id!==except){
preparation.controller.abort();
preparations.delete(id);
}
}
function rebuildCampaigns(requested=campaign.value||pendingCampaign){
if(!modes.includes(modeFilter.value))modeFilter.value=mode;
if(availableCollectionsOnly){
const selected=collection.value,
choices=collections();
collection.replaceChildren(
option(localizedMessage('interface:all'),''),
...choices.map((value)=>option(()=>t(LIBRARY_TAG_KEYS[value]),value)),
);
collection.value=choices.includes(selected)?selected:'';
}
const choices=new Map();
for(const row of library.forMode(modeFilter.value))
if(
(!collection.value||row.collection===collection.value)&&
(!lifecycle.value||row.lifecycle===lifecycle.value)
)
choices.set(row.campaignKey,()=>{
const display=library.presentation?.(row)??row;
return`${display.campaignTitle} · ${display.edition}`;
});
campaign.replaceChildren(
option(localizedMessage('interface:allCampaigns'),''),
...[...choices].map(([key,title])=>option(title,key)),
);
campaign.value=choices.has(requested)?requested:'';
// Remote metadata arrives only after the deliberate open. Keep a saved
// campaign pending until that exact option exists, not as a hidden filter.
if(campaign.value)pendingCampaign='';
}
rebuildCampaigns();
function retirePendingSelection(){
const pending=pendingSelection;
pendingSelection=null;
pending?.opening.dispose();
}
function currentSelectionButton(id){
const card=cards.get(id);
return card?.button.isConnected&&
!card.button.disabled&&
list.contains(card.button)&&
library.find(id)===card.row
?card.button
:null;
}
function updateCampaignRailSelection(id=selectedId||getCurrentId()){
const selected=library.find(id);
onSelection(selected??null,{mode:modeFilter.value});
const key=selected?.campaignKey??'';
for(const shortcut of campaignRail.children)
shortcut.setAttribute('aria-pressed',String(shortcut.dataset.campaignKey===key));
}
function primary(){
const selected=currentSelectionButton(selectedId);
if(selected)return selected;
// A saved remote selection may arrive after the first render. Keep its
// opening lease on Search instead of silently selecting another mission.
if(selectedId&& !library.find(selectedId))return search;
const current=
!selectedId&&modeFilter.value===mode?currentSelectionButton(getCurrentId()):null;
return(
current??
[...list.querySelectorAll('.journey-card')].find((button)=> !button.disabled)??
search
);
}
function restoreSelection(){
const target=primary();
target.focus({preventScroll:true});
list.scrollTop=savedScroll;
if(target!==search)target.scrollIntoView?.({block:'nearest'});
if(selectedId&& !library.find(selectedId)&& !doc.hidden&&doc.hasFocus?.()!==false){
const opening=trackMissionLibraryOpening({
document:doc,
onRetire(){
if(pendingSelection?.opening===opening)pendingSelection=null;
},
});
pendingSelection={
opening,
visit,
id:selectedId,
scroll:savedScroll,
};
}
}
function restorePendingSelection(){
const pending=pendingSelection;
if(!pending)return;
if(
pending.visit!==visit||
!dialog.open||
doc.hidden||
doc.hasFocus?.()===false||
!pending.opening.current()
){
retirePendingSelection();
return;
}
const button=currentSelectionButton(pending.id);
if(!button&& !library.find(pending.id))return;
retirePendingSelection();
const target=button??primary();
target.focus({preventScroll:true});
list.scrollTop=pending.scroll;
if(target!==search)target.scrollIntoView?.({block:'nearest'});
}
function selectExact(id,{focus=false}={}){
const row=library.find(id);
if(!row|| !row.modes.includes(mode))return false;
retirePendingSelection();
// Exact incoming selections belong to this host, even when its last
// browsing session was looking at a different mode.
const modeChanged=modeFilter.value!==mode;
modeFilter.value=mode;
lifecycle.value=row.lifecycle;
pendingCampaign='';
if(modeChanged|| !list.contains(cards.get(id)?.button)){
search.value='';
collection.value='';
campaign.value='';
rebuildCampaigns();
if(modeChanged)invalidateDiagrams();
render();
}
selectedId=id;
if(focus){
cards.get(id)?.button.focus({preventScroll:true});
cards.get(id)?.button.scrollIntoView?.({block:'nearest'});
}
remember();
return true;
}
function selectionVisibilityChanged(){
if(doc.hidden){
retirePendingSelection();
cancelResizeScroll();
}
}
const displayName=(row)=>
library.find(row.id)===row?library.presentation(row).name:row.name;
doc.addEventListener('visibilitychange',selectionVisibilityChanged);
view.addEventListener?.('blur',retirePendingSelection);
view.addEventListener?.('blur',cancelResizeScroll);
async function activate(row,button){
// Detached cards retain their event handlers. A past view (or a closed
// chooser) must not launch or prepare content after its intent has ended.
if(
destroyed||
!dialog.open||
doc.hidden||
doc.hasFocus?.()===false||
cards.get(row.id)?.button!==button||
!list.contains(button)||
library.find(row.id)!==row||
!row.modes.includes(modeFilter.value)
)
return;
if(preparations.has(row.id))return;
retirePendingSelection();
retirePreparations({except:row.id});
selectedId=row.id;
updateCampaignRailSelection(row.id);
// Touch activation need not move keyboard focus off a different card.
remember({captureFocus:false});
const activeMode=modeFilter.value;
let availability;
try{
availability=library.availability(row,activeMode);
}catch(error){
message=error.message;
render();
return;
}
if(availability.state==='preparing')return;
if(availability.state==='download'||availability.retry){
const ticket=visit;
const controller=new AbortController();
const preparation={controller,mode:activeMode,row,ticket};
preparations.set(row.id,preparation);
message='';
try{
const result=await library.prepare(row,{
mode:activeMode,
signal:controller.signal,
});
const current=
preparations.get(row.id)===preparation&&
ticket===visit&&
dialog.open&&
!destroyed&&
!doc.hidden&&
doc.hasFocus?.()!==false&&
modeFilter.value===activeMode&&
cards.get(row.id)?.button===button&&
list.contains(button)&&
library.find(row.id)?.id===row.id;
if(current)
message=
result.state==='cancelled'
?localizedMessage('interface:downloadCancelledYourCurrentGameIsKept')
:result.state==='ready'
?()=>t('interface:missionLibrary.prepared',{name:displayName(row)})
:'';
if(current&&result.state==='ready'){
preparations.delete(row.id);
render();
const readyRow=library.find(row.id),
readyButton=cards.get(row.id)?.button;
if(readyRow&&readyButton)return activate(readyRow,readyButton);
}
}catch(error){
if(ticket===visit)
message=()=>
t('interface:missionLibrary.prepareFailed',{
name:displayName(row),
error:error.message,
});
}finally{
if(preparations.get(row.id)===preparation)preparations.delete(row.id);
if(dialog.open&&ticket===visit)render();
}
return;
}
if(availability.state!=='ready')return;
// Existing hosts must leave the picker before taking their atomic attempt
// ticket. Keep filters/focus for an unsuccessful or cancelled handoff.
const ticket= ++visit;
remember({captureFocus:false});
let context=null,
closeRetired=false;
// close() restores native focus and may run reentrant host listeners before
// the owner's launch lease exists. Admit only this input turn and the
// browser's expected return targets; a newer action must keep its focus.
const closingFocus=new Set([
doc.activeElement,
nativeReturnFocus,
doc.body,
doc.documentElement,
dialog,
]);
const retireClose=()=>{
closeRetired=true;
};
const closingFocusChanged=()=>{
if(!closingFocus.has(doc.activeElement))retireClose();
};
const closingInputs=['keydown','pointerdown','click'];
const mayRestore=()=>
!closeRetired&&
ticket===visit&&
!destroyed&&
!doc.hidden&&
doc.hasFocus?.()!==false&&
context?.isCurrent?.()!==false;
const mayLaunch=()=>
mayRestore()&&
closingFocus.has(doc.activeElement)&&
modeFilter.value===activeMode&&
cards.get(row.id)?.button===button&&
list.contains(button)&&
library.find(row.id)===row;
try{
doc.addEventListener('focusin',closingFocusChanged,true);
for(const type of closingInputs)doc.addEventListener(type,retireClose,true);
try{
context=launchContext(row,{mode:activeMode});
if(!mayLaunch()){
context?.retire?.();
return;
}
dialog.close();
if(!mayLaunch()||dialog.open){
context?.retire?.();
return;
}
}finally{
doc.removeEventListener('focusin',closingFocusChanged,true);
for(const type of closingInputs)doc.removeEventListener(type,retireClose,true);
}
const accepted=await library.launch(row,{
...context,
mode:activeMode,
});
if(accepted===false&&mayRestore()){
message=localizedMessage('interface:missionNotOpenedYourCurrentGameIsKept');
open(opener,{returnLabel:back.textContent,retune:false});
}
}catch(error){
if(mayRestore()){
message=()=>
t('interface:missionLibrary.launchFailed',{
name:displayName(row),
error:error.message,
});
open(opener,{returnLabel:back.textContent,retune:false});
}
}
}
function readyRandomRows(){
return library
.search(search.value||'',{
mode:modeFilter.value,
collection:collection.value,
lifecycle:lifecycle.value,
})
.filter((row)=>library.availability(row,modeFilter.value).state==='ready');
}
function playRandom({resetFilters=false}={}){
if(destroyed|| !dialog.open||doc.hidden||doc.hasFocus?.()===false)return false;
retirePendingSelection();
retirePreparations();
if(resetFilters){
++visit;
message='';
search.value='';
collection.value='';
lifecycle.value='current';
modeFilter.value=mode;
selectedId='';
savedScroll=0;
list.scrollTop=0;
pendingCampaign='';
rebuildCampaigns();
invalidateDiagrams();
render();
remember({captureFocus:false});
}
const ready=readyRandomRows();
const alternatives=ready.filter((row)=>row.id!==getCurrentId());
const choices=alternatives.length?alternatives:ready;
if(!choices.length){
message=localizedMessage('interface:noReadyLevelsMatchTheseFilters');
render();
return false;
}
const draw=Number(random());
const bounded=Number.isFinite(draw)?Math.min(Math.max(draw,0),1-Number.EPSILON):0;
const row=choices[Math.floor(bounded*choices.length)];
const button=cards.get(row.id)?.button;
if(!button||button.disabled|| !list.contains(button)){
message=localizedMessage('interface:noReadyLevelsMatchTheseFilters');
render();
return false;
}
selectedId=row.id;
void activate(row,button);
return true;
}
function makeCard(row){
const view=createLevelCardView({
document:doc,
className:'journey-card journey-card-illustrated',
classes:{
campaignHeading:'journey-campaign-heading',
meta:'journey-card-meta',
number:'journey-card-number',
position:'journey-card-position',
title:'journey-card-title',
campaign:'journey-card-campaign',
progressGroup:'journey-card-progress-group',
progress:'journey-card-progress',
stars:'journey-card-stars',
status:'journey-card-action',
preview:'journey-card-preview',
check:'journey-card-check',
},
});
const{
button,
campaignHeading,
number,
position:campaignPosition,
title:name,
campaign:campaignName,
progress,
stars,
status:action,
preview,
check,
}=view;
button.dataset.missionId=row.id;
const display=()=>library.presentation?.(row)??row;
localizedText(campaignHeading,()=>display().campaignTitle);
localizedText(name,()=>display().name);
localizedText(campaignName,()=>display().campaignTitle);
localizedAttribute(button,'data-campaign-title',()=>display().campaignTitle);
const edition=node('span',null,()=>display().edition);
edition.className='journey-card-edition';
const tags=node('span',null,()=>
row.tags.map((tag)=>t(LIBRARY_TAG_KEYS[tag])).join(' · '),
);
tags.className='journey-card-tags';
const rules=node('span',null,row.rules);
rules.className='journey-card-challenge';
rules.hidden= !row.rules;
const route=node('span');
route.className='journey-card-route';
const mastery=node('span');
mastery.className='journey-card-mastery';
button.append(edition,tags,rules,route,mastery);
button.onclick=()=>activate(row,button);
button.addEventListener('focusin',()=>{
selectedId=row.id;
updateCampaignRailSelection(row.id);
goal?.refresh();
});
return{
row,
button,
campaignHeading,
number,
campaignPosition,
progress,
stars,
rules,
route,
mastery,
action,
preview,
check,
diagram:null,
artwork:null,
completion:null,
};
}
function render(){
if(destroyed)return;
clearSearch.hidden= !search.value;
const focused=doc.activeElement;
const focusedId=list.contains(focused)?focused?.dataset.missionId:null;
const focusedCampaignKey=campaignRail.contains(focused)
?focused?.dataset.campaignKey
:null;
const scroll=list.scrollTop||0;
const campaignScroll=campaignRail.scrollLeft||0;
const railRows=library.search(search.value||'',{
mode:modeFilter.value,
collection:collection.value,
lifecycle:lifecycle.value,
});
// Campaigns are navigation anchors, never a hidden second filter. Every
// matching campaign remains in this one scroll surface.
const matches=railRows;
randomLevel.disabled= !matches.some(
(row)=>library.availability(row,modeFilter.value).state==='ready',
);
localizedText(
status,
()=>
`${t('common:counts.missions',{count:matches.length})} · ${modeLabel(modeFilter.value)}${message?` · ${renderMessage(message)}`:''}`,
);
const filtersActive=
!!collection.value||modeFilter.value!==mode||lifecycle.value!=='current';
localizedText(filterSummary,()=>
filtersActive?t('interface:filtersActive'):t('interface:filters'),
);
const campaignChoices=new Map();
for(const row of railRows)
if(!campaignChoices.has(row.campaignKey))
campaignChoices.set(row.campaignKey,{
row,
count:0,
});
for(const row of railRows)campaignChoices.get(row.campaignKey).count++;
const shortcuts=[...campaignChoices].map(([key,info])=>{
const shortcut=node('button');
localizedText(shortcut,()=>{
const display=library.presentation?.(info.row)??info.row;
return`${display.campaignTitle} · ${t('common:counts.missions',{count:info.count})}`;
});
shortcut.type='button';
shortcut.className='journey-campaign-shortcut';
shortcut.dataset.campaignKey=key;
shortcut.setAttribute('aria-pressed','false');
localizedAttribute(shortcut,'title',()=>{
const display=library.presentation?.(info.row)??info.row;
return display.edition;
});
shortcut.onclick=()=>{
if(destroyed|| !dialog.open||doc.hidden||doc.hasFocus?.()===false)return;
retirePendingSelection();
retirePreparations();
campaign.value=key;
pendingCampaign='';
const target=[...list.querySelectorAll('.journey-card')].find(
(card)=>card.dataset.campaignKey===key,
);
if(!target||target.disabled)return;
selectedId=target.dataset.missionId;
target.focus({preventScroll:true});
target.scrollIntoView?.({block:'start',inline:'nearest'});
remember({captureFocus:false});
};
return shortcut;
});
campaignRail.replaceChildren(...shortcuts);
campaignRail.hidden=shortcuts.length<2;
let previousCampaign=null;
const buttons=matches.map((row)=>{
const display=()=>library.presentation?.(row)??row;
let card=cards.get(row.id);
if(card?.row!==row){
if(card)hidePreview(card);
card=makeCard(row);
cards.set(row.id,card);
}
const availability=library.availability(row,modeFilter.value);
const progressState=library.progressState(row,modeFilter.value);
const cardPresentation=levelCardPresentation({...row,progressState});
applyLevelCardPresentation(card,cardPresentation);
localizedText(card.number,()=>
row.globalLevelNumber===null
?t('interface:missionLibrary.customLevel')
:t('interface:missionLibrary.levelNumber',{number:row.globalLevelNumber}),
);
localizedText(card.campaignPosition,()=>
t('interface:missionLibrary.campaignPosition',{
position:row.campaignLevelNumber,
total:row.campaignLevelCount,
}),
);
localizedText(card.stars,()=>cardPresentation.stars);
localizedAttribute(card.stars,'aria-label',()=>
progressState.state==='completed'
?progressState.bestStars===null
?t('interface:missionLibrary.completedStarsUnknown')
:t('interface:missionLibrary.completedStars',{stars:progressState.bestStars})
:t('interface:missionLibrary.notCompleted'),
);
const details=library.details(row,modeFilter.value);
localizedText(card.rules,()=>library.details(row,modeFilter.value).challenge);
card.rules.hidden= !details.challenge;
localizedText(card.route,()=>library.details(row,modeFilter.value).route);
card.route.hidden= !details.route;
localizedText(card.mastery,()=>{
const mastery=library.details(row,modeFilter.value).mastery;
return mastery
?t('interface:missionLibrary.optionalChallenge',{challenge:mastery})
:'';
});
card.mastery.hidden= !details.mastery;
card.completion=library.completion(row,modeFilter.value);
card.button.dataset.campaignKey=row.campaignKey;
card.button.dataset.campaignStart=String(previousCampaign!==row.campaignKey);
card.button.dataset.availabilityState=availability.included
?'included'
:availability.state;
card.button.dataset.pictureState=card.completion?.state??'unfinished';
card.button.dataset.current=String(row.id===getCurrentId());
card.campaignHeading.hidden=previousCampaign===row.campaignKey;
localizedText(card.progress,()=>
card.completion?.state==='unavailable'
?card.completion.reason
:library.progress(row,modeFilter.value)||
(progressState.state==='completed'&&progressState.bestStars===null
?t('interface:missionLibrary.completedStarsUnknown')
:''),
);
card.progress.hidden= !card.progress.textContent;
localizedText(card.action,()=>
availability.state==='ready'||availability.included
?''
:availability.state==='download'
?`${t('interface:downloadPlay')} · ${sizeLabel(availability.bytes)}`
:availability.state==='preparing'
?`${t('interface:preparing')}…`
:t(
availability.retry
?'interface:missionLibrary.unavailableRetry'
:'interface:missionLibrary.unavailableReason',
{reason:availability.reason},
),
);
card.action.hidden=availability.state==='ready'||availability.included;
localizedAttribute(card.button,'aria-label',()=>{
const progressLabel=
progressState.state==='completed'
?progressState.bestStars===null
?t('interface:missionLibrary.completedStarsUnknown')
:t('interface:missionLibrary.completedStars',{stars:progressState.bestStars})
:progressState.state==='skipped'
?t('interface:skippedTryAgain')
:t('interface:missionLibrary.notCompleted');
const ownerProgress=
progressState.state==='completed'&&progressState.bestStars===null
?library.progress(row,modeFilter.value)
:'';
return`${card.number.textContent} · ${displayName(row)} · ${display().campaignTitle} · ${card.campaignPosition.textContent} · ${progressLabel}${ownerProgress?` · ${ownerProgress}`:''}`;
});
card.button.disabled=availability.state==='unavailable'&& !availability.retry;
card.button.setAttribute('aria-busy',String(availability.state==='preparing'));
previousCampaign=row.campaignKey;
return card.button;
});
// Reuse buttons across status changes instead of throwing away keyboard focus.
if(
buttons.length!==list.children.length||
buttons.some((button,index)=>list.children[index]!==button)
)
list.replaceChildren(...buttons);
if(focusedCampaignKey&& !doc.hidden&&doc.hasFocus?.()!==false){
const replacement=shortcuts.find(
(shortcut)=>shortcut.dataset.campaignKey===focusedCampaignKey,
);
if(replacement?.isConnected&& !campaignRail.hidden){
if(doc.activeElement!==replacement)replacement.focus({preventScroll:true});
}else primary().focus({preventScroll:true});
}
campaignRail.scrollLeft=campaignScroll;
if(focusedId&& !doc.hidden&&doc.hasFocus?.()!==false){
const replacement=cards.get(focusedId)?.button;
if(replacement?.isConnected&&list.contains(replacement)&& !replacement.disabled){
if(doc.activeElement!==replacement){
restoringCardFocus=true;
try{
replacement.focus({preventScroll:true});
}finally{
restoringCardFocus=false;
}
}
}else primary().focus({preventScroll:true});
}
list.scrollTop=scroll;
for(const[id,card]of cards)
if(!library.find(id)){
hidePreview(card);
card.button.remove();
cards.delete(id);
}
restorePendingSelection();
updateCampaignRailSelection();
goal?.refresh();
observeDiagrams();
}
// Decode only near the viewport. An earned picture owns the same exact
// descriptor as Collection; release its decoded bytes when it leaves view.
function hidePreview(card){
const changed=
!!card.artwork||
!!card.diagram||
!!card.preview.querySelector('.journey-card-map')||
!!card.preview.querySelector('.journey-card-picture-status');
card.artwork?.release();
card.previewLease?.release?.();
card.previewLease=null;
card.artwork=null;
card.diagram=null;
if(changed)card.preview.replaceChildren();
}
function showPreview(card){
if(card.diagram|| !dialog.open|| !list.contains(card.button))return;
card.diagram=true;
try{
if(card.completion?.state==='earned'&&createArtworkView){
const canvas=node('canvas');
canvas.className='journey-card-map';
canvas.width=288;
canvas.setAttribute('aria-hidden','true');
const pictureStatus=node('span');
pictureStatus.className='journey-card-picture-status';
card.preview.append(canvas,pictureStatus);
card.artwork=createArtworkView({canvas,status:pictureStatus});
void card.artwork.show(card.completion.record);
}else{
const diagram=library.card(card.row,modeFilter.value);
if(!diagram)return;
card.previewLease=renderPreview({
container:card.preview,
diagram,
row:card.row,
mode:modeFilter.value,
document:doc,
});
}
}catch{
/* Optional previews cannot prevent a mission launch. */
}
}
const Observer=doc.defaultView?.IntersectionObserver??globalThis.IntersectionObserver;
const observer=
typeof Observer==='function'
?new Observer(
(entries)=>{
for(const entry of entries){
const card=cards.get(entry.target.dataset.missionId);
if(!card||library.find(card.row.id)!==card.row)continue;
if(entry.isIntersecting)showPreview(card);
else hidePreview(card);
}
},
{root:list,rootMargin:'120px'},
)
:null;
function fallbackPreviews(){
if(observer|| !dialog.open)return;
const bounds=list.getBoundingClientRect();
let shown=0;
for(const button of list.querySelectorAll('.journey-card')){
const card=cards.get(button.dataset.missionId),
rect=button.getBoundingClientRect();
const near=rect.bottom>=bounds.top-120&&rect.top<=bounds.bottom+120;
// A bounded fallback also works in hosts without layout observation.
if(near&&shown<12){
showPreview(card);
shown++;
}else hidePreview(card);
}
}
function observeDiagrams(){
for(const card of cards.values())
if(!list.contains(card.button)){
observer?.unobserve?.(card.button);
hidePreview(card);
}
for(const button of list.querySelectorAll('.journey-card'))observer?.observe?.(button);
fallbackPreviews();
}
function captureViewportAnchor(){
if(!dialog.open)return;
const bounds=list.getBoundingClientRect();
for(const button of list.querySelectorAll('.journey-card')){
const rect=button.getBoundingClientRect();
if(rect.bottom>=bounds.top){
viewportAnchor={
id:button.dataset.missionId,
offset:rect.top-bounds.top,
};
return;
}
}
}
list.addEventListener('scroll',fallbackPreviews);
list.addEventListener('scroll',captureViewportAnchor);
function invalidateDiagrams(){
observer?.disconnect();
for(const card of cards.values())hidePreview(card);
}
function cancelResizeScroll({retainAnchor=false}={}){
if(resizeFrame!==null)view.cancelAnimationFrame?.(resizeFrame);
resizeFrame=null;
if(!retainAnchor)resizeAnchor=null;
}
function resetViewportAnchor(){
cancelResizeScroll();
viewportAnchor=null;
}
function preserveViewportAnchor(){
const eligible= !destroyed&&dialog.open&& !doc.hidden&&doc.hasFocus?.()!==false;
cancelResizeScroll({retainAnchor:eligible});
if(!eligible)return;
if(!resizeAnchor){
if(!viewportAnchor)captureViewportAnchor();
resizeAnchor=viewportAnchor&&{...viewportAnchor};
}
const anchor=resizeAnchor&&{...resizeAnchor};
if(!anchor)return;
const ticket=visit;
const restore=()=>{
resizeFrame=null;
if(
destroyed||
ticket!==visit||
!dialog.open||
doc.hidden||
doc.hasFocus?.()===false
){
resizeAnchor=null;
return;
}
const target=currentSelectionButton(anchor.id);
if(!target){
resizeAnchor=null;
return;
}
const bounds=list.getBoundingClientRect();
const delta=target.getBoundingClientRect().top-bounds.top-anchor.offset;
if(Number.isFinite(delta)&&Math.abs(delta)>=1)list.scrollTop+=delta;
viewportAnchor=anchor;
resizeAnchor=null;
};
if(view.requestAnimationFrame)resizeFrame=view.requestAnimationFrame(restore);
else restore();
}
view.addEventListener?.('resize',preserveViewportAnchor);
function resizeFilters(event){
compact=event.matches===true;
layoutGoal();
// Keep the exact focused control and selection across rotation. If a
// compact transition catches focus inside the filter panel, leave that
// panel open until the player moves onward instead of relocating focus.
const focused=doc.activeElement;
filterDetails.open= !compact||filterOptions.contains(focused);
if(dialog.open)observeDiagrams();
preserveViewportAnchor();
}
media?.addEventListener?.('change',resizeFilters);
detailedCards.addEventListener('change',()=>{
dialog.classList.toggle('mission-library-detailed',detailedCards.checked);
if(dialog.open)observeDiagrams();
});
dialog.addEventListener('focusin',(event)=>{
// A touch activation can deliberately leave keyboard focus on a different
// control. Retire its preparation only after a later focus transition;
// refocusing the preparing card keeps the owned one-action launch alive.
if(!restoringCardFocus){
const focusedCard=event.target.closest?.('.journey-card');
retirePreparations({
except:
focusedCard&&list.contains(focusedCard)?focusedCard.dataset.missionId:null,
});
}
// The compact filters float above cards. Once keyboard/controller focus
// reaches an action below them, remove that cover without moving focus or
// changing a filter. Focus and select previews inside the popover stay put.
if(
compact&&
filterDetails.open&&
(list.contains(event.target)||footer.contains(event.target))
)
filterDetails.open=false;
});
function close({retune=true}={}){
retirePendingSelection();
cancelResizeScroll();
++visit;
const wasOpen=dialog.open;
// Play already saved the visible position before closing. Native hidden
// layout reports zero; later disposal must not overwrite that position or
// return focus away from the action that now owns this page.
if(wasOpen)remember();
retirePreparations();
if(!wasOpen)return;
dialog.close();
if(onReturn)onReturn(opener);
else if(opener?.isConnected)opener.focus({preventScroll:true});
if(retune&& !dialog.open)commitMenuRetune(dialog,retuneOrigin);
}
function open(
origin=doc.activeElement,
{returnLabel=t('common:navigation.backToGame'),retune=true}={},
){
if(destroyed)return;
const changed= !dialog.open;
const landing=retune&&changed?menuRetuneOrigin(origin):null;
retirePendingSelection();
cancelResizeScroll();
++visit;
opener=origin;
if(initialOpen&& !saved&&library.find(getCurrentId())?.lifecycle==='archive')
lifecycle.value='archive';
initialOpen=false;
localizedText(back,()=>returnLabel);
onPause?.();
invalidateDiagrams();
rebuildCampaigns();
render();
if(!dialog.open)nativeReturnFocus=doc.activeElement;
dialog.showModal();
observeDiagrams();
restoreSelection();
if(landing){
retuneOrigin=landing;
commitMenuRetune(landing,dialog);
}else if(changed)retuneOrigin=null;
}
search.addEventListener('input',()=>{
resetViewportAnchor();
retirePendingSelection();
retirePreparations();
pendingCampaign='';
++visit;// Late preparation feedback belongs to the view that requested it.
message='';
selectedId='';
savedScroll=0;
list.scrollTop=0;
render();
captureViewportAnchor();
remember();
});
clearSearch.onclick=()=>{
if(destroyed|| !dialog.open||doc.hidden||doc.hasFocus?.()===false|| !search.value)
return;
const ticket=visit,
focused=doc.activeElement;
search.value='';
// Use the same bubbling input path as typing, including host-owned lazy
// loading invalidation. Clearing never changes the other visible filters.
const EventType=doc.defaultView?.Event||Event;
search.dispatchEvent(new EventType('input',{bubbles:true}));
if(
destroyed||
!dialog.open||
doc.hidden||
doc.hasFocus?.()===false||
visit!==ticket+1||
(doc.activeElement!==focused&&
!(focused===clearSearch&&doc.activeElement===doc.body))
)
return;
const first=[...list.querySelectorAll('.journey-card')].find(
(button)=> !button.disabled,
);
(first??(compact?filterSummary:collection)).focus({
preventScroll:true,
});
remember();
};
campaign.addEventListener('change',()=>{
retirePendingSelection();
retirePreparations();
pendingCampaign='';
const key=campaign.value;
if(!key)return;
const target=[...list.querySelectorAll('.journey-card')].find(
(card)=>card.dataset.campaignKey===key&& !card.disabled,
);
if(!target)return;
selectedId=target.dataset.missionId;
target.focus({preventScroll:true});
target.scrollIntoView?.({block:'start',inline:'nearest'});
updateCampaignRailSelection(selectedId);
remember({captureFocus:false});
});
for(const control of[collection,modeFilter,lifecycle])
control.addEventListener('change',()=>{
resetViewportAnchor();
retirePendingSelection();
retirePreparations();
++visit;
message='';
selectedId='';
savedScroll=0;
list.scrollTop=0;
pendingCampaign='';
rebuildCampaigns();
if(control===modeFilter)invalidateDiagrams();
render();
captureViewportAnchor();
remember();
});
back.onclick=close;
randomLevel.onclick=()=>playRandom();
dialog.addEventListener('close',()=>{
retirePendingSelection();
invalidateDiagrams();
});
dialog.addEventListener('cancel',(event)=>{
if(event.target===dialog){
event.preventDefault();
close();
}
});
const unsubscribe=library.subscribe(()=>{
if(dialog.open){
rebuildCampaigns();
render();
}
});
function revealExisting(id,targetMode=mode,{focus=true}={}){
const row=library.find(id);
if(!row|| !modes.includes(targetMode)|| !row.modes.includes(targetMode))return false;
retirePendingSelection();
const modeChanged=modeFilter.value!==targetMode;
modeFilter.value=targetMode;
lifecycle.value=row.lifecycle;
pendingCampaign='';
if(modeChanged|| !list.contains(cards.get(id)?.button)){
search.value='';
collection.value='';
campaign.value='';
rebuildCampaigns();
if(modeChanged)invalidateDiagrams();
render();
}
selectedId=id;
if(focus){
cards.get(id)?.button.focus({preventScroll:true});
cards.get(id)?.button.scrollIntoView?.({block:'nearest'});
}
goal?.refresh();
remember();
return true;
}
goal=attachMissionLibraryGoal({
container:footer,
library,
modes,
getMode:()=>modeFilter.value,
getSelectedId:()=>(currentSelectionButton(selectedId)?selectedId:null),
isActive:()=> !destroyed&&dialog.open&& !doc.hidden&&doc.hasFocus?.()!==false,
reveal:revealExisting,
onIntent(){
retirePendingSelection();
retirePreparations();
++visit;
},
...goalPreferenceOptions,
window:view,
});
function layoutGoal(){
if(!goal)return;
// Pinning is useful but secondary to seeing and choosing the next route.
// The same live controls move into compact Filters without duplicating
// their preferences, listeners or focused mission.
const focused=doc.activeElement;
(compact?filterOptions:footer).append(goal.element);
if(compact&&goal.element.contains(focused))filterDetails.open=true;
if(goal.element.contains(focused))focused.focus({preventScroll:true});
}
layoutGoal();
return{
elements:{dialog,list,footer,filters},
open,
primary,
restore(){
open(opener,{returnLabel:back.textContent,retune:false});
},
close,
state,
select(id){
return revealExisting(id,mode,{focus:false});
},
playRandom,
// Incoming launch intent keeps its existing host-mode ownership rule.
reveal:(id)=>revealExisting(id,mode),
refresh(){
if(dialog.open){
invalidateDiagrams();
rebuildCampaigns();
render();
}
},
destroy(){
close({retune:false});
destroyed=true;
goal.dispose();
unsubscribe();
observer?.disconnect();
media?.removeEventListener?.('change',resizeFilters);
doc.removeEventListener('visibilitychange',selectionVisibilityChanged);
view.removeEventListener?.('blur',retirePendingSelection);
view.removeEventListener?.('blur',cancelResizeScroll);
view.removeEventListener?.('resize',preserveViewportAnchor);
dialog.remove();
},
};
}

return{attachMissionLibraryBrowser};
})();
modules['game/profile-database.mjs']=(()=>{
/** Stable existing database identity; importing it must not load Journey or media. */
const JOURNEY_PROFILE_DATABASE='revealline-journey-v1';

return{JOURNEY_PROFILE_DATABASE};
})();
modules['game/profile-storage.mjs']=(()=>{
const required=modules['game/data-json.mjs']['required'];
const JOURNEY_PROFILE_DATABASE=
modules['game/profile-database.mjs']['JOURNEY_PROFILE_DATABASE'];

function validateTimeout(value){
required(
Number.isFinite(value)&&value>0,
'Reward storage needs a positive operation timeout.',
);
}

function boundedOperation(start,milliseconds,{signal,onAbort}={}){
return new Promise((resolve,reject)=>{
const controller=new AbortController();
let settled=false,
timer;
const clean=()=>{
clearTimeout(timer);
signal?.removeEventListener('abort',cancelled);
};
const fail=(error)=>{
if(settled)return;
settled=true;
clean();
controller.abort(error);
try{
onAbort?.(error);
}catch{
/* A failed cancellation cannot hold up recovery. */
}
reject(error);
};
const cancelled=()=>fail(signal.reason??new Error('Reward storage was cancelled.'));
if(signal?.aborted){
cancelled();
return;
}
signal?.addEventListener('abort',cancelled,{once:true});
timer=setTimeout(
()=>fail(new Error('Reward storage operation timed out.')),
milliseconds,
);
Promise.resolve()
.then(()=>{
controller.signal.throwIfAborted();
return start(controller.signal);
})
.then((value)=>{
if(settled)return;
settled=true;
clean();
resolve(value);
},fail);
});
}

/** A versioned sidecar in the existing Journey database. The profile and its
     * historical backup formats remain unchanged; this never writes arcade clears. */
function createProfileRecordBackend({
key,
empty,
validate,
indexedDB=globalThis.indexedDB,
canWrite=()=>true,
operationTimeoutMs=1500,
}={}){
required(
typeof key==='string'&&key.length>0&&key.length<=256,
'A bounded profile record key is required.',
);
required(
typeof empty==='function'&&typeof validate==='function',
'Profile record validation is required.',
);
required(typeof canWrite==='function','Rewards require a write guard.');
validateTimeout(operationTimeoutMs);
let opening=null,
connection=null,
closed=false;
const open=()=>{
required(!closed,'Reward storage is closed.');
required(indexedDB,'Reward storage is unavailable.');
if(connection)return Promise.resolve(connection);
if(opening)return opening.promise;
const attempt={promise:null,failed:false,cancel:null};
opening=attempt;
attempt.promise=new Promise((resolve,reject)=>{
const fail=(error)=>{
attempt.failed=true;
if(opening===attempt)opening=null;
reject(error??new Error('Reward storage could not be opened.'));
};
attempt.cancel=fail;
let request;
try{
request=indexedDB.open(JOURNEY_PROFILE_DATABASE,1);
}catch(error){
fail(error);
return;
}
request.onupgradeneeded=()=>{
if(closed||attempt.failed){
request.transaction?.abort();
return;
}
if(!request.result.objectStoreNames.contains('profiles'))
request.result.createObjectStore('profiles');
};
request.onsuccess=()=>{
const db=request.result;
if(attempt.failed||closed){
db.close();
return;
}
connection=db;
if(opening===attempt)opening=null;
db.onversionchange=()=>{
db.close();
if(connection===db)connection=null;
};
resolve(db);
};
request.onerror=()=>fail(request.error);
request.onblocked=()=>fail(new Error('Reward storage is busy in another tab.'));
});
return attempt.promise;
};
function transaction(update,{signal}={}){
let tx,pendingOpen;
return boundedOperation(
async(boundedSignal)=>{
if(update)required(canWrite(),'This tab does not own the saving lease.');
const openingPromise=open();
pendingOpen=opening;
const db=await openingPromise;
pendingOpen=null;
boundedSignal.throwIfAborted();
required(!closed,'Reward storage is closed.');
if(update)required(canWrite(),'This tab does not own the saving lease.');
return new Promise((resolve,reject)=>{
tx=db.transaction('profiles',update?'readwrite':'readonly');
const store=tx.objectStore('profiles'),
request=store.get(key);
let state,failure;
request.onsuccess=()=>{
try{
boundedSignal.throwIfAborted();
state=request.result===undefined?empty():validate(request.result);
if(update){
required(canWrite(),'This tab does not own the saving lease.');
state=validate(update(state));
boundedSignal.throwIfAborted();
store.put(state,key);
}
}catch(error){
failure=error;
try{
tx.abort();
}catch{
/* A timed-out transaction is already inactive. */
}
}
};
tx.oncomplete=()=>resolve(state);
tx.onerror=tx.onabort=()=>
reject(failure??tx.error??new Error('Rewards could not be saved.'));
});
},
operationTimeoutMs,
{
signal,
onAbort(error){
if(pendingOpen&&opening===pendingOpen)pendingOpen.cancel(error);
if(tx){
try{
tx.abort();
}catch{
/* The transaction may already have completed. */
}
}
},
},
);
}
return{
key,
read:(options)=>transaction(null,options),
update:transaction,
close(){
if(closed)return;
closed=true;
opening?.cancel(new Error('Reward storage is closed.'));
connection?.close();
connection=null;
},
};
}

return{validateTimeout,boundedOperation,createProfileRecordBackend};
})();
modules['game/enemy-stats.mjs']=(()=>{
const boundedJSON=modules['game/data-json.mjs']['boundedJSON'];
const dataIdentity=modules['game/data-json.mjs']['dataIdentity'];
const exactKeys=modules['game/data-json.mjs']['exactKeys'];
const required=modules['game/data-json.mjs']['required'];
const createProfileRecordBackend=
modules['game/profile-storage.mjs']['createProfileRecordBackend'];

const ENEMY_STATS_FORMAT='revealline-enemy-stats.v1';
const ENEMY_STATS_BACKUP_FORMAT='revealline-enemy-stats-backup.v1';
const ENEMY_STATS_SESSION_FORMAT='revealline-enemy-stats-session.v1';
const ENEMY_STATS_KEY=ENEMY_STATS_FORMAT;
const ENEMY_STATS_MAX_BYTES=4*1024*1024;
const ENEMY_STATS_LIMITS=Object.freeze({lineages:2048,buckets:256,cursors:64});
function canonicalEnemyFamily(family){
return(
{
still:'lookout',
humanoid:'lookout',
patrol:'patroller',
refuge:'refuge-seeker',
pair:'rendezvous-pair',
shield:'shield-bearer',
brace:'brace-trooper',
warden:'relay-warden',
sentry:'guard',
lane:'lane-boss',
'lane-attacker':'lane-boss',
relay:'relay-sentinel',
perimeter:'border-patrol',
contour:'contour-patrol',
rover:'claimed-rover',
ricochet:'bouncer',
'signal-jammer':'jammer',
}[family]??family
);
}
const WRITER_KEY=`${ENEMY_STATS_KEY}:writer`;
// Hosts and the aggregate backup dialog can keep separate services open in the
// same document. Drain their optimistic writes before merging a portable copy.
const coordinators=new WeakMap();
function coordinatorFor(database,storage){
const key=database&&typeof database==='object'?database:storage;
if(!key|| !['object','function'].includes(typeof key))
return{members:new Set(),imports:Promise.resolve()};
if(!coordinators.has(key))
coordinators.set(key,{members:new Set(),imports:Promise.resolve()});
return coordinators.get(key);
}
const id=(v)=>
typeof v==='string'&&
/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(v)&&
!['constructor','prototype','__proto__'].includes(v);
const integer=(v)=>Number.isSafeInteger(v)&&v>=0;
const map=(v)=>v&&typeof v==='object'&& !Array.isArray(v);
const own=(v,k)=>Object.hasOwn(v,k);
const uid=()=>globalThis.crypto.randomUUID();
const emptyEnemyStats=()=>({format:ENEMY_STATS_FORMAT,lineages:{},cursors:{}});

function counts(value,{buckets=false}={}){
required(
map(value)&&Object.keys(value).length<=ENEMY_STATS_LIMITS.buckets,
'Invalid enemy count table.',
);
for(const[key,n]of Object.entries(value)){
const parts=buckets?key.split('/'):[key];
required(
parts.length===(buckets?2:1)&&parts.every(id)&&integer(n),
'Invalid enemy count.',
);
}
}
function cursor(value){
exactKeys(
value,
['gameType','sequences','counts','boardCounts','updated'],
'Enemy attempt cursor',
);
required(
id(value.gameType)&&
integer(value.updated)&&
map(value.sequences)&&
Object.keys(value.sequences).length<=8,
'Invalid enemy attempt cursor.',
);
for(const[board,sequence]of Object.entries(value.sequences))
required(id(board)&&integer(sequence),'Invalid enemy board sequence.');
counts(value.counts);
required(
map(value.boardCounts)&&Object.keys(value.boardCounts).length<=8,
'Invalid enemy board totals.',
);
const total={};
for(const[board,row]of Object.entries(value.boardCounts)){
required(id(board),'Invalid enemy board.');
counts(row);
for(const[family,n]of Object.entries(row))add(total,family,n);
}
required(
Object.keys(total).length===Object.keys(value.counts).length&&
Object.keys(total).every((family)=>total[family]===value.counts[family]),
'Enemy board totals differ.',
);
}
function validateEnemyStats(source){
const value=boundedJSON(source,{
maxBytes:ENEMY_STATS_MAX_BYTES,
maxNodes:250000,
maxDepth:6,
maxString:256,
});
exactKeys(value,['format','lineages','cursors'],'Enemy statistics');
required(
value.format===ENEMY_STATS_FORMAT&&map(value.lineages)&&map(value.cursors),
'Unsupported enemy statistics.',
);
required(
Object.keys(value.lineages).length<=ENEMY_STATS_LIMITS.lineages&&
Object.keys(value.cursors).length<=ENEMY_STATS_LIMITS.cursors,
'Enemy statistics capacity reached.',
);
for(const[lineage,row]of Object.entries(value.lineages)){
required(id(lineage),'Invalid enemy statistics writer.');
counts(row,{buckets:true});
}
for(const[attempt,row]of Object.entries(value.cursors)){
required(id(attempt),'Invalid enemy statistics attempt.');
cursor(row);
}
return value;
}

/** Backup counters are grow-only components. A repeated or older snapshot must
     * never be added to a lifetime total, and attempt cursors are local-only. */
function inspectEnemyStatsBackup(source){
const value=boundedJSON(source,{
maxBytes:ENEMY_STATS_MAX_BYTES,
maxNodes:250000,
maxDepth:6,
maxString:256,
});
exactKeys(value,['format','statistics'],'Enemy statistics backup');
required(value.format===ENEMY_STATS_BACKUP_FORMAT,'Unsupported enemy statistics backup.');
value.statistics=validateEnemyStats(value.statistics);
required(
Object.keys(value.statistics.cursors).length===0,
'Portable enemy statistics cannot resume a live attempt.',
);
return value;
}
function mergeEnemyStats(left,right){
const base=validateEnemyStats(left),
incoming=validateEnemyStats(right);
for(const[lineage,row]of Object.entries(incoming.lineages)){
base.lineages[lineage]??={};
for(const[bucket,n]of Object.entries(row))
base.lineages[lineage][bucket]=Math.max(base.lineages[lineage][bucket]??0,n);
}
return validateEnemyStats(base);
}
function validateEnemyStatsSession(source){
const value=boundedJSON(source,{
maxBytes:32768,
maxNodes:2048,
maxDepth:4,
maxString:256,
});
exactKeys(
value,
['format','attemptId','gameType','sequences','counts','boardCounts'],
'Enemy statistics session',
);
required(
value.format===ENEMY_STATS_SESSION_FORMAT&&id(value.attemptId),
'Unsupported enemy statistics session.',
);
cursor({
gameType:value.gameType,
sequences:value.sequences,
counts:value.counts,
boardCounts:value.boardCounts,
updated:0,
});
return value;
}
/** A locally played branch retains its visible run totals and replay boundary,
     * but cannot share receipt identity with another tab's continued simulation.
     * This pure helper neither awards counters nor retires an existing token. */
function forkEnemyStatsSession(source,{randomId=uid}={}){
const fork=validateEnemyStatsSession(source);
fork.attemptId=randomId();
return validateEnemyStatsSession(fork);
}

function add(table,key,n=1){
const next=(table[key]??0)+n;
required(integer(next),'Enemy count exceeded its safe integer bound.');
table[key]=next;
}
function applyObservation(source,event){
const next=structuredClone(source);
const previous=next.cursors[event.attemptId];
required(
!previous||previous.gameType===event.gameType,
'Enemy attempt belongs to another game.',
);
const row=previous??{
gameType:event.gameType,
sequences:{...event.baseline.sequences},
counts:{...event.baseline.counts},
boardCounts:structuredClone(event.baseline.boardCounts),
updated:event.updated,
};
if(event.sequence<=(row.sequences[event.board]?? -1))return next;
row.sequences[event.board]=event.sequence;
row.updated=event.updated;
const priorCounts=row.boardCounts[event.board]??{};
for(const[family,n]of Object.entries(event.cumulative)){
const delta=Math.max(0,n-(priorCounts[family]??0));
if(!delta)continue;
add((next.lineages[event.lineage]??={}),`${event.gameType}/${family}`,delta);
add(row.counts,family,delta);
}
row.boardCounts[event.board]=structuredClone(event.cumulative);
next.cursors[event.attemptId]=row;
const ordered=Object.keys(next.cursors)
.filter((key)=>key!==event.attemptId)
.sort((a,b)=>next.cursors[a].updated-next.cursors[b].updated||a.localeCompare(b));
while(Object.keys(next.cursors).length>ENEMY_STATS_LIMITS.cursors)
delete next.cursors[ordered.shift()];
return validateEnemyStats(next);
}
function storageDefault(){
try{
return globalThis.localStorage;
}catch{
return null;
}
}
function databaseDefault(){
try{
return globalThis.indexedDB;
}catch{
return null;
}
}

/** Live simulation calls only. Imported proofs/recordings cannot mint totals.
     * The caller supplies the entire defeat batch for one monotonic board tick.
     * Local Continue carries only a cursor; previous simulation is never counted. */
function createEnemyStats({
indexedDB=databaseDefault(),
storage=storageDefault(),
canWrite=()=>true,
onWarning=()=>{},
randomId=uid,
}={}){
const ownsWrites=()=>{
try{
return canWrite();
}catch{
return false;
}
};
let lineage,
sessionLineage=null;
try{
lineage=storage?.getItem(WRITER_KEY);
}catch{
/* Session writer below. */
}
if(!id(lineage)){
lineage=randomId();
try{
if(ownsWrites())storage?.setItem(WRITER_KEY,lineage);
}catch{
/* Counters still use IndexedDB. */
}
}
required(id(lineage),'A unique statistics writer is required.');
const backend=createProfileRecordBackend({
key:ENEMY_STATS_KEY,
empty:emptyEnemyStats,
validate:validateEnemyStats,
indexedDB,
canWrite,
});
const attempts=new WeakMap(),
listeners=new Set(),
coordinator=coordinatorFor(indexedDB,storage);
let state=emptyEnemyStats(),
pending=new Map(),
queue=Promise.resolve(),
closed=false,
memoryOnly=false,
durable=true;
const notify=(kind='refresh')=>{
for(const fn of listeners)fn({kind});
};
const warning=(error)=>{
if(closed)return;
durable=false;
onWarning(error);
notify();
};
const enqueue=(fn)=>{
const result=queue.then(fn);
queue=result.catch(()=>{});
return result;
};
const flushNow=async()=>{
// A host can close between accepting a live event and this queued write.
// Disposal retires that work without rejecting detached host callbacks.
if(closed||memoryOnly)return state;
if(!pending.size)return state;
const batch=new Map(pending);
try{
const saved=await backend.update((base)=>
[...batch.values()].reduce(applyObservation,base),
);
if(closed||memoryOnly)return state;
for(const[key,event]of batch)if(pending.get(key)===event)pending.delete(key);
state=[...pending.values()].reduce(applyObservation,saved);
durable=true;
notify();
}catch(error){
warning(error);
}
return state;
};
const member={
async drain(){
if(closed)return;
required(!memoryOnly,'Export session-only statistics and reload before importing.');
await flushNow();
required(!pending.size,'Save pending enemy statistics before importing.');
},
rotate(writer){
lineage=writer;
},
adopt(snapshot){
if(closed)return;
state=[...pending.values()].reduce(applyObservation,snapshot);
durable= !pending.size;
notify();
},
};
coordinator.members.add(member);
function tokenState(attempt){
const token=attempts.get(attempt);
required(token,'This statistics service does not own that attempt.');
return token;
}
function session(attempt){
const token=tokenState(attempt),
row=state.cursors[token.attemptId]??token.baseline;
return{
format:ENEMY_STATS_SESSION_FORMAT,
attemptId:token.attemptId,
gameType:token.gameType,
sequences:{...row.sequences},
counts:{...row.counts},
boardCounts:structuredClone(row.boardCounts),
};
}
return{
read:()=>
enqueue(async()=>{
if(closed||memoryOnly)return structuredClone(state);
try{
const saved=await backend.read();
if(closed)return structuredClone(state);
state=[...pending.values()].reduce(applyObservation,saved);
durable= !pending.size;
notify();
}catch(error){
warning(error);
}
if(pending.size)await flushNow();
return structuredClone(state);
}),
beginAttempt({gameType,provenance='live',saved=null}={}){
required(
id(gameType)&&
['live','continue','import','replay','demo','preview'].includes(provenance),
'Invalid statistics attempt.',
);
const restored=saved===null?null:validateEnemyStatsSession(saved);
required(
!restored||restored.gameType===gameType,
'Saved statistics belong to another game.',
);
const reuse=provenance==='continue'&&restored;
const token={
attemptId:reuse?restored.attemptId:randomId(),
gameType,
baseline:reuse?restored:{sequences:{},counts:{},boardCounts:{}},
active:['live','continue'].includes(provenance),
};
required(id(token.attemptId),'A unique statistics attempt is required.');
const attempt=Object.freeze({id:token.attemptId,gameType});
attempts.set(attempt,token);
return attempt;
},
observe(attempt,{board='0',sequence,defeats=[]}={}){
const token=tokenState(attempt);
if(!token.active||closed)return Promise.resolve(false);
// Another host/controller can restore a backup while this attempt is
// paused. Same-document localStorage writes do not emit a storage event;
// sample the current writer at the next real gameplay contribution.
if(!ownsWrites()){
sessionLineage??=randomId();
required(id(sessionLineage),'A unique session statistics writer is required.');
}else{
try{
const latest=storage?.getItem(WRITER_KEY);
if(id(latest))lineage=latest;
}catch{
/* A private session retains its independently generated writer. */
}
}
required(
id(String(board))&&
integer(sequence)&&
Array.isArray(defeats)&&
defeats.length<=256,
'Invalid live enemy batch.',
);
if(!defeats.length)return Promise.resolve(false);
const ownedDefeats=defeats.map((event)=>{
exactKeys(
event,
['family',...(own(event,'playerId')?['playerId']:[])],
'Enemy defeat',
);
required(
id(event.family)&&
(event.playerId===undefined||
event.playerId===null||
integer(event.playerId)||
id(event.playerId)),
'Invalid enemy identity.',
);
return{family:canonicalEnemyFamily(event.family)};
});
const current=state.cursors[token.attemptId]??token.baseline;
if(sequence<=(current.sequences[String(board)]?? -1))return Promise.resolve(false);
const cumulative={...current.boardCounts[String(board)]};
for(const{family}of ownedDefeats)add(cumulative,family);
const event={
attemptId:token.attemptId,
gameType:token.gameType,
baseline:structuredClone(token.baseline),
lineage:ownsWrites()?lineage:sessionLineage,
board:String(board),
sequence,
cumulative,
updated:Date.now(),
};
state=applyObservation(state,event);
if(memoryOnly){
notify('defeat');
return Promise.resolve(true);
}
// Coalesce only consecutive contributions from this board's same writer.
// A saving-lease transition must retain the old component: its optimistic
// snapshot may already have been exported from the session-only window.
const previous=[...pending.entries()]
.reverse()
.find(([,row])=>row.attemptId===token.attemptId&&row.board===String(board));
const key=
previous?.[1].lineage===event.lineage
?previous[0]
:`${token.attemptId}/${String(board)}/${sequence}`;
pending.set(key,event);
// Failed storage must not accumulate an unbounded per-attempt journal.
// Keep the complete visible/exportable snapshot; a fresh page can import
// that snapshot when storage recovers instead of losing these totals.
if(pending.size>ENEMY_STATS_LIMITS.cursors*8){
pending.clear();
memoryOnly=true;
warning(
new Error('Enemy statistics are session-only. Export a backup before reloading.'),
);
notify('defeat');
return Promise.resolve(true);
}
notify('defeat');
return enqueue(async()=>{
await flushNow();
return true;
});
},
session,
finishAttempt(attempt){
tokenState(attempt).active=false;
return session(attempt);
},
totals({gameType=null,attempt=null}={}){
const byFamily={},
byGame={};
let total=0;
for(const row of Object.values(state.lineages))
for(const[bucket,n]of Object.entries(row)){
const[game,family]=bucket.split('/');
if(gameType&&game!==gameType)continue;
add(byFamily,family,n);
add(byGame,game,n);
total+=n;
}
const run=attempt?session(attempt).counts:{};
return{
total,
byFamily,
byGame,
run:{total:Object.values(run).reduce((sum,n)=>sum+n,0),byFamily:run},
durable,
countingSince:'feature-introduction',
};
},
subscribe(fn){
listeners.add(fn);
return()=>listeners.delete(fn);
},
snapshot:()=>structuredClone(state),
exportBackup:()=>({
format:ENEMY_STATS_BACKUP_FORMAT,
statistics:{...structuredClone(state),cursors:{}},
}),
importBackup:(source)=>{
const incoming=inspectEnemyStatsBackup(source).statistics;
const importing=coordinator.imports.then(()=>
enqueue(async()=>{
try{
required(!closed,'Enemy statistics are closed.');
// A backup can include an optimistic count from another paused host.
// Persist its cursor first so that queued callbacks cannot add it again.
// Call the drain directly: waiting on another service's import queue
// would deadlock two simultaneous imports in the same document.
for(const active of coordinator.members){
await active.drain();
required(!closed,'Enemy statistics are closed.');
}
required(ownsWrites(),'This tab does not own the saving lease.');
const writer=randomId();
required(id(writer),'A unique statistics writer is required.');
for(const active of coordinator.members)active.rotate(writer);
try{
storage?.setItem(WRITER_KEY,writer);
}catch{
/* Same-document services still adopt the unique writer. */
}
const saved=await backend.update((base)=>mergeEnemyStats(base,incoming));
required(!closed,'Enemy statistics are closed.');
state=saved;
for(const active of coordinator.members)active.adopt(state);
return structuredClone(state);
}catch(error){
warning(error);
throw error;
}
}),
);
coordinator.imports=importing.catch(()=>{});
return importing;
},
flush:()=>enqueue(flushNow),
close(){
closed=true;
coordinator.members.delete(member);
listeners.clear();
backend.close();
},
};
}

/** Legacy hosts keep their existing session bytes. This bounded adjacent cursor
     * record binds their stable run identity to a genuine local Continue only. */
function createEnemyStatsHost({
gameType,
stats:supplied=null,
storage=storageDefault(),
canWrite=()=>true,
...options
}={}){
required(id(gameType),'An enemy statistics host needs a game identity.');
const stats=supplied??createEnemyStats({storage,canWrite,...options});
const key=`${ENEMY_STATS_SESSION_FORMAT}:host:${gameType}`;
let retained={},
attempt=null,
identity=null,
currentProvenance=null,
readable=true;
try{
const raw=storage?.getItem(key);
if(raw){
const rows=boundedJSON(raw,{maxBytes:256*1024,maxNodes:12000,maxDepth:7});
required(map(rows)&&Object.keys(rows).length<=16,'Too many saved enemy cursors.');
for(const[name,row]of Object.entries(rows)){
required(id(name),'Invalid saved enemy cursor identity.');
retained[name]=validateEnemyStatsSession(row);
}
}
}catch{
retained={};
readable=false;
}
function save(){
if(!attempt|| !identity|| !canWrite()|| !readable)return;
const rows={...retained};
delete rows[identity];
rows[identity]=stats.session(attempt);
retained=Object.fromEntries(Object.entries(rows).slice(-16));
try{
storage?.setItem(key,JSON.stringify(retained));
}catch{
/* Stats service reports its own durability. */
}
}
function begin(runIdentity,{provenance='live',saved=null}={}){
required(
typeof runIdentity==='string'&&runIdentity.length>0&&runIdentity.length<=4096,
'A stable live run identity is required.',
);
const next=dataIdentity({gameType,runIdentity});
if(identity===next&&attempt&&provenance===currentProvenance)return attempt;
if(attempt){
save();
stats.finishAttempt(attempt);
}
identity=next;
currentProvenance=provenance;
const cursor=saved??(provenance==='continue'?(retained[next]??null):null);
attempt=stats.beginAttempt({gameType,provenance,saved:cursor});
save();
return attempt;
}
return{
stats,
begin,
getAttempt:()=>attempt,
observe(batch){
if(!attempt)return Promise.resolve(false);
const result=stats.observe(attempt,batch);
save();
return result;
},
session:()=>(attempt?stats.session(attempt):null),
finish(){
if(attempt){
save();
stats.finishAttempt(attempt);
}
},
close(){
save();
if(!supplied)stats.close();
},
};
}

return{
ENEMY_STATS_FORMAT,
ENEMY_STATS_BACKUP_FORMAT,
ENEMY_STATS_SESSION_FORMAT,
ENEMY_STATS_KEY,
ENEMY_STATS_MAX_BYTES,
ENEMY_STATS_LIMITS,
canonicalEnemyFamily,
emptyEnemyStats,
validateEnemyStats,
inspectEnemyStatsBackup,
mergeEnemyStats,
validateEnemyStatsSession,
forkEnemyStatsSession,
createEnemyStats,
createEnemyStatsHost,
};
})();
modules['game/presentation/actor-animation.mjs']=(()=>{
const boundedJSON=modules['game/data-json.mjs']['boundedJSON'];
const exactKeys=modules['game/data-json.mjs']['exactKeys'];
const required=modules['game/data-json.mjs']['required'];
const stableId=modules['game/data-json.mjs']['stableId'];

const ACTOR_ANIMATION_FORMAT='revealline-actor-animation.v1';
const ACTOR_CLIPS=Object.freeze([
'idle',
'notice',
'anticipation',
'move',
'blocked',
'recovery',
'caught',
'aim',
'fire',
]);
const ACTOR_PARTS=Object.freeze([
'helmet',
'cap',
'hood',
'torso',
'arms',
'boots',
'pack',
'satchel',
'radio',
'shield',
'armor',
'weapon',
'scarf',
'binoculars',
]);
const accepted=new WeakSet();
function freeze(value){
if(value&&typeof value==='object'){
Object.values(value).forEach(freeze);
Object.freeze(value);
}
return value;
}
function fields(value,names,label){
const keys=names.split(' ');
exactKeys(value,keys,label);
required(
keys.every((key)=>Object.hasOwn(value,key)),
`${label} is missing fields.`,
);
}
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;

/** Imported animation describes decoration only. No URLs, scripts, sounds,
     * collision shapes, AI transitions or vulnerability timings are accepted. */
function validateActorAnimation(source,{width=null,height=null}={}){
const value=boundedJSON(source,{maxBytes:32768,maxNodes:2500,maxArray:128});
fields(
value,
'format id revision rig material parts anchors frames clips fallback',
'actor animation',
);
required(
value.format===ACTOR_ANIMATION_FORMAT&&
stableId(value.id)&&
integer(value.revision,1,1000000),
'Invalid animation identity.',
);
required(['overhead-soldier.v1','sprite.v1'].includes(value.rig),'Unsupported actor rig.');
required(
['cloth','armor','machine'].includes(value.material),
'Unsupported actor material.',
);
required(
Array.isArray(value.parts)&&
value.parts.length<=ACTOR_PARTS.length&&
new Set(value.parts).size===value.parts.length&&
value.parts.every((p)=>ACTOR_PARTS.includes(p)),
'Invalid actor parts.',
);
fields(value.anchors,'pivot equipment','actor anchors');
for(const anchor of Object.values(value.anchors)){
fields(anchor,'x y','actor anchor');
required(
[anchor.x,anchor.y].every((n)=>Number.isFinite(n)&&n>=0&&n<=1),
'Invalid actor anchor.',
);
}
required(
Array.isArray(value.frames)&&value.frames.length>0&&value.frames.length<=64,
'Invalid animation frames.',
);
const ids=new Set();
for(const frame of value.frames){
fields(frame,'id durationMs stride breath accessory region','actor frame');
required(stableId(frame.id)&& !ids.has(frame.id),'Duplicate actor frame.');
ids.add(frame.id);
required(
integer(frame.durationMs,16,2000)&&
integer(frame.stride,-3,3)&&
integer(frame.breath,0,2)&&
integer(frame.accessory,-2,2),
'Unbounded actor motion.',
);
if(value.rig==='sprite.v1'){
fields(frame.region,'x y width height','atlas region');
const r=frame.region;
required(
integer(width,1,1920)&&
integer(height,1,1920)&&
integer(r.x,0,width-1)&&
integer(r.y,0,height-1)&&
integer(r.width,1,width)&&
integer(r.height,1,height)&&
r.x+r.width<=width&&
r.y+r.height<=height,
'Actor atlas frame escaped its image.',
);
}else required(frame.region===null,'Procedural parts cannot load image regions.');
}
exactKeys(value.clips,ACTOR_CLIPS,'actor clips');
required(
ACTOR_CLIPS.slice(0,7).every((key)=>Object.hasOwn(value.clips,key)),
'Missing required actor clip.',
);
for(const clip of Object.values(value.clips)){
fields(clip,'frames loop','actor clip');
required(
typeof clip.loop==='boolean'&&
Array.isArray(clip.frames)&&
clip.frames.length>0&&
clip.frames.length<=32&&
clip.frames.every((id)=>ids.has(id)),
'Invalid actor clip frames.',
);
}
required(value.fallback==='compact-overhead.v1','Missing registered compact fallback.');
freeze(value);
accepted.add(value);
return value;
}

/** Host supplies elapsed presentation time within the authoritative state. This
     * function cannot advance that state, turn armor or emit gameplay/audio events. */
function sampleActorAnimation(
descriptor,
{clip='idle',timeMs=0,reducedEffects=false}={},
){
required(accepted.has(descriptor),'Use an admitted actor animation.');
const sequence=descriptor.clips[clip]??descriptor.clips.idle;
const frames=sequence.frames.map((id)=>descriptor.frames.find((f)=>f.id===id));
const duration=frames.reduce((sum,frame)=>sum+frame.durationMs,0);
let t=reducedEffects|| !Number.isFinite(timeMs)?0:Math.max(0,timeMs);
t=sequence.loop?t%duration:Math.min(t,duration-1);
for(const frame of frames){
if(t<frame.durationMs)return frame;
t-=frame.durationMs;
}
return frames[0];
}

function createSoldierAnimation(id,parts,material='cloth'){
const frames=[0,1,2,0,-1,-2].map((stride,i)=>({
id:`stride-${i}`,
durationMs:100,
stride,
breath:0,
accessory:i%2,
region:null,
}));
frames.push(
{id:'rest',durationMs:300,stride:0,breath:0,accessory:0,region:null},
{id:'breath',durationMs:300,stride:0,breath:1,accessory:0,region:null},
);
const clips=Object.fromEntries(
ACTOR_CLIPS.map((name)=>[
name,
{
frames:
name==='move'
?frames.slice(0,6).map((f)=>f.id)
:['idle','recovery'].includes(name)
?['rest','breath']
:['rest'],
loop:!['caught','notice','fire'].includes(name),
},
]),
);
return validateActorAnimation({
format:ACTOR_ANIMATION_FORMAT,
id,
revision:1,
rig:'overhead-soldier.v1',
material,
parts,
anchors:{pivot:{x:0.5,y:0.5},equipment:{x:0.75,y:0.625}},
frames,
clips,
fallback:'compact-overhead.v1',
});
}

return{
ACTOR_ANIMATION_FORMAT,
ACTOR_CLIPS,
ACTOR_PARTS,
validateActorAnimation,
sampleActorAnimation,
createSoldierAnimation,
};
})();
modules['game/hunt/industrial-soldier-kit.mjs']=(()=>{
/** Exact original v3 live accessory geometry. Data only: positions are artwork
     * pixels, never collider dimensions, capability declarations or simulation state.
     * Both live renderers and defeat presentation resolve color roles from the same
     * accepted actor palette. Historical art continues using its original recipes. */
const INDUSTRIAL_SOLDIER_KIT_REVISION='industrial-roster-v3';
const freeze=(value)=>{
if(value&&typeof value==='object'){
for(const child of Object.values(value))freeze(child);
Object.freeze(value);
}
return value;
};
const INDUSTRIAL_SOLDIER_KITS=freeze({
lookout:{
id:'binoculars',
material:'optics',
anchor:[9,8],
size:[14,4],
rectangles:[
['#192820',0,0,6,4],
['#192820',8,0,6,4],
['#81b1ac',1,0,3,2],
['#b7d9cf',9,0,3,2],
],
},
patroller:{
id:'bedroll',
material:'cloth',
anchor:[9,21],
size:[14,5],
rectangles:[
['#192820',0,0,14,5],
['coat',1,1,12,3],
['trim',2,1,2,3],
['trim',10,1,2,3],
],
},
runner:{
id:'harness',
material:'cloth',
anchor:[11,19],
size:[10,6],
rectangles:[
['#192820',0,0,3,6],
['#192820',7,0,3,6],
['trim',1,1,1,4],
['trim',8,1,1,4],
['dark',2,1,6,2],
],
},
sprinter:{
id:'headset',
material:'electronics',
anchor:[8,12],
size:[16,5],
rectangles:[
['#192820',0,0,3,5],
['#192820',13,0,3,5],
['trim',1,0,1,4],
['trim',14,0,1,4],
],
},
courier:{
id:'satchel',
material:'canvas',
anchor:[22,17],
size:[7,7],
rectangles:[
['#192820',0,0,7,7],
['#795e3f',1,1,5,5],
['#be9b65',1,1,5,2],
['#d9c296',3,1,1,5],
],
},
guard:{
id:'pouches',
material:'cloth',
anchor:[10,20],
size:[14,4],
rectangles:[
['#192820',0,0,4,4],
['trim',1,1,2,2],
['#192820',5,0,4,4],
['trim',6,1,2,2],
['#192820',10,0,4,4],
['trim',11,1,2,2],
],
},
'refuge-seeker':{
id:'shelter-roll',
material:'cloth',
anchor:[9,20],
size:[14,7],
rectangles:[
['#192820',0,0,14,7],
['dark',1,1,12,5],
['light',1,1,12,2],
['trim',4,1,2,5],
['trim',10,1,2,5],
],
},
switchback:{
id:'scarf',
material:'cloth',
anchor:[23,20],
size:[5,4],
rectangles:[
['#192820',0,0,5,4],
['trim',0,0,4,2],
['patch',1,2,2,2],
],
},
'rendezvous-pair':{
id:'radio',
material:'electronics',
anchor:[11,20],
size:[11,6],
rectangles:[
['#192820',0,0,11,6],
['dark',1,1,9,4],
['trim',1,1,9,2],
],
},
'shield-bearer':{
id:'front-plate',
material:'armor',
anchor:[5,5],
size:[22,5],
rectangles:[
['#192820',0,0,22,5],
['#84928a',1,0,20,3],
['#c8d0bd',2,0,18,1],
['#384c46',6,1,10,2],
['dark',2,3,4,2],
['dark',16,3,4,2],
],
},
'brace-trooper':{
id:'brace-pack',
material:'armor',
anchor:[11,21],
size:[10,5],
rectangles:[
['#192820',0,0,10,5],
['dark',1,1,8,3],
],
},
'relay-warden':{
id:'command-pack',
material:'electronics',
anchor:[10,19],
size:[13,8],
rectangles:[
['#192820',0,0,13,8],
['dark',1,1,11,6],
['trim',2,1,9,2],
['light',2,4,3,1],
],
},
});

return{INDUSTRIAL_SOLDIER_KIT_REVISION,INDUSTRIAL_SOLDIER_KITS};
})();
modules['game/hunt/actor-catalog.mjs']=(()=>{
/** Shared identities, not a grant of gameplay capability. Native engines must
     * accept a versioned policy before an actor can enter an attempt. */
const ACTOR_CATALOG_VERSION='humanoid-actors.v1';
const ACTOR_ART_REVISION='overhead-field-kit.v2';
const ACTOR_ART_BUDGET=Object.freeze({
decodedBytes:64*1024*1024,
compactDecodedBytes:32*1024*1024,
sharedBoards:2,
});
const freeze=(value)=>{
if(value&&typeof value==='object'){
for(const child of Object.values(value))freeze(child);
Object.freeze(value);
}
return value;
};

const ACTOR_CASTS=freeze([
{
id:'tactical',
name:{en:'Field kit',uk:'Польове спорядження'},
accessory:'field-kit',
},
{
id:'rivals',
name:{en:'Worn field kit',uk:'Зношене польове спорядження'},
accessory:'mixed-kit',
},
{
id:'arcade',
name:{en:'Winter kit',uk:'Зимове спорядження'},
accessory:'winter-kit',
},
]);
const ACTOR_STATES=Object.freeze([
'idle',
'walk',
'notice',
'flee',
'warning',
'burst',
'recover',
'blocked',
'caught',
]);

const descriptions=[
[
'lookout',
'Lookout',
'Спостерігач',
'binoculars',
false,
['Watches a post.','Спостерігає за постом.'],
['Binoculars rise while the lookout scans.','Під час огляду піднімає бінокль.'],
[
'Approach directly. This introductory target does not flee.',
'Наближайтеся прямо. Ця навчальна ціль не тікає.',
],
],
[
'patroller',
'Patroller',
'Патрульний',
'cap',
false,
['Completes a circuit or shuttle route.','Проходить коло або маршрут туди й назад.'],
[
'A patrol pack, measured steps and the body heading identify the route.',
'Патрульний рюкзак, рівні кроки та поворот тіла показують напрямок маршруту.',
],
[
'Intercept a crossing; a blocked patrol waits.',
'Перехопіть на перетині; заблокований патруль чекає.',
],
],
[
'runner',
'Runner',
'Бігун',
'light-jacket',
false,
['Seeks space away from nearby players.','Шукає простір подалі від гравців.'],
[
'Looks back, then commits to a short escape.',
'Озирається, потім виконує короткий ривок утечі.',
],
[
'Cut off the next opening instead of following directly.',
'Перекрийте наступний вихід замість переслідування слідом.',
],
],
[
'sprinter',
'Sprinter',
'Спринтер',
'headset',
false,
['Reaches an open straight for a burst.','Шукає пряму ділянку для ривка.'],
[
'A light headset and crouched warning precede the dash; breathing marks recovery.',
'Легка гарнітура та присідання попереджають про ривок; важке дихання означає відпочинок.',
],
[
'Predict the straight dash and catch the recovery.',
'Передбачте прямий ривок і перехопіть під час відпочинку.',
],
],
[
'courier',
'Courier',
'Кур’єр',
'satchel',
false,
[
'Visits delivery checkpoints for an optional reward.',
'Відвідує пункти доставки заради необов’язкової нагороди.',
],
[
'A bouncing satchel and parcel symbol distinguish the bonus target.',
'Сумка та символ пакунка позначають бонусну ціль.',
],
[
'Choose a safe interception; ordinary completion does not require the courier.',
'Оберіть безпечне перехоплення; кур’єр не потрібен для звичайного завершення.',
],
],
[
'guard',
'Guard',
'Охоронець',
'helmet',
false,
[
'Defends a post with warned shots in Capture combat.',
'Захищає пост попередженими пострілами в бойових місіях захоплення.',
],
[
'A helmet and locked aim precede each shot.',
'Шолом та зафіксоване прицілювання позначають постріл.',
],
[
'Evade the shot and touch the body during an opening.',
'Ухиліться від пострілу й торкніться тіла у вдалий момент.',
],
],
[
'refuge-seeker',
'Refuge seeker',
'Шукач укриття',
'hood',
false,
[
'Commits to a reachable shelter and briefly rests there.',
'Прямує до доступного укриття й ненадовго відпочиває там.',
],
[
'A hood and pointing gesture announce the selected goal.',
'Каптур та жест указують на обрану ціль.',
],
[
'Intercept the shelter approach; shelter gives no invulnerability.',
'Перехопіть біля укриття; воно не дає невразливості.',
],
],
[
'switchback',
'Switchback',
'Маневрувальник',
'scarf',
false,
[
'Escapes through an announced alternative exit.',
'Тікає через заздалегідь показаний інший вихід.',
],
[
'A scarf and fork symbol introduce a committed direction change.',
'Шарф і розгалужена стрілка попереджають про зміну напрямку.',
],
[
'Read the next direction and cover that exit.',
'Стежте за наступним напрямком і перекрийте цей вихід.',
],
],
[
'rendezvous-pair',
'Rendezvous pair',
'Пара для зустрічі',
'paired-badge',
false,
['Two actors seek a shared meeting point.','Двоє прямують до спільного місця зустрічі.'],
[
'Paired radio packs and greeting gestures identify the partners.',
'Парні радіорюкзаки та вітальні жести позначають напарників.',
],
[
'Separate their routes; each counts once, and the survivor becomes a Runner.',
'Розділіть їхні маршрути; кожен зараховується один раз, а вцілілий стає Бігуном.',
],
],
[
'shield-bearer',
'Shield bearer',
'Щитоносець',
'shield',
true,
[
'Keeps its front protected while committing to a heading.',
'Тримає фронт захищеним і дотримується обраного напрямку.',
],
[
'A solid shield marks the hazardous front; a hollow arrow warns of its next turn.',
'Суцільний щит позначає небезпечний фронт; порожня стрілка попереджає про поворот.',
],
[
'Touch a side or the rear. The exact side boundary is exposed; enclosure also works in Capture.',
'Торкніться збоку або ззаду. Межа бічної сторони відкрита; у захопленні також діє оточення.',
],
],
[
'brace-trooper',
'Brace trooper',
'Броньований спринтер',
'opening-armor',
true,
[
'Braces for a burst, then opens its armor to recover.',
'Закриває броню для ривка, потім відкриває її на відпочинок.',
],
[
'Closed armor during warning and burst is hazardous; split panels mark recovery.',
'Закрита броня під час попередження та ривка небезпечна; відкриті панелі позначають відпочинок.',
],
[
'Catch the open recovery. Pulse freezes the visible armor state; it does not open it.',
'Перехопіть під час відкритого відпочинку. Імпульс фіксує поточний стан броні, а не відкриває її.',
],
],
[
'relay-warden',
'Relay warden',
'Вартовий ретранслятора',
'command-radio',
true,
[
'Holds a native Capture relay or stronghold objective.',
'Утримує ціль ретранслятора або фортеці в режимі захоплення.',
],
[
'A command radio pack and relay indicators show its objective role.',
'Командний радіорюкзак та індикатори ретранслятора позначають роль цілі.',
],
[
'Follow the mission’s relay or stronghold rules; this is not ordinary contact prey.',
'Виконуйте правила ретранслятора або фортеці; це не звичайна контактна ціль.',
],
],
];

const engines=(capture,snake,flight)=>({capture,snake,flight});
const supported=(policy,requires=[])=>({policy,requires});
// Required policies are intentionally namespaced. Catalogue presence, costume
// and field-guide text never upgrade a historical recipe or imply an adapter.
const capabilities={
lookout:engines(
null,
supported('stationary'),
supported('ground-patrol',['stationary-route']),
),
patroller:engines(
supported('authored-patrol',['successor-recipe']),
supported('patroller'),
supported('ground-patrol'),
),
runner:engines(
supported('humanoid-runner'),
supported('runner'),
supported('ground-pursuit',['successor-recipe']),
),
sprinter:engines(
supported('burst-pursuit',['successor-recipe']),
supported('sprinter'),
supported('ground-burst',['successor-recipe']),
),
courier:engines(
supported('optional-courier',['successor-recipe','bonus-objective']),
supported('courier',['bonus-objective']),
supported('optional-courier',['successor-recipe','bonus-objective']),
),
guard:engines(supported('humanoid-guard',['projectiles']),null,null),
'refuge-seeker':engines(
supported('refuge',['successor-recipe','goal-waypoints']),
supported('refuge',['successor-recipe','goal-waypoints']),
supported('ground-refuge',['successor-recipe','goal-waypoints']),
),
switchback:engines(
supported('switchback',['successor-recipe']),
supported('switchback',['successor-recipe']),
supported('ground-switchback',['successor-recipe']),
),
'rendezvous-pair':engines(
supported('rendezvous',['successor-recipe','pair']),
supported('pair',['successor-recipe','pair']),
supported('ground-rendezvous',['successor-recipe','pair']),
),
'shield-bearer':engines(
supported('directional-shield',['successor-recipe','specialist-opt-in']),
supported('shield',['successor-recipe','specialist-opt-in']),
supported('ground-shield',['successor-recipe','specialist-opt-in']),
),
'brace-trooper':engines(
supported('brace',['successor-recipe','specialist-opt-in']),
supported('brace',['successor-recipe','specialist-opt-in']),
supported('ground-brace',['successor-recipe','specialist-opt-in']),
),
'relay-warden':engines(
supported('relay-stronghold',['native-boss-objective','specialist-opt-in']),
null,
null,
),
};

const ACTOR_FAMILIES=freeze(
descriptions.map(([id,en,uk,accessory,specialist,goal,tell,counter])=>({
id,
name:{en,uk},
accessory,
specialist,
contact:
id==='relay-warden'?'native-objective':specialist?'conditional':'instant',
guide:{
en:{goal:goal[0],tell:tell[0],counter:counter[0]},
uk:{goal:goal[1],tell:tell[1],counter:counter[1]},
},
capabilities:capabilities[id],
reactionIds:['notice','caught'].map((event)=>`${ACTOR_CATALOG_VERSION}/${id}/${event}`),
})),
);

const aliases=freeze({
still:'lookout',
refuge:'refuge-seeker',
pair:'rendezvous-pair',
shield:'shield-bearer',
brace:'brace-trooper',
warden:'relay-warden',
});
const families=new Map(ACTOR_FAMILIES.map((entry)=>[entry.id,entry]));
// Uniform wardrobes are presentation only. Family equipment remains the primary
// identifier; soft webbing never implies the specialist's protected contact.
const wardrobes={
tactical:{
coat:'#778665',
light:'#b0bb8c',
dark:'#45553f',
pants:'#576647',
trim:'#a0a17a',
camo:'#536248',
patch:'#b9ac84',
glove:'#857c5e',
edge:'#d2d3ac',
},
rivals:{
coat:'#958560',
light:'#c8b88a',
dark:'#5d6047',
pants:'#5f6850',
trim:'#b3a078',
camo:'#716949',
patch:'#706b56',
glove:'#9b815f',
edge:'#e0d1aa',
},
arcade:{
coat:'#d4d9cc',
light:'#f4f2df',
dark:'#697564',
pants:'#aab4a4',
trim:'#8c987e',
camo:'#939d8b',
patch:'#a3af9e',
glove:'#6f786a',
edge:'#edeedd',
},
};
// Tiny accents keep all families distinguishable without replacing equipment
// silhouettes with rainbow uniforms.
const familyTrim={
lookout:'#b0a078',
patroller:'#a4af87',
runner:'#89976b',
sprinter:'#b2a782',
courier:'#b89967',
guard:'#94a183',
'refuge-seeker':'#7c9981',
switchback:'#ae9270',
'rendezvous-pair':'#9aacaa',
'shield-bearer':'#9ba8a0',
'brace-trooper':'#b2a287',
'relay-warden':'#b9b38c',
};

const ACTOR_VISUALS=freeze(
ACTOR_FAMILIES.flatMap((family)=>
ACTOR_CASTS.map((cast)=>{
const wardrobe=wardrobes[cast.id];
return{
id:`${ACTOR_CATALOG_VERSION}/${family.id}/${cast.id}`,
family:family.id,
cast:cast.id,
material:'flesh',
accessory:family.accessory,
castAccessory:cast.accessory,
artRevision:ACTOR_ART_REVISION,
palette:{
...wardrobe,
ink:'#192820',
skin:'#cba984',
skinLight:'#e3c29b',
trim:familyTrim[family.id],
},
detailPixels:32,
compactPixels:16,
decodedBytes:0,
};
}),
),
);
const visuals=new Map(ACTOR_VISUALS.map((entry)=>[entry.id,entry]));

function resolveActorFamily(id){
if(typeof id!=='string')return null;
const candidate=Object.hasOwn(aliases,id)?aliases[id]:id;
return families.has(candidate)?candidate:null;
}
function actorDefinition(id){
return families.get(resolveActorFamily(id))??null;
}
function actorVisual(id,cast='rivals'){
if(visuals.has(id))return visuals.get(id);
const family=resolveActorFamily(id);
if(!family|| !ACTOR_CASTS.some((entry)=>entry.id===cast))return null;
return visuals.get(`${ACTOR_CATALOG_VERSION}/${family}/${cast}`)??null;
}
function actorFieldGuide(id,locale='en'){
const entry=actorDefinition(id);
if(!entry)return null;
const language=locale==='uk'?'uk':'en';
return Object.freeze({
id:entry.id,
name:entry.name[language],
specialist:entry.specialist,
contact:entry.contact,
...entry.guide[language],
});
}
function actorCapability(id,engine){
const entry=actorDefinition(id);
return entry&&Object.hasOwn(entry.capabilities,engine)?entry.capabilities[engine]:null;
}

/** Accepted failure feedback; optional identity refines advice without changing rules. */
function specialistFailureCopy(family,locale='en'){
const uk=locale==='uk';
if(['shield','shield-bearer'].includes(family))
return{
reason:uk
?'Ви торкнулися захищеного боку щита.'
:'You touched the protected shield front.',
tip:uk
?'Обійдіть щит збоку чи ззаду, або оточіть ціль. Стрілка показує захищений напрямок.'
:'Approach from the side or rear, or enclose the target. The arrow marks the protected front.',
};
if(['brace','brace-trooper'].includes(family))
return{
reason:uk?'Ви торкнулися закритої броні.':'You touched closed armor.',
tip:uk
?'Дочекайтеся відкритої броні під час відновлення, або оточіть ціль. Замороження не відкриває броню.'
:'Wait for exposed recovery, or enclose the target. Freezing does not open armor.',
};
return{
reason:uk
?'Захищений контакт зупинив ваш апарат.'
:'Protected armor stopped your craft.',
tip:uk
?'Заходьте до Щита збоку чи ззаду. Броньований ривок уразливий під час відновлення. Оточення долає обох.'
:'Catch Shield from the side or rear; catch Brace during recovery. Enclosure defeats either.',
};
}

return{
ACTOR_CATALOG_VERSION,
ACTOR_ART_REVISION,
ACTOR_ART_BUDGET,
ACTOR_CASTS,
ACTOR_STATES,
ACTOR_FAMILIES,
ACTOR_VISUALS,
resolveActorFamily,
actorDefinition,
actorVisual,
actorFieldGuide,
actorCapability,
specialistFailureCopy,
};
})();
modules['game/hunt/actor-art.mjs']=(()=>{
const createSoldierAnimation=
modules['game/presentation/actor-animation.mjs']['createSoldierAnimation'];
const sampleActorAnimation=
modules['game/presentation/actor-animation.mjs']['sampleActorAnimation'];
const validateActorAnimation=
modules['game/presentation/actor-animation.mjs']['validateActorAnimation'];
const runtimeActorArtRevision=simGlobalActorPreferences['runtimeActorArtRevision'];
const INDUSTRIAL_SOLDIER_KITS=
modules['game/hunt/industrial-soldier-kit.mjs']['INDUSTRIAL_SOLDIER_KITS'];
const actorVisual=modules['game/hunt/actor-catalog.mjs']['actorVisual'];
const resolveActorFamily=modules['game/hunt/actor-catalog.mjs']['resolveActorFamily'];
/** Original overhead pixel rigs. The host owns time, facing and vulnerability;
     * this renderer never advances AI, reads a clock or consumes randomness. */
const UNIT=32;
const ANGLES={up:0,right:Math.PI/2,down:Math.PI,left:-Math.PI/2};
const STRIDE=[0,1,2,0,-1,-2];
const BREATH=[0,0,1,0];
const INK='#192820';
const BOOT='#26302c';

const INDUSTRIAL_ACTOR_SAMPLES=Object.freeze({
runner:createSoldierAnimation('industrial-runner',['helmet','torso','arms','boots']),
courier:createSoldierAnimation('industrial-courier',[
'cap',
'torso',
'arms',
'boots',
'satchel',
]),
guard:createSoldierAnimation(
'industrial-guard',
['helmet','torso','arms','boots','armor','weapon'],
'armor',
),
'shield-bearer':createSoldierAnimation(
'industrial-shield',
['helmet','torso','arms','boots','shield'],
'armor',
),
});

const OVERHEAD_ACTOR_ART_REVISION='industrial-overhead-v2';
const OVERHEAD_ACTOR_SAMPLES=Object.freeze(
Object.fromEntries(
[
['lookout',['cap','torso','arms','boots']],
['patroller',['cap','torso','arms','boots']],
['runner',['helmet','torso','arms','boots']],
['sprinter',['helmet','torso','arms','boots']],
['courier',['cap','torso','arms','boots','satchel']],
['guard',['helmet','torso','arms','boots','armor','weapon']],
['refuge-seeker',['helmet','torso','arms','boots','satchel']],
['switchback',['helmet','torso','arms','boots']],
['rendezvous-pair',['helmet','torso','arms','boots','satchel']],
['shield-bearer',['helmet','torso','arms','boots','shield']],
['brace-trooper',['helmet','torso','arms','boots','armor']],
['relay-warden',['helmet','torso','arms','boots','armor']],
].map(([family,parts])=>[
family,
createSoldierAnimation(
`overhead-${family}`,
parts,
['guard','shield-bearer','brace-trooper','relay-warden'].includes(family)
?'armor'
:'cloth',
),
]),
),
);

/** Successor artwork only: the accepted overhead perspective stays intact while
     * family equipment, stride and non-gameplay gestures gain their own vocabulary.
     * Previous descriptors and every saved/default art revision remain unchanged. */
const INDUSTRIAL_ROSTER_ART_REVISION='industrial-roster-v3';
const rosterTraits=Object.freeze({
lookout:[18,1,160,390,['binoculars']],
patroller:[20,1,145,340,['pack']],
runner:[14,2,90,260,[]],
sprinter:[16,3,75,190,[]],
courier:[16,2,115,310,['satchel']],
guard:[20,1,155,360,['armor','weapon']],
'refuge-seeker':[20,1,135,350,['hood','pack']],
switchback:[16,2,105,280,['scarf']],
'rendezvous-pair':[18,1,125,300,['radio','pack']],
'shield-bearer':[18,1,170,420,['shield']],
'brace-trooper':[20,2,120,230,['armor']],
'relay-warden':[22,1,180,460,['radio','pack','armor']],
});
const INDUSTRIAL_ROSTER_SAMPLES=Object.freeze(
Object.fromEntries(
Object.entries(OVERHEAD_ACTOR_SAMPLES).map(([family,original],index)=>{
const[,amplitude,cadence,rest,equipment]=rosterTraits[family];
const value=structuredClone(original);
value.id=`industrial-roster-${family}`;
value.revision=3;
value.parts=[...new Set([...value.parts,...equipment])];
// The crown/pivot remain fixed. Only limb stride, breathing and equipment
// offsets vary; this data cannot introduce movement or vulnerability timing.
value.frames=[
0,
amplitude,
Math.max(1,amplitude-1),
0,
-amplitude,
-Math.max(1,amplitude-1),
].map((stride,i)=>({
id:`move-${i}`,
durationMs:cadence+(i%3===0?15:0),
stride,
breath:0,
accessory:[0,1,0,0,-1,0][i],
region:null,
}));
for(const[id,durationMs,breath,accessory]of[
['idle-0',rest,0,0],
['idle-1',rest,1,index%2],
['notice-0',95+index*3,0,-1],
['notice-1',150+index*4,1,2],
['prepare-0',170,1,-1],
['prepare-1',230,2,0],
['blocked-0',210,0,-1],
['blocked-1',210,1,1],
['recover-0',rest,2,1],
['recover-1',rest,0,0],
['caught-0',80,0,2],
['caught-1',150,1,-2],
['caught-2',260,0,0],
['aim',300,0,-1],
['fire-0',70,0,2],
['fire-1',160,0,0],
])
value.frames.push({id,durationMs,stride:0,breath,accessory,region:null});
value.clips={
idle:{frames:['idle-0','idle-1'],loop:true},
notice:{frames:['notice-0','notice-1','idle-0'],loop:false},
anticipation:{frames:['prepare-0','prepare-1'],loop:true},
move:{frames:value.frames.slice(0,6).map((frame)=>frame.id),loop:true},
blocked:{frames:['blocked-0','blocked-1'],loop:true},
recovery:{frames:['recover-0','recover-1'],loop:true},
caught:{frames:['caught-0','caught-1','caught-2'],loop:false},
aim:{frames:['aim'],loop:true},
fire:{frames:['fire-0','fire-1'],loop:false},
};
return[family,validateActorAnimation(value)];
}),
),
);

function pixel(ctx,color,x,y,width,height){
ctx.fillStyle=color;
ctx.fillRect(x,y,width,height);
}

function facing(options){
// Specialist heading is the heading used by the accepted contact transaction.
// A nextHeading warning must never rotate the currently protected front.
if(Object.hasOwn(ANGLES,options.heading))return ANGLES[options.heading];
if(Number.isFinite(options.facingRadians))return options.facingRadians;
return ANGLES[options.direction]??ANGLES[options.facing]??0;
}

function motion(pose,options,family){
const frozen=options.reducedEffects||options.frozen||options.paused;
const time= !frozen&&Number.isFinite(options.timeMs)?options.timeMs:0;
const still=
frozen||
family==='lookout'||
['rest','warning','turning','recovering','blocked'].includes(options.phase)||
['idle','notice','recover','blocked','caught'].includes(options.state);
const running=
options.state==='flee'||options.phase==='burst'||family==='sprinter';
const frame=frozen
?0
:Number.isFinite(options.locomotionPhase)
?Math.floor(options.locomotionPhase*STRIDE.length)
:Number.isFinite(options.timeMs)
?Math.floor(time/(running?85:130))
:Number.isFinite(pose)
?Math.trunc(pose)
:0;
return{
stride:still?0:STRIDE[((frame%STRIDE.length)+STRIDE.length)%STRIDE.length],
breath:frozen?0:BREATH[Math.floor(time/300)%BREATH.length],
running,
moving:!still,
idling:family==='lookout'||options.state==='idle',
notice:options.state==='notice',
recovery:options.state==='recover'||['rest','recovering'].includes(options.phase),
caught:options.state==='caught',
};
}

function pack(ctx,role,x,y,width,height,radio=false){
pixel(ctx,role.edge,x-1,y,width+2,height);
pixel(ctx,INK,x,y,width,height);
pixel(ctx,role.dark,x+1,y+1,width-2,height-2);
pixel(ctx,role.trim,x+1,y+1,width-2,1);
pixel(ctx,role.coat,x+2,y+3,width-4,Math.max(1,height-5));
if(radio){
pixel(ctx,INK,x+width-2,y-7,1,8);
pixel(ctx,role.edge,x+width-2,y-7,1,1);
pixel(ctx,'#8ab5a6',x+2,y+2,2,1);
}
}

function detailed(ctx,role,family,gait,options,cast){
const stride=gait.stride;
const wide=family==='brace-trooper'||family==='relay-warden';
const recovering=gait.recovery||gait.idling?gait.breath:0;
const shoulderY=gait.caught?17:14+recovering;
// Foreshortened boots extend behind the hips; no front-view face or torso.
for(const[x,offset]of[
[10,stride],
[18,-stride],
]){
pixel(ctx,role.edge,x-1,21+offset,5,6);
pixel(ctx,INK,x,21+offset,4,6);
pixel(ctx,role.pants,x,21+offset,3,4);
pixel(ctx,role.light,x,21+offset,1,3);
pixel(ctx,BOOT,x-1,25+offset,5,2);
}
// Alternating forward/back arm swings are visible on either side of the pack.
for(const[x,offset]of[
[5,-stride],
[23,stride],
]){
const raised=gait.notice&&x===23? -4:0;
pixel(ctx,role.edge,x-1,shoulderY+offset+raised,5,8);
pixel(ctx,INK,x,shoulderY+offset+raised,4,8);
pixel(ctx,role.coat,x,shoulderY+offset+raised,3,5);
pixel(ctx,role.light,x,shoulderY+offset+raised,1,3);
pixel(ctx,role.glove,x,shoulderY+offset+raised+5,3,2);
}
pixel(ctx,role.edge,wide?7:8,shoulderY-1,wide?18:16,9);
pixel(ctx,INK,wide?8:9,shoulderY,wide?16:14,10);
pixel(ctx,role.coat,10,shoulderY,12,9);
pixel(ctx,role.light,10,shoulderY,3,3);
pixel(ctx,role.camo,18,shoulderY+1,3,2);
pixel(ctx,role.camo,11,shoulderY+6,4,2);
pixel(ctx,role.dark,13,shoulderY,2,10);
pixel(ctx,role.trim,14,shoulderY+5,5,2);
pixel(ctx,role.dark,19,shoulderY,2,10);
pixel(ctx,role.trim,10,shoulderY+8,12,1);
// Small field insignia is secondary to silhouette and equipment.
pixel(ctx,'#d9ddcf',6,shoulderY+1,2,1);
pixel(ctx,'#5a779d',6,shoulderY+2,2,1);
pixel(ctx,'#965c55',6,shoulderY+3,2,1);

if(family==='refuge-seeker')pack(ctx,role,11,17,11,10);
else if(family==='rendezvous-pair'||family==='relay-warden')
pack(ctx,role,12,17,family==='relay-warden'?11:9,9,true);
else if(family==='patroller'||(cast==='tactical'&& !options.industrialSample))
pack(ctx,role,12,18,8,7);
else{
pixel(ctx,INK,10,21,4,4);
pixel(ctx,role.trim,11,22,2,2);
pixel(ctx,INK,19,21,4,4);
pixel(ctx,role.trim,20,22,2,2);
}
if(cast==='rivals'){
pixel(ctx,role.patch,10,shoulderY+2,2,2);
pixel(ctx,role.patch,20,shoulderY+6,2,2);
}else if(cast==='arcade'){
pixel(ctx,role.edge,9,shoulderY,2,6);
pixel(ctx,role.camo,21,shoulderY+3,1,4);
}

// The crown of the helmet is the dominant head surface. The nose is a single
// front edge; helmet seams and rear strap distinguish front from back.
const hood=family==='refuge-seeker';
const cap=family==='lookout'||(cast==='rivals'&&family==='runner');
pixel(ctx,role.edge,11,7,10,10);
pixel(ctx,role.edge,10,9,12,6);
pixel(ctx,INK,11,8,10,8);
pixel(ctx,INK,12,7,8,10);
pixel(ctx,hood?role.dark:role.coat,12,8,8,7);
pixel(ctx,role.light,12,8,5,2);
pixel(ctx,role.camo,16,10,4,2);
pixel(ctx,role.camo,12,13,3,2);
pixel(ctx,role.dark,14,15,4,2);
pixel(ctx,role.skin,15,6,2,1);
if(cap){
pixel(ctx,INK,11,6,10,2);
pixel(ctx,role.trim,12,6,8,1);
}else if(!hood){
pixel(ctx,role.trim,14,8,1,6);
pixel(ctx,role.dark,20,10,1,4);
}
if(family==='runner'&&(gait.notice||gait.recovery)){
pixel(ctx,role.skin,10,11,1,2);
pixel(ctx,role.dark,14,8,4,1);
}
if(family==='lookout'){
const y=gait.notice||gait.breath?4:13;
pixel(ctx,INK,10,y,4,4);
pixel(ctx,INK,18,y,4,4);
pixel(ctx,role.dark,13,y+2,6,1);
pixel(ctx,'#a9c5bf',11,y,2,1);
pixel(ctx,'#a9c5bf',19,y,2,1);
}else if(family==='sprinter'){
pixel(ctx,INK,10,10,2,5);
pixel(ctx,INK,21,10,2,5);
pixel(ctx,role.trim,11,9,10,1);
pixel(ctx,role.edge,22,9,1,3);
if(options.phase==='warning')pixel(ctx,role.dark,11,16,10,3);
}else if(family==='courier'){
const bounce=Math.abs(stride)===2?1:0;
pixel(ctx,INK,23,17-bounce,6,8);
pixel(ctx,'#c99455',24,18-bounce,4,6);
pixel(ctx,'#ffe2a2',24,18-bounce,4,1);
pixel(ctx,'#624a37',25,20-bounce,2,2);
pixel(ctx,role.trim,11,17,13,1);
if(gait.notice||options.state==='idle')pixel(ctx,'#e5debd',23,14,4,3);
}else if(family==='guard'&&options.armed===true){
// Only an accepted armed policy may request weapon geometry.
pixel(ctx,INK,23,6,2,15);
pixel(ctx,'#718277',23,10,1,7);
pixel(ctx,'#735c40',22,18,3,4);
pixel(ctx,role.glove,21,13,3,2);
pixel(ctx,INK,24,13,2,3);
}else if(family==='switchback'){
pixel(ctx,role.patch,9,15,14,2);
pixel(ctx,role.trim,22,16,3,3);
pixel(ctx,INK,25,18,3,8);
pixel(ctx,role.trim,26,19,1,6);
}else if(family==='rendezvous-pair'){
const partner=String(options.partnerId??'');
const alternate=(partner.charCodeAt(partner.length-1)||0)%2;
pixel(ctx,alternate?'#dac295':'#9cbdbe',12,19,3,2);
pixel(ctx,alternate?'#9cbdbe':'#dac295',17,19,3,2);
}else if(family==='shield-bearer'){
pixel(ctx,INK,6,4,20,4);
pixel(ctx,'#84928a',7,4,18,2);
pixel(ctx,'#c8d0bd',8,4,16,1);
pixel(ctx,'#384c46',12,5,8,2);
}else if(family==='brace-trooper'){
const closed=options.phase==='warning'||options.phase==='burst';
for(const x of closed?[10,16]:[7,21]){
pixel(ctx,INK,x,16,closed?6:4,8);
pixel(ctx,role.trim,x+1,17,closed?4:2,6);
pixel(ctx,role.light,x+1,17,closed?4:2,1);
}
if(!closed)pixel(ctx,'#aec3a0',14,19,4,3);
}else if(family==='relay-warden'){
pixel(ctx,INK,9,9,2,5);
pixel(ctx,role.trim,10,8,12,1);
pixel(ctx,role.edge,10,7,3,1);
pixel(ctx,INK,24,11,1,9);
pixel(ctx,role.trim,24,11,1,1);
}
}

function compact(ctx,role,family,gait,options,cast){
ctx.save();
ctx.scale(2,2);
const step=Math.sign(gait.stride);
const breath=gait.idling||gait.recovery?gait.breath:0;
for(const[x,offset]of[
[5,step],
[9,-step],
]){
pixel(ctx,role.edge,x-1,10+offset,3,4);
pixel(ctx,role.pants,x,10+offset,2,3);
pixel(ctx,BOOT,x,13+offset,2,1);
}
pixel(ctx,role.edge,3,7,10,5);
pixel(ctx,INK,4,7,8,5);
pixel(ctx,role.coat,5,7,6,5);
pixel(ctx,role.camo,8,9,3,2);
for(const[x,offset]of[
[2,-step],
[12,step],
]){
pixel(ctx,role.edge,x,7+offset,2,4);
pixel(ctx,role.coat,x,7+offset,1,3);
pixel(ctx,role.glove,x,10+offset,2,1);
}
pixel(ctx,role.dark,6,10+breath,4,3);
pixel(ctx,role.trim,6,10+breath,4,1);
if(breath){
pixel(ctx,role.light,4,7,1,2);
pixel(ctx,role.light,11,7,1,2);
}
pixel(ctx,role.edge,5,3,6,5);
pixel(ctx,INK,5,4,6,4);
pixel(ctx,role.coat,6,3,4,4);
pixel(ctx,role.light,6,3,3,1);
pixel(ctx,role.camo,8,5,2,1);
pixel(ctx,role.skin,7,2,2,1);
pixel(ctx,role.dark,7,7,2,1);
if(cast==='rivals')pixel(ctx,role.patch,5,8,2,1);
if(cast==='arcade')pixel(ctx,role.light,4,8,1,3);
if(family==='lookout'){
const y=gait.notice||breath?2:6;
pixel(ctx,INK,4,y,2,2);
pixel(ctx,INK,10,y,2,2);
pixel(ctx,'#a9c5bf',4,y,1,1);
pixel(ctx,'#a9c5bf',11,y,1,1);
}else if(family==='patroller'){
pixel(ctx,role.trim,5,2,6,1);
pixel(ctx,INK,6,9,5,4);
pixel(ctx,role.trim,7,10,3,2);
}else if(family==='sprinter'){
pixel(ctx,INK,4,4,1,3);
pixel(ctx,INK,11,4,1,3);
pixel(ctx,role.trim,5,3,6,1);
}else if(family==='courier'){
pixel(ctx,INK,12,9,3,4);
pixel(ctx,'#c99455',13,10,2,3);
pixel(ctx,'#ffe2a2',13,10,2,1);
}else if(family==='guard'&&options.armed===true){
pixel(ctx,INK,12,3,1,8);
pixel(ctx,'#735c40',11,10,2,2);
}else if(family==='refuge-seeker'){
pixel(ctx,role.dark,5,3,1,5);
pixel(ctx,role.dark,10,3,1,5);
pixel(ctx,INK,5,9,7,5);
pixel(ctx,role.trim,6,10,5,3);
}else if(family==='switchback'){
pixel(ctx,role.patch,4,7,8,1);
pixel(ctx,role.trim,13,9,1,5);
}else if(family==='rendezvous-pair'||family==='relay-warden'){
pixel(ctx,INK,6,9,6,5);
pixel(ctx,role.trim,7,10,4,3);
pixel(ctx,INK,11,5,1,6);
pixel(ctx,'#a8c9bb',7,10,1,1);
if(family==='relay-warden'){
pixel(ctx,INK,4,5,1,3);
pixel(ctx,role.trim,5,3,6,1);
pixel(ctx,role.edge,13,7,1,4);
}
}else if(family==='shield-bearer'){
pixel(ctx,INK,3,2,10,2);
pixel(ctx,'#c8d0bd',4,2,8,1);
pixel(ctx,'#384c46',6,3,4,1);
}else if(family==='brace-trooper'){
const closed=options.phase==='warning'||options.phase==='burst';
pixel(ctx,role.light,closed?5:3,8,closed?3:2,4);
pixel(ctx,role.trim,closed?8:11,8,closed?3:2,4);
if(!closed)pixel(ctx,'#aec3a0',7,9,2,2);
}
ctx.restore();
}

/** Plan view, looking vertically down. The crown overlaps the shoulder plane;
     * there is no visible face or upright chest. Limbs swing around that plane and
     * remain mostly occluded beneath it. Helmet position never bobs off the centre. */
function overheadDetailed(ctx,role,family,gait,options,cast){
const stride=gait.stride,
breath=gait.idling||gait.recovery?gait.breath:0,
wide=['guard','brace-trooper','relay-warden'].includes(family),
breadth=options.roster?rosterTraits[family][0]:wide?20:18,
inset=(32-breadth)/2,
hood=family==='refuge-seeker',
cap=['lookout','patroller','courier'].includes(family),
closed=options.phase==='warning'||options.phase==='burst';

// Short soles and trouser tops are glimpsed beyond the rear/lateral silhouette.
// They are drawn first so the shoulders, helmet and kit occlude the upper legs.
for(const[x,offset]of[
[10,stride],
[18,-stride],
]){
pixel(ctx,role.edge,x-1,18+offset,6,6);
pixel(ctx,BOOT,x,19+offset,4,5);
pixel(ctx,role.pants,x,18+offset,4,3);
pixel(ctx,role.light,x,18+offset,1,2);
pixel(ctx,INK,x+1,23+offset,3,1);
}
// Bent elbows, then forearms reaching ahead; never long hanging portrait arms.
for(const[x,offset]of[
[5,-stride],
[22,stride],
]){
const raised=gait.notice&&x===22? -2:0,
y=13+offset+raised;
pixel(ctx,role.edge,x-1,y,7,6);
pixel(ctx,INK,x,y,5,5);
pixel(ctx,role.coat,x,y+1,4,3);
pixel(ctx,role.light,x,y+1,3,1);
pixel(ctx,INK,x+(x===5?1:0),y-3,4,4);
pixel(ctx,role.glove,x+(x===5?2:1),y-2,2,3);
}
// A broad, shallow shoulder/upper-back footprint under the central crown.
pixel(ctx,role.edge,inset,12,breadth,10);
const inner=options.roster?inset+1:8,
innerWidth=options.roster?breadth-2:16;
pixel(ctx,INK,inner,11,innerWidth,12);
pixel(ctx,role.coat,inner,12,innerWidth,9);
pixel(ctx,role.light,8,12,4,2+breath);
pixel(ctx,role.light,20,12,4,2+breath);
pixel(ctx,role.camo,8,17,4,3);
pixel(ctx,role.camo,21,15,3,3);
pixel(ctx,role.dark,11,19,10,4);
pixel(ctx,role.trim,12,21,8,1);
if(cast==='rivals'){
pixel(ctx,role.patch,8,14,3,2);
pixel(ctx,role.patch,21,19,2,2);
}else if(cast==='arcade'){
pixel(ctx,role.edge,8,12,3,6);
pixel(ctx,role.camo,22,13,2,5);
}

// Top planes of the kit project behind or beside the crown, not down a chest.
if(['refuge-seeker','patroller','rendezvous-pair','relay-warden'].includes(family)){
const width=hood?12:10,
x=hood?10:11;
pixel(ctx,INK,x,19,width,hood?7:6);
pixel(ctx,role.dark,x+1,20,width-2,hood?5:4);
pixel(ctx,role.trim,x+1,20,width-2,2);
pixel(ctx,role.coat,x+3,20,2,hood?5:4);
if(family==='rendezvous-pair'||family==='relay-warden'){
pixel(ctx,INK,x+width-1,14,1,8);
pixel(ctx,role.edge,x+width-1,14,1,1);
pixel(ctx,'#a8c9bb',x+2,21,2,1);
}
}else{
for(const x of[9,20]){
pixel(ctx,INK,x,19,3,4);
pixel(ctx,role.trim,x,19,3,2);
}
}
if(family==='guard'){
pixel(ctx,role.dark,7,12,5,8);
pixel(ctx,role.dark,20,12,5,8);
pixel(ctx,'#99a58e',8,12,3,2);
pixel(ctx,'#99a58e',21,12,3,2);
}

// Crown lies INSIDE the shoulders and obscures the spine/neck. The tiny front
// brim plus rear strap communicates heading without eyes, mouth or face skin.
pixel(ctx,role.edge,11,10,10,11);
pixel(ctx,role.edge,10,12,12,7);
pixel(ctx,INK,11,11,10,9);
pixel(ctx,INK,12,10,8,11);
pixel(ctx,hood?role.dark:role.coat,12,11,8,8);
pixel(ctx,role.light,12,11,5,2);
pixel(ctx,role.light,12,13,2,3);
pixel(ctx,role.camo,16,13,4,2);
pixel(ctx,role.camo,13,17,3,2);
pixel(ctx,role.dark,14,19,4,2);
pixel(ctx,role.trim,cap?11:13,9,cap?10:6,2);
if(hood){
pixel(ctx,role.coat,10,11,2,7);
pixel(ctx,role.coat,20,11,2,7);
}else if(!cap)pixel(ctx,role.trim,15,11,1,6);

if(family==='lookout'){
const y=gait.notice||gait.breath?6:8;
pixel(ctx,INK,10,y,5,4);
pixel(ctx,INK,17,y,5,4);
pixel(ctx,role.dark,14,y+1,4,2);
pixel(ctx,'#a9c5bf',11,y,3,1);
pixel(ctx,'#a9c5bf',18,y,3,1);
}else if(family==='patroller'){
pixel(ctx,role.trim,8,15,2,2);
pixel(ctx,INK,24,17,2,6);
pixel(ctx,role.coat,24,18,1,3);
}else if(family==='runner'){
pixel(ctx,role.trim,11,20,2,4);
pixel(ctx,role.trim,19,20,2,4);
if(gait.notice||gait.recovery)pixel(ctx,role.glove,8,11,3,2);
}else if(family==='sprinter'){
pixel(ctx,INK,9,12,2,5);
pixel(ctx,INK,21,12,2,5);
pixel(ctx,role.trim,11,10,10,1);
pixel(ctx,role.edge,22,11,1,2);
if(options.phase==='warning'){
pixel(ctx,role.glove,7,10,3,3);
pixel(ctx,role.glove,22,10,3,3);
}
}else if(family==='courier'){
const y=18+(gait.accessory?? -(Math.abs(stride)===2?1:0));
pixel(ctx,INK,23,y,6,6);
pixel(ctx,'#795e3f',24,y+1,4,4);
pixel(ctx,'#be9b65',24,y+1,4,2);
pixel(ctx,'#d9c296',26,y+1,1,4);
pixel(ctx,role.trim,21,16,4,1);
if(gait.notice||gait.idling)pixel(ctx,'#e5debd',25,y,3,2);
}else if(family==='guard'&&options.armed===true){
pixel(ctx,INK,24,5,2,14);
pixel(ctx,'#718277',24,9,1,7);
pixel(ctx,'#735c40',23,18,3,4);
pixel(ctx,role.glove,22,12,3,2);
}else if(family==='switchback'){
pixel(ctx,role.patch,10,20,13,2);
pixel(ctx,role.trim,22,20,5,2);
pixel(ctx,role.patch,25,21,3,3);
pixel(ctx,INK,26,24,2,1);
}else if(family==='rendezvous-pair'){
const partner=String(options.partnerId??''),
alternate=(partner.charCodeAt(partner.length-1)||0)%2;
pixel(ctx,alternate?'#dac295':'#9cbdbe',8,14,3,2);
pixel(ctx,alternate?'#9cbdbe':'#dac295',21,14,3,2);
}else if(family==='shield-bearer'){
pixel(ctx,INK,5,5,22,4);
pixel(ctx,'#84928a',6,5,20,2);
pixel(ctx,'#c8d0bd',7,5,18,1);
pixel(ctx,'#384c46',12,6,8,2);
pixel(ctx,role.glove,8,9,3,3);
pixel(ctx,role.glove,21,9,3,3);
}else if(family==='brace-trooper'){
for(const x of closed?[7,20]:[3,25]){
pixel(ctx,INK,x,closed?8:14,closed?5:4,7);
pixel(ctx,role.trim,x+1,closed?9:15,closed?3:2,5);
pixel(ctx,role.light,x+1,closed?9:15,closed?3:2,1);
}
if(!closed)pixel(ctx,'#aec3a0',14,21,4,2);
}else if(family==='relay-warden'){
pixel(ctx,role.trim,6,12,5,2);
pixel(ctx,role.trim,21,12,5,2);
pixel(ctx,INK,9,17,1,9);
pixel(ctx,role.edge,9,17,1,1);
pixel(ctx,INK,9,12,2,5);
pixel(ctx,INK,21,12,2,5);
}
}

function overheadCompact(ctx,role,family,gait,options,cast){
ctx.save();
ctx.scale(2,2);
const step=Math.sign(gait.stride),
breath=gait.idling||gait.recovery?gait.breath:0,
closed=options.phase==='warning'||options.phase==='burst';
for(const[x,offset]of[
[5,step],
[9,-step],
]){
pixel(ctx,role.edge,x-1,9+offset,4,3);
pixel(ctx,BOOT,x,9+offset,2,3);
pixel(ctx,role.pants,x,9+offset,2,1);
}
for(const[x,offset]of[
[2,-step],
[11,step],
]){
pixel(ctx,role.edge,x,6+offset,3,3);
pixel(ctx,role.coat,x,7+offset,3,1);
pixel(ctx,role.glove,x+1,5+offset,2,2);
}
pixel(ctx,role.edge,3,6,10,5);
pixel(ctx,INK,4,5,8,7);
pixel(ctx,role.coat,4,6,8,5);
pixel(ctx,role.light,4,6,2,1+breath);
pixel(ctx,role.light,10,6,2,1+breath);
pixel(ctx,role.camo,4,9,2,2);
pixel(ctx,role.dark,6,10,4,2);
if(cast==='rivals')pixel(ctx,role.patch,4,7,1,1);
if(cast==='arcade')pixel(ctx,role.edge,11,7,1,3);
if(['patroller','refuge-seeker','rendezvous-pair','relay-warden'].includes(family)){
pixel(ctx,INK,5,10,6,3);
pixel(ctx,role.trim,6,10,4,2);
pixel(ctx,role.coat,7,10,1,3);
}
// The compact crown occupies the middle of the shoulder block, not its top.
pixel(ctx,role.edge,5,5,6,5);
pixel(ctx,INK,5,6,6,4);
pixel(ctx,role.coat,6,5,4,4);
pixel(ctx,role.light,6,5,3,1);
pixel(ctx,role.camo,8,7,2,1);
pixel(ctx,role.dark,7,9,2,1);
pixel(ctx,role.trim,6,4,4,1);
if(family==='lookout'){
const y=gait.notice||gait.breath?3:4;
pixel(ctx,INK,4,y,3,2);
pixel(ctx,INK,9,y,3,2);
pixel(ctx,'#a9c5bf',4,y,2,1);
pixel(ctx,'#a9c5bf',10,y,2,1);
}else if(family==='patroller'){
pixel(ctx,role.trim,5,4,6,1);
pixel(ctx,INK,12,9,1,3);
}else if(family==='runner'){
pixel(ctx,role.trim,5,10,1,2);
pixel(ctx,role.trim,10,10,1,2);
}else if(family==='sprinter'){
pixel(ctx,INK,4,6,1,3);
pixel(ctx,INK,11,6,1,3);
pixel(ctx,role.trim,5,5,6,1);
}else if(family==='courier'){
const y=8+(gait.accessory==null? -Math.abs(step):Math.round(gait.accessory/2));
pixel(ctx,INK,12,y,3,3);
pixel(ctx,'#be9b65',12,y,3,1);
pixel(ctx,'#795e3f',13,y+1,2,2);
pixel(ctx,'#d9c296',13,y,1,3);
}else if(family==='guard'){
pixel(ctx,role.dark,3,6,2,4);
pixel(ctx,role.dark,11,6,2,4);
pixel(ctx,'#99a58e',3,6,2,1);
pixel(ctx,'#99a58e',11,6,2,1);
if(options.armed===true){
pixel(ctx,INK,12,2,1,7);
pixel(ctx,'#735c40',12,9,2,2);
}
}else if(family==='refuge-seeker'){
pixel(ctx,role.dark,5,5,1,5);
pixel(ctx,role.dark,10,5,1,5);
pixel(ctx,role.trim,5,10,6,3);
pixel(ctx,role.coat,7,10,1,3);
}else if(family==='switchback'){
pixel(ctx,role.patch,5,10,7,1);
pixel(ctx,role.trim,11,11,3,1);
pixel(ctx,role.patch,13,12,1,1);
}else if(family==='rendezvous-pair'){
pixel(ctx,INK,10,7,1,4);
pixel(ctx,'#dac295',4,7,1,1);
pixel(ctx,'#9cbdbe',11,7,1,1);
pixel(ctx,'#a8c9bb',6,10,1,1);
}else if(family==='shield-bearer'){
pixel(ctx,INK,2,3,12,2);
pixel(ctx,'#c8d0bd',3,3,10,1);
pixel(ctx,'#384c46',6,4,4,1);
}else if(family==='brace-trooper'){
pixel(ctx,role.light,closed?3:1,closed?4:7,2,3);
pixel(ctx,role.trim,closed?11:13,closed?4:7,2,3);
if(!closed)pixel(ctx,'#aec3a0',7,10,2,1);
}else if(family==='relay-warden'){
pixel(ctx,INK,4,8,1,5);
pixel(ctx,INK,10,7,1,5);
pixel(ctx,role.trim,3,6,2,1);
pixel(ctx,role.trim,11,6,2,1);
pixel(ctx,'#a8c9bb',6,10,1,1);
}
ctx.restore();
}

/** Accessories are top planes attached to the approved rig. Compact silhouettes
     * use whole two-pixel cells; detailed parts remain inside the rotating 32px body.
     * Kit differences change geometry, not just colors or a gameplay-facing badge. */
function rosterEquipment(ctx,role,family,gait,options,cast,compactArt){
const unit=compactArt?2:1;
const p=(color,x,y,w,h)=>{
const snap=(n)=>Math.round(n/unit)*unit;
pixel(
ctx,
color,
snap(x),
snap(y),
Math.max(unit,Math.floor(w/unit)*unit),
Math.max(unit,Math.floor(h/unit)*unit),
);
};
const kit=(id,x=null,y=null)=>{
const part=INDUSTRIAL_SOLDIER_KITS[id];
for(const[color,xx,yy,width,height]of part.rectangles)
p(
role[color]??color,
(x??part.anchor[0])+xx,
(y??part.anchor[1])+yy,
width,
height,
);
};
const accessory=gait.accessory??0,
swing=Math.sign(accessory)*unit,
recovering=gait.recovery,
warning=options.phase==='warning'||options.phase==='turning',
caught=gait.caught,
closed=options.phase==='warning'||options.phase==='burst';
// Three different manufactured kits: strapped helmet, repaired asymmetrical
// shoulder pad, or insulated collar/boot gaiters. No cast grants protection.
if(cast==='tactical'){
p(role.dark,12,12,1,6);
p(role.trim,12,13,1,3);
p(role.dark,17,20,4,2);
p(role.light,18,20,2,1);
}else if(cast==='rivals'){
p(INK,6,15,4,7);
p(role.coat,7,16,3,4);
p(role.patch,7,17,2,2);
p(role.trim,21,20,3,2);
p(role.dark,14,12,4,2);
}else{
p(role.dark,9,12,2,9);
p(role.edge,9,13,2,6);
p(role.dark,21,12,2,9);
p(role.edge,21,13,2,6);
p(role.light,11,21,3,2);
p(role.light,18,21,3,2);
}
if(family==='lookout'){
const y=gait.notice||gait.breath||warning?6:8;
kit(family,null,y);
p(role.glove,8,y+3,3,3);
p(role.glove,21,y+3,3,3);
p(INK,13,21,6,4);
p(role.trim,14,22,4,2);
}else if(family==='patroller'){
// Transverse bedroll and a baton make the slow measured patrol recognizable.
kit(family);
p(INK,24,14+swing,2,8);
p(role.light,24,15+swing,1,3);
if(gait.notice)p(role.glove,22,9,3,3);
}else if(family==='runner'){
// A light rear harness leaves shoulders/crown readable; no large rucksack.
kit(family);
if(gait.notice||recovering)p(role.glove,7,10+swing,3,3);
}else if(family==='sprinter'){
kit(family);
p(role.dark,13,20,6,4);
p(role.light,14,20,4,2);
if(warning){
p(role.glove,7,10,3,4);
p(role.glove,22,10,3,4);
}else if(recovering){
p(role.glove,8,19+(gait.breath?unit:0),3,3);
p(role.glove,21,19+(gait.breath?unit:0),3,3);
}
}else if(family==='courier'){
const y=17+swing;
kit(family,null,y);
p(role.trim,20,15,5,2);
if(gait.idling||gait.notice){
p('#e5debd',22,y-2,4,3);
p('#795e3f',23,y-1,2,1);
}
}else if(family==='guard'){
p(INK,6,12,5,9);
p(INK,21,12,5,9);
for(const x of[7,22]){
p(role.dark,x,13,3,6);
p(role.light,x,13,3,2);
}
kit(family);
if(options.armed===true){
const recoil=
options.state==='fire'||options.animationClip==='fire'?Math.max(0,swing):0;
p(INK,24,5+recoil,2,14-recoil);
p('#718277',24,8+recoil,1,7);
p('#735c40',23,18,3,4);
}
}else if(family==='refuge-seeker'){
// Hood plus wide rolled shelter kit: a different outline from patrol/radio.
p(role.dark,9,10,3,9);
p(role.dark,20,10,3,9);
p(role.coat,9,11,2,6);
p(role.coat,21,11,2,6);
kit(family);
if(warning||gait.notice)p(role.glove,23,8+swing,3,6);
}else if(family==='switchback'){
p(role.dark,10,20,13,3);
p(role.patch,11,20,11,2);
kit(family,null,20+swing);
if(warning)p(role.glove,23,9+swing,3,4);
}else if(family==='rendezvous-pair'){
const alternate=(String(options.partnerId??'').charCodeAt(0)||0)%2;
const antenna=alternate?10:21;
kit(family);
p(INK,antenna,10,1,12);
p('#a8c9bb',antenna,10,1,2);
p('#9cbdbe',13,22,2,1);
p('#dac295',18,22,2,1);
if(gait.notice||recovering)p(role.glove,alternate?5:24,10+swing,3,4);
}else if(family==='shield-bearer'){
// Plates never open on a cosmetic frame. Heading and protection stay native.
kit(family);
p(role.trim,13,21,6,4);
}else if(family==='brace-trooper'){
for(const x of closed?[6,21]:[3,25]){
p(INK,x,closed?9:14,4,8);
p(role.trim,x+1,closed?10:15,2,6);
p(role.light,x+1,closed?10:15,2,2);
}
kit(family);
if(!closed)p('#aec3a0',14,21,4,3);
}else if(family==='relay-warden'){
kit(family);
for(const[x,y]of[
[9,8],
[22,10],
]){
p(INK,x,y,1,14);
p('#a8c9bb',x,y,1,2);
}
p('#8fab82',16,23,4,2);
if(accessory>0)p('#d5dcc1',18,23,2,1);
}
if(caught){
// A brief open-hand/stumble pose, not a hitbox displacement or an automatic
// gore effect. Actual clean/brutal breakup remains the shared defeat owner.
p(role.glove,5,13+swing,3,3);
p(role.glove,24,13-swing,3,3);
}else if(options.state==='blocked'){
p(role.glove,8,10+swing,3,3);
p(role.glove,21,10-swing,3,3);
}
}

function markers(ctx,family,options,angle){
if(
['refuge-seeker','switchback','sprinter'].includes(family)&&
options.phase==='warning'&&
Object.hasOwn(ANGLES,options.nextHeading)
){
// Show only an accepted upcoming heading, never a guessed vector to a goal
// behind a wall. Cached north-facing hosts supply the relative paint angle;
// direct board callers keep the native world heading. This stays visible
// during Reduced effects/Pulse without rotating the current body.
ctx.save();
ctx.translate(16,16);
ctx.rotate(
Number.isFinite(options.intentFacingRadians)
?options.intentFacingRadians
:ANGLES[options.nextHeading],
);
pixel(ctx,INK,-2,-11,4,4);
pixel(ctx,'#fff0cc',-1,-11,2,1);
pixel(ctx,'#fff0cc',-2,-10,1,2);
pixel(ctx,'#fff0cc',1,-10,1,2);
ctx.restore();
}
if(family==='shield-bearer'){
ctx.save();
ctx.translate(16,16);
ctx.rotate(angle);
// Exact accepted forward edge, with exposed sides. No enclosing danger box.
pixel(ctx,INK,-10,-14,20,2);
pixel(ctx,'#e5b37d',-9,-14,18,1);
ctx.restore();
if(options.phase==='turning'&&Object.hasOwn(ANGLES,options.nextHeading)){
ctx.save();
ctx.translate(16,16);
ctx.rotate(ANGLES[options.nextHeading]);
pixel(ctx,INK,-2,-11,4,4);
pixel(ctx,'#fff0cc',-1,-11,2,1);
pixel(ctx,'#fff0cc',-2,-10,1,2);
pixel(ctx,'#fff0cc',1,-10,1,2);
ctx.restore();
}
}else if(family==='brace-trooper'){
const closed=options.phase==='warning'||options.phase==='burst';
ctx.save();
ctx.translate(16,16);
ctx.rotate(angle);
for(const x of[-14,12]){
pixel(ctx,INK,x,-2,2,8);
pixel(ctx,closed?'#e0ac76':'#9edda8',x,-1,1,6);
if(closed){
pixel(ctx,'#fff0cc',x,-2,2,1);
pixel(ctx,'#fff0cc',x,5,2,1);
}
}
ctx.restore();
}
if(options.frozen){
// A small snowflake, not the former square token/corner frame.
pixel(ctx,INK,26,2,3,7);
pixel(ctx,'#d6f6ff',27,2,1,7);
pixel(ctx,'#d6f6ff',24,5,7,1);
pixel(ctx,'#88bfce',25,3,1,1);
pixel(ctx,'#88bfce',29,7,1,1);
}
if(options.phase==='warning'||options.state==='notice'){
pixel(ctx,INK,2,2,4,8);
pixel(ctx,'#f7d593',3,3,2,4);
pixel(ctx,'#f7d593',3,8,2,1);
}
if(options.state==='blocked'){
pixel(ctx,INK,2,4,5,3);
pixel(ctx,'#fff0cc',3,5,3,1);
}
}

/** Transparent overhead art. Legacy token/palette options remain accepted but
     * can no longer introduce a square. facingRadians is clockwise from north.
     * Gait is sampled from caller-owned presentation time or locomotionPhase; a
     * frozen/Pulse actor keeps its authoritative armor state and a stable pose. */
function drawHuntActor(ctx,x,y,size,pose=0,options={}){
if(!ctx|| ![x,y,size].every(Number.isFinite)||size<=0)return;
const family=
resolveActorFamily(options.family??options.kind??options.profile)??'runner';
const visual=
actorVisual(options.visualId)??actorVisual(family,options.cast)??actorVisual(family);
const angle=facing(options);
const revision=Object.hasOwn(options,'artRevision')
?options.artRevision
:runtimeActorArtRevision(),
candidate=revision==='industrial-pilot-v1',
roster=revision===INDUSTRIAL_ROSTER_ART_REVISION,
overhead=roster||revision===OVERHEAD_ACTOR_ART_REVISION;
const descriptor=
options.animation??
(roster
?INDUSTRIAL_ROSTER_SAMPLES[visual.family]
:overhead
?OVERHEAD_ACTOR_SAMPLES[visual.family]
:candidate
?INDUSTRIAL_ACTOR_SAMPLES[visual.family]
:null);
const artOptions=overhead
?{
...options,
state:options.state==='recovery'?'recover':options.state,
phase:
options.state==='anticipation'&&options.phase==null?'warning':options.phase,
}
:options;
const gait=motion(pose,artOptions,visual.family);
if(
(overhead&&['aim','fire'].includes(options.state))||
['aim','fire'].includes(options.animationClip)
)
gait.stride=0;
if(descriptor){
const clip=Object.hasOwn(descriptor.clips,options.animationClip)
?options.animationClip
:overhead&&Object.hasOwn(descriptor.clips,options.state)
?options.state
:gait.caught
?'caught'
:gait.recovery
?'recovery'
:options.phase==='warning'||options.phase==='turning'
?'anticipation'
:options.state==='blocked'
?'blocked'
:gait.notice
?'notice'
:gait.idling
?'idle'
:'move';
// Locomotion phase is owned by the native host. Sampling its whole cycle
// avoids aliasing a six-frame walk against an unrelated idle/breath clock.
const moveDuration=
overhead&&clip==='move'&&Number.isFinite(options.locomotionPhase)
?descriptor.clips.move.frames.reduce(
(sum,id)=>sum+descriptor.frames.find((frame)=>frame.id===id).durationMs,
0,
)
:null;
const sample=sampleActorAnimation(descriptor,{
clip,
timeMs:
moveDuration===null
?(options.timeMs??pose*100)
:options.locomotionPhase*moveDuration,
reducedEffects:options.reducedEffects||options.frozen||options.paused,
});
if(overhead||options.animationClip!=null){
// Eligibility comes from the native state (or an explicit Studio Move
// preview), never from a zero crossing of the legacy 130/85ms gait.
const moving=
clip==='move'&&
(gait.moving||options.animationClip==='move')&&
!options.reducedEffects&&
!options.frozen&&
!options.paused;
gait.stride=moving?sample.stride:0;
}else if(gait.stride!==0)gait.stride=sample.stride;
gait.breath=sample.breath;
// Explicit admitted drafts can animate the courier's approved satchel.
// Historical/default procedural art retains its stride-derived bounce;
// body position, facing and specialist protection never use this offset.
if(roster||(overhead&&options.animation&&descriptor.parts.includes('satchel')))
gait.accessory=sample.accessory;
}
ctx.save();
ctx.translate(x,y);
ctx.scale(size/UNIT,size/UNIT);
ctx.imageSmoothingEnabled=false;
// Body and accessories share one transform; simulation position is untouched.
ctx.save();
ctx.translate(16,16);
ctx.rotate(angle);
ctx.translate(-16,-16);
if(options.shadow!==false){
const alpha=ctx.globalAlpha;
ctx.globalAlpha*=0.18;
if(overhead){
pixel(ctx,'#101b17',8,12,16,11);
pixel(ctx,'#101b17',6,14,20,6);
}else pixel(ctx,'#101b17',6,14,20,11);
ctx.globalAlpha=alpha;
}
const useCompact=
options.detail==='compact'||(options.detail!=='detailed'&&size<24);
(overhead
?useCompact
?overheadCompact
:overheadDetailed
:useCompact
?compact
:detailed)(
ctx,
visual.palette,
visual.family,
gait,
{...artOptions,industrialSample:candidate,roster},
visual.cast,
);
if(roster)
rosterEquipment(
ctx,
visual.palette,
visual.family,
gait,
artOptions,
visual.cast,
useCompact,
);
if(candidate&&INDUSTRIAL_ACTOR_SAMPLES[visual.family]){
const p=visual.palette;
// Family-sized equipment changes the silhouette, not the occupied cell.
if(visual.family==='runner'){
pixel(ctx,p.dark,11,16,10,7);
pixel(ctx,p.coat,12,16,8,6);
pixel(ctx,p.trim,12,17,2,4);
pixel(ctx,'#bdbda0',19,17,1,3);
pixel(ctx,INK,12,23,3,2);
pixel(ctx,INK,18,23,3,2);
}else if(visual.family==='courier'){
const bounce=gait.stride?Math.sign(gait.stride):0;
pixel(ctx,INK,23,17+bounce,8,10);
pixel(ctx,'#795e3f',24,18+bounce,6,8);
pixel(ctx,'#be9b65',24,18+bounce,6,2);
pixel(ctx,'#d9c296',26,20+bounce,2,4);
pixel(ctx,'#402f24',24,25+bounce,6,1);
pixel(ctx,p.trim,11,15,2,9);
}else if(visual.family==='guard'){
pixel(ctx,INK,7,14,18,5);
pixel(ctx,'#667366',8,14,16,4);
pixel(ctx,'#9fa68b',8,14,15,1);
pixel(ctx,p.dark,10,19,12,5);
for(const x of[10,15,20]){
pixel(ctx,'#283b33',x,19,3,5);
pixel(ctx,'#87957c',x,19,3,1);
}
}else{
pixel(ctx,INK,5,2,22,8);
pixel(ctx,'#465953',6,2,20,7);
pixel(ctx,'#afb8a0',6,2,20,1);
pixel(ctx,'#85958a',6,3,2,5);
pixel(ctx,'#263a37',23,3,3,6);
pixel(ctx,'#152723',10,4,12,2);
pixel(ctx,'#c2d6c8',11,4,10,1);
pixel(ctx,'#a59762',15,7,2,2);
}
}
ctx.restore();
markers(ctx,visual.family,options,angle);
ctx.restore();
}

return{
INDUSTRIAL_ACTOR_SAMPLES,
OVERHEAD_ACTOR_ART_REVISION,
OVERHEAD_ACTOR_SAMPLES,
INDUSTRIAL_ROSTER_ART_REVISION,
INDUSTRIAL_ROSTER_SAMPLES,
drawHuntActor,
};
})();
modules['game/ui/enemy-stats.mjs']=(()=>{
const canonicalEnemyFamily=modules['game/enemy-stats.mjs']['canonicalEnemyFamily'];
const drawHuntActor=modules['game/hunt/actor-art.mjs']['drawHuntActor'];
const actorDefinition=modules['game/hunt/actor-catalog.mjs']['actorDefinition'];
const resolveActorFamily=modules['game/hunt/actor-catalog.mjs']['resolveActorFamily'];

const copy={
en:{
title:'Your victories',
enemies:'Enemies',
details:'Enemy details',
breakdown:'This run / Lifetime',
lifetime:'Lifetime',
run:'This run',
all:'All games',
defeated:'Enemies defeated',
empty:'Your first catch starts your collection.',
saving:'Session totals · saving unavailable',
since:'Every enemy counts, even on a run you retry.',
filter:'Filter victories by game',
solo:'Solo',
team:'Team',
versus:'Versus',
snake:'Snake',
worlds:'SIM Worlds',
},
uk:{
title:'Ваші перемоги',
enemies:'Вороги',
details:'Види ворогів',
breakdown:'Ця спроба / За весь час',
lifetime:'За весь час',
run:'Ця спроба',
all:'Усі ігри',
defeated:'Переможені вороги',
empty:'Спіймайте першого ворога, щоб почати колекцію.',
saving:'Підсумки сеансу · збереження недоступне',
since:'Кожен ворог зараховується, навіть якщо почати спробу знову.',
filter:'Фільтр перемог за грою',
solo:'Соло',
team:'Команда',
versus:'Дуель',
snake:'Змійка',
worlds:'SIM Worlds',
},
};
const families={
lookout:['Lookout','Спостерігач'],
patroller:['Patroller','Патрульний'],
runner:['Runner','Бігун'],
sprinter:['Sprinter','Спринтер'],
'refuge-seeker':['Refuge seeker','Шукач укриття'],
'pair-runner':['Pair runner','Парний бігун'],
'shield-trooper':['Shield trooper','Щитоносець'],
'brace-trooper':['Brace trooper','Боєць у стійці'],
bouncer:['Field hunter','Польовий мисливець'],
'border-patrol':['Border guard','Прикордонний патруль'],
'contour-patrol':['Contour crawler','Контурний патруль'],
'claimed-rover':['Ground rover','Наземний ровер'],
eroder:['Territory eroder','Руйнівник території'],
'lane-boss':['Lane emitter','Лінійний випромінювач'],
'relay-sentinel':['Relay sentinel','Релейний вартовий'],
jammer:['Signal jammer','Глушник сигналу'],
sentry:['Sentry','Вартовий'],
courier:['Courier','Кур’єр'],
drone:['Drone','Дрон'],
vehicle:['Armoured vehicle','Бронемашина'],
};
const spriteFamilies=new Set([
'bouncer',
'border-patrol',
'contour-patrol',
'claimed-rover',
'eroder',
'lane-boss',
'relay-sentinel',
]);
const glyphs={
drone:['11000011','01100110','00111100','00111100','01100110','11000011'],
vehicle:['00011100','00111110','11111111','11011011','11111111','01100110'],
bouncer:['00111100','01111110','11100111','11111111','01111110','11000011'],
'border-patrol':['11000011','11100111','00111100','00111100','11100111','11000011'],
'contour-patrol':['11110000','10010000','10111100','10100100','00101111','00100001'],
'claimed-rover':['00011000','00111100','01111110','11011011','11111111','11000011'],
eroder:['00011000','00111100','01100110','11011011','01100110','00111100'],
'lane-boss':['10000001','01011010','00111100','11111111','00111100','01100110'],
'relay-sentinel':['00111100','01100110','11011011','11011011','01111110','00111100'],
};
function drawMechanicalPortrait(ctx,family){
if(!ctx)return;
ctx.fillStyle='#b9c6a6';
glyphs[family]?.forEach((row,y)=>
[...row].forEach((value,x)=>{
if(value==='1')ctx.fillRect(4+x*7,11+y*7,7,7);
}),
);
}
const styles=`
.enemy-stats{--stats-gold:var(--fk-color-accent,#eabb59);box-sizing:border-box;color:inherit;min-width:0;max-width:100%;overflow-wrap:anywhere}
.enemy-stats *{box-sizing:border-box;min-width:0}
.enemy-stats[data-variant=panel]{width:100%;margin:8px 0 0;border-top:1px solid #87958c44;font-size:.875rem}
.enemy-stats[data-variant=collection]{border:1px solid #69706f66;background:linear-gradient(140deg,#26343b99,#171c2099);padding:clamp(12px,2vw,24px);margin:12px 0;border-radius:4px}
.enemy-stats-header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.enemy-stats-header h3{margin:0}
.enemy-stats-summary{display:flex;align-items:baseline;gap:6px 14px;flex-wrap:wrap;max-width:100%}
.enemy-stats-metric{display:inline-flex;align-items:baseline;gap:5px;flex-wrap:wrap;max-width:100%;font-variant-numeric:tabular-nums}
.enemy-stats-metric strong{color:var(--stats-gold);font-weight:750}.enemy-stats-caption,.enemy-stats-label{opacity:.8}.enemy-stats-lifetime{opacity:.85}
.enemy-stats[data-variant=collection] .enemy-stats-summary{margin:12px 0}.enemy-stats[data-variant=collection] .enemy-stats-total{font-size:clamp(1.7rem,3vw,2.8rem);line-height:1.1}
.enemy-stats-disclosure{border:0;background:none;padding:0;margin:0;max-width:100%}
.enemy-stats-disclosure>.enemy-stats-summary{list-style:none;cursor:pointer;min-height:44px;padding:10px 0;border-radius:2px}
.enemy-stats-disclosure>.enemy-stats-summary::-webkit-details-marker{display:none}
.enemy-stats-disclosure>.enemy-stats-summary:focus-visible{outline:2px solid var(--stats-gold);outline-offset:3px}
.enemy-stats-disclosure-label{margin-inline-start:auto;opacity:.8;font-size:.85em}
.enemy-stats-disclosure-label::after{content:' +';color:var(--stats-gold);font-weight:700}
.enemy-stats-disclosure[open] .enemy-stats-disclosure-label::after{content:' −'}
.enemy-stats-breakdown-label{margin:0 0 4px;text-align:end;font-size:.8em;opacity:.7}
.enemy-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,165px),1fr));gap:10px;margin:12px 0 0;padding:0;list-style:none}
.enemy-stats-card{display:grid;grid-template-columns:40px minmax(0,1fr);align-items:center;gap:10px;padding:10px;border:1px solid #87958c44;background:#10181b77}.enemy-stats-card strong{display:block;font-variant-numeric:tabular-nums;font-size:1.4em;color:var(--stats-gold)}.enemy-stats-card span{font-size:.85em}
.enemy-stats[data-variant=panel] .enemy-stats-grid{display:block;margin:0}.enemy-stats-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:5px 0;border-top:1px solid #87958c22}.enemy-stats-row-count{flex-shrink:0;font-variant-numeric:tabular-nums;color:var(--stats-gold)}
.enemy-stats-portrait{width:40px;height:40px;object-fit:contain;image-rendering:pixelated;background:#27383c}.enemy-stats-person{position:relative;display:block;width:40px;height:40px;background:#27383c;overflow:hidden}.enemy-stats-person:before{content:'';position:absolute;width:14px;height:14px;left:13px;top:6px;background:#d7bd87;box-shadow:0 -3px #bb934c}.enemy-stats-person:after{content:'';position:absolute;width:24px;height:18px;left:8px;top:22px;background:#829c75;box-shadow:inset 9px 0 #566d58,inset -9px 0 #566d58}
.enemy-stats select{max-width:100%;min-height:40px;color:inherit;background:#20292f;border:1px solid #83908a;padding:5px 9px;font:inherit}
.enemy-stats[data-variant=hud]{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;font-size:.8rem;line-height:1.35}.enemy-stats[data-variant=hud] .enemy-stats-summary{gap:4px 10px}.enemy-stats[data-variant=hud] .enemy-stats-lifetime{font-size:.9em}
.enemy-stats-warning{color:#e6c68b;font-size:.8em;margin:4px 0}.enemy-stats-note{font-size:.85em;margin:8px 0 0;opacity:.8}.enemy-stats-milestone{font-size:.8em;color:var(--stats-gold)}.enemy-stats [hidden]{display:none!important}
@media(max-width:360px){.enemy-stats[data-variant=panel]{font-size:.8rem}.enemy-stats-summary{gap:5px 10px}.enemy-stats-disclosure-label{font-size:.9em}.enemy-stats[data-variant=hud]{font-size:.75rem}}
`;
function enemyStatsFamilyLabel(family,locale='en'){
const canonical=canonicalEnemyFamily(family);
return(
actorDefinition(canonical)?.name?.[locale==='uk'?'uk':'en']??
families[canonical]?.[locale==='uk'?1:0]??
canonical.replaceAll('-',' ')
);
}

/** Compact stats belong inside their host's pause/result card, after actions.
     * Collections keep the portrait grid above the existing picture gallery. */
function mountEnemyStats({
container,
stats,
gameType=null,
getAttempt=()=>null,
locale='en',
variant='panel',
spritePortraits=true,
assetBaseURL=new URL('../assets/',import.meta.url).href,
document:doc=container?.ownerDocument??globalThis.document,
}={}){
if(!container|| !stats|| !doc)
throw new TypeError('Enemy statistics need a host and service.');
if(!doc.getElementById('enemy-stats-shared-style')){
const style=doc.createElement('style');
style.id='enemy-stats-shared-style';
style.textContent=styles;
(doc.head??doc.body).append(style);
}
const make=(tag,className)=>{
const el=doc.createElement(tag);
if(className)el.className=className;
return el;
};
const root=make('section','enemy-stats');
root.dataset.variant=variant;
const header=make('div','enemy-stats-header'),
title=make('h3'),
filter=make('select');
header.append(title,filter);
const disclosure=variant==='panel'?make('details','enemy-stats-disclosure'):null;
const summary=make(disclosure?'summary':'div','enemy-stats-summary');
const label=make('span','enemy-stats-label');
const lifetime=make('span','enemy-stats-metric enemy-stats-lifetime'),
caption=make('span','enemy-stats-caption'),
total=make('strong','enemy-stats-total');
lifetime.append(caption,total);
const run=make('span','enemy-stats-metric enemy-stats-run'),
runLabel=make('span'),
runCount=make('strong');
run.append(runLabel,runCount);
const disclosureLabel=make('span','enemy-stats-disclosure-label');
const grid=make('ul','enemy-stats-grid'),
detail=make('p','enemy-stats-note'),
breakdownLabel=make('p','enemy-stats-breakdown-label'),
warning=make('p','enemy-stats-warning'),
milestone=make('span','enemy-stats-milestone');
milestone.setAttribute('role','status');
milestone.hidden=true;
if(disclosure){
summary.append(run,lifetime,disclosureLabel);
disclosure.append(summary,breakdownLabel,grid,detail);
root.append(disclosure,milestone,warning);
}else if(variant==='collection'){
summary.append(lifetime,run);
root.append(header,summary,milestone,grid,detail,warning);
}else{
summary.append(label,run,lifetime);
root.append(summary,milestone,warning);
}
container.append(root);
let selected=variant==='collection'?'':(gameType??''),
disposed=false,
priorTotal=stats.totals().total,
priorRun=0,
milestoneTimer=null;
const language=()=>
(typeof locale==='function'?locale():locale)==='uk'?'uk':'en';
function refresh(event={}){
if(disposed)return;
const lang=language(),
t=copy[lang],
attempt=getAttempt();
const all=stats.totals(),
result=stats.totals({gameType:selected||null,attempt});
const number=(n)=>new Intl.NumberFormat(lang).format(n);
const mark=(n)=>
n>=100?Math.floor(n/100)*100:([50,25,10].find((value)=>n>=value)??0);
if(event.kind==='defeat'){
const lifetimeMark=mark(all.total),
runMark=mark(result.run.total);
const reached=
lifetimeMark>mark(priorTotal)?lifetimeMark:runMark>mark(priorRun)?runMark:0;
if(reached){
milestone.textContent=
lang==='uk'?`✦ ${number(reached)} перемог!`:`✦ ${number(reached)} victories!`;
milestone.hidden=false;
clearTimeout(milestoneTimer);
milestoneTimer=setTimeout(()=>{
milestone.hidden=true;
},3500);
}
}
priorTotal=all.total;
priorRun=result.run.total;
root.setAttribute('aria-label',t.defeated);
title.textContent=t.title;
label.textContent=t.enemies;
filter.setAttribute('aria-label',t.filter);
if(variant==='collection'){
const games=Object.keys(all.byGame).sort();
if(gameType&& !games.includes(gameType))games.push(gameType);
filter.replaceChildren();
for(const game of['',...games]){
const option=make('option');
option.value=game;
option.textContent=game?(t[game]??game):t.all;
filter.append(option);
}
filter.value=selected;
}
total.textContent=number(result.total);
caption.textContent=t.lifetime;
runLabel.textContent=t.run;
runCount.textContent=number(result.run.total);
run.hidden= !attempt;
disclosureLabel.textContent=t.details;
breakdownLabel.textContent=attempt?t.breakdown:t.lifetime;
grid.setAttribute('aria-label',t.details);
warning.hidden=result.durable;
warning.textContent=t.saving;
detail.textContent=result.total?t.since:t.empty;
detail.hidden=variant==='panel'&&result.total>0;
grid.replaceChildren();
// Closed menu details have no cards, portraits or image requests. Refreshing
// counts never replaces the summary or changes the player's open/focus state.
if(variant==='hud'||(disclosure&& !disclosure.open))return;
const rows=Object.entries(result.byFamily).sort(
(a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]),
);
for(const[family,n]of rows){
const name=make('span');
name.textContent=enemyStatsFamilyLabel(family,lang);
if(disclosure){
const row=make('li','enemy-stats-row'),
count=make('span','enemy-stats-row-count');
const inRun=result.run.byFamily[family]??0;
count.textContent=attempt?`${number(inRun)} / ${number(n)}`:number(n);
count.setAttribute(
'aria-label',
attempt
?`${t.run}: ${number(inRun)} · ${t.lifetime}: ${number(n)}`
:`${t.lifetime}: ${number(n)}`,
);
row.append(name,count);
grid.append(row);
continue;
}
const card=make('li','enemy-stats-card'),
info=make('div'),
count=make('strong');
let portrait;
if(spriteFamilies.has(family)&&spritePortraits){
portrait=make('img','enemy-stats-portrait');
portrait.src=new URL(`field-kit/sprites/enemy-${family}.png`,assetBaseURL).href;
portrait.alt='';
portrait.loading='lazy';
}else if(Object.hasOwn(glyphs,family)){
portrait=make('canvas','enemy-stats-portrait');
portrait.width=portrait.height=64;
portrait.setAttribute('aria-hidden','true');
drawMechanicalPortrait(portrait.getContext?.('2d'),family);
}else if(resolveActorFamily(family)){
portrait=make('canvas','enemy-stats-portrait');
portrait.width=portrait.height=64;
portrait.setAttribute('aria-hidden','true');
drawHuntActor(portrait.getContext?.('2d'),2,2,60,0,{
family,
cast:'rivals',
direction:'up',
reducedEffects:true,
frozen:true,
token:false,
});
}else{
portrait=make('i','enemy-stats-person');
portrait.setAttribute('aria-hidden','true');
}
count.textContent=number(n);
info.append(count,name);
card.append(portrait,info);
grid.append(card);
}
}
filter.addEventListener('change',()=>{
selected=filter.value;
refresh();
});
disclosure?.addEventListener('toggle',()=>refresh());
const unsubscribe=stats.subscribe(refresh);
refresh();
return{
root,
refresh,
dispose(){
disposed=true;
clearTimeout(milestoneTimer);
unsubscribe();
root.remove();
},
};
}

return{enemyStatsFamilyLabel,mountEnemyStats};
})();
modules['game/ui/celebration.mjs']=(()=>{
const t=simGlobalI18n['t'];
// Keep the visual sampler independent of the music engine so optional games can
// project the exact same confetti implementation without loading an audio host.
function hashText(value){
let hash=2166136261;
for(const character of String(value))
hash=Math.imul(hash^character.charCodeAt(0),16777619);
return hash>>>0;
}
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),
TAU=Math.PI*2;
const ease=(v)=>1-(1-clamp(v,0,1))**3;
const CELEBRATION_SECONDS=5.2;
const PAPER_COUNT=104;
const GLINT_COUNT=16;
// Keep the family IDs stable for existing presentation consumers. Each now
// selects a paper palette; the firework-like bloom uses paper and stars only.
const CONFETTI_TONES={
'signal-clear':['accent','safe','paper','danger','accent','safe'],
'stitch-bloom':['accent','danger','paper','safe','danger','accent'],
'savings-nodes':['safe','accent','paper','safe','danger','accent'],
'neon-fireworks':['danger','safe','paper','accent','safe','danger'],
};
// Stateless presentation randomness: sampling a frame never consumes gameplay
// randomness, accumulates particles or depends on the rendering frame rate.
function sample(seed,index,channel){
let value=seed^Math.imul(index+1,0x9e3779b1)^Math.imul(channel+1,0x85ebca6b);
value=Math.imul(value^(value>>>16),0x7feb352d);
value=Math.imul(value^(value>>>15),0x846ca68b);
return((value^(value>>>16))>>>0)/4294967296;
}
function finaleKind(theme={}){
return theme.family==='fpv'||theme.id==='fpv'
?'signal-clear'
:theme.family==='atlas'||theme.scene==='heritage'
?'stitch-bloom'
:theme.family==='navi'||theme.scene==='network'
?'savings-nodes'
:'neon-fireworks';
}
function createCelebration({theme={},levelId='',seed=0,reduced=false}={}){
return{
kind:finaleKind(theme),
levelId,
seed:hashText(`${levelId}:${seed}:${theme.id||''}`),
elapsed:reduced?CELEBRATION_SECONDS:0,
duration:CELEBRATION_SECONDS,
reduced:!!reduced,
skipped:false,
};
}
function advanceCelebration(state,dt,{paused=false,reduced=false}={}){
if(!state)return null;
if(!Number.isFinite(dt)||dt<0)
throw new TypeError(t('interface:celebrationDtMustBeFiniteAndNonnegative'));
if(reduced)return{...state,reduced:true,elapsed:state.duration};
if(paused||state.elapsed>=state.duration)return state;
return{...state,elapsed:Math.min(state.duration,state.elapsed+Math.min(dt,0.25))};
}
function skipCelebration(state){
return state?{...state,elapsed:state.duration,skipped:true}:null;
}
function celebrationFrame(state){
if(!state)
return{
active:false,
finished:true,
reveal:1,
pictureScale:1,
progress:1,
phase:'picture',
particles:[],
equipment:[],
};
const time=state.elapsed,
finished=time>=state.duration,
fade=1-ease((time-2.45)/(state.duration-2.45)),
particles=[];
if(!finished&& !state.reduced){
const tones=CONFETTI_TONES[state.kind]||CONFETTI_TONES['signal-clear'];
// Three finite pops from the picture's center. Analytic drag gives a quick
// launch and a floating finish, without integrating or consuming run RNG.
for(let index=0;index<PAPER_COUNT;index++){
const random=(channel)=>sample(state.seed,index,channel),
wave=index<52?0:index<84?1:2,
age=time-0.08-wave*0.24-random(0)*0.07;
if(age<0)continue;
const phase=random(1)*TAU,
depth=random(2),
angle=index*2.399963229728653+(random(3)-0.5)*0.4,
speed=(0.85+depth*0.8)*(1-wave*0.12),
distance=(speed*(1-Math.exp(-2.5*age)))/2.5,
flutter=(1-Math.exp(-3*age))*0.014,
life=clamp(age/0.08,0,1);
particles.push({
shape:'paper',
x:0.5+Math.cos(angle)*distance+Math.sin(age*5+phase)*flutter,
y:0.5+Math.sin(angle)*distance+0.012*age*age,
size:(5+depth*4.4)*ease(life),
aspect:index%6===0?2.25:0.48+random(6)*0.46,
rotation:angle+age*(2.2+random(7)*4)*(index%2?1:-1),
flip:0.18+Math.abs(Math.cos(phase+age*(3+depth*3)))*0.82,
alpha:ease(life)*fade*(0.76+depth*0.24),
tone:tones[index%tones.length],
});
}
// Sparse stars lead the bloom outwards. One smooth glow per star, no flash
// or repeated twinkling, so the earned image quickly regains the center.
for(let index=0;index<GLINT_COUNT;index++){
const age=time-0.1-(index%2)*0.24,
life=1.05;
if(age<0||age>life)continue;
const angle=(index/GLINT_COUNT)*TAU+sample(state.seed,index,9)*0.2,
distance=0.52*(1-Math.exp(-3.8*age)),
bloom=Math.sin((age/life)*Math.PI);
particles.push({
shape:'glint',
x:0.5+Math.cos(angle)*distance,
y:0.5+Math.sin(angle)*distance,
size:2+bloom*3.5,
rotation:angle+age*0.4,
alpha:bloom*0.75,
tone:index%3?'paper':'accent',
});
}
}
return{
active:!finished,
finished,
reveal:finished||state.reduced?1:ease(time/0.85),
pictureScale:finished||state.reduced?1:1+0.014*(1-ease(time/1.35)),
progress:clamp(time/state.duration,0,1),
phase:finished?'picture':time<0.85?'reveal':time<2.45?'celebrate':'settle',
kind:state.kind,
elapsed:time,
duration:state.duration,
particles,
equipment:[],
};
}
function drawCelebration(ctx,frame,palette,width=768,height=576){
if(!frame.active)return;
const span=Math.min(width,height),
scale=Math.max(0.75,Math.min(width/768,height/576));
ctx.save();
// Use equal pixel distances on both axes: a circular burst stays circular
// on a wide board or a portrait video viewport. Clip at the owning surface.
ctx.beginPath();
ctx.rect(0,0,width,height);
ctx.clip();
for(const p of frame.particles){
if(p.alpha<=0)continue;
const size=p.size*scale;
ctx.save();
ctx.globalAlpha=clamp(p.alpha,0,1);
ctx.fillStyle=palette[p.tone]||palette.accent;
ctx.translate(width/2+(p.x-0.5)*span,height/2+(p.y-0.5)*span);
ctx.rotate(p.rotation);
if(p.shape==='paper'){
ctx.scale(p.flip,1);
ctx.fillRect(-size/2,(-size*p.aspect)/2,size,size*p.aspect);
// A narrow lighter fold makes the paper feel tactile without glow or blur.
ctx.globalAlpha*=0.32;
ctx.fillStyle=palette.paper||'#fff4dc';
ctx.fillRect(
-size/2,
(-size*p.aspect)/2,
size,
Math.min(1,size*p.aspect*0.22),
);
}else if(p.shape==='glint'){
ctx.beginPath();
ctx.moveTo(0,-size);
ctx.lineTo(size*0.22,-size*0.22);
ctx.lineTo(size,0);
ctx.lineTo(size*0.22,size*0.22);
ctx.lineTo(0,size);
ctx.lineTo(-size*0.22,size*0.22);
ctx.lineTo(-size,0);
ctx.lineTo(-size*0.22,-size*0.22);
ctx.closePath();
ctx.fill();
}
ctx.restore();
}
ctx.restore();
}

return{
CELEBRATION_SECONDS,
finaleKind,
createCelebration,
advanceCelebration,
skipCelebration,
celebrationFrame,
drawCelebration,
};
})();
modules['game/ui/continuous-celebration.mjs']=(()=>{
const createCelebration=modules['game/ui/celebration.mjs']['createCelebration'];
const celebrationFrame=modules['game/ui/celebration.mjs']['celebrationFrame'];
const drawCelebration=modules['game/ui/celebration.mjs']['drawCelebration'];

/** The same core confetti renderer, with no input, audio or gameplay ownership. */
function mountContinuousCelebration({
document:doc=globalThis.document,
parent=doc.body,
controller,
reduced=()=>false,
theme=()=>({family:'fpv'}),
seed=()=>0,
}={}){
const canvas=doc.createElement('canvas');
canvas.className='continuous-celebration';
canvas.setAttribute('aria-hidden','true');
Object.assign(canvas.style,{
position:'fixed',
inset:'0',
width:'100%',
height:'100%',
pointerEvents:'none',
zIndex:'30',
});
parent.append(canvas);
let context;
try{
context=canvas.getContext('2d');
}catch{
/* Headless/static hosts keep the textual celebration. */
}
let identity,state;
const stop=controller.subscribe((value)=>{
canvas.hidden=value.outcome!=='won'||value.phase!=='celebration'||reduced();
if(canvas.hidden|| !context)return;
if(identity!==value.identity){
identity=value.identity;
state=createCelebration({
theme:theme(),
seed:seed(),
levelId:String(identity??''),
});
}
canvas.width=doc.defaultView?.innerWidth||parent.clientWidth||768;
canvas.height=doc.defaultView?.innerHeight||parent.clientHeight||576;
state.elapsed=Math.max(0,state.duration-value.remainingMs/1000);
context.clearRect(0,0,canvas.width,canvas.height);
drawCelebration(
context,
celebrationFrame(state),
{accent:'#eac15d',safe:'#b9d995',paper:'#fff4dc',danger:'#e37b6d'},
canvas.width,
canvas.height,
);
});
return{
dispose(){
stop();
canvas.remove();
},
};
}

return{mountContinuousCelebration};
})();
modules['game/ui/continuous-play.mjs']=(()=>{
const CONTINUOUS_PLAY_KEY='revealline.continuous-play.v1';
const CONTINUOUS_PLAY_DEFAULTS=Object.freeze({
autoNext:true,
autoRetry:true,
autoReplay:true,
});
const VICTORY_CELEBRATION_MS=5200;
const AUTO_NEXT_MS=5000;

let sharedPreferences;
function defaultStorage(){
try{
return globalThis.localStorage;
}catch{
return null;
}
}
function continuousPlayPreferences({
storage=defaultStorage(),
window:target=globalThis.window,
}={}){
const shared=storage===defaultStorage();
if(sharedPreferences&&shared)return sharedPreferences;
let value={...CONTINUOUS_PLAY_DEFAULTS};
const listeners=new Set();
const read=()=>{
try{
const saved=JSON.parse(storage?.getItem(CONTINUOUS_PLAY_KEY)??'{}');
for(const key of Object.keys(value))
if(typeof saved?.[key]==='boolean')value[key]=saved[key];
}catch{
/* In-memory preferences remain usable when storage is unavailable. */
}
};
read();
const notify=()=>{
for(const listener of listeners)listener({...value});
};
const changed=(event)=>{
if(event.key===CONTINUOUS_PLAY_KEY){
read();
notify();
}
};
target?.addEventListener?.('storage',changed);
const preferences={
snapshot:()=>({...value}),
set(key,enabled){
if(!(key in CONTINUOUS_PLAY_DEFAULTS))
throw new TypeError('Unknown continuous-play preference.');
value[key]= !!enabled;
try{
storage?.setItem(CONTINUOUS_PLAY_KEY,JSON.stringify(value));
}catch{
/* Session choice remains active. */
}
notify();
},
subscribe(listener){
listeners.add(listener);
return()=>listeners.delete(listener);
},
dispose(){
target?.removeEventListener?.('storage',changed);
listeners.clear();
},
};
if(shared)sharedPreferences=preferences;
return preferences;
}

/** Presentation clock only. Hosts retain simulation, persistence and loading ownership.
     * Identity is checked again immediately before dispatch, and inactive owners cancel
     * instead of silently restarting a countdown when focus returns. */
function createContinuousPlayController({
onNext=()=>{},
onRetry=()=>{},
onChange=()=>{},
isCurrent=()=>true,
isActive=()=>true,
preferences=continuousPlayPreferences(),
}={}){
let state={phase:'idle',identity:null,remainingMs:0},
alive=true,
epoch=0;
const listeners=new Set();
const snapshot=()=>({...state});
const publish=()=>{
onChange(snapshot());
for(const fn of listeners)fn(snapshot());
};
const current=()=>alive&&isCurrent(state.identity);
function cancel(reason='interaction'){
epoch++;
if(state.phase==='idle'||state.phase==='cancelled')return;
state={...state,phase:'cancelled',remainingMs:0,reason};
publish();
}
function dispatch(action){
if(!current())return cancel('superseded');
const identity=state.identity;
const dispatchEpoch= ++epoch;
state={...state,phase:'idle',remainingMs:0};
publish();
if(dispatchEpoch!==epoch|| !current())return;
(action==='next'?onNext:onRetry)(identity);
}
function phase(name,duration){
state={...state,phase:name,remainingMs:duration};
publish();
}
function afterLoss(){
if(state.canRetry&&preferences.snapshot().autoRetry)phase('ready',state.readyMs);
else phase('cancelled',0);
}
function proceed(){
if(state.phase==='celebration'){
if(state.canAdvance&&preferences.snapshot().autoNext)phase('countdown',AUTO_NEXT_MS);
else phase('cancelled',0);
}else if(state.phase==='countdown')dispatch('next');
else if(state.phase==='loss-effect'){
if(preferences.snapshot().autoReplay&&state.replayMs>0)
phase('replay',state.replayMs);
else afterLoss();
}else if(state.phase==='replay')afterLoss();
else if(state.phase==='ready')dispatch('retry');
}
const stopPreferences=preferences.subscribe?.(()=>{
const selected=preferences.snapshot();
if(
(state.phase==='countdown'&& !selected.autoNext)||
(state.phase==='ready'&& !selected.autoRetry)
)
cancel('preference');
});
return{
begin({
identity,
outcome,
canAdvance=false,
canRetry=true,
lossEffectMs=650,
replayMs=1920,
readyMs=600,
}){
if(!alive)return;
epoch++;
state={
identity,
outcome,
canAdvance,
canRetry,
replayMs,
readyMs,
phase:outcome==='won'?'celebration':'loss-effect',
remainingMs:outcome==='won'?VICTORY_CELEBRATION_MS:lossEffectMs,
};
publish();
},
advance(deltaMs){
if(!alive||['idle','cancelled'].includes(state.phase))return;
if(!current())return cancel('superseded');
if(!isActive())return cancel('inactive');
if(!Number.isFinite(deltaMs)||deltaMs<0)return;
const ticket=epoch;
let available=Math.min(deltaMs,250);
while(
available>=0&&
ticket===epoch&&
!['idle','cancelled'].includes(state.phase)
){
const spent=Math.min(available,state.remainingMs);
state={...state,remainingMs:state.remainingMs-spent};
available-=spent;
if(state.remainingMs>0){
publish();
break;
}
proceed();
if(available===0)break;
}
},
cancel,
activate(action){
if(!['next','retry'].includes(action))
throw new TypeError('Unknown continuation action.');
dispatch(action);
},
snapshot,
subscribe(fn){
listeners.add(fn);
fn(snapshot());
return()=>listeners.delete(fn);
},
dispose(){
cancel('disposed');
alive=false;
stopPreferences?.();
listeners.clear();
},
};
}

const FLOW_COPY={
en:{
countdown:'Next level in {seconds}s',
celebrating:'Mission complete!',
replay:'Final 8 moves',
ready:'Ready…',
cancel:'Stay here',
autoNext:'Play next level automatically',
autoRetry:'Retry automatically after defeat',
autoReplay:'Show failure replay automatically',
},
uk:{
countdown:'Наступний рівень за {seconds} с',
celebrating:'Місію завершено!',
replay:'Останні 8 ходів',
ready:'Приготуйтесь…',
cancel:'Залишитися тут',
autoNext:'Починати наступний рівень автоматично',
autoRetry:'Автоматично повторювати після поразки',
autoReplay:'Автоматично показувати повтор поразки',
},
};
function continuousPlayBindings(preferences=continuousPlayPreferences()){
return Object.fromEntries(
Object.keys(CONTINUOUS_PLAY_DEFAULTS).map((key)=>[
key,
{
get:()=>preferences.snapshot()[key],
set:(value)=>preferences.set(key,value),
subscribe:(fn)=>preferences.subscribe(fn),
},
]),
);
}
function mountContinuousPlayControls({
document:doc=globalThis.document,
parent,
primaryAction=null,
controller,
locale='en',
preferences=continuousPlayPreferences(),
}={}){
if(!doc.getElementById('continuous-play-style')){
const style=doc.createElement('style');
style.id='continuous-play-style';
style.textContent=`
.continuous-play-controls {display:flex;align-items:center;flex-wrap:wrap;gap:.35rem .65rem;min-width:0;max-width:100%;margin:0;font-size:.85rem;}
.continuous-play-controls[hidden] {display:none!important;}
.continuous-play-controls p {margin:0;overflow-wrap:anywhere;}
.continuous-play-controls .button {min-height:44px;padding:.35rem .65rem;font-size:inherit;}
.continuous-result-actions {position:sticky;bottom:0;z-index:3;display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;min-width:0;padding-block:.55rem;background:var(--fk-surface,#24292b);}
.continuous-result-actions[hidden] {display:none!important;}
.continuous-result-actions > * {min-width:0;max-width:100%;}
@media(max-width:600px),(max-height:500px) {.continuous-result-actions {scroll-margin-block:1rem;} .continuous-result-actions > .continuous-play-controls {flex:1 1 100%;} .continuous-result-actions > button {min-height:44px;flex:1 1 8rem;}}
`;
(doc.head||doc.body).append(style);
}
const root=doc.createElement('div'),
status=doc.createElement('p'),
cancel=doc.createElement('button');
root.className='continuous-play-controls';
root.dataset.continuousPlay='';
status.setAttribute('role','status');
status.setAttribute('aria-live','polite');
cancel.type='button';
cancel.className='button secondary';
cancel.addEventListener('click',()=>controller.cancel('player'));
root.append(status,cancel);
const action=typeof primaryAction==='function'?primaryAction():primaryAction;
if(action?.parentElement===parent)action.after(root);
else parent.append(root);
let language=locale;
const render=(state)=>{
const copy=
FLOW_COPY[
(typeof language==='function'?language():language)==='uk'?'uk':'en'
];
const value=
state.phase==='countdown'
?copy.countdown.replace('{seconds}',Math.ceil(state.remainingMs/1000))
:state.phase==='celebration'
?copy.celebrating
:state.phase==='replay'
?copy.replay
:state.phase==='ready'
?copy.ready
:'';
if(status.textContent!==value)status.textContent=value;
cancel.textContent=copy.cancel;
root.hidden= !value;
cancel.hidden=state.phase!=='countdown'&&state.phase!=='celebration';
};
const stop=controller.subscribe(render);
const interaction=(event)=>{
if(event.target===cancel||root.contains(event.target))return;
if(
event.type==='keydown'&&
!['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape'].includes(event.key)
)
return;
controller.cancel('interaction');
};
parent.addEventListener('keydown',interaction);
parent.addEventListener('pointerdown',interaction);
return{
root,
status,
cancel,
preferences,
setLocale(value){
language=value;
render(controller.snapshot());
},
dispose(){
stop();
parent.removeEventListener('keydown',interaction);
parent.removeEventListener('pointerdown',interaction);
root.remove();
},
};
}

return{
CONTINUOUS_PLAY_KEY,
CONTINUOUS_PLAY_DEFAULTS,
VICTORY_CELEBRATION_MS,
AUTO_NEXT_MS,
continuousPlayPreferences,
createContinuousPlayController,
continuousPlayBindings,
mountContinuousPlayControls,
};
})();
modules['game/text-face.mjs']=(()=>{
const TEXT_FACES=Object.freeze(['pixel','plain']);
const DEFAULT_TEXT_FACE='pixel';

// `pixel` is the historical preference value; the current label is Theme font.
// Theme defaults can evolve without reinterpreting old saves or loading fonts
// from a player preference. Plain also covers canvas feedback and counters.
const PLAIN_CANVAS_FONTS=Object.freeze({
ui:'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
numeric:'ui-monospace, "SFMono-Regular", Consolas, monospace',
});
const PIXEL_CANVAS_UI="'Reveal Line Pixel', 'Field Kit UI', system-ui, sans-serif";

function resolveTextFace(value){
if(!TEXT_FACES.includes(value))throw new TypeError('Unsupported text style.');
return value;
}

function canvasTextFonts(face,themeFonts,{useThemeFont=false}={}){
if(resolveTextFace(face)==='plain')return PLAIN_CANVAS_FONTS;
return Object.freeze({
...themeFonts,
ui:useThemeFont&&themeFonts?.ui?themeFonts.ui:PIXEL_CANVAS_UI,
numeric:themeFonts?.numeric??"'Field Kit Mono', ui-monospace, monospace",
});
}

return{TEXT_FACES,DEFAULT_TEXT_FACE,resolveTextFace,canvasTextFonts};
})();
modules['game/text-size.mjs']=(()=>{
const TEXT_SIZES=Object.freeze(['standard','large']);
const DEFAULT_TEXT_SIZE='standard';

function resolveTextSize(value){
if(!TEXT_SIZES.includes(value))throw new TypeError('Unsupported text size.');
return value;
}

return{TEXT_SIZES,DEFAULT_TEXT_SIZE,resolveTextSize};
})();
modules['game/display-preferences.mjs']=(()=>{
const DEFAULT_TEXT_FACE=modules['game/text-face.mjs']['DEFAULT_TEXT_FACE'];
const resolveTextFace=modules['game/text-face.mjs']['resolveTextFace'];
const DEFAULT_TEXT_SIZE=modules['game/text-size.mjs']['DEFAULT_TEXT_SIZE'];
const resolveTextSize=modules['game/text-size.mjs']['resolveTextSize'];

const DISPLAY_PREFERENCES_KEY='revealline.display.v1';
const fields=['textFace','textSize','reducedEffects'];
const defaults=Object.freeze({
textFace:DEFAULT_TEXT_FACE,
textSize:DEFAULT_TEXT_SIZE,
reducedEffects:false,
});
const motionQuery='(prefers-reduced-motion: reduce)';

function object(value){
if(
!value||
typeof value!=='object'||
![Object.prototype,null].includes(Object.getPrototypeOf(value))
)
throw new TypeError('Display preferences must be plain data.');
return value;
}
function field(value,key){
const descriptor=Object.getOwnPropertyDescriptor(value,key);
if(!descriptor?.enumerable|| !Object.hasOwn(descriptor,'value'))
throw new TypeError('Display preferences must contain ordinary fields.');
if(key==='textFace')return resolveTextFace(descriptor.value);
if(key==='textSize')return resolveTextSize(descriptor.value);
if(typeof descriptor.value!=='boolean')
throw new TypeError('Reduced effects must be a boolean.');
return descriptor.value;
}
function patch(value,complete=false){
const keys=Reflect.ownKeys(object(value));
if(!keys.length||keys.some((key)=> !fields.includes(key)))
throw new TypeError('Unsupported display preference fields.');
if(complete&&keys.length!==fields.length)
throw new TypeError('The shared display record must contain all three fields.');
return Object.fromEntries(keys.map((key)=>[key,field(value,key)]));
}
function legacy(value={}){
object(value);
return Object.fromEntries(
fields.map((key)=>[key,Object.hasOwn(value,key)?field(value,key):defaults[key]]),
);
}
function decode(raw){
if(typeof raw!=='string'||raw.length>256)return null;
try{
return patch(JSON.parse(raw),true);
}catch{
return null;
}
}

/** Page-owned display policy. Only explicit set() writes the separate shared
     * record; legacy profile data and system motion preferences are never saved. */
function createDisplayPreferences({
window:eventTarget=globalThis,
getStorage=()=>globalThis.localStorage,
matchMedia=(query)=>eventTarget?.matchMedia?.(query),
legacyPreferences,
writable=()=>true,
onWarning=()=>{},
}={}){
let disposed=false,
explicit=false,
stored=false,
unsaved=false,
warning='',
warningKey='',
systemReduced=false;
const listeners=new Set();
let media;
try{
media=matchMedia(motionQuery);
systemReduced=media?.matches===true;
}catch{
// A host without this browser capability still has its explicit preference.
}
const read=()=>{
try{
const storage=getStorage(),
raw=storage?.getItem(DISPLAY_PREFERENCES_KEY);
return{storage,raw,value:decode(raw)};
}catch{
return{storage:null,raw:null,value:null};
}
};
const first=read();
stored= !!first.value;
const initial=first.value??legacy(legacyPreferences);
let state=Object.freeze({
...initial,
effectiveReducedEffects:initial.reducedEffects||systemReduced,
revision:0,
});
const raw=()=>Object.fromEntries(fields.map((key)=>[key,state[key]]));
const notify=()=>{
const errors=[];
for(const listener of[...listeners]){
if(!listeners.has(listener))continue;
try{
// A preceding listener's newer action must win during reentrant updates.
listener(state);
}catch(error){
errors.push(error);
}
}
if(errors.length)
throw new AggregateError(errors,'Display preferences could not be applied.');
return state;
};
const apply=(values)=>{
state=Object.freeze({
...values,
effectiveReducedEffects:values.reducedEffects||systemReduced,
revision:state.revision+1,
});
return notify();
};
const notice=(message,key='')=>{
warning=message;
warningKey=key;
try{
onWarning(message,key);
}catch{
// A notice cannot prevent the already accepted display change.
}
};
const persist=()=>{
try{
if(!writable()){
unsaved=true;
notice(
'Display changes apply only to this session; saving is disabled here.',
'common:preferences.displaySessionOnly',
);
return;
}
const storage=getStorage();
if(!storage)throw new Error('Storage unavailable.');
storage.setItem(DISPLAY_PREFERENCES_KEY,JSON.stringify(raw()));
stored=true;
unsaved=false;
notice('');
}catch{
unsaved=true;
notice(
'Display changed for this session, but could not be saved for another page.',
'common:preferences.displaySaveFailed',
);
}
};
const receive=(event)=>{
if(disposed||unsaved||event.key!==DISPLAY_PREFERENCES_KEY)return;
const current=read();
if(
!current.storage||
event.storageArea!==current.storage||
event.newValue!==current.raw||
!current.value
)
return;
stored=true;
if(fields.every((key)=>state[key]===current.value[key]))return;
apply(current.value);
};
const motionChanged=()=>{
if(disposed)return;
systemReduced=media?.matches===true;
const effectiveReducedEffects=state.reducedEffects||systemReduced;
if(state.effectiveReducedEffects===effectiveReducedEffects)return;
// System changes are not player intent and cannot stale a pending profile seed.
state=Object.freeze({...state,effectiveReducedEffects});
notify();
};
// A frozen page can miss storage/media events. Read current authority when
// restored, without replacing explicit intent that could not be persisted.
const restored=(event)=>{
if(disposed||event.persisted!==true)return;
systemReduced=media?.matches===true;
if(!unsaved){
const current=read();
if(current.value){
stored=true;
if(fields.some((key)=>state[key]!==current.value[key])){
apply(current.value);
return;
}
}
}
const effectiveReducedEffects=state.reducedEffects||systemReduced;
if(state.effectiveReducedEffects!==effectiveReducedEffects){
state=Object.freeze({...state,effectiveReducedEffects});
notify();
}
};
eventTarget?.addEventListener?.('pageshow',restored);
eventTarget?.addEventListener?.('storage',receive);
if(media?.addEventListener)media.addEventListener('change',motionChanged);
else media?.addListener?.(motionChanged);
return Object.freeze({
snapshot:()=>state,
subscribe(listener){
if(disposed)throw new Error('Display preferences are disposed.');
if(typeof listener!=='function')throw new TypeError('Display listener required.');
if(listeners.has(listener))throw new Error('Display listener already subscribed.');
listeners.add(listener);
try{
listener(state);
}catch(error){
listeners.delete(listener);
throw error;
}
return()=>listeners.delete(listener);
},
set(value){
if(disposed)throw new Error('Display preferences are disposed.');
const next={...raw(),...patch(value)};
explicit=true;
try{
apply(next);
}finally{
if(!disposed)persist();
}
return state;
},
adoptLegacy(value,{expectedRevision=0}={}){
if(disposed||stored||explicit||state.revision!==expectedRevision)return false;
const current=read();
if(current.value){
stored=true;
apply(current.value);
return false;
}
apply(legacy(value));
return!explicit&& !stored&& !disposed&&state.revision===expectedRevision+1;
},
getWarning:()=>warning,
getWarningKey:()=>warningKey,
dispose(){
if(disposed)return;
disposed=true;
eventTarget?.removeEventListener?.('storage',receive);
eventTarget?.removeEventListener?.('pageshow',restored);
if(media?.removeEventListener)media.removeEventListener('change',motionChanged);
else media?.removeListener?.(motionChanged);
listeners.clear();
},
});
}

return{DISPLAY_PREFERENCES_KEY,createDisplayPreferences};
})();
modules['game/ui/menu-animation-preferences.mjs']=(()=>{
// Shared menu motion intent. Reading never writes browser preferences.
const MENU_ANIMATION_KEY='revealline.menu-animation.v1';
const MENU_ANIMATION_EVENT='revealline-menu-animation';
const memoryPreferences=new WeakMap();
function getMenuAnimation(win=globalThis.window){
try{
return win.localStorage.getItem(MENU_ANIMATION_KEY)!=='off';
}catch{
return memoryPreferences.get(win)??true;
}
}

function setMenuAnimation(enabled,win=globalThis.window){
try{
win.localStorage.setItem(MENU_ANIMATION_KEY,enabled?'on':'off');
}catch{
memoryPreferences.set(win,Boolean(enabled));
}
win.dispatchEvent(
new win.CustomEvent(MENU_ANIMATION_EVENT,{detail:{enabled:Boolean(enabled)}}),
);
}
/** Observe the same explicit preference across menu surfaces and browser tabs. */
function subscribeMenuAnimation(listener,win=globalThis.window){
const refresh=(event)=>{
if(event?.type==='storage'&&event.key!==MENU_ANIMATION_KEY&&event.key!==null)
return;
listener(getMenuAnimation(win));
};
win?.addEventListener?.(MENU_ANIMATION_EVENT,refresh);
win?.addEventListener?.('storage',refresh);
win?.addEventListener?.('pageshow',refresh);
refresh();
return()=>{
win?.removeEventListener?.(MENU_ANIMATION_EVENT,refresh);
win?.removeEventListener?.('storage',refresh);
win?.removeEventListener?.('pageshow',refresh);
};
}

return{
MENU_ANIMATION_KEY,
MENU_ANIMATION_EVENT,
getMenuAnimation,
setMenuAnimation,
subscribeMenuAnimation,
};
})();
modules['game/ui/theme-material-preview.mjs']=(()=>{
const localizedText=simGlobalI18n['localizedText'];
const t=simGlobalI18n['t'];
const applyResolvedPresentation=simGlobalThemes['applyResolvedPresentation'];

/** The same material specimen serves the chooser and Theme Studio. Chooser
     * samples are inert phrasing content inside one real selection button. Studio
     * uses native controls, without writing any gameplay or appearance preference. */
function mountThemeMaterialPreview({
document:doc,
root,
resolved,
interactive=true,
compact=false,
}){
const tag=interactive?'div':'span';
const node=(tagName,key,className='')=>{
const item=doc.createElement(tagName);
item.className=className;
if(key)localizedText(item,()=>t(`interface:workshop.materialPreview.${key}`));
return item;
};
root.classList.add('theme-material-preview');
root.dataset.previewCompact=String(compact);
if(!interactive){
root.setAttribute('aria-hidden','true');
root.setAttribute('inert','');
}
const panel=node(tag,null,'theme-material-panel');
panel.dataset.uiSurface='panel';
const actions=node(tag,null,'theme-material-actions');
const states=node(tag,null,'theme-material-states');
const action=(key,state,primary=false)=>{
const item=node(interactive?'button':'span',key,'button theme-material-action');
if(interactive)item.type='button';
item.dataset.materialPreviewControl=key;
if(primary)item.dataset.uiAction='primary';
if(state==='disabled'){
if(interactive)item.disabled=true;
else item.setAttribute('aria-disabled','true');
}else if(state==='loading')item.setAttribute('aria-busy','true');
else if(state)item.dataset.state=state;
return item;
};
actions.append(action('mission'),action('launch',null,true));
for(const state of compact
?['hover','pressed','focus']
:['hover','pressed','focus','loading','disabled'])
states.append(action(state,state));
const field=node(interactive?'label':'span',null,'theme-material-field');
field.append(node('span','detail'));
if(interactive){
const select=node('select');
select.dataset.materialPreviewControl='select';
for(const key of['balanced','detailed']){
const option=node('option',key);
option.value=key;
select.append(option);
}
field.append(select);
}else{
const select=node('span','balanced','theme-material-select');
select.dataset.materialPreviewControl='select';
field.append(select);
}
const check=node(interactive?'label':'span',null,'theme-material-check');
const checkbox=node(interactive?'input':'span',null,'theme-material-checkbox');
if(interactive){
checkbox.type='checkbox';
checkbox.setAttribute('type','checkbox');
checkbox.checked=true;
}else checkbox.textContent='✓';
checkbox.dataset.materialPreviewControl='checkbox';
check.append(checkbox,node('span','telemetry'));
panel.append(actions,states,field,check);
root.append(panel);
let release=null,
identity=null;
const update=(next)=>{
if(!next||identity===next.identity)return;
release?.();
identity=next.identity;
release=applyResolvedPresentation(root,next);
};
update(resolved);
return{
update,
dispose(){
release?.();
release=null;
panel.remove();
},
};
}

return{mountThemeMaterialPreview};
})();
modules['game/ui/art-review-navigation.mjs']=(()=>{
/** Explicit, session-only art review pin; never changes a saved appearance or a
     * gameplay recipe. Unrecognized revisions use the released artwork. */
function actorArtReviewRevision(location=globalThis.location){
try{
const params=new URL(location.href).searchParams;
return params.getAll('artReview').length===1&&
['industrial-pilot-v1','industrial-overhead-v2','industrial-roster-v3'].includes(
params.get('artReview'),
)
?params.get('artReview')
:null;
}catch{
return null;
}
}

// These are routes owned by this build, not a general-purpose URL allowlist.
// Do not transfer preview choices to community/provider links or another edition.
const ART_REVIEW_NATIVE_PAGE=
/^(.*\/)(?:game\/(?:(?:index|company)\.html|couch\/(?:index\.html|relay-rescue\.html)?|snake\/(?:(?:index|play)\.html)?|overflight\/(?:play|raid)\.html|studio\/(?:(?:index|snake|overflight|raid)\.html)?|(?:hunt\/military-levels\.html|(?:playground|hunt|online|replay-theater|controller-lab)\/(?:index\.html)?))?|authoring\/(?:asset-studio|motion-lab|enemy-catalog|still-media|video-poster|design-atlas|industrial-art-review)\/(?:index\.html)?|optional-practice\/(?:civilian-fpv|fpv-worlds)\/(?:index\.html)?)$/;

/** Inherit an explicit review-only art pin along a caller-owned native link.
     * Does not validate arbitrary navigation, persist preferences, transfer content,
     * or change an explicit destination choice. Missing/ambiguous pins stay absent.
     */
function nativeArtReviewURL(href,sourceHref){
let source,target;
try{
source=new URL(sourceHref);
target=new URL(href,source);
}catch{
return href;
}
const revision=actorArtReviewRevision(source),
sourceRoot=ART_REVIEW_NATIVE_PAGE.exec(source.pathname)?.[1],
targetRoot=ART_REVIEW_NATIVE_PAGE.exec(target.pathname)?.[1];
if(
revision&&
['http:','https:','file:','capacitor:'].includes(source.protocol)&&
source.protocol===target.protocol&&
source.origin===target.origin&&
source.host===target.host&&
!source.username&&
!source.password&&
!target.username&&
!target.password&&
sourceRoot&&
sourceRoot===targetRoot&&
!target.searchParams.has('artReview')
){
target.searchParams.set('artReview',revision);
return target.href;
}
return href;
}

return{actorArtReviewRevision,nativeArtReviewURL};
})();
modules['game/ui/enemy-appearance-controls.mjs']=(()=>{
const sharedEnemyArtwork=simGlobalActorPreferences['sharedEnemyArtwork'];
const sharedActorAppearance=simGlobalActorPreferences['sharedActorAppearance'];
const ACTOR_CASTS=modules['game/hunt/actor-catalog.mjs']['ACTOR_CASTS'];
const actorArtReviewRevision=
modules['game/ui/art-review-navigation.mjs']['actorArtReviewRevision'];
const nativeArtReviewURL=modules['game/ui/art-review-navigation.mjs']['nativeArtReviewURL'];

const COPY={
en:{
label:'Enemy appearance preset',
authored:'Original level artwork',
military:'Military Field · soldiers and vehicles',
uniform:'Soldier uniform',
castAuthored:'As designed',
about:'What changes?',
help:'Military Field applies the matching game appearance and detailed military artwork. Choose a uniform under Character appearance. It uses the level’s existing enemies; Running enemies adds optional humanoids. Snake targets stay humanoid.',
next:'Applies on Start or Restart. Creator-owned custom artwork is retained.',
preview:'Preview artwork is active. Choosing a preset ends this preview.',
saving:'This choice applies here, but could not be saved for another page.',
failure:'The appearance could not be prepared. Select it again to retry.',
},
uk:{
label:'Набір оформлення ворогів',
authored:'Початкове оформлення рівня',
military:'Військове поле · солдати й техніка',
uniform:'Форма солдатів',
castAuthored:'За задумом',
about:'Що змінюється?',
help:'Військове поле застосовує відповідне оформлення гри та детальні військові образи. Форму можна вибрати в розділі «Вигляд персонажів». Використовуються наявні вороги рівня; «Рухливі вороги» додають необов’язкових гуманоїдів. Цілі Snake залишаються гуманоїдами.',
next:'Діє після початку або перезапуску. Власні авторські зображення зберігаються.',
preview:'Активний попередній перегляд зображень. Вибір набору завершує цей перегляд.',
saving:'Вибір діє тут, але його не вдалося зберегти для іншої сторінки.',
failure:'Не вдалося підготувати оформлення. Виберіть його знову, щоб повторити.',
},
};
let sequence=0;

function clearExplicitReviewPin(location,history){
if(!actorArtReviewRevision(location))return;
const source=new URL(location.href),
target=new URL(source);
target.searchParams.delete('artReview');
// Use the same fixed native-route contract as review-link propagation. An
// unrelated URL, unsupported protocol or ambiguous pin is never rewritten.
if(nativeArtReviewURL(target.href,source.href)===target.href)return;
if(typeof history?.replaceState!=='function')
throw new Error('The current review appearance cannot be replaced.');
history.replaceState(history.state,'',target.href);
}

/** Shared explicit preset, not a gameplay/population switch. Each native host
     * retains ownership of the current attempt and its next preparation boundary. */
function mountEnemyAppearanceControls({
document:doc=globalThis.document,
location=doc.defaultView?.location??globalThis.location,
history=doc.defaultView?.history??globalThis.history,
container,
preferences=sharedEnemyArtwork(),
locale=()=>doc.documentElement?.lang??'en',
includeUniform=false,
applyMilitary,
applyAuthored,
}={}){
if(!container||typeof applyMilitary!=='function'||typeof applyAuthored!=='function')
throw new TypeError('Enemy appearance controls require native appearance actions.');
const root=doc.createElement('div'),
label=doc.createElement('label'),
title=doc.createElement('span'),
select=doc.createElement('select'),
details=doc.createElement('details'),
summary=doc.createElement('summary'),
help=doc.createElement('p'),
status=doc.createElement('p');
root.className='enemy-appearance-controls';
root.dataset.enemyAppearanceControls='true';
label.className='settings-row';
select.id=`enemy-appearance-${++sequence}`;
select.name='enemy-appearance';
select.dataset.enemyAppearance='true';
help.id=`${select.id}-help`;
help.className=status.className='micro-note';
status.setAttribute('role','status');
select.setAttribute('aria-describedby',help.id);
for(const value of['authored','military']){
const option=doc.createElement('option');
option.value=value;
select.append(option);
}
label.append(title,select);
details.append(summary,help);
root.append(label,status,details);
const cast=includeUniform?sharedActorAppearance():null;
let uniform;
if(cast){
const uniformLabel=doc.createElement('label');
uniform={title:doc.createElement('span'),select:doc.createElement('select')};
uniformLabel.className='settings-row';
uniform.select.name='soldier-uniform';
for(const value of['authored',...ACTOR_CASTS.map((entry)=>entry.id)]){
const option=doc.createElement('option');
option.value=value;
uniform.select.append(option);
}
uniformLabel.append(uniform.title,uniform.select);
root.insertBefore(uniformLabel,status);
}
container.append(root);
let disposed=false,
failed=false,
generation=0;
function refresh(){
if(disposed)return;
const words=COPY[locale()]??COPY.en,
state=preferences.snapshot(),
reviewing=actorArtReviewRevision(location)!==null;
title.textContent=words.label;
for(const option of select.options)option.textContent=words[option.value];
select.value=reviewing?'military':state.style;
help.textContent=words.help;
summary.textContent=words.about;
if(uniform){
uniform.title.textContent=words.uniform;
uniform.select.value=cast.snapshot().cast;
for(const option of uniform.select.options)
option.textContent=
ACTOR_CASTS.find((entry)=>entry.id===option.value)?.name[
locale()==='uk'?'uk':'en'
]??words.castAuthored;
}
status.textContent=failed
?words.failure
:reviewing
?words.preview
:state.durable===false
?words.saving
:words.next;
}
const change=async()=>{
const ticket= ++generation,
style=select.value;
if(!['authored','military'].includes(style))return;
failed=false;
try{
// An explicit preset supersedes only this page's supported cosmetic review
// pin. Do this before notifying preferences so native subscribers observe
// the new intent; visiting settings or receiving another tab's choice
// must preserve the current review link.
clearExplicitReviewPin(location,history);
preferences.set({style});
await(style==='military'?applyMilitary():applyAuthored());
}catch{
if(!disposed&&generation===ticket)failed=true;
}
if(!disposed&&generation===ticket)refresh();
};
select.addEventListener('change',change);
const changeUniform=()=>cast.set({cast:uniform.select.value});
uniform?.select.addEventListener('change',changeUniform);
const unsubscribe=preferences.subscribe(refresh);
const unsubscribeCast=cast?.subscribe(refresh);
return Object.freeze({
element:root,
refresh,
dispose(){
if(disposed)return;
disposed=true;
generation++;
unsubscribe();
unsubscribeCast?.();
select.removeEventListener('change',change);
uniform?.select.removeEventListener('change',changeUniform);
root.remove();
},
});
}

return{clearExplicitReviewPin,mountEnemyAppearanceControls};
})();
modules['game/ui/theme-family-controls.mjs']=(()=>{
const t=simGlobalI18n['t'];
const localizedText=simGlobalI18n['localizedText'];
const localizedAttribute=simGlobalI18n['localizedAttribute'];
const getLocale=simGlobalI18n['getLocale'];
const onLocaleChange=simGlobalI18n['onLocaleChange'];
const BUILTIN_THEME_FAMILIES=simGlobalThemes['BUILTIN_THEME_FAMILIES'];
const resolvePresentation=simGlobalThemes['resolvePresentation'];
const mountThemeMaterialPreview=
modules['game/ui/theme-material-preview.mjs']['mountThemeMaterialPreview'];
const mountEnemyAppearanceControls=
modules['game/ui/enemy-appearance-controls.mjs']['mountEnemyAppearanceControls'];

/** One immediate appearance choice; the host owns atomic loads and flight boundaries. */
function attachThemeFamilyControls({
document:doc,
root,
host,
prefix='',
legacyPalette,
legacyOrnaments,
}){
if(!root|| !host)return{dispose(){}};
const group=doc.createElement('section');
group.className='theme-family-controls';
group.setAttribute('data-theme-controls','');
const release=[],
controls=new Map(),
cards=new Map(),
hiddenRows=[];
const text=(node,key)=>localizedText(node,()=>t(`interface:workshop.${key}`));
const heading=doc.createElement('h3');
text(heading,'appearance');
group.append(heading);
const enemyAppearance=mountEnemyAppearanceControls({
document:doc,
container:group,
locale:getLocale,
applyMilitary:()=>host.applyComplete('military-field'),
applyAuthored:()=>host.set({arcadeArt:'authored'}),
});
release.push(enemyAppearance.dispose,onLocaleChange(enemyAppearance.refresh));
const row=(key,parent=group)=>{
const label=doc.createElement('label'),
title=doc.createElement('span');
text(title,key);
label.append(title);
parent.append(label);
return label;
};
const select=(key,entries,parent=group)=>{
const label=row(key,parent),
title=label.querySelector('span'),
input=doc.createElement('select');
title.id=`${prefix}theme-${key}-label`;
input.id=`${prefix}theme-${key}`;
input.setAttribute('aria-labelledby',title.id);
input.setAttribute('data-theme-preference',key);
for(const[value,labelKey]of entries){
const option=doc.createElement('option');
option.value=value;
text(option,labelKey);
input.append(option);
}
label.append(input);
controls.set(key,input);
return input;
};
const themeHeading=doc.createElement('h4');
themeHeading.id=`${prefix}theme-family-heading`;
text(themeHeading,'familyId');
group.append(themeHeading);
const gallery=doc.createElement('div');
gallery.className='theme-gallery';
gallery.setAttribute('role','group');
gallery.setAttribute('aria-labelledby',themeHeading.id);
localizedAttribute(gallery,'aria-description',()=>t('interface:workshop.previewThemes'));
group.append(gallery);
const builtinIds=new Set(BUILTIN_THEME_FAMILIES.map((item)=>item.id));
const choose=(id)=>host.applyComplete(id);
const syncChoices=(state)=>{
const choices=host.availableThemeChoices();
const known=new Set(choices.map((item)=>item.id));
for(const[id,card]of cards){
if(known.has(id))continue;
card.stop();
card.button.remove();
cards.delete(id);
}
for(const[index,item]of choices.entries()){
let card=cards.get(item.id);
if(!card){
const button=doc.createElement('button'),
title=doc.createElement('strong'),
swatches=doc.createElement('span'),
preview=doc.createElement('span'),
description=doc.createElement('small');
button.type='button';
button.id=`${prefix}theme-card-${item.id}`;
button.className='theme-preview-card';
button.setAttribute('data-theme-preview',item.id);
swatches.className='theme-preview-swatches';
swatches.setAttribute('aria-hidden','true');
preview.setAttribute('data-theme-card-preview','');
button.append(title,preview,swatches,description);
const material=mountThemeMaterialPreview({
document:doc,
root:preview,
interactive:false,
compact:true,
});
const activate=()=>choose(item.id);
button.addEventListener('click',activate);
card={
button,
title,
swatches,
description,
material,
stop:()=>{
button.removeEventListener('click',activate);
material.dispose();
},
};
cards.set(item.id,card);
}
// Stable nodes preserve keyboard/controller focus through loading, status
// updates and accessibility changes; only changed inventories move nodes.
if(gallery.children[index]!==card.button)
gallery.insertBefore(card.button,gallery.children[index]??null);
const label=()=>
item.id==='follow-game'
?t('interface:workshop.followContext')
:builtinIds.has(item.id)
?t(`interface:workshop.theme.${item.id}`)
:`${item.family.name} · ${item.family.revision}`;
localizedText(card.title,label);
localizedText(card.description,()=>
builtinIds.has(item.id)||item.id==='follow-game'
?t(`interface:workshop.description.${item.id}`)
:t('interface:workshop.description.curated',{revision:item.family.revision}),
);
card.material.update(
resolvePresentation({
themeFamily:item.family,
interfaceTheme:item.interfaceTheme,
interfaceBasis:item.basis,
accessibility:{
...host.snapshot()?.accessibility,
highContrast:state.highContrast,
opaqueHud:state.opaqueHud,
},
ornaments:state.ornaments==='theme'?'subtle':state.ornaments,
}),
);
const tokens=item.interfaceTheme?.tokens??{},
colors=['ink','panel','text','accent'].map((role)=>tokens[role]);
if(card.colors!==JSON.stringify(colors)){
card.colors=JSON.stringify(colors);
card.swatches.replaceChildren();
for(const color of colors){
const chip=doc.createElement('span');
chip.style.setProperty('background-color',color??'currentColor');
card.swatches.append(chip);
}
}
}
};
const customization=doc.createElement('details'),
summary=doc.createElement('summary');
summary.id=`${prefix}theme-customize`;
text(summary,'customize');
customization.append(summary);
group.append(customization);
for(const[key,entries]of[
[
'arcadeArt',
[
['follow-game','followGame'],
['authored','authored'],
],
],
[
'ornaments',
[
['theme','themeDetail'],
['off','detailOff'],
['subtle','detailSubtle'],
['rich','detailRich'],
],
],
]){
const input=select(key,entries,customization),
change=()=>host.set({[key]:input.value});
input.addEventListener('change',change);
release.push(()=>input.removeEventListener('change',change));
}
const accessibility=doc.createElement('div');
accessibility.className='theme-accessibility';
group.append(accessibility);
for(const key of['highContrast','opaqueHud']){
const label=row(key,accessibility),
input=doc.createElement('input');
input.type='checkbox';
input.id=`${prefix}theme-${key}`;
input.setAttribute('data-theme-preference',key);
label.prepend(input);
controls.set(key,input);
const change=()=>host.set({[key]:input.checked});
input.addEventListener('change',change);
release.push(()=>input.removeEventListener('change',change));
}
const hint=doc.createElement('p');
hint.className='micro-note';
text(hint,'help');
const status=doc.createElement('p');
status.className='micro-note';
status.setAttribute('role','status');
group.append(hint,status);
for(const input of[legacyPalette,legacyOrnaments]){
const label=input?.closest?.('label');
if(label){
hiddenRows.push([label,label.hidden]);
label.hidden=true;
}
}
const legacyRow=legacyPalette?.closest?.('label');
if(legacyRow?.parentElement===root&&root.insertBefore)
root.insertBefore(group,legacyRow);
else root.append(group);
const render=(state)=>{
syncChoices(state);
for(const[id,card]of cards)
card.button.setAttribute('aria-pressed',String(id===state.familyId));
for(const[key,input]of controls)
if(key!=='familyId'){
if(input.type==='checkbox')input.checked=state[key];
else input.value=state[key];
}
const customized=state.arcadeArt!=='follow-game'||state.ornaments!=='theme';
localizedText(summary,()=>
t(`interface:workshop.${customized?'customized':'customize'}`),
);
localizedText(status,()=>host.getWarning());
};
release.push(host.preferences.subscribe(render));
release.push(host.subscribe(()=>render(host.preferences.snapshot())));
release.push(host.subscribeStatus((message)=>localizedText(status,()=>message)));
return{
dispose(){
release.forEach((stop)=>stop());
for(const card of cards.values())card.stop();
group.remove();
hiddenRows.forEach(([label,hidden])=>{
label.hidden=hidden;
});
},
};
}

return{attachThemeFamilyControls};
})();
modules['game/ui/global-settings-view.mjs']=(()=>{
const continuousPlayBindings=modules['game/ui/continuous-play.mjs']['continuousPlayBindings'];
// One logical settings inventory. Shared flow preferences have one lightweight
// owner; hosts retain audio, simulation and profile lifecycle ownership.
const GLOBAL_SETTINGS=Object.freeze(
[
{key:'autoNext',category:'gameplay',type:'checkbox',required:true},
{key:'autoRetry',category:'gameplay',type:'checkbox',required:true},
{key:'autoReplay',category:'gameplay',type:'checkbox',required:true},
{key:'language',category:'display',type:'select',required:true},
{key:'appearance',category:'display',required:true},
{key:'textFace',category:'accessibility',type:'select',required:true},
{key:'textSize',category:'accessibility',type:'select',required:true},
{key:'reducedEffects',category:'accessibility',type:'checkbox',required:true},
{key:'menuAnimation',category:'accessibility',type:'checkbox',required:true},
{key:'masterMuted',category:'audio',type:'checkbox',required:true},
{key:'masterVolume',category:'audio',type:'range',required:true},
{key:'musicVolume',category:'audio',type:'range'},
{key:'effectsVolume',category:'audio',type:'range'},
{key:'audioCues',category:'audio'},
{key:'musicLibrary',category:'audio'},
{key:'touchPresentation',category:'controls'},
{key:'controllerTools',category:'controls'},
{key:'profileRecovery',category:'data'},
{key:'offlineTools',category:'content'},
{key:'storageRetention',category:'content'},
{key:'creatorTools',category:'extras'},
{key:'about',category:'extras'},
{key:'updates',category:'extras'},
].map(Object.freeze),
);

const GLOBAL_SETTINGS_COPY={
en:{
shared:'All games',
autoNext:'Play next level automatically',
autoRetry:'Retry automatically after defeat',
autoReplay:'Snake: show failure replay automatically',
language:'Language / Мова',
textFace:'Text style',
textSize:'Text size',
reducedEffects:'Reduced effects',
menuAnimation:'Animated menu background',
masterMuted:'Mute sound',
masterVolume:'Master volume',
musicVolume:'Music volume',
effectsVolume:'Effects volume',
failed:'This setting could not be changed.',
options:{
language:[
['en','English'],
['uk','Українська'],
],
textFace:[
['pixel','Theme font'],
['plain','Plain'],
],
textSize:[
['standard','Standard'],
['large','Large'],
],
},
},
uk:{
shared:'Для всіх ігор',
autoNext:'Починати наступний рівень автоматично',
autoRetry:'Автоматично повторювати після поразки',
autoReplay:'Змійка: автоматично показувати повтор поразки',
language:'Language / Мова',
textFace:'Стиль тексту',
textSize:'Розмір тексту',
reducedEffects:'Менше ефектів',
menuAnimation:'Анімоване тло меню',
masterMuted:'Вимкнути звук',
masterVolume:'Загальна гучність',
musicVolume:'Гучність музики',
effectsVolume:'Гучність ефектів',
failed:'Не вдалося змінити це налаштування.',
options:{
language:[
['en','English'],
['uk','Українська'],
],
textFace:[
['pixel','Шрифт теми'],
['plain','Звичайний'],
],
textSize:[
['standard','Стандартний'],
['large','Великий'],
],
},
},
};
const globalSettingsOwners=new WeakMap();

/** Adopt real controls, or render missing fields through injected services.
     * Repeated calls add lazy providers without replacing focused controls.
     * `duplicates` retires aliases by logical setting while retaining their handlers.
     */
function mountGlobalSettings({
document:doc=globalThis.document,
root,
panels,
prefix='global-settings',
locale='en',
controls={},
bindings={},
duplicates={},
}={}){
if(!root|| !panels|| !doc)return null;
bindings={...continuousPlayBindings(),...bindings};
const previous=globalSettingsOwners.get(root);
if(previous)return previous.update({controls,bindings,duplicates,locale});
const rows=new Map(),
groups=new Map(),
hiddenAliases=new Map(),
moves=[];
let disposed=false;
const labels=()=>
GLOBAL_SETTINGS_COPY[String(locale).split('-')[0]]??GLOBAL_SETTINGS_COPY.en;
function groupFor(category){
if(groups.has(category))return groups.get(category);
const panel=panels[category];
if(!panel)return null;
const group=doc.createElement('section'),
heading=doc.createElement('h4');
group.className='global-settings-group';
group.dataset.globalSettings=category;
heading.className='global-settings-heading';
group.append(heading);
const title=panel.querySelector(':scope > h2, :scope > h3');
panel.insertBefore(group,title?title.nextSibling:panel.firstChild);
groups.set(category,{group,heading});
return groups.get(category);
}
function remember(node){
moves.push({node,parent:node.parentNode,next:node.nextSibling});
}
function retireField(row){
row.stop?.();
row.input?.removeEventListener('change',row.change);
row.field?.remove();
row.status?.remove();
Object.assign(row,{input:null,field:null,status:null,output:null,stop:null});
}
function render(row){
if(!row.input|| !row.binding)return;
const value=row.binding.get();
if(row.spec.type==='checkbox')row.input.checked= !!value;
else row.input.value=String(value);
if(row.output)row.output.textContent=`${Math.round(Number(value)*100)}%`;
row.status.textContent=row.binding.warning?.()||'';
row.status.hidden= !row.status.textContent;
}
function makeField(row){
const{spec,wrapper}=row;
const label=doc.createElement('label'),
text=doc.createElement('span');
const input=doc.createElement(spec.type==='select'?'select':'input');
input.id=`${prefix}-${spec.key}`;
label.className='global-settings-field';
if(spec.type!=='select')input.type=spec.type;
if(spec.type==='range'){
input.min='0';
input.max='1';
input.step='0.01';
row.output=doc.createElement('output');
row.output.setAttribute('for',input.id);
}
label.append(text,input);
if(row.output)label.append(row.output);
const status=doc.createElement('p');
status.className='micro-note';
status.setAttribute('role','status');
status.hidden=true;
wrapper.append(label,status);
Object.assign(row,{field:label,label:text,input,status});
row.change=()=>{
const value=
spec.type==='checkbox'
?input.checked
:spec.type==='range'
?Number(input.value)
:input.value;
const failed=(error)=>{
render(row);
status.textContent=error?.message||labels().failed;
status.hidden=false;
};
try{
const pending=row.binding.set(value);
render(row);
if(pending?.then)
pending.then(
()=>{
if(!disposed)render(row);
},
(error)=>{
if(!disposed)failed(error);
},
);
}catch(error){
failed(error);
}
};
input.addEventListener('change',row.change);
}
function refresh(nextLocale=locale){
if(disposed)return;
locale=nextLocale;
const copy=labels();
for(const{heading}of groups.values())heading.textContent=copy.shared;
for(const row of rows.values()){
if(!row.input)continue;
row.label.textContent=copy[row.spec.key];
if(row.spec.type==='select'){
const entries=row.binding.options?.(locale)??copy.options[row.spec.key];
const signature=JSON.stringify(entries);
if(row.options!==signature){
row.input.replaceChildren(
...entries.map(([value,label])=>{
const option=doc.createElement('option');
option.value=value;
option.textContent=label;
return option;
}),
);
row.options=signature;
}
}
render(row);
}
}
const api={
refresh,
keys:()=>[...rows.keys()],
missing:()=>
GLOBAL_SETTINGS.filter(({required,key})=>required&& !rows.has(key)).map(
({key})=>key,
),
update(next={}){
if(disposed)return api;
controls={...controls,...next.controls};
bindings={...bindings,...next.bindings};
duplicates={...duplicates,...next.duplicates};
for(const spec of GLOBAL_SETTINGS){
const supplied=controls[spec.key],
binding=bindings[spec.key];
const nodes=(Array.isArray(supplied)?supplied:[supplied]).filter(Boolean);
if(!nodes.length&& !(spec.type&&binding?.get&&binding?.set))continue;
const destination=groupFor(spec.category);
if(!destination)continue;
let row=rows.get(spec.key);
if(!row){
const wrapper=doc.createElement('div');
wrapper.className='global-settings-option';
wrapper.dataset.globalSetting=spec.key;
destination.group.append(wrapper);
row={spec,wrapper,nodes:new Set()};
rows.set(spec.key,row);
if(!nodes.length)makeField(row);
}
if(nodes.length&&row.input)retireField(row);
for(const node of nodes){
if(row.nodes.has(node))continue;
remember(node);
row.nodes.add(node);
row.wrapper.append(node);
}
if(row.input&&row.binding!==binding){
row.stop?.();
row.binding=binding;
row.stop=binding.subscribe?.(()=>{
if(!disposed)render(row);
});
}
for(const node of duplicates[spec.key]??[]){
if(!node||row.wrapper.contains(node))continue;
if(!hiddenAliases.has(node))hiddenAliases.set(node,node.hidden);
node.hidden=true;
}
}
// Lazy providers occupy the same position as eagerly mounted controls.
// Leave already ordered nodes in place so keyboard focus is not disturbed.
for(const[category,{group,heading}]of groups){
let prior=heading;
for(const{key}of GLOBAL_SETTINGS.filter((spec)=>spec.category===category)){
const row=rows.get(key);
if(!row)continue;
if(prior.nextSibling!==row.wrapper)
group.insertBefore(row.wrapper,prior.nextSibling);
prior=row.wrapper;
}
}
refresh(next.locale??locale);
return api;
},
destroy(){
if(disposed)return;
disposed=true;
for(const row of rows.values()){
row.stop?.();
row.input?.removeEventListener('change',row.change);
}
for(const{node,parent,next}of moves.reverse()){
// A host may already have retired its own provider during teardown.
if(!node.parentNode)continue;
if(parent)parent.insertBefore(node,next?.parentNode===parent?next:null);
else node.remove();
}
for(const[node,hidden]of hiddenAliases)node.hidden=hidden;
for(const{group}of groups.values())group.remove();
globalSettingsOwners.delete(root);
},
};
globalSettingsOwners.set(root,api);
return api.update({locale});
}

return{GLOBAL_SETTINGS,mountGlobalSettings};
})();
modules['game/ui/radio-audio.mjs']=(()=>{
const RADIO_AUDIO_KEY='revealline.radio-audio.v1';
function readRadioAudio(storage){
try{
storage??=globalThis.localStorage;
const value=JSON.parse(storage?.getItem(RADIO_AUDIO_KEY)??'null');
return{
enabled:typeof value?.enabled==='boolean'?value.enabled:true,
volume:
Number.isFinite(value?.volume)&&value.volume>=0&&value.volume<=1
?value.volume
:0.35,
};
}catch{
return{enabled:true,volume:0.35};
}
}

return{RADIO_AUDIO_KEY,readRadioAudio};
})();
modules['game/ui/movement-audio.mjs']=(()=>{
const MOVEMENT_AUDIO_KEY='revealline.movement-audio.v1';
function readMovementAudio(storage){
try{
storage??=globalThis.localStorage;
const value=JSON.parse(storage?.getItem(MOVEMENT_AUDIO_KEY)??'null');
return{
enabled:typeof value?.enabled==='boolean'?value.enabled:true,
volume:
Number.isFinite(value?.volume)&&value.volume>=0&&value.volume<=1
?value.volume
:0.5,
};
}catch{
return{enabled:true,volume:0.5};
}
}

return{MOVEMENT_AUDIO_KEY,readMovementAudio};
})();
modules['game/ui/menu-audio.mjs']=(()=>{
const MOVEMENT_AUDIO_KEY=modules['game/ui/movement-audio.mjs']['MOVEMENT_AUDIO_KEY'];
const RADIO_AUDIO_KEY=modules['game/ui/radio-audio.mjs']['RADIO_AUDIO_KEY'];
const t=simGlobalI18n['t'];
const localizedText=simGlobalI18n['localizedText'];
const localizedAttribute=simGlobalI18n['localizedAttribute'];
const MENU_AUDIO_KEY='revealline.menu-audio.v1';
function readMenuAudio(storage){
try{
storage??=globalThis.localStorage;
const value=JSON.parse(storage?.getItem(MENU_AUDIO_KEY)??'null');
return{
enabled:typeof value?.enabled==='boolean'?value.enabled:true,
volume:
Number.isFinite(value?.volume)&&value.volume>=0&&value.volume<=1
?value.volume
:0.35,
};
}catch{
return{enabled:true,volume:0.35};
}
}
function saveMenuAudio(value){
try{
globalThis.localStorage?.setItem(MENU_AUDIO_KEY,JSON.stringify(value));
}catch{
/* Session intent stays on Soundscape. */
}
}
function attachMenuAudioSettings(sound,doc=globalThis.document,options={}){
const menu=attachPreference(
sound,
doc,
'menu',
'menuSettings',
MENU_AUDIO_KEY,
'menuSounds',
'menuVolume',
options,
);
const radio=attachPreference(
sound,
doc,
'radio',
'radioSettings',
RADIO_AUDIO_KEY,
'radioSounds',
'radioVolume',
options,
);
const movement=attachPreference(
sound,
doc,
'movement',
'movementSettings',
MOVEMENT_AUDIO_KEY,
'movementSounds',
'movementVolume',
options,
);
return()=>{
movement();
menu();
radio();
};
}
function attachPreference(sound,doc,prefix,property,key,enableCopy,volumeCopy,options){
if(!sound[property]|| !doc?.createElement)return()=>{};
const win=options.window??globalThis,
getStorage=options.getStorage??(()=>globalThis.localStorage),
idPrefix=options.idPrefix?`${options.idPrefix}-`:'';
const target=
options.target??
doc.getElementById('sfx-volume')?.parentElement?.parentElement??
doc.getElementById('race-settings-panel-audio')??
doc.getElementById('coop-settings-panel-audio')??
doc.getElementById('settings-panel-audio')??
doc.getElementById('settings-dialog');
if(!target||target.querySelector(`[data-${prefix}-audio]`))return()=>{};
const group=doc.createElement('div');
group.dataset[`${prefix}Audio`]='';
group.style.display='grid';
group.style.gap='0.75rem';
const enabledLabel=doc.createElement('label'),
enabled=doc.createElement('input');
enabled.id=`${idPrefix}${prefix}-audio-enabled`;
enabled.type='checkbox';
enabled.style.width='auto';
enabled.style.margin='0';
enabledLabel.style.display='flex';
enabledLabel.style.alignItems='center';
enabledLabel.style.gap='0.6rem';
enabled.checked=sound[property].enabled;
const enabledText=doc.createElement('span');
localizedText(enabledText,()=>t(`common:${enableCopy}`));
enabledLabel.append(enabled,enabledText);
const volumeLabel=doc.createElement('label'),
volume=doc.createElement('input');
volume.id=`${idPrefix}${prefix}-audio-volume`;
volume.type='range';
volumeLabel.style.display='grid';
volumeLabel.style.gap='0.35rem';
volume.min='0';
volume.max='100';
volume.step='1';
volume.value=String(Math.round(sound[property].volume*100));
localizedAttribute(volume,'aria-label',()=>t(`common:${volumeCopy}`));
const volumeText=doc.createElement('span');
volumeText.id=`${idPrefix}${prefix}-audio-volume-label`;
const volumeCaption=()=>
`${t(`common:${volumeCopy}`)} · ${Math.round(sound[property].volume*100)}%`;
localizedText(volumeText,volumeCaption);
volumeLabel.append(volumeText,volume);
const change=()=>{
sound[property]={enabled:enabled.checked,volume:Number(volume.value)/100};
try{
getStorage()?.setItem(key,JSON.stringify(sound[property]));
}catch{
/* Preserve session intent. */
}
sound.applyVolumes();
volumeText.textContent=volumeCaption();
};
enabled.addEventListener('change',change);
volume.addEventListener('input',change);
group.append(enabledLabel,volumeLabel);
target.append(group);
const restore=(event)=>{
if(event?.type==='storage'&&event.key&&event.key!==key)return;
enabled.checked=sound[property].enabled;
volume.value=String(Math.round(sound[property].volume*100));
volumeText.textContent=volumeCaption();
};
win.addEventListener?.('pageshow',restore);
win.addEventListener?.('storage',restore);
return()=>{
win.removeEventListener?.('pageshow',restore);
win.removeEventListener?.('storage',restore);
enabled.removeEventListener('change',change);
volume.removeEventListener('input',change);
group.remove();
};
}

return{MENU_AUDIO_KEY,readMenuAudio,saveMenuAudio,attachMenuAudioSettings};
})();
return{
createSimMissionLibrary:modules['game/mission-library/library.mjs']['createMissionLibrary'],
simLibraryMissionId:modules['game/mission-library/library.mjs']['libraryMissionId'],
attachSimMissionLibraryChooser:
modules['game/ui/mission-library-browser.mjs']['attachMissionLibraryBrowser'],
createSimEnemyStatsHost:modules['game/enemy-stats.mjs']['createEnemyStatsHost'],
mountSimEnemyStats:modules['game/ui/enemy-stats.mjs']['mountEnemyStats'],
mountSimContinuousCelebration:
modules['game/ui/continuous-celebration.mjs']['mountContinuousCelebration'],
createSimContinuousPlayController:
modules['game/ui/continuous-play.mjs']['createContinuousPlayController'],
simContinuousPlayPreferences:
modules['game/ui/continuous-play.mjs']['continuousPlayPreferences'],
mountSimContinuousPlayControls:
modules['game/ui/continuous-play.mjs']['mountContinuousPlayControls'],
simContinuousPlayBindings:modules['game/ui/continuous-play.mjs']['continuousPlayBindings'],
createSimDisplayPreferences:
modules['game/display-preferences.mjs']['createDisplayPreferences'],
getSimMenuAnimation:modules['game/ui/menu-animation-preferences.mjs']['getMenuAnimation'],
setSimMenuAnimation:modules['game/ui/menu-animation-preferences.mjs']['setMenuAnimation'],
subscribeSimMenuAnimation:
modules['game/ui/menu-animation-preferences.mjs']['subscribeMenuAnimation'],
attachSimThemeFamilyControls:
modules['game/ui/theme-family-controls.mjs']['attachThemeFamilyControls'],
mountSimGlobalSettings:modules['game/ui/global-settings-view.mjs']['mountGlobalSettings'],
readSimRadioAudio:modules['game/ui/radio-audio.mjs']['readRadioAudio'],
SIM_RADIO_AUDIO_KEY:modules['game/ui/radio-audio.mjs']['RADIO_AUDIO_KEY'],
attachSimMenuAudioSettings:modules['game/ui/menu-audio.mjs']['attachMenuAudioSettings'],
readSimMenuAudio:modules['game/ui/menu-audio.mjs']['readMenuAudio'],
};
})();
export const createSimMissionLibrary=sharedGlobalSettings.createSimMissionLibrary;
export const simLibraryMissionId=sharedGlobalSettings.simLibraryMissionId;
export const attachSimMissionLibraryChooser=sharedGlobalSettings.attachSimMissionLibraryChooser;
export const createSimEnemyStatsHost=sharedGlobalSettings.createSimEnemyStatsHost;
export const mountSimEnemyStats=sharedGlobalSettings.mountSimEnemyStats;
export const mountSimContinuousCelebration=sharedGlobalSettings.mountSimContinuousCelebration;
export const createSimContinuousPlayController=
sharedGlobalSettings.createSimContinuousPlayController;
export const simContinuousPlayPreferences=sharedGlobalSettings.simContinuousPlayPreferences;
export const mountSimContinuousPlayControls=sharedGlobalSettings.mountSimContinuousPlayControls;
export const simContinuousPlayBindings=sharedGlobalSettings.simContinuousPlayBindings;
export const createSimDisplayPreferences=sharedGlobalSettings.createSimDisplayPreferences;
export const getSimMenuAnimation=sharedGlobalSettings.getSimMenuAnimation;
export const setSimMenuAnimation=sharedGlobalSettings.setSimMenuAnimation;
export const subscribeSimMenuAnimation=sharedGlobalSettings.subscribeSimMenuAnimation;
export const attachSimThemeFamilyControls=sharedGlobalSettings.attachSimThemeFamilyControls;
export const mountSimGlobalSettings=sharedGlobalSettings.mountSimGlobalSettings;
export const readSimRadioAudio=sharedGlobalSettings.readSimRadioAudio;
export const SIM_RADIO_AUDIO_KEY=sharedGlobalSettings.SIM_RADIO_AUDIO_KEY;
export const attachSimMenuAudioSettings=sharedGlobalSettings.attachSimMenuAudioSettings;
export const readSimMenuAudio=sharedGlobalSettings.readSimMenuAudio;
// Canonical source sha256: 67daaa251403bb6651cbf00e410a4c4554be5e3dc92d8302ee7b813e5af67e33
const sharedModeShell=(()=>{
// Dependency-free presentation shared with bundled simulator builds.
const GAME_MODE_ORDER=Object.freeze([
'solo',
'team',
'versus',
'snake',
'overflight',
'simulator',
]);
const copy={
en:{
solo:'Solo',
team:'Team',
versus:'VS',
snake:'Snake',
overflight:'Overflight',
simulator:'SIM',
mode:'Game mode',
},
uk:{
solo:'Соло',
team:'Разом',
versus:'VS',
snake:'Змійка',
overflight:'Проліт',
simulator:'SIM',
mode:'Режим гри',
},
};

/** Reuse each host's real actions, keeping navigation, handlers and save ownership. */
function renderModeChoices({
root,
current,
actions={},
locale='en',
setMenuIcon=()=>{},
}){
if(!root|| !GAME_MODE_ORDER.includes(current))
throw new Error('A visible game mode is required.');
const document=root.ownerDocument;
const rows=GAME_MODE_ORDER.filter((id)=>id!=='overflight'||actions.overflight).map(
(id)=>{
const element=actions[id]??document.createElement('button');
if(element.tagName==='BUTTON')element.type='button';
// A reused launch link must never retain primary/pressed paint from its old home.
element.classList.remove(
'primary',
'race-primary',
'field-kit-primary',
'selected',
'active-tab',
);
for(const attribute of[
'data-i18n',
'data-field-kit-copy',
'aria-current',
'aria-selected',
'aria-pressed',
])
element.removeAttribute(attribute);
if(id===current)element.setAttribute('aria-current','page');
element.dataset.gameMode=id;
element.id||=`${root.id||'game-mode'}-${id}`;
const label=document.createElement('strong');
label.className='game-mode-label';
element.replaceChildren(label);
if(['solo','team','versus','simulator'].includes(id)){
const badge=document.createElement('small');
badge.className='game-mode-badge';
badge.textContent=id==='simulator'?'beta':id==='solo'?'1P':'2P';
badge.setAttribute('aria-hidden','true');
element.append(badge);
}
setMenuIcon(element,id);
return{id,element,label};
},
);
root.classList.add('game-mode-choice');
root.dataset.menuLayout='horizontal';
root.dataset.menuScope='modes';
root.replaceChildren(...rows.map(({element})=>element));
for(const[index,{element}]of rows.entries()){
element.setAttribute(
'data-menu-left',
Array.from(
{length:rows.length-1},
(_,offset)=>rows[(index-offset-1+rows.length)%rows.length].element.id,
).join(' '),
);
element.setAttribute(
'data-menu-right',
Array.from(
{length:rows.length-1},
(_,offset)=>rows[(index+offset+1)%rows.length].element.id,
).join(' '),
);
}
const EventType=document.defaultView?.Event??globalThis.Event;
if(EventType)root.dispatchEvent(new EventType('game-mode-choices-ready',{bubbles:true}));
const refresh=(locale)=>{
const labels=copy[locale]??copy.en;
root.setAttribute('aria-label',labels.mode);
for(const{id,element,label}of rows){
label.textContent=labels[id];
const players=id==='solo'?'1P ':['team','versus'].includes(id)?'2P ':'';
element.setAttribute(
'aria-label',
`${players}${labels[id]}${id==='simulator'?' beta':''}`,
);
}
};
refresh(locale);
return{choices:Object.fromEntries(rows.map(({id,element})=>[id,element])),refresh};
}

// Browser key identities must not depend on the language used at module startup.
const TAB_KEYS=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End']);
const panelOwners=new WeakMap();

/** First Back from a compact settings section returns to its category list. */
function settingsPanelBack(root){
const settings=root?.classList?.contains('native-settings')
?root
:root?.querySelector?.('.native-settings');
if(
!settings||
settings.closest('[hidden],[inert],[aria-hidden="true"]')||
!settings.getClientRects().length
)
return false;
return panelOwners.get(settings)?.back()===true;
}
const owns=(root,doc,list,{tab,panel})=>
root?.ownerDocument===doc&&
doc?.contains(root)&&
root.contains(list)&&
list.contains(tab)&&
tab.closest('.field-kit-settings-tabs')===list&&
tab.ownerDocument===doc&&
!!tab.id&&
panel?.ownerDocument===doc&&
panel!==root&&
root.contains(panel)&&
!panel.contains(list)&&
doc.getElementById(tab.getAttribute('aria-controls'))===panel;
const enabled=({tab})=>
!tab.disabled&& !tab.hidden&&tab.getAttribute('aria-disabled')!=='true';

/** Document-level menu adapters yield these keys to the tab's native listener. */
function settingsTabOwnsKey(event,root){
if(
!TAB_KEYS.has(event?.key)||
event.defaultPrevented||
event.ctrlKey||
event.metaKey||
event.altKey||
event.shiftKey
)
return false;
const tab=event.target?.closest?.('[role="tab"]'),
doc=root?.ownerDocument,
list=root?.querySelector?.('.field-kit-settings-tabs'),
panel=tab&&doc?.getElementById(tab.getAttribute('aria-controls')),
record={tab,panel};
const vertical=list?.getAttribute('aria-orientation')==='vertical';
if(
(vertical&&['ArrowLeft','ArrowRight'].includes(event.key))||
(!vertical&&['ArrowUp','ArrowDown'].includes(event.key))
)
return false;
return!!(
tab&&
list&&
owns(root,doc,list,record)&&
enabled(record)&&
!tab.closest('[hidden],[inert],[aria-hidden="true"]')&&
tab.getClientRects().length&&
doc.defaultView?.getComputedStyle(tab)?.visibility!=='hidden'
);
}

/** Category presentation only. Hosts retain all preference, input and save ownership. */
function attachSettingsPanels({
root,
document:doc=globalThis.document,
beforeSelect=()=>false,
}={}){
const list=root?.querySelector?.('.field-kit-settings-tabs'),
records=[...(list?.querySelectorAll('[role="tab"]')??[])].map((tab)=>({
tab,
panel:doc?.getElementById(tab.getAttribute('aria-controls')),
})),
removers=[];
let destroyed=false,
current=null,
generation=0;
const compact=()=>
root?.classList?.contains('native-settings')&&
(doc.defaultView?.innerWidth??doc.documentElement?.clientWidth??Infinity)<=700;
function view(name){
if(root?.classList?.contains('native-settings'))
root.setAttribute('data-settings-view',name);
}
const owned=(record)=> !destroyed&&owns(root,doc,list,record);
const available=()=>records.filter((record)=>owned(record)&&enabled(record));
function paint(next){
for(const record of records.filter(owned)){
const selected=record===next;
record.tab.setAttribute('aria-selected',String(selected));
record.tab.setAttribute('tabindex',selected?'0':'-1');
record.panel.hidden= !selected;
record.panel.inert= !selected;
}
current=next;
}
function select(id,{focus=false,drill=false}={}){
const next=available().find(({tab})=>tab.id===id);
if(!next)return false;
const ticket= ++generation,
returnFocus=beforeSelect(next.tab)===true;
// A host hook may retire this surface, disable the target or start a newer selection.
if(ticket!==generation|| !owned(next)|| !enabled(next))return false;
paint(next);
if(drill&&compact()){
view('panel');
if(!focusPanel())next.panel.focus?.();
return true;
}
if(focus||returnFocus)next.tab.focus();
return true;
}
const initial=available();
if(initial.length)
paint(initial.find(({tab})=>tab.getAttribute('aria-selected')==='true')||initial[0]);
view('categories');
const back=()=>{
if(!destroyed&&compact()&&root.getAttribute('data-settings-view')==='panel'){
view('categories');
current?.tab.focus();
return true;
}
return false;
};
if(root)panelOwners.set(root,{back});
const cancel=(event)=>{
if(back()){
event.preventDefault();
event.stopPropagation();
// Hosts may close this same dialog from their own cancel listener.
// The category Back consumes the event before that sibling lifecycle.
event.stopImmediatePropagation?.();
}
};
root?.addEventListener('cancel',cancel);
const backClick=(event)=>{
const button=event.target?.closest?.(
'#race-options-back,#coop-settings-close,[data-close="settings-dialog"],[data-settings-back]',
);
if(button&&root.contains(button)&&back()){
event.preventDefault();
event.stopPropagation();
event.stopImmediatePropagation?.();
}
};
root?.addEventListener('click',backClick,true);
const resize=()=>{
if(destroyed|| !root?.contains(doc.activeElement))return;
if(current?.panel.contains(doc.activeElement))view('panel');
else if(list?.contains(doc.activeElement))view('categories');
};
doc.defaultView?.addEventListener?.('resize',resize);
function focusPanel(){
if(!current|| !owned(current))return false;
const target=[
...current.panel.querySelectorAll(
'button,a[href],select,input:not([type="hidden"]),textarea,summary,[tabindex]',
),
].find(
(element)=>
!element.disabled&&
element.tabIndex>=0&&
!element.closest('[hidden],[inert],[aria-hidden="true"]')&&
element.getClientRects().length,
);
if(!target)return false;
target.focus();
target.scrollIntoView?.({block:'nearest',inline:'nearest'});
return true;
}
for(const record of records){
const{tab}=record;
const click=()=>select(tab.id,{drill:true});
const keydown=(event)=>{
if(!owned(record)|| !settingsTabOwnsKey(event,root))return;
const tabs=available(),
index=tabs.indexOf(record),
direction=['ArrowRight','ArrowDown'].includes(event.key)
?1
:['ArrowLeft','ArrowUp'].includes(event.key)
? -1
:0,
next=
event.key==='Home'
?tabs[0]
:event.key==='End'
?tabs.at(-1)
:direction
?tabs[(index+direction+tabs.length)%tabs.length]
:null;
if(!next)return;
event.preventDefault();
event.stopPropagation();
select(next.tab.id,{focus:true});
};
tab.addEventListener('click',click);
tab.addEventListener('keydown',keydown);
removers.push(()=>{
tab.removeEventListener('click',click);
tab.removeEventListener('keydown',keydown);
});
}
return Object.freeze({
select,
selected:()=>(current&&owned(current)?current.tab.id:null),
primary:()=>(current&&owned(current)?current.tab:null),
panel:()=>(current&&owned(current)?current.panel:null),
focusCategories(){
if(!current|| !owned(current)|| !enabled(current))return false;
view('categories');
current.tab.focus();
return true;
},
focusPanel(){
view('panel');
return focusPanel();
},
back,
destroy(){
if(destroyed)return;
destroyed=true;
generation++;
if(root)panelOwners.delete(root);
root?.removeEventListener('cancel',cancel);
root?.removeEventListener('click',backClick,true);
doc.defaultView?.removeEventListener?.('resize',resize);
removers.forEach((remove)=>remove());
},
});
}

// Presentation only: the host owns every preference, modal and input handler.
// Keep this module dependency-free so optional games project the same organizer.
const MODE_SETTINGS_CATEGORIES=Object.freeze([
['gameplay','play'],
['controls','controls'],
['audio','sound'],
['display','display'],
['accessibility','accessibility'],
['data','collection'],
['content','content'],
['extras','help'],
]);
const MODE_SETTINGS_COPY=Object.freeze({
en:{
categories:'Settings categories',
gameplay:'Gameplay',
controls:'Controls',
audio:'Audio',
display:'Display & Language',
accessibility:'Accessibility',
data:'Progress & Collection',
content:'Content & Offline',
extras:'Help & Extras',
},
uk:{
categories:'Розділи налаштувань',
gameplay:'Гра',
controls:'Керування',
audio:'Звук',
display:'Екран і мова',
accessibility:'Доступність',
data:'Прогрес і колекція',
content:'Вміст і офлайн',
extras:'Довідка й додаткове',
},
});
const modeSettingsOwners=new WeakMap();

/** Reparent real host controls into the native settings categories. */
function mountModeSettings({
root,
content=root,
prefix='mode-settings',
groups={},
locale='en',
setMenuIcon=()=>{},
attachPanels,
beforeSelect,
}={}){
const doc=root?.ownerDocument;
if(!doc|| !content|| !root.contains(content)||typeof attachPanels!=='function')
return null;
if(modeSettingsOwners.has(root))return modeSettingsOwners.get(root);
const layout=doc.createElement('div'),
list=doc.createElement('nav'),
tabs={},
panels={},
headings={},
moves=[],
moved=new Set(),
rootClasses=['native-settings','mode-settings-view'].filter(
(name)=> !root.classList.contains(name),
),
contentClass= !content.classList.contains('mode-settings-content'),
originalView=root.getAttribute('data-settings-view');
layout.className='mode-settings-layout';
list.className='field-kit-settings-tabs';
list.setAttribute('role','tablist');
list.setAttribute('aria-orientation','vertical');
list.dataset.menuLayout='vertical';
layout.append(list);
for(const[category,icon]of MODE_SETTINGS_CATEGORIES){
const nodes=(groups[category]??[]).filter(
(node)=>
node?.ownerDocument===doc&&node!==root&&node!==content&& !moved.has(node),
);
if(!nodes.length)continue;
const tab=doc.createElement('button'),
panel=doc.createElement('section'),
heading=doc.createElement('h3');
tab.type='button';
tab.id=`${prefix}-tab-${category}`;
tab.setAttribute('role','tab');
tab.setAttribute('aria-controls',`${prefix}-panel-${category}`);
tab.setAttribute('aria-selected',String(!Object.keys(tabs).length));
tab.tabIndex=Object.keys(tabs).length? -1:0;
setMenuIcon(tab,icon);
panel.id=`${prefix}-panel-${category}`;
panel.className='field-kit-settings-panel';
panel.setAttribute('role','tabpanel');
panel.setAttribute('aria-labelledby',tab.id);
panel.tabIndex= -1;
panel.dataset.menuLayout='vertical';
panel.append(heading);
for(const node of nodes){
moves.push({node,parent:node.parentNode,next:node.nextSibling});
moved.add(node);
panel.append(node);
}
tabs[category]=tab;
panels[category]=panel;
headings[category]=heading;
list.append(tab);
layout.append(panel);
}
rootClasses.forEach((name)=>root.classList.add(name));
if(contentClass)content.classList.add('mode-settings-content');
content.append(layout);
const navigation=attachPanels({root,document:doc,beforeSelect});
let destroyed=false;
const api=Object.freeze({
navigation,
tabs,
panels,
refresh(nextLocale=locale){
if(destroyed)return;
locale=nextLocale;
const labels=MODE_SETTINGS_COPY[String(locale).split('-')[0]]??MODE_SETTINGS_COPY.en;
list.setAttribute('aria-label',labels.categories);
for(const category of Object.keys(tabs)){
tabs[category].textContent=labels[category];
headings[category].textContent=labels[category];
}
},
destroy(){
if(destroyed)return;
destroyed=true;
navigation?.destroy();
for(const{node,parent,next}of moves.reverse()){
if(parent)parent.insertBefore(node,next?.parentNode===parent?next:null);
else node.remove();
}
layout.remove();
rootClasses.forEach((name)=>root.classList.remove(name));
if(contentClass)content.classList.remove('mode-settings-content');
if(originalView===null)root.removeAttribute('data-settings-view');
else root.setAttribute('data-settings-view',originalView);
modeSettingsOwners.delete(root);
},
});
modeSettingsOwners.set(root,api);
api.refresh(locale);
return api;
}

// Presentation only. Hosts own simulation, prepared attempts, sound and navigation.
// Services are injected so optional modes can project this exact source without
// adding another copy of the game runtime or a second controller/audio owner.
const COPY={
en:{
home:'Main menu',
missions:'Select Mission',
missionsGroup:'Missions',
homeAction:'Home',
briefing:'Mission briefing',
settings:'Settings',
expert:'Expert options',
help:'How to play',
workshop:'Workshop',
results:'Results',
start:'Start',
continue:'Continue',
retry:'Retry',
review:'Review mission',
back:'Back',
menu:'Menu',
pause:'Pause',
restart:'Restart',
skip:'Skip',
random:'Random',
choose:'Choose',
audio:'Sound',
config:'Settings',
nextSong:'Next song',
resume:'Resume',
fullscreen:'Full screen',
sound:'Sound',
on:'on',
off:'off',
modes:'Choose game mode',
},
uk:{
home:'Головне меню',
missions:'Вибрати місію',
missionsGroup:'Місії',
homeAction:'Головне меню',
briefing:'Перед польотом',
settings:'Налаштування',
expert:'Розширені налаштування',
help:'Як грати',
workshop:'Майстерня',
results:'Результати',
start:'Почати',
continue:'Продовжити',
retry:'Повторити',
review:'Переглянути місію',
back:'Назад',
menu:'Меню',
pause:'Пауза',
restart:'Заново',
skip:'Далі',
random:'Навмання',
choose:'Обрати',
audio:'Звук',
config:'Налаштування',
nextSong:'Наступна пісня',
resume:'Продовжити',
fullscreen:'На весь екран',
sound:'Звук',
on:'увімкнено',
off:'вимкнено',
modes:'Вибрати режим гри',
},
};
const SURFACES=[
'home',
'pause',
'missions',
'briefing',
'settings',
'expert',
'help',
'workshop',
'results',
];

/** Give every landing page one deterministic vertical cycle. A step may contain
   * several mutually exclusive controls (for example Start and Continue); the
   * controller navigator selects the first currently visible target. */
function wireLandingMenuNavigation({
modesRoot=null,
current=null,
steps=[],
links=[],
scopeRoot=modesRoot?.closest?.('[id]')??null,
}={}){
const groups=steps
.map((step)=>(Array.isArray(step)?step:[step]).filter((node)=>node?.id))
.filter((group)=>group.length);
const modes=[...(modesRoot?.querySelectorAll('[data-game-mode]')??[])].filter(
(node)=>node.id,
);
const selected=
current??modes.find((node)=>node.getAttribute('aria-current')==='page')??null;
const originals=new Map();
const set=(nodes,direction,targets)=>{
nodes=nodes.filter((node)=>node?.id);
targets=targets.filter((node)=>node?.id);
const value=targets
.map((node)=>node?.id)
.filter(Boolean)
.join(' ');
for(const node of nodes){
if(!originals.has(node))
originals.set(node,{
...Object.fromEntries(
['up','right','down','left'].map((name)=>[
name,
node.getAttribute(`data-menu-${name}`),
]),
),
scope:node.getAttribute('data-menu-navigation-scope'),
});
if(scopeRoot?.id)node.setAttribute('data-menu-navigation-scope',scopeRoot.id);
if(value)node.setAttribute(`data-menu-${direction}`,value);
else node.removeAttribute(`data-menu-${direction}`);
}
};
if(groups.length){
set(modes,'down',groups.flat());
set(modes,'up',groups.toReversed().flat());
groups.forEach((group,index)=>{
set(group,'up',[
...groups.slice(0,index).toReversed().flat(),
...(selected?[selected]:[]),
]);
set(group,'down',[...groups.slice(index+1).flat(),...(selected?[selected]:[])]);
});
for(const{nodes,direction,targets}of links)
if(['up','right','down','left'].includes(direction))
set(
Array.isArray(nodes)?nodes:[nodes],
direction,
Array.isArray(targets)?targets:[targets],
);
}
return{
dispose(){
for(const[node,values]of originals)
for(const[direction,value]of Object.entries(values).filter(
([direction])=>direction!=='scope',
)){
if(value===null)node.removeAttribute(`data-menu-${direction}`);
else node.setAttribute(`data-menu-${direction}`,value);
}
for(const[node,values]of originals){
if(values.scope===null)node.removeAttribute('data-menu-navigation-scope');
else node.setAttribute('data-menu-navigation-scope',values.scope);
}
originals.clear();
},
};
}

/** Move live slots, preserving IDs/listeners. No close path starts or resumes play.
   * actions.open(surface) may return false to delegate to an existing host dialog.
   * start/resume/continue/retry run through activate(), after closing owned dialogs.
   * Hosts may activate an already-authorized continuous-play transition; ordinary
   * menu close/back/focus paths never start gameplay. Hosts update accepted phase.
   */
function mountModePlayShell({
document:doc=globalThis.document,
mount=doc.body,
idPrefix='mode',
modeName='',
locale=doc.documentElement.lang,
slots={},
actions={},
services={},
wordmarkURL='',
artworkURL='',
version='',
initial='home',
focusPlay=()=>{},
onSurfaceChange=()=>{},
}={}){
let language=locale==='uk'?'uk':'en',
alive=true,
closing=false,
opening=0;
let state={phase:'ready',missionName:'',summary:'',muted:false};
const moved=[],
cleanups=[],
stack=[],
dialogs={},
content={},
buttons={};
const labels=[];
const text=(value)=>{
if(typeof value==='function')return text(value(language));
return typeof value==='object'?(value?.[language]??value?.en??''):(value??'');
};
const el=(tag,className='')=>{
const node=doc.createElement(tag);
node.className=className;
return node;
};
const listen=(node,type,fn)=>{
node.addEventListener(type,fn);
cleanups.push(()=>node.removeEventListener(type,fn));
};
const label=(node,key)=>{
labels.push([node,key]);
return node;
};
const button=(key,handler,primary=false,name=key)=>{
const node=label(el('button',`button ${primary?'primary':'secondary'}`),key);
node.type='button';
node.id=`${idPrefix}-action-${name}`;
node.dataset.modeAction=name;
services.setMenuIcon?.(
node,
{
review:'missions',
start:'play',
continue:'play',
retry:'restart',
resume:'play',
choose:'missions',
nextSong:'next',
home:'home',
homeAction:'home',
results:'collection',
menu:'back',
pause:'pause',
expert:'settings',
workshop:'content',
}[key]??key,
);
listen(node,'click',handler);
buttons[name]=node;
return node;
};
const move=(name,target)=>{
const value=slots[name];
for(const node of value?(Array.isArray(value)?value:[value]):[]){
moved.push({node,parent:node.parentNode,next:node.nextSibling});
target.append(node);
}
};
const root=el('section','mode-play-shell');
root.dataset.modePlayShell=idPrefix;
const hadPage=doc.body.classList.contains('mode-play-page');
doc.body.classList.add('mode-play-page');
const header=el('header','mode-play-bar');
header.append(button('menu',()=>open('home')));
const modeLabel=el('span','mode-play-name');
let pausePress=null;
header.append(
modeLabel,
button('pause',(event)=>{
// Pointer focus can make the host pause before click. Honour the action
// that was visible at press, never turn that same Pause press into Resume.
const phase=event.detail>0&&pausePress?pausePress.phase:state.phase;
pausePress=null;
if(state.phase==='results'&&state.transitionActive){
actions.pause?.();
open('results');
return;
}
if(!['playing','paused'].includes(state.phase))return;
if(phase==='playing')open('pause');
else if(phase==='paused'&&state.phase==='paused')activate('resume');
}),
);
listen(buttons.pause,'pointerdown',(event)=>{
if((event.button??0)!==0||event.isPrimary===false)return;
pausePress={phase:state.phase,pointerId:event.pointerId};
});
listen(buttons.pause,'pointercancel',(event)=>{
if(pausePress?.pointerId===event.pointerId)pausePress=null;
});
if(wordmarkURL){
const logo=el('img');
logo.src=wordmarkURL;
logo.alt='';
buttons.menu.replaceChildren(logo);
buttons.menu.classList.add('mode-play-brand-button');
}
const stage=el('div','mode-play-stage');
move('play',stage);
root.append(header,stage);
mount.append(root);
for(const name of SURFACES){
const dialog=el('dialog',`mode-play-dialog${name==='home'?' mode-play-home':''}`);
dialog.id=`${idPrefix}-${name}-dialog`;
dialog.dataset.modeSurface=name;
const heading=label(el('h1'),name);
heading.id=`${idPrefix}-${name}-title`;
heading.tabIndex= -1;
dialog.setAttribute('aria-labelledby',heading.id);
const head=el('header','mode-play-dialog-head');
head.append(heading);
const body=el('div','mode-play-content');
const footer=el('footer','mode-play-actions');
dialogs[name]=dialog;
content[name]=body;
dialog.append(head,body,footer);
root.append(dialog);
if(name!=='home'){
move(name,body);
footer.append(button('back',back,false,`${name}-back`));
}
listen(dialog,'cancel',(event)=>{
if(event.defaultPrevented)return;
event.preventDefault();
back();
});
listen(dialog,'close',()=>{
if(dialog.open||closing|| !alive)return;
removeFromStack(dialog);
onSurfaceChange(topDialog()?.dataset.modeSurface??'play');
});
}
if(services.attachMenuScene){
const scene=services.attachMenuScene({root:dialogs.home,mode:'solo'});
cleanups.push(()=>scene.dispose());
}else if(artworkURL){
const scene=el('div','mode-play-artwork');
scene.setAttribute('aria-hidden','true');
const image=el('img');
image.src=artworkURL;
image.alt='';
scene.append(image);
dialogs.home.prepend(scene);
}
const home=content.home;
const title=dialogs.home.querySelector('h1');
title.className='mode-play-wordmark';
// The host supplies the same accepted wordmark used by the main title.
labels.splice(
labels.findIndex(([node])=>node===title),
1,
);
title.textContent='FPV / LINE';
if(slots.brand){
title.textContent='';
move('brand',title);
}else if(wordmarkURL){
const logo=el('img');
logo.src=wordmarkURL;
logo.alt='FPV / LINE';
title.replaceChildren(logo);
}
const edition=el('p','mode-play-edition');
const modes=el('nav','mode-play-modes');
move('modes',modes);
const mission=el('p','mode-play-mission');
const menu=el('nav','mode-play-main-menu native-menu-actions');
menu.dataset.menuScope='main';
menu.append(
button(
'start',
()=>
state.phase==='results'
?activate('retry')
:resumable()
?activate(state.phase==='paused'?'resume':'continue')
:activate('start'),
true,
'primary',
),
button('results',()=>open('results'),false,'home-results'),
button('missions',()=>open('missions')),
button('settings',()=>open('settings')),
);
const utilities=el('div','mode-play-utilities native-menu-utilities');
utilities.setAttribute('role','group');
utilities.append(
button('sound',()=>actions.toggleSound?.()),
button('fullscreen',()=>actions.fullscreen?.()),
);
home.append(edition,modes,mission,menu,utilities);
const landingNavigation=wireLandingMenuNavigation({
modesRoot:modes,
scopeRoot:dialogs.home,
steps:[
buttons.primary,
buttons.missions,
buttons.settings,
buttons.sound,
buttons.fullscreen,
],
});
cleanups.push(()=>landingNavigation.dispose());
const pauseMenu=content.pause;
pauseMenu.classList.add('shared-pause-menu');
const resume=button('resume',()=>activate('resume'),true,'pause-resume');
resume.classList.add('pause-command-primary');
pauseMenu.append(resume);
const pauseGroup=(name,key,controls)=>{
const section=el('section','pause-command-section');
section.dataset.pauseGroup=name;
section.append(label(el('h3'),key));
const grid=el('div','pause-command-grid');
grid.append(...controls);
section.append(grid);
section.hidden= !controls.length;
pauseMenu.append(section);
};
pauseGroup('missions','missionsGroup',[
...(actions.retry
?[button('restart',()=>activate('retry'),false,'pause-restart')]
:[]),
...(actions.skip?[button('skip',()=>activate('skip'),false,'pause-skip')]:[]),
...(actions.random
?[button('random',()=>activate('random'),false,'pause-random')]
:[]),
button('choose',()=>open('missions'),false,'pause-choose'),
]);
pauseGroup('audio','audio',[
...(actions.toggleSound
?[button('sound',()=>actions.toggleSound?.(),false,'pause-sound')]
:[]),
...(actions.nextSong
?[button('nextSong',()=>actions.nextSong(),false,'pause-next-song')]
:[]),
]);
pauseGroup('config','config',[
button('settings',()=>open('settings'),false,'pause-settings'),
button('fullscreen',()=>actions.fullscreen?.(),false,'pause-fullscreen'),
]);
const homeButton=button('homeAction',()=>open('home'),false,'pause-home');
homeButton.classList.add('pause-command-home');
pauseMenu.append(homeButton);
dialogs.pause.querySelector('footer').hidden=true;
if(version){
const build=el('p','mode-play-version');
build.textContent=version;
dialogs.home.querySelector('footer').append(build);
}
const briefingSummary=el('p','mode-play-summary');
content.briefing.prepend(briefingSummary);
dialogs.missions
.querySelector('footer')
.append(button('start',()=>activate('start'),true,'mission-start'));
if(slots.expert||actions.open)
dialogs.missions
.querySelector('footer')
.append(button('expert',()=>open('expert'),false,'missions-expert'));
dialogs.briefing
.querySelector('footer')
.append(button('start',()=>activate(state.phase==='paused'?'resume':'start'),true));
if(slots.help||actions.open)
dialogs.briefing
.querySelector('footer')
.append(button('help',()=>open('help'),false,'briefing-help'));
dialogs.results.querySelector('footer').append(button('retry',()=>activate('retry'),true));
for(const name of['expert','help','workshop']){
if(slots[name]||actions.open)content.settings.append(button(name,()=>open(name)));
}
buttons['settings-back'].dataset.settingsBack='';
const retryHome=button('retry',()=>activate('retry'),false,'home-retry');
content.settings.append(retryHome);
const navigation=services.attachModalNavigation?.({
document:doc,
getFallbackFocus:()=>buttons.menu,
});
if(navigation)cleanups.push(()=>navigation.destroy());
for(const[name,escapeRoot]of[
['fullscreen',dialogs.home],
['pause-fullscreen',dialogs.pause],
]){
const control=buttons[name];
if(services.attachFullscreen){
control.setAttribute('data-fullscreen-label','');
cleanups.push(services.attachFullscreen(control,doc,{escapeRoot}));
}else control.hidden= !actions.fullscreen;
}
buttons.sound.hidden= !actions.toggleSound;
function resumable(){
return state.canResume?? !!actions.canResume?.();
}
function removeFromStack(dialog){
const index=stack.indexOf(dialog);
if(index>=0)stack.splice(index,1);
}
function topDialog(){
return navigation?.topDialog()??[...stack].reverse().find((dialog)=>dialog.open)??null;
}
const put=(node,key,value)=>{
if(node[key]!==value)node[key]=value;
};
const attribute=(node,key,value)=>{
if(node.getAttribute(key)!==value)node.setAttribute(key,value);
};
function update(patch={}){
if(!alive)return;
state={...state,...patch};
put(root.dataset,'phase',state.phase);
const briefingTitle=dialogs.briefing.querySelector('h1');
// HUD refreshes run during pointer activation. Unchanged text must keep its
// native Text node; writing a default then a dynamic label also replaces it.
for(const[node,key]of labels){
if((key==='fullscreen'&&services.attachFullscreen)||(key==='menu'&&wordmarkURL))
continue;
let value=COPY[language][key];
if(node===buttons.primary)
value=
COPY[language][
state.phase==='results'?'retry':resumable()?'continue':'start'
];
else if(node===buttons.start)
value=COPY[language][state.phase==='paused'?'resume':'start'];
else if(node===buttons.pause)
value=COPY[language][state.phase==='paused'?'resume':'pause'];
else if(node===buttons.sound||node===buttons['pause-sound'])
value=`${COPY[language].sound}: ${COPY[language][state.muted?'off':'on']}`;
else if(node===briefingTitle)value=text(state.missionName)||value;
put(node,'textContent',value);
}
attribute(buttons.menu,'aria-label',COPY[language].menu);
put(modeLabel,'textContent',text(modeName));
put(edition,'textContent',text(modeName));
edition.hidden=true;
attribute(modes,'aria-label',COPY[language].modes);
attribute(menu,'aria-label',COPY[language].home);
attribute(utilities,'aria-label',COPY[language].settings);
put(mission,'textContent',text(state.missionName));
put(mission,'hidden',!mission.textContent);
put(briefingSummary,'textContent',text(state.summary)||text(state.missionName));
put(briefingSummary,'hidden',!briefingSummary.textContent);
put(
buttons.pause,
'disabled',
!['playing','paused'].includes(state.phase)&&
!(state.phase==='results'&&state.transitionActive),
);
attribute(buttons.sound,'aria-pressed',String(!state.muted));
if(buttons['pause-sound'])
attribute(buttons['pause-sound'],'aria-pressed',String(!state.muted));
put(retryHome,'hidden',state.phase!=='paused');
put(buttons['home-results'],'hidden',state.phase!=='results');
}
function enterPlay(){
if(!alive)return;
opening++;
closing=true;
for(const dialog of[...stack].reverse())if(dialog.open)dialog.close();
stack.length=0;
closing=false;
onSurfaceChange('play');
// Closing a menu is presentation only; explicit Resume remains required.
focusPlay();
}
function activate(action){
if(typeof actions[action]!=='function'&& !(action==='continue'&&actions.resume))
return false;
enterPlay();
if(!alive)return;
return(actions[action]??(action==='continue'?actions.resume:null))?.();
}
function initialFocus(name,dialog){
if(name==='home')return buttons.primary;
if(name==='pause')return resume;
if(name==='results'){
const preferred=actions.resultFocus?.();
const usable=(node)=>
node&& !node.disabled&& !node.closest('[hidden],[inert],[aria-hidden="true"]');
if(usable(preferred))return preferred;
const primary=[...content.results.querySelectorAll('button.primary')].find(usable);
return primary??buttons.retry;
}
return dialog.querySelector('h1');
}
function open(name='home'){
if(!alive)return false;

const request= ++opening;
if(name==='play'){
enterPlay();
return true;
}
const dialog=dialogs[name];
if(!dialog)throw new Error(`Unknown play surface: ${name}`);
if(state.phase==='playing'){
update({phase:'paused'});
actions.pause?.();
if(!alive||request!==opening)return false;
}else update();
if(actions.open?.(name)===false|| !alive||request!==opening)return false;
if(name==='home'){
closing=true;
for(const prior of[...stack].reverse())if(prior!==dialog&&prior.open)prior.close();
stack.length=0;
if(dialog.open)stack.push(dialog);
closing=false;
}
if(dialog.open){
if(name==='home')onSurfaceChange(name);
initialFocus(name,dialog).focus({
preventScroll:true,
});
return true;
}
dialog.showModal();
removeFromStack(dialog);
stack.push(dialog);
onSurfaceChange(name);
initialFocus(name,dialog).focus({preventScroll:true});
return true;
}
function back(){
const dialog=topDialog();
if(!dialog|| !Object.values(dialogs).includes(dialog))return false;
if(services.settingsPanelBack?.(dialog))return true;
if(dialog===dialogs.home||dialog===dialogs.pause){
if(state.phase==='results')return open('results');
if(!resumable())return false;
enterPlay();
return true;
}
dialog.close();
removeFromStack(dialog);
if(!topDialog())open(dialog===dialogs.briefing?'missions':'home');
return true;
}
const elements={
root,
header,
stage,
home:dialogs.home,
title,
dialogs,
content,
buttons,
modes,
utilities,
};
function setLocale(next){
language=next==='uk'?'uk':'en';
update();
}
update();
// Reveal before focusing: hidden boot content cannot receive native focus.
delete doc.documentElement.dataset.modeShellPending;
if(initial!=='play')open(initial);
return{
open,
openHome:()=>open('home'),
enterPlay,
activate,
back,
update,
topDialog,
elements,
setLocale,
localize:setLocale,
blocksPlay:()=> !!topDialog(),
dispose(){
if(!alive)return;
alive=false;
closing=true;
for(const dialog of Object.values(dialogs))if(dialog.open)dialog.close();
for(const cleanup of cleanups.reverse())cleanup?.();
for(const{node,parent,next}of moved.reverse()){
if(parent)parent.insertBefore(node,next?.parentNode===parent?next:null);
else node.remove();
}
root.remove();
if(!hadPage)doc.body.classList.remove('mode-play-page');
},
};
}

return{
GAME_MODE_ORDER,
renderModeChoices,
settingsPanelBack,
settingsTabOwnsKey,
attachSettingsPanels,
MODE_SETTINGS_CATEGORIES,
mountModeSettings,
wireLandingMenuNavigation,
mountModePlayShell,
};
})();
export const mountSimPlayShell=sharedModeShell.mountModePlayShell;
export const renderSimModeChoices=sharedModeShell.renderModeChoices;
export const mountSimModeSettings=sharedModeShell.mountModeSettings;
export const simAttachSettingsPanels=sharedModeShell.attachSettingsPanels;
export const simSettingsPanelBack=sharedModeShell.settingsPanelBack;
export const simSettingsTabOwnsKey=sharedModeShell.settingsTabOwnsKey;
// END GENERATED SHARED MODE SHELL
