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
const source = '73a345cec696d7789198cf295ca5c37b17ca0e71';
const tree = 'ea30e68636b3342f8e60664a79d425e11e27ff1e';
const baseline = '8b01991942dc764b8aa4726851699ce1985e53ae';
const baselineTree = '9373b6a74aea8fa1ef47aa17ace140b4cf714609';
const pathFor = (lane, phase) =>
  'docs/performance/solo-73-' +
  (lane === 'journal-cost' ? lane : lane + '-' + phase) +
  '-plan.json';
const manifest = async (lane, phase) => JSON.parse(await read(pathFor(lane, phase)));
function body(text, lane) {
  const result = text.split('\n  ' + lane + ':\n')[1];
  assert(result, lane);
  return result.split(/\n  [a-z][a-z-]+:\n/)[0];
}
function expression(value, inputs) {
  return new Function('inputs', 'contains', 'fromJSON', 'return (' + value + ')')(
    inputs,
    (list, item) => list.includes(item),
    JSON.parse,
  );
}
function reviewed(plan, lane) {
  if (plan.release.status !== 'held-for-review') {
    assert.equal(plan.release.evidence[0].runId, 39105055762);
    assert.equal(plan.release.evidence[0].artifactId, 12127359946);
    assert.equal(
      plan.release.evidence[0].artifactSHA256,
      '17665afe978ae63cfaf8d24b1a9626e1d7f607b7ee2611fc637c9e680f3d46d8',
    );
    assert.equal(
      plan.release.evidence[0].summarySHA256,
      'a33416a355620817896366d5312fbecb44f0c7e6b8f7220941c8447886d99762',
    );
    assert.equal(plan.release.evidence[0].scope, 'first-eight-correctness-only');
    assert.equal(plan.release.evidence[0].numericalFailures.length, 3);
    return structuredClone(plan);
  }
  const result = structuredClone(plan);
  result.release.status = lane === 'timing' ? 'reviewed-and-released' : 'reviewed-diagnostic-only';
  for (const key of ['noUnclosedOwners', 'allPriorPlannedJobsClosed', 'priorProofInspected'])
    result.release[key] = true;
  if (lane === 'timing') result.release.firstEightAllCorrectnessPassed = true;
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
  assert(job.includes('scripts/solo-runtime73-measurement.test.mjs'));
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
  const unreviewedJournal = structuredClone(journal);
  unreviewedJournal.release.status = 'held-for-review';
  assert.throws(() => diagnosticsMatrix(unreviewedJournal));
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
    assert.equal(held.release.firstEightAllCorrectnessPassed, phase === 'cold-first30');
    if (phase === 'cold-first30') {
      assert.equal(held.release.status, 'reviewed-and-released');
      const unreleased = structuredClone(held);
      unreleased.release.status = 'held-for-review';
      assert.throws(() => timingMatrix(unreleased));
    } else assert.throws(() => timingMatrix(held));
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
      assert.equal(held.release.status, 'reviewed-diagnostic-only');
      assert.equal(held.release.predecessorRun, 39105055762);
      const unreleased = structuredClone(held);
      unreleased.release.status = 'held-for-review';
      assert.throws(() => sustainedMatrix(unreleased));
    } else assert.throws(() => sustainedMatrix(held));
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
      assert.equal(p.candidate.artifact, 12127570566);
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
