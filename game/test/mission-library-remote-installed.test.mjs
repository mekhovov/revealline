import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRemoteSoloVersusLibrarySources } from '../mission-library/remote-solo-versus.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { createExternalChapterPointerStore } from '../external-chapter-pointer.mjs';
import { PACK_LIBRARY_VERSION } from '../packs.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';

const recipe = JSON.parse(
  await readFile(new URL('../content/packs/night-shift.json', import.meta.url)),
);
const baseURL = 'https://example.test/releases/v0.84.0/site/game/';
class Locks {
  held = new Set();
  before = null;
  async request(key, _options, work) {
    await this.before?.(key);
    if (this.held.has(key)) return work(null);
    this.held.add(key);
    try {
      return await work({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
async function fixture(
  t,
  packs = [],
  { launch = async (context) => context.confirmInventory?.() ?? true, absent = false } = {},
) {
  const models = new Map(),
    values = new Map(),
    reads = [],
    decodes = [],
    launches = [];
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
  // Seed the storage boundary before browsing. A later pointer.snapshot() may
  // create an absent DB; that would rightly invalidate the readonly snapshot.
  if (!absent) await put(packs);
  let fetchHook = null;
  const locks = new Locks();
  const owner = await createRemoteSoloVersusLibrarySources({
    baseURL,
    installed: {
      channel: 'dev',
      indexedDB,
      storage,
      lockManager: locks,
      ImageClass: class {
        constructor() {
          decodes.push(this);
          throw new Error('No browse decode is allowed.');
        }
      },
    },
    fetch: async (url, options) => {
      const path = new URL(url).pathname.split('/site/')[1];
      reads.push(path);
      const replacement = await fetchHook?.(path, options);
      return replacement ?? new Response(await readFile(new URL('../../' + path, import.meta.url)));
    },
    launch: async (context) => {
      launches.push(context);
      return launch(context);
    },
  });
  t.after(() => {
    owner.dispose();
    pointer.close();
  });
  const library = createMissionLibrary(owner.sources);
  t.after(() => library.dispose());
  return {
    owner,
    library,
    values,
    reads,
    decodes,
    launches,
    put,
    locks,
    pointer,
    set fetchHook(value) {
      fetchHook = value;
    },
  };
}
const chapter = (library) =>
  library.missions.filter(
    (row) => row.collection === 'Classic' && row.campaignTitle === recipe.campaigns[0].title,
  );

test('remote installed Classic remains exact, validates raw snapshot at handoff, and never decodes while browsing', async (t) => {
  const f = await fixture(t, [recipe]);
  assert.equal(f.owner.state().ready, true);
  assert.equal(f.library.missions.length, 201);
  assert.equal(f.reads.length, 5);
  const row = chapter(f.library).at(-1);
  assert.ok(row);
  assert.equal(f.library.availability(row, 'versus').state, 'ready');
  assert.equal(await f.library.launch(row, { mode: 'versus', isCurrent: () => true }), true);
  assert.equal(f.launches[0].selection.levelIndex, 2);
  assert.equal(f.launches[0].pack, undefined);
  assert.deepEqual(f.decodes, []);
  const changed = structuredClone(recipe);
  changed.name = 'Player edition';
  await f.put([changed]);
  await assert.rejects(f.library.launch(row, { mode: 'solo', isCurrent: () => true }), /changed/i);
  assert.equal(f.library.availability(row).state, 'unavailable');
});

test('an obsolete held refresh cannot overwrite a newer successful inventory check', async (t) => {
  const f = await fixture(t, [recipe]);
  let release,
    entered = false;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  t.after(() => release());
  f.locks.before = async (key) => {
    if (!entered && key.endsWith('.backup-lock')) {
      entered = true;
      await gate;
    }
  };
  const older = f.owner.refresh();
  await waitFor(() => entered);
  await f.owner.refresh();
  assert.equal(f.owner.state().ready, true);
  const sources = f.owner.sources;
  release();
  await older;
  assert.equal(f.owner.state().ready, true);
  assert.equal(f.owner.state().reason, '');
  assert.deepEqual(f.owner.sources, sources);
  assert.equal(f.library.availability(chapter(f.library)[0]).state, 'ready');
});

test('modified same-ID artwork is Custom, has distinct exact IDs, and refreshed sources keep Classic owners stable', async (t) => {
  const modified = structuredClone(recipe);
  modified.visualOverrides.background = {
    dataUrl: `data:image/png;base64,${pngBytes().toString('base64')}`,
    fit: 'contain',
  };
  const f = await fixture(t, [modified]);
  assert.equal(f.library.missions.length, 204);
  const original = chapter(f.library)[0];
  assert.match(f.library.availability(original).reason, /different edition/);
  const custom = f.library.missions.filter((row) => row.collection === 'Custom');
  assert.equal(custom.length, 3);
  assert.deepEqual(
    custom.map((row) => row.runtimeId),
    modified.campaigns[0].levels.map((level) => level.id),
  );
  assert.equal(
    await f.library.launch(custom.at(-1), { mode: 'versus', isCurrent: () => true }),
    true,
  );
  const sources = f.owner.sources;
  await f.put([recipe]);
  await f.owner.refresh();
  assert.equal(f.library.availability(custom[0]).state, 'unavailable');
  assert.equal(f.owner.sources.filter((source) => source.collection === 'Custom').length, 0);
  for (const source of sources.filter((entry) => entry.collection === 'Classic'))
    assert.equal(
      f.owner.sources.find((entry) => entry.id === source.id),
      source,
    );
  assert.deepEqual(f.decodes, []);
});

test('trusted inline bundled Download becomes Play on the same Classic row without launching or touching progress', async (t) => {
  const f = await fixture(t);
  const row = chapter(f.library).at(-1);
  assert.equal(f.library.availability(row, 'solo').state, 'download');
  f.values.set('revealline.library.dev.v1', 'existing progress');
  assert.deepEqual(await f.library.prepare(row, { mode: 'solo' }), { state: 'ready' });
  assert.equal(f.library.find(row.id), row);
  assert.equal(f.library.availability(row, 'versus').state, 'ready');
  assert.equal(f.launches.length, 0);
  assert.equal(f.values.get('revealline.library.dev.v1'), 'existing progress');
  assert(f.reads.includes('game/content/packs/night-shift.json'));
  assert.equal(f.library.progress(row, 'solo'), '');
});

test('cancelled and failed downloads stay inline, preserve installed bytes, and retry explicitly', async (t) => {
  const f = await fixture(t);
  const before = await f.pointer.snapshot();
  const row = chapter(f.library).at(-1);
  let release,
    entered = false,
    returned = false;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  t.after(() => release());
  f.fetchHook = async (path) => {
    if (path.endsWith('packs/night-shift.json')) {
      entered = true;
      await gate;
      returned = true;
      return new Response('cancelled fixture response');
    }
  };
  const controller = new AbortController();
  const preparation = f.library.prepare(row, { mode: 'solo', signal: controller.signal });
  await waitFor(() => entered);
  controller.abort();
  release();
  assert.deepEqual(await preparation, { state: 'cancelled' });
  await waitFor(() => returned);
  // The chooser cancels immediately; the finite fetch/installer promise must
  // relinquish its transaction before a distinct deliberate Retry can enter.
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(await f.pointer.snapshot(), before);
  assert.equal(f.launches.length, 0);
  f.fetchHook = async (path) =>
    path.endsWith('packs/night-shift.json') ? new Response('offline', { status: 503 }) : undefined;
  await assert.rejects(f.library.prepare(row, { mode: 'solo' }), /503/);
  assert.equal(f.library.availability(row, 'solo').retry, true);
  assert.deepEqual(await f.pointer.snapshot(), before);
  f.fetchHook = null;
  assert.deepEqual(await f.library.prepare(row, { mode: 'solo' }), { state: 'ready' });
  assert.equal(f.launches.length, 0);
});

test('failed inventory refresh retains stale Custom cards and blocks invented downloads until deliberate retry', async (t) => {
  const custom = structuredClone(recipe);
  custom.name = 'Kept upload';
  const f = await fixture(t, [custom]);
  const sources = f.owner.sources;
  f.values.set('revealline.library.dev.v1.backup-lock', 'busy');
  await f.owner.refresh();
  assert.equal(f.owner.state().ready, false);
  assert.match(f.owner.state().reason, /backup lock/);
  assert.deepEqual(f.owner.sources, sources);
  const customRow = f.library.missions.find((row) => row.collection === 'Custom');
  assert.equal(f.library.availability(customRow).state, 'unavailable');
  const missing = f.library.missions.find(
    (row) => row.collection === 'Classic' && f.library.availability(row).state !== 'ready',
  );
  assert.equal(f.library.availability(missing).state, 'unavailable');
  f.values.delete('revealline.library.dev.v1.backup-lock');
  await f.owner.refresh();
  assert.equal(f.owner.state().ready, true);
  assert.equal(f.library.availability(customRow).state, 'ready');
  assert.deepEqual(f.decodes, []);
});

test('an actually absent database can recover inline from first-download 503 without losing the exact card', async (t) => {
  const f = await fixture(t, [], { absent: true });
  const row = chapter(f.library).at(-1);
  assert.equal(f.library.availability(row).state, 'download');
  let downloads = 0;
  f.fetchHook = async (path) => {
    if (!path.endsWith('/packs/night-shift.json')) return;
    downloads++;
    if (downloads === 1) return new Response('Controlled first-download failure', { status: 503 });
  };
  await assert.rejects(f.library.prepare(row), /503/);
  assert.equal(downloads, 1);
  assert.equal(f.library.availability(row).retry, true);
  assert.equal(f.launches.length, 0);
  assert.deepEqual(await f.library.prepare(row), { state: 'ready' });
  assert.equal(downloads, 2, 'The explicit Retry must reach its exact download again.');
  assert.equal(f.library.find(row.id), row);
  assert.equal(f.launches.length, 0);
  assert.equal(await f.library.launch(row, { isCurrent: () => true }), true);
  assert.equal(f.launches.length, 1);
});

test('a deliberate Retry refuses an intervening same-ID custom edition before another download', async (t) => {
  const f = await fixture(t, [], { absent: true });
  const row = chapter(f.library).at(-1);
  let downloads = 0;
  f.fetchHook = async (path) => {
    if (!path.endsWith('/packs/night-shift.json')) return;
    downloads++;
    return new Response('Controlled first-download failure', { status: 503 });
  };
  await assert.rejects(f.library.prepare(row), /503/);
  const modified = structuredClone(recipe);
  modified.name = 'Retain this player edition';
  await f.put([modified]);
  const before = await f.pointer.snapshot();
  await assert.rejects(f.library.prepare(row), /different edition/i);
  assert.equal(downloads, 1);
  assert.deepEqual(await f.pointer.snapshot(), before);
  assert.equal(f.launches.length, 0);
  assert.equal(f.owner.sources.filter((source) => source.collection === 'Custom').length, 1);
});

test('installed external gameplay alone never grants original-picture readiness or a remote handoff', async (t) => {
  const { buildRouteWorld } = await import('../../authoring/library/route-worlds/build.mjs');
  const world = await buildRouteWorld('retro');
  const pack = JSON.parse(await world.payloads.pack.text());
  const f = await fixture(t, [pack]);
  const row = f.library.missions.find(
    (entry) =>
      entry.collection === 'Classic' && JSON.parse(entry.ownerId)[2] === world.descriptor.id,
  );
  assert.ok(row);
  const availability = f.library.availability(row);
  assert.equal(availability.state, 'unavailable');
  assert.equal(availability.retry, true);
  assert.match(availability.reason, /Original pictures need checking/);
  const before = await f.pointer.snapshot();
  await assert.rejects(f.library.prepare(row), /original|paired|picture|index|installed|missing/i);
  assert.equal(f.library.availability(row).state, 'unavailable');
  assert.equal(f.launches.length, 0);
  assert.deepEqual(f.decodes, []);
  assert.deepEqual(await f.pointer.snapshot(), before);
  await f.owner.refresh();
  assert.equal(f.library.availability(row).state, 'unavailable');
});
