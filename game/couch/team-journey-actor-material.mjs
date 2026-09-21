import { journeyActorMaterial } from '../presentation/journey-actor-materials.mjs';

const roles = Object.freeze({
  drifter: 'team-field-bouncer',
  'claimed-rover': 'team-reclaimed-roamer',
});

/** Cosmetic adapter for the two threats actually authored in the Team Journey.
 * The caller must obtain materialId from its live verified picture binding.
 * Override selection is fail-closed: only an explicit false permits the default
 * material. Prepared Team state slots and uploaded bodies always take priority.
 * No loading, lease changes, type conversion, state advancement or new badges. */
export function teamJourneyActorFrame(frame, { materialId, hasBodyOverride = true } = {}) {
  if (
    !frame ||
    hasBodyOverride !== false ||
    frame.sourceSlot?.startsWith('team.') ||
    !journeyActorMaterial(materialId) ||
    !Object.hasOwn(roles, frame.type) ||
    frame.role !== roles[frame.type]
  )
    return frame;
  return Object.freeze({ ...frame, journeyMaterial: materialId });
}
