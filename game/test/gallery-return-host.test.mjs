// Actual Solo, Collection markup, earned originals and picture close handlers.
// Native default/queued dialog events, IndexedDB completion and decoding are
// modeled boundaries; these tests do not establish browser layout or pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { earnedPictureFixture } from './helpers/earned-picture-fixture.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { saveLibrary } from '../library.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';

function nativeDialogs(t) {
  const origins = new WeakMap(),
    show = SoloElement.prototype.showModal,
    remove = SoloElement.prototype.remove;
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    if (this.open) return;
    origins.set(this, this.ownerDocument.activeElement);
    this.emit('beforetoggle', { oldState: 'closed', newState: 'open', bubbles: false });
    show.call(this);
    this.querySelector('button:not(:disabled),select:not(:disabled),input:not(:disabled)')?.focus();
  });
  t.mock.method(SoloElement.prototype, 'close', function () {
    if (!this.open) return;
    this.open = false;
    this.removeAttribute('open');
    const origin = origins.get(this),
      dialog = origin?.closest('dialog');
    if (origin?.isConnected && !origin.closest('[hidden]') && (!dialog || dialog.open))
      origin.focus();
    else this.ownerDocument.activeElement = this.ownerDocument.body;
    // The browser restores its opener before dispatching the queued close event.
    queueMicrotask(() => this.emit('close', { bubbles: false }));
  });
  t.mock.method(SoloElement.prototype, 'remove', function () {
    if (this.isConnected && this.contains(this.ownerDocument.activeElement)) {
      const active = this.ownerDocument.activeElement;
      active.blur();
      active.emit('blur', { bubbles: false });
    }
    return remove.call(this);
  });
}

function holdPresentationRead(memory) {
  const patched = new WeakSet();
  let next = null;
  const indexedDB = {
    open(...args) {
      const request = memory.indexedDB.open(...args);
      let success;
      Object.defineProperty(request, 'onsuccess', {
        get:
          () =>
          (...events) => {
            const db = request.result;
            if (!patched.has(db)) {
              patched.add(db);
              const transaction = db.transaction.bind(db);
              db.transaction = (names, mode) => {
                const tx = transaction(names, mode);
                if (
                  next &&
                  mode === 'readonly' &&
                  Array.isArray(names) &&
                  names.length === 2 &&
                  names.includes('mediaRecords') &&
                  names.includes('storyRecords')
                ) {
                  const gate = next;
                  next = null;
                  gate.entered = true;
                  let complete;
                  Object.defineProperty(tx, 'oncomplete', {
                    get: () => () =>
                      gate.promise.then(() => {
                        if (gate.failure) {
                          tx.error = new Error('Held original metadata refused');
                          tx.onabort?.();
                        } else complete?.();
                      }),
                    set: (callback) => (complete = callback),
                  });
                }
                return tx;
              };
            }
            success?.(...events);
          },
        set: (callback) => (success = callback),
      });
      return request;
    },
  };
  return {
    indexedDB,
    arm(failure = false) {
      assert.equal(next, null);
      next = { ...deferred(), entered: false, failure };
      return next;
    },
  };
}

