import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { attachFieldKitSurfaces } from '../ui/field-kit-surfaces.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { Document, Element, Events } from './helpers/couch-dom.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const html = readFileSync(new URL('../replay-theater/index.html', import.meta.url), 'utf8');
const defaults = { textFace: 'pixel', textSize: 'standard', reducedEffects: false };
const encode = (changes = {}) => JSON.stringify({ ...defaults, ...changes });
let serial = 0;
function recording() {
  const level = {
    version: 'xonix-level.v3',
    id: 'display-proof',
    name: 'Display proof',
    revision: '1',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 60.5, y: 0.5 },
    goal: { coverage: 0.5 },
    enemies: [{ id: 'seed', type: 'bouncer', x: 12.5, y: 18.5, vx: 0, vy: 0 }],
  };
  const options = { turnPolicy: 'immediate' },
    run = createRun(level, options);
  const recorder = createRecorder(level, options, 'display-proof');
  for (let i = 0; i < 120; i++) {
    const input = { direction: 'down' };
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  return exportReplay(recorder, run);
}
async function until(predicate, label) {
  for (let i = 0; i < 150; i++) {
    if (predicate()) return;
    await setImmediate();
  }
  assert.fail(label);
}
function fixture(
  t,
  { stored = encode(), systemReduced = false, holdBoot = false, failBoot = false } = {},
) {
  const doc = new Document(),
    win = new Events(),
    media = new Events(),
    main = new Element(doc, 'main');
  doc.parentNode = win;
  doc.defaultView = win;
  doc.body.append(main);
  for (const [, tag, attrs, id] of html.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const node = new Element(doc, tag, { id });
    for (const [, name, value] of attrs.matchAll(/([\w-]+)="([^"]*)"/g))
      node.setAttribute(name, value);
    main.append(node);
  }
  const $ = (id) => doc.getElementById(id),
    board = $('board'),
    stage = new Element(doc, 'div');
  stage.style.setProperty = (name, value) => {
    stage.style[name] = value;
  };
  board.remove();
  main.append(stage);
  stage.append(board);
  board.width = 768;
  board.height = 576;
  $('speed').value = '1';
  $('example').value = 'fieldcraft-01';
  const original = recording(),
    paints = [],
    frames = new Map(),
    writes = [],
    reads = [];
  const data = new Map([
    [DISPLAY_PREFERENCES_KEY, stored],
    ['revealline.library.dev.v1', 'untouched player profile'],
    ['revealline.suspended.dev.v1', 'untouched saved flight'],
  ]);
  let sequence = 0,
    failWrites = false,
    releaseBoot;
  const bootGate = holdBoot
    ? new Promise((resolve) => {
        releaseBoot = resolve;
      })
    : Promise.resolve();
  const storage = {
    getItem(key) {
      reads.push(key);
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      writes.push({ key, value, accepted: !failWrites });
      assert.equal(
        key,
        DISPLAY_PREFERENCES_KEY,
        'Every attempted write must be the separate display key.',
      );
      if (failWrites) throw new Error('Storage is full');
      data.set(key, value);
    },
  };
  win.localStorage = storage;
  media.matches = systemReduced;
  win.matchMedia = () => media;
  const globals = {
    document: doc,
    window: win,
    localStorage: storage,
    location: { href: 'https://example.test/game/replay-theater/' },
    navigator: { getGamepads: () => [] },
    matchMedia: () => media,
    requestAnimationFrame: (fn) => {
      frames.set(++sequence, fn);
      return sequence;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    fetch: async (path) => {
      if (String(path).includes('content/themes') || String(path).includes('motion-lab/presets')) {
        await bootGate;
        return {
          ok: !failBoot,
          json: async () =>
            String(path).includes('themes')
              ? read('../content/themes.json')
              : read('../../authoring/motion-lab/presets.json'),
        };
      }
      if (String(path).includes('replay.json'))
        return {
          ok: true,
          headers: { get: () => null },
          text: async () => JSON.stringify(original),
        };
      return new Response('', { status: 404 });
    },
  };
  const previous = new Map();
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const surfaces = attachFieldKitSurfaces({ document: doc });
  t.after(() => {
    win.emit('pagehide', { persisted: false });
    surfaces.destroy();
    frames.clear();
    for (const [key, descriptor] of previous)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  t.mock.method(BoardPainter.prototype, 'setLook', async () => {});
  t.mock.method(BoardPainter.prototype, 'draw', (_context, state, _dt, options) =>
    paints.push({
      checkpoint: authoritativeCheckpoint(state),
      tick: state.tick,
      ...options,
    }),
  );
  const loading = import(`../replay-theater/app.mjs?display-host=${++serial}`);
  return {
    $,
    doc,
    win,
    media,
    data,
    storage,
    writes,
    reads,
    paints,
    frames,
    original,
    loading,
    releaseBoot: () => releaseBoot?.(),
    failWrites: (value) => {
      failWrites = value;
    },
    change(id, value) {
      const node = $(id);
      if (typeof value === 'boolean') node.checked = value;
      else node.value = value;
      node.emit('change');
    },
    frame(now) {
      const entry = frames.entries().next().value;
      assert.ok(entry, 'The actual host owns a scheduled frame.');
      frames.delete(entry[0]);
      entry[1](now);
      return paints.at(-1);
    },
    remote(changes, notify = true) {
      const value = encode(changes);
      data.set(DISPLAY_PREFERENCES_KEY, value);
      if (notify)
        win.emit('storage', {
          key: DISPLAY_PREFERENCES_KEY,
          storageArea: storage,
          newValue: value,
        });
    },
  };
}
async function ready(page) {
  await page.loading;
  await until(
    () => page.$('recording-name').textContent === 'Display proof',
    'Real recording must verify and load.',
  );
}
function raw(page) {
  return JSON.parse(page.data.get(DISPLAY_PREFERENCES_KEY));
}
function noPlayerAccess(page) {
  assert.ok(page.reads.every((key) => key === DISPLAY_PREFERENCES_KEY));
  assert.ok(page.writes.every(({ key }) => key === DISPLAY_PREFERENCES_KEY));
  assert.equal(page.data.get('revealline.library.dev.v1'), 'untouched player profile');
  assert.equal(page.data.get('revealline.suspended.dev.v1'), 'untouched saved flight');
}

test('real theater adopts shared text/cap before boot and changes presentation without changing verified playback', async (t) => {
  const p = fixture(t, {
    stored: encode({ textFace: 'plain', textSize: 'large' }),
    systemReduced: true,
    holdBoot: true,
  });
  await until(
    () => p.doc.body.dataset.textFace === 'plain',
    'Shared preference must appear during delayed startup.',
  );
  assert.equal(p.doc.body.dataset.textSize, 'large');
  assert.equal(p.doc.body.dataset.effects, 'reduced');
  assert.equal(
    p.$('reduced').checked,
    false,
    'Checkbox shows raw user choice, not the system cap.',
  );
  assert.match(p.$('replay-system-reduction').textContent, /system|System/);
  assert.equal(p.writes.length, 0);
  p.releaseBoot();
  await ready(p);
  assert.equal(
    p.$('replay-text-size').getAttribute('data-field-kit-text-size'),
    null,
    'Only the shared preference adapter owns this control.',
  );
  let paint = p.frame(1000),
    before = paint.checkpoint;
  assert.equal(paint.textFace, 'plain');
  assert.equal(paint.reduced, true);
  p.$('replay-text-size').focus();
  p.change('replay-text-size', 'standard');
  p.change('replay-text-face', 'pixel');
  assert.equal(p.doc.activeElement, p.$('replay-text-size'), 'Reading changes do not take focus.');
  assert.equal(p.doc.body.dataset.textSize, 'standard');
  assert.equal(raw(p).textFace, 'pixel');
  paint = p.frame(1000);
  assert.deepEqual(paint.checkpoint, before);
  assert.equal(p.$('playback-phase').textContent, 'paused');
  assert.equal(paint.textFace, 'pixel');
  assert.equal(paint.reduced, true);
  p.media.matches = false;
  p.media.emit('change');
  paint = p.frame(1000);
  assert.equal(paint.reduced, false);
  p.change('reduced', true);
  paint = p.frame(1000);
  assert.equal(paint.reduced, true);
  assert.equal(raw(p).reducedEffects, true);
  p.$('play-pause').emit('click');
  p.frame(1010);
  p.frame(1040);
  assert.equal(p.$('playback-phase').textContent, 'playing');
  before = p.paints.at(-1).checkpoint;
  p.remote({ textFace: 'plain', textSize: 'large', reducedEffects: false });
  paint = p.frame(1040);
  assert.deepEqual(paint.checkpoint, before);
  assert.equal(p.$('playback-phase').textContent, 'playing');
  assert.equal(paint.textFace, 'plain');
  assert.equal(paint.reduced, false);
  for (let i = 1; i <= 80 && p.$('playback-phase').textContent === 'playing'; i++)
    p.frame(1040 + i * 50);
  assert.equal(p.$('playback-phase').textContent, 'complete');
  assert.deepEqual(p.paints.at(-1).checkpoint, p.original.checkpoint);
  noPlayerAccess(p);
});

test('real theater preserves denied-save intent and its recording across a persisted return', async (t) => {
  const p = fixture(t);
  await ready(p);
  p.frame(1000);
  p.$('step').emit('click');
  const before = p.frame(1010).checkpoint;
  p.$('replay-text').value = 'Unsubmitted recording text';
  p.failWrites(true);
  p.change('replay-text-face', 'plain');
  p.change('replay-text-size', 'large');
  assert.match(p.$('replay-display-status').textContent, /session|saved/);
  p.$('play-pause').emit('click');
  p.win.emit('pagehide', { persisted: true });
  assert.equal(p.$('playback-phase').textContent, 'paused');
  p.remote({ textFace: 'pixel', textSize: 'standard' }, false);
  p.media.matches = true;
  p.win.emit('pageshow', { persisted: true });
  assert.equal(p.doc.body.dataset.textFace, 'plain');
  assert.equal(p.doc.body.dataset.textSize, 'large');
  assert.equal(p.doc.body.dataset.effects, 'reduced');
  assert.equal(p.$('reduced').checked, false);
  assert.equal(p.$('replay-text').value, 'Unsubmitted recording text');
  assert.deepEqual(p.frame(3000).checkpoint, before);
  assert.equal(p.$('playback-phase').textContent, 'paused');
  p.failWrites(false);
  p.change('replay-text-face', 'plain');
  assert.equal(p.$('replay-display-status').textContent, '');
  p.win.emit('pagehide', { persisted: true });
  p.remote({ textFace: 'pixel', textSize: 'standard' }, false);
  p.media.matches = false;
  p.win.emit('pageshow', { persisted: true });
  assert.equal(p.doc.body.dataset.textFace, 'pixel');
  assert.equal(p.doc.body.dataset.textSize, 'standard');
  assert.equal(p.doc.body.dataset.effects, 'full');
  assert.deepEqual(p.frame(4000).checkpoint, before);
  assert.equal(p.$('playback-phase').textContent, 'paused');
  noPlayerAccess(p);
});

test('real theater boot failure retains usable shared reading controls without playback', async (t) => {
  const p = fixture(t, { failBoot: true });
  await p.loading;
  assert.match(p.$('boot-status').textContent, /could not start/);
  assert.equal(p.frames.size, 0);
  p.change('replay-text-face', 'plain');
  p.change('replay-text-size', 'large');
  assert.equal(p.doc.body.dataset.textFace, 'plain');
  assert.equal(p.doc.body.dataset.textSize, 'large');
  noPlayerAccess(p);
});

test('terminal exit during delayed boot retires authority and fences late replay startup', async (t) => {
  const p = fixture(t, { holdBoot: true });
  await until(() => p.doc.body.dataset.textFace === 'pixel', 'Interface mounts before startup.');
  p.win.emit('pagehide', { persisted: false });
  const before = { ...p.doc.body.dataset };
  p.remote({ textFace: 'plain', textSize: 'large', reducedEffects: true });
  p.media.matches = true;
  p.media.emit('change');
  p.change('replay-text-size', 'large');
  p.releaseBoot();
  await p.loading;
  assert.deepEqual({ ...p.doc.body.dataset }, before);
  assert.equal(
    p.frames.size,
    0,
    'A completed fetch after terminal exit cannot start playback or RAF.',
  );
  assert.equal(p.writes.length, 0);
  noPlayerAccess(p);
});
