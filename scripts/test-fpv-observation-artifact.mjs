import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  FPV_OBSERVATION_PROTOCOLS,
  validateFPVArtifactBinding,
  validateFPVObservationPlan,
  loadFPVObservationArtifact,
  closeFPVObservationResources,
  fpvObservationDeadline,
  FPV_OBSERVATION_LIMITS,
} from './fpv-observation-artifact.mjs';
import { observeFPVRuntime } from './observe-fpv-runtime.mjs';
import { observeFPVRetention } from './observe-fpv-retention.mjs';
import { optionalFPVSourceFixture } from '../publishing/optional-package-source-fixture.mjs';
import { buildOptionalPractice } from './build-optional-practice.mjs';
import { createOptionalPackageCandidate } from '../publishing/optional-package-candidate.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const binding = { version: 'v1.2.3', sourceRevision: 'b'.repeat(40), sourceTree: 'c'.repeat(40) };
const plan = (kind) => ({
  format: `revealline-fpv-${kind}-plan.v1`,
  caseId: 'synthetic-admission-only',
  protocol: FPV_OBSERVATION_PROTOCOLS[kind],
  deviceLabel: 'Synthetic fixture; no browser evidence',
  quietWindow: 'No measurement performed',
  bundle: '.',
  envelopeSha256: 'a'.repeat(64),
  sourceRevision: binding.sourceRevision,
  sourceTree: binding.sourceTree,
  packageRevision: 'd'.repeat(64),
});
const temporary = async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fpv-artifact-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
};

test('runtime and retention require distinct bounded procedures with the same exact artifact identity', () => {
  for (const kind of ['runtime', 'retention']) {
    assert.deepEqual(validateFPVObservationPlan(plan(kind), kind), plan(kind));
    for (const change of [
      { protocol: 'civilian-fpv-airborne-completion.v1' },
      { format: 'revealline-fpv-completion-plan.v1' },
      { caseId: 123 },
      { sourceRevision: 'main' },
      { envelopeSha256: ['a'.repeat(64)] },
      { quietWindow: '' },
      { bundle: 'a'.repeat(4097) },
      { trace: 'cpu' },
      { script: 'inject progress' },
    ])
      assert.throws(() => validateFPVObservationPlan({ ...plan(kind), ...change }, kind));
    assert.throws(() => validateFPVObservationPlan(' '.repeat(65537), kind));
  }
  assert.deepEqual(
    validateFPVArtifactBinding(plan('runtime')),
    validateFPVArtifactBinding(plan('retention')),
  );
  assert.throws(() => validateFPVObservationPlan(plan('runtime'), 'unknown'));
});

test('both observer entry points preserve failed admission and refuse to overwrite earlier evidence', async (t) => {
  const directory = await temporary(t);
  await writeFile(path.join(directory, 'optional-packages.json'), '{}');
  for (const [kind, observe] of [
    ['runtime', observeFPVRuntime],
    ['retention', observeFPVRetention],
  ]) {
    const planFile = path.join(directory, kind + '.json'),
      output = path.join(directory, kind + '-evidence');
    await writeFile(planFile, JSON.stringify(plan(kind)));
    const report = await observe({
      planFile,
      output,
      playwrightModule: '/must-not-be-imported.mjs',
    });
    assert.equal(report.completed, false);
    assert.equal(report.qualification, false);
    assert.equal(report.procedureComplete, false);
    assert.match(report.failure, /Envelope differs/);
    assert.deepEqual(report.cleanup.operations, []);
    assert(
      report.instrumentation.some((item) => item.path === 'scripts/fpv-observation-artifact.mjs'),
    );
    for (const item of report.instrumentation) {
      const recorded = await readFile(path.join(output, 'authority', path.basename(item.path)));
      assert.equal(recorded.length, item.bytes);
      assert.equal(hash(recorded), item.sha256);
    }
    const prior = await readFile(path.join(output, 'observation.json'));
    assert.deepEqual(JSON.parse(prior), report);
    await assert.rejects(
      observe({ planFile, output, playwrightModule: '/must-not-be-imported.mjs' }),
      { code: 'EEXIST' },
    );
    assert.deepEqual(await readFile(path.join(output, 'observation.json')), prior);
  }
});

