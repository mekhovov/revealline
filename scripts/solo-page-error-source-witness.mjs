// Test-side historical provenance only. Runtime admission still hashes every
// current execution dependency; this helper is not imported by an adapter.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const PAGE_ERROR_WITNESS_PATH =
  'docs/performance/fixtures/solo-error-witness/historical-source.json';
const helperPaths = [
  'scripts/qualify-solo-runtime.mjs',
  'scripts/solo-qualification-observation.mjs',
];

export function validatePageErrorSourceWitness(bytes) {
  assert.equal(hash(bytes), 'bd4cf5958d433d557639999cc5fed9cd3e82fc8fe24520b25a7bbcac1788ea2c');
  const witness = JSON.parse(bytes);
  assert.equal(witness.format, 'SoloQualificationErrorWitnessSourceV1');
  assert.deepEqual(
    witness.sources.map((source) => source.revision),
    [
      'c41a02216c0811952232a387fd1743e09452c269',
      '69639b30d985ffa723a4d0c11756b632fc2da5c1',
      '9e0111e066b5dac7749a33fd0e98e92702851dc6',
    ],
  );
  return witness;
}

export function historicalPageErrorRefs(
  witness,
  manifestPath,
  workflowPath,
  manifestBytes,
  workflowBytes,
) {
  const source = witness.sources.find((s) =>
    s.releases.some((r) => r.manifest === manifestPath && r.workflow === workflowPath),
  );
  assert(source, 'Unwitnessed historical declaration');
  for (const [path, bytes] of [
    [manifestPath, manifestBytes],
    [workflowPath, workflowBytes],
  ]) {
    const expected = source.refs.find((ref) => ref.path === path);
    assert.equal(bytes.length, expected?.bytes, path);
    assert.equal(hash(bytes), expected?.sha256, path);
  }
  return new Map(
    source.refs.filter((ref) => helperPaths.includes(ref.path)).map((ref) => [ref.path, ref]),
  );
}

export async function readHistoricalPageErrorRefs(manifestPath, workflowPath) {
  const witness = validatePageErrorSourceWitness(
    await readFile(new URL(PAGE_ERROR_WITNESS_PATH, root)),
  );
  return historicalPageErrorRefs(
    witness,
    manifestPath,
    workflowPath,
    await readFile(new URL(manifestPath, root)),
    await readFile(new URL(workflowPath, root)),
  );
}
