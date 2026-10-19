import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  bindRasterJob,
  RUNTIME797_EARNED_RASTER_SOURCE,
  EARNED_RASTER_CASES,
} from './solo-remote-raster.mjs';
const root = new URL('../', import.meta.url);
const read = async (p) => JSON.parse(await readFile(new URL(p, root)));
const plan = await read('docs/performance/solo-remote-797e03-earned-raster-plan.json');
const prior = await read('docs/performance/solo-remote-73a345-earned-raster-plan.json');

const actualFirstEight = (
  await read('docs/performance/fixtures/solo-797e03-consumer/first-eight-39109911286.json')
).proof;
const reviewed = () => structuredClone(plan);

test('current raster binds the exact verified package and unchanged legal native workload', () => {
  assert.equal(
    RUNTIME797_EARNED_RASTER_SOURCE.revision,
    '797e03f28743921842df6aa57520a72016ba3dfc',
  );
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
    const bound = bindRasterJob(reviewed(), job);
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
    (p) => (p.release.status = 'reviewed-diagnostic-only'),
    (p) => (p.release.firstEightRequired = false),
    (p) => (p.release.firstEightAllCorrectnessPassed = false),
    (p) => (p.release.firstEightEvidence = null),
    (p) =>
      (p.release.firstEightEvidence.sourceRevision = '73a345cec696d7789198cf295ca5c37b17ca0e71'),
    (p) => (p.release.firstEightEvidence.correctness = 'failed'),
    (p) => (p.release.firstEightEvidence.ownersClosed = false),
    (p) => (p.release.firstEightEvidence.runId = 0),
    (p) => (p.release.firstEightEvidence.artifactSHA256 = 'invalid'),
    (p) => (p.release.firstEightEvidence.unreviewed = true),
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
    const value = reviewed();
    change(value);
    assert.throws(() => bindRasterJob(value, 'raster-webkit'));
  }
});

test('previous raster declaration still binds to its original source and exact protocol', () => {
  for (const job of prior.jobs) {
    const bound = bindRasterJob(prior, job);
    assert.equal(bound.candidate.revision, '73a345cec696d7789198cf295ca5c37b17ca0e71');
    assert.equal(bound.release.firstEightAllCorrectnessPassed, true);
    assert.deepEqual(bound.raster.cases, EARNED_RASTER_CASES);
  }
});

test('exact797 raster keeps held/proof refusals and unchanged source assets without native claims', async () => {
  assert.equal(plan.status, 'reviewed-diagnostic-only');
  assert.equal(plan.release.status, 'reviewed');
  assert.deepEqual(plan.release.firstEightEvidence, actualFirstEight);
  assert.equal(plan.release.firstEightAllCorrectnessPassed, true);
  assert.deepEqual(plan.release.evidence, [
    Object.fromEntries(
      ['runId', 'artifactId', 'artifactSHA256', 'summarySHA256'].map((key) => [
        key,
        actualFirstEight[key],
      ]),
    ),
  ]);
  assert.equal(plan.release.performanceQualification, 'excluded');
  assert.equal(plan.prospectiveOutcome.status, 'unobserved');
  const held = structuredClone(plan);
  held.release.status = 'held';
  assert.throws(() => bindRasterJob(held, 'raster-webkit'));
  const missingProof = structuredClone(plan);
  missingProof.release.firstEightEvidence = null;
  assert.throws(() => bindRasterJob(missingProof, 'raster-webkit'));
  const proof = await read(plan.sourceCompatibility.path);
  assert.equal(proof.source, plan.candidate.revision);
  assert.equal(proof.tree, plan.candidate.tree);
  assert.equal(proof.records.length, 13);
  assert(proof.records.every((record) => record.equal && record.previous === record.object));
});
