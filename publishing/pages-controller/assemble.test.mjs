import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  assemble,
  loadCatalog,
  validateAdmissions,
  rootCompatibilityRows,
  rootReleaseProjection,
  directoryInventory,
} from './assemble.mjs';
import { digest, jsonBytes, retainRecentMetadata } from './metadata.mjs';
import { assertPagesBudget, MAX_ARCHIVE_SHARDS } from '../../scripts/pages-archive.mjs';

async function fixture(t, versions = ['v0.1.0', 'v0.44.0'], { archiveCurrent = false } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pages-assemble-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const directory = path.join(dir, 'config'),
    currentSite = path.join(dir, 'current'),
    outputDirectory = path.join(dir, 'artifact');
  const write = async (name, bytes) => {
    await fs.mkdir(path.dirname(name), { recursive: true });
    await fs.writeFile(name, bytes);
  };
  const currentVersion = versions.at(-1),
    historicalVersions = versions.slice(0, -1),
    archivedVersions = archiveCurrent ? versions : historicalVersions,
    releases = [],
    records = [],
    archiveFiles = [];
  for (const version of versions) {
    const payload = new Map([
      ['index.html', Buffer.from(`root ${version}`)],
      ['game/index.html', Buffer.from(`game ${version}`)],
      ['game/icon.png', Buffer.from([1, 2, 3])],
      ['game/app.mjs', Buffer.from('export const edition = "frozen";')],
      ['optional/chapter.json', Buffer.from('{"edition":"frozen"}')],
      ['offline-cache.json', Buffer.from('{"offline":"canonical-only"}')],
      ['manifest.webmanifest', Buffer.from('{"start_url":"./game/","scope":"./"}')],
      ['icons/icon-180.png', Buffer.from([1, 8, 0])],
      ['icons/icon-192.png', Buffer.from([1, 9, 2])],
      ['icons/icon-512.png', Buffer.from([5, 1, 2])],
      ['icons/icon.svg', Buffer.from('<svg/>')],
      ['service-worker.js', Buffer.from(`original worker ${version}`)],
    ]);
    const rows = [...payload].map(([name, bytes]) => ({
      path: name,
      bytes: bytes.length,
      sha256: digest(bytes),
    }));
    const manifestBytes = jsonBytes({
      formatVersion: 1,
      version,
      sourceRevision: 'a'.repeat(40),
      entry: 'game/index.html',
      totalBytes: rows.reduce((n, r) => n + r.bytes, 0),
      files: rows,
    });
    const record = {
      formatVersion: 1,
      version,
      sourceRevision: 'a'.repeat(40),
      sourceArchiveSha256: 'b'.repeat(64),
      distributionSha256: 'c'.repeat(64),
      manifestSha256: digest(manifestBytes),
      play: `${version}/site/game/`,
      download: `${version}/site/distribution.zip`,
    };
    const recordBytes = jsonBytes(record),
      checksumBytes = Buffer.from(`${record.distributionSha256}  distribution.zip\n`);
    for (const [name, bytes] of [
      ['release.json', recordBytes],
      ['manifest.json', manifestBytes],
      ['distribution.zip.sha256', checksumBytes],
    ])
      await write(path.join(directory, 'metadata', version, name), bytes);
    releases.push({
      version,
      sourceRevision: record.sourceRevision,
      tagObject: 'd'.repeat(40),
      recordSha256: digest(recordBytes),
      manifestSha256: record.manifestSha256,
      checksumSha256: digest(checksumBytes),
    });
    records.push(record);
    payload.set('manifest.json', manifestBytes);
    payload.set('distribution.zip.sha256', checksumBytes);
    payload.set(
      '.xonix-build.json',
      Buffer.from('{\n  "tool": "xonix-game-cli",\n  "formatVersion": 1\n}\n'),
    );
    if (version === currentVersion)
      for (const [name, bytes] of payload) await write(path.join(currentSite, name), bytes);
    if (version !== currentVersion || archiveCurrent) {
      archiveFiles.push({
        path: `releases/${version}/release.json`,
        bytes: recordBytes.length,
        sha256: digest(recordBytes),
      });
      for (const [name, bytes] of payload)
        archiveFiles.push({
          path: `releases/${version}/site/${name}`,
          bytes: bytes.length,
          sha256: digest(bytes),
        });
    }
  }
  const catalogBytes = jsonBytes({
    format: 'revealline-frozen-catalog.v1',
    sourceRepository: 'mekhovov/revealline',
    releases,
  });
  const allocationBytes = jsonBytes({
    formatVersion: 1,
    shards: [
      {
        id: 'archive-01',
        repository: 'mekhovov/revealline-archive-01',
        versions: archivedVersions,
      },
      {
        id: 'archive-08',
        repository: 'mekhovov/revealline-archive-08',
        versions: ['v0.47.0', 'v0.48.0'],
      },
    ],
  });
  const base = 'https://mekhovov.github.io/revealline-archive-01/',
    inventoryBytes = jsonBytes({ base, files: archiveFiles }),
    httpBytes = jsonBytes({
      status: 'PASS',
      base,
      files: archiveFiles.length,
      expectedInventorySha256: digest(inventoryBytes),
      expectedBytes: archiveFiles.reduce((n, r) => n + r.bytes, 0),
      verifiedBytes: archiveFiles.reduce((n, r) => n + r.bytes, 0),
      failedFiles: 0,
      skipped: [],
    });
  const nativeBytes = Buffer.from('Scoped native fixture receipt.');
  const nativePin = { path: 'native.txt', sha256: digest(nativeBytes), kind: 'reference' };
  const browserBytes = jsonBytes({
    evidence: [nativePin],
    format: 'revealline-archive-browser-admission.v1',
    status: 'PASS',
    archiveId: 'archive-01',
    infrastructureCommit: 'e'.repeat(40),
    deploymentId: 42,
    versions: archivedVersions,
  });
  const qualificationBytes = jsonBytes({
    format: 'revealline-source-qualification.v1',
    version: currentVersion,
    sourceRevision: 'a'.repeat(40),
    sourceTree: 'f'.repeat(40),
    passed: true,
    allTrackedSourceContentsAndModesMatch: true,
    gates: ['validate', 'lint', 'test', 'format', 'native-format', 'motion-syntax'].map((gate) => ({
      gate,
      exitCode: 0,
    })),
  });
  const configuration = {
    format: 'revealline-pages-controller.v1',
    currentSourceQualification: { path: 'qualification.json', sha256: digest(qualificationBytes) },
    deploymentEnabled: true,
    retainedReleasesPerMajor: 5,
    testingRoutes: {},
    currentVersion,
    catalogSha256: digest(catalogBytes),
    allocationSha256: digest(allocationBytes),
    admissions: [
      {
        id: 'archive-01',
        infrastructureCommit: 'e'.repeat(40),
        deploymentId: 42,
        evidence: [
          ['inventory.json', inventoryBytes, 'inventory'],
          ['http.json', httpBytes, 'http'],
          ['browser.json', browserBytes, 'browser'],
          ['native.txt', nativeBytes, 'reference'],
        ].map(([name, bytes, kind]) => ({ path: name, sha256: digest(bytes), kind })),
      },
    ],
  };
  for (const [name, bytes] of [
    ['qualification.json', qualificationBytes],
    ['catalog.json', catalogBytes],
    ['allocations.json', allocationBytes],
    ['publication.json', jsonBytes(configuration)],
    ['inventory.json', inventoryBytes],
    ['http.json', httpBytes],
    ['browser.json', browserBytes],
    ['native.txt', nativeBytes],
  ])
    await write(path.join(directory, name), bytes);
  const currentManifestBytes = await fs.readFile(path.join(currentSite, 'manifest.json')),
    currentManifest = JSON.parse(currentManifestBytes),
    extractionReceipt = {
      format: 'revealline-current-extraction.v1',
      distributionSha256: records.at(-1).distributionSha256,
      manifestSha256: records.at(-1).manifestSha256,
      gameSourceRevision: records.at(-1).sourceRevision,
      version: records.at(-1).version,
      membersVerified: currentManifest.files.length + 1,
      manifestFilesVerified: currentManifest.files.length,
      uncompressedBytesVerified: currentManifest.totalBytes + currentManifestBytes.length,
      crcAndHashesVerified: true,
      files: await directoryInventory(currentSite),
    };
  return {
    directory,
    currentSite,
    outputDirectory,
    configuration,
    records,
    write,
    extractionReceipt,
  };
}

