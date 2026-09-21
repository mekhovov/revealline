import { mountToolReturnLinks } from '../ui/workshop-return.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate, setTimeout as delay } from 'node:timers/promises';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const html = readFileSync(new URL('../replay-theater/index.html', import.meta.url), 'utf8');
let serial = 0;
async function until(predicate, label) {
  await waitFor(predicate, { message: label });
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
    .split(/<body\b[^>]*>/u)[1]
    .split('</body>')[0]
    .matchAll(/<\/?[^>]+>|[^<]+/g)) {
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) {
      const parent = stack.at(-1);
      parent._text = (parent._text || '') + token.trim();
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
async function harness(t, source = recording(), { expectLoadFailure = false } = {}) {
  const doc = new Document(),
    win = new Events();
  mount(doc);
  mountToolReturnLinks({
    document: doc,
    href: 'https://example.test/releases/v0.29.2/site/game/replay-theater/?journey=opening',
    id: 'replay-theater',
  });
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
  await until(
    () =>
      expectLoadFailure
        ? $('import-status').dataset.state === 'error'
        : $('recording-name').textContent === source.level.name,
    expectLoadFailure ? 'initial replay rejected' : 'example loaded',
  );
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

function identifyFocusTargets(doc) {
  doc.body.id ||= 'theater-test-body';
  const summary = doc.querySelector('.replay-interface summary');
  if (summary) summary.id ||= 'theater-test-interface-summary';
}

function jumpToPlayback(h, click = {}) {
  identifyFocusTargets(h.doc);
  // The original production markup lacks the new ID. Resolve its real anchor
  // too, so baseline discrimination reaches the missing focus behavior.
  const link = h.$('jump-playback') ?? h.doc.querySelector('a[href="#playback"]');
  if (link) link.id ||= 'jump-playback';
  assert.ok(link, 'The actual markup exposes the playback anchor.');
  assert.equal(link.getAttribute('href'), '#playback');
  assert.equal(h.key(link, 'Enter').defaultPrevented, false, 'Enter retains native activation.');
  const event = link.emit('click', { button: 0, ...click });
  // Model the observed browser default AFTER the real click handler: the
  // fragment scrolls, then leaves BODY focused. The handoff must survive it.
  if (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey
  ) {
    h.$('playback').scrollIntoView();
    h.doc.body.focus();
  }
  return event;
}

function modelDisabledControlFocus(h, node) {
  identifyFocusTargets(h.doc);
  let disabled = node.disabled;
  Object.defineProperty(node, 'disabled', {
    configurable: true,
    get: () => disabled,
    set(value) {
      disabled = value;
      // Match the native observation: disabling the active transport control
      // leaves BODY focused before updateControls finishes.
      if (value && h.doc.activeElement === node) h.doc.body.focus();
    },
  });
}

test('native fragment Jump hands off to playback and the next Tab reaches Restart without changing the recording', async (t) => {
  const h = await harness(t),
    { $, doc, key, tick } = h;
  for (let i = 0; i < 12; i++) key($('board'), 'ArrowRight');
  const before = tick().checkpoint;
  assert.equal(jumpToPlayback(h).defaultPrevented, false, 'Native fragment/history is retained.');
  assert.equal(doc.activeElement?.id, doc.body.id, 'The modeled browser default clears focus.');
  await delay(0);
  assert.equal(doc.activeElement?.id, 'play-pause');
  assert.ok($('play-pause').scrolled, 'The preferred control is brought into view.');
  assert.equal($('playback-phase').textContent, 'paused');
  assert.deepEqual(tick(100).checkpoint, before);
  key(doc.activeElement, 'Tab');
  assert.equal(doc.activeElement?.id, 'restart', 'Tab continues in playback, not the header.');
  assert.deepEqual(tick(100).checkpoint, before);

  key($('play-pause'), 'Enter');
  const running = tick(0).checkpoint;
  jumpToPlayback(h);
  await delay(0);
  assert.equal(doc.activeElement?.id, 'play-pause');
  assert.equal($('playback-phase').textContent, 'playing', 'Jump is not a transport command.');
  assert.deepEqual(tick(0).checkpoint, running);
  for (let i = 0; i < 15; i++) tick(100);
  assert.equal($('playback-phase').textContent, 'complete');
  jumpToPlayback(h);
  await delay(0);
  assert.equal(doc.activeElement?.id, 'restart', 'A completed recording has a usable target.');
  assert.deepEqual(tick().checkpoint, h.source.checkpoint);
});

test('Jump chooses Cancel for a held import and preserves the prior recording after rejection', async (t) => {
  const h = await harness(t),
    { $, doc, tick } = h;
  h.key($('board'), 'ArrowRight');
  const before = tick().checkpoint;
  let finish;
  $('replay-file').files = [
    {
      name: 'pending-jump.json',
      size: 100,
      text: () => new Promise((resolve) => (finish = resolve)),
    },
  ];
  $('replay-file').emit('change');
  await until(() => finish, 'file read is pending');
  jumpToPlayback(h);
  await delay(0);
  assert.equal(doc.activeElement?.id, 'cancel-load');
  assert.equal($('import-status').dataset.state, 'busy', 'Jump does not cancel preparation.');
  assert.equal($('cancel-load').hidden, false);
  assert.deepEqual(tick().checkpoint, before);
  finish(JSON.stringify({ version: 'wrong' }));
  await until(() => $('import-status').dataset.state === 'error', 'import rejected');
  jumpToPlayback(h);
  await delay(0);
  assert.equal(doc.activeElement?.id, 'play-pause', 'A failed import keeps prior playback usable.');
  assert.deepEqual(tick().checkpoint, before);
  assert.equal($('recording-name').textContent, h.source.level.name);
});

test('Jump with no loaded recording reaches Load example without retrying the failed import', async (t) => {
  const h = await harness(t, { version: 'wrong' }, { expectLoadFailure: true }),
    { $, doc, tick } = h;
  const message = $('import-status').textContent;
  jumpToPlayback(h);
  await delay(0);
  assert.equal(doc.activeElement?.id, 'load-example');
  assert.equal($('import-status').dataset.state, 'error');
  assert.equal($('import-status').textContent, message);
  assert.equal($('recording-name').textContent, 'Choose a recording');
  tick();
  assert.equal(h.snapshots.length, 0);
});

test('Jump preserves modified clicks and yields to newer focus, input, background and terminal disposal', async (t) => {
  const h = await harness(t),
    { $, doc, win, tick } = h,
    before = tick().checkpoint;
  for (const click of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
    { button: 2 },
  ]) {
    assert.equal(jumpToPlayback(h, click).defaultPrevented, false);
    await delay(0);
    assert.equal(doc.activeElement?.id, 'jump-playback');
  }
  jumpToPlayback(h, { defaultPrevented: true });
  await delay(0);
  assert.equal(doc.activeElement?.id, 'jump-playback');

  const link = $('jump-playback');
  for (const [attribute, value] of [
    ['target', '_blank'],
    ['download', 'recording.html'],
    ['href', '#recording-name'],
  ]) {
    const previous = link.getAttribute(attribute);
    link.setAttribute(attribute, value);
    link.focus();
    // Deliver the native click boundary without modeling a new tab/download
    // or a different fragment. This owner must leave each default untouched.
    assert.equal(link.emit('click', { button: 0 }).defaultPrevented, false);
    await delay(0);
    assert.equal(doc.activeElement?.id, 'jump-playback', `${attribute} retains native ownership.`);
    if (previous === null) link.removeAttribute(attribute);
    else link.setAttribute(attribute, previous);
  }
  const preventLater = (event) => event.preventDefault();
  doc.addEventListener('click', preventLater);
  try {
    assert.equal(jumpToPlayback(h).defaultPrevented, true);
    await delay(0);
    assert.equal(
      doc.activeElement?.id,
      'jump-playback',
      'A later bubble cancellation vetoes focus.',
    );
  } finally {
    doc.removeEventListener('click', preventLater);
  }

  jumpToPlayback(h);
  $('restart').focus();
  await delay(0);
  assert.equal(doc.activeElement?.id, 'restart', 'Newer focus wins.');
  jumpToPlayback(h);
  doc.body.emit('pointerdown', { button: 0 });
  await delay(0);
  assert.equal(doc.activeElement?.id, doc.body.id, 'A newer pointer gesture can keep BODY focus.');
  jumpToPlayback(h);
  h.key($('return-game'), 'Tab');
  const newerKeyboardFocusId = doc.activeElement.id;
  await delay(0);
  assert.equal(doc.activeElement?.id, newerKeyboardFocusId, 'Newer keyboard navigation wins.');

  jumpToPlayback(h);
  win.emit('blur');
  await delay(0);
  assert.equal(doc.activeElement?.id, doc.body.id);
  win.emit('focus');
  jumpToPlayback(h);
  win.emit('pagehide', { persisted: true });
  await delay(0);
  assert.equal(doc.activeElement?.id, doc.body.id);
  win.emit('pageshow', { persisted: true });
  jumpToPlayback(h);
  await delay(0);
  assert.equal(doc.activeElement?.id, 'play-pause', 'Cached return retains the owned handler.');
  assert.deepEqual(tick().checkpoint, before);

  jumpToPlayback(h);
  win.emit('pagehide', { persisted: false });
  await delay(0);
  assert.equal(doc.activeElement?.id, doc.body.id, 'Terminal disposal cancels the handoff.');
  jumpToPlayback(h);
  await delay(0);
  assert.equal(
    doc.activeElement?.id,
    doc.body.id,
    'The disposed click handler cannot focus controls.',
  );
});

test('completed Play and Step hand off to Restart with exact final checkpoints and local next Tab', async (t) => {
  const h = await harness(t),
    { $, doc, key, tick } = h;
  modelDisabledControlFocus(h, $('play-pause'));
  modelDisabledControlFocus(h, $('step'));
  key($('play-pause'), 'Enter');
  for (let i = 0; i < 15; i++) tick(100);
  assert.equal($('playback-phase').textContent, 'complete');
  assert.equal(doc.activeElement?.id, 'restart', 'Focus survives native Play disabling.');
  assert.deepEqual(h.snapshots.at(-1).checkpoint, h.source.checkpoint);
  key(doc.activeElement, 'Tab');
  assert.equal(doc.activeElement?.id, 'speed', 'Tab stays in transport and skips disabled Step.');
  assert.deepEqual(tick().checkpoint, h.source.checkpoint);

  key($('restart'), 'Enter');
  for (let i = 0; i < h.source.ticks; i++) key($('step'), 'Enter');
  assert.equal($('playback-phase').textContent, 'complete');
  assert.equal(doc.activeElement?.id, 'restart', 'The final explicit Step has the same handoff.');
  assert.deepEqual(tick().checkpoint, h.source.checkpoint);
});

test('completion preserves unrelated editor focus and does not steal background focus', async (t) => {
  const h = await harness(t),
    { $, doc, key, tick } = h;
  modelDisabledControlFocus(h, $('play-pause'));
  key($('play-pause'), 'Enter');
  $('replay-text').closest('details').open = true;
  $('replay-text').value = 'Unfinished import text';
  $('replay-text').focus();
  for (let i = 0; i < 15; i++) tick(100);
  assert.equal($('playback-phase').textContent, 'complete');
  assert.equal(doc.activeElement?.id, 'replay-text');
  assert.equal($('replay-text').value, 'Unfinished import text');
  assert.deepEqual(h.snapshots.at(-1).checkpoint, h.source.checkpoint);

  key($('restart'), 'Enter');
  key($('play-pause'), 'Enter');
  // Model an in-flight completion after foreground ownership was lost, before
  // a blur handler could pause. The current document must not steal focus.
  doc.focused = false;
  for (let i = 0; i < 15; i++) tick(100);
  assert.equal($('playback-phase').textContent, 'complete');
  assert.equal(doc.activeElement?.id, doc.body.id);
  assert.deepEqual(h.snapshots.at(-1).checkpoint, h.source.checkpoint);
  doc.focused = true;
});

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
    assert.match($('navigation-status').textContent, /Return to Workshop is focused/);
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
  assert.equal($('import-status').dataset.state, 'busy');
  assert.equal($('import-status').dataset.stage, 'reading');
  assert.equal($('cancel-load').hidden, false);
  key($('replay-file'), 'Escape');
  assert.match($('import-status').textContent, /cancelled/);
  assert.equal($('import-status').dataset.state, 'cancelled');
  const cancelled = $('import-status').textContent;
  finish(JSON.stringify(recording('grid-center', true)));
  for (let i = 0; i < 5; i++) await setImmediate();
  assert.deepEqual(tick().checkpoint, before);
  assert.equal($('import-status').textContent, cancelled);
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

test('real replay verification reports exact ticks and a cancelled artwork decode cannot adopt its candidate', async (t) => {
  const { $, tick, loadText } = await harness(t);
  const before = tick().checkpoint;
  const candidate = recording('grid-center', true);
  const meter = $('import-status').querySelector('progress');
  const measured = [];
  let value = meter.value;
  Object.defineProperty(meter, 'value', {
    configurable: true,
    get: () => value,
    set(next) {
      value = next;
      measured.push({ completed: next, total: meter.max });
    },
  });
  let finish;
  t.mock.method(
    BoardPainter.prototype,
    'setLook',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  loadText(candidate);
  await until(() => finish, 'verified candidate reached artwork decoding');
  assert.deepEqual(measured.at(-1), { completed: candidate.ticks, total: candidate.ticks });
  assert.equal($('import-status').dataset.stage, 'decoding');
  assert.equal(meter.hidden, true, 'artwork has no invented tick progress');
  assert.equal($('cancel-load').hidden, false);
  $('cancel-load').click();
  assert.equal($('import-status').dataset.state, 'cancelled');
  finish();
  for (let i = 0; i < 5; i++) await setImmediate();
  assert.equal($('recording-name').textContent, 'Navigation recording');
  assert.deepEqual(tick().checkpoint, before);
  t.mock.method(BoardPainter.prototype, 'setLook', async () => {});
  loadText(candidate);
  await until(
    () => $('recording-name').textContent === 'Classic recording',
    'retry loaded verified candidate',
  );
  assert.equal($('import-status').dataset.state, 'ready');
  assert.equal($('playback-phase').textContent, 'paused');
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

function modelHiddenControlFocus(h, node) {
  identifyFocusTargets(h.doc);
  let hidden = node.hidden;
  Object.defineProperty(node, 'hidden', {
    configurable: true,
    get: () => hidden,
    set(value) {
      hidden = value;
      // Native hiding removes the focused Cancel control from keyboard navigation.
      if (value && h.doc.activeElement === node) h.doc.body.focus();
    },
  });
}
async function holdReplayFile(h, name = 'held-focus.json') {
  let finish;
  h.$('replay-file').files = [
    { name, size: 100, text: () => new Promise((resolve) => (finish = resolve)) },
  ];
  h.$('replay-file').emit('change');
  await until(() => finish, 'the ordinary file reader is held');
  return finish;
}

for (const outcome of ['cancel', 'success', 'failure', 'completed', 'empty'])
  test(`settled Cancel focus: ${outcome} hands off to a usable control without starting playback`, async (t) => {
    const h =
      outcome === 'empty'
        ? await harness(t, { version: 'wrong' }, { expectLoadFailure: true })
        : await harness(t);
    const { $, doc, tick, key } = h;
    modelHiddenControlFocus(h, $('cancel-load'));
    if (outcome === 'completed') {
      key($('play-pause'), 'Enter');
      for (let i = 0; i < 15; i++) tick(100);
      assert.equal($('playback-phase').textContent, 'complete');
    } else if (outcome !== 'empty') key($('board'), 'ArrowRight');
    const before = tick()?.checkpoint,
      name = $('recording-name').textContent;
    const finish = await holdReplayFile(h);
    jumpToPlayback(h);
    await delay(0);
    assert.equal(doc.activeElement, $('cancel-load'));
    if (['cancel', 'completed', 'empty'].includes(outcome)) key($('cancel-load'), 'Enter');
    else
      finish(
        JSON.stringify(
          outcome === 'success' ? recording('grid-center', true) : { version: 'wrong' },
        ),
      );
    await until(() => $('cancel-load').hidden, 'load settled');
    const expected =
      outcome === 'completed' ? 'restart' : outcome === 'empty' ? 'load-example' : 'play-pause';
    assert.equal(doc.activeElement, $(expected));
    assert.equal($(expected).disabled, false);
    assert.ok($(expected).scrolled);
    if (['cancel', 'completed', 'empty'].includes(outcome)) {
      finish(JSON.stringify(recording('grid-center', true)));
      for (let i = 0; i < 5; i++) await setImmediate();
      assert.equal($('import-status').dataset.state, 'cancelled');
    }
    if (outcome === 'success') {
      assert.equal($('recording-name').textContent, 'Classic recording');
      assert.equal($('playback-phase').textContent, 'paused');
      assert.equal(tick(100).tick, 0);
    } else {
      assert.equal($('recording-name').textContent, name);
      tick(100);
      assert.deepEqual(h.snapshots.at(-1)?.checkpoint, before);
    }
  });

for (const departure of ['editor', 'pointer', 'background', 'foreground-suspend', 'new-load'])
  test(`settled Cancel focus yields to ${departure} ownership`, async (t) => {
    const h = await harness(t),
      { $, doc, win, tick } = h;
    modelHiddenControlFocus(h, $('cancel-load'));
    const before = tick().checkpoint;
    const finish = await holdReplayFile(h);
    $('cancel-load').focus();
    let newer;
    if (departure === 'editor') {
      $('replay-text').closest('details').open = true;
      $('replay-text').value = 'Keep this draft';
      $('replay-text').focus();
    } else if (departure === 'pointer') {
      // Reading nonfocusable text is a newer intent even while Cancel still has focus.
      $('recording-name').emit('pointerdown');
    } else if (departure === 'background') {
      doc.focused = false;
      win.emit('blur');
    } else if (departure === 'foreground-suspend') {
      assert.equal(doc.hidden, false);
      assert.equal(doc.hasFocus(), true);
      win.emit('pagehide', { persisted: true });
    } else newer = await holdReplayFile(h, 'newer.json');
    finish(JSON.stringify({ version: 'wrong' }));
    if (departure === 'new-load') {
      for (let i = 0; i < 5; i++) await setImmediate();
      assert.equal($('import-status').dataset.state, 'busy');
      assert.equal($('cancel-load').hidden, false);
      assert.equal(doc.activeElement, $('cancel-load'));
      newer(JSON.stringify({ version: 'wrong' }));
    }
    await until(() => $('cancel-load').hidden, 'current load settled');
    assert.equal(doc.activeElement, departure === 'editor' ? $('replay-text') : doc.body);
    if (departure === 'editor') assert.equal($('replay-text').value, 'Keep this draft');
    if (departure === 'background') {
      doc.focused = true;
      win.emit('focus');
    }
    if (departure === 'foreground-suspend') win.emit('pageshow', { persisted: true });
    assert.deepEqual(tick(100).checkpoint, before);
    assert.equal($('playback-phase').textContent, 'paused');
  });

for (const departure of ['blur', 'hidden', 'persisted', 'controller-loss'])
  test(`complete replay keeps Restart guidance through ${departure}`, async (t) => {
    const h = await harness(t),
      { $, doc, win, key, tick } = h;
    key($('play-pause'), 'Enter');
    for (let i = 0; i < 15; i++) tick(100);
    assert.equal($('playback-phase').textContent, 'complete');
    const message = $('transport-status').textContent;
    assert.match(message, /Restart to watch again/);
    const before = tick().checkpoint;
    if (departure === 'blur') {
      doc.focused = false;
      win.emit('blur');
      doc.focused = true;
      win.emit('focus');
    }
    if (departure === 'hidden') {
      doc.hidden = true;
      doc.emit('visibilitychange');
      doc.hidden = false;
      doc.emit('visibilitychange');
    }
    if (departure === 'persisted') {
      win.emit('pagehide', { persisted: true });
      win.emit('pageshow', { persisted: true });
    }
    if (departure === 'controller-loss') {
      h.pad();
      h.press(0);
      h.unplug();
    }
    assert.equal($('transport-status').textContent, message);
    assert.equal($('play-pause').disabled, true);
    assert.equal($('step').disabled, true);
    assert.equal($('restart').disabled, false);
    assert.equal($('playback-phase').textContent, 'complete');
    assert.deepEqual(tick(100).checkpoint, before);
    key($('restart'), 'Enter');
    assert.equal(tick().tick, 0);
    assert.equal($('playback-phase').textContent, 'paused');
    assert.equal($('play-pause').disabled, false);
  });

test('a rejected first load keeps its recovery status through lifecycle return without advertising Play', async (t) => {
  const h = await harness(t, { version: 'wrong' }, { expectLoadFailure: true });
  const { $, win, tick } = h;
  const status = $('transport-status').textContent,
    failure = $('import-status').textContent;
  win.emit('pagehide', { persisted: true });
  win.emit('pageshow', { persisted: true });
  assert.equal($('transport-status').textContent, status);
  assert.equal($('import-status').textContent, failure);
  assert.equal($('play-pause').disabled, true);
  assert.equal($('step').disabled, true);
  tick();
  assert.equal(h.snapshots.length, 0);
});

test('a playback checkpoint failure keeps its error through lifecycle return', async (t) => {
  const h = await harness(t),
    { $, win, key, tick } = h;
  // Inject a read-model corruption at the renderer boundary. The real player
  // must reject the final checkpoint; this is not an imported fixture bypass.
  tick().run.score++;
  key($('play-pause'), 'Enter');
  for (let i = 0; i < 15; i++) tick(100);
  assert.equal($('playback-phase').textContent, 'error');
  const message = $('transport-status').textContent,
    checkpoint = $('checkpoint').textContent;
  assert.ok(message);
  assert.doesNotMatch(message, /Choose Play/);
  win.emit('pagehide', { persisted: true });
  win.emit('pageshow', { persisted: true });
  assert.equal($('transport-status').textContent, message);
  assert.equal($('checkpoint').textContent, checkpoint);
  assert.equal($('play-pause').disabled, true);
  assert.equal($('step').disabled, true);
  assert.equal($('restart').disabled, false);
});
