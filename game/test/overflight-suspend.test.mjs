import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  createSurvivalSuspend,
  SURVIVAL_SUSPEND_FORMAT,
  validateSurvivalSuspend,
} from '../overflight/suspend.mjs';
import {
  createOverflightRecords,
  validateOverflightRecords,
  OVERFLIGHT_RECORDS_FORMAT,
  overflightRecordContext,
} from '../overflight/records.mjs';
import {
  createOverflightMastery,
  validateOverflightMastery,
  OVERFLIGHT_MASTERY_FORMAT,
} from '../overflight/mastery.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  pauseOverflight,
  resumeOverflight,
  chooseOverflightUpgrade,
} from '../overflight/core.mjs';
import { assessmentDigest } from './helpers/survival-roundtrip.mjs';
import { dataIdentity } from '../data-json.mjs';

const { IDBFactory } = createRequire(
  new URL('../../authoring/fpv-worlds/package.json', import.meta.url),
)('fake-indexeddb');
// Storage/codec test identity only; production manifest admission is tested apart.
const packageIdentity = {
  manifestSha256: 'a'.repeat(64),
  runtimeSha256: 'b'.repeat(64),
  sourceRevision: 'c'.repeat(40),
};
const ids = ['12345678-1234-4123-8123-123456789abc', '12345678-1234-4123-8123-123456789abd'];
function flight(seed = 7) {
  const project = createOverflightProject({ rulesVersion: 4, world: 'field-crossing', seed });
  const run = createOverflightRun(compileOverflightProject(project), { airframes: 1 });
  startOverflight(run);
  for (let tick = 0; tick < 120; tick++) stepOverflight(run, {});
  pauseOverflight(run);
  return { project, run };
}
function complete(run) {
  resumeOverflight(run);
  let ticks = 0;
  while (['playing', 'upgrade'].includes(run.phase) && ticks++ < 30000) {
    if (run.phase === 'upgrade') chooseOverflightUpgrade(run, run.offers[0].id);
    else stepOverflight(run, {});
  }
  assert.equal(run.phase, 'lost', 'actual stationary gameplay must complete the run');
}
function fixture(indexedDB = new IDBFactory(), options = {}) {
  const records = createOverflightRecords({ indexedDB }),
    mastery = createOverflightMastery({ indexedDB });
  let next = 0;
  const coordinator = createSurvivalSuspend({
    indexedDB,
    records,
    mastery,
    packageIdentity,
    canWrite: () => true,
    randomUUID: () => ids[next++],
    ...options,
  });
  return {
    indexedDB,
    records,
    mastery,
    coordinator,
    close() {
      coordinator.close();
      records.dispose();
      mastery.dispose();
    },
  };
}

test('explicit replacement, exact-package admission and reopen retain the previous paused state', async () => {
  const f = fixture(),
    first = flight(),
    second = flight(8);
  try {
    const saved = await f.coordinator.save(first.run, first.project);
    assert.equal(f.coordinator.owns(first.run), true);
    await assert.rejects(f.coordinator.save(second.run, second.project), /Confirm replacing/);
    assert.deepEqual(await f.coordinator.read(), saved);
    const candidate = await f.coordinator.prepareRestore();
    assert.equal(assessmentDigest(candidate.run), assessmentDigest(first.run));
    assert.equal(candidate.run.phase, 'paused');
    await f.coordinator.admitRestore(candidate);
    assert.equal(f.coordinator.owns(candidate.run), true);
    const changed = fixture(f.indexedDB, {
      packageIdentity: { ...packageIdentity, manifestSha256: 'd'.repeat(64) },
    });
    try {
      await assert.rejects(changed.coordinator.prepareRestore(), /exact game package/);
      assert.deepEqual(await changed.coordinator.read(), saved);
    } finally {
      changed.close();
    }
    const other = fixture(f.indexedDB, { randomUUID: () => ids[1] });
    try {
      await other.coordinator.read();
      await other.coordinator.save(second.run, second.project, { replace: true });
      await assert.rejects(f.coordinator.save(first.run, first.project), /changed/);
      const stale = candidate;
      await assert.rejects(f.coordinator.admitRestore(stale), /not been prepared/);
      assert.equal((await other.coordinator.read()).attemptId, ids[1]);
    } finally {
      other.close();
    }
  } finally {
    f.close();
  }
});

test('durable completion cannot be replayed or change its previous comparison after reopen', async () => {
  const f = fixture(),
    { run, project } = flight();
  await f.coordinator.save(run, project);
  complete(run);
  const result = await f.coordinator.finish(run);
  assert.equal(result.records.durable, true);
  assert.equal(result.mastery.durable, true);
  assert.equal(result.records.previous, null);
  assert.equal(result.mastery.previous, null);
  assert.equal((await f.coordinator.read()).phase, 'consumed');
  const duplicate = await f.coordinator.finish(run);
  assert.deepEqual(duplicate, result);
  const indexedDB = f.indexedDB;
  f.close();
  const reopened = fixture(indexedDB);
  try {
    assert.equal((await reopened.coordinator.read()).phase, 'consumed');
    await assert.rejects(reopened.coordinator.prepareRestore(), /No resumable/);
    // Receipt deduplication must survive a fresh run object and fresh stores.
    assert.deepEqual(
      await reopened.records.record(structuredClone(run), { attemptId: ids[0] }),
      result.records,
    );
    assert.deepEqual(
      await reopened.mastery.record(structuredClone(run), { attemptId: ids[0] }),
      result.mastery,
    );
    await assert.rejects(
      reopened.records.record({ ...run, time: run.time + 1 }, { attemptId: ids[0] }),
      /different result/,
    );
  } finally {
    reopened.close();
  }
});

