import test from 'node:test';
import assert from 'node:assert/strict';
import { createHuntRecords, HUNT_RECORDS_KEY, validateHuntRecords } from '../hunt/records.mjs';

function storage() {
  const rows = new Map();
  return { getItem: (key) => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value) };
}
const record = (key, fields = {}) => ({
  key: `team/${key}`,
  score: 100,
  time: 5,
  all: true,
  contact: true,
  clean: true,
  ...fields,
});
const envelope = (...records) => ({ format: 'HuntRecordsV1', records });

test('Hunt records merge independent same-page owners and retain best dimensions', () => {
  const saved = storage();
  const a = createHuntRecords({ getStorage: () => saved }),
    b = createHuntRecords({ getStorage: () => saved });
  a.import(envelope(record('aaaaaaaaaaaaaaaa')));
  b.import(
    envelope(
      record('bbbbbbbbbbbbbbbb'),
      record('aaaaaaaaaaaaaaaa', { score: 150, time: 7, clean: false, contact: false }),
    ),
  );
  assert.deepEqual(a.export(), b.export());
  assert.deepEqual(a.export().records[0], record('aaaaaaaaaaaaaaaa', { score: 150 }));
  a.dispose();
  b.dispose();
});

test('Hunt records preserve future or corrupt saved data and export session-only results', () => {
  for (const raw of ['{"format":"HuntRecordsV2","extra":true}', 'not json']) {
    const saved = storage();
    saved.setItem(HUNT_RECORDS_KEY, raw);
    const records = createHuntRecords({ getStorage: () => saved });
    assert.equal(records.import(envelope(record('aaaaaaaaaaaaaaaa'))).durable, false);
    assert.equal(saved.getItem(HUNT_RECORDS_KEY), raw);
    assert.equal(records.export().records.length, 1);
    records.dispose();
  }
});

test('Hunt record import validates before mutation and supports retry after a quota failure', () => {
  const saved = storage();
  let blocked = true;
  const records = createHuntRecords({
    getStorage: () => ({
      getItem: saved.getItem,
      setItem: (...args) => {
        if (blocked) throw new Error('quota');
        saved.setItem(...args);
      },
    }),
  });
  records.import(envelope(record('aaaaaaaaaaaaaaaa')));
  assert.equal(records.snapshot().durable, false);
  assert.throws(() =>
    records.import(envelope(record('aaaaaaaaaaaaaaaa'), record('aaaaaaaaaaaaaaaa'))),
  );
  assert.throws(() => validateHuntRecords(envelope(record('aaaaaaaaaaaaaaaa', { score: 2401 }))));
  assert.throws(() => validateHuntRecords(' '.repeat(65537)));
  assert.equal(records.export().records.length, 1);
  blocked = false;
  assert.equal(records.retry().durable, true);
  records.dispose();
});

test('a concurrent storage event merges an overwritten successful record', () => {
  const saved = storage();
  let handler;
  const window = {
    addEventListener: (_name, listener) => {
      handler = listener;
    },
    removeEventListener: () => {},
  };
  const records = createHuntRecords({ getStorage: () => saved, window });
  records.import(envelope(record('aaaaaaaaaaaaaaaa')));
  const overwritten = JSON.stringify(envelope(record('bbbbbbbbbbbbbbbb')));
  saved.setItem(HUNT_RECORDS_KEY, overwritten);
  handler({ key: HUNT_RECORDS_KEY, storageArea: saved, newValue: overwritten });
  assert.equal(JSON.parse(saved.getItem(HUNT_RECORDS_KEY)).records.length, 2);
  records.dispose();
});

test('Team clean milestone uses cumulative attempt downs and repeated terminal renders are inert', () => {
  const saved = storage(),
    records = createHuntRecords({ getStorage: () => saved });
  const run = {
    status: 'won',
    time: 7,
    huntRecordIdentity: 'aaaaaaaaaaaaaaaa',
    huntDowns: 1,
    level: { hunt: { mode: 'hunt', quota: 1, targets: [{ id: 'runner', kind: 'runner' }] } },
    hunt: { kills: 1, touchKills: 1, captureKills: 0, score: 100 },
  };
  assert.equal(records.complete(run, 'team').clean, false);
  const raw = saved.getItem(HUNT_RECORDS_KEY);
  assert.equal(records.complete(run, 'team'), null);
  assert.equal(saved.getItem(HUNT_RECORDS_KEY), raw);
  assert.equal(records.export().records.length, 1);
  records.dispose();
});

test('Solo record identity pins the attempt and separates chosen class and steering', () => {
  const saved = storage(),
    records = createHuntRecords({ getStorage: () => saved });
  const run = {
    ruleset: 'xonix-core.v10',
    status: 'won',
    time: 7,
    seed: 1,
    turnPolicy: 'free',
    classId: 'scout',
    classRecipes: [],
    level: {
      classic: { hunt: { mode: 'hunt', quota: 1, targets: [{ id: 'runner', kind: 'runner' }] } },
    },
    classic: { hunt: { kills: 1, touchKills: 1, captureKills: 0, score: 100 }, livesLost: 0 },
  };
  records.complete(run);
  assert.equal(records.best({ ...run, classId: 'heavy' }), null);
  assert.equal(records.best({ ...run, turnPolicy: 'grid' }), null);
  const original = records.best(run).key;
  run.level = { changedAfterIdentity: true };
  assert.equal(records.best(run).key, original);
  records.dispose();
});
