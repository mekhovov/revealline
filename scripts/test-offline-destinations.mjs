import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildOfflineDestinations, buildNavigationBootstraps } from './offline-destinations.mjs';
import { CULTURAL_TEAM_OFFLINE_PROJECT_FACTORIES } from './offline-content.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../game/content-design/default-entry.mjs';
import { classifyContent } from '../game/content-design/content-lifecycle.mjs';
import { AUTHORED_JOURNEY_ROUTE_IDS } from '../game/content-design/mode-href.mjs';
import { loadAuthoredJourneyRoute } from '../game/content-design/route-loader.mjs';
import { createTeamImpactOriginalCandidates } from '../game/content-design/team-impact-originals.mjs';
import { createTeamCulturalSpecialistOriginalCandidates } from '../game/content-design/team-cultural-specialist-originals.mjs';
import { createTeamCulturalSpecialistV2OriginalCandidates } from '../game/content-design/team-cultural-specialist-v2-originals.mjs';
import { journeyMissionId } from '../game/journey/catalog.mjs';
import { libraryMissionId } from '../game/mission-library/library.mjs';

const route = await loadAuthoredJourneyRoute('whole-spatial-v11');
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
    route: { id },
    descriptor: { path: `runtime/${id}.json` },
  }));
  const rows = buildNavigationBootstraps({ journeys, currentRouteId: route.id });
  assert.equal(rows.length, journeys.length * 2 - 1);
  assert.equal(rows.filter((row) => row.path === 'game/index.html').length, journeys.length - 1);
  assert(!rows.some((row) => row.path === 'game/index.html' && row.routeId === route.id));
  for (const row of rows) {
    assert(AUTHORED_JOURNEY_ROUTE_IDS.includes(row.routeId));
    assert.deepEqual(row.files, [`game/content-design/runtime/${row.routeId}.json`]);
    assert.equal(Object.keys(row).length, 3);
  }
  assert(
    JSON.stringify(rows).length < 12000,
    'bootstrap metadata stays bounded independently of the mission table',
  );
});
