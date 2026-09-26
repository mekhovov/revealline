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
const revisedBorder = ['second-landing', 'long-rail', 'new-frontier'];
const revisedBorderSignal = ['border-remix', 'dry-spine', 'wide-approach'];
const revisedEarlyCultural = ['nearby-shore', 'two-bays', 'behind-the-patrol'];
const revisedSignalCultural = ['soft-crossing', 'cool-the-crossing', 'signal-remix'];
const revisedNeonCultural = ['folded-corner', 'inside-out', 'side-door-bays'];
const revisedNeonFinale = ['dogleg-return', 'staggered-circuit', 'neon-remix'];
const revisedRoverCultural = ['wake-the-yard', 'between-the-rows', 'rover-remix'];
const revisedFractureCultural = ['first-fracture', 'two-districts', 'fracture-remix'];
const revisedPhaseworksCultural = ['return-in-reserve', 'two-ways-home', 'dogleg-transfer'];
const revisedLivewireCultural = ['read-the-lock', 'switchyard', 'split-junction'];
const revisedRelayCultural = ['first-link', 'second-approach', 'three-compounds'];
const revisedCrosswindCultural = ['read-the-arrows', 'windbreak-weave', 'long-wave'];
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

test('bounded Border projection preserves exact compiled v11 manifests across modes and presets', async () => {
  const route = await loadAuthoredJourneyRoute('whole-spatial-v11');
  const full = compileContentProject(route.source);
  const projection = spatialNextPriorEditionProjection(route.source, revisedBorder);
  const projected = compileContentProject(projection);
  assert.deepEqual(
    projection.missions.map((mission) => mission.id).toSorted(),
    revisedBorder.toSorted(),
  );
  assert.equal(projected.source.maps.length, 3);
  assert.equal(
    projected.missions.find((mission) => mission.id === 'new-frontier').revision,
    'pressure-v2-c4ed661aaea4b903',
  );
  for (const id of revisedBorder)
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

test('v12 selector exposes three v11 Border cards while retaining the six earlier cards', async (t) => {
  const launches = [];
  const started = performance.now();
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v12',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  assert(
    performance.now() - started < 3000,
    'Nine prior cards must use three bounded three-mission projections.',
  );
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 9);
  assert.equal(library.forMode('solo').length, 9);
  assert.equal(library.forMode('versus').length, 9);
  assert.equal(library.forMode('team').length, 0);
  assert.deepEqual(
    library.missions
      .filter((row) => row.editionId === 'whole-spatial-v11')
      .map(sourceId)
      .toSorted(),
    revisedBorder.toSorted(),
  );
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
    assert.match(row.edition, /^Previous Journey · v(?:9|10|11)$/);
    assert.equal(await library.launch(row, { mode: 'solo' }), true);
    assert.equal(launches.at(-1).libraryMissionId, row.id);
    assert.equal(launches.at(-1).mode, 'solo');
  }
});