async function setup(t) {
  nativeDialogs(t);
  const f = await earnedPictureFixture(),
    memory = memoryIndexedDB(),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true, soundtrackCatalogue: true }),
    store = createStillMediaStore({
      managedStore: manager,
      decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
    });
  t.after(() => {
    f.manager.close();
    manager.close();
  });
  const saved = await f.store.read();
  await store.commit(
    await store.prepare(saved.document.library, saved.assets, { executionCatalog: f.catalog }),
    { expectedGeneration: 0 },
  );
  f.manager.close();
  manager.close();
  const storage = memoryStorage();
  assert.equal(saveLibrary(storage, 'revealline.library.dev.v1', f.profile).ok, true);
  const reads = holdPresentationRead(memory),
    images = [];
  class Image {
    naturalWidth = 1;
    naturalHeight = 1;
    width = 1;
    height = 1;
    released = 0;
    constructor() {
      images.push(this);
    }
    set src(value) {
      this.source = value;
      if (value) queueMicrotask(() => this.onload?.());
    }
    async decode() {}
    removeAttribute(name) {
      if (name === 'src') this.source = '';
    }
    close() {
      this.released++;
    }
  }
  t.mock.method(SoloElement.prototype, 'getContext', () => ({ drawImage() {} }));
  t.mock.method(BoardPainter.prototype, 'drawGallery', () => {});
  const h = await soloPage(t, {
    storage,
    soundtrackIndexedDB: reads.indexedDB,
    pictures: { Image },
  });
  // Real browser document.defaultView and global window have one identity.
  Object.assign(h.win, h.doc.defaultView);
  h.doc.defaultView = h.win;
  h.$('start-button').click();
  h.key('ArrowDown');
  h.key('ArrowDown', false);
  for (let i = 0; i < 20; i++) h.frame();
  assert.equal(h.rendered.run.player.cutting, true);
  h.key('Escape');
  h.key('Escape', false);
  h.frame(0);
  await settle(
    () =>
      JSON.parse(storage.getItem('revealline.suspended.dev.v1') ?? 'null')?.replay?.ticks === 20,
  );
  h.$('collection-button').focus();
  h.$('collection-button').click();
  await settle(() => cards()[0]?.dataset.pictureState === 'ready');
  const opener = cards()[0];
  opener.focus();
  opener.click();
  await settle(() => h.$('gallery-canvas').getAttribute('aria-busy') === 'false');
  assert.equal(h.$('gallery-view-dialog').open, true);
  assert.equal(h.$('gallery-canvas').style.visibility, '');
  const fullImage = images.findLast((image) => image.released === 0);
  assert.ok(fullImage, 'The picture holds its real acquired original lease.');
  let raw = [...storage.map],
    writes = storage.writes.length;
  const profile = storage.getItem('revealline.library.dev.v1'),
    mediaWrites = memory.allPuts.length,
    run = h.rendered.run,
    checkpoint = authoritativeCheckpoint(run);
  function cards() {
    return h.$('gallery-grid').querySelectorAll('button');
  }
  function unchanged() {
    h.frame(0);
    assert.equal(h.rendered.run === run, true);
    assert.equal(h.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(JSON.stringify([...storage.map]) === JSON.stringify(raw), true);
    assert.equal(storage.getItem('revealline.library.dev.v1') === profile, true);
    assert.equal(storage.writes.length, writes);
    assert.equal(memory.allPuts.length, mediaWrites);
    assert.deepEqual(h.errors, []);
  }
  async function settledLifecycleSave() {
    // Window suspension already owns an autosave. Establish the return adapter's
    // no-write baseline after that separate action, while metadata is still held.
    await new Promise((resolve) => setImmediate(resolve));
    const old = new Map(raw);
    const changed = [...storage.map].filter(([key, value]) => old.get(key) !== value);
    assert.deepEqual(
      changed.map(([key]) => key),
      ['revealline.suspended.dev.v1'],
    );
    assert.equal(storage.getItem('revealline.library.dev.v1') === profile, true);
    raw = [...storage.map];
    writes = storage.writes.length;
  }
  async function back({ failure = false, beforeCloseEvent } = {}) {
    const gate = reads.arm(failure);
    t.after(gate.resolve);
    const button = h.$('gallery-view-dialog').querySelectorAll('[data-close]').at(-1);
    button.focus();
    button.click();
    assert.equal(h.doc.activeElement === opener, opener.isConnected);
    beforeCloseEvent?.();
    await settle(() => gate.entered);
    assert.equal(h.$('collection-dialog').open, true);
    assert.equal(fullImage.released, 1, 'Closing releases only the old full-view drawable.');
    return {
      async finish() {
        gate.resolve();
        await settle(() => cards()[0] !== opener);
        await new Promise((resolve) => setImmediate(resolve));
        unchanged();
      },
    };
  }
  return { ...h, cards, opener, images, fullImage, unchanged, back, settledLifecycleSave };
}

for (const failure of [false, true])
  test(`actual Collection Back resolves its restored origin after held metadata ${failure ? 'refusal' : 'success'}`, async (t) => {
    const h = await setup(t),
      pending = await h.back({ failure });
    await pending.finish();
    assert.equal(h.opener.isConnected, false);
    assert.equal(h.doc.activeElement === (failure ? h.$('gallery-search') : h.cards()[0]), true);
    if (failure) assert.match(h.$('gallery-load-status').textContent, /unavailable/);
  });

for (const choice of [
  'search',
  'close',
  'search-then-body',
  'pointer',
  'key',
  'blur-return',
  'hidden-return',
  'pagehide',
])
  test(`actual Collection held Back never restores over ${choice}`, async (t) => {
    const h = await setup(t),
      pending = await h.back();
    const search = h.$('gallery-search'),
      close = h.$('collection-dialog').querySelector('[data-close]');
    if (choice === 'search' || choice === 'search-then-body') search.focus();
    if (choice === 'close') close.focus();
    if (choice === 'search-then-body') search.blur();
    if (choice === 'pointer') search.emit('pointerdown');
    if (choice === 'key') search.emit('keydown', { key: 'Shift' });
    if (choice === 'blur-return') {
      h.doc.focused = false;
      h.win.emit('blur');
      h.doc.focused = true;
      h.win.emit('focus');
    }
    if (choice === 'hidden-return') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
      h.doc.hidden = false;
      h.doc.emit('visibilitychange');
    }
    if (choice === 'pagehide') h.win.emit('pagehide', { persisted: true });
    if (['blur-return', 'hidden-return', 'pagehide'].includes(choice))
      await h.settledLifecycleSave();
    const target = h.doc.activeElement === h.opener ? h.doc.body : h.doc.activeElement;
    await pending.finish();
    assert.equal(
      h.doc.activeElement === target,
      true,
      'New intent outlives the old metadata read.',
    );
  });

for (const choice of ['search', 'close'])
  test(`queued native picture close cannot capture newer ${choice} as its origin`, async (t) => {
    const h = await setup(t),
      target =
        choice === 'search'
          ? h.$('gallery-search')
          : h.$('collection-dialog').querySelector('[data-close]'),
      pending = await h.back({ beforeCloseEvent: () => target.focus() });
    await pending.finish();
    assert.equal(h.doc.activeElement === target, true);
  });

test('already detached native picture origin cannot claim BODY as return intent', async (t) => {
  const h = await setup(t);
  h.opener.remove();
  const pending = await h.back();
  assert.equal(h.doc.activeElement === h.doc.body, true);
  await pending.finish();
  assert.equal(h.doc.activeElement === h.doc.body, true);
});
