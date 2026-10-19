import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadBuiltinClassicSoloDemoSources } from '../demo-modes/solo-classic-builtins.mjs';
import {
  loadBuiltinSoloDemoSources,
  mergeBuiltinSoloDemoSources,
} from '../demo-modes/solo-builtins.mjs';
import { loadStandaloneSoloContext } from '../demo-modes/solo-catalog.mjs';
import { SOLO_BUILTIN_DEMO_INDEX } from '../demo-modes/solo-builtins-index.mjs';
import { preparePack } from '../packs.mjs';
import { preparedPackIdentity } from '../mission-library/pack-identity.mjs';
import { externalChapterHash } from '../external-chapter.mjs';
import { readMissionLibraryHandoff, readMissionLibraryReady } from '../mission-library/handoff.mjs';
import { soloClassicDemoLaunchURL } from '../demo-modes/solo-classic-launch.mjs';
import { loadDemoSources } from '../demo-sources.mjs';
import { resolveDemoCatalog } from '../demo-catalog.mjs';
import { createDemoRotation } from '../demo-rotation.mjs';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const fetchFile = async (url) => new Response(await readFile(url));
const levelKeys = (sources) => [...new Set(sources.map((source) => source.levelKey))].sort();
const nativeIndex = await read('../content/mission-library-index.json');
const expectedClassic = nativeIndex.missions.filter(
  (row) =>
    ['base', 'bundled', 'archived'].includes(row.source) &&
    row.modes.includes('solo') &&
    row.difficultiesByMode.solo.includes('standard'),
);
const expectedKeys = [
  ...new Set([
    ...expectedClassic.map((row) => `${row.campaignKey}/${row.levelId}`),
    ...SOLO_BUILTIN_DEMO_INDEX.map((row) => row.levelKey),
  ]),
].sort();

