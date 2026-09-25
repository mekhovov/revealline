import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createCouchChapterInstaller } from '../couch/couch-chapter-install.mjs';
import { createExternalChapterPointerStore } from '../external-chapter-pointer.mjs';
import {
  preparePack,
  resolvePackCampaign,
  installPack,
  emptyPackLibrary,
  exportPackLibrary,
} from '../packs.mjs';
import { preparedPackIdentity } from '../mission-library/pack-identity.mjs';
import {
  CLASSIC_RULES_CURRENT,
  CLASSIC_RULES_ORIGINAL,
} from '../mission-library/classic-current-rules.mjs';
import { campaignKey } from '../library.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { pngBytes, deferred } from './helpers/media-fixtures.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const source = JSON.parse(
  await readFile(new URL('../content/packs/night-shift.json', import.meta.url)),
);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const decodeHeader = async (url) => {
  const header = inspectImageDataUrl(url);
  assert(header.valid);
  return { naturalWidth: header.width, naturalHeight: header.height };
};
async function fixture(kind = 'bundled', changes = {}) {
  const authored = structuredClone(source);
  authored.visualOverrides.background = {
    dataUrl: `data:image/png;base64,${pngBytes().toString('base64')}`,
    fit: 'contain',
  };
  Object.assign(authored, changes);
  const bytes = Buffer.from(JSON.stringify(authored));
  const { pack } = await preparePack(authored, { decodeImage: decodeHeader });
  const identity = await preparedPackIdentity(pack);
  const missions = pack.campaigns.flatMap((campaign) => {
    const entry = resolvePackCampaign(pack, campaign.id);
    return entry.campaign.levels.map((level, levelIndex) => ({
      id: `${pack.id}/${campaign.id}/${level.id}`,
      source: kind,
      packId: pack.id,
      packVersion: pack.version,
      campaignId: campaign.id,
      campaignKey: campaignKey(entry.campaign),
      campaignTitle: campaign.title,
      levelId: level.id,
      levelRevision: level.revision,
      levelIndex,
      name: level.name,
      edition: 'Injected trusted release fixture',
      modes: ['solo', 'versus'],
      difficultiesByMode: { solo: ['standard'], versus: ['standard'] },
      tags: ['Classic'],
      sourceFile: {
        path: `game/content/packs/${pack.id}.json`,
        bytes: bytes.length,
        sha256: digest(bytes),
      },
      packIdentity: identity,
    }));
  });
  return {
    pack,
    bytes,
    index: { format: 'revealline-mission-library-index.v1', missions },
    row: missions.at(-1),
  };
}
class Locks {
  held = new Set();
  calls = [];
  before = null;
  async request(key, options, work) {
    this.calls.push(key);
    await this.before?.(key);
    if (this.held.has(key)) return work(null);
    this.held.add(key);
    try {
      return await work({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
async function setup(t, f = null, options = {}) {
  f ??= await fixture();
  const assets = managedIndexedDB(),
    locks = new Locks(),
    requests = [],
    images = [];
  const values = new Map([
    ['revealline.library.dev.v1', 'retained-progress'],
    ['revealline.suspended.dev.v1', 'retained-flight'],
  ]);
  let fetchHook = null,
    decodeHook = null;
  class Image {
    constructor() {
      this.releases = 0;
      images.push(this);
    }
    set src(value) {
      const header = inspectImageDataUrl(value);
      assert(header.valid);
      this.naturalWidth = header.width;
      this.naturalHeight = header.height;
      queueMicrotask(() => this.onload?.());
    }
    async decode() {
      await decodeHook?.();
    }
    removeAttribute() {
      this.releases++;
    }
  }
  const pointer = createExternalChapterPointerStore({
    indexedDB: assets.indexedDB,
    profileKey: 'revealline.library.dev.v1',
    packsKey: 'revealline.packs.dev.v1',
  });
  const service = createCouchChapterInstaller({
    channel: 'dev',
    registeredEntries: [],
    indexedDB: assets.indexedDB,
    missionIndex: f.index,
    ImageClass: Image,
    lockManager: locks,
    baseURL: 'https://game.example/releases/v-test/site/',
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem() {
        assert.fail('No player writes');
      },
      removeItem() {
        assert.fail('No player deletion');
      },
    },
    fetch: async (url, request) => {
      requests.push([url, request]);
      return fetchHook ? fetchHook(url, request) : new Response(f.bytes);
    },
    ...options,
  });
  async function seed(packs) {
    await pointer.snapshot();
    const db = await new Promise((resolve, reject) => {
      const request = assets.indexedDB.open('revealline-assets-v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const library = packs.reduce((value, pack) => installPack(value, pack), emptyPackLibrary());
      await new Promise((resolve, reject) => {
        const tx = db.transaction('assets', 'readwrite');
        tx.objectStore('assets').put(exportPackLibrary(library), pointer.keys.packsKey);
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
    assets.allPuts.length = 0;
    return (await pointer.snapshot()).packs;
  }
  t.after(() => {
    service.dispose();
    pointer.close();
  });
  return {
    f,
    assets,
    locks,
    requests,
    images,
    values,
    service,
    pointer,
    seed,
    set fetchHook(value) {
      fetchHook = value;
    },
    set decodeHook(value) {
      decodeHook = value;
    },
    async preserved() {
      assert.deepEqual(
        [...values],
        [
          ['revealline.library.dev.v1', 'retained-progress'],
          ['revealline.suspended.dev.v1', 'retained-flight'],
        ],
      );
      await waitFor(() => !locks.held.has(pointer.keys.writerKey));
    },
  };
}

for (const source of ['bundled', 'archived'])
  test(`${source} exact late mission authenticates all pack missions and atomically installs without launch`, async (t) => {
    const h = await setup(t, await fixture(source));
    const result = await h.service.installIndexed(h.f.row);
    assert(result.committed && !result.reused);
    assert.deepEqual(result.pack, h.f.pack);
    assert.equal(result.usage.packBytes, Buffer.byteLength((await h.pointer.snapshot()).packs));
    assert.deepEqual(h.assets.allPuts, [['assets', h.pointer.keys.packsKey]]);
    assert.equal(
      h.requests[0][0],
      `https://game.example/releases/v-test/site/${h.f.row.sourceFile.path}`,
    );
    assert.equal(h.requests[0][1].redirect, 'error');
    assert.equal(h.requests[0][1].credentials, 'same-origin');
    assert(h.images.length > 0 && h.images.every((image) => image.releases === 1));
    await h.preserved();
  });

test('indexed installer accepts only the two known Classic rules projections', async (t) => {
  const h = await setup(t);
  await assert.rejects(
    h.service.installIndexed({ ...h.f.row, rulesEdition: 'untrusted-rules' }),
    /supported Classic rules edition/,
  );
  assert.equal(h.requests.length, 0);

  const installed = await h.service.installIndexed({
    ...h.f.row,
    rulesEdition: CLASSIC_RULES_ORIGINAL,
  });
  assert.equal(installed.committed, true);
  const reused = await h.service.installIndexed({
    ...h.f.row,
    rulesEdition: CLASSIC_RULES_CURRENT,
  });
  assert.equal(reused.reused, true);
  assert.equal(h.requests.length, 1);
  await h.preserved();
});

for (const id of ['night-shift', 'fpv-arcade-r4'])
  test(`real generated ${id} index matches exact published bytes and prepared identity`, async (t) => {
    const bytes = await readFile(new URL(`../content/packs/${id}.json`, import.meta.url));
    const index = JSON.parse(
      await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
    );
    const row = index.missions.filter((item) => item.packId === id).at(-1);
    const h = await setup(t, { bytes, index, row });
    const result = await h.service.installIndexed(row);
    assert.deepEqual(await preparedPackIdentity(result.pack), row.packIdentity);
    await h.preserved();
  });

test('unregistered or altered caller metadata and unsafe trusted paths reject before IO', async (t) => {
  const h = await setup(t);
  for (const changes of [
    { id: 'unregistered' },
    { packId: 'other' },
    { levelId: 'other' },
    { sourceFile: { ...h.f.row.sourceFile, sha256: 'a'.repeat(64) } },
  ])
    await assert.rejects(h.service.installIndexed({ ...h.f.row, ...changes }), /exact mission/);
  assert.deepEqual(h.requests, []);
  assert.deepEqual(h.assets.allPuts, []);
  const altered = structuredClone(h.f);
  for (const row of altered.index.missions) row.sourceFile.path = '../other.json';
  altered.row = altered.index.missions.at(-1);
  const unsafe = await setup(t, altered);
  await assert.rejects(unsafe.service.installIndexed(altered.row), /exact bounded distribution/);
  assert.deepEqual(unsafe.requests, []);
  const absent = await setup(t, h.f, { missionIndex: undefined });
  await assert.rejects(absent.service.installIndexed(h.f.row), /trusted index/);
  for (const source of ['optional', 'external']) {
    const f = await fixture(source),
      other = await setup(t, f);
    await assert.rejects(other.service.installIndexed(f.row), /only bundled and archived/);
    assert.deepEqual(other.requests, []);
  }
});

test('exact reuse avoids download and writer; modified same-ID content cannot be overwritten', async (t) => {
  const h = await setup(t);
  await h.seed([h.f.pack]);
  const result = await h.service.installIndexed(h.f.row);
  assert(result.reused && !result.committed);
  assert.deepEqual(h.requests, []);
  assert(!h.locks.calls.includes(h.pointer.keys.writerKey));
  const modified = await fixture('bundled', { description: 'Changed original edition.' });
  const retained = await h.seed([modified.pack]);
  await assert.rejects(h.service.installIndexed(h.f.row), /different edition/);
  assert.equal((await h.pointer.snapshot()).packs, retained);
  assert.deepEqual(h.requests, []);
  assert.deepEqual(h.assets.allPuts, []);
  await h.preserved();
});

test('corrupt, truncated, oversized and redirected downloads fail before decoding or publication', async (t) => {
  const h = await setup(t),
    broken = Buffer.from(h.f.bytes);
  broken[broken.length - 2] ^= 1;
  for (const bytes of [
    broken,
    h.f.bytes.subarray(0, -1),
    Buffer.concat([h.f.bytes, Buffer.from('x')]),
  ]) {
    h.fetchHook = () => new Response(bytes);
    await assert.rejects(h.service.installIndexed(h.f.row), /checksum|incomplete|byte budget/);
  }
  h.fetchHook = () =>
    new Response(h.f.bytes, { headers: { 'content-length': String(h.f.bytes.length + 1) } });
  await assert.rejects(h.service.installIndexed(h.f.row), /byte budget/);
  h.fetchHook = () => {
    const response = new Response(h.f.bytes);
    Object.defineProperty(response, 'redirected', { value: true });
    return response;
  };
  await assert.rejects(h.service.installIndexed(h.f.row), /exact release URL/);
  assert.deepEqual(h.assets.allPuts, []);
  assert.equal(h.images.length, 0);
  assert(!h.locks.calls.includes(h.pointer.keys.writerKey));
});

test('complete source authentication cannot disguise mismatched campaign pins or omitted missions', async (t) => {
  for (const change of ['campaign', 'omit', 'duplicate']) {
    const f = await fixture();
    if (change === 'campaign') f.index.missions[0].campaignKey = 'wrong';
    if (change === 'omit') f.index.missions.shift();
    if (change === 'duplicate') {
      const row = { ...f.index.missions[0], id: 'duplicate-runtime-position' };
      f.index.missions.push(row);
    }
    f.row = f.index.missions.at(-1);
    const h = await setup(t, f);
    await assert.rejects(h.service.installIndexed(f.row), /different edition/);
    assert.deepEqual(h.assets.allPuts, []);
    assert(!h.locks.calls.includes(h.pointer.keys.writerKey));
  }
});

test('source-valid bytes still must match the full prepared artwork identity', async (t) => {
  const f = await fixture();
  for (const row of f.index.missions)
    row.packIdentity = { ...row.packIdentity, sha256: '0'.repeat(64) };
  f.row = f.index.missions.at(-1);
  const h = await setup(t, f);
  await assert.rejects(h.service.installIndexed(f.row), /different edition/);
  assert.deepEqual(h.assets.allPuts, []);
});

test('constructor index and request row are captured before asynchronous work', async (t) => {
  const h = await setup(t),
    supplied = structuredClone(h.f.row);
  const operation = h.service.installIndexed(supplied);
  supplied.sourceFile.path = 'elsewhere.json';
  h.f.index.missions.length = 0;
  const result = await operation;
  assert(result.committed);
  assert.equal(result.pack.id, h.f.pack.id);
  await h.preserved();
});

test('the fixed release root cannot be changed after construction or escape through credentials', async (t) => {
  const baseURL = new URL('https://game.example/releases/v-test/site/');
  const h = await setup(t, null, { baseURL });
  baseURL.href = 'https://different.example/';
  assert((await h.service.installIndexed(h.f.row)).committed);
  assert(
    h.requests[0][0].startsWith('https://game.example/releases/v-test/site/game/content/packs/'),
  );
  for (const baseURL of [
    'file:///game/',
    'https://user:password@game.example/releases/v-test/site/',
    'https://game.example/releases/v-test/site/?source=other',
    'https://game.example/releases/v-test/site',
  ]) {
    const blocked = await setup(t, null, { baseURL });
    await assert.rejects(blocked.service.installIndexed(blocked.f.row), /same-origin HTTP release/);
    assert.deepEqual(blocked.requests, []);
    assert.deepEqual(blocked.assets.allPuts, []);
  }
});

test('cancelling a held bounded stream stops its reader before any decode or writer lease', async (t) => {
  const h = await setup(t),
    abort = new AbortController();
  let cancelled = false;
  h.fetchHook = () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(h.f.bytes.subarray(0, 8));
        },
        cancel() {
          cancelled = true;
        },
      }),
    );
  const operation = h.service.installIndexed(h.f.row, { signal: abort.signal });
  await waitFor(() => h.requests.length === 1);
  abort.abort();
  await assert.rejects(operation, { name: 'AbortError' });
  assert(cancelled);
  assert.equal(h.images.length, 0);
  assert(!h.locks.calls.includes(h.pointer.keys.writerKey));
  assert.deepEqual(h.assets.allPuts, []);
});

test('late fetch cancellation is single-flight and cannot publish or autolaunch', async (t) => {
  const h = await setup(t),
    gate = deferred();
  h.fetchHook = () => gate.promise;
  const operation = h.service.installIndexed(h.f.row);
  await waitFor(() => h.requests.length === 1);
  h.service.cancel();
  await assert.rejects(h.service.installIndexed(h.f.row), /still finishing/);
  gate.resolve(new Response(h.f.bytes));
  await assert.rejects(operation, { name: 'AbortError' });
  assert.deepEqual(h.assets.allPuts, []);
  h.fetchHook = null;
  assert((await h.service.installIndexed(h.f.row)).committed);
  await h.preserved();
});

test('cancelled decode releases the image and late completion cannot acquire the writer', async (t) => {
  const h = await setup(t),
    gate = deferred(),
    controller = new AbortController();
  h.decodeHook = () => gate.promise;
  const operation = h.service.installIndexed(h.f.row, { signal: controller.signal });
  await waitFor(() => h.images.length === 1);
  controller.abort();
  await assert.rejects(operation, { name: 'AbortError' });
  gate.resolve();
  assert.equal(h.images[0].releases, 1);
  assert.deepEqual(h.assets.allPuts, []);
  assert(!h.locks.calls.includes(h.pointer.keys.writerKey));
  await h.preserved();
});

test('writer-owned reinspection reuses exact concurrent installs and rejects conflicting editions', async (t) => {
  for (const same of [true, false]) {
    const h = await setup(t),
      gate = deferred();
    h.fetchHook = () => gate.promise;
    const operation = h.service.installIndexed(h.f.row);
    await waitFor(() => h.requests.length === 1);
    const other = same
      ? h.f
      : await fixture('bundled', { description: 'Concurrent changed edition' });
    const before = await h.seed([other.pack]);
    gate.resolve(new Response(h.f.bytes));
    if (same) assert((await operation).reused);
    else await assert.rejects(operation, /different edition/);
    assert.equal((await h.pointer.snapshot()).packs, before);
    assert.deepEqual(h.assets.allPuts, []);
    await h.preserved();
  }
});

test('atomic put failure and unavailable writer preserve data; explicit retry succeeds', async (t) => {
  const h = await setup(t);
  h.locks.held.add(h.pointer.keys.writerKey);
  await assert.rejects(h.service.installIndexed(h.f.row), /cannot reserve/);
  h.locks.held.delete(h.pointer.keys.writerKey);
  h.assets.failAnyPutAt = 1;
  await assert.rejects(h.service.installIndexed(h.f.row), /write failure/);
  assert.equal((await h.pointer.snapshot()).packs, null);
  h.assets.failAnyPutAt = null;
  assert((await h.service.installIndexed(h.f.row)).committed);
  await h.preserved();
});

test('post-commit cancellation reports durable installation, not a fictitious rollback', async (t) => {
  const h = await setup(t),
    controller = new AbortController();
  h.assets.afterAnyCommit = () => controller.abort();
  const result = await h.service.installIndexed(h.f.row, { signal: controller.signal });
  assert(result.committed && !result.reused);
  assert.deepEqual(JSON.parse((await h.pointer.snapshot()).packs).packs, [h.f.pack]);
  await h.preserved();
});
