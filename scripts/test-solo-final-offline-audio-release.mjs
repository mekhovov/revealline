import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const source = 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4';
const runtime = '32abd322afd8243e4537ce4784e2f78ee45ecbec';
const paths = {
  audio: [
    'docs/performance/solo-final-audio-plan.json',
    '.github/workflows/solo-remote-final-audio-temporary.yml',
  ],
  offline: [
    'docs/performance/solo-remote-offline-candidate-plan.json',
    '.github/workflows/solo-remote-offline-candidate-temporary.yml',
  ],
};
const guard = `github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '${source}'`;
const sourceIdentity = {
  revision: source,
  tree: '6b13627e324f695b6ee8d9f2dee2eeeb7217c332',
  run: 39008793814,
  artifact: 12092903788,
  outer: {
    bytes: 1091879339,
    sha256: 'a61fd756ce362abacf5dd5f329bed1a936db2b888b9f814cf5924a781964e14a',
  },
  inner: {
    bytes: 1073755490,
    sha256: '52a9f82f48b3e657755f2c5735826b827caa1e866430d30939d05113b1fa67b1',
  },
  manifestSHA256: 'b0e56f24e4d49c6c9ee42000f472ca895c883ca02e1063db741e2eddfe428fb7',
};
function check(name, plan, workflow) {
  const candidate = { ...plan.candidate };
  delete candidate.producer;
  assert.deepEqual(candidate, sourceIdentity);
  assert.equal(plan.baseline.revision, '8b01991942dc764b8aa4726851699ce1985e53ae');
  assert.equal(plan.baseline.tree, '9373b6a74aea8fa1ef47aa17ace140b4cf714609');
  assert.equal(plan.baseline.reusableArtifact.format, 'SoloHostedNormalBaselineReuseV2');
  assert.equal(plan.baseline.reusableArtifact.artifact, 12088541389);
  assert.equal(plan.performanceExclusion, true);
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.setupTimeoutMs, 2400000);
  assert.equal(workflow.split(`    if: ${guard}\n`).length - 1, 1);
  assert(!workflow.includes('workflow_dispatch'));
  assert(workflow.includes('cancel-in-progress: false'));
  assert.equal(workflow.match(/if: \$\{\{ always\(\) \}\}/g)?.length, 2);
  assert(workflow.includes('if-no-files-found: warn'));
  assert(workflow.includes('retention-days: 14'));
  assert(workflow.includes('scripts/test-solo-final-offline-audio-release.mjs 2>&1'));
  for (const sourcePath of ['baseline', 'candidate']) {
    const escaped = sourcePath === 'baseline' ? plan.baseline.revision : source;
    const expression = new RegExp(
      `      - (?:uses: actions/checkout@[^\\n]+\\n        timeout-minutes: 3|timeout-minutes: 3\\n        uses: actions/checkout@[^\\n]+)\\n        with:\\n          ref: ${escaped}\\n          path: ${sourcePath}\\n          persist-credentials: false\\n          fetch-depth: 1\\n(?=      - )`,
    );
    assert.match(workflow, expression);
  }
  for (const path of [
    ...Object.values(paths).flat(),
    'scripts/test-solo-final-offline-audio-release.mjs',
  ])
    assert(workflow.includes(`            /${path}\n`), `Missing sparse test dependency ${path}`);
  if (name === 'audio') {
    assert.equal(plan.runtimeRevision, runtime);
    assert.equal(plan.release.format, 'SoloFinalAudioConfirmationReleaseV1');
    assert.equal(plan.release.onceOnlyBefore, source);
    assert.equal(plan.release.automaticRetries, 0);
    assert.equal(plan.release.firstEightAllCorrectnessPassed, false);
    assert.equal(plan.release.performanceQualification, 'excluded');
    assert.equal(plan.release.importProbe, undefined);
    assert.equal(plan.release.repetitions, undefined);
    assert.deepEqual(plan.release.selectedJobs, [
      'speech-chromium',
      'music-chromium',
      'speech-webkit',
      'music-webkit',
    ]);
    for (const id of plan.release.selectedJobs) {
      const job = plan.jobs.find((row) => row.id === id);
      assert.equal(job.wholeJobMinutes, 122);
      assert.equal(job.helperMinutes, 75);
      assert.deepEqual(
        job.rows.map((row) => row.source),
        ['baseline', 'candidate'],
      );
      assert(
        job.rows.every((row) => row.timeoutMs === (id.startsWith('speech') ? 540000 : 600000)),
      );
    }
    assert(workflow.includes('max-parallel: 2'));
    assert(workflow.includes('timeout-minutes: ${{ matrix.stepMinutes }}'));
    assert(workflow.includes('timeout --signal=TERM --kill-after=30s ${{ matrix.outerSeconds }}s'));
  } else {
    assert.equal(plan.bindingScope.runtimeRevision, runtime);
    assert.equal(plan.format, 'SoloHostedOfflineCandidatePlan.v1');
    assert.equal(plan.status, 'pinned-for-execution');
    assert.deepEqual(
      plan.rows.map((row) => row.source),
      ['candidate'],
    );
    assert.equal(plan.rows[0].timeoutMs, 1200000);
    assert.equal(plan.diagnosticRelease.onceOnlyBefore, source);
    assert.equal(plan.diagnosticRelease.firstEightAllCorrectnessPassed, false);
    assert.equal(plan.diagnosticRelease.nativeStateEvidence.conclusion, 'failure');
    assert.equal(
      plan.diagnosticRelease.independentAdmission.baselineGameplay,
      'failed-next-deadline',
    );
    assert.equal(plan.diagnosticRelease.independentAdmission.priorCandidateObservation, 'not-run');
    assert.equal(plan.offline.nativeStatePolicy, 'owned-cdp-after-navigation-v1');
    assert.equal(plan.offline.expectedBrowserVersion, '151.0.7922.34');
    assert.equal(plan.offline.failureWitnessPolicy, 'failed-public-play-dom-v1');
    assert.equal(plan.offline.gameplay.playTimeoutMs, 120000);
    assert.equal(plan.resources.automaticRetries, 0);
    assert(workflow.includes('timeout-minutes: 165'));
    assert(workflow.includes('timeout --signal=TERM --kill-after=30s 103m'));
  }
}
for (const [name, [manifestPath, workflowPath]] of Object.entries(paths)) {
  const plan = JSON.parse(await readFile(new URL(manifestPath, root), 'utf8'));
  const workflow = await readFile(new URL(workflowPath, root), 'utf8');
  test(`${name} final release binds actual package and preserves complete source/owner scheduling`, () =>
    check(name, plan, workflow));
  test(`${name} final release rejects stale source, unsafe release and missing closure`, () => {
    for (const mutate of [
      (p) => p.candidate.artifact++,
      (p) => (p.candidate.outer.sha256 = '0'.repeat(64)),
      (p) => (p.candidate.revision = '0'.repeat(40)),
      (p) => (p.performanceExclusion = false),
      (p) => p.baseline.reusableArtifact.artifact++,
    ]) {
      const value = structuredClone(plan);
      mutate(value);
      assert.throws(() => check(name, value, workflow));
    }
    for (const mutate of [
      (w) => w.replace(guard, 'true'),
      (w) => w.replace('cancel-in-progress: false', 'cancel-in-progress: true'),
      (w) => w.replaceAll('timeout-minutes: 3', 'timeout-minutes: 2'),
      (w) =>
        w.replaceAll('/scripts/test-solo-final-offline-audio-release.mjs', '/scripts/missing.mjs'),
      (w) => w.replaceAll('if: ${{ always() }}', 'if: ${{ success() }}'),
    ])
      assert.throws(() => check(name, plan, mutate(workflow)));
  });
}
