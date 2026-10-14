import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectPracticeCapacity, practiceCapacityFromConfig } from './practice-capacity.mjs';

const core = (bytes = 900_000_000) => ({
  format: 'revealline-default-build-inspection.v1',
  publicationProfile: 'main-pages',
  sourceRevision: 'a'.repeat(40),
  payloadBytesIncludingManifest: bytes,
  manifest: {
    sourceRevision: 'a'.repeat(40),
    totalBytes: bytes - 1,
    files: [{ path: 'game/index.html', bytes: bytes - 1, sha256: 'c'.repeat(64) }],
  },
  manifestDescriptor: { path: 'manifest.json', bytes: 1, sha256: 'd'.repeat(64) },
  completeHostedOutput: false,
});
const manifest = () => ({
  format: 'revealline-optional-practice-package.v1',
  id: 'sample-flight',
  revision: 'b'.repeat(64),
  engineCommit: 'a'.repeat(40),
  entry: 'app/index.html',
  files: [
    { path: 'app/index.html', bytes: 1000, sha256: 'c'.repeat(64) },
    { path: 'launcher/index.html', bytes: 2000, sha256: 'd'.repeat(64) },
  ],
});
const input = (changes = {}, value = manifest()) => ({
  version: 'v1.0.0',
  manifestBytes: Buffer.from(JSON.stringify(value)),
  active: true,
  ...changes,
});

test('counts complete manifest bytes, stable launcher copies and pointer only for active version', () => {
  const current = input(),
    retained = input({ version: 'v0.9.0', active: false });
  const report = inspectPracticeCapacity({ coreInspection: core(), packages: [current, retained] });
  assert.equal(report.packages[0].archiveBytes, 3000 + current.manifestBytes.length);
  assert.equal(report.packages[0].stableLauncherBytes, 2000);
  assert.ok(report.packages[0].pointerBytes > 0);
  assert.equal(report.packages[1].stableLauncherBytes, 0);
  assert.equal(report.packages[1].pointerBytes, 0);
  assert.equal(report.hostedPayloadLowerBound, 900_000_000 + report.packageBytes);
  assert.equal(report.verdict, 'requires-exact-build');
  assert.equal(report.publicEligible, false);
  assert.equal(report.completeHostedOutput, false);
  assert.equal(report.admissionPerformed, false);
  assert.equal(report.coreFiles, 2);
});

test('explicit future reserve is not a fictitious retained release or a capacity pass', () => {
  const report = inspectPracticeCapacity({
    coreInspection: core(930_000_000),
    reserveBytes: 27_000_000,
  });
  assert.equal(report.packages.length, 0);
  assert.equal(report.verdict, 'cannot-fit');
  assert.equal(report.minimumReductionRequiredBytes, 7_000_000);
  assert.equal(report.headroomUpperBoundBytes, -7_000_000);
});

test('even an empty selection exactly at the guard still requires complete-site assembly', () => {
  const report = inspectPracticeCapacity({ coreInspection: core(950_000_000) });
  assert.equal(report.verdict, 'requires-exact-build');
  assert.ok(report.missingComponents.length);
});

test('rejects duplicate immutable versions and competing stable launchers', () => {
  assert.throws(
    () => inspectPracticeCapacity({ coreInspection: core(), packages: [input(), input()] }),
    /conflicting/,
  );
  assert.throws(
    () =>
      inspectPracticeCapacity({
        coreInspection: core(),
        packages: [input(), input({ version: 'v1.0.1' })],
      }),
    /conflicting/,
  );
});

test('rejects invalid core claims, counts and overflowing sums', () => {
  for (const bad of [
    null,
    { ...core(), publicationProfile: null },
    { ...core(), completeHostedOutput: true },
    core(-1),
    core(1.5),
    { ...core(), manifest: { ...core().manifest, totalBytes: 1 } },
  ])
    assert.throws(() => inspectPracticeCapacity({ coreInspection: bad }));
  assert.throws(() => inspectPracticeCapacity({ coreInspection: core(), reserveBytes: -1 }));
  assert.throws(() =>
    inspectPracticeCapacity({ coreInspection: core(Number.MAX_SAFE_INTEGER), reserveBytes: 1 }),
  );
});

