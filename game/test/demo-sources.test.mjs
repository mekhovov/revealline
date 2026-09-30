import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadDemoSources } from '../demo-sources.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { createDemoDirector } from '../demo-director.mjs';
import { createDemoLibrary } from '../demo-library.mjs';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';
import { demoIdentity } from '../demo-catalog.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { verifyReplay } from '../replay.mjs';
import { demoLoadingClock, settleDemoLoading } from './helpers/demo-loading-clock.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { createSoloRouteHost } from '../content-design/solo-route-host.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { loadEditionBootstrap } from '../editions/bootstrap.mjs';

const json = async (relative) =>
  JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const campaign = await json('../content/campaign.json'),
  classRecipes = await json('../content/classes.json'),
  pack = await json('../content/packs/fpv-arcade-r5.json');
campaign.classRecipes = classRecipes;
const base = { campaign, classRecipes },
  installed = {
    campaign: { ...pack.campaigns[0], classRecipes: pack.classRecipes },
    classRecipes: pack.classRecipes,
  };
const entries = createExecutionCatalog([base, installed]).entries;
const emptyLibrary = { list: async () => [] };
class LazyWorker {
  constructor() {
    throw new Error('Source enumeration must not create a Worker.');
  }
}
const assetFetch = async (url) => ({ ok: true, text: async () => readFile(url, 'utf8') });

test('actual installed Standard/Gentle catalogue exposes ten curated and six qualified live sources lazily', async () => {
  const requests = [];
  const sources = await loadDemoSources({
    entries,
    library: emptyLibrary,
    WorkerClass: LazyWorker,
    fetch: async (url) => {
      requests.push(url.href);
      return assetFetch(url);
    },
  });
  assert.equal(sources.filter((source) => source.kind === 'replay').length, 10);
  assert.equal(sources.filter((source) => source.kind === 'bot').length, 6);
  assert.equal(new Set(sources.map((source) => source.id)).size, 16);
  assert.equal(requests.length, 1, 'Only the bundled catalogue loads before a scene is chosen.');
  assert.ok(requests[0].endsWith('/game/demo-data/catalog.json'));
  assert.equal(sources.filter((source) => source.approachable).length, 1);
  for (const source of sources.filter((candidate) => candidate.kind === 'replay')) {
    const player = await source.create({ signal: new AbortController().signal });
    assert.equal(player.info.levelId, source.levelId);
    assert.equal(player.state.tick, 0);
    assert.equal(player.phase, 'paused');
    assert.ok(source.entry.difficulty === 'standard');
    assert.deepEqual(
      player.state.level,
      applyGameplayTuning(source.level, resolveGameplayTuning('standard')),
    );
    assert.equal(source.identity, demoIdentity(source.level, source.entry.classRecipes));
    assert.notEqual(source.identity, source.recordingIdentity);
    player.dispose();
  }
  for (const source of sources.filter((candidate) => candidate.kind === 'bot')) {
    assert.equal(source.identity, demoIdentity(source.level, source.entry.classRecipes));
    assert.equal(
      source.recordingIdentity,
      demoIdentity(
        applyGameplayTuning(source.level, resolveGameplayTuning('standard')),
        source.entry.classRecipes,
      ),
    );
  }
  const director = createDemoDirector({ sources });
  director.dispose();
});

test('same map IDs in separately installed themed owners do not collide', async () => {
  const themed = structuredClone(installed);
  themed.campaign.id = 'fpv-pressure-lines-themed';
  themed.campaign.title = 'A different installed world';
  const themedEntries = createExecutionCatalog([base, installed, themed]).entries;
  const sources = await loadDemoSources({
    entries: themedEntries,
    library: emptyLibrary,
    fetch: assetFetch,
    WorkerClass: LazyWorker,
  });
  const bots = sources.filter((source) => source.kind === 'bot');
  assert.equal(bots.length, 12);
  assert.equal(new Set(bots.map((source) => source.id)).size, 12);
  assert.equal(new Set(bots.map((source) => source.levelKey)).size, 4);
  assert.equal(new Set(bots.map((source) => source.campaignKey)).size, 2);
  createDemoDirector({ sources }).dispose();
});

