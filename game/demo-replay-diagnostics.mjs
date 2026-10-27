import { boundedJSON } from './data-json.mjs';
import { createRun, stepRun, releaseInputs, FIXED_DT } from './core/index.mjs';
import { authoritativeCheckpoint } from './replay.mjs';
import { demoInputTraceIdentity } from './demo-catalog.mjs';

/** Supplemental diagnosis only. This cannot authorize a replay, replace its
 * checkpoint, or weaken the native full-state verifier. Old recordings need no sidecar. */
export async function diagnoseDemoReplay(replay, source, { signal } = {}) {
  const diagnostics = boundedJSON(source, { maxBytes: 256 * 1024, maxArray: 360, maxNodes: 16000 });
  if (
    diagnostics.format !== 'SoloDemoDiagnosticsV1' ||
    diagnostics.inputTraceIdentity !== demoInputTraceIdentity(replay) ||
    !Array.isArray(diagnostics.checkpoints) ||
    diagnostics.checkpoints.length !== Math.floor(replay.ticks / 600)
  )
    throw new TypeError('Diagnostic checkpoints do not belong to this Solo recording.');
  diagnostics.checkpoints.forEach((checkpoint, index) => {
    if (checkpoint.tick !== (index + 1) * 600 || !/^[a-f0-9]{16}$/.test(checkpoint.hash))
      throw new TypeError('Invalid Solo diagnostic checkpoint.');
  });
  const checkAbort = () => {
    if (signal?.aborted) throw signal.reason ?? new DOMException('Cancelled', 'AbortError');
  };
  checkAbort();
  const run = createRun(replay.level, replay.options);
  let next = 0;
  for (const segment of replay.segments) {
    if (segment.releaseBefore) releaseInputs(run);
    for (let tick = 0; tick < segment.ticks; tick++) {
      checkAbort();
      stepRun(run, segment.input, FIXED_DT);
      if (run.tick !== diagnostics.checkpoints[next]?.tick) continue;
      const expected = diagnostics.checkpoints[next++];
      const actual = authoritativeCheckpoint(run);
      if (actual.hash !== expected.hash)
        return {
          code: 'diagnostic-checkpoint-mismatch',
          firstMismatchingCheckpointTick: run.tick,
          expected: expected.hash,
          actual: actual.hash,
        };
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  checkAbort();
  return null;
}
