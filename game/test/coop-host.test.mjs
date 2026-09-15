import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountCouch } from './helpers/couch-host.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';

const html = await readFile(new URL('../couch/relay-rescue.html', import.meta.url), 'utf8');
let sequence = 0;

/** Real markup and game modules, with a minimal DOM, inert Canvas, and controlled frame callbacks. */
async function page(t) {
  const doc = new Document(),
    win = new Events();
  doc.parentNode = win;
  mountCouch(doc, html);
  const $ = (id) => doc.getElementById(id);
  $('coop-canvas').width = 1152;
  $('coop-canvas').height = 576;
  const context = new Proxy(
    {},
    {
      get(target, key) {
        return Object.hasOwn(target, key) ? target[key] : () => {};
      },
    },
  );
  $('coop-canvas').getContext = () => context;
  const frames = new Map(),
    originals = new Map();
  let nextFrame = 0;
  const install = (key, descriptor) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
  };
  for (const [key, value] of Object.entries({
    document: doc,
    window: win,
    navigator: { getGamepads: () => [] },
    location: { href: 'http://localhost/game/couch/relay-rescue.html' },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame(callback) {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  }))
    install(key, { value, writable: true });
  for (const key of ['localStorage', 'sessionStorage', 'indexedDB'])
    install(key, {
      get() {
        throw new Error(`Unexpected co-op storage access: ${key}`);
      },
    });
  t.after(() => {
    win.emit('pagehide');
    frames.clear();
    for (const [key, original] of originals)
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
  });
  await import(`../couch/relay-rescue.mjs?host-test=${++sequence}`);
  assert.equal($('coop-start').disabled, false, $('coop-boot').textContent);
  assert.ok(frames.size);
  $('coop-difficulty').value = 'standard';
  const selectFile = (text, read = async () => text) => {
    $('coop-pack-file').files = [{ size: Buffer.byteLength(text), text: read }];
    return $('coop-pack-file').onchange();
  };
  const choose = (id, value) => {
    $(id).value = value;
    $(id).onchange();
  };
  const press = (key) => doc.activeElement.emit('keydown', { key, code: key, repeat: false });
  return { $, doc, selectFile, choose, press };
}

