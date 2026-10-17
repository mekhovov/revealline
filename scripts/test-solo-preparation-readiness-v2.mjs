import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { bindReadinessJob, readinessMatrix, readinessRowPlan } from './solo-remote-readiness.mjs';
const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const oldPath = 'docs/performance/solo-readiness-preparation-e1cc-plan.json';
const currentPath = 'docs/performance/solo-readiness-preparation-e1cc-v2-plan.json';
const workflowPath = '.github/workflows/solo-remote-readiness-preparation-e1cc-v2-temporary.yml';
const oldBytes = await read(oldPath),
  prior = JSON.parse(oldBytes);
const value = JSON.parse(await read(currentPath));
const workflow = (await read(workflowPath)).toString();
const before = '7c7cc2648331870683ac7b76850bbeff859f802e';
const conditions = [
  'github.event.pull_request.number == 1544',
  'github.event.pull_request.head.repo.full_name == github.repository',
  "github.event.action == 'synchronize'",
  `github.event.before == '${before}'`,
];
function guard(text) {
  assert(text.includes('    if: ' + conditions.join(' && ') + '\n'));
  for (const forbidden of ['workflow_dispatch', 'continue-on-error', 'if: ${{ false }}'])
    assert(!text.includes(forbidden), forbidden);
}
function declaredCorrection(m) {
  assert.equal(m.release.onceOnlyBefore, before);
  assert.deepEqual(m.release.setupCorrection, {
    format: 'SoloPreparationRowDispatchSuccessorV1',
    priorRun: 39044567357,
    priorTooling: before,
    priorConclusion: 'failure',
    priorNativeObservations: 0,
    priorAdapterFailures: 2,
    priorRowsNotRun: 10,
    originalDeclaration: { path: oldPath, bytes: oldBytes.length, sha256: hash(oldBytes) },
    reason: 'immutable-declaration-compared-with-common-runner-report-metadata',
    runtimeChanged: false,
    scenarioChanged: false,
    gateChanged: false,
    automaticRetries: 0,
  });
  assert.equal(m.release.priorProofInspected, true);
  assert.equal(m.release.noUnclosedOwners, true);
  assert.equal(m.release.automaticRetries, 0);
  assert.equal(m.release.performanceQualification, 'excluded');
  assert.equal(m.release.firstEightAllCorrectnessPassed, false);
}

