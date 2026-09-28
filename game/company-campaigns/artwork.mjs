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

/** Build-time descriptions follow the selected public bytes, never a later
 * source record. Only these localized strings enter the player projection. */
export function selectExactCompanyArtworkDescriptions(asset, assetSources = []) {
  const record = assetSources.find((entry) => entry.id === asset.id && entry.locales);
  if (!record) return null;
  if (
    record.path !== asset.path ||
    record.sha256 !== asset.sha256 ||
    record.bytes !== asset.bytes ||
    record.publication !== 'public'
  )
    throw new TypeError('Company artwork descriptions differ from the selected public bytes.');
  if (
    !['en', 'uk'].every(
      (locale) =>
        typeof record.locales[locale]?.alt === 'string' && record.locales[locale].alt.trim(),
    )
  )
    throw new TypeError('Company artwork descriptions require English and Ukrainian alt text.');
  return Object.fromEntries(['en', 'uk'].map((locale) => [locale, record.locales[locale].alt]));
}
