import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  prepareBackupArchive,
  createBackupZip,
  BACKUP_ARCHIVE_FORMAT,
} from '../backup-archive.mjs';
import { prepareBackupSet } from '../backup-set.mjs';
import { createJourneyProfileStore, emptyJourneyProfile } from '../journey/profile.mjs';
import { backupSetFixture, catalogueBackupAudio } from './helpers/backup-set-fixture.mjs';
import { deferred } from './helpers/media-fixtures.mjs';

function storedMembers(bytes) {
  const files = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(bytes.readUInt16LE(offset + 8), 0, 'original bytes use stored ZIP entries');
    const size = bytes.readUInt32LE(offset + 18),
      nameSize = bytes.readUInt16LE(offset + 26),
      extraSize = bytes.readUInt16LE(offset + 28),
      start = offset + 30 + nameSize + extraSize;
    files.set(
      bytes.subarray(offset + 30, offset + 30 + nameSize).toString(),
      bytes.subarray(start, start + size),
    );
    offset = start + size;
  }
  assert.equal(
    bytes.readUInt32LE(offset),
    0x02014b50,
    'a central directory follows the local entries',
  );
  assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
  assert.equal(bytes.readUInt16LE(bytes.length - 12), files.size);
  return files;
}
const buffer = async (blob) => Buffer.from(await blob.arrayBuffer());
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('portable archive preserves actual component bytes and records current scope, restrictions and exclusions', async () => {
  const f = await backupSetFixture();
  await catalogueBackupAudio(f);
  const original = await prepareBackupSet(f.source),
    archive = await prepareBackupArchive(f.source),
    members = storedMembers(await buffer(archive.files[0].blob)),
    report = JSON.parse(members.get('archive-manifest.json'));
  assert.equal(report.format, BACKUP_ARCHIVE_FORMAT);
  assert.equal(report.journey, 'not-included');
  assert.ok(report.exclusions.some((value) => /no current Journey owner/.test(value)));
  assert.ok(report.exclusions.some((value) => /reference-only/.test(value)));
  assert.ok(report.exclusions.some((value) => /simulator records/.test(value)));
  assert.match(members.get('README.txt').toString(), /cannot directly import this ZIP yet/);
  assert.match(members.get('README.txt').toString(), /Розпакуйте ZIP/);
  const coverage = JSON.parse(members.get(report.coverageReport));
  assert.match(coverage.coverage, /reference-only music/);
  for (const file of report.files) {
    const bytes = members.get(file.filename);
    assert.equal(bytes.length, file.bytes);
    assert.equal(hash(bytes), file.sha256);
    if (['media', 'story', 'audio'].includes(file.id))
      assert.deepEqual(
        bytes,
        await buffer(original.files.find((item) => item.id === file.id).blob),
      );
  }
  assert.equal(report.files.length, 5);
  assert.equal(members.size, report.files.length + 2);
});

test('archive awaits the existing Journey async owner and preserves its exact bytes and partial label', async () => {
  const f = await backupSetFixture(),
    entered = deferred(),
    held = deferred();
  const raw =
    '{"format":"revealline-journey-backup.v5","profileKey":"edition-test","profile":{},"performance":{"records":["retained evidence"]}}';
  f.source.journey = {
    identity: () => 1,
    read: async () => {
      entered.resolve();
      await held.promise;
      return { raw, partial: true };
    },
  };
  const preparing = prepareBackupArchive(f.source);
  await entered.promise;
  held.resolve();
  const archive = await preparing,
    report = archive.archiveReport,
    members = storedMembers(await buffer(archive.files[0].blob)),
    journey = report.files.find((file) => file.id === 'journey');
  assert.equal(report.journey, 'available-evidence-only');
  assert.equal(report.files.length, 6);
  assert.match(journey.filename, /-journey-recovery\.json$/);
  assert.equal(members.get(journey.filename).toString(), raw);
  assert.equal(journey.sha256, hash(Buffer.from(raw)));
  assert.ok(report.exclusions.some((value) => /could not be read/.test(value)));
});

test('authored owner explicitly exports shared media and Journey without entering legacy game-data export', async () => {
  const f = await backupSetFixture(),
    identity = f.source.gameIdentity,
    readStill = f.source.readStill;
  f.source.archiveProfile = { kind: 'authored-journey', identity };
  f.source.gameIdentity = () => {
    throw new Error('Legacy authored session guard');
  };
  f.source.readGame = () => {
    throw new Error('Legacy game data must not be read');
  };
  f.source.journey = { identity: () => 1, read: async () => ({ raw: '{}', partial: false }) };
  await assert.rejects(prepareBackupSet(f.source), /Legacy authored session guard/);
  const archive = await prepareBackupArchive(f.source),
    report = archive.archiveReport;
  assert.equal(report.gameData, 'excluded-authored');
  assert.deepEqual(
    report.files.map((file) => file.id),
    ['media', 'story', 'audio', 'coverage', 'journey'],
  );
  assert.ok(report.exclusions.some((value) => /unfinished authored flight/.test(value)));
  assert.ok(archive.coverage.exclusions.some((value) => /Legacy game-data/.test(value)));
  assert.ok(report.restoreOrder.every((value) => !/game-data/.test(value)));
  assert.equal(report.journey, 'included');
  f.changeGame();
  assert.throws(archive.assertGameCurrent, /Game data changed/);
  f.source.readStill = async () => {
    throw new Error('Shared media storage unavailable');
  };
  await assert.rejects(prepareBackupArchive(f.source), /Shared media storage unavailable/);
  f.source.readStill = readStill;
  f.source.archiveProfile = { kind: 'unknown', identity };
  await assert.rejects(prepareBackupArchive(f.source), /Unsupported archive profile/);
});

