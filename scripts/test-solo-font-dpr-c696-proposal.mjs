// Exact executed source-bound release. Original native failures remain unchanged.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  FONT_DPR_C696_COHORT,
  SELECTED_FONT_SOURCE,
  FONT_DPR_PROTOCOL,
  SELECTED_FONT_JOINED_FIXTURE,
  COMPACT_READINESS_FIXTURES,
  bindReadinessJob,
  readinessArguments,
} from './solo-remote-readiness.mjs';
const read = (p) => readFile(new URL('../' + p, import.meta.url));
const m = JSON.parse(await read('docs/performance/solo-readiness-font-dpr-c696-plan.json'));
const original = JSON.parse(await read('docs/performance/solo-readiness-font-c696-plan.json'));
const workflow = (
  await read('docs/performance/fixtures/solo-readiness-font/e1cc-executed-workflow.yml')
).toString();

const witnessPath = 'docs/performance/fixtures/solo-readiness-font/e1cc-execution-source.json';
const witnessSHA256 = '6338947364c7a35f58443fea23ee59fc981598ca4526fbdd4b400c57ce884590';
const historicalChangedPaths = new Set([
  'scripts/solo-qualification.mjs',
  'scripts/solo-qualification-replay-core.mjs',
  'scripts/run-solo-remote-correctness.mjs',
  'scripts/solo-remote-sustained.mjs',
  'scripts/solo-remote-readiness.mjs',
  'scripts/qualify-solo-runtime.mjs',
  'scripts/solo-qualification-readiness.mjs',
  'scripts/solo-qualification-next-route.mjs',
]);
function verifyExecutedSource(witnessBytes, declarationBytes, workflowBytes) {
  assert.equal(createHash('sha256').update(witnessBytes).digest('hex'), witnessSHA256);
  const witness = JSON.parse(witnessBytes);
  assert.equal(witness.format, 'SoloExecutedReadinessSourceV1');
  assert.equal(witness.sourceRevision, 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17');
  assert.equal(witness.sourceTree, '58f19392e25384620d896098fce8616b538e318d');
  assert.equal(witness.run, 39037875095);
  const records = new Map(witness.records.map((row) => [row.path, row]));
  assert.equal(records.size, witness.records.length);
  for (const [path, bytes] of [
    [witness.manifestPath, declarationBytes],
    [witness.workflowPath, workflowBytes],
  ]) {
    const row = records.get(path);
    assert.equal(bytes.length, row.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
  }
  return records;
}
function verify(value, text) {
  assert.equal(value.status, 'reviewed-readiness-diagnostic-only');
  assert.equal(value.sourceCohort, FONT_DPR_C696_COHORT);
  assert.deepEqual(value.candidate, original.candidate);
  assert.equal(value.runtimeRevision, SELECTED_FONT_SOURCE.revision);
  assert.deepEqual(value.protocol, FONT_DPR_PROTOCOL);
  assert.deepEqual(value.fixture, SELECTED_FONT_JOINED_FIXTURE);
  assert.deepEqual(value.additionalFixtures, [COMPACT_READINESS_FIXTURES.full]);
  assert.equal(value.release.onceOnlyBefore, '0febd334619731adc26dfa3df78aab02991563af');
  assert.equal(value.release.priorProofInspected, true);
  assert.equal(value.release.noUnclosedOwners, true);
  assert.equal(value.metadataAdmission.remoteVerificationRequired, true);
  assert.equal(value.metadataAdmission.metadataArtifact, 12100751601);
  assert.deepEqual(value.metadataAdmission.packageBinding, {
    path: '.cache/solo-followup/remote-c696-39028705715/appearance-retained/members/package-binding.json',
    bytes: 7776,
    sha256: '8a85e5bce913c33c549a53ac608e51c21d33d2fda9058c0e839f227b2fcbca65',
  });
  assert.equal(value.pendingBindings.length, 0);
  assert.deepEqual(value.release.priorOwnerReceipt, {
    path: '.cache/solo-followup/font-dpr-c696-proposal/prior-owner-readback.json',
    bytes: 7970,
    sha256: 'f557301a2967efc7caff296e4f28d9c09c36663fc5b69117b195e947f0df0ef1',
  });
  assert.deepEqual(value.release.currentSourceFirstEight, {
    run: 39032516813,
    source: SELECTED_FONT_SOURCE.revision,
    passed: 8,
    required: 8,
    performanceExcluded: true,
  });
  assert.equal(value.priorHeldProposal.producer, 39032516871);
  assert.equal(value.priorHeldProposal.conclusion, 'failure');
  assert.equal(value.priorHeldProposal.packageAvailable, false);
  assert.equal(
    text.split('\n').find((s) => s.startsWith('    if: ')),
    "    if: github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '0febd334619731adc26dfa3df78aab02991563af'",
  );
  assert.equal(value.cpu, 1);
  assert.equal(value.automaticRetries, 0);
  assert.equal(value.rowEvidenceBytes, 32 * 1024 ** 2);
  assert.equal(value.evidenceBytes, 256 * 1024 ** 2);
  assert.equal(value.setupTimeoutMs, 40 * 60000);
  assert.equal(value.helperTimeoutMs, 75 * 60000);
  const sparse = [...text.matchAll(/^            \/([^\n]+)$/gm)].map((m) => m[1]);
  assert.equal(new Set(sparse).size, sparse.length, 'No duplicate sparse paths');
  for (const path of [
    'docs/performance/solo-readiness-font-dpr-0feb-plan.json',
    'docs/performance/solo-readiness-font-dpr-c696-plan.json',
    'docs/performance/fixtures/solo-readiness-font/06bfe-held-source.json',
    'docs/performance/fixtures/solo-readiness-font/06bfe-held-workflow.yml',
  ])
    assert(sparse.includes(path), path);
}
test('reviewed same-source c696 release uses verified115 metadata and cannot borrow failed117 authority', () => {
  verify(m, workflow);
  assert.equal(bindReadinessJob(m, 'webkit').rows.length, 5);
  for (const change of [
    (p) => p.candidate.artifact++,
    (p) => (p.candidate.inner.sha256 = '0'.repeat(64)),
    (p) => (p.runtimeRevision = '0febd334619731adc26dfa3df78aab02991563af'),
    (p) => (p.release.onceOnlyBefore = SELECTED_FONT_SOURCE.revision),
    (p) => (p.metadataAdmission.remoteVerificationRequired = false),
    (p) => (p.priorHeldProposal.packageAvailable = true),
  ]) {
    const p = structuredClone(m);
    change(p);
    assert.throws(() => verify(p, workflow));
  }
  for (const path of [
    'docs/performance/solo-readiness-font-dpr-0feb-plan.json',
    'docs/performance/fixtures/solo-readiness-font/06bfe-held-source.json',
  ]) {
    assert.throws(() => verify(m, workflow.replace('            /' + path + '\n', '')));
    assert.throws(() => verify(m, workflow + '            /' + path + '\n'));
  }
  assert.throws(() =>
    verify(
      m,
      workflow.replace(
        "    if: github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '0febd334619731adc26dfa3df78aab02991563af'",
        '    if: true',
      ),
    ),
  );
});
test('executed declaration preserves six original bounded rows and exact historical source authority', async () => {
  for (const engine of ['chromium', 'webkit']) {
    const p = bindReadinessJob(m, engine);
    assert.equal(p.rows.length, engine === 'webkit' ? 5 : 1);
    for (const row of p.rows) {
      const args = readinessArguments(
        { plan: p, here: '/tools/scripts', repository: '/tools' },
        row,
        'http://localhost/game/',
        '/out',
      );
      assert(args.includes('--source-revision=' + SELECTED_FONT_SOURCE.revision));
      assert(args.includes('--cpu=1'));
      assert(args.includes('--hitch-journal'));
      assert.equal(row.timeoutMs, 480000);
      if (row.kind === 'readiness')
        assert(args.includes('--readiness-probe=selected-font-cancel-joined-v2'));
      else {
        assert(args.includes('--visual-quality-observation=full'));
        assert(args.includes('--dpr=' + row.dpr));
      }
    }
  }
  const refs = [...m.adapterInputs, ...m.frozenTools, m.fixture, ...m.additionalFixtures];
  assert.equal(new Set(refs.map((r) => r.path)).size, refs.length);
  assert(refs.length > 25 && refs.length < 70);
  const witness = verifyExecutedSource(
    await read(witnessPath),
    await read('docs/performance/solo-readiness-font-dpr-c696-plan.json'),
    Buffer.from(workflow),
  );
  assert.equal(witness.size, refs.length + 2);
  for (const ref of refs) {
    const historical = witness.get(ref.path);
    assert(historical, ref.path);
    assert.equal(historical.bytes, ref.bytes, ref.path);
    assert.equal(historical.sha256, ref.sha256, ref.path);
    if (!historicalChangedPaths.has(ref.path)) {
      const b = await read(ref.path);
      assert.equal(b.length, ref.bytes, ref.path);
      assert.equal(createHash('sha256').update(b).digest('hex'), ref.sha256, ref.path);
    }
    assert(workflow.includes('            /' + ref.path + '\n'), ref.path);
  }
  for (const item of [
    'timeout-minutes: 130',
    'timeout-minutes: 78',
    'timeout --signal=TERM --kill-after=30s 4620s',
    'scripts/test-solo-source-verifier-smoke.mjs ',
    'scripts/test-solo-font-dpr-c696-proposal.mjs ',
    'cancel-in-progress: false',
    'fail-fast: false',
  ])
    assert(workflow.includes(item), item);
  assert.equal(
    [
      ...workflow.matchAll(/^        timeout-minutes: (\d+)$/gm),
      ...workflow.matchAll(/^      - timeout-minutes: (\d+)$/gm),
    ].reduce((n, m) => n + Number(m[1]), 0),
    122,
  );
});

test('executed witness rejects changed declaration, workflow and source receipt', async () => {
  const witness = await read(witnessPath),
    declaration = await read('docs/performance/solo-readiness-font-dpr-c696-plan.json');
  verifyExecutedSource(witness, declaration, Buffer.from(workflow));
  for (const [a, b, c] of [
    [Buffer.concat([witness, Buffer.from(' ')]), declaration, Buffer.from(workflow)],
    [witness, Buffer.concat([declaration, Buffer.from(' ')]), Buffer.from(workflow)],
    [witness, declaration, Buffer.from(workflow + ' ')],
  ])
    assert.throws(() => verifyExecutedSource(a, b, c));
  const changed = JSON.parse(witness);
  changed.records[2].sha256 = '0'.repeat(64);
  assert.throws(() =>
    verifyExecutedSource(Buffer.from(JSON.stringify(changed)), declaration, Buffer.from(workflow)),
  );
});
