import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';
import {
  createFlightAttemptStore,
  verifyFlightAttempt,
} from '../../optional-practice/civilian-fpv/attempts.mjs';
import {
  createFlightNotebook,
  flightRewardDefinitions,
} from '../../optional-practice/civilian-fpv/notebook.mjs';
import { validateFlightStudioBundle } from '../../optional-practice/civilian-fpv/studio.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
const proof = (index = 0) => ({
  ...structuredClone(FLIGHT_DEMONSTRATIONS[index]),
  session: 'practice',
});
test('flight attempts reverify before persistence, reject demonstration or completion flags and isolate transcript records', async () => {
  const db = managedIndexedDB(),
    store = createFlightAttemptStore({ courses: FLIGHT_COURSES, indexedDB: db.indexedDB });
  await store.load();
  await assert.rejects(store.accept(FLIGHT_DEMONSTRATIONS[0]), /cannot earn/);
  await assert.rejects(store.accept({ ...proof(), completed: true }), /completed/);
  const accepted = await store.accept(proof());
  assert.equal(accepted.saved, true);
  assert.equal(store.records().length, 1);
  const exported = store.export();
  assert.equal(exported.attempts[0].frames.length, proof().frames.length);
  await store.close();
  const restored = createFlightAttemptStore({ courses: FLIGHT_COURSES, indexedDB: db.indexedDB });
  await restored.load();
  assert.deepEqual(restored.records(), [accepted.record]);
  await restored.close();
});
test('flight finale remains locked at 11/12 and repeats never substitute; twelve Acro is separate', async () => {
  const db = managedIndexedDB(),
    book = createFlightNotebook({ courses: FLIGHT_COURSES, indexedDB: db.indexedDB });
  await book.ready;
  for (let i = 0; i < 11; i++) await book.accept(proof(i * 2));
  await book.accept(proof(0));
  let ids = book.snapshot().rewards.receipts.map((item) => item.definition.id);
  assert.equal(ids.length, 11);
  assert.ok(!ids.includes('flight-notebook-finale'));
  await book.accept(proof(22));
  ids = book.snapshot().rewards.receipts.map((item) => item.definition.id);
  assert.equal(ids.length, 13);
  assert.ok(ids.includes('flight-notebook-finale'));
  assert.ok(!ids.includes('flight-all-acro'));
  for (let i = 0; i < 12; i++) await book.accept(proof(i * 2 + 1));
  ids = book.snapshot().rewards.receipts.map((item) => item.definition.id);
  assert.ok(ids.includes('flight-all-acro'));
  assert.equal(ids.length, 14);
  assert.ok(
    book
      .snapshot()
      .rewards.receipts.every((item) => Object.keys(item.evidence.clears).length === 0),
  );
  await book.close();
});
test('whole transfer verifies before granting any reward and failed saves remain explicitly recoverable', async () => {
  const db = managedIndexedDB(),
    store = createFlightAttemptStore({ courses: FLIGHT_COURSES, indexedDB: db.indexedDB });
  await store.load();
  const bad = proof(2);
  bad.frames[1][3] = -1;
  await assert.rejects(
    store.import({
      format: 'FlightProofBackup.v1',
      packageId: 'civilian-fpv',
      attempts: [proof(), bad],
    }),
  );
  assert.equal(store.records().length, 0);
  db.failAnyPutAt = 1;
  const session = await store.accept(proof());
  assert.equal(session.saved, false);
  assert.equal(store.status().saved, false);
  assert.equal(store.export().attempts.length, 1);
  db.failAnyPutAt = null;
  await store.retry();
  assert.equal(store.status().saved, true);
  await store.close();
});
test('studio bundle round trip retains exact criteria, source text, verified demonstration and typed rewards', () => {
  const course = FLIGHT_COURSES[0],
    bundle = {
      format: 'FlightStudioBundle.v1',
      course,
      rewards: [flightRewardDefinitions([course])[0]],
      demonstration: FLIGHT_DEMONSTRATIONS[0],
    };
  assert.deepEqual(validateFlightStudioBundle(JSON.stringify(bundle)), bundle);
  const bad = structuredClone(bundle);
  bad.course.revision = 'r2';
  assert.throws(() => validateFlightStudioBundle(bad), /exact course/);
  bad.rewards = [flightRewardDefinitions([bad.course])[0]];
  assert.throws(() => validateFlightStudioBundle(bad), /Exact flight/);
});
test('changed mode recomputes outcome, response changes require exact identity and proof digest pins every frame', async () => {
  const result = await verifyFlightAttempt(FLIGHT_COURSES, proof());
  const changed = proof();
  changed.response.expo = 1;
  await assert.rejects(verifyFlightAttempt(FLIGHT_COURSES, changed), /Exact flight/);
  const same = await verifyFlightAttempt(FLIGHT_COURSES, JSON.stringify(proof()));
  assert.equal(result.hash, same.hash);
});

test('accepted flight return data cannot mutate later proof exports or verified projections', async () => {
  const db = managedIndexedDB(),
    store = createFlightAttemptStore({ courses: FLIGHT_COURSES, indexedDB: db.indexedDB });
  await store.load();
  const result = await store.accept(proof());
  const expected = store.export(),
    records = store.records();
  result.proof.frames[0][0] = 1000;
  result.proof.course = 'flight-12';
  result.record.course = 'flight-12';
  result.summary.heightRange.min = -99;
  assert.deepEqual(store.export(), expected);
  assert.deepEqual(store.records(), records);
  await store.close();
});

