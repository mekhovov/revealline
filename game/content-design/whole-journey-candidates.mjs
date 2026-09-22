import {
  WHOLE_JOURNEY_CHAPTERS,
  WHOLE_JOURNEY_CORE_PACK_IDS,
  WHOLE_JOURNEY_REMIX_PACK_IDS,
} from './whole-journey-order.mjs';
export {
  WHOLE_JOURNEY_CHAPTERS,
  WHOLE_JOURNEY_CORE_PACK_IDS,
  WHOLE_JOURNEY_REMIX_PACK_IDS,
} from './whole-journey-order.mjs';
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

const factories = {
  horizon: createOpeningCandidates,
  border: createBorderCandidates,
  signal: createSignalCandidates,
  neon: createNeonCandidates,
  rover: createRoverCandidates,
  fracture: createFractureCandidates,
  phase: createPhaseCandidates,
  livewire: createLivewireCandidates,
  relay: createRelayCandidates,
  crosswind: createCrosswindCandidates,
  sentinel: createSentinelCandidates,
  apex: createApexCandidates,
};

/** The one chapter selection used by composition and read-only evidence tools. */
export function createWholeJourneyChapterSources({
  artwork = false,
  roverTeaching = false,
  campaignPresentation = false,
  campaignActors = false,
} = {}) {
  return WHOLE_JOURNEY_CHAPTERS.map(({ id }) => {
    const create = factories[id];
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
