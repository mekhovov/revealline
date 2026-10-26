// Test-only executed-source readback. No production admission imports this file.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
export const DE332_EXECUTED_WITNESS =
  'docs/performance/fixtures/solo-de332-consumer/executed-source.json';
export const DE332_EXECUTED_WORKFLOW =
  'docs/performance/fixtures/solo-de332-consumer/68ad-workflow.yml';
const workflowPath = '.github/workflows/solo-native-package-consumer.yml';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function executedDe332Source(bytes, manifestPath, manifestBytes, workflowBytes) {
  assert.equal(bytes.length, 32621);
  assert.equal(sha(bytes), '4e0c6b8cf361586f3c4f97f31ca624e022bdb548b80d39dd1c9acc2a45ab1304');
  const witness = JSON.parse(bytes);
  assert.equal(witness.format, 'SoloDe332ExecutedConsumerSourceV1');
  assert.equal(witness.postHocExactGitReadback, true);
  const source = witness.sources.find(
    (value) => value.revision === '68ad6a4730ae558cbfd14abf59800c8e462b1dc9',
  );
  const manifest = source.manifests.find((value) => value.path === manifestPath);
  assert(manifest, 'Unwitnessed executed declaration');
  const refs = new Map(source.records.map((value) => [value.path, value]));
  assert.equal(refs.size, source.records.length);
  for (const [path, value] of [
    [manifestPath, manifestBytes],
    [workflowPath, workflowBytes],
  ]) {
    assert.equal(value.length, refs.get(path)?.bytes, path);
    assert.equal(sha(value), refs.get(path)?.sha256, path);
  }
  // The first-eight run used 3e640; independently preserve its identical plan
  // and runtime inputs, rather than attributing that run to the later workflow.
  if (manifestPath === 'docs/performance/solo-remote-de332-correctness-plan.json') {
    const initial = witness.sources.find((value) => value.run === 39096176143);
    for (const path of [manifestPath, ...manifest.references]) {
      const old = initial.records.find((value) => value.path === path);
      assert.equal(old?.bytes, refs.get(path)?.bytes, path);
      assert.equal(old?.sha256, refs.get(path)?.sha256, path);
    }
  }
  return new Map(manifest.references.map((path) => [path, refs.get(path)]));
}

export async function readExecutedDe332Source(manifestPath) {
  const [bytes, manifestBytes, workflowBytes] = await Promise.all([
    readFile(new URL(DE332_EXECUTED_WITNESS, root)),
    readFile(new URL(manifestPath, root)),
    readFile(new URL(DE332_EXECUTED_WORKFLOW, root)),
  ]);
  return {
    refs: executedDe332Source(bytes, manifestPath, manifestBytes, workflowBytes),
    workflow: workflowBytes.toString(),
  };
}

export function assertExecutedDe332Ref(refs, ref) {
  const old = refs.get(ref.path);
  assert(old, ref.path);
  assert.equal(ref.bytes, old.bytes, ref.path);
  assert.equal(ref.sha256, old.sha256, ref.path);
}
