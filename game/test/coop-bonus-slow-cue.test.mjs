import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createCoop,
  startCoop,
  stepCoop,
  pauseCoop,
  resumeCoop,
  validateCoopLevel,
} from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { coopBonusActive, coopBonusEnemyFactor } from '../coop/timed-bonuses.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { coopCueOverflowEntries } from '../couch/coop-cue-overflow.mjs';

const command = (direction = null, support = false) => ({ direction, boost: false, support });
const inputs = (direction = null, support = false) => [command(direction, support), command()];
function level({ nearby = false, freeze = false } = {}) {
  const schedule = (id, kind, y) => ({
    id,
    kind,
    anchors: [
      { x: 8.5, y },
      { x: 8.5, y: y + 10 },
    ],
    initialDelayTicks: 0,
    announcementTicks: 120,
    availableTicks: 1200,
    cooldownTicks: 240,
    maxAppearances: 1,
    maxCollections: 1,
  });
  return {
    version: 'revealline-coop-level.v5',
    id: 'slow-cue-contact',
    revision: '1',
    name: 'Slow cue contact',
    width: 72,
    height: 36,
    journeyDifficulty: 'standard',
    spawns: [
      { x: 8.5, y: 0.5 },
      { x: 71.5, y: 30.5 },
    ],
    walls: [],
    safeRects: [],
    terrain: [],
    enemies: [
      {
        id: 'keeper',
        type: 'drifter',
        x: nearby ? 13.5 : 55.5,
        y: nearby ? 8.5 : 18.5,
        vx: nearby ? 0 : 0.2,
        vy: nearby ? 0.2 : 0,
        radius: 0.25,
      },
    ],
    goal: { coverage: 0.99 },
    rules: { moveSpeed: 8, boostMultiplier: 1 },
    timedBonuses: {
      version: 'timed-bonuses.v2',
      schedules: [
        schedule('slow', 'enemy-slow', 8.5),
        ...(freeze ? [schedule('freeze', 'enemy-freeze', 12.5)] : []),
      ],
    },
  };
}
function advance(run, ticks, direction = null, support = false) {
  for (let i = 0; i < ticks; i++) stepCoop(run, inputs(direction, support));
}
function take(run, kind) {
  for (let n = 0; n < 1200; n++) {
    stepCoop(run, inputs('down'));
    const event = run.events.find(
      (item) => item.type === 'powerup.collected' && item.kind === kind,
    );
    if (event) return structuredClone(event);
    assert.equal(run.status, 'running');
  }
  assert.fail(`Public movement did not collect ${kind}.`);
}
function ready(options) {
  const authored = level(options);
  assert.deepEqual(validateCoopLevel(authored), { valid: true, errors: [] });
  const run = startCoop(createCoop(authored, { seed: 17 }));
  advance(run, 121);
  return run;
}

// Actual painter commands with finite Canvas boundaries; no browser-pixel or
// physical-device claim. Save/restore and measured text use the current state.
function surface(width = 1152) {
  let state = { globalAlpha: 1, lineDash: [] };
  const calls = [],
    stack = [],
    ctx = new Proxy(
      {},
      {
        get(_, name) {
          if (name in state) return state[name];
          return (...args) => {
            calls.push({ name, args, state: structuredClone(state) });
            if (name === 'save') stack.push({ ...state });
            if (name === 'restore') state = stack.pop();
            if (name === 'setLineDash') state.lineDash = args[0];
            if (name === 'measureText')
              return {
                width:
                  Number.parseFloat(state.font?.match(/[\d.]+px/)?.[0] ?? '1') *
                  String(args[0]).length *
                  0.55,
              };
          };
        },
        set(_, name, value) {
          state[name] = value;
          return true;
        },
      },
    ),
    painter = createCoopPainter({
      width: 1152,
      height: 576,
      clientWidth: width,
      getContext: () => ctx,
    });
  return {
    paint(run, options = {}) {
      calls.length = 0;
      const before = structuredClone(run);
      painter.paint(run, options);
      assert.deepEqual(run, before, 'Painting leaves the complete core checkpoint untouched.');
      assert.equal(stack.length, 0);
      return structuredClone(calls);
    },
  };
}
const labels = (calls) =>
  calls.filter((call) => call.name === 'fillText').map((call) => call.args[0]);
