import { canonicalJSON } from '../data-json.mjs';
import { resolvePackCampaign } from '../packs.mjs';
import { campaignKey } from '../library.mjs';
import { preparedPackIdentity } from './pack-identity.mjs';
import { LIBRARY_MODES, LIBRARY_TAGS } from './library.mjs';

/** owners: [{pack, entries}], using exact prepared installed pack objects and all
 * original resolved campaign entries. Do not pass Gentle execution projections.
 * Callbacks receive {pack,entry,level,levelIndex} with original references intact.
 * A host must explicitly return its supported modes; [] omits an unsupported map.
 * Official exclusion requires a positively verified boolean, never a name match.
 */
export async function customLibrarySources(
  owners,
  {
    isOfficial = () => false,
    compatibility,
    describe,
    availability,
    prepare,
    launch,
    progress,
    card,
  } = {},
) {
  if (
    !Array.isArray(owners) ||
    owners.length > 12 ||
    [isOfficial, compatibility, describe, availability, launch].some(
      (fn) => typeof fn !== 'function',
    ) ||
    [prepare, progress, card].some((fn) => fn !== undefined && typeof fn !== 'function')
  )
    throw new TypeError('Custom browsing needs bounded owners and explicit host adapters.');
  const sources = [],
    packIds = new Set();
  for (const owner of owners) {
    const { pack, entries } = owner ?? {};
    if (
      !pack ||
      !Array.isArray(pack.campaigns) ||
      !pack.campaigns.length ||
      !Array.isArray(entries) ||
      entries.length !== pack.campaigns.length ||
      packIds.has(pack.id)
    )
      throw new TypeError(
        'Custom browsing needs each exact installed pack and its authored campaigns once.',
      );
    // resolvePackCampaign rejects raw/unprepared lookalikes. This lookup performs
    // no fetch or image decode, and is never called while rendering a card.
    const resolved = pack.campaigns.map((campaign) => resolvePackCampaign(pack, campaign.id));
    packIds.add(pack.id);
    const byCampaign = new Map();
    for (const entry of entries) {
      if (!entry?.campaign || entry.sourcePackId !== pack.id || byCampaign.has(entry.campaign.id))
        throw new TypeError('Custom campaign entry belongs to another or duplicate pack owner.');
      byCampaign.set(entry.campaign.id, entry);
    }
    for (const reference of resolved) {
      const entry = byCampaign.get(reference.campaign.id);
      if (!entry || canonicalJSON(entry.campaign) !== canonicalJSON(reference.campaign))
        throw new TypeError('Custom campaign differs from its prepared installed pack.');
      for (const field of [
        'classRecipes',
        'themes',
        'visualOverrides',
        'levelVisuals',
        'music',
        'sourcePackFormat',
        'masteries',
      ]) {
        if (canonicalJSON(entry[field]) !== canonicalJSON(reference[field]))
          throw new TypeError(
            'Custom presentation or equipment differs from its prepared installed pack.',
          );
      }
    }
    const official = await isOfficial(pack);
    if (typeof official !== 'boolean')
      throw new TypeError('Official verification must return an explicit boolean.');
    if (official) continue;
    const { sha256: editionId } = await preparedPackIdentity(pack);
    const rows = [],
      descriptions = new WeakMap();
    for (const reference of resolved) {
      const entry = byCampaign.get(reference.campaign.id);
      const key = campaignKey(entry.campaign);
      for (const [levelIndex, level] of entry.campaign.levels.entries()) {
        const binding = Object.freeze({ pack, entry, level, levelIndex });
        const modes = compatibility(binding);
        if (
          !Array.isArray(modes) ||
          new Set(modes).size !== modes.length ||
          modes.some((mode) => !LIBRARY_MODES.includes(mode))
        )
          throw new TypeError('Custom mode compatibility must be an explicit supported-mode list.');
        if (!modes.length) continue;
        const info = describe(binding);
        if (
          !info ||
          typeof info.rules !== 'string' ||
          info.rules.length > 2048 ||
          (info.hook !== undefined && (typeof info.hook !== 'string' || info.hook.length > 2048)) ||
          (info.tags !== undefined &&
            (!Array.isArray(info.tags) ||
              info.tags.some(
                (tag) => !LIBRARY_TAGS.includes(tag) || ['Journey', 'Classic'].includes(tag),
              )))
        )
          throw new TypeError('Custom descriptions need actual rules and valid textual tags.');
        rows.push(binding);
        descriptions.set(
          binding,
          Object.freeze({
            id: level.id,
            revision: level.revision,
            campaignKey: key,
            campaignTitle: entry.campaign.title || entry.campaign.name || entry.campaign.id,
            name: level.name || level.id,
            levelIndex,
            modes: Object.freeze([...modes]),
            rules: info.rules,
            tags: Object.freeze([...(info.tags ?? [])]),
            hook: info.hook ?? '',
          }),
        );
      }
    }
    if (!rows.length) continue;
    sources.push({
      id: JSON.stringify(['custom', pack.id]),
      collection: 'Custom',
      editionId,
      edition: `${pack.name} · ${pack.version}`.slice(0, 160),
      entries: Object.freeze(rows),
      describe(binding) {
        const info = descriptions.get(binding);
        if (!info) throw new TypeError('Custom mission does not belong to this source.');
        return info;
      },
      availability,
      prepare,
      launch,
      progress,
      card,
    });
  }
  return sources;
}