const waivedPolicy = () => ({
  format: 'revealline-release-test-policy.v1',
  mode: 'waived',
  authorization: 'explicit-user-request-20260922',
  scope: 'automated-test-suites',
  reason: 'Temporary automated test waiver requested by the user.',
  restoration: 'Restore required automated tests in a reviewed change.',
});

function waivedQualification(version, policyBytes) {
  const sourceRevision = 'a'.repeat(40),
    sourceTree = 'f'.repeat(40),
    step = (name, number) => ({ name, number, status: 'completed', conclusion: 'success' }),
    policyEvidence = {
      path: 'publishing/test-policy.json',
      bytes: policyBytes.length,
      sha256: digest(policyBytes),
    },
    runEvidence = { path: 'run.json', bytes: 10, sha256: '1'.repeat(64) },
    jobsEvidence = { path: 'jobs.json', bytes: 10, sha256: '2'.repeat(64) };
  return {
    format: 'revealline-source-qualification.v2',
    status: 'qualified-with-test-waiver',
    releaseEligible: true,
    version,
    sourceRevision,
    sourceTree,
    actualCheckoutCommit: sourceRevision,
    actualCheckoutTree: sourceTree,
    allTrackedSourceContentsAndModesMatch: true,
    gates: ['validate', 'lint', 'format', 'native-format', 'motion-syntax'].map((gate, index) => ({
      gate,
      command: [
        'npm run validate',
        'npm run lint',
        'npm run format:check',
        'npm run format:native:check',
        'node --check authoring/motion-lab/app.js',
      ][index],
      jobId: 100 + index,
      step: step(`Gate ${gate}`, index + 1),
    })),
    tests: { status: 'waived', counts: null },
    testPolicy: {
      mode: 'waived',
      authorization: 'explicit-user-request-20260922',
      reason: waivedPolicy().reason,
      policyEvidence,
    },
    waiverEvidence: { runId: 42, runEvidence, jobsEvidence },
    evidencePins: [
      policyEvidence,
      runEvidence,
      jobsEvidence,
      { path: 'empty.log', bytes: 0, sha256: '3'.repeat(64) },
      { path: 'large-diff.bin', bytes: 5 * 1024 * 1024, sha256: '4'.repeat(64) },
    ],
    preMergeValidationCorroboration: {
      runId: 41,
      jobId: 98,
      command: 'npm run validate',
      sourceRevision,
      sourceTree,
      step: step('Validate release-critical source', 20),
      artifactBuild: {
        status: 'deferred-to-frozen-source',
        step: step('Defer full artifact build to merged-source qualification', 21),
      },
      scope: 'Exact PR source validation; artifact deferred to frozen source',
    },
    frozenArtifactCorroboration: {
      artifactId: 99,
      runId: 42,
      wholeOriginalArtifactVerifiedBeforeQualification: true,
      sourceTarGitBlobTypeModeAndPaxCommitVerified: true,
      allInnerZipManifestBytesVerified: true,
      frozenOfflineInventoryAndBindingsVerified: true,
    },
  };
}

