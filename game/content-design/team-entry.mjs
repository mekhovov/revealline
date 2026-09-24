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
import {
  createTeamImpactOriginalCandidates,
  TEAM_IMPACT_PROFILE_KEY,
} from './team-impact-originals.mjs';

/** Prepare the exact Team edition selected by the host's entry policy.
 * Player-facing copy does not grant official awards, artwork qualification
 * or change legacy Team arena preferences.
 * Pressure has a separate progress scope; only admitted play records events. */
export async function createTeamGreyboxEntry({
  artwork = false,
  pressure = false,
  spatial = false,
  impact = false,
  reviewCopy = true,
} = {}) {
  const source = impact
    ? createTeamImpactOriginalCandidates()
    : spatial
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
    impact
      ? { profileKey: TEAM_IMPACT_PROFILE_KEY }
      : spatial
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
    candidateCardPresenter: createTeamMissionCardPresenter(candidateJourney, candidateProgress, {
      reviewCopy,
    }),
    candidateCaptureTeaching: createTeamCaptureTeaching(
      candidateJourney,
      TEAM_JOURNEY_LEARNING_ARCS[0].missionIds,
    ),
    candidateDifficulty: snapshot.difficulty,
    candidateEditionLabel:
      pressure || spatial || impact
        ? `${impact ? 'owned trail-impact edition' : spatial ? 'changing-return pressure edition' : 'pressure edition'} · enemy speed Gentle ×1 / Standard ×1.4 / Expert ×1.75 · shared reserves 4 / 2 / 1`
        : '',
    candidateNotice: snapshot.durable ? '' : snapshot.error,
  });
}
