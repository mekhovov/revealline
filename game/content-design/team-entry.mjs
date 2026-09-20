import { createTeamJourneyCandidates } from './team-journey-candidates.mjs';
import { createCandidateTeamHost } from './team-host.mjs';
import { createJourneyPreferences } from '../journey/preferences.mjs';

/** Explicit geometry-review entry only. No public enrollment, awards, progress
 * writes, artwork qualification or changes to legacy Team arena preferences. */
export function createTeamGreyboxEntry() {
  const source = createTeamJourneyCandidates();
  const preferences = createJourneyPreferences();
  const snapshot = preferences.snapshot();
  preferences.dispose();
  return Object.freeze({
    candidateJourney: createCandidateTeamHost(source, {
      corePackIds: source.packs.map((pack) => pack.id),
    }),
    candidateDifficulty: snapshot.difficulty,
    candidateNotice: snapshot.durable ? '' : snapshot.error,
  });
}
