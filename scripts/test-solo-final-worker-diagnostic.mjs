import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  FINAL_WORKER_COHORT,
  WORKER_DIAGNOSTIC_ROWS,
  validateWorkerDiagnosticPlan,
  workerDiagnosticAssessment,
  workerProbeArguments,
  prepareWorkerDiagnosticMode,
} from './solo-remote-worker-diagnostic.mjs';
import { validateWorkerSourceWitness } from './solo-worker-source-witness.mjs';
const root = new URL('../', import.meta.url),
  read = (p) => readFile(new URL(p, root));
const original = JSON.parse(await read('docs/performance/solo-remote-worker-diagnostic-plan.json'));
const packagePlan = JSON.parse(await read('docs/performance/solo-final-soak-plan.json'));

const priorDeclarationPath = 'docs/performance/solo-final-worker-diagnostic-plan.json';
const priorSourcePath =
  'docs/performance/fixtures/solo-worker-diagnostic/f179-declared-source.json';
function priorWorkerSource(bytes, declaration) {
  assert.equal(bytes.length, 1139);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    '9bf9baecad951bc7bf3e4b0facdaaba38d944a5fdbe2778b261d0d19def94a60',
  );
  const witness = JSON.parse(bytes);
  assert.equal(witness.format, 'SoloFinalWorkerDeclaredSourceV1');
  assert.equal(witness.revision, 'f1798f323204b02898d4e7d45a7c5b69df73914d');
  assert.equal(witness.tree, '2c0faa46fc9ed42aa4e8c7af1be44f2899ab582f');
  assert.deepEqual(
    witness.records.map((r) => r.path),
    [
      'docs/performance/solo-final-worker-diagnostic-plan.json',
      'scripts/solo-remote-worker-diagnostic.mjs',
      'scripts/run-solo-remote-correctness.mjs',
    ],
  );
  const refs = new Map(witness.records.map((r) => [r.path, r]));
  assert.equal(declaration.length, refs.get(priorDeclarationPath).bytes);
  assert.equal(
    createHash('sha256').update(declaration).digest('hex'),
    refs.get(priorDeclarationPath).sha256,
  );
  refs.delete(priorDeclarationPath);
  return refs;
}

