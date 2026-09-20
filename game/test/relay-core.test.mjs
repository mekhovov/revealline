import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, validateLevel, CELL, FIXED_DT } from '../core/index.mjs';
import { classicErosionReason } from '../core/classic-topology.mjs';
import { retainedCaptureCells } from '../core/capture-regions.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { openCapturedRelays } from '../core/relay-gates.mjs';
import { resolveVersions, RELAY_VERSIONS, FOUNDATION_VERSIONS } from '../core/versions.mjs';

const source = (overrides = {}) => ({
  version: 'xonix-level.v6',
  id: 'relay-contract',
  revision: '1',
  name: 'Relay contract',
  width: 72,
  height: 36,
  spawn: { x: 10.5, y: 0.5 },
  foundations: [],
  walls: [
    { x: 35, y: 1, w: 1, h: 15 },
    { x: 35, y: 20, w: 1, h: 15 },
  ],
  relayGates: {
    version: 'relay-gates.v1',
    gates: [{ id: 'east-link', x: 35, y: 16, w: 1, h: 4, objectiveId: 'relay' }],
  },
  goal: { coverage: 0.99 },
  encounter: null,
  classic: { version: 'classic.v1', terrain: [], powerups: [] },
  enemies: [{ id: 'keeper', type: 'bouncer', x: 20.5, y: 30.5, vx: 0, vy: 0 }],
  objectives: [{ id: 'relay', x: 50.5, y: 17.5, required: true }],
  supplies: [],
  rules: { lives: 3, moveSpeed: 10, stopOnCapture: true },
  ...overrides,
});
function firstCut(level = source()) {
  const run = createRun(level),
    recorder = createRecorder(level);
  for (let n = 0; n < 500 && !run.claimedCount; n++) {
    const input = { direction: 'down' };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
  }
  assert(run.claimedCount > 0);
  return { run, recorder };
}

test('relay editions select a new authoritative tuple and reserve their denominator', () => {
  const run = createRun(source());
  assert.equal(run.ruleset, 'xonix-core.v7');
  assert.equal(authoritativeCheckpoint(run).algorithm, 'fnv1a64-state-v7');
  assert.equal(run.totalClaimable, 2380 - 34);
  assert.equal(run.score, 0);
  assert.equal(run.coverage, 0);
  assert.equal(run.cells[17 * 72 + 35], CELL.WALL);
  assert.equal(run.relay.gates[0].openedTick, null);
  assert.equal(run.classic.eligible[17 * 72 + 35], 0);
  assert.equal(validateLevel({ ...source(), version: 'xonix-level.v5' }).valid, false);
  const { relayGates: _gates, ...missing } = source();
  assert.equal(validateLevel(missing).valid, false);
});

test('one remote objective capture opens a permanent non-scoring connector exactly once', () => {
  const before = createRun(source()),
    { run } = firstCut();
  const gate = run.relay.gates[0];
  assert.equal(run.objectives[0].captured, true);
  assert.equal(gate.openedTick, run.tick);
  assert.equal(run.totalClaimable, before.totalClaimable);
  assert.equal(run.coverage, run.claimedCount / before.totalClaimable);
  assert.equal(
    run.score,
    run.classic.uniqueClaimedCount * run.rules.pointsPerCell + run.rules.objectivePoints,
  );
  assert.equal(run.player.cutting, false);
  assert.equal(run.player.speed, 0);
  for (const index of gate.cells) {
    assert.equal(run.cells[index], CELL.SAFE);
    assert.equal(run.foundation.permanent[index], 1);
    assert.equal(run.classic.everClaimed[index], 0);
    assert.equal(classicErosionReason(run, index), 'foundation');
    assert(!run.classic.tickClaims.includes(index));
  }
  const kinds = run.events.map((event) => event.type);
  assert(kinds.indexOf('cut.closed') < kinds.indexOf('objective.captured'));
  assert(kinds.indexOf('objective.captured') < kinds.indexOf('relay.opened'));
  assert.equal(kinds.filter((kind) => kind === 'cells.claimed').length, 1);
  assert.equal(kinds.filter((kind) => kind === 'relay.opened').length, 1);
  const unchanged = authoritativeCheckpoint(run);
  openCapturedRelays(run);
  assert.deepEqual(authoritativeCheckpoint(run), unchanged);
  assert.equal(run.events.filter((event) => event.type === 'relay.opened').length, 1);
});

test('retaining enemies behind a gate keep their region and trigger unclaimed', () => {
  const { run } = firstCut(
    source({
      enemies: [
        ...source().enemies,
        { id: 'remote', type: 'bouncer', x: 60.5, y: 30.5, vx: 0, vy: 0 },
      ],
    }),
  );
  assert.equal(run.objectives[0].captured, false);
  assert.equal(run.relay.gates[0].openedTick, null);
  assert.equal(run.cells[17 * 72 + 35], CELL.WALL);
  assert.equal(retainedCaptureCells(run)[17 * 72 + 50], 1);
});

test('relay capture may be on the secured trail, not only enclosed fill', () => {
  const { run } = firstCut(
    source({ objectives: [{ id: 'relay', x: 10.5, y: 17.5, required: true }] }),
  );
  assert.equal(run.relay.gates[0].openedTick, run.tick);
});

