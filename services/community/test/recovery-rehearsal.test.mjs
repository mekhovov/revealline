import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  RECOVERY_REHEARSAL_RECEIPT_FORMAT,
  inspectRecoveryDatabase,
  planRecoveryRehearsal,
  rehearseCommunityRecovery,
} from '../src/recovery-rehearsal.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

const fixture = async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'revealline-community-rehearsal-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceBlobRoot = path.join(root, 'source-blobs');
  const targetBlobRoot = path.join(root, 'target-blobs');
  const bytes = Buffer.from('immutable rehearsal package');
  const sha256 = digest(bytes);
  const key = `packages/sha256/${sha256.slice(0, 2)}/${sha256}.rlpack`;
  await mkdir(path.dirname(path.join(sourceBlobRoot, key)), { recursive: true });
  await writeFile(path.join(sourceBlobRoot, key), bytes);
  return {
    root,
    sourceBlobRoot,
    targetBlobRoot,
    bytes,
    key,
    sha256,
    sourceDatabaseUrl: 'postgres://source-user:source-secret@source.example/revealline',
    targetDatabaseUrl: 'postgres://target-user:target-secret@target.example/revealline-rehearsal',
  };
};

const inspection = ({ key, sha256, size, submissions = 2, tusUploads = 0 }) => ({
  schemaRevision: 3,
  counts: {
    submissions,
    validationJobs: 2,
    reports: 1,
    auditRecords: 1,
    admissionWindows: 3,
    admissionEvents: 2,
    tusUploads,
  },
  submissionStatusCounts: { draft: 1, published: submissions - 1 },
  tableFingerprints: {
    submissions: submissions === 2 ? '0'.repeat(32) : '1'.repeat(32),
    validationJobs: '2'.repeat(32),
    reports: '3'.repeat(32),
    auditRecords: '4'.repeat(32),
    admissionWindows: '5'.repeat(32),
    admissionEvents: '6'.repeat(32),
    tusUploads: '7'.repeat(32),
  },
  blobReferences: [{ key, sha256, size }],
});

const commandRecorder = (databaseBytes, calls) => async (command, args, options) => {
  calls.push({ command, args, options });
  if (command === 'pg_dump') {
    const target = args[args.indexOf('--file') + 1];
    await writeFile(target, databaseBytes);
  }
};

test('rehearsal restores into a confirmed distinct target and writes a redacted receipt', async (t) => {
  const value = await fixture(t);
  const plan = planRecoveryRehearsal(value);
  const calls = [];
  const observedRoles = [];
  const receiptFile = path.join(value.root, 'receipts', 'rehearsal.json');
  const receipt = await rehearseCommunityRecovery({
    ...value,
    workDirectory: path.join(value.root, 'work'),
    receiptFile,
    expectedTargetIdentity: plan.targetDatabase,
    runCommand: commandRecorder(Buffer.from('custom-format database dump'), calls),
    inspectDatabase: async ({ role }) => {
      observedRoles.push(role);
      return inspection({ key: value.key, sha256: value.sha256, size: value.bytes.length });
    },
    clock: () => new Date('2026-09-26T12:00:00.000Z'),
  });

  assert.equal(receipt.format, RECOVERY_REHEARSAL_RECEIPT_FORMAT);
  assert.equal(receipt.outcome, 'passed');
  assert.deepEqual(observedRoles, ['source', 'target']);
  assert.deepEqual(
    calls.map(({ command }) => command),
    ['pg_dump', 'pg_restore', 'psql'],
  );
  assert.match(calls[2].args.at(-1), /DELETE FROM public\.community_tus_uploads/u);
  assert.equal(
    await readFile(path.join(value.targetBlobRoot, value.key), 'utf8'),
    value.bytes.toString('utf8'),
  );
  const stored = await readFile(receiptFile, 'utf8');
  assert.deepEqual(JSON.parse(stored), receipt);
  for (const secret of [
    value.sourceDatabaseUrl,
    value.targetDatabaseUrl,
    value.sourceBlobRoot,
    value.targetBlobRoot,
    'source-secret',
    'target-secret',
  ])
    assert.equal(stored.includes(secret), false);
  assert.match(receipt.source.databaseIdentity, /^database_[a-f0-9]{64}$/u);
  assert.match(receipt.target.blobRootIdentity, /^blob-root_[a-f0-9]{64}$/u);
  assert.equal(receipt.evidence.referencedBlobCount, 1);
  assert.equal(receipt.evidence.storedBlobBytes, value.bytes.length);
});

