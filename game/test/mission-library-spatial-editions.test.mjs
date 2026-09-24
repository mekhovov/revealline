import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSpatialEditionSources } from '../mission-library/spatial-editions.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { journeyLibrarySource } from '../mission-library/journey-source.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { missionLibraryHref, readMissionLibraryHandoff } from '../mission-library/handoff.mjs';
import { librarySuccessor } from '../mission-library/continuous-next.mjs';

const originalThemes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
).themes;
const revised = [
  'two-bays',
  'neon-remix',
  'broken-yard',
  'read-the-arrows',
  'twin-receivers',
  'crossing-complete',
];
const sourceId = (row) => row.runtimeId.split('/').at(-1);

for (const [activeRouteId, alternateRouteId, label] of [
  ['whole-spatial-v6', 'whole-spatial-v5', 'Previous Journey · v5'],
  ['whole-spatial-v5', 'whole-spatial-v6', 'Spatial challenge · balance pending'],
])
  test(`${activeRouteId} offers only the six alternate editions with exact receiver identities and no media reads`, async (t) => {
    t.mock.method(globalThis, 'fetch', () => {
      throw new Error('Metadata browsing must not fetch artwork.');
    });
    let preset = 'standard';
    const launches = [];
    const owner = await createSpatialEditionSources({
      activeRouteId,
      originalThemes,
      difficulty: () => preset,
      launch: (context) => {
        launches.push(context);
        return true;
      },
    });
    t.after(owner.dispose);
    const library = createMissionLibrary(owner.sources);
    assert.equal(library.missions.length, 6);
    assert.equal(library.forMode('solo').length, 6);
    assert.equal(library.forMode('versus').length, 6);
    assert.equal(library.forMode('team').length, 0);
    assert.deepEqual(library.missions.map(sourceId).sort(), [...revised].sort());
    assert.equal(library.search(label).length, 6);
    for (const row of library.missions) {
      assert.equal(row.ownerId, `journey:${alternateRouteId}`);
      assert.equal(row.editionId, alternateRouteId);
      assert.equal(row.edition, label);
      assert.equal(row.automaticContinuation, false);
      assert.deepEqual(
        row.tags,
        sourceId(row) === 'neon-remix' ? ['Journey', 'Remix'] : ['Journey'],
      );
      for (const mode of ['solo', 'versus']) {
        assert.equal(library.availability(row, mode).state, 'ready');
        assert.equal(library.progress(row, mode), '');
        assert.equal(await library.launch(row, { mode }), true);
        assert.equal(launches.at(-1).libraryMissionId, row.id);
        assert.equal(launches.at(-1).mode, mode);
      }
    }
    // Exact receiving-host registration, not a name or geometry lookup.
    const route = await loadAuthoredJourneyRoute(alternateRouteId);
    const host = createCandidateVersusHost(route.source, {
      themes: journeyActorThemeCandidates(originalThemes, { includeOriginals: true }),
      corePackIds: route.corePackIds,
      optionalCampaignIds: route.optionalCampaignIds,
    });
    const receiverSource = journeyLibrarySource({
      editionId: route.id,
      edition: 'Receiving Journey',
      catalog: host.catalog,
      launch: () => true,
    });
    const receiver = createMissionLibrary([receiverSource]);
    assert.equal(receiver.missions.length, 91);
    for (const row of library.missions) {
      const received = receiver.find(row.id);
      assert(received, 'Receiver owns the exact display identity');
      assert.equal(received.runtimeId, row.runtimeId);
      assert.equal(received.levelIndex, row.levelIndex, 'Preserve full campaign position');
      assert.deepEqual(library.card(row, 'versus'), host.card(host.catalog.find(row.runtimeId)));
      const target = new URL(
        missionLibraryHref({
          baseURL: 'https://example.test/releases/v0.99.0/site/game/',
          currentMode: 'solo',
          mode: 'versus',
          journey: row.editionId,
          missionId: row.id,
          sourceJourney: activeRouteId,
        }),
      );
      assert.equal(target.searchParams.get('journey'), alternateRouteId);
      assert.equal(readMissionLibraryHandoff(target.searchParams), row.id);
    }
    const twoBays = library.missions.find((row) => sourceId(row) === 'two-bays');
    assert.equal(host.next(twoBays.runtimeId).levelId, 'courtyard-return');
    assert(
      !revised.includes(host.next(twoBays.runtimeId).levelId),
      'Next is not the six-card list',
    );
    preset = 'expert';
    assert.match(library.details(twoBays, 'solo').challenge, /Expert$/);
    assert.equal(library.card(twoBays, 'solo').preset, 'expert');
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });

