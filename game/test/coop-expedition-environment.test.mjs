import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCoop,
  startCoop,
  stepCoop,
  pauseCoop,
  resumeCoop,
  validateCoopLevel,
} from '../coop/core.mjs';
import {
  EXPEDITION_LEVEL,
  EXPEDITION_PACK,
  EXPEDITION_RULESET,
  expeditionSpeed,
} from '../coop/expedition-environment.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import { journeyTeamPackEdition } from '../coop/foundations.mjs';
import { eventCue } from '../ui/feedback-cues.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';

const environment = (patch) => ({
  version: 'team-environment.v1',
  emitters: [],
  relays: [],
  currents: [],
  patrols: [],
  erosion: [],
  stages: [],
  ...patch,
});
function level(env, patch = {}) {
  return {
    version: EXPEDITION_LEVEL,
    id: 'environment-proof',
    revision: '1',
    name: 'Environment proof',
    width: 72,
    height: 36,
    journeyDifficulty: 'standard',
    spawns: [
      { x: 0.5, y: 10.5 },
      { x: 71.5, y: 25.5 },
    ],
    walls: [],
    safeRects: [],
    terrain: [],
    enemies: [{ id: 'keeper', type: 'drifter', x: 60.5, y: 30.5, vx: 1, vy: 0, radius: 0.25 }],
    goal: { coverage: 1 },
    rules: { moveSpeed: 10, boostMultiplier: 1 },
    lineImpact: { version: 'team-line-impact.v2', speed: 14 },
    supportRoles: ['interceptor', 'disruptor'],
    environment: environment(env),
    ...patch,
  };
}
const command = (direction) => ({ direction, boost: false, support: false });
function ticks(run, n, a = null, b = null) {
  const events = [];
  for (let i = 0; i < n; i++) {
    stepCoop(run, [command(a), command(b)]);
    events.push(...run.events);
  }
  return events;
}
const begin = (env, patch) => startCoop(createCoop(level(env, patch), { seed: 17 }));

test('Studio closure inspection protects future numbered targets even when the trail crosses them', () => {
  const run = begin({
    stages: [
      { id: 'first', x: 12.5, y: 12.5 },
      { id: 'later', x: 24.5, y: 12.5 },
    ],
  });
  const index = 12 * run.width + 24;
  const preview = inspectCaptureSnapshot(run, { trailCells: [index] });
  assert(!preview.securedTrail.includes(index));
  assert(!preview.filledCells.includes(index));
  assert.equal(run.cells[index], 0);
});

test('new environment edition and exact pack survive JSON while legacy envelopes reject it', () => {
  const source = level({ currents: [{ id: 'east', x: 8, y: 8, w: 10, h: 5, direction: 'right' }] });
  assert.equal(validateCoopLevel(source).valid, true);
  assert.deepEqual(journeyTeamPackEdition(source), {
    version: EXPEDITION_PACK,
    ruleset: EXPEDITION_RULESET,
  });
  const pack = {
    version: EXPEDITION_PACK,
    ruleset: EXPEDITION_RULESET,
    id: 'environment-proof',
    revision: '1',
    name: 'Proof',
    levels: [source],
  };
  assert.equal(validateCoopPack(JSON.parse(JSON.stringify(pack))).valid, true);
  assert.equal(
    validateCoopPack({ ...pack, version: 'revealline-coop-pack.v7', ruleset: 'revealline-coop.v9' })
      .valid,
    false,
  );
  assert.equal(validateCoopLevel({ ...source, version: 'revealline-coop-level.v7' }).valid, false);
  const run = createCoop(source);
  source.environment.currents[0].direction = 'left';
  assert.equal(run.environment.currents[0].direction, 'right');
  for (const patch of [
    { version: 'unknown' },
    { mystery: 1 },
    { patrols: [{ id: 'bad', offset: -1, speed: 99, clockwise: true }] },
    { currents: [{ id: 'overlap', x: 0, y: 2, w: 8, h: 8, direction: 'up' }] },
  ])
    assert.equal(validateCoopLevel(level(patch)).valid, false);
});

test('arrows affect active exposed travel, never parked or downed craft or reclaimed returns', () => {
  const run = begin({ currents: [{ id: 'east', x: 2, y: 8, w: 20, h: 5, direction: 'right' }] });
  ticks(run, 48, 'right');
  assert(run.players[0].x > 4.5, 'tailwind changes actual public movement');
  const p = run.players[0];
  assert.equal(expeditionSpeed(run, p), 1.35);
  assert.equal(expeditionSpeed(run, { ...p, direction: 'left' }), 0.7);
  assert.equal(expeditionSpeed(run, { ...p, direction: 'up' }), 1);
  assert.equal(expeditionSpeed(run, { ...p, direction: null }), 1);
  assert.equal(expeditionSpeed(run, { ...p, status: 'downed' }), 1);
  ticks(run, 130, 'up');
  assert.equal(run.players[0].cutting, false);
  assert.equal(expeditionSpeed(run, run.players[0]), 1);
});

