import { freezeDesign } from './catalogs.mjs';
import { createOpeningCandidates } from './horizon-candidates.mjs';
import { createBorderCandidates } from './border-candidates.mjs';
import { createSignalCandidates } from './signal-candidates.mjs';
import { createNeonCandidates } from './neon-candidates.mjs';
import { createRoverCandidates } from './rover-candidates.mjs';
import { createRoverTeachingCandidates } from './rover-teaching-candidates.mjs';
import { createFractureCandidates } from './fracture-candidates.mjs';
import { createPhaseCandidates } from './phase-candidates.mjs';
import { createLivewireCandidates } from './livewire-candidates.mjs';
import { createRelayCandidates } from './relay-candidates.mjs';
import { createCrosswindCandidates } from './crosswind-candidates.mjs';
import { createSentinelCandidates } from './sentinel-candidates.mjs';
import { createApexCandidates } from './apex-candidates.mjs';
import { withCampaignPresentation } from './campaign-presentation.mjs';
import { withCampaignActorPresentation } from './campaign-actor-presentation.mjs';

// Explicit review order, never inferred from titles or an imported "official" flag.
const chapters = [
  ['horizon', 'journey-opening', 'opening-remixes', createOpeningCandidates],
  ['border', 'journey-border', 'border-remixes', createBorderCandidates],
  ['signal', 'journey-signal', 'signal-remixes', createSignalCandidates],
  ['neon', 'journey-neon', 'neon-remixes', createNeonCandidates],
  ['rover', 'journey-rover', 'rover-remixes', createRoverCandidates],
  ['fracture', 'journey-fracture', 'fracture-remixes', createFractureCandidates],
  ['phase', 'journey-phase', 'phase-remixes', createPhaseCandidates],
  ['livewire', 'journey-livewire', 'livewire-remixes', createLivewireCandidates],
  ['relay', 'journey-relay', 'relay-remixes', createRelayCandidates],
  ['crosswind', 'journey-crosswind', 'crosswind-remixes', createCrosswindCandidates],
  ['sentinel', 'journey-sentinel', 'sentinel-remixes', createSentinelCandidates],
  ['apex', 'journey-apex', 'apex-remixes', createApexCandidates],
];
export const WHOLE_JOURNEY_CHAPTERS = freezeDesign(
  chapters.map(([id, corePackId, remixPackId]) => ({ id, corePackId, remixPackId })),
);
export const WHOLE_JOURNEY_CORE_PACK_IDS = freezeDesign(chapters.map((row) => row[1]));
export const WHOLE_JOURNEY_REMIX_PACK_IDS = freezeDesign(chapters.map((row) => row[2]));

/** The one chapter selection used by composition and read-only evidence tools. */
export function createWholeJourneyChapterSources({
  artwork = false,
  roverTeaching = false,
  campaignPresentation = false,
  campaignActors = false,
} = {}) {
  return chapters.map(([id, , , create]) => {
    const source = (roverTeaching && id === 'rover' ? createRoverTeachingCandidates : create)({
      artwork,
    });
    return {
      id,
      source: campaignActors
        ? withCampaignActorPresentation(source, id)
        : campaignPresentation
          ? withCampaignPresentation(source, id)
          : source,
    };
  });
}

/** Review source for the existing compiler/Studio/execution adapters. Historical
 * callers retain greyboxes; explicit artwork selects each chapter's already
 * authored picture edition (including Signal's distinct theme revision). Neither
 * variant enrolls public content, retunes physics, migrates saves or awards official
 * progress. Independent drafts cannot mutate another chapter. The opt-in Rover
 * teaching successor has a distinct project revision; default editions remain
 * frozen, including the previous pictured source and its suspended-game route. */
export function createWholeJourneyCandidates({
  artwork = false,
  roverTeaching = false,
  campaignPresentation = false,
  campaignActors = false,
} = {}) {
  const sources = createWholeJourneyChapterSources({
    artwork,
    roverTeaching,
    campaignPresentation,
    campaignActors,
  }).map((chapter) => chapter.source);
  const source = {
    ...sources[0],
    id: artwork ? 'whole-journey-original-review' : 'whole-journey-greybox-review',
    revision: artwork ? 'original-review-1' : 'greybox-review-1',
    name: artwork
      ? 'Whole Journey · unvalidated original-picture review'
      : 'Whole Journey · unvalidated greybox review',
    actorCatalogId: 'journey-actors-v6',
  };
  if (roverTeaching) {
    source.id = artwork
      ? 'whole-journey-teaching-original-review'
      : 'whole-journey-teaching-review';
    source.revision = 'teaching-review-1';
    source.name = 'Whole Journey · unvalidated first-capture teaching review';
  }
  if (campaignPresentation || campaignActors) {
    source.id += '-themes';
    source.revision += '-theme-1';
    source.name = 'Whole Journey · unvalidated campaign presentation review';
  }
  if (campaignActors) {
    source.id += '-actors';
    source.revision += '-actors-1';
    source.name = 'Whole Journey · unvalidated actor material review';
  }
  for (const key of ['maps', 'missions', 'campaigns', 'packs', 'assets'])
    source[key] = sources.flatMap((chapter) => chapter[key] ?? []);
  const byPack = new Map(source.packs.map((pack) => [pack.id, pack]));
  source.packs = [...WHOLE_JOURNEY_CORE_PACK_IDS, ...WHOLE_JOURNEY_REMIX_PACK_IDS].map((id) =>
    byPack.get(id),
  );
  return source;
}
