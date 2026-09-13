import test from 'node:test';
import assert from 'node:assert/strict';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createStoryMediaStore } from '../story-media-store.mjs';
import { attachStillMediaPanel } from '../ui/still-media-panel.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { SoloElement } from './helpers/solo-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { mediaFixture, pngBytes, deferred } from './helpers/media-fixtures.mjs';
import { inspectionEnvironment, videoBytes } from './helpers/victory-story-fixture.mjs';
import { waitFor } from './helpers/wait-for.mjs';

// Real MP4 and PNG bytes/crypto/storage; this explicitly models a 1x1 native
// decoded frame and Canvas export. It is not browser codec or visual evidence.
async function setup(t, options = {}) {
  const doc = new Document();
  doc.createElement = (tag) => {
    const element = new SoloElement(doc, tag),
      set = element.setAttribute.bind(element);
    // Native input attribute reflection, absent from this minimal DOM fixture.
    element.setAttribute = (key, value) => {
      set(key, value);
      if (['type', 'min', 'max', 'step'].includes(key)) element[key] = String(value);
    };
    return element;
  };
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true });
  const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
  const store = createStillMediaStore({ managedStore: manager, decodeImage });
  const storyStore = createStoryMediaStore({ managedStore: manager, decodeImage });
  const f = mediaFixture(true),
    context = Object.freeze({ executionCatalog: f.catalog }),
    native = inspectionEnvironment({ facts: { width: 1, height: 1 } });
  let slow = false,
    calls = 0,
    id = 0,
    allocation = null;
  const paints = [];
  const inspection = {
    ...native.options,
    decodeImage,
    createVideo() {
      const v = native.options.createVideo();
      v.seekable = { length: 1, start: () => 0, end: () => 6 };
      v.seeking = false;
      v.time = 0;
      Object.defineProperty(v, 'currentTime', {
        get: () => v.time,
        set(value) {
          v.time = value;
          queueMicrotask(() => v.dispatchEvent(new Event('seeked')));
        },
      });
      v.requestVideoFrameCallback = (callback) =>
        setTimeout(
          () => callback(0, { mediaTime: Math.floor(v.time * 10) / 10, width: 1, height: 1 }),
          0,
        );
      v.cancelVideoFrameCallback = (handle) => clearTimeout(handle);
      if (slow) v.load = () => {};
      return v;
    },
    createCanvas() {
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage() {
            ++calls;
          },
        }),
        toBlob(callback) {
          callback(new Blob([pngBytes()], { type: 'image/png' }));
        },
      };
    },
  };
  const URLImpl = {
    ...native.options.URLImpl,
    createObjectURL(blob) {
      const url = native.options.URLImpl.createObjectURL(blob);
      allocation?.(blob, url);
      return url;
    },
  };
  const panel = attachStillMediaPanel({
    document: doc,
    store,
    storyStore,
    decodeImage,
    URLImpl,
    storyInspection: inspection,
    catalog: {
      read: async () => context,
      withCurrent: async (ticket, work) => {
        assert.equal(ticket, context);
        return work();
      },
    },
    preview: {
      canvas: doc.createElement('canvas'),
      async show(args, extra) {
        paints.push(args);
        return options.show ? options.show(args, extra) : true;
      },
      clear() {},
      dispose() {},
    },
    makeId: () => `picture-${++id}`,
    makeStoryId: () => `story-${++id}`,
    ...options.panel,
  });
  t.after(async () => {
    panel.dispose();
    await storyStore.close();
    manager.close();
  });
  const $ = (id) => doc.getElementById(`still-media-${id}`),
    s = (id) => $(`story-${id}`);
  assert.equal(await panel.open(), true);
  $('credit').value = 'Owned diagnostic fixture';
  $('source').value = 'Modeled codec boundary over owned MP4';
  $('description').value = 'Captured diagnostic picture';
  async function inspect() {
    s('file').files = [new Blob([videoBytes])];
    s('file').onchange();
    return s('inspect').onclick();
  }
  return {
    doc,
    panel,
    $,
    s,
    store,
    storyStore,
    native,
    paints,
    inspect,
    get calls() {
      return calls;
    },
    set slow(v) {
      slow = v;
    },
    set allocation(v) {
      allocation = v;
    },
  };
}

test('capture reports requested versus observed time, saves exact PNG through assignment and retains video for one story save', async (t) => {
  const h = await setup(t);
  assert.equal(await h.inspect(), true);
  h.s('frame-time').value = '2.05';
  h.s('frame-time').onchange();
  assert.equal(await h.s('capture').onclick(), true);
  assert.equal(h.calls, 1);
  assert.match(h.s('frame-facts').textContent, /Requested 2.05s · observed 2s · playhead 2.05s/);
  assert.equal(h.panel.snapshot().hasDraft, true);
  assert.equal(h.s('prepare').disabled, true);
  assert.equal((await h.store.read()).generation, 0);
  assert.equal((await h.storyStore.readMetadata()).generation, 0);
  assert.equal(await h.$('save').onclick(), true);
  const saved = await h.store.read();
  assert.deepEqual(Buffer.from(await saved.assets[0].blob.arrayBuffer()), pngBytes());
  assert.equal(
    h.s('prepare').disabled,
    false,
    'Capturing and saving did not dispose the video source.',
  );
  h.s('start').value = '2';
  h.s('end').value = '4';
  h.s('description').value = 'Owned test segment';
  assert.equal(await h.s('prepare').onclick(), true);
  assert.equal((await h.storyStore.readMetadata()).generation, 0);
  assert.equal(await h.s('save').onclick(), true);
  const inventory = await h.storyStore.exportInventory();
  assert.equal(inventory.generation, 1);
  assert.equal(inventory.document.bindings.length, 1);
  assert.deepEqual(Buffer.from(await inventory.assets[0].blob.arrayBuffer()), videoBytes);
  assert.equal(
    inventory.document.stories[0].picturePin.sha256,
    saved.document.library.assets[0].sha256,
  );
});

