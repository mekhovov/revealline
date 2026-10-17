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
const manifest = JSON.parse(await read(path)),
  old = JSON.parse(await read(oldPath)),
  workflow = (await read(workflowPath)).toString();
const before = '34d95cb9fe471ca56c243f05c4330826ba822fb9';
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
test('exact before34d95 guard and current sparse/frozen inputs bind one unchanged e1cc row', async () => {
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
    const b = await read(ref.path);
    assert.equal(b.length, ref.bytes, ref.path);
    assert.equal(hash(b), ref.sha256, ref.path);
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
