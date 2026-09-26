/** Select current art from an immutable revision ledger. Historical presentations
 * carry their exact asset records and never consult this authoring selection. */
export function selectCurrentCompanyArtwork(artwork) {
  const latest = new Map(),
    revisions = new Set();
  for (const asset of artwork) {
    if (
      !/^[1-9][0-9]*$/.test(String(asset.revision)) ||
      !Number.isSafeInteger(Number(asset.revision))
    )
      throw new TypeError('Company artwork revisions must be positive integers.');
    const key = `${asset.id}@${asset.revision}`;
    if (revisions.has(key)) throw new TypeError('Repeated company artwork revision.');
    revisions.add(key);
    if (!latest.has(asset.id) || Number(latest.get(asset.id).revision) < Number(asset.revision))
      latest.set(asset.id, asset);
  }
  return [...latest.values()];
}
