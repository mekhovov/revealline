import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRemoteSoloVersusLibrarySources } from '../mission-library/remote-solo-versus.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { createExternalChapterPointerStore } from '../external-chapter-pointer.mjs';
import { PACK_LIBRARY_VERSION } from '../packs.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { buildRouteWorld } from '../../authoring/library/route-worlds/build.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { deferred } from './helpers/media-fixtures.mjs';

// Real source pins/PNG bytes and the real validators/installers. Image below
// models browser decode completion/header dimensions, not native GPU/disk QA.
const world = await buildRouteWorld('retro');
const baseURL = 'https://example.test/releases/v0.84.0/site/game/';
class Locks {
  held = new Set();
  async request(key, _options, work) {
    if (this.held.has(key)) return work(null);
    this.held.add(key);
    try {
      return await work({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
async function fixture(t) {
  const assets = managedIndexedDB(),
    media = managedIndexedDB(),
    locks = new Locks();
  const values = new Map([
      ['revealline.library.dev.v1', 'retained progress'],
      ['revealline.suspended.dev.v1', 'retained attempt'],
    ]),
    retained = [...values],
    images = [],
    urls = new Map(),
    requests = [],
    launches = [];
  const indexedDB = {
    open(name, ...args) {
      assert(['revealline-assets-v1', 'revealline-soundtrack-v1'].includes(name));
      return (name === 'revealline-assets-v1' ? assets : media).indexedDB.open(name, ...args);
    },
  };
  const pointer = createExternalChapterPointerStore({
    indexedDB,
    profileKey: 'revealline.library.dev.v1',
    packsKey: 'revealline.packs.dev.v1',
  });
  await pointer.compareAndSwap(await pointer.snapshot(), {
    packs: JSON.stringify({ format: PACK_LIBRARY_VERSION, packs: [] }),
    index: null,
    journal: null,
  });
  let decodeHook = null,
    sequence = 0;
  async function dimensions(value) {
    const source =
      typeof value === 'string'
        ? value
        : `data:image/png;base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`;
    const header = inspectImageDataUrl(source);
    assert.equal(header.valid, true);
    return { naturalWidth: header.width, naturalHeight: header.height };
  }
  class Image {
    constructor() {
      images.push(this);
      this.releases = 0;
    }
    set src(value) {
      this.source = value;
      void dimensions(urls.get(value) ?? value).then(
        (size) => {
          Object.assign(this, size);
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
  const owner = await createRemoteSoloVersusLibrarySources({
    baseURL,
    installed: {
      channel: 'dev',
      indexedDB,
      lockManager: locks,
      storage: {
        getItem: (key) => values.get(key) ?? null,
        setItem() {
          assert.fail('No player progress writes');
        },
        removeItem() {
          assert.fail('No player data deletion');
        },
      },
      ImageClass: Image,
      URLImpl: {
        createObjectURL(blob) {
          const key = `blob:remote-${++sequence}`;
          urls.set(key, blob);
          return key;
        },
        revokeObjectURL(key) {
          assert(urls.delete(key));
        },
      },
    },
    fetch: async (url) => {
      const path = new URL(url).pathname.split('/site/')[1];
      requests.push(path);
      if (path === `optional/external-chapters/${world.descriptor.id}/pack.json`)
        return new Response(world.payloads.pack);
      if (path === `optional/external-chapters/${world.descriptor.id}/media.rlmedia`)
        return new Response(world.payloads.media);
      return new Response(await readFile(new URL('../../' + path, import.meta.url)));
    },
    launch: async (context) => {
      if (!(await context.confirmInventory())) return false;
      launches.push({
        id: context.libraryMissionId,
        mode: context.mode,
        selection: context.selection,
      });
      return true;
    },
  });
  const library = createMissionLibrary(owner.sources);
  const row = (id) =>
    library.missions
      .filter((entry) => entry.collection === 'Classic' && JSON.parse(entry.ownerId)[2] === id)
      .at(-1);
  const published = () => {
    const store = assets.contents().get('assets');
    return Boolean(
      store
        ?.get(pointer.keys.indexKey)
        ?.chapters?.some((entry) => entry.id === world.descriptor.id) &&
        store?.get(pointer.keys.journalKey) === null,
    );
  };
  async function settled() {
    await waitFor(() => !locks.held.has(pointer.keys.writerKey));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual([...values], retained);
    assert.equal(urls.size, 0);
    assert(images.every((image) => image.releases === 1));
  }
  t.after(() => {
    owner.dispose();
    library.dispose();
    pointer.close();
  });
  return {
    owner,
    library,
    row,
    assets,
    media,
    pointer,
    requests,
    images,
    launches,
    published,
    settled,
    set decodeHook(value) {
      decodeHook = value;
    },
    async corruptOriginal() {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('revealline-soundtrack-v1', 5);
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
    },
  };
}

test('real optional chapter downloads, validates images and becomes Play without changing row or launching', async (t) => {
  const f = await fixture(t),
    row = f.row('original-retro-1994');
  assert.equal(f.images.length, 0);
  assert.equal(f.library.availability(row).state, 'download');
  assert.deepEqual(await f.library.prepare(row), { state: 'ready' });
  assert.equal(f.library.find(row.id), row);
  assert(f.images.length >= 3);
  assert.equal(f.launches.length, 0);
  assert(f.requests.includes('game/content/optional-worlds.json'));
  assert(
    f.requests.includes('authoring/library/four-worlds-chapters/packs/original-retro-1994.json'),
  );
  assert.equal(await f.library.launch(row, { mode: 'versus', isCurrent: () => true }), true);
  assert.deepEqual(
    f.launches.map((value) => [value.id, value.mode]),
    [[row.id, 'versus']],
  );
  assert.equal(f.launches[0].selection.levelIndex, 2);
  await f.settled();
});

test('real paired chapter needs separate Play, refresh clears proof without decoding, and Play rechecks independent media', async (t) => {
  const f = await fixture(t),
    row = f.row(world.descriptor.id);
  assert.equal(f.images.length, 0);
  assert.equal(f.library.availability(row).state, 'download');
  assert.deepEqual(await f.library.prepare(row), { state: 'ready' });
  assert.equal(f.published(), true);
  assert.equal(f.launches.length, 0);
  const downloaded = f.requests.filter((path) => path.startsWith('optional/')).length;
  assert.equal(downloaded, 2);
  const decodes = f.images.length;
  await f.owner.refresh();
  assert.equal(f.images.length, decodes, 'An explicit metadata refresh does not decode pictures.');
  assert.equal(f.library.availability(row).state, 'unavailable');
  assert.equal(f.library.availability(row).retry, true);
  assert.deepEqual(await f.library.prepare(row), { state: 'ready' });
  assert(f.images.length > decodes, 'Installed Retry actually checks all original bytes/decodes.');
  assert.equal(f.requests.filter((path) => path.startsWith('optional/')).length, downloaded);
  const checked = f.images.length;
  assert.equal(await f.library.launch(row, { mode: 'solo', isCurrent: () => true }), true);
  assert(f.images.length > checked, 'A remembered proof cannot replace the Play-time media check.');
  assert.equal(f.launches.length, 1);
  await f.corruptOriginal();
  await assert.rejects(f.library.launch(row, { mode: 'versus', isCurrent: () => true }), /SHA-256/);
  assert.equal(f.launches.length, 1, 'Corrupted media cannot reach the receiving-host handoff.');
  await f.settled();
});

test('paired cancellation before publication is non-launching and preserves exact installed bytes', async (t) => {
  const f = await fixture(t),
    row = f.row(world.descriptor.id),
    gate = deferred(),
    signal = new AbortController();
  const before = await f.pointer.snapshot();
  let decoding = false;
  f.decodeHook = async () => {
    decoding = true;
    await gate.promise;
  };
  t.after(() => gate.resolve());
  const work = f.library.prepare(row, { signal: signal.signal });
  await waitFor(() => decoding, { timeoutMs: 30000 });
  signal.abort();
  assert.deepEqual(await work, { state: 'cancelled' });
  gate.resolve();
  await f.settled();
  assert.deepEqual(await f.pointer.snapshot(), before);
  assert.equal(f.launches.length, 0);
  assert.equal(f.published(), false);
});

test('committed but unconfirmed paired originals remain installed, show truthful Retry, and never launch automatically', async (t) => {
  const f = await fixture(t),
    row = f.row(world.descriptor.id);
  f.decodeHook = async () => {
    if (f.published()) throw new Error('Post-commit original check unavailable');
  };
  await assert.rejects(f.library.prepare(row), /were installed.*readiness could not be confirmed/);
  assert.equal(f.published(), true);
  assert.equal(f.library.availability(row).state, 'unavailable');
  assert.equal(f.library.availability(row).retry, true);
  assert.equal(f.launches.length, 0);
  const count = f.requests.filter((path) => path.startsWith('optional/')).length;
  f.decodeHook = null;
  assert.deepEqual(await f.library.prepare(row), { state: 'ready' });
  assert.equal(f.requests.filter((path) => path.startsWith('optional/')).length, count);
  assert.equal(f.launches.length, 0);
  await f.settled();
});

test('cancellation after paired publication never removes committed content or grants a ready proof', async (t) => {
  const f = await fixture(t),
    row = f.row(world.descriptor.id),
    signal = new AbortController();
  let cancelled = false;
  f.assets.afterAnyCommit = () => {
    if (!cancelled && f.published()) {
      cancelled = true;
      signal.abort();
    }
  };
  assert.deepEqual(await f.library.prepare(row, { signal: signal.signal }), { state: 'cancelled' });
  await f.settled();
  assert.equal(cancelled, true);
  assert.equal(f.published(), true);
  assert.notEqual(f.library.availability(row).state, 'ready');
  assert.equal(f.launches.length, 0);
  f.assets.afterAnyCommit = null;
  // Cancellation resolves the chooser immediately. A publication already
  // committed must finish its readonly metadata refresh before a new explicit
  // visit can reserve the same backup lock; observe that finite boundary.
  await waitFor(
    () => f.owner.state().ready && f.library.availability(row).state === 'unavailable',
    { timeoutMs: 30000 },
  );
  await f.owner.refresh();
  assert.equal(f.library.availability(row).state, 'unavailable');
  assert.equal(
    f.library.availability(row).retry,
    true,
    JSON.stringify({
      state: f.owner.state(),
      availability: f.library.availability(row),
      stored: (await f.pointer.snapshot()).journal,
    }),
  );
  assert.deepEqual(await f.library.prepare(row), { state: 'ready' });
  assert.equal(f.launches.length, 0);
  await f.settled();
});
