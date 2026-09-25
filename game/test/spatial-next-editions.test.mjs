import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createSpatialNextEditionSources,
  spatialNextPriorEditionProjection,
} from '../mission-library/spatial-next-editions.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { journeyLibrarySource } from '../mission-library/journey-source.mjs';
import { librarySuccessor } from '../mission-library/continuous-next.mjs';
import { missionLibraryHref, readMissionLibraryHandoff } from '../mission-library/handoff.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { authoredJourneyMissionTags } from '../mission-library/journey-presentation.mjs';

const originalThemes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
).themes;
const revised = ['stepping-stones', 'return-pocket', 'neutral-ground'];
const revisedHorizon = ['island-outpost', 'long-way-home', 'horizon-remix'];
const sourceId = (row) => row.runtimeId.split('/').at(-1);

test('prior-edition qualification is bounded to the three preserved mission owners', async () => {
  const route = await loadAuthoredJourneyRoute('whole-spatial-v9');
  const projected = spatialNextPriorEditionProjection(route.source);
  assert.deepEqual(projected.missions.map((mission) => mission.id).toSorted(), revised.toSorted());
  assert.equal(projected.maps.length, 3);
  assert.equal(projected.campaigns.length, 3);
  assert.equal(projected.packs.length, 3);
  assert.equal(projected.assets.length, 3);
  assert.equal(projected.campaigns.flatMap((campaign) => campaign.missionIds).length, 3);
  assert.equal(projected.packs.flatMap((pack) => pack.campaignIds).length, 3);
});

test('bounded prior projection preserves exact v9 manifests across modes and presets', async () => {
  const route = await loadAuthoredJourneyRoute('whole-spatial-v9');
  const full = compileContentProject(route.source);
  const projected = compileContentProject(spatialNextPriorEditionProjection(route.source));
  for (const id of revised)
    for (const mode of ['solo', 'versus'])
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        const expected = resolveMission(full, id, { mode, difficulty });
        const actual = resolveMission(projected, id, { mode, difficulty });
        assert.equal(actual.simulationIdentity, expected.simulationIdentity);
        assert.deepEqual(actual.level, expected.level);
        assert.deepEqual(actual.presentation, expected.presentation);
        assert.deepEqual(actual.background, expected.background);
        assert.deepEqual(actual.design, expected.design);
      }
});

test('bounded Horizon projection preserves exact v10 manifests across modes and presets', async () => {
  const route = await loadAuthoredJourneyRoute('whole-spatial-v10');
  const full = compileContentProject(route.source);
  const projection = spatialNextPriorEditionProjection(route.source, revisedHorizon);
  const projected = compileContentProject(projection);
  assert.deepEqual(
    projection.missions.map((mission) => mission.id).toSorted(),
    revisedHorizon.toSorted(),
  );
  assert.equal(projected.source.maps.length, 3);
  for (const id of revisedHorizon)
    for (const mode of ['solo', 'versus'])
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        const expected = resolveMission(full, id, { mode, difficulty });
        const actual = resolveMission(projected, id, { mode, difficulty });
        assert.equal(actual.simulationIdentity, expected.simulationIdentity);
        assert.deepEqual(actual.level, expected.level);
        assert.deepEqual(actual.presentation, expected.presentation);
        assert.deepEqual(actual.background, expected.background);
        assert.deepEqual(actual.design, expected.design);
      }
});

test('v11 selector exposes three v10 Horizon cards while retaining three v9 cards', async (t) => {
  const launches = [];
  const started = performance.now();
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v11',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  assert(
    performance.now() - started < 2500,
    'Six prior cards must use two bounded three-mission projections.',
  );
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 6);
  assert.equal(library.forMode('solo').length, 6);
  assert.equal(library.forMode('versus').length, 6);
  assert.equal(library.forMode('team').length, 0);
  assert.deepEqual(
    library.missions
      .filter((row) => row.editionId === 'whole-spatial-v10')
      .map(sourceId)
      .toSorted(),
    revisedHorizon.toSorted(),
  );
  assert.deepEqual(
    library.missions
      .filter((row) => row.editionId === 'whole-spatial-v9')
      .map(sourceId)
      .toSorted(),
    revised.toSorted(),
  );
  for (const row of library.missions) {
    assert.equal(row.automaticContinuation, false);
    assert.match(row.edition, /^Previous Journey · v(?:9|10)$/);
    assert.equal(await library.launch(row, { mode: 'solo' }), true);
    assert.equal(launches.at(-1).libraryMissionId, row.id);
    assert.equal(launches.at(-1).mode, 'solo');
    const target = new URL(
      missionLibraryHref({
        baseURL: 'https://example.test/releases/current/site/game/',
        currentMode: 'versus',
        mode: 'solo',
        journey: row.editionId,
        missionId: row.id,
        sourceJourney: 'whole-spatial-v11',
      }),
    );
    assert.equal(target.searchParams.get('journey'), row.editionId);
    assert.equal(readMissionLibraryHandoff(target.searchParams), row.id);
  }
});

