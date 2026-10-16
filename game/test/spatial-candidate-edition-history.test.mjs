import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import {
  createSpatialNextEditionSources,
  spatialNextPriorEditions,
  spatialNextPriorEditionProjection,
} from '../mission-library/spatial-next-editions.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { librarySuccessor } from '../mission-library/continuous-next.mjs';
import { missionLibraryHref, readMissionLibraryHandoff } from '../mission-library/handoff.mjs';

const routes = new Map();
async function route(id) {
  if (!routes.has(id)) routes.set(id, await loadAuthoredJourneyRoute(id, { fullSource: true }));
  return routes.get(id);
}

for (let version = 26; version <= 38; version++)
  test(`v${version} retains only changed predecessor missions and inherits earlier distinct editions`, async () => {
    const active = await route(`whole-spatial-v${version}`);
    const previous = await route(`whole-spatial-v${version - 1}`);
    const history = spatialNextPriorEditions(active.id);
    const added = history[0];
    const changed = active.source.missions
      .filter(
        (mission) =>
          !isDeepStrictEqual(
            mission,
            previous.source.missions.find((item) => item.id === mission.id),
          ),
      )
      .map((mission) => mission.id);
    assert.equal(added.routeId, previous.id);
    assert.deepEqual(added.missionIds.toSorted(), changed.toSorted());
    assert(added.missionIds.length > 0 && added.missionIds.length <= 12);
    assert.deepEqual(history.slice(1), spatialNextPriorEditions(previous.id));
    assert.equal(new Set(history.map((entry) => entry.routeId)).size, history.length);
    assert(Object.isFrozen(history));
    assert(Object.isFrozen(added));
    assert(Object.isFrozen(added.missionIds));

    const before = JSON.stringify(previous.source);
    const projection = spatialNextPriorEditionProjection(previous.source, added.missionIds);
    assert.equal(projection.id, previous.source.id);
    assert.equal(projection.revision, previous.source.revision);
    for (const key of ['policyId', 'actorCatalogId', 'difficultyCatalogId'])
      assert.equal(projection[key], previous.source[key]);
    assert.equal(projection.missions.length, added.missionIds.length);
    assert.equal(projection.maps.length, added.missionIds.length);
    assert.equal(projection.assets.length, added.missionIds.length);
    for (const mission of projection.missions) {
      assert.equal(
        mission,
        previous.source.missions.find((item) => item.id === mission.id),
      );
      const campaign = previous.source.campaigns.find((item) =>
        item.missionIds.includes(mission.id),
      );
      const pack = previous.source.packs.find((item) => item.campaignIds.includes(campaign.id));
      const projectedCampaign = projection.campaigns.find((item) => item.id === campaign.id);
      const projectedPack = projection.packs.find((item) => item.id === pack.id);
      assert.deepEqual(projectedCampaign, {
        ...campaign,
        missionIds: campaign.missionIds.filter((id) => added.missionIds.includes(id)),
      });
      assert.deepEqual(projectedPack, {
        ...pack,
        campaignIds: pack.campaignIds.filter((id) =>
          projection.campaigns.some((item) => item.id === id),
        ),
      });
    }

    // Qualify only the changed missions, keeping each full edition's source
    // identity and rules. Unrelated campaign missions are never compiled here.
    const compiled = compileContentProject(projection);
    const successor = compileContentProject(
      spatialNextPriorEditionProjection(active.source, added.missionIds),
    );
    for (const mission of projection.missions)
      for (const mode of ['solo', 'versus'])
        for (const difficulty of ['gentle', 'standard', 'expert']) {
          const prior = resolveMission(compiled, mission.id, { mode, difficulty });
          const next = resolveMission(successor, mission.id, { mode, difficulty });
          assert.equal(prior.level.revision, mission.revision);
          assert.deepEqual(prior.design, mission.design);
          assert.deepEqual(prior.presentation, mission.presentation);
          assert.deepEqual(
            prior.background,
            previous.source.assets.find(
              (asset) => asset.id === mission.presentation.backgroundAssetId,
            ),
          );
          assert.notEqual(prior.simulationIdentity, next.simulationIdentity);
          assert.equal(prior.officialProgressEligible, false);
          assert.equal(prior.validation, 'compiled-candidate-not-playtested');
        }
    assert.equal(JSON.stringify(previous.source), before);
  });

test('v37 history adds 33 prior cards without changing the default Journey or archive bounds', () => {
  const history = spatialNextPriorEditions('whole-spatial-v37');
  assert.equal(history.length, 28);
  assert.equal(
    history.reduce((count, entry) => count + entry.missionIds.length, 0),
    81,
  );
  assert.equal(
    history.slice(0, 12).reduce((count, entry) => count + entry.missionIds.length, 0),
    33,
  );
  assert.deepEqual(history.slice(12), spatialNextPriorEditions('whole-spatial-v25'));
  assert.deepEqual(DEFAULT_JOURNEY_ROUTES, {
    solo: 'whole-spatial-v25',
    versus: 'whole-spatial-v25',
    team: 'team-cultural-specialist-originals-2',
  });
  for (const id of ['latest', 'whole-spatial-v39', 'whole-spatial-v037', 'legacy'])
    assert.deepEqual(spatialNextPriorEditions(id), []);
});

