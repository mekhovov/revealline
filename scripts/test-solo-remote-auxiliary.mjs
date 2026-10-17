import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  AUXILIARY_JOBS,
  auxiliaryMatrix,
  auxiliaryArguments,
  auxiliaryAssessment,
  bindAuxiliaryJob,
  readAuxiliaryJSON,
  validateAuxiliaryPlan,
} from './solo-remote-auxiliary.mjs';

const dispatchedManifest = JSON.parse(
  await readFile(new URL('../docs/performance/solo-remote-auxiliary-plan.json', import.meta.url)),
);
const manifest = structuredClone(dispatchedManifest);
delete manifest.release.selectedJobs; // Exercise every supported arm independently of this release subset.
const clone = (x) => structuredClone(x);
function admitted() {
  const m = clone(manifest);
  m.status = 'reviewed-and-released';
  m.release = {
    firstEightAllCorrectnessPassed: true,
    priorProofInspected: true,
    noUnclosedOwners: true,
    evidence: [
      { runId: 1, artifactId: 2, artifactSHA256: 'a'.repeat(64), summarySHA256: 'b'.repeat(64) },
    ],
  };
  return m;
}
const plan = (job = 'speech-chromium') => bindAuxiliaryJob(admitted(), job);
const closed = {
  status: 'closed',
  exitCode: 0,
  forcedCleanup: false,
  survivors: [],
  ambiguous: [],
};
function raw(p, row) {
  const spec = AUXILIARY_JOBS[p.job],
    revision = p[row.source].revision;
  return {
    scenarioStatus: 'pass',
    scenarioSHA256: p.recipes[spec.recipe].sha256,
    sourceRevision: revision,
    buildIdentity: { sourceRevision: revision },
    environment: {
      engine: row.engine,
      cpuThrottle: 1,
      contextMode: row.engine === 'webkit' ? 'persistent' : 'ephemeral',
      browserVersion: '123.4',
    },
    replay: {
      scope: 'completed-scenario',
      nativeVerification: { status: 'pass', engine: row.engine, browserVersion: '123.4' },
    },
    pageErrors: [],
    performanceGateStatus:
      spec.recipe === 'recovery'
        ? 'excluded-synthetic-recovery'
        : 'excluded-audio-identity-profiling',
    audioIdentity: {
      status: 'pass',
      pending: 0,
      failed: 0,
      capped: 0,
      droppedStarts: 0,
      droppedMediaEvents: 0,
    },
  };
}
test('ordinary qualification cannot launch without reviewed first-eight proof', () => {
  assert.throws(() => bindAuxiliaryJob({ ...manifest, status: 'unreviewed' }, 'speech-chromium'));
  for (const change of [
    { firstEightAllCorrectnessPassed: false },
    { priorProofInspected: false },
    { noUnclosedOwners: false },
    { evidence: [] },
  ]) {
    const m = admitted();
    Object.assign(m.release, change);
    assert.throws(() => bindAuxiliaryJob(m, 'speech-chromium'));
  }
});
test('six fixed jobs retain original six commands and append four WebKit audio arms', () => {
  const jobs = Object.keys(AUXILIARY_JOBS).map(plan);
  assert.equal(jobs.length, 6);
  assert.equal(
    jobs.reduce((n, p) => n + p.rows.length, 0),
    10,
  );
  assert.deepEqual(
    jobs.map((p) => p.rows.map((r) => r.timeoutMs)),
    [[540000, 540000], [600000, 600000], [420000], [420000], [540000, 540000], [600000, 600000]],
  );
  assert(jobs.every((p) => p.performanceExclusion && p.cpu === 1));
});
test('workflow matrix binds the six fixed jobs and preserves disjoint helper shutdown margins', () => {
  assert.throws(() => auxiliaryMatrix({ ...manifest, status: 'unreviewed' }));
  const matrix = auxiliaryMatrix(admitted());
  assert.deepEqual(
    matrix.include.map((row) => row.job),
    Object.keys(AUXILIARY_JOBS),
  );
  for (const row of matrix.include) {
    const spec = AUXILIARY_JOBS[row.job];
    assert.equal(row.jobMinutes, spec.jobMinutes);
    assert.equal(row.stepMinutes, spec.helperMinutes + 3);
    assert.equal(row.outerSeconds, (spec.helperMinutes + 2) * 60);
  }
  const omitted = admitted();
  omitted.jobs.pop();
  assert.throws(() => auxiliaryMatrix(omitted));
});
test('independent diagnostics retain the failed prerequisite and cannot claim timing or retry', () => {
  for (const job of Object.keys(AUXILIARY_JOBS)) {
    const p = bindAuxiliaryJob(manifest, job);
    assert.equal(p.status, 'reviewed-diagnostic-only');
    assert.equal(p.release.firstEightAllCorrectnessPassed, false);
    const result = auxiliaryAssessment(p, p.rows.at(-1), raw(p, p.rows.at(-1)), closed, '123.4');
    assert.equal(result.firstEightAllCorrectnessPassed, false);
    assert.equal(result.performanceQualification, 'excluded');
  }
  for (const change of [
    { firstEightAllCorrectnessPassed: true },
    { priorProofInspected: false },
    { noUnclosedOwners: false },
    { evidence: [] },
    { automaticRetries: 1 },
    { performanceQualification: 'passed' },
    { predecessorRun: 1 },
    { scope: 'performance-qualification' },
  ]) {
    const p = clone(manifest);
    Object.assign(p.release, change);
    assert.throws(() => bindAuxiliaryJob(p, 'speech-chromium'));
  }
});
test('parallel auxiliary jobs retain separate job-named evidence artifacts', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/solo-remote-auxiliary-temporary.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /max-parallel: 2/);
  assert(!workflow.includes('fetch-depth: 0'));
  assert.match(
    workflow,
    /name: solo-linux-auxiliary-\$\{\{ matrix\.job \}\}-\$\{\{ github\.run_id \}\}/,
  );
  assert(!/matrix\.(phase|engine|repetition)/.test(workflow));
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(
    workflow,
    /github\.event\.action == 'synchronize' && github\.event\.before == 'aeadf7f43a8c1aba3af78d6cc8713666b4af49f1'/,
  );
});
test('a reviewed subset cannot repeat completed unrelated observations', () => {
  assert.deepEqual(
    auxiliaryMatrix(dispatchedManifest).include.map((row) => row.job),
    dispatchedManifest.release.selectedJobs,
  );
  assert(
    !auxiliaryMatrix(dispatchedManifest).include.some((row) => row.job.startsWith('recovery')),
  );
  const selected = clone(manifest);
  selected.release.selectedJobs = ['music-chromium', 'speech-webkit'];
  assert.deepEqual(
    auxiliaryMatrix(selected).include.map((row) => row.job),
    selected.release.selectedJobs,
  );
  assert.throws(() => bindAuxiliaryJob(selected, 'recovery-chromium'));
  for (const jobs of [
    [],
    ['unknown'],
    ['music-chromium', 'music-chromium'],
    ['speech-webkit', 'music-chromium'],
  ]) {
    selected.release.selectedJobs = jobs;
    assert.throws(() => auxiliaryMatrix(selected));
  }
  const qualified = admitted();
  qualified.release.selectedJobs = ['music-chromium'];
  assert.throws(() => auxiliaryMatrix(qualified));
});

