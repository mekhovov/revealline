import {
  createTeamJourneyCandidates,
  TEAM_JOURNEY_LEARNING_ARCS,
} from './team-journey-candidates.mjs';
import { createCandidateTeamHost } from './team-host.mjs';
import { createJourneyPreferences } from '../journey/preferences.mjs';
import { createTeamJourneyProgress } from './team-progress.mjs';
import { createTeamMissionCardPresenter } from './team-mission-card.mjs';
import { createTeamCaptureTeaching } from './team-capture-teaching.mjs';
import {
  createTeamPressureOriginalCandidates,
  TEAM_PRESSURE_PROFILE_KEY,
} from './team-pressure-originals.mjs';
import {
  createTeamSpatialOriginalCandidates,
  TEAM_SPATIAL_PROFILE_KEY,
} from './team-spatial-originals.mjs';

/** Explicit candidate-review entry only. Originals require a separate opt-in;
 * no variant grants default enrollment, official awards, artwork qualification
 * or changes to legacy Team arena preferences.
 * Pressure has a separate progress scope; only admitted play records events. */
export async function createTeamGreyboxEntry({
  artwork = false,
  pressure = false,
  spatial = false,
} = {}) {
  const source = spatial
    ? createTeamSpatialOriginalCandidates()
    : pressure
      ? createTeamPressureOriginalCandidates()
      : createTeamJourneyCandidates({ artwork });
  const preferences = createJourneyPreferences({ window: globalThis.window ?? globalThis });
  const snapshot = preferences.snapshot();
  const candidateJourney = createCandidateTeamHost(source, {
    corePackIds: source.packs.map((pack) => pack.id),
  });
  const candidateProgress = createTeamJourneyProgress(
    candidateJourney,
    spatial
      ? { profileKey: TEAM_SPATIAL_PROFILE_KEY }
      : pressure
        ? { profileKey: TEAM_PRESSURE_PROFILE_KEY }
        : {},
  );
  await candidateProgress.load();
  return Object.freeze({
    candidateJourney,
    candidateProgress,
    candidatePreferences: preferences,
    candidateCardPresenter: createTeamMissionCardPresenter(candidateJourney, candidateProgress),
    candidateCaptureTeaching: createTeamCaptureTeaching(
      candidateJourney,
      TEAM_JOURNEY_LEARNING_ARCS[0].missionIds,
    ),
    candidateDifficulty: snapshot.difficulty,
    candidateEditionLabel:
      pressure || spatial
        ? `${spatial ? 'changing-return pressure edition' : 'pressure edition'} · enemy speed Gentle ×1 / Standard ×1.4 / Expert ×1.75 · shared reserves 4 / 2 / 1`
        : '',
    candidateNotice: snapshot.durable ? '' : snapshot.error,
  });
}
