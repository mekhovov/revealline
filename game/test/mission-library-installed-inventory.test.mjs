import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createExternalChapterInventoryReader } from '../external-chapter-pointer.mjs';
import { createMissionLibraryInventory } from '../mission-library/installed-inventory.mjs';
import { createMetadataInstalledMissionLibrary } from '../mission-library/metadata-installed-library.mjs';
import {
  PACK_LIBRARY_VERSION,
  inspectPackLibraryMetadata,
  isPackLibraryMetadata,
  importPackLibrary,
  resolvePackCampaign,
} from '../packs.mjs';
import { preparedPackIdentity } from '../mission-library/pack-identity.mjs';
import { profileAssetFixture } from './helpers/profile-channel-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)));
const recipe = await json('../content/packs/night-shift.json');
const index = await json('../content/mission-library-index.json');
const baseEntry = {
  campaign: {
    ...(await json('../content/campaign.json')),
    classRecipes: await json('../content/classes.json'),
  },
};
const raw = (packs = [recipe]) => JSON.stringify({ format: PACK_LIBRARY_VERSION, packs });
const profileKey = 'revealline.library.release-v0.84.0.v1';
const packsKey = 'revealline.packs.release-v0.84.0.v1';
const lockKey = `${profileKey}.backup-lock`;
class Locks {
  held = new Set();
  async request(key, options, run) {
    assert.equal(options.ifAvailable, true);
    if (this.held.has(key)) return run(null);
    this.held.add(key);
    try {
      return await run({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function fixture(t, stored = raw(), { absent = false, wrap = (reader) => reader } = {}) {
  const f = await profileAssetFixture(stored === null ? [] : [[packsKey, stored]], { absent });
  const values = new Map();
  const reader = createExternalChapterInventoryReader({
    indexedDB: f.indexedDB,
    profileKey,
    packsKey,
    storage: { getItem: (key) => values.get(key) ?? null },
    lockManager: new Locks(),
  });
  const inventory = await createMissionLibraryInventory({ reader: wrap(reader) });
  t.after(() => inventory.close());
  return { ...f, reader, inventory, values };
}
async function put(f, value) {
  // Fixture setup writes use the raw model, never the production readonly adapter.
  const db = await new Promise((resolve, reject) => {
    const request = f.model.indexedDB.open('revealline-assets-v1', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readwrite');
    tx.objectStore('assets').put(value, packsKey);
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  f.model.allPuts.length = 0;
}
const noResources = () => {};

test('unread and absent remain distinct; factory does no storage IO and absence creates no database', async (t) => {
  const f = await fixture(t, null, { absent: true });
  const sentinel = f.inventory.getInventory();
  assert(isPackLibraryMetadata(sentinel));
  assert.equal(f.inventory.state().status, 'unread');
  assert.equal(f.inventory.state().ready, false);
  assert.match(f.inventory.state().reason, /not been checked/);
  assert.deepEqual(f.opens, []);
  const checked = await f.inventory.refresh();
  assert.notEqual(checked, sentinel);
  assert.deepEqual(checked.packs, []);
  assert.equal(f.inventory.state().ready, true);
  assert.equal(await f.inventory.confirm(checked), true);
  assert.deepEqual(f.model.contents(), new Map());
  assert.deepEqual(f.model.allPuts, []);
  // Finite IDB semantics, not native browser disk qualification.
});

test('browse is artwork-free and cached only by exact raw snapshot identity', async (t) => {
  const pictured = structuredClone(recipe);
  pictured.visualOverrides.player = {
    dataUrl:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'Image', original);
    else delete globalThis.Image;
  });
  globalThis.Image = function () {
    throw new Error('Browsing must not decode artwork.');
  };
  const bytes = raw([pictured]);
  const f = await fixture(t, bytes);
  const first = await f.inventory.refresh();
  const firstState = f.inventory.state();
  assert.equal(await f.inventory.refresh(), first);
  assert.equal(f.inventory.state().sha256, firstState.sha256);
  assert.equal(JSON.stringify(first).includes('data:image'), false);
  assert.throws(() => resolvePackCampaign(first.packs[0], recipe.campaigns[0].id), /prepared/);
  await put(f, bytes + '\n');
  const second = await f.inventory.refresh();
  assert.notEqual(second, first);
  assert.notEqual(f.inventory.state().sha256, firstState.sha256);
  assert.deepEqual(second.packs[0].identity, first.packs[0].identity);
  assert.throws(() => f.inventory.confirm(first), /superseded/);
  assert.deepEqual(f.model.allPuts, []);
});

test('explicit preparation receives exact bound bytes and returns genuine runtime ownership only', async (t) => {
  const f = await fixture(t);
  const metadata = await f.inventory.refresh();
  let calls = 0;
  const prepared = await f.inventory.materialize(
    metadata,
    async (context) => {
      calls++;
      assert.equal(context.metadata, metadata);
      assert.equal(context.snapshot.packs, raw());
      assert(Object.isFrozen(context) && Object.isFrozen(context.snapshot));
      assert.equal(context.isCurrent(), true);
      context.checkCurrent();
      return importPackLibrary(context.snapshot.packs);
    },
    { disposeFailed: () => assert.fail('Accepted resources belong to caller.') },
  );
  assert.equal(calls, 1);
  assert.deepEqual(await preparedPackIdentity(prepared.packs[0]), metadata.packs[0].identity);
  assert.equal(
    resolvePackCampaign(prepared.packs[0], recipe.campaigns[0].id).campaign.levels.length,
    3,
  );
  assert.deepEqual(f.model.contents(), f.before);
  assert.deepEqual(f.model.allPuts, []);
});

test('same-SHA refresh cannot resurrect held materialization and disposes its late result', async (t) => {
  const f = await fixture(t),
    gate = deferred();
  const metadata = await f.inventory.refresh();
  let context,
    resource,
    disposed = 0;
  const work = f.inventory.materialize(
    metadata,
    async (value) => {
      context = value;
      resource = { library: await importPackLibrary(value.snapshot.packs) };
      await gate.promise;
      return resource;
    },
    {
      disposeFailed: (result, error) => {
        assert.equal(result, resource);
        assert.match(error.message, /superseded/);
        disposed++;
      },
    },
  );
  const rejected = assert.rejects(work, /superseded/);
  await waitFor(() => resource);
  assert.equal(await f.inventory.refresh(), metadata, 'Cache reuses DTO, not action generation.');
  assert.equal(context.isCurrent(), false);
  gate.resolve();
  await rejected;
  assert.equal(disposed, 1);
  assert.equal(f.inventory.state().ready, true);
  assert.equal(await f.inventory.confirm(metadata), true);
});

test('failed read keeps old cards stale and blocks missing Classic downloads until a checked retry', async (t) => {
  const changed = structuredClone(recipe);
  changed.id = 'my-custom';
  const f = await fixture(t, raw([changed]));
  const metadata = await f.inventory.refresh();
  let downloads = 0;
  const host = await createMetadataInstalledMissionLibrary({
    index,
    baseEntry,
    getInventory: f.inventory.getInventory,
    compatibility: () => ['solo', 'versus'],
    describe: ({ level }) => ({ rules: `${level.rules.lives} authored lives` }),
    availabilityClassic: (_row, pack) =>
      !f.inventory.state().ready
        ? { state: 'unavailable', reason: f.inventory.state().reason }
        : pack
          ? { state: 'ready' }
          : { state: 'download', bytes: 1 },
    availabilityCustom: () => ({ state: 'ready' }),
    prepareClassic: () => {
      downloads++;
    },
    launchClassic: () => true,
    launchCustom: () => true,
  });
  const custom = host.library.missions.find((row) => row.collection === 'Custom');
  const classic = host.library.missions.find(
    (row) => row.runtimeId === recipe.campaigns[0].levels[0].id && row.collection === 'Classic',
  );
  assert.equal(host.library.availability(classic).state, 'download');
  const rows = host.library.missions.length;
  f.values.set(lockKey, 'backup owns profile');
  await assert.rejects(f.inventory.refresh(), /backup lock/);
  assert.equal(f.inventory.state().status, 'unavailable');
  assert.equal(f.inventory.state().hasPrevious, true);
  assert.match(f.inventory.state().error, /Existing packs are kept/);
  assert.notEqual(f.inventory.getInventory(), metadata);
  assert.equal(host.library.missions.length, rows, 'Host must not reconcile the unknown sentinel.');
  assert.equal(host.library.availability(custom).state, 'unavailable');
  assert.equal(host.library.availability(classic).state, 'unavailable');
  await assert.rejects(host.library.prepare(classic), /backup lock/);
  assert.equal(downloads, 0);
  const base = host.library.missions.find((row) => row.runtimeId === 'signal-12');
  assert.equal(host.library.availability(base).state, 'ready');
  f.values.delete(lockKey);
  assert.equal(await f.inventory.refresh(), metadata);
  await host.refreshInstalled();
  assert.equal(
    host.library.missions.find((row) => row.id === custom.id),
    custom,
  );
  assert.equal(host.library.availability(custom).state, 'ready');
  assert.equal(host.library.availability(classic).state, 'download');
  assert.deepEqual(f.model.contents(), f.before);
  assert.deepEqual(f.model.allPuts, []);
});

test('a late older refresh cannot replace or invalidate a newer checked inventory', async (t) => {
  const gate = deferred();
  let entered = false,
    first = true;
  const f = await fixture(t, raw(), {
    wrap: (reader) => ({
      ...reader,
      snapshot: async (options) => {
        if (first) {
          first = false;
          entered = true;
          await gate.promise;
        }
        return reader.snapshot(options);
      },
    }),
  });
  const older = f.inventory.refresh();
  const rejected = assert.rejects(older, /superseded/);
  await waitFor(() => entered);
  const current = await f.inventory.refresh();
  gate.resolve();
  await rejected;
  assert.equal(f.inventory.getInventory(), current);
  assert.equal(f.inventory.state().ready, true);
  assert.equal(f.inventory.state().error, null);
});

for (const action of ['change', 'abort', 'close'])
  test(`${action} after preparation retires and cleans up the returned resource`, async (t) => {
    const f = await fixture(t),
      signal = new AbortController();
    const metadata = await f.inventory.refresh();
    let disposed = 0;
    const resource = {};
    await assert.rejects(
      f.inventory.materialize(
        metadata,
        async () => {
          if (action === 'change') await put(f, raw() + '\n');
          else if (action === 'abort') signal.abort();
          else f.inventory.close();
          return resource;
        },
        {
          signal: signal.signal,
          disposeFailed: (result) => {
            assert.equal(result, resource);
            disposed++;
          },
        },
      ),
      action === 'abort' ? { name: 'AbortError' } : /changed|closed/,
    );
    assert.equal(disposed, 1);
    if (action === 'change') assert.equal(f.inventory.state().status, 'unavailable');
    if (action === 'close') {
      assert.equal(f.inventory.state().status, 'closed');
      await assert.rejects(f.reader.snapshot(), /closed|cancelled/i);
    }
    assert.deepEqual(f.model.allPuts, []);
  });

test('cleanup failure retains both errors and preparation rejection remains preparer-owned', async (t) => {
  const f = await fixture(t);
  const metadata = await f.inventory.refresh();
  const failure = new Error('Image decode rejected');
  let disposeCalls = 0;
  await assert.rejects(
    f.inventory.materialize(
      metadata,
      async () => {
        throw failure;
      },
      {
        disposeFailed: () => {
          disposeCalls++;
        },
      },
    ),
    (error) => error === failure,
  );
  assert.equal(disposeCalls, 0);
  assert.equal(f.inventory.state().ready, true);
  const cleanup = new Error('Resource disposal failed');
  await assert.rejects(
    f.inventory.materialize(
      metadata,
      async () => {
        f.inventory.close();
        return {};
      },
      {
        disposeFailed: () => {
          throw cleanup;
        },
      },
    ),
    (error) => {
      assert(error instanceof AggregateError);
      assert.match(error.errors[0].message, /closed/);
      assert.equal(error.errors[1], cleanup);
      return true;
    },
  );
});

test('unowned metadata and missing result lifecycle are rejected before preparation', async (t) => {
  const f = await fixture(t);
  const metadata = await f.inventory.refresh();
  let calls = 0;
  const prepare = () => {
    calls++;
  };
  for (const value of [
    structuredClone(metadata),
    await inspectPackLibraryMetadata(raw()),
    f.inventory.state(),
  ]) {
    await assert.rejects(
      f.inventory.materialize(value, prepare, { disposeFailed: noResources }),
      /exact inspected/,
    );
  }
  await assert.rejects(f.inventory.materialize(metadata, prepare), /cleanup/);
  assert.equal(calls, 0);
});

test('malformed stored content is explicitly unavailable, never a checked empty library', async (t) => {
  const f = await fixture(t, '{');
  const sentinel = f.inventory.getInventory();
  await assert.rejects(f.inventory.refresh());
  assert.equal(f.inventory.getInventory(), sentinel);
  assert.equal(f.inventory.state().ready, false);
  assert.equal(f.inventory.state().status, 'unavailable');
  assert.equal(f.inventory.state().hasPrevious, false);
  assert.match(f.inventory.state().error, /could not be checked/);
  assert.deepEqual(f.model.contents(), f.before);
  assert.deepEqual(f.model.allPuts, []);
});
