import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, CELL } from '../../core/index.mjs';
import { inspectCaptureSnapshot } from '../../core/capture-regions.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../../replay.mjs';
import { createApexGoalEvidence, observeApexGoal } from './apex-goal.mjs';

/** Ordinary public-input field-finale evidence. Never synthesizes a boss release. */
export function playApexFieldRoute(manifest, row, { race = false } = {}) {
  const options = { seed: row.seed ?? 1, classId: 'scout', turnPolicy: row.turnPolicy };
  const run = createRun(manifest.level, options);
  assert.equal(run.encounter, null);
  const recorder = createRecorder(manifest.level, options);
  const match = race
    ? createDuel(manifest.level, options, { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 })
    : null;
  if (match) {
    assert.notEqual(match.runs[0].cells, match.runs[1].cells);
    assert.notEqual(match.runs[0].enemies, match.runs[1].enemies);
    resumeDuel(match);
  }
  const evidence = createApexGoalEvidence();
  const closures = [],
    objectives = [],
    roverEvents = [],
    dockCrossings = [];
  let allRequiredCapturedTick = null,
    firstQuotaTick = null;
  let exposureTicks = 0,
    postObjectiveExposureTicks = 0;
  let maxExposureTicks = 0,
    currentExposure = 0,
    closestActiveRoamer = null;
  const denominator = run.totalClaimable;
  for (const { direction, ticks } of row.segments) {
    assert([null, 'left', 'right', 'up', 'down'].includes(direction));
    assert(Number.isSafeInteger(ticks) && ticks > 0);
    for (let tick = 0; tick < ticks; tick++) {
      assert.equal(run.status, 'running');
      if (direction === null) {
        assert.equal(run.player.speed, 0, 'No artificial neutral braking');
        assert.equal(run.player.cutting, false, 'Wait only after securing a cut');
        assert.equal(
          run.cells[Math.floor(run.player.y) * run.width + Math.floor(run.player.x)],
          CELL.SAFE,
        );
      }
      const wasCutting = run.player.cutting;
      const dock = run.relay.gates.find((gate) => gate.id === 'home-dock');
      const inDock = () =>
        dock.openedTick !== null &&
        dock.cells.includes(Math.floor(run.player.y) * run.width + Math.floor(run.player.x));
      const wasInDock = inDock();
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      if (match) stepDuel(match, [{ direction }, { direction }]);
      assert.equal(run.classic.livesLost, 0);
      assert.equal(run.totalClaimable, denominator);
      if (wasInDock !== inDock()) dockCrossings.push([run.tick, inDock() ? 'enter' : 'exit']);
      observeApexGoal(run, evidence);
      if (wasCutting || run.player.cutting) {
        exposureTicks++;
        if (allRequiredCapturedTick !== null) postObjectiveExposureTicks++;
        maxExposureTicks = Math.max(maxExposureTicks, ++currentExposure);
      }
      if (!run.player.cutting) currentExposure = 0;
      if (run.objectives.every((item) => !item.required || item.captured))
        allRequiredCapturedTick ??= run.tick;
      if (run.coverage >= manifest.level.goal.coverage) firstQuotaTick ??= run.tick;
      const roamer = run.enemies.find((enemy) => enemy.id === 'roamer');
      if (roamer?.classic?.mode === 'active') {
        const distance = Math.hypot(roamer.x - run.player.x, roamer.y - run.player.y);
        if (!closestActiveRoamer || distance < closestActiveRoamer.distance)
          closestActiveRoamer = { tick: run.tick, distance, cutting: run.player.cutting };
      }
      for (const event of run.events) {
        if (event.type === 'rover.warning' || event.type === 'rover.activated')
          roverEvents.push([run.tick, event.type]);
        if (event.type === 'objective.captured') objectives.push([run.tick, event.id]);
        if (event.type === 'cut.closed')
          closures.push({
            tick: run.tick,
            coverage: run.coverage,
            player: [run.player.x, run.player.y],
            regions: inspectCaptureSnapshot(run).components.map((component) => ({
              cells: component.cells.length,
              enemyIds: component.enemyIds,
            })),
            enemies: run.enemies.map((enemy) => ({
              id: enemy.id,
              x: enemy.x,
              y: enemy.y,
              mode: enemy.classic?.mode ?? null,
            })),
          });
        assert.notEqual(event.type, 'encounter.defeated');
      }
    }
  }
  assert.equal(run.status, 'won');
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  if (match) {
    assert.equal(match.status, 'finished');
    assert.equal(match.winner, null);
    assert.deepEqual(
      authoritativeCheckpoint(match.runs[0]),
      authoritativeCheckpoint(match.runs[1]),
    );
    assert.deepEqual(authoritativeCheckpoint(match.runs[0]), authoritativeCheckpoint(run));
  }
  for (const gate of run.relay.gates)
    for (const cell of gate.cells) {
      assert.equal(run.cells[cell], CELL.SAFE);
      assert.equal(run.foundation.permanent[cell], 1);
      assert.equal(run.classic.everClaimed[cell], 0);
    }
  const visited = (index) => evidence.connected.has(index) && evidence.visits.has(index);
  return {
    ticks: run.tick,
    coverage: run.coverage,
    lives: run.lives,
    checkpoint: authoritativeCheckpoint(run).hash,
    denominator,
    closures,
    objectives,
    roverEvents,
    dockCrossings,
    allRequiredCapturedTick,
    firstQuotaTick,
    ticksAfterRequiredObjectives: run.tick - allRequiredCapturedTick,
    ticksAfterQuota: run.tick - firstQuotaTick,
    exposureTicks,
    postObjectiveExposureTicks,
    maxExposureTicks,
    closestActiveRoamer,
    collectedBonusIds: run.classic.powerups
      .filter((item) => item.collectedTick !== null)
      .map((item) => item.id),
    mastery: [1, 2, 3, 4].some(visited) && [6, 8].some(visited),
    connected: [...evidence.connected],
    visits: [...evidence.visits],
    used: [...evidence.used],
  };
}
