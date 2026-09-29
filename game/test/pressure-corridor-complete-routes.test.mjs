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
import {
  createPhaseGoalEvidence,
  phaseBeforeStep,
  observePhaseGoal,
  inspectPhaseGoal,
} from './helpers/phase-goal.mjs';
import {
  createRelayGoalEvidence,
  relayBeforeStep,
  observeRelayGoal,
  inspectRelayGoal,
} from './helpers/relay-goal.mjs';

const project = compileContentProject(createPressureCorridorTriptychCandidates({ artwork: true }));

/** Fresh source preparation and recorded legal commands only. These skilled
 * Standard/immediate/seed1 routes are not host-input, all-preset balance,
 * optional-mastery or human enjoyment qualification. Historical first-return
 * evidence remains unchanged in pressure-corridor-effective-routes.test.mjs. */
function completeRoute(missionId, segments) {
  const manifest = resolveMission(project, missionId, { difficulty: 'standard', mode: 'solo' });
  const level = applyGameplayTuning(manifest.level, resolveGameplayTuning('standard'));
  const versusManifest = resolveMission(project, missionId, {
    difficulty: 'standard',
    mode: 'versus',
  });
  const versus = applyGameplayTuning(versusManifest.level, resolveGameplayTuning('standard'));
  assert.deepEqual(versus, level);
  const options = { seed: 1, turnPolicy: 'immediate', classId: 'scout' };
  const run = createRun(level, options);
  const recorder = createRecorder(level, options);
  const duel = createDuel(versus, options, {
    protocol: UNTIMED_DUEL_PROTOCOL,
    seconds: 0,
  });
  resumeDuel(duel);
  assert.notEqual(duel.runs[0].cells, duel.runs[1].cells);
  const denominator = run.totalClaimable;
  const permanent = [...run.foundation.permanent.keys()].filter(
    (index) => run.foundation.permanent[index],
  );
  const phaseEvidence = createPhaseGoalEvidence(run);
  const relayEvidence = createRelayGoalEvidence();
  const gateVisits = new Map();
  const gateOccupiedTicks = new Map();
  const events = [];

  play: for (const [direction, ticks] of segments)
    for (let tick = 0; tick < ticks; tick++) {
      if (run.status !== 'running') break play;
      const before = phaseBeforeStep(run);
      const relayBefore = relayBeforeStep(run);
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      stepDuel(duel, [{ direction }, { direction }]);
      observePhaseGoal(run, phaseEvidence, before);
      if (run.relay?.gates) {
        observeRelayGoal(run, relayEvidence, relayBefore);
        const cell = Math.floor(run.player.y) * run.width + Math.floor(run.player.x);
        for (const gate of run.relay.gates)
          if (gate.openedTick !== null) {
            assert(gate.cells.every((index) => run.cells[index] === CELL.SAFE));
            assert(gate.cells.every((index) => run.foundation.permanent[index] === 1));
            if (gate.cells.includes(cell)) {
              assert.equal(run.player.cutting, false);
              if (!gateVisits.has(gate.id)) gateVisits.set(gate.id, run.tick);
              gateOccupiedTicks.set(gate.id, (gateOccupiedTicks.get(gate.id) ?? 0) + 1);
            }
          }
      }
      events.push(...structuredClone(run.events));
      for (const board of [run, ...duel.runs]) {
        assert.equal(board.classic.livesLost, 0);
        assert.equal(board.totalClaimable, denominator);
        assert(permanent.every((index) => board.foundation.permanent[index] === 1));
        assert(permanent.every((index) => board.cells[index] === CELL.SAFE));
      }
    }

  assert.equal(run.status, 'won');
  assert.equal(run.lives, 3);
  assert.deepEqual(
    run.classic.powerups.filter((powerup) => powerup.collectedTick !== null),
    [],
  );
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  const checkpoint = authoritativeCheckpoint(run);
  assert.equal(duel.status, 'finished');
  assert.equal(duel.winner, null);
  for (const board of duel.runs) {
    assert.equal(board.status, 'won');
    assert.deepEqual(authoritativeCheckpoint(board), checkpoint);
  }
  return {
    run,
    manifest,
    level,
    events,
    phaseEvidence,
    relayEvidence,
    gateVisits,
    gateOccupiedTicks,
    checkpoint,
  };
}

