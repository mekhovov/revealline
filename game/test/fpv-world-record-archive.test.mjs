import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJSON, dataIdentity } from '../data-json.mjs';
import {
  ACADEMY_IDENTITY,
  BEGINNER_CATALOGUE,
} from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { WORLD_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/world-demonstrations.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';
import {
  replayWorldFlight,
  validateWorldCourse,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import {
  WORLD_RECORD_LIMITS,
  exportProofParts,
  importProofPart,
  partitionProofArchive,
  readProofArchive,
  worldRecordIdentity,
} from '../../optional-practice/civilian-fpv/world-records.mjs';

const published = WORLD_DEMONSTRATIONS.find(
  ({ proof }) => proof.course === 'beginner-01' && proof.mode === 'self-level',
);
const entry = BEGINNER_CATALOGUE.find(({ id }) => id === published.proof.course);
function envelope(course, proof, extra = {}) {
  const record = {
    course: structuredClone(course),
    proof: structuredClone(proof),
    status: 'verified',
    diagnostic: 'complete',
    packIdentity: entry.packIdentity,
    savedAt: 1000,
    ...extra,
  };
  record.id = worldRecordIdentity(record);
  record.byteLength = Buffer.byteLength(JSON.stringify(record)) + 64;
  return record;
}
const genuine = () => envelope(entry.course, published.proof);
// These are opaque archive-boundary data, not flight proofs or claimed progress.
const opaque = (id = 0, extra = {}) => envelope({ id: `raw-${id}` }, { raw: id }, extra);
const legacyArchive = (records, extra = {}) => ({
  format: 'FPVProofArchive.v1',
  part: 1,
  parts: 1,
  records,
  ...extra,
});

test('checksummed export/import keeps a genuine published demonstration but never trusts verification', async () => {
  const before = genuine();
  assert.equal(dataIdentity(validateWorldCourse(entry.course)), published.sourceIdentity);
  assert.equal(before.proof.session, 'demonstration');
  const parts = await exportProofParts([before]);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].format, 'FPVProofArchive.v2');
  const [restored] = await importProofPart(JSON.stringify(parts[0]));
  assert.deepEqual(restored, { ...before, status: 'missing-dependency' });
  assert.deepEqual(before, genuine());
  assert.deepEqual(await exportProofParts([before]), parts);
  const result = await replayWorldFlight(entry.course, restored.proof);
  assert.equal(result.state.status, 'complete');
  assert.equal(result.state.ticks, published.proof.frames.length);
});

test('legacy v1 and current archives preserve unavailable/invalid raw records without importing trust', async () => {
  const records = ['verified', 'invalid', 'missing-dependency'].map((status, i) =>
    opaque(i, {
      status,
      diagnostic: `Retained diagnostic ${i}`,
      pinned: i === 1,
    }),
  );
  const expected = records.map((record) => ({
    ...record,
    status: 'missing-dependency',
  }));
  assert.deepEqual(readProofArchive(JSON.stringify(legacyArchive(records))), expected);
  assert.deepEqual(await importProofPart(legacyArchive(records)), expected);
  const [part] = await exportProofParts(records);
  assert.deepEqual(await importProofPart(part), expected);
  assert.deepEqual(part.records, records);
});

test('v3 retains a genuine legacy proof appearance and includes it in the recording identity', async () => {
  const course = FLIGHT_COURSES.find(({ id }) => id === FLIGHT_DEMONSTRATIONS[0].course);
  assert.ok(course);
  const record = envelope(course, FLIGHT_DEMONSTRATIONS[0], {
    packIdentity: ACADEMY_IDENTITY,
    presentation: { collectionId: 'authored', revision: 'r1', drone: 'racer' },
  });
  const [part] = await exportProofParts([record]);
  assert.equal(part.format, 'FPVProofArchive.v3');
  assert.deepEqual((await importProofPart(part))[0], {
    ...record,
    status: 'missing-dependency',
  });
  assert.notEqual(
    worldRecordIdentity(record),
    worldRecordIdentity({
      ...record,
      presentation: { ...record.presentation, drone: 'utility' },
    }),
  );
  assert.throws(
    () => partitionProofArchive([{ ...genuine(), presentation: record.presentation }]),
    /appearance belongs in its course/i,
  );
});

