// Test-side provenance for the immutable a7e dispatch. Runtime admission still
// reads and hashes every file from its own checked-out execution revision.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const FINAL_WAVE_WITNESS_PATH =
  'docs/performance/fixtures/solo-final-wave/a7e-execution-source.json';
const root = new URL('../', import.meta.url);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function validateFinalWaveWitness(bytes) {
  assert.equal(sha(bytes), '19f40a8a688924bbc081a48881608b514efee95ad828425de4eabd294bf9c330');
  const witness = JSON.parse(bytes);
  assert.equal(witness.format, 'SoloDispatchedExecutionSourceWitnessV1');
  assert.equal(witness.revision, 'a7e0219818842f02399317ca6d2a14bdd506da3d');
  assert.equal(witness.tree, '3af3539969845d19c67dd86675aad1c16fa2dfb9');
  assert.equal(witness.releases.length, 13);
  assert.equal(new Set(witness.files.map((f) => f.path)).size, witness.files.length);
  return witness;
}

export async function assertFinalWaveBindings(manifestPath, references, workflowPath) {
  const witness = validateFinalWaveWitness(await readFile(new URL(FINAL_WAVE_WITNESS_PATH, root)));
  const files = new Map(witness.files.map((f) => [f.path, f]));
  const release = witness.releases.find((entry) => entry.workflow === workflowPath);
  assert(release && Object.hasOwn(release.manifests, manifestPath), 'Unwitnessed release');
  for (const path of [manifestPath, workflowPath]) {
    const bytes = await readFile(new URL(path, root));
    assert.equal(bytes.length, files.get(path)?.bytes, path);
    assert.equal(sha(bytes), files.get(path)?.sha256, path);
  }
  for (const ref of references) {
    assert(release.manifests[manifestPath].includes(ref.path), ref.path);
    const actual = files.get(ref.path);
    assert.equal(ref.bytes, actual?.bytes, ref.path);
    assert.equal(ref.sha256, actual?.sha256, ref.path);
  }
}
