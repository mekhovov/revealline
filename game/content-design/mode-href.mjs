// The explicit review routes, not arbitrary imported project IDs or URLs.
export const AUTHORED_JOURNEY_ROUTE_IDS = Object.freeze([
  'opening',
  'authored',
  'whole-originals',
  'whole-originals-v2',
  'whole-originals-v3',
  'whole-originals-v4',
  'whole-spatial-v1',
  'whole-spatial-v2',
  'whole-spatial-v3',
  'whole-spatial-v4',
  'whole-spatial-v5',
]);
export const isAuthoredJourneyRouteId = (id) => AUTHORED_JOURNEY_ROUTE_IDS.includes(id);
export const authoredJourneyUsesActorMaterials = (id) =>
  [
    'whole-originals-v4',
    'whole-spatial-v1',
    'whole-spatial-v2',
    'whole-spatial-v3',
    'whole-spatial-v4',
    'whole-spatial-v5',
  ].includes(id);

/** Fixed same-game destinations. Team has different authored missions and is
 * intentionally not inferred from a Solo/Versus route. This is navigation only:
 * no save, token, mission completion or cross-mode progress transfer. */
export function authoredJourneyModeHref(routeId, destination) {
  if (!isAuthoredJourneyRouteId(routeId)) return null;
  if (destination === 'versus') return `couch/?return=solo&journey=${routeId}`;
  if (destination === 'solo') return `../?journey=${routeId}`;
  return null;
}
