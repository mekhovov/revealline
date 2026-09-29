import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';

const html = await readFile(
  new URL('../../authoring/enemy-catalog/index.html', import.meta.url),
  'utf8',
);
const themes = await readFile(new URL('../content/themes.json', import.meta.url), 'utf8');
let instance = 0;
const until = (predicate) =>
  waitFor(predicate, { message: 'Enemy workshop did not reach the expected state.' });

// Finite DOM/native-default boundary for the actual workshop module. Canvas
// painting, browser layout, modal Tab traversal and child gameplay are outside
// this fixture. Page Tab models the visible controls' DOM order only; the
// existing practice-return test exercises the actual child.
function mount(doc) {
  const stack = [doc.body];
  for (const [token] of html
    .split(/<body\b[^>]*>/)[1]
    .split('</body>')[0]
    .matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) {
      stack.at(-1)._text = (stack.at(-1)._text || '') + token.trim();
      continue;
    }
    const tag = token.match(/^<([\w-]+)/)[1],
      el = doc.createElement(tag);
    for (const [, name, quoted, bare] of token
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      el.setAttribute(name, value);
      if (name === 'class') el.className = value;
      if (['type', 'value'].includes(name)) el[name] = value;
      if (['hidden', 'disabled', 'checked', 'inert'].includes(name)) el[name] = true;
    }
    stack.at(-1).append(el);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(el);
  }
}

