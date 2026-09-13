import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const html = readFileSync(new URL('../replay-theater/index.html', import.meta.url), 'utf8');
let serial = 0;
async function until(predicate, label) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await setImmediate();
  }
  assert.fail(label);
}
function recording(turnPolicy = 'immediate', classic = false) {
  const level = {
    version: classic ? 'xonix-level.v4' : 'xonix-level.v3',
    id: 'theater-navigation',
    revision: '1',
    name: classic ? 'Classic recording' : 'Navigation recording',
    width: 72,
    height: 36,
    encounter: null,
    ...(classic ? { classic: { version: 'classic.v1', terrain: [], powerups: [] } } : {}),
    spawn: { x: 36.5, y: 0.5 },
    goal: { coverage: 0.9 },
    enemies: [{ id: 'seed', type: 'bouncer', x: 12.5, y: 18.5, vx: 0, vy: 0 }],
  };
  const options = { turnPolicy },
    run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (let tick = 0; tick < 120; tick++) {
    const input = { direction: tick < 80 ? 'down' : 'right' };
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  return exportReplay(recorder, run);
}
// Mount the actual markup, including nested details and native select choices.
// DOM layout/default key activation, device samples and drawing are modeled;
// entry handlers, router/navigation, replay verification and core remain real.
function mount(doc) {
  const stack = [doc.body];
  for (const [token] of html
    .split('<body>')[1]
    .split('</body>')[0]
    .matchAll(/<\/?[^>]+>|[^<]+/g)) {
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) {
      stack.at(-1).textContent += token.trim();
      continue;
    }
    const tag = token.match(/^<([\w-]+)/)[1],
      node = doc.createElement(tag);
    for (const [, name, quoted, bare] of token
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      node.setAttribute(name, value);
      if (['type', 'value'].includes(name)) node[name] = value;
      if (name === 'class') node.className = value;
      if (['hidden', 'disabled', 'checked', 'inert', 'open'].includes(name)) node[name] = true;
    }
    stack.at(-1).append(node);
    if (tag === 'option') {
      node.label = token;
      if (node.hasAttribute('selected')) node.parentElement.value = node.value;
    }
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(node);
  }
  for (const select of doc.querySelectorAll('select'))
    for (const option of select.options) option.label = option.textContent;
}
async function harness(t, source = recording()) {
  const doc = new Document(),
    win = new Events();
  mount(doc);
  const $ = (id) => doc.getElementById(id),
    snapshots = [];
  let frame,
    now = 1000,
    pads = [],
    reads = 0,
    cancelled = 0;
  const forbidden = new Proxy(
    {},
    {
      get() {
        throw new Error('Theater must not access storage');
      },
    },
  );
  const globals = {
    document: doc,
    window: win,
    location: { href: 'https://example.test/releases/v0.29.2/site/game/replay-theater/' },
    navigator: {
      getGamepads: () => {
        reads++;
        return pads;
      },
    },
    localStorage: forbidden,
    sessionStorage: forbidden,
    AudioContext: class {
      constructor() {
        throw new Error('Theater must remain silent');
      }
    },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (callback) => {
      frame = callback;
      return 1;
    },
    cancelAnimationFrame: () => {
      cancelled++;
    },
    fetch: async (path) => ({
      ok: true,
      headers: { get: () => null },
      json: async () =>
        path.includes('themes')
          ? read('../content/themes.json')
          : read('../../authoring/motion-lab/presets.json'),
      text: async () => JSON.stringify(source),
    }),
  };
  const previous = new Map();
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.mock.method(BoardPainter.prototype, 'setLook', async () => {});
  t.mock.method(BoardPainter.prototype, 'draw', (_context, run) =>
    snapshots.push({
      run,
      tick: run.tick,
      checkpoint: authoritativeCheckpoint(run),
    }),
  );
  t.after(() => {
    win.emit('pagehide', { persisted: false });
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  await import(`../replay-theater/app.mjs?navigation=${++serial}`);
  await until(() => $('recording-name').textContent === source.level.name, 'example loaded');
  const tick = (ms = 10) => {
    now += ms;
    frame(now);
    return snapshots.at(-1);
  };
  const pad = (buttons = [], id = 'Test pad') => {
    pads = [
      {
        id,
        index: 0,
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 16 }, (_, i) => ({
          pressed: buttons.includes(i),
          value: Number(buttons.includes(i)),
        })),
      },
    ];
    return tick();
  };
  const press = (button) => {
    pad();
    return pad([button]);
  };
  const key = (node, name, extra = {}) => {
    node.focus();
    const event = node.emit('keydown', {
      key: name,
      code: name === ' ' ? 'Space' : name,
      ...extra,
    });
    // Browser-owned Enter activation is intentionally modeled, not replaced by
    // a second handler in production. The adapter must leave it unconsumed.
    if (!event.defaultPrevented && !event.repeat && name === 'Enter' && node.tagName === 'BUTTON')
      node.click();
    return event;
  };
  tick();
  return {
    $,
    doc,
    win,
    tick,
    pad,
    press,
    key,
    source,
    snapshots,
    readCount: () => reads,
    cancelCount: () => cancelled,
    unplug: () => {
      pads = [];
      tick();
    },
    loadText: (value) => {
      $('replay-text').value = JSON.stringify(value);
      $('load-text').click();
    },
  };
}

