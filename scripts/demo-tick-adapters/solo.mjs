import { createRun, stepRun, releaseInputs, FIXED_DT } from '../../game/core/index.mjs';
import {
  snapshotReplay,
  verifyReplayAsync,
  authoritativeCheckpoint,
  MAX_REPLAY_TICKS,
} from '../../game/replay.mjs';
import { demoReplayMatchesEntry } from '../../game/demo-catalog.mjs';
import { demoTickSHA256 } from '../demo-tick-trace.mjs';

const abort = (signal) => signal?.throwIfAborted();
const terminal = (state) => ['won', 'lost'].includes(state.status);
const summary = (state) => ({
  terminalTick: state.tick,
  terminalIdentity: authoritativeCheckpoint(state).hash,
  outcome: state.status,
});
const yieldToHost = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Only offline diagnostics use the per-tick hashes. Native replay verification
 * remains independent and required before a reference can be captured. */
export async function createAdapter({ recording, entry, variantId = 'standard' } = {}) {
  const replay = snapshotReplay(recording);
  if (entry && !demoReplayMatchesEntry(replay, entry.entry ?? entry))
    throw new Error('Solo diagnostic recording does not match its authored entry.');
  const binding = Object.freeze({
    modeId: 'solo',
    levelId: replay.level.id,
    variantId,
    contentIdentity: await demoTickSHA256({
      level: replay.level,
      classRecipes: replay.options.classRecipes,
    }),
    simulationIdentity: await demoTickSHA256({
      version: replay.version,
      ruleset: replay.ruleset,
      checkpointAlgorithm: replay.checkpoint.algorithm,
    }),
    recordingIdentity: await demoTickSHA256(replay),
  });
  return {
    binding,
    maxTicks: MAX_REPLAY_TICKS,
    async verify({ signal, yieldTask = yieldToHost } = {}) {
      abort(signal);
      await yieldTask();
      abort(signal);
      const verified = await verifyReplayAsync(replay, { signal, chunkTicks: 120 });
      if (!verified.match)
        throw Object.assign(new Error('Solo native replay verification failed.'), {
          diagnostics: verified.diagnostics,
        });
      if (!terminal(verified.state)) throw new Error('Solo diagnostic replay is not terminal.');
      return summary(verified.state);
    },
    async observe({ onTick, signal, yieldTask = yieldToHost } = {}) {
      if (typeof onTick !== 'function') throw new TypeError('A native tick observer is required.');
      abort(signal);
      const run = createRun(replay.level, replay.options);
      await onTick({ tick: 0, stateIdentity: authoritativeCheckpoint(run).hash });
      for (const segment of replay.segments) {
        abort(signal);
        if (segment.releaseBefore) releaseInputs(run);
        for (let index = 0; index < segment.ticks; index++) {
          abort(signal);
          if (terminal(run)) throw new Error('Solo replay contains commands after its outcome.');
          stepRun(run, segment.input, FIXED_DT);
          // The native verifier includes final input release in the terminal
          // checkpoint. Observe that stable boundary once, at its native tick.
          if (run.tick === replay.ticks && replay.releaseAfter) releaseInputs(run);
          await onTick({ tick: run.tick, stateIdentity: authoritativeCheckpoint(run).hash });
          if (run.tick % 120 === 0) {
            await yieldTask();
            abort(signal);
          }
        }
      }
      if (!terminal(run) || run.tick !== replay.ticks)
        throw new Error('Solo diagnostic replay did not reach its complete native outcome.');
      return summary(run);
    },
  };
}
