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
      element.setAttribute('href', target.href);
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
const sharedGlobalSettings=(()=>{
const modules=Object.create(null);
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
required(!closed,'Enemy statistics are closed.');
if(memoryOnly)return state;
if(!pending.size)return state;
const batch=new Map(pending);
try{
const saved=await backend.update((base)=>
[...batch.values()].reduce(applyObservation,base),
);
if(memoryOnly)return state;
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
if(memoryOnly)return structuredClone(state);
try{
state=[...pending.values()].reduce(applyObservation,await backend.read());
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
// A backup can include an optimistic count from another paused host.
// Persist its cursor first so that queued callbacks cannot add it again.
// Call the drain directly: waiting on another service's import queue
// would deadlock two simultaneous imports in the same document.
for(const active of coordinator.members)await active.drain();
required(ownsWrites(),'This tab does not own the saving lease.');
const writer=randomId();
required(id(writer),'A unique statistics writer is required.');
for(const active of coordinator.members)active.rotate(writer);
try{
storage?.setItem(WRITER_KEY,writer);
}catch{
/* Same-document services still adopt the unique writer. */
}
state=await backend.update((base)=>mergeEnemyStats(base,incoming));
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
modules['game/hunt/actor-catalog.mjs']=(()=>{
/** Shared identities, not a grant of gameplay capability. Native engines must
     * accept a versioned policy before an actor can enter an attempt. */
const ACTOR_CATALOG_VERSION='humanoid-actors.v1';
const ACTOR_ART_REVISION='overhead-field-kit.v2';
const ACTOR_ART_BUDGET=Object.freeze({decodedBytes:32*1024*1024,sharedBoards:2});
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
else if(family==='patroller'||cast==='tactical')pack(ctx,role,12,18,8,7);
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

function markers(ctx,family,options,angle){
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
const gait=motion(pose,options,visual.family);
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
pixel(ctx,'#101b17',6,14,20,11);
ctx.globalAlpha=alpha;
}
const useCompact=
options.detail==='compact'||(options.detail!=='detailed'&&size<24);
(useCompact?compact:detailed)(
ctx,
visual.palette,
visual.family,
gait,
options,
visual.cast,
);
ctx.restore();
markers(ctx,visual.family,options,angle);
ctx.restore();
}

return{drawHuntActor};
})();
modules['game/ui/enemy-stats.mjs']=(()=>{
const canonicalEnemyFamily=modules['game/enemy-stats.mjs']['canonicalEnemyFamily'];
const drawHuntActor=modules['game/hunt/actor-art.mjs']['drawHuntActor'];
const actorDefinition=modules['game/hunt/actor-catalog.mjs']['actorDefinition'];
const resolveActorFamily=modules['game/hunt/actor-catalog.mjs']['resolveActorFamily'];

const copy={
en:{
title:'Your victories',
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
.enemy-stats{--stats-gold:var(--fk-color-accent,#eabb59);color:inherit;min-width:0}
.enemy-stats[data-variant=collection],.enemy-stats[data-variant=panel]{border:1px solid #69706f66;background:linear-gradient(140deg,#26343b99,#171c2099);padding:clamp(12px,2vw,24px);margin:12px 0;border-radius:4px}
.enemy-stats-header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.enemy-stats-header h3{margin:0}.enemy-stats-total{font-variant-numeric:tabular-nums;color:var(--stats-gold);font-size:clamp(1.7rem,3vw,2.8rem);font-weight:800;line-height:1.1}.enemy-stats-summary{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:10px 0}.enemy-stats-caption{opacity:.8;font-size:.9em}.enemy-stats-run{font-variant-numeric:tabular-nums;white-space:nowrap}.enemy-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,165px),1fr));gap:10px;margin:12px 0 0;padding:0;list-style:none}.enemy-stats-card{display:grid;grid-template-columns:40px 1fr;align-items:center;gap:10px;padding:10px;border:1px solid #87958c44;background:#10181b77}.enemy-stats-card strong{display:block;font-variant-numeric:tabular-nums;font-size:1.4em;color:var(--stats-gold)}.enemy-stats-card span{font-size:.85em}.enemy-stats-portrait{width:40px;height:40px;object-fit:contain;image-rendering:pixelated;background:#27383c}.enemy-stats-person{position:relative;display:block;width:40px;height:40px;background:#27383c;overflow:hidden}.enemy-stats-person:before{content:'';position:absolute;width:14px;height:14px;left:13px;top:6px;background:#d7bd87;box-shadow:0 -3px #bb934c}.enemy-stats-person:after{content:'';position:absolute;width:24px;height:18px;left:8px;top:22px;background:#829c75;box-shadow:inset 9px 0 #566d58,inset -9px 0 #566d58}.enemy-stats select{max-width:100%;min-height:40px;color:inherit;background:#20292f;border:1px solid #83908a;padding:5px 9px;font:inherit}.enemy-stats[data-variant=hud]{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:.85rem}.enemy-stats[data-variant=hud] .enemy-stats-total{font-size:1.1em}.enemy-stats[data-variant=hud] .enemy-stats-summary{margin:0}.enemy-stats[data-variant=hud] .enemy-stats-caption{font-size:inherit}.enemy-stats-warning{color:#e6c68b;font-size:.85em}.enemy-stats [hidden]{display:none!important}
`;
function enemyStatsFamilyLabel(family,locale='en'){
const canonical=canonicalEnemyFamily(family);
return(
actorDefinition(canonical)?.name?.[locale==='uk'?'uk':'en']??
families[canonical]?.[locale==='uk'?1:0]??
canonical.replaceAll('-',' ')
);
}

/** A shared rendering adapter: no simulation, rewards, picture ownership, or
     * keyboard shortcuts live here. Hosts mount it above their existing pictures. */
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
const summary=make('div','enemy-stats-summary'),
total=make('strong','enemy-stats-total'),
caption=make('span','enemy-stats-caption'),
run=make('span','enemy-stats-run');
const grid=make('ul','enemy-stats-grid'),
detail=make('p','enemy-stats-caption'),
warning=make('p','enemy-stats-warning'),
milestone=make('span','enemy-stats-milestone');
milestone.setAttribute('role','status');
milestone.hidden=true;
header.append(title,filter);
summary.append(total,caption,run);
root.append(header,summary,milestone,grid,detail,warning);
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
title.textContent=t.title;
header.hidden=variant==='hud';
filter.hidden=variant!=='collection';
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
caption.textContent=variant==='hud'?t.lifetime:t.defeated;
run.textContent=attempt?` · ${t.run}: ${number(result.run.total)}`:'';
run.hidden= !attempt;
grid.hidden=variant==='hud';
detail.hidden=variant==='hud';
warning.hidden=result.durable;
detail.textContent=result.total?t.since:t.empty;
warning.textContent=t.saving;
grid.replaceChildren();
if(variant!=='hud')
for(const[family,n]of Object.entries(result.byFamily).sort(
(a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]),
)){
const card=make('li','enemy-stats-card'),
info=make('div'),
count=make('strong'),
name=make('span');
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
name.textContent=enemyStatsFamilyLabel(family,lang);
info.append(count,name);
card.append(portrait,info);
grid.append(card);
}
}
filter.addEventListener('change',()=>{
selected=filter.value;
refresh();
});
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
const CELEBRATION_SECONDS=3.8;
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
canvas.hidden=value.phase!=='celebration'||reduced();
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
const VICTORY_CELEBRATION_MS=3800;
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
controller,
locale='en',
preferences=continuousPlayPreferences(),
}={}){
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
parent.append(root);
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
modules['game/ui/theme-family-controls.mjs']=(()=>{
const t=simGlobalI18n['t'];
const localizedText=simGlobalI18n['localizedText'];
const localizedAttribute=simGlobalI18n['localizedAttribute'];
const BUILTIN_THEME_FAMILIES=simGlobalThemes['BUILTIN_THEME_FAMILIES'];
const resolvePresentation=simGlobalThemes['resolvePresentation'];
const mountThemeMaterialPreview=
modules['game/ui/theme-material-preview.mjs']['mountThemeMaterialPreview'];

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
// Canonical source sha256: 567f2621fa80af1d0c6fd1b702bbcb288ef49e689af27e5dfcd85a9b4b68c29c
const sharedModeShell=(()=>{
// Dependency-free presentation shared with bundled simulator builds.
const GAME_MODE_ORDER=Object.freeze(['solo','team','versus','snake','simulator']);
const copy={
en:{
solo:'Solo',
team:'Team',
versus:'VS',
snake:'Snake',
simulator:'SIM',
mode:'Game mode',
},
uk:{
solo:'Соло',
team:'Разом',
versus:'VS',
snake:'Змійка',
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
const rows=GAME_MODE_ORDER.map((id)=>{
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
});
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
