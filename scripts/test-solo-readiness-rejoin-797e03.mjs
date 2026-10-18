import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import test from 'node:test';
import {
  bindReadinessJob,
  readinessMatrix,
  readinessRowPlan,
  readinessArguments,
  prepareReadinessMode,
  PREPARATION_READINESS_PHASES,
} from './solo-remote-readiness.mjs';
import {
  READINESS_REJOIN_WITNESS,
  changedReadinessTools,
  declaredReadinessToolRefs,
  assertDeclaredReadinessTool,
  modelCurrentReadinessTools,
} from './solo-readiness-rejoin-declared-source.mjs';

const read = (path) => readFile(new URL('../' + path, import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const priorPath = 'docs/performance/solo-readiness-preparation-797e03-plan.json';
const planPath = 'docs/performance/solo-readiness-preparation-rejoin-797e03-plan.json';
const workflowPath = '.github/workflows/solo-native-package-consumer.yml';
const plan = JSON.parse(await read(planPath));
const prior = JSON.parse(await read(priorPath));
const policy = 'retained-reference-rejoin-v1';
const reviewedModel = () => ({
  ...structuredClone(plan),
  status: 'reviewed-readiness-diagnostic-only',
});
const refs = (value) => [
  ...value.adapterInputs,
  ...value.frozenTools,
  value.fixture,
  ...value.additionalFixtures,
];
const workflow = (await read(workflowPath)).toString();
const body = (text, name) => {
  const value = text.split('\n  ' + name + ':\n')[1];
  assert(value, name);
  return value.split(/\n  [A-Za-z_][A-Za-z0-9_-]*:\n/)[0];
};

test('immutable declared-source witness binds exact historical bytes and never grants production admission', async () => {
  const bytes = await read(READINESS_REJOIN_WITNESS);
  const witness = JSON.parse(bytes);
  assert.equal(witness.records.length, 39);
  assert.equal(witness.declarations.length, 33);
  for (const path of new Set(witness.declarations.map((row) => row.path))) {
    const saved = await read(path);
    const value = JSON.parse(saved);
    const historical = declaredReadinessToolRefs(bytes, path, saved);
    for (const ref of [
      ...(value.adapterInputs ?? []),
      ...(value.frozenTools ?? []),
      ...(value.runtimeRefs ?? []),
    ]) {
      if (!historical.has(ref.path)) continue;
      assert.deepEqual(ref, historical.get(ref.path));
      assert.equal(await assertDeclaredReadinessTool(path, ref), true);
      await assert.rejects(() =>
        assertDeclaredReadinessTool(path, { ...ref, bytes: ref.bytes + 1 }),
      );
      await assert.rejects(() =>
        assertDeclaredReadinessTool(path, { ...ref, sha256: '0'.repeat(64) }),
      );
    }
    for (const [w, p, savedBytes] of [
      [Buffer.concat([bytes, Buffer.from(' ')]), path, saved],
      [bytes, planPath, saved],
      [bytes, path, Buffer.concat([saved, Buffer.from(' ')])],
      [Buffer.from(JSON.stringify({ ...witness, records: witness.records.slice(1) })), path, saved],
      [Buffer.from(JSON.stringify({ ...witness, revision: '0'.repeat(40) })), path, saved],
    ])
      assert.throws(() => declaredReadinessToolRefs(w, p, savedBytes));
  }
  for (const path of changedReadinessTools)
    assert(!(await read(path)).toString().includes('solo-readiness-rejoin-declared-source'));
});

test('successor is held and preserves exact package, first-eight proof, six rows and original failed V2 observation', async () => {
  assert.equal(plan.status, 'held-awaiting-source-and-dispatch-review');
  assert.throws(() => readinessMatrix(plan));
  assert.equal(plan.requiredClickIdentityObservation, policy);
  assert.equal(prior.requiredClickIdentityObservation, undefined);
  for (const key of [
    'candidate',
    'baseline',
    'runtimeRevision',
    'fixture',
    'additionalFixtures',
    'protocol',
    'release',
    'engines',
    'cpu',
    'maxParallel',
    'automaticRetries',
    'performanceExclusion',
    'hitchJournal',
    'setupTimeoutMs',
    'helperTimeoutMs',
    'rowEvidenceBytes',
    'evidenceBytes',
  ])
    assert.deepEqual(plan[key], prior[key], key);
  const failed = plan.toolingSuccessor.originalFailedObservation;
  assert.equal(failed.runId, 39119124191);
  assert.equal(failed.jobId, 117650918988);
  assert.equal(failed.artifactId, 12133667373);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.requiredOriginalExitCode, 1);
  assert.equal(
    failed.artifactSHA256,
    'dfeb65287e8a771919e7d0fef70872a71d0908f8ed3325315661c2894063a6f8',
  );
  assert.equal(plan.prospectiveOutcome.status, 'unobserved');
  const witness = await read(READINESS_REJOIN_WITNESS);
  assert.deepEqual(plan.toolingSuccessor.sourceWitness, {
    path: READINESS_REJOIN_WITNESS,
    bytes: witness.length,
    sha256: hash(witness),
  });
  for (const engine of plan.engines) {
    const selected = bindReadinessJob(reviewedModel(), engine);
    const old = bindReadinessJob(prior, engine);
    assert.deepEqual(selected.rows, old.rows);
    assert.deepEqual(
      selected.rows.map((row) => row.phase),
      PREPARATION_READINESS_PHASES,
    );
    for (const row of selected.rows) {
      const args = readinessArguments(
        { plan: selected, here: '/tools/scripts', repository: '/tools' },
        row,
        'http://127.0.0.1:1/game/',
        '/evidence',
      );
      const oldArgs = readinessArguments(
        { plan: old, here: '/tools/scripts', repository: '/tools' },
        row,
        'http://127.0.0.1:1/game/',
        '/evidence',
      );
      assert.deepEqual(
        args.filter((arg) => !arg.startsWith('--readiness-required-rejoin=')),
        oldArgs,
      );
      assert.equal(
        args.includes('--readiness-required-rejoin=' + policy),
        row.phase === 'required-original-cancel',
      );
      assert.deepEqual(readinessRowPlan(selected, row).fixture, readinessRowPlan(old, row).fixture);
    }
  }
});

test('current successor refs and actual command remain source-confined while every old declaration remains frozen', async () => {
  const selected = body(workflow, 'readiness');
  const sparse = new Set([...selected.matchAll(/^            \/(.+)$/gm)].map((m) => m[1]));
  for (const ref of refs(plan)) {
    const bytes = await read(ref.path);
    assert.deepEqual({ path: ref.path, bytes: bytes.length, sha256: hash(bytes) }, ref);
    assert(sparse.has(ref.path), ref.path);
  }
  const check = (text) => {
    const lane = body(text, 'readiness');
    assert.match(
      lane,
      /^    if: github.repository == 'mekhovov\/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs\/heads\/main' && inputs.lane == 'readiness'$/m,
    );
    assert(
      lane.includes(
        'node scripts/solo-remote-readiness.mjs bind-plan ' +
          planPath +
          ' "$RUNNER_TEMP/readiness-plan.json"',
      ),
    );
    const command = lane.match(/^\s*node (--test [^\n]+) 2>&1 \|/m)?.[1].split(/\s+/);
    assert.deepEqual(command.slice(0, 2), ['--test', '--test-concurrency=2']);
    assert(command.includes('scripts/test-solo-readiness-rejoin-797e03.mjs'));
    assert(command.includes('scripts/test-solo-required-media-transport.mjs'));
    assert.match(lane, /^    timeout-minutes: 130$/m);
    assert.match(lane, /4620s node scripts\/run-solo-remote-correctness.mjs/);
  };
  check(workflow);
  assert.throws(() =>
    check(
      workflow.replace(
        'node scripts/solo-remote-readiness.mjs bind-plan ' + planPath,
        'node scripts/solo-remote-readiness.mjs bind-plan ' + priorPath,
      ),
    ),
  );
  const witness = JSON.parse(await read(READINESS_REJOIN_WITNESS));
  const requiredReads = new Set([
    planPath,
    priorPath,
    READINESS_REJOIN_WITNESS,
    'scripts/solo-readiness-rejoin-declared-source.mjs',
    'scripts/test-solo-readiness-rejoin-797e03.mjs',
    'scripts/test-solo-required-media-transport.mjs',
    ...witness.declarations.map((declaration) => declaration.path),
  ]);
  const checkReads = (text) => {
    const retained = new Set(
      [...body(text, 'readiness').matchAll(/^            \/(.+)$/gm)].map((m) => m[1]),
    );
    for (const path of requiredReads)
      assert(retained.has(path), 'Missing immutable declaration read: ' + path);
  };
  checkReads(workflow);
  for (const path of requiredReads) {
    const entry = '            /' + path + '\n';
    assert.equal(selected.split(entry).length, 2, path);
    assert.throws(
      () => checkReads(workflow.replace(selected, selected.replace(entry, ''))),
      /Missing immutable declaration read/,
    );
  }
});

test('production preparation rejects the original stale declaration before package admission or effects', async () => {
  const repository = await realpath(new URL('../', import.meta.url));
  for (const path of [priorPath, 'docs/performance/solo-readiness-preparation-73a345-plan.json']) {
    const saved = JSON.parse(await read(path));
    const bound = bindReadinessJob(saved, 'chromium');
    let admitted = 0,
      effects = 0,
      checked = 0;
    await assert.rejects(
      () =>
        prepareReadinessMode({
          plan: bound,
          repository,
          report: {},
          get admitted() {
            admitted++;
            throw Error('package admission must remain unread');
          },
          digest: async (file) => {
            checked++;
            const bytes = await readFile(file);
            return { bytes: bytes.length, sha256: hash(bytes) };
          },
          required: async () => {
            effects++;
          },
        }),
      { name: 'AssertionError' },
    );
    assert(checked > 0);
    assert.equal(admitted, 0);
    assert.equal(effects, 0);
    const modeled = await modelCurrentReadinessTools(path, saved);
    assert.deepEqual(JSON.parse(await read(path)), saved);
    for (const key of ['adapterInputs', 'frozenTools']) {
      for (let i = 0; i < saved[key].length; i++) {
        const before = saved[key][i],
          after = modeled[key][i];
        if (!changedReadinessTools.includes(before.path)) assert.deepEqual(after, before);
        else {
          const bytes = await read(before.path);
          assert.deepEqual(after, { path: before.path, bytes: bytes.length, sha256: hash(bytes) });
          assert.notDeepEqual(after, before);
        }
      }
    }
  }
});
