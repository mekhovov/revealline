import test from 'node:test';
import assert from 'node:assert/strict';
import { attachFullscreen } from '../ui/fullscreen.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { Document } from './helpers/couch-dom.mjs';

class Target {
  listeners = new Map();
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type);
    listeners?.delete(listener);
    if (listeners?.size === 0) this.listeners.delete(type);
  }
  async emit(type, event) {
    const results = [];
    for (const listener of this.listeners.get(type) ?? []) results.push(listener(event));
    await Promise.all(results);
  }
}

class Button extends Target {
  hidden = true;
  attributes = new Map();
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  hasAttribute(name) {
    return this.attributes.has(name);
  }
}

function fullscreenDocument() {
  const doc = new Target();
  const root = {
    dataset: {},
    async requestFullscreen(options) {
      doc.requestOptions = options;
      doc.fullscreenElement = root;
      await doc.emit('fullscreenchange');
    },
  };
  Object.assign(doc, {
    fullscreenEnabled: true,
    fullscreenElement: null,
    documentElement: root,
    async exitFullscreen() {
      doc.fullscreenElement = null;
      await doc.emit('fullscreenchange');
    },
  });
  return doc;
}

test('fullscreen control follows the browser state and exits through the same explicit control', async (t) => {
  const button = new Button();
  const doc = fullscreenDocument();
  const detach = attachFullscreen(button, doc);
  t.after(detach);

  assert.equal(button.hidden, false);
  assert.equal(button.getAttribute('aria-label'), 'Enter fullscreen');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(doc.documentElement.dataset.gameFullscreen, undefined);

  await button.emit('click');
  assert.equal(doc.fullscreenElement, doc.documentElement);
  assert.deepEqual(doc.requestOptions, { navigationUI: 'hide' });
  assert.equal(button.getAttribute('aria-label'), 'Exit fullscreen');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(doc.documentElement.dataset.gameFullscreen, 'true');

  await button.emit('click');
  assert.equal(doc.fullscreenElement, null);
  assert.equal(button.getAttribute('aria-label'), 'Enter fullscreen');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(doc.documentElement.dataset.gameFullscreen, undefined);
});

test('main-menu and Pause fullscreen controls stay synchronized', async (t) => {
  const menu = new Button(),
    pause = new Button(),
    doc = fullscreenDocument();
  menu.setAttribute('data-fullscreen-label', '');
  pause.setAttribute('data-fullscreen-label', '');
  const detachMenu = attachFullscreen(menu, doc, { allowInstallHelp: false }),
    detachPause = attachFullscreen(pause, doc, { allowInstallHelp: false });
  t.after(detachMenu);
  t.after(detachPause);

  assert.equal(menu.textContent, 'Full screen');
  assert.equal(pause.textContent, 'Full screen');
  await menu.emit('click');
  assert.equal(menu.textContent, 'Exit full screen');
  assert.equal(pause.textContent, 'Exit full screen');
  assert.equal(menu.getAttribute('aria-pressed'), 'true');
  assert.equal(pause.getAttribute('aria-pressed'), 'true');
  await pause.emit('click');
  assert.equal(menu.textContent, 'Full screen');
  assert.equal(pause.textContent, 'Full screen');
});

test('menu fullscreen controls hide instead of offering install help when unsupported', (t) => {
  const button = new Button(),
    doc = fullscreenDocument();
  doc.fullscreenEnabled = false;
  doc.defaultView = { navigator: { platform: 'iPhone' } };
  doc.getElementById = () => ({ open: false, showModal() {} });
  const detach = attachFullscreen(button, doc, { allowInstallHelp: false });
  t.after(detach);
  assert.equal(button.hidden, true);
});