const rings = (calls) =>
  calls.filter(
    (call) => call.name === 'arc' && call.args[2] === 0.88 && call.state.lineDash[0] === 0.16,
  );
function assertSlow(run, expected, view = surface(), options = {}) {
  const calls = view.paint(run, options);
  assert.equal(
    labels(calls).filter((text) => text === 'SLOWED').length,
    expected,
    'Every slowed active drifter has one readable cue.',
  );
  assert.equal(
    rings(calls).length,
    expected,
    'Every slowed active drifter has one patterned ring.',
  );
  return calls;
}

test('public timed pickup paints Slowed despite unchanged Support fields, and exact expiry removes it', () => {
  const run = ready(),
    view = surface();
  assertSlow(run, 0, view);
  const event = take(run, 'enemy-slow'),
    enemy = run.enemies[0];
  assert.equal(event.activationTick, run.tick);
  assert.equal(coopBonusActive(run, 'enemy-slow'), true);
  assert.equal(enemy.speedScale, 1);
  assert.equal(enemy.slowUntil, 0);
  assert.equal(coopBonusEnemyFactor(run, enemy), 0.5);
  assert.match(
    coopCueOverflowEntries(run).find((entry) => entry.id === 'enemy:keeper').state,
    /SLOWED/,
  );
  for (const width of [212, 1152])
    for (const reduced of [false, true])
      assertSlow(run, 1, surface(width), { reduced, textSize: 'large', textFace: 'plain' });
  pauseCoop(run);
  const paused = structuredClone(run),
    held = assertSlow(run, 1, view, { reduced: true });
  advance(run, 240);
  assert.deepEqual(run, paused);
  assert.deepEqual(assertSlow(run, 1, view, { reduced: true }), held);
  resumeCoop(run);
  advance(run, event.untilTick - run.tick - 1, 'up');
  assertSlow(run, 1, view);
  advance(run, 1);
  assert.equal(run.tick, event.untilTick);
  assert.equal(coopBonusActive(run, 'enemy-slow'), false);
  assertSlow(run, 0, view);
});

for (const late of [false, true])
  test(`public Support and pickup overlap keeps one cue when ${late ? 'the pickup' : 'Support'} expires first`, () => {
    const run = ready({ nearby: true }),
      event = take(run, 'enemy-slow'),
      enemy = run.enemies[0];
    if (late) {
      advance(run, 160, 'up');
      advance(run, event.untilTick - run.tick - 180);
      advance(run, 120, 'down');
    }
    advance(run, 1, null, true);
    assert.equal(enemy.speedScale, 0.5, 'Actual Support reaches the nearby drifter.');
    assertSlow(run, 1);
    const supportUntil = enemy.slowUntil;
    advance(run, late ? event.untilTick - run.tick : 181, 'up');
    assert.equal(coopBonusActive(run, 'enemy-slow'), !late);
    assert.equal(enemy.slowUntil > run.time, late);
    assertSlow(run, 1);
    while (run.tick < event.untilTick || run.time < supportUntil + 1 / 120) advance(run, 1);
    assertSlow(run, 0);
  });

test('a second real freeze pickup holds movement without hiding or duplicating the still-active slow cue', () => {
  const run = ready({ freeze: true });
  take(run, 'enemy-slow');
  const freeze = take(run, 'enemy-freeze'),
    enemy = run.enemies[0],
    point = [enemy.x, enemy.y];
  assert.equal(coopBonusActive(run, 'enemy-freeze'), true);
  assertSlow(run, 1);
  advance(run, 120, 'up');
  assert.deepEqual([enemy.x, enemy.y], point);
  assertSlow(run, 1, surface(212), { reduced: true });
  advance(run, freeze.untilTick - run.tick);
  assert.equal(coopBonusActive(run, 'enemy-freeze'), false);
  assert.equal(coopBonusActive(run, 'enemy-slow'), true);
  assertSlow(run, 1);
});