test('v38 adds only the exact v37 Cooling loop archive without changing defaults or continuation', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('History browsing must not fetch media'));
  const history = spatialNextPriorEditions('whole-spatial-v38');
  assert.deepEqual(history[0], { routeId: 'whole-spatial-v37', missionIds: ['cooling-loop'] });
  assert.deepEqual(history.slice(1), spatialNextPriorEditions('whole-spatial-v37'));
  assert.equal(history.length, 29);
  assert.equal(
    history.reduce((count, entry) => count + entry.missionIds.length, 0),
    82,
  );
  assert.deepEqual(DEFAULT_JOURNEY_ROUTES, {
    solo: 'whole-spatial-v25',
    versus: 'whole-spatial-v25',
    team: 'team-cultural-specialist-originals-2',
  });
  const originalThemes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
  ).themes;
  const launches = [];
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v38',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 82);
  assert.equal(new Set(library.missions.map((mission) => mission.id)).size, 82);
  assert.equal(library.forMode('solo').length, 82);
  assert.equal(library.forMode('versus').length, 82);
  assert.equal(library.forMode('team').length, 0);
  const rows = library.missions.filter((mission) => mission.editionId === 'whole-spatial-v37');
  assert.equal(rows.length, 1);
  const row = rows[0];
  const previous = await route('whole-spatial-v37');
  const mission = previous.source.missions.find((item) => item.id === 'cooling-loop');
  const campaign = previous.source.campaigns.find((item) => item.missionIds.includes(mission.id));
  const pack = previous.source.packs.find((item) => item.campaignIds.includes(campaign.id));
  assert.equal(row.ownerId, 'journey:whole-spatial-v37');
  assert.equal(row.runtimeId, `candidate/${pack.id}/${campaign.id}/${mission.id}`);
  assert.equal(row.levelIndex, campaign.missionIds.indexOf(mission.id));
  assert.equal(row.hook, mission.design.routeDecision);
  assert.equal(row.lifecycle, 'archive');
  assert.equal(row.automaticContinuation, false);
  for (const mode of ['solo', 'versus']) {
    assert.equal(library.progress(row, mode), '');
    assert.equal(librarySuccessor(library, row, mode), null);
    assert.equal(await library.launch(row, { mode }), true);
    assert.equal(launches.at(-1).libraryMissionId, row.id);
    assert.equal(launches.at(-1).mode, mode);
    const href = missionLibraryHref({
      baseURL: 'https://example.test/frozen/game/',
      currentMode: 'solo',
      mode,
      journey: row.editionId,
      missionId: row.id,
      sourceJourney: 'whole-spatial-v38',
    });
    const params = new URL(href).searchParams;
    assert.equal(params.get('journey'), 'whole-spatial-v37');
    assert.equal(readMissionLibraryHandoff(params), row.id);
  }
});

test('v37 prior cards preserve exact owners and manual handoffs without fetching media', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('History browsing must not fetch media'));
  const originalThemes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
  ).themes;
  const launches = [];
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v37',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 81);
  assert.equal(library.forMode('solo').length, 81);
  assert.equal(library.forMode('versus').length, 81);
  assert.equal(library.forMode('team').length, 0);
  assert.equal(new Set(library.missions.map((mission) => mission.id)).size, 81);
  const addedHistory = spatialNextPriorEditions('whole-spatial-v37').slice(0, 12);
  const addedRows = library.missions.filter((mission) =>
    addedHistory.some((entry) => entry.routeId === mission.editionId),
  );
  assert.equal(addedRows.length, 33);
  for (const row of addedRows) {
    const previous = await route(row.editionId);
    const missionId = row.runtimeId.split('/').at(-1);
    const mission = previous.source.missions.find((item) => item.id === missionId);
    const campaign = previous.source.campaigns.find((item) => item.missionIds.includes(missionId));
    const pack = previous.source.packs.find((item) => item.campaignIds.includes(campaign.id));
    assert.equal(row.ownerId, `journey:${previous.id}`);
    assert.equal(row.runtimeId, `candidate/${pack.id}/${campaign.id}/${missionId}`);
    assert.equal(row.levelIndex, campaign.missionIds.indexOf(missionId));
    assert.equal(row.hook, mission.design.routeDecision);
    assert.equal(row.lifecycle, 'archive');
    assert.equal(row.automaticContinuation, false);
    for (const mode of ['solo', 'versus']) {
      assert.equal(library.progress(row, mode), '');
      assert.equal(librarySuccessor(library, row, mode), null);
      assert.equal(await library.launch(row, { mode }), true);
      assert.equal(launches.at(-1).libraryMissionId, row.id);
      assert.equal(launches.at(-1).mode, mode);
      const href = missionLibraryHref({
        baseURL: 'https://example.test/frozen/game/',
        currentMode: 'solo',
        mode,
        journey: row.editionId,
        missionId: row.id,
        sourceJourney: 'whole-spatial-v37',
      });
      const params = new URL(href).searchParams;
      assert.equal(params.get('journey'), previous.id);
      assert.equal(readMissionLibraryHandoff(params), row.id);
    }
  }
  // A mission revised again keeps both genuinely different earlier versions.
  assert.deepEqual(
    library.missions
      .filter((row) => row.runtimeId.endsWith('/side-door-bays'))
      .map((row) => row.editionId)
      .toSorted(),
    ['whole-spatial-v15', 'whole-spatial-v35'],
  );
});
