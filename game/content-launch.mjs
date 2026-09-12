export const PACK_CATALOG_VERSION = 'xonix-pack-catalog.v1';

const stableId = (value) =>
  typeof value === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(value);
const shortText = (value, max = 160) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const exactKeys = (value, keys, label) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(value, key))
  )
    throw new TypeError(`${label} has missing or unsupported fields.`);
};
const freeze = (value) => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

/** Validate the small shipped navigation catalog before using it for URLs or selectors. */
export function preparePackCatalog(candidate) {
  const catalog = structuredClone(candidate);
  exactKeys(catalog, ['format', 'packs'], 'Pack catalog');
  if (catalog.format !== PACK_CATALOG_VERSION || !Array.isArray(catalog.packs))
    throw new TypeError('Unsupported pack catalog.');
  if (catalog.packs.length < 1 || catalog.packs.length > 12)
    throw new TypeError('Pack catalog size is invalid.');
  const packIds = new Set();
  for (const pack of catalog.packs) {
    exactKeys(pack, ['id', 'path', 'name', 'campaigns'], 'Pack catalog entry');
    if (
      !stableId(pack.id) ||
      packIds.has(pack.id) ||
      pack.path !== `${pack.id}.json` ||
      !shortText(pack.name) ||
      !Array.isArray(pack.campaigns) ||
      pack.campaigns.length < 1 ||
      pack.campaigns.length > 8
    )
      throw new TypeError('Pack catalog identity or content is invalid.');
    packIds.add(pack.id);
    const campaignIds = new Set();
    for (const campaign of pack.campaigns) {
      exactKeys(campaign, ['id', 'title', 'levels'], 'Pack catalog campaign');
      if (
        !stableId(campaign.id) ||
        campaignIds.has(campaign.id) ||
        !shortText(campaign.title) ||
        !Array.isArray(campaign.levels) ||
        campaign.levels.length < 1 ||
        campaign.levels.length > 128
      )
        throw new TypeError('Pack catalog campaign is invalid.');
      campaignIds.add(campaign.id);
      const levelIds = new Set();
      for (const level of campaign.levels) {
        exactKeys(level, ['id', 'name'], 'Pack catalog level');
        if (!stableId(level.id) || levelIds.has(level.id) || !shortText(level.name))
          throw new TypeError('Pack catalog level is invalid.');
        levelIds.add(level.id);
      }
    }
  }
  return freeze(catalog);
}

function one(params, key) {
  const values = params.getAll(key);
  if (values.length > 1) throw new TypeError(`Use one ${key} value.`);
  return values[0] ?? null;
}

/** Resolve a bounded landing-page handoff without trusting arbitrary file paths or IDs. */
export function resolvePackLaunch(params, catalog) {
  if (!(params instanceof URLSearchParams))
    throw new TypeError('Pack launch needs URL parameters.');
  const packId = one(params, 'pack');
  const campaignId = one(params, 'campaign');
  const levelId = one(params, 'level');
  const playValue = one(params, 'play');
  if (packId === null) {
    if (campaignId !== null || levelId !== null || playValue !== null)
      throw new TypeError('Choose a pack before a campaign or level.');
    return null;
  }
  const pack = catalog.packs.find((item) => item.id === packId);
  if (!pack) throw new TypeError('This bundled pack is not available.');
  const campaign = campaignId
    ? pack.campaigns.find((item) => item.id === campaignId)
    : pack.campaigns[0];
  if (!campaign) throw new TypeError('This pack campaign is not available.');
  const level = levelId ? campaign.levels.find((item) => item.id === levelId) : campaign.levels[0];
  if (!level) throw new TypeError('This pack level is not available.');
  if (playValue !== null && playValue !== '1')
    throw new TypeError('Pack launch play must be 1 when provided.');
  return freeze({
    packId: pack.id,
    packName: pack.name,
    path: pack.path,
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    levelId: level.id,
    levelName: level.name,
    play: playValue === '1',
  });
}

export function packLaunchHref(base, { packId, campaignId, levelId, play = false }) {
  if (typeof base !== 'string' || !base) throw new TypeError('Pack launch base URL is required.');
  const params = new URLSearchParams({ pack: packId });
  if (campaignId) params.set('campaign', campaignId);
  if (levelId) params.set('level', levelId);
  if (play) params.set('play', '1');
  return `${base}?${params}`;
}
