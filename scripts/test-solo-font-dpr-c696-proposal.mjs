// Exact reviewed source-bound release; native outcomes remain unobserved.
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
  await read('.github/workflows/solo-remote-readiness-ab45-temporary.yml')
).toString();
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
test('reviewed declaration admits six unchanged bounded rows while current bytes are frozen', async () => {
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
  for (const ref of refs) {
    const b = await read(ref.path);
    assert.equal(b.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(b).digest('hex'), ref.sha256, ref.path);
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
