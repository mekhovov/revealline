import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySoundtrackLibrary } from '../soundtrack.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';
import { mergeSoundtrackAlbum, resolveSoundtrackAlbumCatalog } from '../soundtrack-albums.mjs';
import {
  fetchSoundtrackAlbum,
  fetchSoundtrackAlbumCatalog,
} from '../soundtrack-album-download.mjs';
import { structuralProbe, memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { createManagedMediaStore, MANAGED_MEDIA_LIMITS } from '../managed-media-store.mjs';
import { albumFixture, albumCatalog, responseFor } from './helpers/soundtrack-albums.mjs';

const baseURL = 'https://example.test/release-39/';
test('album union shares the actual picture/story staging budget and preserves all domains on refusal', async () => {
  const a = await albumFixture('qa.shared-a'),
    b = await albumFixture('qa.shared-b');
  const memory = memoryIndexedDB();
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true });
  const store = createSoundtrackStore({ managedStore: manager });
  try {
    await store.commit(a.prepared, { expectedGeneration: 0 });
    const before = await store.read(),
      usage = await manager.usage();
    const merged = mergeSoundtrackAlbum(before.library, before.assets, b.prepared, b.album);
    const prepared = await prepareSoundtrackLibrary(merged.library, merged.assets, {
      probeMedia: structuralProbe,
    });
    const held = await manager.reserve({
      domain: 'story',
      expectedGeneration: 0,
      maxNewBytes: MANAGED_MEDIA_LIMITS.bytes - usage.usedBytes - 1024,
    });
    await assert.rejects(
      store.commit(prepared, { expectedGeneration: 1, otherManagedBytes: 0 }),
      /256 MiB/,
    );
    assert.deepEqual((await store.read()).library, before.library);
    assert.deepEqual((await manager.usage()).generations, { audio: 1, media: 0, story: 0 });
    assert.equal(
      (await manager.usage()).reservations,
      1,
      'the album cannot release another domain’s reservation',
    );
    await manager.release(held);
    await store.commit(prepared, { expectedGeneration: 1 });
    assert.deepEqual((await manager.usage()).generations, { audio: 2, media: 0, story: 0 });
    assert.equal((await store.read()).library.tracks.length, 2);
    assert.deepEqual((await store.read()).library.selection, before.library.selection);
  } finally {
    store.close();
    manager.close();
  }
});
test('album union preserves draft edits, selection and assignments; repeats are idempotent and original hashes deduplicate', async () => {
  const a = await albumFixture('qa.first'),
    b = await albumFixture('qa.second'),
    c = await albumFixture('qa.same-bytes', 'qa.first');
  const before = {
    ...a.album.library,
    tracks: [{ ...a.track, title: 'Applied custom title' }],
    assignments: [{ scope: 'global', key: null, playlistId: a.album.id }],
  };
  const merged = mergeSoundtrackAlbum(before, a.prepared.assets, b.prepared, b.album);
  assert.equal(merged.library.tracks[0].title, 'Applied custom title');
  assert.deepEqual(merged.library.selection, before.selection);
  assert.deepEqual(merged.library.assignments, before.assignments);
  assert.equal(merged.addedTracks, 1);
  const again = mergeSoundtrackAlbum(merged.library, merged.assets, b.prepared, b.album);
  assert.deepEqual(again.library, merged.library);
  assert.equal(again.addedTracks, 0);
  const dedup = mergeSoundtrackAlbum(again.library, again.assets, c.prepared, c.album);
  assert.equal(dedup.library.tracks.length, 3);
  assert.equal(dedup.assets.length, 2);
  assert.equal(before.tracks.length, 1, 'caller draft was never mutated');
});
test('album conflicts, borrowed metadata and missing originals refuse before a draft can change', async () => {
  const a = await albumFixture('qa.a'),
    b = await albumFixture('qa.b');
  assert.throws(
    () =>
      mergeSoundtrackAlbum(
        { ...a.album.library, tracks: [{ ...a.track, title: 'Mine' }] },
        a.prepared.assets,
        a.prepared,
        a.album,
      ),
    /Conflicting track ID/,
  );
  assert.throws(
    () => mergeSoundtrackAlbum(a.album.library, [], b.prepared, b.album),
    /every draft original/,
  );
  assert.throws(
    () => mergeSoundtrackAlbum(emptySoundtrackLibrary(), [], { ...a.prepared }, a.album),
    /actual verified import/,
  );
  assert.throws(
    () => mergeSoundtrackAlbum(emptySoundtrackLibrary(), [], a.prepared, b.album),
    /differs from the selected album/,
  );
  const same = await albumFixture('qa.same', 'qa.a');
  const changed = structuredClone(a.album.library);
  changed.tracks[0].asset.frames++;
  changed.tracks[0].asset.durationSeconds += 1152 / changed.tracks[0].asset.sampleRate;
  assert.throws(
    () => mergeSoundtrackAlbum(changed, a.prepared.assets, same.prepared, same.album),
    /conflicting metadata/,
  );
});
test('complete union uses existing CAS and quota admission; failed save preserves previous album', async () => {
  const a = await albumFixture('qa.a'),
    b = await albumFixture('qa.b'),
    db = memoryIndexedDB();
  const store = createSoundtrackStore({ indexedDB: db.indexedDB });
  try {
    await store.commit(a.prepared, { expectedGeneration: 0 });
    const result = mergeSoundtrackAlbum(a.album.library, a.prepared.assets, b.prepared, b.album);
    const prepared = await prepareSoundtrackLibrary(result.library, result.assets, {
      probeMedia: structuralProbe,
    });
    await assert.rejects(store.commit(prepared, { expectedGeneration: 0 }), /changed/);
    await assert.rejects(
      store.commit(prepared, { expectedGeneration: 1, otherManagedBytes: 256 * 1024 * 1024 }),
      /256 MiB/,
    );
    assert.deepEqual((await store.read()).library, a.prepared.library);
    await store.commit(prepared, { expectedGeneration: 1 });
    const current = await store.read();
    assert.equal(current.library.tracks.length, 2);
    assert.equal(current.assets.length, 2);
  } finally {
    store.close();
  }
});
test('catalog rejects assignments, path escapes, invalid source URLs, duplicates and accessors without invoking them', async () => {
  const a = await albumFixture();
  assert.throws(() => resolveSoundtrackAlbumCatalog(albumCatalog(a.album, a.album)), /Duplicate/);
  for (const delta of [
    { path: '../borrow.rlsound' },
    { source: 'javascript:alert(1)' },
    { bytes: 64 * 1024 * 1024 + 1 },
  ])
    assert.throws(() => resolveSoundtrackAlbumCatalog(albumCatalog({ ...a.album, ...delta })));
  let calls = 0;
  const hostile = { ...a.album };
  Object.defineProperty(hostile, 'path', {
    enumerable: true,
    get() {
      calls++;
      return a.album.path;
    },
  });
  assert.throws(() => resolveSoundtrackAlbumCatalog(albumCatalog(hostile)));
  assert.equal(calls, 0);
  const assigned = structuredClone(a.album);
  assigned.library.assignments.push({ scope: 'global', key: null, playlistId: a.album.id });
  assert.throws(
    () => resolveSoundtrackAlbumCatalog(albumCatalog(assigned)),
    /no automatic assignments/,
  );
});
test('download verifies actual framing and exact catalog identity with a captured version-local request', async () => {
  const a = await albumFixture(),
    calls = [];
  const request = async (url, options) => {
    calls.push([url, options]);
    return responseFor(url.endsWith('.json') ? JSON.stringify(albumCatalog(a.album)) : a.blob, url);
  };
  const options = { baseURL, fetch: request, probeMedia: structuralProbe };
  const catalog = await fetchSoundtrackAlbumCatalog(options);
  const pending = fetchSoundtrackAlbum(catalog.albums[0], options);
  options.baseURL = 'https://wrong.test/';
  options.fetch = () => {
    throw Error('borrowed later fetch');
  };
  const actual = await pending;
  assert.deepEqual(actual.library, a.prepared.library);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][0], baseURL + a.album.path);
  assert.equal(calls[1][1].redirect, 'error');
  await assert.rejects(
    fetchSoundtrackAlbum(
      { ...a.album, sha256: 'a'.repeat(64) },
      { baseURL, fetch: request, probeMedia: structuralProbe },
    ),
    /hash differs/,
  );
  await assert.rejects(
    fetchSoundtrackAlbum(a.album, {
      baseURL,
      fetch: async () => responseFor(a.blob, 'https://wrong.test/body'),
      probeMedia: structuralProbe,
    }),
    /declared URL/,
  );
  const borrowed = structuredClone(a.album);
  borrowed.library.tracks[0].title = 'A different declared work';
  await assert.rejects(
    fetchSoundtrackAlbum(borrowed, { baseURL, fetch: request, probeMedia: structuralProbe }),
    /metadata differs/,
  );
});
test('missing size headers cannot hide excess bytes; timeout cancels a stalled reader', async () => {
  const a = await albumFixture();
  await assert.rejects(
    fetchSoundtrackAlbum(a.album, {
      baseURL,
      fetch: async (url) => responseFor(new Blob([a.blob, new Uint8Array(1)]), url),
      probeMedia: structuralProbe,
    }),
    /exceeded/,
  );
  let cancelled = 0;
  const body = new ReadableStream({
    pull() {},
    cancel() {
      cancelled++;
    },
  });
  await assert.rejects(
    fetchSoundtrackAlbum(a.album, {
      baseURL,
      fetch: async (url) => responseFor(body, url),
      timeoutMs: 10,
      probeMedia: structuralProbe,
    }),
    /timed out/,
  );
  assert.equal(cancelled, 1);
});
test('cancelled native inspection joins its cleanup and cannot return a prepared album', async () => {
  const a = await albumFixture(),
    controller = new AbortController();
  let entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  let cleaned = false;
  const pending = fetchSoundtrackAlbum(a.album, {
    baseURL,
    fetch: async (url) => responseFor(a.blob, url),
    signal: controller.signal,
    probeMedia: (_, { signal }) =>
      new Promise((resolve, reject) => {
        entered();
        signal.addEventListener(
          'abort',
          () => {
            cleaned = true;
            reject(new DOMException('Cancelled', 'AbortError'));
          },
          { once: true },
        );
      }),
  });
  await started;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(cleaned, true);
});