for (const policy of ['immediate', 'grid-center'])
  test(`${policy}: keyboard transport, focus and Back preserve the real recorded cut through completion`, async (t) => {
    const h = await harness(t, recording(policy)),
      { $, key, tick, doc } = h;
    key($('board'), 'ArrowRight');
    assert.equal(tick().tick, 1);
    for (let i = 0; i < 11; i++) key($('board'), 'ArrowRight');
    const one = tick();
    assert.equal(one.tick, 12);
    assert.equal(one.run.player.cutting, true);
    key($('board'), 'ArrowRight', { repeat: true });
    assert.deepEqual(tick().checkpoint, one.checkpoint);
    key($('board'), ' ');
    tick(50);
    const running = tick(50);
    assert.ok(running.tick > 1);
    key($('board'), 'Escape');
    assert.equal($('playback-phase').textContent, 'paused');
    assert.equal(doc.activeElement, $('return-game'));
    assert.deepEqual(tick(100).checkpoint, running.checkpoint);
    key($('play-pause'), 'ArrowDown');
    assert.equal(doc.activeElement, $('restart'));
    key($('play-pause'), 'Enter', { repeat: true });
    assert.equal($('playback-phase').textContent, 'paused');
    key($('play-pause'), 'Enter');
    for (let i = 0; i < 15; i++) tick(100);
    assert.equal($('playback-phase').textContent, 'complete');
    assert.deepEqual(h.snapshots.at(-1).checkpoint, h.source.checkpoint);
    key($('board'), 'Enter');
    assert.equal(doc.activeElement, $('restart'));
    assert.equal(h.snapshots.at(-1).tick, 120, 'Restoring focus does not restart.');
  });

test('controller joins without activation, previews native speed, cancels once and pauses before leaving', async (t) => {
  const h = await harness(t),
    { $, pad, press, doc, tick } = h;
  pad([0]);
  pad([0]);
  assert.equal($('playback-phase').textContent, 'paused');
  press(0);
  pad([0]);
  assert.equal(doc.activeElement, $('play-pause'));
  assert.equal($('playback-phase').textContent, 'paused');
  press(0);
  assert.equal($('playback-phase').textContent, 'playing');
  $('speed').focus();
  press(0);
  assert.equal($('speed').getAttribute('data-controller-editing'), 'true');
  press(15);
  assert.equal($('speed').value, '1');
  press(1);
  assert.equal($('speed').getAttribute('data-controller-editing'), null);
  assert.equal($('speed').value, '1');
  assert.equal($('playback-phase').textContent, 'playing', 'First Back only cancels the draft.');
  press(0);
  press(15);
  press(0);
  assert.equal($('speed').value, '2');
  press(1);
  assert.equal($('playback-phase').textContent, 'paused');
  assert.equal(doc.activeElement, $('return-game'));
  const checkpoint = tick().checkpoint;
  pad([1]);
  pad([0]);
  assert.deepEqual(
    tick().checkpoint,
    checkpoint,
    'Held/changed buttons cannot pass the neutral gate.',
  );
});

