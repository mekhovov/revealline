import { createUkrainianOrnamentJourney } from './ukrainian-ornament-candidates.mjs';
import {
  UKRAINIAN_ORNAMENT_ATLAS_REVISION,
  UKRAINIAN_ORNAMENT_ATLAS_IDS,
} from './ukrainian-ornament-atlas-registry.mjs';
import { ORNAMENT_CORE_UPDATES } from './ukrainian-ornament-core.mjs';
import { ORNAMENT_OPTIONAL_UPDATES } from './ukrainian-ornament-optional.mjs';

export { UKRAINIAN_ORNAMENT_ATLAS_REVISION, UKRAINIAN_ORNAMENT_ATLAS_IDS };

/** Nine original spatial abstractions of documented Ukrainian decorative
 * compositions. They are not traced charts or authentic reconstructions.
 * Preserve earlier immutable editions, original pictures, progression, presets
 * and signature mechanics. Source checks alone never establish human balance. */
export function createUkrainianOrnamentAtlasJourney({
  artwork = false,
  source = createUkrainianOrnamentJourney({ artwork }),
} = {}) {
  const project = structuredClone(source);
  const updates = { ...ORNAMENT_OPTIONAL_UPDATES, ...ORNAMENT_CORE_UPDATES };
  const revised = new Set(UKRAINIAN_ORNAMENT_ATLAS_IDS);
  for (const id of revised) {
    const mission = project.missions.find((candidate) => candidate.id === id);
    if (!mission || typeof updates[id] !== 'function')
      throw new Error(`Ornament atlas requires mission and update ${id}.`);
    const previous = project.maps.find(
      (map) => map.id === mission.map.id && map.revision === mission.map.revision,
    );
    if (!previous) throw new Error(`Ornament atlas requires the map for ${id}.`);
    const map = structuredClone(previous);
    mission.revision = map.revision = UKRAINIAN_ORNAMENT_ATLAS_REVISION;
    mission.map = { id: map.id, revision: map.revision };
    updates[id](mission, map);
    if (
      project.missions.some(
        (other) => other.map.id === previous.id && other.map.revision === previous.revision,
      )
    )
      project.maps.push(map);
    else project.maps[project.maps.indexOf(previous)] = map;
  }
  project.id = artwork
    ? 'ukrainian-ornament-atlas-original-review'
    : 'ukrainian-ornament-atlas-greybox-review';
  project.revision = UKRAINIAN_ORNAMENT_ATLAS_REVISION;
  project.name = 'Ukrainian ornament atlas · twelve spatial studies · balance pending';
  const campaigns = new Set();
  for (const campaign of project.campaigns)
    if (campaign.missionIds.some((id) => revised.has(id))) {
      campaign.revision = UKRAINIAN_ORNAMENT_ATLAS_REVISION;
      campaigns.add(campaign.id);
    }
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => campaigns.has(id)))
      pack.revision = UKRAINIAN_ORNAMENT_ATLAS_REVISION;
  return project;
}