test('a relay opens permanent shared ground with stable denominator and is required for victory', () => {
  const env = {
    relays: [{ id: 'bridge', gate: { x: 40, y: 5, w: 8, h: 3 }, objective: { x: 10.5, y: 4.5 } }],
  };
  const run = begin(env, { walls: [env.relays[0].gate] });
  const total = run.totalClaimable;
  const events = [...ticks(run, 300, 'right'), ...ticks(run, 140, 'up')];
  assert.equal(run.environment.relays[0].open, true);
  assert.equal(run.cells[5 * 72 + 40], 1);
  assert.equal(run.environment.protected[5 * 72 + 40], 1);
  assert.equal(run.totalClaimable, total);
  assert(events.some((e) => e.type === 'objective.captured' && e.kind === 'relay'));
  assert.equal(run.coverage, run.claimedCount / total);
});

test('lane warnings lock one owned cut and closing it cannot transfer the attack to a new cut', () => {
  const run = begin({
    emitters: [
      { id: 'lane', x: 54.5, y: 28.5, axis: 'horizontal', warningTicks: 240, restTicks: 360 },
    ],
  });
  const events = ticks(run, 420, 'right');
  const warning = events.find((e) => e.type === 'emitter.warning');
  assert(warning);
  assert.equal(warning.target, 0);
  const locked = run.environment.emitters[0].cutId;
  ticks(run, 130, 'up');
  assert.equal(run.players[0].cutting, false);
  ticks(run, 1);
  ticks(run, 70, 'down');
  assert.notEqual(run.players[0].cutId, locked);
  assert.equal(run.impacts.filter((i) => i.owner === 'lane').length, 0);
});

test('pause freezes environment clocks; warnings remain audible through existing sound bindings', () => {
  const run = begin({
    emitters: [
      { id: 'lane', x: 54.5, y: 28.5, axis: 'vertical', warningTicks: 240, restTicks: 360 },
    ],
    patrols: [{ id: 'outer', offset: 80, clockwise: true, speed: 1.8 }],
  });
  ticks(run, 380, 'right');
  pauseCoop(run);
  const before = structuredClone(run.environment);
  ticks(run, 300);
  assert.deepEqual(run.environment, before);
  resumeCoop(run);
  ticks(run, 1);
  assert.equal(run.environment.patrolTick, before.patrolTick + 1);
  assert.equal(eventCue({ type: 'emitter.warning' }), 'warning');
  assert.equal(eventCue({ type: 'shield.disabled' }), 'gate');
});

test('future stage regions stay locked until a separate earlier capture and replay stays deterministic', () => {
  const recipe = level({
    stages: [
      { id: 'first', x: 10.5, y: 4.5 },
      { id: 'second', x: 50.5, y: 22.5 },
    ],
  });
  const a = startCoop(createCoop(recipe)),
    b = startCoop(createCoop(JSON.parse(JSON.stringify(recipe))));
  for (const r of [a, b]) {
    ticks(r, 300, 'right');
    ticks(r, 140, 'up');
  }
  assert.equal(a.environment.stage, 1);
  assert.equal(a.cells[22 * 72 + 50], 0);
  assert.equal(a.status, 'running');
  assert.deepEqual(a, b);
});

test('perimeter patrols resolve swept contact on the rail and leave the other seat active', () => {
  const run = begin({ patrols: [{ id: 'outer', offset: 91, clockwise: true, speed: 4 }] });
  const events = ticks(run, 180);
  assert(events.some((e) => e.type === 'player.downed' && e.player === 1));
  assert.equal(run.players[0].status, 'active');
  assert.equal(run.players[1].status, 'downed');
});

test('local erosion warns before removing earned ground and preserves both recovery anchors', () => {
  const run = begin({
    erosion: [{ id: 'fault', x: 20.5, y: 14.5, radius: 10, warningTicks: 240, restTicks: 960 }],
  });
  ticks(run, 300, 'right');
  ticks(run, 140, 'up');
  const before = run.claimedCount;
  const events = ticks(run, 1100);
  const warning = events.find((e) => e.type === 'emitter.warning');
  const removal = events.find((e) => e.type === 'environment.eroded' && e.cells > 0);
  assert(warning);
  assert(removal);
  assert(removal.tick - warning.tick >= 240);
  assert(run.claimedCount < before);
  for (const player of run.players) {
    const i = Math.floor(player.safeAnchor.y) * 72 + Math.floor(player.safeAnchor.x);
    assert.equal(run.cells[i], 1);
    assert.equal(player.status, 'active');
  }
});
