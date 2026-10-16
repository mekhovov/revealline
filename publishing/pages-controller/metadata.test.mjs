import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeArchiveBridges, verifyFrozenSite } from '../../scripts/pages-archive.mjs';
import {
  digest,
  jsonBytes,
  metadataBridges,
  retainRecentMetadata,
  selectReleaseMetadata,
  validRetentionConfiguration,
  validateMetadata,
} from './metadata.mjs';

test('global retention orders semantic versions numerically across majors and includes current', () => {
  const metadata = new Map(
    ['v0.9.0', 'v0.10.0', 'v1.0.0', 'v2.0.0', 'v9.0.0', 'v10.0.0', 'v10.1.0'].map((v) => [v, v]),
  );
  const config = { retainedReleaseCount: 5, currentVersion: 'v10.1.0' };
  assert.deepEqual(
    [...selectReleaseMetadata(metadata, config).keys()],
    ['v1.0.0', 'v2.0.0', 'v9.0.0', 'v10.0.0', 'v10.1.0'],
  );
  assert.deepEqual(
    [...selectReleaseMetadata(metadata, { ...config, currentVersion: 'v0.9.0' }).keys()],
    ['v0.9.0', 'v2.0.0', 'v9.0.0', 'v10.0.0', 'v10.1.0'],
  );
  assert.equal(selectReleaseMetadata(metadata, { ...config, retainedReleaseCount: 10 }).size, 7);
  assert.deepEqual(
    [...selectReleaseMetadata(metadata, { ...config, retainedReleaseCount: 1 }).keys()],
    ['v10.1.0'],
  );
  assert.throws(
    () => selectReleaseMetadata(metadata, { ...config, currentVersion: 'v11.0.0' }),
    /Current release/,
  );
  assert.deepEqual(
    [...selectReleaseMetadata(metadata, { retainedReleasesPerMajor: 'all' }).keys()],
    [...metadata.keys()],
  );
});

test('global and per-major policies are mutually exclusive and bounded', () => {
  for (const value of [0, -1, 1.5, 101, '5', 'all', null])
    assert.equal(validRetentionConfiguration({ retainedReleaseCount: value }), false);
  assert.equal(
    validRetentionConfiguration({ retainedReleaseCount: 5, retainedReleasesPerMajor: 5 }),
    false,
  );
  assert.equal(validRetentionConfiguration({}), false);
  assert.equal(validRetentionConfiguration({ retainedReleaseCount: 5 }), true);
});

function fixture(worker = true) {
  const payloads = new Map([
    ['index.html', Buffer.from('<html>old root</html>')],
    ['game/index.html', Buffer.from('<html>old game</html>')],
    ['authoring/nested/example.html', Buffer.from('nested')],
    ['game/asset.png', Buffer.from([1, 2, 3])],
  ]);
  if (worker) payloads.set('service-worker.js', Buffer.from('/* original worker */'));
  const files = [...payloads].map(([name, bytes]) => ({
    path: name,
    bytes: bytes.length,
    sha256: digest(bytes),
  }));
  const manifest = {
    formatVersion: 1,
    version: 'v0.44.0',
    sourceRevision: 'a'.repeat(40),
    entry: 'game/index.html',
    totalBytes: files.reduce((n, row) => n + row.bytes, 0),
    files,
  };
  const manifestBytes = jsonBytes(manifest),
    record = {
      formatVersion: 1,
      version: manifest.version,
      sourceRevision: manifest.sourceRevision,
      sourceArchiveSha256: 'b'.repeat(64),
      distributionSha256: 'c'.repeat(64),
      manifestSha256: digest(manifestBytes),
      play: 'v0.44.0/site/game/',
      download: 'v0.44.0/site/distribution.zip',
    },
    recordBytes = jsonBytes(record),
    checksumBytes = Buffer.from(`${record.distributionSha256}  distribution.zip\n`);
  const pin = {
    version: record.version,
    sourceRevision: record.sourceRevision,
    tagObject: 'd'.repeat(40),
    recordSha256: digest(recordBytes),
    manifestSha256: digest(manifestBytes),
    checksumSha256: digest(checksumBytes),
  };
  return { payloads, manifest, recordBytes, manifestBytes, checksumBytes, pin };
}
async function inventory(dir, prefix = '') {
  const rows = [];
  for (const file of await fs.readdir(dir, { withFileTypes: true })) {
    if (file.isDirectory())
      rows.push(...(await inventory(path.join(dir, file.name), prefix + file.name + '/')));
    else rows.push([prefix + file.name, await fs.readFile(path.join(dir, file.name))]);
  }
  return rows.sort(([a], [b]) => a.localeCompare(b));
}

