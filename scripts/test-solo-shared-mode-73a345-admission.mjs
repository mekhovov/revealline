import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import {
  bindAuxiliaryJob,
  auxiliaryMatrix,
  auxiliaryArguments,
  auxiliaryAssessment,
  prepareAuxiliaryMode,
  SHARED_RETURN_RUNTIME73_CANDIDATE,
} from './solo-remote-auxiliary.mjs';
import {
  qualificationSharedModeOptions,
  executeSharedModePublicReturn,
  readSharedModePublicState,
  assessSharedModePublicReturn,
} from './solo-qualification-shared-mode.mjs';
const read = (path) => readFile(new URL('../' + path, import.meta.url));
const manifest = JSON.parse(
  await read('docs/performance/solo-shared-mode-public-return-73a345-plan.json'),
);
// Exact retained source73 first-eight correctness receipt; numerical failures remain separate.
const verifiedFirstEight = {
  format: 'SoloFirstEightCorrectnessEvidenceV1',
  sourceRevision: '73a345cec696d7789198cf295ca5c37b17ca0e71',
  runId: 39105055762,
  artifactId: 12127359946,
  artifactSHA256: '17665afe978ae63cfaf8d24b1a9626e1d7f607b7ee2611fc637c9e680f3d46d8',
  summarySHA256: 'a33416a355620817896366d5312fbecb44f0c7e6b8f7220941c8447886d99762',
  correctness: 'passed',
  ownersClosed: true,
};
const reviewed = () => ({
  ...structuredClone(manifest),
  status: 'reviewed-diagnostic-only',
  release: {
    ...structuredClone(manifest.release),
    firstEightAllCorrectnessPassed: true,
    firstEightEvidence: structuredClone(verifiedFirstEight),
  },
});
const bytes = await read(manifest.recipes.recovery.path),
  recipe = JSON.parse(bytes);
