import { createRun, stepRun, FIXED_DT } from './core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from './replay.mjs';
import { prepareReplayPlayer } from './replay-player.mjs';
import { planImprovMacro } from './demo-bot.mjs';

const MAX_TICKS = 120 * 45;
const abort = (signal) => {
  if (signal?.aborted) throw new DOMException('Improvised demo cancelled.', 'AbortError');
};

/** Build one bounded, replay-verifiable performance through the ordinary core.
 * It is a fallback for installed levels without a reviewed recording or
 * qualified live planner. Routes approach through safe ground and attempt
 * actual closures. A real hazard may catch an occasional ambitious cut;
 * no scripted suicide, reward or persistence adapter is available here. */
export async function prepareImprovPlayer(level, options = {}, { signal, performanceSeed } = {}) {
  abort(signal);
  const seed = Number.isInteger(performanceSeed) ? performanceSeed >>> 0 : options.seed >>> 0,
    run = createRun(level, options),
    recorder = createRecorder(level, options, 'revealline-improvised-demo.v2');
  let yielded = 0,
    captures = 0,
    losses = 0;
  async function input(command = {}, ticks = 1, until = null) {
    for (let index = 0; index < ticks && run.tick < MAX_TICKS; index++) {
      if (['won', 'lost'].includes(run.status) || until?.()) break;
      stepRun(run, command, FIXED_DT);
      recordInput(recorder, command);
      captures += run.events.filter((event) => event.type === 'cut.closed').length;
      losses += run.events.filter((event) => event.type === 'player.failed').length;
      if (++yielded >= 240) {
        yielded = 0;
        await new Promise((resolve) => setTimeout(resolve, 0));
        abort(signal);
      }
    }
  }
  for (let decision = 0; decision < 6 && run.tick < MAX_TICKS; decision++) {
    if (['won', 'lost'].includes(run.status)) break;
    const macro = await planImprovMacro(run, {
      plannerSeed: seed,
      decision,
      // Establish competence first, then allow at most one overreach. After
      // losing a life every subsequent route must be a validated recovery.
      allowRisk: captures > 0 && losses === 0,
      signal,
    });
    // End at a decision boundary rather than cutting a planned maneuver off
    // mid-trail just because the presentation's time allowance expired.
    if (!macro || run.tick + macro.ticks > MAX_TICKS) break;
    for (const segment of macro.segments) await input(segment.input, segment.ticks);
    if (run.status === 'respawning') await input({}, 600, () => run.status !== 'respawning');
  }
  abort(signal);
  if (!captures) throw new Error('No purposeful capture performance is available for this level.');
  const replay = exportReplay(recorder, run),
    verified = verifyReplay(replay);
  if (!verified.match) throw new Error('Improvised demo did not reproduce its real simulation.');
  return prepareReplayPlayer(replay, { signal });
}
