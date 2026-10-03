// Presentation only. Hosts own simulation, prepared attempts, sound and navigation.
// Services are injected so optional modes can project this exact source without
// adding another copy of the game runtime or a second controller/audio owner.
const COPY = {
  en: {
    home: 'Main menu',
    missions: 'Select Mission',
    briefing: 'Mission briefing',
    settings: 'Settings',
    expert: 'Expert options',
    help: 'How to play',
    workshop: 'Workshop',
    results: 'Results',
    start: 'Start',
    continue: 'Continue',
    retry: 'Retry',
    review: 'Review mission',
    back: 'Back',
    menu: 'Menu',
    pause: 'Pause',
    resume: 'Resume',
    fullscreen: 'Full screen',
    sound: 'Sound',
    on: 'on',
    off: 'off',
    modes: 'Choose game mode',
  },
  uk: {
    home: 'Головне меню',
    missions: 'Вибрати місію',
    briefing: 'Перед польотом',
    settings: 'Налаштування',
    expert: 'Розширені налаштування',
    help: 'Як грати',
    workshop: 'Майстерня',
    results: 'Результати',
    start: 'Почати',
    continue: 'Продовжити',
    retry: 'Повторити',
    review: 'Переглянути місію',
    back: 'Назад',
    menu: 'Меню',
    pause: 'Пауза',
    resume: 'Продовжити',
    fullscreen: 'На весь екран',
    sound: 'Звук',
    on: 'увімкнено',
    off: 'вимкнено',
    modes: 'Вибрати режим гри',
  },
};
const SURFACES = [
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
export function mountModePlayShell({
  document: doc = globalThis.document,
  mount = doc.body,
  idPrefix = 'mode',
  modeName = '',
  locale = doc.documentElement.lang,
  slots = {},
  actions = {},
  services = {},
  wordmarkURL = '',
  version = '',
  initial = 'home',
  focusPlay = () => {},
  onSurfaceChange = () => {},
} = {}) {
  let language = locale === 'uk' ? 'uk' : 'en',
    alive = true,
    closing = false,
    opening = 0;
  let state = { phase: 'ready', missionName: '', summary: '', muted: false };
  const moved = [],
    cleanups = [],
    stack = [],
    dialogs = {},
    content = {},
    buttons = {};
  const labels = [];
  const text = (value) => {
    if (typeof value === 'function') return text(value(language));
    return typeof value === 'object' ? (value?.[language] ?? value?.en ?? '') : (value ?? '');
  };
  const el = (tag, className = '') => {
    const node = doc.createElement(tag);
    node.className = className;
    return node;
  };
  const listen = (node, type, fn) => {
    node.addEventListener(type, fn);
    cleanups.push(() => node.removeEventListener(type, fn));
  };
  const label = (node, key) => {
    labels.push([node, key]);
    return node;
  };
  const button = (key, handler, primary = false, name = key) => {
    const node = label(el('button', `button ${primary ? 'primary' : 'secondary'}`), key);
    node.type = 'button';
    node.id = `${idPrefix}-action-${name}`;
    node.dataset.modeAction = name;
    services.setMenuIcon?.(
      node,
      {
        review: 'missions',
        start: 'play',
        continue: 'play',
        retry: 'play',
        menu: 'back',
        pause: 'pause',
        expert: 'settings',
        workshop: 'content',
      }[key] ?? key,
    );
    listen(node, 'click', handler);
    buttons[name] = node;
    return node;
  };
  const move = (name, target) => {
    const value = slots[name];
    for (const node of value ? (Array.isArray(value) ? value : [value]) : []) {
      moved.push({ node, parent: node.parentNode, next: node.nextSibling });
      target.append(node);
    }
  };
  const root = el('section', 'mode-play-shell');
  root.dataset.modePlayShell = idPrefix;
  const hadPage = doc.body.classList.contains('mode-play-page');
  doc.body.classList.add('mode-play-page');
  const header = el('header', 'mode-play-bar');
  header.append(button('menu', () => open('home')));
  const modeLabel = el('span', 'mode-play-name');
  let pausePress = null;
  header.append(
    modeLabel,
    button('pause', (event) => {
      // Pointer focus can make the host pause before click. Honour the action
      // that was visible at press, never turn that same Pause press into Resume.
      const phase = event.detail > 0 && pausePress ? pausePress.phase : state.phase;
      pausePress = null;
      if (!['playing', 'paused'].includes(state.phase)) return;
      if (phase === 'playing') open('home');
      else if (phase === 'paused' && state.phase === 'paused') activate('resume');
    }),
  );
  listen(buttons.pause, 'pointerdown', (event) => {
    if ((event.button ?? 0) !== 0 || event.isPrimary === false) return;
    pausePress = { phase: state.phase, pointerId: event.pointerId };
  });
  listen(buttons.pause, 'pointercancel', (event) => {
    if (pausePress?.pointerId === event.pointerId) pausePress = null;
  });
  if (wordmarkURL) {
    const logo = el('img');
    logo.src = wordmarkURL;
    logo.alt = '';
    buttons.menu.replaceChildren(logo);
    buttons.menu.classList.add('mode-play-brand-button');
  }
  const stage = el('div', 'mode-play-stage');
  move('play', stage);
  root.append(header, stage);
  mount.append(root);
  for (const name of SURFACES) {
    const dialog = el('dialog', `mode-play-dialog${name === 'home' ? ' mode-play-home' : ''}`);
    dialog.id = `${idPrefix}-${name}-dialog`;
    dialog.dataset.modeSurface = name;
    const heading = label(el('h1'), name);
    heading.id = `${idPrefix}-${name}-title`;
    heading.tabIndex = -1;
    dialog.setAttribute('aria-labelledby', heading.id);
    const head = el('header', 'mode-play-dialog-head');
    head.append(heading);
    const body = el('div', 'mode-play-content');
    const footer = el('footer', 'mode-play-actions');
    dialogs[name] = dialog;
    content[name] = body;
    dialog.append(head, body, footer);
    root.append(dialog);
    if (name !== 'home') {
      move(name, body);
      footer.append(button('back', back, false, `${name}-back`));
    }
    listen(dialog, 'cancel', (event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      back();
    });
    listen(dialog, 'close', () => {
      if (dialog.open || closing || !alive) return;
      removeFromStack(dialog);
      onSurfaceChange(topDialog()?.dataset.modeSurface ?? 'play');
    });
  }
  const home = content.home;
  const title = dialogs.home.querySelector('h1');
  title.className = 'mode-play-wordmark';
  // The host supplies the same accepted wordmark used by the main title.
  labels.splice(
    labels.findIndex(([node]) => node === title),
    1,
  );
  title.textContent = 'FPV / LINE';
  if (slots.brand) {
    title.textContent = '';
    move('brand', title);
  } else if (wordmarkURL) {
    const logo = el('img');
    logo.src = wordmarkURL;
    logo.alt = 'FPV / LINE';
    title.replaceChildren(logo);
  }
  const edition = el('p', 'mode-play-edition');
  const modes = el('nav', 'mode-play-modes');
  move('modes', modes);
  const mission = el('p', 'mode-play-mission');
  const menu = el('nav', 'mode-play-main-menu');
  menu.dataset.menuScope = 'main';
  menu.append(
    button(
      'start',
      () =>
        state.phase === 'results'
          ? activate('retry')
          : resumable()
            ? activate(state.phase === 'paused' ? 'resume' : 'continue')
            : open('briefing'),
      true,
      'primary',
    ),
    button('missions', () => open('missions')),
    button('settings', () => open('settings')),
    button('fullscreen', () => actions.fullscreen?.()),
    button('sound', () => actions.toggleSound?.()),
  );
  home.append(edition, modes, mission, menu);
  if (version) {
    const build = el('p', 'mode-play-version');
    build.textContent = version;
    dialogs.home.querySelector('footer').append(build);
  }
  const briefingSummary = el('p', 'mode-play-summary');
  content.briefing.prepend(briefingSummary);
  dialogs.missions.querySelector('footer').append(button('review', () => open('briefing'), true));
  if (slots.expert || actions.open)
    dialogs.missions
      .querySelector('footer')
      .append(button('expert', () => open('expert'), false, 'missions-expert'));
  dialogs.briefing
    .querySelector('footer')
    .append(button('start', () => activate(state.phase === 'paused' ? 'resume' : 'start'), true));
  if (slots.help || actions.open)
    dialogs.briefing
      .querySelector('footer')
      .append(button('help', () => open('help'), false, 'briefing-help'));
  dialogs.results.querySelector('footer').append(button('retry', () => activate('retry'), true));
  for (const name of ['expert', 'help', 'workshop']) {
    if (slots[name] || actions.open) content.settings.append(button(name, () => open(name)));
  }
  const retryHome = button('retry', () => activate('retry'), false, 'home-retry');
  content.home.append(retryHome);
  const navigation = services.attachModalNavigation?.({
    document: doc,
    getFallbackFocus: () => buttons.menu,
  });
  if (navigation) cleanups.push(() => navigation.destroy());
  if (services.attachFullscreen) {
    buttons.fullscreen.setAttribute('data-fullscreen-label', '');
    cleanups.push(services.attachFullscreen(buttons.fullscreen, doc, { escapeRoot: dialogs.home }));
  } else buttons.fullscreen.hidden = !actions.fullscreen;
  buttons.sound.hidden = !actions.toggleSound;
  function resumable() {
    return state.canResume ?? !!actions.canResume?.();
  }
  function removeFromStack(dialog) {
    const index = stack.indexOf(dialog);
    if (index >= 0) stack.splice(index, 1);
  }
  function topDialog() {
    return navigation?.topDialog() ?? [...stack].reverse().find((dialog) => dialog.open) ?? null;
  }
  const put = (node, key, value) => {
    if (node[key] !== value) node[key] = value;
  };
  const attribute = (node, key, value) => {
    if (node.getAttribute(key) !== value) node.setAttribute(key, value);
  };
  function update(patch = {}) {
    if (!alive) return;
    state = { ...state, ...patch };
    put(root.dataset, 'phase', state.phase);
    const briefingTitle = dialogs.briefing.querySelector('h1');
    // HUD refreshes run during pointer activation. Unchanged text must keep its
    // native Text node; writing a default then a dynamic label also replaces it.
    for (const [node, key] of labels) {
      if ((key === 'fullscreen' && services.attachFullscreen) || (key === 'menu' && wordmarkURL))
        continue;
      let value = COPY[language][key];
      if (node === buttons.primary)
        value =
          COPY[language][state.phase === 'results' ? 'retry' : resumable() ? 'continue' : 'start'];
      else if (node === buttons.start)
        value = COPY[language][state.phase === 'paused' ? 'resume' : 'start'];
      else if (node === buttons.pause)
        value = COPY[language][state.phase === 'paused' ? 'resume' : 'pause'];
      else if (node === buttons.sound)
        value = `${COPY[language].sound}: ${COPY[language][state.muted ? 'off' : 'on']}`;
      else if (node === briefingTitle) value = text(state.missionName) || value;
      put(node, 'textContent', value);
    }
    attribute(buttons.menu, 'aria-label', COPY[language].menu);
    put(modeLabel, 'textContent', text(modeName));
    put(edition, 'textContent', text(modeName));
    attribute(modes, 'aria-label', COPY[language].modes);
    attribute(menu, 'aria-label', COPY[language].home);
    put(mission, 'textContent', text(state.missionName));
    put(mission, 'hidden', !mission.textContent);
    put(briefingSummary, 'textContent', text(state.summary) || text(state.missionName));
    put(briefingSummary, 'hidden', !briefingSummary.textContent);
    put(buttons.pause, 'disabled', !['playing', 'paused'].includes(state.phase));
    attribute(buttons.sound, 'aria-pressed', String(!state.muted));
    put(retryHome, 'hidden', state.phase !== 'paused');
  }
  function enterPlay() {
    if (!alive) return;
    opening++;
    closing = true;
    for (const dialog of [...stack].reverse()) if (dialog.open) dialog.close();
    stack.length = 0;
    closing = false;
    onSurfaceChange('play');
    // Closing a menu is presentation only; explicit Resume remains required.
    focusPlay();
  }
  function activate(action) {
    enterPlay();
    if (!alive) return;
    (actions[action] ?? (action === 'continue' ? actions.resume : null))?.();
  }
  function open(name = 'home') {
    if (!alive) return false;
    if (name === 'pause') name = 'home';
    const request = ++opening;
    if (name === 'play') {
      enterPlay();
      return true;
    }
    const dialog = dialogs[name];
    if (!dialog) throw new Error(`Unknown play surface: ${name}`);
    if (state.phase === 'playing') {
      update({ phase: 'paused' });
      actions.pause?.();
      if (!alive || request !== opening) return false;
    } else update();
    if (actions.open?.(name) === false || !alive || request !== opening) return false;
    if (dialog.open) {
      dialog.querySelector('h1').focus({ preventScroll: true });
      return true;
    }
    if (name === 'home') {
      closing = true;
      for (const prior of [...stack].reverse()) if (prior.open) prior.close();
      stack.length = 0;
      closing = false;
    }
    dialog.showModal();
    removeFromStack(dialog);
    stack.push(dialog);
    onSurfaceChange(name);
    (name === 'home' ? buttons.primary : dialog.querySelector('h1')).focus({ preventScroll: true });
    return true;
  }
  function back() {
    const dialog = topDialog();
    if (!dialog || !Object.values(dialogs).includes(dialog)) return false;
    if (dialog === dialogs.home) {
      if (!resumable()) return false;
      enterPlay();
      return true;
    }
    dialog.close();
    removeFromStack(dialog);
    if (!topDialog()) open(dialog === dialogs.briefing ? 'missions' : 'home');
    return true;
  }
  const elements = {
    root,
    header,
    stage,
    home: dialogs.home,
    title,
    dialogs,
    content,
    buttons,
    modes,
  };
  function setLocale(next) {
    language = next === 'uk' ? 'uk' : 'en';
    update();
  }
  update();
  if (initial !== 'play') open(initial);
  return {
    open,
    openHome: () => open('home'),
    enterPlay,
    back,
    update,
    topDialog,
    elements,
    setLocale,
    localize: setLocale,
    blocksPlay: () => !!topDialog(),
    dispose() {
      if (!alive) return;
      alive = false;
      closing = true;
      for (const dialog of Object.values(dialogs)) if (dialog.open) dialog.close();
      for (const cleanup of cleanups.reverse()) cleanup?.();
      for (const { node, parent, next } of moved.reverse()) {
        if (parent) parent.insertBefore(node, next?.parentNode === parent ? next : null);
        else node.remove();
      }
      root.remove();
      if (!hadPage) doc.body.classList.remove('mode-play-page');
    },
  };
}
