// Actual Solo/Collection/Library handlers; native queued dialog close and IDB
// completion are modeled. Scroll commands prove ownership/order, not geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { earnedPictureFixture } from './helpers/earned-picture-fixture.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { emptyLibrary, importLibrary, recordLibraryCompletion, saveLibrary } from '../library.mjs';
import { createRun, stepRun, getSummary, FIXED_DT, CLASSES } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'pager-fixture',
  title: 'Records return fixture',
  revision: '1',
  classRecipes: CLASSES,
  levels: Array.from({ length: 25 }, (_, index) => ({
    version: 'xonix-level.v1',
    id: `pager-${index}`,
    revision: '1',
    name: `Pager picture ${String(index).padStart(2, '0')}`,
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    walls: [],
    enemies: [],
    objectives: [],
    supplies: [],
    goal: { coverage: 0.2 },
  })),
};
let profile = emptyLibrary();
for (const level of campaign.levels) {
  const run = createRun(level, { seed: 1, classId: 'scout', classRecipes: CLASSES });
  for (let tick = 0; tick < 1000 && run.status === 'running'; tick++)
    stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.status, 'won', 'Each stored board/picture originates in a legal completion');
  profile = recordLibraryCompletion(profile, {
    campaign,
    result: getSummary(run),
    runId: level.id,
    themeId: 'fpv',
    bodyId: 'fpv-body',
    completedAt: '2026-09-15T12:00:00.000Z',
  });
}
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

async function setup(t, { media = false } = {}) {
  nativeDialogs(t);
  const storage = memoryStorage(),
    memory = memoryIndexedDB(),
    reads = holdPresentationRead(memory);
  if (media) {
    const f = await earnedPictureFixture(),
      manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true }),
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
    assert.equal(saveLibrary(storage, 'revealline.library.dev.v1', f.profile).ok, true);
  }
  class Image {
    naturalWidth = 1;
    naturalHeight = 1;
    width = 1;
    height = 1;
    set src(value) {
      if (value) queueMicrotask(() => this.onload?.());
    }
    async decode() {}
    removeAttribute() {}
  }
  t.mock.method(SoloElement.prototype, 'getContext', () => ({ drawImage() {} }));
  t.mock.method(BoardPainter.prototype, 'drawGallery', () => {});
  const h = await soloPage(t, {
    storage,
    ...(media ? {} : { campaign, titleScreen: true }),
    soundtrackIndexedDB: reads.indexedDB,
    pictures: { Image },
  });
  Object.assign(h.win, h.doc.defaultView);
  h.doc.defaultView = h.win;
  if (media) {
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
  }
  const collectionEntry = h.$(media ? 'collection-button' : 'shell-gallery');
  collectionEntry.focus();
  collectionEntry.click();
  if (media) await settle(() => cards()[0]?.dataset.pictureState === 'ready');
  assert.equal(h.$('collection-dialog').open, true);
  const records = h.$('collection-records'),
    calls = [],
    focus = records.focus;
  let focuses = 0;
  records.focus = function (...args) {
    focuses++;
    return focus.apply(this, args);
  };
  records.scrollIntoView = (options) =>
    calls.push({ options, cards: cards().length, status: h.$('gallery-load-status').textContent });
  records.focus();
  records.click();
  assert.equal(h.$('library-dialog').open, true);
  assert.equal(h.$('library-scores').hidden, false);
  let snapshot;
  const baseline = () => {
    h.frame(0);
    snapshot = {
      run: h.rendered.run,
      checkpoint: authoritativeCheckpoint(h.rendered.run),
      paused: h.rendered.paused,
      storage: [...storage.map],
      writes: storage.writes.length,
      puts: memory.allPuts.length,
    };
  };
  const unchanged = () => {
    h.frame(0);
    assert.equal(h.rendered.run === snapshot.run, true);
    assert.equal(h.rendered.paused, snapshot.paused);
    assert.deepEqual(authoritativeCheckpoint(h.rendered.run), snapshot.checkpoint);
    assert.equal(JSON.stringify([...storage.map]) === JSON.stringify(snapshot.storage), true);
    assert.equal(storage.writes.length, snapshot.writes);
    assert.equal(memory.allPuts.length, snapshot.puts);
    assert.deepEqual(h.errors, []);
  };
  function cards() {
    return h.$('gallery-grid').querySelectorAll('button');
  }
  async function close({ failure = false, beforeCloseEvent } = {}) {
    const gate = media ? reads.arm(failure) : null;
    if (gate) t.after(gate.resolve);
    h.$('library-dialog').querySelector('[data-close]').click();
    const restoredFocuses = focuses;
    beforeCloseEvent?.();
    if (gate) await settle(() => gate.entered);
    else await new Promise((resolve) => setImmediate(resolve));
    return {
      restoredFocuses,
      async finish() {
        gate?.resolve();
        if (gate) await settle(() => !h.$('gallery-load-status').textContent.includes('Reading'));
        await new Promise((resolve) => setImmediate(resolve));
      },
    };
  }
  baseline();
  return { ...h, cards, records, calls, close, baseline, unchanged, focuses: () => focuses };
}

