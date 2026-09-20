import test from 'node:test';
import assert from 'node:assert/strict';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createStoryMediaStore } from '../story-media-store.mjs';
import { inspectStoryBundle } from '../story-bundle.mjs';
import { attachStillMediaPanel } from '../ui/still-media-panel.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { SoloElement } from './helpers/solo-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { mediaFixture, pngBytes, deferred } from './helpers/media-fixtures.mjs';
import { inspectionEnvironment, videoBytes } from './helpers/victory-story-fixture.mjs';
import { waitFor } from './helpers/wait-for.mjs';

// Actual adapter, hash and transfer authority; native codec and DOM defaults are
// modeled explicitly. This test never starts the current v3 workshop host.
async function setup(t, options = {}) {
  const doc = new Document();
  doc.createElement = (tag) => new SoloElement(doc, tag);
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({
      indexedDB: memory.indexedDB,
      ...(options.noStory ? { richStillMedia: true } : { storyMedia: true }),
    }),
    decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
  const store = createStillMediaStore({ managedStore: manager, decodeImage });
  const storyStore = options.noStory
    ? null
    : createStoryMediaStore({ managedStore: manager, decodeImage });
  const native = inspectionEnvironment(),
    f = mediaFixture(true),
    ticket = Object.freeze({ executionCatalog: f.catalog });
  let valid = true,
    id = 0,
    commits = 0,
    notifications = 0;
  const wrapped = storyStore && {
    ...storyStore,
    async commit(...args) {
      ++commits;
      return storyStore.commit(...args);
    },
    ...options.story,
  };
  const panel = attachStillMediaPanel({
    document: doc,
    store,
    storyStore: wrapped,
    decodeImage,
    storyInspection: native.options,
    URLImpl: native.options.URLImpl,
    catalog: {
      read: async () => ticket,
      withCurrent: async (snapshot, work) => {
        assert.equal(snapshot, ticket);
        if (!valid) throw new Error('Installed context changed.');
        return work();
      },
    },
    preview: {
      canvas: doc.createElement('canvas'),
      show: async () => true,
      clear() {},
      dispose() {},
    },
    makeId: () => `poster-${++id}`,
    makeStoryId: () => `story-${++id}`,
    onStorySaved: async () => {
      ++notifications;
      if (options.notificationFailure) throw new Error('Observer refused');
      await options.afterNotification?.();
    },
    ...options.panel,
  });
  t.after(async () => {
    panel.dispose();
    await storyStore?.close();
    manager.close();
  });
  const $ = (id) => doc.getElementById(`still-media-${id}`),
    s = (id) => $(`story-${id}`);
  assert.equal(await panel.open(), true);
  async function poster(description = 'Owned poster A') {
    $('file').files = [new Blob([pngBytes()], { type: 'image/png' })];
    $('file').onchange();
    $('credit').value = 'Owned test fixture';
    $('source').value = 'Injected 1x1 PNG';
    $('description').value = description;
    assert.equal(await $('preview').onclick(), true);
    assert.equal(await $('save').onclick(), true);
  }
  async function inspect() {
    s('file').files = [new Blob([videoBytes])];
    s('file').onchange();
    assert.equal(await s('inspect').onclick(), true);
    s('start').value = '2';
    s('end').value = '4';
    s('description').value = 'Owned diagnostic segment';
  }
  async function story() {
    await inspect();
    assert.equal(await s('prepare').onclick(), true);
    assert.equal(await s('save').onclick(), true);
  }
  return {
    doc,
    memory,
    manager,
    store,
    storyStore,
    panel,
    native,
    $,
    s,
    poster,
    inspect,
    story,
    invalidate() {
      valid = false;
    },
    get commits() {
      return commits;
    },
    get notifications() {
      return notifications;
    },
  };
}

test('no optional capability keeps the actual still-only panel and rich-v3 store unchanged', async (t) => {
  const h = await setup(t, { noStory: true });
  assert.equal(h.s('section'), null);
  await h.poster();
  assert.equal((await h.store.read()).generation, 1);
  h.panel.back();
  assert.equal(h.panel.dialog.open, false);
});

