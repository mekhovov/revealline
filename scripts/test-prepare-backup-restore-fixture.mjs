import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  prepareNonemptyRestoreFixture,
  writeNonemptyRestoreFixture,
  verifyNonemptyRestoreExport,
} from './prepare-backup-restore-fixture.mjs';
import { inspectBackupArchive } from '../game/backup-archive-inspection.mjs';
import { createBackupZip } from '../game/backup-archive.mjs';

const options = { profileKey: 'journey-whole-spatial-v38', sourceRevision: '1'.repeat(40) };
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const execute = promisify(execFile);
const cli = fileURLToPath(new URL('./prepare-backup-restore-fixture.mjs', import.meta.url));

test('qualification archive carries exact nonempty originals, scoped synthetic progress and honest codec limits', async () => {
  const prepared = await prepareNonemptyRestoreFixture(options);
  const inspected = await inspectBackupArchive(prepared.blob);
  assert.deepEqual(
    inspected.files.map((file) => file.id),
    ['media', 'story', 'audio', 'coverage', 'journey'],
  );
  assert.equal(inspected.manifest.gameData, 'excluded-authored');
  assert.deepEqual(
    prepared.receipt.originals.map((row) => row.component),
    ['media', 'story', 'audio'],
  );
  assert.ok(prepared.receipt.originals.every((row) => row.bytes > 0));
  assert.equal(
    prepared.receipt.originals.find((row) => row.component === 'story').sha256,
    '5abb074b8a740a3305b1d8c6b84466e46eb51d853e2faacad592182999b2c1ea',
  );
  assert.equal(
    prepared.receipt.originals.find((row) => row.component === 'audio').sha256,
    '54a1cbf7f98d7b263dae389576f50dc8507e3b3b40aec9c5793dc4480b14d913',
  );
  assert.equal(
    prepared.receipt.archive.sha256,
    hash(Buffer.from(await prepared.blob.arrayBuffer())),
  );
  assert.equal(prepared.receipt.qualification.nativeCodecs, 'pending-browser');
  assert.equal(prepared.receipt.qualification.hardware, 'not-tested');
  const result = await verifyNonemptyRestoreExport(prepared.blob, prepared.receipt);
  assert.equal(result.status, 'original-payloads-and-synthetic-receipt-match');
  assert.match(result.limitations[0], /not earned/);
});

async function replaceJourney(prepared, change) {
  const inspection = await inspectBackupArchive(prepared.blob);
  const changed = [];
  for (const file of inspection.files) {
    if (file.id !== 'journey') {
      changed.push(file);
      continue;
    }
    const data = JSON.parse(await file.blob.text());
    change(data);
    const blob = new Blob([JSON.stringify(data)]);
    changed.push({
      ...file,
      blob,
      bytes: blob.size,
      sha256: hash(Buffer.from(await blob.arrayBuffer())),
    });
  }
  const manifest = {
    ...inspection.manifest,
    files: changed.map(({ blob: _blob, ...file }) => file),
  };
  const instructions = inspection.instructions.map((file) =>
    file.filename === 'archive-manifest.json'
      ? { ...file, blob: new Blob([JSON.stringify(manifest)]) }
      : file,
  );
  return createBackupZip([
    ...instructions.map((file) => ({ ...file, bytes: file.blob.size })),
    ...changed,
  ]);
}

test('comparison rejects absent progress, a different profile and substituted qualification pins', async () => {
  const prepared = await prepareNonemptyRestoreFixture(options);
  const absent = await replaceJourney(prepared, (data) => {
    data.profile.clears.solo = {};
  });
  await assert.rejects(verifyNonemptyRestoreExport(absent, prepared.receipt), /not retained/);
  await assert.rejects(
    verifyNonemptyRestoreExport(prepared.blob, {
      ...prepared.receipt,
      profileKey: 'different-profile',
    }),
    /different|belongs/,
  );
  const changed = structuredClone(prepared.receipt);
  changed.originals[1] = changed.originals[0];
  await assert.rejects(verifyNonemptyRestoreExport(prepared.blob, changed), /pins changed/);
});

test('explicit fixture directory never replaces an earlier receipt; CLI comparison reads unchanged bytes', async (t) => {
  const parent = await mkdtemp(join(tmpdir(), 'nonempty-restore-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const output = join(parent, 'qualification');
  const receipt = await writeNonemptyRestoreFixture(output, options);
  const receiptPath = join(output, 'receipt.json'),
    archivePath = join(output, receipt.archive.filename);
  const before = await readFile(archivePath);
  await writeFile(join(output, 'retained-note.txt'), 'Do not overwrite this attempt');
  await assert.rejects(writeNonemptyRestoreFixture(output, options), { code: 'EEXIST' });
  const compared = await execute(process.execPath, [
    cli,
    '--verify',
    archivePath,
    '--receipt',
    receiptPath,
  ]);
  assert.equal(JSON.parse(compared.stdout).status, 'original-payloads-and-synthetic-receipt-match');
  assert.deepEqual(await readFile(archivePath), before);
  assert.equal(
    await readFile(join(output, 'retained-note.txt'), 'utf8'),
    'Do not overwrite this attempt',
  );
});

test('fixture creation requires an explicit valid profile and committed identity', async () => {
  await assert.rejects(
    prepareNonemptyRestoreFixture({ ...options, profileKey: undefined }),
    /explicitly/,
  );
  await assert.rejects(
    prepareNonemptyRestoreFixture({ ...options, sourceRevision: 'working-copy' }),
    /committed/,
  );
  await assert.rejects(
    execute(process.execPath, [cli, '--output', '/tmp/not-created-by-missing-profile']),
    /explicit destination/,
  );
});