function focusedAdmission(sourceTree) {
  return {
    runId: 41,
    jobId: 98,
    aggregateJobId: 97,
    sourceRevision: 'c'.repeat(40),
    sourceTree,
    classificationSteps: [
      {
        name: 'Capture the reviewed changed-path set',
        number: 5,
        status: 'completed',
        conclusion: 'success',
      },
      {
        name: 'Select the fail-closed focused gate',
        number: 6,
        status: 'completed',
        conclusion: 'success',
      },
    ],
    genericBuild: { jobId: 96, status: 'skipped-by-fast-release-policy' },
    fullTests: { status: 'waived-and-skipped' },
    scope: 'Exact PR head focused admission; generic build and full suites were skipped.',
  };
}

test('complete artifact retains original graph and creates only authenticated historical bridges', async (t) => {
  const f = await fixture(t),
    receipt = await assemble(f);
  assert.equal(receipt.currentVersion, 'v0.44.0');
  assert.equal(receipt.historicalBridges, 1);
  assert.equal(receipt.redirectedHTMLFiles, 2);
  assert.equal(
    await fs.readFile(
      path.join(f.outputDirectory, 'releases/v0.44.0/site/service-worker.js'),
      'utf8',
    ),
    'original worker v0.44.0',
  );
  assert.equal(
    await fs.readFile(
      path.join(f.outputDirectory, 'releases/v0.44.0/site/game/index.html'),
      'utf8',
    ),
    'game v0.44.0',
  );
  const root = await fs.readFile(path.join(f.outputDirectory, 'game/index.html'), 'utf8');
  assert.match(root, /releases\/v0.44.0\/site\/game\/index.html/);
  const historical = await fs.readFile(
    path.join(f.outputDirectory, 'releases/v0.1.0/site/game/index.html'),
    'utf8',
  );
  assert.match(historical, /revealline-archive-01\/releases\/v0.1.0\/site\/game\/index.html/);
  await assert.rejects(
    fs.access(path.join(f.outputDirectory, 'releases/v0.1.0/site/game/icon.png')),
  );
  const worker = await fs.readFile(path.join(f.outputDirectory, 'service-worker.js'), 'utf8');
  assert.match(worker, /registration.unregister/);
  assert.doesNotMatch(worker, /skipWaiting|clients.claim|caches.delete/);
  assert.equal(receipt.browserAdmissionsRequired, true);
  assert.equal(receipt.currentGraphLayout, 'single-canonical-with-root-metadata-v1');
  const { metadata } = await loadCatalog(f.directory);
  const current = metadata.get('v0.44.0');
  const rootRelease = JSON.parse(
    await fs.readFile(path.join(f.outputDirectory, 'release.json'), 'utf8'),
  );
  assert.deepEqual(rootRelease, rootReleaseProjection(current.record, 'mekhovov/revealline'));
  assert.equal(rootRelease.play, 'releases/v0.44.0/site/game/');
  assert.equal(
    rootRelease.download,
    'https://github.com/mekhovov/revealline/releases/download/v0.44.0/distribution.zip',
  );
  await fs.access(path.join(f.outputDirectory, rootRelease.play, 'index.html'));
  assert.deepEqual(
    await fs.readFile(path.join(f.outputDirectory, 'releases/v0.44.0/release.json')),
    current.recordBytes,
  );
  // Every immutable runtime body is present once at its canonical path, even
  // when its old root duplicate is no longer emitted. Never edit frozen bytes.
  for (const row of current.manifest.files) {
    const original = await fs.readFile(path.join(f.currentSite, row.path));
    assert.deepEqual(
      await fs.readFile(path.join(f.outputDirectory, 'releases/v0.44.0/site', row.path)),
      original,
      row.path,
    );
    assert.equal(digest(original), row.sha256);
  }
  for (const name of [
    'game/app.mjs',
    'game/icon.png',
    'optional/chapter.json',
    'offline-cache.json',
    '.xonix-build.json',
  ])
    await assert.rejects(fs.access(path.join(f.outputDirectory, name)), { code: 'ENOENT' });
  assert.deepEqual(receipt.rootCompatibilityFiles.map((row) => row.path).sort(), [
    'icons/icon-180.png',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon.svg',
    'manifest.json',
    'manifest.webmanifest',
  ]);
  for (const row of receipt.rootCompatibilityFiles)
    assert.deepEqual(
      await fs.readFile(path.join(f.outputDirectory, row.path)),
      await fs.readFile(path.join(f.currentSite, row.path)),
    );
  const routing = JSON.parse(
    await fs.readFile(path.join(f.outputDirectory, 'current-entry-routing.json')),
  );
  assert.equal(routing.frozenManifest.appliesTo, 'releases/v0.44.0/site/');
  assert.ok(receipt.totalBytes < 950_000_000);
  const reread = await directoryInventory(f.outputDirectory);
  assert.deepEqual(reread, receipt.files);
  assert.equal(
    reread.reduce((sum, row) => sum + row.bytes, 0),
    receipt.totalBytes,
  );
  await assert.rejects(assemble(f), /EEXIST/);
  assert.equal(
    await fs.readFile(
      path.join(f.outputDirectory, 'releases/v0.44.0/site/game/index.html'),
      'utf8',
    ),
    'game v0.44.0',
  );
});