test('multiple linked connectors open atomically in deterministic ID order', () => {
  const level = source();
  level.relayGates.gates.push({
    id: 'a-second-link',
    x: 40,
    y: 10,
    w: 2,
    h: 2,
    objectiveId: 'relay',
  });
  const { run } = firstCut(level);
  const opened = run.events.filter((event) => event.type === 'relay.opened');
  assert.deepEqual(
    opened.map((event) => event.id),
    ['a-second-link', 'east-link'],
  );
  assert(opened.every((event) => event.tick === run.tick));
  assert.equal(run.totalClaimable, 2380 - 38);
  assert.equal(run.classic.uniqueClaimedCount, run.claimedCount);
});

test('public replay covers relay definitions and opened state, with fresh attempts reset', () => {
  const { run, recorder } = firstCut();
  const replay = exportReplay(recorder, run),
    verified = verifyReplay(replay);
  assert.equal(verified.match, true);
  assert.equal(verified.state.relay.gates[0].openedTick, run.relay.gates[0].openedTick);
  assert.equal(verified.state.ruleset, 'xonix-core.v7');
  const prior = authoritativeCheckpoint(run);
  run.relay.gates[0].openedTick++;
  assert.notEqual(authoritativeCheckpoint(run).hash, prior.hash);
  run.relay.gates[0].openedTick--;
  run.level.relayGates.gates[0].objectiveId = 'different';
  assert.notEqual(authoritativeCheckpoint(run).hash, prior.hash);
  assert.equal(createRun(source()).relay.gates[0].openedTick, null);
});

test('invalid trigger identities and occupants fail before a run exists', () => {
  for (const modify of [
    (s) => {
      s.relayGates.version = 'relay-gates.v2';
    },
    (s) => {
      s.relayGates.gates[0].objectiveId = 'missing';
    },
    (s) => {
      s.relayGates.gates[0].opens = 'all';
    },
    (s) => {
      s.objectives[0].hidden = true;
    },
    (s) => {
      s.objectives[0].x = 35.5;
    },
    (s) => {
      s.enemies[0].x = 35.5;
      s.enemies[0].y = 17.5;
    },
    (s) => {
      s.classic.powerups = [{ id: 'bonus', kind: 'extra-life', x: 35.5, y: 17.5 }];
    },
  ]) {
    const level = source();
    modify(level);
    assert.equal(validateLevel(level).valid, false);
  }
});

test('closed gates block movement without closing cuts; opened connectors are valid return ground', () => {
  const level = source({
    spawn: { x: 0.5, y: 17.5 },
    enemies: [
      ...source().enemies,
      { id: 'remote', type: 'bouncer', x: 60.5, y: 30.5, vx: 0, vy: 0 },
    ],
  });
  const closed = createRun(level),
    opened = createRun(level);
  // Isolate movement/closure semantics from the separately tested trigger capture.
  opened.objectives[0].captured = true;
  openCapturedRelays(opened);
  for (let n = 0; n < 440; n++) {
    stepRun(closed, { direction: 'right' }, FIXED_DT);
    if (!opened.claimedCount) stepRun(opened, { direction: 'right' }, FIXED_DT);
  }
  assert.equal(closed.lives, 3);
  assert.equal(closed.player.cutting, true);
  assert(closed.player.x < 35);
  assert.equal(closed.player.speed, 0);
  assert.equal(closed.claimedCount, 0);
  assert.equal(opened.player.cutting, false);
  assert(Math.abs(opened.player.x - 35) < 1e-9);
  assert.equal(opened.player.speed, 0);
  assert.equal(opened.lives, 3);
  assert(opened.events.some((event) => event.type === 'cut.closed'));
  assert.equal(opened.classic.everClaimed[17 * 72 + 35], 0);
});

test('ordinary life recovery retains opened connectors and their original opening tick', () => {
  const { run } = firstCut();
  const gate = structuredClone(run.relay.gates[0]),
    denominator = run.totalClaimable;
  // Arrange the craft on the earned return lane, then depart toward the keeper.
  Object.assign(run.player, { x: 10.5, y: 30.5, graceUntil: 0 });
  for (let n = 0; n < 180 && run.status === 'running'; n++)
    stepRun(run, { direction: 'right' }, FIXED_DT);
  assert.equal(run.status, 'respawning');
  assert.equal(run.lives, 2);
  for (let n = 0; n < 500 && run.status === 'respawning'; n++) stepRun(run, {}, FIXED_DT);
  assert.equal(run.status, 'running');
  assert.deepEqual(run.relay.gates[0], gate);
  assert.equal(run.totalClaimable, denominator);
  for (const index of gate.cells) {
    assert.equal(run.cells[index], CELL.SAFE);
    assert.equal(run.foundation.permanent[index], 1);
  }
});

test('one capture can activate distinct objective links without a second flood', () => {
  const level = source();
  level.objectives.push({ id: 'trail-relay', x: 10.5, y: 20.5, required: true });
  level.relayGates.gates.push({
    id: 'trail-link',
    x: 40,
    y: 10,
    w: 2,
    h: 2,
    objectiveId: 'trail-relay',
  });
  const { run } = firstCut(level);
  assert.equal(run.events.filter((event) => event.type === 'relay.opened').length, 2);
  assert.equal(run.events.filter((event) => event.type === 'cut.closed').length, 1);
  assert(run.relay.gates.every((gate) => gate.openedTick === run.tick));
});

test('relay replay tuple cannot be silently mixed with historical foundation identities', () => {
  for (const [key, value] of Object.entries(FOUNDATION_VERSIONS))
    assert.throws(() => resolveVersions({ ...RELAY_VERSIONS, [key]: value }), /mismatched/);
  const { run, recorder } = firstCut();
  const replay = exportReplay(recorder, run);
  replay.version = FOUNDATION_VERSIONS.replayVersion;
  assert.throws(() => verifyReplay(replay), /version|mismatch/i);
});