test('v12 active Border cards and exact v11 cards stay distinct and stop prior-edition Next', async (t) => {
  const activeRoute = await loadAuthoredJourneyRoute('whole-spatial-v12');
  const priorRoute = await loadAuthoredJourneyRoute('whole-spatial-v11');
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
  assert.equal(library.missions.length, activeHost.catalog.missions.length + 9);
  const activeRows = library
    .forMode('versus')
    .filter((row) => row.editionId === 'whole-spatial-v12');
  const boundary = activeRows.findIndex(
    (row, index) => activeRows[index + 1] && row.campaignKey !== activeRows[index + 1].campaignKey,
  );
  assert(boundary >= 0);
  assert.equal(librarySuccessor(library, activeRows[boundary], 'versus'), activeRows[boundary + 1]);
  assert.equal(librarySuccessor(library, activeRows.at(-1), 'versus'), null);
  for (const id of revisedBorder) {
    const runtimeId = activeHost.catalog.missions.find((mission) => mission.levelId === id).id;
    const editions = library.missions.filter((row) => row.runtimeId === runtimeId);
    assert.equal(editions.length, 2);
    assert.deepEqual(
      new Set(editions.map((row) => row.editionId)),
      new Set(['whole-spatial-v11', 'whole-spatial-v12']),
    );
    const prior = editions.find((row) => row.editionId === 'whole-spatial-v11');
    const active = editions.find((row) => row.editionId === 'whole-spatial-v12');
    assert(active.tags.includes('Ukrainian'));
    assert(!prior.tags.includes('Ukrainian'));
    assert.equal(await library.launch(prior, { mode: 'versus' }), true);
    assert.equal(selected.libraryMissionId, prior.id);
    assert.equal(selected.mode, 'versus');
    assert.equal(priorHost.catalog.find(prior.runtimeId)?.levelId, id);
    assert.equal(librarySuccessor(library, prior, 'versus'), null);
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

test('v13 selector exposes three v12 Border/Signal cards and retains earlier history', async (t) => {
  const launches = [];
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v13',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 12);
  assert.equal(library.forMode('solo').length, 12);
  assert.equal(library.forMode('versus').length, 12);
  assert.equal(library.forMode('team').length, 0);
  assert.deepEqual(
    library.missions
      .filter((row) => row.editionId === 'whole-spatial-v12')
      .map(sourceId)
      .toSorted(),
    revisedBorderSignal.toSorted(),
  );
  assert.deepEqual(
    library.missions
      .filter((row) => row.editionId === 'whole-spatial-v11')
      .map(sourceId)
      .toSorted(),
    revisedBorder.toSorted(),
  );
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
    assert.match(row.edition, /^Previous Journey · v(?:9|10|11|12)$/);
    assert.equal(await library.launch(row, { mode: 'solo' }), true);
    assert.equal(launches.at(-1).libraryMissionId, row.id);
    assert.equal(launches.at(-1).mode, 'solo');
  }
});

test('v13 active cards and exact v12 cards stay distinct and stop prior-edition Next', async (t) => {
  const activeRoute = await loadAuthoredJourneyRoute('whole-spatial-v13');
  const priorRoute = await loadAuthoredJourneyRoute('whole-spatial-v12');
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
  assert.equal(library.missions.length, activeHost.catalog.missions.length + 12);
  const activeRows = library
    .forMode('versus')
    .filter((row) => row.editionId === 'whole-spatial-v13');
  const boundary = activeRows.findIndex(
    (row, index) => activeRows[index + 1] && row.campaignKey !== activeRows[index + 1].campaignKey,
  );
  assert(boundary >= 0);
  assert.equal(librarySuccessor(library, activeRows[boundary], 'versus'), activeRows[boundary + 1]);
  assert.equal(librarySuccessor(library, activeRows.at(-1), 'versus'), null);
  for (const id of revisedBorderSignal) {
    const runtimeId = activeHost.catalog.missions.find((mission) => mission.levelId === id).id;
    const editions = library.missions.filter((row) => row.runtimeId === runtimeId);
    assert.equal(editions.length, 2);
    assert.deepEqual(
      new Set(editions.map((row) => row.editionId)),
      new Set(['whole-spatial-v12', 'whole-spatial-v13']),
    );
    const prior = editions.find((row) => row.editionId === 'whole-spatial-v12');
    const active = editions.find((row) => row.editionId === 'whole-spatial-v13');
    assert(active.tags.includes('Ukrainian'));
    assert(!prior.tags.includes('Ukrainian'));
    assert.equal(await library.launch(prior, { mode: 'versus' }), true);
    assert.equal(selected.libraryMissionId, prior.id);
    assert.equal(selected.mode, 'versus');
    assert.equal(priorHost.catalog.find(prior.runtimeId)?.levelId, id);
    assert.equal(librarySuccessor(library, prior, 'versus'), null);
  }
});

test('v14 selector exposes three exact v13 early-route cards and retains earlier history', async (t) => {
  const launches = [];
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v14',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 15);
  assert.equal(library.forMode('solo').length, 15);
  assert.equal(library.forMode('versus').length, 15);
  assert.equal(library.forMode('team').length, 0);
  assert.deepEqual(
    library.missions
      .filter((row) => row.editionId === 'whole-spatial-v13')
      .map(sourceId)
      .toSorted(),
    revisedEarlyCultural.toSorted(),
  );
  for (const row of library.missions) {
    assert.equal(row.automaticContinuation, false);
    assert.match(row.edition, /^Previous Journey · v(?:9|10|11|12|13)$/);
    assert.equal(await library.launch(row, { mode: 'solo' }), true);
    assert.equal(launches.at(-1).libraryMissionId, row.id);
    assert.equal(launches.at(-1).mode, 'solo');
  }
});

test('v14 active cards and exact v13 cards remain distinct and stop cross-edition Next', async (t) => {
  const activeRoute = await loadAuthoredJourneyRoute('whole-spatial-v14');
  const priorRoute = await loadAuthoredJourneyRoute('whole-spatial-v13');
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
  assert.equal(library.missions.length, activeHost.catalog.missions.length + 15);
  const activeRows = library
    .forMode('versus')
    .filter((row) => row.editionId === 'whole-spatial-v14');
  const boundary = activeRows.findIndex(
    (row, index) => activeRows[index + 1] && row.campaignKey !== activeRows[index + 1].campaignKey,
  );
  assert(boundary >= 0);
  assert.equal(librarySuccessor(library, activeRows[boundary], 'versus'), activeRows[boundary + 1]);
  for (const id of revisedEarlyCultural) {
    const runtimeId = activeHost.catalog.missions.find((mission) => mission.levelId === id).id;
    const editions = library.missions.filter((row) => row.runtimeId === runtimeId);
    assert.equal(editions.length, 2);
    assert.deepEqual(
      new Set(editions.map((row) => row.editionId)),
      new Set(['whole-spatial-v13', 'whole-spatial-v14']),
    );
    const prior = editions.find((row) => row.editionId === 'whole-spatial-v13');
    const active = editions.find((row) => row.editionId === 'whole-spatial-v14');
    assert(active.tags.includes('Ukrainian'));
    assert(!prior.tags.includes('Ukrainian'));
    assert.equal(await library.launch(prior, { mode: 'versus' }), true);
    assert.equal(selected.libraryMissionId, prior.id);
    assert.equal(selected.mode, 'versus');
    assert.equal(priorHost.catalog.find(prior.runtimeId)?.levelId, id);
    assert.equal(librarySuccessor(library, prior, 'versus'), null);
  }
});

test('v15 selector exposes three exact v14 Signal cards and retains earlier history', async (t) => {
  const launches = [];
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v15',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 18);
  assert.equal(library.forMode('solo').length, 18);
  assert.equal(library.forMode('versus').length, 18);
  assert.equal(library.forMode('team').length, 0);
  assert.deepEqual(
    library.missions
      .filter((row) => row.editionId === 'whole-spatial-v14')
      .map(sourceId)
      .toSorted(),
    revisedSignalCultural.toSorted(),
  );
  for (const row of library.missions) {
    assert.equal(row.automaticContinuation, false);
    assert.match(row.edition, /^Previous Journey · v(?:9|10|11|12|13|14)$/);
    assert.equal(await library.launch(row, { mode: 'solo' }), true);
    assert.equal(launches.at(-1).libraryMissionId, row.id);
    assert.equal(launches.at(-1).mode, 'solo');
  }
});

test('v15 active cards and exact v14 cards remain distinct and stop cross-edition Next', async (t) => {
  const activeRoute = await loadAuthoredJourneyRoute('whole-spatial-v15');
  const priorRoute = await loadAuthoredJourneyRoute('whole-spatial-v14');
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
  assert.equal(library.missions.length, activeHost.catalog.missions.length + 18);
  const activeRows = library
    .forMode('versus')
    .filter((row) => row.editionId === 'whole-spatial-v15');
  const boundary = activeRows.findIndex(
    (row, index) => activeRows[index + 1] && row.campaignKey !== activeRows[index + 1].campaignKey,
  );
  assert(boundary >= 0);
  assert.equal(librarySuccessor(library, activeRows[boundary], 'versus'), activeRows[boundary + 1]);
  for (const id of revisedSignalCultural) {
    const runtimeId = activeHost.catalog.missions.find((mission) => mission.levelId === id).id;
    const editions = library.missions.filter((row) => row.runtimeId === runtimeId);
    assert.equal(editions.length, 2);
    assert.deepEqual(
      new Set(editions.map((row) => row.editionId)),
      new Set(['whole-spatial-v14', 'whole-spatial-v15']),
    );
    const prior = editions.find((row) => row.editionId === 'whole-spatial-v14');
    const active = editions.find((row) => row.editionId === 'whole-spatial-v15');
    assert(active.tags.includes('Ukrainian'));
    assert(!prior.tags.includes('Ukrainian'));
    assert.equal(await library.launch(prior, { mode: 'versus' }), true);
    assert.equal(selected.libraryMissionId, prior.id);
    assert.equal(selected.mode, 'versus');
    assert.equal(priorHost.catalog.find(prior.runtimeId)?.levelId, id);
    assert.equal(librarySuccessor(library, prior, 'versus'), null);
  }
});

test('v16 selector exposes three exact v15 Neon cards and retains earlier history', async (t) => {
  const launches = [];
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v16',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 21);
  assert.equal(library.forMode('solo').length, 21);
  assert.equal(library.forMode('versus').length, 21);
  assert.equal(library.forMode('team').length, 0);
  assert.deepEqual(
    library.missions
      .filter((row) => row.editionId === 'whole-spatial-v15')
      .map(sourceId)
      .toSorted(),
    revisedNeonCultural.toSorted(),
  );
  for (const row of library.missions) {
    assert.equal(row.automaticContinuation, false);
    assert.match(row.edition, /^Previous Journey · v(?:9|10|11|12|13|14|15)$/);
    assert.equal(await library.launch(row, { mode: 'solo' }), true);
    assert.equal(launches.at(-1).libraryMissionId, row.id);
    assert.equal(launches.at(-1).mode, 'solo');
  }
});

test('v16 active cards and exact v15 cards remain distinct and stop cross-edition Next', async (t) => {
  const activeRoute = await loadAuthoredJourneyRoute('whole-spatial-v16');
  const priorRoute = await loadAuthoredJourneyRoute('whole-spatial-v15');
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
  assert.equal(library.missions.length, activeHost.catalog.missions.length + 21);
  const activeRows = library
    .forMode('versus')
    .filter((row) => row.editionId === 'whole-spatial-v16');
  const boundary = activeRows.findIndex(
    (row, index) => activeRows[index + 1] && row.campaignKey !== activeRows[index + 1].campaignKey,
  );
  assert(boundary >= 0);
  assert.equal(librarySuccessor(library, activeRows[boundary], 'versus'), activeRows[boundary + 1]);
  for (const id of revisedNeonCultural) {
    const runtimeId = activeHost.catalog.missions.find((mission) => mission.levelId === id).id;
    const editions = library.missions.filter((row) => row.runtimeId === runtimeId);
    assert.equal(editions.length, 2);
    assert.deepEqual(
      new Set(editions.map((row) => row.editionId)),
      new Set(['whole-spatial-v15', 'whole-spatial-v16']),
    );
    const prior = editions.find((row) => row.editionId === 'whole-spatial-v15');
    const active = editions.find((row) => row.editionId === 'whole-spatial-v16');
    assert(active.tags.includes('Ukrainian'));
    assert(!prior.tags.includes('Ukrainian'));
    assert.equal(await library.launch(prior, { mode: 'versus' }), true);
    assert.equal(selected.libraryMissionId, prior.id);
    assert.equal(selected.mode, 'versus');
    assert.equal(priorHost.catalog.find(prior.runtimeId)?.levelId, id);
    assert.equal(librarySuccessor(library, prior, 'versus'), null);
  }
});

test('v18 selector exposes three exact v17 Rover cards and retains earlier history', async (t) => {
  const launches = [];
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v18',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 27);
  assert.equal(library.forMode('solo').length, 27);
  assert.equal(library.forMode('versus').length, 27);
  assert.equal(library.forMode('team').length, 0);
  assert.deepEqual(
    library.missions
      .filter((row) => row.editionId === 'whole-spatial-v17')
      .map(sourceId)
      .toSorted(),
    revisedRoverCultural.toSorted(),
  );
  for (const row of library.missions) {
    assert.equal(row.automaticContinuation, false);
    assert.match(row.edition, /^Previous Journey · v(?:9|10|11|12|13|14|15|16|17)$/);
    assert.equal(await library.launch(row, { mode: 'solo' }), true);
    assert.equal(launches.at(-1).libraryMissionId, row.id);
    assert.equal(launches.at(-1).mode, 'solo');
  }
});

test('v18 active cards and exact v17 cards remain distinct and stop cross-edition Next', async (t) => {
  const activeRoute = await loadAuthoredJourneyRoute('whole-spatial-v18');
  const priorRoute = await loadAuthoredJourneyRoute('whole-spatial-v17');
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
  assert.equal(library.missions.length, activeHost.catalog.missions.length + 27);
  const activeRows = library
    .forMode('versus')
    .filter((row) => row.editionId === 'whole-spatial-v18');
  const boundary = activeRows.findIndex(
    (row, index) => activeRows[index + 1] && row.campaignKey !== activeRows[index + 1].campaignKey,
  );
  assert(boundary >= 0);
  assert.equal(librarySuccessor(library, activeRows[boundary], 'versus'), activeRows[boundary + 1]);
  for (const id of revisedRoverCultural) {
    const runtimeId = activeHost.catalog.missions.find((mission) => mission.levelId === id).id;
    const editions = library.missions.filter((row) => row.runtimeId === runtimeId);
    assert.equal(editions.length, 2);
    assert.deepEqual(
      new Set(editions.map((row) => row.editionId)),
      new Set(['whole-spatial-v17', 'whole-spatial-v18']),
    );
    const prior = editions.find((row) => row.editionId === 'whole-spatial-v17');
    const active = editions.find((row) => row.editionId === 'whole-spatial-v18');
    assert(active.tags.includes('Ukrainian'));
    assert(!prior.tags.includes('Ukrainian'));
    assert.equal(await library.launch(prior, { mode: 'versus' }), true);
    assert.equal(selected.libraryMissionId, prior.id);
    assert.equal(selected.mode, 'versus');
    assert.equal(priorHost.catalog.find(prior.runtimeId)?.levelId, id);
    assert.equal(librarySuccessor(library, prior, 'versus'), null);
  }
});

test('v19 selector exposes three exact v18 Fractured Grid cards and retains earlier history', async (t) => {
  const launches = [];
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v19',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 30);
  assert.equal(library.forMode('solo').length, 30);
  assert.equal(library.forMode('versus').length, 30);
  assert.equal(library.forMode('team').length, 0);
  assert.deepEqual(
    library.missions
      .filter((row) => row.editionId === 'whole-spatial-v18')
      .map(sourceId)
      .toSorted(),
    revisedFractureCultural.toSorted(),
  );
  for (const row of library.missions) {
    assert.equal(row.automaticContinuation, false);
    assert.match(row.edition, /^Previous Journey · v(?:9|10|11|12|13|14|15|16|17|18)$/);
    assert.equal(await library.launch(row, { mode: 'solo' }), true);
    assert.equal(launches.at(-1).libraryMissionId, row.id);
    assert.equal(launches.at(-1).mode, 'solo');
  }
});

test('v19 active cards and exact v18 cards remain distinct and stop cross-edition Next', async (t) => {
  const activeRoute = await loadAuthoredJourneyRoute('whole-spatial-v19');
  const priorRoute = await loadAuthoredJourneyRoute('whole-spatial-v18');
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
  assert.equal(library.missions.length, activeHost.catalog.missions.length + 30);
  const activeRows = library
    .forMode('versus')
    .filter((row) => row.editionId === 'whole-spatial-v19');
  const boundary = activeRows.findIndex(
    (row, index) => activeRows[index + 1] && row.campaignKey !== activeRows[index + 1].campaignKey,
  );
  assert(boundary >= 0);
  assert.equal(librarySuccessor(library, activeRows[boundary], 'versus'), activeRows[boundary + 1]);
  for (const id of revisedFractureCultural) {
    const runtimeId = activeHost.catalog.missions.find((mission) => mission.levelId === id).id;
    const editions = library.missions.filter((row) => row.runtimeId === runtimeId);
    assert.equal(editions.length, 2);
    assert.deepEqual(
      new Set(editions.map((row) => row.editionId)),
      new Set(['whole-spatial-v18', 'whole-spatial-v19']),
    );
    const prior = editions.find((row) => row.editionId === 'whole-spatial-v18');
    const active = editions.find((row) => row.editionId === 'whole-spatial-v19');
    assert(active.tags.includes('Ukrainian'));
    assert(!prior.tags.includes('Ukrainian'));
    assert.equal(await library.launch(prior, { mode: 'versus' }), true);
    assert.equal(selected.libraryMissionId, prior.id);
    assert.equal(selected.mode, 'versus');
    assert.equal(priorHost.catalog.find(prior.runtimeId)?.levelId, id);
    assert.equal(librarySuccessor(library, prior, 'versus'), null);
  }
});

test('v20 selector exposes three exact v19 Phaseworks cards and retains earlier history', async (t) => {
  const launches = [];
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v20',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 33);
  assert.equal(library.forMode('solo').length, 33);
  assert.equal(library.forMode('versus').length, 33);
  assert.equal(library.forMode('team').length, 0);
  assert.deepEqual(
    library.missions
      .filter((row) => row.editionId === 'whole-spatial-v19')
      .map(sourceId)
      .toSorted(),
    revisedPhaseworksCultural.toSorted(),
  );
  for (const row of library.missions) {
    assert.equal(row.automaticContinuation, false);
    assert.match(row.edition, /^Previous Journey · v(?:9|10|11|12|13|14|15|16|17|18|19)$/);
    assert.equal(await library.launch(row, { mode: 'solo' }), true);
    assert.equal(launches.at(-1).libraryMissionId, row.id);
    assert.equal(launches.at(-1).mode, 'solo');
  }
});

test('v20 active cards and exact v19 cards remain distinct and stop cross-edition Next', async (t) => {
  const activeRoute = await loadAuthoredJourneyRoute('whole-spatial-v20');
  const priorRoute = await loadAuthoredJourneyRoute('whole-spatial-v19');
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
  assert.equal(library.missions.length, activeHost.catalog.missions.length + 33);
  const activeRows = library
    .forMode('versus')
    .filter((row) => row.editionId === 'whole-spatial-v20');
  const boundary = activeRows.findIndex(
    (row, index) => activeRows[index + 1] && row.campaignKey !== activeRows[index + 1].campaignKey,
  );
  assert(boundary >= 0);
  assert.equal(librarySuccessor(library, activeRows[boundary], 'versus'), activeRows[boundary + 1]);
  for (const id of revisedPhaseworksCultural) {
    const runtimeId = activeHost.catalog.missions.find((mission) => mission.levelId === id).id;
    const editions = library.missions.filter((row) => row.runtimeId === runtimeId);
    assert.equal(editions.length, 2);
    assert.deepEqual(
      new Set(editions.map((row) => row.editionId)),
      new Set(['whole-spatial-v19', 'whole-spatial-v20']),
    );
    const prior = editions.find((row) => row.editionId === 'whole-spatial-v19');
    const active = editions.find((row) => row.editionId === 'whole-spatial-v20');
    assert(active.tags.includes('Ukrainian'));
    assert(!prior.tags.includes('Ukrainian'));
    assert.equal(await library.launch(prior, { mode: 'versus' }), true);
    assert.equal(selected.libraryMissionId, prior.id);
    assert.equal(selected.mode, 'versus');
    assert.equal(priorHost.catalog.find(prior.runtimeId)?.levelId, id);
    assert.equal(librarySuccessor(library, prior, 'versus'), null);
  }
});

test('v21 selector exposes three exact v20 Livewire cards and retains earlier history', async (t) => {
  const launches = [];
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v21',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 36);
  assert.equal(library.forMode('solo').length, 36);
  assert.equal(library.forMode('versus').length, 36);
  assert.equal(library.forMode('team').length, 0);
  assert.deepEqual(
    library.missions
      .filter((row) => row.editionId === 'whole-spatial-v20')
      .map(sourceId)
      .toSorted(),
    revisedLivewireCultural.toSorted(),
  );
  for (const row of library.missions) {
    assert.equal(row.automaticContinuation, false);
    assert.match(row.edition, /^Previous Journey · v(?:9|10|11|12|13|14|15|16|17|18|19|20)$/);
    assert.equal(await library.launch(row, { mode: 'solo' }), true);
    assert.equal(launches.at(-1).libraryMissionId, row.id);
    assert.equal(launches.at(-1).mode, 'solo');
  }
});

test('v21 active cards and exact v20 cards remain distinct and stop cross-edition Next', async (t) => {
  const activeRoute = await loadAuthoredJourneyRoute('whole-spatial-v21');
  const priorRoute = await loadAuthoredJourneyRoute('whole-spatial-v20');
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
  assert.equal(library.missions.length, activeHost.catalog.missions.length + 36);
  const activeRows = library
    .forMode('versus')
    .filter((row) => row.editionId === 'whole-spatial-v21');
  const boundary = activeRows.findIndex(
    (row, index) => activeRows[index + 1] && row.campaignKey !== activeRows[index + 1].campaignKey,
  );
  assert(boundary >= 0);
  assert.equal(librarySuccessor(library, activeRows[boundary], 'versus'), activeRows[boundary + 1]);
  for (const id of revisedLivewireCultural) {
    const runtimeId = activeHost.catalog.missions.find((mission) => mission.levelId === id).id;
    const editions = library.missions.filter((row) => row.runtimeId === runtimeId);
    assert.equal(editions.length, 2);
    assert.deepEqual(
      new Set(editions.map((row) => row.editionId)),
      new Set(['whole-spatial-v20', 'whole-spatial-v21']),
    );
    const prior = editions.find((row) => row.editionId === 'whole-spatial-v20');
    const active = editions.find((row) => row.editionId === 'whole-spatial-v21');
    assert(active.tags.includes('Ukrainian'));
    assert(!prior.tags.includes('Ukrainian'));
    assert.equal(await library.launch(prior, { mode: 'versus' }), true);
    assert.equal(selected.libraryMissionId, prior.id);
    assert.equal(selected.mode, 'versus');
    assert.equal(priorHost.catalog.find(prior.runtimeId)?.levelId, id);
    assert.equal(librarySuccessor(library, prior, 'versus'), null);
  }
});

test('v22 selector exposes three exact v21 Relay cards and retains earlier history', async (t) => {
  const launches = [];
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v22',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 39);
  assert.equal(library.forMode('solo').length, 39);
  assert.equal(library.forMode('versus').length, 39);
  assert.equal(library.forMode('team').length, 0);
  assert.deepEqual(
    library.missions
      .filter((row) => row.editionId === 'whole-spatial-v21')
      .map(sourceId)
      .toSorted(),
    revisedRelayCultural.toSorted(),
  );
  for (const row of library.missions) {
    assert.equal(row.automaticContinuation, false);
    assert.match(row.edition, /^Previous Journey · v(?:9|10|11|12|13|14|15|16|17|18|19|20|21)$/);
    assert.equal(await library.launch(row, { mode: 'solo' }), true);
    assert.equal(launches.at(-1).libraryMissionId, row.id);
    assert.equal(launches.at(-1).mode, 'solo');
  }
});

test('v22 active cards and exact v21 cards remain distinct and stop cross-edition Next', async (t) => {
  const activeRoute = await loadAuthoredJourneyRoute('whole-spatial-v22');
  const priorRoute = await loadAuthoredJourneyRoute('whole-spatial-v21');
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
  assert.equal(library.missions.length, activeHost.catalog.missions.length + 39);
  const activeRows = library
    .forMode('versus')
    .filter((row) => row.editionId === 'whole-spatial-v22');
  const boundary = activeRows.findIndex(
    (row, index) => activeRows[index + 1] && row.campaignKey !== activeRows[index + 1].campaignKey,
  );
  assert(boundary >= 0);
  assert.equal(librarySuccessor(library, activeRows[boundary], 'versus'), activeRows[boundary + 1]);
  for (const id of revisedRelayCultural) {
    const runtimeId = activeHost.catalog.missions.find((mission) => mission.levelId === id).id;
    const editions = library.missions.filter((row) => row.runtimeId === runtimeId);
    assert.equal(editions.length, 2);
    assert.deepEqual(
      new Set(editions.map((row) => row.editionId)),
      new Set(['whole-spatial-v21', 'whole-spatial-v22']),
    );
    const prior = editions.find((row) => row.editionId === 'whole-spatial-v21');
    const active = editions.find((row) => row.editionId === 'whole-spatial-v22');
    assert(active.tags.includes('Ukrainian'));
    assert(!prior.tags.includes('Ukrainian'));
    assert.equal(await library.launch(prior, { mode: 'versus' }), true);
    assert.equal(selected.libraryMissionId, prior.id);
    assert.equal(selected.mode, 'versus');
    assert.equal(priorHost.catalog.find(prior.runtimeId)?.levelId, id);
    assert.equal(librarySuccessor(library, prior, 'versus'), null);
  }
});

test('v23 selector exposes three exact v22 Crosswind cards and retains earlier history', async (t) => {
  const launches = [];
  const owner = await createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v23',
    originalThemes,
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(library.missions.length, 42);
  assert.equal(library.forMode('solo').length, 42);
  assert.equal(library.forMode('versus').length, 42);
  assert.equal(library.forMode('team').length, 0);
  assert.deepEqual(
    library.missions
      .filter((row) => row.editionId === 'whole-spatial-v22')
      .map(sourceId)
      .toSorted(),
    revisedCrosswindCultural.toSorted(),
  );
  for (const row of library.missions) {
    assert.equal(row.automaticContinuation, false);
    assert.match(row.edition, /^Previous Journey · v(?:9|10|11|12|13|14|15|16|17|18|19|20|21|22)$/);
    assert.equal(await library.launch(row, { mode: 'solo' }), true);
    assert.equal(launches.at(-1).libraryMissionId, row.id);
    assert.equal(launches.at(-1).mode, 'solo');
  }
});

test('v23 active cards and exact v22 cards remain distinct and stop cross-edition Next', async (t) => {
  const activeRoute = await loadAuthoredJourneyRoute('whole-spatial-v23');
  const priorRoute = await loadAuthoredJourneyRoute('whole-spatial-v22');
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
  assert.equal(library.missions.length, activeHost.catalog.missions.length + 42);
  const activeRows = library
    .forMode('versus')
    .filter((row) => row.editionId === 'whole-spatial-v23');
  const boundary = activeRows.findIndex(
    (row, index) => activeRows[index + 1] && row.campaignKey !== activeRows[index + 1].campaignKey,
  );
  assert(boundary >= 0);
  assert.equal(librarySuccessor(library, activeRows[boundary], 'versus'), activeRows[boundary + 1]);
  for (const id of revisedCrosswindCultural) {
    const runtimeId = activeHost.catalog.missions.find((mission) => mission.levelId === id).id;
    const editions = library.missions.filter((row) => row.runtimeId === runtimeId);
    assert.equal(editions.length, 2);
    assert.deepEqual(
      new Set(editions.map((row) => row.editionId)),
      new Set(['whole-spatial-v22', 'whole-spatial-v23']),
    );
    const prior = editions.find((row) => row.editionId === 'whole-spatial-v22');
    const active = editions.find((row) => row.editionId === 'whole-spatial-v23');
    assert(active.tags.includes('Ukrainian'));
    assert(!prior.tags.includes('Ukrainian'));
    assert.equal(await library.launch(prior, { mode: 'versus' }), true);
    assert.equal(selected.libraryMissionId, prior.id);
    assert.equal(selected.mode, 'versus');
    assert.equal(priorHost.catalog.find(prior.runtimeId)?.levelId, id);
    assert.equal(librarySuccessor(library, prior, 'versus'), null);
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
