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
// One logical settings inventory. Hosts supply their existing preference owners;
// this view never opens storage, starts audio, or owns a game/profile lifecycle.
const GLOBAL_SETTINGS=Object.freeze(
[
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
// Canonical source sha256: 6601e3ecd0d3fd6ecc69670e90d774c2987f7e30321a7d8213f3ef700edce32c
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
   * start/resume/continue/retry run only after an explicit activation, after closing
   * owned dialogs. Hosts call update({phase}) after accepting the action.
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
:open('briefing'),
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
dialogs.missions.querySelector('footer').append(button('review',()=>open('briefing'),true));
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
put(buttons.pause,'disabled',!['playing','paused'].includes(state.phase));
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
enterPlay();
if(!alive)return;
(actions[action]??(action==='continue'?actions.resume:null))?.();
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
(name==='home'
?buttons.primary
:name==='pause'
?resume
:dialog.querySelector('h1')
).focus({
preventScroll:true,
});
return true;
}
dialog.showModal();
removeFromStack(dialog);
stack.push(dialog);
onSurfaceChange(name);
(name==='home'
?buttons.primary
:name==='pause'
?resume
:dialog.querySelector('h1')
).focus({preventScroll:true});
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
