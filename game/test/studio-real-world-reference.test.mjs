import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { SYNEVYR_REFERENCE, loadBundledReference } from '../studio/real-world-reference.mjs';
import { loadMapReference } from '../content-design/image-authoring.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createImageWorkbench } from '../studio/image-workbench.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { t } from '../i18n/index.mjs';

const jpeg = await readFile(new URL(`../${SYNEVYR_REFERENCE.path}`, import.meta.url));
const digest = (bytes) => createHash('sha256').update(bytes).digest();
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
};
function response(bytes = jpeg, type = 'image/jpeg') {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += 10000)
          controller.enqueue(bytes.subarray(offset, offset + 10000));
        controller.close();
      },
    }),
    { headers: { 'content-type': type } },
  );
}
const bundledFile = () => loadBundledReference({ fetchAsset: async () => response(), digest });
function imageFactory(width = 960) {
  const image = {
    naturalWidth: width,
    naturalHeight: 540,
    disposed: false,
    async decode() {},
    removeAttribute() {
      this.disposed = true;
    },
    set src(value) {
      this.url = value;
      queueMicrotask(() => this.onload?.());
    },
  };
  return image;
}

test('bundled photograph matches its byte pin and passes the existing JPEG decode boundary', async () => {
  assert.equal(jpeg.length, SYNEVYR_REFERENCE.bytes);
  assert.equal(digest(jpeg).toString('hex'), SYNEVYR_REFERENCE.sha256);
  assert(Object.isFrozen(SYNEVYR_REFERENCE));
  let fetched = 0;
  const file = await loadBundledReference({
    fetchAsset: async (path, options) => {
      fetched++;
      assert.equal(path, SYNEVYR_REFERENCE.path);
      assert.equal(options.redirect, 'error');
      assert.equal(options.cache, 'no-store');
      assert(options.signal instanceof AbortSignal);
      return response();
    },
    digest,
  });
  assert.equal(fetched, 1);
  assert.equal(file.type, 'image/jpeg');
  assert.equal(file.name, SYNEVYR_REFERENCE.name);
  assert.equal(file.size, SYNEVYR_REFERENCE.bytes);
  const image = imageFactory();
  const decoded = await loadMapReference(file, { createImage: () => image });
  assert.equal(decoded.width, SYNEVYR_REFERENCE.width);
  assert.equal(decoded.height, SYNEVYR_REFERENCE.height);
  assert.equal(decoded.source.dataUrl, `data:image/jpeg;base64,${jpeg.toString('base64')}`);
  decoded.dispose();
  assert(image.disposed);
  const mismatched = imageFactory(961);
  await assert.rejects(loadMapReference(file, { createImage: () => mismatched }), /dimensions/);
  assert(mismatched.disposed);
});

test('wrong MIME, truncation, oversized streams, changed bytes and failed digests are rejected', async () => {
  const changed = Buffer.from(jpeg);
  changed[changed.length - 10] ^= 1;
  const cases = [
    { fetchAsset: async () => response(jpeg, 'text/html') },
    { fetchAsset: async () => response(jpeg.subarray(0, -1)) },
    { fetchAsset: async () => response(Buffer.concat([jpeg, Buffer.from([0])])) },
    { fetchAsset: async () => response(changed) },
    { fetchAsset: async () => new Response(null, { status: 404 }) },
    { fetchAsset: async () => ({ ...response(), redirected: true }) },
    {
      fetchAsset: async () => response(),
      digest: async () => {
        throw new Error('Digest unavailable');
      },
    },
  ];
  for (const options of cases)
    await assert.rejects(
      loadBundledReference({ digest, ...options }),
      (error) => error.localization?.key === 'errors:studio.image.bundledFailed',
    );
});

