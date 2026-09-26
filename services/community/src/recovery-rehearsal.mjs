import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createRecoverySnapshot,
  restoreRecoverySnapshot,
  verifyRecoverySnapshot,
} from './recovery.mjs';

export const RECOVERY_REHEARSAL_RECEIPT_FORMAT =
  'revealline-community-recovery-rehearsal-receipt.v1';

const PACKAGE_KEY = /^packages\/sha256\/([a-f0-9]{2})\/([a-f0-9]{64})\.rlpack$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const COUNT_KEYS = Object.freeze([
  'submissions',
  'validationJobs',
  'reports',
  'auditRecords',
  'admissionWindows',
  'admissionEvents',
  'tusUploads',
]);
const TABLE_FINGERPRINT_KEYS = Object.freeze([
  'submissions',
  'validationJobs',
  'reports',
  'auditRecords',
  'admissionWindows',
  'admissionEvents',
  'tusUploads',
]);

export const RECOVERY_SEMANTIC_INSPECTION_SQL = `
SELECT json_build_object(
  'schemaRevision', 3,
  'counts', json_build_object(
    'submissions', (SELECT count(*) FROM community_submissions),
    'validationJobs', (SELECT count(*) FROM community_validation_jobs),
    'reports', (SELECT count(*) FROM community_reports),
    'auditRecords', (SELECT count(*) FROM community_audit_log),
    'admissionWindows', (SELECT count(*) FROM community_admission_windows),
    'admissionEvents', (SELECT count(*) FROM community_admission_events),
    'tusUploads', (SELECT count(*) FROM community_tus_uploads)
  ),
  'submissionStatusCounts', COALESCE((
    SELECT json_object_agg(status, total ORDER BY status)
    FROM (SELECT status, count(*) AS total FROM community_submissions GROUP BY status) statuses
  ), '{}'::json),
  'tableFingerprints', json_build_object(
    'submissions', (SELECT md5(COALESCE(string_agg(to_jsonb(rows)::text, E'\\n' ORDER BY to_jsonb(rows)::text), '')) FROM community_submissions rows),
    'validationJobs', (SELECT md5(COALESCE(string_agg(to_jsonb(rows)::text, E'\\n' ORDER BY to_jsonb(rows)::text), '')) FROM community_validation_jobs rows),
    'reports', (SELECT md5(COALESCE(string_agg(to_jsonb(rows)::text, E'\\n' ORDER BY to_jsonb(rows)::text), '')) FROM community_reports rows),
    'auditRecords', (SELECT md5(COALESCE(string_agg(to_jsonb(rows)::text, E'\\n' ORDER BY to_jsonb(rows)::text), '')) FROM community_audit_log rows),
    'admissionWindows', (SELECT md5(COALESCE(string_agg(to_jsonb(rows)::text, E'\\n' ORDER BY to_jsonb(rows)::text), '')) FROM community_admission_windows rows),
    'admissionEvents', (SELECT md5(COALESCE(string_agg(to_jsonb(rows)::text, E'\\n' ORDER BY to_jsonb(rows)::text), '')) FROM community_admission_events rows),
    'tusUploads', (SELECT md5(COALESCE(string_agg(to_jsonb(rows)::text, E'\\n' ORDER BY to_jsonb(rows)::text), '')) FROM community_tus_uploads rows)
  ),
  'blobReferences', COALESCE((
    SELECT json_agg(json_build_object(
      'key', blob_key,
      'sha256', package_sha256,
      'size', actual_size
    ) ORDER BY blob_key)
    FROM (
      SELECT DISTINCT blob_key, package_sha256, actual_size
      FROM community_submissions
      WHERE blob_key IS NOT NULL
    ) blobs
  ), '[]'::json)
)::text;
`;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const requireText = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} is required.`);
  return value;
};

const assertAbsent = async (target, label) => {
  try {
    await access(target);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`${label} already exists: ${target}`);
};

const databaseEndpoint = (databaseUrl) => {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('Database URL must be a PostgreSQL connection URL.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.pathname.length < 2
  )
    throw new Error('Database URL must identify a PostgreSQL host and database.');
  for (const parameter of ['host', 'port', 'dbname', 'service'])
    if (parsed.searchParams.has(parameter))
      throw new Error(`Database URL target parameter is unsupported for rehearsal: ${parameter}`);
  return `${parsed.hostname.toLowerCase()}:${parsed.port || '5432'}${parsed.pathname}`;
};

const databaseIdentity = (databaseUrl) => `database_${sha256(databaseEndpoint(databaseUrl))}`;
const blobIdentity = (blobRoot) => `blob-root_${sha256(path.resolve(blobRoot))}`;

const canonicalInspection = (inspection) => {
  if (!inspection || typeof inspection !== 'object' || Array.isArray(inspection))
    throw new Error('Recovery semantic inspection must be an object.');
  if (inspection.schemaRevision !== 3)
    throw new Error('Recovery semantic inspection schema revision is unsupported.');
  const counts = {};
  for (const key of COUNT_KEYS) {
    const count = Number(inspection.counts?.[key]);
    if (!Number.isSafeInteger(count) || count < 0)
      throw new Error(`Recovery semantic inspection count is invalid: ${key}`);
    counts[key] = count;
  }
  const submissionStatusCounts = {};
  for (const [status, rawCount] of Object.entries(inspection.submissionStatusCounts ?? {}).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    if (!/^[a-z]+(?:-[a-z]+)*$/u.test(status))
      throw new Error(`Recovery semantic inspection status is invalid: ${status}`);
    const count = Number(rawCount);
    if (!Number.isSafeInteger(count) || count < 1)
      throw new Error(`Recovery semantic inspection status count is invalid: ${status}`);
    submissionStatusCounts[status] = count;
  }
  if (
    Object.values(submissionStatusCounts).reduce((sum, count) => sum + count, 0) !==
    counts.submissions
  )
    throw new Error('Recovery semantic inspection submission status totals do not match.');
  const tableFingerprints = {};
  for (const key of TABLE_FINGERPRINT_KEYS) {
    const fingerprint = inspection.tableFingerprints?.[key];
    if (!/^[a-f0-9]{32}$/u.test(fingerprint ?? ''))
      throw new Error(`Recovery semantic table fingerprint is invalid: ${key}`);
    tableFingerprints[key] = fingerprint;
  }
  if (!Array.isArray(inspection.blobReferences))
    throw new Error('Recovery semantic inspection blob references must be an array.');
  const blobReferences = inspection.blobReferences.map((reference) => {
    const match = PACKAGE_KEY.exec(reference?.key ?? '');
    const size = Number(reference?.size);
    if (
      !match ||
      match[1] !== match[2].slice(0, 2) ||
      reference.sha256 !== match[2] ||
      !SHA256.test(reference.sha256) ||
      !Number.isSafeInteger(size) ||
      size < 1
    )
      throw new Error('Recovery semantic inspection contains an invalid blob reference.');
    return { key: reference.key, sha256: reference.sha256, size };
  });
  blobReferences.sort((left, right) => left.key.localeCompare(right.key));
  for (let index = 1; index < blobReferences.length; index += 1)
    if (blobReferences[index - 1].key === blobReferences[index].key)
      throw new Error('Recovery semantic inspection contains duplicate blob references.');
  return {
    schemaRevision: 3,
    counts,
    submissionStatusCounts,
    tableFingerprints,
    blobReferences,
  };
};

const semanticFingerprint = (inspection) => sha256(JSON.stringify(inspection));

const assertReferencedBlobs = (inspection, manifest) => {
  const inventory = new Map(manifest.blobs.map((blob) => [blob.key, blob]));
  for (const reference of inspection.blobReferences) {
    const stored = inventory.get(reference.key);
    if (!stored || stored.sha256 !== reference.sha256 || Number(stored.size) !== reference.size)
      throw new Error(
        `Database references a package absent from the recovery snapshot: ${reference.key}`,
      );
  }
};

const atomicWriteJson = async (file, value) => {
  const target = path.resolve(file);
  await assertAbsent(target, 'Recovery rehearsal receipt');
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.partial`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  await rename(temporary, target);
};

