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
export function createSimModeLinks({ document: doc, gameReturn, locale = () => 'en' }) {
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
  if (root)
    for (const [path, en, uk] of [
      [root.accepted.pathname.endsWith('/company.html') ? 'company.html' : '', 'Solo', 'Соло'],
      ['couch/', 'Versus', 'Двобій'],
      ['couch/relay-rescue.html', 'Team', 'Команда'],
      [null, 'FPV SIM', 'FPV SIM'],
      ['snake/play.html', 'Snake', 'Змійка'],
    ]) {
      const element = doc.createElement(path === null ? 'button' : 'a');
      element.dataset.modeTitleEn = en;
      element.dataset.modeTitleUk = uk;
      const refresh = () => {
        element.textContent = locale() === 'uk' ? uk : en;
      };
      refresh();
      if (path === null) {
        element.type = 'button';
        element.setAttribute('aria-current', 'page');
      } else {
        const target = new URL(root.base + path, root.accepted);
        const synchronize = () => {
          target.searchParams.set('lang', locale() === 'uk' ? 'uk' : 'en');
          for (const key of ['appearanceFamily', 'appearanceRevision'])
            if (root.accepted.searchParams.has(key))
              target.searchParams.set(key, root.accepted.searchParams.get(key));
          element.href = target.href;
          refresh();
        };
        synchronize();
        element.addEventListener('click', synchronize);
      }
      nav.append(element);
    }
  nav.refresh = () => {
    for (const element of nav.children)
      element.textContent =
        locale() === 'uk' ? element.dataset.modeTitleUk : element.dataset.modeTitleEn;
  };
  return nav;
}

// BEGIN GENERATED SHARED MODE SHELL
// Canonical source sha256: 751be3729b5a702525d629844eb59661673e9bc2a27b5589df7047ea9badab1d
const sharedModeShell=(()=>{
// Presentation only. Hosts own simulation, prepared attempts, sound and navigation.
// Services are injected so optional modes can project this exact source without
// adding another copy of the game runtime or a second controller/audio owner.
const COPY={
en:{
home:'Main menu',
missions:'Select Mission',
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
'missions',
'briefing',
'settings',
'expert',
'help',
'workshop',
'results',
];

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
retry:'play',
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
if(phase==='playing')open('home');
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
const menu=el('nav','mode-play-main-menu');
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
button('fullscreen',()=>actions.fullscreen?.()),
button('sound',()=>actions.toggleSound?.()),
);
home.append(edition,modes,mission,menu);
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
const retryHome=button('retry',()=>activate('retry'),false,'home-retry');
content.home.append(retryHome);
const navigation=services.attachModalNavigation?.({
document:doc,
getFallbackFocus:()=>buttons.menu,
});
if(navigation)cleanups.push(()=>navigation.destroy());
if(services.attachFullscreen){
buttons.fullscreen.setAttribute('data-fullscreen-label','');
cleanups.push(
services.attachFullscreen(buttons.fullscreen,doc,{escapeRoot:dialogs.home}),
);
}else buttons.fullscreen.hidden= !actions.fullscreen;
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
else if(node===buttons.sound)
value=`${COPY[language].sound}: ${COPY[language][state.muted?'off':'on']}`;
else if(node===briefingTitle)value=text(state.missionName)||value;
put(node,'textContent',value);
}
attribute(buttons.menu,'aria-label',COPY[language].menu);
put(modeLabel,'textContent',text(modeName));
put(edition,'textContent',text(modeName));
attribute(modes,'aria-label',COPY[language].modes);
attribute(menu,'aria-label',COPY[language].home);
put(mission,'textContent',text(state.missionName));
put(mission,'hidden',!mission.textContent);
put(briefingSummary,'textContent',text(state.summary)||text(state.missionName));
put(briefingSummary,'hidden',!briefingSummary.textContent);
put(buttons.pause,'disabled',!['playing','paused'].includes(state.phase));
attribute(buttons.sound,'aria-pressed',String(!state.muted));
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
if(name==='pause')name='home';
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
(name==='home'?buttons.primary:dialog.querySelector('h1')).focus({
preventScroll:true,
});
return true;
}
dialog.showModal();
removeFromStack(dialog);
stack.push(dialog);
onSurfaceChange(name);
(name==='home'?buttons.primary:dialog.querySelector('h1')).focus({
preventScroll:true,
});
return true;
}
function back(){
const dialog=topDialog();
if(!dialog|| !Object.values(dialogs).includes(dialog))return false;
if(dialog===dialogs.home){
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
};
function setLocale(next){
language=next==='uk'?'uk':'en';
update();
}
update();
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

return{mountModePlayShell};
})();
export const mountSimPlayShell=sharedModeShell.mountModePlayShell;
// END GENERATED SHARED MODE SHELL
