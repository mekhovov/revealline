// Test-only source provenance. Execution continues to hash its actual checked-out tools.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function validateWorkerSourceWitness(bytes) {
  assert.equal(hash(bytes), '15a22436b5853469a558d1a0ff2f26db6aaac0eb1a22ba135e12f08329b6c834');
  const w = JSON.parse(bytes);
  assert.equal(w.format, 'SoloHistoricalWorkerSourceV1');
  assert.equal(w.revision, 'a7e0219818842f02399317ca6d2a14bdd506da3d');
  assert.equal(w.tree, '3af3539969845d19c67dd86675aad1c16fa2dfb9');
  assert.equal(w.files.length, 8);
  assert.equal(new Set(w.files.map((f) => f.path)).size, 8);
  return w;
}
export async function assertHistoricalWorkerBindings(manifestPath, refs) {
  const witness = validateWorkerSourceWitness(
    await readFile(
      new URL('docs/performance/fixtures/solo-worker-diagnostic/historical-a7e-source.json', root),
    ),
  );
  const release = witness.releases.find((r) => r.manifest === manifestPath);
  assert(release, 'Unwitnessed historical worker declaration');
  const files = new Map(witness.files.map((f) => [f.path, f]));
  const bytes = await readFile(new URL(manifestPath, root));
  assert.equal(bytes.length, files.get(manifestPath).bytes);
  assert.equal(hash(bytes), files.get(manifestPath).sha256);
  assert.deepEqual(
    refs.map((r) => r.path),
    release.references,
  );
  for (const ref of refs) {
    assert.equal(ref.bytes, files.get(ref.path).bytes);
    assert.equal(ref.sha256, files.get(ref.path).sha256);
  }
}