test('transport checksum and recording identity each reject tampering independently', async () => {
  const [part] = await exportProofParts([genuine()]);
  const transportChange = structuredClone(part);
  transportChange.records[0].diagnostic = 'Different metadata';
  await assert.rejects(importProofPart(transportChange), /checksum/i);
  const identityChange = genuine();
  identityChange.course.revision = 'wrong-revision';
  assert.throws(() => partitionProofArchive([identityChange]), /identity does not match/i);
  // A new, self-consistent archive is still not replay authority for another course.
  identityChange.id = worldRecordIdentity(identityChange);
  const [repacked] = await exportProofParts([identityChange]);
  const [unverified] = await importProofPart(repacked);
  assert.equal(unverified.status, 'missing-dependency');
  await assert.rejects(replayWorldFlight(unverified.course, unverified.proof), /exact world/i);
});

test('empty and multipart archives preserve order, duplicates and independent part import', async () => {
  const [empty] = await exportProofParts([]);
  assert.deepEqual(await importProofPart(empty), []);
  const records = Array.from({ length: WORLD_RECORD_LIMITS.archiveRecords + 1 }, (_, i) =>
    opaque(i),
  );
  records[records.length - 1] = structuredClone(records[0]);
  const parts = await exportProofParts(records);
  assert.equal(parts.length, 2);
  assert.equal(parts[0].records.length, WORLD_RECORD_LIMITS.archiveRecords);
  assert.equal(parts[1].records.length, 1);
  assert.equal(parts[0].archiveId, parts[1].archiveId);
  assert.deepEqual(await importProofPart(parts[1]), [
    { ...records.at(-1), status: 'missing-dependency' },
  ]);
  const restored = (await Promise.all(parts.map(importProofPart))).flat();
  assert.deepEqual(
    restored,
    records.map((record) => ({ ...record, status: 'missing-dependency' })),
  );
});

test('invalid archive format, part indices and excessive selections are rejected', async () => {
  for (const extra of [
    { format: 'FPVProofArchive.future' },
    { part: 0 },
    { part: 2 },
    { parts: 0 },
    { parts: 4097 },
    { part: 1.5 },
    { records: {} },
    { records: Array(WORLD_RECORD_LIMITS.archiveRecords + 1).fill(opaque()) },
    { surprise: true },
  ])
    await assert.rejects(importProofPart(legacyArchive([], extra)));
  assert.throws(() => partitionProofArchive(Array(4097).fill(opaque())), /selection is too large/);
  const [part] = await exportProofParts([opaque()]);
  await assert.rejects(importProofPart({ ...part, archiveId: 'not-a-hash' }), /identity/i);
});

test('malformed records cannot enter an otherwise well formed legacy archive', () => {
  for (const change of [
    { course: null },
    { proof: [] },
    { id: 'not-the-identity' },
    { status: 'accepted' },
    { diagnostic: 'x'.repeat(1001) },
    { packIdentity: 'x'.repeat(161) },
    { savedAt: -1 },
    { savedAt: 1.5 },
    { pinned: 'yes' },
    { extra: true },
  ])
    assert.throws(() => readProofArchive(legacyArchive([{ ...opaque(), ...change }])));
});

test('archive boundaries reject oversized files/records, deep data and getters without invoking them', async () => {
  await assert.rejects(
    importProofPart(' '.repeat(WORLD_RECORD_LIMITS.archiveBytes + 1)),
    /budget/i,
  );
  const record = opaque();
  record.proof = { raw: Array(2050).fill('x'.repeat(4096)) };
  assert.throws(() => partitionProofArchive([record]), /budget/i);
  const deep = opaque();
  deep.proof = Array.from({ length: 25 }).reduce((value) => ({ child: value }), null);
  assert.throws(() => readProofArchive(legacyArchive([deep])), /budget/i);
  let invoked = false;
  const getter = opaque();
  Object.defineProperty(getter.course, 'surprise', {
    enumerable: true,
    get() {
      invoked = true;
      throw new Error('Must not run user accessors');
    },
  });
  assert.throws(() => partitionProofArchive([getter]), /accessors/i);
  assert.equal(invoked, false);
  assert.equal(canonicalJSON(genuine().proof), canonicalJSON(published.proof));
});
