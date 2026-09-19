import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { createCoop, startCoop, pauseCoop, resumeCoop, stepCoop, FIXED_DT } from '../coop/core.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createModeReturn } from '../mode-return.mjs';
import { coopRetryFeedback } from '../couch/coop-feedback.mjs';

import { page } from './helpers/coop-host.mjs';

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

test('the same Team mode choices belong to the lobby and active pause panel, never the live arena', async (t) => {
  const f = await page(t, { nativeFocus: true, capturePaint: true });
  const modes = f.$('coop-mode-actions');
  const solo = f.$('coop-solo');
  const versus = f.$('coop-versus');
  assert.deepEqual(
    modes.children.map((element) => element.dataset.gameMode),
    ['solo', 'versus', 'team'],
  );
  assert.equal(modes.parentNode, f.$('coop-lobby-modes'));
  assert.equal(modes.hidden, false);
  const current = modes.querySelector('[aria-current="page"]');
  assert.equal(current.tagName, 'SPAN');
  assert.equal(current.getAttribute('tabindex'), null);
  assert.equal(current.getAttribute('href'), null);
  assert.equal(solo.getAttribute('href'), '../');
  assert.equal(versus.getAttribute('href'), './');
  current.click();
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.visits.length, 0);

  f.$('coop-start').click();
  f.tick();
  assert.equal(modes.hidden, true);
  assert.equal(f.$('coop-overlay').hidden, true);
  f.$('coop-pause').click();
  assert.equal(modes.parentNode, f.$('coop-pause-modes'));
  assert.equal(modes.hidden, false);
  assert.equal(f.$('coop-overlay').contains(modes), true);
  assert.equal(f.$('coop-solo'), solo);
  assert.equal(f.$('coop-versus'), versus);
  tabToTeamAction(f, 'coop-solo');
  f.tap('Tab');
  assert.equal(f.doc.activeElement, versus, 'visible mode order is keyboard order');
  f.tap('Enter');
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.tap('Escape');
  assert.equal(f.doc.activeElement, versus, 'moving links retain their checked departure owner');
  assert.equal(f.visits.length, 0);
  f.$('coop-resume').click();
  assert.equal(modes.hidden, true);
  assert.equal(f.$('coop-overlay').hidden, true);
});

