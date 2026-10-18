import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { bindDiagnosticsJob, diagnosticsMatrix } from './solo-remote-diagnostics.mjs';
import {
  bindTimingJob,
  timingMatrix,
  bindSustainedJob,
  sustainedMatrix,
} from './solo-remote-sustained.mjs';

const workflowPath = '.github/workflows/solo-native-package-consumer.yml';
const read = (path) => readFile(new URL('../' + path, import.meta.url));
const workflow = (await read(workflowPath)).toString();
const timing = [
  'cold-first30',
  'warm-first30',
  'sentry-latency',
  'long-rail-latency',
  'large-capture-erosion',
  'jammer-steering',
];
const lifecycle = ['retry', 'soak', 'long29'];
const boundedMatch = (value, pattern) =>
  assert(pattern.test(value), 'Missing workflow contract: ' + pattern);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = '797e03f28743921842df6aa57520a72016ba3dfc';
const tree = 'bd53120f0cdfa462b8d63c2de5aa61e9c6658ac5';
const baseline = '8b01991942dc764b8aa4726851699ce1985e53ae';
const baselineTree = '9373b6a74aea8fa1ef47aa17ace140b4cf714609';
const pathFor = (lane, phase) =>
  'docs/performance/solo-797-' +
  (lane === 'journal-cost' ? lane : lane + '-' + phase) +
  '-plan.json';
