import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

// This executed declaration is immutable. New declarations must check current files.
const executionWitnessBytes = await readFile(
  new URL(
    '../docs/performance/fixtures/solo-readiness-geometry/7c7-execution-source.json',
    import.meta.url,
  ),
);
function executedBindings(bytes, declarationBytes, workflowBytes) {
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    'a54fa43e5f89dc2ccce08f69892421213d5a6a0deb107ebc6dc320f174665613',
  );
  const witness = JSON.parse(bytes);
  assert.equal(witness.head, '7c7cc2648331870683ac7b76850bbeff859f802e');
  assert.equal(witness.tree, 'e20aabb50c0e82c52c0970a14934b2d05611f53e');
  for (const [path, value] of [
    ['docs/performance/solo-native-lifecycle-e1cc-plan.json', declarationBytes],
    ['.github/workflows/solo-remote-native-lifecycle-e1cc-temporary.yml', workflowBytes],
  ]) {
    const entry = witness.records.find((r) => r.path === path);
    assert(entry, path);
    assert.equal(value.length, entry.bytes, path);
    assert.equal(createHash('sha256').update(value).digest('hex'), entry.sha256, path);
  }
  return witness;
}
const root = process.cwd();
const base = process.env.SOLO_LIFECYCLE_E1CC_PROPOSAL || join(root, 'scripts');
const {
  lifecycleSourceFor,
  lifecycleCaseFor,
  lifecycleCase,
  LIFECYCLE_SOURCE,
  LIFECYCLE_E1CC_SOURCE,
  LIFECYCLE_E1CC_PACKAGE,
  LIFECYCLE_PROTOCOL,
  LIFECYCLE_RUN_RETENTION_POLICY,
  LIFECYCLE_PREPARATION_RETENTION,
  bindLifecycleJob,
  lifecycleMatrix,
  validateLifecyclePlan,
} = await import(pathToFileURL(join(base, 'solo-remote-lifecycle.mjs')));
const old = JSON.parse(
  await readFile(join(root, 'docs/performance/solo-native-lifecycle-v2-plan.json')),
);
const held = JSON.parse(
  await readFile(join(base, '../docs/performance/solo-native-lifecycle-e1cc-plan.json')),
);

