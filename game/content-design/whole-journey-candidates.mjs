import { freezeDesign } from './catalogs.mjs';
import { createOpeningCandidates } from './horizon-candidates.mjs';
import { createBorderCandidates } from './border-candidates.mjs';
import { createSignalCandidates } from './signal-candidates.mjs';
import { createNeonCandidates } from './neon-candidates.mjs';
import { createRoverCandidates } from './rover-candidates.mjs';
import { createFractureCandidates } from './fracture-candidates.mjs';
import { createPhaseCandidates } from './phase-candidates.mjs';
import { createLivewireCandidates } from './livewire-candidates.mjs';
import { createRelayCandidates } from './relay-candidates.mjs';
import { createCrosswindCandidates } from './crosswind-candidates.mjs';
import { createSentinelCandidates } from './sentinel-candidates.mjs';
import { createApexCandidates } from './apex-candidates.mjs';

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

/** A greybox review source for the existing compiler/Studio/execution adapters.
 * Does not enroll public content, bind unqualified art, upgrade mission/map
 * editions, retune physics, migrate saves or award official progress. All source
 * factories return independent drafts; edits cannot mutate another chapter. */
export function createWholeJourneyCandidates() {
  const sources = chapters.map(([, , , create]) => create());
  const source = {
    ...sources[0],
    id: 'whole-journey-greybox-review',
    revision: 'greybox-review-1',
    name: 'Whole Journey · unvalidated greybox review',
    actorCatalogId: 'journey-actors-v6',
  };
  for (const key of ['maps', 'missions', 'campaigns', 'packs', 'assets'])
    source[key] = sources.flatMap((chapter) => chapter[key] ?? []);
  const byPack = new Map(source.packs.map((pack) => [pack.id, pack]));
  source.packs = [...WHOLE_JOURNEY_CORE_PACK_IDS, ...WHOLE_JOURNEY_REMIX_PACK_IDS].map((id) =>
    byPack.get(id),
  );
  return source;
}
