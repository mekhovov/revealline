import { CLASSIC_SNAKE_LEVELS } from '../../game/snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../../game/snake/classic-setup.mjs';
import { exportClassicSnakeReplay } from '../../game/snake/classic-core.mjs';
import {
  createClassicSnakeMatch,
  advanceClassicSnakeMatchTo,
  nextClassicSnakeMatchEventAt,
  queueClassicSnakeMatchTurn,
} from '../../game/snake/classic-match.mjs';
import { verifySnakeDemo } from '../../game/demo-modes/snake-recording.mjs';
import { DEMO_TICK_LIMIT, demoTickSHA256 } from '../demo-tick-trace.mjs';

const abort = (signal) => {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Cancelled', 'AbortError');
};
const yieldDefault = () => new Promise((resolve) => setTimeout(resolve, 0));
const terminal = (match) => {
  const run = match.runs[0];
  if (match.status !== 'finished' || !['won', 'lost'].includes(run.status))
    throw new Error('Snake tick observation did not reach a native terminal outcome.');
  return {
    terminalTick: run.tick,
    terminalIdentity: exportClassicSnakeReplay(run).checkpoint,
    outcome: run.status,
  };
};

/** Offline exact diagnostics. Observation never substitutes for replay admission. */
export async function createAdapter({ recording, entry, variantId = 'standard' }) {
  const demo = structuredClone(recording);
  if (variantId !== 'standard' || demo?.modeId !== 'snake')
    throw new TypeError('Snake tick diagnostics require a standard Snake demonstration.');
  const selected =
    entry?.entry ?? entry ?? CLASSIC_SNAKE_LEVELS.find((row) => row.id === demo.levelId);
  if (!selected || selected.id !== demo.levelId)
    throw new Error('Snake tick diagnostics need the exact authored level.');
  const level = prepareClassicSnakeLevel(selected);
  const native = demo.recording;
  const expectedSteps = native?.replays?.[0]?.steps;
  const maxTicks = DEMO_TICK_LIMIT;
  if (
    native?.options?.mode !== 'solo' ||
    !Array.isArray(native.turns) ||
    !Number.isSafeInteger(expectedSteps) ||
    expectedSteps < 1 ||
    expectedSteps > maxTicks ||
    !Number.isFinite(native.elapsedMs) ||
    native.elapsedMs < 0
  )
    throw new TypeError('Snake tick diagnostics need a bounded native Solo match.');
  const initial = createClassicSnakeMatch(level, native.options).runs[0];
  const binding = Object.freeze({
    modeId: 'snake',
    levelId: demo.levelId,
    variantId,
    contentIdentity: initial.levelIdentity,
    simulationIdentity: initial.version,
    recordingIdentity: await demoTickSHA256(demo),
  });
  return {
    binding,
    maxTicks,
    async verify({ signal, yieldTask = yieldDefault } = {}) {
      abort(signal);
      await yieldTask();
      abort(signal);
      const { match } = verifySnakeDemo(demo, { level });
      abort(signal);
      return terminal(match);
    },
    async observe({ onTick, signal, yieldTask = yieldDefault } = {}) {
      if (typeof onTick !== 'function') throw new TypeError('Snake tick observation needs onTick.');
      abort(signal);
      const match = createClassicSnakeMatch(level, native.options);
      let nextTick = 0;
      const emit = async (row) => {
        abort(signal);
        if (row.tick !== nextTick || row.tick > maxTicks)
          throw new Error('Snake observation must contain every native move exactly once.');
        nextTick++;
        await onTick(row);
        abort(signal);
        await yieldTask();
        abort(signal);
      };
      const row = (run) => ({
        tick: run.tick,
        stateIdentity: exportClassicSnakeReplay(run).checkpoint,
      });
      // Tick zero is the newly constructed native state, before the input journal.
      await emit(row(match.runs[0]));
      const advance = async (time) => {
        if (!Number.isFinite(time) || time < match.elapsedMs || time > native.elapsedMs)
          throw new Error('Snake observation contains an invalid input time.');
        while (nextClassicSnakeMatchEventAt(match) <= time) {
          abort(signal);
          const observed = [];
          // The native callback is synchronous. Advancing one scheduled event
          // lets the asynchronous observer finish before the next native move.
          advanceClassicSnakeMatchTo(match, nextClassicSnakeMatchEventAt(match), {
            onStep: ({ run }) => observed.push(row(run)),
          });
          if (observed.length !== 1)
            throw new Error('Snake Solo observation requires one board move per event.');
          await emit(observed[0]);
        }
        if (match.status === 'running') advanceClassicSnakeMatchTo(match, time);
      };
      for (const turn of native.turns) {
        await advance(turn.atMs);
        abort(signal);
        if (
          match.elapsedMs !== turn.atMs ||
          !queueClassicSnakeMatchTurn(match, turn.seat, turn.direction)
        )
          throw new Error('Snake observation contains a late or rejected native input.');
      }
      await advance(native.elapsedMs);
      abort(signal);
      return terminal(match);
    },
  };
}
