import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { checkBackupSet } from './check-backup-set.mjs';
import { prepareBackupSet } from '../game/backup-set.mjs';
import { EXTERNAL_BACKUP_FORMAT } from '../game/backup.mjs';
import { backupSetFixture } from '../game/test/helpers/backup-set-fixture.mjs';

const execute = promisify(execFile);
const cli = fileURLToPath(new URL('./check-backup-set.mjs', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function savedSet(t, { detached = false } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-check-backup-set-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const fixture = await backupSetFixture();
  if (detached) {
    fixture.story.originals = [];
    fixture.source.readStory = async () => ({
      generation: fixture.metadata.story,
      document: fixture.story,
      assets: [],
    });
  }
  const prepared = await prepareBackupSet(fixture.source);
  for (const file of prepared.files)
    await fs.writeFile(
      path.join(directory, file.filename),
      Buffer.from(await file.blob.arrayBuffer()),
    );
  const reportPath = path.join(
    directory,
    prepared.files.find((file) => file.id === 'coverage').filename,
  );
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  return {
    directory,
    reportPath,
    report,
    prepared,
    file: (id) => path.join(directory, report.files.find((row) => row.id === id).filename),
    saveReport: () => fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'),
  };
}

async function fingerprints(directory) {
  return Promise.all(
    (await fs.readdir(directory)).sort().map(async (name) => {
      const file = path.join(directory, name),
        stat = await fs.lstat(file);
      return {
        name,
        bytes: stat.size,
        mtimeMs: stat.mtimeMs,
        sha256: hash(await fs.readFile(file)),
      };
    }),
  );
}

async function replaceComponent(set, id, bytes) {
  await fs.writeFile(set.file(id), bytes);
  const row = set.report.files.find((file) => file.id === id);
  row.bytes = bytes.length;
  row.sha256 = hash(bytes);
  await set.saveReport();
}

function changeBundleManifest(bytes, change) {
  const length = bytes.readUInt32BE(8);
  const manifest = JSON.parse(bytes.subarray(12, 12 + length).toString('utf8'));
  change(manifest);
  const text = Buffer.from(JSON.stringify(manifest)),
    header = Buffer.from(bytes.subarray(0, 12));
  header.writeUInt32BE(text.length, 8);
  return Buffer.concat([header, text, bytes.subarray(12 + length)]);
}

test('saved actual four-format set verifies exact bytes without changing any file', async (t) => {
  const set = await savedSet(t),
    before = await fingerprints(set.directory);
  const result = await checkBackupSet({ reportPath: set.reportPath });
  assert.equal(result.status, 'verified');
  assert.deepEqual(
    result.files.map(({ id, filename, bytes, sha256 }) => ({ id, filename, bytes, sha256 })),
    set.report.files.map(({ id, filename, bytes, sha256 }) => ({ id, filename, bytes, sha256 })),
  );
  assert.deepEqual(await fingerprints(set.directory), before);
});

test('explicit component directory works when the coverage report is stored elsewhere', async (t) => {
  const set = await savedSet(t),
    reports = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-backup-report-'));
  t.after(() => fs.rm(reports, { recursive: true, force: true }));
  const reportPath = path.join(reports, 'coverage.json');
  await fs.rename(set.reportPath, reportPath);
  assert.equal((await checkBackupSet({ reportPath, directory: set.directory })).status, 'verified');
});

for (const fault of ['missing', 'changed-bytes', 'wrong-size', 'wrong-hash'])
  test(`one ${fault} component invalidates the complete set`, async (t) => {
    const set = await savedSet(t),
      file = set.file('media');
    if (fault === 'missing') await fs.unlink(file);
    else if (fault === 'changed-bytes') {
      const bytes = await fs.readFile(file);
      bytes[bytes.length - 1] ^= 1;
      await fs.writeFile(file, bytes);
    } else {
      const row = set.report.files.find((entry) => entry.id === 'media');
      if (fault === 'wrong-size') row.bytes++;
      else row.sha256 = '0'.repeat(64);
      await set.saveReport();
    }
    const before = await fingerprints(set.directory);
    await assert.rejects(checkBackupSet({ reportPath: set.reportPath }));
    assert.deepEqual(await fingerprints(set.directory), before);
  });

for (const fault of [
  'traversal',
  'duplicate-name',
  'duplicate-id',
  'report-version',
  'report-identity',
])
  test(`coverage ${fault} is refused before it can authorize a component`, async (t) => {
    const set = await savedSet(t);
    if (fault === 'traversal') set.report.files[0].filename = '../outside.json';
    if (fault === 'duplicate-name')
      set.report.files.find((row) => row.id === 'game').filename = path.basename(set.reportPath);
    if (fault === 'duplicate-id') set.report.files[1].id = set.report.files[0].id;
    if (fault === 'report-version') set.report.reportVersion = 999;
    if (fault === 'report-identity') set.report.report = 'Unrelated report';
    await set.saveReport();
    await assert.rejects(checkBackupSet({ reportPath: set.reportPath }));
  });

for (const target of ['component', 'report'])
  test(`${target} symlink refuses even when its target has all expected bytes`, async (t) => {
    const set = await savedSet(t),
      file = target === 'report' ? set.reportPath : set.file('audio'),
      actual = file + '.retained';
    await fs.rename(file, actual);
    await fs.symlink(actual, file);
    await assert.rejects(checkBackupSet({ reportPath: set.reportPath }));
    assert.equal((await fs.lstat(file)).isSymbolicLink(), true);
  });

for (const id of ['game', 'media', 'story', 'audio'])
  test(`${id} schema failure is not hidden by a recomputed coverage hash`, async (t) => {
    const set = await savedSet(t),
      original = await fs.readFile(set.file(id));
    const invalid =
      id === 'game'
        ? Buffer.from(JSON.stringify({ format: 'unknown-game-backup' }))
        : changeBundleManifest(original, (manifest) => {
            if (id === 'audio') manifest.library.format = 'unknown-audio-library';
            else manifest.document.format = 'unknown-original-inventory';
          });
    await replaceComponent(set, id, invalid);
    assert.equal(
      hash(await fs.readFile(set.file(id))),
      set.report.files.find((row) => row.id === id).sha256,
    );
    await assert.rejects(checkBackupSet({ reportPath: set.reportPath }));
  });

test('detached story coverage remains incomplete after successful file verification', async (t) => {
  const set = await savedSet(t, { detached: true });
  const result = await checkBackupSet({ reportPath: set.reportPath });
  assert.equal(result.status, 'verified');
  assert.match(JSON.stringify(result.coverage), /incomplete/);
  assert.match(
    JSON.stringify(result.detachedStories),
    new RegExp(set.report.detachedStories[0].sha256),
  );
});

test('CLI help needs no backup files and actual CLI verification prints JSON', async (t) => {
  const set = await savedSet(t),
    before = await fingerprints(set.directory);
  const help = await execute(process.execPath, [cli, '--help'], {
    cwd: set.directory,
    maxBuffer: 64 * 1024,
  });
  assert.match(help.stdout, /--report/);
  assert.match(help.stdout, /--directory/);
  const result = await execute(process.execPath, [cli, '--report', set.reportPath], {
    cwd: set.directory,
    maxBuffer: 64 * 1024,
  });
  assert.equal(JSON.parse(result.stdout).status, 'verified');
  assert.deepEqual(await fingerprints(set.directory), before);
});

test('recomputed outer hash cannot hide a corrupt still original', async (t) => {
  const set = await savedSet(t),
    bytes = await fs.readFile(set.file('media'));
  bytes[bytes.length - 1] ^= 1;
  await replaceComponent(set, 'media', bytes);
  await assert.rejects(checkBackupSet({ reportPath: set.reportPath }), /original SHA-256/);
});

for (const field of ['library', 'session', 'externalChapters'])
  test(`malformed game ${field} refuses with its outer hash correctly recomputed`, async (t) => {
    const set = await savedSet(t),
      value = JSON.parse(await fs.readFile(set.file('game'), 'utf8'));
    if (field === 'externalChapters') {
      value.format = EXTERNAL_BACKUP_FORMAT;
      value.externalChapters = { format: 'unsupported-external-index' };
    } else value[field] = [];
    await replaceComponent(set, 'game', Buffer.from(JSON.stringify(value)));
    await assert.rejects(checkBackupSet({ reportPath: set.reportPath }));
  });

test('CLI rejects unknown and inherited option names without changing the downloaded files', async (t) => {
  const set = await savedSet(t),
    before = await fingerprints(set.directory);
  for (const flag of ['toString', 'constructor', '--unknown']) {
    await assert.rejects(
      execute(process.execPath, [cli, '--report', set.reportPath, flag, 'value'], {
        maxBuffer: 64 * 1024,
      }),
      (error) =>
        error.code === 1 &&
        /unknown, missing or duplicate CLI option/.test(error.stderr) &&
        error.stdout === '',
    );
  }
  assert.deepEqual(await fingerprints(set.directory), before);
});

test('CLI refuses a browser-renamed download and explains exact set filenames without guessing', async (t) => {
  const set = await savedSet(t),
    original = set.file('media');
  await fs.rename(original, original.replace('.rlmedia', ' (1).rlmedia'));
  const before = await fingerprints(set.directory);
  await assert.rejects(
    execute(process.execPath, [cli, '--report', set.reportPath], { maxBuffer: 64 * 1024 }),
    (error) =>
      error.code === 1 &&
      /exact coverage-report filenames/.test(error.stderr) &&
      /not selected automatically/.test(error.stderr) &&
      error.stdout === '',
  );
  assert.deepEqual(await fingerprints(set.directory), before);
});
