import { freezeDesign } from './catalogs.mjs';
import { createAuthoredJourneyRoute } from './route.mjs';
import { createContentExecutionCatalog } from './execution.mjs';
import { WHOLE_JOURNEY_CHAPTERS } from './whole-journey-candidates.mjs';
import { JOURNEY_CAMPAIGN_THEMES } from './campaign-presentation.mjs';
import {
  createTeamJourneyCandidates,
  TEAM_JOURNEY_LEARNING_ARCS,
} from './team-journey-candidates.mjs';
import { createTeamActorCandidates } from './team-actor-candidates.mjs';
import { createCandidateTeamHost } from './team-host.mjs';
import {
  soloCompatibleMusicContext,
  prepareTeamMusicContext,
} from '../couch/couch-music-context.mjs';

// Creative matching metadata only, not a composition, approved recording,
// license grant, saved assignment or playback instruction. Original music
// production remains paused; the soundtrack owner controls licensed selection.
const directions = [
  [
    'horizon',
    2,
    ['synth90s'],
    'Warm, spacious melodic exploration; leave silence around the first closure and failure cues.',
  ],
  [
    'border',
    2,
    ['synth90s'],
    'Light, buoyant rhythmic movement with audible gaps for perimeter timing and bonus expiry.',
  ],
  [
    'signal',
    3,
    ['synth90s'],
    'Airy electronic detail and clean soft attacks; do not mask interference or lethal-field warnings.',
  ],
  [
    'neon',
    3,
    ['synth90s'],
    'Restrained night-drive pulse, stable groove and short phrases around the changing frontier.',
  ],
  [
    'rover',
    3,
    ['synth90s', 'metal'],
    'Dry workshop percussion with space between accents; reclaimed-ground activation stays unmistakable.',
  ],
  [
    'fracture',
    3,
    ['synth90s'],
    'Measured tidal pulse with deliberate quiet space for erosion and territory-loss feedback.',
  ],
  [
    'phase',
    4,
    ['synth90s'],
    'Clockwork layers with clear rhythmic rests; trail-impact warnings must lead the soundscape.',
  ],
  [
    'livewire',
    4,
    ['metal', 'synth90s'],
    'Controlled industrial drive, not uninterrupted maximum intensity; preserve lane-warning and recovery space.',
  ],
  [
    'relay',
    3,
    ['synth90s'],
    'Interlocking exploratory phrases, clean resolutions and room for relay-capture confirmation.',
  ],
  [
    'crosswind',
    4,
    ['synth90s'],
    'Airy forward motion with broad phrases; movement efficiency must not sound like forced steering.',
  ],
  [
    'sentinel',
    4,
    ['metal', 'synth90s'],
    'Measured monumental tension with clear separation from shield, target-lock and attack cues.',
  ],
  [
    'apex',
    4,
    ['synth90s', 'metal'],
    'Broad returning colors and capstone lift; alternate tension and breathing room rather than constant density.',
  ],
];
export const JOURNEY_MUSIC_DIRECTIONS = freezeDesign(
  directions.map(([chapterId, energy, preferredGenres, brief]) => ({
    chapterId,
    sourceThemeId: JOURNEY_CAMPAIGN_THEMES[chapterId],
    preferredGenres,
    menu: {
      scene: 'menu',
      energy: Math.min(2, energy),
      brief:
        'Calm, spacious continuation of the campaign mood; do not restart a playing track merely because a menu opens.',
    },
    gameplay: { scene: 'gameplay', energy, brief },
    approval: 'direction-only',
    originalProduction: 'paused',
  })),
);
const byChapter = new Map(JOURNEY_MUSIC_DIRECTIONS.map((row) => [row.chapterId, row]));
const byPack = new Map(
  WHOLE_JOURNEY_CHAPTERS.flatMap((chapter) =>
    [chapter.corePackId, chapter.remixPackId].map((id) => [id, chapter.id]),
  ),
);

/** Read-only handoff using real immutable runtime identities, not a name match.
 * Compatible Solo and Versus share these contexts. No preferences or transport
 * are accessed, and no track is selected or marked approved by this report. */
export function createJourneyMusicDirectionReview(routeId) {
  const route = createAuthoredJourneyRoute(routeId);
  if (!route) throw new Error('Choose an explicit Journey review edition.');
  const catalog = createContentExecutionCatalog(route.source);
  return freezeDesign(
    catalog.entries.flatMap((entry) => {
      const direction = byChapter.get(byPack.get(entry.sourcePackId));
      if (!direction) throw new Error('Missing authored campaign music direction.');
      return entry.manifests.map((manifest, index) => ({
        routeId,
        packId: entry.sourcePackId,
        campaignId: entry.campaignId,
        missionId: manifest.missionId,
        difficulty: entry.difficulty,
        modes: ['solo', 'versus'],
        direction,
        context: soloCompatibleMusicContext({
          campaignKey: entry.baseCampaignKey,
          level: entry.campaign.levels[index],
          themeId: manifest.presentation.themeId,
        }),
      }));
    }),
  );
}

const teamArcs = new Map([
  ['shared-return-network', 'horizon'],
  ['shared-material-work', 'signal'],
  ['changing-common-ground', 'rover'],
]);
/** Separate Team identity, never fabricated from a Solo baseCampaignKey. The
 * current Team picture lease uses its exact prepared FPV look; desired authored
 * materials are metadata, not permission to substitute that look/theme identity. */
export async function createTeamMusicDirectionReview({ actors = false } = {}) {
  if (typeof actors !== 'boolean') throw new Error('Choose an explicit Team review variant.');
  const source = actors
    ? createTeamActorCandidates()
    : createTeamJourneyCandidates({ artwork: true });
  const host = createCandidateTeamHost(source, {
    corePackIds: source.packs.map((pack) => pack.id),
  });
  const report = [];
  for (const row of host.rows) {
    const arc = TEAM_JOURNEY_LEARNING_ARCS.find((item) => item.missionIds.includes(row.level.id));
    const direction = byChapter.get(teamArcs.get(arc?.id));
    if (!direction) throw new Error('Missing authored Team music direction.');
    report.push({
      sourceProjectId: source.id,
      missionId: row.level.id,
      difficulty: row.difficulty,
      modes: ['team'],
      direction,
      authoredThemeId: row.presentation.themeId,
      context: await prepareTeamMusicContext({ pack: row.pack, level: row.level, themeId: 'fpv' }),
    });
  }
  return freezeDesign(report);
}
