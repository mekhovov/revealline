import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { measureReleaseZipCapacity } from './measure-release-zip-capacity.mjs';
import { createZip, prepareBuildProject } from './game-cli.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function fixture(entries) {
  const manifest = {
    version: '0.1.0',
    sourceRevision: 'a'.repeat(40),
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes.length, 0),
    files: entries.map(({ name, bytes }) => ({
      path: name,
      bytes: bytes.length,
      sha256: hash(bytes),
    })),
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
  return {
    entries: [...entries, { name: 'manifest.json', bytes: manifestBytes }],
    manifest,
    manifestBytes,
  };
}
function example() {
  const noise = Buffer.concat(
    Array.from({ length: 1024 }, (_, index) =>
      createHash('sha256').update(`bounded-noise-${index}`).digest(),
    ),
  );
  return fixture([
    {
      name: 'game/data.json',
      bytes: Buffer.from(JSON.stringify({ text: 'intact runtime content '.repeat(1000) })),
    },
    { name: 'authoring/original.bin', bytes: noise },
    { name: 'licenses/許可.txt', bytes: Buffer.from('Original license text'.repeat(100)) },
    { name: 'optional/external-chapters/retained/media.rlmedia', bytes: Buffer.alloc(4096, 37) },
    { name: 'empty', bytes: Buffer.alloc(0) },
  ]);
}

test('complete measurement preserves originals/licenses/external members and exact canonical stored layout', () => {
  const prepared = example();
  const before = prepared.entries.map(({ name, bytes }) => [name, hash(bytes)]);
  const progress = [];
  const report = measureReleaseZipCapacity(prepared, {
    onProgress: (value) => progress.push(value),
  });
  assert.equal(report.projections.allStoredBytes, createZip(prepared.entries).length);
  assert.equal(report.archiveMembers, 6);
  assert.equal(report.payloadMembers, 5);
  assert.equal(report.payloadBytes, prepared.manifest.totalBytes);
  assert.equal(
    report.payloadBytesIncludingManifest,
    prepared.manifest.totalBytes + prepared.manifestBytes.length,
  );
  assert.deepEqual(
    report.members.map((entry) => entry.path),
    prepared.entries.map((entry) => entry.name).sort(),
  );
  assert.deepEqual(
    prepared.entries.map(({ name, bytes }) => [name, hash(bytes)]),
    before,
  );
  assert.equal(
    report.members.find((entry) => entry.path === 'authoring/original.bin').selectedMethod,
    'stored',
  );
  assert.equal(
    report.members.find((entry) => entry.path === 'game/data.json').selectedMethod,
    'deflate',
  );
  assert.equal(report.members.find((entry) => entry.path === 'empty').selectedBytes, 0);
  assert.equal(report.projections.storedMembers + report.projections.deflatedMembers, 6);
  assert.equal(report.projections.chooseSmallerBytes < report.projections.allDeflatedBytes, true);
  assert.equal(report.projections.chooseSmallerBytes < report.projections.allStoredBytes, true);
  assert.deepEqual(report.verification, {
    manifestMatchedMembers: 6,
    exactRoundTripMembers: 6,
    repeatedCompressionMatchedMembers: 6,
    completeBuildRepetitions: 0,
  });
  assert.equal(report.publicEligible, false);
  assert.equal(report.promotable, false);
  assert.equal(report.archiveProduced, false);
  assert.equal(report.expandedSiteProduced, false);
  assert.equal(report.productionCompressionSupportVerified, false);
  assert.equal(progress.length, 6);
  assert.equal(progress.at(-1).selectedBytes, report.projections.chooseSmallerBytes);
});

test('reordering prepared entries leaves deterministic member measurements unchanged', () => {
  const prepared = example();
  const first = measureReleaseZipCapacity(prepared);
  prepared.entries.reverse();
  assert.deepEqual(measureReleaseZipCapacity(prepared), first);
});

