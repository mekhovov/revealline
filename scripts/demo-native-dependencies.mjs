import { createHash } from 'node:crypto';

export const SIM_DEMO_INDEX = 'optional-practice/civilian-fpv/demo-data/index.json';
export const SIM_DEMO_RUNTIME_PATHS = Object.freeze(
  ['inventory', 'player', 'input', 'payload'].map(
    (name) => `optional-practice/civilian-fpv/demo-${name}.mjs`,
  ),
);

/** The standalone simulator deliberately excludes demo bodies. The demo extra
 * owns its catalog-selected recordings and adapter bridge, and separately
 * requires the existing named simulator owner for the native engine/assets. */
export function simDemoSourcePaths(entries) {
  const byPath = new Map(entries.map((entry) => [entry.name, entry]));
  const index = byPath.get(SIM_DEMO_INDEX);
  if (!index) return new Set();
  const catalog = JSON.parse(index.bytes);
  if (
    catalog.format !== 'SimDemoCatalog.v1' ||
    !Array.isArray(catalog.entries) ||
    !catalog.entries.length ||
    catalog.entries.length > 10000
  )
    throw new Error('Invalid SIM demo offline catalog.');
  const paths = new Set([SIM_DEMO_INDEX, ...SIM_DEMO_RUNTIME_PATHS]);
  for (const row of catalog.entries) {
    if (
      typeof row?.file !== 'string' ||
      !/^[a-z0-9][a-z0-9-]*\.json$/.test(row?.file) ||
      ['index.json', 'coverage.json'].includes(row.file)
    )
      throw new Error('Invalid SIM demo offline recording path.');
    const name = `optional-practice/civilian-fpv/demo-data/${row.file}`;
    if (paths.has(name)) throw new Error(`Duplicate SIM demo offline recording: ${name}`);
    paths.add(name);
  }
  const counts = new Map();
  for (const entry of entries) counts.set(entry.name, (counts.get(entry.name) || 0) + 1);
  for (const name of paths)
    if (counts.get(name) !== 1 || !byPath.get(name)?.bytes.length)
      throw new Error(`Missing or ambiguous SIM demo offline dependency: ${name}`);
  return paths;
}

/** Share only the authored routes and pictures actually referenced by the
 * shipped Journey demo catalogs; archive/multiplayer selection stays separate. */
export async function journeyDemoSourcePaths(entries, { index } = {}) {
  const byPath = new Map(entries.map((entry) => [entry.name, entry]));
  const catalogs = ['journey-current', 'journey-archive']
    .map((group) => ({ group, entry: byPath.get(`game/demo-data/catalog.${group}.json`) }))
    .filter((item) => item.entry);
  if (!catalogs.length) return new Set();
  index ??= (await import('../game/demo-modes/solo-builtins-index.mjs')).SOLO_BUILTIN_DEMO_INDEX;
  const paths = new Set(['game/demo-modes/solo-builtins-index.mjs']);
  const routes = new Map();
  const counts = new Map();
  for (const entry of entries) counts.set(entry.name, (counts.get(entry.name) || 0) + 1);
  const body = (name) => {
    const entry = byPath.get(name);
    if (counts.get(name) !== 1 || !entry?.bytes.length)
      throw new Error(`Missing or ambiguous Journey demo offline dependency: ${name}`);
    paths.add(name);
    return entry;
  };
  body('game/demo-modes/solo-builtins-index.mjs');
  for (const catalog of catalogs) {
    const { clips } = JSON.parse(body(catalog.entry.name).bytes);
    if (!Array.isArray(clips) || !clips.length)
      throw new Error('Invalid Journey demo offline catalog.');
    for (const clip of clips) {
      const matches = index.filter(
        (row) =>
          row.catalogGroup === catalog.group &&
          row.id === clip.id &&
          row.campaignKey === clip.campaignKey &&
          row.levelId === clip.levelId,
      );
      if (matches.length !== 1 || !/^[a-z0-9][a-z0-9-]*$/.test(matches[0].routeId))
        throw new Error(`Journey demo has no unique authored route: ${clip.id}`);
      const { routeId, levelId } = matches[0];
      if (!routes.has(routeId)) {
        const route = JSON.parse(body(`game/content-design/runtime/${routeId}.json`).bytes);
        if (route.id !== routeId || !Array.isArray(route.source?.missions))
          throw new Error(`Invalid Journey demo offline route: ${routeId}`);
        routes.set(routeId, route);
      }
      const route = routes.get(routeId);
      const missions = route.source.missions.filter((mission) => mission.id === levelId);
      if (missions.length !== 1)
        throw new Error(`Journey demo has no unique authored mission: ${clip.id}`);
      const assetId = missions[0].presentation?.backgroundAssetId;
      if (!assetId) continue;
      const assets = (route.source.assets || []).filter((asset) => asset.id === assetId);
      if (
        assets.length !== 1 ||
        typeof assets[0].path !== 'string' ||
        !/^content-design\/assets\/[a-zA-Z0-9._/-]+$/.test(assets[0].path) ||
        assets[0].path.split('/').some((part) => !part || part === '.' || part === '..')
      )
        throw new Error(`Journey demo has no unique authored picture: ${clip.id}`);
      const asset = assets[0],
        entry = body(`game/${asset.path}`);
      if (
        entry.bytes.length !== asset.bytes ||
        createHash('sha256').update(entry.bytes).digest('hex') !== asset.sha256
      )
        throw new Error(`Journey demo picture differs from its native identity: ${clip.id}`);
    }
  }
  return paths;
}

/** Demo recordings also need their exact ordinary source for admission and Fresh.
 * Sharing this finite dependency with an optional extra does not install a pack
 * or change whether an archived mission is discoverable in normal play. */
export function classicDemoSourcePaths(entries) {
  const byPath = new Map(entries.map((entry) => [entry.name, entry]));
  const catalog = byPath.get('game/demo-data/catalog.json');
  if (!catalog) return new Set();
  const index = byPath.get('game/content/mission-library-index.json');
  if (!index) throw new Error('Demo native dependencies need the ordinary mission index.');
  const { clips } = JSON.parse(catalog.bytes);
  const { missions } = JSON.parse(index.bytes);
  if (!Array.isArray(clips) || !Array.isArray(missions))
    throw new Error('Invalid demo native dependency metadata.');
  const paths = new Set();
  for (const clip of clips) {
    const matches = missions.filter(
      (mission) =>
        ['base', 'bundled', 'archived'].includes(mission.source) &&
        mission.campaignKey === clip.campaignKey &&
        mission.levelId === clip.levelId &&
        mission.modes?.includes('solo'),
    );
    if (matches.length !== 1) throw new Error(`Demo has no unique ordinary source: ${clip.id}`);
    const source = matches[0].sourceFile;
    const entry = byPath.get(source?.path);
    if (
      !entry ||
      entry.bytes.length !== source.bytes ||
      createHash('sha256').update(entry.bytes).digest('hex') !== source.sha256
    )
      throw new Error(`Demo ordinary source differs from its native identity: ${clip.id}`);
    paths.add(source.path);
  }
  return paths;
}
