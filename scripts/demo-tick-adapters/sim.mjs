/** Offline SIM observation uses native worlds; it has no renderer or persistence. */
import { boundedJSON, dataIdentity } from '../../game/data-json.mjs';
import { demoTickSHA256 } from '../demo-tick-trace.mjs';
import { simDemoInventory } from '../../optional-practice/civilian-fpv/demo-inventory.mjs';
import { decodeSimDemoPayload } from '../../optional-practice/civilian-fpv/demo-payload.mjs';
import { verifySimDemo } from '../../optional-practice/civilian-fpv/demo-player.mjs';
import { resolveFlightDemonstration } from '../../optional-practice/civilian-fpv/demonstration-resolver.mjs';
import { createFlight, MAX_FLIGHT_TICKS } from '../../optional-practice/civilian-fpv/model.mjs';
import {
  createWorldFlight,
  initWorldRuntime,
  validateWorldCourse,
  worldStateIdentity,
  WORLD_MAX_TICKS,
} from '../../optional-practice/civilian-fpv/world-model.mjs';

const axes = ['roll', 'pitch', 'yaw', 'throttle', 'actions'];
const yieldDefault = () => new Promise((resolve) => setTimeout(resolve, 0));
const identity = (entry, state) => (entry.legacy ? dataIdentity(state) : worldStateIdentity(state));
const summary = (entry, state) => ({
  terminalTick: state.ticks,
  terminalIdentity: identity(entry, state),
  outcome: state.status,
});

export async function createAdapter({
  modeId = 'sim',
  recording,
  entry: requestedEntry,
  variantId,
} = {}) {
  if (modeId !== 'sim') throw new TypeError('SIM tick adapter requires modeId sim.');
  const payload = boundedJSON(recording, {
    maxBytes: 4 * 1024 * 1024,
    maxString: 2 * 1024 * 1024,
    maxArray: 400,
    maxNodes: 12000,
    maxDepth: 16,
  });
  const proof = decodeSimDemoPayload(payload);
  if (variantId !== undefined && variantId !== proof.mode)
    throw new TypeError('SIM trace variant differs from its recorded flight mode.');
  const admits = (entry) =>
    resolveFlightDemonstration({
      entry,
      mode: proof.mode,
      worldDemonstrations: [
        {
          sourceIdentity: dataIdentity(
            entry.legacy ? entry.course : validateWorldCourse(entry.course),
          ),
          proof,
        },
      ],
      flightDemonstrations: [proof],
    });
  const supplied = requestedEntry?.entry ?? requestedEntry;
  const candidates = supplied
    ? [supplied].filter(admits)
    : simDemoInventory()
        .filter((item) => item.levelId === proof.course && item.variantId === proof.mode)
        .map((item) => item.entry)
        .filter(admits);
  if (candidates.length !== 1)
    throw new TypeError(
      'SIM trace needs one exact authored course matching the native proof; provide entry for an ambiguous revision.',
    );
  const entry = boundedJSON(candidates[0], {
    maxBytes: 1024 * 1024,
    maxArray: 2000,
    maxNodes: 40000,
    maxDepth: 24,
  });
  const simulation = Object.fromEntries(
    [
      'format',
      'model',
      'backend',
      'worldIdentity',
      'rulesIdentity',
      'conditionsIdentity',
      'responseIdentity',
      'comparisonIdentity',
    ]
      .filter((key) => Object.hasOwn(proof, key))
      .map((key) => [key, proof[key]]),
  );
  const binding = Object.freeze({
    modeId: 'sim',
    levelId: entry.id,
    variantId: proof.mode,
    contentIdentity: await demoTickSHA256(
      entry.legacy ? entry.course : validateWorldCourse(entry.course),
    ),
    simulationIdentity: await demoTickSHA256(simulation),
    recordingIdentity: await demoTickSHA256(payload),
  });
  return {
    binding,
    maxTicks: entry.legacy ? MAX_FLIGHT_TICKS : WORLD_MAX_TICKS,
    async verify({ signal, yieldTask = yieldDefault } = {}) {
      const result = await verifySimDemo(entry, payload, { signal, yieldControl: yieldTask });
      return summary(entry, result.state);
    },
    async observe({ onTick, signal, yieldTask = yieldDefault } = {}) {
      signal?.throwIfAborted();
      if (!entry.legacy) await initWorldRuntime();
      signal?.throwIfAborted();
      const flight = (entry.legacy ? createFlight : createWorldFlight)({
        course: entry.course,
        mode: proof.mode,
        response: proof.response,
      });
      try {
        flight.arm();
        let state = flight.snapshot();
        await onTick({ tick: state.ticks, stateIdentity: identity(entry, state) });
        for (let index = 0; index < proof.frames.length; index++) {
          signal?.throwIfAborted();
          if (index % 200 === 0) {
            await yieldTask();
            signal?.throwIfAborted();
          }
          if (state.status !== 'active')
            throw new Error('SIM trace continues beyond a native terminal state.');
          state = flight.step(
            Object.fromEntries(proof.frames[index].map((value, axis) => [axes[axis], value])),
            { quantized: true },
          );
          if (state.ticks !== index + 1)
            throw new Error('SIM trace did not advance one native tick.');
          await onTick({ tick: state.ticks, stateIdentity: identity(entry, state) });
        }
        signal?.throwIfAborted();
        return summary(entry, state);
      } finally {
        await flight.dispose?.();
      }
    },
  };
}