test('root compatibility projection never admits runtime bodies and retains finite byte bounds', () => {
  const names = [
    'manifest.json',
    'manifest.webmanifest',
    'icons/icon-180.png',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon.svg',
  ];
  assert.deepEqual(
    rootCompatibilityRows(names.map((path) => ({ path, bytes: 1 }))).map((row) => row.path),
    names,
  );
  assert.deepEqual(
    rootCompatibilityRows(
      [
        'game/app.mjs',
        'offline-cache.json',
        'optional/chapter.json',
        'icons/extra.png',
        'manifest.json/extra',
        '../manifest.json',
      ].map((path) => ({ path, bytes: 1 })),
    ),
    [],
  );
  for (const bytes of [0, -1, 1.5, Infinity, '1', 8_000_001])
    assert.throws(() => rootCompatibilityRows([{ path: 'manifest.json', bytes }]), /byte budget/);
  for (const [path, bytes] of [
    ['manifest.json', 8_000_000],
    ['manifest.webmanifest', 65_536],
    ['icons/icon-192.png', 1_048_576],
    ['icons/icon.svg', 65_536],
  ]) {
    assert.equal(rootCompatibilityRows([{ path, bytes }]).length, 1);
    assert.throws(() => rootCompatibilityRows([{ path, bytes: bytes + 1 }]), /byte budget/);
  }
});

test('single-copy projection does not relax the actual Pages artifact budget', () => {
  assert.equal(assertPagesBudget(950_000_000), 950_000_000);
  assert.throws(() => assertPagesBudget(950_000_001), /budget|exceeds/i);
});

test('retention keeps only the latest releases in each semantic major line', async (t) => {
  const f = await fixture(t);
  f.configuration.retainedReleasesPerMajor = 1;
  await f.write(path.join(f.directory, 'publication.json'), jsonBytes(f.configuration));
  const receipt = await assemble(f);
  assert.equal(receipt.historicalBridges, 0);
  await assert.rejects(fs.access(path.join(f.outputDirectory, 'releases/v0.1.0/release.json')));
  const index = JSON.parse(await fs.readFile(path.join(f.outputDirectory, 'releases/index.json')));
  assert.deepEqual(
    index.releases.map((release) => release.version),
    ['v0.44.0'],
  );
  const { metadata } = await loadCatalog(f.directory);
  assert.deepEqual([...retainRecentMetadata(metadata, 1).keys()], ['v0.44.0']);
});

test('a comparison-only tag is listed with its dedicated playable archive route', async (t) => {
  const f = await fixture(t);
  f.configuration.retainedReleasesPerMajor = 1;
  f.configuration.testingRoutes = {
    'v0.1.0': 'https://mekhovov.github.io/revealline-archive-01/releases/v0.1.0/site/',
  };
  await f.write(path.join(f.directory, 'publication.json'), jsonBytes(f.configuration));
  await assemble(f);
  const index = JSON.parse(await fs.readFile(path.join(f.outputDirectory, 'releases/index.json'))),
    comparison = index.releases.find((release) => release.version === 'v0.1.0');
  assert.equal(
    comparison.canonicalPlay,
    'https://mekhovov.github.io/revealline-archive-01/releases/v0.1.0/site/game/',
  );
  assert.match(
    await fs.readFile(path.join(f.outputDirectory, 'releases/v0.1.0/site/game/index.html'), 'utf8'),
    /revealline-archive-01\/releases\/v0\.1\.0\/site\/game\/index\.html/,
  );
});

test('wrong and extra current bodies fail before any artifact is created', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.currentSite, 'unexpected.txt'), 'extra');
  await assert.rejects(assemble(f), /extra files/);
  await assert.rejects(fs.access(f.outputDirectory));
  await fs.unlink(path.join(f.currentSite, 'unexpected.txt'));
  await fs.writeFile(path.join(f.currentSite, 'game/index.html'), 'wrong');
  await assert.rejects(assemble(f), /mismatch|changed/);
  await assert.rejects(fs.access(f.outputDirectory));
});

test('extraction receipt identity and inventory mutations fail closed', async (t) => {
  for (const mutate of [
    (receipt) => (receipt.gameSourceRevision = 'b'.repeat(40)),
    (receipt) => (receipt.files[0].sha256 = 'f'.repeat(64)),
    (receipt) => receipt.files.reverse(),
    (receipt) => receipt.files.pop(),
  ]) {
    const f = await fixture(t),
      changed = structuredClone(f.extractionReceipt);
    mutate(changed);
    await assert.rejects(assemble({ ...f, extractionReceipt: changed }), /extraction|inventory/i);
    await assert.rejects(fs.access(f.outputDirectory));
  }
});

test('archive admission requires every original file, pinned HTTP evidence and native approval', async (t) => {
  const f = await fixture(t),
    { metadata } = await loadCatalog(f.directory);
  const validate = (configuration) =>
    validateAdmissions({ directory: f.directory, metadata, configuration });
  await validate(f.configuration);
  await assert.rejects(validate({ ...f.configuration, deploymentEnabled: false }), /not enabled/);
  const missing = structuredClone(f.configuration);
  missing.admissions[0].evidence = missing.admissions[0].evidence.filter(
    (p) => p.kind !== 'browser',
  );
  await assert.rejects(validate(missing), /incomplete/);
  const missingInventory = structuredClone(f.configuration);
  missingInventory.admissions[0].evidence = missingInventory.admissions[0].evidence.filter(
    (p) => p.kind !== 'inventory',
  );
  await assert.rejects(validate(missingInventory), /incomplete/);
  const changed = structuredClone(f.configuration);
  changed.admissions[0].evidence[0].sha256 = 'f'.repeat(64);
  await assert.rejects(validate(changed), /byte pin mismatch/);
  const wrong = structuredClone(f.configuration);
  wrong.admissions[0].infrastructureCommit = 'f'.repeat(40);
  await assert.rejects(validate(wrong), /browser admission failed/);
});

