import { loadDemoSources } from '../demo-sources.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { campaignKey } from '../library.mjs';
import { prepareMissionLibraryIndex } from '../mission-library/classic-source.mjs';
import { soloClassicDemoLaunchURL } from './solo-classic-launch.mjs';
import { createExternalChapterInventoryReader } from '../external-chapter-pointer.mjs';
import { createMissionLibraryInventory } from '../mission-library/installed-inventory.mjs';
import { loadBuiltinSoloDemoSources, mergeBuiltinSoloDemoSources } from './solo-builtins.mjs';

/** Exact ordinary mission lookup; the destination repeats its normal content
 * and departure checks. No custom source can acquire an authored public URL. */
export function soloDemoLaunchURL(source, index) {
  const entry = source.entry;
  if (!entry) return null;
  const row = index.missions.find(
    (row) =>
      ['base', 'bundled', 'archived'].includes(row.source) &&
      row.campaignKey === campaignKey(entry.campaign) &&
      row.packId === (entry.sourcePackId ?? null) &&
      row.levelId === source.levelId &&
      row.levelRevision === source.level.revision &&
      row.modes.includes('solo'),
  );
  if (!row) return null;
  return soloClassicDemoLaunchURL(row);
}

/** Read-only base-game context for a demo opened from another engine. No app,
 * profile writer, optional download or personal recording collection is started. */
export async function loadStandaloneSoloContext({
  signal,
  fetch: fetcher = globalThis.fetch,
  inventoryReader = createExternalChapterInventoryReader,
} = {}) {
  const read = async (path) => {
    const response = await fetcher(new URL(path, import.meta.url), { signal });
    if (!response.ok)
      throw Object.assign(new Error('Solo demo content is unavailable.'), {
        code: 'package-unavailable',
      });
    return response.json();
  };
  const [campaign, themes, classRecipes, presets, indexSource] = await Promise.all([
    read('../content/campaign.json'),
    read('../content/themes.json'),
    read('../content/classes.json'),
    read('../../authoring/motion-lab/presets.json'),
    read('../content/mission-library-index.json'),
  ]);
  const index = prepareMissionLibraryIndex(indexSource);
  const authored = [
    {
      campaign,
      themes: themes.themes,
      classRecipes,
      visualOverrides: {},
      levelVisuals: [],
      music: [],
      sourcePackId: null,
    },
  ];
  let inventory;
  try {
    let channel = 'dev';
    try {
      const info = await read('../build-info.json');
      if (/^v?\d+\.\d+\.\d+$/.test(info.version)) channel = `release-${info.version}`;
    } catch {
      signal?.throwIfAborted();
    }
    // This existing reader aborts absent-database upgrades. It never creates a
    // profile, acquires a writer, downloads packs or changes recovery markers.
    inventory = await createMissionLibraryInventory({
      reader: inventoryReader({
        profileKey: `revealline.library.${channel}.v1`,
        packsKey: `revealline.packs.${channel}.v1`,
      }),
    });
    const metadata = await inventory.refresh({ signal });
    for (const pack of metadata.packs) {
      const rows = index.missions.filter(
        (row) =>
          ['bundled', 'archived'].includes(row.source) &&
          row.packId === pack.id &&
          row.packVersion === pack.version &&
          row.packIdentity?.sha256 === pack.identity.sha256 &&
          row.packIdentity?.bytes === pack.identity.bytes,
      );
      for (const entry of pack.entries)
        if (rows.some((row) => row.campaignKey === campaignKey(entry.campaign)))
          authored.push({ ...entry, visualOverrides: {}, levelVisuals: [] });
    }
  } catch {
    signal?.throwIfAborted();
    // Unavailable/locked installed content stays unavailable; the base remains
    // independent. No repair, installation or persistence fallback is attempted.
  } finally {
    inventory?.close();
  }
  const entries = createExecutionCatalog(authored).entries;
  return {
    entries,
    presets,
    loadSources: async ({ signal }) => {
      const [classic, builtins] = await Promise.all([
        loadDemoSources({
          entries,
          signal,
          library: { list: async () => [] },
          fetch: fetcher,
        }),
        loadBuiltinSoloDemoSources({ signal, fetch: fetcher, index }).catch((error) => {
          signal?.throwIfAborted();
          if (error.name === 'AbortError') throw error;
          return [];
        }),
      ]);
      return mergeBuiltinSoloDemoSources(
        classic.map((source) => ({
          ...source,
          modeId: 'solo',
          launchURL: soloDemoLaunchURL(source, index),
        })),
        builtins,
      );
    },
  };
}
