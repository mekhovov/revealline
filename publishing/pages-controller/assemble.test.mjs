import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assemble, loadCatalog, validateAdmissions } from './assemble.mjs';
import { digest, jsonBytes, retainRecentMetadata } from './metadata.mjs';

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
  return { directory, currentSite, outputDirectory, configuration, records, write };
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
  assert.ok(receipt.totalBytes < 950_000_000);
  await assert.rejects(assemble(f), /EEXIST/);
  assert.equal(
    await fs.readFile(
      path.join(f.outputDirectory, 'releases/v0.44.0/site/game/index.html'),
      'utf8',
    ),
    'game v0.44.0',
  );
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
  await assert.rejects(assemble(f), /mismatched/);
  await assert.rejects(fs.access(f.outputDirectory));
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