const closed = {
  status: 'closed',
  exitCode: 0,
  forcedCleanup: false,
  cleanupUnconfirmed: false,
  survivors: [],
  ambiguous: [],
};
const priorTest = await readFile(
  new URL('./test-solo-shared-mode-public-return.mjs', import.meta.url),
  'utf8',
);
const ast = parse(priorTest, { ecmaVersion: 'latest', sourceType: 'module' });
const control = ast.body.find(
  (n) => n.type === 'VariableDeclaration' && n.declarations[0].id.name === 'control',
);
const modelNode = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === 'model');
assert(control && modelNode);
const model = new Function(
  'assert',
  'readSharedModePublicState',
  `${priorTest.slice(control.start, control.end)}\nreturn (${priorTest.slice(modelNode.start, modelNode.end)});`,
)(assert, readSharedModePublicState);
async function observed(plan) {
  const m = model(),
    record = {};
  await executeSharedModePublicReturn({
    page: m.page,
    now: m.now,
    deadline: 120000,
    record,
  });
  assert.equal(m.keyHeld.size, 0);
  return {
    scenarioStatus: 'pass',
    scenarioSHA256: plan.recipes.recovery.sha256,
    sourceRevision: plan.candidate.revision,
    buildIdentity: { sourceRevision: plan.candidate.revision },
    environment: {
      engine: plan.rows[0].engine,
      browserVersion: '123.4',
      cpuThrottle: 1,
      contextMode: plan.rows[0].engine === 'webkit' ? 'persistent' : 'ephemeral',
    },
    replay: {
      scope: 'completed-scenario',
      nativeVerification: {
        status: 'pass',
        engine: plan.rows[0].engine,
        browserVersion: '123.4',
      },
    },
    pageErrors: [],
    performanceGateStatus: 'excluded-public-shared-mode-recovery',
    sharedModeObservation: record,
    sharedModeAssessment: assessSharedModePublicReturn(record),
  };
}
test('reviewed shared-return binds actual correctness proof; held and missing-proof rows reject with original bounds', () => {
  assert.deepEqual(manifest.release.firstEightEvidence, verifiedFirstEight);
  assert.deepEqual(manifest.release.firstEightNumericalFailures, [
    'baseline-first30-chromium',
    'baseline-first30-webkit',
    'candidate-first30-webkit',
  ]);
  auxiliaryMatrix(manifest);
  assert.throws(() =>
    auxiliaryMatrix({
      ...structuredClone(manifest),
      status: 'held-awaiting-source-and-dispatch-review',
    }),
  );
  assert.throws(() =>
    auxiliaryMatrix({
      ...structuredClone(manifest),
      release: { ...structuredClone(manifest.release), firstEightEvidence: null },
    }),
  );
  const selected = reviewed();
  assert.deepEqual(auxiliaryMatrix(selected).include, [
    {
      job: 'recovery-chromium',
      observation: 'recovery-chromium',
      repetition: 1,
      jobMinutes: 105,
      stepMinutes: 63,
      outerSeconds: 3720,
    },
    {
      job: 'recovery-webkit',
      observation: 'recovery-webkit',
      repetition: 1,
      jobMinutes: 105,
      stepMinutes: 63,
      outerSeconds: 3720,
    },
  ]);
  assert.equal(recipe.timeoutMs, 180000);
  assert.equal(recipe.actions[0].timeoutMs, 120000);
  for (const job of selected.release.selectedJobs) {
    const plan = bindAuxiliaryJob(selected, job);
    assert.equal(plan.rows.length, 1);
    assert.equal(plan.rows[0].source, 'candidate');
    assert.equal(plan.rows[0].timeoutMs, 420000);
    assert.equal(plan.helperTimeoutMs, 3600000);
    assert.equal(plan.setupTimeoutMs, 2400000);
    assert.deepEqual(plan.uploads, []);
    assert.equal(plan.musicBundle, undefined);
    assert.equal(plan.evidenceBytes, 256 * 1024 ** 2);
    assert.equal(plan.rowEvidenceBytes, 32 * 1024 ** 2);
  }
});
test('fixed package, source, recipe, scope and unchanged budgets cannot be substituted', () => {
  assert.equal(
    SHARED_RETURN_RUNTIME73_CANDIDATE.revision,
    '73a345cec696d7789198cf295ca5c37b17ca0e71',
  );
  for (const mutate of [
    (p) => p.candidate.run++,
    (p) => p.candidate.artifact++,
    (p) => p.candidate.outer.bytes++,
    (p) => (p.candidate.inner.sha256 = '0'.repeat(64)),
    (p) => (p.candidate.tree = '0'.repeat(40)),
    (p) => (p.candidate.manifestSHA256 = '0'.repeat(64)),
    (p) => (p.release.firstEightEvidence = null),
    (p) =>
      (p.release.firstEightEvidence.sourceRevision = 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4'),
    (p) => (p.release.firstEightEvidence.correctness = 'failed'),
    (p) => (p.release.firstEightEvidence.ownersClosed = false),
    (p) => (p.release.firstEightEvidence.artifactId = 0),
    (p) => (p.release.firstEightEvidence.artifactSHA256 = 'invalid'),
    (p) => (p.release.firstEightSourceRevision = 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4'),
    (p) => (p.release.sourceCohort = 'other'),
    (p) => (p.runtimeRevision = '0'.repeat(40)),
    (p) => (p.recipes.recovery.sha256 = '0'.repeat(64)),
    (p) => (p.recipes.recovery.path = 'docs/other.json'),
    (p) => (p.release.protocol = 'other'),
    (p) => (p.release.dispatch.lane = 'next'),
    (p) => p.release.automaticRetries++,
    (p) => (p.release.physicalQualification = 'passed'),
    (p) => p.release.selectedJobs.push('music-webkit'),
    (p) => (p.release.firstEightAllCorrectnessPassed = false),
    (p) => (p.cpu = 4),
    (p) => p.setupTimeoutMs++,
    (p) => p.rowEvidenceBytes++,
    (p) => p.maxParallel++,
    (p) => p.uploads.push({ name: 'unused' }),
    (p) => (p.release.repetitions = [1, 2, 3]),
  ]) {
    const p = reviewed();
    mutate(p);
    assert.throws(() => bindAuxiliaryJob(p, 'recovery-chromium'));
  }
  assert.throws(() => bindAuxiliaryJob(reviewed(), 'music-webkit'));
  assert.throws(() => bindAuxiliaryJob(reviewed(), 'recovery-webkit', 2));
});
test('actual adapter arguments reach exact observer admission without unsupported work-probe or audio mode', () => {
  for (const job of reviewed().release.selectedJobs) {
    const plan = bindAuxiliaryJob(reviewed(), job),
      row = plan.rows[0];
    const args = auxiliaryArguments(
      {
        plan,
        here: '/tools/scripts',
        modeState: { recipePath: '/input/scenario.json' },
      },
      row,
      'http://127.0.0.1:1/game/',
      '/evidence',
    );
    assert(!args.includes('--work-probe'));
    assert(!args.includes('--audio-proof'));
    assert(!args.includes('--baseline-runtime'));
    assert.equal(
      qualificationSharedModeOptions(args.slice(4), recipe, bytes).sourceRevision,
      plan.candidate.revision,
    );
    assert.equal(args.includes('--context=persistent'), row.engine === 'webkit');
    assert.throws(() =>
      qualificationSharedModeOptions([...args.slice(4), '--work-probe'], recipe, bytes),
    );
  }
});
test('independent adapter readback requires real public-route evidence AND strict final Solo replay', async () => {
  for (const job of reviewed().release.selectedJobs) {
    const p = bindAuxiliaryJob(reviewed(), job),
      row = p.rows[0],
      raw = await observed(p);
    const value = await auxiliaryAssessment(p, row, raw, closed, '123.4');
    assert.equal(value.status, 'passed');
    assert.equal(value.sharedMode.documentCount, 5);
    assert.equal(value.sharedMode.intermediateReplay, 'unobserved');
    assert.equal(value.physicalQualification, 'unobserved');
    for (const mutate of [
      (r) =>
        (r.sharedModeObservation.rows[0].samples[2].state.clock =
          r.sharedModeObservation.rows[0].samples[1].state.clock),
      (r) => r.sharedModeObservation.rows[1].inputs.pop(),
      (r) => (r.sharedModeObservation.rows[0].samples[6].state.otherModePresent = true),
      (r) => (r.sharedModeAssessment.documentCount = 99),
      (r) => delete r.sharedModeObservation,
      (r) => (r.replay.nativeVerification.status = 'fail'),
      (r) => (r.replay.nativeVerification.engine = 'other'),
      (r) => (r.replay.scope = 'partial'),
      (r) => (r.sourceRevision = '0'.repeat(40)),
      (r) => (r.scenarioSHA256 = '0'.repeat(64)),
      (r) => (r.performanceGateStatus = 'excluded-synthetic-recovery'),
      (r) => r.pageErrors.push('original error'),
      (r) => (r.failure = 'retained failure'),
      (r) => (r.contextCleanupFailure = 'not closed'),
    ]) {
      const q = structuredClone(raw);
      mutate(q);
      assert.equal((await auxiliaryAssessment(p, row, q, closed, '123.4')).status, 'failed');
    }
    for (const mutation of [
      { exitCode: 2 },
      { forcedCleanup: true },
      { cleanupUnconfirmed: true },
      { survivors: [{ pid: 1 }] },
      { ambiguous: [{ pid: 1 }] },
    ])
      assert.equal(
        (await auxiliaryAssessment(p, row, raw, { ...closed, ...mutation }, '123.4')).status,
        'failed',
      );
  }
});
test('changed current fixture bytes reject before any admitted package or native side effect', async () => {
  let admitted = 0,
    effects = 0,
    digests = 0;
  const plan = bindAuxiliaryJob(reviewed(), 'recovery-chromium');
  await assert.rejects(
    () =>
      prepareAuxiliaryMode({
        plan,
        repository: new URL('../', import.meta.url).pathname.replace(/\/$/, ''),
        get admitted() {
          admitted++;
          throw Error('must not read');
        },
        digest: async (path) => {
          digests++;
          const b = await readFile(path);
          return { bytes: b.length, sha256: '0'.repeat(64) };
        },
        required: async () => {
          effects++;
        },
      }),
    { name: 'AssertionError' },
  );
  assert.equal(digests, 1);
  assert.equal(admitted, 0);
  assert.equal(effects, 0);
});
test('new held fixture remains exact with unchanged actions and final immutable replay definition', () => {
  assert.equal(bytes.length, 2685);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    '805b2793d4613aa67fd8e6f373c9268dd919b6cf857222bdf143cbe8fcd6311d',
  );
  assert.deepEqual(recipe.query, { journey: 'legacy' });
  assert.equal(recipe.actions.at(-1).type, 'exportReplay');
  assert.equal(recipe.replayRequirements.movingTicks, 120);
  assert.equal(recipe.expectedReplayDefinition.level.id, 'signal-01');
});

test('source73 observer selection preserves the old exact source and rejects missing, repeated or arbitrary source', () => {
  const p = bindAuxiliaryJob(reviewed(), 'recovery-chromium');
  const args = auxiliaryArguments(
    { plan: p, here: '/tools/scripts', modeState: { recipePath: '/input/scenario.json' } },
    p.rows[0],
    'http://127.0.0.1:1/game/',
    '/evidence',
  ).slice(4);
  const source = '73a345cec696d7789198cf295ca5c37b17ca0e71';
  const old = 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4';
  assert.equal(
    qualificationSharedModeOptions(
      args.map((x) => x.replace(source, old)),
      recipe,
      bytes,
    ).sourceRevision,
    old,
  );
  for (const changed of [
    args.filter((x) => !x.startsWith('--source-revision')),
    args.concat('--source-revision=' + source),
    args.map((x) => x.replace(source, '0'.repeat(40))),
    args.map((x) => x.replace('--source-revision=', '--source-revision-other=')),
  ])
    assert.throws(() => qualificationSharedModeOptions(changed, recipe, bytes));
});
