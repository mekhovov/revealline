// Exact reviewed package authority; full remote admission remains mandatory.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  FONT_COMPACT_COHORT,
  FONT_COMPACT_PROTOCOL,
  SELECTED_FONT_SOURCE,
  SELECTED_FONT_FIXTURE,
  COMPACT_READINESS_FIXTURES,
  readinessMatrix,
  bindReadinessJob,
  readinessArguments,
  fontCompactRows,
} from './solo-remote-readiness.mjs';
const root = new URL('../', import.meta.url),
  read = (p) => readFile(new URL(p, root));
const path = 'docs/performance/solo-readiness-font-c696-plan.json',
  m = JSON.parse(await read(path)),
  workflow = (await read('.github/workflows/solo-remote-readiness-ab45-temporary.yml')).toString();
// Independently reviewed current helper identity. A stale overlay plus a stale
// declaration must not validate merely because they agree with each other.
const currentRunner = Object.freeze({
  path: 'scripts/run-solo-remote-correctness.mjs',
  bytes: 62407,
  sha256: 'b0073738c8b8a13db98068eea1145ea2ec915601bf1377c6ae7136c92dce3858',
});
function assertCurrentRunner(plan) {
  const refs = plan.frozenTools.filter((r) => r.path === currentRunner.path);
  assert.equal(refs.length, 1);
  assert.deepEqual(refs[0], currentRunner);
}
test('current release rejects the previously self-consistent but stale unedited runner', () => {
  assertCurrentRunner(m);
  const stale = structuredClone(m);
  Object.assign(
    stale.frozenTools.find((r) => r.path === currentRunner.path),
    {
      bytes: 57968,
      sha256: '1d39759163c7f26e79ddcb05cce53a9d424a803cacc1434076cef14c7e390069',
    },
  );
  assert.throws(() => assertCurrentRunner(stale));
});
const expectedCandidate = {
  revision: 'c696af41857840359ae473558b90682f3d71f2db',
  tree: 'b70ce1c4b15023a38628c5e958b166e44898eccf',
  run: 39028705715,
  artifact: 12100662115,
  outer: {
    bytes: 1091949183,
    sha256: '8545bc4e8a665cbaff8d39e9704dd0dc85ba72b52e1f3dc04ed1cc69ca874342',
  },
  inner: {
    bytes: 1073779419,
    sha256: 'c715e0a960300c48b341fbc1b3dbc656882f6f03b5dadf373aaf6d9473079fa5',
  },
  manifestSHA256: '9521c2f2afb62879a7ebedb09b7436f9a93babed10cb53989a4f9108239dc21d',
};
const conditions = [
  'github.event.pull_request.number == 1544',
  'github.event.pull_request.head.repo.full_name == github.repository',
  "github.event.action == 'synchronize'",
  "github.event.before == '" + expectedCandidate.revision + "'",
];
function released(value, text) {
  const { producer, ...candidate } = value.candidate;
  assert.equal(typeof producer, 'string');
  assert.deepEqual(candidate, expectedCandidate);
  assert.equal(value.status, 'reviewed-readiness-diagnostic-only');
  assert.equal(value.runtimeRevision, SELECTED_FONT_SOURCE.revision);
  assert.equal(value.sourceCohort, FONT_COMPACT_COHORT);
  assert.deepEqual(value.protocol, FONT_COMPACT_PROTOCOL);
  assert.deepEqual(value.fixture, SELECTED_FONT_FIXTURE);
  assert.deepEqual(value.additionalFixtures, [
    COMPACT_READINESS_FIXTURES.saved,
    COMPACT_READINESS_FIXTURES.full,
    COMPACT_READINESS_FIXTURES.reduced,
  ]);
  assert.equal(value.release.onceOnlyBefore, SELECTED_FONT_SOURCE.revision);
  assert.equal(value.release.performanceQualification, 'excluded');
  assert.equal(value.release.firstEightAllCorrectnessPassed, false);
  assert.equal(value.release.priorProofInspected, true);
  assert.equal(value.release.noUnclosedOwners, true);
  assert.match(value.release.priorOwnerScope, /^hosted-linux-only;/);
  assert.deepEqual(value.release.priorOwnerReceipt, {
    path: '.cache/solo-followup/c696-next-release-owners/analysis.json',
    bytes: 16066,
    sha256: '0802f8cc7d765987c5049d7d88caed59936a629feb663ab1146035ff1fe40670',
  });
  assert.equal(value.pendingBindings, undefined);
  assert.equal(value.cpu, 1);
  assert.equal(value.automaticRetries, 0);
  assert.equal(value.rowEvidenceBytes, 32 * 1024 ** 2);
  assert.equal(value.evidenceBytes, 256 * 1024 ** 2);
  assert.equal(value.setupTimeoutMs, 40 * 60000);
  assert.equal(value.helperTimeoutMs, 75 * 60000);
  assert.equal(value.metadataAdmission.remoteVerificationRequired, true);
  assert.equal(value.metadataAdmission.metadataArtifact, 12100751601);
  assert.equal(
    value.metadataAdmission.packageBinding.sha256,
    '8a85e5bce913c33c549a53ac608e51c21d33d2fda9058c0e839f227b2fcbca65',
  );
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
  assert.equal(
    text.split('\n').find((line) => line.startsWith('    if: ')),
    '    if: ' + conditions.join(' && '),
  );
  assert(!text.includes('workflow_dispatch') && !text.includes('workflow_run:'));
  for (const item of [
    'max-parallel: 2',
    'timeout-minutes: 130',
    'timeout-minutes: 78',
    'timeout --signal=TERM --kill-after=30s 4620s',
    'cancel-in-progress: false',
    'fail-fast: false',
    'scripts/test-solo-source-verifier-smoke.mjs ',
    'scripts/test-solo-selected-font-transport.mjs ',
    'scripts/test-solo-selected-font-readiness.mjs ',
    'scripts/test-solo-selected-font-release.mjs ',
    'scripts/solo-remote-readiness.mjs bind-plan ' + path,
  ])
    assert(text.includes(item), item);
  assert.equal((text.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  const steps = [
    ...text.matchAll(/^        timeout-minutes: (\d+)$/gm),
    ...text.matchAll(/^      - timeout-minutes: (\d+)$/gm),
  ];
  assert.equal(
    steps.reduce((n, match) => n + Number(match[1]), 0),
    122,
  );
  for (const [revision, destination] of [
    [value.candidate.revision, 'candidate'],
    [value.baseline.revision, 'baseline'],
  ]) {
    const step = text
      .split(/\n      - /)
      .find((part) => part.includes('path: ' + destination + '\n'));
    assert(
      step &&
        step.includes('timeout-minutes: 3') &&
        step.includes('ref: ' + revision) &&
        !step.includes('sparse-checkout'),
      destination,
    );
  }
}
test('reviewed seven-observation release binds actual115 package and exact one-shot edge', () =>
  released(m, workflow));
test('source, package, review and exact guard mutations fail without changing historical outcomes', () => {
  for (const mutate of [
    (p) => p.candidate.artifact++,
    (p) => p.candidate.run++,
    (p) => p.candidate.outer.bytes++,
    (p) => (p.candidate.inner.sha256 = '0'.repeat(64)),
    (p) => (p.candidate.manifestSHA256 = '0'.repeat(64)),
    (p) => (p.candidate.revision = '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7'),
    (p) => (p.release.priorProofInspected = false),
    (p) => (p.release.noUnclosedOwners = false),
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => (p.release.priorOwnerReceipt.sha256 = '0'.repeat(64)),
    (p) => (p.metadataAdmission.remoteVerificationRequired = false),
    (p) => (p.additionalFixtures[0].sha256 = '0'.repeat(64)),
    (p) => (p.cpu = 2),
  ]) {
    const p = structuredClone(m);
    mutate(p);
    assert.throws(() => released(p, workflow));
  }
  for (let omitted = 0; omitted < conditions.length; omitted++)
    assert.throws(() =>
      released(
        m,
        workflow.replace(
          conditions.join(' && '),
          conditions.filter((_, i) => i !== omitted).join(' && '),
        ),
      ),
    );
  assert.throws(() => released(m, workflow.replace(conditions.join(' && '), 'true')));
});
test('native commands retain the exact one/six routes and declared observation and ownership limits', () => {
  const jobs = ['chromium', 'webkit'].map((engine) => bindReadinessJob(m, engine));
  assert.deepEqual(
    jobs.map((job) => job.rows.length),
    [1, 6],
  );
  assert.deepEqual(
    jobs[1].rows.map((row) => row.id),
    [
      'readiness-selected-font-cancel-webkit',
      'readiness-saved-resume-webkit',
      'public-effects-p1-full',
      'public-effects-p1-reduced',
      'public-effects-p2-reduced',
      'public-effects-p2-full',
    ],
  );
  for (const job of jobs) {
    assert.deepEqual(job.rows, fontCompactRows(job.engine));
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
      for (const flag of [
        '--source-revision=' + expectedCandidate.revision,
        '--cpu=1',
        '--work-probe',
        '--hitch-journal',
        '--cadence=settled120',
      ])
        assert(args.includes(flag), flag);
      if (row.phase === 'selected-font-cancel')
        assert(
          args.includes('--readiness-probe=selected-font-cancel-v1') &&
            args.includes('/tools/' + SELECTED_FONT_FIXTURE.path),
        );
      else if (row.phase === 'saved-resume')
        assert(
          args.includes('--readiness-probe=saved-resume-v1') &&
            args.includes('/tools/' + COMPACT_READINESS_FIXTURES.saved.path),
        );
      else
        assert(
          args.includes('--visual-quality-observation=' + row.tier) &&
            args.includes('/tools/' + COMPACT_READINESS_FIXTURES[row.tier].path),
        );
      assert(
        !args.includes('--audio-proof') && !args.some((arg) => arg.startsWith('--cpu-profile')),
      );
    }
  }
});
test('every prospective runtime byte is frozen separately from the immutable executed witness', async () => {
  const refs = [...m.adapterInputs, ...m.frozenTools, m.fixture, ...m.additionalFixtures];
  assert(refs.length > 25 && refs.length < 70);
  assert.equal(new Set(refs.map((r) => r.path)).size, refs.length);
  for (const ref of refs) {
    const b = await read(ref.path);
    assert.equal(b.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(b).digest('hex'), ref.sha256, ref.path);
    assert(workflow.includes('            /' + ref.path + '\n'), ref.path);
  }
  for (const p of [
    'docs/performance/fixtures/solo-readiness-font/c696-execution-source.json',
    'docs/performance/fixtures/solo-readiness-font/c696-executed-workflow.yml',
    'scripts/test-solo-readiness-4bf-release.mjs',
    'game/ui/fonts/field-kit/handjet-display-600.woff2',
  ])
    assert(workflow.includes('            /' + p + '\n'), p);
});
