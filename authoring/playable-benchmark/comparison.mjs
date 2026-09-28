import { acquireScoutComparison } from './candidate-appearance.mjs';
import { createBenchmarkSelection } from './session.mjs';

export const COMPARISON_BODIES = Object.freeze([
  'approved',
  'v3-auto',
  'v3-compact',
  'v3-detailed',
]);

/** Own only a second-view image override. It cannot replace the core run,
 * original artwork or approved appearance lease. */
export function createSceneComparison({
  actors,
  session,
  acquire = acquireScoutComparison,
  onStatus = () => {},
}) {
  let reduced = true;
  let feedback = Object.freeze({ captureAccent: true, eventAccents: true });
  let disposed = false;
  const selection = createBenchmarkSelection({
    async prepare(body, { signal }) {
      if (!COMPARISON_BODIES.includes(body)) throw new Error('Unknown comparison appearance.');
      if (body === 'approved')
        return { body, snapshot: actors.snapshot, provenance: null, dispose() {} };
      const candidate = await acquire(actors.snapshot, { signal, treatment: body.slice(3) });
      return {
        body,
        snapshot: candidate.snapshot,
        provenance: candidate.provenance,
        dispose: candidate.release,
      };
    },
    onStatus(kind, message) {
      onStatus(
        kind,
        kind === 'loading'
          ? 'Checking candidate files. The accepted comparison stays visible and the run is paused.'
          : kind === 'ready'
            ? 'Comparison ready. Resume when ready.'
            : message.replace('this mission', 'this comparison'),
      );
    },
  });
  return {
    get body() {
      return selection.current?.body ?? 'approved';
    },
    get pending() {
      return selection.pending;
    },
    get snapshot() {
      return selection.current?.snapshot ?? actors.snapshot;
    },
    get provenance() {
      return selection.current?.provenance ?? null;
    },
    get reduced() {
      return reduced;
    },
    get feedback() {
      return feedback;
    },
    select(body) {
      if (disposed) return Promise.resolve(false);
      session.pause();
      return selection.select(body);
    },
    setReduced(value) {
      if (disposed) return;
      session.pause();
      reduced = !!value;
    },
    setFeedback(value) {
      if (disposed) return;
      session.pause();
      feedback = Object.freeze({
        captureAccent: !!value.captureAccent,
        eventAccents: !!value.eventAccents,
      });
    },
    cancel: () => selection.cancel(),
    dispose() {
      if (disposed) return;
      disposed = true;
      selection.dispose();
    },
  };
}
