/** Catalog authority membership only. HTTP body coverage is reported separately. */
export function summarizeCatalogCohorts(currentRows, retainedRows) {
  const versions = (rows) => {
    if (!Array.isArray(rows)) throw new Error('Catalog cohort must be an array.');
    const values = rows.map((row) => row?.version);
    if (values.some((version) => typeof version !== 'string' || !/^v\d+\.\d+\.\d+$/.test(version)) ||
        new Set(values).size !== values.length) throw new Error('Catalog cohort versions must be valid and unique.');
    return values.sort();
  };
  const current = versions(currentRows), retained = versions(retainedRows);
  const currentSet = new Set(current), retainedSet = new Set(retained);
  if (retained.some((version) => !currentSet.has(version))) throw new Error('Retained catalog authority is missing.');
  const added = current.filter((version) => !retainedSet.has(version));
  return {
    retainedCatalogAuthorities: retained.length,
    newCatalogAuthorities: added.length,
    totalCatalogAuthorities: current.length,
    retainedCatalogVersions: retained,
    newCatalogVersions: added,
    historicalHTTPBodyPreservationClaimed: false,
  };
}