test('an admitted current archive is verified without replacing the current game route', async (t) => {
  const f = await fixture(t, ['v0.1.0', 'v0.44.0'], { archiveCurrent: true });
  const { metadata } = await loadCatalog(f.directory);
  const admitted = await validateAdmissions({ ...f, metadata });
  assert.equal(admitted.admissions.length, 1);
  assert.equal(admitted.canonicalSites['v0.44.0'], undefined);
  assert.deepEqual(admitted.plan.shards[0].versions, ['v0.1.0']);
  const receipt = await assemble(f);
  assert.equal(receipt.currentVersion, 'v0.44.0');
  assert.equal(
    await fs.readFile(
      path.join(f.outputDirectory, 'releases/v0.44.0/site/game/index.html'),
      'utf8',
    ),
    'game v0.44.0',
  );

  // Even though current routing stays local, its new archive must retain exact bytes.
  const inventory = JSON.parse(await fs.readFile(path.join(f.directory, 'inventory.json')));
  inventory.files.find((r) => r.path === 'releases/v0.44.0/site/game/icon.png').sha256 = 'f'.repeat(
    64,
  );
  const inventoryBytes = jsonBytes(inventory);
  await fs.writeFile(path.join(f.directory, 'inventory.json'), inventoryBytes);
  const config = structuredClone(f.configuration);
  config.admissions[0].evidence.find((pin) => pin.kind === 'inventory').sha256 =
    digest(inventoryBytes);
  const http = JSON.parse(await fs.readFile(path.join(f.directory, 'http.json')));
  http.expectedInventorySha256 = digest(inventoryBytes);
  const httpBytes = jsonBytes(http);
  await fs.writeFile(path.join(f.directory, 'http.json'), httpBytes);
  config.admissions[0].evidence.find((pin) => pin.kind === 'http').sha256 = digest(httpBytes);
  await assert.rejects(
    validateAdmissions({ directory: f.directory, metadata, configuration: config }),
    /does not preserve the pinned original/,
  );
});

test('accepted HTTP status cannot substitute a different original while retaining matched counts', async (t) => {
  const f = await fixture(t),
    { metadata } = await loadCatalog(f.directory);
  const inventory = JSON.parse(await fs.readFile(path.join(f.directory, 'inventory.json')));
  inventory.files.find((r) => r.path.endsWith('/game/icon.png')).sha256 = 'f'.repeat(64);
  const bytes = jsonBytes(inventory);
  await fs.writeFile(path.join(f.directory, 'inventory.json'), bytes);
  const config = structuredClone(f.configuration);
  config.admissions[0].evidence.find((p) => p.kind === 'inventory').sha256 = digest(bytes);
  const http = JSON.parse(await fs.readFile(path.join(f.directory, 'http.json')));
  http.expectedInventorySha256 = digest(bytes);
  const httpBytes = jsonBytes(http);
  await fs.writeFile(path.join(f.directory, 'http.json'), httpBytes);
  config.admissions[0].evidence.find((p) => p.kind === 'http').sha256 = digest(httpBytes);
  await assert.rejects(
    validateAdmissions({ directory: f.directory, metadata, configuration: config }),
    /does not preserve the pinned original/,
  );
});

test('current source admission refuses a failed gate or borrowed source even with a fresh evidence pin', async (t) => {
  const f = await fixture(t),
    { metadata } = await loadCatalog(f.directory);
  const original = JSON.parse(await fs.readFile(path.join(f.directory, 'qualification.json')));
  for (const mutate of [
    (q) => (q.gates.find((row) => row.gate === 'test').exitCode = 1),
    (q) => (q.sourceRevision = 'b'.repeat(40)),
    (q) => (q.gates = q.gates.filter((row) => row.gate !== 'motion-syntax')),
  ]) {
    const q = structuredClone(original);
    mutate(q);
    const bytes = jsonBytes(q);
    await fs.writeFile(path.join(f.directory, 'qualification.json'), bytes);
    const configuration = structuredClone(f.configuration);
    configuration.currentSourceQualification.sha256 = digest(bytes);
    await assert.rejects(
      validateAdmissions({ directory: f.directory, metadata, configuration }),
      /Current source/,
    );
  }
});

test('v2 admits an explicit waiver with empty and 5 MiB generic evidence without claiming tests passed', async (t) => {
  const f = await fixture(t),
    { metadata } = await loadCatalog(f.directory),
    policyBytes = jsonBytes(waivedPolicy()),
    qualification = waivedQualification(f.configuration.currentVersion, policyBytes),
    bytes = jsonBytes(qualification),
    configuration = structuredClone(f.configuration);
  await fs.writeFile(path.join(f.directory, 'qualification.json'), bytes);
  configuration.currentSourceQualification.sha256 = digest(bytes);
  const result = await validateAdmissions({
    directory: f.directory,
    metadata,
    configuration,
    readSourceFile: async (revision, name) => {
      assert.equal(revision, qualification.sourceRevision);
      assert.equal(name, 'publishing/test-policy.json');
      return policyBytes;
    },
  });
  assert.equal(result.qualification.status, 'qualified-with-test-waiver');
  assert.deepEqual(result.qualification.tests, { status: 'waived', counts: null });
  assert.equal(Object.hasOwn(result.qualification, 'passed'), false);
  assert.deepEqual(
    result.qualification.evidencePins.slice(-2).map((pin) => pin.bytes),
    [0, 5 * 1024 * 1024],
  );

  const focusedQualification = structuredClone(qualification);
  delete focusedQualification.preMergeValidationCorroboration;
  focusedQualification.focusedAdmissionCorroboration = focusedAdmission(
    focusedQualification.sourceTree,
  );
  const focusedBytes = jsonBytes(focusedQualification);
  await fs.writeFile(path.join(f.directory, 'qualification.json'), focusedBytes);
  configuration.currentSourceQualification.sha256 = digest(focusedBytes);
  const focusedResult = await validateAdmissions({
    directory: f.directory,
    metadata,
    configuration,
    readSourceFile: async () => policyBytes,
  });
  assert.equal(
    focusedResult.qualification.focusedAdmissionCorroboration.fullTests.status,
    'waived-and-skipped',
  );
  assert.equal(
    focusedResult.qualification.focusedAdmissionCorroboration.genericBuild.status,
    'skipped-by-fast-release-policy',
  );
});

