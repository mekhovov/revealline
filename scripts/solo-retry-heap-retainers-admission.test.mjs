import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  bindSustainedJob,
  sustainedMatrix,
  sustainedArguments,
  prepareSustainedMode,
} from './solo-remote-sustained.mjs';
import './solo-qualification-heap-retainers.test.mjs';

const read = (path) => readFile(new URL('../' + path, import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const planPath = 'docs/performance/solo-797-retry-heap-retainers-plan.json';
const manifest = JSON.parse(await read(planPath));
const prior = JSON.parse(await read('docs/performance/solo-797-lifecycle-retry-plan.json'));
const bind = (plan = manifest) => bindSustainedJob(plan, 'chromium', 1);
const workflow = (await read('.github/workflows/solo-native-package-consumer.yml')).toString();
const body = workflow.split('\n  lifecycle:\n')[1].split(/\n  [a-z][a-z-]+:\n/)[0];

test('heap successor is exactly one candidate Chromium row with original source, fixture and deadlines', () => {
  const plan = bind();
  assert.equal(plan.cohort, '797-retry-heap-retainers-v1');
  assert.deepEqual(
    plan.rows.map((row) => [row.engine, row.source]),
    [['chromium', 'candidate']],
  );
  assert.equal(sustainedMatrix(manifest).include.length, 1);
  assert.equal(sustainedMatrix(prior).include.length, 6);
  for (const key of [
    'candidate',
    'baseline',
    'recipes',
    'node',
    'playwright',
    'setupTimeoutMs',
    'calibrationTimeoutMs',
    'calibrationPreset',
    'evidenceBytes',
    'rowEvidenceBytes',
  ])
    assert.deepEqual(manifest[key], prior[key], key);
  assert.equal(plan.rows[0].timeoutMs, 1140000);
  assert.equal(plan.helperTimeoutMs, 5700000);
  assert.equal(plan.performanceExclusion, true);
  assert.equal(manifest.heapRetainers.perSnapshotBytes, 33554432);
  assert.equal(manifest.heapRetainers.totalHeapBytes, 67108864);
  assert.deepEqual(manifest.heapRetainers.captureOrdinals, [1, 20]);
  assert.equal(manifest.release.automaticRetries, 0);
  assert.equal(manifest.release.automaticPhaseContinuation, false);
});

test('heap scope mutations and extra native rows fail admission', () => {
  for (const mutate of [
    (p) => p.jobs.push({ engine: 'chromium', repetition: 2 }),
    (p) => p.jobs.push({ engine: 'webkit', repetition: 1 }),
    (p) => p.heapRetainers.perSnapshotBytes++,
    (p) => p.heapRetainers.totalHeapBytes++,
    (p) => p.heapRetainers.perPauseDeadlineMs++,
    (p) => p.heapRetainers.scenarioTimeoutMs++,
    (p) => p.heapRetainers.captureOrdinals.push(10),
    (p) => (p.heapRetainers.sourceEvidence.reportSHA256 = '0'.repeat(64)),
    (p) => (p.release.heapRetainers.protocol = 'other'),
    (p) => (p.candidateOnly = false),
    (p) => (p.cohort = prior.cohort),
    (p) => (p.release.dispatch.phase = 'retry'),
    (p) =>
      (p.frozenTools = p.frozenTools.filter(
        (r) => !r.path.endsWith('/solo-qualification-heap-retainers.mjs'),
      )),
  ]) {
    const bad = structuredClone(manifest);
    mutate(bad);
    assert.throws(() => bind(bad));
  }
  assert.throws(() => bindSustainedJob(manifest, 'webkit', 1));
  assert.throws(() => bindSustainedJob(manifest, 'chromium', 2));
});

test('actual Retry driver forwards only the explicit heap opt-in and keeps memory timing exclusion', () => {
  const plan = bind(),
    row = plan.rows[0];
  const args = sustainedArguments(
    {
      plan,
      here: '/tools',
      modeState: { cpu: 2.5, recipePath: '/fixture/recipe.json' },
    },
    row,
    'http://127.0.0.1:12345/game/',
    '/evidence',
  );
  assert.equal(args.filter((a) => a === '--memory-profile').length, 1);
  assert.equal(args.filter((a) => a === '--heap-retainers=retry797-first-last-v1').length, 1);
  assert(args.includes('--server-fixture-access'));
  assert(args.includes('--source-revision=797e03f28743921842df6aa57520a72016ba3dfc'));
  assert(args.includes('--hitch-journal-preparation=first-return-retry-anchored-v1'));
  assert(!args.includes('--baseline-runtime'));
  assert(!args.some((a) => a.startsWith('--cpu-profile') || a.startsWith('--frame-trace')));
});

test('every new declaration input has exact current bytes and stale input fails before native effects', async () => {
  for (const ref of [
    ...manifest.adapterInputs,
    ...manifest.frozenTools,
    ...Object.values(manifest.recipes),
  ]) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(hash(bytes), ref.sha256, ref.path);
  }
  const plan = bind(),
    effects = [];
  plan.adapterInputs[0].sha256 = '0'.repeat(64);
  await assert.rejects(
    () =>
      prepareSustainedMode({
        plan,
        repository: process.cwd(),
        digest: async (path) => {
          const bytes = await readFile(path);
          return { bytes: bytes.length, sha256: hash(bytes) };
        },
        ensureBaseline: async () => effects.push('baseline'),
        required: async () => effects.push('native'),
      }),
    /Changed input/,
  );
  assert.deepEqual(effects, []);
});

test('existing manual lifecycle lane admits a single heap row and executes every source control first', () => {
  for (const value of [
    "inputs.lane == 'lifecycle'",
    '["retry","retry-heap-retainers","soak","long29"]',
    "inputs.phase == 'retry-heap-retainers' && '[\"chromium\"]'",
    "inputs.phase == 'retry-heap-retainers' && '[1]'",
    'retry-heap-retainers) PLAN=' + planPath,
    'node --test --test-concurrency=2 scripts/solo-retry-heap-retainers-admission.test.mjs ',
    '5820 || 8820',
    '142 || 192',
    '98 || 148',
    'timeout --signal=TERM --kill-after=30s',
  ])
    assert(body.includes(value), value);
  for (const path of [
    planPath,
    'scripts/solo-qualification-heap-retainers.mjs',
    'scripts/solo-qualification-heap-retainers.test.mjs',
    'scripts/solo-retry-heap-retainers-admission.test.mjs',
  ])
    assert(body.includes('            /' + path), path);
  assert(!body.includes('continue-on-error'));
  assert(body.includes('max-parallel: 1'));
});