test('Pressure ladder Standard immediate seed1 clears with warned interception, impact closures, replay and tied Versus', () => {
  const { run, manifest, level, events, phaseEvidence, checkpoint } = completeRoute(
    'pressure-ladder',
    [
      [null, 120],
      ['left', 162],
      ['up', 89],
      [null, 1],
      ['up', 150],
      ['left', 330],
      ['down', 220],
      [null, 1],
      ['right', 401],
      [null, 301],
      ['down', 249],
      ['right', 150],
      [null, 1],
      ['up', 245],
      [null, 1],
      ['up', 226],
      ['right', 390],
      [null, 401],
      ['down', 469],
      ['up', 245],
      [null, 1],
      ['left', 378],
    ],
  );
  assert.equal(manifest.simulationIdentity, '387170cc527870d5');
  assert.equal(run.tick, 4531);
  assert.equal(run.claimedCount, 1790);
  assert.equal(run.totalClaimable, 2206);
  assert.equal(run.coverage, 1790 / 2206);
  assert.equal(checkpoint.hash, 'b4963c61fd2d4316');
  assert.deepEqual(
    events.filter((event) => event.type === 'cut.closed').map(({ tick, cells }) => [tick, cells]),
    [
      [371, 13],
      [481, 5],
      [1474, 310],
      [2024, 540],
      [2420, 198],
      [2639, 224],
      [3907, 68],
      [4531, 432],
    ],
  );
  const pressure = events.filter((event) => event.type.startsWith('pressure.'));
  assert.deepEqual(
    pressure.map(({ type, tick, reason = null }) => [type, tick, reason]),
    [
      ['pressure.warning', 433, null],
      ['pressure.cancelled', 481, 'trail-closed'],
      ['pressure.warning', 3709, null],
      ['pressure.committed', 3799, null],
      ['pressure.cancelled', 3907, 'trail-closed'],
    ],
  );
  for (const warning of pressure.filter((event) => event.type === 'pressure.warning')) {
    assert.equal(warning.mode, 'head-intercept');
    assert.equal(warning.warningUntil - warning.actorTick, 90);
  }
  const committed = pressure.find((event) => event.type === 'pressure.committed');
  const secondWarning = pressure.find((event) => event.tick === 3709);
  assert.equal(committed.id, secondWarning.id);
  assert.deepEqual(committed.target, secondWarning.target);
  assert.equal(committed.commitUntil - committed.actorTick, 144);

  const impacts = events.filter((event) => event.type === 'lineImpact.seeded');
  const cleared = events.filter((event) => event.type === 'lineImpact.cleared');
  assert.deepEqual(
    impacts.map(({ tick, actorId }) => [tick, actorId]),
    [
      [2013, 'west-carrier'],
      [3905, 'east-carrier'],
    ],
  );
  assert.deepEqual(
    cleared.map(({ tick, reason }) => [tick, reason]),
    [
      [2024, 'capture'],
      [3907, 'capture'],
    ],
  );
  for (const [index, impact] of impacts.entries()) {
    assert.deepEqual(
      impact.fronts.map((front) => front.direction),
      [-1, 1],
    );
    assert.deepEqual(
      cleared[index].ids,
      impact.fronts.map((front) => front.id),
    );
  }

  // This historical Phaseworks helper measures all-foundation connectivity.
  // v37 instead authors a both-gap challenge; that geometry-specific goal is
  // not measured here, and this test-only result does not award runtime mastery.
  assert.deepEqual(
    inspectPhaseGoal({
      missionId: 'pressure-ladder',
      run,
      foundations: level.foundations,
      evidence: phaseEvidence,
    }),
    {
      achieved: false,
      allLinked: false,
      lethalNeutralized: true,
      districts: [0],
      impactClosure: true,
      activeClosure: false,
      activeImpactClosure: false,
    },
  );
});

