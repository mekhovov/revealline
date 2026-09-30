import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';
import {
  replayFlight,
  replayFlightCooperatively,
} from '../../optional-practice/civilian-fpv/model.mjs';
import {
  createFlightAttemptStore,
  verifyFlightAttempt,
} from '../../optional-practice/civilian-fpv/attempts.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const practice = (index = 0) => ({
  ...structuredClone(FLIGHT_DEMONSTRATIONS[index]),
  session: 'practice',
});
const backup = (attempts) => ({
  format: 'FlightProofBackup.v1',
  packageId: 'civilian-fpv',
  attempts,
});

test('cooperative replay matches every complete synchronous state and sampled path for all24 demonstrations', async () => {
  for (const proof of FLIGHT_DEMONSTRATIONS) {
    const course = FLIGHT_COURSES.find((item) => item.id === proof.course);
    let yields = 0;
    const result = await replayFlightCooperatively(course, proof, {
      sampleEvery: 7,
      yieldControl: async () => {
        yields++;
      },
    });
    assert.deepEqual(result, replayFlight(course, proof, { sampleEvery: 7 }));
    assert.equal(yields, Math.ceil(proof.frames.length / 200));
  }
});

test('cooperative replay owns its inspected input and stops before the next200-tick batch after cancellation', async () => {
  const proof = practice(),
    controller = new AbortController();
  const expected = replayFlight(FLIGHT_COURSES[0], proof);
  let yields = 0;
  const owned = await replayFlightCooperatively(FLIGHT_COURSES[0], proof, {
    yieldControl: async () => {
      if (++yields === 1) proof.frames[0][3] = -1;
    },
  });
  assert.deepEqual(owned, expected);
  yields = 0;
  await assert.rejects(
    replayFlightCooperatively(FLIGHT_COURSES[0], practice(), {
      signal: controller.signal,
      yieldControl: async () => {
        if (++yields === 2) controller.abort();
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(yields, 2);
  await assert.rejects(
    replayFlightCooperatively(FLIGHT_COURSES[0], practice(), {
      signal: controller.signal,
      yieldControl: async () => {
        throw new Error('Must not yield');
      },
    }),
    { name: 'AbortError' },
  );
});

test('aborting transfer verification after an earlier valid proof grants and writes nothing, then allows a fresh import', async () => {
  const db = managedIndexedDB(),
    controller = new AbortController();
  let yields = 0;
  const store = createFlightAttemptStore({
    courses: FLIGHT_COURSES,
    indexedDB: db.indexedDB,
    verify: (courses, proof, { signal }) =>
      verifyFlightAttempt(courses, proof, {
        signal,
        yieldControl: async () => {
          if (++yields === 3) controller.abort();
        },
      }),
  });
  await store.load();
  await assert.rejects(
    store.import(backup([practice(), practice(2)]), { signal: controller.signal }),
    { name: 'AbortError' },
  );
  assert.equal(store.records().length, 0);
  assert.equal(store.export().attempts.length, 0);
  assert.deepEqual(db.allPuts, []);
  await store.import(backup([practice()]));
  assert.equal(store.records().length, 1);
  assert.equal(store.status().saved, true);
  await store.close();
});

test('closing cancels active and queued verification immediately and a late verifier cannot mutate memory or disk', async () => {
  const db = managedIndexedDB(),
    checked = await verifyFlightAttempt(FLIGHT_COURSES, practice());
  let release, started;
  const entered = new Promise((resolve) => {
    started = resolve;
  });
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const store = createFlightAttemptStore({
    courses: FLIGHT_COURSES,
    indexedDB: db.indexedDB,
    verify: async () => {
      started();
      await blocked;
      return checked;
    },
  });
  await store.load();
  const active = assert.rejects(store.accept(practice()), { name: 'AbortError' }),
    queued = assert.rejects(store.import(backup([practice()])), { name: 'AbortError' });
  await entered;
  let timer;
  try {
    await Promise.race([
      store.close(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Close waited for verifier')), 250);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  await Promise.all([active, queued]);
  release();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(db.allPuts, []);
  assert.equal(store.records().length, 0);
  await assert.rejects(store.accept(practice()), { name: 'AbortError' });
});

test('cancellation reaches the owned IndexedDB write transaction before an attempt can be durable', async () => {
  const db = managedIndexedDB(),
    controller = new AbortController(),
    store = createFlightAttemptStore({ courses: FLIGHT_COURSES, indexedDB: db.indexedDB });
  await store.load();
  db.onAnyPut = () => controller.abort();
  await assert.rejects(store.accept(practice(), { signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.equal(store.durableRecords().length, 0);
  db.onAnyPut = null;
  await store.close();
  const restored = createFlightAttemptStore({ courses: FLIGHT_COURSES, indexedDB: db.indexedDB });
  await restored.load();
  assert.equal(restored.records().length, 0);
  await restored.close();
});