export function planRecoveryRehearsal({
  sourceDatabaseUrl,
  sourceBlobRoot,
  targetDatabaseUrl,
  targetBlobRoot,
}) {
  const sourceDatabase = databaseIdentity(requireText(sourceDatabaseUrl, 'Source database URL'));
  const targetDatabase = databaseIdentity(requireText(targetDatabaseUrl, 'Target database URL'));
  const sourceBlobs = blobIdentity(requireText(sourceBlobRoot, 'Source blob root'));
  const targetBlobs = blobIdentity(requireText(targetBlobRoot, 'Target blob root'));
  if (sourceDatabase === targetDatabase)
    throw new Error('Recovery rehearsal source and target databases must differ.');
  if (sourceBlobs === targetBlobs)
    throw new Error('Recovery rehearsal source and target blob roots must differ.');
  return Object.freeze({ sourceDatabase, targetDatabase, sourceBlobs, targetBlobs });
}

export async function inspectRecoveryDatabase({ databaseUrl, runCommand }) {
  if (typeof runCommand !== 'function') throw new Error('runCommand is required.');
  const output = await runCommand(
    'psql',
    [
      '--no-psqlrc',
      '--set=ON_ERROR_STOP=1',
      '--tuples-only',
      '--no-align',
      '--command',
      RECOVERY_SEMANTIC_INSPECTION_SQL,
    ],
    { databaseUrl: requireText(databaseUrl, 'Database URL'), captureOutput: true },
  );
  if (typeof output !== 'string' || output.trim().length === 0)
    throw new Error('PostgreSQL semantic inspection returned no result.');
  let decoded;
  try {
    decoded = JSON.parse(output.trim());
  } catch {
    throw new Error('PostgreSQL semantic inspection returned invalid JSON.');
  }
  return canonicalInspection(decoded);
}

