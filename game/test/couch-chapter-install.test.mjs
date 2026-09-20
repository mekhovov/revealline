import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCouchChapterInstaller } from '../couch/couch-chapter-install.mjs';
import { createExternalChapterPointerStore } from '../external-chapter-pointer.mjs';
import { CLASSES, RULESET } from '../core/registry.mjs';
import { campaignKey } from '../library.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { emptyPackLibrary, exportPackLibrary, installPack, preparePack } from '../packs.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { mediaFixture, pngBytes, deferred } from './helpers/media-fixtures.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const imageURL = `data:image/png;base64,${pngBytes().toString('base64')}`;
const decodeHeader = async (url) => {
  const header = inspectImageDataUrl(url);
  assert.equal(header.valid, true);
  return { naturalWidth: header.width, naturalHeight: header.height };
};
async function fixture(id = 'couch-chapter-fixture', change = {}) {
  const campaign = {
    ...mediaFixture().campaign,
    id: `${id}-campaign`,
    title: 'Test flight',
    themeId: 'fpv',
  };
  const theme = {
    id: 'fpv',
    family: 'fpv',
    player: 'neutral-marker',
    name: 'Fixture',
    subtitle: 'Testing only',
    scene: 'dawn',
    enemyShape: 'drone',
    patrolShape: 'tank',
    bossShape: 'radar',
    palette: Object.fromEntries(
      'ink paper muted accent safe danger field grid sky land'
        .split(' ')
        .map((key) => [key, '#224466']),
    ),
    labels: Object.fromEntries(
      'objective supply enemy boss currency ability'.split(' ').map((key) => [key, key]),
    ),
  };
  const { pack } = await preparePack(
    {
      format: 'xonix-pack.v1',
      id,
      version: '1.0.0',
      name: 'Couch chapter fixture',
      description: 'Small injected original for installation transaction tests.',
      engine: RULESET,
      dependencies: [],
      themes: [theme],
      classRecipes: [CLASSES[0]],
      campaigns: [campaign],
      visualOverrides: { background: { dataUrl: imageURL, fit: 'contain' } },
      levelVisuals: [],
      music: [],
      ...change,
    },
    { decodeImage: decodeHeader },
  );
  const normalized = Buffer.from(JSON.stringify(pack));
  const bytes = Buffer.from(JSON.stringify(pack, null, 2));
  const summary = {
    id: pack.id,
    version: pack.version,
    name: pack.name,
    description: pack.description,
    themeId: 'fpv',
    levels: 1,
    path: `authoring/library/four-worlds-chapters/packs/${pack.id}.json`,
    bytes: bytes.length,
    normalizedBytes: normalized.length,
    sha256: digest(bytes),
    normalizedSha256: digest(normalized),
    campaignKey: campaignKey({ ...pack.campaigns[0], classRecipes: pack.classRecipes }),
  };
  return { pack, bytes, summary };
}
class Locks {
  held = new Set();
  calls = [];
  before = null;
  async request(key, options, action) {
    this.calls.push([key, options]);
    await this.before?.(key);
    if (this.held.has(key)) return action(null);
    this.held.add(key);
    try {
      return await action({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
async function setup(t, f) {
  f ??= await fixture();
  const assets = managedIndexedDB(),
    locks = new Locks(),
    images = [],
    requests = [];
  const values = new Map([
    ['revealline.library.dev.v1', '{"solo":"earned original and medals stay exact"}'],
    ['revealline.suspended.dev.v1', '{"solo":"pinned suspended attempt stays exact"}'],
    ['revealline.settings.v1', '{"sound":false}'],
  ]);
  const preservedValues = [...values];
  const pointer = createExternalChapterPointerStore({
    indexedDB: assets.indexedDB,
    profileKey: 'revealline.library.dev.v1',
    packsKey: 'revealline.packs.dev.v1',
  });
  let fetchHook = null,
    decodeHook = null;
  class Image {
    constructor() {
      this.releases = 0;
      images.push(this);
    }
    set src(value) {
      this.source = value;
      const header = inspectImageDataUrl(value);
      this.naturalWidth = header.width;
      this.naturalHeight = header.height;
      queueMicrotask(() => this.onload?.());
    }
    async decode() {
      await decodeHook?.(this);
    }
    removeAttribute(name) {
      assert.equal(name, 'src');
      this.releases++;
      this.source = null;
    }
  }
  const service = createCouchChapterInstaller({
    channel: 'dev',
    registeredEntries: [],
    indexedDB: assets.indexedDB,
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem() {
        assert.fail('No Solo/preference writes');
      },
      removeItem() {
        assert.fail('No Solo deletion');
      },
    },
    lockManager: locks,
    ImageClass: Image,
    baseURL: 'https://game.example/releases/v-test/site/',
    fetch: async (url, options) => {
      requests.push([url, options]);
      return fetchHook ? fetchHook(url, options) : new Response(f.bytes);
    },
  });
  async function access(key, value, write = false) {
    await pointer.snapshot();
    const db = await new Promise((resolve, reject) => {
      const request = assets.indexedDB.open('revealline-assets-v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('assets', write ? 'readwrite' : 'readonly');
        const req = write
          ? tx.objectStore('assets').put(value, key)
          : tx.objectStore('assets').get(key);
        tx.oncomplete = () => resolve(req.result);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
  await access('retained-original', { bytes: [7, 8, 9], revision: 2 }, true);
  assets.allPuts.length = 0;
  t.after(() => {
    service.dispose();
    pointer.close();
  });
  return {
    f,
    assets,
    locks,
    images,
    requests,
    values,
    pointer,
    service,
    set fetchHook(value) {
      fetchHook = value;
    },
    set decodeHook(value) {
      decodeHook = value;
    },
    put: (key, value) => access(key, value, true),
    async preserved() {
      assert.deepEqual([...values], preservedValues);
      assert.deepEqual(await access('retained-original'), { bytes: [7, 8, 9], revision: 2 });
    },
    async noWriter() {
      await waitFor(() => !locks.held.has(pointer.keys.writerKey));
    },
    async seed(packs) {
      let library = emptyPackLibrary();
      for (const pack of packs) library = installPack(library, pack);
      await access(pointer.keys.packsKey, exportPackLibrary(library), true);
      assets.allPuts.length = 0;
      return (await pointer.snapshot()).packs;
    },
  };
}

test('inspection uses the real checked library, without writer lease or player writes', async (t) => {
  const h = await setup(t);
  const result = await h.service.inspect();
  assert.deepEqual(result.library, emptyPackLibrary());
  assert.equal(result.usage.packBytes, Buffer.byteLength(exportPackLibrary(emptyPackLibrary())));
  assert.equal(
    h.locks.calls.some(([key]) => key.endsWith('.writer')),
    false,
  );
  assert.deepEqual(h.assets.allPuts, []);
  assert.deepEqual(h.requests, []);
  await h.preserved();
});

test('verified download publishes only the pack pointer, returns exact usage and releases the real writer', async (t) => {
  const h = await setup(t),
    statuses = [];
  const result = await h.service.install(h.f.summary, {
    onStatus: (value) => statuses.push(value),
  });
  assert.equal(result.committed, true);
  assert.equal(result.reused, false);
  assert.deepEqual(result.pack, h.f.pack);
  assert.deepEqual(result.library.packs, [h.f.pack]);
  const saved = await h.pointer.snapshot();
  assert.equal(result.usage.packBytes, Buffer.byteLength(saved.packs));
  assert.equal(saved.index, null);
  assert.deepEqual(h.assets.allPuts, [['assets', h.pointer.keys.packsKey]]);
  assert.equal(h.requests[0][0], `https://game.example/releases/v-test/site/${h.f.summary.path}`);
  assert.equal(h.requests[0][1].redirect, 'error');
  assert.equal(h.requests[0][1].credentials, 'same-origin');
  assert.ok(h.images.length > 0);
  assert.ok(h.images.every((image) => image.releases === 1));
  assert.ok(statuses.some((item) => item.stage === 'saving'));
  assert.equal(statuses.at(-1).stage, 'ready');
  await h.noWriter();
  await h.preserved();
});

test('exact reuse avoids both download and writer ownership; conflicting content never overwrites', async (t) => {
  const h = await setup(t),
    original = await h.seed([h.f.pack]);
  const result = await h.service.install(h.f.summary);
  assert.equal(result.reused, true);
  assert.equal(result.committed, false);
  assert.deepEqual(result.pack, h.f.pack);
  assert.equal(h.requests.length, 0);
  assert.equal(
    h.locks.calls.some(([key]) => key.endsWith('.writer')),
    false,
  );
  const different = await fixture(h.f.pack.id, {
    description: 'Changed content of same identity.',
  });
  await assert.rejects(h.service.install(different.summary), /different.*edition/);
  assert.equal((await h.pointer.snapshot()).packs, original);
  assert.deepEqual(h.assets.allPuts, []);
  await h.preserved();
});

test('corrupt and truncated source bytes reject before decoding or writer acquisition', async (t) => {
  const h = await setup(t),
    broken = Buffer.from(h.f.bytes);
  broken[broken.length - 2] ^= 1;
  for (const bytes of [broken, h.f.bytes.subarray(0, -1)]) {
    h.fetchHook = () => new Response(bytes);
    await assert.rejects(h.service.install(h.f.summary), /checksum|incomplete/);
  }
  assert.equal(h.images.length, 0);
  assert.equal(
    h.locks.calls.some(([key]) => key.endsWith('.writer')),
    false,
  );
  assert.deepEqual(h.assets.allPuts, []);
  await h.preserved();
});

test('a denied real writer lease retains all existing data and permits a later explicit retry', async (t) => {
  const h = await setup(t);
  h.locks.held.add(h.pointer.keys.writerKey);
  await assert.rejects(h.service.install(h.f.summary), /cannot reserve/);
  assert.equal((await h.pointer.snapshot()).packs, null);
  assert.deepEqual(h.assets.allPuts, []);
  h.locks.held.delete(h.pointer.keys.writerKey);
  assert.equal((await h.service.install(h.f.summary)).committed, true);
  await h.noWriter();
  await h.preserved();
});

test('recovery and occupied backup locks fail before download', async (t) => {
  const h = await setup(t);
  h.values.set(h.pointer.keys.lockKey, 'backup in progress');
  await assert.rejects(h.service.inspect(), /recovery/);
  await assert.rejects(h.service.install(h.f.summary), /recovery/);
  h.values.delete(h.pointer.keys.lockKey);
  h.locks.held.add(h.pointer.keys.lockKey);
  await assert.rejects(h.service.install(h.f.summary), /owns the profile lock/);
  h.locks.held.delete(h.pointer.keys.lockKey);
  assert.deepEqual(h.requests, []);
  assert.deepEqual(h.assets.allPuts, []);
  await h.preserved();
});

test('cancelled fetch stays single-flight until its late promise settles, then explicit retry works', async (t) => {
  const h = await setup(t),
    gate = deferred();
  h.fetchHook = () => gate.promise;
  const operation = h.service.install(h.f.summary);
  await waitFor(() => h.requests.length === 1);
  h.service.cancel();
  await assert.rejects(h.service.inspect(), /still finishing/);
  gate.resolve(new Response(h.f.bytes));
  await assert.rejects(operation, { name: 'AbortError' });
  assert.equal(h.images.length, 0);
  assert.deepEqual(h.assets.allPuts, []);
  h.fetchHook = null;
  assert.equal((await h.service.install(h.f.summary)).committed, true);
  await h.noWriter();
  await h.preserved();
});

test('cancelled image verification releases its image and a late decoder cannot publish', async (t) => {
  const h = await setup(t),
    gate = deferred(),
    abort = new AbortController();
  h.decodeHook = () => gate.promise;
  const operation = h.service.install(h.f.summary, { signal: abort.signal });
  await waitFor(() => h.images.length === 1);
  abort.abort();
  await assert.rejects(operation, { name: 'AbortError' });
  assert.equal(h.images[0].releases, 1);
  gate.resolve();
  await Promise.resolve();
  assert.deepEqual(h.assets.allPuts, []);
  assert.equal(
    h.locks.calls.some(([key]) => key.endsWith('.writer')),
    false,
  );
  await h.preserved();
});

test('cancellation during writer acquisition releases a late granted lease without publication', async (t) => {
  const h = await setup(t),
    gate = deferred();
  let waiting = false;
  h.locks.before = (key) => {
    if (key === h.pointer.keys.writerKey) {
      waiting = true;
      return gate.promise;
    }
  };
  const operation = h.service.install(h.f.summary);
  await waitFor(() => waiting);
  h.service.cancel();
  gate.resolve();
  await assert.rejects(operation, { name: 'AbortError' });
  await h.noWriter();
  assert.deepEqual(h.assets.allPuts, []);
  await h.preserved();
});

test('fresh writer-owned inspection preserves a chapter added while the download was pending', async (t) => {
  const h = await setup(t),
    second = await fixture('another-chapter'),
    gate = deferred();
  h.fetchHook = () => gate.promise;
  const operation = h.service.install(h.f.summary);
  await waitFor(() => h.requests.length === 1);
  await h.seed([second.pack]);
  gate.resolve(new Response(h.f.bytes));
  const result = await operation;
  assert.equal(result.committed, true);
  assert.deepEqual(
    result.library.packs.map((pack) => pack.id),
    [second.pack.id, h.f.pack.id],
  );
  assert.deepEqual(result.library.packs[0], second.pack);
  await h.noWriter();
  await h.preserved();
});

test('concurrent exact installation is reused while conflicting installation rejects without replacement', async (t) => {
  for (const same of [true, false]) {
    const h = await setup(t),
      gate = deferred();
    h.fetchHook = () => gate.promise;
    const operation = h.service.install(h.f.summary);
    await waitFor(() => h.requests.length === 1);
    const other = same
      ? h.f
      : await fixture(h.f.pack.id, { description: 'Different installed edition.' });
    const before = await h.seed([other.pack]);
    gate.resolve(new Response(h.f.bytes));
    if (same) {
      const result = await operation;
      assert.equal(result.reused, true);
      assert.equal(result.committed, false);
    } else await assert.rejects(operation, /different.*edition/);
    assert.equal((await h.pointer.snapshot()).packs, before);
    assert.deepEqual(h.assets.allPuts, []);
    await h.noWriter();
    await h.preserved();
  }
});

test('a backup marker arriving after review blocks the real commit and a fresh retry succeeds', async (t) => {
  const h = await setup(t);
  await assert.rejects(
    h.service.install(h.f.summary, {
      onStatus({ stage }) {
        if (stage === 'saving') h.values.set(h.pointer.keys.lockKey, 'new backup owner');
      },
    }),
    /backup|changed|lock/i,
  );
  assert.deepEqual(h.assets.allPuts, []);
  h.values.delete(h.pointer.keys.lockKey);
  assert.equal((await h.service.install(h.f.summary)).committed, true);
  await h.noWriter();
  await h.preserved();
});

test('transaction put failure is atomic, keeps the old library and requires a new explicit operation', async (t) => {
  const h = await setup(t),
    other = await fixture('retained-chapter'),
    before = await h.seed([other.pack]);
  h.assets.failAnyPutAt = 1;
  await assert.rejects(h.service.install(h.f.summary), /write failure/);
  assert.equal((await h.pointer.snapshot()).packs, before);
  await h.noWriter();
  h.assets.failAnyPutAt = null;
  assert.equal((await h.service.install(h.f.summary)).committed, true);
  await h.noWriter();
  await h.preserved();
});

test('abort or disposal after durable commit reports committed installation, never a fictitious rollback', async (t) => {
  for (const dispose of [false, true]) {
    const h = await setup(t),
      abort = new AbortController();
    let observedLease = false;
    h.assets.afterAnyCommit = () => {
      observedLease = h.locks.held.has(h.pointer.keys.writerKey);
      if (dispose) h.service.dispose();
      else abort.abort();
    };
    const result = await h.service.install(h.f.summary, { signal: abort.signal });
    assert.equal(result.committed, true);
    assert.equal(result.reused, false);
    assert.equal(observedLease, true);
    assert.deepEqual(JSON.parse((await h.pointer.snapshot()).packs).packs, [h.f.pack]);
    assert.deepEqual(h.assets.allPuts, [['assets', h.pointer.keys.packsKey]]);
    await h.noWriter();
    await h.preserved();
    if (dispose) await assert.rejects(h.service.inspect(), { name: 'AbortError' });
  }
});

test('observer throws cannot alter installation; observer cancellation before commit prevents every write', async (t) => {
  const h = await setup(t);
  let nested;
  await assert.rejects(
    h.service.install(h.f.summary, {
      onStatus({ stage }) {
        if (stage === 'saving') {
          nested = assert.rejects(h.service.install(h.f.summary), /still finishing/);
          h.service.cancel();
        }
      },
    }),
    { name: 'AbortError' },
  );
  await nested;
  assert.deepEqual(h.assets.allPuts, []);
  await h.noWriter();
  assert.equal(
    (
      await h.service.install(h.f.summary, {
        onStatus() {
          throw new Error('Observer only');
        },
      })
    ).committed,
    true,
  );
  await h.noWriter();
  await h.preserved();
});

test('caller summary is captured before any async boundary; disposed service cannot resume', async (t) => {
  const h = await setup(t),
    summary = structuredClone(h.f.summary);
  const operation = h.service.install(summary);
  summary.sha256 = 'f'.repeat(64);
  assert.equal((await operation).committed, true);
  h.service.dispose();
  h.service.dispose();
  await assert.rejects(h.service.inspect(), { name: 'AbortError' });
  await assert.rejects(h.service.install(h.f.summary), { name: 'AbortError' });
  await h.noWriter();
  await h.preserved();
});
