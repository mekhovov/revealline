import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStillAuthoringCatalog,
  STILL_AUTHORING_KEYS as keys,
} from '../ui/still-media-catalog.mjs';
import { mediaFixture, deferred } from './helpers/media-fixtures.mjs';

function setup() {
  const f = mediaFixture(true),
    rows = new Map(),
    held = new Set(),
    reads = [];
  const lockManager = {
    async request(name, options, work) {
      assert.equal(options.ifAvailable, true);
      if (held.has(name)) return work(null);
      held.add(name);
      try {
        return await work({ name });
      } finally {
        held.delete(name);
      }
    },
  };
  const read = (key) => {
    assert.deepEqual(held, new Set([keys.writer, keys.lock]));
    reads.push(key);
    return rows.has(key) ? rows.get(key) : null;
  };
  const catalog = createStillAuthoringCatalog({
    baseEntry: { campaign: f.campaign, themes: [{ id: 'fpv' }] },
    storage: { getItem: read },
    readAsset: async (key) => read(key),
    lockManager,
  });
  return { ...f, catalog, rows, held, reads };
}
test('installed dev catalog uses exact ownership and holds both source locks through media commit', async () => {
  const f = setup(),
    snapshot = await f.catalog.read();
  assert.equal(snapshot.executionCatalog.entries.length, 2);
  assert.equal(snapshot.executionCatalog.entries[0].baseCampaignKey, f.identity.baseCampaignKey);
  const gate = deferred(),
    commit = f.catalog.withCurrent(snapshot, async () => {
      assert.deepEqual(f.held, new Set([keys.writer, keys.lock]));
      await gate.promise;
      return 'committed';
    });
  await new Promise(setImmediate);
  await assert.rejects(f.catalog.read(), /Close the source game/);
  gate.resolve();
  assert.equal(await commit, 'committed');
  assert.equal(f.held.size, 0);
  assert.deepEqual([...new Set(f.reads)].sort(), [keys.journal, keys.lock, keys.packs].sort());
});
test('changed packs, missing locks and corrupt values never become empty authority', async () => {
  const f = setup(),
    snapshot = await f.catalog.read();
  f.rows.set(keys.packs, '{"format":"xonix-pack-library.v1","packs":[]}');
  let writes = 0;
  await assert.rejects(
    f.catalog.withCurrent(snapshot, () => ++writes),
    /Installed packs changed/,
  );
  assert.equal(writes, 0);
  for (const invalid of [undefined, {}, '{broken', 'null']) {
    f.rows.set(keys.packs, invalid);
    await assert.rejects(f.catalog.read());
  }
  await assert.rejects(createStillAuthoringCatalog({}).read(), /Web Locks/);
  await assert.rejects(
    f.catalog.withCurrent({ ...snapshot }, () => ++writes),
    /Reload/,
  );
});
test('pending recovery and cancellation stop catalog work without source writes or stolen locks', async () => {
  for (const key of [keys.journal, keys.lock]) {
    const f = setup();
    f.rows.set(key, 'pending');
    await assert.rejects(f.catalog.read(), /pending backup recovery/);
    assert.equal(f.reads.includes(keys.packs), false);
    assert.equal(f.held.size, 0);
  }
  const f = setup(),
    abort = new AbortController();
  abort.abort();
  await assert.rejects(f.catalog.read({ signal: abort.signal }), { name: 'AbortError' });
  assert.equal(f.reads.length, 0);
});