function customPack(id = 'custom') {
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = id;
  pack.name = `Created ${id}`;
  pack.levels[0].id = `${id}-coverage`;
  pack.levels[1].id = `${id}-stronghold`;
  return pack;
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('a file selected before Start cannot replace setup after returning from an attempt', async (t) => {
  const f = await page(t),
    read = deferred(),
    text = JSON.stringify(customPack('late'));
  f.$('coop-difficulty').value = 'expert';
  const pending = f.selectFile(text, () => read.promise);
  f.$('coop-start').click();
  f.$('coop-pause').click();
  f.$('coop-lobby').click();
  read.resolve(text);
  await pending;
  assert.equal(f.$('coop-pack-status').textContent, 'Relay Rescue · 2 levels');
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(f.$('coop-difficulty').value, 'expert');
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.equal(f.$('coop-pack-file').value, '');
});

test('invalid or oversized imports preserve the selected custom pack and challenge', async (t) => {
  const f = await page(t);
  await f.selectFile(JSON.stringify(customPack()));
  f.choose('coop-level', 'custom-stronghold');
  f.$('coop-difficulty').value = 'expert';
  const options = f.$('coop-level').options.map((option) => [option.value, option.textContent]);
  for (const text of ['{', JSON.stringify({ ...customPack(), ruleset: 'unsupported' })]) {
    await f.selectFile(text);
    assert.deepEqual(
      f.$('coop-level').options.map((option) => [option.value, option.textContent]),
      options,
    );
    assert.equal(f.$('coop-level').value, 'custom-stronghold');
    assert.equal(f.$('coop-difficulty').value, 'expert');
    assert.match(f.$('coop-pack-status').textContent, /Pack unchanged:/);
  }
  let read = false;
  f.$('coop-pack-file').files = [
    {
      size: 1024 * 1024 + 1,
      text: async () => {
        read = true;
        return '{}';
      },
    },
  ];
  await f.$('coop-pack-file').onchange();
  assert.equal(read, false, 'The byte limit applies before reading the file.');
  assert.equal(f.$('coop-level').value, 'custom-stronghold');
});

test('the latest file selection wins when earlier reads finish out of order', async (t) => {
  const f = await page(t),
    read = deferred(),
    old = JSON.stringify(customPack('older'));
  const pending = f.selectFile(old, () => read.promise);
  await f.selectFile(JSON.stringify(customPack('newer')));
  read.resolve(old);
  await pending;
  assert.equal(f.$('coop-level').value, 'newer-coverage');
  assert.equal(f.$('coop-pack-status').textContent, 'Created newer · 2 levels');
  assert.equal(f.doc.activeElement.id, 'coop-start');
});

test('returning to built-ins cancels an outstanding file read', async (t) => {
  const f = await page(t),
    read = deferred(),
    text = JSON.stringify(customPack('late'));
  await f.selectFile(JSON.stringify(customPack()));
  const pending = f.selectFile(text, () => read.promise);
  f.$('coop-pack-reset').click();
  read.resolve(text);
  await pending;
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(f.$('coop-pack-reset').hidden, true);
  assert.equal(f.$('coop-pack-status').textContent, 'Relay Rescue · 2 levels');
});

test('custom fractional coverage and multiple required cores drive the actual briefing and HUD', async (t) => {
  const f = await page(t),
    pack = customPack();
  pack.levels[0].goal.coverage = 0.724;
  const level = pack.levels[1];
  level.strongholds.unshift({
    id: 'optional',
    core: { x: 10.5, y: 5.5 },
    anchors: [
      { x: 6.5, y: 11.5 },
      { x: 12.5, y: 11.5 },
    ],
  });
  level.strongholds.push({
    id: 'second',
    core: { x: 36.5, y: 29.5 },
    anchors: [
      { x: 23.5, y: 24.5 },
      { x: 48.5, y: 24.5 },
    ],
  });
  level.goal.cores.push('second');
  await f.selectFile(JSON.stringify(pack));
  assert.equal(f.$('coop-menu-goal').textContent, 'Reveal 72.4% together');
  assert.doesNotMatch(f.$('coop-level-note').textContent, /Both halves are contested/);
  f.$('coop-start').click();
  assert.equal(f.$('coop-objective').textContent, 'Reveal 72.4% together');
  assert.ok(Math.abs(f.$('coop-progress').max - 72.4) < 1e-9);
  f.$('coop-pause').click();
  f.$('coop-lobby').click();
  f.choose('coop-level', 'custom-stronghold');
  assert.match(f.$('coop-menu-goal').textContent, /2 strongholds/);
  assert.doesNotMatch(f.$('coop-level-note').textContent, /Bait a Hunter/);
  f.$('coop-start').click();
  assert.match(f.$('coop-objective').textContent, /0 \/ 2 secured/);
  assert.match(
    f.$('coop-objective').textContent,
    /Relay 2/,
    'The optional first relay is excluded from required progress.',
  );
  assert.equal(f.$('coop-progress').max, 100);
});

test('lobby keyboard navigation reaches Race and accessibility controls while excluding flight pads', async (t) => {
  const f = await page(t),
    seen = new Set();
  f.$('coop-touch').checked = true;
  f.$('coop-touch').onchange();
  f.doc.body.focus();
  for (let index = 0; index < 30; index++) {
    f.press('Tab');
    assert.equal(f.doc.activeElement.closest('.race-pad'), null);
    seen.add(f.doc.activeElement.id);
  }
  for (const id of ['coop-race', 'coop-touch', 'coop-reduced', 'coop-level', 'coop-start'])
    assert.ok(seen.has(id), `Lobby Tab must reach ${id}.`);
  let left = 0;
  f.$('coop-race').onclick = () => left++;
  f.press('Escape');
  assert.equal(left, 1, 'Lobby Back activates the visible Race destination.');
  f.$('coop-start').click();
  f.$('coop-pause').click();
  for (let index = 0; index < 6; index++) {
    f.press('Tab');
    assert.ok(
      f.$('coop-overlay').contains(f.doc.activeElement),
      'Paused navigation stays in the overlay.',
    );
  }
});