function preparationManifest() {
  const value = clone(manifest);
  // Synthetic admission fixture only. Real package byte identities are unknown
  // until Appearance completes and must be pinned before any native execution.
  value.candidate.revision = 'bffcbd838a7bb925da8aaf030695773f893d8bda';
  Object.assign(value.release, {
    format: 'SoloStartPreparationConfirmationReleaseV1',
    scope: 'independent-start-preparation-confirmation',
    runtimeFix: 'b5b985f7049537a278632ba82228bb671f7f135a',
    candidateRevision: value.candidate.revision,
    selectedJobs: ['recovery-chromium', 'recovery-webkit'],
    repetitions: [1, 2, 3],
  });
  return value;
}

test('preparation confirmation declares six distinct existing-recipe observations with unchanged bounds', () => {
  const value = preparationManifest();
  const matrix = auxiliaryMatrix(value);
  assert.deepEqual(
    matrix.include.map(({ observation }) => observation),
    ['chromium', 'webkit'].flatMap((engine) => [1, 2, 3].map((n) => `recovery-${engine}-r${n}`)),
  );
  for (const row of matrix.include) {
    const p = bindAuxiliaryJob(value, row.job, row.repetition);
    assert.equal(row.jobMinutes, 105);
    assert.equal(row.stepMinutes, 63);
    assert.equal(row.outerSeconds, 3720);
    assert.equal(p.rows.length, 1);
    assert.equal(p.rows[0].timeoutMs, 420000);
    assert.equal(p.rows[0].id, `${row.observation}-candidate`);
    assert.equal(p.rows[0].source, 'candidate');
    assert.equal(p.helperTimeoutMs, 3600000);
    assert.equal(p.release.firstEightAllCorrectnessPassed, false);
    const args = auxiliaryArguments(
      { here: '/tools', plan: p, modeState: { recipePath: '/scenario' } },
      p.rows[0],
      'http://localhost/game/',
      '/evidence',
    );
    assert(args.includes(`--source-revision=${value.candidate.revision}`));
    assert(!args.includes('--audio-proof'));
    const observation = raw(p, p.rows[0]);
    assert.equal(auxiliaryAssessment(p, p.rows[0], observation, closed, '123.4').status, 'passed');
    observation.buildIdentity.sourceRevision = manifest.candidate.revision;
    assert.equal(auxiliaryAssessment(p, p.rows[0], observation, closed, '123.4').status, 'failed');
  }
});

