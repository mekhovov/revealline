// Test-only immutable execution readback; production admission never imports this helper.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
export const RUNTIME73_EXECUTED_WITNESS =
  'docs/performance/fixtures/solo-73a345-consumer/570-executed-source.json';
export const RUNTIME73_EXECUTED_WORKFLOW =
  'docs/performance/fixtures/solo-73a345-consumer/570-workflow.yml';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function executed73Source(bytes, manifestBytes, workflowBytes) {
  assert.equal(bytes.length, 12813);
  assert.equal(sha(bytes), 'd06b0a23272a16a09eb0855032f221879bdfad72d20014c334759bb96bd4a8b1');
  const witness = JSON.parse(bytes);
  assert.equal(witness.format, 'Solo73ExecutedConsumerSourceV1');
  assert.equal(witness.postHocExactGitReadback, true);
  assert.equal(witness.revision, '570ca4ffe57f75c342e2d99b62a04a8b62b740a0');
  assert.equal(witness.tree, '7e2ded8a289aa73949e67dfcaed46f5c6ca08cff');
  assert.equal(witness.run, 39105055762);
  assert.equal(witness.manifest.path, 'docs/performance/solo-remote-73a345-correctness-plan.json');
  const records = new Map(witness.records.map((ref) => [ref.path, ref]));
  assert.equal(records.size, witness.records.length);
  for (const [path, value] of [
    [witness.manifest.path, manifestBytes],
    ['.github/workflows/solo-native-package-consumer.yml', workflowBytes],
  ]) {
    assert.equal(value.length, records.get(path)?.bytes, path);
    assert.equal(sha(value), records.get(path)?.sha256, path);
  }
  return new Map(witness.manifest.references.map((path) => [path, records.get(path)]));
}
export function assertExecuted73Ref(refs, ref) {
  const old = refs.get(ref.path);
  assert(old, ref.path);
  assert.equal(ref.bytes, old.bytes, ref.path);
  assert.equal(ref.sha256, old.sha256, ref.path);
}
export async function readExecuted73Source() {
  const [bytes, manifestBytes, workflowBytes] = await Promise.all([
    readFile(new URL(RUNTIME73_EXECUTED_WITNESS, root)),
    readFile(new URL('docs/performance/solo-remote-73a345-correctness-plan.json', root)),
    readFile(new URL(RUNTIME73_EXECUTED_WORKFLOW, root)),
  ]);
  return {
    refs: executed73Source(bytes, manifestBytes, workflowBytes),
    workflow: workflowBytes.toString(),
  };
}