test('a file selected before Start cannot replace setup after returning from an attempt', async (t) => {
  const f = await page(t),
    read = deferred(),
    text = JSON.stringify(customPack('late'));
  f.$('coop-difficulty').value = 'expert';
  const pending = f.selectFile(text, () => read.promise);
  f.$('coop-start').click();
  f.$('coop-pause').click();
  f.$('coop-lobby').click();
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.$('coop-discard-confirm').click();
  read.resolve(text);
  await pending;
  assert.equal(f.$('coop-pack-status').textContent, 'Relay Rescue · 2 levels');
  assert.equal(f.$('coop-level').value, 'first-connection');
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
  assert.equal(f.$('coop-level').value, 'first-connection');
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
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.$('coop-discard-confirm').click();
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
  f.$('coop-settings-open').click();
  f.$('coop-settings-tab-controls').click();
  f.choose('coop-touch', 'on');
  f.$('coop-settings-tab-controls').focus();
  for (let index = 0; index < 30; index++) {
    f.press('Tab');
    assert.equal(f.doc.activeElement.closest('.race-pad'), null);
    seen.add(f.doc.activeElement.id);
  }
  assert.ok(seen.has('coop-touch'), 'Controls category exposes touch settings');
  assert.equal(seen.has('coop-level'), false, 'The dialog excludes the lobby');
  f.$('coop-settings-tab-display').click();
  f.$('coop-settings-tab-display').focus();
  for (let index = 0; index < 20; index++) {
    f.press('Tab');
    seen.add(f.doc.activeElement.id);
  }
  assert.ok(seen.has('coop-reduced'), 'Display category exposes reduced effects');
  f.$('coop-settings-close').click();
  for (let index = 0; index < 30; index++) {
    f.press('Tab');
    assert.equal(f.doc.activeElement.closest('.race-pad'), null);
    seen.add(f.doc.activeElement.id);
  }
  for (const id of ['coop-race', 'coop-level', 'coop-start'])
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
    assert.equal(f.$('coop-discard-dialog').open, true);
    f.$('coop-discard-confirm').click();
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
  f.$('coop-settings-open').click();
  f.$('coop-settings-tab-controls').click();
  f.choose('coop-touch', 'on');
  f.setTouch(false);
  f.$('coop-settings-close').click();
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
  f.$('coop-settings-open').click();
  f.$('coop-settings-tab-controls').click();
  f.choose('coop-touch', 'off');
  f.setTouch(true);
  f.$('coop-settings-close').click();
  f.$('coop-resume').click();
  assert.equal(f.$('coop-controls').hidden, true);
  f.$('coop-pause').click();
  f.$('coop-lobby').click();
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.$('coop-discard-confirm').click();
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
  f.$('coop-help-read').click();
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
  f.$('coop-settings-open').click();
  f.$('coop-settings-tab-controls').click();
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

test('Team pack reads show immediate status, Stop waiting rejects late adoption, and completion preserves deliberately moved focus', async (t) => {
  const f = await page(t),
    read = deferred(),
    candidate = JSON.stringify(customPack('slow'));
  f.$('coop-pack-file').focus();
  const pending = f.selectFile(candidate, () => read.promise);
  assert.equal(f.$('coop-pack-status').dataset.state, 'busy');
  assert.equal(f.$('coop-pack-status').dataset.stage, 'reading');
  assert.match(f.$('coop-pack-status').textContent, /Reading the selected Team pack/);
  assert.equal(f.$('coop-pack-cancel').hidden, false);
  assert.equal(f.$('coop-start').disabled, false, 'an import never blocks the existing arena');
  f.$('coop-pack-cancel').click();
  assert.equal(f.$('coop-pack-status').dataset.state, 'detached');
  const cancelled = f.$('coop-pack-status').textContent;
  read.resolve(candidate);
  await pending;
  assert.equal(f.$('coop-pack-status').textContent, cancelled);
  assert.equal(f.$('coop-level').value, 'first-connection');
  const nextRead = deferred();
  const next = f.selectFile(candidate, () => nextRead.promise);
  f.$('coop-race').focus();
  nextRead.resolve(candidate);
  await next;
  assert.equal(f.$('coop-pack-status').dataset.state, 'ready');
  assert.equal(f.$('coop-level').value, 'slow-coverage');
  assert.equal(f.doc.activeElement, f.$('coop-race'));
});

test('Back and closing the Team pack picker detach a read before reopening', async (t) => {
  const f = await page(t),
    candidate = JSON.stringify(customPack('closed'));
  const first = deferred();
  f.$('coop-pack-file').focus();
  const pending = f.selectFile(candidate, () => first.promise);
  f.tap('Escape');
  assert.equal(f.$('coop-pack-status').dataset.state, 'detached');
  assert.equal(f.doc.activeElement, f.$('coop-pack-file'));
  first.resolve(candidate);
  await pending;
  const second = deferred();
  const next = f.selectFile(candidate, () => second.promise);
  const picker = f.$('coop-pack-file').closest('details');
  f.$('coop-pack-file').value = 'C:\\fakepath\\team.json';
  picker.open = false;
  picker.emit('toggle');
  assert.equal(f.$('coop-pack-status').dataset.state, 'detached');
  assert.equal(
    f.$('coop-pack-file').value,
    '',
    'native same-file selection can emit change on retry',
  );
  second.resolve(candidate);
  await next;
  picker.open = true;
  picker.emit('toggle');
  assert.equal(f.$('coop-pack-status').dataset.state, 'detached');
  assert.equal(f.$('coop-level').value, 'first-connection');
  await f.selectFile(candidate);
  assert.equal(f.$('coop-pack-status').dataset.state, 'ready');
  assert.equal(f.$('coop-level').value, 'closed-coverage');
});

for (const [query, path, label] of [
  ['?return=solo', '../', 'Back to Solo'],
  ['?return=versus', './', 'Race mode ↗'],
  ['', './', 'Race mode ↗'],
  ['?return=https://other.invalid/', './', 'Race mode ↗'],
  ['?return=solo&return=versus', './', 'Race mode ↗'],
])
  test(`Team lobby uses only its code-owned return destination ${query || '(default)'}`, async (t) => {
    const href = `http://localhost/releases/v0.58.0/couch/relay-rescue.html${query}`,
      f = await page(t, { href }),
      destination = new URL(path, href).href,
      link = f.$('coop-race'),
      visited = [];
    assert.equal(new URL(link.getAttribute('href'), href).href, destination);
    assert.equal(link.textContent, label);
    link.onclick = () => visited.push(new URL(link.getAttribute('href'), href).href);
    link.focus();
    link.click();
    f.$('coop-start').focus();
    f.press('Escape');
    const pad = {
      index: 0,
      id: 'Team Back',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    f.pads.push(pad);
    f.tick(2);
    // The first deliberate press joins this non-auto-join host; release it
    // before a separate Back, so controller adoption cannot leave the lobby.
    pad.buttons[1] = { pressed: true, value: 1 };
    f.tick();
    pad.buttons[1] = { pressed: false, value: 0 };
    f.tick();
    assert.equal(visited.length, 2);
    pad.buttons[1] = { pressed: true, value: 1 };
    f.tick();
    pad.buttons[1] = { pressed: false, value: 0 };
    f.tick();
    assert.deepEqual(visited, [destination, destination, destination]);
    assert.equal(f.$('coop-overlay').hidden, true);
    f.$('coop-start').click();
    f.tick(60);
    f.$('coop-pause').click();
    const clock = f.$('coop-clock').textContent,
      progress = f.$('coop-coverage').textContent;
    f.press('Escape');
    assert.equal(f.doc.activeElement.id, 'coop-resume');
    f.tick(60);
    assert.equal(f.$('coop-clock').textContent, clock);
    assert.equal(f.$('coop-coverage').textContent, progress);
    assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
    assert.equal(visited.length, 3, 'Paused Back never leaves or resumes Team.');
  });

test('the existing Solo and Versus Team entry links declare their code-owned return context', async () => {
  const solo = await readFile(new URL('../index.html', import.meta.url), 'utf8'),
    versus = await readFile(new URL('../couch/index.html', import.meta.url), 'utf8');
  const entries = [...solo.matchAll(/<a\b([^>]*href="(couch\/relay-rescue\.html[^"\s]*)"[^>]*)>/g)];
  assert.deepEqual(
    entries.map(([, attributes]) => /\bid="([^"]+)"/.exec(attributes)?.[1] ?? 'header'),
    ['header', 'shell-title-team', 'shell-team'],
    'Header, visible Title and Missions each retain their own fixed Team anchor',
  );
  for (const [, , href] of entries) assert.equal(href, 'couch/relay-rescue.html?return=solo');
  assert.match(versus, /id="race-coop"[^>]*href="relay-rescue\.html\?return=versus"/);
});

test('actual Team lobby preserves the bounded Solo return token through native Back without consuming it', async (t) => {
  const entries = new Map(),
    returnStorage = {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
      removeItem: (key) => entries.delete(key),
    };
  const api = createModeReturn({
    storage: returnStorage,
    baseURL: 'http://localhost/game/',
    authority: { channel: 'dev', version: 'dev', sourceRevision: null },
  });
  const ticket = api.prepare({
    campaignKey: 'first-signal/2/88639f3aab7b6cc1',
    levelId: 'signal-01',
    themeId: 'fpv',
  });
  const before = [...entries];
  const h = await page(t, { href: ticket.href, returnStorage });
  assert.equal(h.$('coop-race').getAttribute('href'), `../?mode-return=${ticket.token}`);
  assert.equal(h.$('coop-race').textContent, 'Back to Solo');
  let visited;
  h.$('coop-race').onclick = () => {
    visited = h.$('coop-race').getAttribute('href');
  };
  h.$('coop-start').focus();
  h.tap('Escape');
  assert.equal(visited, `../?mode-return=${ticket.token}`);
  assert.deepEqual([...entries], before);
  assert.equal(h.$('coop-start').disabled, false);
});

test('fresh Team lobby focuses enabled Start only after actual ready, without starting play', async (t) => {
  const h = await page(t, { nativeFocus: true });
  assert.equal(h.doc.activeElement.id, 'coop-start');
  assert.deepEqual(
    h.focusAttempts.filter(({ id }) => id === 'coop-start'),
    [{ id: 'coop-start', phase: 'ready', disabled: false }],
  );
  for (let i = 0; i < 8; i++) h.tick();
  assert.equal(h.$('coop-menu').hidden, false);
  assert.equal(h.$('coop-play').hidden, true);
  assert.equal(h.doc.activeElement.id, 'coop-start');
  h.tap('Tab');
  assert.equal(h.doc.activeElement.tagName, 'SUMMARY');
  const chosen = h.doc.activeElement;
  for (let i = 0; i < 8; i++) h.tick();
  assert.equal(h.doc.activeElement === chosen, true, 'Later frames must not retry initial focus.');
});

for (const id of ['coop-race', 'coop-level'])
  test(`a deliberate preload ${id} focus is kept through Team readiness`, async (t) => {
    const h = await page(t, { nativeFocus: true, beforeImport: ({ $ }) => $(id).focus() });
    assert.equal(h.doc.activeElement.id, id);
    assert.equal(
      h.focusAttempts.some(({ id }) => id === 'coop-start'),
      false,
    );
    h.tick();
    assert.equal(h.doc.activeElement.id, id);
  });

test('a late deliberate menu choice at ready is not replaced by Team initial focus', async (t) => {
  const h = await page(t, {
    nativeFocus: true,
    onReady: ({ $, doc }) => {
      $('coop-settings-open').click();
      $('coop-settings-tab-audio').click();
      $('coop-master-volume').focus();
      assert.equal(doc.activeElement.id, 'coop-master-volume');
    },
  });
  assert.equal(h.doc.activeElement.id, 'coop-master-volume');
  h.tick();
  assert.equal(h.doc.activeElement.id, 'coop-master-volume');
  assert.equal(
    h.focusAttempts.some(({ id }) => id === 'coop-start'),
    false,
  );
});

for (const background of ['hidden', 'unfocused'])
  test(`a ${background} Team page does not claim focus now or after returning`, async (t) => {
    const h = await page(t, {
      nativeFocus: true,
      beforeImport: ({ doc }) => {
        if (background === 'hidden') doc.hidden = true;
        else doc.focused = false;
      },
    });
    assert.equal(h.doc.activeElement === h.doc.body, true);
    assert.equal(h.focusAttempts.length, 0);
    h.doc.hidden = false;
    h.doc.focused = true;
    h.doc.emit('focus');
    h.tick();
    assert.equal(h.doc.activeElement === h.doc.body, true);
  });

for (const kind of ['hidden', 'disabled', 'inert', 'invisible'])
  test(`a ${kind} Start uses the existing visible navigation fallback`, async (t) => {
    const h = await page(t, {
      nativeFocus: true,
      readyStartDisabled: kind === 'disabled',
      onReady: ({ $ }) => {
        if (kind === 'invisible') $('coop-start').style.visibility = 'hidden';
        else $('coop-start')[kind] = true;
      },
    });
    const fallback = h.$('coop-app').querySelector('a[href]');
    assert.equal(h.doc.activeElement === fallback, true, 'The first visible fallback owns focus.');
    assert.equal(h.doc.activeElement.tagName, 'A');
    assert.equal(h.doc.activeElement.getAttribute('href'), fallback.getAttribute('href'));
    assert.equal(
      h.focusAttempts.some(({ id }) => id === 'coop-start'),
      false,
    );
    assert.equal(h.$('coop-play').hidden, true);
  });

test('a loader recovery link hidden by attachment is not mistaken for untouched BODY', async (t) => {
  const h = await page(t, {
    nativeFocus: true,
    beforeImport: ({ $, doc, install }) => {
      const reload = doc.createElement('a');
      reload.setAttribute('href', './relay-rescue.html');
      reload.textContent = 'Reload this tool';
      $('coop-menu').append(reload);
      reload.focus();
      install('RevealLineToolLaunch', {
        value: {
          attached() {
            reload.hidden = true;
            // Native hiding blurs the focused link, exactly as the classic loader does.
            doc.activeElement = doc.body;
          },
        },
      });
    },
  });
  assert.equal(h.doc.activeElement === h.doc.body, true);
  assert.equal(
    h.focusAttempts.some(({ id }) => id === 'coop-start'),
    false,
  );
});

test('a real Canvas boot failure retains recovery focus and never runs the ready handoff', async (t) => {
  const errors = [];
  t.mock.method(console, 'error', (error) => errors.push(error));
  const h = await page(t, {
    nativeFocus: true,
    expectError: true,
    beforeImport: ({ $ }) => {
      $('coop-race').focus();
      $('coop-canvas').getContext = () => null;
    },
  });
  assert.equal(h.doc.documentElement.dataset.toolState, 'error');
  assert.equal(h.doc.activeElement.id, 'coop-race');
  assert.match(h.$('coop-boot').textContent, /Canvas 2D/);
  assert.equal(h.$('coop-start').disabled, true);
  assert.equal(
    h.focusAttempts.some(({ id }) => id === 'coop-start'),
    false,
  );
  assert.equal(errors.length, 1);
});

test('a deliberate ready-time choice that then blurs is not reclaimed by initial focus', async (t) => {
  const h = await page(t, {
    nativeFocus: true,
    onReady: ({ $, doc }) => {
      $('coop-race').focus();
      $('coop-race').blur();
      assert.equal(doc.activeElement.tagName, 'BODY');
    },
  });
  assert.equal(h.doc.activeElement.tagName, 'BODY');
  assert.equal(
    h.focusAttempts.some(({ id }) => id === 'coop-start'),
    false,
  );
});

test('foreground loss during boot vetoes initial focus even if the page is focused again at ready', async (t) => {
  const h = await page(t, {
    nativeFocus: true,
    onReady: ({ win }) => {
      win.emit('blur');
    },
  });
  assert.equal(h.doc.activeElement.tagName, 'BODY');
  assert.equal(
    h.focusAttempts.some(({ id }) => id === 'coop-start'),
    false,
  );
  h.tick();
  assert.equal(h.doc.activeElement.tagName, 'BODY');
});

// P03-I oracles bind observable HUD and the real painter's command stream, not
// private host state or physical Canvas pixels. No synthetic run replaces core.
function heldTeam(f) {
  return {
    hud: [
      'coop-stage',
      'coop-clock',
      'coop-coverage',
      'coop-reserves',
      'coop-objective',
      'coop-state-0',
      'coop-state-1',
      'coop-charge-0',
      'coop-charge-1',
      'coop-support-0',
      'coop-support-1',
    ].map((id) => [id, f.$(id).textContent]),
    progress: f.$('coop-progress').value,
    paint: f.lastPaint,
  };
}
function playingTeam(f) {
  f.$('coop-start').click();
  f.tick(2);
  f.tap('KeyD');
  f.tap('ArrowLeft');
  f.tick(65);
}
function unchangedPaused(f, before) {
  f.tick(75);
  assert.deepEqual(heldTeam(f), before);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
  assert.deepEqual(f.visits, []);
}
const departures = [
  ['setup', 'coop-lobby', 'Discard and change setup'],
  ['retry', 'coop-retry', 'Discard and retry'],
  ['return', 'coop-race', 'Discard and leave'],
  ['home', 'coop-home', 'Discard and leave'],
];
for (const [kind, id, label] of departures)
  for (const paused of [false, true])
    test(`${kind} from ${paused ? 'paused' : 'running'} requires a separate decision; Stay preserves painted/HUD flight without Resume`, async (t) => {
      const f = await page(t, { nativeFocus: true, capturePaint: true });
      playingTeam(f);
      if (paused) f.$('coop-pause').click();
      f.$(id).focus();
      f.$(id).click();
      assert.equal(f.$('coop-discard-dialog').open, true);
      assert.equal(f.doc.activeElement.id, 'coop-discard-stay');
      assert.equal(f.$('coop-discard-confirm').textContent, label);
      assert.match(f.$('coop-discard-copy').textContent, /not saved/);
      const held = heldTeam(f);
      assert.ok(held.paint);
      f.$('coop-resume').click();
      f.$('coop-start').click();
      f.$('coop-lobby').click();
      assert.equal(
        f.$('coop-discard-confirm').textContent,
        label,
        'Other actions cannot replace the owned decision',
      );
      unchangedPaused(f, held);
      f.$('coop-discard-stay').click();
      assert.equal(f.$('coop-discard-dialog').open, false);
      assert.equal(
        f.doc.activeElement.id,
        kind === 'setup' || kind === 'retry' ? id : 'coop-resume',
      );
      unchangedPaused(f, held);
      f.$('coop-resume').click();
      f.tick(65);
      assert.equal(f.$('coop-overlay').hidden, true);
      assert.notEqual(
        f.$('coop-clock').textContent,
        held.hud.find(([id]) => id === 'coop-clock')[1],
      );
    });

test('native Escape reaches only the top confirmation cancel and keeps its paused opener', async (t) => {
  const f = await page(t, { nativeFocus: true, capturePaint: true });
  playingTeam(f);
  f.$('coop-pause').click();
  f.$('coop-lobby').focus();
  f.$('coop-lobby').click();
  const before = heldTeam(f);
  let windowEscapes = 0;
  f.win.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') windowEscapes++;
  });
  const event = f.press('Escape');
  assert.equal(
    event.defaultPrevented,
    false,
    'The dialog keeps native Escape cancellation available',
  );
  assert.equal(windowEscapes, 0);
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-lobby');
  unchangedPaused(f, before);
});

test('confirmation Tab wraps both directions and editor defaults cannot start or discard', async (t) => {
  const f = await page(t, { nativeFocus: true, capturePaint: true });
  playingTeam(f);
  f.$('coop-pause').click();
  f.$('coop-retry').click();
  const before = heldTeam(f);
  const reverse = f
    .$('coop-discard-stay')
    .emit('keydown', { key: 'Tab', code: 'Tab', shiftKey: true });
  assert.equal(reverse.defaultPrevented, true);
  assert.equal(f.doc.activeElement.id, 'coop-discard-confirm');
  const forward = f.press('Tab');
  assert.equal(forward.defaultPrevented, true);
  assert.equal(f.doc.activeElement.id, 'coop-discard-stay');
  unchangedPaused(f, before);
  f.press('Enter');
  assert.equal(f.$('coop-discard-dialog').open, false);
  unchangedPaused(f, before);
});

test('controller adoption/held Confirm cannot discard; a separate Back stays paused', async (t) => {
  const f = await page(t, { nativeFocus: true, capturePaint: true });
  playingTeam(f);
  f.$('coop-pause').click();
  const pad = {
    index: 0,
    id: 'Departure controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  f.pads.push(pad);
  f.tick(2);
  pad.buttons[0] = { pressed: true, value: 1 };
  f.tick();
  pad.buttons[0] = { pressed: false, value: 0 };
  f.tick();
  f.$('coop-lobby').focus();
  pad.buttons[0] = { pressed: true, value: 1 };
  f.tick();
  assert.equal(f.$('coop-discard-dialog').open, true);
  assert.equal(f.doc.activeElement.id, 'coop-discard-stay');
  const before = heldTeam(f);
  f.tick(8);
  assert.equal(f.$('coop-discard-dialog').open, true);
  pad.buttons[0] = { pressed: false, value: 0 };
  f.tick();
  pad.buttons[1] = { pressed: true, value: 1 };
  f.tick();
  pad.buttons[1] = { pressed: false, value: 0 };
  f.tick();
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-lobby');
  unchangedPaused(f, before);
});

test('confirmed setup discards once into lobby without starting the mutable setup choice', async (t) => {
  const f = await page(t, { nativeFocus: true });
  playingTeam(f);
  f.$('coop-pause').click();
  f.$('coop-lobby').click();
  assert.equal(f.$('coop-menu').hidden, true);
  f.$('coop-discard-confirm').click();
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-play').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-start');
  const clock = f.$('coop-clock').textContent;
  f.tick(100);
  assert.equal(f.$('coop-clock').textContent, clock);
  assert.deepEqual(f.visits, []);
});

test('confirmed retry uses the actual level/configuration, not edited hidden lobby selects', async (t) => {
  const f = await page(t, { nativeFocus: true, capturePaint: true });
  f.$('coop-difficulty').value = 'standard';
  f.$('coop-start').click();
  const fresh = heldTeam(f);
  assert.ok(fresh.paint);
  f.tick(2);
  f.tap('KeyD');
  f.tap('ArrowLeft');
  f.tick(65);
  assert.notDeepEqual(heldTeam(f), fresh);
  f.$('coop-pause').click();
  const stage = f.$('coop-stage').textContent,
    reserves = f.$('coop-reserves').textContent;
  f.$('coop-level').value = 'relay-stronghold';
  f.$('coop-difficulty').value = 'expert';
  f.$('coop-experiment').value = 'independent';
  f.$('coop-retry').click();
  f.$('coop-discard-confirm').click();
  assert.equal(f.$('coop-stage').textContent, stage);
  assert.equal(f.$('coop-reserves').textContent, reserves);
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(
    f.$('coop-overlay').hidden,
    true,
    JSON.stringify({
      message: f.$('coop-message').textContent,
      title: f.$('coop-overlay-title').textContent,
      focus: f.doc.activeElement.id,
      dialog: f.$('coop-discard-dialog').open,
    }),
  );
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.doesNotMatch(f.$('coop-message').textContent, /Comparison:/);
  assert.deepEqual(
    heldTeam(f),
    fresh,
    'Retry rebuilds the original authored board and initial HUD',
  );
  assert.deepEqual(f.visits, []);
});

for (const [kind, id] of departures.filter(([kind]) => ['home', 'return'].includes(kind)))
  for (const context of ['solo', 'versus'])
    test(`confirmed ${kind} keeps only its fixed ${context} destination`, async (t) => {
      const href = `http://localhost/releases/v0.58.0/couch/relay-rescue.html?return=${context}`;
      const f = await page(t, { href, nativeFocus: true, capturePaint: true });
      playingTeam(f);
      f.$(id).setAttribute('href', 'https://other.invalid/steal');
      const click = f.$(id).emit('click', { button: 0 });
      assert.equal(click.defaultPrevented, true);
      assert.deepEqual(f.visits, []);
      const before = heldTeam(f);
      f.$('coop-discard-confirm').click();
      const path = kind === 'home' || context === 'solo' ? '../' : './';
      assert.deepEqual(f.visits, [new URL(path, href).href]);
      f.tick(60);
      assert.deepEqual(heldTeam(f), before);
      assert.equal(f.$('coop-overlay').hidden, false);
    });

for (const mode of ['blur', 'hidden', 'pagehide'])
  test(`${mode} cancels an open discard choice and stale Confirm cannot leave after return`, async (t) => {
    const f = await page(t, { nativeFocus: true, capturePaint: true });
    playingTeam(f);
    f.$('coop-race').click();
    const before = heldTeam(f);
    if (mode === 'blur') {
      f.doc.focused = false;
      f.win.emit('blur');
    } else if (mode === 'hidden') {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
    } else f.win.emit('pagehide', { persisted: true });
    f.doc.body.focus();
    f.doc.hidden = false;
    f.doc.focused = true;
    f.win.emit('pageshow', { persisted: true });
    assert.equal(f.$('coop-discard-dialog').open, false);
    f.$('coop-discard-confirm').click();
    assert.equal(f.doc.activeElement, f.doc.body);
    unchangedPaused(f, before);
  });

test('faulted attempt cannot Resume and both native Back and header Stay return to visible Retry', async (t) => {
  const errors = [];
  t.mock.method(console, 'error', (e) => errors.push(e));
  const f = await page(t, { nativeFocus: true, capturePaint: true });
  playingTeam(f);
  f.failNextPaint();
  f.tick();
  assert.equal(errors.length, 1);
  assert.equal(f.$('coop-resume').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-retry');
  const before = heldTeam(f);
  f.press('Escape');
  assert.equal(f.doc.activeElement.id, 'coop-retry');
  f.$('coop-home').click();
  assert.match(f.$('coop-discard-copy').textContent, /cannot resume/);
  f.$('coop-discard-stay').click();
  assert.equal(f.doc.activeElement.id, 'coop-retry');
  f.$('coop-resume').click();
  unchangedPaused(f, before);
  f.$('coop-retry').click();
  f.$('coop-discard-confirm').click();
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(
    f.$('coop-overlay').hidden,
    true,
    JSON.stringify({
      message: f.$('coop-message').textContent,
      title: f.$('coop-overlay-title').textContent,
      focus: f.doc.activeElement.id,
      dialog: f.$('coop-discard-dialog').open,
    }),
  );
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
});

test('failed native navigation retains an explicit paused attempt instead of silently clearing it', async (t) => {
  const f = await page(t, { nativeFocus: true, capturePaint: true });
  playingTeam(f);
  f.$('coop-race').click();
  const before = heldTeam(f);
  globalThis.location.assign = () => {
    throw new Error('Navigation unavailable');
  };
  f.$('coop-discard-confirm').click();
  assert.match(f.$('coop-message').textContent, /could not be replaced.*Navigation unavailable/);
  unchangedPaused(f, before);
  assert.equal(f.doc.activeElement.id, 'coop-resume');
});

test('modified link gestures retain native browser ownership without a discard or current-page mutation', async (t) => {
  const f = await page(t, { nativeFocus: true, capturePaint: true });
  playingTeam(f);
  f.$('coop-pause').click();
  const before = heldTeam(f);
  for (const extra of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
    const event = f.$('coop-race').emit('click', extra);
    assert.equal(event.defaultPrevented, false);
    assert.equal(f.$('coop-discard-dialog').open, false);
  }
  unchangedPaused(f, before);
});

test('paint failure while opening departure releases the invisible intent and exposes stopped Retry', async (t) => {
  const errors = [];
  t.mock.method(console, 'error', (e) => errors.push(e));
  const f = await page(t, { nativeFocus: true, capturePaint: true });
  playingTeam(f);
  f.failNextPaint();
  f.$('coop-lobby').click();
  assert.equal(errors.length, 1);
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.$('coop-resume').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-retry');
  assert.match(f.$('coop-message').textContent, /Arena stopped/);
  const stopped = heldTeam(f);
  unchangedPaused(f, stopped);
  f.$('coop-retry').click();
  assert.equal(f.$('coop-discard-dialog').open, true);
  assert.equal(f.doc.activeElement.id, 'coop-discard-stay');
  assert.match(f.$('coop-discard-copy').textContent, /cannot resume/);
  f.press('Escape');
  assert.equal(f.doc.activeElement.id, 'coop-retry');
  unchangedPaused(f, stopped);
});

test('a repeated Retry paint failure stops the new attempt truthfully until another explicit Retry', async (t) => {
  const errors = [];
  t.mock.method(console, 'error', (e) => errors.push(e));
  const f = await page(t, { nativeFocus: true, capturePaint: true });
  playingTeam(f);
  f.failNextPaint();
  f.tick();
  assert.equal(errors.length, 1);
  f.$('coop-retry').click();
  f.failNextPaint();
  f.$('coop-discard-confirm').click();
  assert.equal(errors.length, 2);
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.$('coop-resume').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-retry');
  assert.match(f.$('coop-message').textContent, /Arena stopped/);
  assert.doesNotMatch(f.$('coop-message').textContent, /could not be replaced/);
  const stopped = heldTeam(f);
  unchangedPaused(f, stopped);
  f.$('coop-retry').click();
  f.$('coop-discard-confirm').click();
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.doesNotMatch(f.$('coop-message').textContent, /Arena stopped/);
  f.tick(150); // Team advances at 120 Hz; cross the displayed one-second boundary.
  assert.notEqual(f.$('coop-clock').textContent, '0:00');
});

function tabToTeamAction(f, id) {
  for (let i = 0; i < 20 && f.doc.activeElement.id !== id; i++) f.tap('Tab');
  assert.equal(f.doc.activeElement.id, id, `Actual paused Tab traversal reaches ${id}.`);
  assert.equal(f.$('coop-overlay').contains(f.doc.activeElement), true);
  assert.equal(f.doc.activeElement.closest('[hidden],[inert]'), null);
}
const modePanelLinks = [
  ['coop-solo', '../'],
  ['coop-versus', './'],
];
for (const [id, path] of modePanelLinks)
  for (const fault of [false, true])
    test(`in-panel ${id} keyboard departure from ${fault ? 'fault' : 'pause'} preserves its exact Stay/Back opener`, async (t) => {
      const errors = [];
      t.mock.method(console, 'error', (error) => errors.push(error));
      const f = await page(t, { nativeFocus: true, capturePaint: true });
      playingTeam(f);
      if (fault) {
        f.failNextPaint();
        f.tick();
        assert.equal(errors.length, 1);
        assert.equal(f.$('coop-resume').hidden, true);
      } else f.$('coop-pause').click();
      tabToTeamAction(f, id);
      const before = heldTeam(f);
      f.tap('Enter');
      assert.equal(f.$('coop-discard-dialog').open, true);
      assert.equal(f.doc.activeElement.id, 'coop-discard-stay');
      assert.match(
        f.$('coop-discard-copy').textContent,
        fault ? /cannot resume/ : /both players paused/,
      );
      unchangedPaused(f, before);
      f.tap('Escape');
      assert.equal(f.$('coop-discard-dialog').open, false);
      assert.equal(f.doc.activeElement.id, id);
      unchangedPaused(f, before);
      f.tap('Enter');
      f.tap('Enter');
      assert.equal(f.$('coop-discard-dialog').open, false, 'Enter on Stay is not Resume.');
      assert.equal(f.doc.activeElement.id, id);
      unchangedPaused(f, before);
      f.$(id).setAttribute('href', 'https://other.invalid/not-a-mode');
      f.tap('Enter');
      f.tap('Tab');
      assert.equal(f.doc.activeElement.id, 'coop-discard-confirm');
      f.tap('Enter');
      assert.deepEqual(f.visits, [new URL(path, globalThis.location.href).href]);
      f.tick(75);
      assert.deepEqual(heldTeam(f), before, 'Leaving never resumes or replaces the old page run.');
    });

for (const [id, path] of modePanelLinks)
  test(`in-panel ${id} is reachable by actual controller navigation and requires a separate discard`, async (t) => {
    const f = await page(t, { nativeFocus: true, capturePaint: true });
    playingTeam(f);
    f.$('coop-pause').click();
    const before = heldTeam(f);
    const pad = {
      index: 0,
      id: 'Mode panel controller',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    f.pads.push(pad);
    const button = (index) => {
      pad.buttons[index] = { pressed: true, value: 1 };
      f.tick();
      pad.buttons[index] = { pressed: false, value: 0 };
      f.tick();
    };
    f.tick(2);
    button(0); // South adoption/release has no departure action.
    for (let i = 0; i < 20 && f.doc.activeElement.id !== id; i++) button(13);
    assert.equal(f.doc.activeElement.id, id);
    unchangedPaused(f, before);
    button(0);
    assert.equal(f.$('coop-discard-dialog').open, true);
    button(1);
    assert.equal(f.$('coop-discard-dialog').open, false);
    assert.equal(f.doc.activeElement.id, id);
    unchangedPaused(f, before);
    button(0);
    button(13);
    assert.equal(f.doc.activeElement.id, 'coop-discard-confirm');
    button(0);
    assert.deepEqual(f.visits, [new URL(path, globalThis.location.href).href]);
    assert.deepEqual(heldTeam(f), before);
  });

test('in-panel Solo keeps the exact existing one-use return context and does not consume or rewrite it', async (t) => {
  const entries = new Map(),
    returnStorage = {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
      removeItem: (key) => entries.delete(key),
    };
  const api = createModeReturn({
    storage: returnStorage,
    baseURL: 'http://localhost/game/',
    authority: { channel: 'dev', version: 'dev', sourceRevision: null },
  });
  const ticket = api.prepare({
    campaignKey: 'first-signal/2/88639f3aab7b6cc1',
    levelId: 'signal-01',
    themeId: 'fpv',
  });
  const recorded = [...entries];
  const f = await page(t, {
    href: ticket.href,
    returnStorage,
    nativeFocus: true,
    capturePaint: true,
  });
  playingTeam(f);
  f.$('coop-pause').click();
  tabToTeamAction(f, 'coop-solo');
  assert.equal(f.$('coop-solo').getAttribute('href'), `../?mode-return=${ticket.token}`);
  const before = heldTeam(f);
  f.tap('Enter');
  f.tap('Escape');
  unchangedPaused(f, before);
  assert.deepEqual([...entries], recorded);
  f.tap('Enter');
  f.tap('Tab');
  f.tap('Enter');
  assert.deepEqual(f.visits, [new URL(`../?mode-return=${ticket.token}`, ticket.href).href]);
  assert.deepEqual([...entries], recorded);
});

for (const [id, path] of modePanelLinks)
  test(`terminal in-panel ${id} follows the refreshed fixed native route without another discard`, async (t) => {
    const f = await page(t, { nativeFocus: true, capturePaint: true }),
      pack = customPack('mode-loss');
    pack.levels[0].enemies = [];
    await f.selectFile(JSON.stringify(pack));
    f.$('coop-difficulty').value = 'expert';
    f.$('coop-start').click();
    f.tick(3);
    for (let loop = 0; loop < 2; loop++)
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
    assert.equal(f.$('coop-overlay').hidden, false);
    assert.equal(f.$('coop-resume').hidden, true);
    assert.equal(f.$('coop-overlay-kicker').textContent, 'ONE MORE SHARED PLAN');
    tabToTeamAction(f, id);
    const before = heldTeam(f);
    f.$(id).setAttribute('href', 'https://other.invalid/not-a-mode');
    f.tap('Enter');
    assert.equal(f.$('coop-discard-dialog').open, false);
    assert.deepEqual(f.visits, [new URL(path, globalThis.location.href).href]);
    assert.deepEqual(heldTeam(f), before);
  });

test('in-panel navigation failure keeps the paused attempt and explicit retryable actions', async (t) => {
  const f = await page(t, { nativeFocus: true, capturePaint: true });
  playingTeam(f);
  f.$('coop-pause').click();
  tabToTeamAction(f, 'coop-versus');
  const before = heldTeam(f);
  f.tap('Enter');
  f.tap('Tab');
  globalThis.location.assign = () => {
    throw new Error('Mode navigation unavailable');
  };
  f.tap('Enter');
  assert.match(
    f.$('coop-message').textContent,
    /could not be replaced.*Mode navigation unavailable/,
  );
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-resume');
  unchangedPaused(f, before);
  tabToTeamAction(f, 'coop-versus');
  f.tap('Enter');
  assert.equal(f.$('coop-discard-dialog').open, true);
});

test('in-panel departure loses its authority on blur; background return cannot reuse Confirm', async (t) => {
  const f = await page(t, { nativeFocus: true, capturePaint: true });
  playingTeam(f);
  f.$('coop-pause').click();
  tabToTeamAction(f, 'coop-solo');
  f.tap('Enter');
  const before = heldTeam(f);
  f.doc.focused = false;
  f.win.emit('blur');
  f.doc.focused = true;
  f.doc.body.focus();
  f.win.emit('focus');
  f.$('coop-discard-confirm').click();
  assert.equal(f.$('coop-discard-dialog').open, false);
  unchangedPaused(f, before);
});

for (const interruption of ['blur', 'hidden', 'persisted pagehide'])
  test(`already-paused Team retires Help and controller intent on ${interruption}, then requires explicit foreground Resume`, async (t) => {
    const f = await page(t, { nativeFocus: true, capturePaint: true });
    playingTeam(f);
    f.$('coop-pause').click();
    const pad = {
      index: 0,
      id: 'Team lifecycle controller',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    f.pads.push(pad);
    f.tick(2);
    pad.buttons[0] = { pressed: true, value: 1 };
    f.tick();
    pad.buttons[0] = { pressed: false, value: 0 };
    f.tick(2);
    assert.equal(f.$('coop-overlay').hidden, false, 'Joining a pad is not Resume.');
    f.disclose('coop-help');
    const region = f.$('coop-help-reading'),
      done = f.$('coop-help-reading-done');
    region.clientHeight = 100;
    region.scrollHeight = 800;
    f.$('coop-help-read').click();
    assert.equal(f.doc.activeElement, region);
    pad.buttons[13] = { pressed: true, value: 1 };
    f.tick();
    assert.ok(
      region.scrollTop > 0,
      'The joined controller actually owns reading before suspension.',
    );
    const before = heldTeam(f),
      scroll = region.scrollTop,
      audioNote = f.$('coop-audio-note').textContent,
      audioWarning = f.$('coop-audio-status').textContent;
    let reads = 0;
    t.mock.method(navigator, 'getGamepads', () => {
      reads++;
      return f.pads;
    });
    if (interruption === 'blur') {
      f.doc.focused = false;
      f.win.emit('blur');
    } else if (interruption === 'hidden') {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
    } else f.win.emit('pagehide', { persisted: true });
    // A cached-page event can precede any hasFocus/visibility update; its explicit
    // inactive lifetime must still retire reading and reject an obsolete action.
    assert.equal(done.disabled, true);
    assert.equal(region.hasAttribute('data-controller-reading'), false);
    assert.equal(f.doc.activeElement, region, 'Suspension retires ownership without moving focus.');
    pad.buttons[13] = { pressed: false, value: 0 };
    pad.buttons[0] = { pressed: true, value: 1 };
    f.$('coop-resume').click();
    f.tick(90);
    assert.equal(reads, 0, 'Inactive frames never poll either flight or menu controllers.');
    assert.deepEqual(heldTeam(f), before);
    assert.equal(region.scrollTop, scroll);
    assert.equal(f.$('coop-overlay').hidden, false);
    assert.deepEqual(f.visits, []);
    assert.equal(f.$('coop-audio-note').textContent, audioNote);
    assert.equal(f.$('coop-audio-status').textContent, audioWarning);

    f.doc.focused = true;
    f.doc.hidden = false;
    if (interruption === 'blur') f.win.emit('focus');
    else if (interruption === 'hidden') f.doc.emit('visibilitychange');
    else f.win.emit('pageshow', { persisted: true });
    f.tick(5);
    assert.ok(reads > 0);
    assert.deepEqual(heldTeam(f), before);
    assert.equal(f.$('coop-overlay').hidden, false, 'Held Confirm cannot Resume on return.');
    assert.equal(done.disabled, true);
    assert.equal(region.scrollTop, scroll);
    done.click();
    assert.deepEqual(heldTeam(f), before);
    pad.buttons[0] = { pressed: false, value: 0 };
    f.tick(2);
    f.tap('Escape'); // Close the still-open disclosure, not the paused flight.
    assert.equal(f.$('coop-help').open, false);
    f.tap('Escape'); // Focus the real Resume action without activating it.
    assert.equal(f.doc.activeElement, f.$('coop-resume'));
    unchangedPaused(f, before);
    f.tap('Enter');
    f.tick(65);
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.notEqual(
      f.$('coop-clock').textContent,
      before.hud.find(([id]) => id === 'coop-clock')[1],
    );
    assert.equal(f.$('coop-audio-note').textContent, audioNote);
    assert.equal(f.$('coop-audio-status').textContent, audioWarning);
  });

test('Team detects missed focus-loss notification before polling or stepping and returns paused', async (t) => {
  const f = await page(t, { nativeFocus: true, capturePaint: true });
  playingTeam(f);
  const time = f.$('coop-clock').textContent;
  let reads = 0;
  t.mock.method(navigator, 'getGamepads', () => {
    reads++;
    return f.pads;
  });
  f.doc.focused = false; // No blur notification: the frame guard owns this observation.
  f.tick();
  const paused = heldTeam(f);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-clock').textContent, time);
  f.tick(90);
  assert.equal(reads, 0);
  assert.deepEqual(heldTeam(f), paused);
  f.$('coop-resume').click();
  assert.equal(f.$('coop-overlay').hidden, false);
  f.doc.focused = true;
  f.win.emit('focus');
  unchangedPaused(f, paused);
  f.$('coop-resume').focus();
  f.tap('Enter');
  f.tick(65);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.notEqual(f.$('coop-clock').textContent, time);
});
