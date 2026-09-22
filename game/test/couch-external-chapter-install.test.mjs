import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCouchChapterInstaller } from '../couch/couch-chapter-install.mjs';
import { createExternalChapterPointerStore } from '../external-chapter-pointer.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { emptyPackLibrary, exportPackLibrary, installPack, preparePack } from '../packs.mjs';
import { buildRouteWorld } from '../../authoring/library/route-worlds/build.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { waitFor } from './helpers/wait-for.mjs';

// Compiler verifies the real original PNG CRC/scanline bytes. Runtime Image
// below models decode completion/header dimensions, not browser hardware/disk.
const world = await buildRouteWorld('retro');
const index = JSON.parse(
  await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
);
const row = index.missions.filter((item) => item.packId === world.descriptor.id).at(-1);
const decodeHeader = async (value) => {
  const url =
    typeof value === 'string'
      ? value
      : `data:image/png;base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`;
  const header = inspectImageDataUrl(url);
  assert(header.valid);
  return { naturalWidth: header.width, naturalHeight: header.height };
};
class Locks {
  held = new Set();
  calls = [];
  async request(key, options, run) {
    this.calls.push(key);
    assert.equal(options.ifAvailable, true);
    if (this.held.has(key)) return run(null);
    this.held.add(key);
    try {
      return await run({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
async function setup(t, missionIndex = index) {
  const assets = managedIndexedDB(),
    media = managedIndexedDB(),
    locks = new Locks();
  const indexedDB = {
    open(name, version) {
      assert(['revealline-assets-v1', 'revealline-soundtrack-v1'].includes(name));
      return (name === 'revealline-assets-v1' ? assets : media).indexedDB.open(name, version);
    },
  };
  const values = new Map([
      ['revealline.library.dev.v1', 'existing Solo progress'],
      ['revealline.suspended.dev.v1', 'existing pinned attempt'],
    ]),
    preserved = [...values],
    requests = [],
    images = [],
    urls = new Map();
  let nextURL = 0,
    fetchHook = null,
    decodeHook = null;
  class Image {
    constructor() {
      images.push(this);
      this.releases = 0;
    }
    set src(value) {
      this.source = value;
      void decodeHeader(urls.get(value) ?? value).then(
        (dimensions) => {
          Object.assign(this, dimensions);
          this.onload?.();
        },
        () => this.onerror?.(),
      );
    }
    async decode() {
      await decodeHook?.(this);
    }
    removeAttribute() {
      this.source = null;
      this.releases++;
    }
  }
  const pointer = createExternalChapterPointerStore({
    indexedDB,
    profileKey: 'revealline.library.dev.v1',
    packsKey: 'revealline.packs.dev.v1',
  });
  const service = createCouchChapterInstaller({
    channel: 'dev',
    registeredEntries: [],
    indexedDB,
    missionIndex,
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem() {
        assert.fail('No player writes');
      },
      removeItem() {
        assert.fail('No player deletion');
      },
    },
    lockManager: locks,
    ImageClass: Image,
    URLImpl: {
      createObjectURL(blob) {
        const url = `blob:test-${++nextURL}`;
        urls.set(url, blob);
        return url;
      },
      revokeObjectURL(url) {
        assert(urls.delete(url));
      },
    },
    baseURL: 'https://game.example/releases/v-test/site/',
    fetch: async (url, options) => {
      requests.push([url, options]);
      return fetchHook
        ? fetchHook(url, options)
        : new Response(url.endsWith('/pack.json') ? world.payloads.pack : world.payloads.media);
    },
  });
  async function put(key, value) {
    await pointer.snapshot();
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('revealline-assets-v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('assets', 'readwrite');
        tx.objectStore('assets').put(value, key);
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
  t.after(() => {
    service.dispose();
    pointer.close();
  });
  return {
    assets,
    media,
    indexedDB,
    locks,
    values,
    pointer,
    service,
    requests,
    images,
    urls,
    put,
    set fetchHook(fn) {
      fetchHook = fn;
    },
    set decodeHook(fn) {
      decodeHook = fn;
    },
    async settled() {
      await waitFor(() => !locks.held.has(pointer.keys.writerKey));
      assert.deepEqual([...values], preserved);
      assert.equal(urls.size, 0);
      assert(images.every((image) => image.releases === 1));
    },
  };
}

test('exact absent paired metadata never claims ready or opens media/downloads', async (t) => {
  const h = await setup(t);
  const result = await h.service.inspectExternal(row);
  assert.equal(result.status, 'absent');
  assert.equal(result.ready, false);
  assert.equal(result.bytes, world.descriptor.pack.bytes + world.descriptor.media.bytes);
  assert.equal(h.media.openCount, 0);
  assert.deepEqual(h.requests, []);
  assert.deepEqual(h.images, []);
  assert.equal(
    h.locks.calls.some((key) => key.endsWith('.writer')),
    false,
  );
  assert.deepEqual(h.assets.allPuts, []);
});

test('trusted pair publishes with existing journal, checks real originals and reuses without writes', async (t) => {
  const h = await setup(t),
    statuses = [];
  const result = await h.service.installExternal(row, {
    onStatus: (value) => statuses.push(value),
  });
  assert.equal(result.committed, true);
  assert.equal(result.reused, false);
  assert.equal(result.ready, true);
  assert.equal(result.pack.id, world.descriptor.id);
  assert.equal(result.library.packs[0], result.pack);
  assert.equal(result.pins.length, 3);
  assert.equal(result.store, undefined);
  assert.equal(result.mediaGeneration, 1);
  assert(result.usage.indexBytes > 0);
  assert(statuses.some((value) => value.stage === 'saving'));
  assert.equal(h.requests.length, 2);
  for (const [i, file] of ['pack.json', 'media.rlmedia'].entries()) {
    assert.equal(
      h.requests[i][0],
      `https://game.example/releases/v-test/site/optional/external-chapters/${world.descriptor.id}/${file}`,
    );
    assert.equal(h.requests[i][1].redirect, 'error');
    assert.equal(h.requests[i][1].credentials, 'same-origin');
  }
  const published = await h.pointer.snapshot();
  assert.equal(published.journal, null);
  assert.deepEqual(published.index.chapters, [world.descriptor]);
  assert(h.assets.allPuts.some(([, key]) => key === h.pointer.keys.journalKey));
  const beforeAssets = h.assets.contents(),
    beforeMedia = h.media.contents();
  h.assets.allPuts.length = h.media.allPuts.length = 0;
  const reused = await h.service.installExternal(row);
  assert.equal(reused.committed, false);
  assert.equal(reused.reused, true);
  assert.equal(reused.ready, true);
  assert.equal(h.requests.length, 2);
  assert.deepEqual(h.assets.allPuts, []);
  assert.deepEqual(h.media.allPuts, []);
  assert.deepEqual(h.assets.contents(), beforeAssets);
  assert.deepEqual(h.media.contents(), beforeMedia);
  assert.equal((await h.service.inspectExternal(row)).ready, true);
  await h.settled();
  const db = await new Promise((resolve, reject) => {
    const request = h.indexedDB.open('revealline-soundtrack-v1', 5);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('mediaBlobs', 'readwrite');
    tx.objectStore('mediaBlobs').put(
      new Blob([new Uint8Array(world.descriptor.originals[0].bytes)]),
      world.descriptor.originals[0].sha256,
    );
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  const corrupted = h.media.contents();
  h.assets.allPuts.length = h.media.allPuts.length = 0;
  await assert.rejects(h.service.inspectExternal(row), /SHA-256/);
  await assert.rejects(h.service.installExternal(row), /SHA-256/);
  assert.equal(h.requests.length, 2, 'Broken originals need explicit recovery, not replacement.');
  assert.deepEqual(h.assets.allPuts, []);
  assert.deepEqual(h.media.allPuts, []);
  assert.deepEqual(h.media.contents(), corrupted);
});

test('foreign caller rows and trusted-index claims cannot nominate another source or weaken paired pins', async (t) => {
  const h = await setup(t);
  const changed = structuredClone(row);
  changed.download.mediaPath = 'https://foreign.example/wrong';
  await assert.rejects(h.service.installExternal(changed), /exact mission/);
  for (const alter of [
    (item) => {
      item.download.mediaPath = 'optional/wrong.rlmedia';
    },
    (item) => {
      item.sourceFile.sha256 = '0'.repeat(64);
    },
    (item) => {
      item.download.bytes++;
    },
    (item) => {
      item.levelId += '-wrong';
    },
  ]) {
    const forged = structuredClone(index);
    const target = forged.missions.find((item) => item.id === row.id);
    alter(target);
    const bad = await setup(t, forged);
    await assert.rejects(bad.service.installExternal(target), /code-owned/);
    assert.deepEqual(bad.requests, []);
    assert.equal(bad.assets.openCount, 0);
  }
  assert.deepEqual(h.requests, []);
  assert.equal(h.assets.openCount, 0);
});

test('truncated or tampered pair never claims the writer or installs compact JSON alone', async (t) => {
  for (const corruption of ['truncated', 'tampered']) {
    const h = await setup(t);
    h.fetchHook = async (url) => {
      if (url.endsWith('/pack.json')) return new Response(world.payloads.pack);
      if (corruption === 'truncated') return new Response(new Uint8Array(1));
      const bytes = new Uint8Array(await world.payloads.media.arrayBuffer());
      bytes[bytes.length - 1] ^= 1;
      return new Response(bytes);
    };
    await assert.rejects(h.service.installExternal(row), /incomplete|differ|match/i);
    assert.equal((await h.pointer.snapshot()).packs, null);
    assert.deepEqual(h.assets.allPuts, []);
    assert.deepEqual(h.media.allPuts, []);
    assert.equal(
      h.locks.calls.some((key) => key.endsWith('.writer')),
      false,
    );
    await h.settled();
  }
});

test('same-ID compact upload and pending recovery remain untouched without downloads', async (t) => {
  for (const conflict of ['upload', 'journal']) {
    const h = await setup(t);
    if (conflict === 'upload') {
      const uploaded = structuredClone(world.prepared.pack);
      uploaded.name = 'Player upload with a conflicting ID';
      const { pack } = await preparePack(uploaded);
      await h.put(
        h.pointer.keys.packsKey,
        exportPackLibrary(installPack(emptyPackLibrary(), pack)),
      );
    } else await h.put(h.pointer.keys.journalKey, { pending: 'preserve for explicit recovery' });
    const before = h.assets.contents();
    h.assets.allPuts.length = 0;
    await assert.rejects(h.service.installExternal(row), /descriptor index|recovery/);
    assert.deepEqual(h.assets.contents(), before);
    assert.deepEqual(h.assets.allPuts, []);
    assert.deepEqual(h.requests, []);
  }
});

test('cancellation during original decode releases native resources before writer or publication', async (t) => {
  const h = await setup(t),
    gate = deferred(),
    signal = new AbortController();
  let decoding = false;
  h.decodeHook = async () => {
    decoding = true;
    await gate.promise;
  };
  const work = h.service.installExternal(row, { signal: signal.signal });
  const rejected = assert.rejects(work, { name: 'AbortError' });
  await waitFor(() => decoding, { timeoutMs: 30000 });
  signal.abort();
  await rejected;
  gate.resolve();
  assert.equal((await h.pointer.snapshot()).packs, null);
  assert.deepEqual(h.assets.allPuts, []);
  assert.equal(
    h.locks.calls.some((key) => key.endsWith('.writer')),
    false,
  );
  await h.settled();
});

test('cancellation after durable publication reports committed, not ready or rolled back', async (t) => {
  const h = await setup(t),
    signal = new AbortController();
  const result = await h.service.installExternal(row, {
    signal: signal.signal,
    onStatus: ({ message }) => {
      if (message === 'Chapter installed. Verifying saved originals…') signal.abort();
    },
  });
  assert.equal(result.committed, true);
  assert.equal(result.reused, false);
  assert.equal(result.ready, false);
  assert.equal(result.library, null);
  assert.equal(result.usage, null);
  assert.match(result.reason, /were installed.*readiness could not be confirmed/);
  const stored = await h.pointer.snapshot();
  assert.equal(stored.journal, null);
  assert(stored.packs.includes(world.descriptor.id));
  assert.equal((await h.service.inspectExternal(row)).ready, true);
  await h.settled();
});

test('retained picture conflict requires genuine explicit review and never silently changes assignment', async (t) => {
  const h = await setup(t);
  const manager = createManagedMediaStore({ indexedDB: h.indexedDB, soundtrackCatalogue: true });
  const still = createStillMediaStore({ managedStore: manager, decodeImage: decodeHeader });
  t.after(() => {
    still.close();
    manager.close();
  });
  const library = structuredClone(world.prepared.imported.document.library);
  library.presentations.push({
    ...library.presentations[0],
    revision: 2,
    description: 'Player retained art',
  });
  library.assignments[0].revision = 2;
  await still.commit(
    await still.prepare(library, world.prepared.imported.assets, {
      executionCatalog: world.prepared.executionCatalog,
    }),
    { expectedGeneration: 0 },
  );
  const before = await still.read();
  let review;
  await assert.rejects(h.service.installExternal(row), (error) => {
    review = error;
    return error.name === 'RetainedPictureAssignmentConflict';
  });
  assert.deepEqual((await still.read()).document, before.document);
  assert.equal((await h.pointer.snapshot()).packs, null);
  await assert.rejects(h.service.installExternal(row, { pictureReview: {} }), /expired|changed/);
  assert.deepEqual((await still.read()).document, before.document);
  const result = await h.service.installExternal(row, { pictureReview: review });
  assert.equal(result.ready, true);
  assert.equal(result.committed, true);
  assert.deepEqual((await still.read()).document, before.document);
  assert.equal(result.pins[0].presentationRevision, 1);
  await h.settled();
});
