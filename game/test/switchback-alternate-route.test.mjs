import test from 'node:test';
import assert from 'node:assert/strict';
import { createPressureCorridorTriptychCandidates } from '../content-design/pressure-corridor-triptych-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  exportReplay,
  recordInput,
  verifyReplay,
} from '../replay.mjs';

const project = compileContentProject(createPressureCorridorTriptychCandidates({ artwork: true }));
const options = { seed: 1, turnPolicy: 'immediate', classId: 'scout' };

// A second, east-first complete route, not a replacement for the existing
// west-first recipe. All commands use freshly prepared current gp4 rules.
// One Standard/immediate seed establishes skilled feasibility, not host input,
// all-preset/all-seed balance, human enjoyment or a runtime mastery award.
const EAST_FIRST = [
  ['right', 40],
  ['up', 143],
  ['down', 150],
  ['right', 285],
  ['up', 232],
  ['left', 318],
  ['down', 28],
  ['left', 7],
  ['down', 150],
  [null, 1],
  ['down', 55],
  ['left', 292],
  ['up', 232],
  ['right', 310],
  ['down', 462],
  ['right', 294],
  [null, 120], // Let the warned bottom lane expire before leaving return ground.
  ['up', 191],
  ['left', 1],
  ['up', 41],
  ['right', 171],
  ['left', 951],
  ['right', 170],
  ['down', 232],
  ['right', 203],
  [null, 120], // Keeper opening; the separately probed 90-tick wait also clears.
  ['up', 218],
];

function prepare(mode = 'solo') {
  const manifest = resolveMission(project, 'relay-remix', { difficulty: 'standard', mode });
  const level = applyGameplayTuning(manifest.level, resolveGameplayTuning('standard'));
  return { manifest, level };
}

function playerPoint(run) {
  return { tick: run.tick, x: run.player.x, y: run.player.y, cutting: run.player.cutting };
}

function freshRoute(segments, { paired = false } = {}) {
  const { manifest, level } = prepare();
  const run = createRun(level, options);
  const recorder = paired ? createRecorder(level, options) : null;
  const versus = paired ? prepare('versus').level : null;
  if (paired) assert.deepEqual(versus, level);
  const duel = paired
    ? createDuel(versus, options, { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 })
    : null;
  if (duel) {
    resumeDuel(duel);
    assert.notEqual(duel.runs[0].cells, duel.runs[1].cells);
  }
  const denominator = run.totalClaimable;
  const permanent = [...run.foundation.permanent.keys()].filter(
    (index) => run.foundation.permanent[index],
  );
  const events = [];
  const episodes = [];
  const phases = [];
  let occupied = null;
  let previousPhase = null;

  play: for (const [direction, ticks] of segments)
    for (let tick = 0; tick < ticks; tick++) {
      if (run.status !== 'running') break play;
      const before = playerPoint(run);
      if (recorder) recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      if (duel) stepDuel(duel, [{ direction }, { direction }]);
      const point = playerPoint(run);
      events.push(
        ...structuredClone(run.events).map((event) => ({
          ...event,
          player: point,
          claimedCount: run.claimedCount,
        })),
      );
      const cell = Math.floor(point.y) * run.width + Math.floor(point.x);
      const gate = run.relay.gates.find(
        (candidate) => candidate.openedTick !== null && candidate.cells.includes(cell),
      );
      if (occupied && occupied.id !== gate?.id) {
        occupied.after = point;
        episodes.push(occupied);
        occupied = null;
      }
      if (gate) {
        assert.equal(run.cells[cell], CELL.SAFE);
        assert.equal(point.cutting, false);
        occupied ??= { id: gate.id, before, points: [] };
        occupied.points.push(point);
      }
      const emitter = run.enemies.find((enemy) => enemy.id === 'emitter');
      if (emitter.bossPhase !== previousPhase) {
        phases.push({ tick: run.tick, phase: emitter.bossPhase, lane: emitter.lane });
        previousPhase = emitter.bossPhase;
      }
      for (const board of [run, ...(duel?.runs ?? [])]) {
        assert.equal(board.totalClaimable, denominator);
        assert(permanent.every((index) => board.foundation.permanent[index] === 1));
        assert(permanent.every((index) => board.cells[index] === CELL.SAFE));
        if (paired) assert.equal(board.classic.livesLost, 0);
        for (const opened of board.relay.gates.filter(
          (candidate) => candidate.openedTick !== null,
        )) {
          assert.equal(opened.cells.length, 42);
          assert(opened.cells.every((index) => board.cells[index] === CELL.SAFE));
          assert(opened.cells.every((index) => board.foundation.permanent[index] === 1));
        }
      }
    }

  assert.deepEqual(
    run.classic.powerups.filter((powerup) => powerup.collectedTick !== null),
    [],
  );
  const checkpoint = authoritativeCheckpoint(run);
  if (paired) {
    assert.equal(run.status, 'won');
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    assert.equal(duel.status, 'finished');
    assert.equal(duel.winner, null);
    for (const board of duel.runs) {
      assert.equal(board.status, 'won');
      assert.deepEqual(authoritativeCheckpoint(board), checkpoint);
    }
  }
  return { run, manifest, events, episodes, phases, checkpoint };
}

