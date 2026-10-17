/** Read-only download binding. Never merge candidate and receipt ZIP namespaces. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateArtifactProvenance } from './pages-candidate-contract.mjs';
import { stackArtifactName } from './pages-stack-packet.mjs';

export function validateStackArtifact(metadata, kind, artifactId, expected) {
  validateArtifactProvenance(metadata, {
    artifactId,
    runId: expected.runId,
    controllerSha: expected.controllerSha,
    name: stackArtifactName(kind, expected),
  });
  assert.ok(
    typeof metadata.digest === 'string' &&
      /^sha256:[a-f0-9]{64}$/u.exec(metadata.digest)?.[0] === metadata.digest,
    'Missing GitHub ZIP digest',
  );
  assert.ok(
    Number.isSafeInteger(metadata.size_in_bytes) &&
      metadata.size_in_bytes > 0 &&
      metadata.size_in_bytes <= 1100000000,
    'Invalid ZIP size',
  );
  return metadata.digest.slice(7);
}
export async function downloadStackArtifact(metadata, kind, artifactId, expected, directory) {
  const checksum = validateStackArtifact(metadata, kind, artifactId, expected);
  assert.ok(path.isAbsolute(directory));
  const zipFile = path.join(directory, `${kind}-${artifactId}.zip`);
  const file = await fs.open(zipFile, 'wx', 0o600);
  const child = spawn(
    'gh',
    ['api', `repos/mekhovov/revealline/actions/artifacts/${artifactId}/zip`],
    { env: { ...process.env, TMPDIR: directory }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const finished = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  finished.catch(() => {}); // Handle an early spawn error until the stream loop settles.
  child.stderr.resume(); // Do not echo API diagnostics that might contain sensitive context.
  let length = 0;
  const hash = createHash('sha256');
  try {
    for await (const chunk of child.stdout) {
      length += chunk.length;
      assert.ok(length <= 1100000000, 'Oversized artifact ZIP');
      hash.update(chunk);
      await file.writeFile(chunk);
    }
    assert.equal(await finished, 0, 'Artifact download failed');
    assert.ok(length > 0);
    assert.equal(hash.digest('hex'), checksum, 'Downloaded ZIP digest differs');
  } catch (error) {
    child.kill('SIGTERM');
    await finished.catch(() => {});
    throw error;
  } finally {
    await file.close();
  }
  return {
    zipFile,
    checksum,
    bytes: length,
    output: path.join(directory, `${kind}-${artifactId}-verified`),
  };
}
