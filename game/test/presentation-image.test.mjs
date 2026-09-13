import test from 'node:test';
import assert from 'node:assert/strict';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { createPresentationPins } from '../presentation-pins.mjs';
import {
  acquirePresentationImage,
  createPresentationImageSlot,
} from '../ui/presentation-image.mjs';
import {
  mediaFixture,
  libraryRecord,
  pngBytes,
  provenance,
  deferred,
} from './helpers/media-fixtures.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';

async function fixture() {
  const f = mediaFixture(true),
    memory = memoryIndexedDB();
  const prepared = await prepareStillAsset(
    new Blob([pngBytes()]),
    { id: 'picture-a', provenance: provenance() },
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  const library = libraryRecord(f.identity);
  library.assets = [prepared.asset];
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, richStillMedia: true });
  const store = createStillMediaStore({
    managedStore: manager,
    decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  });
  await store.commit(
    await store.prepare(library, [{ sha256: prepared.asset.sha256, blob: prepared.blob }], {
      executionCatalog: f.catalog,
    }),
    { expectedGeneration: 0 },
  );
  const metadata = await store.readMetadata(),
    request = f.request('gentle');
  const pins = createPresentationPins({
    library: metadata.document.library,
    identityCatalog: f.identityCatalog,
    ...request,
    themeIds: ['fpv', 'ukraine'],
  });
  return {
    ...f,
    memory,
    store,
    manager,
    metadata,
    pin: pins.choices[0],
    legacy: pins.choices[1],
    context: { runId: 'run-1', ...request },
  };
}
function image(width = 1, height = 1) {
  return {
    width,
    height,
    naturalWidth: width,
    naturalHeight: height,
    removed: 0,
    closed: 0,
    removeAttribute(name) {
      assert.equal(name, 'src');
      this.removed++;
    },
    close() {
      this.closed++;
    },
  };
}
function urls(onCreate) {
  const created = [],
    revoked = [];
  return {
    created,
    revoked,
    createObjectURL(blob) {
      const url = `blob:test-${created.length}`;
      created.push({ blob, url });
      onCreate?.();
      return url;
    },
    revokeObjectURL(url) {
      revoked.push(url);
    },
  };
}
const input = (f, pin = f.pin) => ({ pin, metadata: f.metadata, store: f.store });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('exact historical pin acquires one original with atomic fit/image and idempotent retained lease', async () => {
  const f = await fixture(),
    URLImpl = urls(),
    drawn = image();
  const backdrop = await acquirePresentationImage(input(f), {
    URLImpl,
    decodeImage: async (url) => {
      assert.equal(url, URLImpl.created[0].url);
      return drawn;
    },
  });
  assert.equal(backdrop.image, drawn);
  assert.equal(backdrop.fit, 'contain');
  assert.equal(backdrop.sampling, 'nearest');
  assert.deepEqual(backdrop.pin, f.pin);
  assert.ok(Object.isFrozen(backdrop));
  assert.deepEqual(Buffer.from(await URLImpl.created[0].blob.arrayBuffer()), pngBytes());
  assert.deepEqual(URLImpl.revoked, []);
  backdrop.release();
  backdrop.release();
  assert.deepEqual(URLImpl.revoked, ['blob:test-0']);
  assert.equal(drawn.removed, 1);
  assert.equal(drawn.closed, 1);
  f.manager.close();
});

test('legacy choice uses no store, decoder or URL and does not resolve a current replacement', async () => {
  const f = await fixture(),
    URLImpl = urls();
  assert.equal(
    await acquirePresentationImage(
      { pin: f.legacy },
      { URLImpl, decodeImage: () => assert.fail('legacy decoder') },
    ),
    null,
  );
  assert.deepEqual(URLImpl.created, []);
  for (const edit of [
    (p) => {
      p.presentationRevision++;
    },
    (p) => {
      p.assetId = 'other-picture';
    },
    (p) => {
      p.sha256 = 'a'.repeat(64);
    },
    (p) => {
      p.identity.baseCampaignKey += ':other';
    },
    (p) => {
      p.identity.levelRevision = 'other';
    },
    (p) => {
      p.identity.themeId = 'ukraine';
    },
  ]) {
    const pin = structuredClone(f.pin);
    edit(pin);
    await assert.rejects(
      acquirePresentationImage(input(f, pin), { URLImpl }),
      /saved picture revision is missing/,
    );
  }
  assert.deepEqual(URLImpl.created, []);
  f.manager.close();
});