test('Switchback exchange Standard immediate seed1 clears with ordered relays, used gate ground, replay and tied Versus', () => {
  const { run, manifest, events, relayEvidence, gateVisits, gateOccupiedTicks, checkpoint } =
    completeRoute('relay-remix', [
      ['up', 143],
      ['down', 20],
      ['right', 41],
      ['down', 27],
      ['left', 35],
      ['right', 7],
      ['left', 14],
      ['down', 299],
      ['right', 109],
      ['up', 184],
      ['down', 7],
      ['up', 14],
      ['left', 204],
      ['down', 217],
      ['right', 109],
      ['up', 20],
      ['down', 34],
      ['right', 271],
      ['up', 197],
      ['down', 197],
      ['left', 760],
      ['up', 475],
      ['right', 149],
      ['down', 197],
      [null, 60],
      ['down', 7],
      ['up', 204],
      ['right', 68],
      ['down', 197],
      [null, 120],
      ['down', 20],
      ['right', 177],
      ['up', 211],
      [null, 240],
      ['down', 7],
      ['up', 14],
      ['right', 570],
      ['down', 285],
      ['left', 197],
    ]);
  assert.equal(manifest.simulationIdentity, '9a4cda68a408d14a');
  assert.equal(run.tick, 6107);
  assert.equal(run.claimedCount, 1820);
  assert.equal(run.totalClaimable, 2002);
  assert.equal(run.coverage, 1820 / 2002);
  assert.equal(checkpoint.hash, '09638acfdde8cf90');
  assert.equal(events.filter((event) => event.type === 'cut.closed').length, 9);
  assert.deepEqual(
    events
      .filter((event) => event.type === 'relay.opened')
      .map(({ tick, objectiveId, id }) => [tick, objectiveId, id]),
    [
      [143, 'upper-relay', 'west-link'],
      [266, 'east-relay', 'east-link'],
    ],
  );
  assert.deepEqual(
    run.objectives
      .filter((objective) => objective.required && objective.captured)
      .map(({ id }) => id),
    ['upper-relay', 'east-relay'],
  );
  // These cells are actually occupied after opening and before the clear.
  // This is not evidence of an end-to-end horizontal connector crossing.
  assert.deepEqual(
    [...gateVisits],
    [
      ['east-link', 894],
      ['west-link', 1070],
    ],
  );
  assert(gateVisits.size > 0 && [...gateVisits.values()].every((tick) => tick < run.tick));
  assert.deepEqual(
    [...gateOccupiedTicks],
    [
      ['east-link', 41],
      ['west-link', 218],
    ],
  );
  assert.deepEqual(
    events
      .filter((event) => event.type === 'lineImpact.seeded')
      .map(({ tick, actorId }) => [tick, actorId]),
    [
      [1435, 'emitter'],
      [1942, 'emitter'],
      [4770, 'carrier'],
      [6095, 'carrier'],
    ],
  );
  assert.deepEqual(
    events
      .filter((event) => event.type === 'lineImpact.cleared')
      .map(({ tick, reason, ids }) => [tick, reason, ids]),
    [
      [1450, 'capture', ['impact-1-departure', 'impact-1-player']],
      [1952, 'capture', ['impact-2-player']],
      [4794, 'capture', ['impact-3-player']],
      [6107, 'capture', ['impact-4-player']],
    ],
  );
  const laneWarnings = events.filter((event) => event.type === 'boss.warning');
  assert.equal(laneWarnings.length, 12);
  assert(laneWarnings.every((event) => event.id === 'emitter'));
  assert.deepEqual(
    events
      .filter((event) => event.type === 'rover.warning')
      .map(({ tick, id, activationTick }) => [tick, id, activationTick]),
    [[1952, 'roamer', 2072]],
  );
  assert.deepEqual(
    events.filter((event) => event.type === 'rover.activated').map(({ tick }) => tick),
    [2072],
  );
  // The historical helper measures impact-on-relay closure, not v37's newer
  // different-court-gap wording. Preserve the observation without claiming a
  // current-edition mastery result or a runtime award.
  const goal = inspectRelayGoal({ missionId: 'relay-remix', run, evidence: relayEvidence });
  assert.equal(goal.achieved, false);
  assert.equal(goal.impactRelayClosure, false);
  assert.deepEqual([...goal.used].sort(), ['east-link', 'west-link']);
});
