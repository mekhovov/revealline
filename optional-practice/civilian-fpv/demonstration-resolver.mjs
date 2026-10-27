import { dataIdentity } from '../../game/data-json.mjs';
import { createFlight } from './model.mjs';
import { responseIdentity } from './radio-profile.mjs';
import { validateWorldCourse, worldFlightIdentity } from './world-model.mjs';

/** Cosmetic substitutions must never change the course against which a proof is admitted. */
export function demonstrationEntry(entry) {
  const course =
    entry.appearanceCourse === entry.course ? (entry.sourceCourse ?? entry.course) : entry.course;
  return {
    ...entry,
    course,
    sourceCourse: course,
    appearanceCourse: course,
    presentation: undefined,
  };
}

/** Metadata-only admission shared by Academy's examples and the attract-mode adapter.
 * This checks identities, not playback: callers must still replay the entire proof.
 * No physics world, renderer, storage, or recording body is needed here.
 */
export function resolveFlightDemonstration({
  entry,
  mode,
  worldDemonstrations = [],
  flightDemonstrations = [],
  records = [],
}) {
  if (!entry || entry.regional) return null;
  entry = demonstrationEntry(entry);
  if (entry.legacy) {
    const proof = flightDemonstrations.find(
      (item) => item.course === entry.id && item.mode === mode,
    );
    if (!proof || proof.format !== 'FlightAttempt.v1' || proof.session !== 'demonstration')
      return null;
    try {
      const { identity } = createFlight({ course: entry.course, mode, response: proof.response });
      return Object.entries(identity).every(([key, value]) => proof[key] === value) ? proof : null;
    } catch {
      return null;
    }
  }
  const source = validateWorldCourse(entry.course),
    sourceIdentity = dataIdentity(source);
  const matchesRuntime = (proof) => {
    try {
      return (
        proof?.format ===
          (source.format === 'FlightCourse.v3' ? 'FlightAttempt.v3' : 'FlightAttempt.v2') &&
        proof.session === 'demonstration' &&
        proof.responseIdentity === responseIdentity(proof.response) &&
        Object.entries(
          worldFlightIdentity({ course: source, mode, response: proof.response }),
        ).every(([key, value]) => proof[key] === value)
      );
    } catch {
      return false;
    }
  };
  let candidate =
    !entry.projectId &&
    worldDemonstrations.find(
      (item) =>
        item.proof.course === entry.id &&
        item.proof.mode === mode &&
        item.sourceIdentity === sourceIdentity,
    );
  if (!candidate && (!entry.projectId || /^fpv-pack:[a-f0-9]{64}$/.test(entry.packIdentity))) {
    const saved = records.find((record) => {
      if (
        record.status !== 'verified' ||
        record.diagnostic !== 'complete' ||
        record.packIdentity !== entry.packIdentity ||
        record.proof.course !== entry.id ||
        record.proof.mode !== mode ||
        record.proof.session !== 'demonstration'
      )
        return false;
      try {
        return (
          dataIdentity(validateWorldCourse(record.course)) === sourceIdentity &&
          matchesRuntime(record.proof)
        );
      } catch {
        return false;
      }
    });
    if (saved) candidate = { sourceIdentity, proof: saved.proof };
  }
  return matchesRuntime(candidate?.proof) && candidate.sourceIdentity === sourceIdentity
    ? candidate.proof
    : null;
}