test('v2 refuses forged pass claims, failed mandatory gates, and missing or invalid policy', async (t) => {
  const f = await fixture(t),
    { metadata } = await loadCatalog(f.directory),
    policyBytes = jsonBytes(waivedPolicy()),
    original = waivedQualification(f.configuration.currentVersion, policyBytes);
  for (const [name, mutate, policy = policyBytes] of [
    ['forged pass', (q) => (q.passed = true)],
    ['fake counts', (q) => (q.tests.counts = { passed: 100, failed: 0 })],
    ['invented shards', (q) => (q.testShards = [])],
    ['failed gate', (q) => (q.gates[1].step.conclusion = 'failure')],
    [
      'forged gate exit code',
      (q) => {
        q.gates[1].exitCode = 0;
        q.gates[1].step.conclusion = 'failure';
      },
    ],
    ['missing gate', (q) => q.gates.pop()],
    ['test gate', (q) => (q.gates[2].gate = 'test')],
    ['substituted gate command', (q) => (q.gates[2].command = 'true')],
    ['missing waiver run evidence', (q) => delete q.waiverEvidence],
    [
      'oversized run evidence',
      (q) => {
        q.waiverEvidence.runEvidence.bytes = 4 * 1024 * 1024 + 1;
        q.evidencePins.find((pin) => pin.path === 'run.json').bytes = 4 * 1024 * 1024 + 1;
      },
    ],
    [
      'missing evidence pin',
      (q) => (q.evidencePins = q.evidencePins.filter((pin) => pin.path !== 'jobs.json')),
    ],
    [
      'oversized generic evidence',
      (q) =>
        q.evidencePins.push({
          path: 'too-large.bin',
          bytes: 64 * 1024 * 1024 + 1,
          sha256: '5'.repeat(64),
        }),
    ],
    [
      'failed PR validation',
      (q) => (q.preMergeValidationCorroboration.step.conclusion = 'failure'),
    ],
    ['missing artifact deferral', (q) => delete q.preMergeValidationCorroboration.artifactBuild],
    [
      'malformed PR source identity',
      (q) => (q.preMergeValidationCorroboration.sourceRevision = 'short'),
    ],
    [
      'ambiguous legacy and deferred PR proof',
      (q) =>
        (q.ordinaryBuildCorroboration = {
          command: 'npm run build',
          step: { status: 'completed', conclusion: 'success' },
        }),
    ],
    [
      'ambiguous focused and deferred PR proof',
      (q) => (q.focusedAdmissionCorroboration = focusedAdmission(q.sourceTree)),
    ],
    [
      'failed focused classification proof',
      (q) => {
        delete q.preMergeValidationCorroboration;
        q.focusedAdmissionCorroboration = focusedAdmission(q.sourceTree);
        q.focusedAdmissionCorroboration.classificationSteps[1].conclusion = 'failure';
      },
    ],
    [
      'focused proof for another source tree',
      (q) => {
        delete q.preMergeValidationCorroboration;
        q.focusedAdmissionCorroboration = focusedAdmission('d'.repeat(40));
      },
    ],
    [
      'incomplete frozen proof',
      (q) => (q.frozenArtifactCorroboration.allInnerZipManifestBytesVerified = false),
    ],
    ['mismatched frozen run', (q) => (q.frozenArtifactCorroboration.runId = 43)],
    ['missing policy pin', (q) => delete q.testPolicy.policyEvidence],
    ['wrong policy hash', (q) => (q.testPolicy.policyEvidence.sha256 = '0'.repeat(64))],
    ['required source policy', () => {}, jsonBytes({ ...waivedPolicy(), mode: 'required' })],
    [
      'oversized restoration',
      () => {},
      jsonBytes({ ...waivedPolicy(), restoration: 'r'.repeat(2001) }),
    ],
  ]) {
    const qualification = structuredClone(original);
    mutate(qualification);
    const bytes = jsonBytes(qualification),
      configuration = structuredClone(f.configuration);
    await fs.writeFile(path.join(f.directory, 'qualification.json'), bytes);
    configuration.currentSourceQualification.sha256 = digest(bytes);
    await assert.rejects(
      validateAdmissions({
        directory: f.directory,
        metadata,
        configuration,
        readSourceFile: async () => policy,
      }),
      undefined,
      name,
    );
  }
});