test('clean and Journey entry contexts enumerate the complete authored union from metadata only', async () => {
  const requests = [];
  const fetch = async (url) => {
    requests.push(url.pathname);
    return fetchFile(url);
  };
  const builtin = await loadBuiltinSoloDemoSources({ fetch });
  assert.deepEqual(levelKeys(builtin), expectedKeys);
  assert.ok(builtin.every((source) => source.entry === null));
  assert.ok(
    requests.every((path) =>
      /\/(?:catalog(?:\.journey-(?:current|archive))?|mission-library-index)\.json$/.test(path),
    ),
  );
  const journey = builtin.filter((source) =>
    SOLO_BUILTIN_DEMO_INDEX.some((row) => row.id === source.id),
  );
  assert.deepEqual(levelKeys(mergeBuiltinSoloDemoSources(journey, builtin)), expectedKeys);
  requests.length = 0;
  const context = await loadStandaloneSoloContext({
    fetch,
    inventoryReader: () => {
      throw Error('No profile');
    },
  });
  requests.length = 0;
  const sources = await context.loadSources({});
  assert.deepEqual(levelKeys(sources), expectedKeys);
  assert.ok(
    requests.every((path) => /\/catalog(?:\.journey-(?:current|archive))?\.json$/.test(path)),
  );
  assert.ok(!requests.some((path) => /\.replay\.json$|\/content\/packs\//.test(path)));
});

test('source merge preserves personal recordings, live bots, improvisation and reviewed choices', () => {
  const existing = [
    { id: 'local-one', source: 'local', levelKey: 'same' },
    { id: 'live-one', kind: 'bot', levelKey: 'same' },
    { id: 'improv-one', kind: 'improv', levelKey: 'same' },
    { id: 'reviewed-one', kind: 'replay', levelKey: 'same' },
  ];
  const added = { id: 'qualified-one', kind: 'replay', levelKey: 'same' };
  assert.deepEqual(mergeBuiltinSoloDemoSources(existing, [{ ...existing[3] }, added]), [
    ...existing,
    added,
  ]);
});

test('actual merged personal, improvised and qualified sources share one Standard visit per authored level', async () => {
  const context = await loadStandaloneSoloContext({
    fetch: fetchFile,
    inventoryReader: () => {
      throw Error('No profile');
    },
  });
  const catalog = await read('../demo-data/catalog.json');
  const [reviewed] = resolveDemoCatalog(catalog, context.entries);
  class LazyWorker {
    constructor() {
      throw Error('Enumeration must not start a worker.');
    }
  }
  const existing = await loadDemoSources({
    entries: context.entries,
    // An unavailable curated metadata read still retains native live/personal sources.
    catalogs: [],
    library: { list: async () => [{ ...reviewed, id: 'local-extra', source: 'local' }] },
    WorkerClass: LazyWorker,
  });
  assert.ok(existing.some((source) => source.kind === 'improv'));
  assert.ok(existing.some((source) => source.source === 'local'));
  const merged = mergeBuiltinSoloDemoSources(
    existing,
    await loadBuiltinSoloDemoSources({ fetch: fetchFile }),
  );
  assert.ok(merged.every((source) => source.variantId === 'standard'));
  const rotation = createDemoRotation({ random: () => 0 });
  let previous = null;
  for (let cycle = 0; cycle < 2; cycle++) {
    const visited = new Set();
    for (let index = 0; index < expectedKeys.length; index++) {
      const source = rotation.choose(merged);
      assert.notEqual(
        source.levelKey,
        previous,
        'Cycle boundaries cannot repeat the preceding level.',
      );
      assert.ok(
        !visited.has(source.levelKey),
        'Extra recordings must not grant a second level visit.',
      );
      visited.add(source.levelKey);
      rotation.accept(source);
      previous = source.levelKey;
    }
    assert.deepEqual([...visited].sort(), expectedKeys);
  }
});

test('lazy handoffs name exact ordinary missions without granting installation or progress', async () => {
  const sources = await loadBuiltinClassicSoloDemoSources({ fetch: fetchFile });
  for (const source of sources) {
    const row = expectedClassic.find(
      (row) => `${row.campaignKey}/${row.levelId}` === source.levelKey,
    );
    const url = new URL(source.launchURL);
    assert.equal(source.launchURL, soloClassicDemoLaunchURL(row));
    assert.ok(readMissionLibraryHandoff(url.searchParams));
    assert.equal(readMissionLibraryReady(url.searchParams), true);
    assert.equal(url.searchParams.get('journey'), 'legacy');
    assert.equal(source.entry, null);
  }
});

// Native gameplay/replay fixture with artwork omitted, not a fake image decoder.
// Actual authored images are additionally decoded by the browser qualification.
async function fixture() {
  const raw = await read('../content/packs/night-shift.json');
  raw.visualOverrides = {};
  raw.levelVisuals = [];
  const { pack } = await preparePack(raw);
  const body = JSON.stringify(raw);
  const row = structuredClone(
    expectedClassic.find((row) => row.packId === raw.id && row.levelIndex === 0),
  );
  row.sourceFile.bytes = new TextEncoder().encode(body).length;
  row.sourceFile.sha256 = await externalChapterHash(body);
  row.packIdentity = await preparedPackIdentity(pack);
  const index = { format: nativeIndex.format, missions: [row] };
  const requests = [];
  const fetch = async (url, options) => {
    requests.push(url.pathname);
    if (url.pathname.endsWith('/content/packs/night-shift.json')) return new Response(body);
    return fetchFile(url, options);
  };
  return { row, index, body, requests, fetch };
}

test('selected native packed replay strictly plays to its terminal outcome and releases its entry', async () => {
  const f = await fixture();
  const [source] = await loadBuiltinClassicSoloDemoSources({ index: f.index, fetch: f.fetch });
  assert.equal(f.requests.length, 1);
  const player = await source.create();
  assert.ok(Object.isFrozen(player));
  assert.equal(source.entry.difficulty, 'standard');
  assert.equal(source.entry.sourcePackId, f.row.packId);
  assert.equal(source.level.id, f.row.levelId);
  const startingClaimed = player.state.claimedCount;
  player.play();
  while (player.phase === 'playing') player.advance(0.25);
  assert.equal(player.phase, 'complete');
  assert.ok(['won', 'lost'].includes(player.state.status));
  assert.ok(player.state.claimedCount > startingClaimed);
  player.dispose();
  player.dispose();
  assert.equal(source.entry, null);
  assert.equal(source.level.name, f.row.name);
  const controller = new AbortController();
  const next = await source.create({ signal: controller.signal });
  controller.abort();
  assert.equal(source.entry, null);
  assert.equal(next.phase, 'disposed');
  assert.equal(
    f.requests.filter((path) => path.endsWith('night-shift.json')).length,
    2,
    'No prepared pack is retained between scenes.',
  );
});

test('changed indexed bytes, canonical pack identity and replay content fail before adoption', async () => {
  for (const mutation of ['bytes', 'hash', 'identity', 'replay']) {
    const f = await fixture();
    if (mutation === 'bytes') f.row.sourceFile.bytes--;
    if (mutation === 'hash') f.row.sourceFile.sha256 = '0'.repeat(64);
    if (mutation === 'identity')
      f.row.packIdentity = { ...f.row.packIdentity, sha256: '0'.repeat(64) };
    const fetch = async (url, options) => {
      if (mutation === 'replay' && url.pathname.endsWith('/demo-data/catalog.json')) {
        const catalog = await read('../demo-data/catalog.json');
        for (const clip of catalog.clips)
          if (clip.levelId === f.row.levelId) clip.identity = '0'.repeat(16);
        return new Response(JSON.stringify(catalog));
      }
      return f.fetch(url, options);
    };
    const [source] = await loadBuiltinClassicSoloDemoSources({ index: f.index, fetch });
    await assert.rejects(source.create(), (error) => error.code === 'content-mismatch', mutation);
    assert.equal(source.entry, null);
    assert.ok(!f.requests.some((path) => path.endsWith('.replay.json')));
  }
});

test('cancellation releases an ignored late transport and never adopts native content', async () => {
  const f = await fixture();
  let respond,
    cancelled = 0;
  const fetch = async (url) =>
    url.pathname.endsWith('night-shift.json')
      ? new Promise((resolve) => {
          respond = resolve;
        })
      : f.fetch(url);
  const [source] = await loadBuiltinClassicSoloDemoSources({ index: f.index, fetch });
  const controller = new AbortController();
  const pending = source.create({ signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  respond(
    new Response(
      new ReadableStream({
        cancel() {
          cancelled++;
        },
      }),
    ),
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cancelled, 1);
  assert.equal(source.entry, null);
});

test('indexed metadata cannot escape the finite local authored pack paths', async () => {
  const f = await fixture();
  f.row.sourceFile.path = 'game/content/packs/../../external.json';
  await assert.rejects(
    loadBuiltinClassicSoloDemoSources({ index: f.index, fetch: f.fetch }),
    (error) => error.code === 'content-mismatch',
  );
  assert.equal(f.requests.length, 1);
});

test('cancelling a locked pack body releases its stream before preparation', async () => {
  const f = await fixture();
  const controller = new AbortController();
  let cancelled = 0;
  const fetch = async (url) =>
    url.pathname.endsWith('night-shift.json')
      ? new Response(
          new ReadableStream({
            pull() {
              queueMicrotask(() => controller.abort());
            },
            cancel() {
              cancelled++;
            },
          }),
        )
      : f.fetch(url);
  const [source] = await loadBuiltinClassicSoloDemoSources({ index: f.index, fetch });
  await assert.rejects(source.create({ signal: controller.signal }), { name: 'AbortError' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cancelled, 1);
  assert.equal(source.entry, null);
});

test('cancelling native pack image preparation retires its image and prevents subsequent decodes', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const images = [];
  const controller = new AbortController();
  class PendingImage {
    constructor() {
      images.push(this);
    }
    set src(value) {
      this.source = value;
      queueMicrotask(() => controller.abort());
    }
    removeAttribute(name) {
      if (name === 'src') this.source = null;
    }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: PendingImage });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'Image', previous);
    else delete globalThis.Image;
  });
  const requests = [];
  const sources = await loadBuiltinClassicSoloDemoSources({
    fetch: async (url) => {
      requests.push(url.pathname);
      return fetchFile(url);
    },
  });
  const source = sources.find((source) => source.levelId === 'night-shift-01');
  await assert.rejects(source.create({ signal: controller.signal }), { name: 'AbortError' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(images.length, 1);
  assert.equal(images[0].source, null);
  assert.equal(images[0].onload, null);
  assert.equal(images[0].onerror, null);
  assert.equal(source.entry, null);
  assert.ok(!requests.some((path) => path.endsWith('.replay.json')));
});
