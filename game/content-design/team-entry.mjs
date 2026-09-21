import { createTeamJourneyCandidates } from './team-journey-candidates.mjs';
import { createCandidateTeamHost } from './team-host.mjs';
import { createJourneyPreferences } from '../journey/preferences.mjs';
import { createTeamJourneyProgress } from './team-progress.mjs';

/** Explicit geometry-review entry only. No public enrollment, official awards,
 * artwork qualification or changes to legacy Team arena preferences.
 * Loading reads the shared progress store; only admitted play records events. */
export async function createTeamGreyboxEntry() {
  const source = createTeamJourneyCandidates();
  const preferences = createJourneyPreferences({ window: globalThis.window ?? globalThis });
  const snapshot = preferences.snapshot();
  const candidateJourney = createCandidateTeamHost(source, {
    corePackIds: source.packs.map((pack) => pack.id),
  });
  const candidateProgress = createTeamJourneyProgress(candidateJourney);
  await candidateProgress.load();
  return Object.freeze({
    candidateJourney,
    candidateProgress,
    candidatePreferences: preferences,
    candidateDifficulty: snapshot.difficulty,
    candidateNotice: snapshot.durable ? '' : snapshot.error,
  });
}