test('all retains more than 100 major-zero editions, their order and every original archive route', async (t) => {
  const historical = Array.from({ length: 101 }, (_, index) => `v0.61.${100 - index}`),
    versions = [...historical, 'v0.62.0'],
    f = await fixture(t, versions);
  f.configuration.retainedReleasesPerMajor = 'all';
  await f.write(path.join(f.directory, 'publication.json'), jsonBytes(f.configuration));
  const { metadata } = await loadCatalog(f.directory),
    retained = retainRecentMetadata(metadata, 'all');
  assert.deepEqual([...retained], [...metadata]); // Preserve input order and row identity.
  const admissions = await validateAdmissions({ ...f, metadata: retained });
  assert.deepEqual(admissions.admissions, f.configuration.admissions);
  const receipt = await assemble(f),
    index = JSON.parse(await fs.readFile(path.join(f.outputDirectory, 'releases/index.json'))),
    routing = JSON.parse(await fs.readFile(path.join(f.outputDirectory, 'archive-routing.json')));
  assert.equal(index.latest, 'v0.62.0');
  assert.deepEqual(
    index.releases.map((release) => release.version),
    ['v0.62.0', ...historical],
  );
  assert.equal(receipt.historicalBridges, 101);
  for (const version of historical) {
    const prefix = `releases/${version}/`,
      canonical = `https://mekhovov.github.io/revealline-archive-01/${prefix}site/`,
      release = index.releases.find((row) => row.version === version);
    assert.equal(release.canonicalPlay, canonical + 'game/');
    assert.equal(routing.canonicalSites[version], canonical);
    assert.equal(
      release.download,
      `https://github.com/mekhovov/revealline/releases/download/${version}/distribution.zip`,
    );
    for (const [outputName, originalName] of [
      ['release.json', 'release.json'],
      ['site/manifest.json', 'manifest.json'],
      ['site/distribution.zip.sha256', 'distribution.zip.sha256'],
    ])
      assert.deepEqual(
        await fs.readFile(path.join(f.outputDirectory, prefix + outputName)),
        await fs.readFile(path.join(f.directory, 'metadata', version, originalName)),
      );
    assert.ok(
      (
        await fs.readFile(path.join(f.outputDirectory, prefix + 'site/game/index.html'), 'utf8')
      ).includes(canonical + 'game/index.html'),
    );
  }
  // The oldest version still needs its authenticated archive, unlike numeric retirement.
  await assert.rejects(
    validateAdmissions({
      ...f,
      metadata: retained,
      configuration: { ...f.configuration, admissions: [] },
    }),
    /archive|historical/i,
  );
  const inventoryPath = path.join(f.directory, 'inventory.json'),
    inventory = JSON.parse(await fs.readFile(inventoryPath));
  inventory.files.find((row) => row.path === 'releases/v0.61.0/site/game/index.html').sha256 =
    '0'.repeat(64);
  const inventoryBytes = jsonBytes(inventory),
    httpPath = path.join(f.directory, 'http.json'),
    http = JSON.parse(await fs.readFile(httpPath));
  http.expectedInventorySha256 = digest(inventoryBytes);
  const httpBytes = jsonBytes(http);
  await f.write(inventoryPath, inventoryBytes);
  await f.write(httpPath, httpBytes);
  for (const pin of f.configuration.admissions[0].evidence) {
    if (pin.kind === 'inventory') pin.sha256 = digest(inventoryBytes);
    if (pin.kind === 'http') pin.sha256 = digest(httpBytes);
  }
  await assert.rejects(validateAdmissions({ ...f, metadata: retained }), /pinned original/);
});

test('numeric retention remains semantic and all does not admit invalid policies', async (t) => {
  const versions = ['v0.10.0', 'v1.1.0', 'v0.2.0', 'v1.0.9', 'v0.9.10'],
    metadata = new Map(versions.map((version) => [version, { version }]));
  assert.deepEqual([...retainRecentMetadata(metadata, 1).keys()], ['v0.10.0', 'v1.1.0']);
  assert.deepEqual([...retainRecentMetadata(metadata, 100)], [...metadata]);
  assert.deepEqual([...retainRecentMetadata(metadata, 'all')], [...metadata]);
  assert.throws(() => retainRecentMetadata(new Map([['invalid', {}]]), 'all'), /version/);
  const f = await fixture(t),
    { metadata: frozen } = await loadCatalog(f.directory);
  for (const value of [
    undefined,
    null,
    false,
    true,
    0,
    -1,
    101,
    1.5,
    NaN,
    Infinity,
    '100',
    'ALL',
    ' all',
    {},
    [],
  ]) {
    assert.throws(() => retainRecentMetadata(metadata, value), /retention policy/);
    await assert.rejects(
      validateAdmissions({
        ...f,
        metadata: frozen,
        configuration: { ...f.configuration, retainedReleasesPerMajor: value },
      }),
      /configuration/,
    );
  }
});

test('all leaves the 1024-catalog entry bound intact', async (t) => {
  const f = await fixture(t),
    catalogPath = path.join(f.directory, 'catalog.json'),
    catalog = JSON.parse(await fs.readFile(catalogPath));
  catalog.releases = Array.from({ length: 1025 }, () => catalog.releases[0]);
  await f.write(catalogPath, jsonBytes(catalog));
  await assert.rejects(loadCatalog(f.directory), /Invalid frozen catalog/);
});

