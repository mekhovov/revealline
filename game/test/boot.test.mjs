import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Script, createContext, constants as vmConstants } from 'node:vm';
import { Document, Events } from './helpers/couch-dom.mjs';

const source = await readFile(new URL('../boot.mjs', import.meta.url), 'utf8');
const landing = await readFile(new URL('../../site/launch.mjs', import.meta.url), 'utf8');

// Actual classic source runs in an isolated VM. DOM, time and pad samples are
// finite browser boundaries; there is no layout, network or device assertion.
function boundary({
  href = 'https://game.example/releases/v29/site/game/',
  renderer = true,
  importModuleDynamically,
} = {}) {
  const document = new Document();
  document.readyState = 'loading';
  document.documentElement.dataset.bootState = 'loading';
  document.currentScript = { src: new URL('boot.mjs', href).href };
  const make = (tag, id, parent = document.body) => {
    const element = document.createElement(tag);
    element.setAttribute('id', id);
    parent.append(element);
    return element;
  };
  const screen = make('section', 'boot-screen');
  make('h1', 'boot-title', screen);
  make('p', 'boot-status', screen);
  const retry = make('a', 'boot-retry', screen);
  const online = make('a', 'boot-online', screen);
  online.href = 'https://mekhovov.github.io/revealline/game/';
  const local = make('details', 'boot-local', screen);
  make('summary', 'boot-summary', local);
  make('a', 'boot-server-link', local);
  make('p', 'boot-detail', screen);
  const game = make('main', 'main-game');
  game.setAttribute('data-boot-inert', '');
  game.setAttribute('aria-busy', 'true');
  game.inert = true;
  const dialog = make('dialog', 'partial-game-dialog');
  dialog.close = () => {
    dialog.open = false;
  };
  const events = new Events();
  const timers = new Map();
  const frames = new Map();
  const locations = [];
  let sequence = 0;
  let pad = null;
  const context = createContext({
    document,
    location: { href, protocol: new URL(href).protocol, replace: (url) => locations.push(url) },
    URL,
    Error,
    Phaser: renderer ? {} : undefined,
    navigator: { getGamepads: () => [pad] },
    setTimeout: (fn) => {
      timers.set(++sequence, fn);
      return sequence;
    },
    clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame: (fn) => {
      frames.set(++sequence, fn);
      return sequence;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  });
  function run() {
    new Script(source, { filename: 'game/boot.mjs', importModuleDynamically }).runInContext(
      context,
    );
  }
  function mount() {
    document.emit('DOMContentLoaded');
  }
  function frame() {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((fn) => fn());
  }
  function control({ button, axis = 0 } = {}) {
    pad = {
      connected: true,
      mapping: 'standard',
      axes: [0, axis],
      buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === button })),
    };
    frame();
  }
  return {
    context,
    document,
    events,
    make,
    run,
    mount,
    frame,
    control,
    timers,
    frames,
    locations,
    screen,
    game,
    dialog,
    retry,
    online,
    local,
  };
}

async function moduleBoundary(t, initialize) {
  const directory = await mkdtemp(path.join(tmpdir(), 'revealline-boot-import-'));
  const key = path.basename(directory);
  const page = boundary({ importModuleDynamically: vmConstants.USE_MAIN_CONTEXT_DEFAULT_LOADER });
  const deferred = () => {
    let resolve;
    const promise = new Promise((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };
  const started = deferred();
  const settled = deferred();
  // A real ES module with top-level await runs through production import(). Only
  // its initialization callback is supplied; no boot source is rewritten.
  globalThis[key] = async () => {
    started.resolve();
    try {
      return await initialize(page);
    } finally {
      settled.resolve();
    }
  };
  page.appStarted = started.promise;
  page.appSettled = settled.promise;
  await writeFile(path.join(directory, 'app.mjs'), `await globalThis[${JSON.stringify(key)}]();\n`);
  page.document.currentScript.src = pathToFileURL(path.join(directory, 'boot.mjs')).href;
  t.after(async () => {
    delete globalThis[key];
    await rm(directory, { recursive: true, force: true });
  });
  return page;
}

async function settle() {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve));
}

test('downloaded file shows usable native launch options without importing or redirecting', () => {
  const page = boundary({ href: 'file:///tmp/RevealLine/game/index.html' });
  page.run();
  page.mount();
  assert.equal(page.document.documentElement.dataset.bootState, 'file');
  assert.equal(page.game.inert, true);
  assert.equal(page.screen.hidden, false);
  assert.equal(page.retry.hidden, true);
  assert.equal(page.local.open, true);
  assert.equal(page.document.activeElement, page.online);
  assert.deepEqual(page.locations, []);
  assert.equal(page.timers.size, 0);
  assert.equal(
    page.context.RevealLineBoot.ready(),
    false,
    'a later callback cannot expose broken file gameplay',
  );
});

