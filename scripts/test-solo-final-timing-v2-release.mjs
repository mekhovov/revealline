import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readSoloDiagnosticSource } from './solo-retired-diagnostic-source.mjs';
import test from 'node:test';
import {
  timingMatrix,
  sustainedMatrix,
  COMPARISON_SETUP_DYNAMIC_ROOTS,
  comparisonSetupSuccessor,
} from './solo-remote-sustained.mjs';
import { assertFinalWaveBindings } from './solo-final-wave-witness.mjs';
import {
  QUALIFICATION_TOOL_WITNESS_PATH,
  historicalQualificationRefs,
  readHistoricalQualificationRefs,
  PAGE_ERROR_WITNESS_PATH,
  validatePageErrorSourceWitness,
  historicalPageErrorRefs,
  readHistoricalPageErrorRefs,
} from './solo-page-error-source-witness.mjs';
const read = readSoloDiagnosticSource;
const originalSoak = JSON.parse(await read('docs/performance/solo-final-soak-plan.json'));
const stages = [
  'cold-first30',
  'warm-first30',
  'sentry',
  'long-rail',
  'soak',
  'next',
  'retry',
  'long29',
];
function names(phase) {
  const successor = !['next', 'retry', 'long29'].includes(phase);
  const timing = successor && phase !== 'soak';
  const name = timing ? `timing-${phase}-v2` : successor ? 'soak-v2' : `lifecycle-${phase}`;
  return {
    successor,
    timing,
    manifest: `docs/performance/solo-final-${timing ? `timing-${phase}-v2` : successor ? 'soak-v2' : phase}-plan.json`,
    workflow: `.github/workflows/solo-remote-final-${name}-temporary.yml`,
  };
}
function check(manifest, workflow, phase) {
  const paths = names(phase);
  assert.equal(manifest.phase, phase);
  assert.deepEqual(manifest.candidate, originalSoak.candidate);
  assert.deepEqual(manifest.baseline, originalSoak.baseline);
  assert.equal(manifest.latestRuntimeRevision, '32abd322afd8243e4537ce4784e2f78ee45ecbec');
  assert.equal(manifest.release.status, 'reviewed-diagnostic-only');
  assert.equal(manifest.release.firstEightAllCorrectnessPassed, false);
  assert.equal(manifest.performanceExclusion, true);
  assert.equal(manifest.hitchJournal, 'bounded-v1');
  assert.equal(manifest.release.onceOnlyBefore, 'a7e0219818842f02399317ca6d2a14bdd506da3d');
  if (paths.successor) assert.deepEqual(manifest.setupSuccessor, comparisonSetupSuccessor(phase));
  else assert.equal(manifest.setupSuccessor, undefined);
  assert.equal(manifest.ownedResources, phase === 'soak' ? 'source-bounds-v1' : undefined);
  const matrix = paths.timing ? timingMatrix(manifest) : sustainedMatrix(manifest);
  const jobMinutes = paths.timing ? 122 : phase === 'next' ? 152 : phase === 'retry' ? 142 : 192;
  const helperMinutes = paths.timing ? 75 : phase === 'next' ? 105 : phase === 'retry' ? 95 : 145;
  assert.equal(matrix.include.length, 6);
  assert.deepEqual(
    matrix.include.map(({ engine, repetition }) => [engine, repetition]),
    ['chromium', 'webkit'].flatMap((engine) => [1, 2, 3].map((repetition) => [engine, repetition])),
  );
  for (const job of matrix.include) {
    assert.equal(job.jobMinutes, jobMinutes);
    assert.equal(job.stepMinutes, helperMinutes + 3);
    assert.equal(job.outerSeconds, (helperMinutes + 2) * 60);
  }
  const guard =
    "    if: github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'";
  assert.equal(workflow.split(guard).length, 2);
  assert(!workflow.includes('workflow_dispatch'));
  for (const text of [
    'cancel-in-progress: false',
    'fail-fast: false',
    'max-parallel: 6',
    'timeout-minutes: ${{ matrix.jobMinutes }}',
    'timeout-minutes: ${{ matrix.stepMinutes }}',
    'timeout --signal=TERM --kill-after=30s ${{ matrix.outerSeconds }}s node scripts/run-solo-remote-correctness.mjs',
    'if-no-files-found: warn',
    'retention-days: 14',
  ])
    assert(workflow.includes(text), text);
  assert.equal((workflow.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  const [declaration, observation] = workflow.split('  sustained:\n');
  const listed = declaration
    .split('          sparse-checkout: |\n')[1]
    .split('      - timeout-minutes: 1')[0]
    .trim()
    .split('\n')
    .map((s) => s.trim());
  assert.deepEqual(
    listed,
    [
      'scripts/solo-remote-sustained.mjs',
      'scripts/solo-qualification.mjs',
      'scripts/solo-qualification-observation.mjs',
      paths.manifest,
    ]
      .sort()
      .map((p) => '/' + p),
  );
  for (const [revision, path] of [
    [manifest.candidate.revision, 'candidate'],
    [manifest.baseline.revision, 'baseline'],
  ])
    assert(
      new RegExp(
        `      - timeout-minutes: 3\\n        uses: actions/checkout@[^\\n]+\\n        with:\\n          ref: ${revision}\\n          path: ${path}`,
      ).test(observation),
    );
  for (const p of [
    ...COMPARISON_SETUP_DYNAMIC_ROOTS,
    'scripts/solo-source-verifier-smoke.mjs',
    'scripts/test-solo-source-verifier-smoke.mjs',
    'game/build-config.json',
    'scripts/test-solo-final-timing-v2-release.mjs',
    ...stages.flatMap((phase) =>
      Object.values(names(phase)).filter((value) => typeof value === 'string'),
    ),
  ])
    assert(observation.includes(`            /${p}\n`), p);
  assert(observation.includes('node --test --test-concurrency=2'));
  assert(observation.includes('scripts/test-solo-source-verifier-smoke.mjs '));
}

test('eight concrete releases preserve exact package, routes, diagnostic gates and finite owner envelopes', async () => {
  for (const phase of stages) {
    const p = names(phase);
    check(JSON.parse(await read(p.manifest)), (await read(p.workflow)).toString(), phase);
  }
});

test('dispatched declarations preserve every exact historical helper and recipe reference', async () => {
  for (const phase of stages) {
    const p = names(phase),
      m = JSON.parse(await read(p.manifest));
    const historical = await readHistoricalPageErrorRefs(p.manifest, p.workflow);
    for (const [file, ref] of await readHistoricalQualificationRefs(p.manifest, p.workflow))
      historical.set(file, ref);
    for (const ref of [...m.frozenTools, ...m.adapterInputs, ...Object.values(m.recipes)]) {
      if (historical.has(ref.path)) {
        const expected = historical.get(ref.path);
        assert.equal(ref.bytes, expected.bytes, ref.path);
        assert.equal(ref.sha256, expected.sha256, ref.path);
        continue;
      }
      const bytes = await read(ref.path);
      assert.equal(bytes.length, ref.bytes, ref.path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
    }
    if (p.successor) {
      const originalPath = m.setupSuccessor.originalDeclaration.path,
        old = JSON.parse(await read(originalPath));
      const oldWorkflow = p.workflow.replace('-v2-temporary.yml', '-temporary.yml');
      await assertFinalWaveBindings(
        originalPath,
        [...old.frozenTools, ...old.adapterInputs, ...Object.values(old.recipes)],
        oldWorkflow,
      );
      const comparable = structuredClone(m);
      for (const key of [
        'cohort',
        'executionAdmission',
        'frozenTools',
        'adapterInputs',
        'setupSuccessor',
        'toolingClosure',
      ]) {
        delete comparable[key];
        delete old[key];
      }
      delete comparable.release.onceOnlyBefore;
      assert.deepEqual(comparable, old);
    }
  }
});

test('concrete release guards reject changed packages, evidence claims and setup/workflow shortcuts', async () => {
  for (const phase of stages) {
    const p = names(phase),
      original = JSON.parse(await read(p.manifest)),
      workflow = (await read(p.workflow)).toString();
    for (const mutate of [
      (m) => m.candidate.artifact++,
      (m) => {
        m.candidate.tree = '0'.repeat(40);
      },
      (m) => {
        m.release.firstEightAllCorrectnessPassed = true;
      },
      (m) => {
        m.hitchJournal = undefined;
      },
      (m) => {
        m.release.onceOnlyBefore = m.candidate.revision;
      },
      (m) => {
        m.ownedResources = 'source-bounds-v1';
        if (phase === 'soak') delete m.ownedResources;
      },
    ]) {
      const m = structuredClone(original);
      mutate(m);
      assert.throws(() => check(m, workflow, phase));
    }
    for (const [from, to] of [
      [
        "github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
        `github.event.before == '${original.candidate.revision}'`,
      ],
      ['cancel-in-progress: false', 'cancel-in-progress: true'],
      ['max-parallel: 6', 'max-parallel: 7'],
      ['--kill-after=30s', '--kill-after=60s'],
      ['if: ${{ always() }}', 'if: ${{ success() }}'],
      ['      - timeout-minutes: 3', '      - timeout-minutes: 2'],
      ['            /scripts/soundtrack-distribution.mjs\n', ''],
    ])
      assert.throws(() => check(original, workflow.replace(from, to), phase));
  }
});

test('historical error witness rejects changed metadata, declarations and workflow pairings', async () => {
  const bytes = await read(PAGE_ERROR_WITNESS_PATH),
    witness = validatePageErrorSourceWitness(bytes);
  const changed = JSON.parse(bytes);
  changed.sources[0].refs[0].sha256 = '0'.repeat(64);
  assert.throws(() => validatePageErrorSourceWitness(Buffer.from(JSON.stringify(changed))));
  for (const source of witness.sources)
    for (const { manifest, workflow } of source.releases) {
      const manifestBytes = await read(manifest),
        workflowBytes = await read(workflow);
      const refs = historicalPageErrorRefs(
        witness,
        manifest,
        workflow,
        manifestBytes,
        workflowBytes,
      );
      assert(refs.size > 0);
      assert(
        [...refs.keys()].every((path) =>
          [
            'scripts/qualify-solo-runtime.mjs',
            'scripts/solo-qualification-observation.mjs',
          ].includes(path),
        ),
      );
      const altered = JSON.parse(manifestBytes);
      altered.frozenTools.find((ref) => refs.has(ref.path)).sha256 = '0'.repeat(64);
      assert.throws(() =>
        historicalPageErrorRefs(
          witness,
          manifest,
          workflow,
          Buffer.from(JSON.stringify(altered)),
          workflowBytes,
        ),
      );
      assert.throws(() =>
        historicalPageErrorRefs(
          witness,
          manifest,
          workflow,
          manifestBytes,
          Buffer.concat([workflowBytes, Buffer.from(' ')]),
        ),
      );
      assert.throws(() =>
        historicalPageErrorRefs(witness, manifest, 'unknown', manifestBytes, workflowBytes),
      );
    }
});

test('additive qualification history rejects changed bytes, foreign releases and altered frozen refs', async () => {
  const bytes = await read(QUALIFICATION_TOOL_WITNESS_PATH),
    witness = JSON.parse(bytes);
  for (const source of witness.sources)
    for (const release of source.releases) {
      const manifest = await read(release.manifest),
        workflow = await read(release.workflow);
      const refs = historicalQualificationRefs(
        bytes,
        release.manifest,
        release.workflow,
        manifest,
        workflow,
      );
      assert.equal(refs.size, release.references.length);
      for (const args of [
        [
          Buffer.concat([bytes, Buffer.from(' ')]),
          release.manifest,
          release.workflow,
          manifest,
          workflow,
        ],
        [
          bytes,
          release.manifest,
          release.workflow,
          Buffer.concat([manifest, Buffer.from(' ')]),
          workflow,
        ],
        [
          bytes,
          release.manifest,
          release.workflow,
          manifest,
          Buffer.concat([workflow, Buffer.from(' ')]),
        ],
        [bytes, release.manifest, 'unknown', manifest, workflow],
      ])
        assert.throws(() => historicalQualificationRefs(...args));
      const changed = structuredClone(witness);
      changed.sources[0].records[0].sha256 = '0'.repeat(64);
      assert.throws(() =>
        historicalQualificationRefs(
          Buffer.from(JSON.stringify(changed)),
          release.manifest,
          release.workflow,
          manifest,
          workflow,
        ),
      );
      const alteredPlan = JSON.parse(manifest);
      (alteredPlan.frozenTools || alteredPlan.adapterInputs)[0].sha256 = '0'.repeat(64);
      assert.throws(() =>
        historicalQualificationRefs(
          bytes,
          release.manifest,
          release.workflow,
          Buffer.from(JSON.stringify(alteredPlan)),
          workflow,
        ),
      );
    }
});
