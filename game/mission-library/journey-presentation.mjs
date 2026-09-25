import { WHOLE_JOURNEY_REMIX_PACK_IDS } from '../content-design/whole-journey-order.mjs';

const UKRAINIAN_CULTURAL_SPATIAL_REVISION = 'cultural-spatial-triptych-1';
const UKRAINIAN_HORIZON_JOINS_REVISION = 'horizon-cultural-joins-1';

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
  if (['journey-arcade-v2', 'journey-trail-impact-v3'].includes(manifest.policyId))
    tags.push('Arcade');
  if (WHOLE_JOURNEY_REMIX_PACK_IDS.includes(mission.packId)) tags.push('Remix');
  if (mission.packId === 'ornament-crossings-study' && mission.campaignId === 'ornament-crossings')
    tags.push('Ukrainian');
  if (
    [UKRAINIAN_CULTURAL_SPATIAL_REVISION, UKRAINIAN_HORIZON_JOINS_REVISION].includes(
      manifest.level.revision,
    )
  )
    tags.push('Ukrainian');
  if (mission.packId === 'workshop-routing-study' && mission.campaignId === 'workshop-routing')
    tags.push('FPV');
  return tags;
}
