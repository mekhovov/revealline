import { createHash } from 'node:crypto';
import { DEFAULT_JOURNEY_ROUTES } from '../game/content-design/default-entry.mjs';
import { loadAuthoredJourneyRoute } from '../game/content-design/route-loader.mjs';
import { compileContentProject } from '../game/content-design/project.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Keep whole campaign identities: slicing missions inside a campaign changes saves. */
export function chapterSource(source, packId) {
  const pack = source.packs.find((item) => item.id === packId);
  if (!pack) throw new Error('Unknown authored package.');
  const campaigns = source.campaigns.filter((item) => pack.campaignIds.includes(item.id));
  const ids = new Set(campaigns.flatMap((item) => item.missionIds));
  const missions = source.missions.filter((item) => ids.has(item.id));
  const maps = new Set(missions.map((item) => JSON.stringify([item.map.id, item.map.revision])));
  const assets = new Set(missions.map((item) => item.presentation.backgroundAssetId));
  const result = {
    ...source,
    packs: [pack],
    campaigns,
    missions,
    maps: source.maps.filter((item) => maps.has(JSON.stringify([item.id, item.revision]))),
    assets: (source.assets || []).filter((item) => assets.has(item.id)),
  };
  // Same validator as authored hosts; archive/import limits are never bypassed.
  compileContentProject(result);
  return result;
}

/** New distributions use a pinned flattened current source. The complete small
 * source keeps future missions visible and progress intact; each artwork package
 * also carries its standalone campaign snapshot for dependency verification. */
export async function addAuthoredRuntimeSnapshots(entries) {
  const loader = entries.find((entry) => entry.name === 'game/content-design/route-loader.mjs');
  const marker = 'const SHIPPED_ROUTE_SNAPSHOT = null;';
  if (!loader?.bytes.toString().includes(marker)) return null;
  const route = await loadAuthoredJourneyRoute(DEFAULT_JOURNEY_ROUTES.solo);
  compileContentProject(route.source);
  const bytes = Buffer.from(JSON.stringify(route));
  const path = `runtime/${route.id}.json`;
  entries.push({ name: `game/content-design/${path}`, bytes });
  loader.bytes = Buffer.from(
    loader.bytes
      .toString()
      .replace(
        marker,
        `const SHIPPED_ROUTE_SNAPSHOT = ${JSON.stringify({ id: route.id, path, bytes: bytes.length, sha256: digest(bytes) })};`,
      ),
  );
  const chapters = route.source.packs.map((pack) => {
    const source = chapterSource(route.source, pack.id);
    const name = `game/content-design/runtime/chapter-${pack.id}.json`;
    const content = Buffer.from(JSON.stringify(source));
    entries.push({ name, bytes: content });
    return { pack, source, path: name };
  });
  return { route, chapters };
}
