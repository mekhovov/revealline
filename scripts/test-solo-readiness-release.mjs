import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bindReadinessJob, readinessMatrix } from './solo-remote-readiness.mjs';
const root = new URL('../', import.meta.url);
const manifestPath = 'docs/performance/solo-readiness-ab45-plan.json';
const workflowPath = '.github/workflows/solo-remote-readiness-ab45-temporary.yml';
const read = (p) => readFile(new URL(p, root));
const plan = JSON.parse(await read(manifestPath));
const workflow = (await read(workflowPath)).toString();
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
test('actual readiness release frozen source bytes match independently', async () => {
  for (const ref of [...plan.adapterInputs, ...plan.frozenTools, plan.fixture]) {
    const b = await read(ref.path);
    assert.equal(b.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(b).digest('hex'), ref.sha256, ref.path);
  }
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
