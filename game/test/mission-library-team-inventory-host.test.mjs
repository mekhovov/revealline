import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createExternalChapterPointerStore } from '../external-chapter-pointer.mjs';
import { PACK_LIBRARY_VERSION } from '../packs.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';

const recipe = JSON.parse(
  await readFile(new URL('../content/packs/night-shift.json', import.meta.url)),
);
const custom = {
  ...recipe,
  name: 'My illustrated edition',
  visualOverrides: {
    background: {
      dataUrl: `data:image/png;base64,${pngBytes().toString('base64')}`,
      fit: 'contain',
    },
  },
};
class Locks {
  held = new Set();
  before = null;
  completed = [];
  async request(key, _options, callback) {
    await this.before?.(key);
    if (this.held.has(key)) return callback(null);
    this.held.add(key);
    try {
      return await callback({ name: key });
    } finally {
      this.held.delete(key);
      this.completed.push(key);
    }
  }
}
async function fixture(t, packs = []) {
  const models = new Map(),
    values = new Map(),
    requests = [],
    locks = new Locks();
  const indexedDB = {
    open(name, ...args) {
      if (!models.has(name)) models.set(name, managedIndexedDB());
      return models.get(name).indexedDB.open(name, ...args);
    },
  };
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const pointer = createExternalChapterPointerStore({
    indexedDB,
    profileKey: 'revealline.library.dev.v1',
    packsKey: 'revealline.packs.dev.v1',
  });
  async function put(next) {
    await pointer.compareAndSwap(await pointer.snapshot(), {
      packs: JSON.stringify({ format: PACK_LIBRARY_VERSION, packs: next }),
      index: null,
      journal: null,
    });
  }
  await put(packs);
  t.after(() => pointer.close());
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
    beforeImport({ install }) {
      install('crypto', { value: webcrypto });
      install('indexedDB', { value: indexedDB });
      install('localStorage', { value: storage });
      install('navigator', { value: { getGamepads: () => [], locks } });
      install('fetch', {
        value: async (url) => {
          const path = new URL(url).pathname.slice(1);
          requests.push(path);
          return new Response(await readFile(new URL('../../' + path, import.meta.url)));
        },
      });
    },
  });
  return {
    ...f,
    values,
    requests,
    images: f.artwork.calls.decodes,
    initialImages: f.artwork.calls.decodes.length,
    pointer,
    put,
    locks,
  };
}
const settle = (predicate) => waitFor(predicate, { timeoutMs: 15000 });
const cards = (f) => [...f.$('journey-cards').querySelectorAll('.journey-card')];
async function open(f, paused = false) {
  f.$(paused ? 'coop-discovery-paused' : 'coop-discovery-open').focus();
  f.tap('Enter');
  await settle(() => f.$('journey-chooser')?.open);
  f.$('journey-mode').focus();
  f.$('journey-mode').value = 'solo';
  f.$('journey-mode').emit('change');
  await settle(() => cards(f).length >= 201);
}
function collection(f, value) {
  f.$('journey-collection').value = value;
  f.$('journey-collection').emit('change');
  return cards(f);
}

test('actual Team library browses same-ID Custom artwork with no decodes and hands off the exact late mission', async (t) => {
  const f = await fixture(t, [custom]);
  const before = await f.pointer.snapshot();
  await open(f);
  assert.equal(cards(f).length, 204);
  assert.match(f.$('coop-library-remote-status').textContent, /All missions loaded/);
  const rows = collection(f, 'Custom');
  assert.equal(rows.length, 3);
  const target = rows.find(
    (card) => JSON.parse(card.dataset.missionId)[3] === recipe.campaigns[0].levels.at(-1).id,
  );
  assert.ok(target);
  assert.equal(f.images.length, f.initialImages);
  assert.deepEqual(await f.pointer.snapshot(), before);
  target.focus();
  f.tap('Enter');
  await settle(() => f.visits.length === 1);
  const href = new URL(f.visits[0]);
  assert.equal(href.pathname, '/game/');
  assert.equal(href.searchParams.get('journey'), 'legacy');
  assert.equal(href.searchParams.get('library-mission'), target.dataset.missionId);
  assert.equal(href.searchParams.get('journey-return'), 'legacy');
  assert.equal(f.images.length, f.initialImages);
});

