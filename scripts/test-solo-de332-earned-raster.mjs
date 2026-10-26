import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  bindRasterJob,
  DE332_EARNED_RASTER_SOURCE,
  EARNED_RASTER_CASES,
} from './solo-remote-raster.mjs';
const root = new URL('../', import.meta.url);
const read = async (p) => JSON.parse(await readFile(new URL(p, root)));
const plan = await read('docs/performance/solo-remote-de332-earned-raster-plan.json');
const prior = await read('docs/performance/solo-remote-final-earned-raster-v2-plan.json');

test('current raster binds the exact verified package and unchanged legal native workload', () => {
  assert.equal(DE332_EARNED_RASTER_SOURCE.revision, 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4');
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
    (p) => p.release.evidence[0].artifactId++,
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
    assert.equal(bound.candidate.revision, 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4');
    assert.equal(bound.release.firstEightAllCorrectnessPassed, false);
    assert.deepEqual(bound.raster.cases, EARNED_RASTER_CASES);
  }
});
