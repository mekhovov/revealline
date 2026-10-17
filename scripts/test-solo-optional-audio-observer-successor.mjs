import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, realpath, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  bindReadinessJob,
  readinessMatrix,
  validateReadinessPlan,
  OPTIONAL_AUDIO_OBSERVER_CORRECTION,
} from './solo-remote-readiness.mjs';
const root = new URL('../', import.meta.url),
  read = (p) => readFile(new URL(p, root)),
  hash = (b) => createHash('sha256').update(b).digest('hex');
const path = 'docs/performance/solo-optional-start-audio-e1cc-v4-plan.json',
  oldPath = 'docs/performance/solo-optional-start-audio-e1cc-v3-plan.json';
const workflowPath = '.github/workflows/solo-remote-optional-start-audio-e1cc-v4-temporary.yml';
const manifestBytes = await read(path);
const manifest = JSON.parse(manifestBytes),
  old = JSON.parse(await read(oldPath)),
  workflow = (await read(workflowPath)).toString();
const before = '34d95cb9fe471ca56c243f05c4330826ba822fb9';
const executedBytes = await read(
  'docs/performance/fixtures/solo-optional-start-audio/bab3-execution-source.json',
);
function executedV4(bytes, declaration, workflowBytes) {
  assert.equal(hash(bytes), '3e8c221d3c3eda5449bf29ede69e056b4b62175ac8effec4b65391ca44baf3a3');
  const witness = JSON.parse(bytes);
  assert.equal(witness.revision, 'bab3b2790944c6257f9c1f9b346839996bbefebb');
  assert.equal(witness.tree, '4bdfc784e14b41ed5d32895b4fa139920f494a63');
  assert.equal(witness.run, 39059454404);
  assert.equal(witness.records.length, 7);
  assert.equal(witness.postHocReadback.format, 'SoloAdditiveExecutedSourceReadbackV1');
  assert.deepEqual(witness.postHocReadback.addedPaths, [
    'scripts/solo-qualification-next-route.mjs',
  ]);
  const original = structuredClone(witness);
  delete original.postHocReadback;
  original.records = original.records.slice(0, 6);
  const originalBytes = Buffer.from(JSON.stringify(original, null, 2) + '\n');
  assert.deepEqual(witness.postHocReadback.originalWitness, {
    bytes: originalBytes.length,
    sha256: '8a1be51e842c364e616939097096971f71b6ed9629aecb38b4cf65a3f3d62162',
    recordCount: 6,
  });
  assert.equal(hash(originalBytes), witness.postHocReadback.originalWitness.sha256);
  for (const [p, input] of [
    [path, declaration],
    [workflowPath, workflowBytes],
  ]) {
    const record = witness.records.find((r) => r.path === p);
    assert.equal(input.length, record.bytes);
    assert.equal(hash(input), record.sha256);
  }
  for (const record of witness.records) assert.match(record.blob, /^[a-f0-9]{40}$/);
  return witness;
}
const executed = executedV4(executedBytes, manifestBytes, Buffer.from(workflow));
test('executed bab3 V4 rejects changed witness or historical declaration/workflow', () => {
  assert.throws(() => executedV4(Buffer.from('{}'), Buffer.from('{}'), Buffer.from(workflow)));
  assert.throws(() => executedV4(executedBytes, Buffer.from('{}'), Buffer.from(workflow)));
  assert.throws(() => executedV4(executedBytes, manifestBytes, Buffer.from(workflow + ' ')));
});

