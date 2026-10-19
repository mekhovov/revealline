import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  bindRasterJob,
  RUNTIME73_EARNED_RASTER_SOURCE,
  EARNED_RASTER_CASES,
} from './solo-remote-raster.mjs';
const root = new URL('../', import.meta.url);
const read = async (p) => JSON.parse(await readFile(new URL(p, root)));
const plan = await read('docs/performance/solo-remote-73a345-earned-raster-plan.json');
const prior = await read('docs/performance/solo-remote-de332-earned-raster-plan.json');

test('current raster binds the exact verified package and unchanged legal native workload', () => {
  assert.equal(RUNTIME73_EARNED_RASTER_SOURCE.revision, '73a345cec696d7789198cf295ca5c37b17ca0e71');
  for (const field of [
    'raster',
    'resources',
    'setupTimeoutMs',
    'helperTimeoutMs',
    'evidenceBytes',
    'rowEvidenceBytes',
    'jobs',
    'maxParallel',
    'node',
    'playwright',
  ])
    assert.deepEqual(plan[field], prior[field], field);
  assert.equal(plan.baseline.reusableArtifact, undefined);
  assert.equal(plan.baseline.publishVerifiedNormal, undefined);
  for (const job of plan.jobs) {
    const bound = bindRasterJob(plan, job);
    assert.equal(bound.rows.length, 1);
    assert.equal(bound.rows[0].source, 'candidate');
    assert.equal(bound.rows[0].timeoutMs, 1200000);
    assert.deepEqual(bound.raster.cases, EARNED_RASTER_CASES);
    assert.equal(bound.raster.cases.length, 21);
    assert.equal(bound.raster.observationTimeoutMs, 120000);
    assert.equal(bound.raster.pixelTolerance, 0);
    assert.equal(bound.raster.retryCount, 0);
    assert.equal(bound.performanceExclusion, true);
  }
});

test('current raster refuses mixed package identities, authority, modified workload and limits', () => {
  for (const change of [
    (p) => p.candidate.run++,
    (p) => p.candidate.artifact++,
    (p) => p.candidate.outer.bytes++,
    (p) => (p.candidate.inner.sha256 = '0'.repeat(64)),
    (p) => (p.candidate.manifestSHA256 = '0'.repeat(64)),
    (p) => (p.candidate.revision = '56e29fd264f77df191b75b3425cc6e7bb0ce9e13'),
    (p) => (p.candidate.tree = prior.candidate.tree),
    (p) => (p.sourceCohort = 'earned-raster-any'),
    (p) => (p.runtimeRevision = prior.runtimeRevision),
    (p) => (p.baseline.publishVerifiedNormal = true),
    (p) => (p.baseline.reusableArtifact = {}),
    (p) => (p.release.noUnclosedOwners = false),
    (p) => (p.release.priorProofInspected = false),
    (p) => (p.release.firstEightAllCorrectnessPassed = false),
    (p) => p.release.evidence[0].runId++,
    (p) => p.release.evidence[0].artifactId++,
    (p) => (p.release.evidence[0].artifactSHA256 = '0'.repeat(64)),
    (p) => (p.release.evidence[0].summarySHA256 = '0'.repeat(64)),
    (p) => (p.release.dispatch.lane = 'first-eight'),
    (p) => (p.release.dispatch.ref = 'refs/heads/arbitrary'),
    (p) => (p.release.onceOnlyBefore = p.candidate.revision),
    (p) => p.release.automaticRetries++,
    (p) => p.raster.cases.pop(),
    (p) => p.raster.pixelTolerance++,
    (p) => p.raster.observationTimeoutMs++,
    (p) => p.raster.fixture.bytes++,
    (p) => p.raster.retryCount++,
    (p) => p.helperTimeoutMs++,
    (p) => p.rowEvidenceBytes++,
    (p) => (p.performanceExclusion = false),
  ]) {
    const value = structuredClone(plan);
    change(value);
    assert.throws(() => bindRasterJob(value, 'raster-webkit'));
  }
});

test('previous raster declaration still binds to its original source and exact protocol', () => {
  for (const job of prior.jobs) {
    const bound = bindRasterJob(prior, job);
    assert.equal(bound.candidate.revision, 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4');
    assert.equal(bound.release.firstEightAllCorrectnessPassed, true);
    assert.deepEqual(bound.raster.cases, EARNED_RASTER_CASES);
  }
});

test('actual73 first-eight proof admits only raster correctness and unchanged source-core recipe', async () => {
  assert.deepEqual(plan.release.evidence, [
    {
      runId: 39105055762,
      artifactId: 12127359946,
      artifactSHA256: '17665afe978ae63cfaf8d24b1a9626e1d7f607b7ee2611fc637c9e680f3d46d8',
      summarySHA256: 'a33416a355620817896366d5312fbecb44f0c7e6b8f7220941c8447886d99762',
    },
  ]);
  assert.equal(plan.release.performanceQualification, 'excluded');
  assert.equal(plan.prospectiveOutcome.status, 'not-yet-observed');
  const proof = await read(plan.sourceCompatibility.path);
  assert.equal(proof.candidate, plan.candidate.revision);
  assert.equal(proof.tree, plan.candidate.tree);
  assert.equal(proof.records.length, 5);
  assert(
    proof.records.every(
      (record) => record.equal && record.sources[0].object === record.sources[1].object,
    ),
  );
});
