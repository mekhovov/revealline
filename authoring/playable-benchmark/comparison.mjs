import { acquireActorComparison } from './candidate-appearance.mjs';
import { createBenchmarkSelection } from './session.mjs';

const choices = Object.freeze(
  Object.fromEntries(
    [
      ['v3', 'reference-v3'],
      ['v4', 'reference-v4'],
      ['v5', 'reference-v5'],
      ['v6', 'reference-v6'],
    ].flatMap(([prefix, construction]) =>
      ['auto', 'compact', 'detailed'].map((treatment) => [
        `${prefix}-${treatment}`,
        Object.freeze({ construction, treatment }),
      ]),
    ),
  ),
);
export const COMPARISON_BODIES = Object.freeze(['approved', ...Object.keys(choices)]);

/** Own only a second-view image override. It cannot replace the core run,
 * original artwork or approved appearance lease. */
export function createSceneComparison({
  actors,
  session,
  acquire = acquireActorComparison,
  onStatus = () => {},
}) {
  let reduced = true;
  let feedback = Object.freeze({
    captureAccent: true,
    eventAccents: true,
    contactStyle: 'standard',
  });
  let disposed = false;
  const selection = createBenchmarkSelection({
    async prepare(body, { signal }) {
      if (!COMPARISON_BODIES.includes(body)) throw new Error('Unknown comparison appearance.');
      if (body === 'approved')
        return { body, snapshot: actors.snapshot, provenance: null, dispose() {} };
      const classId = session.setup?.classId ?? 'scout';
      if (classId !== 'scout' && choices[body].construction !== 'reference-v6')
        throw new Error(
          'Earlier body studies support Scout only. Choose the V6 roster for this craft.',
        );
      const candidate = await acquire(actors.snapshot, { signal, classId, ...choices[body] });
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
        contactStyle: value.contactStyle === 'fine-outline' ? 'fine-outline' : 'standard',
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
