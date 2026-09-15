import assert from 'node:assert/strict';
import test from 'node:test';
import { Document, Events } from './helpers/couch-dom.mjs';
import { SoloElement } from './helpers/solo-dom.mjs';
import { deferred, pngBytes } from './helpers/media-fixtures.mjs';
import { prepareStoryFixture } from './helpers/victory-story-fixture.mjs';
import { prepareStoredStillMedia } from '../media-storage-record.mjs';
import { changeStoredStoryBinding, STORY_STORAGE_FORMAT } from '../story-storage-record.mjs';
import { createAuthoredStoryPin } from '../story-bindings.mjs';
import { acquirePinnedStory, createStoryDialog } from '../ui/story-dialog.mjs';

const f = await prepareStoryFixture(),
  still = (
    await prepareStoredStillMedia(
      f.library,
      [{ sha256: f.pin.sha256, blob: new Blob([pngBytes()]) }],
      {
        executionCatalog: f.catalog,
        decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
      },
    )
  ).library;
const document = await changeStoredStoryBinding(
  {
    format: STORY_STORAGE_FORMAT,
    stories: [f.descriptor],
    originals: [f.descriptor.source.sha256],
  },
  { picturePin: f.pin, story: { id: f.descriptor.id, revision: 1 } },
  still,
);
const pin = await createAuthoredStoryPin({ document, still, picturePin: f.pin });
const media = (documentOverride = document, acquire = async () => f.prepared) => ({
  metadata: { document: still },
  story: { document: documentOverride },
  storyStore: { acquire },
});

// Real immutable descriptor/hash/Blob brand; DOM and presentation allocation are
// modeled here. The real native video lifecycle has a separate UI test suite.
function setup(t, overrides = {}) {
  const doc = new Document(),
    win = new Events();
  doc.defaultView = win;
  doc.createElement = (tag) => new SoloElement(doc, tag);
  const calls = [],
    instances = [],
    saved = [];
  let neutral = 0,
    preferences = { volume: 0.75, masterVolume: 0.5, muted: false, reducedMotion: false };
  const host = createStoryDialog({
    document: doc,
    window: win,
    readMedia: async () => media(),
    settings: () => ({ ...preferences }),
    neutralize: () => neutral++,
    saveVolume: (volume) => {
      saved.push(volume);
      preferences.volume = volume;
    },
    createPresentation(options) {
      calls.push(options);
      const instance = {
        disposed: 0,
        paused: 0,
        dispose() {
          this.disposed++;
        },
        pause() {
          this.paused++;
        },
        setPreferences(value) {
          this.settings = value;
        },
      };
      instances.push(instance);
      options.onChange({ state: 'ready', volume: options.volume });
      return instance;
    },
    ...overrides,
  });
  t.after(() => host.dispose());
  const request = {
    pin,
    title: 'Earned original',
    drawPoster(canvas) {
      canvas.width = 72;
      canvas.height = 36;
      canvas.dataset.original = f.pin.sha256;
    },
  };
  return {
    doc,
    win,
    host,
    request,
    calls,
    instances,
    saved,
    setPreferences: (next) => {
      preferences = { ...preferences, ...next };
    },
    neutral: () => neutral,
  };
}

test('exact historical A survives unbinding and original availability is checked before codec acquisition', async () => {
  const unbound = await changeStoredStoryBinding(
    document,
    { picturePin: f.pin, story: null },
    still,
  );
  let reads = 0;
  const source = media(unbound, async (request) => {
    reads++;
    assert.deepEqual(request, { id: pin.id, revision: pin.revision, picturePin: pin.picturePin });
    return f.prepared;
  });
  assert.equal(await acquirePinnedStory({ pin, media: source }), f.prepared);
  assert.equal(reads, 1);
  const missing = structuredClone(unbound);
  missing.originals = [];
  await assert.rejects(
    acquirePinnedStory({ pin, media: media(missing, () => assert.fail('Missing movie codec')) }),
    /exact .rlstory/,
  );
  for (const key of ['sourceSha256', 'descriptorSha256']) {
    await assert.rejects(
      acquirePinnedStory({ pin: { ...pin, [key]: 'a'.repeat(64) }, media: media() }),
      /hash|immutable/,
    );
  }
});

test('opening stages exact poster before awaiting originals and never calls Play or changes volume automatically', async (t) => {
  const wait = deferred(),
    h = setup(t, { readMedia: () => wait.promise });
  const opened = h.host.open(h.request);
  assert.equal(h.host.dialog.open, true);
  assert.equal(h.host.dialog.querySelector('canvas').dataset.original, f.pin.sha256);
  assert.equal(h.host.dialog.dataset.storyState, 'preparing');
  const status = h.host.dialog.querySelector('.operation-status');
  assert.equal(status.dataset.state, 'busy');
  assert.equal(status.dataset.stage, 'reading');
  assert.match(status.textContent, /Reading optional story metadata/);
  assert.notEqual(h.host.dialog.getAttribute('aria-busy'), 'true');
  assert.equal(h.calls.length, 0);
  wait.resolve(media());
  assert.equal(await opened, true);
  assert.equal(status.hidden, true);
  assert.equal(status.dataset.state, 'ready');
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].prepared, f.prepared);
  assert.equal(h.calls[0].posterElement.hidden, false);
  assert.deepEqual(h.saved, []);
  assert.equal(h.calls[0].volume, 0.75);
  assert.equal(h.calls[0].masterVolume, 0.5);
  h.calls[0].onChange({ state: 'playing', volume: 0.3 });
  assert.deepEqual(h.saved, [0.3]);
  h.setPreferences({ masterVolume: 0, muted: true });
  h.host.syncSettings();
  assert.deepEqual(h.instances[0].settings, {
    volume: 0.3,
    masterVolume: 0,
    muted: true,
    reducedMotion: false,
  });
});