test('aborting a delayed fetch returns promptly and cancels a late response', async () => {
  const pending = deferred();
  const started = deferred();
  const controller = new AbortController();
  const loading = loadBundledReference({
    signal: controller.signal,
    fetchAsset: () => {
      started.resolve();
      return pending.promise;
    },
    digest,
  });
  await started.promise;
  controller.abort();
  await assert.rejects(loading, { name: 'AbortError' });
  let cancelled = false;
  pending.resolve({
    body: {
      cancel: async () => {
        cancelled = true;
      },
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert(cancelled);
});

test('aborting during stream or digest prevents an admitted file', async () => {
  const started = deferred();
  const controller = new AbortController();
  let cancelled = false;
  const loading = loadBundledReference({
    signal: controller.signal,
    fetchAsset: async () =>
      new Response(
        new ReadableStream({
          start() {
            started.resolve();
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { 'content-type': 'image/jpeg' } },
      ),
    digest,
  });
  await started.promise;
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(loading, { name: 'AbortError' });
  assert(cancelled);
  const digestStarted = deferred();
  const lateDigest = deferred();
  const nextController = new AbortController();
  const next = loadBundledReference({
    signal: nextController.signal,
    fetchAsset: async () => response(),
    digest: () => {
      digestStarted.resolve();
      return lateDigest.promise;
    },
  });
  await digestStarted.promise;
  nextController.abort();
  await assert.rejects(next, { name: 'AbortError' });
  lateDigest.resolve(digest(jpeg));
});

function workbenchFixture(loadReference, { deferSync = false } = {}) {
  const document = new Document();
  for (const id of (
    'reference-status reference-queue reference-file reference-show reference-tools ' +
    'reference-apply reference-play reference-preview reference-crop reference-clear ' +
    'reference-queue-add reference-queue-undo reference-inspect reference-synevyr reference-synevyr-download ' +
    'crop-x crop-y crop-w crop-h surface x y w h'
  ).split(' ')) {
    const element = document.createElement('input');
    element.id = id;
    document.body.append(element);
  }
  const $ = (id) => document.getElementById(id);
  const source = createStarterProject();
  let mission = source.missions[0],
    applies = 0,
    plays = 0,
    changes = 0;
  let ready = false;
  const images = [];
  const api = createImageWorkbench({
    document,
    getSource: () => source,
    getMission: () => {
      assert(ready, 'Studio session must not be read during workbench construction');
      return mission;
    },
    getDifficulty: () => 'standard',
    redraw() {},
    apply() {
      applies++;
      return true;
    },
    play() {
      plays++;
    },
    onChange() {
      changes++;
    },
    loadReference:
      loadReference ??
      ((file) =>
        loadMapReference(file, {
          createImage: () => {
            const image = imageFactory();
            images.push(image);
            return image;
          },
        })),
  });
  ready = true;
  if (!deferSync) api.sync();
  return {
    $,
    api,
    source,
    images,
    counters: () => ({ applies, plays, changes }),
    select(value) {
      mission = value;
      api.sync();
    },
  };
}

test('optional photo button loads an underlay without applying geometry or changing the project', async () => {
  const f = workbenchFixture();
  const before = structuredClone(f.source);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert(url.pathname.endsWith(`/${SYNEVYR_REFERENCE.path}`));
    return response();
  };
  try {
    const click = [...f.$('reference-synevyr').listeners.get('click')][0];
    await click();
    assert(f.api.underlay());
    assert.equal(f.api.snapshot().reference.name, SYNEVYR_REFERENCE.name);
    assert.deepEqual(f.source, before);
    assert.deepEqual(f.counters(), { applies: 0, plays: 0, changes: 1 });
    assert.equal(f.api.hasPending(), false);
    assert.equal(f.$('reference-apply').disabled, true);
    assert.equal(f.$('reference-play').disabled, true);
    assert.equal(f.$('reference-synevyr').disabled, false);
    await f.$('reference-apply').onclick();
    assert.equal(f.counters().applies, 0);
  } finally {
    globalThis.fetch = originalFetch;
    f.api.dispose();
  }
});

test('optional actions do not read the Studio session or fetch during construction', () => {
  const f = workbenchFixture(undefined, { deferSync: true });
  assert.equal(f.$('reference-synevyr').disabled, true);
  assert.equal(f.$('reference-synevyr-download').disabled, false);
  f.api.sync();
  assert.equal(f.$('reference-synevyr').disabled, false);
  f.api.dispose();
});

test('Studio restores disposed optional listeners on a persisted pageshow without duplicates', async () => {
  const f = workbenchFixture();
  const host = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const start = host.indexOf("window.addEventListener('pageshow'");
  const end = host.indexOf('\nasync function boot()', start);
  assert(start > 0 && end > start);
  let show;
  const context = {
    session: null,
    imageWorkbench: f.api,
    window: {
      addEventListener(type, handler) {
        assert.equal(type, 'pageshow');
        show = handler;
      },
    },
  };
  vm.runInNewContext(host.slice(start, end), context);
  f.api.dispose();
  show({ persisted: true });
  assert.equal(
    f.$('reference-synevyr').listeners.get('click').size,
    0,
    'unbooted session stays inert',
  );
  context.session = {};
  show({ persisted: false });
  assert.equal(f.$('reference-synevyr').listeners.get('click').size, 0);
  show({ persisted: true });
  show({ persisted: true });
  for (const id of ['reference-synevyr', 'reference-synevyr-download'])
    assert.equal(f.$(id).listeners.get('click').size, 1);
  f.api.dispose();
});

test('verified download preserves the accepted reference, geometry and inspection state', async () => {
  const f = workbenchFixture();
  await f.api.loadFile(bundledFile);
  const before = f.api.snapshot();
  const sourceBefore = structuredClone(f.source);
  const statusBefore = f.$('reference-status').textContent;
  const originalFetch = globalThis.fetch;
  const createURL = URL.createObjectURL,
    revokeURL = URL.revokeObjectURL;
  const blobs = [],
    revoked = [];
  let fetches = 0;
  globalThis.fetch = async (_url, options) => {
    fetches++;
    assert.equal(options.cache, 'no-store');
    return response();
  };
  URL.createObjectURL = (blob) => {
    blobs.push(blob);
    return `blob:reference-${blobs.length}`;
  };
  URL.revokeObjectURL = (url) => revoked.push(url);
  try {
    const click = [...f.$('reference-synevyr-download').listeners.get('click')][0];
    await click({ ctrlKey: true });
    assert.equal(fetches, 0, 'Modified link actions retain normal browser navigation.');
    let prevented = false;
    await click({
      preventDefault() {
        prevented = true;
      },
    });
    assert(prevented);
    assert.equal(fetches, 1);
    assert.equal(blobs.length, 1);
    assert.equal(blobs[0].size, SYNEVYR_REFERENCE.bytes);
    assert.equal(
      digest(new Uint8Array(await blobs[0].arrayBuffer())).toString('hex'),
      SYNEVYR_REFERENCE.sha256,
    );
    assert.deepEqual(f.api.snapshot(), before);
    assert.deepEqual(f.source, sourceBefore);
    assert.equal(f.$('reference-status').textContent, statusBefore);
    assert.deepEqual(f.counters(), { applies: 0, plays: 0, changes: 1 });
    assert.equal(f.$('reference-apply').disabled, true);
    f.api.dispose();
    assert.deepEqual(revoked, ['blob:reference-1']);
    assert.equal(f.$('reference-synevyr-download').listeners.get('click').size, 0);
    assert.equal(f.$('reference-synevyr').listeners.get('click').size, 0);
  } finally {
    f.api.dispose();
    globalThis.fetch = originalFetch;
    URL.createObjectURL = createURL;
    URL.revokeObjectURL = revokeURL;
  }
});

test('failed downloads report an error and disposal cancels a delayed download without a blob', async () => {
  const f = workbenchFixture();
  await f.api.loadFile(bundledFile);
  const before = f.api.snapshot();
  const originalFetch = globalThis.fetch;
  const createURL = URL.createObjectURL;
  let blobs = 0;
  URL.createObjectURL = () => {
    blobs++;
    throw new Error('No download should be created');
  };
  try {
    const click = [...f.$('reference-synevyr-download').listeners.get('click')][0];
    globalThis.fetch = async () => response(jpeg.subarray(1));
    await click();
    assert.deepEqual(f.api.snapshot(), before);
    assert.equal(f.$('reference-status').textContent, t('errors:studio.image.bundledFailed'));
    assert.equal(f.$('reference-synevyr-download').disabled, false);
    const pending = deferred(),
      started = deferred();
    let signal;
    globalThis.fetch = (_url, options) => {
      signal = options.signal;
      started.resolve();
      return pending.promise;
    };
    const downloading = click();
    await started.promise;
    assert.equal(f.$('reference-synevyr-download').disabled, true);
    f.api.dispose();
    const statusAfterDispose = f.$('reference-status').textContent;
    await downloading;
    assert(signal.aborted);
    pending.resolve(response());
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.$('reference-status').textContent, statusAfterDispose);
    assert.equal(blobs, 0);
  } finally {
    f.api.dispose();
    globalThis.fetch = originalFetch;
    URL.createObjectURL = createURL;
  }
});

test('failed and cancelled asynchronous replacements keep the accepted reference', async () => {
  const f = workbenchFixture();
  await f.api.loadFile(bundledFile);
  const old = f.api.snapshot();
  const pending = deferred();
  const replacing = f.api.loadFile(() => pending.promise);
  assert.equal(f.$('reference-synevyr').disabled, true);
  assert.equal(f.$('reference-tools').disabled, true);
  pending.reject(new Error('Fetch unavailable'));
  await assert.rejects(replacing, /Fetch unavailable/);
  assert.deepEqual(f.api.snapshot(), old);
  assert.equal(f.images[0].disposed, false);
  assert.equal(f.$('reference-tools').disabled, false);
  assert.equal(f.$('reference-synevyr').disabled, false);
  assert.equal(await f.api.loadFile(async () => null), false);
  assert.deepEqual(f.api.snapshot(), old);
  assert.equal(f.counters().changes, 1);
  f.api.dispose();
});

test('mission changes and disposal cancel pending suppliers before they can decode', async () => {
  for (const change of ['mission', 'dispose', 'draft']) {
    let decodes = 0;
    const f = workbenchFixture(async () => {
      decodes++;
      throw new Error('Must not decode');
    });
    const pending = deferred();
    let signal;
    const loading = f.api.loadFile((inputSignal) => {
      signal = inputSignal;
      return pending.promise;
    });
    if (change === 'mission') f.select(null);
    else if (change === 'dispose') f.api.dispose();
    else {
      f.source.name = 'New draft';
      f.api.sync();
    }
    assert(signal.aborted);
    pending.resolve(await bundledFile());
    assert.equal(await loading, false);
    assert.equal(decodes, 0);
    assert.equal(f.api.underlay(), null);
    assert.equal(f.counters().changes, 0);
    assert.equal(f.$('reference-synevyr').disabled, change === 'mission');
    f.api.dispose();
  }
});

test('a newer upload wins over a slow supplier and a stale decoded image is disposed', async () => {
  const f = workbenchFixture();
  const pending = deferred();
  const slow = f.api.loadFile(() => pending.promise);
  await f.api.loadFile(bundledFile);
  const accepted = f.api.snapshot();
  pending.resolve(await bundledFile());
  assert.equal(await slow, false);
  assert.deepEqual(f.api.snapshot(), accepted);
  assert.equal(f.images.length, 1);
  f.api.dispose();

  const decoded = deferred();
  const g = workbenchFixture(() => decoded.promise);
  const late = g.api.loadFile(await bundledFile());
  g.select(null);
  let disposed = false;
  decoded.resolve({
    dispose() {
      disposed = true;
    },
  });
  assert.equal(await late, false);
  assert(disposed);
  assert.equal(g.api.underlay(), null);
  g.api.dispose();
});
