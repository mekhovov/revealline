import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { attachLibraryEntry } from '../ui/library-entry.mjs';
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
function fixture(options = {}) {
  const document = new Document(),
    window = new Events(),
    calls = [],
    gate = deferred();
  const add = (tag, id, parent = document.body) => {
    const x = document.createElement(tag);
    x.id = id;
    parent.append(x);
    return x;
  };
  const library = add('dialog', 'library-dialog'),
    collection = add('dialog', 'collection-dialog');
  add('h2', 'library-title', library);
  add('h2', 'collection-title', collection);
  for (const id of ['scores', 'saves', 'packs', 'challenges'])
    add('section', 'library-' + id, library);
  const button = add('button', 'library-button');
  const packs = add('button', 'packs');
  packs.dataset.libraryPanel = 'packs';
  let active = true,
    loads = 0,
    constructors = 0;
  const api = {
    pause() {
      calls.push('pause');
      active = false;
    },
  };
  const owner = Object.fromEntries(
    [
      'open',
      'populateGallery',
      'refresh',
      'refreshMasteries',
      'cancelAttemptExport',
      'dispose',
    ].map((name) => [
      name,
      (...args) => {
        calls.push([name, ...args]);
        return name === 'cancelAttemptExport';
      },
    ]),
  );
  const module = {
    attachLibraryPanel(actual) {
      assert.equal(actual, api);
      assert.equal(active, false);
      constructors++;
      button.onclick = () => owner.open();
      return owner;
    },
  };
  const entry = attachLibraryEntry({
    document,
    window,
    api,
    load: () => {
      loads++;
      return options.load?.(loads) ?? gate.promise;
    },
    admit:
      options.admit ??
      ((work) => {
        assert.equal(active, false);
        return work();
      }),
  });
  return {
    document,
    window,
    library,
    collection,
    button,
    packs,
    calls,
    gate,
    module,
    entry,
    owner,
    counts: () => ({ loads, constructors }),
    active: () => active,
  };
}
test('unopened Library facade creates no panel, request, status or lifecycle listeners', async () => {
  const h = fixture();
  h.entry.refresh();
  h.entry.refreshMasteries();
  assert.equal(h.entry.cancelAttemptExport(), false);
  await flush();
  assert.deepEqual(h.counts(), { loads: 0, constructors: 0 });
  assert.equal(h.document.querySelector('.operation-status'), null);
  assert.equal(h.document.listeners.size, 0);
  assert.equal(h.window.listeners.size, 0);
  h.entry.dispose();
  assert.deepEqual(h.calls, []);
});
test('public open pauses before import/admission, preserves options and constructs once', async () => {
  const h = fixture();
  const opened = h.button.onclick();
  assert.equal(h.active(), false);
  assert.equal(h.library.open, true);
  assert.equal(h.document.getElementById('library-scores').hidden, true);
  await flush();
  h.gate.resolve(h.module);
  await opened;
  assert.deepEqual(h.counts(), { loads: 1, constructors: 1 });
  assert.deepEqual(h.calls, ['pause', ['open', 'scores']]);
  await h.packs.onclick();
  h.entry.refresh();
  h.entry.refreshMasteries();
  assert.equal(h.entry.cancelAttemptExport(), true);
  h.entry.dispose();
  await h.button.onclick();
  assert.equal(h.counts().constructors, 1);
  assert.equal(h.calls.filter((x) => Array.isArray(x) && x[0] === 'open').length, 2);
  assert.deepEqual(h.calls.at(-1), ['dispose']);
});
for (const kind of ['close', 'hidden', 'blur', 'pagehide', 'dispose'])
  test(`${kind} retires only pending opening before late import settles`, async () => {
    const h = fixture();
    const pending = h.entry.open();
    await flush();
    if (kind === 'close') {
      h.library.close();
      h.library.emit('close', { currentTarget: h.library });
    }
    if (kind === 'hidden') {
      h.document.hidden = true;
      h.document.emit('visibilitychange');
    }
    if (kind === 'blur' || kind === 'pagehide') h.window.emit(kind);
    if (kind === 'dispose') h.entry.dispose();
    assert.equal(await pending, false);
    h.gate.resolve(h.module);
    await flush();
    assert.equal(h.counts().constructors, 0);
    assert.equal(h.document.getElementById('library-dialog-entry-status').hidden, true);
  });