test('legacy and v2 source contracts remain distinct and commit-addressed', () => {
  const f = fixture();
  assert.equal(validateMetadata(f).record.formatVersion, 1);
  const record = JSON.parse(f.recordBytes);
  delete record.sourceArchiveSha256;
  Object.assign(record, {
    formatVersion: 2,
    sourceTree: 'e'.repeat(40),
    sourceUrl: `https://github.com/mekhovov/revealline/archive/${record.sourceRevision}.tar.gz`,
    sourceManifestSha256: 'f'.repeat(64),
  });
  const check = () => {
    f.recordBytes = jsonBytes(record);
    f.pin.recordSha256 = digest(f.recordBytes);
    return validateMetadata(f);
  };
  assert.equal(check().record.formatVersion, 2);
  record.sourceUrl = 'https://github.com/mekhovov/revealline/archive/main.tar.gz';
  assert.throws(check, /record mismatch/);
  record.sourceUrl = `https://github.com/mekhovov/revealline/archive/${record.sourceRevision}.tar.gz`;
  record.sourceArchiveSha256 = 'b'.repeat(64);
  assert.throws(check, /record mismatch/);
});
for (const hasWorker of [true, false])
  test(`metadata bridges exactly equal existing writer; worker=${hasWorker}`, async (t) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pages-metadata-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const source = path.join(dir, 'source'),
      target = path.join(dir, 'target'),
      f = fixture(hasWorker),
      checked = validateMetadata(f),
      canonical = 'https://mekhovov.github.io/revealline-archive-06/releases/v0.44.0/site/';
    for (const [name, bytes] of [
      ...f.payloads,
      ['manifest.json', f.manifestBytes],
      ['distribution.zip.sha256', f.checksumBytes],
      ['.xonix-build.json', Buffer.from('{}')],
    ]) {
      await fs.mkdir(path.dirname(path.join(source, name)), { recursive: true });
      await fs.writeFile(path.join(source, name), bytes);
    }
    await verifyFrozenSite(source, checked.record);
    await writeArchiveBridges(source, target, canonical);
    assert.deepEqual(
      [...metadataBridges(checked, canonical)].sort(([a], [b]) => a.localeCompare(b)),
      await inventory(target),
    );
    assert.equal(checked.manifest.files.length, f.payloads.size);
  });

test('changed pinned metadata and release identity are rejected', () => {
  const f = fixture();
  assert.throws(() => validateMetadata({ ...f, manifestBytes: Buffer.from('{}') }), /pin mismatch/);
  assert.throws(
    () => validateMetadata({ ...f, pin: { ...f.pin, sourceRevision: 'e'.repeat(40) } }),
    /record mismatch/,
  );
  assert.throws(
    () => validateMetadata({ ...f, checksumBytes: Buffer.from('bad') }),
    /pin mismatch/,
  );
});

test('self-consistent malformed manifests fail before bridge creation', () => {
  for (const mutation of [
    (m) => m.files.push(m.files[0]),
    (m) => (m.files[0].path = '../outside.html'),
    (m) => (m.files[0].path = 'nested\\outside.html'),
    (m) => (m.files[0].path = '%2e%2e/outside.html'),
    (m) => (m.files[0].path = '/absolute.html'),
    (m) => (m.files[0].path = 'releases/index.html'),
    (m) => (m.files[0].bytes = 1.5),
    (m) => (m.files[0].sha256 = 'A'.repeat(64)),
    (m) => m.totalBytes++,
    (m) => (m.files[0].extra = 'unknown'),
  ]) {
    const f = fixture();
    mutation(f.manifest);
    f.manifestBytes = jsonBytes(f.manifest);
    const record = JSON.parse(f.recordBytes);
    record.manifestSha256 = digest(f.manifestBytes);
    f.recordBytes = jsonBytes(record);
    f.pin.manifestSha256 = record.manifestSha256;
    f.pin.recordSha256 = digest(f.recordBytes);
    assert.throws(() => validateMetadata(f));
  }
});

test('bridge targets cannot escape the admitted canonical edition', () => {
  const f = validateMetadata(fixture());
  for (const url of [
    'https://example.com/releases/v0.44.0/site/',
    'https://mekhovov.github.io/revealline-archive-06/releases/v0.45.0/site/',
    'https://mekhovov.github.io/revealline-archive-06/releases/v0.44.0/site/?x=1',
    'http://mekhovov.github.io/revealline-archive-06/releases/v0.44.0/site/',
  ])
    assert.throws(() => metadataBridges(f, url));
});

test('numeric retention keeps the newest ten releases in every semantic major', () => {
  const versions = [
      ...Array.from({ length: 12 }, (_, index) => `v0.${index}.0`),
      ...Array.from({ length: 12 }, (_, index) => `v1.${index}.0`),
    ],
    metadata = new Map(versions.map((version) => [version, { version }])),
    retained = retainRecentMetadata(metadata, 10);
  assert.deepEqual(
    [...retained.keys()],
    versions.filter((version) => !['v0.0.0', 'v0.1.0', 'v1.0.0', 'v1.1.0'].includes(version)),
  );
});