test('shared fullscreen ownership preserves each control install-help policy and label', async (t) => {
  const doc = fullscreenDocument(),
    menu = new Button(),
    help = new Button();
  let opened = 0;
  const dialog = {
    open: false,
    showModal() {
      this.open = true;
      opened++;
    },
  };
  doc.fullscreenEnabled = false;
  doc.defaultView = { navigator: { platform: 'iPhone' } };
  doc.getElementById = (id) => (id === 'ios-home-screen-dialog' ? dialog : null);
  menu.setAttribute('data-fullscreen-label', '');
  help.setAttribute('data-fullscreen-label', '');
  const states = [];
  t.after(attachFullscreen(menu, doc, { allowInstallHelp: false, onState: (s) => states.push(s) }));
  t.after(attachFullscreen(help, doc));
  assert.equal(menu.hidden, true);
  assert.equal(help.hidden, false);
  assert.equal(menu.textContent, 'Full screen');
  assert.equal(help.textContent, 'Full screen help');
  assert.equal(states.at(-1).hidden, true);
  await menu.emit('click');
  assert.equal(opened, 0);
  const restrictHelp = attachFullscreen(help, doc, { allowInstallHelp: false });
  assert.equal(help.hidden, true);
  await help.emit('click');
  assert.equal(opened, 0);
  restrictHelp();
  assert.equal(help.hidden, false);
  await help.emit('click');
  assert.equal(opened, 1);
  assert.equal(doc.documentElement.dataset.gameFullscreen, undefined);
});

test('installed standalone PWAs report their display state without browser fullscreen', (t) => {
  const button = new Button();
  const doc = fullscreenDocument();
  const displayMode = new Target();
  displayMode.matches = true;
  doc.fullscreenEnabled = false;
  doc.defaultView = { matchMedia: () => displayMode };

  const detach = attachFullscreen(button, doc);
  t.after(detach);

  assert.equal(button.hidden, true);
  assert.equal(doc.documentElement.dataset.gameFullscreen, 'true');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
});

test('iOS Home Screen games report standalone display state', (t) => {
  const button = new Button();
  const doc = fullscreenDocument();
  doc.fullscreenEnabled = false;
  doc.defaultView = { navigator: { standalone: true } };

  const detach = attachFullscreen(button, doc);
  t.after(detach);

  assert.equal(button.hidden, true);
  assert.equal(doc.documentElement.dataset.gameFullscreen, 'true');
});

test('iPhone Safari offers the truthful Home Screen route instead of a dead fullscreen control', async (t) => {
  const button = new Button();
  const close = new Button();
  close.focus = (options) => (close.focusOptions = options);
  const dialog = {
    open: false,
    showModal() {
      this.open = true;
    },
  };
  const doc = new Target();
  doc.fullscreenEnabled = false;
  doc.documentElement = { dataset: {} };
  doc.defaultView = {
    navigator: { platform: 'iPhone', maxTouchPoints: 5, standalone: false },
  };
  doc.getElementById = (id) =>
    id === 'ios-home-screen-dialog' ? dialog : id === 'ios-home-screen-close' ? close : null;
  t.after(attachFullscreen(button, doc));

  assert.equal(button.hidden, false);
  assert.equal(button.getAttribute('aria-label'), 'Use full screen on iPhone or iPad');
  assert.equal(button.getAttribute('aria-pressed'), null);
  await button.emit('click');
  assert.equal(dialog.open, true);
  assert.deepEqual(close.focusOptions, { preventScroll: true });
  assert.equal(doc.documentElement.dataset.gameFullscreen, undefined);
});

test('touch-capable iPad desktop identity receives the same Home Screen route', () => {
  const button = new Button();
  const dialog = { open: false, showModal() {} };
  const doc = new Target();
  doc.fullscreenEnabled = false;
  doc.documentElement = { dataset: {} };
  doc.defaultView = {
    navigator: { platform: 'MacIntel', maxTouchPoints: 5, standalone: false },
  };
  doc.getElementById = (id) => (id === 'ios-home-screen-dialog' ? dialog : null);
  const detach = attachFullscreen(button, doc);
  assert.equal(button.hidden, false);
  detach();
  assert.equal(button.listeners.size, 0);
});

test('display-mode changes update state and detach releases the listener', async () => {
  const button = new Button();
  const doc = fullscreenDocument();
  const displayMode = new Target();
  displayMode.matches = false;
  doc.fullscreenEnabled = false;
  doc.defaultView = { matchMedia: () => displayMode };
  const detach = attachFullscreen(button, doc);

  displayMode.matches = true;
  await displayMode.emit('change');
  assert.equal(doc.documentElement.dataset.gameFullscreen, 'true');
  displayMode.matches = false;
  await displayMode.emit('change');
  assert.equal(doc.documentElement.dataset.gameFullscreen, undefined);
  detach();
  assert.equal(displayMode.listeners.size, 0);
});