function assertCrossing(episode, { id, first, last, minimum, maximum, direction }) {
  assert.equal(episode.id, id);
  assert.equal(episode.points[0].tick, first);
  assert.equal(episode.points.at(-1).tick, last);
  assert.equal(episode.before.tick, first - 1);
  assert.equal(episode.after.tick, last + 1);
  assert.equal(episode.before.cutting, false);
  assert.equal(episode.after.cutting, false);
  assert(episode.points.every((point) => point.y >= 16 && point.y < 19 && !point.cutting));
  const points = [episode.before, ...episode.points, episode.after];
  assert(
    points.every((point, index) => index === 0 || (point.x - points[index - 1].x) * direction > 0),
  );
  if (direction === 1) {
    assert(episode.before.x < minimum);
    assert(episode.after.x >= maximum);
  } else {
    assert(episode.before.x >= maximum);
    assert(episode.after.x < minimum);
  }
}

test('Switchback east-first route traverses both opened connectors and clears with replay and tied Versus', () => {
  const { run, manifest, events, episodes, phases, checkpoint } = freshRoute(EAST_FIRST, {
    paired: true,
  });
  assert.equal(manifest.simulationIdentity, '9a4cda68a408d14a');
  assert.equal(checkpoint.hash, 'b1e9dccc51cfe04f');
  assert.equal(run.tick, 5417);
  assert.equal(run.claimedCount, 1705);
  assert.equal(run.totalClaimable, 2002);
  assert.equal(run.coverage, 1705 / 2002);
  assert.equal(run.lives, 3);
  assert.deepEqual(
    events.filter((event) => event.type === 'objective.captured').map(({ tick, id }) => [tick, id]),
    [
      [183, 'east-relay'],
      [1353, 'upper-relay'],
    ],
  );
  assert.deepEqual(
    events
      .filter((event) => event.type === 'relay.opened')
      .map(({ tick, id, objectiveId }) => [tick, id, objectiveId]),
    [
      [183, 'east-link', 'east-relay'],
      [1353, 'west-link', 'upper-relay'],
    ],
  );
  assert.equal(episodes.length, 4);
  assertCrossing(episodes[0], {
    id: 'east-link',
    first: 368,
    last: 557,
    minimum: 41,
    maximum: 55,
    direction: 1,
  });
  assertCrossing(episodes[1], {
    id: 'west-link',
    first: 1471,
    last: 1660,
    minimum: 17,
    maximum: 31,
    direction: -1,
  });
  assertCrossing(episodes[2], {
    id: 'east-link',
    first: 3741,
    last: 3930,
    minimum: 41,
    maximum: 55,
    direction: -1,
  });
  assertCrossing(episodes[3], {
    id: 'west-link',
    first: 4066,
    last: 4256,
    minimum: 17,
    maximum: 31,
    direction: -1,
  });

  // The first opened connector enables a new departure from its eastern
  // landing, before the second relay. This is more than an incidental visit.
  const landingDeparture = events.find(
    (event) => event.type === 'cut.started' && event.tick === 660,
  );
  assert(landingDeparture.player.x >= 55 && landingDeparture.player.x < 62);
  assert(landingDeparture.player.y < 15 && landingDeparture.player.y > 14.9);
  const closures = events.filter((event) => event.type === 'cut.closed');
  assert.deepEqual(
    closures.map(({ tick, cells }) => [tick, cells]),
    [
      [183, 7],
      [850, 14],
      [1196, 270],
      [1353, 21],
      [1933, 284],
      [2705, 14],
      [3310, 306],
      [3523, 181],
      [4474, 195],
      [4876, 209],
      [5417, 204],
    ],
  );
  assert.equal(closures.find((event) => event.tick === 1353).claimedCount, 312);
  assert.equal(closures.filter((event) => event.tick > 1353).length, 7);
  assert.equal(run.tick - 1353, 4064);
  assert.equal(
    EAST_FIRST.filter(([direction]) => direction === null).reduce(
      (sum, [, ticks]) => sum + ticks,
      0,
    ),
    241,
  );

  const warnings = events.filter((event) => event.type === 'boss.warning');
  assert.equal(warnings.length, 11);
  assert(warnings.every((event) => event.id === 'emitter' && event.axis === 'horizontal'));
  assert.equal(warnings.find((event) => event.tick === 748).lane, 8.5);
  assert(850 < phases.find((phase) => phase.tick === 928 && phase.phase === 'active').tick);
  assert.deepEqual(
    phases.filter((phase) => phase.tick >= 2776 && phase.tick <= 3040),
    [
      { tick: 2776, phase: 'warning', lane: 34.5 },
      { tick: 2956, phase: 'active', lane: 34.5 },
      { tick: 3040, phase: 'idle', lane: 34.5 },
    ],
  );
  assert(events.some((event) => event.type === 'cut.started' && event.tick === 3120));
  assert.deepEqual(
    events
      .filter((event) => event.type === 'rover.warning')
      .map(({ tick, id, activationTick }) => [tick, id, activationTick]),
    [[3310, 'roamer', 3430]],
  );
  assert.deepEqual(
    events.filter((event) => event.type === 'rover.activated').map(({ tick, id }) => [tick, id]),
    [[3430, 'roamer']],
  );
  assert(3430 < episodes[2].points[0].tick);
  assert(3430 < episodes[3].points[0].tick);
  // This route avoids impacts, rather than demonstrating impact cancellation.
  assert.deepEqual(
    events.filter((event) => event.type.startsWith('lineImpact.')),
    [],
  );
  assert.equal(events.filter((event) => event.type === 'run.completed').length, 1);
  // v37's different-court-gaps mastery is descriptive design metadata without
  // a corresponding award predicate; the historical relay helper is not it.
});