test('rejects unsafe and duplicate pins, absent entry and absent active launcher', () => {
  for (const change of [
    (value) => {
      value.files[0].path = '../escape';
    },
    (value) => {
      value.files.push(value.files[0]);
    },
    (value) => {
      value.files[0].bytes = Infinity;
    },
    (value) => {
      value.files[0].sha256 = 'unknown';
    },
    (value) => {
      value.entry = 'missing.html';
    },
    (value) => {
      value.files[1].path = 'other.html';
    },
    (value) => {
      value.files[1].path = 'optional-package.json';
    },
  ]) {
    const value = manifest();
    change(value);
    assert.throws(() =>
      inspectPracticeCapacity({ coreInspection: core(), packages: [input({}, value)] }),
    );
  }
});

test('config resolves paths relative to itself and pins candidate manifests without admitting archives', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'practice-capacity-test-'));
  try {
    await fs.mkdir(path.join(directory, 'candidate'));
    const { manifestBytes } = input();
    await fs.writeFile(path.join(directory, 'candidate/package.json'), manifestBytes);
    const envelope = {
      format: 'revealline-optional-packages.v1',
      version: 'v1.0.0',
      sourceRevision: 'a'.repeat(40),
      packages: [
        {
          id: 'sample-flight',
          manifest: {
            path: 'package.json',
            bytes: manifestBytes.length,
            sha256: createHash('sha256').update(manifestBytes).digest('hex'),
          },
        },
      ],
    };
    await fs.writeFile(
      path.join(directory, 'candidate/optional-packages.json'),
      JSON.stringify(envelope),
    );
    await fs.writeFile(path.join(directory, 'core.json'), JSON.stringify(core()));
    const config = {
      format: 'revealline-practice-capacity-input.v1',
      coreInspection: 'core.json',
      releases: [{ directory: 'candidate', activePackageIds: ['sample-flight'] }],
      reserveBytes: 27_000_000,
    };
    const configPath = path.join(directory, 'plan.json');
    await fs.writeFile(configPath, JSON.stringify(config));
    const report = await practiceCapacityFromConfig(configPath);
    assert.equal(report.packages[0].id, 'sample-flight');
    assert.equal(report.reserveBytes, 27_000_000);
    assert.equal(report.admissionPerformed, false);
    const run = () =>
      spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('./bundle-optional-practice.mjs', import.meta.url)),
          '--capacity',
          configPath,
        ],
        { encoding: 'utf8' },
      );
    const underBudget = run();
    assert.equal(underBudget.status, 0, underBudget.stderr);
    assert.equal(JSON.parse(underBudget.stdout).verdict, 'requires-exact-build');
    config.reserveBytes = 60_000_000;
    await fs.writeFile(configPath, JSON.stringify(config));
    const overBudget = run();
    assert.equal(overBudget.status, 1, overBudget.stderr);
    assert.equal(JSON.parse(overBudget.stdout).verdict, 'cannot-fit');
    await fs.writeFile(path.join(directory, 'candidate/package.json'), Buffer.from('tampered'));
    await assert.rejects(
      practiceCapacityFromConfig(configPath),
      /differs from its candidate envelope/,
    );
    await fs.writeFile(path.join(directory, 'candidate/package.json'), manifestBytes);
    config.releases[0].activePackageIds = ['missing'];
    await fs.writeFile(configPath, JSON.stringify(config));
    await assert.rejects(practiceCapacityFromConfig(configPath), /Invalid capacity candidate/);
    envelope.packages[0].manifest.path = '../core.json';
    config.releases[0].activePackageIds = ['sample-flight'];
    await fs.writeFile(configPath, JSON.stringify(config));
    await fs.writeFile(
      path.join(directory, 'candidate/optional-packages.json'),
      JSON.stringify(envelope),
    );
    await assert.rejects(practiceCapacityFromConfig(configPath), /Unsafe capacity manifest path/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