test('legacy exact a6 native row and bounds are unchanged', () => {
  assert.equal(lifecycleSourceFor(old), LIFECYCLE_SOURCE);
  assert.deepEqual(lifecycleCaseFor(old), lifecycleCase());
  const plan = bindLifecycleJob(old, 'chromium-background');
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0].timeoutMs, 600000);
  assert.equal(plan.helperTimeoutMs, 3300000);
  assert.equal(plan.protocol.observationTimeoutMs, 360000);
  assert.equal(plan.protocol.replayTimeoutMs, 120000);
  assert.deepEqual(lifecycleMatrix(old), {
    include: [{ job: 'chromium-background', jobMinutes: 100, stepMinutes: 58, outerSeconds: 3420 }],
  });
});
test('only exact final-layout source selector and actual successful118 package are admitted', () => {
  assert.equal(lifecycleSourceFor(held), LIFECYCLE_E1CC_SOURCE);
  assert.equal(LIFECYCLE_E1CC_SOURCE.revision, 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17');
  assert.equal(LIFECYCLE_E1CC_SOURCE.tree, '58f19392e25384620d896098fce8616b538e318d');
  assert.equal(LIFECYCLE_E1CC_SOURCE.runtime, LIFECYCLE_E1CC_SOURCE.revision);
  assert.deepEqual(held.candidate, LIFECYCLE_E1CC_PACKAGE);
  assert.equal(LIFECYCLE_E1CC_PACKAGE.run, 39037874955);
  assert.equal(LIFECYCLE_E1CC_PACKAGE.artifact, 12104590541);
  assert.deepEqual(LIFECYCLE_E1CC_PACKAGE.outer, {
    bytes: 1091965213,
    sha256: 'fb85094a61cdc329ccf8a1488b6e3ca1043ef5f249a6b33729bb04141336af1e',
  });
  assert.deepEqual(LIFECYCLE_E1CC_PACKAGE.inner, {
    bytes: 1073790972,
    sha256: '6c8bbb6aafe3f9d55e2fb445d5846a5e9d02ebd648c4e630889743bf76ec421e',
  });
  assert.equal(
    LIFECYCLE_E1CC_PACKAGE.manifestSHA256,
    '23f555db20036838cc1601f2cebf8f1a75eb62fb0c6cf36f1e1988035b3e1b64',
  );
  for (const sourceCohort of [
    '',
    'lifecycle-candidatee1cc',
    'lifecycle-candidateE1CC-v1',
    'lifecycle-candidatec696-v1',
    null,
  ])
    assert.throws(() => lifecycleSourceFor({ sourceCohort }));
});
test('missing, tampered and historical package identities cannot execute the new source', () => {
  assert.equal(held.releaseTrigger.status, 'reviewed-one-shot');
  assert.equal(held.releaseTrigger.onceOnlyBefore, LIFECYCLE_E1CC_SOURCE.revision);
  assert.equal(held.currentSourceCorrectness.status, 'unobserved');
  assert.equal(
    held.packageMetadataProof.sha256,
    'fd82e61aee70d927d9860e62063dd373733d6d3108d61e8b4bd0e5a22849b54a',
  );
  assert.equal(
    held.priorLinuxOwners.sha256,
    'a9c8afc47cc982ed74a87af50a7c4bab60dd5fd8dbc6c494ce39d48dc01383a1',
  );
  for (const mutate of [
    (p) => (p.candidate = old.candidate),
    ...['run', 'artifact', 'outer', 'inner', 'manifestSHA256'].map(
      (key) => (p) => (p.candidate[key] = null),
    ),
    (p) => p.candidate.outer.bytes++,
    (p) => (p.candidate.inner.sha256 = 'f'.repeat(64)),
    (p) => (p.runtimeRevision = old.runtimeRevision),
  ]) {
    const plan = structuredClone(held);
    mutate(plan);
    assert.throws(() => bindLifecycleJob(plan, 'chromium-background'));
  }
});
test('only the reviewed e1cc hidden tuple resolves with unchanged native bounds', () => {
  const execution = {
    sourceCohort: held.sourceCohort,
    runRetentionPolicy: LIFECYCLE_RUN_RETENTION_POLICY,
    preparationRetention: LIFECYCLE_PREPARATION_RETENTION,
    job: { ...lifecycleCase(), id: 'chromium-preparation-hidden-r1', mode: 'preparation-hidden' },
  };
  assert.deepEqual(lifecycleCaseFor(execution), execution.job);
  assert.deepEqual(
    lifecycleCaseFor({ ...execution, job: 'chromium-preparation-hidden' }),
    execution.job,
  );
  assert.deepEqual(
    lifecycleCaseFor({ sourceCohort: held.sourceCohort, job: lifecycleCase() }),
    lifecycleCase(),
  );
  for (const patch of [
    { sourceCohort: undefined },
    { runRetentionPolicy: undefined },
    { runRetentionPolicy: 'retained-paused-run' },
    { preparationRetention: undefined },
    { preparationRetention: 'visible-busy-shared-font' },
    { job: { ...execution.job, engine: 'webkit' } },
    { job: { ...execution.job, viewport: { width: 1280, height: 801 } } },
    { job: { ...execution.job, repetition: 2 } },
    { job: { ...execution.job, id: 'chromium-background-r1' } },
    { job: 'chromium-background' },
    { job: 'chromium-other' },
  ])
    assert.throws(() => lifecycleCaseFor({ ...execution, ...patch }));
  assert.equal(LIFECYCLE_PROTOCOL.observationTimeoutMs, 360000);
  assert.equal(LIFECYCLE_PROTOCOL.replayTimeoutMs, 120000);
  assert.equal(LIFECYCLE_PROTOCOL.hiddenMs, 10000);
  assert.equal(LIFECYCLE_PROTOCOL.resumedFrameCapacity, 16);
});

test('actual two-row package binding preserves strict bounds and rejects every broadened control', () => {
  const manifest = structuredClone(held);
  assert.deepEqual(lifecycleMatrix(manifest), {
    include: ['chromium-background', 'chromium-preparation-hidden'].map((job) => ({
      job,
      jobMinutes: 100,
      stepMinutes: 58,
      outerSeconds: 3420,
    })),
  });
  for (const job of manifest.jobs) {
    const plan = bindLifecycleJob(manifest, job);
    assert.equal(plan.rows.length, 1);
    assert.equal(plan.rows[0].source, 'candidate');
    assert.equal(plan.rows[0].timeoutMs, 600000);
    assert.equal(plan.helperTimeoutMs, 3300000);
    assert.equal(plan.rowEvidenceBytes, 16 * 1024 ** 2);
    assert.equal(plan.evidenceBytes, 128 * 1024 ** 2);
    assert.equal(
      plan.preparationRetention,
      job === 'chromium-preparation-hidden' ? LIFECYCLE_PREPARATION_RETENTION : undefined,
    );
    for (const mutate of [
      (p) => p.protocol.observationTimeoutMs++,
      (p) => p.protocol.replayTimeoutMs++,
      (p) => p.protocol.hiddenMs--,
      (p) => p.protocol.resumedFrameCapacity++,
      (p) => (p.protocol.noDefaults = false),
      (p) => p.rows[0].timeoutMs++,
      (p) => p.helperTimeoutMs++,
      (p) => (p.rows[0].engine = 'webkit'),
      (p) => (p.rows[0].source = 'baseline'),
      (p) => (p.release.priorProofInspected = false),
      (p) => (p.release.noUnclosedOwners = false),
      (p) => (p.release.onceOnlyBefore = '0'.repeat(40)),
      (p) => (p.runRetentionPolicy = undefined),
      (p) =>
        (p.frozenTools = p.frozenTools.filter(
          (r) => r.path !== 'scripts/solo-qualification-readiness.mjs',
        )),
      (p) =>
        (p.frozenTools = p.frozenTools.filter(
          (r) => r.path !== 'scripts/solo-qualification-replay-identity.mjs',
        )),
    ]) {
      const changed = structuredClone(plan);
      mutate(changed);
      assert.throws(() => validateLifecyclePlan(changed));
    }
  }
  for (const jobs of [
    ['chromium-background'],
    ['chromium-preparation-hidden'],
    [...manifest.jobs].reverse(),
    [...manifest.jobs, 'chromium-other'],
  ])
    assert.throws(() => bindLifecycleJob({ ...manifest, jobs }, jobs[0]));
});

test('exact two-case workflow preserves scheduling, full source admission and current sparse closure', async () => {
  const path = '.github/workflows/solo-remote-native-lifecycle-e1cc-temporary.yml';
  const workflow = await readFile(join(root, path), 'utf8');
  assertReleaseGuard(workflow);
  assert.match(workflow, /job: \[chromium-background, chromium-preparation-hidden\]/);
  assert.match(workflow, /timeout-minutes: 100/);
  assert.match(workflow, /max-parallel: 1/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert(!workflow.includes('workflow_dispatch') && !workflow.includes('continue-on-error'));
  assert(
    workflow.indexOf('x11-utils') < workflow.indexOf('scripts/run-solo-remote-correctness.mjs "'),
  );
  const checkouts = workflow
    .split(/\n      - /)
    .filter((step) => step.includes('uses: actions/checkout@'));
  assert.equal(checkouts.length, 3);
  for (const step of checkouts) {
    assert(step.includes('fetch-depth: 1'));
    if (step.includes('path: tools')) {
      assert(step.includes('timeout-minutes: 2'));
      assert(step.includes('sparse-checkout-cone-mode: false'));
      assert(!step.includes('filter:'));
    } else {
      assert(step.includes('timeout-minutes: 3'));
      assert(!step.includes('sparse-checkout:'));
      assert(
        step.includes(
          'ref: ' +
            (step.includes('path: baseline')
              ? held.baseline.revision
              : LIFECYCLE_E1CC_SOURCE.revision),
        ),
      );
    }
  }
  const match = workflow.match(/          sparse-checkout: \|\n((?:            .+\n)+)/);
  assert(match);
  const paths = match[1]
    .trim()
    .split('\n')
    .map((x) => x.trim().slice(1));
  assert.equal(paths.length, new Set(paths).size);
  const execution = executedBindings(
    executionWitnessBytes,
    await readFile(join(root, 'docs/performance/solo-native-lifecycle-e1cc-plan.json')),
    Buffer.from(workflow),
  );
  for (const ref of [...held.frozenTools, ...held.adapterInputs, held.fixture]) {
    const entry = execution.records.find((r) => r.path === ref.path);
    assert(entry, ref.path);
    assert.equal(entry.bytes, ref.bytes, ref.path);
    assert.equal(entry.sha256, ref.sha256, ref.path);
    assert(paths.includes(ref.path), ref.path);
  }
  for (const file of paths) assert((await readFile(join(root, file))).length > 0, file);
  for (const name of [
    'test-solo-lifecycle-e1cc-admission.mjs',
    'test-solo-hidden-preparation-workload.mjs',
    'test-solo-source-verifier-smoke.mjs',
  ])
    assert(workflow.includes('scripts/' + name + ' '), name);
});

const releaseConditions = [
  'github.event.pull_request.number == 1544',
  'github.event.pull_request.head.repo.full_name == github.repository',
  "github.event.action == 'synchronize'",
  "github.event.before == 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17'",
];
function assertReleaseGuard(text) {
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], releaseConditions.join(' && '));
  assert.equal((text.match(/^    if:/gm) ?? []).length, 1);
}
test('each exact release condition remains mandatory without alternate dispatch', async () => {
  const text = await readFile(
    join(root, '.github/workflows/solo-remote-native-lifecycle-e1cc-temporary.yml'),
    'utf8',
  );
  assertReleaseGuard(text);
  for (const condition of releaseConditions) {
    const wrong = text.replace(
      releaseConditions.join(' && '),
      releaseConditions.filter((x) => x !== condition).join(' && '),
    );
    assert.throws(() => assertReleaseGuard(wrong));
  }
  assert.throws(() => assertReleaseGuard(text.replace(releaseConditions.join(' && '), 'true')));
});

test('immutable7c7 witness rejects altered source, declaration and workflow identities', async () => {
  const declaration = await readFile(
    join(root, 'docs/performance/solo-native-lifecycle-e1cc-plan.json'),
  );
  const workflow = await readFile(
    join(root, '.github/workflows/solo-remote-native-lifecycle-e1cc-temporary.yml'),
  );
  executedBindings(executionWitnessBytes, declaration, workflow);
  for (const slot of [0, 1, 2]) {
    const inputs = [executionWitnessBytes, declaration, workflow].map((bytes) =>
      Buffer.from(bytes),
    );
    inputs[slot][0] ^= 1;
    assert.throws(() => executedBindings(...inputs));
  }
});