test('header-valid hash corruption refuses before drawable allocation', async () => {
  const f = await fixture(),
    URLImpl = urls();
  // Existing modeled shared audio store supports direct corruption injection;
  // remove the original media row through an explicit same-version transaction.
  const req = f.memory.indexedDB.open('revealline-soundtrack-v1', 3);
  const db = await new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result);
  });
  const tx = db.transaction(['mediaBlobs'], 'readwrite');
  const bad = pngBytes();
  bad[bad.length - 1] ^= 1;
  tx.objectStore('mediaBlobs').put(new Blob([bad]), f.pin.sha256);
  await new Promise((resolve) => {
    tx.oncomplete = resolve;
  });
  db.close();
  await assert.rejects(
    acquirePresentationImage(input(f), {
      URLImpl,
      decodeImage: () => assert.fail('corrupt decoder'),
    }),
    /SHA-256/,
  );
  assert.deepEqual(URLImpl.created, []);
  f.manager.close();
});

test('failure and wrong decoded dimensions release the candidate without returning a binding', async () => {
  const f = await fixture(),
    URLImpl = urls(),
    wrong = image(2, 1);
  await assert.rejects(
    acquirePresentationImage(input(f), {
      URLImpl,
      decodeImage: async () => {
        throw new Error('decode failure');
      },
    }),
    /decode failure/,
  );
  await assert.rejects(
    acquirePresentationImage(input(f), { URLImpl, decodeImage: async () => wrong }),
    /dimensions/,
  );
  const resized = image();
  resized.width = 0;
  await assert.rejects(
    acquirePresentationImage(input(f), { URLImpl, decodeImage: async () => resized }),
    /dimensions/,
  );
  assert.deepEqual(URLImpl.revoked, ['blob:test-0', 'blob:test-1', 'blob:test-2']);
  assert.equal(wrong.closed, 1);
  assert.equal(resized.closed, 1);
  f.manager.close();
});

test('abort while decoder is pending rejects promptly and cleans the late owned image', async () => {
  const f = await fixture(),
    URLImpl = urls(),
    controller = new AbortController(),
    started = deferred(),
    late = deferred();
  const pending = acquirePresentationImage(input(f), {
    URLImpl,
    signal: controller.signal,
    decodeImage: async () => {
      started.resolve();
      return late.promise;
    },
  });
  await started.promise;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual(URLImpl.revoked, ['blob:test-0']);
  const drawn = image();
  late.resolve(drawn);
  await tick();
  assert.equal(drawn.closed, 1);
  assert.equal(drawn.removed, 1);
  assert.equal(URLImpl.revoked.length, 1);
  f.manager.close();
});

test('abort during URL allocation starts no decoder and still releases the just-created URL', async () => {
  const f = await fixture(),
    controller = new AbortController(),
    URLImpl = urls(() => controller.abort());
  await assert.rejects(
    acquirePresentationImage(input(f), {
      URLImpl,
      signal: controller.signal,
      decodeImage: () => assert.fail('post-abort decoder'),
    }),
    { name: 'AbortError' },
  );
  assert.deepEqual(URLImpl.revoked, ['blob:test-0']);
  f.manager.close();
});

test('real browser decoder adapter waits for complete decode, handles failure and construction-time abort', async () => {
  const f = await fixture(),
    URLImpl = urls(),
    fully = deferred(),
    started = deferred(),
    images = [];
  class ImageClass {
    constructor() {
      Object.assign(this, image());
      images.push(this);
    }
    set src(value) {
      this.source = value;
      queueMicrotask(() => this.onload?.());
    }
    decode() {
      started.resolve();
      return fully.promise;
    }
  }
  let settled = false;
  const pending = acquirePresentationImage(input(f), { URLImpl, ImageClass }).then((value) => {
    settled = true;
    return value;
  });
  await started.promise;
  assert.equal(settled, false);
  fully.resolve();
  const binding = await pending;
  binding.release();
  assert.equal(images[0].closed, 1);
  class Broken extends ImageClass {
    decode() {
      return Promise.reject(new Error('undecodable'));
    }
  }
  await assert.rejects(
    acquirePresentationImage(input(f), { URLImpl, ImageClass: Broken }),
    /undecodable/,
  );
  const cancel = new AbortController();
  class Aborted extends ImageClass {
    constructor() {
      super();
      cancel.abort();
    }
  }
  await assert.rejects(
    acquirePresentationImage(input(f), { URLImpl, ImageClass: Aborted, signal: cancel.signal }),
    { name: 'AbortError' },
  );
  assert.equal(images.at(-1).source, undefined);
  assert.equal(images.at(-1).closed, 1);
  assert.equal(URLImpl.revoked.length, 3);
  f.manager.close();
});