test('Back cancels a deferred import without adoption; native text editing and file choice remain native', async (t) => {
  const h = await harness(t),
    { $, key, tick } = h;
  key($('board'), 'ArrowRight');
  const before = tick().checkpoint;
  $('replay-text').closest('details').open = true;
  assert.equal(key($('replay-text'), 'ArrowRight').defaultPrevented, false);
  assert.equal(key($('replay-text'), 'Enter').defaultPrevented, false);
  let finish;
  $('replay-file').files = [
    {
      name: 'later.json',
      size: 100,
      text: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  ];
  $('replay-file').emit('change');
  await until(() => !!finish, 'file read began');
  assert.equal($('playback-phase').textContent, 'Verifying');
  key($('replay-file'), 'Escape');
  assert.match($('import-status').textContent, /cancelled/);
  finish(JSON.stringify(recording('grid-center', true)));
  for (let i = 0; i < 5; i++) await setImmediate();
  assert.deepEqual(tick().checkpoint, before);
  assert.equal($('recording-name').textContent, 'Navigation recording');
  h.loadText({ version: 'wrong' });
  await until(
    () => $('import-status').textContent.startsWith('Could not load'),
    'invalid replay rejected',
  );
  assert.deepEqual(tick().checkpoint, before);
});

test('blur, controller loss and page disposal pause exact playback and reject a late import', async (t) => {
  const h = await harness(t),
    { $, key, tick, pad, press, win, doc } = h;
  key($('board'), ' ');
  tick(20);
  const before = tick(50).checkpoint;
  doc.focused = false;
  win.emit('blur');
  const reads = h.readCount();
  tick(100);
  assert.deepEqual(h.snapshots.at(-1).checkpoint, before);
  assert.equal(h.readCount(), reads);
  doc.focused = true;
  win.emit('focus');
  pad([0]);
  pad([0]);
  assert.equal($('playback-phase').textContent, 'paused');
  press(0);
  press(0);
  assert.equal($('playback-phase').textContent, 'playing');
  h.unplug();
  assert.equal($('playback-phase').textContent, 'paused');
  let finish;
  $('replay-file').files = [
    {
      name: 'late.json',
      size: 100,
      text: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  ];
  $('replay-file').emit('change');
  await until(() => !!finish, 'pending import began');
  win.emit('pagehide', { persisted: false });
  assert.equal(h.cancelCount(), 1);
  finish(JSON.stringify(recording('immediate', true)));
  for (let i = 0; i < 5; i++) await setImmediate();
  const count = h.snapshots.length;
  tick(100);
  assert.equal(h.snapshots.length, count);
  assert.equal($('recording-name').textContent, 'Navigation recording');
});

test('Classic replay import stays paused and controller completion checks the exact v6 checkpoint', async (t) => {
  const source = recording('grid-center', true),
    h = await harness(t),
    { $, pad, press, tick } = h;
  h.loadText(source);
  await until(
    () => $('recording-name').textContent === source.level.name,
    'Classic replay adopted',
  );
  assert.equal($('playback-phase').textContent, 'paused');
  pad();
  press(0);
  press(0);
  for (let i = 0; i < 15; i++) tick(100);
  assert.equal($('playback-phase').textContent, 'complete');
  assert.deepEqual(h.snapshots.at(-1).checkpoint, source.checkpoint);
  assert.equal(h.snapshots.at(-1).run.ruleset, 'xonix-core.v5');
});
