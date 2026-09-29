import { WHOLE_JOURNEY_REMIX_PACK_IDS } from '../content-design/whole-journey-order.mjs';
import {
  UKRAINIAN_ORNAMENT_ATLAS_REVISION,
  UKRAINIAN_ORNAMENT_ATLAS_IDS,
} from '../content-design/ukrainian-ornament-atlas-registry.mjs';

/** Text-only projection of an already resolved manifest. No engine, geometry,
 * image fetching or decoding is needed to describe a mission at its preset. */
export function journeyMissionDetails(manifest) {
  if (!manifest) return null;
  const band = manifest.design?.difficulty?.band;
  const preset = manifest.difficulty;
  if (
    !Number.isInteger(band) ||
    band < 1 ||
    band > 12 ||
    !['gentle', 'standard', 'expert'].includes(preset)
  )
    throw new TypeError('Journey cards need an actual resolved band and preset.');
  return Object.freeze({
    challenge: `Band ${band}/12 · ${preset[0].toUpperCase()}${preset.slice(1)}`,
    route: manifest.design.routeDecision,
    mastery: manifest.design.mastery,
  });
}

/** Curated, stable authored identities, never keyword guesses or imported IDs. */
export function authoredJourneyMissionTags(mission, manifest) {
  if (mission?.source !== 'candidate' || !manifest) return [];
  const tags = [];
  if (manifest.policyId === 'journey-arcade-v2') tags.push('Arcade');
  if (WHOLE_JOURNEY_REMIX_PACK_IDS.includes(mission.packId)) tags.push('Remix');
  if (
    (mission.packId === 'ornament-crossings-study' &&
      mission.campaignId === 'ornament-crossings') ||
    (manifest.level?.revision === UKRAINIAN_ORNAMENT_ATLAS_REVISION &&
      UKRAINIAN_ORNAMENT_ATLAS_IDS.includes(mission.levelId))
  )
    tags.push('Ukrainian');
  if (mission.packId === 'workshop-routing-study' && mission.campaignId === 'workshop-routing')
    tags.push('FPV');
  return tags;
}