test('128 independently pinned archives retain admission bounds and original-byte guards', async (t) => {
  assert.equal(MAX_ARCHIVE_SHARDS, 128);
  const versions = Array.from({ length: 128 }, (_, i) => `v0.${i + 1}.0`),
    f = await fixture(t, [...versions, 'v1.0.0']),
    { metadata } = await loadCatalog(f.directory),
    originalInventory = JSON.parse(await fs.readFile(path.join(f.directory, 'inventory.json'))),
    configuration = structuredClone(f.configuration),
    allocation = { formatVersion: 1, shards: [] };
  configuration.admissions = [];
  configuration.retainedReleasesPerMajor = 'all';
  for (const [index, version] of versions.entries()) {
    const id = `archive-${index + 1}`,
      repository = `mekhovov/revealline-${id}`,
      base = `https://mekhovov.github.io/revealline-${id}/`,
      inventory = {
        base,
        files: originalInventory.files.filter((row) => row.path.startsWith(`releases/${version}/`)),
      },
      inventoryBytes = jsonBytes(inventory),
      bytes = inventory.files.reduce((sum, row) => sum + row.bytes, 0),
      nativeBytes = Buffer.from(`Scoped native receipt for ${id} / ${version}.`),
      nativePin = { path: `${id}/native.txt`, sha256: digest(nativeBytes), kind: 'reference' },
      admission = {
        id,
        infrastructureCommit: 'e'.repeat(40),
        deploymentId: index + 1,
        evidence: [],
      },
      browserBytes = jsonBytes({
        format: 'revealline-archive-browser-admission.v1',
        status: 'PASS',
        archiveId: id,
        infrastructureCommit: admission.infrastructureCommit,
        deploymentId: admission.deploymentId,
        versions: [version],
        evidence: [nativePin],
      }),
      httpBytes = jsonBytes({
        status: 'PASS',
        base,
        files: inventory.files.length,
        expectedInventorySha256: digest(inventoryBytes),
        expectedBytes: bytes,
        verifiedBytes: bytes,
        failedFiles: 0,
        skipped: [],
      });
    allocation.shards.push({ id, repository, versions: [version] });
    for (const [name, body, kind] of [
      ['inventory.json', inventoryBytes, 'inventory'],
      ['http.json', httpBytes, 'http'],
      ['browser.json', browserBytes, 'browser'],
      ['native.txt', nativeBytes, 'reference'],
    ]) {
      const relative = `${id}/${name}`;
      admission.evidence.push({ path: relative, sha256: digest(body), kind });
      await f.write(path.join(f.directory, relative), body);
    }
    configuration.admissions.push(admission);
  }
  const allocationBytes = jsonBytes(allocation);
  await f.write(path.join(f.directory, 'allocations.json'), allocationBytes);
  configuration.allocationSha256 = digest(allocationBytes);
  const original = structuredClone(configuration);
  for (const count of [96, 97, 128]) {
    const scopedMetadata = new Map(
      [...metadata].filter(
        ([version]) => version === 'v1.0.0' || versions.slice(0, count).includes(version),
      ),
    );
    const admitted = await validateAdmissions({
      directory: f.directory,
      configuration: { ...configuration, admissions: configuration.admissions.slice(0, count) },
      metadata: scopedMetadata,
    });
    assert.equal(admitted.admissions.length, count);
    assert.equal(admitted.plan.shards.length, count);
    assert.equal(Object.keys(admitted.canonicalSites).length, count);
    for (const [index, version] of versions.slice(0, count).entries())
      assert.equal(
        admitted.canonicalSites[version],
        `https://mekhovov.github.io/revealline-archive-${index + 1}/releases/${version}/site/`,
      );
    assert.equal(admitted.canonicalSites['v1.0.0'], undefined);
  }
  assert.deepEqual(configuration, original);
  const validate = (config) =>
    validateAdmissions({ directory: f.directory, configuration: config, metadata });
  const overflow = structuredClone(configuration);
  overflow.admissions.push({ ...overflow.admissions.at(-1), id: 'archive-129' });
  await assert.rejects(validate(overflow), /Invalid Pages controller configuration/);
  for (const [mutate, expected] of [
    [(last) => (last.id = configuration.admissions[0].id), /Invalid archive admission/],
    [(last) => (last.evidence[0].sha256 = 'f'.repeat(64)), /evidence byte pin mismatch/],
    [(last) => (last.infrastructureCommit = 'f'.repeat(40)), /browser admission failed/],
    [
      (last) => (last.evidence = last.evidence.filter((pin) => pin.kind !== 'browser')),
      /incomplete/,
    ],
    [
      (last) => (last.evidence = Array.from({ length: 65 }, () => last.evidence[0])),
      /Invalid archive admission/,
    ],
  ]) {
    const changed = structuredClone(configuration);
    mutate(changed.admissions.at(-1));
    await assert.rejects(validate(changed), expected);
  }
  // Re-pinning a false HTTP report or inventory must not bypass the unchanged
  // 800 MB archive limit or the independently pinned original release bytes.
  const httpPath = 'archive-128/http.json',
    inventoryPath = 'archive-128/inventory.json',
    originalHTTP = JSON.parse(await fs.readFile(path.join(f.directory, httpPath))),
    originalLastInventory = JSON.parse(await fs.readFile(path.join(f.directory, inventoryPath)));
  const repin = async (config, relative, value) => {
    const bytes = jsonBytes(value);
    await f.write(path.join(f.directory, relative), bytes);
    config.admissions.at(-1).evidence.find((pin) => pin.path === relative).sha256 = digest(bytes);
    return digest(bytes);
  };
  const overBudget = structuredClone(configuration);
  await repin(overBudget, httpPath, {
    ...originalHTTP,
    expectedBytes: 800_000_001,
    verifiedBytes: 800_000_001,
  });
  await assert.rejects(validate(overBudget), /full-body admission failed/);
  const substituted = structuredClone(configuration);
  originalLastInventory.files.find((row) => row.path.endsWith('/game/icon.png')).sha256 =
    'f'.repeat(64);
  const inventorySha256 = await repin(substituted, inventoryPath, originalLastInventory);
  await repin(substituted, httpPath, { ...originalHTTP, expectedInventorySha256: inventorySha256 });
  await assert.rejects(validate(substituted), /does not preserve the pinned original/);
});
