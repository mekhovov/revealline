import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildOfflineDestinations, buildNavigationBootstraps } from './offline-destinations.mjs';
import { AUTHORED_JOURNEY_ROUTE_IDS } from '../game/content-design/mode-href.mjs';
import { loadAuthoredJourneyRoute } from '../game/content-design/route-loader.mjs';
import { createTeamImpactOriginalCandidates } from '../game/content-design/team-impact-originals.mjs';
import { journeyMissionId } from '../game/journey/catalog.mjs';
import { libraryMissionId } from '../game/mission-library/library.mjs';

const route = await loadAuthoredJourneyRoute('whole-spatial-v11');
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