for (const failAfter of ['journal', 'records', 'mastery'])
  test(`interruption after ${failAfter} retains durable ownership and retries after reopen`, async () => {
    const f = fixture(),
      { run, project } = flight();
    let interrupted = false;
    const records = {
      async record(...args) {
        if (failAfter === 'journal' && !interrupted) {
          interrupted = true;
          throw new Error('interrupted');
        }
        const value = await f.records.record(...args);
        if (failAfter === 'records' && !interrupted) {
          interrupted = true;
          throw new Error('interrupted');
        }
        return value;
      },
    };
    const mastery = {
      async record(...args) {
        const value = await f.mastery.record(...args);
        if (failAfter === 'mastery' && !interrupted) {
          interrupted = true;
          throw new Error('interrupted');
        }
        return value;
      },
    };
    const c = createSurvivalSuspend({
      indexedDB: f.indexedDB,
      records,
      mastery,
      packageIdentity,
      canWrite: () => true,
      randomUUID: () => ids[0],
    });
    await c.save(run, project);
    complete(run);
    await assert.rejects(c.finish(run), /interrupted/);
    assert.equal((await c.read()).phase, 'finishing');
    await assert.rejects(c.save(flight(8).run, flight(8).project, { replace: true }), /recovering/);
    c.close();
    f.close();
    const reopened = fixture(f.indexedDB);
    try {
      const recovered = await reopened.coordinator.recoverResults();
      assert.equal(assessmentDigest(recovered.run), assessmentDigest(run));
      assert.equal(recovered.records.previous, null);
      assert.equal(recovered.mastery.previous, null);
      assert.equal((await reopened.coordinator.read()).phase, 'consumed');
      const recordReader = createProfileRecordBackend({
        key: OVERFLIGHT_RECORDS_FORMAT,
        empty: () => null,
        validate: validateOverflightRecords,
        indexedDB: f.indexedDB,
      });
      const masteryReader = createProfileRecordBackend({
        key: OVERFLIGHT_MASTERY_FORMAT,
        empty: () => null,
        validate: validateOverflightMastery,
        indexedDB: f.indexedDB,
      });
      assert.equal(Object.keys((await recordReader.read()).entries).length, 1);
      assert.equal(Object.keys((await masteryReader.read()).entries).length, 1);
      recordReader.close();
      masteryReader.close();
    } finally {
      reopened.close();
    }
  });

test('storage rejection and lost writer never mutate the active flight or replace the old slot', async () => {
  const f = fixture(),
    first = flight();
  const saved = await f.coordinator.save(first.run, first.project);
  const previous = assessmentDigest(first.run);
  let writable = true;
  const backend = {
    read: () => Promise.resolve(saved),
    update: () => Promise.reject(new Error('quota')),
  };
  const broken = fixture(f.indexedDB, { backend, canWrite: () => writable });
  try {
    await assert.rejects(broken.coordinator.save(first.run, first.project), /quota/);
    assert.equal(assessmentDigest(first.run), previous);
    assert.deepEqual(await f.coordinator.read(), saved);
    writable = false;
    await assert.rejects(broken.coordinator.prepareRestore(), /does not own/);
    assert.deepEqual(await f.coordinator.read(), saved);
    assert.throws(() => validateSurvivalSuspend({ ...saved, format: 'unknown' }));
    assert.equal(saved.format, SURVIVAL_SUSPEND_FORMAT);
  } finally {
    broken.close();
    f.close();
  }
});

test('a full records profile can finish, recover after its receipt commits, and save the next flight', async () => {
  const f = fixture(),
    { run, project } = flight();
  const reader = createProfileRecordBackend({
    key: OVERFLIGHT_RECORDS_FORMAT,
    empty: () => ({ format: OVERFLIGHT_RECORDS_FORMAT, entries: {} }),
    validate: validateOverflightRecords,
    indexedDB: f.indexedDB,
  });
  const base = overflightRecordContext(run);
  await reader.update((state) => {
    for (let seed = 1000; seed < 1256; seed++) {
      const context = { ...base, seed };
      state.entries[dataIdentity(context)] = {
        context,
        fastestClear: null,
        bestScore: null,
        last: null,
      };
    }
    return state;
  });
  const c = createSurvivalSuspend({
    indexedDB: f.indexedDB,
    packageIdentity,
    canWrite: () => true,
    records: f.records,
    mastery: {
      record: async () => {
        throw new Error('interrupted after records');
      },
    },
    randomUUID: () => ids[0],
  });
  try {
    await c.save(run, project);
    complete(run);
    await assert.rejects(c.finish(run), /interrupted after records/);
    assert.equal((await c.read()).phase, 'finishing');
    const stored = await reader.read();
    assert.equal(Object.keys(stored.entries).length, 256);
    assert.equal(stored.entries[dataIdentity(base)].last.outcome, 'lost');
  } finally {
    c.close();
    f.close();
    reader.close();
  }
  const reopened = fixture(f.indexedDB, { randomUUID: () => ids[1] });
  try {
    const recovered = await reopened.coordinator.recoverResults();
    assert.equal(recovered.records.previous, null, 'The committed receipt is replayed.');
    assert.equal(recovered.records.durable, true);
    assert.equal(recovered.mastery.durable, true);
    assert.equal((await reopened.coordinator.read()).phase, 'consumed');
    const next = flight(8);
    await reopened.coordinator.save(next.run, next.project);
    assert.equal((await reopened.coordinator.read()).attemptId, ids[1]);
    assert.equal((await reopened.coordinator.prepareRestore()).run.seed, 8);
  } finally {
    reopened.close();
  }
});
