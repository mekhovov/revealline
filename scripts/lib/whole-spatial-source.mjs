import { dataIdentity } from '../../game/data-json.mjs';
import { freezeDesign } from '../../game/content-design/catalogs.mjs';
import { compileContentProject } from '../../game/content-design/project.mjs';
import { withPressureDifficulty } from '../../game/content-design/pressure-candidates.mjs';
import { createWholeJourneyCandidates } from '../../game/content-design/whole-journey-candidates.mjs';
import { createOutpostSpatialCandidates } from '../../game/content-design/outpost-spatial-candidates.mjs';
import { createFractureSpatialCandidates } from '../../game/content-design/fracture-spatial-candidates.mjs';
import { createPhaseSpatialCandidates } from '../../game/content-design/phase-spatial-candidates.mjs';
import { createLivewireSpatialCandidates } from '../../game/content-design/livewire-spatial-candidates.mjs';
import { createSentinelSpatialCandidates } from '../../game/content-design/sentinel-spatial-candidates.mjs';
import { createApexFieldCandidates } from '../../game/content-design/apex-field-candidates.mjs';
import { createTimedBorderCandidates } from '../../game/content-design/timed-border-candidates.mjs';
import { TIMED_BONUS_TRAIL_VERSION } from '../../game/core/timed-bonuses.mjs';
import { createCulturalWorkshopArtCandidates } from '../../game/content-design/cultural-workshop-art-candidates.mjs';
import { createSpatialBalanceCandidates } from '../../game/content-design/spatial-balance-candidates.mjs';

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

/** Canonical build-time composition for Studio, Solo, Versus and qualification. Preserve the
 * reviewed study gameplay verbatim while retaining the common campaign pictures
 * and actor materials. Do not rewrite historical whole-Journey factories. */
export function composeWholeSpatialCandidates({
  artwork = false,
  fieldFinale = false,
  timedBorder = false,
  culturalWorkshop = false,
} = {}) {
  if (culturalWorkshop) timedBorder = true;
  const source = withPressureDifficulty(
    createWholeJourneyCandidates({ artwork, roverTeaching: true, campaignActors: true }),
  );
  const mapKey = (map) => `${map.id}@${map.revision}`;
  const maps = new Map(source.maps.map((map) => [mapKey(map), map]));
  const retiredMapKeys = new Set();
  const selected = new Set();
  const selections =
    fieldFinale || timedBorder
      ? [
          ...studies,
          { id: 'apex-field', missionIds: ['home-signal'], create: createApexFieldCandidates },
        ]
      : studies;
  if (timedBorder)
    selections.push({
      id: 'border-timed',
      missionIds: ['behind-the-patrol', 'second-landing', 'long-rail'],
      create: () =>
        withPressureDifficulty(createTimedBorderCandidates({ version: TIMED_BONUS_TRAIL_VERSION })),
    });
  for (const study of selections) {
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
  if (fieldFinale) {
    source.id = artwork ? 'whole-field-original-review' : 'whole-field-greybox-review';
    source.revision = 'field-finale-review-1';
    source.name = 'Whole Journey · unvalidated field-finale review';
  }
  if (timedBorder) {
    source.id = artwork ? 'whole-timed-original-review' : 'whole-timed-greybox-review';
    source.revision = 'timed-border-review-1';
    source.name = 'Whole Journey · unvalidated timed-bonus review';
  }
  if (culturalWorkshop) {
    const extra = compileContentProject(
      artwork
        ? createCulturalWorkshopArtCandidates({ spatial: true })
        : createSpatialBalanceCandidates(),
    ).source;
    for (const key of ['policyId', 'difficultyCatalogId'])
      if (extra[key] !== source[key])
        throw new Error(`Cultural study ${key} must match the Journey.`);
    for (const key of ['maps', 'missions', 'campaigns', 'packs', 'assets']) {
      const ids = new Set(source[key].map((item) => item.id));
      for (const item of key === 'assets' ? (extra.assets ?? []) : extra[key]) {
        if (ids.has(item.id)) throw new Error(`Duplicate cultural study ${key}: ${item.id}`);
        ids.add(item.id);
        source[key].push(structuredClone(item));
      }
    }
    for (const campaign of source.campaigns) {
      if (campaign.id === 'ornament-crossings')
        campaign.name = 'Ukrainian-inspired ornament · optional';
      if (campaign.id === 'workshop-routing') campaign.name = 'FPV workshop · optional';
    }
    for (const pack of source.packs.filter((item) => extra.packs.some((p) => p.id === item.id)))
      pack.name = source.campaigns.find((c) => c.id === pack.campaignIds[0]).name;
    source.id = artwork ? 'whole-variety-original-review' : 'whole-variety-greybox-review';
    source.revision = 'cultural-workshop-review-1';
    source.name = 'Whole Journey · unvalidated ornament and workshop review';
  }
  for (const item of [...source.campaigns, ...source.packs]) item.revision = source.revision;
  return structuredClone(compileContentProject(source).source);
}