test('missing/corrupt movie keeps the already staged exact poster and gives finite recovery guidance', async (t) => {
  const h = setup(t, {
    acquire: async () => {
      throw new Error('Original hash differs.');
    },
  });
  assert.equal(await h.host.open(h.request), false);
  assert.equal(h.host.dialog.open, true);
  assert.equal(h.host.dialog.dataset.storyState, 'unavailable');
  assert.equal(h.host.dialog.querySelector('.operation-status').dataset.state, 'error');
  assert.equal(h.host.dialog.querySelector('canvas').dataset.original, f.pin.sha256);
  assert.match(
    h.host.dialog.children.find((child) => child.tagName === 'P').textContent,
    /picture stays visible.*\.rlstory.*Original hash differs/s,
  );
  assert.equal(h.calls.length, 0);
});

test('Close during delayed acquisition neutralizes input and prevents late presentation allocation', async (t) => {
  const wait = deferred(),
    entered = deferred(),
    h = setup(t, {
      acquire: () => {
        entered.resolve();
        return wait.promise;
      },
    });
  const opened = h.host.open(h.request);
  await entered.promise;
  h.host.dialog.querySelector('button').onclick();
  wait.resolve(f.prepared);
  assert.equal(await opened, false);
  assert.equal(h.calls.length, 0);
  assert.equal(h.host.dialog.open, false);
  assert.ok(h.neutral() >= 2);
});

test('new context and external lifecycle abort cannot publish old or later resources', async (t) => {
  const first = deferred();
  let count = 0;
  const h = setup(t, {
    readMedia: () => (++count === 1 ? first.promise : Promise.resolve(media())),
  });
  const old = h.host.open(h.request),
    controller = new AbortController();
  assert.equal(
    await h.host.open({ ...h.request, title: 'New view' }, { signal: controller.signal }),
    true,
  );
  first.resolve(media());
  assert.equal(await old, false);
  assert.equal(h.calls.length, 1);
  assert.equal(h.doc.getElementById('victory-story-title').textContent, 'New view');
  controller.abort();
  assert.equal(h.host.dialog.open, false);
  assert.equal(h.instances[0].disposed, 1);
});

test('failed poster staging preserves current view; blur pauses ready story and hidden loading closes safely', async (t) => {
  const h = setup(t);
  await h.host.open(h.request);
  const poster = h.host.dialog.querySelector('canvas');
  await assert.rejects(
    h.host.open({
      ...h.request,
      drawPoster: () => {
        throw new Error('Draw failed');
      },
    }),
    /Draw failed/,
  );
  assert.equal(h.host.dialog.querySelector('canvas'), poster);
  assert.equal(h.instances[0].disposed, 0);
  h.win.emit('blur');
  assert.equal(h.instances[0].paused, 1);
  h.win.emit('pagehide');
  assert.equal(h.instances[0].disposed, 1);
  assert.equal(h.host.dialog.isConnected, false);
});

test('reentrant presentation allocation cancellation releases the returned view without a late success', async (t) => {
  let released = 0,
    host;
  const h = setup(t, {
    createPresentation: () => {
      host.close();
      return { dispose: () => released++ };
    },
  });
  host = h.host;
  assert.equal(await host.open(h.request), false);
  assert.equal(released, 1);
  assert.equal(host.dialog.open, false);
});

test('persisted pagehide releases the open presentation and permits explicit reopening after pageshow', async (t) => {
  const h = setup(t);
  assert.equal(await h.host.open(h.request), true);
  const first = h.instances[0];
  h.win.emit('pagehide', { persisted: true });
  assert.equal(first.disposed, 1);
  assert.equal(h.host.dialog.open, false);
  assert.equal(h.host.dialog.isConnected, true);
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.calls.length, 1, 'Restoring the page does not reopen or play a story');
  assert.equal(await h.host.open(h.request), true);
  assert.equal(h.calls.length, 2);
  assert.equal(h.host.dialog.querySelector('canvas').dataset.original, f.pin.sha256);
  h.win.emit('pagehide', { persisted: false });
  assert.equal(h.instances[1].disposed, 1);
  assert.equal(h.host.dialog.isConnected, false);
  await assert.rejects(h.host.open(h.request), /story view is closed/);
});

test('persisted pagehide cancels pending acquisition without publishing its late return after reopening', async (t) => {
  const wait = deferred(),
    entered = deferred();
  let reads = 0;
  const h = setup(t, {
    acquire: () => {
      if (++reads !== 1) return Promise.resolve(f.prepared);
      entered.resolve();
      return wait.promise;
    },
  });
  const opening = h.host.open(h.request);
  await entered.promise;
  h.win.emit('pagehide', { persisted: true });
  assert.equal(h.host.dialog.open, false);
  h.win.emit('pageshow', { persisted: true });
  assert.equal(await h.host.open({ ...h.request, title: 'Reopened story' }), true);
  wait.resolve(f.prepared);
  assert.equal(await opening, false);
  assert.equal(h.calls.length, 1);
  assert.equal(h.instances[0].disposed, 0);
  assert.equal(h.doc.getElementById('victory-story-title').textContent, 'Reopened story');
});