function descriptiveMetadata(m) {
  assert.equal(
    m.sourceScope,
    'Exact independently verified e1cc/118 production package. This separately declared successor corrects the executed7c7 readiness dispatcher integration; it does not reassign earlier c696 observations or qualify later runtime changes.',
  );
  assert.deepEqual(m.metadataAdmission, {
    remoteVerificationRequired: true,
    metadataArtifact: 12104261890,
    packageBinding: {
      path: '.cache/solo-followup/e1cc-package-next/appearance-retained/members/package-binding.json',
      bytes: 7931,
      sha256: 'f548ebdc12740dfb59d2fdb6ba49fdf3cf0aa8095eda469239852a540c54cbab',
    },
    scope:
      'Metadata authority only; full outer/inner/source/CSP and native owner admission remain mandatory before each row. No native/performance/physical/offline pass inferred.',
  });
  assert.deepEqual(m.priorResults, {
    run: 39044567357,
    tooling: '7c7cc2648331870683ac7b76850bbeff859f802e',
    conclusion: 'failure',
    nativeObservations: 0,
    adapterFailures: 2,
    rowsNotRun: 10,
    retained: true,
    note: 'docs/performance/solo-preparation-dispatch-20261017.md',
  });
  assert.equal(Object.hasOwn(m, 'priorHeldProposal'), false);
  assert.equal(m.candidate.revision, 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17');
  assert.equal(m.candidate.tree, '58f19392e25384620d896098fce8616b538e318d');
  assert.equal(m.candidate.run, 39037874955);
  assert.equal(m.candidate.artifact, 12104590541);
}

test('prospective descriptions bind actual118 metadata and the failed7c7 dispatcher without reassigning history', () => {
  descriptiveMetadata(value);
  for (const change of [
    (m) => (m.sourceScope = prior.sourceScope),
    (m) => (m.metadataAdmission = structuredClone(prior.metadataAdmission)),
    (m) => (m.metadataAdmission.packageBinding.sha256 = '0'.repeat(64)),
    (m) => (m.priorResults = structuredClone(prior.priorResults)),
    (m) => m.priorResults.nativeObservations++,
    (m) => (m.priorHeldProposal = structuredClone(prior.priorHeldProposal)),
    (m) => (m.candidate.revision = 'c696af418'.padEnd(40, '0')),
  ]) {
    const m = structuredClone(value);
    change(m);
    assert.throws(() => descriptiveMetadata(m));
  }
});

test('setup-only successor preserves actual e1cc artifact, all twelve rows and every original scenario/limit', () => {
  declaredCorrection(value);
  for (const key of Object.keys(prior).filter(
    (k) =>
      ![
        'release',
        'adapterInputs',
        'frozenTools',
        'sourceScope',
        'metadataAdmission',
        'priorResults',
        'priorHeldProposal',
      ].includes(k),
  ))
    assert.deepEqual(value[key], prior[key], key);
  assert.deepEqual(readinessMatrix(value), readinessMatrix(prior));
  for (const engine of value.engines) {
    const old = bindReadinessJob(prior, engine),
      plan = bindReadinessJob(value, engine);
    assert.deepEqual(plan.rows, old.rows);
    for (const row of plan.rows) {
      const selected = readinessRowPlan(plan, row),
        previous = readinessRowPlan(old, row);
      for (const key of [
        'phase',
        'fixture',
        'rows',
        'protocol',
        'candidate',
        'runtimeRevision',
        'setupTimeoutMs',
        'helperTimeoutMs',
        'rowEvidenceBytes',
        'evidenceBytes',
      ])
        assert.deepEqual(selected[key], previous[key], key);
    }
  }
});

test('new declaration freezes the current adapter and every helper; sparse checkout includes actual dispatch control', async () => {
  const sparse = [...workflow.matchAll(/^            \/([^\n]+)$/gm)].map((m) => m[1]);
  assert.equal(new Set(sparse).size, sparse.length);
  for (const ref of [
    ...value.adapterInputs,
    ...value.frozenTools,
    value.fixture,
    ...value.additionalFixtures,
  ]) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(hash(bytes), ref.sha256, ref.path);
    assert(sparse.includes(ref.path), ref.path);
  }
  for (const path of [
    currentPath,
    oldPath,
    workflowPath,
    'scripts/test-solo-readiness-dispatch.mjs',
    'scripts/test-solo-preparation-readiness-v2.mjs',
    'scripts/test-solo-optional-start-audio-release.mjs',
    'docs/performance/solo-optional-start-audio-e1cc-plan.json',
    '.github/workflows/solo-remote-optional-start-audio-e1cc-temporary.yml',
    'docs/performance/fixtures/solo-readiness-geometry/7c7-execution-source.json',
  ])
    assert(sparse.includes(path), path);
  const tests = workflow.match(/node --test --test-concurrency=2 ([^\n]+) 2>&1/)[1].split(' ');
  assert(tests.includes('scripts/test-solo-readiness-dispatch.mjs'));
  for (const path of tests) {
    assert(sparse.includes(path), path);
    assert((await read(path)).length > 0);
  }
});

test('single before7c7 edge and original command/owner envelopes cannot be relaxed', () => {
  guard(workflow);
  for (const condition of conditions)
    assert.throws(() => guard(workflow.replace(condition, 'true')));
  for (const required of [
    'timeout-minutes: 130',
    'timeout-minutes: 78',
    '4620s node scripts/run-solo-remote-correctness.mjs',
    'bind-plan ' + currentPath,
    'ref: ' + value.candidate.revision,
    'max-parallel: 2',
    'cancel-in-progress: false',
  ])
    assert(workflow.includes(required), required);
  assert(!workflow.includes('workflow_run'));
  for (const change of [
    (m) => m.release.setupCorrection.priorNativeObservations++,
    (m) => m.release.setupCorrection.priorAdapterFailures--,
    (m) => (m.release.setupCorrection.originalDeclaration.sha256 = '0'.repeat(64)),
    (m) => (m.release.setupCorrection.runtimeChanged = true),
    (m) => (m.release.setupCorrection.scenarioChanged = true),
    (m) => (m.release.setupCorrection.gateChanged = true),
    (m) => m.release.setupCorrection.automaticRetries++,
    (m) => (m.release.onceOnlyBefore = value.candidate.revision),
  ]) {
    const m = structuredClone(value);
    change(m);
    assert.throws(() => declaredCorrection(m));
  }
});

test('actual one-module adapter CLI binds both corrected jobs without acquiring a browser or payload', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-readiness-dispatch-cli-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const adapter = join(dir, 'adapter.mjs'),
    manifest = join(dir, 'plan.json');
  await writeFile(adapter, await read('scripts/solo-remote-readiness.mjs'));
  await writeFile(manifest, await read(currentPath));
  for (const engine of value.engines) {
    const output = join(dir, engine + '.json');
    const result = spawnSync(process.execPath, [adapter, 'bind-plan', manifest, output, engine], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 65536,
    });
    assert.equal(result.status, 0, result.stderr);
    const bound = JSON.parse(await readFile(output));
    assert.deepEqual(bound.rows, bindReadinessJob(value, engine).rows);
    assert.deepEqual(bound.candidate, value.candidate);
    assert.equal(bound.release.onceOnlyBefore, before);
  }
});