test('v4 preserves exact runtime/fixture/workload/bounds and admits only the declared observer correction', () => {
  const current = bindReadinessJob(manifest, 'chromium'),
    prior = bindReadinessJob(old, 'chromium');
  assert.deepEqual(readinessMatrix(manifest), readinessMatrix(old));
  for (const key of Object.keys(prior).filter(
    (k) =>
      !['release', 'releaseTrigger', 'priorResults', 'adapterInputs', 'frozenTools'].includes(k),
  ))
    assert.deepEqual(current[key], prior[key], key);
  assert.deepEqual(current.release.setupCorrection, prior.release.setupCorrection);
  assert.deepEqual(current.release.routeCorrection, prior.release.routeCorrection);
  assert.deepEqual(current.release.observerCorrection, OPTIONAL_AUDIO_OBSERVER_CORRECTION);
  for (const mutate of [
    (p) => delete p.release.observerCorrection,
    (p) => delete p.release.routeCorrection,
    (p) => delete p.release.setupCorrection,
    (p) => p.release.observerCorrection.priorRun++,
    (p) => (p.release.observerCorrection.priorClaimedAudioRequests = 0),
    (p) => (p.release.observerCorrection.priorConclusion = 'success'),
    (p) => (p.release.observerCorrection.runtimeChanged = true),
    (p) => (p.release.observerCorrection.scenarioChanged = true),
    (p) => (p.release.observerCorrection.gateChanged = true),
    (p) => (p.release.observerCorrection.originalDeclaration.sha256 = '0'.repeat(64)),
    (p) => (p.release.onceOnlyBefore = prior.release.onceOnlyBefore),
    (p) => p.candidate.artifact++,
    (p) => p.protocol.observationTimeoutMs++,
    (p) => p.rows.push(p.rows[0]),
  ]) {
    const p = structuredClone(current);
    mutate(p);
    assert.throws(() => validateReadinessPlan(p));
  }
  const unchanged = structuredClone(prior);
  unchanged.release.observerCorrection = current.release.observerCorrection;
  assert.throws(() => validateReadinessPlan(unchanged));
});
test('executed before34d95 guard and exact bab3 sparse/frozen inputs bind one unchanged e1cc row', async () => {
  const terms = [
    'github.event.pull_request.number == 1544',
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.action == 'synchronize'",
    `github.event.before == '${before}'`,
  ];
  const guard = (s) => assert(s.includes('    if: ' + terms.join(' && ') + '\n'));
  guard(workflow);
  for (const term of terms) assert.throws(() => guard(workflow.replace(term, 'true')));
  assert.equal(manifest.releaseTrigger.onceOnlyBefore, before);
  assert.equal(manifest.releaseTrigger.status, 'reviewed-one-shot');
  for (const term of [
    'engine: [chromium]',
    'install --with-deps chromium webkit',
    'timeout-minutes: 130',
    'timeout-minutes: 78',
    '4620s node scripts/run-solo-remote-correctness.mjs',
    'bind-plan ' + path,
    'cancel-in-progress: false',
  ])
    assert(workflow.includes(term), term);
  for (const term of ['workflow_dispatch', 'workflow_run', 'continue-on-error'])
    assert(!workflow.includes(term));
  const sparse = [...workflow.matchAll(/^            \/([^\n]+)$/gm)].map((m) => m[1]);
  assert.equal(sparse.length, new Set(sparse).size);
  for (const ref of [...manifest.adapterInputs, ...manifest.frozenTools, manifest.fixture]) {
    const historical = executed.records.find((r) => r.path === ref.path);
    if (historical) {
      assert.deepEqual(ref, {
        path: historical.path,
        bytes: historical.bytes,
        sha256: historical.sha256,
      });
    } else {
      const b = await read(ref.path);
      assert.equal(b.length, ref.bytes, ref.path);
      assert.equal(hash(b), ref.sha256, ref.path);
    }
    assert(sparse.includes(ref.path));
  }
  for (const p of [
    path,
    workflowPath,
    oldPath,
    'game/app.mjs',
    'scripts/test-solo-optional-audio-observer-correction.mjs',
    'scripts/test-solo-optional-audio-observer-successor.mjs',
    'docs/performance/fixtures/solo-optional-start-audio/34d95-execution-source.json',
  ])
    assert(sparse.includes(p), p);
  assert.equal(manifest.priorResults.observerFailure.conclusion, 'failure');
  assert.equal(manifest.priorResults.observerFailure.scenarioStatus, 'fail');
  assert.equal(manifest.priorResults.observerFailure.claimedAudioRequests, 1);
  const oldBytes = await read(oldPath);
  assert.deepEqual(manifest.release.observerCorrection.originalDeclaration, {
    path: oldPath,
    bytes: oldBytes.length,
    sha256: hash(oldBytes),
  });
});
test('historical v3 declaration/workflow and exact changed input identities remain independent', async () => {
  const bytes = await read(
    'docs/performance/fixtures/solo-optional-start-audio/34d95-execution-source.json',
  );
  assert.equal(hash(bytes), '506bdb703b1ce3f9ff0198aa60d2cd6852c429b3972d40e81b765b195ec65e11');
  const witness = JSON.parse(bytes);
  assert.equal(witness.revision, before);
  assert.equal(witness.run, 39057302158);
  assert.equal(witness.records.length, 4);
  for (const record of witness.records) {
    assert.match(record.blob, /^[a-f0-9]{40}$/);
    if (record.path.startsWith('scripts/')) {
      const prior = [...old.adapterInputs, ...old.frozenTools].find((r) => r.path === record.path);
      assert.deepEqual(prior, { path: record.path, bytes: record.bytes, sha256: record.sha256 });
      assert.notEqual(hash(await read(record.path)), record.sha256);
    } else {
      const b = await read(record.path);
      assert.equal(b.length, record.bytes);
      assert.equal(hash(b), record.sha256);
    }
  }
});
test('one-module command binds the concrete v4 without workspace imports', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-audio-observer-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'adapter.mjs'), await read('scripts/solo-remote-readiness.mjs'));
  await writeFile(join(dir, 'plan.json'), await read(path));
  const r = spawnSync(
    process.execPath,
    [
      join(dir, 'adapter.mjs'),
      'bind-plan',
      join(dir, 'plan.json'),
      join(dir, 'bound.json'),
      'chromium',
    ],
    { cwd: dir, encoding: 'utf8', timeout: 5000, maxBuffer: 65536 },
  );
  assert.equal(r.status, 0, r.stderr);
  const bound = JSON.parse(await readFile(join(dir, 'bound.json')));
  assert.deepEqual(bound.fixture, old.fixture);
  assert.equal(bound.rows.length, 1);
  assert.deepEqual(bound.release.observerCorrection, OPTIONAL_AUDIO_OBSERVER_CORRECTION);
});