test('current main Journey host retains the expanded base showcase without pretending the clips belong to Journey', async (t) => {
  const route = await loadAuthoredJourneyRoute(DEFAULT_JOURNEY_ROUTES.solo);
  const host = await createSoloRouteHost(route, {
    themes: (await json('../content-design/themes.json')).themes,
    buildVersion: 'demo-source-test',
  });
  t.after(() => host.preparer.dispose());
  assert.ok(host.entries.length > 0);
  // This is the production executionEntries() composition for a fresh main
  // profile: current Journey plus the installed base, without optional packs.
  const sources = await loadDemoSources({
    entries: [...host.entries, ...createExecutionCatalog([base]).entries],
    library: emptyLibrary,
    fetch: assetFetch,
    WorkerClass: LazyWorker,
  });
  assert.equal(sources.length, 10);
  assert.ok(sources.every((source) => source.kind === 'replay'));
  assert.ok(sources.every((source) => source.campaignId === base.campaign.id));
  assert.ok(sources.every((source) => !host.owns(source.entry)));
  assert.equal(new Set(sources.map((source) => source.levelId)).size, 8);
});

test('actual public company editions cannot select base or another company showcase', async () => {
  const root = new URL('../../', import.meta.url);
  for (const editionId of ['coupa-all', 'droneaid-nl-community', 'droneaid-community']) {
    const bootstrap = await loadEditionBootstrap({
      catalogURL: new URL('game/editions/catalog.json', root).href,
      contentBaseURL: root.href,
      editionId,
      fetcher: async (url) => ({ ok: true, text: async () => readFile(new URL(url), 'utf8') }),
    });
    const host = await createSoloRouteHost(bootstrap.route, {
      themes: bootstrap.boot.themes.themes,
      buildVersion: 'demo-company-source-test',
    });
    try {
      const campaign = structuredClone(bootstrap.boot.campaign);
      campaign.classRecipes = bootstrap.boot.classes;
      const boot = { campaign, classRecipes: bootstrap.boot.classes };
      const requests = [];
      const sources = await loadDemoSources({
        entries: [...host.entries, ...createExecutionCatalog([boot]).entries],
        library: emptyLibrary,
        WorkerClass: LazyWorker,
        fetch: async (url) => {
          requests.push(url.href);
          return assetFetch(url);
        },
      });
      assert.deepEqual(sources, [], editionId);
      assert.equal(requests.length, 1, editionId);
      assert.ok(requests[0].endsWith('/game/demo-data/catalog.json'));
    } finally {
      host.preparer.dispose();
    }
  }
});

test('missing Worker and uninstalled content filter sources without downloading or installing packs', async () => {
  const requested = [];
  const fetcher = async (url) => {
    requested.push(url.href);
    return assetFetch(url);
  };
  assert.equal(
    (await loadDemoSources({ entries, library: emptyLibrary, fetch: fetcher, WorkerClass: null }))
      .length,
    10,
  );
  assert.deepEqual(
    await loadDemoSources({
      entries: [],
      library: emptyLibrary,
      fetch: fetcher,
      WorkerClass: LazyWorker,
    }),
    [],
  );
  const onlyInstalled = createExecutionCatalog([installed]).entries;
  const sources = await loadDemoSources({
    entries: onlyInstalled,
    library: emptyLibrary,
    fetch: fetcher,
    WorkerClass: LazyWorker,
  });
  assert.equal(sources.length, 6);
  assert.ok(sources.every((source) => source.kind === 'bot'));
  assert.ok(requested.every((url) => url.endsWith('/game/demo-data/catalog.json')));
});

test('manually kept local recordings join the catalogue without enabling automatic collection', async () => {
  let stored = null;
  const library = createDemoLibrary({
    storage: {
      read: async () => structuredClone(stored),
      update: async (fn) => {
        stored = fn(stored);
        return structuredClone(stored);
      },
    },
  });
  const source = await json('../demo-data/first-signal-left.replay.json');
  await library.keep(source, { entry: base, practice: false, manual: true });
  const sources = await loadDemoSources({ entries, library, fetch: assetFetch, WorkerClass: null });
  assert.equal(library.enabled, false);
  assert.equal(sources.length, 11);
  const local = sources.find((candidate) => candidate.source === 'local');
  assert.ok(local);
  assert.equal(
    (await local.create({ signal: new AbortController().signal })).info.totalTicks,
    source.ticks,
  );
  library.dispose();
});

