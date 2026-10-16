import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBenchmarkCatalog } from '../../authoring/playable-benchmark/catalog.mjs';
import { createBenchmarkSession } from '../../authoring/playable-benchmark/session.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { canonicalJSON, dataIdentity } from '../data-json.mjs';

test('headless benchmark defaults Off and explicit opt-in separates measured setups', async (t) => {
  const catalog = await loadBenchmarkCatalog();
  for (const entry of catalog.entries) {
    const sourceBefore = canonicalJSON(entry.manifest);
    const ordinary = createBenchmarkSession(entry.manifest);
    const hunting = createBenchmarkSession(entry.manifest, { runningEnemies: true });
    t.after(() => {
      ordinary.dispose();
      hunting.dispose();
    });
    assert.equal(ordinary.setup.runningEnemies, false);
    assert.equal(ordinary.run.level.runningEnemies, undefined);
    assert.equal(hunting.setup.runningEnemies, true);
    assert.deepEqual(hunting.run.level.goal, ordinary.run.level.goal);
    assert.deepEqual(hunting.run.rules, ordinary.run.rules);
    assert.equal(hunting.summary.hunt.mode, 'bonus');
    assert.equal(hunting.summary.hunt.total, 6);
    assert.equal(hunting.summary.hunt.kills, 0);
    assert.equal(combatView(hunting.run).valid, true);
    assert.notEqual(hunting.setup.runtimeLevelIdentity, ordinary.setup.runtimeLevelIdentity);
    assert.equal(hunting.setup.runtimeLevelIdentity, dataIdentity(hunting.run.level));
    assert.equal(hunting.setup.sourceSimulationIdentity, ordinary.setup.sourceSimulationIdentity);
    assert.equal(hunting.setup.sourceRevision, ordinary.setup.sourceRevision);
    assert.equal(canonicalJSON(entry.manifest), sourceBefore);
    assert(Object.isFrozen(hunting.setup));
  }
});

test('Retry retains the accepted enemy recipe until a new benchmark session is loaded', async (t) => {
  const { entries } = await loadBenchmarkCatalog();
  const manifest = structuredClone(entries[0].manifest);
  const options = { runningEnemies: true };
  const session = createBenchmarkSession(manifest, options);
  t.after(() => session.dispose());
  const accepted = structuredClone(session.run);
  const identity = session.setup.runtimeLevelIdentity;
  options.runningEnemies = false;
  manifest.level.goal.coverage = 0.99;
  assert(session.start());
  assert(session.retry());
  assert.equal(session.playing, false);
  assert.deepEqual(session.run, accepted);
  assert.equal(session.setup.runningEnemies, true);
  assert.equal(session.setup.runtimeLevelIdentity, identity);
  const reloaded = createBenchmarkSession(entries[0].manifest, options);
  t.after(() => reloaded.dispose());
  assert.equal(reloaded.setup.runningEnemies, false);
  assert.equal(reloaded.run.level.runningEnemies, undefined);
  assert.notEqual(reloaded.setup.runtimeLevelIdentity, identity);
});

test('benchmark rejects ambiguous enemy preference values instead of silently opting in', async () => {
  const { entries } = await loadBenchmarkCatalog();
  for (const runningEnemies of ['false', 1, null])
    assert.throws(
      () => createBenchmarkSession(entries[0].manifest, { runningEnemies }),
      /explicit boolean/,
    );
});
