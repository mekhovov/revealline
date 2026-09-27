import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import { Document, Events } from './helpers/couch-dom.mjs';
const source = await readFile(new URL('../boot.mjs', import.meta.url), 'utf8');
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

test('startup dialog owns keyboard/pad input without declaring boot ready', () => {
  const b = boundary({ importModuleDynamically: () => new Promise(() => {}) });
  b.run();
  b.mount();
  const boot = b.context.RevealLineBoot;
  b.control();
  const release = boot.suspendInput();
  const target = b.make('button', 'company-consent', b.dialog);
  b.dialog.open = true;
  target.focus();
  let prevented = 0;
  b.document.emit('keydown', {
    key: 'ArrowDown',
    preventDefault() {
      prevented++;
    },
  });
  b.control({ button: 13 });
  assert.equal(b.document.activeElement, target);
  assert.equal(prevented, 0);
  assert.equal(b.game.inert, true);
  assert.equal(b.document.documentElement.dataset.bootState, 'loading');
  release();
  release();
  b.control({ button: 13 });
  assert.equal(b.document.activeElement, target, 'held pad cannot transfer focus on release');
  b.control();
  b.control({ button: 13 });
  assert.notEqual(
    b.document.activeElement,
    target,
    'neutral then fresh input returns to boot owner',
  );
});
test('nested input ownership and boot failure retain fail-closed cleanup', () => {
  const b = boundary({ importModuleDynamically: () => new Promise(() => {}) });
  b.run();
  b.mount();
  b.control();
  const a = b.context.RevealLineBoot.suspendInput(),
    z = b.context.RevealLineBoot.suspendInput();
  const target = b.make('button', 'company-confirm', b.dialog);
  target.focus();
  b.dialog.open = true;
  a();
  b.control();
  b.control({ button: 0 });
  assert.equal(b.document.activeElement, target);
  z();
  b.context.RevealLineBoot.fail(new Error('download cancelled'));
  assert.equal(b.dialog.open, false);
  assert.equal(b.game.inert, true);
  assert.equal(b.document.activeElement, b.retry);
});
