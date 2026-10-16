import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildOfflineDestinations, buildNavigationBootstraps } from './offline-destinations.mjs';
import {
  CULTURAL_TEAM_OFFLINE_PROJECT_FACTORIES,
  TEAM_OFFLINE_PROJECT_FACTORIES,
} from './offline-content.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../game/content-design/default-entry.mjs';
import { classifyContent } from '../game/content-design/content-lifecycle.mjs';
import { AUTHORED_JOURNEY_ROUTE_IDS } from '../game/content-design/mode-href.mjs';
import { loadAuthoredJourneyRoute } from '../game/content-design/route-loader.mjs';
import { createTeamImpactOriginalCandidates } from '../game/content-design/team-impact-originals.mjs';
import { createTeamCulturalSpecialistOriginalCandidates } from '../game/content-design/team-cultural-specialist-originals.mjs';
import { createTeamCulturalSpecialistV2OriginalCandidates } from '../game/content-design/team-cultural-specialist-v2-originals.mjs';
import { authoredMissionDownloadGroup } from '../game/content-design/offline-packages.mjs';
import { journeyMissionId } from '../game/journey/catalog.mjs';
import { libraryMissionId } from '../game/mission-library/library.mjs';

const route = await loadAuthoredJourneyRoute('whole-spatial-v11');
const duelRoute = await loadAuthoredJourneyRoute('duel-expedition-v1');
const culturalTeamV1 = createTeamCulturalSpecialistOriginalCandidates({ artwork: true });
const culturalTeamV2 = createTeamCulturalSpecialistV2OriginalCandidates({ artwork: true });
const classicIndex = JSON.parse(
  await readFile(new URL('../game/content/mission-library-index.json', import.meta.url)),
);
const destinations = buildOfflineDestinations({
  journeys: [{ route }],
  teamProjects: [
    {
      routeId: 'team-trail-impact-originals-1',
      source: createTeamImpactOriginalCandidates({ artwork: true }),
    },
    { routeId: 'team-cultural-specialist-originals-1', source: culturalTeamV1 },
    { routeId: DEFAULT_JOURNEY_ROUTES.team, source: culturalTeamV2 },
  ],
  classicIndex,
  arenas: {
    rows: [],
    sourceId: 'team-classic:relay-rescue-starter',
    editionId: 'fixture',
    packId: 'fixture',
    revision: 1,
  },
});

test('every destination uses one complete approval group and explicit runtime dependency', () => {
  for (const destination of destinations) {
    assert.equal(destination.groups.length, 1, `${destination.mode}/${destination.routeId}`);
    assert(destination.runtimeGroups.length > 0);
  }
  const defaults = destinations.filter((item) => !item.libraryId);
  assert.deepEqual(
    defaults.find((item) => item.mode === 'versus' && item.routeId === 'legacy').groups,
    ['destination:versus:classic:base'],
  );
  assert.deepEqual(
    defaults.find((item) => item.mode === 'team' && item.routeId === 'legacy').groups,
    ['runtime:team'],
  );
});

function assertTeamDestination(routeId, teamSource, classification) {
  assert.equal(classifyContent({ family: 'team', id: routeId }), classification);
  const pack = teamSource.packs[0],
    campaign = teamSource.campaigns.find((item) => pack.campaignIds.includes(item.id)),
    mission = journeyMissionId({
      source: 'candidate',
      packId: pack.id,
      campaignId: campaign.id,
      levelId: campaign.missionIds[0],
    }),
    libraryId = libraryMissionId({
      owner: 'journey:' + routeId,
      edition: routeId,
      campaign: JSON.stringify(['candidate', pack.id, campaign.id]),
      mission,
    }),
    group = classification === 'current' ? 'team:' + pack.id : 'archive:team:' + routeId,
    root = destinations.find(
      (item) => item.mode === 'team' && item.routeId === routeId && !item.libraryId,
    ),
    selected = destinations.find(
      (item) => item.mode === 'team' && item.routeId === routeId && item.libraryId === libraryId,
    );
  for (const item of [root, selected]) {
    assert(item);
    assert.equal(item.path, 'game/couch/relay-rescue.html');
    assert.deepEqual(item.groups, [group]);
    assert.deepEqual(item.runtimeGroups, ['runtime:team']);
  }
}

test('Team lifecycle keeps cultural-v2 current and superseded editions archived', () => {
  assert.equal(DEFAULT_JOURNEY_ROUTES.team, 'team-cultural-specialist-originals-2');
  assert.deepEqual(CULTURAL_TEAM_OFFLINE_PROJECT_FACTORIES, [
    [
      'team-cultural-specialist-originals',
      'createTeamCulturalSpecialistOriginalCandidates',
      'team-cultural-specialist-originals-1',
    ],
    [
      'team-cultural-specialist-v2-originals',
      'createTeamCulturalSpecialistV2OriginalCandidates',
      DEFAULT_JOURNEY_ROUTES.team,
    ],
  ]);
  assertTeamDestination(
    'team-trail-impact-originals-1',
    createTeamImpactOriginalCandidates({ artwork: true }),
    'archived',
  );
  assertTeamDestination('team-cultural-specialist-originals-1', culturalTeamV1, 'archived');
  assertTeamDestination(DEFAULT_JOURNEY_ROUTES.team, culturalTeamV2, 'current');
});

