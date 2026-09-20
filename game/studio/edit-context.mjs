/** Same revision labels can arrive in an inspected import. Bind unsaved fields
 * to the actual mission, referenced map and rule catalogs, not labels alone. */
export function missionEditContext(source, mission, qualifier = null) {
  const map = source.maps.find(
    (entry) => entry.id === mission?.map.id && entry.revision === mission?.map.revision,
  );
  return JSON.stringify([
    source.id,
    source.revision,
    source.policyId,
    source.actorCatalogId,
    source.difficultyCatalogId,
    mission,
    map,
    qualifier,
  ]);
}
