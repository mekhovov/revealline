import {
  hasIndustrialEnvironmentSource,
  prepareIndustrialEnvironmentSource,
} from '../presentation/industrial-environments.mjs';

const ORIGIN = Object.freeze({
  kind: 'builtin',
  catalogueId: 'classic-catalogue',
  catalogueRevision: 'classic-catalogue-v3',
  sourceForm: 'authored',
});

/** Authenticate immutable official source before activation. Imported editions
 * retain their artwork; a coincident level ID does not confer official ownership.
 * No await occurs between a Start gesture and the native audio activation. */
export async function prepareClassicEnvironments(entries, { official = false, signal } = {}) {
  const candidates = new WeakMap();
  if (!official) return () => null;
  for (const entry of entries) {
    const original = entry.level,
      fingerprint = JSON.stringify(original),
      modes = new Map();
    candidates.set(entry, { original, fingerprint, modes });
    for (const mode of ['solo', 'versus', 'team']) {
      const source = { engine: 'snake', mode, id: entry.level.id, revision: entry.level.revision };
      if (!hasIndustrialEnvironmentSource(source)) continue;
      const candidate = await prepareIndustrialEnvironmentSource({
        engine: 'snake',
        mode,
        source: entry.level,
        origin: ORIGIN,
        signal,
      });
      if (candidate) modes.set(mode, candidate);
    }
  }
  return (entry, mode) => {
    const cached = candidates.get(entry);
    if (
      !cached ||
      entry.level !== cached.original ||
      JSON.stringify(entry.level) !== cached.fingerprint
    )
      return null;
    return cached.modes.get(mode) ?? null;
  };
}