test('authored destination selection keeps exact opaque owner IDs', () => {
  const pack = route.source.packs[0],
    campaign = route.source.campaigns.find((item) => pack.campaignIds.includes(item.id));
  const mission = journeyMissionId({
    source: 'candidate',
    packId: pack.id,
    campaignId: campaign.id,
    levelId: campaign.missionIds[0],
  });
  const libraryId = libraryMissionId({
    owner: `journey:${route.id}`,
    edition: route.id,
    campaign: JSON.stringify(['candidate', pack.id, campaign.id]),
    mission,
  });
  for (const mode of ['solo', 'versus'])
    assert.equal(
      destinations.filter(
        (item) => item.mode === mode && item.routeId === route.id && item.libraryId === libraryId,
      ).length,
      1,
    );
  assert.equal(
    new Set(
      destinations.map(({ path, routeId, libraryId = '' }) =>
        JSON.stringify([path, routeId, libraryId]),
      ),
    ).size,
    destinations.length,
  );
});

test('worker bootstrap mapping gates only exact optional source routes and keeps current Solo core', () => {
  const journeys = AUTHORED_JOURNEY_ROUTE_IDS.map((id) => ({
    route: id === duelRoute.id ? duelRoute : { id },
    descriptor: { path: `runtime/${id}.json` },
  }));
  const rows = buildNavigationBootstraps({ journeys, currentRouteId: route.id });
  assert.equal(rows.length, journeys.length * 2 - 2);
  assert.equal(rows.filter((row) => row.path === 'game/index.html').length, journeys.length - 2);
  assert(!rows.some((row) => row.path === 'game/index.html' && row.routeId === route.id));
  const maxRowBytes = 160;
  for (const row of rows) {
    assert(AUTHORED_JOURNEY_ROUTE_IDS.includes(row.routeId));
    assert.deepEqual(row.files, [`game/content-design/runtime/${row.routeId}.json`]);
    assert.equal(Object.keys(row).length, 3);
    assert(
      Buffer.byteLength(JSON.stringify(row)) <= maxRowBytes,
      `bootstrap row stays bounded: ${row.path}/${row.routeId}`,
    );
  }
  // Two brackets and the commas between route rows. Growth follows the explicit
  // route catalogue, never the number of missions contained by those routes.
  const arrayBytes = 2 + Math.max(0, rows.length - 1);
  assert(
    Buffer.byteLength(JSON.stringify(rows)) <= rows.length * maxRowBytes + arrayBytes,
    'bootstrap metadata stays bounded independently of the mission table',
  );
});

test('all 168 expeditions have independent current chapter downloads and exact supported destinations', async () => {
  const registered = TEAM_OFFLINE_PROJECT_FACTORIES.find(
    (item) => item[2] === 'team-expedition-v1',
  );
  assert(registered, 'Team source must participate in the production offline catalogue');
  const [module, factory, routeId] = registered;
  const source = (await import(`../game/content-design/${module}.mjs`))[factory]();
  const duel = duelRoute;
  const rows = buildOfflineDestinations({
    journeys: [{ route: duel }],
    teamProjects: [{ routeId, source }],
    classicIndex,
    arenas: { rows: [] },
  });
  for (const [id, mode, project, count] of [
    [routeId, 'team', source, 96],
    [duel.id, 'versus', duel.source, 72],
  ]) {
    const missions = rows.filter((row) => row.routeId === id && row.libraryId);
    assert.equal(missions.length, count);
    assert(
      missions.every((row) => row.mode === mode && row.runtimeGroups.includes(`runtime:${mode}`)),
    );
    assert.equal(new Set(missions.flatMap((row) => row.groups)).size, 12);
    for (const pack of project.packs) {
      const expected = `${mode}:${pack.id}`;
      const ownedIds = project.campaigns
        .filter((campaign) => pack.campaignIds.includes(campaign.id))
        .flatMap((campaign) => campaign.missionIds);
      assert.equal(missions.filter((row) => row.groups.includes(expected)).length, ownedIds.length);
      if (mode === 'versus')
        for (const missionId of ownedIds) {
          assert.equal(authoredMissionDownloadGroup(duel, mode, missionId), expected);
          assert.equal(authoredMissionDownloadGroup(duel, 'solo', missionId), null);
        }
    }
  }
  const bootstrap = buildNavigationBootstraps({
    journeys: [{ route: duel, descriptor: { path: 'runtime/duel-expedition-v1.json' } }],
    currentRouteId: DEFAULT_JOURNEY_ROUTES.solo,
  });
  assert.deepEqual(bootstrap, [
    {
      path: 'game/couch/index.html',
      routeId: duel.id,
      files: ['game/content-design/runtime/duel-expedition-v1.json'],
    },
  ]);
});
