import test from 'node:test';
import assert from 'node:assert/strict';
import { createPressureCorridorTriptychCandidates } from '../content-design/pressure-corridor-triptych-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { captureSeedEnemies, inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  exportReplay,
  recordInput,
  verifyReplay,
} from '../replay.mjs';
import { roverLinks } from './helpers/rover-goal.mjs';

const project = compileContentProject(createPressureCorridorTriptychCandidates({ artwork: true }));

// A bounded offline search continued the already-qualified lower first return.
// This is a skilled Standard/immediate/seed1 feasibility route, not human pacing,
// host-input or other-preset qualification. Its 27-second clear deserves review;
// neither all-foundation linkage nor this fixture awards the authored mastery.
const LOWER_FIRST = [
  [null, 300],
  ['down', 167],
  ['right', 198],
  ['down', 1],
  ['up', 176],
  ['left', 109],
  ['down', 41],
  ['up', 41],
  ['right', 109],
  ['up', 68],
  ['right', 108],
  ['down', 232],
  ['up', 217],
  ['left', 441],
  ['right', 7],
  ['down', 108],
  ['right', 75],
  [null, 240],
  ['right', 360],
  ['down', 68],
  ['right', 197],
];

test('Pressure ladder lower-first slow-field route clears with linked landings, active pressure, replay and equal Versus', () => {
  const manifest = resolveMission(project, 'pressure-ladder', {
    difficulty: 'standard',
    mode: 'solo',
  });
  const level = applyGameplayTuning(manifest.level, resolveGameplayTuning('standard'));
  const versusManifest = resolveMission(project, 'pressure-ladder', {
    difficulty: 'standard',
    mode: 'versus',
  });
  const versus = applyGameplayTuning(versusManifest.level, resolveGameplayTuning('standard'));
  assert.equal(manifest.simulationIdentity, '387170cc527870d5');
  assert.deepEqual(versus, level);
  const options = { seed: 1, turnPolicy: 'immediate', classId: 'scout' };
  const run = createRun(level, options);
  const recorder = createRecorder(level, options);
  const duel = createDuel(versus, options, { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 });
  resumeDuel(duel);
  assert.notEqual(duel.runs[0].cells, duel.runs[1].cells);
  const denominator = run.totalClaimable;
  const permanent = [...run.foundation.permanent.keys()].filter(
    (index) => run.foundation.permanent[index],
  );
  const slow = [...run.classic.terrain.keys()].filter(
    (index) => run.classic.terrain[index] === 1 && run.cells[index] === CELL.FIELD,
  );
  assert.equal(slow.length, 40);
  const events = [],
    closures = [],
    departures = [];
  let terminalSnapshot = null;

  play: for (const [direction, ticks] of LOWER_FIRST)
    for (let tick = 0; tick < ticks; tick++) {
      if (run.status !== 'running') break play;
      const trail = run.trail.map((cell) => cell.index);
      if (run.tick === 3262) {
        // Frozen evidence only, checked against the following real closure.
        // Both keeper centers currently occupy the trail that is about to close.
        const snapshot = inspectCaptureSnapshot(run, { trailCells: trail });
        terminalSnapshot = {
          seedCells: captureSeedEnemies(run).map((enemy) => ({
            id: enemy.id,
            index: Math.floor(enemy.y) * run.width + Math.floor(enemy.x),
          })),
          securedTrail: snapshot.securedTrail.length,
          filled: snapshot.filledCells.length,
          retained: snapshot.components.some((component) => component.retained),
        };
        assert(terminalSnapshot.seedCells.every(({ index }) => trail.includes(index)));
      }
      const fronts = run.classic.lineImpact.fronts
        .filter((front) => front.direction === 1)
        .map((front) => front.id);
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      stepDuel(duel, [{ direction }, { direction }]);
      events.push(...structuredClone(run.events));
      for (const event of run.events) {
        if (event.type === 'cut.started')
          departures.push({ tick: run.tick, x: run.player.x, y: run.player.y });
        if (event.type === 'cut.closed') {
          const cleared = run.events
            .filter((item) => item.type === 'lineImpact.cleared' && item.reason === 'capture')
            .flatMap((item) => item.ids);
          closures.push({
            tick: run.tick,
            cells: event.cells,
            claimed: run.claimedCount,
            x: run.player.x,
            y: run.player.y,
            trail,
            slowRemaining: slow.filter((index) => run.cells[index] === CELL.FIELD).length,
            linked: roverLinks(run, level.foundations),
            activePlayerFrontsCleared: fronts.filter((id) => cleared.includes(id)),
          });
          assert.equal(run.player.cutting, false);
          assert.equal(run.player.speed, 0);
        }
      }
      for (const board of [run, ...duel.runs]) {
        assert.equal(board.classic.livesLost, 0);
        assert.equal(board.totalClaimable, denominator);
        assert(permanent.every((index) => board.foundation.permanent[index] === 1));
        assert(permanent.every((index) => board.cells[index] === CELL.SAFE));
      }
    }

  assert.equal(run.status, 'won');
  assert.equal(run.tick, 3263);
  assert.equal(run.claimedCount, 2206);
  assert.equal(denominator, 2206);
  assert.equal(run.coverage, 1);
  assert.equal(run.lives, 3);
  assert.deepEqual(run.classic.powerups, [], 'There are no authored or collected pickups.');
  assert.deepEqual(
    closures.map(({ tick, cells }) => [tick, cells]),
    [
      [658, 20],
      [985, 120],
      [1543, 141],
      [2208, 24],
      [2398, 116],
      [3263, 1785],
    ],
  );
  assert.deepEqual(
    closures.map(({ claimed }) => claimed),
    [20, 140, 281, 305, 421, 2206],
  );

  // The distinct first cut crosses actual slow field and lands on the far lower
  // foundation. Its next cut departs from that staging point, not the upper rung.
  const first = closures[0],
    lower = level.foundations[2];
  assert.equal(first.x, lower.x);
  assert(first.y >= lower.y && first.y <= lower.y + lower.h);
  assert(first.trail.includes(21 * run.width + 35));
  assert(first.trail.includes(24 * run.width + 44));
  assert.equal(first.slowRemaining, 35);
  assert.equal(departures[1].tick, 687);
  assert(departures[1].x >= lower.x && departures[1].x < lower.x + lower.w);
  assert(departures[1].y < lower.y && departures[1].y > lower.y - 1);
  assert.equal(
    closures[2].y,
    lower.y,
    'A later pressured enclosure returns to the same lower landing.',
  );
  assert(closures[2].x >= lower.x && closures[2].x < lower.x + lower.w);
  const upperReturn = closures[3];
  assert.equal(upperReturn.x, level.foundations[0].x + level.foundations[0].w);
  assert(upperReturn.y >= 6 && upperReturn.y < 9);
  assert(upperReturn.trail.includes(7 * run.width + 27));
  assert.equal(closures.find((closure) => closure.linked).tick, 2208);
  assert.equal(roverLinks(run, level.foundations), true);
  assert.deepEqual(
    closures.map((closure) => closure.slowRemaining),
    [35, 32, 32, 32, 32, 0],
  );

  const pressure = events.filter((event) => event.type.startsWith('pressure.'));
  assert.deepEqual(
    pressure.map(({ type, tick, reason = null }) => [type, tick, reason]),
    [
      ['pressure.warning', 841, null],
      ['pressure.committed', 931, null],
      ['pressure.cancelled', 985, 'trail-closed'],
      ['pressure.warning', 3085, null],
      ['pressure.committed', 3175, null],
      ['pressure.cooldown', 3259, null],
    ],
  );
  for (const warning of pressure.filter((event) => event.type === 'pressure.warning')) {
    assert.equal(warning.mode, 'head-intercept');
    assert.equal(warning.warningUntil - warning.actorTick, 90);
    const commit = pressure.find(
      (event) => event.type === 'pressure.committed' && event.tick === warning.warningUntil,
    );
    assert.equal(commit.id, warning.id);
    assert.deepEqual(commit.target, warning.target);
    assert.equal(commit.commitUntil - commit.actorTick, 144);
  }
  assert.deepEqual(
    events
      .filter((event) => event.type === 'lineImpact.seeded')
      .map(({ tick, actorId }) => [tick, actorId]),
    [
      [1534, 'frontier'],
      [3250, 'east-carrier'],
      [3254, 'west-carrier'],
    ],
  );
  assert.deepEqual(
    closures
      .filter((closure) => closure.activePlayerFrontsCleared.length)
      .map(({ tick, activePlayerFrontsCleared }) => [tick, activePlayerFrontsCleared]),
    [
      [1543, ['impact-1-player']],
      [3263, ['impact-2-player', 'impact-3-player']],
    ],
  );
  // After the secured trail excludes both keeper centers, the only remaining
  // field component has no retaining enemy. The actual legal cut fills it;
  // this is not a quota, actor-removal or capture-policy change.
  assert.deepEqual(terminalSnapshot, {
    seedCells: [
      { id: 'east-carrier', index: 1500 },
      { id: 'west-carrier', index: 1499 },
    ],
    securedTrail: 14,
    filled: 1771,
    retained: false,
  });
  assert.equal(closures.at(-1).cells, terminalSnapshot.securedTrail + terminalSnapshot.filled);
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  const checkpoint = authoritativeCheckpoint(run);
  assert.equal(checkpoint.hash, 'c28892f0a872a209');
  assert.equal(duel.status, 'finished');
  assert.equal(duel.winner, null);
  for (const board of duel.runs) {
    assert.equal(board.status, 'won');
    assert.deepEqual(authoritativeCheckpoint(board), checkpoint);
  }
});
