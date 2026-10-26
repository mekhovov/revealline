import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { mainRepositoryRoutes, requireMainRepositoryPolicy } from './main-repository-policy.mjs';
import { metadataBridges } from './metadata.mjs';
import { publishedReleaseIndex } from './catalog.mjs';

const read = (name) => fs.readFile(new URL(name, import.meta.url));
async function inputs() {
  const configuration = JSON.parse(await read('./publication.json'));
  const allocationBytes = await read('./allocations.json');
  const metadata = new Map(
    ['v1.0.0', 'v1.1.0'].map((version) => [version, { record: { version } }]),
  );
  return { configuration, allocationBytes, metadata };
}

test('retired frozen configuration has no admitted releases or external routes', async () => {
  const { configuration, allocationBytes } = await inputs();
  assert.equal(configuration.deploymentEnabled, false);
  assert.equal(configuration.currentSourceQualification, null);
  assert.deepEqual(JSON.parse(await read('./catalog.json')).releases, []);
  assert.deepEqual(JSON.parse(allocationBytes), { formatVersion: 1, shards: [] });
  assert.deepEqual(configuration.admissions, []);
  assert.deepEqual(configuration.testingRoutes, {});
});

test('new main-repository metadata cannot revive a retired external archive', async () => {
  const { configuration, allocationBytes, metadata } = await inputs();
  configuration.currentVersion = 'v1.1.0';
  const before = JSON.stringify(configuration);
  const result = mainRepositoryRoutes(configuration, allocationBytes, metadata);
  assert.deepEqual(result.downloadOnlyVersions, ['v1.0.0']);
  assert.deepEqual(result.plan, { formatVersion: 1, shards: [] });
  assert.deepEqual(result.canonicalSites, {});
  assert.deepEqual(result.admissions, []);
  assert.equal(JSON.stringify(configuration), before);
  configuration.currentVersion = 'v1.0.0';
  assert.deepEqual(
    mainRepositoryRoutes(configuration, allocationBytes, metadata).downloadOnlyVersions,
    ['v1.1.0'],
  );
});

test('retired allocations, admissions and changes to the empty registry fail closed', async () => {
  const { configuration, allocationBytes, metadata } = await inputs();
  for (const mutate of [
    (c) => c.admissions.push({ id: 'archive-100', deploymentId: 1, evidence: [] }),
    (c) => {
      c.allocationSha256 = '0'.repeat(64);
    },
  ]) {
    const changed = structuredClone(configuration);
    mutate(changed);
    assert.throws(
      () => mainRepositoryRoutes(changed, allocationBytes, metadata),
      /registry is frozen/,
    );
  }
  assert.throws(
    () =>
      mainRepositoryRoutes(
        configuration,
        Buffer.concat([allocationBytes, Buffer.from(' ')]),
        metadata,
      ),
    /registry is frozen/,
  );
  const changed = Buffer.from(
    JSON.stringify({
      formatVersion: 1,
      shards: [
        { id: 'archive-100', repository: 'mekhovov/revealline-archive-100', versions: ['v1.0.0'] },
      ],
    }),
  );
  assert.throws(() => mainRepositoryRoutes(configuration, changed, metadata), /registry is frozen/);
});

test('active publisher requires the main policy and forbids testing archive routes', async () => {
  const { configuration, allocationBytes, metadata } = await inputs();
  assert.throws(() => requireMainRepositoryPolicy({}), /main-repository-only/);
  assert.throws(
    () => requireMainRepositoryPolicy({ hostingPolicy: 'archives' }),
    /main-repository-only/,
  );
  configuration.testingRoutes['v1.0.0'] =
    'https://mekhovov.github.io/revealline-archive-100/releases/v1.0.0/site/';
  assert.throws(
    () => mainRepositoryRoutes(configuration, allocationBytes, metadata),
    /already accepted/,
  );
});

function oldMetadata() {
  return {
    record: { version: 'v0.141.6' },
    manifest: {
      files: [
        { path: 'index.html' },
        { path: 'game/index.html' },
        { path: 'authoring/studio/index.html' },
        { path: 'service-worker.js' },
        { path: 'game/app.mjs' },
      ],
    },
    manifestBytes: Buffer.from('original manifest\n'),
    checksumBytes: Buffer.from('original checksum\n'),
  };
}
test('download landings preserve original evidence without inventing historical runtime bodies', () => {
  const metadata = oldMetadata(),
    before = structuredClone(metadata);
  const files = metadataBridges(metadata, undefined);
  assert.equal(files.size, 6);
  for (const name of ['index.html', 'game/index.html', 'authoring/studio/index.html']) {
    const html = files.get(name).toString();
    assert.match(
      html,
      /https:\/\/github.com\/mekhovov\/revealline\/releases\/download\/v0.141.6\/distribution.zip/,
    );
    assert.doesNotMatch(html, /http-equiv="refresh"|<script|revealline-archive/);
    assert.match(html, /not hosted as a separate website/);
  }
  assert.deepEqual(files.get('manifest.json'), metadata.manifestBytes);
  assert.deepEqual(files.get('distribution.zip.sha256'), metadata.checksumBytes);
  assert.equal(files.has('game/app.mjs'), false);
  assert.deepEqual(structuredClone(metadata), before);
});

test('historical download worker unregisters only on normal activation without cache or client mutation', async () => {
  const code = metadataBridges(oldMetadata()).get('service-worker.js').toString();
  const listeners = new Map();
  let unregisters = 0,
    completion;
  vm.runInNewContext(code, {
    self: {
      addEventListener: (name, callback) => listeners.set(name, callback),
      registration: {
        unregister: async () => {
          unregisters++;
          return true;
        },
      },
    },
  });
  assert.deepEqual([...listeners.keys()], ['activate']);
  assert.equal(unregisters, 0);
  listeners.get('activate')({
    waitUntil: (promise) => {
      completion = promise;
    },
  });
  await completion;
  assert.equal(unregisters, 1);
  assert.doesNotMatch(code, /skipWaiting|clients|caches|localStorage|indexedDB|fetch|navigate/);
});

test('catalog differentiates local current Play, retained legacy Play and main-repository Download only', () => {
  const records = ['v0.141.5', 'v0.141.6', 'v0.142.0'].map((version) => ({
    version,
    play: version + '/site/game/',
    sourceRevision: 'a'.repeat(40),
  }));
  const original = structuredClone(records);
  const index = publishedReleaseIndex(
    records,
    'mekhovov/revealline',
    'v0.142.0',
    { 'v0.141.5': 'https://mekhovov.github.io/revealline-archive-99/releases/v0.141.5/site/' },
    { hostingPolicy: 'main-repository-only' },
  );
  assert.deepEqual(records, original);
  assert.equal(index.json.releases[1].play, null);
  assert.equal(index.json.releases[1].availability, 'download-only');
  assert.match(index.html, /href=".\/v0.142.0\/site\/game\/"/);
  assert.match(index.html, /revealline-archive-99\/releases\/v0.141.5\/site\/game\//);
  assert.doesNotMatch(index.html, /href=".\/v0.141.6\/site\/game\/"|href=".\/null"/);
  assert.equal((index.html.match(/>Play<\/a>/g) || []).length, 2);
  assert.equal((index.html.match(/>Download ZIP<\/a>/g) || []).length, 3);
});