test('uncached optional bundled replays fall back to a retained recording or stay unavailable offline', async () => {
  const catalog = await json('../demo-data/catalog.json');
  const recording = await json('../demo-data/first-signal-left.replay.json');
  // A fresh main installation has the base owner, without an installed bot pack.
  // The catalogue remains available offline; its optional recording bodies do not.
  const installedEntries = createExecutionCatalog([base]).entries;
  for (const retained of [true, false]) {
    const clock = demoLoadingClock();
    const requested = [];
    let stored = null;
    const library = createDemoLibrary({
      storage: {
        read: async () => structuredClone(stored),
        update: async (fn) => {
          stored = fn(stored);
          return structuredClone(stored);
        },
      },
    });
    let director;
    try {
      if (retained) await library.keep(recording, { entry: base, practice: false, manual: true });
      const storedBefore = structuredClone(stored);
      const sources = await loadDemoSources({
        entries: installedEntries,
        library,
        WorkerClass: LazyWorker,
        loading: clock.options,
        fetch: async (url) => {
          requested.push(url.href);
          if (url.pathname.endsWith('/demo-data/catalog.json')) return assetFetch(url);
          throw new TypeError('Failed to fetch: optional recording is not cached offline.');
        },
      });
      const bundled = sources.filter((source) => source.source !== 'local');
      assert.equal(bundled.length, catalog.clips.length);
      assert.ok(sources.every((source) => source.kind === 'replay'));
      director = createDemoDirector({ sources, random: () => 0, loading: clock.options });
      assert.equal(await director.start(), retained);
      assert.deepEqual(
        director.failedSourceIds,
        bundled.map((source) => source.id),
      );
      assert.deepEqual(
        requested,
        [
          new URL('../demo-data/catalog.json', import.meta.url).href,
          ...catalog.clips.map(
            (clip) => new URL(`../${clip.replayURL.slice(2)}`, import.meta.url).href,
          ),
        ],
        'Each unavailable bundled source is attempted once; no variant, pack or media download is attempted.',
      );
      const requestCount = requested.length;
      if (retained) {
        assert.equal(director.phase, 'playing');
        assert.equal(director.source.source, 'local');
        assert.deepEqual(director.player.exportRecording(), recording);
        assert.equal(director.advance(0.25).ticks, 30);
        assert.equal(director.player.state.tick, 30);
        director.pause();
        assert.equal(await director.next(), true);
        assert.equal(director.phase, 'paused', 'Offline fallback retains explicit Pause.');
        assert.equal(director.source.source, 'local');
        assert.equal(director.player.state.tick, 0);
      } else {
        assert.equal(director.phase, 'unavailable');
        assert.equal(director.player, null);
        assert.equal(director.source, null);
        assert.equal(director.advance(0.25).reason, 'inactive');
        assert.equal(await director.next(), false);
        assert.equal(await director.start(), false);
        assert.equal(director.phase, 'unavailable');
      }
      assert.equal(
        requested.length,
        requestCount,
        'Quarantined recordings do not form a retry loop.',
      );
      assert.deepEqual(
        stored,
        storedBefore,
        'Playback never rewrites the personal recording cache.',
      );
      assert.equal(library.enabled, false);
    } finally {
      director?.dispose();
      library.dispose();
    }
    assert.equal(clock.pending, 0, 'All source/director deadline timers are released.');
  }
});

