import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { qualificationCadenceOption } from './solo-qualification-cadence.mjs';
import {
  bindAuxiliaryJob,
  auxiliaryMatrix,
  auxiliaryArguments,
  auxiliaryAssessment,
  prepareAuxiliaryMode,
  SHARED_RETURN_RUNTIME797_CANDIDATE,
} from './solo-remote-auxiliary.mjs';
import {
  qualificationSharedModeOptions,
  executeSharedModePublicReturn,
  readSharedModePublicState,
  assessSharedModePublicReturn,
} from './solo-qualification-shared-mode.mjs';
const read = (path) => readFile(new URL('../' + path, import.meta.url));
const manifest = JSON.parse(
  await read('docs/performance/solo-shared-mode-public-return-797e03-tooling-plan.json'),
);
// Scoped correctness only; raw numerical and portability failures remain retained.
const firstEightOutcome = JSON.parse(
  await read('docs/performance/fixtures/solo-797e03-consumer/first-eight-39109911286.json'),
);
const verifiedFirstEight = firstEightOutcome.proof;
const reviewed = () => structuredClone(manifest);
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

// Execute the actual CLI cadence declaration and guard, without importing its browser driver.
const qualifierSource = (await read('scripts/qualify-solo-runtime.mjs')).toString();
const qualifierAST = parse(qualifierSource, { ecmaVersion: 'latest', sourceType: 'module' });
const cadenceDeclaration = qualifierAST.body.find(
  (node) =>
    node.type === 'VariableDeclaration' &&
    node.declarations.some((value) => value.id.name === 'workProbe'),
);
const cadenceGuard = qualifierAST.body.find(
  (node) =>
    node.type === 'ExpressionStatement' &&
    node.expression.type === 'CallExpression' &&
    node.expression.callee.name === 'assert' &&
    node.expression.arguments[1]?.value === 'Settled cadence requires the work probe',
);
assert(cadenceDeclaration && cadenceGuard);
const cliCadence = new Function(
  'assert',
  'qualificationCadenceOption',
  'flags',
  qualifierSource.slice(cadenceDeclaration.start, cadenceDeclaration.end) +
    '\n' +
    qualifierSource.slice(cadenceGuard.start, cadenceGuard.end) +
    '\nreturn { workProbe, cadenceProtocol };',
).bind(null, assert, qualificationCadenceOption);

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
test('797 shared-return binds actual correctness prerequisite; held and missing-proof rows reject with original bounds', () => {
  assert.deepEqual(manifest.release.firstEightEvidence, verifiedFirstEight);
  assert.equal(
    manifest.release.firstEightNumericalFailuresRetained,
    firstEightOutcome.rawNumericalFailuresRetained,
  );
  assert.equal(
    manifest.release.nodePortabilityMismatchesRetained,
    firstEightOutcome.nodePortabilityMismatchesRetained,
  );
  assert.equal(manifest.status, 'reviewed-diagnostic-only');
  assert.equal(auxiliaryMatrix(manifest).include.length, 2);
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
    SHARED_RETURN_RUNTIME797_CANDIDATE.revision,
    '797e03f28743921842df6aa57520a72016ba3dfc',
  );
  for (const mutate of [
    (p) => (p.release.firstEightRequired = false),
    (p) =>
      (p.release.firstEightEvidence.sourceRevision = '73a345cec696d7789198cf295ca5c37b17ca0e71'),
    (p) => (p.release.firstEightEvidence.unreviewed = true),
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
    assert(!args.some((arg) => arg.startsWith('--cadence=')));
    assert.deepEqual(cliCadence(args.slice(4)), { workProbe: false, cadenceProtocol: 'blank30' });
    assert.throws(
      () => cliCadence([...args.slice(4), '--cadence=settled120']),
      /Settled cadence requires the work probe/,
    );
    assert.deepEqual(cliCadence(['--work-probe', '--cadence=settled120']), {
      workProbe: true,
      cadenceProtocol: 'settled120',
    });
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

test('source797 observer selection preserves the old exact source and rejects missing, repeated or arbitrary source', () => {
  const p = bindAuxiliaryJob(reviewed(), 'recovery-chromium');
  const args = auxiliaryArguments(
    { plan: p, here: '/tools/scripts', modeState: { recipePath: '/input/scenario.json' } },
    p.rows[0],
    'http://127.0.0.1:1/game/',
    '/evidence',
  ).slice(4);
  const source = '797e03f28743921842df6aa57520a72016ba3dfc';
  const old = 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4';
  const prior = '73a345cec696d7789198cf295ca5c37b17ca0e71';
  assert.equal(
    qualificationSharedModeOptions(
      args.map((x) => x.replace(source, prior)),
      recipe,
      bytes,
    ).sourceRevision,
    prior,
  );
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

test('executed shared-return declaration and failed adapter stay bound to actual historical Git bytes', async () => {
  const witnessBytes = await read(
    'docs/performance/fixtures/solo-shared-mode/9aaf-executed-source.json',
  );
  const declarationBytes = await read(
    'docs/performance/solo-shared-mode-public-return-797e03-plan.json',
  );
  const check = (value, declaration) => {
    assert.equal(value.length, 1578);
    assert.equal(
      createHash('sha256').update(value).digest('hex'),
      'a3c7882b060ea2672907539742c694fab8dece2bd56e4f58f784c7de7806d7ed',
    );
    const witness = JSON.parse(value);
    assert.equal(witness.sourceRevision, '9aaf4ea6ee9ebe23821552e59851f2e3e817a15b');
    assert.equal(witness.sourceTree, '7e64a66f9eb309b692719b163ca00fbe78146ad5');
    assert.equal(witness.postHocExactGitReadback, true);
    const records = new Map(witness.records.map((ref) => [ref.path, ref]));
    assert.equal(records.size, 2);
    const expected = records.get(
      'docs/performance/solo-shared-mode-public-return-797e03-plan.json',
    );
    assert.equal(declaration.length, expected.bytes);
    assert.equal(createHash('sha256').update(declaration).digest('hex'), expected.sha256);
    const old = JSON.parse(declaration);
    assert.deepEqual(
      old.adapterInputs,
      witness.records
        .filter((ref) => ref.path === 'scripts/solo-remote-auxiliary.mjs')
        .map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
    );
    assert.deepEqual(
      witness.evidence.map((entry) => entry.status),
      ['failed-before-browser', 'failed-before-browser'],
    );
  };
  check(witnessBytes, declarationBytes);
  assert.throws(() => check(Buffer.concat([witnessBytes, Buffer.from(' ')]), declarationBytes));
  const changed = JSON.parse(declarationBytes);
  changed.adapterInputs[0].sha256 = '0'.repeat(64);
  assert.throws(() => check(witnessBytes, Buffer.from(JSON.stringify(changed))));
  const old = JSON.parse(declarationBytes);
  const successor = structuredClone(manifest);
  delete successor.toolingSuccessor;
  successor.adapterInputs = old.adapterInputs;
  assert.deepEqual(
    successor,
    old,
    'Only the new tooling identity and explanatory prior-declaration record differ',
  );
});

test('production preparation cannot use historical adapter pins with current source', async () => {
  const old = JSON.parse(
    await read('docs/performance/solo-shared-mode-public-return-797e03-plan.json'),
  );
  const plan = bindAuxiliaryJob(old, 'recovery-chromium');
  let effects = 0;
  await assert.rejects(
    () =>
      prepareAuxiliaryMode({
        plan,
        repository: new URL('../', import.meta.url).pathname.replace(/\/$/, ''),
        digest: async (path) => {
          const value = await readFile(path);
          return { bytes: value.length, sha256: createHash('sha256').update(value).digest('hex') };
        },
        get admitted() {
          effects++;
          throw Error('historical source must reject first');
        },
        required: async () => {
          effects++;
        },
      }),
    { name: 'AssertionError' },
  );
  assert.equal(effects, 0);
});
