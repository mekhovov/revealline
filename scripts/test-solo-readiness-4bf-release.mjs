import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  bindReadinessJob,
  COMBINED_READINESS_COHORT,
  COMBINED_READINESS_PROTOCOL,
  readinessArguments,
  readinessMatrix,
} from './solo-remote-readiness.mjs';
const root = new URL('../', import.meta.url);
const manifestPath = 'docs/performance/solo-readiness-4bf-plan.json';
const workflowPath = '.github/workflows/solo-remote-readiness-ab45-temporary.yml';
const read = (path) => readFile(new URL(path, root));
const plan = JSON.parse(await read(manifestPath));
const workflow = (await read(workflowPath)).toString();
const expectedCandidate = {
  revision: '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7',
  tree: 'e87e64d0e14584c2a569d06bae8e7c602c5ed105',
  run: 39024034432,
  artifact: 12098972901,
  outer: {
    bytes: 1091926948,
    sha256: 'ef33c1a98e124c65d744601bff94c38db86ae7892ed9101af0dbd1932d92f03e',
  },
  inner: {
    bytes: 1073774570,
    sha256: '6af25018a61a708d7e77765b0108470cc1291fd6e69cc04e813b7c6e0c5e116b',
  },
  manifestSHA256: '9285e484db53635e4651c90c86d4f385e5fc41894828cbf02744ef40ee7fa810',
};
const paths = (value) => [
  ...value.adapterInputs,
  ...value.frozenTools,
  value.fixture,
  ...value.additionalFixtures,
];
function check(value, text) {
  const { producer, ...candidate } = value.candidate;
  assert.equal(typeof producer, 'string');
  assert.deepEqual(candidate, expectedCandidate);
  assert.equal(value.runtimeRevision, expectedCandidate.revision);
  assert.equal(value.sourceCohort, COMBINED_READINESS_COHORT);
  assert.equal(value.release.onceOnlyBefore, expectedCandidate.revision);
  assert.deepEqual(value.protocol, COMBINED_READINESS_PROTOCOL);
  assert.equal(value.release.comparisonScope, 'muted-public-effects-bundle-only');
  const matrix = readinessMatrix(value);
  assert.deepEqual(
    matrix.include,
    ['chromium', 'webkit'].map((engine) => ({
      engine,
      jobMinutes: 130,
      stepMinutes: 78,
      outerSeconds: 4620,
    })),
  );
  const jobs = matrix.include.map(({ engine }) => bindReadinessJob(value, engine));
  assert.deepEqual(
    jobs.map((job) => job.rows.length),
    [2, 6],
  );
  assert.deepEqual(
    jobs[1].rows.map((row) => row.id),
    [
      'readiness-warm-resume-webkit',
      'readiness-saved-resume-webkit',
      'public-effects-p1-full',
      'public-effects-p1-reduced',
      'public-effects-p2-reduced',
      'public-effects-p2-full',
    ],
  );
  for (const job of jobs)
    for (const row of job.rows) {
      assert.equal(row.source, 'candidate');
      assert.equal(row.timeoutMs, 480000);
      assert.equal(row.performanceExclusion, true);
      const args = readinessArguments(
        {
          plan: job,
          here: '/tools/scripts',
          repository: '/tools',
          candidateRoot: '/candidate',
          browserVersion: 'test',
        },
        row,
        'http://127.0.0.1:1234',
        '/evidence/' + row.id,
      );
      assert(args.includes('--source-revision=' + expectedCandidate.revision));
      assert(!args.includes('--audio-proof') && !args.some((s) => s.startsWith('--cpu-profile')));
    }
  assert.equal(
    text.split('\n').find((line) => line.startsWith('    if: ')),
    "    if: github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7'",
  );
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
    'scripts/test-solo-readiness-4bf-release.mjs ',
    'scripts/test-solo-quality-comparison.mjs ',
    'scripts/test-solo-readiness-release.mjs ',
    'scripts/test-solo-readiness-resume.mjs ',
    'scripts/test-solo-qualification.mjs ',
    'scripts/test-solo-qualification-cadence.mjs ',
    'scripts/solo-remote-readiness.mjs bind-plan ' + manifestPath,
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
  for (const path of paths(value)
    .map((r) => r.path)
    .concat([
      manifestPath,
      workflowPath,
      'scripts/test-solo-readiness-4bf-release.mjs',
      'scripts/test-solo-quality-comparison.mjs',
      'scripts/test-solo-source-verifier-smoke.mjs',
      'scripts/solo-source-verifier-smoke.mjs',
      'game/build-config.json',
      'game/content/campaign.json',
      'docs/performance/fixtures/solo-readiness/4bf-executed-workflow.yml',
      'docs/performance/fixtures/solo-readiness/4bf-execution-source.json',
    ]))
    assert(text.includes('            /' + path + '\n'), path);
  const steps = [
    ...text.matchAll(/^        timeout-minutes: (\d+)$/gm),
    ...text.matchAll(/^      - timeout-minutes: (\d+)$/gm),
  ];
  assert.equal(
    steps.reduce((n, m) => n + Number(m[1]), 0),
    122,
    'Existing finite step sum',
  );
}
test('reviewed combined declaration binds the verified112 package and fixed eight excluded observations', () =>
  check(plan, workflow));
test('current frozen tooling and all four recipe bytes are read back independently', async () => {
  for (const ref of paths(plan)) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
  }
});
test('combined release rejects changed package, protocol, gates and missing actual closure', () => {
  for (const mutate of [
    (p) => p.candidate.artifact++,
    (p) => p.candidate.outer.bytes++,
    (p) => p.candidate.inner.bytes++,
    (p) => p.candidate.run++,
    (p) => (p.candidate.manifestSHA256 = '0'.repeat(64)),
    (p) => (p.runtimeRevision = '0'.repeat(40)),
    (p) => (p.release.onceOnlyBefore = '0'.repeat(40)),
    (p) => (p.release.performanceQualification = 'passed'),
    (p) => (p.protocol.effects[0] = 'reduced'),
    (p) => (p.protocol.effectsAudio.muted = false),
    (p) => p.helperTimeoutMs++,
    (p) => p.rowEvidenceBytes++,
    (p) => p.additionalFixtures.pop(),
    (p) =>
      (p.frozenTools = p.frozenTools.filter(
        (r) => r.path !== 'scripts/soundtrack-distribution.mjs',
      )),
  ]) {
    const changed = structuredClone(plan);
    mutate(changed);
    assert.throws(() => check(changed, workflow));
  }
  for (const [from, to] of [
    ["github.event.before == '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7'", 'true'],
    ['github.event.pull_request.number == 1544', 'true'],
    ['github.event.pull_request.head.repo.full_name == github.repository', 'true'],
    ["github.event.action == 'synchronize'", 'true'],
    ['max-parallel: 2', 'max-parallel: 3'],
    ['timeout-minutes: 78', 'timeout-minutes: 79'],
    ['scripts/test-solo-source-verifier-smoke.mjs ', ''],
    ['scripts/test-solo-quality-comparison.mjs ', ''],
    ['            /scripts/soundtrack-distribution.mjs\n', ''],
    ['            /game/content/campaign.json\n', ''],
  ])
    assert.throws(() => check(plan, workflow.replace(from, to)));
});