test('invalid seek and failed same-context preview retain the accepted frame without saving new originals', async (t) => {
  let fail = false;
  const h = await setup(t, {
    show: () => {
      if (fail) throw new Error('Display candidate refused');
      return true;
    },
  });
  await h.inspect();
  h.s('frame-time').value = '2.05';
  await h.s('capture').onclick();
  const src = h.s('frame').src,
    facts = h.s('frame-facts').textContent;
  h.s('frame-time').value = '7';
  assert.equal(await h.s('capture').onclick(), false);
  assert.match(h.s('status').textContent, /never truncated/);
  assert.equal(h.s('frame').src, src);
  assert.equal(h.s('frame-facts').textContent, facts);
  h.s('frame-time').value = '';
  assert.equal(await h.s('capture').onclick(), false);
  assert.match(h.s('status').textContent, /explicit time/);
  fail = true;
  h.s('frame-time').value = '3';
  assert.equal(await h.s('capture').onclick(), false);
  assert.match(h.s('status').textContent, /Display candidate refused/);
  assert.equal(h.s('frame').src, src);
  assert.equal((await h.store.read()).generation, 0);
});

test('allocation cancellation revokes the returned PNG URL, preserves the prior frame and requires reload', async (t) => {
  const h = await setup(t);
  await h.inspect();
  h.s('frame-time').value = '2';
  await h.s('capture').onclick();
  const prior = h.s('frame').src;
  let candidate;
  h.allocation = (blob, url) => {
    if (blob.type === 'image/png') {
      candidate = url;
      h.panel.back();
    }
  };
  h.s('frame-time').value = '3';
  assert.equal(await h.s('capture').onclick(), false);
  assert.ok(candidate);
  assert.ok(h.native.revoked.includes(candidate));
  assert.equal(h.native.urls.has(candidate), false);
  assert.equal(h.s('frame').src, prior);
  assert.equal(h.panel.dialog.open, true);
  assert.equal(h.panel.snapshot().ready, false);
  assert.match(h.$('status').textContent, /Any completed save stays saved/);
  assert.equal((await h.store.read()).generation, 0);
  h.panel.back();
  assert.equal(h.panel.dialog.open, false);
  assert.equal(h.native.urls.size, 0);
});

test('Back cancels pending metadata before closing; a late older source cannot replace a newly inspected source', async (t) => {
  const h = await setup(t);
  await h.inspect();
  h.s('file').files = [new Blob([videoBytes])];
  h.s('file').onchange();
  h.slow = true;
  const count = h.native.videos.length,
    pending = h.s('inspect').onclick();
  await waitFor(() => h.native.videos.length > count);
  const old = h.native.videos.at(-1);
  h.panel.back();
  assert.equal(h.panel.dialog.open, true);
  assert.equal(await pending, false);
  assert.equal(old.src, '');
  h.slow = false;
  await h.$('reload').onclick();
  assert.equal(await h.inspect(), true);
  const facts = h.s('source-facts').textContent;
  old.metadata();
  assert.equal(h.s('source-facts').textContent, facts);
  assert.equal(h.s('capture').disabled, false);
  h.panel.back();
  assert.equal(h.panel.dialog.open, false);
  assert.equal(h.native.urls.size, 0);
});

test('pending capture cannot adopt a changed owner; cancelled native work cannot paint after reopening', async (t) => {
  const gate = deferred();
  let slow = false;
  const h = await setup(t, {
    show: async () => {
      if (slow) await gate.promise;
      return true;
    },
  });
  await h.inspect();
  slow = true;
  const pending = h.s('capture').onclick();
  await waitFor(() => h.paints.length === 1);
  h.$('theme').value = 'retro';
  h.$('theme').onchange();
  assert.equal(h.panel.snapshot().ready, false);
  slow = false;
  await h.$('reload').onclick();
  gate.resolve();
  assert.equal(await pending, false);
  assert.equal(h.panel.snapshot().hasDraft, false);
  assert.equal(h.s('frame').hidden, true);
  assert.equal((await h.store.read()).generation, 0);
});

test('existing controller editor changes a segment slider only on Confirm and Back cancels editing before closing', async (t) => {
  const h = await setup(t);
  await h.inspect();
  const nav = attachControllerNavigation({
    document: h.doc,
    keyboard: true,
    getScope: () => (h.panel.dialog.open ? 'workshop' : 'closed'),
    getRoot: () => h.panel.dialog,
    getDefaultFocus: () => h.s('start-range'),
    onBack: () => h.panel.back(),
  });
  t.after(() => nav.destroy());
  h.s('start-range').focus();
  nav.sync();
  nav.handle({ confirm: true });
  nav.handle({ direction: 'right' });
  assert.equal(h.s('start').value, '0');
  nav.handle({ back: true });
  assert.equal(h.s('start').value, '0');
  assert.equal(h.panel.dialog.open, true);
  nav.handle({ confirm: true });
  nav.handle({ direction: 'right' });
  nav.handle({ confirm: true });
  assert.equal(h.s('start').value, '0.01');
  assert.equal((await h.storyStore.readMetadata()).generation, 0);
  nav.handle({ back: true });
  assert.equal(h.panel.dialog.open, false);
});
