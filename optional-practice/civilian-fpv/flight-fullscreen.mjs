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
