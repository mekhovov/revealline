import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import { Document, Events } from './helpers/couch-dom.mjs';

const source = await readFile(new URL('../boot.mjs', import.meta.url), 'utf8');
const landing = await readFile(new URL('../../site/launch.mjs', import.meta.url), 'utf8');

// Actual classic source runs in an isolated VM. DOM, time and pad samples are
// finite browser boundaries; there is no layout, network or device assertion.
function boundary({ href = 'https://game.example/releases/v29/site/game/', renderer = true } = {}) {
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
    new Script(source, { filename: 'game/boot.mjs' }).runInContext(context);
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
