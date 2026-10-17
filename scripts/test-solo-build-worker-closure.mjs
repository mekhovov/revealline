import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectSoloWorkerClosure, SOLO_MP3_WORKER_FILES } from './solo-build-worker-closure.mjs';

const candidate = () => ({
  sourcePaths: new Set(SOLO_MP3_WORKER_FILES),
  manifestPaths: new Set(SOLO_MP3_WORKER_FILES),
  coreFiles: SOLO_MP3_WORKER_FILES.map((path) => ({ path })),
  inventoryFiles: SOLO_MP3_WORKER_FILES.map((path) => ({ path, delivery: 'core' })),
});
const baseline = () => ({
  sourcePaths: new Set(),
  manifestPaths: new Set(),
  coreFiles: [],
  inventoryFiles: [],
});

test('historical source without the capability admits only an absent worker closure', () => {
  const result = inspectSoloWorkerClosure(baseline());
  assert.equal(result.contract, 'absent-in-source');
  assert.deepEqual(result.failures, []);
  assert.equal(result.rows.length, 4);
});

test('current source requires every worker in the package and both offline core inventories', () => {
  assert.deepEqual(inspectSoloWorkerClosure(candidate()).failures, []);
  for (const path of SOLO_MP3_WORKER_FILES) {
    for (const location of ['manifestPaths', 'coreFiles', 'inventoryFiles']) {
      const fixture = candidate();
      if (location === 'manifestPaths') fixture[location].delete(path);
      else fixture[location] = fixture[location].filter((row) => row.path !== path);
      assert.deepEqual(inspectSoloWorkerClosure(fixture).failures, [
        { reason: 'MP3 worker closure is not offline core.', path },
      ]);
    }
  }
});

test('omitting the entire packaged capability cannot opt out of the source requirement', () => {
  const fixture = baseline();
  fixture.sourcePaths = candidate().sourcePaths;
  const result = inspectSoloWorkerClosure(fixture);
  assert.equal(result.contract, 'required-in-source');
  assert.equal(result.failures.length, 4);
});

test('partial source contracts fail even when all packaged workers are present', () => {
  for (const path of SOLO_MP3_WORKER_FILES) {
    const fixture = candidate();
    fixture.sourcePaths.delete(path);
    assert.ok(
      inspectSoloWorkerClosure(fixture).failures.some(
        (row) => row.reason === 'MP3 worker source contract is incomplete.',
      ),
    );
  }
});

test('historical source rejects unexpected packaged, core, or optional worker descriptors', () => {
  for (const path of SOLO_MP3_WORKER_FILES) {
    for (const location of ['manifestPaths', 'coreFiles', 'inventoryFiles']) {
      const fixture = baseline();
      if (location === 'manifestPaths') fixture[location].add(path);
      else fixture[location].push({ path, delivery: 'optional' });
      assert.deepEqual(inspectSoloWorkerClosure(fixture).failures, [
        { reason: 'MP3 worker is packaged without its source contract.', path },
      ]);
    }
    const fixture = candidate();
    fixture.inventoryFiles.find((row) => row.path === path).delivery = 'optional';
    assert.equal(inspectSoloWorkerClosure(fixture).failures.length, 1);
  }
});
