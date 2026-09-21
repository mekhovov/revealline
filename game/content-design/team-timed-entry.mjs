import { createTeamTimedOriginalCandidates } from './team-timed-originals.mjs';
import { createCandidateTeamHost } from './team-host.mjs';
import { createJourneyPreferences } from '../journey/preferences.mjs';
import { createTeamJourneyProgress } from './team-progress.mjs';
import { createTeamMissionCardPresenter } from './team-mission-card.mjs';
import { createTeamCaptureTeaching } from './team-capture-teaching.mjs';

export const TEAM_TIMED_PROFILE_KEY = 'team-shared-windows-originals';

/** Lazy, explicitly selected three-mission test. Shared input preferences, but
 * isolated bookmarks/results; not a checkpoint save or official award source. */
export async function createTeamTimedEntry() {
  const source = createTeamTimedOriginalCandidates();
  const preferences = createJourneyPreferences({ window: globalThis.window ?? globalThis });
  const snapshot = preferences.snapshot();
  const candidateJourney = createCandidateTeamHost(source, {
    corePackIds: source.packs.map((p) => p.id),
  });
  const candidateProgress = createTeamJourneyProgress(candidateJourney, {
    profileKey: TEAM_TIMED_PROFILE_KEY,
  });
  await candidateProgress.load();
  return Object.freeze({
    candidateJourney,
    candidateProgress,
    candidatePreferences: preferences,
    candidateCardPresenter: createTeamMissionCardPresenter(candidateJourney, candidateProgress),
    candidateCaptureTeaching: createTeamCaptureTeaching(candidateJourney, ['window-exchange']),
    candidateDifficulty: snapshot.difficulty,
    candidateNotice: snapshot.durable ? '' : snapshot.error,
  });
}