test('v11 active Horizon and exact v10 cards stay distinct and never cross edition on Next', async (t) => {
  const activeRoute = await loadAuthoredJourneyRoute('whole-spatial-v11');
  const priorRoute = await loadAuthoredJourneyRoute('whole-spatial-v10');
  const themes = journeyActorThemeCandidates(originalThemes, { includeOriginals: true });
  const activeHost = createCandidateVersusHost(activeRoute.source, {
    themes,
    corePackIds: activeRoute.corePackIds,
    optionalCampaignIds: activeRoute.optionalCampaignIds,
  });
  const priorHost = createCandidateVersusHost(priorRoute.source, {
    themes,
    corePackIds: priorRoute.corePackIds,
    optionalCampaignIds: priorRoute.optionalCampaignIds,
  });
  let selected;
  const owner = await createSpatialNextEditionSources({
    activeRouteId: activeRoute.id,
    originalThemes,
    launch: (context) => {
      selected = context;
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary([
    journeyLibrarySource({
      editionId: activeRoute.id,
      edition: 'New Journey',
      catalog: activeHost.catalog,
      tags: (mission) => authoredJourneyMissionTags(mission, activeHost.manifest(mission)),
      launch: () => true,
    }),
    ...owner.sources,
  ]);
  assert.equal(library.missions.length, activeHost.catalog.missions.length + 6);
  const activeRows = library
    .forMode('versus')
    .filter((row) => row.editionId === 'whole-spatial-v11');
  const boundary = activeRows.findIndex(
    (row, index) => activeRows[index + 1] && row.campaignKey !== activeRows[index + 1].campaignKey,
  );
  assert(boundary >= 0);
  assert.equal(librarySuccessor(library, activeRows[boundary], 'versus'), activeRows[boundary + 1]);
  assert.equal(
    librarySuccessor(library, activeRows.at(-1), 'versus'),
    null,
    'The final current card skips both manual prior-edition sources.',
  );
  for (const id of revisedHorizon) {
    const runtimeId = activeHost.catalog.missions.find((mission) => mission.levelId === id).id;
    const editions = library.missions.filter((row) => row.runtimeId === runtimeId);
    assert.equal(editions.length, 2);
    assert.deepEqual(
      new Set(editions.map((row) => row.editionId)),
      new Set(['whole-spatial-v10', 'whole-spatial-v11']),
    );
    const prior = editions.find((row) => row.editionId === 'whole-spatial-v10');
    const active = editions.find((row) => row.editionId === 'whole-spatial-v11');
    assert(active.tags.includes('Ukrainian'));
    assert(!prior.tags.includes('Ukrainian'));
    assert.equal(await library.launch(prior, { mode: 'versus' }), true);
    assert.equal(selected.libraryMissionId, prior.id);
    assert.equal(selected.mode, 'versus');
    assert.equal(priorHost.catalog.find(prior.runtimeId)?.levelId, id);
    assert.equal(librarySuccessor(library, prior, 'versus'), null);
  }
});

test('v10 selector exposes exactly three separately qualified v9 cards in Solo and Versus', async (t) => {
  const launches = [];
  const started = performance.now();
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v10',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  assert(
    performance.now() - started < 2500,
    'Three prior cards must not compile the complete 91-mission edition at selector startup.',
  );
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 3);
  assert.equal(library.forMode('solo').length, 3);
  assert.equal(library.forMode('versus').length, 3);
  assert.equal(library.forMode('team').length, 0);
  assert.deepEqual(library.missions.map(sourceId).toSorted(), revised.toSorted());
  for (const row of library.missions) {
    assert.equal(row.ownerId, 'journey:whole-spatial-v9');
    assert.equal(row.editionId, 'whole-spatial-v9');
    assert.equal(row.edition, 'Previous Journey · v9');
    assert.equal(row.automaticContinuation, false);
    for (const mode of ['solo', 'versus']) {
      assert.equal(library.availability(row, mode).state, 'ready');
      assert.equal(await library.launch(row, { mode }), true);
      assert.equal(launches.at(-1).libraryMissionId, row.id);
      assert.equal(launches.at(-1).mode, mode);
      const target = new URL(
        missionLibraryHref({
          baseURL: 'https://example.test/releases/current/site/game/',
          currentMode: mode === 'solo' ? 'versus' : 'solo',
          mode,
          journey: row.editionId,
          missionId: row.id,
          sourceJourney: 'whole-spatial-v10',
        }),
      );
      assert.equal(target.searchParams.get('journey'), 'whole-spatial-v9');
      assert.equal(readMissionLibraryHandoff(target.searchParams), row.id);
    }
  }
});

test('current and prior cards stay distinct while manual launch retains the full receiving edition', async (t) => {
  const activeRoute = await loadAuthoredJourneyRoute('whole-spatial-v10');
  const priorRoute = await loadAuthoredJourneyRoute('whole-spatial-v9');
  const themes = journeyActorThemeCandidates(originalThemes, { includeOriginals: true });
  const activeHost = createCandidateVersusHost(activeRoute.source, {
    themes,
    corePackIds: activeRoute.corePackIds,
    optionalCampaignIds: activeRoute.optionalCampaignIds,
  });
  const priorHost = createCandidateVersusHost(priorRoute.source, {
    themes,
    corePackIds: priorRoute.corePackIds,
    optionalCampaignIds: priorRoute.optionalCampaignIds,
  });
  let selected;
  const owner = await createSpatialNextEditionSources({
    activeRouteId: activeRoute.id,
    originalThemes,
    launch: (context) => {
      selected = context;
      return true;
    },
  });
  t.after(() => {
    owner.dispose();
  });
  const library = createMissionLibrary([
    journeyLibrarySource({
      editionId: activeRoute.id,
      edition: 'New Journey',
      catalog: activeHost.catalog,
      tags: (mission) => authoredJourneyMissionTags(mission, activeHost.manifest(mission)),
      launch: () => true,
    }),
    ...owner.sources,
  ]);
  assert.equal(library.missions.length, activeHost.catalog.missions.length + 3);
  const activeRows = library
    .forMode('versus')
    .filter((row) => row.editionId === 'whole-spatial-v10');
  const boundary = activeRows.findIndex(
    (row, index) => activeRows[index + 1] && row.campaignKey !== activeRows[index + 1].campaignKey,
  );
  assert(boundary >= 0);
  assert.equal(librarySuccessor(library, activeRows[boundary], 'versus'), activeRows[boundary + 1]);
  assert.equal(
    librarySuccessor(library, activeRows.at(-1), 'versus'),
    null,
    'The final v10 card skips manual-only v9 cards instead of switching editions.',
  );
  for (const id of revised) {
    const runtimeId = activeHost.catalog.missions.find((mission) => mission.levelId === id).id;
    const editions = library.missions.filter((row) => row.runtimeId === runtimeId);
    assert.equal(editions.length, 2);
    assert.deepEqual(
      new Set(editions.map((row) => row.editionId)),
      new Set(['whole-spatial-v9', 'whole-spatial-v10']),
    );
    assert.notEqual(editions[0].id, editions[1].id);

    const prior = editions.find((row) => row.editionId === 'whole-spatial-v9');
    const active = editions.find((row) => row.editionId === 'whole-spatial-v10');
    assert(active.tags.includes('Ukrainian'));
    assert(!prior.tags.includes('Ukrainian'));
    assert.equal(await library.launch(prior, { mode: 'versus' }), true);
    assert.equal(selected.libraryMissionId, prior.id);
    assert.equal(selected.mode, 'versus');
    const receiver = priorHost.catalog.find(prior.runtimeId);
    assert(receiver, 'The full prior host owns the exact runtime identity.');
    assert.equal(receiver.levelId, id);
    const successor = librarySuccessor(library, prior, 'versus');
    assert.equal(successor, null, 'A manually selected v9 card has no cross-edition library Next.');
  }
});

test('unrelated editions allocate no selector adapter or browsing dependency', async () => {
  for (const activeRouteId of [
    undefined,
    'legacy',
    'whole-spatial-v9',
    'team-spatial-originals-1',
  ]) {
    const owner = await createSpatialNextEditionSources({ activeRouteId });
    assert.deepEqual(owner.sources, []);
    owner.dispose();
  }
  await assert.rejects(
    createSpatialNextEditionSources({ activeRouteId: 'whole-spatial-v10' }),
    /exact mission handoff/,
  );
});
