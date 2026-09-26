import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRemoteSoloVersusLibrarySources } from '../mission-library/remote-solo-versus.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { classicLibrarySources } from '../mission-library/classic-source.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { journeyLibrarySource } from '../mission-library/journey-source.mjs';
import { createSpatialNextEditionSources } from '../mission-library/spatial-next-editions.mjs';

const paths = [
  'content/mission-library-index.json',
  'content-design/themes.json',
  'content/campaign.json',
  'content/classes.json',
];
const files = new Map(
  await Promise.all(
    paths.map(async (path) => [
      path,
      await readFile(new URL('../' + path, import.meta.url), 'utf8'),
    ]),
  ),
);
const index = JSON.parse(files.get(paths[0]));
const baseURL = 'https://example.test/release/v0.84.0/game/';
function reader(seen, replace = (path, text) => text) {
  return async (url) => {
    const path = url.href.slice(baseURL.length);
    assert(files.has(path), 'Only fixed bounded JSON metadata may be fetched');
    seen.push(path);
    return new Response(replace(path, files.get(path)));
  };
}

test('remote Solo/Versus inventory preserves 91 current, thirty-six prior and 188 Classic identities without images or saving', async (t) => {
  const reads = [],
    launches = [];
  const owner = await createRemoteSoloVersusLibrarySources({
    baseURL,
    fetch: reader(reads),
    difficulty: () => 'expert',
    launch: (context) => {
      launches.push(context);
      return true;
    },
  });
  t.after(owner.dispose);
  const library = createMissionLibrary(owner.sources);
  assert.equal(reads.length, 4);
  assert.equal(library.missions.length, 315);
  assert.equal(library.forMode('solo').length, 315);
  assert.equal(library.forMode('versus').length, 315);
  assert.equal(library.forMode('team').length, 0);
  const route = await loadAuthoredJourneyRoute('whole-spatial-v21');
  const versus = createCandidateVersusHost(route.source, {
    themes: journeyActorThemeCandidates(JSON.parse(files.get(paths[1])).themes, {
      includeOriginals: route.preserveOriginalThemes === true,
    }),
    corePackIds: route.corePackIds,
    optionalCampaignIds: route.optionalCampaignIds,
  });
  const prior = await createSpatialNextEditionSources({
    activeRouteId: route.id,
    originalThemes: JSON.parse(files.get(paths[1])).themes,
    launch: () => true,
  });
  t.after(prior.dispose);
  const receiver = createMissionLibrary([
    journeyLibrarySource({
      editionId: route.id,
      edition: 'New Journey',
      catalog: versus.catalog,
      launch: () => true,
    }),
    ...prior.sources,
    ...classicLibrarySources(index, {
      availability: () => ({ state: 'ready' }),
      launch: () => true,
    }),
  ]);
  assert.deepEqual(
    library.missions.map((row) => row.id),
    receiver.missions.map((row) => row.id),
  );
  for (const mode of ['solo', 'versus']) {
    const ready = library
      .forMode(mode)
      .filter((row) => library.availability(row, mode).state === 'ready');
    assert.equal(
      ready.length,
      139,
      '91 current + thirty-six prior Journey +12 verified Base, not invented installed packs',
    );
    for (const row of ready) {
      assert.equal(library.progress(row, mode), '');
      assert.equal(library.completion(row, mode), null);
      assert.equal(await library.launch(row, { mode }), true);
      assert.equal(launches.at(-1).libraryMissionId, row.id);
      assert.equal(launches.at(-1).mode, mode);
    }
    const unavailable = library
      .forMode(mode)
      .find((row) => library.availability(row, mode).state === 'unavailable');
    assert.match(library.availability(unavailable, mode).reason, /not yet checked/);
    await assert.rejects(async () => library.launch(unavailable, { mode }), /Prepare this mission/);
  }
  assert.match(library.details(library.missions[0], 'solo').challenge, /Expert/);
  assert.equal(reads.length, 4, 'Details, readiness and handoffs do not fetch pictures');
});

test('remote Base source drift is rejected rather than promoted to ready', async () => {
  await assert.rejects(
    createRemoteSoloVersusLibrarySources({
      baseURL,
      fetch: reader([], (path, text) => (path === 'content/campaign.json' ? text + '\n' : text)),
      launch: () => true,
    }),
    /differs from the retained source edition/,
  );
});

test('cancelled remote metadata never publishes source ownership', async () => {
  const controller = new AbortController();
  controller.abort();
  let reads = 0;
  await assert.rejects(
    createRemoteSoloVersusLibrarySources({
      baseURL,
      fetch: () => {
        reads++;
        throw new Error('No read after cancellation');
      },
      launch: () => true,
      signal: controller.signal,
    }),
    { name: 'AbortError' },
  );
  assert.equal(reads, 0);
});
