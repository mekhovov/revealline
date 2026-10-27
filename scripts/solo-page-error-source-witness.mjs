// Test-side historical provenance only. Runtime admission still hashes every
// current execution dependency; this helper is not imported by an adapter.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
// Active sparse consumers retain their original input closure. Only the finite
// retired declarations need the additional preserved source fixture.
async function readSoloDiagnosticSource(path) {
  const retired =
    /^\.github\/workflows\/solo-remote-final-(?:lifecycle-(?:long29|next|retry)|soak(?:-v2)?|timing-(?:cold-first30|warm-first30|sentry|long-rail)(?:-v2)?)-temporary\.yml$/;
  if (!retired.test(path)) return readFile(new URL(path, root));
  const historical = await import('./solo-retired-diagnostic-source.mjs');
  return historical.readSoloDiagnosticSource(path);
}

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const PAGE_ERROR_WITNESS_PATH =
  'docs/performance/fixtures/solo-error-witness/historical-source.json';
export const READINESS_PRIOR_TOOLS_PATH =
  'docs/performance/fixtures/solo-readiness/prior-tools-source.json';
const readinessHelperPaths = [
  'scripts/run-solo-remote-correctness.mjs',
  'scripts/solo-remote-sustained.mjs',
];
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

export function validateReadinessPriorToolsWitness(bytes) {
  assert.equal(hash(bytes), '451def5929572e7c39acb7d12788946bbfb30e0d4f1bac10c9456d1e1981bb7a');
  const witness = JSON.parse(bytes);
  assert.equal(witness.format, 'SoloReadinessPriorToolsWitnessV1');
  assert.deepEqual(
    witness.sources.map(({ revision, tree }) => [revision, tree]),
    [
      ['c41a02216c0811952232a387fd1743e09452c269', '7fff7e134c67aa268e63cab5b08a7f3473bb5703'],
      ['69639b30d985ffa723a4d0c11756b632fc2da5c1', 'd022c57efa75dbe7b7aeeca00a1950f61426595b'],
      ['9e0111e066b5dac7749a33fd0e98e92702851dc6', '780fdfcb84a1d5cc6009b697879a98fbe39d0487'],
    ],
  );
  return witness;
}

export function historicalReadinessToolRefs(
  witness,
  manifestPath,
  workflowPath,
  manifestBytes,
  workflowBytes,
) {
  const source = witness.sources.find((s) =>
    s.releases.some((r) => r.manifest === manifestPath && r.workflow === workflowPath),
  );
  assert(source, 'Unwitnessed readiness predecessor declaration');
  for (const [path, bytes] of [
    [manifestPath, manifestBytes],
    [workflowPath, workflowBytes],
  ]) {
    const expected = source.refs.find((ref) => ref.path === path);
    assert.equal(bytes.length, expected?.bytes, path);
    assert.equal(hash(bytes), expected?.sha256, path);
  }
  return new Map(
    source.refs
      .filter((ref) => readinessHelperPaths.includes(ref.path))
      .map((ref) => [ref.path, ref]),
  );
}

export async function readHistoricalPageErrorRefs(manifestPath, workflowPath) {
  const witness = validatePageErrorSourceWitness(
    await readFile(new URL(PAGE_ERROR_WITNESS_PATH, root)),
  );
  const readinessWitness = validateReadinessPriorToolsWitness(
    await readFile(new URL(READINESS_PRIOR_TOOLS_PATH, root)),
  );
  const manifestBytes = await readFile(new URL(manifestPath, root));
  const workflowBytes = await readSoloDiagnosticSource(workflowPath);
  const refs = historicalReadinessToolRefs(
    readinessWitness,
    manifestPath,
    workflowPath,
    manifestBytes,
    workflowBytes,
  );
  // The original observation witness remains immutable. The later offline
  // consumer needs only the independently bound runner, not observation refs.
  if (
    witness.sources.some((s) =>
      s.releases.some((r) => r.manifest === manifestPath && r.workflow === workflowPath),
    )
  ) {
    for (const [path, ref] of historicalPageErrorRefs(
      witness,
      manifestPath,
      workflowPath,
      manifestBytes,
      workflowBytes,
    )) {
      assert(!refs.has(path), 'Historical helper witness overlap');
      refs.set(path, ref);
    }
  }
  return refs;
}

// Additional immutable source authority for completed historical declarations.
// A new declaration is deliberately not recognized by this test-only reader.
export const QUALIFICATION_TOOL_WITNESS_PATH =
  'docs/performance/fixtures/solo-representative/prior-qualification-tools.json';
export function historicalQualificationRefs(
  bytes,
  manifestPath,
  workflowPath,
  manifestBytes,
  workflowBytes,
) {
  assert.equal(hash(bytes), '9418521e3e90d3e67e66bd331e8c456d989ac178524a3507c6b09ed1d6d3e958');
  const witness = JSON.parse(bytes);
  assert.equal(witness.format, 'SoloQualificationHistoricalToolSupplementV1');
  assert.equal(witness.postHocExactGitReadback, true);
  assert.deepEqual(
    witness.sources.map((s) => [s.revision, s.tree]),
    [
      ['c41a02216c0811952232a387fd1743e09452c269', '7fff7e134c67aa268e63cab5b08a7f3473bb5703'],
      ['69639b30d985ffa723a4d0c11756b632fc2da5c1', 'd022c57efa75dbe7b7aeeca00a1950f61426595b'],
      ['7c7cc2648331870683ac7b76850bbeff859f802e', 'e20aabb50c0e82c52c0970a14934b2d05611f53e'],
    ],
  );
  const source = witness.sources.find((s) =>
    s.releases.some((r) => r.manifest === manifestPath && r.workflow === workflowPath),
  );
  assert(source, 'Unwitnessed historical qualification release');
  const release = source.releases.find(
    (r) => r.manifest === manifestPath && r.workflow === workflowPath,
  );
  const refs = new Map(source.records.map((r) => [r.path, r]));
  assert.equal(refs.size, source.records.length);
  for (const [path, content] of [
    [manifestPath, manifestBytes],
    [workflowPath, workflowBytes],
  ]) {
    const ref = refs.get(path);
    assert(ref, path);
    assert.equal(content.length, ref.bytes, path);
    assert.equal(hash(content), ref.sha256, path);
  }
  return new Map(
    release.references.map((path) => {
      const ref = refs.get(path);
      assert(ref, path);
      return [path, ref];
    }),
  );
}
export async function readHistoricalQualificationRefs(manifestPath, workflowPath) {
  return historicalQualificationRefs(
    await readFile(new URL(QUALIFICATION_TOOL_WITNESS_PATH, root)),
    manifestPath,
    workflowPath,
    await readFile(new URL(manifestPath, root)),
    await readSoloDiagnosticSource(workflowPath),
  );
}