test('unsupported browsers retain their responsive game layout without an inoperable control', () => {
  const button = new Button();
  const doc = new Target();
  doc.fullscreenEnabled = false;
  doc.documentElement = { dataset: {} };

  const detach = attachFullscreen(button, doc);
  assert.equal(button.hidden, true);
  assert.equal(button.listeners.size, 0);
  detach();
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test('fullscreen retry clears a prior denial only after an accepted transition', async (t) => {
  const button = new Button();
  const doc = fullscreenDocument();
  const request = doc.documentElement.requestFullscreen;
  doc.documentElement.requestFullscreen = async () => {
    throw new Error('Gesture denied');
  };
  t.after(attachFullscreen(button, doc));
  await button.emit('click');
  assert.match(button.title, /unavailable/);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  doc.documentElement.requestFullscreen = request;
  await button.emit('click');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(button.title, '', 'An accepted retry must retire the old denial.');
});

test('repeated activation while fullscreen is pending sends one browser request', async (t) => {
  const button = new Button();
  const doc = fullscreenDocument();
  const gate = deferred();
  let requests = 0;
  doc.documentElement.requestFullscreen = () => {
    requests++;
    return gate.promise;
  };
  t.after(attachFullscreen(button, doc));
  const first = button.emit('click');
  const second = button.emit('click');
  assert.equal(requests, 1, 'Touch/controller repetition cannot queue competing transitions.');
  doc.fullscreenElement = doc.documentElement;
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  await button.emit('click');
  assert.equal(
    button.getAttribute('aria-pressed'),
    'false',
    'Next deliberate activation can exit.',
  );
});

for (const outcome of ['resolve', 'reject']) {
  test(`retired fullscreen owner ignores a late ${outcome} after replacement`, async () => {
    const button = new Button();
    const doc = fullscreenDocument();
    const gate = deferred();
    doc.documentElement.requestFullscreen = () => gate.promise;
    const detach = attachFullscreen(button, doc);
    const pending = button.emit('click');
    detach();
    button.title = 'Replacement owner';
    button.setAttribute('aria-label', 'Replacement control');
    if (outcome === 'reject') gate.reject(new Error('Late denial'));
    else gate.resolve();
    await pending;
    assert.equal(button.title, 'Replacement owner');
    assert.equal(button.getAttribute('aria-label'), 'Replacement control');
    assert.equal(button.listeners.size, 0);
    assert.equal(doc.listeners.size, 0);
  });
}

test('landing and Settings share one pending browser request and follow native Escape', async (t) => {
  const landing = new Button(),
    settings = new Button(),
    doc = fullscreenDocument();
  const gate = deferred();
  let requests = 0;
  doc.documentElement.requestFullscreen = () => {
    requests++;
    return gate.promise;
  };
  const detachLanding = attachFullscreen(landing, doc),
    detachSettings = attachFullscreen(settings, doc),
    detachExistingHost = attachFullscreen(settings, doc);
  t.after(() => {
    detachLanding();
    detachSettings();
    detachExistingHost();
  });
  const first = landing.emit('click');
  await settings.emit('click');
  await landing.emit('click');
  assert.equal(requests, 1, 'different controls and repeated Enter share the pending operation');
  doc.fullscreenElement = doc.documentElement;
  await doc.emit('fullscreenchange');
  gate.resolve();
  await first;
  for (const button of [landing, settings]) {
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(button.getAttribute('aria-label'), 'Exit fullscreen');
  }
  // Escape is owned by the browser; no game menu event must fabricate this state.
  doc.fullscreenElement = null;
  await doc.emit('fullscreenchange');
  assert.equal(landing.getAttribute('aria-pressed'), 'false');
  assert.equal(settings.getAttribute('aria-label'), 'Enter fullscreen');
  detachSettings();
  assert.equal(settings.listeners.size, 1, 'the original host still owns its registration');
  detachExistingHost();
  assert.equal(settings.listeners.size, 0);
  assert.equal(doc.listeners.size, 1, 'the landing keeps one shared fullscreen listener');
  detachLanding();
  assert.equal(doc.listeners.size, 0);
});

test('mirrored controls expose the same denied request without claiming fullscreen succeeded', async (t) => {
  const landing = new Button(),
    settings = new Button(),
    doc = fullscreenDocument();
  const states = [];
  doc.documentElement.requestFullscreen = async () => {
    throw new TypeError('No transient activation');
  };
  t.after(attachFullscreen(landing, doc, { onState: (state) => states.push(state) }));
  t.after(attachFullscreen(settings, doc));
  await landing.emit('click');
  assert.equal(doc.fullscreenElement, null);
  assert.equal(landing.getAttribute('aria-pressed'), 'false');
  assert.equal(settings.getAttribute('aria-pressed'), 'false');
  assert.equal(landing.title, settings.title);
  assert.match(states.at(-1).message, /unavailable/);
});

test('locale changes refresh every registered label and status without another browser request', async (t) => {
  const locale = getLocale(),
    doc = fullscreenDocument(),
    landing = new Button(),
    settings = new Button();
  t.after(() => setLocale(locale));
  t.after(attachFullscreen(landing, doc));
  t.after(attachFullscreen(settings, doc));
  await setLocale('uk');
  assert.equal(landing.getAttribute('aria-label'), 'На повний екран');
  assert.equal(settings.getAttribute('aria-label'), 'На повний екран');
  assert.equal(doc.fullscreenElement, null);
});

test('document teardown releases shared registrations while a retained page keeps its owner', async () => {
  const doc = fullscreenDocument(),
    win = new Target(),
    landing = new Button(),
    settings = new Button();
  doc.defaultView = win;
  attachFullscreen(landing, doc);
  attachFullscreen(settings, doc);
  await win.emit('pagehide', { persisted: true });
  assert.equal(landing.listeners.size, 1);
  await win.emit('pagehide', { persisted: false });
  assert.equal(landing.listeners.size, 0);
  assert.equal(settings.listeners.size, 0);
  assert.equal(doc.listeners.size, 0);
  assert.equal(win.listeners.size, 0);
});

test('landing Escape never takes ownership of gameplay, Settings or a hidden menu', async (t) => {
  const doc = new Document();
  doc.parentNode = doc.defaultView;
  const landing = doc.createElement('section'),
    button = doc.createElement('button'),
    outside = doc.createElement('button');
  landing.append(button);
  doc.body.append(landing, outside);
  doc.fullscreenEnabled = true;
  doc.fullscreenElement = doc.documentElement;
  doc.documentElement.requestFullscreen = async () => {};
  let exits = 0;
  doc.exitFullscreen = async () => {
    exits++;
  };
  t.after(attachFullscreen(button, doc, { escapeRoot: landing }));
  outside.focus();
  assert.equal(outside.emit('keydown', { key: 'Escape' }).defaultPrevented, false);
  button.focus();
  landing.hidden = true;
  assert.equal(button.emit('keydown', { key: 'Escape' }).defaultPrevented, false);
  landing.hidden = false;
  doc.fullscreenElement = null;
  assert.equal(button.emit('keydown', { key: 'Escape' }).defaultPrevented, false);
  assert.equal(exits, 0);
});

test('landing Escape during a pending entrance exits once after that request settles', async (t) => {
  const doc = new Document();
  doc.parentNode = doc.defaultView;
  const landing = doc.createElement('section'),
    button = doc.createElement('button');
  landing.append(button);
  doc.body.append(landing);
  doc.fullscreenEnabled = true;
  const gate = deferred();
  doc.documentElement.requestFullscreen = () => {
    doc.fullscreenElement = doc.documentElement;
    return gate.promise;
  };
  let exits = 0;
  doc.exitFullscreen = async () => {
    exits++;
    doc.fullscreenElement = null;
    doc.emit('fullscreenchange');
  };
  t.after(attachFullscreen(button, doc, { escapeRoot: landing }));
  button.focus();
  button.click();
  assert.equal(button.emit('keydown', { key: 'Escape', repeat: false }).defaultPrevented, true);
  assert.equal(button.emit('keydown', { key: 'Escape', repeat: true }).defaultPrevented, true);
  assert.equal(exits, 0, 'the current browser operation retains its single owner');
  gate.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(exits, 1);
  assert.equal(doc.fullscreenElement, null);
  assert.equal(button.emit('keyup', { key: 'Escape' }).defaultPrevented, true);
});
