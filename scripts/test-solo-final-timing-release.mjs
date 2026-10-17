import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { timingMatrix, sustainedMatrix } from './solo-remote-sustained.mjs';
import { validateBaselineReuse } from './solo-remote-baseline.mjs';

const root = new URL('../', import.meta.url);
const load = (path) => readFile(new URL(path, root));
const candidate = 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4';
const baseline = '8b01991942dc764b8aa4726851699ce1985e53ae';
const phases = ['cold-first30', 'warm-first30', 'sentry', 'long-rail', 'soak'];
const declarationModules = [
  'scripts/solo-qualification-observation.mjs',
  'scripts/solo-qualification.mjs',
  'scripts/solo-remote-sustained.mjs',
];
const paths = (phase) => {
  const name = phase === 'soak' ? phase : `timing-${phase}`;
  return {
    manifest: `docs/performance/solo-final-${name}-plan.json`,
    workflow: `.github/workflows/solo-remote-final-${name}-temporary.yml`,
  };
};
const matrixFor = (manifest) =>
  manifest.phase === 'soak' ? sustainedMatrix(manifest) : timingMatrix(manifest);

function checkRelease(manifest, workflow, phase) {
  const files = paths(phase);
  assert.equal(manifest.phase, phase);
  assert.equal(manifest.candidate.revision, candidate);
  assert.equal(manifest.candidate.tree, '6b13627e324f695b6ee8d9f2dee2eeeb7217c332');
  assert.equal(manifest.latestRuntimeRevision, '32abd322afd8243e4537ce4784e2f78ee45ecbec');
  assert.equal(manifest.candidate.run, 39008793814);
  assert.equal(manifest.candidate.artifact, 12092903788);
  assert.deepEqual(manifest.candidate.outer, {
    bytes: 1091879339,
    sha256: 'a61fd756ce362abacf5dd5f329bed1a936db2b888b9f814cf5924a781964e14a',
  });
  assert.deepEqual(manifest.candidate.inner, {
    bytes: 1073755490,
    sha256: '52a9f82f48b3e657755f2c5735826b827caa1e866430d30939d05113b1fa67b1',
  });
  assert.equal(
    manifest.candidate.manifestSHA256,
    'b0e56f24e4d49c6c9ee42000f472ca895c883ca02e1063db741e2eddfe428fb7',
  );
  assert.equal(manifest.baseline.revision, baseline);
  assert.equal(manifest.baseline.tree, '9373b6a74aea8fa1ef47aa17ace140b4cf714609');
  validateBaselineReuse(manifest.baseline.reusableArtifact, manifest);
  assert.equal(manifest.release.status, 'reviewed-diagnostic-only');
  assert.equal(manifest.release.firstEightAllCorrectnessPassed, false);
  assert.equal(manifest.release.predecessorRun, 38985941469);
  assert.equal(manifest.release.automaticRetries, 0);
  assert.equal(manifest.release.automaticPhaseContinuation, false);
  assert.equal(manifest.performanceExclusion, true);
  assert.equal(manifest.hitchJournal, 'bounded-v1');
  if (phase === 'soak') assert.equal(manifest.ownedResources, 'source-bounds-v1');
  const matrix = matrixFor(manifest).include;
  assert.deepEqual(
    matrix.map(({ engine, repetition }) => [engine, repetition]),
    ['chromium', 'webkit'].flatMap((engine) => [1, 2, 3].map((n) => [engine, n])),
  );
  for (const job of matrix) {
    assert.equal(job.jobMinutes, phase === 'soak' ? 192 : 122);
    assert.equal(job.stepMinutes, phase === 'soak' ? 148 : 78);
    assert.equal(job.outerSeconds, (phase === 'soak' ? 147 : 77) * 60);
  }
  const guard = `    if: github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '${candidate}'`;
  assert.equal(workflow.split(guard).length, 2);
  assert(!workflow.includes('workflow_dispatch'));
  assert(workflow.includes('cancel-in-progress: false'));
  assert(workflow.includes('fail-fast: false'));
  assert(workflow.includes('max-parallel: 6'));
  assert(workflow.includes('timeout-minutes: ${{ matrix.jobMinutes }}'));
  assert(workflow.includes('timeout-minutes: ${{ matrix.stepMinutes }}'));
  assert(
    workflow.includes(
      'timeout --signal=TERM --kill-after=30s ${{ matrix.outerSeconds }}s node scripts/run-solo-remote-correctness.mjs',
    ),
  );
  const [declaration, observation] = workflow.split('  sustained:\n');
  assert(observation);
  assert.equal((observation.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  assert(observation.includes('if-no-files-found: warn'));
  assert(observation.includes('retention-days: 14'));
  const listed = declaration
    .split('          sparse-checkout: |\n')[1]
    .split('      - timeout-minutes: 1')[0]
    .trim()
    .split('\n')
    .map((line) => line.trim());
  assert.deepEqual(
    listed,
    [...declarationModules, files.manifest].sort().map((p) => `/${p}`),
  );
  const checkout = (revision, path) =>
    new RegExp(
      `      - timeout-minutes: 3\\n        uses: actions/checkout@[^\\n]+\\n        with:\\n          ref: ${revision}\\n          path: ${path}\\n          persist-credentials: false\\n          fetch-depth: 1`,
    );
  assert(checkout(baseline, 'baseline').test(observation));
  assert(checkout(candidate, 'candidate').test(observation));
  assert(observation.includes('scripts/test-solo-final-timing-release.mjs'));
  for (const p of [
    ...phases.flatMap((p) => Object.values(paths(p))),
    'scripts/test-solo-final-timing-release.mjs',
  ])
    assert(observation.includes(`            /${p}\n`), `Missing sparse release input ${p}`);
  return matrix;
}

test('five concrete final-package releases retain exact sources, diagnostics, order and setup-only envelopes', async () => {
  for (const phase of phases) {
    const files = paths(phase);
    const manifest = JSON.parse(await load(files.manifest));
    checkRelease(manifest, (await load(files.workflow)).toString(), phase);
  }
});

test('every final release freezes exact current tool and recipe bytes', async () => {
  for (const phase of phases) {
    const manifest = JSON.parse(await load(paths(phase).manifest));
    for (const ref of [
      ...manifest.frozenTools,
      ...manifest.adapterInputs,
      ...Object.values(manifest.recipes),
    ]) {
      const bytes = await load(ref.path);
      assert.equal(bytes.length, ref.bytes, ref.path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
    }
  }
});

test('concrete release checks reject substituted package, source, gate, owner and scheduling values', async () => {
  for (const phase of phases) {
    const files = paths(phase);
    const original = JSON.parse(await load(files.manifest));
    const workflow = (await load(files.workflow)).toString();
    for (const mutate of [
      (m) => {
        m.candidate.artifact++;
      },
      (m) => {
        m.candidate.tree = 'f'.repeat(40);
      },
      (m) => {
        m.latestRuntimeRevision = candidate;
      },
      (m) => {
        m.release.firstEightAllCorrectnessPassed = true;
      },
      (m) => {
        m.hitchJournal = false;
      },
    ]) {
      const m = structuredClone(original);
      mutate(m);
      assert.throws(() => checkRelease(m, workflow, phase));
    }
    for (const [from, to] of [
      [`github.event.before == '${candidate}'`, `github.event.before == '${baseline}'`],
      ['cancel-in-progress: false', 'cancel-in-progress: true'],
      ['max-parallel: 6', 'max-parallel: 7'],
      ['--kill-after=30s', '--kill-after=60s'],
      ['if: ${{ always() }}', 'if: ${{ success() }}'],
      ['      - timeout-minutes: 3', '      - timeout-minutes: 2'],
    ])
      assert.throws(() => checkRelease(original, workflow.replace(from, to), phase));
  }
});