test('normal preparation supplies every generated member without creating an archive or expanded site', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'release-zip-capacity-test-'));
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  await fs.mkdir(path.join(root, 'game'));
  await fs.writeFile(path.join(root, 'game/index.html'), '<main>Complete tiny fixture</main>');
  await fs.writeFile(path.join(root, 'game/license.txt'), 'Retained original license.');
  await fs.writeFile(
    path.join(root, 'game/build-config.json'),
    JSON.stringify({ version: '0.1.0', entry: 'game/index.html', include: ['game'] }),
  );
  const prepared = await prepareBuildProject({
    root,
    sourceRevision: 'b'.repeat(40),
    publicationProfile: null,
  });
  const report = measureReleaseZipCapacity(prepared);
  assert.equal(report.sourceRevision, 'b'.repeat(40));
  assert.equal(report.archiveMembers, prepared.manifest.files.length + 1);
  assert.equal(report.projections.allStoredBytes, createZip(prepared.entries).length);
  assert.ok(report.members.some((entry) => entry.path === 'game/build-info.json'));
  assert.ok(report.members.some((entry) => entry.path === 'game/license.txt'));
  assert.deepEqual(await fs.readdir(root), ['game']);
  assert.deepEqual((await fs.readdir(path.join(root, 'game'))).sort(), [
    'build-config.json',
    'index.html',
    'license.txt',
  ]);
});

test('incomplete, duplicate, extra and corrupt payloads never receive a capacity result', () => {
  for (const mutate of [
    (prepared) => prepared.entries.pop(),
    (prepared) => {
      prepared.entries[0] = prepared.entries[1];
    },
    (prepared) => {
      prepared.entries[0] = { name: 'unexpected', bytes: Buffer.from('extra') };
    },
    (prepared) => {
      prepared.entries[0].bytes = Buffer.from('corrupted');
    },
    (prepared) => {
      prepared.entries[0].bytes[0] ^= 1;
    },
    (prepared) => {
      prepared.entries.at(-1).bytes = Buffer.from('{}\n');
    },
    (prepared) => {
      prepared.manifestBytes = Buffer.from('{}\n');
    },
    (prepared) => {
      prepared.manifest.files[0].sha256 = '0'.repeat(64);
      prepared.manifestBytes = Buffer.from(`${JSON.stringify(prepared.manifest)}\n`);
      prepared.entries.at(-1).bytes = prepared.manifestBytes;
    },
  ]) {
    const prepared = example();
    mutate(prepared);
    assert.throws(() => measureReleaseZipCapacity(prepared), /differ|duplicate|canonical/);
  }
});

test('unsafe member names, ambiguous manifests and ZIP64 counts fail before compression', () => {
  for (const name of [
    '../escape',
    '/absolute',
    'a//b',
    'a/./b',
    'a\\b',
    'C:/member',
    'nul\0name',
    'x'.repeat(65536),
  ]) {
    const prepared = fixture([{ name, bytes: Buffer.from('unchanged') }]);
    assert.throws(() => measureReleaseZipCapacity(prepared), /Unsafe ZIP member/);
  }
  const duplicate = fixture([
    { name: 'same', bytes: Buffer.alloc(0) },
    { name: 'same', bytes: Buffer.alloc(0) },
  ]);
  assert.throws(() => measureReleaseZipCapacity(duplicate), /duplicate manifest/);
  const reserved = fixture([{ name: 'manifest.json', bytes: Buffer.alloc(0) }]);
  assert.throws(() => measureReleaseZipCapacity(reserved), /duplicate manifest/);
  const huge = example();
  huge.entries = Array(65536).fill(huge.entries[0]);
  assert.throws(() => measureReleaseZipCapacity(huge), /ZIP64/);
  const total = example();
  total.manifest.totalBytes++;
  total.manifestBytes = Buffer.from(`${JSON.stringify(total.manifest)}\n`);
  total.entries.at(-1).bytes = total.manifestBytes;
  assert.throws(() => measureReleaseZipCapacity(total), /Manifest total/);
});