test('early renderer or stylesheet errors retain inert controls and close partially opened dialogs', () => {
  for (const target of [{ id: 'boot-phaser' }, { tagName: 'LINK', rel: 'stylesheet' }]) {
    const page = boundary();
    page.run();
    page.events.emit('error', { target });
    page.dialog.open = true;
    page.mount();
    assert.equal(page.document.documentElement.dataset.bootState, 'failed');
    assert.equal(page.game.inert, true);
    assert.equal(page.dialog.open, false);
    assert.equal(page.screen.hidden, false);
    assert.equal(page.context.RevealLineBoot.ready(), false);
    assert.equal(page.document.activeElement, page.retry);
  }
});

test('missing renderer does not expose legacy controls or request an app startup', () => {
  const page = boundary({ renderer: false });
  page.run();
  page.mount();
  assert.equal(page.document.documentElement.dataset.bootState, 'failed');
  assert.match(page.document.getElementById('boot-detail').textContent, /renderer is unavailable/);
  assert.equal(page.game.inert, true);
});

test('app import rejection has an actual caught promise path and stays concealed', async () => {
  const page = boundary();
  page.run();
  page.mount();
  // This VM deliberately has no dynamic-import adapter. Its actual rejected
  // import exercises the production catch; this is not a network outage test.
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.document.documentElement.dataset.bootState, 'failed');
  assert.match(page.document.getElementById('boot-detail').textContent, /dynamic import callback/i);
  assert.equal(page.game.inert, true);
  assert.equal(page.timers.size, 0);
});

