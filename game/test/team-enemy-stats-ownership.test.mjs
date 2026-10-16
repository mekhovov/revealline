import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamEnemyStatsOwnership } from '../coop/enemy-stats-ownership.mjs';
import { createEnemyStatsHost } from '../enemy-stats.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

class Locks {
  held = new Set();
  async request(key, options, callback) {
    if (this.held.has(key)) return callback(null);
    this.held.add(key);
    try {
      return await callback({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

test('two pages continuing one Team save retain both new catches without sharing a tick cursor', async () => {
  const locks = new Locks(),
    model = managedIndexedDB(),
    values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const first = createTeamEnemyStatsOwnership({ locks, sessionId: 'first' });
  const second = createTeamEnemyStatsOwnership({ locks, sessionId: 'second' });
  await Promise.all([first.ready, second.ready]);
  const a = createEnemyStatsHost({ gameType: 'team', storage, indexedDB: model.indexedDB });
  const b = createEnemyStatsHost({ gameType: 'team', storage, indexedDB: model.indexedDB });
  try {
    a.begin('saved-team-attempt');
    await a.observe({ sequence: 1, defeats: [{ family: 'lookout' }] });
    await b.stats.read();
    const owned = first.select({}, 'saved-team-attempt', { provenance: 'continue' });
    const branchRun = {},
      branch = second.select(branchRun, 'saved-team-attempt', { provenance: 'continue' });
    assert.equal(owned.identity, 'saved-team-attempt');
    assert.equal(owned.provenance, 'continue');
    assert.notEqual(branch.identity, owned.identity);
    assert.equal(branch.provenance, 'live');
    assert.equal(second.select(branchRun, 'saved-team-attempt'), branch);
    a.begin(owned.identity, { provenance: owned.provenance });
    b.begin(branch.identity, { provenance: branch.provenance });
    await a.observe({ sequence: 2, defeats: [{ family: 'patroller' }] });
    await b.observe({ sequence: 2, defeats: [{ family: 'courier' }] });
    await b.observe({ sequence: 2, defeats: [{ family: 'courier' }] });
    await a.stats.read();
    assert.deepEqual(a.stats.totals().byFamily, { lookout: 1, patroller: 1, courier: 1 });
  } finally {
    a.close();
    b.close();
    first.release();
    second.release();
  }
  await turn();
  assert.equal(locks.held.size, 0);
});

test('unavailable or pending locks use a stable branch and keep preview provenance inert', async () => {
  const pending = [];
  const owner = createTeamEnemyStatsOwnership({
    locks: {
      request: (_key, _options, callback) =>
        new Promise((resolve) => {
          pending.push(() => {
            const holding = callback({ name: 'held' });
            holding.then(resolve);
            return holding;
          });
        }),
    },
    sessionId: 'late',
  });
  const run = {},
    early = owner.select(run, 'attempt', { provenance: 'continue' });
  assert.equal(early.provenance, 'live');
  assert.notEqual(early.identity, 'attempt');
  const holding = pending[0]();
  await owner.ready;
  assert.equal(owner.select(run, 'attempt', { provenance: 'continue' }), early);
  assert.equal(owner.select({}, 'other', { provenance: 'preview' }).provenance, 'preview');
  owner.release();
  await holding;
  const missing = createTeamEnemyStatsOwnership({ locks: null, sessionId: 'missing' });
  await missing.ready;
  assert.equal(missing.select({}, 'attempt', { provenance: 'preview' }).provenance, 'preview');
  missing.release();
});