test('merged Journey exportAsync is borrowed read-only rather than replaced by the synchronous serializer', async (t) => {
  const f = await backupSetFixture();
  let reads = 0,
    writes = 0;
  const owner = createJourneyProfileStore({
    backend: {
      read: async () => {
        reads++;
        return emptyJourneyProfile();
      },
      commit: async () => {
        writes++;
        throw new Error('Archive must not persist');
      },
    },
  });
  t.after(() => owner.performance.dispose());
  await owner.load();
  const before = owner.snapshot(),
    baselineReads = reads;
  f.source.journey = {
    identity: owner.stateRevision,
    read: (options) => owner.exportAsync(options),
  };
  const result = await prepareBackupArchive(f.source);
  assert.equal(result.archiveReport.journey, 'included');
  assert.ok(
    reads > baselineReads,
    'async export observes optional evidence through its existing owner',
  );
  assert.deepEqual(owner.snapshot(), before);
  assert.equal(writes, 0);
});

test('cancellation, changed Journey state and failed Journey exports never publish a partial-success archive', async () => {
  for (const kind of ['cancel', 'change', 'failure']) {
    const f = await backupSetFixture(),
      controller = new AbortController();
    let revision = 1;
    f.source.journey = {
      identity: () => revision,
      read: async () => {
        if (kind === 'cancel') controller.abort();
        if (kind === 'change') revision++;
        if (kind === 'failure') throw new Error('Conflicting Journey evidence');
        return { raw: '{}', partial: false };
      },
    };
    await assert.rejects(
      prepareBackupArchive(f.source, { signal: controller.signal }),
      kind === 'cancel'
        ? { name: 'AbortError' }
        : kind === 'change'
          ? /Journey progress changed/
          : /Conflicting/,
    );
  }
});

test('archive ownership is rechecked before native activation', async () => {
  const f = await backupSetFixture();
  let revision = 1;
  f.source.journey = {
    identity: () => revision,
    read: async () => ({ raw: '{}', partial: false }),
  };
  const archive = await prepareBackupArchive(f.source);
  revision++;
  assert.throws(archive.assertGameCurrent, /Journey progress changed/);
});

test('stored ZIP uses standard CRC32 and bounded reads, with budgets admitted before reading bodies', async () => {
  const blob = new Blob(['123456789']),
    zip = await buffer(await createBackupZip([{ filename: 'vector.txt', blob, bytes: 9 }]));
  assert.equal(zip.readUInt32LE(14), 0xcbf43926);
  const large = new Blob([new Uint8Array(131073)]),
    slice = large.slice.bind(large),
    reads = [];
  large.arrayBuffer = () => {
    throw new Error('The ZIP must not allocate a whole member');
  };
  large.slice = (start, end) => {
    reads.push(end - start);
    return slice(start, end);
  };
  await createBackupZip([{ filename: 'large.bin', blob: large, bytes: large.size }]);
  assert.equal(reads.length, 3);
  assert.ok(reads.every((size) => size <= 65536));
  reads.length = 0;
  await assert.rejects(
    createBackupZip([{ filename: 'large.bin', blob: large, bytes: large.size }], { maxBytes: 100 }),
    /budget/,
  );
  assert.equal(reads.length, 0);
  for (const filename of ['../escape', '/absolute', 'folder/file', ''])
    await assert.rejects(createBackupZip([{ filename, blob, bytes: 9 }]), /filename/);
  await assert.rejects(
    createBackupZip([
      { filename: 'same', blob, bytes: 9 },
      { filename: 'same', blob, bytes: 9 },
    ]),
    /duplicate/,
  );
  const controller = new AbortController();
  await assert.rejects(
    createBackupZip([{ filename: 'one', blob, bytes: 9 }], {
      signal: controller.signal,
      onProgress: () => controller.abort(),
    }),
    { name: 'AbortError' },
  );
});

test('the system unzip reader validates and extracts an archive without changing component bytes', async (t) => {
  if (spawnSync('unzip', ['-v']).error?.code === 'ENOENT')
    return t.skip('System unzip is unavailable');
  const directory = await mkdtemp(path.join(tmpdir(), 'revealline-backup-zip-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const f = await backupSetFixture(),
    result = await prepareBackupArchive(f.source),
    filename = path.join(directory, 'archive.zip');
  await writeFile(filename, await buffer(result.files[0].blob));
  const verified = spawnSync('unzip', ['-t', filename], { encoding: 'utf8' });
  assert.equal(verified.status, 0, verified.stdout + verified.stderr);
  const extracted = spawnSync('unzip', ['-q', filename, '-d', path.join(directory, 'files')], {
    encoding: 'utf8',
  });
  assert.equal(extracted.status, 0, extracted.stdout + extracted.stderr);
  for (const file of result.archiveReport.files)
    assert.equal(hash(await readFile(path.join(directory, 'files', file.filename))), file.sha256);
});
