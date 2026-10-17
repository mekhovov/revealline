// Held admission/closure controls only. No package or native execution authority.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  FONT_DPR_SOURCE,
  FONT_DPR_COHORT,
  FONT_DPR_PROTOCOL,
  SELECTED_FONT_JOINED_FIXTURE,
  COMPACT_READINESS_FIXTURES,
  readinessMatrix,
} from './solo-remote-readiness.mjs';
const read = (p) => readFile(new URL('../' + p, import.meta.url));
const plan = JSON.parse(await read('docs/performance/solo-readiness-font-dpr-0feb-plan.json'));
const workflow = (
  await read('.github/workflows/solo-remote-readiness-ab45-temporary.yml')
).toString();
test('font/DPR proposal cannot execute or borrow prior package authority', () => {
  assert.equal(plan.status, 'held-unbound-font-dpr-diagnostic');
  assert.equal(plan.sourceCohort, FONT_DPR_COHORT);
  assert.deepEqual(plan.candidate, FONT_DPR_SOURCE);
  assert.equal(plan.runtimeRevision, FONT_DPR_SOURCE.revision);
  assert.deepEqual(plan.protocol, FONT_DPR_PROTOCOL);
  assert.deepEqual(plan.fixture, SELECTED_FONT_JOINED_FIXTURE);
  assert.deepEqual(plan.additionalFixtures, [COMPACT_READINESS_FIXTURES.full]);
  assert.equal(plan.release.onceOnlyBefore, null);
  assert.equal(plan.release.priorProofInspected, false);
  assert.equal(plan.release.noUnclosedOwners, false);
  assert.equal(plan.metadataAdmission, undefined);
  assert.equal(plan.pendingBindings.length, 4);
  assert.equal(
    workflow.split('\n').find((s) => s.startsWith('    if: ')),
    '    if: false # Held until actual117 package, source/owner review and explicit release',
  );
  assert.throws(() => readinessMatrix(plan));
  assert.equal(plan.priorResults.run, 39032516742);
  assert.equal(plan.priorResults.conclusion, 'failure');
  for (const k of ['run', 'artifact', 'outer', 'inner', 'manifestSHA256'])
    assert.equal(plan.candidate[k], undefined);
});
test('prospective helpers match actual copied bytes and stay within unchanged owner/observation envelope', async () => {
  const refs = [
    ...plan.adapterInputs,
    ...plan.frozenTools,
    plan.fixture,
    ...plan.additionalFixtures,
  ];
  assert(refs.length > 25 && refs.length < 70);
  assert.equal(new Set(refs.map((r) => r.path)).size, refs.length);
  for (const ref of refs) {
    const b = await read(ref.path);
    assert.equal(b.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(b).digest('hex'), ref.sha256, ref.path);
    assert(workflow.includes('            /' + ref.path + '\n'), ref.path);
  }
  assert.equal(plan.cpu, 1);
  assert.equal(plan.automaticRetries, 0);
  assert.equal(plan.rowEvidenceBytes, 32 * 1024 ** 2);
  assert.equal(plan.evidenceBytes, 256 * 1024 ** 2);
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.equal(plan.helperTimeoutMs, 75 * 60000);
  for (const text of [
    'max-parallel: 2',
    'timeout-minutes: 130',
    'timeout-minutes: 78',
    'timeout --signal=TERM --kill-after=30s 4620s',
    'cancel-in-progress: false',
    'fail-fast: false',
    'scripts/test-solo-source-verifier-smoke.mjs ',
    'scripts/test-solo-font-dpr-proposal.mjs ',
  ])
    assert(workflow.includes(text), text);
  assert.equal(
    [
      ...workflow.matchAll(/^        timeout-minutes: (\d+)$/gm),
      ...workflow.matchAll(/^      - timeout-minutes: (\d+)$/gm),
    ].reduce((n, m) => n + Number(m[1]), 0),
    122,
  );
  for (const [revision, path] of [
    [FONT_DPR_SOURCE.revision, 'candidate'],
    [plan.baseline.revision, 'baseline'],
  ]) {
    const s = workflow.split(/\n      - /).find((s) => s.includes('path: ' + path + '\n'));
    assert(
      s?.includes('timeout-minutes: 3') &&
        s.includes('ref: ' + revision) &&
        !s.includes('sparse-checkout'),
      path,
    );
  }
});
