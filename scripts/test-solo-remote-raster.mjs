import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, symlink, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  bindRasterJob,
  validateRasterPlan,
  RASTER_CASES,
  rasterAssessment,
  strictControlReproduced,
  readRasterJSON,
  primitiveInputPremises,
  RASTER_SOURCE_LIMITS,
  assertRasterSourceBody,
} from './solo-remote-raster.mjs';
import {
  fullProtocol,
  prefixProtocol,
  primitiveProtocol,
  compositorProtocol,
  analyzeCompositor,
} from './solo-raster-protocols.mjs';
const requirelessPins =
  '{"full":"0b2f0ac044f3553de7a084ce575fc5a0584851e4fd8b4e1d3ee6a6ac214e25a9","prefix":"cf001707d2f3189038da7b76c1d4d1243e948e91846b966b7e263003dbb8f94e","primitive":"3cbc5a06feec4ea311eae8ef91735169207724c34ebca545149203c167b34bc5","compositor":"05d3a8a6376276cb969cdb813a742b0cb3d97ba436b35ff1a38dae98566e80e3"}';

const manifest = JSON.parse(
  await readFile(new URL('../docs/performance/solo-remote-raster-plan.json', import.meta.url)),
);
const bound = () => {
  const value = structuredClone(manifest);
  value.status = 'reviewed-and-released';
  value.release = {
    status: 'reviewed',
    candidateRevision: 'a'.repeat(40),
    firstEightAllCorrectnessPassed: true,
  };
  value.candidate = {
    revision: 'a'.repeat(40),
    tree: 'b'.repeat(40),
    run: 1,
    artifact: 2,
    inner: { bytes: 3, sha256: 'c'.repeat(64) },
    outer: { bytes: 4, sha256: 'd'.repeat(64) },
    manifestSHA256: 'e'.repeat(64),
  };
  return bindRasterJob(value, 'raster-webkit');
};
const control = (count) => ({
  clean: true,
  status: 'failed-strict-invariants',
  cases: RASTER_CASES.slice(0, count).map((r, i) => ({
    ...r,
    determinism: [{ equal: i !== 1 }, { equal: true }],
  })),
  invariantFailures: ['Identical-input raster differs; concealment unobserved: full/acquire'],
});
test('unbound raster plans refuse execution and exact per-engine limits remain fixed', () => {
  const held = structuredClone(manifest);
  held.status = 'bound-3ad-metadata-pending-full-remote-proof-and-reviewed-release';
  assert.throws(() => bindRasterJob(held, 'raster-webkit'));
  const plan = bound();
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0].timeoutMs, 1200000);
  for (const change of [
    (p) => (p.raster.pixelTolerance = 1),
    (p) => (p.raster.retryCount = 1),
    (p) => p.rows[0].timeoutMs++,
    (p) => (p.maxParallel = 3),
    (p) => p.helperTimeoutMs++,
    (p) => p.setupTimeoutMs++,
    (p) => (p.rows[0].source = 'baseline'),
    (p) => p.raster.cases.pop(),
    (p) => p.raster.observationTimeoutMs++,
  ]) {
    const next = structuredClone(plan);
    change(next);
    assert.throws(() => validateRasterPlan(next));
  }
});
test('independent raster diagnostic retains the failed predecessor and all strict limits', () => {
  const plan = bindRasterJob(manifest, 'raster-webkit');
  assert.equal(plan.status, 'reviewed-diagnostic-only');
  assert.equal(plan.release.firstEightAllCorrectnessPassed, false);
  assert.equal(plan.candidate.revision, '3adcd53792043ef02459e86168c6b33a66d6ef00');
  assert.equal(plan.performanceExclusion, true);
  assert.deepEqual(plan.raster.sourceObservation, RASTER_SOURCE_LIMITS);
  for (const change of [
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => (p.release.predecessorRun = 1),
    (p) => (p.release.scope = 'successor-performance'),
    (p) => (p.release.automaticRetries = 1),
    (p) => (p.release.performanceQualification = 'passed'),
    (p) => (p.release.priorProofInspected = false),
    (p) => (p.release.noUnclosedOwners = false),
    (p) => (p.release.evidence[0].summarySHA256 = '0'.repeat(64)),
    (p) => (p.raster.pixelTolerance = 1),
    (p) => p.raster.cases.pop(),
    (p) => (p.raster.retryCount = 1),
    (p) => p.raster.sourceObservation.aggregateBytes++,
    (p) => p.raster.sourceObservation.records++,
  ]) {
    const changed = structuredClone(plan);
    change(changed);
    assert.throws(() => validateRasterPlan(changed));
  }
});
test('raster release is limited to one exact push edge and shallow pinned source checkouts', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/solo-remote-raster-temporary.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /github\.event\.pull_request\.number == 1544/);
  assert.match(
    workflow,
    /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/,
  );
  assert.match(workflow, /github\.event\.action == 'synchronize'/);
  assert.match(workflow, /github\.event\.before == 'aeadf7f43a8c1aba3af78d6cc8713666b4af49f1'/);
  assert.equal((workflow.match(/fetch-depth: 1/g) ?? []).length, 3);
  assert.doesNotMatch(workflow, /fetch-depth: 0/);
});
test('source witness admits the exact large required modules while all other bounds stay strict', async () => {
  assert.deepEqual(RASTER_SOURCE_LIMITS, {
    perSourceBytes: 2 * 1024 ** 2,
    aggregateBytes: 8 * 1024 ** 2,
    records: 256,
  });
  const refs = ['game/i18n/catalogs.mjs'];
  const precedingBytes = 2242201;
  let total = precedingBytes;
  let sourceBytes = 0;
  for (const path of refs) {
    const bytes = await readFile(new URL('../' + path, import.meta.url));
    const size = bytes.length;
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    assert(size > 1024 ** 2, 'The old one MiB source witness cap rejected this required input');
    assert(size <= RASTER_SOURCE_LIMITS.perSourceBytes);
    const identity = { bytes: size, sha256 };
    total += size;
    sourceBytes += size;
    assert.doesNotThrow(() => assertRasterSourceBody(bytes, identity, 200, total));
    assert.throws(() =>
      assertRasterSourceBody(bytes, { ...identity, sha256: '0'.repeat(64) }, 200, total),
    );
    assert.throws(() => assertRasterSourceBody(bytes, identity, 404, total));
    assert.throws(() => assertRasterSourceBody(bytes, identity, 200, 8 * 1024 ** 2 + 1));
  }
  assert.equal(total, precedingBytes + sourceBytes);
  const oversized = Buffer.alloc(2 * 1024 ** 2 + 1);
  assert.throws(() =>
    assertRasterSourceBody(
      oversized,
      {
        bytes: oversized.length,
        sha256: createHash('sha256').update(oversized).digest('hex'),
      },
      200,
      oversized.length,
    ),
  );
});
test('conditional localization requires complete clean exact control-failure class', () => {
  for (const count of [2, 12]) {
    const value = control(count);
    assert.equal(strictControlReproduced(value, count), true);
    for (const change of [
      (v) => (v.clean = false),
      (v) => (v.status = 'incomplete'),
      (v) => v.cases.pop(),
      (v) => (v.cases[1].determinism[1].equal = false),
      (v) => (v.cases[0].determinism[0].equal = false),
      (v) => v.invariantFailures.push('hidden difference'),
    ]) {
      const next = structuredClone(value);
      change(next);
      assert.equal(strictControlReproduced(next, count), false);
    }
  }
});
test('strict historical failure stays failed even when all diagnostic arms close', () => {
  const raw = {
    format: 'SoloHostedNativeRasterV1',
    status: 'failed',
    sourceRevision: 'a'.repeat(40),
    engine: 'webkit',
    browserVersion: '26.5',
    primary: control(12),
    localization: [{ clean: true, diagnosticStatus: 'observed-original-strict-failure-retained' }],
  };
  const command = { status: 'closed', exitCode: 1, survivors: [], ambiguous: [] };
  assert.equal(rasterAssessment(raw, command, 'a'.repeat(40), 'webkit').status, 'failed');
  assert.equal(
    rasterAssessment(raw, command, 'a'.repeat(40), 'webkit').raster,
    'failed-strict-invariants',
  );
});
test('latest-source primary pass is visual-review pending and rejects incomplete owner or coverage', () => {
  const raw = {
    format: 'SoloHostedNativeRasterV1',
    status: 'automated-invariants-pass-visual-review-pending',
    sourceRevision: 'a'.repeat(40),
    engine: 'webkit',
    browserVersion: '26.5',
    primary: {
      ...control(12),
      status: 'automated-invariants-pass-visual-review-pending',
      invariantFailures: [],
    },
  };
  const command = { status: 'closed', exitCode: 0, survivors: [], ambiguous: [] };
  const pass = rasterAssessment(raw, command, 'a'.repeat(40), 'webkit');
  assert.equal(pass.status, 'passed');
  assert.equal(pass.raster, 'automated-invariants-pass-visual-review-pending');
  assert.equal(pass.historicalMacFailure, 'retained-unresolved');
  for (const change of [
    (c) => (c.forcedCleanup = true),
    (c) => (c.cleanupUnconfirmed = true),
    (c) => (c.violation = 'RSS'),
    (c) => (c.exitCode = 1),
    (c) => (c.survivors = [1]),
    (c) => (c.ambiguous = [2]),
  ]) {
    const c = structuredClone(command);
    change(c);
    assert.equal(rasterAssessment(raw, c, 'a'.repeat(40), 'webkit').status, 'failed');
  }
  raw.primary.cases.pop();
  assert.equal(rasterAssessment(raw, command, 'a'.repeat(40), 'webkit').raster, 'incomplete');
});
test('original compositor evaluator retains one-channel difference and blank-positive-control failure', () => {
  const zero = Buffer.alloc(1200 * 900 * 4),
    changed = Buffer.from(zero);
  changed[0] = 1;
  const names = [
    'a-010',
    'a-025',
    'a-zero-control',
    'a-zero-repeat',
    'a-replaced-b',
    'a-restored-a',
    'b-010',
    'b-025',
    'b-zero-control',
    'b-zero-repeat',
    'repeat-a-010',
    'repeat-a-025',
    'repeat-a-zero-control',
    'repeat-a-zero-repeat',
  ];
  const pixels = new Map(
    names.map((name) => [
      name,
      { width: 1200, height: 900, data: name === 'a-010' ? changed : zero },
    ]),
  );
  const report = {
    fixture: { width: 48, height: 36, cells: Array(48 * 36).fill(0) },
    invariantFailures: [],
  };
  assert.throws(() => analyzeCompositor(report, pixels, { sync: { read: (x) => x } }));
  assert.equal(report.controls[0].maxDelta, 1);
  assert.equal(report.controls[0].changedPixels, 1);
  assert(report.invariantFailures.includes('Exact pixel control differs: a-010/repeat-a-010'));
  assert(report.invariantFailures.some((s) => s.startsWith('Exposed positive control fails:')));
});
test('bounded report reader rejects oversized and aliased files', async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'raster-test-'));
  try {
    const path = join(root, 'a.json');
    await writeFile(path, '{"a":1}');
    assert.deepEqual(await readRasterJSON(path, 16), { a: 1 });
    await symlink(path, join(root, 'alias'));
    await assert.rejects(readRasterJSON(join(root, 'alias'), 16));
    await writeFile(path, 'x'.repeat(17));
    await assert.rejects(readRasterJSON(path, 16));
  } finally {
    await rm(root, { recursive: true });
  }
});
test('all four browser protocol bodies retain exact extracted historical bytes', () => {
  const pins = JSON.parse(requirelessPins);
  for (const [name, fn] of Object.entries({
    full: fullProtocol,
    prefix: prefixProtocol,
    primitive: primitiveProtocol,
    compositor: compositorProtocol,
  }))
    assert.equal(createHash('sha256').update(fn.toString()).digest('hex'), pins[name]);
});

test('primitive input admission rejects independent upload inequality before native drawing', () => {
  const refs = structuredClone(manifest.raster.primitiveInputs);
  for (const rows of Object.values(refs)) for (const row of rows) row.base64 = row.sha256;
  assert.equal(primitiveInputPremises(refs), true);
  refs.atlasUploads[4].base64 += 'changed';
  assert.throws(() => primitiveInputPremises(refs));
});