test('Prepare writes neither descriptor nor binding, Save commits both once and rejected notification retains the new generation', async (t) => {
  const h = await setup(t, { notificationFailure: true });
  await h.poster();
  const still = await h.store.read();
  await h.inspect();
  assert.equal(await h.s('prepare').onclick(), true);
  assert.equal(h.commits, 0);
  assert.equal((await h.storyStore.readMetadata()).generation, 0);
  assert.equal(h.doc.activeElement, h.s('save'));
  assert.equal(await h.s('save').onclick(), true);
  assert.equal(h.commits, 1);
  assert.equal(h.notifications, 1);
  assert.match(h.s('status').textContent, /Story saved; notification failed/);
  assert.match(h.$('status').textContent, /Story saved; notification failed/);
  const a = await h.storyStore.exportInventory();
  assert.equal(a.generation, 1);
  assert.equal(a.document.stories.length, 1);
  assert.equal(a.document.bindings.length, 1);
  assert.deepEqual(Buffer.from(await a.assets[0].blob.arrayBuffer()), videoBytes);
  assert.deepEqual(await h.store.read(), still);
  assert.equal(
    await h.s('clear').onclick(),
    true,
    'The committed generation was refreshed despite observer rejection.',
  );
  assert.equal((await h.storyStore.readMetadata()).generation, 2);
});

test('historical poster A can be selected after current B; clear saves explicit null and exact saved history can be rebound', async (t) => {
  const h = await setup(t);
  await h.poster();
  await h.story();
  const a = (await h.storyStore.readMetadata()).document.stories[0];
  await h.poster('Owned poster B');
  assert.match(h.s('selected').textContent, /current assignment/);
  assert.equal(h.s('history').value, '');
  h.$('history').value = JSON.stringify([
    a.picturePin.presentationId,
    a.picturePin.presentationRevision,
  ]);
  h.$('history').onchange();
  assert.match(h.s('selected').textContent, /Owned poster A.*historical revision/);
  assert.match(h.s('binding').textContent, /Owned diagnostic segment/);
  assert.equal(await h.s('clear').onclick(), true);
  let stored = await h.storyStore.readMetadata();
  assert.equal(stored.document.bindings[0].story, null);
  assert.deepEqual(stored.document.stories, [a]);
  h.s('history').value = JSON.stringify([a.id, a.revision]);
  h.s('history').onchange();
  assert.equal(await h.s('prepare-saved').onclick(), true);
  assert.equal((await h.storyStore.readMetadata()).document.bindings[0].story, null);
  assert.equal(await h.s('save').onclick(), true);
  stored = await h.storyStore.readMetadata();
  assert.deepEqual(stored.document.stories, [a]);
  assert.equal(stored.document.bindings[0].story.id, a.id);
  assert.equal(
    (await h.store.read()).document.library.assignments[0].revision,
    2,
    'Binding a historical picture does not reassign it.',
  );
});

test('unsaved poster and invalid segment cannot produce a reviewed story; picture revision change invalidates a prepared save', async (t) => {
  const h = await setup(t);
  await h.poster();
  await h.inspect();
  h.s('end').value = '7';
  assert.equal(await h.s('prepare').onclick(), false);
  assert.match(h.s('status').textContent, /segment|duration/i);
  h.s('end').value = '';
  assert.equal(await h.s('prepare').onclick(), false);
  assert.match(h.s('status').textContent, /explicit time/);
  h.s('end').value = '4';
  assert.equal(await h.s('prepare').onclick(), true);
  h.$('description').value = 'Unsaved poster';
  h.$('description').oninput();
  assert.equal(h.s('save').disabled, true);
  h.$('file').files = [new Blob([pngBytes()])];
  h.$('file').onchange();
  assert.equal(await h.$('preview').onclick(), true);
  assert.equal(h.s('prepare').disabled, true);
  assert.equal(await h.s('prepare').onclick(), false);
  assert.equal((await h.storyStore.readMetadata()).generation, 0);
});

test('stale installed context, concurrent story generation and transaction refusal preserve the entire prior inventory', async (t) => {
  const h = await setup(t);
  await h.poster();
  await h.inspect();
  await h.s('prepare').onclick();
  h.invalidate();
  assert.equal(await h.s('save').onclick(), false);
  assert.match(h.s('status').textContent, /Installed context/);
  assert.equal((await h.storyStore.readMetadata()).generation, 0);
  const j = await setup(t);
  await j.poster();
  await j.story();
  await j.s('prepare').onclick();
  const before = await j.storyStore.exportInventory();
  const clear = await j.storyStore.stageBinding(
    { picturePin: before.document.stories[0].picturePin, story: null },
    { expectedGeneration: before.generation, ...j.native.options },
  );
  await j.storyStore.commit(clear);
  const concurrent = await j.storyStore.exportInventory();
  assert.equal(await j.s('save').onclick(), false);
  assert.deepEqual(await j.storyStore.exportInventory(), concurrent);
  await j.$('reload').onclick();
  await j.s('prepare').onclick();
  j.memory.failAnyPutAt = 1;
  assert.equal(await j.s('save').onclick(), false);
  j.memory.failAnyPutAt = null;
  assert.deepEqual(await j.storyStore.exportInventory(), concurrent);
});