test('complete album admission refuses partial HTTP responses', async () => {
  const a = await albumFixture();
  await assert.rejects(
    fetchSoundtrackAlbum(a.album, {
      baseURL,
      fetch: async (url) => responseFor(a.blob, url, { status: 206 }),
      probeMedia: structuralProbe,
    }),
    /HTTP 200/,
  );
});

test('cancel joins a deferred fetch and its deferred body cancellation before release', async () => {
  const a = await albumFixture(),
    controller = new AbortController();
  let respond,
    finishCancel,
    entered,
    cancelCount = 0,
    released = false;
  const start = new Promise((resolve) => {
    entered = resolve;
  });
  const cancellation = new Promise((resolve) => {
    finishCancel = resolve;
  });
  const pending = fetchSoundtrackAlbum(a.album, {
    baseURL,
    signal: controller.signal,
    probeMedia: structuralProbe,
    fetch: () =>
      new Promise((resolve) => {
        respond = resolve;
        entered();
      }),
  });
  const settled = pending
    .catch((error) => error)
    .finally(() => {
      released = true;
    });
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  try {
    await start;
    controller.abort();
    await tick();
    assert.equal(released, false, 'task remains owned while the response is unresolved');
    respond(
      responseFor(
        new ReadableStream({
          cancel() {
            cancelCount++;
            return cancellation;
          },
        }),
        baseURL + a.album.path,
      ),
    );
    await tick();
    assert.equal(cancelCount, 1);
    assert.equal(released, false, 'body cancellation is joined');
    finishCancel();
    const error = await settled;
    assert.equal(error.name, 'AbortError');
  } finally {
    respond?.(responseFor(null, baseURL + a.album.path));
    finishCancel?.();
    await settled;
  }
});

