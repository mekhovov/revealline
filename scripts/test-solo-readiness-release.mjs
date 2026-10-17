import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bindReadinessJob, readinessMatrix } from './solo-remote-readiness.mjs';
const root = new URL('../', import.meta.url);
const manifestPath = 'docs/performance/solo-readiness-ab45-plan.json';
const workflowPath = '.github/workflows/solo-remote-readiness-ab45-temporary.yml';
const executedWorkflowArchive =
  'docs/performance/fixtures/solo-readiness/4bf-executed-workflow.yml';
const read = (p) => readFile(new URL(p, root));
const witnessBytes = await read(
  'docs/performance/fixtures/solo-readiness/4bf-execution-source.json',
);
assert.equal(
  createHash('sha256').update(witnessBytes).digest('hex'),
  'f390e5d23cf7c38a2b21b241fb77c17bb5ea50c55846dfb9f966cb1a25b11951',
);
const witness = JSON.parse(witnessBytes);
function executedBindings(value, text, proof) {
  assert.equal(proof.format, 'SoloReadinessExecutedSourceV1');
  assert.equal(proof.revision, '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7');
  assert.equal(proof.tree, 'e87e64d0e14584c2a569d06bae8e7c602c5ed105');
  assert.equal(proof.manifest, manifestPath);
  assert.equal(proof.workflow, workflowPath);
  assert.equal(proof.files.length, 44);
  const refs = [...value.adapterInputs, ...value.frozenTools, value.fixture];
  assert.deepEqual(
    proof.files.map((r) => r.path).sort(),
    [manifestPath, workflowPath, ...refs.map((r) => r.path)].sort(),
  );
  for (const ref of refs) {
    const row = proof.files.find((r) => r.path === ref.path);
    assert.deepEqual({ path: row.path, bytes: row.bytes, sha256: row.sha256 }, ref);
    assert.match(row.gitBlob, /^[a-f0-9]{40}$/);
  }
  assert.deepEqual(value, plan);
  const row = proof.files.find((r) => r.path === workflowPath),
    bytes = Buffer.from(text);
  assert.equal(bytes.length, row.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
}
const plan = JSON.parse(await read(manifestPath));
// The original path remains the executed identity; its bytes are archived before reuse.
const workflow = (await read(executedWorkflowArchive)).toString();
const expectedCandidate = {
  revision: 'ab45bfde5d54d612cbba9b038a46f13d13f417ec',
  tree: '0d8238992621613883efcf0c73a9f4d88f3fcb10',
  run: 39020129193,
  artifact: 12097731509,
  outer: {
    bytes: 1091910838,
    sha256: 'cf2daed4b7c77d651aa5c1603d2b987e6fd521bfe17f7536cbd55c254d48b7b9',
  },
  inner: {
    bytes: 1073769711,
    sha256: '67b99d8ecf85f9fd60a7f4b7b8b97c7e86db50d790c3ab13842845a59b3fe6dd',
  },
  manifestSHA256: '52d517625389db05aec2cf599db6242be5c670b77b300a4077122acad8cc8d31',
};
function check(value, text) {
  const { producer, ...candidate } = value.candidate;
  assert.equal(typeof producer, 'string');
  assert.deepEqual(candidate, expectedCandidate);
  assert.equal(value.release.onceOnlyBefore, expectedCandidate.revision);
  assert.equal(
    value.release.readinessPrerequisite,
    'diagnosticStatus-passed-and-readinessCorrectness-pass',
  );
  const matrix = readinessMatrix(value);
  assert.equal(matrix.include.length, 2);
  for (const row of matrix.include) {
    assert.equal(row.jobMinutes, 130);
    assert.equal(row.stepMinutes, 78);
    assert.equal(row.outerSeconds, 4620);
    assert.deepEqual(
      bindReadinessJob(value, row.engine).rows.map((r) => r.source),
      ['candidate'],
    );
  }
  assert(text.includes("github.event.before == 'ab45bfde5d54d612cbba9b038a46f13d13f417ec'"));
  assert(text.includes('github.event.pull_request.number == 1544'));
  assert(text.includes('github.event.pull_request.head.repo.full_name == github.repository'));
  assert(text.includes("github.event.action == 'synchronize'"));
  assert(!text.includes('workflow_dispatch') && !text.includes('__REVIEWED_PUSH_EDGE__'));
  for (const expected of [
    'cancel-in-progress: false',
    'fail-fast: false',
    'max-parallel: 2',
    'engine: [chromium, webkit]',
    'timeout-minutes: 130',
    'timeout-minutes: 78',
    'timeout --signal=TERM --kill-after=30s 4620s',
    'retention-days: 14',
    'if-no-files-found: warn',
    'scripts/test-solo-source-verifier-smoke.mjs ',
    'scripts/test-solo-readiness-release.mjs ',
  ])
    assert(text.includes(expected), expected);
  assert.equal((text.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  for (const [revision, path] of [
    [value.candidate.revision, 'candidate'],
    [value.baseline.revision, 'baseline'],
  ])
    assert(
      new RegExp(
        `      - timeout-minutes: 3\\n        uses: actions/checkout@[^\\n]+\\n        with:\\n          ref: ${revision}\\n          path: ${path}`,
      ).test(text),
    );
  for (const p of [...value.frozenTools, ...value.adapterInputs, value.fixture]
    .map((r) => r.path)
    .concat([
      manifestPath,
      workflowPath,
      'scripts/test-solo-readiness-release.mjs',
      'scripts/test-solo-source-verifier-smoke.mjs',
    ]))
    assert(text.includes('            /' + p + '\n'), p);
}
test('actual readiness release preserves exact ab45 package, two excluded rows and owned limits', () =>
  check(plan, workflow));
test('executed readiness release retains exact 4bf source authority after tooling evolves', async () => {
  executedBindings(plan, workflow, witness);
  for (const path of [manifestPath, workflowPath]) {
    const ref = witness.files.find((r) => r.path === path),
      bytes = await read(path === workflowPath ? executedWorkflowArchive : path);
    assert.equal(bytes.length, ref.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256);
  }
});
test('executed source witness rejects changed declaration, source or blob identity', () => {
  for (const mutate of [
    (p) => p.files.pop(),
    (p) => p.files.push(p.files[0]),
    (p) =>
      (p.files.find((r) => r.path === 'scripts/qualify-solo-runtime.mjs').sha256 = '0'.repeat(64)),
    (p) => (p.revision = '0'.repeat(40)),
    (p) => (p.tree = '0'.repeat(40)),
    (p) => (p.workflow = 'other.yml'),
  ]) {
    const changed = structuredClone(witness);
    mutate(changed);
    assert.throws(() => executedBindings(plan, workflow, changed));
  }
  const changed = structuredClone(plan);
  changed.frozenTools[0].bytes++;
  assert.throws(() => executedBindings(changed, workflow, witness));
  assert.throws(() => executedBindings(plan, workflow + ' ', witness));
});
test('release rejects changed package, numerical promotion, source edge and missing verifier closure', () => {
  for (const mutate of [
    (p) => p.candidate.artifact++,
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => (p.release.performanceQualification = 'passed'),
    (p) => (p.protocol.startupWait = 'settled30'),
    (p) => (p.release.onceOnlyBefore = '0'.repeat(40)),
    (p) => (p.cpu = 4),
    (p) => p.engines.push('webkit'),
  ]) {
    const changed = structuredClone(plan);
    mutate(changed);
    assert.throws(() => check(changed, workflow));
  }
  for (const [from, to] of [
    ['cancel-in-progress: false', 'cancel-in-progress: true'],
    ['max-parallel: 2', 'max-parallel: 3'],
    ['--kill-after=30s', '--kill-after=60s'],
    ['            /scripts/soundtrack-distribution.mjs\n', ''],
    ['scripts/test-solo-readiness-release.mjs ', ''],
  ])
    assert.throws(() => check(plan, workflow.replace(from, to)));
});
