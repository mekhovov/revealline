import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, CELL } from '../../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../../replay.mjs';
import { createApexGoalEvidence, observeApexGoal, inspectApexGoal } from './apex-goal.mjs';

/** Observes ordinary public inputs only. Local evidence is not a human playtest. */
export function playApexSpatialRoute(manifest, row, { race = false } = {}) {
  const options = { seed: row.seed ?? 1, classId: 'scout', turnPolicy: row.turnPolicy };
  const run = createRun(manifest.level, options);
  const recorder = createRecorder(manifest.level, options);
  const match = race
    ? createDuel(manifest.level, options, { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 })
    : null;
  if (match) {
    assert.notEqual(match.runs[0].cells, match.runs[1].cells);
    assert.notEqual(match.runs[0].encounter, match.runs[1].encounter);
    resumeDuel(match);
  }
  const evidence = createApexGoalEvidence();
  const closures = [],
    cutStarts = [],
    dockCrossings = [],
    stages = [],
    shields = [],
    roverEvents = [];
  let closestActiveRoamer = null;
  let firstQuotaTick = null,
    exposureTicks = 0,
    maxExposureTicks = 0,
    currentExposure = 0;
  const denominator = run.totalClaimable;
  for (const { direction, ticks } of row.segments) {
    assert([null, 'left', 'right', 'up', 'down'].includes(direction));
    assert(Number.isSafeInteger(ticks) && ticks > 0);
    for (let tick = 0; tick < ticks; tick++) {
      assert.equal(run.status, 'running');
      if (direction === null) assert.equal(run.player.speed, 0, 'No artificial neutral braking');
      const wasCutting = run.player.cutting;
      const beforeX = run.player.x;
      const dock = run.relay.gates.find((gate) => gate.id === 'home-dock');
      const inDock = () =>
        dock?.openedTick !== null &&
        dock?.cells.includes(Math.floor(run.player.y) * run.width + Math.floor(run.player.x));
      const wasInDock = inDock();
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      if (wasInDock !== inDock())
        dockCrossings.push({
          tick: run.tick,
          action: inDock() ? 'enter' : 'exit',
          fromX: beforeX,
          toX: run.player.x,
        });
      if (match) stepDuel(match, [{ direction }, { direction }]);
      observeApexGoal(run, evidence);
      const roamer = run.enemies.find((enemy) => enemy.id === 'roamer');
      if (roamer?.classic?.mode === 'active') {
        const distance = Math.hypot(roamer.x - run.player.x, roamer.y - run.player.y);
        if (!closestActiveRoamer || distance < closestActiveRoamer.distance)
          closestActiveRoamer = { tick: run.tick, distance, cutting: run.player.cutting };
      }
      assert.equal(run.classic.livesLost, 0);
      assert.equal(run.totalClaimable, denominator);
      if (wasCutting || run.player.cutting) {
        exposureTicks++;
        currentExposure++;
        maxExposureTicks = Math.max(maxExposureTicks, currentExposure);
      }
      if (!run.player.cutting) currentExposure = 0;
      if (run.coverage >= manifest.level.goal.coverage) firstQuotaTick ??= run.tick;
      for (const event of run.events) {
        if (event.type === 'rover.warning' || event.type === 'rover.activated')
          roverEvents.push([run.tick, event.type, event.id]);
        if (event.type === 'cut.closed') closures.push([run.tick, run.coverage]);
        if (event.type === 'cut.started') cutStarts.push(run.tick);
        if (event.type === 'objective.captured' && event.id !== 'core')
          shields.push([run.tick, event.id]);
        if (event.type === 'encounter.stageChanged')
          stages.push({
            tick: run.tick,
            stage: event.stage,
            fieldCells: run.cells.reduce((sum, cell) => sum + Number(cell === CELL.FIELD), 0),
          });
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
  return {
    ticks: run.tick,
    seconds: run.time,
    lives: run.lives,
    checkpoint: authoritativeCheckpoint(run).hash,
    totalClaimable: denominator,
    closures,
    cutStarts,
    dockCrossings,
    shields,
    stages,
    roverEvents,
    closestActiveRoamer,
    firstQuotaTick,
    ticksAfterQuota: run.tick - firstQuotaTick,
    exposureTicks,
    maxExposureTicks,
    release: { cause: run.encounter.defeatCause, cutCells: run.encounter.qualifyingCutCells },
    collectedBonusIds: run.classic.powerups
      .filter((item) => item.collectedTick !== null)
      .map((item) => item.id),
    goal: inspectApexGoal({ missionId: 'home-signal', run, evidence }),
  };
}