test('native prepared download transfers exact v2 bytes; keep-current preserves null and explicit restore restores only reviewed incoming bindings', async (t) => {
  let invoked = false,
    clicked = false;
  const h = await setup(t, {
    panel: {
      requestStoryDownload({ blob, filename }) {
        assert.equal(clicked, true);
        invoked = true;
        assert.ok(blob.size > videoBytes.length);
        assert.equal(filename, 'RevealLine-stories.rlstory');
      },
    },
  });
  await h.poster();
  await h.story();
  assert.equal(await h.s('prepare-download').onclick(), true);
  assert.equal(invoked, false);
  const bundle = h.native.urls.get(h.s('download').href);
  assert.ok(bundle);
  clicked = true;
  h.s('download').onclick({ preventDefault() {} });
  assert.equal(invoked, true);
  const inspected = await inspectStoryBundle(bundle);
  assert.equal(inspected.document.format, 'revealline-story-storage.v2');
  assert.equal(await h.s('clear').onclick(), true);
  const cleared = await h.storyStore.exportInventory();
  h.s('bundle-file').files = [bundle];
  h.s('bundle-file').onchange();
  assert.equal(h.s('bundle-mode').value, 'keep');
  assert.equal(await h.s('review').onclick(), true);
  assert.deepEqual(await h.storyStore.exportInventory(), cleared);
  assert.equal(await h.s('restore').onclick(), true);
  assert.equal((await h.storyStore.readMetadata()).document.bindings[0].story, null);
  h.s('bundle-mode').value = 'restore';
  h.s('bundle-mode').onchange();
  assert.equal(await h.s('review').onclick(), true);
  h.s('bundle-mode').value = 'keep';
  h.s('bundle-mode').onchange();
  assert.equal(h.s('restore').disabled, true);
  h.s('bundle-mode').value = 'restore';
  h.s('bundle-mode').onchange();
  assert.equal(await h.s('review').onclick(), true);
  assert.equal(await h.s('restore').onclick(), true);
  const restored = await h.storyStore.exportInventory();
  assert.deepEqual(restored.document, inspected.document);
  assert.deepEqual(Buffer.from(await restored.assets[0].blob.arrayBuffer()), videoBytes);
});

// Model the native disabled-button blur that exposed this regression; the shared
// minimal DOM intentionally does not pretend to implement browser focus rules.
for (const outcome of ['success', 'observer-failure', 'moved-focus', 'cancelled']) {
  test(`story restore ${outcome} retains only the initiating operation's focus ownership`, async (t) => {
    const gate = deferred();
    let waiting = false;
    const h = await setup(t, {
      afterNotification: async () => {
        if (!waiting) return;
        await gate.promise;
        if (outcome === 'observer-failure') throw new Error('Observer refused');
      },
    });
    await h.poster();
    await h.story();
    await h.s('prepare-download').onclick();
    const bundle = h.native.urls.get(h.s('download').href);
    h.s('bundle-file').files = [bundle];
    h.s('bundle-file').onchange();
    await h.s('review').onclick();
    const opener = h.s('restore');
    let disabled = opener.disabled;
    Object.defineProperty(opener, 'disabled', {
      configurable: true,
      get: () => disabled,
      set(value) {
        disabled = value;
        if (value && h.doc.activeElement === opener) opener.blur();
      },
    });
    opener.focus();
    waiting = true;
    const before = h.notifications;
    const pending = opener.onclick();
    await waitFor(() => h.notifications > before);
    assert.equal(h.doc.activeElement, h.doc.body, 'Native disabling lost focus');
    assert.equal(opener.disabled, true);
    if (outcome === 'moved-focus') {
      h.$('close').focus();
      h.$('close').blur();
    }
    if (outcome === 'cancelled') h.panel.back();
    gate.resolve();
    assert.equal(await pending, outcome !== 'cancelled');
    assert.equal(h.s('restore').disabled, true, 'Consumed review cannot be reused');
    if (outcome === 'success' || outcome === 'observer-failure') {
      assert.equal(h.doc.activeElement, h.s('review'));
      assert.equal(h.s('review').disabled, false);
    } else assert.notEqual(h.doc.activeElement, h.s('review'));
  });
}