test('Team confirms installed raw authority after Replace and refuses a changed Custom edition without changing its attempt', async (t) => {
  const f = await fixture(t, [custom]);
  f.$('coop-start').click();
  f.$('coop-pause').click();
  const checkpoint = structuredClone(f.lastPaint);
  await open(f, true);
  const target = collection(f, 'Custom').at(-1);
  target.focus();
  f.tap('Enter');
  await settle(() => f.$('coop-discard-dialog').open);
  assert.equal(f.visits.length, 0);
  const changed = structuredClone(custom);
  changed.name = 'Replaced during decision';
  await f.put([changed]);
  f.$('coop-discard-confirm').click();
  await settle(() => f.$('journey-chooser').open);
  assert.match(f.$('journey-chooser-status').textContent, /changed/i);
  assert.equal(f.visits.length, 0);
  assert.deepEqual(f.lastPaint, checkpoint);
  assert.equal(f.images.length, f.initialImages);
});

test('Team inline trusted download preserves filter, search, focused card and attempt until a separate Play', async (t) => {
  const f = await fixture(t);
  await open(f);
  collection(f, 'Classic');
  f.$('journey-search').value = recipe.campaigns[0].levels.at(-1).name;
  f.$('journey-search').emit('input');
  const target = cards(f).find(
    (card) => JSON.parse(card.dataset.missionId)[3] === recipe.campaigns[0].levels.at(-1).id,
  );
  assert.match(target.textContent, /Download/);
  const id = target.dataset.missionId,
    checkpoint = structuredClone(f.lastPaint);
  target.focus();
  f.tap('Enter');
  await settle(() => /Play/.test(target.textContent) && !/Preparing/.test(target.textContent));
  assert.equal(f.$('journey-chooser').open, true);
  assert.equal(f.$('journey-collection').value, 'Classic');
  assert.equal(f.$('journey-search').value, recipe.campaigns[0].levels.at(-1).name);
  assert.equal(f.doc.activeElement, target);
  assert.equal(
    cards(f).find((card) => card.dataset.missionId === id),
    target,
  );
  assert.deepEqual(f.lastPaint, checkpoint);
  assert.equal(f.visits.length, 0);
  assert(f.requests.includes('game/content/packs/night-shift.json'));
  f.tap('Enter');
  await settle(() => f.visits.length === 1);
  assert.equal(new URL(f.visits[0]).searchParams.get('library-mission'), id);
});

test('a later held inventory refresh interrupted by blur offers Retry and cannot publish late Custom owners', async (t) => {
  const f = await fixture(t, [custom]);
  await open(f);
  assert.match(f.$('coop-library-remote-status').textContent, /All missions loaded/);
  const before = cards(f).map((card) => card.dataset.missionId);
  f.$('journey-back').click();
  const changed = structuredClone(custom);
  changed.name = 'New edition awaiting deliberate refresh';
  await f.put([changed]);
  let release,
    entered = false;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  t.after(() => release());
  const completed = f.locks.completed.length;
  f.locks.before = async (key) => {
    if (!entered && key.endsWith('.backup-lock')) {
      entered = true;
      await gate;
    }
  };
  f.$('coop-discovery-open').focus();
  f.tap('Enter');
  await settle(() => entered && f.$('journey-chooser').open);
  assert.match(f.$('coop-library-remote-status').textContent, /Loading/);
  f.win.emit('blur');
  assert.match(f.$('coop-library-remote-status').textContent, /interrupted/i);
  assert.equal(f.$('coop-library-remote-retry').hidden, false);
  assert.equal(f.$('coop-library-remote-retry').textContent, 'Retry');
  release();
  await settle(() => f.locks.completed.length >= completed + 2);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(
    cards(f).map((card) => card.dataset.missionId),
    before,
  );
  assert.equal(f.visits.length, 0);
  f.win.emit('focus');
  f.$('coop-library-remote-retry').focus();
  f.tap('Enter');
  await settle(() => /All missions loaded/.test(f.$('coop-library-remote-status').textContent));
  assert.notDeepEqual(
    cards(f).map((card) => card.dataset.missionId),
    before,
  );
  assert.equal(f.visits.length, 0);
  assert.equal(f.images.length, f.initialImages);
});
