import { createHash } from 'node:crypto';
import { createCoop, startCoop, stepCoop } from '../../coop/core.mjs';
import {
  createTeamFoundationEvidence,
  observeTeamFoundationGoal,
  inspectTeamFoundationGoal,
} from './team-foundation-goal.mjs';

/** Recorded public commands only; no state arrangements or hidden assistance.
 * Exact repeats are local simulation evidence, not an official replay format. */
export function playTeamFoundationRoute(
  level,
  segments,
  { jointCuts = true, seed = 1, swapped = false, delayTicks = 0 } = {},
) {
  const owned = structuredClone(level);
  if (swapped) owned.spawns.reverse();
  const run = startCoop(createCoop(owned, { jointCuts, seed }));
  const evidence = createTeamFoundationEvidence(),
    events = [];
  let simultaneousTicks = 0;
  observeTeamFoundationGoal(run, evidence);
  const tick = (a, b) => {
    const directions = swapped ? [b, a] : [a, b];
    for (const [seat, direction] of directions.entries())
      if (direction === null && run.players[seat].direction !== null)
        throw new Error('A recorded route cannot brake continuous steering between closures.');
    stepCoop(
      run,
      directions.map((direction) => ({ direction, boost: false, support: false })),
    );
    events.push(...structuredClone(run.events));
    observeTeamFoundationGoal(run, evidence);
    if (directions.every(Boolean) && run.players.every((p) => p.cutting)) simultaneousTicks++;
  };
  for (let i = 0; i < delayTicks && run.status === 'running'; i++) tick(null, null);
  for (const segment of segments) {
    if (!Number.isSafeInteger(segment.ticks) || segment.ticks < 1 || segment.ticks > 10000)
      throw new Error('Route segments require bounded whole fixed ticks.');
    for (let i = 0; i < segment.ticks && run.status === 'running'; i++) tick(segment.a, segment.b);
  }
  return {
    run,
    events,
    evidence,
    simultaneousTicks,
    mastery: inspectTeamFoundationGoal(run, evidence),
    checkpoint: createHash('sha256').update(JSON.stringify({ run, events })).digest('hex'),
  };
}
