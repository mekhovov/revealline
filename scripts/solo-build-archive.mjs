import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { open, readFile, realpath, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

export function soloBuildVerificationArguments(args) {
  const [artifact, output, ...flags] = args;
  assert(
    artifact && output && !artifact.startsWith('--') && !output.startsWith('--'),
    'Usage: node scripts/verify-solo-build.mjs <finished artifact directory> <new-report.json> [--source=<directory>] [--base=<git ref>] [--archive=<external distribution.zip> --archive-receipt=<independent extraction report>]',
  );
  const result = { artifact, output };
  for (const flag of flags) {
    const match = /^--(source|base|archive|archive-receipt)=(.+)$/.exec(flag);
    assert(
      match && !Object.hasOwn(result, match[1]),
      'Invalid or duplicate build verification option.',
    );
    result[match[1]] = match[2];
  }
  assert(
    Boolean(result.archive) === Boolean(result['archive-receipt']),
    'An external --archive requires its independent --archive-receipt (and vice versa).',
  );
  return result;
}

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const unchanged = (before, after) =>
  ['size', 'dev', 'ino', 'mtimeMs', 'ctimeMs'].every((key) => before[key] === after[key]);
async function boundedRead(file, limit) {
  const info = await stat(file);
  assert(info.isFile() && info.size <= limit, 'Invalid or oversized archive evidence file.');
  const bytes = await readFile(file);
  assert(
    bytes.length <= limit && unchanged(info, await stat(file)),
    'Archive evidence changed during reading.',
  );
  return bytes;
}

/** Recompute archive identity, then bind the independent member-verification
 * receipt to that identity and the freshly checked local payload manifest.
 * This is composed evidence, not a second ZIP parser or a trust in old hashes. */
export async function verifyExternalBuildArchive({
  archive,
  receipt,
  artifactRoot,
  manifestBytes,
}) {
  const archivePath = await realpath(archive);
  const sidecarPath = await realpath(`${resolve(archive)}.sha256`);
  const receiptPath = await realpath(receipt);
  const sidecarBytes = await boundedRead(sidecarPath, 4096);
  const receiptBytes = await boundedRead(receiptPath, 1024 * 1024);
  const independent = JSON.parse(receiptBytes);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(independent.status, 'passed', 'Independent ZIP member verification did not pass.');
  assert.equal(
    independent.sourceRevision,
    manifest.sourceRevision,
    'Archive receipt revision differs.',
  );
  assert.equal(
    await realpath(independent.destination),
    await realpath(artifactRoot),
    'Archive receipt is for another extracted payload.',
  );
  const manifestSHA256 = hash(manifestBytes);
  assert.equal(
    independent.manifestSHA256,
    manifestSHA256,
    'Archive receipt manifest differs from the local payload.',
  );
  assert.equal(
    independent.verifiedMembers,
    manifest.files.length + 1,
    'Archive receipt member count differs.',
  );
  assert.equal(
    independent.verifiedBytes,
    manifest.totalBytes + manifestBytes.length,
    'Archive receipt byte count differs.',
  );
  const handle = await open(archivePath, 'r');
  let bytes = 0;
  const digest = createHash('sha256');
  try {
    const before = await handle.stat();
    assert(before.isFile(), 'External archive is not a regular file.');
    for await (const chunk of handle.createReadStream({
      autoClose: false,
      highWaterMark: 1024 * 1024,
    })) {
      bytes += chunk.length;
      digest.update(chunk);
    }
    assert(
      bytes === before.size &&
        unchanged(before, await handle.stat()) &&
        unchanged(before, await stat(archivePath)),
      'External archive changed during verification.',
    );
  } finally {
    await handle.close();
  }
  const sha256 = digest.digest('hex');
  assert.equal(
    sidecarBytes.toString('utf8').trim(),
    `${sha256}  ${basename(archive)}`,
    'External archive sidecar differs from its freshly computed digest.',
  );
  assert.equal(
    independent.zipSHA256,
    sha256,
    'Independent member verification belongs to another ZIP.',
  );
  assert.equal(independent.zipBytes, bytes, 'Independent member verification ZIP length differs.');
  assert(
    (await boundedRead(sidecarPath, 4096)).equals(sidecarBytes),
    'Archive sidecar changed during verification.',
  );
  assert(
    (await boundedRead(receiptPath, 1024 * 1024)).equals(receiptBytes),
    'Independent archive receipt changed during verification.',
  );
  return {
    bytes,
    sha256,
    archivePath,
    sidecarPath,
    external: true,
    payloadManifestSHA256: manifestSHA256,
    independentMemberVerification: {
      receiptPath,
      receiptSHA256: hash(receiptBytes),
      verifiedMembers: independent.verifiedMembers,
      verifiedBytes: independent.verifiedBytes,
      sourceRevision: independent.sourceRevision,
    },
    check:
      'ZIP digest recomputed from external bytes and matched to its sidecar; independent closed-member extraction receipt is bound to this ZIP and the freshly verified local payload manifest. No ZIP copy or second expansion.',
  };
}
