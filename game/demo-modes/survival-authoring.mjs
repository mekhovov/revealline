/** Offline authoring only: play ordinary legal controls through a complete native run. */
import { survivalDemoCompiled, SURVIVAL_DEMO_OPTIONS } from './survival-catalog.mjs';
import { SURVIVAL_DEMO_SIMULATION_IDENTITY } from './survival-simulation-identity.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  chooseOverflightUpgrade,
  overflightSummary,
} from '../overflight/core.mjs';
import { pilot, selectCard } from '../overflight/review-pilot.mjs';
import {
  SURVIVAL_DEMO_FORMAT,
  SURVIVAL_DEMO_MAX_TICKS,
  SURVIVAL_DEMO_CHECKPOINT_TICKS,
  survivalDemoStateIdentity,
  survivalDemoProgress,
} from './survival-replay.mjs';

export async function authorSurvivalDemo(
  entry,
  {
    signal,
    yieldEvery = 240,
    yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0)),
  } = {},
) {
  const compiled = survivalDemoCompiled(entry);
  const run = createOverflightRun(compiled, SURVIVAL_DEMO_OPTIONS);
  const proof = {
    format: SURVIVAL_DEMO_FORMAT,
    levelId: entry.levelId,
    simulationIdentity: SURVIVAL_DEMO_SIMULATION_IDENTITY,
    contentIdentity: compiled.projectIdentity,
    options: SURVIVAL_DEMO_OPTIONS,
    inputs: [],
    choices: [],
    checkpoints: [],
  };
  startOverflight(run);
  let input = {};
  while (['playing', 'upgrade'].includes(run.phase) && run.tick < SURVIVAL_DEMO_MAX_TICKS) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('Cancelled', 'AbortError');
    if (run.tick > 0 && run.tick % yieldEvery === 0) await yieldTask();
    if (run.phase === 'upgrade') {
      const before = run.stats.rerollsUsed;
      const card = selectCard(run, 'fan');
      if (!card || !chooseOverflightUpgrade(run, card.id))
        throw new Error(`No legal upgrade in ${entry.levelId} at ${run.tick}.`);
      proof.choices.push([run.tick, card.id, run.stats.rerollsUsed - before]);
      continue;
    }
    if (run.tick % 6 === 0) {
      input = pilot(run, 'tight');
      proof.inputs.push([run.tick, input.x ?? 0, input.y ?? 0, input.boost === true]);
    }
    stepOverflight(run, input);
    if (run.tick % SURVIVAL_DEMO_CHECKPOINT_TICKS === 0)
      proof.checkpoints.push([run.tick, survivalDemoStateIdentity(run)]);
  }
  if (!['won', 'lost'].includes(run.phase) || !survivalDemoProgress(run))
    throw new Error(`No meaningful terminal performance for ${entry.levelId}; nothing published.`);
  Object.assign(proof, {
    ticks: run.tick,
    outcome: run.phase,
    summary: overflightSummary(run),
    finalState: survivalDemoStateIdentity(run),
  });
  return proof;
}