const manifest = async (lane, phase) => JSON.parse(await read(pathFor(lane, phase)));
function body(text, lane) {
  const result = text.split('\n  ' + lane + ':\n')[1];
  assert(result, lane);
  return result.split(/\n  [A-Za-z_][A-Za-z0-9_-]*:\n/)[0];
}
function expression(value, inputs) {
  return new Function('inputs', 'contains', 'fromJSON', 'return (' + value + ')')(
    inputs,
    (list, item) => list.includes(item),
    JSON.parse,
  );
}
const actualFirstEightProof = JSON.parse(
  await readFile(
    new URL(
      '../docs/performance/fixtures/solo-797e03-consumer/first-eight-39109911286.json',
      import.meta.url,
    ),
  ),
).proof;
function reviewed(plan, lane) {
  if (plan.release.status !== 'held-for-review') {
    assert.deepEqual(plan.release.firstEightEvidence, actualFirstEightProof);
    assert.equal(plan.release.firstEightAllCorrectnessPassed, true);
    return structuredClone(plan);
  }
  assert.equal(plan.release.status, 'held-for-review');
  assert.equal(plan.release.firstEightEvidence, null);
  assert.equal(plan.release.firstEightAllCorrectnessPassed, false);
  assert.deepEqual(plan.release.evidence, []);
  const result = structuredClone(plan);
  result.release.status = lane === 'timing' ? 'reviewed-and-released' : 'reviewed-diagnostic-only';
  for (const key of ['noUnclosedOwners', 'allPriorPlannedJobsClosed', 'priorProofInspected'])
    result.release[key] = true;
  result.release.firstEightAllCorrectnessPassed = true;
  result.release.firstEightEvidence = {
    format: 'SoloFirstEightCorrectnessEvidenceV1',
    sourceRevision: source,
    runId: 1,
    artifactId: 2,
    artifactSHA256: '0'.repeat(64),
    summarySHA256: '0'.repeat(64),
    correctness: 'passed',
    ownersClosed: true,
  };
  if (lane === 'lifecycle') result.release.predecessorRun = 1;
  result.release.evidence = [
    {
      runId: 1,
      artifactId: 1,
      artifactSHA256: '0'.repeat(64),
      summarySHA256: '0'.repeat(64),
      disposition: 'failed-reviewed',
    },
  ];
  return result; // Synthetic control only; never persist this authority.
}
function selection(text, lane) {
  return body(text, lane)
    .match(/^          case "\$SOLO_MEASUREMENT_PHASE" in\n[\s\S]*?^          esac$/m)?.[0]
    .replace(/^          /gm, '');
}
function checkJob(text, lane) {
  const job = body(text, lane);
  const phases = lane === 'timing' ? timing : lifecycle;
  const guard =
    "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == '" +
    lane +
    "'" +
    (lane === 'journal-cost'
      ? ''
      : " && contains(fromJSON('" + JSON.stringify(phases) + "'), inputs.phase)");
  assert.equal(job.match(/^    if: (.+)$/m)?.[1], guard);
  boundedMatch(job, /^      fail-fast: false$/m);
  boundedMatch(job, /^      max-parallel: 1$/m);
  boundedMatch(job, /engine: \[chromium, webkit\]/);
  if (lane !== 'journal-cost') boundedMatch(job, /repetition: \[1, 2, 3\]/);
  else assert(!job.includes('repetition:'));
  boundedMatch(job, /SOLO_TOOLING_REVISION: \$\{\{ github.sha \}\}/);
  boundedMatch(job, /ref: \$\{\{ github.sha \}\}/);
  assert(
    job.includes(
      'solo-shared-source-checkout.sh ' + baseline + ' ' + baselineTree + ' ' + source + ' ' + tree,
    ),
  );
  boundedMatch(job, /node-version: '22.13.1'/);
  boundedMatch(job, /playwright@1.62.1/);
  assert(
    job.includes(
      lane === 'journal-cost'
        ? 'install --with-deps ${{ matrix.engine }}'
        : 'install --with-deps chromium webkit',
    ),
  );
  assert.equal((job.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  const sourceCommand = job.split('\n').find((line) => line.trim().startsWith('node --test '));
  assert(sourceCommand);
  const sourceArgs = sourceCommand.trim().split(/\s+/);
  assert.deepEqual(sourceArgs.slice(0, 3), ['node', '--test', '--test-concurrency=2']);
  assert.deepEqual(sourceArgs.slice(3, 6), [
    'scripts/solo-de332-diagnostics.test.mjs',
    'scripts/solo-de332-timing.test.mjs',
    'scripts/solo-de332-lifecycle.test.mjs',
  ]);
  assert(!sourceArgs.includes('scripts/solo-runtime73-measurement.test.mjs'));
  assert(!sourceArgs.slice(3).some((arg) => arg.startsWith('--test')));
  assert(job.includes('scripts/solo-native-measurement-consumer.test.mjs'));
  assert(job.includes('--signal=TERM --kill-after=30s'));
  assert(job.includes("'maximumTotalBytes':" + (lane === 'journal-cost' ? 20 : 24) + '*1024*1024'));
  boundedMatch(job, /retention-days: 14/);
  boundedMatch(job, /if-no-files-found: warn/);
  for (const forbidden of [
    'continue-on-error',
    'inputs.source',
    'inputs.artifact',
    'inputs.timeout',
    'needs:',
    'schedule:',
  ])
    assert(!job.includes(forbidden), forbidden);
  const jobBound = job.match(/^    timeout-minutes: (.+)$/m)?.[1];
  const stepBound = job.match(
    /^        timeout-minutes: (.+)\n        working-directory: tools\n        env:/m,
  )?.[1];
  if (lane === 'journal-cost') {
    assert.equal(jobBound, '130');
    assert.equal(stepBound, '88');
    assert(job.includes('5220s node scripts/run-solo-remote-correctness.mjs'));
    assert(
      job.includes('bind-plan ' + pathFor(lane) + ' "$RUNNER_TEMP/solo-diagnostics-job.json"'),
    );
  } else if (lane === 'timing') {
    assert.equal(jobBound, '122');
    assert.equal(stepBound, '78');
    assert(job.includes('4620s node scripts/run-solo-remote-correctness.mjs'));
    assert(job.includes('bind-timing-plan "$PLAN" "$RUNNER_TEMP/solo-diagnostics-job.json"'));
  } else {
    assert.equal(jobBound, "${{ inputs.phase == 'retry' && 142 || 192 }}");
    assert.equal(stepBound, "${{ inputs.phase == 'retry' && 98 || 148 }}");
    assert(job.includes("SOLO_OUTER_SECONDS: ${{ inputs.phase == 'retry' && 5820 || 8820 }}"));
    assert(job.includes('"${SOLO_OUTER_SECONDS}s" node scripts/run-solo-remote-correctness.mjs'));
    assert(job.includes('bind-plan "$PLAN" "$RUNNER_TEMP/solo-diagnostics-job.json"'));
  }
  const native =
    lane === 'lifecycle'
      ? "${{ inputs.phase == 'retry' && 98 || 148 }}"
      : lane === 'timing'
        ? '78'
        : '88';
  assert.deepEqual(
    [...job.matchAll(/^        timeout-minutes: (.+)$/gm)].map((m) => m[1]),
    ['3', lane === 'journal-cost' ? '6' : '10', '10', '3', native, '2', '10'],
  );
  assert.deepEqual(
    [...job.matchAll(/^      - timeout-minutes: (.+)$/gm)].map((m) => m[1]),
    ['2', '3', '1'],
  );
  return guard;
}

test('all three manual measurement jobs retain exact guards, source checkout, budgets and both evidence owners', () => {
  const choices = (name) =>
    workflow
      .split('\n      ' + name + ':\n')[1]
      .match(/options:\s*\[([^\]]+)\]/)[1]
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  assert.deepEqual(choices('lane'), [
    'first-eight',
    'next',
    'cocoa',
    'raster',
    'hud-cpu',
    'readiness',
    'touch',
    'app-overhead',
    'journal-cost',
    'timing',
    'lifecycle',
    'shared-return',
    'demo-recovery',
    'demo-resources',
    'replay-portability',
  ]);
  assert.deepEqual(choices('phase'), ['none', ...timing, ...lifecycle]);
  boundedMatch(workflow, /cancel-in-progress: false/);
  const github = {
    repository: 'mekhovov/revealline',
    event_name: 'workflow_dispatch',
    ref: 'refs/heads/main',
  };
  for (const lane of ['journal-cost', 'timing', 'lifecycle']) {
    const guard = checkJob(workflow, lane),
      phase = lane === 'timing' ? timing[0] : lifecycle[0];
    const evaluate = (g, inputs) =>
      new Function('github', 'inputs', 'contains', 'fromJSON', 'return (' + guard + ')')(
        g,
        inputs,
        (list, item) => list.includes(item),
        JSON.parse,
      );
    assert.equal(evaluate(github, { lane, phase }), true);
    for (const changed of [
      { ...github, repository: 'fork/repo' },
      { ...github, event_name: 'pull_request' },
      { ...github, ref: 'refs/heads/other' },
    ])
      assert.equal(evaluate(changed, { lane, phase }), false);
    assert.equal(evaluate(github, { lane: 'all', phase }), false);
    if (lane !== 'journal-cost')
      for (const invalid of ['none', '../other', lane === 'timing' ? 'retry' : timing[0]])
        assert.equal(evaluate(github, { lane, phase: invalid }), false);
    for (const term of guard.split(' && '))
      assert.throws(() =>
        checkJob(
          workflow.replace(
            guard,
            guard
              .split(' && ')
              .filter((value) => value !== term)
              .join(' && '),
          ),
          lane,
        ),
      );
    for (const [a, b] of [
      ['max-parallel: 1', 'max-parallel: 2'],
      ['fail-fast: false', 'fail-fast: true'],
      [source, '0'.repeat(40)],
      ['kill-after=30s', 'kill-after=31s'],
    ])
      assert.throws(() =>
        checkJob('\n  ' + lane + ':\n' + body(workflow, lane).replace(a, b), lane),
      );
  }
});

test('actual shell selectors accept only the fixed phase-to-declaration map', () => {
  for (const [lane, phases] of [
    ['timing', timing],
    ['lifecycle', lifecycle],
  ]) {
    const script = selection(workflow, lane);
    assert(script);
    for (const phase of phases) {
      const result = spawnSync('bash', ['-c', script + '\nprintf "%s" "$PLAN"'], {
        encoding: 'utf8',
        env: { ...process.env, SOLO_MEASUREMENT_PHASE: phase },
        timeout: 3000,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, pathFor(lane, phase));
    }
    for (const invalid of [
      'none',
      '../other',
      'cold-first30; true',
      lane === 'timing' ? 'retry' : 'warm-first30',
    ]) {
      const result = spawnSync('bash', ['-c', script + '\nprintf "%s" "$PLAN"'], {
        encoding: 'utf8',
        env: { ...process.env, SOLO_MEASUREMENT_PHASE: invalid },
        timeout: 3000,
      });
      assert.equal(result.status, 2);
      assert.equal(result.stdout, '');
    }
  }
});

test('real binders keep ten journal pairs and all72 matched timing roles while held releases refuse admission', async () => {
  const journal = await manifest('journal-cost');
  assert.equal(journal.release.status, 'reviewed-diagnostic-only');
  assert.deepEqual(journal.release.firstEightEvidence, actualFirstEightProof);
  assert.equal(diagnosticsMatrix(journal).include.length, 2);
  const missing = structuredClone(journal);
  missing.release.firstEightEvidence = null;
  assert.throws(() => diagnosticsMatrix(missing));
  const j = reviewed(journal, 'journal-cost');
  for (const row of diagnosticsMatrix(j).include) {
    assert.deepEqual([row.jobMinutes, row.stepMinutes, row.outerSeconds], [130, 88, 5220]);
    const p = bindDiagnosticsJob(j, row.engine);
    assert.equal(p.rows.length, 1);
    assert.equal(p.rows[0].timeoutMs, 1800000);
    assert.equal(p.observation.pairs, 10);
    assert.equal(p.observation.cpuRate, 1);
    assert.equal(p.observation.overheadLimit, 0.05);
    assert.equal(p.release.unconditionalClockGuarantee, false);
    assert.equal(p.release.fullJournalOverheadQualification, false);
  }
  let count = 0;
  for (const phase of timing) {
    const held = await manifest('timing', phase);
    if (phase === 'cold-first30') {
      assert.deepEqual(held.release.firstEightEvidence, actualFirstEightProof);
      assert.equal(timingMatrix(held).include.length, 6);
      const missing = structuredClone(held);
      missing.release.firstEightEvidence = null;
      assert.throws(() => timingMatrix(missing));
    } else {
      assert.equal(held.release.firstEightAllCorrectnessPassed, false);
      assert.equal(held.release.status, 'held-for-review');
      assert.throws(() => timingMatrix(held));
    }
    const m = reviewed(held, 'timing');
    for (const row of timingMatrix(m).include) {
      assert.deepEqual([row.jobMinutes, row.stepMinutes, row.outerSeconds], [122, 78, 4620]);
      const p = bindTimingJob(m, row.engine, row.repetition);
      assert.equal(p.helperTimeoutMs, 4500000);
      assert.equal(p.performanceExclusion, false);
      assert.equal(p.calibrationPreset, 'mid');
      assert.deepEqual(
        p.rows.map((r) => r.source),
        row.repetition === 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'],
      );
      assert(p.rows.every((r) => r.timeoutMs === 480000));
      count += p.rows.length;
    }
  }
  assert.equal(count, 72);
});

test('real lifecycle binders match actual job/outer expressions for36 independent diagnostic observations', async () => {
  const job = body(workflow, 'lifecycle');
  const get = (pattern, phase) => expression(job.match(pattern)[1], { phase });
  let count = 0;
  for (const phase of lifecycle) {
    const held = await manifest('lifecycle', phase);
    if (phase === 'soak') {
      assert.deepEqual(held.release.firstEightEvidence, actualFirstEightProof);
      assert.equal(sustainedMatrix(held).include.length, 6);
      const missing = structuredClone(held);
      missing.release.firstEightEvidence = null;
      assert.throws(() => sustainedMatrix(missing));
    } else {
      assert.equal(held.release.status, 'held-for-review');
      assert.throws(() => sustainedMatrix(held));
    }
    const m = reviewed(held, 'lifecycle');
    for (const row of sustainedMatrix(m).include) {
      assert.equal(row.jobMinutes, get(/^    timeout-minutes: \$\{\{ (.+) \}\}$/m, phase));
      assert.equal(row.stepMinutes, get(/^        timeout-minutes: \$\{\{ (.+) \}\}$/m, phase));
      assert.equal(row.outerSeconds, get(/^      SOLO_OUTER_SECONDS: \$\{\{ (.+) \}\}$/m, phase));
      const p = bindSustainedJob(m, row.engine, row.repetition);
      assert.equal(p.performanceExclusion, true);
      assert.equal(p.helperTimeoutMs, (phase === 'retry' ? 95 : 145) * 60000);
      assert(p.rows.every((r) => r.timeoutMs === (phase === 'retry' ? 1140000 : 2640000)));
      assert.deepEqual(
        p.rows.map((r) => r.source),
        row.repetition === 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'],
      );
      count += p.rows.length;
    }
  }
  assert.equal(count, 36);
});

test('every plan reference is current and retained in each exact sparse measurement job', async () => {
  for (const [lane, phases] of [
    ['journal-cost', [undefined]],
    ['timing', timing],
    ['lifecycle', lifecycle],
  ]) {
    const paths = [...body(workflow, lane).matchAll(/^            \/(.+)$/gm)].map((m) => m[1]);
    assert.equal(paths.length, new Set(paths).size);
    for (const phase of phases) {
      const p = await manifest(lane, phase);
      assert.equal(p.candidate.revision, source);
      assert.equal(p.candidate.tree, tree);
      assert.equal(p.candidate.artifact, 12128990483);
      assert.equal(p.baseline.revision, baseline);
      assert.equal((lane === 'journal-cost' ? p : p.release).automaticRetries, 0);
      assert.equal((lane === 'journal-cost' ? p : p.release).automaticPhaseContinuation, false);
      assert(paths.includes(pathFor(lane, phase)));
      const refs = [
        ...(p.adapterInputs ?? []),
        ...p.frozenTools,
        ...Object.values(p.recipes ?? {}),
        ...[p.recipe].filter(Boolean),
      ];
      for (const ref of refs) {
        assert(paths.includes(ref.path), lane + ': ' + ref.path);
        const bytes = await read(ref.path);
        assert.equal(bytes.length, ref.bytes, ref.path);
        assert.equal(sha(bytes), ref.sha256, ref.path);
      }
    }
  }
});

test('actual797 correctness receipt preserves failed numerical and portability evidence', async () => {
  const bytes = await read(
    'docs/performance/fixtures/solo-797e03-consumer/first-eight-39109911286.json',
  );
  assert.equal(bytes.length, 2213);
  assert.equal(sha(bytes), '3bedb1f0cc889e21ea2937addd936cbfd7ec78824434b37571d84dbdc1b65f9f');
  const record = JSON.parse(bytes);
  assert.equal(record.format, 'SoloFirstEightReviewedOutcomeV1');
  assert.deepEqual(record.proof, {
    format: 'SoloFirstEightCorrectnessEvidenceV1',
    sourceRevision: '797e03f28743921842df6aa57520a72016ba3dfc',
    runId: 39109911286,
    artifactId: 12130067688,
    artifactSHA256: '5c5f84eb082d13123410b0c1939aab3c9af4ef981ad9b3150b215c3a16aba916',
    summarySHA256: '5ff787c26c962ec31c9fbe2d635b679fb393caa5ea2eaa84e41fbcc3061804b8',
    correctness: 'passed',
    ownersClosed: true,
  });
  assert.deepEqual(
    [
      record.correctnessPassed,
      record.strictSameEngineNativeReplaysPassed,
      record.ownedCommandsClosed,
    ],
    [8, 4, 14],
  );
  assert.equal(record.rawNumericalFailuresRetained, 3);
  assert.equal(record.nodePortabilityMismatchesRetained, 4);
  assert.equal(record.candidateWebKit.rawStatus, 'failed');
  assert.equal(record.candidateWebKit.sensitivityOnly.status, 'failed');
  assert.equal(record.candidateWebKit.sensitivityOnly.changesAcceptanceGate, false);
});

test('every job retains its invoked shared source checkout script in sparse tools', async () => {
  const requiredSourceCheckout = (text, lane) => {
    const job = body(text, lane);
    const commands = [...job.matchAll(/^\s+bash tools\/(scripts\/[a-z0-9-]+\.sh)(?:\s|$)/gm)].map(
      (match) => match[1],
    );
    const path = commands.find((value) => value === 'scripts/solo-shared-source-checkout.sh');
    if (!path) return null;
    const sparse = [...job.matchAll(/^            \/(.+)$/gm)].map((match) => match[1]);
    assert(sparse.includes(path), lane + ': missing invoked sparse source checkout');
    return path;
  };
  const jobsStart = workflow.indexOf('\njobs:\n');
  assert(jobsStart >= 0);
  const lanes = [...workflow.slice(jobsStart).matchAll(/^  ([A-Za-z_][A-Za-z0-9_-]*):$/gm)].map(
    (match) => match[1],
  );
  assert(lanes.length > 0);
  for (const lane of lanes) {
    const path = requiredSourceCheckout(workflow, lane);
    if (path) assert((await read(path)).length > 0);
  }
  const adjacentJobs = [
    'jobs:',
    '  Readiness_2:',
    '    steps:',
    '      - run: |',
    '          bash tools/scripts/solo-shared-source-checkout.sh source',
    '  _Following2:',
    '    steps:',
    '      - with:',
    '          sparse-checkout: |',
    '            /scripts/solo-shared-source-checkout.sh',
    '',
  ].join('\n');
  assert.throws(
    () => requiredSourceCheckout('\n' + adjacentJobs, 'Readiness_2'),
    /missing invoked sparse source checkout/,
  );
  for (const lane of ['readiness', 'touch', 'shared-return', 'demo-recovery', 'demo-resources']) {
    const path = requiredSourceCheckout(workflow, lane);
    assert(path, lane + ': expected source checkout invocation');
    const job = body(workflow, lane);
    const entry = '            /' + path + '\n';
    assert.equal(job.split(entry).length, 2);
    const missing = job.replace(entry, '');
    assert(missing.includes('bash tools/' + path + ' '));
    assert.throws(
      () => requiredSourceCheckout(workflow.replace(job, missing), lane),
      /missing invoked sparse source checkout/,
    );
  }
});

test('every invoked native display adapter installs and verifies its Ubuntu display tools before use', () => {
  const displaySetup = (text, lane) => {
    const job = body(text, lane);
    // A sparse entry alone is not an invocation of this adapter.
    const commands = job.replace(/^            \/.*\n/gm, '');
    if (!/scripts\/solo-remote-(?:touch|demo|lifecycle|offline)\.mjs/.test(commands)) return null;
    const steps = job.split(/\n      - name: /).slice(1);
    const install = steps.find((step) => step.includes('playwright" install --with-deps '));
    assert(install, lane + ': missing browser dependency step');
    const required = [
      'timeout --signal=TERM --kill-after=10s 120s sudo env DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y x11-utils',
      'for tool in xvfb-run Xvfb xauth xdpyinfo; do test -x "/usr/bin/$tool"; done',
      'timeout 10s /usr/bin/xdpyinfo -version',
    ];
    for (const command of required)
      assert(install.includes(command), lane + ': missing display dependency ' + command);
    assert(install.indexOf(required[0]) < install.indexOf(required[1]));
    assert(install.indexOf(required[1]) < install.indexOf(required[2]));
    assert.match(
      install,
      /\} 2>&1 \| head -c 4194304 > "\$RUNNER_TEMP\/solo-linux-setup\/browser-dependencies\.log"/,
    );
    const use = steps.findIndex((step) =>
      /node scripts\/run-solo-remote-correctness\.mjs/.test(step),
    );
    assert(use > steps.indexOf(install), lane + ': display dependency must precede native use');
    return required;
  };
  const jobsStart = workflow.indexOf('\njobs:\n');
  assert(jobsStart >= 0);
  const lanes = [...workflow.slice(jobsStart).matchAll(/^  ([A-Za-z_][A-Za-z0-9_-]*):$/gm)].map(
    (match) => match[1],
  );
  const observed = [];
  for (const lane of lanes) {
    const required = displaySetup(workflow, lane);
    if (!required) continue;
    observed.push(lane);
    const job = body(workflow, lane);
    for (const command of required) {
      assert.equal(job.split(command).length, 2);
      assert.throws(
        () => displaySetup(workflow.replace(job, job.replace(command, '')), lane),
        /missing display dependency/,
      );
    }
    const late = job
      .replace(required[0], '')
      .replace(required[2], required[2] + '\n' + required[0]);
    assert.throws(() => displaySetup(workflow.replace(job, late), lane));
  }
  for (const lane of ['touch', 'demo-recovery', 'demo-resources'])
    assert(observed.includes(lane), lane + ': expected display adapter invocation');
  assert(
    !observed.includes('lifecycle'),
    'Current lifecycle uses sustained, not the legacy display adapter',
  );
});