test('Title empty Collection imports 25 actual completions and reveals Flight records only after refreshed cards', async (t) => {
  const h = await setup(t);
  assert.equal(h.cards().length, 0);
  h.doc.querySelector('[data-library-panel="saves"]').click();
  h.$('save-json').value = JSON.stringify(profile);
  h.$('import-save').click();
  await settle(() => h.$('save-status').textContent.includes('Player library loaded'));
  assert.equal(
    importLibrary(JSON.parse(h.storage.getItem('revealline.library.dev.v1'))).gallery.length,
    25,
  );
  h.baseline();
  const pending = await h.close();
  await pending.finish();
  assert.equal(h.doc.activeElement === h.records, true);
  assert.equal(h.cards().length, 12);
  assert.deepEqual(h.calls, [
    { options: { block: 'nearest', inline: 'nearest', behavior: 'auto' }, cards: 12, status: '' },
  ]);
  assert.equal(
    h.focuses(),
    pending.restoredFocuses,
    'Reveal must not refocus the already restored opener.',
  );
  h.unchanged();
});

for (const failure of [false, true])
  test(`actual Flight records return waits for still metadata ${failure ? 'refusal' : 'success'} before revealing`, async (t) => {
    const h = await setup(t, { media: true }),
      pending = await h.close({ failure });
    assert.equal(h.calls.length, 0);
    assert.equal(h.doc.activeElement === h.records, true);
    await pending.finish();
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].cards, 1);
    if (failure) {
      assert.match(h.calls[0].status, /unavailable/);
      assert.equal(h.cards()[0].disabled, true);
    }
    assert.equal(h.focuses(), pending.restoredFocuses);
    h.unchanged();
  });

for (const choice of [
  'search',
  'close',
  'pointer',
  'key',
  'blur-return',
  'hidden-return',
  'pagehide',
  'new-dialog',
  'close-reopen',
  'new-population',
])
  test(`held Flight records return preserves ${choice} intent without late reveal`, async (t) => {
    const h = await setup(t, { media: true }),
      pending = await h.close();
    const search = h.$('gallery-search');
    if (choice === 'search') search.focus();
    if (choice === 'close') h.$('collection-dialog').querySelector('[data-close]').focus();
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
    if (choice === 'new-dialog') h.$('settings-dialog').showModal();
    if (choice === 'close-reopen') {
      h.$('collection-dialog').close();
      h.$('collection-dialog').showModal();
    }
    if (choice === 'new-population') search.emit('input');
    if (['blur-return', 'hidden-return', 'pagehide'].includes(choice)) {
      // Existing suspension owns its separate timestamp save; only subsequent
      // records-return settlement is required to perform no additional writes.
      await new Promise((resolve) => setImmediate(resolve));
      h.baseline();
    }
    const target = h.doc.activeElement;
    await pending.finish();
    assert.equal(h.calls.length, 0);
    assert.equal(h.doc.activeElement === target, true);
    h.unchanged();
  });

for (const choice of ['search', 'close', 'body', 'detached'])
  test(`queued Flight records close cannot adopt ${choice} as its return origin`, async (t) => {
    const h = await setup(t, { media: true }),
      pending = await h.close({
        beforeCloseEvent() {
          if (choice === 'search') h.$('gallery-search').focus();
          if (choice === 'close') h.$('collection-dialog').querySelector('[data-close]').focus();
          if (choice === 'body') h.records.blur();
          if (choice === 'detached') h.records.remove();
        },
      });
    const target = h.doc.activeElement;
    await pending.finish();
    assert.equal(h.calls.length, 0);
    assert.equal(h.doc.activeElement === target, true);
    h.unchanged();
  });
