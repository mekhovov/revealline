import { createWholeErosionReviewCandidates } from './whole-spatial-candidates.mjs';
import { compileContentProject } from './project.mjs';
import { dataIdentity } from '../data-json.mjs';
import { TIMED_BONUS_TRAIL_VERSION } from '../core/timed-bonuses.mjs';

const REVISION = 'border-timed-detour-pair-1';
export const BORDER_TIMED_DETOUR_MISSIONS = Object.freeze(['turn-the-corner', 'return-pocket']);

const recipes = {
  'turn-the-corner': {
    kind: 'enemy-freeze',
    anchors: [
      { x: 30.5, y: 8.5 },
      { x: 26.5, y: 20.5 },
      { x: 46.5, y: 17.5 },
    ],
    initialDelayTicks: 480,
    design: {
      routeDecision:
        'Extend an arm of the L to redirect frontier pressure, or leave that return in reserve while taking a short detour to an announced freeze window?',
      lesson:
        'The outline announces an optional contact pickup; wait for it to appear before touching it. Missed windows expire and may return at another unclaimed anchor.',
      counterplay:
        'The broad L remains a complete return route without either bonus. Read the frontier first; freezing enemies still requires a genuine reclaimed return.',
      memorableMoment:
        'A missed window beside one arm returns beside another, asking for a new approach rather than a longer wait at the same spot.',
    },
  },
  'return-pocket': {
    kind: 'enemy-slow',
    anchors: [
      { x: 34.5, y: 17.5 },
      { x: 36.5, y: 6.5 },
      { x: 52.5, y: 16.5 },
    ],
    initialDelayTicks: 600,
    design: {
      routeDecision:
        'Close the pocket mouth without detouring, or collect a briefly available slow window inside or outside the pocket before making the larger enclosure?',
      lesson:
        'Outer and frontier patrols keep their distinct routes. A slow window needs actual contact, not enclosure, and is never required to finish.',
      counterplay:
        'Keep a short return to either arm while approaching a window. Let a bad opportunity expire: its next eligible anchor differs, but its appearance never guarantees safety from moving enemies.',
      memorableMoment:
        'An ignored inner window relocates outside the shelter, changing the optional route while the same broad pocket remains available.',
    },
  },
};

/** Two explicit current-rules successors, not automatic edits to any accepted
 * route. Timings use the existing simulation clock and opportunity validation.
 * No pickup is a goal, and old missions, fixed pickups and pictures stay exact. */
export function createBorderTimedDetourPairCandidates({ artwork = false } = {}) {
  const project = createWholeErosionReviewCandidates({ artwork });
  for (const [id, recipe] of Object.entries(recipes)) {
    const schedule = {
      id: `${id}-detour-window`,
      kind: recipe.kind,
      anchors: recipe.anchors,
      initialDelayTicks: recipe.initialDelayTicks,
      announcementTicks: 120,
      availableTicks: 1200,
      cooldownTicks: 960,
      maxAppearances: 3,
      maxCollections: 1,
    };
    const mission = project.missions.find((item) => item.id === id);
    mission.timedBonuses = { version: TIMED_BONUS_TRAIL_VERSION, schedules: [schedule] };
    mission.revision = `detour-${dataIdentity({
      previous: mission.revision,
      timedBonuses: mission.timedBonuses,
      design: recipe.design,
    })}`;
    mission.design = {
      ...mission.design,
      ...recipe.design,
      practices: [...new Set([...mission.design.practices, 'timed-contact-bonuses'])],
    };
  }
  project.id = artwork ? 'border-detour-original-review' : 'border-detour-greybox-review';
  project.revision = REVISION;
  project.name = 'Whole Journey · two optional Border bonus detours';
  for (const campaign of project.campaigns)
    if (campaign.missionIds.some((id) => BORDER_TIMED_DETOUR_MISSIONS.includes(id))) {
      campaign.revision = REVISION;
      for (const pack of project.packs)
        if (pack.campaignIds.includes(campaign.id)) pack.revision = REVISION;
    }
  return structuredClone(compileContentProject(project).source);
}
