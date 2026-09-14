import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileSharedMediaReader } from '../profile-shared-media.mjs';
import { recoveryMediaFixture } from './helpers/recovery-media-idb.mjs';

const sha = 'a'.repeat(64);
const generic = {
  generation: 2,
  library: { format: 'revealline-managed-bytes.v1', items: [{ id: 'retained', sha256: sha }] },
};
const rows = () => ({
  mediaRecords: [['library', generic]],
  mediaBlobs: [[sha, new Blob(['small'])]],
  managedState: [
    ['ledger', { format: 'revealline-managed-state.v1', revision: 3, usedBytes: 5000 }],
  ],
});
for (const version of [2, 3, 4])
  test(`existing schema${version} snapshot owns immutable Blob handles without body reads or writes`, async (t) => {
    const f = await recoveryMediaFixture(rows(), { version });
    const reader = createProfileSharedMediaReader(f);
    t.after(() => reader.close());
    const got = await reader.snapshot();
    assert.equal(got.value.marker.version, version);
    assert.equal(got.value.marker.ledger.revision, 3);
    assert.equal(got.value.marker.media.generation, 2);
    assert.equal(got.value.files[0].bytes, 5);
    assert.equal(got.value.originalBytesVerified, false);
    assert(Object.isFrozen(got.value.files));
    assert(Object.isFrozen(got.value.marker.media));
    assert.equal(await got.value.files[0].blob.text(), 'small');
    assert.deepEqual(f.model.contents(), f.before);
    assert.deepEqual(f.model.allPuts, []);
    assert(f.opens.every((o) => o.requestedVersion === undefined));
    assert(f.reads.filter((r) => r[1].startsWith('getAll')).every((r) => Number.isInteger(r[3])));
  });
test('absent database aborts creation; unknown version or extra store refuses unchanged', async () => {
  for (const options of [
    { absent: true },
    { version: 5 },
    { version: 3, extraStore: 'futureClaims' },
  ]) {
    const f = await recoveryMediaFixture({}, options),
      reader = createProfileSharedMediaReader(f);
    if (options.absent) assert.deepEqual(await reader.snapshot(), { state: 'absent' });
    else await assert.rejects(reader.snapshot(), /unsupported/);
    assert.deepEqual(f.model.contents(), f.before);
    assert.deepEqual(f.model.allPuts, []);
    reader.close();
  }
});
test('absent metadata is distinct from present null, undefined, future ledger and pending reservation', async () => {
  for (const value of [null, undefined, { generation: 0, library: { format: 'residency.v2' } }]) {
    const f = await recoveryMediaFixture({ mediaRecords: [['library', value]] }),
      reader = createProfileSharedMediaReader(f);
    await assert.rejects(reader.snapshot());
    assert.deepEqual(f.model.contents(), f.before);
    reader.close();
  }
  for (const values of [
    { managedState: [['ledger', { format: 'future', revision: 0, usedBytes: 0 }]] },
    { reservations: [['pending', null]] },
    { metadata: [['unknown', null]] },
  ]) {
    const f = await recoveryMediaFixture(values),
      reader = createProfileSharedMediaReader(f);
    await assert.rejects(reader.snapshot(), /ledger|reservations|metadata keys/);
    assert.deepEqual(f.model.allPuts, []);
    reader.close();
  }
});
test('missing referenced body, duplicate physical hash and key overflow refuse boundedly', async () => {
  for (const data of [
    { mediaRecords: [['library', generic]] },
    { ...rows(), audio: [[sha, new Blob(['small'])]] },
    {
      mediaBlobs: Array.from({ length: 513 }, (_, i) => [
        i.toString(16).padStart(64, '0'),
        new Blob(['x']),
      ]),
    },
  ]) {
    const f = await recoveryMediaFixture(data),
      reader = createProfileSharedMediaReader(f);
    await assert.rejects(reader.snapshot(), /absent|duplicate|Too many/);
    assert.deepEqual(f.model.allPuts, []);
    reader.close();
  }
});
test('cancellation during late open and versionchange releases connections without stale success', async () => {
  const f = await recoveryMediaFixture(),
    reader = createProfileSharedMediaReader(f);
  f.controls.holdSuccess = true;
  const operation = reader.snapshot(),
    rejected = assert.rejects(operation, { name: 'AbortError' });
  await new Promise((r) => setTimeout(r, 0));
  const before = f.model.closed;
  reader.close();
  await rejected;
  f.controls.release();
  assert.equal(f.model.closed, before + 1);
  assert.deepEqual(f.reads, []);
  const g = await recoveryMediaFixture(),
    other = createProfileSharedMediaReader(g);
  g.controls.onRead = () => g.controls.versionchange();
  await assert.rejects(other.snapshot());
  other.close();
  assert.deepEqual(g.model.allPuts, []);
});
test('close after absent open resolution cannot publish stale absence', async () => {
  const f = await recoveryMediaFixture({}, { absent: true }),
    reader = createProfileSharedMediaReader(f);
  f.controls.beforeError = () => queueMicrotask(() => reader.close());
  await assert.rejects(reader.snapshot(), /closed/);
  assert.deepEqual(f.model.contents(), new Map());
});

test('selected availability is diagnostic while the existing full snapshot stays strict', async () => {
  const f = await recoveryMediaFixture({ mediaRecords: [['library', generic]] }),
    reader = createProfileSharedMediaReader(f);
  const selected = await reader.originalSnapshot();
  assert.deepEqual(selected.value.diagnostics, [{ sha256: sha, availability: 'missing' }]);
  assert.equal(selected.value.originalBytesVerified, false);
  assert(Object.isFrozen(selected.value.diagnostics));
  assert.equal(selected.value.marker.media.generation, 2);
  await assert.rejects(reader.snapshot(), /absent/);
  assert.deepEqual(f.model.allPuts, []);
  assert.deepEqual(f.model.contents(), f.before);
  reader.close();
});
test('selected availability keeps schema, pending-work, physical-handle and budget refusals', async () => {
  for (const [data, options] of [
    [{}, { version: 5 }],
    [{ mediaRecords: [['library', undefined]] }, {}],
    [{ reservations: [['pending', null]] }, {}],
    [{ ...rows(), audio: [[sha, new Blob(['small'])]] }, {}],
    [{ mediaBlobs: [[sha, { size: 5 }]] }, {}],
    [
      {
        mediaBlobs: Array.from({ length: 513 }, (_, i) => [
          i.toString(16).padStart(64, '0'),
          new Blob(['x']),
        ]),
      },
      {},
    ],
  ]) {
    const f = await recoveryMediaFixture(data, options),
      reader = createProfileSharedMediaReader(f);
    await assert.rejects(reader.originalSnapshot());
    assert.deepEqual(f.model.allPuts, []);
    assert.deepEqual(f.model.contents(), f.before);
    reader.close();
  }
});
test('selected availability aborts missing database creation and closes late reads', async () => {
  const f = await recoveryMediaFixture({}, { absent: true }),
    reader = createProfileSharedMediaReader(f);
  assert.deepEqual(await reader.originalSnapshot(), { state: 'absent' });
  assert.deepEqual(f.model.contents(), new Map());
  reader.close();
  const g = await recoveryMediaFixture(rows()),
    other = createProfileSharedMediaReader(g);
  g.controls.onRead = () => g.controls.versionchange();
  await assert.rejects(other.originalSnapshot());
  assert.deepEqual(g.model.allPuts, []);
  other.close();
});