test('target confirmation and distinct-source guards run before destructive commands', async (t) => {
  const value = await fixture(t);
  let commands = 0;
  await assert.rejects(
    rehearseCommunityRecovery({
      ...value,
      workDirectory: path.join(value.root, 'work'),
      receiptFile: path.join(value.root, 'receipt.json'),
      expectedTargetIdentity: 'database_wrong',
      runCommand: async () => {
        commands += 1;
      },
    }),
    /Target confirmation does not match/u,
  );
  assert.equal(commands, 0);
  assert.throws(
    () => planRecoveryRehearsal({ ...value, targetDatabaseUrl: value.sourceDatabaseUrl }),
    /databases must differ/u,
  );
  assert.throws(
    () =>
      planRecoveryRehearsal({
        ...value,
        targetDatabaseUrl: 'postgres://different-user:different-password@source.example/revealline',
      }),
    /databases must differ/u,
  );
  assert.throws(
    () =>
      planRecoveryRehearsal({
        ...value,
        targetDatabaseUrl:
          'postgres://different-user:different-password@SOURCE.example/%72evealline',
      }),
    /databases must differ/u,
  );
  assert.throws(
    () => planRecoveryRehearsal({ ...value, targetBlobRoot: value.sourceBlobRoot }),
    /blob roots must differ/u,
  );
});

test('semantic mismatch fails without creating a passing receipt', async (t) => {
  const value = await fixture(t);
  const plan = planRecoveryRehearsal(value);
  const receiptFile = path.join(value.root, 'receipt.json');
  await assert.rejects(
    rehearseCommunityRecovery({
      ...value,
      workDirectory: path.join(value.root, 'work'),
      receiptFile,
      expectedTargetIdentity: plan.targetDatabase,
      runCommand: commandRecorder(Buffer.from('database'), []),
      inspectDatabase: async ({ role }) =>
        inspection({
          key: value.key,
          sha256: value.sha256,
          size: value.bytes.length,
          submissions: role === 'source' ? 2 : 3,
        }),
    }),
    /does not match the source semantic inspection/u,
  );
  await assert.rejects(access(receiptFile), /ENOENT/u);
});

test('source database references must resolve to exact snapshot package bytes', async (t) => {
  const value = await fixture(t);
  const plan = planRecoveryRehearsal(value);
  const missingSha256 = 'a'.repeat(64);
  await assert.rejects(
    rehearseCommunityRecovery({
      ...value,
      workDirectory: path.join(value.root, 'work'),
      receiptFile: path.join(value.root, 'receipt.json'),
      expectedTargetIdentity: plan.targetDatabase,
      runCommand: commandRecorder(Buffer.from('database'), []),
      inspectDatabase: async () =>
        inspection({
          key: `packages/sha256/aa/${missingSha256}.rlpack`,
          sha256: missingSha256,
          size: 100,
        }),
    }),
    /absent from the recovery snapshot/u,
  );
  await assert.rejects(access(value.targetBlobRoot), /ENOENT/u);
});

test('PostgreSQL inspection uses a credential-free process environment boundary', async () => {
  const sha256 = 'b'.repeat(64);
  const key = `packages/sha256/bb/${sha256}.rlpack`;
  const expected = inspection({ key, sha256, size: 42 });
  const calls = [];
  const actual = await inspectRecoveryDatabase({
    databaseUrl: 'postgres://inspector:secret@database/revealline',
    runCommand: async (command, args, options) => {
      calls.push({ command, args, options });
      return `${JSON.stringify(expected)}\n`;
    },
  });
  assert.deepEqual(actual, expected);
  assert.equal(calls[0].command, 'psql');
  assert.equal(calls[0].args.includes('postgres://inspector:secret@database/revealline'), false);
  assert.equal(calls[0].options.captureOutput, true);
});

test('disaster rehearsal expires in-progress tus sessions and records their source count', async (t) => {
  const value = await fixture(t);
  const plan = planRecoveryRehearsal(value);
  const receipt = await rehearseCommunityRecovery({
    ...value,
    workDirectory: path.join(value.root, 'work'),
    receiptFile: path.join(value.root, 'receipt.json'),
    expectedTargetIdentity: plan.targetDatabase,
    runCommand: commandRecorder(Buffer.from('database'), []),
    inspectDatabase: async ({ role }) =>
      inspection({
        key: value.key,
        sha256: value.sha256,
        size: value.bytes.length,
        tusUploads: role === 'source' ? 3 : 0,
      }),
  });
  assert.equal(receipt.evidence.discardedTusUploads, 3);
  assert.ok(receipt.checks.includes('transient-tus-uploads-expired'));
});
