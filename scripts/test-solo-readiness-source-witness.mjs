import assert from 'node:assert/strict';
import { readSoloDiagnosticSource } from './solo-retired-diagnostic-source.mjs';
import test from 'node:test';
import {
  READINESS_PRIOR_TOOLS_PATH,
  validateReadinessPriorToolsWitness,
  historicalReadinessToolRefs,
  readHistoricalPageErrorRefs,
} from './solo-page-error-source-witness.mjs';
const read = readSoloDiagnosticSource;

test('readiness tool changes retain exact executed and parked source authority', async () => {
  const bytes = await read(READINESS_PRIOR_TOOLS_PATH);
  const witness = validateReadinessPriorToolsWitness(bytes);
  let releases = 0;
  for (const source of witness.sources) {
    for (const { manifest, workflow } of source.releases) {
      releases++;
      const manifestBytes = await read(manifest),
        workflowBytes = await read(workflow);
      const refs = historicalReadinessToolRefs(
        witness,
        manifest,
        workflow,
        manifestBytes,
        workflowBytes,
      );
      assert.deepEqual([...refs.keys()].sort(), [
        'scripts/run-solo-remote-correctness.mjs',
        'scripts/solo-remote-sustained.mjs',
      ]);
      const combined = await readHistoricalPageErrorRefs(manifest, workflow);
      for (const [path, ref] of refs) assert.deepEqual(combined.get(path), ref);
      for (const args of [
        [manifest, workflow, Buffer.concat([manifestBytes, Buffer.from(' ')]), workflowBytes],
        [manifest, workflow, manifestBytes, Buffer.concat([workflowBytes, Buffer.from(' ')])],
        [manifest, 'unknown', manifestBytes, workflowBytes],
      ])
        assert.throws(() => historicalReadinessToolRefs(witness, ...args));
    }
  }
  assert.equal(releases, 12);
  for (const mutate of [
    (w) => (w.sources[0].revision = '0'.repeat(40)),
    (w) => (w.sources[0].tree = '0'.repeat(40)),
    (w) => (w.sources[0].refs[0].sha256 = '0'.repeat(64)),
    (w) => (w.sources[0].refs[0].blob = '0'.repeat(40)),
    (w) => w.sources[0].releases.pop(),
  ]) {
    const changed = structuredClone(witness);
    mutate(changed);
    assert.throws(() => validateReadinessPriorToolsWitness(Buffer.from(JSON.stringify(changed))));
  }
});