test('real Hunter warning, commitment and recovery retain their full compact captions alongside pickup slowdown', () => {
  const authored = level({ nearby: true });
  authored.version = 'revealline-coop-level.v6';
  authored.lineImpact = { version: 'team-line-impact.v2', speed: 1 };
  authored.enemies[0] = { ...authored.enemies[0], type: 'hunter', vx: 0, vy: 0 };
  assert.deepEqual(validateCoopLevel(authored), { valid: true, errors: [] });
  const run = startCoop(createCoop(authored, { seed: 17 })),
    view = surface(212);
  advance(run, 121);
  take(run, 'enemy-slow');
  const enemy = run.enemies[0],
    seen = new Set();
  for (let guard = 0; guard < 600 && seen.size < 3; guard++) {
    if (['warning', 'commit', 'recovery'].includes(enemy.phase) && !seen.has(enemy.phase)) {
      assert.equal(coopBonusActive(run, 'enemy-slow'), true);
      assert.equal(enemy.speedScale, 1);
      const calls = view.paint(run, { reduced: true });
      const caption =
        enemy.phase === 'warning'
          ? `LOCK ${enemy.target + 1}`
          : enemy.phase === 'commit'
            ? 'CHARGE'
            : 'RECOVER';
      assert.equal(labels(calls).filter((label) => label === `${caption} ↓`).length, 1);
      assert.equal(
        labels(calls).includes('SLOWED'),
        false,
        'Compact danger is not replaced with a separate generic caption.',
      );
      assert.equal(rings(calls).length, 1);
      pauseCoop(run);
      const held = view.paint(run, { reduced: true });
      advance(run, 60);
      assert.deepEqual(view.paint(run, { reduced: true }), held);
      resumeCoop(run);
      seen.add(enemy.phase);
    }
    advance(run, 1, 'up');
  }
  assert.deepEqual(seen, new Set(['warning', 'commit', 'recovery']));
});

test('a removed actor is excluded even while a real collected slow effect remains active', () => {
  const run = ready();
  take(run, 'enemy-slow');
  assertSlow(run, 1);
  // Explicit rendering boundary arrangement: the public core uses active=false
  // for captured actors. This does not claim a drifter can be defeated by capture.
  run.enemies[0].active = false;
  assert.equal(coopBonusActive(run, 'enemy-slow'), true);
  assertSlow(run, 0);
  assert.equal(
    coopCueOverflowEntries(run).some((entry) => entry.id === 'enemy:keeper'),
    false,
  );
});

test('freeze alone is never relabelled as a slow pickup', () => {
  const authored = level();
  authored.timedBonuses.schedules[0].kind = 'enemy-freeze';
  const run = startCoop(createCoop(authored, { seed: 17 }));
  advance(run, 121);
  take(run, 'enemy-freeze');
  assert.equal(coopBonusActive(run, 'enemy-freeze'), true);
  assert.equal(coopBonusActive(run, 'enemy-slow'), false);
  assertSlow(run, 0);
});

test('legacy boards preserve accepted wide-board painting and readable compact identity without slow cues', () => {
  const run = startCoop(createCoop(FIRST_CONNECTION));
  // Independently measured from accepted main 6c6771d7, including its newer
  // pilot-contact drawing. Compact boards intentionally use group cue packing.
  const wide = surface(1152).paint(run, { reduced: true });
  assert.equal(
    createHash('sha256').update(JSON.stringify(wide)).digest('hex'),
    '3c4b89c5c6b97ec4b0c5822c0123161c4102ac040eedc3747822f7ae452e3fcb',
  );
  const compact = surface(212).paint(run, { reduced: true });
  for (const id of ['1', '2'])
    assert.equal(labels(compact).filter((label) => label === id).length, 1);
  assert.equal(labels(compact).includes('SLOWED'), false);
  assert.equal(rings(compact).length, 0);
});
