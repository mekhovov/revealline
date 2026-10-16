import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dataIdentity } from '../data-json.mjs';
import {
  SIM_APPEARANCE_KEY,
  academyRecording,
  createSimAppearancePreferences,
  createSimAppearanceSession,
  playableSimAppearance,
  readAcademyRecording,
  resolveSimAppearance,
  resolveSimThemeProfile,
  snapshotSimThemeProfile,
  recordedSimAppearance,
  validateThemeProfile,
} from '../../optional-practice/civilian-fpv/world-themes.mjs';
import { createFlightAttemptStore } from '../../optional-practice/civilian-fpv/attempts.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';
import { WORLD_CATALOGUE } from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  replayWorldFlight,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import {
  exportProofParts,
  importProofPart,
  openWorldRecords,
  worldRecordIdentity,
} from '../../optional-practice/civilian-fpv/world-records.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const authored = { collectionId: 'authored', revision: 'r1' };
const industrial = { collectionId: 'industrial-workshop', revision: 'r1', drone: 'utility' };
const proof = () => ({ ...structuredClone(FLIGHT_DEMONSTRATIONS[0]), session: 'practice' });
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('SIM preferences preserve existing authored choices, new installs follow game, and missing collections retain intent', () => {
  const fresh = createSimAppearancePreferences({ storage: memoryStorage() });
  assert.equal(fresh.snapshot().world, 'follow-game');
  assert.equal(fresh.adoptExisting(true), true);
  assert.equal(fresh.snapshot().world, 'authored');
  const explicit = createSimAppearancePreferences({ storage: memoryStorage() });
  explicit.set({ world: 'industrial-workshop' });
  assert.equal(explicit.adoptExisting(true), false);
  assert.equal(explicit.snapshot().world, 'industrial-workshop');
  const storage = memoryStorage({ 'revealline.fpv.world-settings.v1': '{}' });
  const existing = createSimAppearancePreferences({ storage });
  assert.equal(existing.snapshot().world, 'authored');
  existing.set({ world: 'not-installed', interface: 'industrial-workshop' });
  assert.equal(
    resolveSimAppearance({ choice: existing.snapshot().world }).fallbackReason,
    'collection-unavailable',
  );
  assert.equal(createSimAppearancePreferences({ storage }).snapshot().world, 'not-installed');
  assert.equal(JSON.parse(storage.getItem(SIM_APPEARANCE_KEY)).world, 'not-installed');
  assert.deepEqual(
    resolveSimAppearance({ choice: 'follow-game', familyId: 'industrial-workshop' }).appearance,
    { collectionId: 'industrial-workshop', revision: 'r1' },
  );
  assert.equal(
    resolveSimAppearance({ choice: 'follow-game', familyId: 'legacy' }).appearance.collectionId,
    'authored',
  );
});

test('first successful arm freezes accepted appearance until a new attempt, even after disarming', () => {
  const session = createSimAppearanceSession();
  session.begin(authored);
  session.arm('disarmed');
  assert.equal(session.select(industrial), true);
  session.arm('active');
  session.arm('disarmed');
  assert.equal(session.select(authored), false);
  assert.deepEqual(session.current(), industrial);
  assert.equal(session.pending(), true);
  session.begin(authored);
  assert.equal(session.pending(), false);
  assert.deepEqual(session.current(), authored);
  session.begin(industrial, { retained: true });
  assert.equal(session.select(authored), false);
});

test('recording metadata is bounded, portable and independent of Academy proof/reward identity', async () => {
  const db = managedIndexedDB();
  const store = createFlightAttemptStore({ courses: FLIGHT_COURSES, indexedDB: db.indexedDB });
  await store.load();
  const legacy = await store.accept(proof());
  const themed = await store.accept(academyRecording(proof(), industrial));
  assert.equal(themed.hash, legacy.hash);
  assert.deepEqual(themed.record, legacy.record);
  assert.equal(store.records().length, 1);
  assert.deepEqual(store.recording(themed.hash).presentation, industrial);
  const backup = store.export();
  assert.equal(backup.format, 'FlightProofBackup.v2');
  await store.close();
  const restored = createFlightAttemptStore({ courses: FLIGHT_COURSES, indexedDB: db.indexedDB });
  await restored.load();
  assert.deepEqual(restored.recording(themed.hash).presentation, industrial);
  assert.deepEqual(readAcademyRecording(restored.recording(themed.hash)).proof, proof());
  const invalid = structuredClone(backup);
  invalid.attempts[0].presentation.drone = 'script';
  await assert.rejects(restored.import(invalid), /drone appearance/);
  assert.equal(restored.records().length, 1);
  await restored.close();
  assert.equal(
    playableSimAppearance({ collectionId: 'future-theme', revision: 'r2' }).fallbackReason,
    'collection-unavailable',
  );
});

test('replacing cosmetic metadata owns queued inputs and retries a failed save of an existing proof', async () => {
  const db = managedIndexedDB();
  const store = createFlightAttemptStore({ courses: FLIGHT_COURSES, indexedDB: db.indexedDB });
  await store.load();
  const original = await store.accept(proof());
  assert.equal(original.saved, true);
  db.failAnyPutAt = 1;
  const incoming = proof();
  const presentation = structuredClone(industrial);
  const operation = store.accept(incoming, { presentation });
  incoming.session = 'demonstration';
  presentation.collectionId = 'changed-after-admission';
  const replacement = await operation;
  assert.equal(replacement.hash, original.hash);
  assert.equal(replacement.saved, false);
  assert.equal(store.status().saved, false);
  assert.deepEqual(store.recording(original.hash).presentation, industrial);
  await store.load();
  assert.equal(store.status().saved, false);
  assert.deepEqual(store.recording(original.hash).presentation, industrial);
  db.failAnyPutAt = null;
  await store.retry();
  assert.equal(store.status().saved, true);
  await store.close();
  const restored = createFlightAttemptStore({ courses: FLIGHT_COURSES, indexedDB: db.indexedDB });
  await restored.load();
  assert.deepEqual(restored.recording(original.hash).presentation, industrial);
  await restored.close();
});

