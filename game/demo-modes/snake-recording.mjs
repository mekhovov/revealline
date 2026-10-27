/** Snake demos retain the game's native replay as their authority. Diagnostics
 * locate the first changed checkpoint; they never replace full verification. */
import { boundedJSON, canonicalJSON, exactKeys } from '../data-json.mjs';
import {
  exportClassicSnakeReplay,
  restoreClassicSnakeReplay,
  classicSnakeUsesVariableHazards,
} from '../snake/classic-core.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  nextClassicSnakeMatchEventAt,
  exportClassicSnakeMatch,
  restoreClassicSnakeMatch,
} from '../snake/classic-match.mjs';

export const SNAKE_DEMO_FORMAT = 'snake-demo.v1';
export const SNAKE_DEMO_CHECKPOINT_MS = 5000;
export function snakeDemoDiagnostics() {
  let next = SNAKE_DEMO_CHECKPOINT_MS;
  const checkpoints = [];
  return {
    checkpoints,
    observe({ run }) {
      if (run.elapsedMs < next) return;
      checkpoints.push({
        tick: run.tick,
        elapsedMs: run.elapsedMs,
        checkpoint: exportClassicSnakeReplay(run).checkpoint,
      });
      next = (Math.floor(run.elapsedMs / SNAKE_DEMO_CHECKPOINT_MS) + 1) * SNAKE_DEMO_CHECKPOINT_MS;
    },
  };
}
export function snakeDemoProgress(run) {
  return {
    catches: run.catches,
    deliveries: run.operation?.parcels.filter((parcel) => parcel.state === 'delivered').length ?? 0,
    stages: run.operation?.stage ?? 0,
    relays: run.relays?.filter((relay) => relay.collected).length ?? 0,
  };
}
export function meaningfulSnakeDemoProgress(progress) {
  return Object.values(progress).some((value) => Number.isInteger(value) && value > 0);
}

/** Convert a planner's ordinary-input board journal into the ordinary Solo match. */
export function recordSnakeDemo(replay, { level }) {
  const verified = restoreClassicSnakeReplay(replay, { level });
  if (!['won', 'lost'].includes(verified.status))
    throw new Error('Snake demo must finish normally.');
  const match = createClassicSnakeMatch(level, {
    mode: 'solo',
    seed: replay.seed,
    ...(classicSnakeUsesVariableHazards(level) ? { hazardSeed: replay.hazardSeed } : {}),
  });
  const diagnostics = snakeDemoDiagnostics();
  let cursor = 0;
  while (match.status === 'running') {
    while (replay.turns[cursor]?.tick === match.runs[0].tick) {
      const turn = replay.turns[cursor++];
      if (!queueClassicSnakeMatchTurn(match, turn.playerId, turn.direction))
        throw new Error('Snake demonstration contains a rejected input.');
    }
    if (match.runs[0].tick >= replay.steps) break;
    advanceClassicSnakeMatchTo(match, nextClassicSnakeMatchEventAt(match), {
      onStep: diagnostics.observe,
    });
  }
  const run = match.runs[0],
    progress = snakeDemoProgress(run);
  if (match.status !== 'finished' || !meaningfulSnakeDemoProgress(progress))
    throw new Error('Snake demo requires a terminal performance with objective progress.');
  const result = {
    format: SNAKE_DEMO_FORMAT,
    modeId: 'snake',
    levelId: level.id,
    levelIdentity: run.levelIdentity,
    simulationIdentity: run.version,
    outcome: run.status,
    progress,
    diagnostics: diagnostics.checkpoints,
    recording: exportClassicSnakeMatch(match),
  };
  verifySnakeDemo(result, { level });
  return result;
}

export function verifySnakeDemo(source, { level } = {}) {
  const demo = boundedJSON(source, {
    maxBytes: 8 * 1024 * 1024,
    maxNodes: 600000,
    maxArray: 32768,
    maxDepth: 18,
  });
  exactKeys(
    demo,
    [
      'format',
      'modeId',
      'levelId',
      'levelIdentity',
      'simulationIdentity',
      'outcome',
      'progress',
      'diagnostics',
      'recording',
    ],
    'Snake demonstration',
  );
  if (
    demo.format !== SNAKE_DEMO_FORMAT ||
    demo.modeId !== 'snake' ||
    demo.recording?.options?.mode !== 'solo' ||
    !level ||
    demo.levelId !== level.id
  )
    throw new Error('Snake demo belongs to a different mode or level.');
  if (!Array.isArray(demo.diagnostics) || !Array.isArray(demo.recording.turns))
    throw new Error('Snake demo is missing its replay diagnostics.');
  const diagnostics = snakeDemoDiagnostics();
  const diagnosticMatch = createClassicSnakeMatch(level, demo.recording.options);
  const divergent = (tick) => {
    const error = new Error(`Snake demo first mismatching checkpoint is at tick ${tick}.`);
    error.name = 'ReplayVerificationError';
    error.diagnostics = [{ code: 'checkpoint-mismatch', tick }];
    throw error;
  };
  const onStep = (step) => {
    const before = diagnostics.checkpoints.length;
    diagnostics.observe(step);
    if (
      diagnostics.checkpoints.length !== before &&
      canonicalJSON(diagnostics.checkpoints[before]) !==
        canonicalJSON(demo.diagnostics[before] ?? null)
    )
      divergent(step.run.tick);
  };
  // Run sparse checks first so an edited input journal reports its earliest
  // divergent interval, before the native verifier rejects its final hash.
  for (const turn of demo.recording.turns) {
    exactKeys(turn, ['atMs', 'seat', 'direction'], 'Snake demonstration turn');
    if (turn.atMs > demo.recording.elapsedMs) throw new Error('Snake demo input exceeds its end.');
    advanceClassicSnakeMatchTo(diagnosticMatch, turn.atMs, { onStep });
    if (
      diagnosticMatch.elapsedMs !== turn.atMs ||
      !queueClassicSnakeMatchTurn(diagnosticMatch, turn.seat, turn.direction)
    )
      throw new Error('Snake demo contains a rejected input.');
  }
  advanceClassicSnakeMatchTo(diagnosticMatch, demo.recording.elapsedMs, { onStep });
  if (diagnostics.checkpoints.length !== demo.diagnostics.length)
    divergent(diagnosticMatch.runs[0].tick);
  // Native verification independently reproduces every move and terminal state.
  const match = restoreClassicSnakeMatch(demo.recording, { level });
  const run = match.runs[0];
  if (
    match.status !== 'finished' ||
    !['won', 'lost'].includes(run.status) ||
    run.status !== demo.outcome ||
    run.levelIdentity !== demo.levelIdentity ||
    run.version !== demo.simulationIdentity ||
    canonicalJSON(snakeDemoProgress(run)) !== canonicalJSON(demo.progress) ||
    !meaningfulSnakeDemoProgress(demo.progress)
  )
    throw new Error('Snake demo lacks a verified terminal outcome and meaningful progress.');
  return { demo, match };
}
