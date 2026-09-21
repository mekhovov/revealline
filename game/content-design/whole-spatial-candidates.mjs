import { dataIdentity } from '../data-json.mjs';
import { freezeDesign } from './catalogs.mjs';
import { compileContentProject } from './project.mjs';
import { withPressureDifficulty } from './pressure-candidates.mjs';
import { createWholeJourneyCandidates } from './whole-journey-candidates.mjs';
import { createOutpostSpatialCandidates } from './outpost-spatial-candidates.mjs';
import { createFractureSpatialCandidates } from './fracture-spatial-candidates.mjs';
import { createPhaseSpatialCandidates } from './phase-spatial-candidates.mjs';
import { createLivewireSpatialCandidates } from './livewire-spatial-candidates.mjs';
import { createSentinelSpatialCandidates } from './sentinel-spatial-candidates.mjs';

const studies = [
  {
    id: 'horizon',
    missionIds: ['island-outpost', 'courtyard-return'],
    create: createOutpostSpatialCandidates,
  },
  { id: 'fracture', missionIds: ['two-districts'], create: createFractureSpatialCandidates },
  { id: 'phase', missionIds: ['return-in-reserve'], create: createPhaseSpatialCandidates },
  {
    id: 'livewire',
    missionIds: ['cross-the-afterglow', 'switchyard', 'split-junction'],
    create: () => createLivewireSpatialCandidates({ edition: 'routing' }),
  },
  {
    id: 'sentinel',
    missionIds: ['twin-receivers', 'relay-perimeter'],
    create: createSentinelSpatialCandidates,
  },
];

// This edition's selection is explicit and immutable. Later selections need a new
// route/revision; candidate presence never means human acceptance or publication.
export const WHOLE_SPATIAL_SELECTIONS = freezeDesign(
  studies.map(({ id, missionIds }) => ({ id, missionIds: [...missionIds] })),
);

/** One source for Studio, Solo, Versus and offline qualification. Preserve the
 * reviewed study gameplay verbatim while retaining the common campaign pictures
 * and actor materials. Do not rewrite historical whole-Journey factories. */
export function createWholeSpatialCandidates({ artwork = false } = {}) {
  const source = withPressureDifficulty(
    createWholeJourneyCandidates({ artwork, roverTeaching: true, campaignActors: true }),
  );
  const mapKey = (map) => `${map.id}@${map.revision}`;
  const maps = new Map(source.maps.map((map) => [mapKey(map), map]));
  const retiredMapKeys = new Set();
  const selected = new Set();
  for (const study of studies) {
    const candidate = study.create();
    if (candidate.difficultyCatalogId !== source.difficultyCatalogId)
      throw new Error('Spatial studies must use the shared pressure policy.');
    for (const id of study.missionIds) {
      const index = source.missions.findIndex((mission) => mission.id === id);
      const replacement = candidate.missions.find((mission) => mission.id === id);
      if (index < 0 || !replacement || selected.has(id))
        throw new Error(`Missing or duplicate spatial selection: ${id}`);
      selected.add(id);
      const prior = source.missions[index];
      const map = candidate.maps.find((item) => mapKey(item) === mapKey(replacement.map));
      if (!map) throw new Error(`Missing spatial map: ${id}`);
      const existing = maps.get(mapKey(map));
      if (existing && dataIdentity(existing) !== dataIdentity(map))
        throw new Error(`Conflicting immutable spatial map: ${mapKey(map)}`);
      maps.set(mapKey(map), structuredClone(map));
      if (mapKey(prior.map) !== mapKey(map)) retiredMapKeys.add(mapKey(prior.map));
      source.missions[index] = {
        ...structuredClone(replacement),
        presentation: structuredClone(prior.presentation),
      };
    }
  }
  // Keep an old shared map if any retained mission still references it. Only
  // superseded, now-unreferenced revisions are omitted from this new project.
  const references = new Set(source.missions.map((mission) => mapKey(mission.map)));
  source.maps = [...maps]
    .filter(([key]) => !retiredMapKeys.has(key) || references.has(key))
    .map(([, map]) => map);
  source.id = artwork ? 'whole-spatial-original-review' : 'whole-spatial-greybox-review';
  source.revision = 'spatial-review-1';
  source.name = 'Whole Journey · unvalidated spatial and pressure review';
  for (const item of [...source.campaigns, ...source.packs]) item.revision = source.revision;
  return structuredClone(compileContentProject(source).source);
}