async function workshop(
  t,
  url = 'https://example.test/revealline/releases/v0.60.8/site/authoring/enemy-catalog/',
  context = null,
) {
  const doc = new Document(),
    win = new Events(),
    callbacks = new Map();
  class HostElement extends Element {
    getContext() {
      return context;
    }
    prepend(child) {
      this.append(child);
      this.children.unshift(this.children.pop());
    }
    showModal() {
      this.open = true;
      this.setAttribute('open', '');
    }
    close() {
      this.open = false;
      this.removeAttribute('open');
      if (this.contains(doc.activeElement)) doc.activeElement = doc.body;
      this.emit('close');
    }
    focus() {
      if (this.disabled || this.closest('[hidden],[inert]')) return;
      const dialog = this.closest('dialog');
      if (dialog && !dialog.open) return;
      super.focus();
    }
  }
  doc.createElement = (tag) => new HostElement(doc, tag);
  mount(doc);
  win.location = { href: url };
  win.crypto = globalThis.crypto;
  const pad = {
    index: 0,
    id: 'Modeled workshop controller',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const storage = () => {
    const values = new Map(),
      writes = [];
    return {
      writes,
      entries: () => [...values],
      seed: (key, value) => values.set(key, String(value)),
      getItem: (key) => values.get(key) ?? null,
      setItem(key, value) {
        writes.push([key, value]);
        values.set(key, String(value));
      },
    };
  };
  const local = storage(),
    session = storage(),
    navigations = [],
    requests = [];
  let resolveThemes,
    resolveBody,
    bodyPending = false,
    raf = 0,
    now = 0;
  const themeGate = new Promise((resolve) => {
    resolveThemes = resolve;
  });
  const bodyGate = new Promise((resolve) => {
    resolveBody = resolve;
  });
  const globals = {
    document: doc,
    window: win,
    localStorage: local,
    sessionStorage: session,
    navigator: { getGamepads: () => [pad] },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame(fn) {
      callbacks.set(++raf, fn);
      return raf;
    },
    cancelAnimationFrame(id) {
      callbacks.delete(id);
    },
    fetch: async (path) => {
      requests.push(path);
      assert.equal(path, '../../game/content/themes.json');
      return themeGate;
    },
  };
  const previous = Object.fromEntries(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => {
    win.emit('pagehide', { persisted: false });
    for (const [key, descriptor] of Object.entries(previous))
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  const $ = (id) => doc.getElementById(id);
  const back = $('return-game');
  assert.ok(back, 'The actual workshop has an explicit native Return to game action.');
  assert.equal(back.tagName, 'A');
  // Observe native navigation activation without leaving the modeled document.
  // Resolution uses the actual href and page URL, not a guessed global game URL.
  back.addEventListener('click', (event) => {
    event.preventDefault();
    navigations.push(new URL(back.getAttribute('href'), url).href);
  });
  const frame = () => {
    now += 16;
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach((fn) => fn(now));
  };
  const key = (value) => {
    const target = doc.activeElement;
    const event = target.emit('keydown', { key: value });
    if (!event.defaultPrevented && value === 'Enter' && ['A', 'BUTTON'].includes(target.tagName))
      target.click();
    if (!event.defaultPrevented && value === 'Escape')
      doc.querySelector('dialog[open]')?.emit('cancel');
    if (!event.defaultPrevented && value === 'Tab' && !doc.querySelector('dialog[open]')) {
      const controls = doc
        .querySelectorAll('button,a[href]')
        .filter((element) => !element.disabled && !element.closest('dialog,[hidden],[inert]'));
      const current = controls.indexOf(target);
      if (current >= 0) controls[(current + 1) % controls.length].focus();
    }
    return event;
  };
  const start = () =>
    import(`../../authoring/enemy-catalog/workshop.mjs?return-host=${++instance}`);
  const resolve = (status = 200, { holdBody = false } = {}) => {
    const response = new Response(status === 200 ? themes : '', { status });
    if (holdBody)
      response.json = () => {
        bodyPending = true;
        return bodyGate;
      };
    resolveThemes(response);
  };
  return {
    doc,
    win,
    $,
    back,
    local,
    session,
    requests,
    navigations,
    pad,
    frame,
    pendingFrames: () => callbacks.size,
    key,
    start,
    resolve,
    bodyPending: () => bodyPending,
    releaseBody: () => resolveBody(JSON.parse(themes)),
    message: () => $('catalog-host-status').querySelector('.operation-status-label').textContent,
    tap(index) {
      pad.buttons[index] = { pressed: true, value: 1 };
      frame();
      pad.buttons[index] = { pressed: false, value: 0 };
      frame();
    },
    async ready() {
      await start();
      resolve();
      await until(() => !$('open-catalog').disabled);
      // Existing draft/Back tests exercise an explicit opener, not programmatic
      // focus on a disabled button before the module has started.
      if ($('enemy-catalog-dialog').open) $('enemy-catalog-back').click();
      $('open-catalog').focus();
      $('open-catalog').click();
      assert.equal($('enemy-catalog-dialog').open, true);
    },
  };
}

for (const [base, expected] of [
  ['http://localhost:8000/authoring/enemy-catalog/', 'http://localhost:8000/game/'],
  [
    'https://example.test/revealline/releases/v0.60.8/site/authoring/enemy-catalog/',
    'https://example.test/revealline/releases/v0.60.8/site/game/',
  ],
])
  test(`native Return remains available before loading and after theme failure: ${base}`, async (t) => {
    const h = await workshop(t, base);
    assert.equal(h.back.textContent, 'Return to game');
    assert.equal(h.back.closest('[hidden],[inert],[disabled]'), null);
    assert.equal(h.$('open-catalog').disabled, true);
    assert.equal(h.requests.length, 0);
    h.back.focus();
    h.key('Enter');
    assert.deepEqual(h.navigations, [expected]);
    await h.start();
    assert.match(h.message(), /Loading registered themes/);
    assert.equal(h.$('open-catalog').disabled, true);
    h.back.focus();
    h.key('Enter');
    assert.deepEqual(h.navigations, [expected, expected]);
    h.resolve(503);
    await until(() => /Workshop unavailable/.test(h.message()));
    assert.equal(h.back.isConnected, true);
    assert.equal(h.back.closest('[hidden],[inert],[disabled]'), null);
    assert.equal(h.$('open-catalog').disabled, true);
    h.back.focus();
    h.key('Enter');
    assert.deepEqual(h.navigations, [expected, expected, expected]);
    assert.deepEqual(h.local.writes, []);
    assert.deepEqual(h.session.writes, []);
    assert.deepEqual(h.requests, ['../../game/content/themes.json']);
  });

test('workshop modal Back keeps its draft before a separate keyboard Return to game', async (t) => {
  const h = await workshop(t);
  await h.ready();
  h.$('enemy-catalog-role').value = 'eroder';
  h.$('enemy-catalog-role').onchange();
  h.$('enemy-catalog-skin').value = 'ukraine';
  h.$('enemy-catalog-skin').onchange();
  assert.equal(h.doc.activeElement, h.$('enemy-catalog-role'));
  h.key('Escape');
  assert.equal(h.$('enemy-catalog-dialog').open, false);
  assert.equal(h.doc.activeElement, h.$('open-catalog'));
  assert.deepEqual(h.navigations, [], 'Modal Back does not leave the workshop.');
  h.key('Enter');
  assert.equal(h.$('enemy-catalog-dialog').open, true);
  assert.equal(h.$('enemy-catalog-role').value, 'eroder');
  assert.equal(h.$('enemy-catalog-skin').value, 'ukraine');
  h.$('enemy-catalog-back').focus();
  h.key('Enter');
  assert.equal(h.$('enemy-catalog-dialog').open, false);
  h.back.focus();
  h.key('Enter');
  assert.deepEqual(h.navigations, ['https://example.test/revealline/releases/v0.60.8/site/game/']);
  assert.deepEqual(h.local.writes, []);
  assert.deepEqual(h.session.writes, []);
});

test('ready controller navigation keeps modal ownership then activates the page Return link explicitly', async (t) => {
  const h = await workshop(t);
  await h.ready();
  h.frame();
  h.tap(0);
  for (let i = 0; i < 5; i++) {
    h.tap(13);
    assert.ok(h.$('enemy-catalog-dialog').contains(h.doc.activeElement));
  }
  assert.deepEqual(h.navigations, []);
  h.tap(1);
  assert.equal(h.$('enemy-catalog-dialog').open, false);
  assert.deepEqual(h.navigations, []);
  for (let i = 0; i < 8 && h.doc.activeElement !== h.back; i++) h.tap(13);
  assert.equal(h.doc.activeElement, h.back);
  assert.deepEqual(h.navigations, [], 'Highlighting the page action never navigates.');
  h.tap(0);
  assert.deepEqual(h.navigations, ['https://example.test/revealline/releases/v0.60.8/site/game/']);
  assert.deepEqual(h.local.writes, []);
  assert.deepEqual(h.session.writes, []);
});

test('focused practice keeps parent controls idle and authenticated return restores the draft', async (t) => {
  const h = await workshop(t);
  await h.ready();
  h.$('enemy-catalog-role').value = 'eroder';
  h.$('enemy-catalog-role').onchange();
  h.$('enemy-catalog-skin').value = 'ukraine';
  h.$('enemy-catalog-skin').onchange();
  await h.$('enemy-catalog-play').onclick();
  const child = h.$('catalog-practice');
  await until(() => h.doc.activeElement === child);
  assert.equal(child.hidden, false);
  assert.equal(h.$('enemy-catalog-dialog').open, false);
  const launch = new URL(child.src);
  assert.equal(launch.pathname, '/revealline/releases/v0.60.8/site/game/');
  assert.equal(launch.searchParams.get('practice'), '1');
  assert.equal(h.session.writes.length, 1);
  assert.equal(h.session.writes[0][0], 'revealline.playground.current');
  assert.equal(JSON.parse(h.session.writes[0][1]).level.id, 'catalog-eroder');
  h.pad.buttons[0] = { pressed: true, value: 1 };
  h.frame();
  h.frame();
  assert.equal(h.doc.activeElement, child);
  assert.equal(h.$('enemy-catalog-dialog').open, false);
  assert.deepEqual(h.navigations, []);
  child.contentWindow = {};
  h.win.emit('message', {
    source: child.contentWindow,
    origin: launch.origin,
    data: {
      format: 'revealline.enemy-workshop-return.v1',
      session: launch.searchParams.get('enemy-workshop-session'),
    },
  });
  assert.equal(child.hidden, true);
  assert.equal(child.src, 'about:blank');
  assert.equal(h.$('enemy-catalog-dialog').open, true);
  assert.equal(h.doc.activeElement, h.$('enemy-catalog-role'));
  h.frame();
  h.frame();
  assert.equal(
    h.doc.activeElement,
    h.$('enemy-catalog-role'),
    'Held child Confirm cannot activate the parent page exit.',
  );
  assert.equal(h.$('enemy-catalog-role').value, 'eroder');
  assert.equal(h.$('enemy-catalog-skin').value, 'ukraine');
  assert.deepEqual(h.navigations, []);
  assert.deepEqual(
    h.local.writes,
    [],
    'Neither explicit return path implicitly applies authoring choices.',
  );
  assert.equal(h.session.writes.length, 1);
});

function pendingListeners(h) {
  return [h.doc, h.win].flatMap((target) =>
    [...target.captureListeners].flatMap(([type, handlers]) =>
      [...handlers].map((handler) => ({ target, type, handler })),
    ),
  );
}
function assertRetired(listeners) {
  for (const { target, type, handler } of listeners)
    assert.equal(target.captureListeners.get(type)?.has(handler), false, `${type} lease retired`);
}

test('ordinary foreground startup still opens the panel once and retires loading listeners', async (t) => {
  const h = await workshop(t);
  await h.start();
  const listeners = pendingListeners(h);
  h.resolve();
  await until(() => h.$('enemy-catalog-dialog')?.open);
  assert.equal(h.doc.activeElement, h.$('enemy-catalog-role'));
  assertRetired(listeners);
  h.$('enemy-catalog-back').click();
  h.frame();
  h.frame();
  assert.equal(h.$('enemy-catalog-dialog').open, false);
  assert.equal(h.doc.activeElement, h.$('open-catalog'));
  assert.deepEqual(h.navigations, []);
});

for (const close of ['Escape', 'Back'])
  test(`startup catalog ${close} returns to Open workshop before forward Tab`, async (t) => {
    const h = await workshop(t);
    await h.start();
    h.resolve();
    await until(() => h.$('enemy-catalog-dialog')?.open);
    h.$('enemy-catalog-skin').focus();
    if (close === 'Escape') h.key('Escape');
    else h.$('enemy-catalog-back').click();
    assert.equal(h.$('enemy-catalog-dialog').open, false);
    assert.equal(h.doc.activeElement, h.$('open-catalog'));
    h.key('ArrowRight');
    assert.equal(h.doc.activeElement, h.$('open-catalog'), 'The page keeps native arrow behavior.');
    h.key('Tab');
    assert.equal(h.doc.activeElement.getAttribute('href'), '../../game/playground/');
    h.key('Tab');
    assert.equal(h.doc.activeElement, h.back);
    h.key('Escape');
    h.frame();
    h.tap(1);
    h.tap(1);
    assert.equal(
      h.doc.activeElement,
      h.back,
      'A repeated Back cannot revive the closed return target.',
    );
    assert.deepEqual(h.local.writes, []);
    assert.deepEqual(h.session.writes, []);
    assert.deepEqual(h.navigations, []);
  });

for (const timing of ['before module', 'during loading'])
  test(`successful readiness preserves Return focus chosen ${timing}`, async (t) => {
    const h = await workshop(t);
    if (timing === 'before module') h.back.focus();
    await h.start();
    const listeners = pendingListeners(h);
    if (timing === 'during loading') h.back.focus();
    h.resolve();
    await until(() => !h.$('open-catalog').disabled);
    h.frame();
    h.frame();
    assert.equal(h.$('enemy-catalog-dialog').open, false);
    assert.equal(h.doc.activeElement, h.back);
    assertRetired(listeners);
    h.key('Enter');
    assert.deepEqual(h.navigations, [
      'https://example.test/revealline/releases/v0.60.8/site/game/',
    ]);
    assert.deepEqual(h.local.writes, []);
    assert.deepEqual(h.session.writes, []);
  });

for (const [name, retire] of [
  [
    'focus then return to body',
    (h) => {
      h.back.focus();
      h.back.blur();
    },
  ],
  ['keyboard intent', (h) => h.doc.body.emit('keydown', { key: 'Tab' })],
  ['pointer intent', (h) => h.doc.body.emit('pointerdown')],
  [
    'blur and refocus',
    (h) => {
      h.doc.focused = false;
      h.win.emit('blur');
      h.doc.focused = true;
    },
  ],
  [
    'hide and show',
    (h) => {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
      h.doc.hidden = false;
      h.doc.emit('visibilitychange');
    },
  ],
  [
    'pagehide and pageshow',
    (h) => {
      h.win.emit('pagehide', { persisted: true });
      h.win.emit('pageshow', { persisted: true });
    },
  ],
])
  test(`late readiness cannot revive retired opening after ${name}`, async (t) => {
    const h = await workshop(t);
    await h.start();
    const listeners = pendingListeners(h);
    retire(h);
    h.resolve();
    await until(() => !h.$('open-catalog').disabled);
    h.frame();
    assert.equal(h.$('enemy-catalog-dialog').open, false);
    assert.equal(h.doc.activeElement, h.doc.body);
    assertRetired(listeners);
    // A later explicit choice retains the ordinary workshop behavior.
    h.$('open-catalog').focus();
    h.key('Enter');
    assert.equal(h.$('enemy-catalog-dialog').open, true);
    h.$('enemy-catalog-back').click();
    assert.equal(h.doc.activeElement, h.$('open-catalog'));
  });

test('theme failure retires the startup lease and retains the existing reload/Return recovery', async (t) => {
  const h = await workshop(t);
  await h.start();
  const listeners = pendingListeners(h);
  h.resolve(503);
  await until(() => /Workshop unavailable/.test(h.message()));
  assertRetired(listeners);
  assert.match(h.message(), /Reload this page to retry/);
  assert.equal(h.$('open-catalog').disabled, true);
  h.back.focus();
  h.key('Enter');
  assert.equal(h.navigations.length, 1);
});

for (const status of [200, 503])
  test(`terminal departure prevents late startup and feedback after theme status ${status}`, async (t) => {
    const h = await workshop(t);
    await h.start();
    const listeners = pendingListeners(h),
      message = h.message();
    h.win.emit('pagehide', { persisted: false });
    assertRetired(listeners);
    h.resolve(status);
    await new Promise(setImmediate);
    assert.equal(h.$('open-catalog').disabled, true);
    assert.equal(h.$('enemy-catalog-dialog'), null);
    assert.equal(h.pendingFrames(), 0);
    assert.equal(h.message(), message);
  });

for (const status of [200, 503])
  test(`persisted departure defers theme status ${status} until restoration without auto-open`, async (t) => {
    const h = await workshop(t);
    await h.start();
    const listeners = pendingListeners(h);
    h.back.focus();
    h.win.emit('pagehide', { persisted: true });
    h.resolve(status);
    await new Promise(setImmediate);
    assert.equal(h.$('open-catalog').disabled, true);
    assert.equal(h.$('enemy-catalog-dialog'), null);
    assert.equal(h.pendingFrames(), 0);
    assert.match(h.message(), /Loading registered themes/);
    h.win.emit('pageshow', { persisted: true });
    await until(() =>
      status === 200 ? !h.$('open-catalog').disabled : /Workshop unavailable/.test(h.message()),
    );
    h.frame();
    assertRetired(listeners);
    assert.equal(h.$('enemy-catalog-dialog')?.open || false, false);
    assert.equal(h.doc.activeElement, h.back);
    h.key('Enter');
    assert.equal(h.navigations.length, 1);
  });

test('terminal departure during theme body decoding prevents late owner initialization', async (t) => {
  const h = await workshop(t);
  await h.start();
  h.resolve(200, { holdBody: true });
  await until(h.bodyPending);
  const listeners = pendingListeners(h),
    message = h.message();
  h.win.emit('pagehide', { persisted: false });
  assertRetired(listeners);
  h.releaseBody();
  await new Promise(setImmediate);
  assert.equal(h.$('open-catalog').disabled, true);
  assert.equal(h.$('enemy-catalog-dialog'), null);
  assert.equal(h.pendingFrames(), 0);
  assert.equal(h.message(), message);
});

// The HTML-selected shared owner runs alongside the real catalog host. These
// modeled storage, media and cached-page events do not claim native font/layout
// or BFCache coverage; canvas commands only prove the real reduction consumer.
async function readingWorkshop(
  t,
  initial = { textFace: 'plain', textSize: 'large', reducedEffects: true },
) {
  const paints = [],
    context = { globalAlpha: 1 };
  for (const method of [
    'clearRect',
    'save',
    'restore',
    'translate',
    'rotate',
    'scale',
    'fillRect',
    'beginPath',
    'arc',
    'stroke',
    'moveTo',
    'lineTo',
    'drawImage',
  ])
    context[method] = (...args) => paints.push([method, ...args]);
  const h = await workshop(t, undefined, context),
    media = Object.assign(new Events(), { matches: false }),
    timers = new Map();
  let timerSerial = 0;
  h.local.seed(DISPLAY_PREFERENCES_KEY, JSON.stringify(initial));
  h.win.localStorage = h.local;
  h.win.matchMedia = () => media;
  h.win.setTimeout = (fn, ms) => {
    assert.equal(ms, 0);
    timers.set(++timerSerial, fn);
    return timerSerial;
  };
  h.win.clearTimeout = (id) => timers.delete(id);
  h.doc.defaultView = h.win;
  const htmlURL = new URL('../../authoring/enemy-catalog/index.html', import.meta.url),
    entries = [...html.matchAll(/<script\s+type="module"\s+src="([^"]+)"/g)]
      .map((match) => new URL(match[1], htmlURL))
      .filter((url) => url.pathname.endsWith('/tool-display-entry.mjs'));
  for (const url of entries) {
    url.searchParams.set('enemy-reading-host', String(++instance));
    await import(url.href);
  }
  return {
    ...h,
    entries,
    media,
    timers,
    paints,
    external(value, notify = true) {
      const raw = JSON.stringify(value);
      h.local.seed(DISPLAY_PREFERENCES_KEY, raw);
      if (notify)
        h.win.emit('storage', {
          key: DISPLAY_PREFERENCES_KEY,
          newValue: raw,
          storageArea: h.local,
        });
    },
    flush() {
      for (const [id, fn] of [...timers]) {
        timers.delete(id);
        fn();
      }
    },
  };
}
function readingState(h) {
  const { textFace, textSize, effects } = h.doc.body.dataset;
  return { textFace, textSize, effects };
}
const largePlainReduced = { textFace: 'plain', textSize: 'large', effects: 'reduced' };

test('Enemy reading entry adopts shared Large/Plain before catalog readiness without writes or focus', async (t) => {
  const h = await readingWorkshop(t);
  assert.deepEqual(readingState(h), largePlainReduced);
  assert.equal(h.entries.length, 1);
  assert.equal(h.doc.activeElement, h.doc.body);
  assert.equal(h.$('open-catalog').disabled, true);
  assert.equal(h.$('enemy-catalog-dialog'), null);
  assert.equal(h.requests.length, 0);
  const before = h.local.entries();
  h.back.focus();
  await h.start();
  assert.deepEqual(readingState(h), largePlainReduced);
  assert.equal(h.doc.activeElement, h.back);
  h.resolve();
  await until(() => !h.$('open-catalog').disabled);
  assert.equal(h.$('enemy-catalog-dialog').open, false);
  assert.equal(h.doc.activeElement, h.back);
  assert.deepEqual(h.local.entries(), before);
  assert.deepEqual(h.local.writes, []);
  assert.deepEqual(h.session.writes, []);
});

test('Enemy reading updates preserve the actual catalog draft, stored choices and focused editor', async (t) => {
  const h = await readingWorkshop(t);
  await h.ready();
  await h.$('enemy-catalog-apply').onclick();
  const stored = h.local.entries().filter(([key]) => key !== DISPLAY_PREFERENCES_KEY),
    writes = [...h.local.writes],
    dialog = h.$('enemy-catalog-dialog'),
    preview = dialog.querySelector('canvas'),
    requests = [...h.requests];
  h.$('enemy-catalog-skin').value = 'ukraine';
  h.$('enemy-catalog-skin').onchange();
  h.$('enemy-catalog-enabled').checked = false;
  h.$('enemy-catalog-enabled').onchange();
  h.$('enemy-catalog-skin').focus();
  const detail = h.$('enemy-catalog-details').textContent;
  h.external({ textFace: 'pixel', textSize: 'standard', reducedEffects: false });
  assert.deepEqual(readingState(h), { textFace: 'pixel', textSize: 'standard', effects: 'full' });
  h.external({ textFace: 'plain', textSize: 'large', reducedEffects: false });
  h.media.matches = true;
  h.media.emit('change');
  assert.deepEqual(readingState(h), largePlainReduced);
  assert.equal(h.doc.activeElement, h.$('enemy-catalog-skin'));
  assert.equal(h.$('enemy-catalog-skin').value, 'ukraine');
  assert.equal(h.$('enemy-catalog-enabled').checked, false);
  assert.equal(h.$('enemy-catalog-details').textContent, detail);
  assert.equal(h.$('enemy-catalog-dialog'), dialog);
  assert.equal(dialog.open, true);
  assert.equal(dialog.querySelector('canvas'), preview);
  assert.deepEqual(
    h.local.entries().filter(([key]) => key !== DISPLAY_PREFERENCES_KEY),
    stored,
  );
  assert.deepEqual(h.local.writes, writes);
  assert.deepEqual(h.session.writes, []);
  assert.deepEqual(h.requests, requests);
});

test('Enemy preview consumes explicit and system reduction through the shared reading owner', async (t) => {
  const h = await readingWorkshop(t, {
    textFace: 'pixel',
    textSize: 'standard',
    reducedEffects: false,
  });
  await h.ready();
  function bank() {
    h.paints.length = 0;
    h.frame();
    return h.paints.find(([method]) => method === 'scale')?.slice(1);
  }
  bank();
  assert.notDeepEqual(bank(), [1, 1], 'Ordinary moving preview has cosmetic bank.');
  h.external({ textFace: 'pixel', textSize: 'standard', reducedEffects: true });
  assert.deepEqual(bank(), [1, 1], 'Explicit reduction removes bank in the real panel painter.');
  h.external({ textFace: 'pixel', textSize: 'standard', reducedEffects: false });
  assert.notDeepEqual(bank(), [1, 1]);
  h.media.matches = true;
  h.media.emit('change');
  assert.deepEqual(bank(), [1, 1], 'System reduction reaches the same painter.');
  assert.deepEqual(h.local.writes, []);
  assert.deepEqual(h.session.writes, []);
});

test('Enemy reading return refreshes missed preferences without replacing draft or focus', async (t) => {
  const h = await readingWorkshop(t);
  await h.ready();
  h.$('enemy-catalog-skin').value = 'retro';
  h.$('enemy-catalog-skin').onchange();
  h.$('enemy-catalog-skin').focus();
  const dialog = h.$('enemy-catalog-dialog'),
    focus = h.doc.activeElement,
    requests = [...h.requests];
  h.win.emit('pagehide', { persisted: true });
  assert.equal(h.pendingFrames(), 0);
  h.external({ textFace: 'pixel', textSize: 'standard', reducedEffects: false }, false);
  h.win.emit('pageshow', { persisted: true });
  h.flush();
  assert.deepEqual(readingState(h), { textFace: 'pixel', textSize: 'standard', effects: 'full' });
  assert.equal(h.$('enemy-catalog-dialog'), dialog);
  assert.equal(dialog.open, true);
  assert.equal(h.doc.activeElement, focus);
  assert.equal(h.$('enemy-catalog-skin').value, 'retro');
  assert.equal(h.pendingFrames(), 1);
  assert.deepEqual(h.requests, requests);
  assert.deepEqual(h.local.writes, []);
  assert.deepEqual(h.session.writes, []);
});

test('Enemy reading departure retires subscriptions and retained reading callbacks', async (t) => {
  const h = await readingWorkshop(t);
  h.back.focus();
  h.win.emit('pageshow', { persisted: false });
  const pending = [...h.timers.values()],
    storage = [...(h.win.listeners.get('storage') || [])],
    shows = [...(h.win.listeners.get('pageshow') || [])],
    motion = [...(h.media.listeners.get('change') || [])];
  assert.equal(storage.length, 1);
  h.win.emit('pagehide', { persisted: false });
  const state = readingState(h);
  assert.equal(h.timers.size, 0);
  assert.equal(h.win.listeners.get('storage')?.size ?? 0, 0);
  assert.equal(h.media.listeners.get('change')?.size ?? 0, 0);
  h.external({ textFace: 'pixel', textSize: 'standard', reducedEffects: false });
  h.media.matches = true;
  for (const callback of pending) callback();
  for (const callback of storage) callback({ key: DISPLAY_PREFERENCES_KEY });
  for (const callback of shows) callback({ persisted: true });
  for (const callback of motion) callback();
  assert.deepEqual(readingState(h), state);
  assert.equal(h.doc.activeElement, h.back);
  assert.equal(h.timers.size, 0);
  assert.equal(h.requests.length, 0);
  assert.deepEqual(h.local.writes, []);
  assert.deepEqual(h.session.writes, []);
});