test('Collection replaces Library intent without reopening either closed owner', async () => {
  const h = fixture();
  const old = h.entry.open('packs');
  await flush();
  h.library.close();
  h.collection.showModal();
  const current = h.entry.populateGallery('gallery-opener');
  h.gate.resolve(h.module);
  assert.equal(await old, false);
  await current;
  assert.equal(h.library.open, false);
  assert.equal(h.collection.open, true);
  assert.deepEqual(h.calls.at(-1), ['populateGallery', 'gallery-opener']);
  assert.equal(h.counts().constructors, 1);
});
test('close after import but before main admission cannot construct or reopen', async () => {
  const admitted = deferred();
  let work, options;
  const h = fixture({
    admit: (fn, opts) => {
      work = fn;
      options = opts;
      return admitted.promise;
    },
  });
  const pending = h.entry.open();
  h.gate.resolve(h.module);
  await flush();
  assert.equal(typeof work, 'function');
  h.library.close();
  work();
  admitted.resolve();
  assert.equal(await pending, false);
  assert.equal(options.eligible(), false);
  assert.equal(h.counts().constructors, 0);
  assert.equal(h.library.open, false);
});
test('failed import is visible and retries only on a fresh public visit', async () => {
  const h = fixture({
    load: (n) => (n === 1 ? Promise.reject(new Error('offline module')) : undefined),
  });
  assert.equal(await h.entry.open(), false);
  assert.equal(h.document.getElementById('library-dialog-entry-status').dataset.state, 'error');
  await flush();
  assert.equal(h.counts().loads, 1);
  const retry = h.entry.open('saves');
  h.gate.resolve(h.module);
  await retry;
  assert.deepEqual(h.counts(), { loads: 2, constructors: 1 });
  assert.deepEqual(h.calls.at(-1), ['open', 'saves']);
});
test('partially failed constructor is never repeated by another public visit', async () => {
  const h = fixture();
  let attempts = 0;
  h.gate.resolve({
    attachLibraryPanel() {
      attempts++;
      throw new Error('constructor failure');
    },
  });
  assert.equal(await h.entry.open(), false);
  assert.equal(await h.entry.open(), false);
  assert.equal(attempts, 1);
  h.entry.dispose();
});

test('detached dialog cannot receive a late constructed panel', async () => {
  const h = fixture();
  const pending = h.entry.open();
  await flush();
  h.library.remove();
  h.gate.resolve(h.module);
  assert.equal(await pending, false);
  assert.equal(h.counts().constructors, 0);
  h.entry.dispose();
});
test('reentrant permanent disposal during construction immediately disposes the returned owner', async () => {
  const h = fixture();
  h.gate.resolve({
    attachLibraryPanel() {
      h.entry.dispose();
      return h.owner;
    },
  });
  assert.equal(await h.entry.open(), false);
  assert.deepEqual(h.calls, ['pause', ['dispose']]);
  await h.entry.open();
  assert.deepEqual(h.calls, ['pause', ['dispose']]);
});

test('partial constructor handler writes cannot bypass the failure latch or retired entry', async () => {
  const h = fixture();
  let attempts = 0,
    escaped = 0;
  h.gate.resolve({
    attachLibraryPanel() {
      attempts++;
      h.button.onclick = () => escaped++;
      h.packs.onclick = () => escaped++;
      throw new Error('after handler attachment');
    },
  });
  assert.equal(await h.entry.open(), false);
  await h.button.onclick();
  await h.packs.onclick();
  assert.equal(attempts, 1);
  assert.equal(escaped, 0);
  h.entry.dispose();
  await h.button.onclick();
  assert.equal(escaped, 0);
});
