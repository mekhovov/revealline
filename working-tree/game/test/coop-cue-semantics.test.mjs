import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop, startCoop, pauseCoop, resumeCoop } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { updateThreatClocks, useSupport } from '../coop/threats.mjs';
import { describeCoopEnemyCue, coopThreatSummary } from '../couch/coop-cue-semantics.mjs';

const hunter = (phase = 'patrol', target = null, extra = {}) => ({
  type: 'hunter',
  active: true,
  phase,
  target,
  speedScale: 1,
  slowUntil: 0,
  ...extra,
});
function activeRun(enemies) {
  const run = startCoop(createCoop(FIRST_CONNECTION));
  run.enemies = enemies;
  return run;
}
function freeze(value) {
  if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('hunter cue uses actual phase and exact zero-based player target', () => {
  for (const [phase, target, text, mark, priority] of [
    ['warning', 0, 'P1', 'hunter-lock', 1],
    ['warning', 1, 'P2', 'hunter-lock', 1],
    ['commit', 0, 'P1', 'hunter-charge', 1],
    ['commit', 1, 'P2', 'hunter-charge', 1],
    ['recovery', 1, 'H', 'hunter-recovery', 2],
    ['patrol', 1, 'H', 'hunter', 2],
    ['unknown', 0, 'H', 'hunter', 2],
  ]) {
    const enemy = freeze(hunter(phase, target)),
      cue = describeCoopEnemyCue(enemy, 3);
    assert.deepEqual(cue, { text, mark, priority, slowed: false });
    assert.ok(Object.isFrozen(cue));
  }
});

test('invalid targets never invent a player or change the actual hunter phase', () => {
  for (const target of [null, undefined, '0', '1', false, true, -1, 2, 0.5, NaN, Infinity])
    for (const [phase, mark] of [
      ['warning', 'hunter-lock'],
      ['commit', 'hunter-charge'],
    ])
      assert.deepEqual(describeCoopEnemyCue(hunter(phase, target), 0), {
        text: 'H',
        mark,
        priority: 1,
        slowed: false,
      });
});

test('inactive and malformed actors are absent; nonhunters retain only applicable slowdown', () => {
  for (const enemy of [null, undefined, [], {}, 'hunter', hunter('warning', 0, { active: false })])
    assert.equal(describeCoopEnemyCue(enemy, 0), null);
  assert.deepEqual(describeCoopEnemyCue({ type: 'drifter', speedScale: 0.5, slowUntil: 4 }, 3), {
    text: '',
    mark: null,
    priority: 2,
    slowed: true,
  });
  assert.deepEqual(describeCoopEnemyCue({ type: 'unknown' }, 0), {
    text: '',
    mark: null,
    priority: 2,
    slowed: false,
  });
});

test('slow cue requires a finite active support interval and expires exactly at its endpoint', () => {
  const enemy = freeze(hunter('recovery', null, { speedScale: 0.5, slowUntil: 4 }));
  assert.equal(describeCoopEnemyCue(enemy, 3.999).slowed, true);
  assert.equal(describeCoopEnemyCue(enemy, 4).slowed, false);
  assert.equal(describeCoopEnemyCue(enemy, 5).slowed, false);
  for (const time of [undefined, null, '3', NaN, Infinity, -1])
    assert.equal(describeCoopEnemyCue(enemy, time).slowed, false);
  for (const speedScale of [undefined, '0.5', 0, -0.5, 1, 2, NaN, Infinity])
    assert.equal(describeCoopEnemyCue({ ...enemy, speedScale }, 3).slowed, false);
  for (const slowUntil of [undefined, '4', NaN, Infinity])
    assert.equal(describeCoopEnemyCue({ ...enemy, slowUntil }, 3).slowed, false);
});

test('real Team threat transitions determine cues without any presentation-owned timing', () => {
  const run = startCoop(createCoop(FIRST_CONNECTION)),
    enemy = run.enemies.find((item) => item.type === 'hunter');
  run.time = 10;
  Object.assign(enemy, {
    phase: 'warning',
    phaseUntil: run.time,
    target: 0,
    targetPoint: { x: enemy.x + 4, y: enemy.y },
  });
  assert.equal(describeCoopEnemyCue(enemy, run.time).mark, 'hunter-lock');
  updateThreatClocks(run, () => {});
  assert.equal(enemy.phase, 'commit');
  assert.equal(describeCoopEnemyCue(enemy, run.time).mark, 'hunter-charge');
  run.time = enemy.phaseUntil;
  updateThreatClocks(run, () => {});
  assert.equal(enemy.phase, 'recovery');
  const before = structuredClone(run);
  assert.equal(describeCoopEnemyCue(enemy, run.time).mark, 'hunter-recovery');
  assert.deepEqual(run, before);
});

test('real Support slowdown and paused time remain cosmetic read-only inputs', () => {
  const run = startCoop(createCoop(FIRST_CONNECTION)),
    enemy = run.enemies.find((item) => item.type === 'hunter'),
    player = run.players[0];
  enemy.x = player.x + 1;
  enemy.y = player.y;
  useSupport(run, player, () => {});
  assert.equal(enemy.speedScale, 0.5);
  assert.ok(enemy.slowUntil > run.time);
  pauseCoop(run);
  const before = structuredClone(run);
  for (let i = 0; i < 3; i++) assert.equal(describeCoopEnemyCue(enemy, run.time).slowed, true);
  assert.deepEqual(run, before);
});

test('summary preserves both targets and both phases while deduplicating repeated hunters', () => {
  const run = freeze(
    activeRun([
      hunter('commit', 1),
      hunter('warning', 1),
      hunter('warning', 0),
      hunter('warning', 1),
      hunter('commit', 0),
      hunter('commit', 1),
    ]),
  );
  const before = structuredClone(run);
  assert.equal(
    coopThreatSummary(run),
    'Hunter lock: Players 1 and 2 · Hunter charge: Players 1 and 2',
  );
  assert.deepEqual(run, before);
  assert.equal(
    coopThreatSummary({ ...run, enemies: [...run.enemies].reverse() }),
    coopThreatSummary(run),
  );
});

test('summary distinguishes a single lock, a single charge and simultaneous different targets', () => {
  assert.equal(coopThreatSummary(activeRun([hunter('warning', 0)])), 'Hunter lock: Player 1');
  assert.equal(coopThreatSummary(activeRun([hunter('commit', 1)])), 'Hunter charge: Player 2');
  assert.equal(
    coopThreatSummary(activeRun([hunter('warning', 0), hunter('commit', 1)])),
    'Hunter lock: Player 1 · Hunter charge: Player 2',
  );
});

test('summary excludes inactive, invalid, nonhunter and non-immediate threats', () => {
  const run = activeRun([
    null,
    {},
    hunter('warning', 0, { active: false }),
    hunter('warning', '0'),
    hunter('warning', 2),
    hunter('commit', null),
    hunter('recovery', 0),
    hunter('patrol', 1),
    { type: 'drifter', phase: 'commit', target: 1 },
  ]);
  assert.equal(coopThreatSummary(run), null);
  run.enemies.push(hunter('warning', 1));
  assert.equal(coopThreatSummary(run), 'Hunter lock: Player 2');
  run.players[1].status = 'unavailable';
  assert.equal(coopThreatSummary(run), null);
});

test('either downed player keeps rescue guidance ahead of every hunter summary', () => {
  for (const player of [0, 1]) {
    const run = activeRun([hunter('warning', 0), hunter('commit', 1)]);
    run.players[player].status = 'downed';
    freeze(run);
    const before = structuredClone(run);
    assert.equal(coopThreatSummary(run), null);
    assert.deepEqual(run, before);
  }
});

test('pause retains actual threats while ready, terminal and malformed runs have no advisory', () => {
  const run = activeRun([hunter('warning', 0), hunter('commit', 1)]),
    expected = coopThreatSummary(run);
  pauseCoop(run);
  const paused = structuredClone(run);
  assert.equal(coopThreatSummary(run), expected);
  assert.deepEqual(run, paused);
  resumeCoop(run);
  assert.equal(coopThreatSummary(run), expected);
  for (const status of ['ready', 'won', 'lost', 'unknown'])
    assert.equal(coopThreatSummary({ ...run, status }), null);
  for (const invalid of [null, undefined, [], {}, { status: 'running' }])
    assert.equal(coopThreatSummary(invalid), null);
});