test('a noncooperative request has a finite cleanup refusal and its later body is still discarded', async () => {
  const a = await albumFixture(),
    controller = new AbortController();
  let respond,
    entered,
    cancels = 0;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const pending = fetchSoundtrackAlbum(a.album, {
    baseURL,
    signal: controller.signal,
    cleanupTimeoutMs: 5,
    probeMedia: structuralProbe,
    fetch: () =>
      new Promise((resolve) => {
        respond = resolve;
        entered();
      }),
  });
  await started;
  controller.abort();
  await assert.rejects(pending, /cleanup is still pending/);
  respond(
    responseFor(
      new ReadableStream({
        cancel() {
          cancels++;
        },
      }),
      baseURL + a.album.path,
    ),
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cancels, 1);
});

test('catalogues support more than four albums and published original rights without admitting personal uploads', async () => {
  const albums = await Promise.all(
    Array.from({ length: 6 }, (_, i) => albumFixture(`qa.volume-${i}`)),
  );
  const original = structuredClone(albums[0].album);
  original.library.tracks[0].rights.kind = 'original';
  const catalog = resolveSoundtrackAlbumCatalog(
    albumCatalog(original, ...albums.slice(1).map((item) => item.album)),
  );
  assert.equal(catalog.albums.length, 6);
  original.library.tracks[0].rights.kind = 'personal';
  assert.throws(() => resolveSoundtrackAlbumCatalog(albumCatalog(original)), /publication source/);
  original.library.tracks[0].rights.kind = 'original';
  original.library.tracks[0].rights.license = '';
  assert.throws(() => resolveSoundtrackAlbumCatalog(albumCatalog(original)), /publication source/);
});

test('v2 album addition tags new songs without overwriting existing tags or losing installed catalogue bytes', async () => {
  const { upgradeSoundtrackLibrary } = await import('../soundtrack.mjs');
  const a = await albumFixture('qa.tagged'),
    b = await albumFixture('qa.metal');
  const base = upgradeSoundtrackLibrary(a.album.library);
  const tags = { genres: ['ukrainian'], role: 'menu', energy: 1, themes: ['ukraine'] };
  const original = {
    ...a.track,
    id: 'builtin.catalog.qa.original',
    edition: 'qa',
    path: 'optional/soundtracks/qa.mp3',
    tags,
  };
  const before = {
    ...base,
    tags: { [a.track.id]: tags },
    catalogTracks: [original],
    installedTrackIds: [original.id],
  };
  const merged = mergeSoundtrackAlbum(before, a.prepared.assets, b.prepared, {
    ...b.album,
    genre: 'Rock / metal',
  });
  assert.deepEqual(merged.library.tags[a.track.id], tags);
  assert.deepEqual(merged.library.tags[b.track.id], {
    genres: ['metal'],
    role: 'any',
    energy: 3,
    themes: ['fpv'],
  });
  assert.deepEqual(merged.library.installedTrackIds, before.installedTrackIds);
  assert.equal(
    merged.assets.length,
    2,
    'shared catalogue/custom original hash remains deduplicated',
  );
});