test('slot publishes only complete same-context candidate and keeps prior through failure', async () => {
  const f = await fixture(),
    URLImpl = urls(),
    first = image(),
    next = image();
  const slot = createPresentationImageSlot();
  slot.setContext(f.context);
  assert.equal(
    await slot.load(input(f), { context: f.context, URLImpl, decodeImage: async () => first }),
    true,
  );
  const prior = slot.current(),
    wait = deferred(),
    began = deferred();
  const replacement = slot.load(input(f), {
    context: f.context,
    URLImpl,
    decodeImage: async () => {
      began.resolve();
      return wait.promise;
    },
  });
  await began.promise;
  assert.equal(slot.current(), prior);
  assert.equal(first.closed, 0);
  wait.reject(new Error('candidate failed'));
  await assert.rejects(replacement, /candidate failed/);
  assert.equal(slot.current(), prior);
  assert.equal(first.closed, 0);
  await slot.load(input(f), { context: f.context, URLImpl, decodeImage: async () => next });
  assert.equal(slot.current().image, next);
  assert.equal(first.closed, 1);
  assert.equal(slot.setContext({ ...f.context }), false);
  assert.equal(next.closed, 0);
  slot.dispose();
  assert.equal(next.closed, 1);
  assert.equal(slot.current(), null);
  await assert.rejects(slot.load(input(f)), /context/);
  f.manager.close();
});

test('slot cancels old run/world work and never publishes that drawable into the new context', async () => {
  const f = await fixture(),
    URLImpl = urls(),
    started = deferred(),
    late = deferred(),
    old = image();
  const slot = createPresentationImageSlot();
  slot.setContext(f.context);
  const pending = slot.load(input(f), {
    context: f.context,
    URLImpl,
    decodeImage: async () => {
      started.resolve();
      return late.promise;
    },
  });
  await started.promise;
  slot.setContext({ ...f.context, runId: 'run-2', themeId: 'ukraine' });
  assert.equal(await pending, false);
  assert.equal(slot.current(), null);
  await assert.rejects(
    slot.load(input(f), { context: { ...f.context, runId: 'run-2', themeId: 'ukraine' } }),
    /active map\/world/,
  );
  assert.equal(
    await slot.load(input(f, f.legacy), {
      context: { ...f.context, runId: 'run-2', themeId: 'ukraine' },
    }),
    true,
  );
  late.resolve(old);
  await tick();
  assert.equal(slot.current(), null);
  assert.equal(old.closed, 1);
  assert.equal(URLImpl.revoked.length, 1);
  slot.dispose();
  f.manager.close();
});

test('same-context supersession releases old decode and external abort retains current image', async () => {
  const f = await fixture(),
    URLImpl = urls(),
    initial = image(),
    late = deferred(),
    began = deferred();
  const slot = createPresentationImageSlot();
  slot.setContext(f.context);
  await slot.load(input(f), { context: f.context, URLImpl, decodeImage: async () => initial });
  const old = slot.load(input(f), {
    context: f.context,
    URLImpl,
    decodeImage: async () => {
      began.resolve();
      return late.promise;
    },
  });
  await began.promise;
  const newest = image();
  await slot.load(input(f), { context: f.context, URLImpl, decodeImage: async () => newest });
  assert.equal(await old, false);
  assert.equal(slot.current().image, newest);
  const stale = image();
  late.resolve(stale);
  await tick();
  assert.equal(stale.closed, 1);
  const cancel = new AbortController();
  cancel.abort();
  await assert.rejects(
    slot.load(input(f), { context: f.context, URLImpl, signal: cancel.signal }),
    { name: 'AbortError' },
  );
  assert.equal(slot.current().image, newest);
  assert.equal(newest.closed, 0);
  slot.clear();
  assert.equal(newest.closed, 1);
  f.manager.close();
});

test('context execution/map revision changes clear the prior binding before another frame', async () => {
  const f = await fixture(),
    URLImpl = urls(),
    slot = createPresentationImageSlot();
  for (const delta of [
    { executionKey: 'foreign-execution' },
    { levelRevision: 'other-revision' },
    { levelId: 'next-map' },
    { runId: 'next-attempt' },
  ]) {
    slot.setContext(f.context);
    const original = image();
    await slot.load(input(f), { context: f.context, URLImpl, decodeImage: async () => original });
    slot.setContext({ ...f.context, ...delta });
    assert.equal(slot.current(), null);
    assert.equal(original.closed, 1);
  }
  slot.dispose();
  f.manager.close();
});

test('late metadata preparation from an earlier same-map attempt cannot begin a new acquisition', async () => {
  const f = await fixture(),
    URLImpl = urls(),
    slot = createPresentationImageSlot();
  slot.setContext(f.context);
  slot.setContext({ ...f.context, runId: 'new-attempt' });
  await assert.rejects(
    slot.load(input(f), {
      context: f.context,
      URLImpl,
      decodeImage: () => assert.fail('stale caller decode'),
    }),
    /earlier display context/,
  );
  assert.deepEqual(URLImpl.created, []);
  assert.equal(slot.current(), null);
  slot.dispose();
  f.manager.close();
});
