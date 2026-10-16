import { createHash } from 'node:crypto';
import { DEFAULT_JOURNEY_ROUTES } from '../game/content-design/default-entry.mjs';
import { loadAuthoredJourneyRoute } from '../game/content-design/route-loader.mjs';
import { compileContentProject } from '../game/content-design/project.mjs';
import { AUTHORED_JOURNEY_ROUTE_IDS } from '../game/content-design/mode-href.mjs';
import { authoredPackageId } from '../game/content-design/offline-packages.mjs';
import { buildJourneyView, projectHash, routeMetadata } from './published-navigation.mjs';
import {
  spatialNextPriorEditions,
  spatialNextPriorEditionProjection,
} from '../game/mission-library/spatial-next-editions.mjs';
import { createTeamImpactOriginalCandidates } from '../game/content-design/team-impact-originals.mjs';
import { COOP_STARTER_PACK, coopGoalText } from '../game/coop/library.mjs';
import {
  TEAM_LIBRARY_CLASSIC_SOURCE,
  TEAM_LIBRARY_JOURNEY_EDITION,
} from '../game/mission-library/team-source.mjs';

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

/** Publish lightweight complete navigation and independently pinned whole-pack
 * sources. Mode runtimes and historical routes retain exact full-source snapshots;
 * Solo starts with Horizon and materializes other packs only after preparation. */
export async function addAuthoredRuntimeSnapshots(entries) {
  const loader = entries.find((entry) => entry.name === 'game/content-design/route-loader.mjs');
  const marker = 'const SHIPPED_ROUTE_SNAPSHOT = null;';
  if (!loader?.bytes.toString().includes(marker)) return null;
  const route = await loadAuthoredJourneyRoute(DEFAULT_JOURNEY_ROUTES.solo);
  compileContentProject(route.source);
  const descriptor = (path, value) => {
    const bytes = Buffer.from(JSON.stringify(value));
    entries.push({ name: `game/content-design/${path}`, bytes });
    return { path, bytes: bytes.length, sha256: digest(bytes) };
  };
  const routes = [];
  for (const id of AUTHORED_JOURNEY_ROUTE_IDS) {
    const historical = id === route.id ? route : await loadAuthoredJourneyRoute(id);
    routes.push({
      route: historical,
      descriptor: { id, ...descriptor(`runtime/${id}.json`, historical) },
    });
  }
  const chapters = route.source.packs.map((pack) => {
    const source = chapterSource(route.source, pack.id);
    const name = `game/content-design/runtime/chapter-${pack.id}.json`;
    const content = Buffer.from(JSON.stringify(source));
    entries.push({ name, bytes: content });
    return {
      pack,
      source,
      path: name,
      descriptor: {
        packId: pack.id,
        path: name.slice('game/content-design/'.length),
        bytes: content.length,
        sha256: digest(content),
        core: pack.id === 'journey-opening',
        groups: {
          solo: authoredPackageId(route.id, 'solo', pack.id),
          versus: authoredPackageId(route.id, 'versus', pack.id),
        },
      },
    };
  });
  const cards = {};
  const archives = spatialNextPriorEditions(route.id).map(({ routeId, missionIds }) => {
    const prior = routes.find((item) => item.route.id === routeId).route;
    const projected = spatialNextPriorEditionProjection(prior.source, missionIds);
    return {
      route: routeMetadata(prior),
      views: {
        solo: buildJourneyView(projected, 'solo', cards, prior.source),
        versus: buildJourneyView(projected, 'versus', cards, prior.source),
      },
    };
  });
  const teamSource = createTeamImpactOriginalCandidates({ artwork: true });
  const navigation = {
    format: 'revealline-journey-navigation.v1',
    project: {
      id: route.source.id,
      revision: route.source.revision,
      sha256: projectHash(route.source),
      difficultyCatalogId: route.source.difficultyCatalogId,
    },
    starterPackId: 'journey-opening',
    chapters: chapters.map((item) => item.descriptor),
    views: {
      solo: buildJourneyView(route.source, 'solo', cards),
      versus: buildJourneyView(route.source, 'versus', cards),
    },
    team: {
      route: {
        id: TEAM_LIBRARY_JOURNEY_EDITION,
        label: 'Team Journey',
        profileKey: TEAM_LIBRARY_JOURNEY_EDITION,
      },
      view: buildJourneyView(teamSource, 'team', cards),
      arenas: {
        sourceId: TEAM_LIBRARY_CLASSIC_SOURCE,
        editionId: `${COOP_STARTER_PACK.id}@${COOP_STARTER_PACK.revision}`,
        edition: 'Relay Rescue · Classic arenas',
        packId: COOP_STARTER_PACK.id,
        revision: COOP_STARTER_PACK.revision,
        packName: COOP_STARTER_PACK.name,
        rows: COOP_STARTER_PACK.levels.map((level, levelIndex) => ({
          levelId: level.id,
          title: level.name,
          goal: coopGoalText(level),
          levelIndex,
        })),
      },
    },
    archives,
    cards,
  };
  const published = { ...routeMetadata(route), navigation };
  const navigationDescriptor = {
    id: route.id,
    ...descriptor(`runtime/navigation-${route.id}.json`, published),
  };
  const routeDescriptors = Object.fromEntries(
    routes.map((item) => [item.route.id, item.descriptor]),
  );
  loader.bytes = Buffer.from(
    `import { loadRouteSnapshot } from './route-snapshot.mjs';\nconst CURRENT = ${JSON.stringify(navigationDescriptor)};\nconst ROUTES = ${JSON.stringify(routeDescriptors)};\nexport async function loadAuthoredJourneyRoute(id, options = {}) {\n  const descriptor = id === CURRENT.id && !options.fullSource ? CURRENT : ROUTES[id];\n  return descriptor ? loadRouteSnapshot(descriptor, options) : null;\n}\n`,
  );
  return { route, chapters, routes, published, navigationDescriptor };
}
