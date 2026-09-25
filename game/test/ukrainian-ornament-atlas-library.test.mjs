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
import { UKRAINIAN_ORNAMENT_ATLAS_IDS } from '../content-design/ukrainian-ornament-atlas-registry.mjs';

const routeId = 'whole-ornament-v2';
const originalThemes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
).themes;
const themes = journeyActorThemeCandidates(originalThemes, { includeOriginals: true });
const route = await loadAuthoredJourneyRoute(routeId);
const options = {
  themes,
  corePackIds: route.corePackIds,
  optionalCampaignIds: route.optionalCampaignIds,
};
const solo = createCandidateSoloHost(route.source, options);
const versus = createCandidateVersusHost(route.source, options);

test('atlas opt-in owns progress but preserves default and the complete existing Next sequence', async () => {
  const oldRoute = await loadAuthoredJourneyRoute('whole-ornament-v1');
  const old = createCandidateVersusHost(oldRoute.source, options);
  assert.notEqual(route.profileKey, oldRoute.profileKey);
  assert.notEqual(route.sessionKey, oldRoute.sessionKey);
  assert.deepEqual(route.corePackIds, oldRoute.corePackIds);
  assert.deepEqual(
    versus.catalog.missions.map((m) => m.id),
    old.catalog.missions.map((m) => m.id),
  );
  for (const mission of versus.catalog.missions)
    assert.equal(versus.next(mission.id)?.id, old.next(mission.id)?.id);
  for (const mode of ['solo', 'versus']) {
    assert.equal(resolveJourneyRequest(new URLSearchParams(), { mode }), 'whole-spatial-v11');
    assert.equal(
      resolveJourneyRequest(new URLSearchParams({ journey: routeId }), { mode }),
      routeId,
    );
  }
});

test('one atlas selector retains 103 unique rows, exact old owners and inherited Ukrainian tags without media fetch', async (t) => {
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Browsing must not fetch artwork');
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
  const library = createMissionLibrary([
    combineJourneyLibrarySources(
      [
        ['solo', solo],
        ['versus', versus],
      ].map(([mode, host]) => ({
        mode,
        source: journeyLibrarySource({
          editionId: route.id,
          edition: route.label,
          catalog: host.catalog,
          tags: (mission) =>
            authoredJourneyMissionTags(
              mission,
              mode === 'solo'
                ? host
                    .select(mission, 'standard')
                    .manifests.find((m) => m.missionId === mission.levelId)
                : host.manifest(mission),
            ),
          launch: () => true,
        }),
      })),
    ),
    ...previous.sources,
  ]);
  assert.equal(library.missions.length, 103);
  assert.equal(new Set(library.missions.map((row) => row.id)).size, 103);
  assert.equal(previous.sources.flatMap((s) => s.entries).length, 12);
  assert(previous.sources.every((s) => s.automaticContinuation === false));
  const counts = Object.fromEntries(
    [routeId, 'whole-ornament-v1', 'whole-spatial-v11'].map((id) => [
      id,
      library.missions.filter((m) => m.editionId === id).length,
    ]),
  );
  assert.deepEqual(counts, {
    [routeId]: 91,
    'whole-ornament-v1': 9,
    'whole-spatial-v11': 3,
  });
  assert.equal(
    library.missions.filter((m) => m.editionId === routeId && m.tags.includes('Ukrainian')).length,
    18,
  );
  for (const id of UKRAINIAN_ORNAMENT_ATLAS_IDS) {
    const mission = versus.catalog.missions.find((m) => m.levelId === id);
    const matches = library.missions.filter((m) => m.runtimeId === mission.id);
    assert.equal(matches.length, 2);
    const current = matches.find((m) => m.editionId === routeId);
    const old = matches.find((m) => m.editionId === 'whole-ornament-v1');
    assert(current.tags.includes('Ukrainian'));
    assert.equal(old.tags.includes('Ukrainian'), id === 'dnipro-crossings');
    if (
      ['four-motor-landings', 'circuit-lanes', 'twin-lens-chambers', 'toolbench-weave'].includes(id)
    )
      assert(current.tags.includes('FPV'));
    assert.equal(old.levelIndex, current.levelIndex);
    for (const mode of ['solo', 'versus']) {
      assert.equal(library.availability(old, mode).state, 'ready');
      assert.equal(await library.launch(old, { mode }), true);
      assert.equal(selected.libraryMissionId, old.id);
      const url = new URL(
        missionLibraryHref({
          baseURL: 'https://example.test/game/',
          currentMode: 'solo',
          mode,
          journey: old.editionId,
          missionId: old.id,
          sourceJourney: routeId,
        }),
      );
      assert.equal(url.searchParams.get('journey'), 'whole-ornament-v1');
      assert.equal(readMissionLibraryHandoff(url.searchParams), old.id);
    }
  }
  previous.dispose();
  for (const row of library.missions.filter((m) => m.editionId !== routeId))
    assert.equal(library.availability(row, 'solo').state, 'unavailable');
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('previous v1 profile never leaks to the v11 retained cards', async () => {
  const state = { clears: { solo: {} }, skipped: { versus: [] } };
  const previous = await createSpatialNextEditionSources({
    activeRouteId: routeId,
    originalThemes,
    profile: { snapshot: () => state },
    launch: () => true,
  });
  try {
    const library = createMissionLibrary(previous.sources);
    for (const row of library.missions) state.clears.solo[row.runtimeId] = { completed: true };
    for (const row of library.missions)
      assert.equal(
        library.progress(row, 'solo'),
        row.editionId === 'whole-ornament-v1' ? 'Cleared' : '',
      );
  } finally {
    previous.dispose();
  }
});