async function finalPlan() {
  const p = structuredClone(original);
  p.sourceCohort = FINAL_WORKER_COHORT;
  p.candidate = structuredClone(packagePlan.candidate);
  p.baseline = { revision: packagePlan.baseline.revision, tree: packagePlan.baseline.tree };
  p.runtimeRevision = packagePlan.latestRuntimeRevision;
  Object.assign(p.release, {
    candidateRevision: p.candidate.revision,
    predecessorRun: 39012635540,
    historicalPredecessorRun: 38985941469,
    scope: 'independent-final-worker-idle-diagnostic',
    onceOnlyBefore: 'a7e0219818842f02399317ca6d2a14bdd506da3d',
    predecessorWorkerReport: {
      bytes: 2670,
      sha256: '7b5e8cd5251423092ef4ec8e82b629e8186ed480f77080214503fd91a57b55eb',
    },
  });
  p.frozenTools = [];
  for (const path of [
    'scripts/run-solo-remote-correctness.mjs',
    'scripts/verify-solo-build.mjs',
    'scripts/solo-remote-archive.py',
    'scripts/soundtrack-distribution.mjs',
    'scripts/optional-distribution.mjs',
    'scripts/external-distribution.mjs',
    'scripts/optional-artwork.mjs',
  ]) {
    const bytes = await read(path);
    p.frozenTools.push({
      path,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  return p;
}
test('final worker admission preserves exactly three paired 12-second windows and original probe arguments', async () => {
  const p = await finalPlan();
  validateWorkerDiagnosticPlan(p);
  validateWorkerDiagnosticPlan(original);
  assert.deepEqual(p.rows, WORKER_DIAGNOSTIC_ROWS);
  for (const row of p.rows)
    assert.deepEqual(
      workerProbeArguments(p, row, 'url', 'report'),
      workerProbeArguments(original, row, 'url', 'report'),
    );
  assert.equal(p.helperTimeoutMs, 75 * 60000);
  assert.equal(p.rowEvidenceBytes, 32 * 1024 ** 2);
  assert.equal(p.evidenceBytes, 256 * 1024 ** 2);
});
test('final source cannot claim another cohort, source, predecessor, runtime, baseline payload or relaxed window', async () => {
  const original = await finalPlan();
  for (const mutate of [
    (p) => {
      p.sourceCohort = 'other';
    },
    (p) => {
      delete p.sourceCohort;
    },
    (p) => {
      p.format = 'SoloHostedWorkerConfirmationPlanV1';
    },
    (p) => {
      p.candidate.tree = '0'.repeat(40);
    },
    (p) => {
      p.runtimeRevision = p.candidate.revision;
    },
    (p) => {
      p.release.predecessorRun = 38985941469;
    },
    (p) => {
      p.release.predecessorWorkerReport.sha256 = '0'.repeat(64);
    },
    (p) => {
      p.release.onceOnlyBefore = p.candidate.revision;
    },
    (p) => {
      p.baseline.reusableArtifact = {};
    },
    (p) => {
      p.release.firstEightAllCorrectnessPassed = true;
    },
    (p) => p.windowMs++,
    (p) => p.rows.reverse(),
    (p) => p.rows[0].timeoutMs++,
    (p) => p.automaticRetries++,
    (p) => {
      p.frozenTools = p.frozenTools.filter((r) => r.path !== 'scripts/optional-artwork.mjs');
    },
  ]) {
    const p = structuredClone(original);
    mutate(p);
    assert.throws(() => validateWorkerDiagnosticPlan(p));
  }
});
test('final diagnostic raw source and pause failures remain independently visible', async () => {
  const p = await finalPlan(),
    command = { status: 'closed', exitCode: 0, forcedCleanup: false, survivors: [], ambiguous: [] };
  const raw = {
    engine: 'webkit',
    browser: '26.5',
    status: 'passed',
    mode: 'worker',
    validationPassed: true,
    active: { flightBefore: 'running', flightAfter: 'running' },
    pageErrors: [],
    diagnostics: {
      mode: 'worker-inspection',
      application: { sourceRevision: p.candidate.revision, phase: 'paused' },
      windowMs: 12000,
      windowStartedAtMs: 100,
      windowEndedAtMs: 12100,
      initialFlightState: 'running',
      finalFlightState: 'running',
    },
  };
  assert.equal(workerDiagnosticAssessment(raw, command, p.rows[0], p).status, 'passed');
  assert.equal(workerDiagnosticAssessment(raw, command, p.rows[0]).status, 'failed');
  for (const mutate of [
    (r) => {
      r.diagnostics.application.sourceRevision = original.candidate.revision;
    },
    (r) => {
      r.diagnostics.finalFlightState = 'paused';
    },
    (r) => {
      r.active.flightAfter = 'paused';
    },
    (r) => {
      r.validationPassed = false;
    },
    (r) => {
      r.diagnostics.windowEndedAtMs--;
    },
    (r) => {
      r.pageErrors.push('error');
    },
  ]) {
    const r = structuredClone(raw);
    mutate(r);
    assert.equal(workerDiagnosticAssessment(r, command, p.rows[0], p).status, 'failed');
  }
  const paused = structuredClone(raw);
  paused.diagnostics.finalFlightState = 'paused';
  const result = workerDiagnosticAssessment(paused, command, p.rows[0], p);
  assert.equal(result.diagnosticCompleteness, 'complete');
  assert.equal(result.status, 'failed');
  assert.equal(result.performanceQualification, 'excluded');
  assert.equal(result.firstEightAllCorrectnessPassed, false);
});
test('final preparation requires exact admitted source tree and artifact without starting a baseline', async () => {
  const plan = await finalPlan();
  for (const list of ['adapterInputs', 'frozenTools'])
    plan[list] = await Promise.all(
      plan[list].map(async (r) => {
        const b = await read(r.path);
        return {
          path: r.path,
          bytes: b.length,
          sha256: createHash('sha256').update(b).digest('hex'),
        };
      }),
    );
  const ctx = {
    plan,
    repository: new URL('../', import.meta.url).pathname.replace(/\/$/, ''),
    admitted: {
      status: 'passed',
      artifacts: {
        candidate: {
          sourceRevision: plan.candidate.revision,
          sourceTree: plan.candidate.tree,
          manifestSHA256: plan.candidate.manifestSHA256,
          archiveIdentity: plan.candidate.inner,
        },
      },
    },
    digest: async (path) => {
      const b = await readFile(path);
      return { bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') };
    },
  };
  assert.equal((await prepareWorkerDiagnosticMode(ctx)).performanceQualification, 'excluded');
  ctx.admitted.artifacts.candidate.sourceTree = '0'.repeat(40);
  await assert.rejects(prepareWorkerDiagnosticMode(ctx));
});
test('historical worker provenance rejects altered witness bytes', async () => {
  const b = await read(
    'docs/performance/fixtures/solo-worker-diagnostic/historical-a7e-source.json',
  );
  assert.equal(validateWorkerSourceWitness(b).files.length, 8);
  const changed = JSON.parse(b);
  changed.files[0].bytes++;
  assert.throws(() => validateWorkerSourceWitness(Buffer.from(JSON.stringify(changed))));
});

test('concrete final worker release binds actual package, all source tools and one reviewed edge', async () => {
  const p = JSON.parse(await read('docs/performance/solo-final-worker-diagnostic-plan.json'));
  validateWorkerDiagnosticPlan(p);
  assert.deepEqual(p.candidate, packagePlan.candidate);
  assert.deepEqual(p.baseline, {
    revision: packagePlan.baseline.revision,
    tree: packagePlan.baseline.tree,
  });
  const prior = priorWorkerSource(await read(priorSourcePath), await read(priorDeclarationPath));
  for (const ref of [...p.adapterInputs, ...p.frozenTools]) {
    const historical = prior.get(ref.path);
    if (historical) {
      assert.equal(historical.bytes, ref.bytes);
      assert.equal(historical.sha256, ref.sha256);
    } else {
      const bytes = await read(ref.path);
      assert.equal(bytes.length, ref.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256);
    }
  }
  const wf = (
    await read('.github/workflows/solo-remote-final-worker-diagnostic-temporary.yml')
  ).toString();
  const guard =
    "if: github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'";
  assert.equal(wf.split(guard).length, 2);
  assert(!wf.includes('workflow_dispatch'));
  assert(wf.includes('cancel-in-progress: false'));
  assert(wf.includes('timeout-minutes: 145'));
  assert(
    wf.includes(
      'timeout --signal=TERM --kill-after=30s 78m node scripts/run-solo-remote-correctness.mjs docs/performance/solo-final-worker-diagnostic-plan.json',
    ),
  );
  assert.equal((wf.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  assert(wf.includes('retention-days: 14'));
  assert(wf.includes('if-no-files-found: warn'));
  assert(wf.includes('fetch-depth: 1'));
  assert(!wf.includes('fetch-depth: 0'));
  assert(wf.includes('sparse-checkout-cone-mode: false'));
  for (const path of [
    'scripts/soundtrack-distribution.mjs',
    'scripts/optional-distribution.mjs',
    'scripts/external-distribution.mjs',
    'scripts/optional-artwork.mjs',
    'scripts/solo-source-verifier-smoke.mjs',
    'scripts/test-solo-source-verifier-smoke.mjs',
    'game/build-config.json',
    'game/test/fixtures/audio/silence-mpeg1-layer3.mp3',
  ])
    assert(wf.includes(`            /${path}\n`), path);
  assert(wf.includes('node --test --test-concurrency=2'));
  assert(wf.includes('scripts/test-solo-source-verifier-smoke.mjs '));
  for (const [revision, path] of [
    [p.candidate.revision, 'candidate'],
    [p.baseline.revision, 'baseline'],
  ])
    assert(
      new RegExp(
        `timeout-minutes: 3\\n        with:\\n          ref: ${revision}\\n          path: ${path}`,
      ).test(wf),
    );
  assert(!wf.includes('npm ci --prefix baseline'));
});

test('exact prior final worker readback refuses altered witness or declaration', async () => {
  const witness = await read(priorSourcePath),
    declaration = await read(priorDeclarationPath);
  assert.equal(priorWorkerSource(witness, declaration).size, 2);
  for (const [w, d] of [
    [Buffer.concat([witness, Buffer.from(' ')]), declaration],
    [witness, Buffer.concat([declaration, Buffer.from(' ')])],
    [
      Buffer.from(JSON.stringify({ ...JSON.parse(witness), revision: '0'.repeat(40) })),
      declaration,
    ],
  ])
    assert.throws(() => priorWorkerSource(w, d));
});