test('preparation repetitions cannot reuse old source, expand jobs, alter ownership or add retries', () => {
  for (const change of [
    (p) => {
      p.candidate.revision = manifest.candidate.revision;
    },
    (p) => {
      p.release.candidateRevision = manifest.candidate.revision;
    },
    (p) => {
      p.release.runtimeFix = '0'.repeat(40);
    },
    (p) => {
      p.release.selectedJobs.push('speech-webkit');
    },
    (p) => {
      p.release.repetitions = [1, 1, 2];
    },
    (p) => {
      p.release.repetitions = [1, 2, 3, 4];
    },
    (p) => {
      p.release.automaticRetries = 1;
    },
    (p) => {
      p.release.noUnclosedOwners = false;
    },
    (p) => {
      p.release.firstEightAllCorrectnessPassed = true;
    },
  ]) {
    const value = preparationManifest();
    change(value);
    assert.throws(() => auxiliaryMatrix(value));
  }
  assert.throws(() => bindAuxiliaryJob(preparationManifest(), 'recovery-webkit', 0));
  assert.throws(() => bindAuxiliaryJob(preparationManifest(), 'recovery-webkit', 4));
  assert.throws(() => bindAuxiliaryJob(manifest, 'recovery-webkit', 2));
  const p = bindAuxiliaryJob(preparationManifest(), 'recovery-webkit', 2);
  p.observationId = 'recovery-webkit-r1';
  assert.throws(() => validateAuxiliaryPlan(p));
  const old = plan('recovery-webkit');
  old.observationId = 'recovery-webkit-r1';
  old.rows[0].id = 'recovery-webkit-r1-candidate';
  assert.throws(() => validateAuxiliaryPlan(old));
});

