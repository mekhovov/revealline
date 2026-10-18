#!/usr/bin/env node
/** Read-only inventory of authored Solo entries exposed by the ordinary chooser. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadAuthoredJourneyRoute } from '../game/content-design/route-loader.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../game/content-design/default-entry.mjs';
import { createSoloRouteHost } from '../game/content-design/solo-route-host.mjs';
import { spatialNextPriorEditions } from '../game/mission-library/spatial-next-editions.mjs';
import { supportsClassicCurrentRules } from '../game/mission-library/classic-current-rules.mjs';
import { campaignKey } from '../game/library.mjs';
import { dataIdentity } from '../game/data-json.mjs';
import { libraryMissionId } from '../game/mission-library/library.mjs';
import { journeyActorThemeCandidates } from '../game/presentation/journey-actor-materials.mjs';
import { authoredJourneyUsesActorMaterials } from '../game/content-design/mode-href.mjs';

const root = new URL('../', import.meta.url);
export async function soloJourneyDemoInventory({ onRoute = () => {} } = {}) {
  const originals = JSON.parse(
    await readFile(new URL('game/content-design/themes.json', root), 'utf8'),
  ).themes;
  const routes = [
    { routeId: DEFAULT_JOURNEY_ROUTES.solo, missionIds: null },
    ...spatialNextPriorEditions(DEFAULT_JOURNEY_ROUTES.solo),
  ];
  const inventory = [];
  for (const { routeId, missionIds } of routes) {
    const route = await loadAuthoredJourneyRoute(routeId, { fullSource: true });
    const themes = authoredJourneyUsesActorMaterials(route.id)
      ? journeyActorThemeCandidates(originals, {
          includeOriginals: route.preserveOriginalThemes === true,
        })
      : originals;
    const host = await createSoloRouteHost(route, { themes, buildVersion: 'demo-scope-audit' });
    try {
      for (const entry of host.entries.filter((entry) => entry.difficulty === 'standard'))
        for (const level of entry.campaign.levels) {
          if (missionIds && !missionIds.includes(level.id)) continue;
          const owner = campaignKey(entry.campaign);
          const mission = host.mission(entry, entry.campaign.levels.indexOf(level));
          inventory.push({
            id: `solo-qualified-${dataIdentity({ owner, levelId: level.id })}`,
            modeId: 'solo',
            routeId,
            catalogGroup: missionIds ? 'journey-archive' : 'journey-current',
            levelId: level.id,
            levelKey: `${owner}/${level.id}`,
            variantId: 'standard',
            missionId: mission.id,
            libraryMissionId: libraryMissionId({
              owner: `journey:${routeId}`,
              edition: routeId,
              campaign: JSON.stringify([mission.source, mission.packId, mission.campaignId]),
              mission: mission.id,
            }),
            entry,
            level,
          });
        }
    } finally {
      host.preparer.dispose();
    }
    onRoute({ routeId, required: inventory.filter((entry) => entry.routeId === routeId).length });
  }
  return inventory;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inventory = await soloJourneyDemoInventory({
    onRoute: (entry) => console.log(JSON.stringify(entry)),
  });
  const index = JSON.parse(
    await readFile(new URL('game/content/mission-library-index.json', root), 'utf8'),
  );
  const classic = index.missions.filter((row) =>
    ['base', 'bundled', 'archived'].includes(row.source),
  );
  const projections = classic.filter(supportsClassicCurrentRules);
  const report = {
    format: 'SoloDemoScopeAuditV1',
    defaultRoute: DEFAULT_JOURNEY_ROUTES.solo,
    sources: [
      'game/content-design/default-entry.mjs',
      'game/content-design/route-loader.mjs',
      'game/mission-library/spatial-next-editions.mjs',
      'game/content/mission-library-index.json',
      'game/runtime-content-provider.mjs',
    ],
    counts: {
      classicOriginals: classic.length,
      classicCurrentRules: projections.length,
      journeyCurrent: inventory.filter((entry) => entry.catalogGroup === 'journey-current').length,
      journeyArchive: inventory.filter((entry) => entry.catalogGroup === 'journey-archive').length,
    },
    required: classic.length + inventory.length,
    exclusions: [
      {
        kind: 'classic-current-rules',
        count: projections.length,
        reason:
          'Alternative rule/setup projections of the original authored Classic missions, which are covered at their original standard setup.',
      },
      {
        kind: 'company-editions',
        reason:
          'Separately selected URLs or compiled distributions; not entries in the ordinary default Solo chooser.',
      },
      {
        kind: 'optional-external',
        reason:
          'Separately installed external chapters are outside the built-in authored catalog; no demo entry installs them.',
      },
    ],
    journey: inventory.map(({ entry, level, ...metadata }) => ({
      ...metadata,
      campaignId: entry.campaign.id,
      levelRevision: level.revision,
      sourcePackId: entry.sourcePackId,
    })),
    classicCurrentRules: projections.map((row) => ({
      campaignKey: row.campaignKey,
      levelId: row.levelId,
      source: row.source,
    })),
    companyEditions:
      'Separate selected URLs or compiled distributions; not entries in the default Solo chooser.',
  };
  await writeFile(
    new URL('docs/qualification/solo-demo-scope.json', root),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const metadata = inventory.map(
    ({
      id,
      routeId,
      catalogGroup,
      levelId,
      levelKey,
      missionId,
      libraryMissionId,
      entry,
      level,
    }) => ({
      id,
      routeId,
      catalogGroup,
      levelId,
      levelKey,
      missionId,
      libraryMissionId,
      campaignKey: campaignKey(entry.campaign),
      title: level.name,
    }),
  );
  await writeFile(
    new URL('game/demo-modes/solo-builtins-index.mjs', root),
    `// Generated by scripts/audit-solo-demo-scope.mjs from the ordinary authored chooser.\nexport const SOLO_BUILTIN_DEMO_INDEX = ${JSON.stringify(metadata, null, 2)};\n`,
  );
  console.log(JSON.stringify(report.counts));
}