test('scene creation rejects a valid but wrong bundled recording and respects cancellation', async () => {
  const sources = await loadDemoSources({
    entries,
    library: emptyLibrary,
    WorkerClass: null,
    fetch: async (url) =>
      url.href.endsWith('/catalog.json')
        ? assetFetch(url)
        : assetFetch(new URL('../demo-data/first-signal-left.replay.json', import.meta.url)),
  });
  const orchard = sources.find((source) => source.levelId === 'signal-02');
  await assert.rejects(orchard.create({ signal: new AbortController().signal }), /match/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(sources[0].create({ signal: controller.signal }), { name: 'AbortError' });
});

test('cancelled source discovery cannot return a late catalogue whose fetch ignored cancellation', async () => {
  let release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  const controller = new AbortController();
  const pending = loadDemoSources({
    entries,
    library: emptyLibrary,
    WorkerClass: LazyWorker,
    signal: controller.signal,
    fetch: async (url) => {
      await waiting;
      return assetFetch(url);
    },
  });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  release();
  await settleDemoLoading();
});

test('frozen runtime variants are selected only after strict verification of the identical pinned input trace', async () => {
  const catalog = await json('../demo-data/catalog.json');
  const clip = catalog.clips[0];
  const candidates = await Promise.all(
    [clip.replayURL, ...clip.replayVariants].map(async (url) => ({
      url,
      replay: await json(`../${url.slice(2)}`),
    })),
  );
  const good = candidates.find(({ replay }) => verifyReplay(replay).match);
  const foreign = candidates.find(({ replay }) => !verifyReplay(replay).match);
  assert.ok(good && foreign, 'The two recorded math runtimes have distinct exact checkpoints.');
  clip.replayURL = foreign.url;
  clip.replayVariants = [good.url];
  catalog.clips = [clip];
  const requested = [];
  const fetcher = async (url) => {
    requested.push(url.href);
    return url.href.endsWith('/catalog.json')
      ? { ok: true, text: async () => JSON.stringify(catalog) }
      : assetFetch(url);
  };
  const [source] = await loadDemoSources({
    entries,
    library: emptyLibrary,
    WorkerClass: null,
    fetch: fetcher,
  });
  const player = await source.create({ signal: new AbortController().signal });
  assert.deepEqual(player.exportRecording(), good.replay);
  assert.equal(requested.length, 3);
  player.dispose();

  const corrupted = structuredClone(good.replay);
  corrupted.segments[0].input.action = !corrupted.segments[0].input.action;
  const [alteredSource] = await loadDemoSources({
    entries,
    library: emptyLibrary,
    WorkerClass: null,
    fetch: async (url) =>
      url.href.endsWith(good.url.slice(2))
        ? { ok: true, text: async () => JSON.stringify(corrupted) }
        : fetcher(url),
  });
  await assert.rejects(alteredSource.create({}), /no longer matches/);

  const controller = new AbortController();
  let alternateRequests = 0;
  const [cancelled] = await loadDemoSources({
    entries,
    library: emptyLibrary,
    WorkerClass: null,
    fetch: async (url) => {
      if (url.href.endsWith(foreign.url.slice(2))) setTimeout(() => controller.abort(), 0);
      if (url.href.endsWith(good.url.slice(2))) alternateRequests++;
      return fetcher(url);
    },
  });
  await assert.rejects(cancelled.create({ signal: controller.signal }), { name: 'AbortError' });
  assert.equal(alternateRequests, 0, 'Cancellation must not start the next runtime variant.');

  clip.replayVariants = [];
  const [unsupported] = await loadDemoSources({
    entries,
    library: emptyLibrary,
    WorkerClass: null,
    fetch: fetcher,
  });
  await assert.rejects(unsupported.create({}), { name: 'ReplayVerificationError' });
});

test('the ordinary game build includes every dynamic demo asset and Worker module', async () => {
  const files = new Set(await collectBuildFiles());
  const catalog = await json('../demo-data/catalog.json');
  for (const path of [
    'game/demo-catalog.mjs',
    'game/demo-library.mjs',
    'game/demo-sources.mjs',
    'game/demo-director.mjs',
    'game/demo-loading.mjs',
    'game/demo-bot.mjs',
    'game/demo-bot-player.mjs',
    'game/demo-bot-worker.mjs',
    'game/demo-data/catalog.json',
    'game/demo-data/variant-provenance.json',
    ...catalog.clips.flatMap((clip) =>
      [clip.replayURL, ...clip.replayVariants].map((url) => `game/${url.slice(2)}`),
    ),
  ])
    assert.ok(
      files.has(path),
      `${path} must be included under nested static hosting and offline packaging.`,
    );
  assert.equal(files.has('game/test/demo-sources.test.mjs'), false);
});

test('a personal cache that never settles times out without discarding bundled sources', async () => {
  const clock = demoLoadingClock();
  const catalogText = JSON.stringify(await json('../demo-data/catalog.json'));
  let librarySignal;
  const pending = loadDemoSources({
    entries,
    WorkerClass: null,
    loading: clock.options,
    fetch: async () => ({
      ok: true,
      text: async () => catalogText,
    }),
    library: {
      list: (_, { signal }) => {
        librarySignal = signal;
        return new Promise(() => {});
      },
    },
  });
  await settleDemoLoading();
  assert.ok(librarySignal);
  clock.advance(15000);
  const sources = await pending;
  assert.equal(sources.length, 10);
  assert.ok(sources.every((source) => source.kind === 'replay'));
  assert.equal(librarySignal.aborted, true);
  assert.equal(clock.pending, 0);
});

test('a never-settling catalogue falls through to local sources and cancellation settles a hung cache', async () => {
  const clock = demoLoadingClock();
  let signal;
  const pending = loadDemoSources({
    entries: [],
    WorkerClass: null,
    loading: clock.options,
    fetch: () => new Promise(() => {}),
    library: { list: async () => [{ id: 'local-owner', levelId: 'one', campaignKey: 'local' }] },
  });
  clock.advance(15000);
  assert.deepEqual(
    (await pending).map((source) => source.id),
    ['local-owner'],
  );
  assert.equal(clock.pending, 0);
  const controller = new AbortController();
  const cancelled = loadDemoSources({
    entries: [],
    WorkerClass: null,
    loading: clock.options,
    signal: controller.signal,
    fetch: async () => ({
      ok: true,
      text: async () => '{"format":"revealline-demo-catalog.v1","clips":[]}',
    }),
    library: {
      list: (_, options) => {
        signal = options.signal;
        return new Promise(() => {});
      },
    },
  });
  await settleDemoLoading();
  assert.ok(signal);
  controller.abort();
  await assert.rejects(cancelled, { name: 'AbortError' });
  assert.equal(signal.aborted, true);
  assert.equal(clock.pending, 0);
});
