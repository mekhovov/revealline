import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT } from '../../core/index.mjs';
import { classicEffectActive } from '../../core/classic-state.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../../replay.mjs';

/** Offline public-input observations, not predicates added to game rules. */
export function playTimedTakingRoute(level, row, { replay = true, onStep = null } = {}) {
  assert(Array.isArray(row.segments) && row.segments.length > 0 && row.segments.length <= 512);
  let budget = 0;
  for (const { direction, ticks } of row.segments) {
    assert([null, 'left', 'right', 'up', 'down'].includes(direction));
    assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 12000);
    budget += ticks;
  }
  assert(budget <= 36000, 'A route is bounded to five minutes.');
  const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
  const run = createRun(level, options),
    recorder = createRecorder(level, options);
  const definition = level.classic.timedBonuses.schedules[0];
  const events = [],
    collections = [],
    closures = [],
    activeTicks = {};
  let stationaryTicks = 0;
  for (const { direction, ticks } of row.segments)
    for (let n = 0; n < ticks; n++) {
      assert.equal(run.status, 'running', 'Route cannot continue after its clear.');
      const before = { x: run.player.x, y: run.player.y };
      const command = { direction };
      recordInput(recorder, command);
      stepRun(run, command, FIXED_DT);
      assert.equal(run.classic.livesLost, 0, 'Extra life cannot hide a route failure.');
      if (run.player.x === before.x && run.player.y === before.y) stationaryTicks++;
      for (const kind of ['player-speed', 'enemy-slow', 'enemy-freeze'])
        if (classicEffectActive(run, kind)) activeTicks[kind] = (activeTicks[kind] ?? 0) + 1;
      for (const event of run.events) {
        if (event.type.startsWith('bonus.') || event.type === 'powerup.collected')
          events.push({ ...event });
        if (event.type === 'powerup.collected') collections.push({ ...event });
        if (event.type === 'cut.closed') closures.push([run.tick, run.coverage]);
      }
      onStep?.(run, recorder, command);
    }
  const schedule = run.classic.timedBonuses.schedules[0];
  const timedCollections = collections.filter((event) => event.id === definition.id);
  assert.equal(run.status, 'won');
  assert.equal(schedule.collections, 1);
  assert.equal(schedule.phase, 'exhausted');
  assert.equal(timedCollections.length, 1, 'Collect the timed item, not only a fixed pickup.');
  const collected = timedCollections[0];
  const appeared = events
    .filter((event) => event.type === 'bonus.appeared' && event.tick <= collected.tick)
    .at(-1);
  assert(appeared);
  assert.equal(collected.x, appeared.x);
  assert.equal(collected.y, appeared.y);
  assert(
    collected.tick >= appeared.tick && collected.tick < appeared.tick + definition.availableTicks,
  );
  if (definition.kind === 'extra-life') assert.equal(collected.gain, 1);
  else
    assert(activeTicks[definition.kind] > 0, 'The collected effect becomes active before clear.');
  assert.equal(
    run.lives,
    level.rules.lives + collections.reduce((n, event) => n + (event.gain ?? 0), 0),
  );
  if (replay) {
    const verification = verifyReplay(exportReplay(recorder, run));
    assert.equal(verification.match, true);
    assert.equal(verification.state.status, 'won');
  }
  return {
    run,
    recorder,
    observations: {
      ticks: run.tick,
      lives: run.lives,
      losses: run.classic.livesLost,
      coverage: run.coverage,
      stationaryTicks,
      activeTicks,
      appearances: schedule.appearances,
      collectedAnchor: { x: collected.x, y: collected.y },
      collectionTick: collected.tick,
      collectionWindowTicks: collected.tick - appeared.tick,
      postCollectionTicks: run.tick - collected.tick,
      closures,
      events,
      checkpoint: authoritativeCheckpoint(run).hash,
    },
  };
}
