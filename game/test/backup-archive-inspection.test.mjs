import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareBackupArchive, createBackupZip } from '../backup-archive.mjs';
import { inspectBackupArchive } from '../backup-archive-inspection.mjs';
import { backupSetFixture } from './helpers/backup-set-fixture.mjs';

async function archive() {
  const fixture = await backupSetFixture();
  return (await prepareBackupArchive(fixture.source)).files[0].blob;
}
async function members(blob) {
  const bytes = Buffer.from(await blob.arrayBuffer()),
    files = [];
  let at = 0;
  while (bytes.readUInt32LE(at) === 0x04034b50) {
    const size = bytes.readUInt32LE(at + 18),
      length = bytes.readUInt16LE(at + 26),
      start = at + 30 + length;
    files.push({
      filename: bytes.subarray(at + 30, start).toString(),
      blob: new Blob([bytes.subarray(start, start + size)]),
      bytes: size,
    });
    at = start + size;
  }
  return files;
}
async function changedManifest(blob, change) {
  const files = await members(blob),
    row = files[0],
    manifest = JSON.parse(await row.blob.text());
  change(manifest, files);
  row.blob = new Blob([JSON.stringify(manifest)]);
  row.bytes = row.blob.size;
  return createBackupZip(files);
}

test('inspection extracts exact native component bytes and actual scope without reading a whole ZIP buffer', async () => {
  const blob = await archive(),
    original = await members(blob),
    progress = [];
  blob.arrayBuffer = () => {
    throw new Error('No whole ZIP allocation');
  };
  const result = await inspectBackupArchive(blob, { onProgress: (value) => progress.push(value) });
  assert.equal(result.manifest.gameData, 'included');
  assert.equal(result.manifest.journey, 'not-included');
  assert.deepEqual(
    result.files.map((file) => file.id),
    ['game', 'media', 'story', 'audio', 'coverage'],
  );
  for (const file of result.files)
    assert.deepEqual(
      await file.blob.arrayBuffer(),
      await original.find((row) => row.filename === file.filename).blob.arrayBuffer(),
    );
  assert.deepEqual(
    result.instructions.map((file) => file.filename),
    ['archive-manifest.json', 'README.txt'],
  );
  assert.deepEqual(progress.at(-1), { completed: 7, total: 7, unit: 'files' });
});

test('authored and partial Journey archives retain their exclusions and never acquire invented game-data files', async () => {
  const f = await backupSetFixture();
  f.source.archiveProfile = { kind: 'authored-journey', identity: f.source.gameIdentity };
  f.source.journey = {
    identity: () => 1,
    read: async () => ({ raw: '{"profile":"retained"}', partial: true }),
  };
  const blob = (await prepareBackupArchive(f.source)).files[0].blob,
    result = await inspectBackupArchive(blob);
  assert.equal(result.manifest.gameData, 'excluded-authored');
  assert.equal(result.manifest.journey, 'available-evidence-only');
  assert.ok(!result.files.some((file) => file.id === 'game'));
  assert.ok(result.manifest.exclusions.some((value) => /unfinished authored flight/.test(value)));
  assert.equal(
    await result.files.find((file) => file.id === 'journey').blob.text(),
    '{"profile":"retained"}',
  );
});

test('early v1 game archives remain readable when the explicit gameData scope field is absent', async () => {
  const result = await inspectBackupArchive(
    await changedManifest(await archive(), (manifest) => {
      delete manifest.gameData;
    }),
  );
  assert.equal(result.manifest.gameData, 'included');
});

test('CRC damage and a valid-CRC archive with a false SHA-256 are both rejected before extraction', async () => {
  const blob = await archive(),
    bytes = Buffer.from(await blob.arrayBuffer());
  let component = 0;
  for (let i = 0; i < 2; i++)
    component += 30 + bytes.readUInt16LE(component + 26) + bytes.readUInt32LE(component + 18);
  bytes[component + 30 + bytes.readUInt16LE(component + 26)] ^= 1;
  await assert.rejects(
    inspectBackupArchive(new Blob([bytes])),
    (error) => error.archiveCode === 'integrity',
  );
  const wrongHash = await changedManifest(blob, (manifest) => {
    manifest.files[0].sha256 = '0'.repeat(64);
  });
  await assert.rejects(
    inspectBackupArchive(wrongHash),
    (error) => error.archiveCode === 'integrity',
  );
});

for (const kind of ['scope', 'journey', 'coverage', 'omitted', 'extra', 'extension', 'metadata'])
  test(`manifest ${kind} inconsistency is rejected without presenting files`, async () => {
    const blob = await changedManifest(await archive(), (manifest, files) => {
      if (kind === 'scope') manifest.gameData = 'excluded-authored';
      if (kind === 'journey') manifest.journey = 'included';
      if (kind === 'coverage') manifest.coverageReport = 'missing.json';
      if (kind === 'omitted') manifest.files.pop();
      if (kind === 'extra')
        files.push({ filename: 'unexpected.exe', blob: new Blob(['x']), bytes: 1 });
      if (kind === 'extension') manifest.files[0].filename = 'unexpected.exe';
      if (kind === 'metadata') manifest.scope = 'x'.repeat(1025);
    });
    await assert.rejects(inspectBackupArchive(blob), (error) => error.archiveCode === 'manifest');
  });

test('unsupported compression, encryption, directory overlap and trailing data are rejected', async () => {
  const original = Buffer.from(await (await archive()).arrayBuffer()),
    end = original.length - 22,
    central = original.readUInt32LE(end + 16);
  for (const kind of ['compression', 'encryption', 'overlap', 'trailing']) {
    const bytes = Buffer.from(original);
    if (kind === 'compression') {
      bytes.writeUInt16LE(8, 8);
      bytes.writeUInt16LE(8, central + 10);
    }
    if (kind === 'encryption') {
      bytes.writeUInt16LE(1, 6);
      bytes.writeUInt16LE(1, central + 8);
    }
    if (kind === 'overlap') bytes.writeUInt32LE(1, central + 42);
    const blob = kind === 'trailing' ? new Blob([bytes, 'hidden']) : new Blob([bytes]);
    await assert.rejects(inspectBackupArchive(blob), (error) =>
      ['unsupported', 'structure'].includes(error.archiveCode),
    );
  }
});

test('unsafe extraction names and case-insensitive collisions are rejected', async () => {
  const files = ['one', 'TWO', 'two'].map((filename) => ({
    filename,
    blob: new Blob(['x']),
    bytes: 1,
  }));
  await assert.rejects(
    inspectBackupArchive(await createBackupZip(files)),
    (error) => error.archiveCode === 'structure',
  );
  files[2].filename = 'end';
  const bytes = Buffer.from(await (await createBackupZip(files)).arrayBuffer()),
    central = bytes.readUInt32LE(bytes.length - 6);
  bytes.write('../', 30);
  bytes.write('../', central + 46);
  await assert.rejects(
    inspectBackupArchive(new Blob([bytes])),
    (error) => error.archiveCode === 'structure',
  );
});

test('size admission precedes all body reads and cancellation never returns a partial inspection', async () => {
  const blob = await archive(),
    slice = blob.slice.bind(blob);
  let reads = 0;
  blob.slice = (...args) => {
    reads++;
    return slice(...args);
  };
  await assert.rejects(
    inspectBackupArchive(blob, { maxBytes: 22 }),
    (error) => error.archiveCode === 'size',
  );
  assert.equal(reads, 0);
  const controller = new AbortController();
  await assert.rejects(
    inspectBackupArchive(blob, { signal: controller.signal, onProgress: () => controller.abort() }),
    { name: 'AbortError' },
  );
});