export async function rehearseCommunityRecovery({
  sourceDatabaseUrl,
  sourceBlobRoot,
  targetDatabaseUrl,
  targetBlobRoot,
  workDirectory,
  receiptFile,
  expectedTargetIdentity,
  runCommand,
  inspectDatabase = ({ databaseUrl }) => inspectRecoveryDatabase({ databaseUrl, runCommand }),
  clock = () => new Date(),
}) {
  if (typeof runCommand !== 'function') throw new Error('runCommand is required.');
  const plan = planRecoveryRehearsal({
    sourceDatabaseUrl,
    sourceBlobRoot,
    targetDatabaseUrl,
    targetBlobRoot,
  });
  if (expectedTargetIdentity !== plan.targetDatabase)
    throw new Error(
      `Target confirmation does not match the planned recovery target (${plan.targetDatabase}).`,
    );
  const workspace = path.resolve(requireText(workDirectory, 'Rehearsal work directory'));
  const receipt = path.resolve(requireText(receiptFile, 'Rehearsal receipt file'));
  await assertAbsent(workspace, 'Recovery rehearsal work directory');
  await assertAbsent(receipt, 'Recovery rehearsal receipt');

  const sourceInspection = canonicalInspection(
    await inspectDatabase({ databaseUrl: sourceDatabaseUrl, role: 'source' }),
  );
  const snapshotDirectory = path.join(workspace, 'snapshot');
  const created = await createRecoverySnapshot({
    databaseUrl: sourceDatabaseUrl,
    blobRoot: sourceBlobRoot,
    destination: snapshotDirectory,
    runCommand,
  });
  const manifest = await verifyRecoverySnapshot({ source: snapshotDirectory });
  if (created.snapshotId !== manifest.snapshotId)
    throw new Error('Recovery snapshot changed between creation and verification.');
  assertReferencedBlobs(sourceInspection, manifest);

  await restoreRecoverySnapshot({
    databaseUrl: targetDatabaseUrl,
    blobRoot: targetBlobRoot,
    source: snapshotDirectory,
    runCommand,
  });
  const targetInspection = canonicalInspection(
    await inspectDatabase({ databaseUrl: targetDatabaseUrl, role: 'target' }),
  );
  assertReferencedBlobs(targetInspection, manifest);
  const sourceFingerprint = semanticFingerprint(sourceInspection);
  const targetFingerprint = semanticFingerprint(targetInspection);
  if (sourceFingerprint !== targetFingerprint)
    throw new Error('Restored database does not match the source semantic inspection.');

  const completedAt = clock();
  if (!(completedAt instanceof Date) || !Number.isFinite(completedAt.getTime()))
    throw new Error('Recovery rehearsal clock returned an invalid date.');
  const receiptValue = {
    format: RECOVERY_REHEARSAL_RECEIPT_FORMAT,
    outcome: 'passed',
    completedAt: completedAt.toISOString(),
    snapshotId: manifest.snapshotId,
    source: { databaseIdentity: plan.sourceDatabase, blobRootIdentity: plan.sourceBlobs },
    target: { databaseIdentity: plan.targetDatabase, blobRootIdentity: plan.targetBlobs },
    evidence: {
      semanticFingerprint: sourceFingerprint,
      counts: sourceInspection.counts,
      submissionStatusCounts: sourceInspection.submissionStatusCounts,
      referencedBlobCount: sourceInspection.blobReferences.length,
      storedBlobCount: manifest.blobs.length,
      storedBlobBytes: manifest.blobs.reduce((sum, blob) => sum + blob.size, 0),
      databaseDumpSha256: manifest.database.sha256,
    },
    checks: [
      'source-target-identities-distinct',
      'snapshot-bytes-verified',
      'database-blob-references-present',
      'restore-journal-completed',
      'source-target-semantics-equal',
    ],
  };
  await atomicWriteJson(receipt, receiptValue);
  return Object.freeze(receiptValue);
}