test('fresh restore requires actual paired poster originals, corrupt source refuses completely, and correct pairs restore exact video', async (t) => {
  const source = await setup(t);
  await source.poster();
  await source.story();
  await source.s('prepare-download').onclick();
  const bundle = source.native.urls.get(source.s('download').href);
  const target = await setup(t);
  target.s('bundle-file').files = [bundle];
  target.s('bundle-file').onchange();
  assert.equal(await target.s('review').onclick(), false);
  assert.equal((await target.storyStore.readMetadata()).generation, 0);
  assert.equal((await target.store.read()).generation, 0);
  await target.poster();
  const bytes = new Uint8Array(await bundle.arrayBuffer());
  bytes[bytes.length - 1] ^= 1;
  target.s('bundle-file').files = [new Blob([bytes])];
  target.s('bundle-file').onchange();
  assert.equal(await target.s('review').onclick(), false);
  assert.equal((await target.storyStore.readMetadata()).generation, 0);
  target.s('bundle-file').files = [bundle];
  target.s('bundle-mode').value = 'restore';
  target.s('bundle-file').onchange();
  assert.equal(await target.s('review').onclick(), true);
  assert.equal(await target.s('restore').onclick(), true);
  assert.equal(await target.s('prepare-download').onclick(), true);
  const again = target.native.urls.get(target.s('download').href);
  assert.deepEqual(Buffer.from(await again.arrayBuffer()), Buffer.from(await bundle.arrayBuffer()));
});

test('Back cancels a late returned reservation without publishing Save; current source remains usable after reload', async (t) => {
  const gate = deferred();
  let delegate,
    returned = false;
  const h = await setup(t, {
    story: {
      async stageRestore(...args) {
        const result = await delegate(...args);
        returned = true;
        await gate.promise;
        return result;
      },
    },
  });
  delegate = h.storyStore.stageRestore;
  await h.poster();
  await h.inspect();
  const pending = h.s('prepare').onclick();
  await waitFor(() => returned);
  h.panel.back();
  assert.equal(h.panel.dialog.open, true);
  gate.resolve();
  assert.equal(await pending, false);
  assert.equal(h.s('save').disabled, true);
  assert.equal(h.commits, 0);
  assert.equal((await h.storyStore.readMetadata()).generation, 0);
  await h.$('reload').onclick();
  assert.equal(h.s('prepare').disabled, false);
});

test('the existing router requires released Confirm between Prepare and Save and native Enter remains a browser action', async (t) => {
  const h = await setup(t);
  await h.poster();
  await h.inspect();
  const pad = {
    index: 0,
    id: 'Modeled story controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const router = createControllerRouter({ eventTarget: new Events(), readPads: () => [pad] }),
    nav = attachControllerNavigation({
      document: h.doc,
      keyboard: true,
      getScope: () => (h.panel.dialog.open ? 'workshop' : 'closed'),
      getRoot: () => h.panel.dialog,
      getDefaultFocus: () => h.s('prepare'),
      onBack: () => h.panel.back(),
    });
  t.after(() => {
    router.destroy();
    nav.destroy();
  });
  const sample = (now) => {
      nav.sync();
      nav.handle(router.sample({ scope: 'workshop', timeMs: now }).ui);
    },
    press = (down) => {
      pad.buttons[0] = { pressed: down, value: down ? 1 : 0 };
    };
  sample(0);
  press(true);
  sample(1);
  press(false);
  sample(2);
  h.s('prepare').focus();
  nav.sync();
  press(true);
  sample(3);
  await waitFor(() => !h.panel.snapshot().busy);
  assert.equal(h.doc.activeElement, h.s('save'));
  assert.equal((await h.storyStore.readMetadata()).generation, 0);
  sample(1000);
  assert.equal(h.commits, 0);
  press(false);
  sample(1001);
  press(true);
  sample(1002);
  await waitFor(() => !h.panel.snapshot().busy);
  assert.equal(h.commits, 1);
  await h.s('prepare-download').onclick();
  const event = h.doc.emit('keydown', { key: 'Enter', target: h.s('download') });
  assert.equal(
    event.defaultPrevented,
    false,
    'Native Enter is not synthesized by the navigation layer.',
  );
});
