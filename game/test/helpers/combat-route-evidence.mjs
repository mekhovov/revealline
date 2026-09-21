import { createRun, stepRun, FIXED_DT } from '../../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../../replay.mjs';

/** Offline observations from public inputs, not predicates added to game rules. */
export function playCombatRoute(level, row, { verify = true } = {}) {
  const options = { seed: row.seed, turnPolicy: row.turnPolicy, classId: 'scout' };
  const run = createRun(level, options),
    recorder = createRecorder(level, options);
  const events = [];
  let liveShotExposureTicks = 0,
    cuts = 0;
  for (const { direction, ticks } of row.segments)
    for (let n = 0; n < ticks; n++) {
      if (['won', 'lost'].includes(run.status)) break;
      const command = { direction };
      recordInput(recorder, command);
      stepRun(run, command, FIXED_DT);
      if (run.player.cutting && run.classic.combatPatrols?.projectiles.length)
        liveShotExposureTicks++;
      if (run.events.some((e) => e.type === 'cut.closed')) cuts++;
      events.push(...run.events.filter((e) => e.type.startsWith('combat.')));
    }
  const observations = {
    status: run.status,
    ticks: run.tick,
    losses: run.classic.livesLost,
    cuts,
    coverage: run.coverage,
    liveShotExposureTicks,
    locks: events.filter((e) => e.type === 'combat.locked').length,
    shots: events.filter((e) => e.type === 'combat.fired').length,
    impacts: events.filter((e) => e.type === 'combat.impact').length,
    removals: events
      .filter((e) => e.type === 'combat.eliminated')
      .map(({ id, cause, tick }) => ({ id, cause, tick })),
    checkpoint: authoritativeCheckpoint(run).hash,
  };
  if (verify && !verifyReplay(exportReplay(recorder, run)).match)
    throw new Error('Combat candidate replay differs');
  return { run, observations };
}