test('flight archive accepts a repeated proof at capacity but rejects a new one before mutation', async () => {
  // Small verifier outputs isolate the archive boundary without 129 physics replays.
  const db = managedIndexedDB();
  const verify = async (_courses, value) => ({
    hash: value.n.toString(16).padStart(64, '0'),
    proof: { n: value.n },
    record: { attemptId: `attempt-${value.n}` },
    summary: {},
  });
  const store = createFlightAttemptStore({ courses: [], indexedDB: db.indexedDB, verify });
  await store.load();
  for (let n = 0; n < 128; n++) await store.accept({ n });
  const before = store.export();
  await assert.rejects(store.accept({ n: 128 }), /capacity/);
  assert.deepEqual(store.export(), before);
  assert.equal(store.records().length, 128);
  assert.equal((await store.accept({ n: 0 })).saved, true);
  assert.equal(store.status().saved, true);
  await store.close();
});

test('explicit retry revalidates a temporarily unreadable index and persists session-only verified work', async () => {
  const db = managedIndexedDB();
  let blocked = true;
  const indexedDB = {
    open(...args) {
      if (blocked) throw new DOMException('Temporarily unavailable', 'UnknownError');
      return db.indexedDB.open(...args);
    },
  };
  const store = createFlightAttemptStore({ courses: FLIGHT_COURSES, indexedDB });
  await store.load();
  assert.equal(store.status().unavailable, true);
  assert.equal((await store.accept(proof())).saved, false);
  blocked = false;
  await store.retry();
  assert.equal(store.status().saved, true);
  assert.equal(store.status().unavailable, false);
  assert.equal(store.status().error, null);
  assert.equal(store.durableRecords().length, 1);
  await store.close();
});

test('missing exact proof keeps a recovery warning while its previously earned discovery is preserved', async () => {
  const db = managedIndexedDB();
  const first = createFlightNotebook({ courses: FLIGHT_COURSES, indexedDB: db.indexedDB });
  await first.ready;
  const accepted = await first.accept(proof());
  await first.close();
  const removed = createProfileRecordBackend({
    key: 'practice-civilian-fpv:' + accepted.hash,
    indexedDB: db.indexedDB,
    empty: () => null,
    validate: (value) => value,
  });
  await removed.update(() => null);
  removed.close();
  const restored = createFlightNotebook({ courses: FLIGHT_COURSES, indexedDB: db.indexedDB });
  await restored.ready;
  assert.equal(restored.snapshot().storage.saved, false);
  assert.match(restored.snapshot().storage.error, /missing/);
  assert.equal(restored.snapshot().rewards.receipts.length, 1);
  await restored.accept(proof(2));
  assert.equal(
    restored.snapshot().storage.saved,
    false,
    'A new successful save cannot hide the missing old proof.',
  );
  assert.match(restored.snapshot().storage.error, /missing/);
  await restored.retry();
  assert.equal(restored.snapshot().storage.saved, false);
  assert.equal(restored.snapshot().rewards.receipts.length, 2);
  await restored.close();
});

test('notebook close cancels initial hydration before ready and rejects queued or later evidence work', async () => {
  const indexedDB = { open: () => ({}) };
  const book = createFlightNotebook({ courses: FLIGHT_COURSES, indexedDB });
  const ready = assert.rejects(book.ready, { name: 'AbortError' });
  const accepting = assert.rejects(book.accept(proof()), { name: 'AbortError' });
  const importing = assert.rejects(
    book.import({ format: 'FlightProofBackup.v1', packageId: 'civilian-fpv', attempts: [proof()] }),
    { name: 'AbortError' },
  );
  await Promise.resolve();
  let timeout;
  try {
    await Promise.race([
      book.close(),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Notebook close waited for initial hydration')),
          250,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
  await Promise.all([ready, accepting, importing]);
  assert.equal(book.snapshot().attempts.length, 0);
  assert.equal(book.snapshot().rewards.receipts.length, 0);
  await assert.rejects(book.accept(proof()), { name: 'AbortError' });
  await assert.rejects(book.import({}), { name: 'AbortError' });
  await assert.rejects(book.retry(), { name: 'AbortError' });
  await book.close();
});

test('notebook forwards explicit import cancellation without a receipt or proof write', async () => {
  const db = managedIndexedDB(),
    book = createFlightNotebook({ courses: FLIGHT_COURSES, indexedDB: db.indexedDB });
  await book.ready;
  const before = book.snapshot(),
    controller = new AbortController(),
    writes = db.allPuts.length;
  const pending = book.import(
    { format: 'FlightProofBackup.v1', packageId: 'civilian-fpv', attempts: [proof(), proof(2)] },
    { signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual(book.snapshot().attempts, before.attempts);
  assert.deepEqual(book.snapshot().rewards, before.rewards);
  assert.equal(db.allPuts.length, writes);
  await book.accept(proof());
  assert.equal(book.snapshot().rewards.receipts.length, 1);
  await book.close();
});