test(
  'resolved legacy app cannot substitute hidden status for the ready handshake',
  { timeout: 5000 },
  async (t) => {
    let imported = false;
    const page = await moduleBoundary(t, (oldPage) => {
      imported = true;
      oldPage.document.getElementById('boot-status').hidden = true;
      oldPage.game.inert = false;
      oldPage.game.removeAttribute('aria-busy');
      oldPage.dialog.open = true;
    });
    page.run();
    page.mount();
    await page.appSettled;
    await settle();
    assert.equal(imported, true);
    assert.equal(page.document.documentElement.dataset.bootState, 'failed');
    assert.equal(page.document.getElementById('boot-status').hidden, false);
    assert.match(page.document.getElementById('boot-status').textContent, /could not start/);
    assert.match(
      page.document.getElementById('boot-detail').textContent,
      /did not confirm startup/,
    );
    assert.equal(page.screen.hidden, false);
    assert.equal(page.game.inert, true);
    assert.equal(page.dialog.open, false);
    assert.equal(page.document.activeElement, page.retry);
    assert.equal(page.context.RevealLineBoot.ready(), false);
    assert.equal(page.timers.size, 0);
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(
      html,
      /html:not\(\[data-boot-state='ready'\]\) body > :not\(#boot-screen\):not\(script\)\s*\{\s*display: none !important;/,
      'the actual inline guard conceals failed gameplay even if an older app removed inert',
    );
  },
);

test(
  'pending top-level await keeps loading and real ready succeeds before import completion',
  { timeout: 5000 },
  async (t) => {
    let release;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    t.after(() => release());
    let initialized = false;
    const page = await moduleBoundary(t, async (currentPage) => {
      await pending;
      initialized = currentPage.context.RevealLineBoot.ready();
    });
    page.run();
    page.mount();
    await page.appStarted;
    await settle();
    assert.equal(page.document.documentElement.dataset.bootState, 'loading');
    assert.equal(page.screen.hidden, false);
    assert.equal(page.game.inert, true);
    for (const callback of page.timers.values()) callback();
    assert.match(page.document.getElementById('boot-status').textContent, /Still preparing/);
    assert.equal(page.document.documentElement.dataset.bootState, 'loading');
    release();
    await page.appSettled;
    await settle();
    assert.equal(initialized, true);
    assert.equal(page.document.documentElement.dataset.bootState, 'ready');
    assert.equal(page.screen.hidden, true);
    assert.equal(page.game.inert, false);
    assert.equal(page.frames.size, 0);
    assert.equal(page.timers.size, 0);
  },
);

test(
  'rejected real app import restores its hidden status and retains the import error',
  { timeout: 5000 },
  async (t) => {
    const page = await moduleBoundary(t, (partialPage) => {
      partialPage.document.getElementById('boot-status').hidden = true;
      partialPage.game.inert = false;
      throw new Error('Owned module initialization rejected');
    });
    page.run();
    page.mount();
    await page.appSettled;
    await settle();
    assert.equal(page.document.documentElement.dataset.bootState, 'failed');
    assert.equal(page.document.getElementById('boot-status').hidden, false);
    assert.match(
      page.document.getElementById('boot-detail').textContent,
      /Owned module initialization rejected/,
    );
    assert.equal(page.screen.hidden, false);
    assert.equal(page.game.inert, true);
    assert.equal(page.document.activeElement, page.retry);
    assert.equal(page.context.RevealLineBoot.ready(), false);
  },
);

test('only successful ready reveals the game and shuts down boot scheduling/listeners', () => {
  const page = boundary();
  page.run();
  assert.equal(page.game.inert, true);
  assert.equal(page.context.RevealLineBoot.ready(), true);
  assert.equal(page.document.documentElement.dataset.bootState, 'ready');
  assert.equal(page.screen.hidden, true);
  assert.equal(page.game.inert, false);
  assert.equal(page.game.hasAttribute('aria-busy'), false);
  assert.equal(page.frames.size, 0);
  assert.equal(page.timers.size, 0);
  assert.equal(page.context.RevealLineBoot.fail(new Error('late unrelated error')), false);
});

test('boot keyboard and controller navigation requires fresh input and yields after pointer use', () => {
  const page = boundary({ renderer: false });
  page.run();
  page.mount();
  let clicks = 0;
  page.online.addEventListener('click', () => clicks++);
  page.control({ button: 0 });
  assert.equal(page.document.activeElement, page.retry, 'held pad at startup cannot activate');
  page.control();
  page.control({ axis: 1 });
  assert.equal(page.document.activeElement, page.online);
  page.control({ button: 0 });
  assert.equal(clicks, 1);
  page.control({ button: 0 });
  assert.equal(clicks, 1, 'holding Confirm does not repeat downloads or navigation');
  page.screen.emit('pointerdown');
  page.control({ axis: 1 });
  assert.equal(page.document.activeElement, page.online, 'old held pad cannot reclaim focus');
  page.control();
  page.document.emit('keydown', { key: 'ArrowUp' });
  assert.equal(page.document.activeElement, page.retry);
  page.document.emit('keydown', { key: 'ArrowDown', repeat: true });
  assert.equal(page.document.activeElement, page.retry);
  page.document.focused = false;
  page.control({ button: 0 });
  page.document.focused = true;
  page.control({ button: 0 });
  assert.equal(clicks, 1, 'returning focus with a held control remains neutral-gated');
});

test('public root enters the native game within source, Pages and frozen prefixes with exact queries', () => {
  for (const [href, script, expected] of [
    [
      'http://localhost:8768/site/',
      'http://localhost:8768/site/launch.mjs',
      'http://localhost:8768/game/',
    ],
    [
      'https://example.test/revealline/',
      'https://example.test/revealline/site/launch.mjs',
      'https://example.test/revealline/game/',
    ],
    [
      'https://example.test/archive/releases/v29/site/?course=first-flight&lesson=close-line#read',
      'https://example.test/archive/releases/v29/site/site/launch.mjs',
      'https://example.test/archive/releases/v29/site/game/?course=first-flight&lesson=close-line#read',
    ],
  ]) {
    const page = boundary({ href });
    page.make('a', 'launch-game', page.screen);
    page.document.currentScript.src = script;
    new Script(landing).runInContext(page.context);
    assert.deepEqual(page.locations, [expected]);
    assert.equal(page.document.getElementById('launch-game').href, expected);
  }
});

test('file launch and a cross-origin script never automatically leave the current document', () => {
  for (const [href, script] of [
    ['file:///tmp/RevealLine/index.html', 'file:///tmp/RevealLine/site/launch.mjs'],
    ['https://example.test/game/', 'https://other.test/site/launch.mjs'],
  ]) {
    const page = boundary({ href });
    const game = page.make('a', 'launch-game', page.screen);
    page.document.currentScript.src = script;
    new Script(landing).runInContext(page.context);
    assert.deepEqual(page.locations, []);
    if (href.startsWith('file:')) {
      assert.equal(game.hidden, true);
      assert.equal(page.local.open, true);
    }
  }
});

test('static launch markup survives disabled JS and excludes decorative fake controls', async () => {
  const index = await readFile(new URL('../../site/index.html', import.meta.url), 'utf8');
  assert.match(index, /<noscript\s*>[\s\S]*?Enable JavaScript/);
  assert.match(index, /href="https:\/\/mekhovov.github.io\/revealline\/game\/"/);
  assert.match(index, /python3 -m http.server/);
  assert.doesNotMatch(index, /landing-pack-select|pixel-board|flight-window|<select/);
  assert.doesNotMatch(index, /http-equiv="refresh"/);
  assert.match(index, /<script src="\.\/launch.mjs" defer>/);
});