test('alternate owner preserves handoff guards and scoped progress, rejects forged bindings and retires cleanly', async () => {
  const state = { clears: { solo: {} }, skipped: { versus: [] } };
  let received;
  const owner = await createSpatialEditionSources({
    activeRouteId: 'whole-spatial-v6',
    originalThemes,
    profile: { snapshot: () => state },
    launch: (context) => {
      received = context;
      return true;
    },
  });
  const source = owner.sources[0];
  const library = createMissionLibrary(owner.sources);
  const row = library.missions[0];
  state.clears.solo[row.runtimeId] = { completed: true };
  state.skipped.versus.push(row.runtimeId);
  assert.equal(library.progress(row, 'solo'), 'Cleared');
  assert.equal(library.progress(row, 'versus'), 'Skipped · try again');
  const context = {
    libraryMissionId: row.id,
    mode: 'versus',
    continuation: Object.freeze({ next: 'original-sequence' }),
    transferContinuation: () => true,
    isCurrent: () => true,
  };
  assert.equal(source.launch(source.entries[0], context), true);
  assert.equal(received, context, 'Preserve exact handoff object and callback ownership');
  assert.equal(source.launch(source.entries[0], { ...context, isCurrent: () => false }), false);
  assert.throws(
    () => source.launch(source.entries[0], { ...context, libraryMissionId: 'wrong-edition' }),
    /another display mission/,
  );
  assert.throws(() => source.launch({}, context), /Unknown Journey display binding/);
  assert.throws(
    () => source.launch(source.entries[0], { ...context, mode: 'team' }),
    /no qualified/,
  );
  owner.dispose();
  owner.dispose();
  assert.equal(library.availability(row, 'solo').state, 'unavailable');
  assert.equal(source.launch(source.entries[0], context), false);
  assert.equal(received, context);
});

for (const activeRouteId of ['whole-spatial-v6', 'whole-spatial-v5'])
test(`${activeRouteId} keeps same-name editions manually playable without looping at Journey completion`, async (t) => {
  const route = await loadAuthoredJourneyRoute(activeRouteId);
  const host = createCandidateVersusHost(route.source, {
    themes: journeyActorThemeCandidates(originalThemes, { includeOriginals: true }),
    corePackIds: route.corePackIds,
    optionalCampaignIds: route.optionalCampaignIds,
  });
  let selected;
  const owner = await createSpatialEditionSources({
    activeRouteId: route.id,
    originalThemes,
    launch: (context) => {
      selected = context;
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary([
    journeyLibrarySource({
      editionId: route.id,
      edition: 'New Journey',
      catalog: host.catalog,
      launch: () => true,
    }),
    ...owner.sources,
  ]);
  assert.equal(library.missions.length, 97);
  assert.equal(new Set(library.missions.map((row) => row.id)).size, 97);
  for (const mission of host.catalog.missions) {
    const editions = library.missions.filter((row) => row.runtimeId === mission.id);
    assert.equal(editions.length, revised.includes(mission.levelId) ? 2 : 1);
  }
  const twins = library.search('Twin receivers', { mode: 'versus' });
  assert.equal(twins.length, 2);
  assert.deepEqual(
    new Set(twins.map((row) => row.editionId)),
    new Set(['whole-spatial-v5', 'whole-spatial-v6']),
  );
  const alternateTwin = twins.find((row) => row.editionId !== activeRouteId);
  assert.equal(await library.launch(alternateTwin, { mode: 'versus' }), true);
  assert.equal(selected.libraryMissionId, alternateTwin.id);
  assert.equal(selected.mode, 'versus');
  const finalMission = library.missions.find(
    (row) => row.editionId === activeRouteId && row.runtimeId === host.catalog.missions.at(-1).id,
  );
  assert.equal(finalMission.automaticContinuation, true);
  assert.equal(
    librarySuccessor(library, finalMission, 'versus'),
    null,
    'Finishing a whole Journey does not restart the other edition at Two bays',
  );
  const [classic] = library.register({
    id: '["classic","base",null]',
    editionId: 'base-1',
    edition: 'Base game',
    collection: 'Classic',
    entries: [{ id: 'first-classic' }],
    describe: (entry) => ({
      ...entry,
      name: 'Classic opening',
      campaignKey: 'base-1',
      campaignTitle: 'Base game',
      levelIndex: 0,
      modes: ['solo', 'versus'],
    }),
    availability: () => ({ state: 'ready' }),
    launch: () => true,
  });
  assert.equal(librarySuccessor(library, finalMission, 'versus'), classic);
});

test('unrelated routes do not construct another source or require browsing dependencies', async () => {
  for (const activeRouteId of [
    undefined,
    'legacy',
    'whole-spatial-v4',
    'team-spatial-originals-1',
    '__proto__',
  ]) {
    const owner = await createSpatialEditionSources({ activeRouteId });
    assert.deepEqual(owner.sources, []);
    owner.dispose();
  }
  await assert.rejects(
    createSpatialEditionSources({ activeRouteId: 'whole-spatial-v6' }),
    /exact mission handoff/,
  );
});