test('preparation declaration needs only the exact adapter and manifest, and binds one named repetition', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-recovery-declaration-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const module = join(dir, 'adapter.mjs');
  const input = join(dir, 'manifest.json');
  const output = join(dir, 'observation.json');
  const value = preparationManifest();
  await writeFile(module, await readFile(new URL('./solo-remote-auxiliary.mjs', import.meta.url)));
  await writeFile(input, JSON.stringify(value));
  const options = { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024, cwd: dir };
  assert.equal(
    execFileSync(process.execPath, [module, 'matrix-plan', input], options),
    `matrix=${JSON.stringify(auxiliaryMatrix(value))}\n`,
  );
  execFileSync(
    process.execPath,
    [module, 'bind-plan', input, output, 'recovery-webkit', '2'],
    options,
  );
  const bound = JSON.parse(await readFile(output));
  validateAuxiliaryPlan(bound);
  assert.equal(bound.observationId, 'recovery-webkit-r2');
  assert.equal(bound.rows[0].id, 'recovery-webkit-r2-candidate');
  assert.equal(bound.manifestInput.path, input);
  assert.equal(
    bound.manifestInput.sha256,
    createHash('sha256')
      .update(await readFile(input))
      .digest('hex'),
  );
});
test('verified baseline reuse requires its separately pinned verifier without permitting arbitrary helpers', () => {
  const p = plan();
  p.adapterInputs = p.adapterInputs.filter(
    (ref) => ref.path !== 'scripts/solo-remote-baseline.mjs',
  );
  p.baseline.reusableArtifact = {};
  assert.throws(() => validateAuxiliaryPlan(p));
  p.adapterInputs.push({
    path: 'scripts/solo-remote-baseline.mjs',
    bytes: 1,
    sha256: 'a'.repeat(64),
  });
  assert.equal(validateAuxiliaryPlan(p), p);
  p.adapterInputs[1].path = 'scripts/other.mjs';
  assert.throws(() => validateAuxiliaryPlan(p));
});
test('source, recipe, resource, row and concurrency changes cannot enter a job', () => {
  for (const mutate of [
    (p) => {
      p.candidate.revision = p.baseline.revision;
    },
    (p) => {
      p.rows[0].timeoutMs++;
    },
    (p) => {
      p.rows.push(p.rows[0]);
    },
    (p) => {
      p.recipes.speech.sha256 = '0'.repeat(64);
    },
    (p) => {
      p.helperTimeoutMs++;
    },
    (p) => {
      p.evidenceBytes++;
    },
    (p) => {
      p.rowEvidenceBytes++;
    },
    (p) => {
      p.setupTimeoutMs++;
    },
    (p) => {
      p.fixturePreparationTimeoutMs++;
    },
    (p) => {
      p.performanceExclusion = false;
    },
    (p) => {
      p.maxParallel = 3;
    },
    (p) => {
      p.cpu = 2;
    },
    (p) => {
      p.adapterInputs[0].path = 'scripts/other.mjs';
    },
  ]) {
    const p = plan();
    mutate(p);
    assert.throws(() => validateAuxiliaryPlan(p));
  }
});
test('all preserved recipe/upload bytes and the adapter pin match the draft manifest', async () => {
  for (const ref of [
    ...Object.values(manifest.recipes),
    ...manifest.uploads,
    ...manifest.adapterInputs,
  ]) {
    const bytes = await readFile(new URL('../' + ref.path, import.meta.url));
    assert.equal(bytes.length, ref.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256);
  }
});
test('audio and recovery argv preserve exact tools, engine context and intrusive exclusion', () => {
  for (const job of Object.keys(AUXILIARY_JOBS)) {
    const p = plan(job);
    for (const row of p.rows) {
      const args = auxiliaryArguments(
        { here: '/tools', plan: p, modeState: { recipePath: '/scenario' } },
        row,
        'http://localhost/game/',
        '/evidence',
      );
      assert.equal(args.includes('--audio-proof'), !job.startsWith('recovery'));
      assert.equal(args.includes('--context=persistent'), row.engine === 'webkit');
      assert.equal(args.includes('--baseline-runtime'), row.source === 'baseline');
      assert(args.includes('--cpu=1'));
      assert(!args.some((x) => x.includes('cpu-profile') || x.includes('memory-profile')));
    }
  }
});
test('complete audio identities and synthetic main recovery can qualify only their declared correctness scope', () => {
  for (const job of Object.keys(AUXILIARY_JOBS)) {
    const p = plan(job),
      row = p.rows.at(-1),
      result = auxiliaryAssessment(p, row, raw(p, row), closed, '123.4');
    assert.equal(result.status, 'passed');
    assert.equal(result.performanceQualification, 'excluded');
    if (job.startsWith('recovery')) assert.match(result.scope, /no Demo or actual GPU/);
  }
});
test('positive audio witnesses with any pending, failed, capped or dropped observation stay failed', () => {
  const p = plan('music-chromium'),
    row = p.rows[1];
  for (const key of ['pending', 'failed', 'capped', 'droppedStarts', 'droppedMediaEvents']) {
    const r = raw(p, row);
    r.audioIdentity[key] = 1;
    assert.equal(auxiliaryAssessment(p, row, r, closed, '123.4').status, 'failed');
  }
});
test('wrong source/recipe/browser/replay/engine/context or partial replay cannot grant credit', () => {
  const p = plan(),
    row = p.rows[1];
  for (const mutate of [
    (r) => {
      r.sourceRevision = p.baseline.revision;
    },
    (r) => {
      r.scenarioSHA256 = '0'.repeat(64);
    },
    (r) => {
      r.environment.browserVersion = 'other';
    },
    (r) => {
      r.replay.nativeVerification.status = 'fail';
    },
    (r) => {
      r.replay.nativeVerification.engine = 'webkit';
    },
    (r) => {
      r.replay.scope = 'partial-scenario';
    },
    (r) => {
      r.environment.cpuThrottle = 2;
    },
    (r) => {
      r.environment.contextMode = 'persistent';
    },
    (r) => {
      r.pageErrors.push('error');
    },
    (r) => {
      r.performanceGateStatus = 'pass';
    },
    (r) => {
      r.finalReadFailure = 'final snapshot incomplete';
    },
    (r) => {
      r.failureCleanupFailure = 'failed observation cleanup';
    },
  ]) {
    const r = raw(p, row);
    mutate(r);
    assert.equal(auxiliaryAssessment(p, row, r, closed, '123.4').status, 'failed');
  }
});
test('resource stops, forced cleanup and unknown owners cannot become successful observations', () => {
  const p = plan(),
    row = p.rows[1];
  for (const change of [
    { status: 'failed' },
    { exitCode: 1 },
    { forcedCleanup: true },
    { cleanupUnconfirmed: true },
    { violation: 'rss' },
    { survivors: [1] },
    { ambiguous: [1] },
  ])
    assert.equal(
      auxiliaryAssessment(p, row, raw(p, row), { ...closed, ...change }, '123.4').status,
      'failed',
    );
});
test('bounded report read refuses oversized and aliased input', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'aux-report-')));
  try {
    const target = join(root, 'report.json');
    await writeFile(target, '{"status":"pass"}');
    assert.deepEqual(await readAuxiliaryJSON(target, 64), { status: 'pass' });
    await assert.rejects(readAuxiliaryJSON(target, 4));
    const alias = join(root, 'alias.json');
    await symlink(target, alias);
    await assert.rejects(readAuxiliaryJSON(alias, 64));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('WebKit audio keeps exact original fixtures and rejects context, replay, and cleanup failures', () => {
  for (const recipe of ['speech', 'music']) {
    const chromium = plan(`${recipe}-chromium`);
    const webkit = plan(`${recipe}-webkit`);
    assert.deepEqual(webkit.recipes[recipe], chromium.recipes[recipe]);
    assert.deepEqual(webkit.uploads, chromium.uploads);
    assert.deepEqual(webkit.musicBundle, chromium.musicBundle);
    assert.deepEqual(
      webkit.rows.map((row) => row.timeoutMs),
      chromium.rows.map((row) => row.timeoutMs),
    );
    assert.equal(webkit.maxParallel, 2);
    for (const row of webkit.rows) {
      const actual = raw(webkit, row);
      assert.equal(auxiliaryAssessment(webkit, row, actual, closed, '123.4').status, 'passed');
      for (const mutate of [
        (value) => {
          value.environment.contextMode = 'ephemeral';
        },
        (value) => {
          value.replay.nativeVerification.engine = 'chromium';
        },
        (value) => {
          value.replay.nativeVerification.browserVersion = 'other';
        },
        (value) => {
          value.contextCleanupFailure = 'persistent profile did not close';
        },
        (value) => {
          value.audioIdentity.pending = 1;
        },
      ]) {
        const invalid = clone(actual);
        mutate(invalid);
        assert.equal(auxiliaryAssessment(webkit, row, invalid, closed, '123.4').status, 'failed');
      }
    }
  }
});
