// Test-only immutable input readback. Production admission never imports this module.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
export const demoCloseWitnessPath =
  'docs/performance/fixtures/solo-demo-797e03/d99-close-boundary-source.json';
const historicalPlans = new Set([
  'docs/performance/solo-demo-recovery-73a345-plan.json',
  'docs/performance/solo-demo-resources-73a345-plan.json',
  'docs/performance/solo-demo-recovery-797e03-plan.json',
  'docs/performance/solo-demo-resources-797e03-plan.json',
  'docs/performance/solo-demo-recovery-797e03-tooling-plan.json',
  'docs/performance/solo-demo-resources-797e03-tooling-plan.json',
]);
const changedTools = new Set([
  'scripts/solo-remote-demo.mjs',
  'scripts/solo-demo-recovery-probe.mjs',
  'scripts/observe-solo-demo-recovery.mjs',
]);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const blob = (bytes) =>
  createHash('sha1')
    .update(Buffer.from('blob ' + bytes.length + '\0'))
    .update(bytes)
    .digest('hex');
const read = (path) => readFile(new URL('../' + path, import.meta.url));
export function decodeDemoCloseWitness(bytes) {
  assert.equal(bytes.length, 115599);
  assert.equal(sha(bytes), 'e0ded260781e56c1de8e28c85492ecdc77b4380eb3e8335b3e3592c9834ce660');
  const witness = JSON.parse(bytes);
  assert.equal(witness.format, 'SoloDemoCloseDeclaredSourceV1');
  assert.equal(witness.records.length, 10);
  assert.deepEqual(witness.commits, [
    {
      revision: 'd99d5fa6a3d99da73f5ed31c12ccd9844b53124b',
      tree: '6f556027bc4bd205b898a91570bd793ad8582f7b',
    },
    {
      revision: 'ee9ece54bc9f484bc4179a20f8fd915d7933680b',
      tree: 'a449f7425a95ef867dd0b695f819d9e2c9a1cef2',
    },
  ]);
  for (const record of witness.records) {
    assert(witness.commits.some((commit) => commit.revision === record.revision));
    if (record.content !== undefined) {
      const source = Buffer.from(record.content);
      assert.equal(source.length, record.bytes);
      assert.equal(sha(source), record.sha256);
      assert.equal(blob(source), record.gitBlob);
    }
  }
  return witness;
}
const witness = decodeDemoCloseWitness(await read(demoCloseWitnessPath));
export function assertDemoCloseDeclaration(path, bytes) {
  assert(historicalPlans.has(path), 'No historical fallback for a new declaration');
  const record = witness.records.find((entry) => entry.path === path);
  assert.equal(record.revision, 'd99d5fa6a3d99da73f5ed31c12ccd9844b53124b');
  assert.equal(bytes.length, record.bytes, path);
  assert.equal(sha(bytes), record.sha256, path);
  assert.equal(blob(bytes), record.gitBlob, path);
  return JSON.parse(bytes);
}
export async function readDeclaredDemoCloseTool(planPath, ref) {
  if (!changedTools.has(ref.path)) return null;
  const declaration = assertDemoCloseDeclaration(planPath, await read(planPath));
  assert(
    [...declaration.adapterInputs, ...declaration.frozenTools].some(
      (item) => item.path === ref.path && item.bytes === ref.bytes && item.sha256 === ref.sha256,
    ),
    'Requested reference must be declared by the immutable plan',
  );
  const record = witness.records.find(
    (entry) =>
      entry.path === ref.path &&
      entry.bytes === ref.bytes &&
      entry.sha256 === ref.sha256 &&
      typeof entry.content === 'string',
  );
  assert(record, 'Exact historical tool bytes required');
  return Buffer.from(record.content);
}
