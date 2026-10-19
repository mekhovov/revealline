/** Offline per-tick diagnosis; never mounted by the game's demo host. */
import { survivalDemoInventory } from '../../game/demo-modes/survival-catalog.mjs';
import {
  createSurvivalDemoReplay,
  survivalDemoStateIdentity,
  verifySurvivalDemo,
  SURVIVAL_DEMO_MAX_TICKS,
} from '../../game/demo-modes/survival-replay.mjs';
import { demoTickSHA256 } from '../demo-tick-trace.mjs';

const cancelled = (signal) => {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Cancelled', 'AbortError');
};
const yieldToTask = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function createAdapter({ recording, entry, variantId = 'standard' } = {}) {
  const required = survivalDemoInventory().find(
    (candidate) => candidate.levelId === (entry?.levelId ?? recording?.levelId),
  );
  if (
    !required ||
    variantId !== required.variantId ||
    (entry?.variantId && entry.variantId !== variantId)
  )
    throw new TypeError('Survival tick diagnosis requires an authored standard mission.');
  // Native decoding owns the bounded copy and validates the exact content/setup.
  // Runs are plain local state: no renderer, worker, listener or physics world.
  const { proof } = createSurvivalDemoReplay(required, recording);
  const binding = Object.freeze({
    modeId: 'survival',
    levelId: required.levelId,
    variantId,
    contentIdentity: proof.contentIdentity,
    simulationIdentity: proof.simulationIdentity,
    recordingIdentity: await demoTickSHA256(proof),
  });
  const terminalResult = () => ({
    terminalTick: proof.ticks,
    terminalIdentity: proof.finalState,
    outcome: proof.outcome,
  });
  return Object.freeze({
    binding,
    maxTicks: SURVIVAL_DEMO_MAX_TICKS,
    async verify({ signal, yieldTask = yieldToTask } = {}) {
      await verifySurvivalDemo(required, proof, { signal, yieldTask });
      return terminalResult();
    },
    async observe({ onTick, signal, yieldTask = yieldToTask } = {}) {
      if (typeof onTick !== 'function') throw new TypeError('A tick observer is required.');
      cancelled(signal);
      const replay = createSurvivalDemoReplay(required, proof);
      let lastObserved = -1;
      const publish = async () => {
        cancelled(signal);
        if (replay.run.tick !== lastObserved + 1)
          throw new Error('Survival diagnostic replay skipped a native tick.');
        await onTick({
          tick: replay.run.tick,
          stateIdentity: survivalDemoStateIdentity(replay.run),
        });
        lastObserved = replay.run.tick;
        cancelled(signal);
      };
      await publish();
      while (replay.run.tick < proof.ticks) {
        cancelled(signal);
        let failure;
        try {
          replay.step();
        } catch (error) {
          failure = error;
        }
        // A sparse checkpoint may reject the newly advanced tick. Publish its
        // actual state first so the exact comparator can diagnose that boundary.
        if (replay.run.tick === lastObserved + 1) await publish();
        else if (!failure) throw new Error('Survival diagnostic replay did not advance.');
        if (failure) throw failure;
        if (replay.run.tick % 240 === 0) {
          await yieldTask();
          cancelled(signal);
        }
      }
      replay.finish();
      return terminalResult();
    },
  });
}
