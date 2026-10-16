import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { resolveJourneyRequest } from '../content-design/default-entry.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { journeyLibrarySource } from '../mission-library/journey-source.mjs';
import { combineJourneyLibrarySources } from '../mission-library/cross-mode-journey.mjs';
import { createSpatialNextEditionSources } from '../mission-library/spatial-next-editions.mjs';
import { authoredJourneyMissionTags } from '../mission-library/journey-presentation.mjs';
import { missionLibraryHref, readMissionLibraryHandoff } from '../mission-library/handoff.mjs';

const routeId = 'whole-ornament-v1';
const ids = ['cross-stitch-crossings', 'rushnyk-bands', 'pysanka-sections'];
const originalThemes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
).themes;
const themes = journeyActorThemeCandidates(originalThemes, { includeOriginals: true });

test('ornament opt-in leaves default, historic storage and all core continuation untouched', async () => {
  const route = await loadAuthoredJourneyRoute(routeId);
  const previous = await loadAuthoredJourneyRoute('whole-spatial-v11');
  for (const mode of ['solo', 'versus']) {
    assert.equal(resolveJourneyRequest(new URLSearchParams(), { mode }), 'whole-spatial-v11');
    assert.equal(
      resolveJourneyRequest(new URLSearchParams({ journey: routeId }), { mode }),
      routeId,
    );
  }
  assert.notEqual(route.sessionKey, previous.sessionKey);
  assert.notEqual(route.profileKey, previous.profileKey);
  assert.deepEqual(route.corePackIds, previous.corePackIds);
  const hosts = [route, previous].map((r) =>
    createCandidateVersusHost(r.source, {
      themes,
      corePackIds: r.corePackIds,
      optionalCampaignIds: r.optionalCampaignIds,
    }),
  );
  const core = (host) => {
    const levels = [];
    for (let m = host.catalog.missions[0]; m; m = host.next(m.id)) levels.push(m.levelId);
    return levels;
  };
  assert.equal(core(hosts[0]).length, 71);
  assert.deepEqual(core(hosts[0]), core(hosts[1]));
  for (const host of hosts) {
    const first = host.catalog.missions.find((m) => m.levelId === ids[0]);
    const actual = [];
    for (let m = first; m; m = host.next(m.id)) actual.push(m.levelId);
    assert.deepEqual(actual, [...ids, 'dnipro-crossings']);
  }
});

test('one ornament selector keeps the three prior v11 owners without media fetch', async (t) => {
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Browsing must not fetch artwork');
  });
  const route = await loadAuthoredJourneyRoute(routeId);
  const host = createCandidateVersusHost(route.source, {
    themes,
    corePackIds: route.corePackIds,
    optionalCampaignIds: route.optionalCampaignIds,
  });
  let selected;
  const previous = await createSpatialNextEditionSources({
    activeRouteId: routeId,
    originalThemes,
    launch: (context) => {
      selected = context;
      return true;
    },
  });
  t.after(previous.dispose);
  const solo = createCandidateSoloHost(route.source, {
    themes,
    corePackIds: route.corePackIds,
    optionalCampaignIds: route.optionalCampaignIds,
  });
  const library = createMissionLibrary([
    combineJourneyLibrarySources(
      [
        ['solo', solo],
        ['versus', host],
      ].map(([mode, current]) => ({
        mode,
        source: journeyLibrarySource({
          editionId: route.id,
          edition: route.label,
          catalog: current.catalog,
          tags: (mission) =>
            authoredJourneyMissionTags(
              mission,
              mode === 'solo'
                ? current
                    .select(mission, 'standard')
                    .manifests.find((m) => m.missionId === mission.levelId)
                : current.manifest(mission),
            ),
          launch: () => true,
        }),
      })),
    ),
    ...previous.sources,
  ]);
  assert.equal(library.missions.length, 94);
  assert.equal(new Set(library.missions.map((row) => row.id)).size, 94);
  assert.equal(previous.sources.flatMap((s) => s.entries).length, 3);
  assert(previous.sources.every((s) => s.automaticContinuation === false));
  for (const id of ids) {
    const mission = host.catalog.missions.find((m) => m.levelId === id);
    const matches = library.missions.filter((row) => row.runtimeId === mission.id);
    assert.equal(matches.length, 2);
    assert.deepEqual(
      new Set(matches.map((row) => row.editionId)),
      new Set([routeId, 'whole-spatial-v11']),
    );
    for (const row of matches) {
      assert(row.tags.includes('Ukrainian'));
      assert.equal(row.levelIndex, mission.levelIndex);
      assert.deepEqual(row.modes, ['solo', 'versus']);
    }
    const old = matches.find((row) => row.editionId === 'whole-spatial-v11');
    for (const mode of ['solo', 'versus']) {
      assert.equal(library.availability(old, mode).state, 'ready');
      assert.equal(await library.launch(old, { mode }), true);
      assert.equal(selected.libraryMissionId, old.id);
      const href = new URL(
        missionLibraryHref({
          baseURL: 'https://example.test/game/',
          currentMode: 'solo',
          mode,
          journey: old.editionId,
          missionId: old.id,
          sourceJourney: routeId,
        }),
      );
      assert.equal(href.searchParams.get('journey'), 'whole-spatial-v11');
      assert.equal(readMissionLibraryHandoff(href.searchParams), old.id);
    }
  }
  const retained = library.missions.filter((row) => row.editionId !== routeId);
  previous.dispose();
  for (const row of retained) {
    assert.equal(library.availability(row, 'solo').state, 'unavailable');
    assert.throws(() => library.launch(row, { mode: 'solo' }), /Prepare this mission/);
  }
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('current ornament progress never leaks into the retained v11 edition', async () => {
  const state = { clears: { solo: {} }, skipped: { versus: [] } };
  const previous = await createSpatialNextEditionSources({
    activeRouteId: routeId,
    originalThemes,
    profile: { snapshot: () => state },
    launch: () => true,
  });
  const library = createMissionLibrary(previous.sources);
  for (const row of library.missions) state.clears.solo[row.runtimeId] = { completed: true };
  for (const row of library.missions)
    assert.equal(
      library.progress(row, 'solo'),
      row.editionId === 'whole-spatial-v11' ? 'Cleared' : '',
    );
  previous.dispose();
});
