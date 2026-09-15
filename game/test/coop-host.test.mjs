import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountCouch } from './helpers/couch-host.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { createCoop, startCoop, pauseCoop, resumeCoop, stepCoop, FIXED_DT } from '../coop/core.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { coopRetryFeedback } from '../couch/coop-feedback.mjs';

const html = await readFile(new URL('../couch/relay-rescue.html', import.meta.url), 'utf8');
let sequence = 0;

/** Real markup and game modules, with a minimal DOM, inert Canvas, and controlled frame callbacks. */
async function page(t, { touch = false } = {}) {
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
  const pads = [];
  const touchListeners = new Set();
  const touchQuery = {
    matches: touch,
    addEventListener: (type, fn) => touchListeners.add(fn),
    removeEventListener: (type, fn) => touchListeners.delete(fn),
  };
  const install = (key, descriptor) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
  };
  for (const [key, value] of Object.entries({
    document: doc,
    window: win,
    navigator: { getGamepads: () => pads },
    location: { href: 'http://localhost/game/couch/relay-rescue.html' },
    matchMedia: (query) => (query === '(any-pointer: coarse)' ? touchQuery : { matches: false }),
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
  const tap = (key) => {
    press(key);
    doc.activeElement.emit('keyup', { key, code: key });
  };
  let now = 0;
  const tick = (count = 1) => {
    for (let index = 0; index < count; index++) {
      const [id, callback] = frames.entries().next().value;
      frames.delete(id);
      callback((now += FIXED_DT * 1000));
    }
  };
  return {
    $,
    doc,
    selectFile,
    choose,
    press,
    tap,
    tick,
    pads,
    touchPads: [...doc.querySelectorAll('.race-pad')],
    setTouch(value) {
      touchQuery.matches = value;
      for (const fn of touchListeners) fn();
    },
    // This minimal host has no native summary activation. Model only that
    // browser default while retaining real navigation/cancel callbacks.
    disclose(id) {
      $(id).open = true;
      $(id).querySelector('summary').focus();
    },
  };
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
  f.disclose('coop-options');
  f.choose('coop-touch', 'on');
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
  f.$('coop-options').open = false;
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

test('the selected cut rules agree across the briefing and actual start message', async (t) => {
  const f = await page(t);
  for (const style of ['independent', 'joint', 'full']) {
    f.choose('coop-experiment', style);
    if (style === 'independent') {
      assert.doesNotMatch(f.$('coop-intro').textContent, /meet to join/);
      assert.match(f.$('coop-cut-help').textContent, /does not join your lines/);
    } else {
      assert.match(f.$('coop-intro').textContent, /small loop/);
      assert.match(f.$('coop-cut-help').textContent, /bank a shared cut/);
      assert.doesNotMatch(f.$('coop-cut-help').textContent, /does not join/);
    }
    f.$('coop-start').click();
    assert.match(
      f.$('coop-message').textContent,
      style === 'independent' ? /head meetings do not join/ : /join after the charge passes/,
    );
    f.$('coop-pause').click();
    f.$('coop-lobby').click();
  }
});

test('real keyboard self-crossings explain the shared recovery and cause-aware retry', async (t) => {
  const f = await page(t),
    pack = customPack('self-crossing');
  // An authored empty arena isolates input, recovery and debrief behavior from enemy motion.
  pack.levels[0].enemies = [];
  await f.selectFile(JSON.stringify(pack));
  f.$('coop-difficulty').value = 'expert';
  f.$('coop-start').click();
  f.tick(3);
  const loop = () => {
    for (const [first, second, ticks] of [
      ['KeyD', 'ArrowLeft', 30],
      ['KeyW', 'ArrowUp', 15],
      ['KeyD', 'ArrowLeft', 15],
      ['KeyS', 'ArrowDown', 15],
      ['KeyA', 'ArrowRight', 15],
    ]) {
      f.tap(first);
      f.tap(second);
      f.tick(ticks);
    }
  };
  loop();
  assert.match(f.$('coop-message').textContent, /Both craft are back\. One team reserve used/);
  assert.equal(f.$('coop-reserves').textContent, '0 reserves');
  loop();
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-resume').hidden, true);
  const copy = f.$('coop-overlay-copy').textContent;
  assert.match(copy, /0% revealed; goal 65%/);
  assert.match(copy, /unfinished line crossed itself/);
  assert.match(copy, /safe ground before crossing your own line/);
  assert.doesNotMatch(copy, /Hunter|Support|Sunflower|Skyline/);
  assert.equal(copy.match(/unfinished line crossed itself/g).length, 1);
  f.$('coop-retry').click();
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(f.$('coop-level').value, 'self-crossing-coverage');
});

test('retry feedback counts required objectives and distinguishes enemy and spark causes', () => {
  const run = {
    coverage: 0.5,
    level: { goal: { cores: ['required'] } },
    strongholds: [
      { id: 'optional', defeated: true, anchors: [{ captured: true }, { captured: true }] },
      { id: 'required', defeated: false, anchors: [{ captured: true }, { captured: false }] },
    ],
    enemies: [
      { id: 'hunter', type: 'hunter' },
      { id: 'drifter', type: 'drifter' },
    ],
  };
  const hunter = coopRetryFeedback(run, [{ cause: 'enemy-trail', enemy: 'hunter' }]);
  assert.match(hunter, /0 \/ 1 required cores and 1 \/ 2 anchors/);
  assert.match(hunter, /A Hunter caught an unfinished line/);
  assert.doesNotMatch(hunter, /50%|crossed itself/);
  const drifter = coopRetryFeedback(run, [{ cause: 'enemy-player', enemy: 'drifter' }]);
  assert.match(drifter, /roaming enemy caught an exposed craft/);
  assert.doesNotMatch(drifter, /Hunter/);
  const spark = coopRetryFeedback(run, [{ cause: 'line-impact', enemy: 'required' }]);
  assert.match(spark, /travelling spark/);
  assert.match(spark, /Intercept a nearby spark with Support or bank the cut sooner/);
  const coverage = coopRetryFeedback({ ...run, level: { goal: { coverage: 0.724001 } } });
  assert.match(coverage, /50% revealed; goal 72\.41%/);
  assert.doesNotMatch(coverage, /cores|anchors/);
});

test('a slowed enemy stays marked after the pulse, through pause and reduced effects, then expires', () => {
  const level = structuredClone(COOP_STARTER_PACK.levels[0]);
  level.enemies = [{ id: 'nearby', type: 'drifter', x: 3.5, y: 17.5, vx: 1, vy: 0, radius: 0.3 }];
  const run = createCoop(level);
  const neutral = () =>
    Array.from({ length: 2 }, () => ({ direction: null, boost: false, support: false }));
  const labels = [];
  const context = new Proxy(
    { fillText: (text) => labels.push(text) },
    {
      get: (target, key) => (Object.hasOwn(target, key) ? target[key] : () => {}),
    },
  );
  const painter = createCoopPainter({ width: 1152, getContext: () => context });
  const marked = (reduced = false) => {
    labels.length = 0;
    painter.paint(run, { reduced });
    return labels.includes('SLOWED');
  };
  startCoop(run);
  stepCoop(run, neutral(), FIXED_DT);
  const pulse = neutral();
  pulse[0].support = true;
  stepCoop(run, pulse, FIXED_DT);
  assert.equal(marked(), true);
  for (let tick = 0; tick < 60; tick++) stepCoop(run, neutral(), FIXED_DT);
  assert.equal(run.supportEffects.length, 0, 'The short pulse animation has ended.');
  assert.equal(marked(true), true);
  pauseCoop(run);
  const before = structuredClone(run);
  for (let tick = 0; tick < 120; tick++) stepCoop(run, neutral(), FIXED_DT);
  assert.equal(marked(), true);
  assert.deepEqual(
    run,
    before,
    'Neither paused stepping nor rendering changes authoritative state.',
  );
  resumeCoop(run);
  for (let tick = 0; tick < 125; tick++) stepCoop(run, neutral(), FIXED_DT);
  assert.equal(marked(), false);
  const empty = neutral();
  empty[1].support = true;
  stepCoop(run, empty, FIXED_DT);
  assert.ok(
    run.events.some((event) => event.type === 'support.pulse' && !event.slowedEnemies.length),
  );
  assert.equal(marked(), false, 'An empty pulse does not claim an enemy is slowed.');
});

test('Auto touch uses actual controller seats while menu hiding and explicit overrides stay authoritative', async (t) => {
  const f = await page(t, { touch: true });
  assert.equal(f.$('coop-controls').hidden, true);
  assert.equal(f.$('coop-tools').parentNode.id, 'coop-lobby-tools');
  f.$('coop-start').click();
  f.tick(3);
  assert.deepEqual(
    f.touchPads.map((p) => p.hidden),
    [false, false],
  );
  assert.equal(f.$('coop-tools').hidden, true);
  f.pads.push({
    index: 7,
    id: 'First pad',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  });
  f.tick(2);
  assert.deepEqual(
    f.touchPads.map((p) => p.hidden),
    [true, false],
    'The assigned seat loses only its Auto virtual pad.',
  );
  f.$('coop-pause').click();
  assert.deepEqual(
    f.touchPads.map((p) => p.hidden),
    [true, true],
  );
  assert.equal(f.$('coop-tools').parentNode.id, 'coop-pause-tools');
  f.disclose('coop-options');
  f.choose('coop-touch', 'on');
  f.setTouch(false);
  assert.equal(
    f.$('coop-controls').hidden,
    true,
    'Even explicit Show does not expose flight controls over menus.',
  );
  f.$('coop-resume').click();
  assert.deepEqual(
    f.touchPads.map((p) => p.hidden),
    [false, false],
    'Show overrides pointer capability and controller assignment.',
  );
  f.$('coop-pause').click();
  f.disclose('coop-options');
  f.choose('coop-touch', 'off');
  f.setTouch(true);
  f.$('coop-resume').click();
  assert.equal(f.$('coop-controls').hidden, true);
  f.$('coop-pause').click();
  f.$('coop-lobby').click();
  assert.equal(f.$('coop-controls').hidden, true);
  assert.equal(f.$('coop-tools').hidden, false);
  assert.equal(f.$('coop-tools').parentNode.id, 'coop-lobby-tools');
});

test('paused Help reading and Back return to an action without resuming the shared simulation', async (t) => {
  const f = await page(t);
  f.$('coop-start').click();
  f.tick(60);
  f.$('coop-pause').click();
  const clock = f.$('coop-clock').textContent;
  f.disclose('coop-help');
  assert.equal(f.$('coop-help-read').onclick(), true);
  assert.equal(f.doc.activeElement.id, 'coop-help-reading');
  f.tick(120);
  assert.equal(f.$('coop-clock').textContent, clock);
  f.press('Escape');
  assert.equal(f.doc.activeElement.id, 'coop-help-read');
  f.press('Escape');
  assert.equal(f.$('coop-help').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-help-toggle');
  f.press('Escape');
  assert.equal(f.doc.activeElement.id, 'coop-resume');
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
  assert.equal(f.$('coop-clock').textContent, clock);
  f.disclose('coop-options');
  f.$('coop-touch').focus();
  assert.equal(f.press('ArrowDown').defaultPrevented, false, 'Native select arrows stay native.');
  assert.equal(
    f.press('Enter').defaultPrevented,
    false,
    'Select confirmation is not player-two Support.',
  );
  f.tick(60);
  assert.equal(f.$('coop-clock').textContent, clock);
  assert.equal(f.$('coop-overlay').hidden, false);
  f.press('Escape');
  f.press('Escape');
  assert.equal(f.doc.activeElement.id, 'coop-resume');
  f.$('coop-resume').click();
  f.tick(65);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.notEqual(f.$('coop-clock').textContent, clock);
});

test('assigning a controller releases hidden held touch; disconnect stays paused until Resume', async (t) => {
  const f = await page(t, { touch: true });
  f.$('coop-start').click();
  f.tick(3);
  const boost = f.touchPads[0].querySelector('[data-action="boost"]');
  boost.emit('pointerdown', { pointerId: 9, pointerType: 'touch', button: 0 });
  assert.equal(boost.getAttribute('aria-pressed'), 'true');
  f.pads.push({
    index: 5,
    id: 'Assigned pad',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  });
  f.tick(2);
  assert.equal(f.touchPads[0].hidden, true);
  assert.equal(boost.getAttribute('aria-pressed'), 'false');
  f.pads[0].connected = false;
  f.tick();
  const clock = f.$('coop-clock').textContent;
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-controls').hidden, true);
  f.tick(60);
  assert.equal(f.$('coop-clock').textContent, clock);
  f.$('coop-resume').click();
  assert.deepEqual(
    f.touchPads.map((p) => p.hidden),
    [false, false],
  );
  assert.equal(boost.getAttribute('aria-pressed'), 'false');
});