test('artifact loader rejects a symlink outside the selected bundle before reading envelope content', async (t) => {
  const directory = await temporary(t),
    bundle = path.join(directory, 'bundle'),
    outside = path.join(directory, 'outside.json');
  await mkdir(bundle);
  await writeFile(outside, '{}');
  await symlink(outside, path.join(bundle, 'optional-packages.json'));
  await assert.rejects(
    loadFPVObservationArtifact({ ...plan('runtime'), bundle }, { base: directory }),
    /escapes its root/,
  );
});

test('shared loader admits complete frozen runtime and source bytes and rejects corrupt source even with intact runtime', async (t) => {
  const fixture = await optionalFPVSourceFixture(t),
    built = await buildOptionalPractice(fixture.root, {
      packageId: 'civilian-fpv',
      engineCommit: binding.sourceRevision,
      engineTree: binding.sourceTree,
      basePath: '/revealline/',
    }),
    candidate = createOptionalPackageCandidate({ built, ...binding }),
    envelope = Buffer.from(
      JSON.stringify({
        format: 'revealline-optional-packages.v1',
        ...binding,
        packages: [candidate.package],
      }),
    ),
    directory = await temporary(t),
    selected = {
      ...plan('runtime'),
      envelopeSha256: hash(envelope),
      packageRevision: candidate.package.revision,
    };
  for (const [name, bytes] of candidate.files) await writeFile(path.join(directory, name), bytes);
  await writeFile(path.join(directory, 'optional-packages.json'), envelope);
  const admitted = await loadFPVObservationArtifact(selected, { base: directory });
  assert.equal(admitted.admission.publicEligible, false);
  assert.equal(admitted.admission.zipMembersVerified, true);
  assert.deepEqual(admitted.files, new Map(built.entries.map((item) => [item.name, item.bytes])));
  assert.equal(admitted.binding.members.length, admitted.files.size);
  assert(admitted.binding.members.some((item) => item.path === 'optional-package.json'));
  assert.equal(admitted.binding.envelope.sha256, selected.envelopeSha256);
  await assert.rejects(
    loadFPVObservationArtifact(
      { ...selected, packageRevision: 'e'.repeat(64) },
      { base: directory },
    ),
    /exact civilian-fpv package is absent/,
  );
  const source = candidate.package.sourceArchive.path;
  await writeFile(path.join(directory, source), Buffer.from('changed'));
  await assert.rejects(
    loadFPVObservationArtifact(selected, { base: directory }),
    /artifact bytes differ/,
  );
});

test('cleanup records a failure while still closing every other owned resource', async () => {
  const called = [];
  const report = await closeFPVObservationResources([
    [
      'app',
      () => {
        called.push('app');
        throw Error('app cleanup failed');
      },
    ],
    ['browser', () => called.push('browser')],
    ['server', () => called.push('server')],
  ]);
  assert.deepEqual(called, ['app', 'browser', 'server']);
  assert.equal(report.completed, false);
  assert.deepEqual(
    report.operations.map((item) => item.closed),
    [false, true, true],
  );
  assert.match(report.operations[0].error, /app cleanup failed/);
});

test('a stalled observation wait times out without claiming that its underlying operation stopped', async () => {
  let release;
  const stalled = new Promise((resolve) => {
    release = resolve;
  });
  await assert.rejects(
    fpvObservationDeadline(stalled, 5, 'runtime observation procedure'),
    /runtime observation procedure timed out/,
  );
  release('still needs owned cleanup');
  assert.equal(await stalled, 'still needs owned cleanup');
  assert.deepEqual(FPV_OBSERVATION_LIMITS, { runtime: 180_000, retention: 600_000 });
});