test('World snapshots preserve gameplay identities while their existing record IDs distinguish appearance', async () => {
  await initWorldRuntime();
  const course = WORLD_CATALOGUE.find((entry) => !entry.legacy).course;
  const themeProfile = resolveSimThemeProfile(course, industrial);
  const themed = { ...course, world: { ...course.world, themeProfile, theme: themeProfile.id } };
  const before = createWorldFlight({ course });
  const after = createWorldFlight({ course: themed });
  try {
    assert.deepEqual(after.identity, before.identity);
    assert.notEqual(
      dataIdentity({ course, proof: {} }),
      dataIdentity({ course: themed, proof: {} }),
    );
  } finally {
    before.dispose();
    after.dispose();
  }
});

test('World pinned profile owns one bounded authored fallback while legacy profiles keep exact appearance', () => {
  const course = WORLD_CATALOGUE.find((entry) => !entry.legacy).course;
  const profile = resolveSimThemeProfile(course);
  profile.palette.wall = 0x123456;
  profile.drone = 'pixel';
  profile.revision = 'authored-custom-revision';
  const original = {
    ...course,
    world: { ...course.world, theme: profile.id, themeProfile: profile },
  };
  assert.deepEqual(resolveSimThemeProfile(original), profile);
  assert.deepEqual(recordedSimAppearance(original), { ...authored, drone: 'pixel' });
  const pinned = snapshotSimThemeProfile(original, industrial);
  assert.equal(pinned.format, 'ThemeProfile.v2');
  assert.deepEqual(pinned.authoredFallback, profile);
  assert.deepEqual(validateThemeProfile(JSON.stringify(pinned)), pinned);
  const selected = {
    ...course,
    world: { ...course.world, theme: pinned.id, themeProfile: pinned },
  };
  assert.deepEqual(snapshotSimThemeProfile(selected, industrial).authoredFallback, profile);
  assert.deepEqual(resolveSimThemeProfile(selected, industrial), pinned);
  const unavailable = structuredClone(selected);
  unavailable.world.themeProfile.revision = 'r2';
  assert.deepEqual(resolveSimThemeProfile(unavailable), profile);
  assert.equal(unavailable.world.themeProfile.revision, 'r2');
  for (const mutate of [
    (value) => {
      value.authoredFallback = structuredClone(pinned);
    },
    (value) => {
      value.authoredFallback.authoredFallback = structuredClone(profile);
    },
    (value) => {
      value.authoredFallback.palette.wall = -1;
    },
    (value) => {
      value.extra = 'unsupported';
    },
    (value) => {
      value.authoredFallback.title.en = 'x'.repeat(65536);
    },
  ]) {
    const invalid = structuredClone(pinned);
    mutate(invalid);
    assert.throws(() => validateThemeProfile(invalid));
  }
});

test('World archive keeps legacy records and round-trips Academy appearance with separate record IDs', async () => {
  const requireAuthoring = createRequire(
    new URL('../../authoring/fpv-worlds/package.json', import.meta.url),
  );
  const { IDBFactory } = requireAuthoring('fake-indexeddb');
  const store = await openWorldRecords(new IDBFactory());
  try {
    const course = FLIGHT_COURSES[0];
    const legacy = await store.put({ course, proof: proof() });
    const themed = await store.put({ course, proof: proof(), presentation: industrial });
    assert.notEqual(themed.id, legacy.id);
    assert.equal((await store.list()).length, 2);
    assert.equal((await exportProofParts([legacy]))[0].format, 'FPVProofArchive.v2');
    const archive = (await exportProofParts([legacy, themed]))[0];
    assert.equal(archive.format, 'FPVProofArchive.v3');
    const restored = await importProofPart(archive);
    assert.deepEqual(restored[1].presentation, industrial);
    assert.equal(restored[0].id, legacy.id);
  } finally {
    store.close();
  }
});

test('World archive preserves the versioned profile fallback inside its unchanged course/proof record', async () => {
  await initWorldRuntime();
  const requireAuthoring = createRequire(
    new URL('../../authoring/fpv-worlds/package.json', import.meta.url),
  );
  const { IDBFactory } = requireAuthoring('fake-indexeddb');
  const store = await openWorldRecords(new IDBFactory());
  const original = WORLD_CATALOGUE.find((entry) => !entry.legacy).course;
  const themeProfile = snapshotSimThemeProfile(original, industrial);
  const course = {
    ...original,
    world: { ...original.world, theme: themeProfile.id, themeProfile },
  };
  const flight = createWorldFlight({ course });
  try {
    const recorder = createWorldRecorder(flight);
    flight.arm();
    flight.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 });
    recorder.record();
    const proof = recorder.export();
    const saved = await store.put({ course, proof });
    assert.equal(saved.id, worldRecordIdentity({ course, proof }));
    const archive = (await exportProofParts([saved]))[0];
    assert.equal(archive.format, 'FPVProofArchive.v2');
    const [restored] = await importProofPart(archive);
    assert.deepEqual(restored.course, course);
    assert.deepEqual(restored.proof, proof);
    assert.equal(restored.id, saved.id);
    assert.equal(restored.presentation, undefined);
    const replayed = await replayWorldFlight(restored.course, restored.proof);
    assert.equal(replayed.state.ticks, 1);
  } finally {
    flight.dispose();
    store.close();
  }
});