test('Switchback alternate overlong upper cut is caught by the warned lane impact', () => {
  const { run, events, checkpoint } = freshRoute([
    ...EAST_FIRST.slice(0, 4),
    ['up', 224],
    ['left', 318],
    ['down', 25],
  ]);
  assert.equal(run.status, 'respawning');
  assert.equal(run.tick, 981);
  assert.equal(run.classic.livesLost, 1);
  assert.equal(run.claimedCount, 7);
  assert.equal(checkpoint.hash, '5d3048d235e15d43');
  assert.deepEqual(
    events
      .filter((event) => event.type === 'lineImpact.seeded')
      .map(({ tick, actorId }) => [tick, actorId]),
    [[928, 'emitter']],
  );
  assert.deepEqual(
    events
      .filter((event) => event.type === 'player.failed')
      .map(({ tick, cause, actorId, lives }) => [tick, cause, actorId, lives]),
    [[981, 'enemy-trail', 'emitter', 2]],
  );
});

test('Switchback alternate departing during the active bottom lane loses immediately', () => {
  const { run, events, checkpoint } = freshRoute([...EAST_FIRST.slice(0, 16), ['up', 191]]);
  assert.equal(run.status, 'respawning');
  assert.equal(run.tick, 3000);
  assert.equal(run.classic.livesLost, 1);
  assert.equal(checkpoint.hash, '1660726e1da41fe2');
  assert.deepEqual(
    events
      .filter((event) => event.type === 'lineImpact.seeded')
      .map(({ tick, actorId }) => [tick, actorId]),
    [[3000, 'emitter']],
  );
  assert.deepEqual(
    events
      .filter((event) => event.type === 'player.failed')
      .map(({ tick, cause, actorId, lives }) => [tick, cause, actorId, lives]),
    [[3000, 'enemy-trail', 'emitter', 2]],
  );
});

test('Switchback alternate final keeper approach without its timing window is not a free clear', () => {
  const { run, events } = freshRoute([...EAST_FIRST.slice(0, 25), ['up', 232]]);
  assert.equal(run.status, 'respawning');
  assert.equal(run.tick, 5233);
  assert.equal(run.classic.livesLost, 1);
  assert.equal(run.claimedCount, 1501);
  assert.deepEqual(
    events
      .filter((event) => event.type === 'lineImpact.seeded')
      .map(({ tick, actorId }) => [tick, actorId]),
    [[5228, 'carrier']],
  );
  assert.deepEqual(
    events
      .filter((event) => event.type === 'player.failed')
      .map(({ tick, cause, actorId, lives }) => [tick, cause, actorId, lives]),
    [[5233, 'enemy-trail', 'carrier', 2]],
  );
  // Bounded exploration additionally tried waits 30,60,180,240,360: each
  // lost one life. Both 90 and120 cleared, so this is not a claimed unique or
  // globally optimal timing. Only120 receives replay/Versus qualification here.
});
