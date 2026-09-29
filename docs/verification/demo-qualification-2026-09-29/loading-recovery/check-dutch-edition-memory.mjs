/** Read-only package composition. Writes only the small receipt beside this script. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  collectEditionEngineFiles,
  collectEditionSelectedFiles,
  compileEdition,
  editionCodeDependencies,
  validateEditionCodeClosure,
} from '../../../../scripts/compile-edition.mjs';
import { editionMenuSceneResources } from '../../../../scripts/edition-runtime.mjs';
import { DEMO_LIBRARY_LIMITS } from '../../../../game/demo-library.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const expectedRevision = '55c5ec57cc1ed478b44e065951073c0bdd3c3ead';
const editionId = 'droneaid-nl-community';
const receiptURL = new URL('./dutch-edition-memory.json', import.meta.url);
const startedAt = new Date().toISOString();
const started = performance.now();
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (name) => fs.readFile(path.join(root, name));
const readJSON = async (name) => JSON.parse(await read(name));
const assertCleanInputs = () => {
  assert.equal(git('rev-parse', 'HEAD'), expectedRevision);
  assert.equal(
    git(
      'diff',
      '--name-only',
      'HEAD',
      '--',
      'game',
      'scripts',
      'publishing',
      'authoring',
      'package.json',
    ),
    '',
    'Tracked compilation inputs must still match the named revision.',
  );
};
assertCleanInputs();
const [catalog, { version }, engine] = await Promise.all([
  readJSON('game/editions/catalog.json'),
  readJSON('package.json'),
  collectEditionEngineFiles({ root }),
]);
assert.ok(catalog.editions.some((edition) => edition.id === editionId));
const selected = await collectEditionSelectedFiles({
  catalog,
  editionIds: [editionId],
  read,
});
const inputs = new Map([...engine, ...selected]);
const inputInventory = [...inputs]
  .map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) }))
  .sort((a, b) => a.path.localeCompare(b.path));
const result = await compileEdition({
  catalog,
  editionIds: [editionId],
  files: inputs,
  enginePaths: [...engine.keys()],
  version,
  sourceRevision: expectedRevision,
  offline: { basePath: '/' },
});
validateEditionCodeClosure(result.files);
assert.deepEqual(
  result.runtimeCatalog.editions.map((edition) => edition.id),
  [editionId],
);
assert.equal(result.runtimeCatalog.campaigns.length, 6);
const offline = JSON.parse(result.files.get('offline-cache.json'));
assert.equal(offline.editionId, editionId);
assert.equal(offline.version, version);
assert.ok(offline.files.length <= 2000);
assert.ok(offline.totalBytes <= 64 * 1024 * 1024);
assert.equal(
  offline.totalBytes,
  offline.files.reduce((total, file) => total + file.bytes, 0),
);
const offlineByPath = new Map(offline.files.map((file) => [file.path, file]));
assert.equal(offlineByPath.size, offline.files.length);
for (const row of offline.files) {
  const bytes = result.files.get(row.path);
  assert.ok(bytes, `Offline inventory is missing bytes for ${row.path}.`);
  assert.equal(bytes.length, row.bytes, row.path);
  assert.equal(hash(bytes), row.sha256, row.path);
}
const required = [
  'game/demo-loading.mjs',
  'game/demo-catalog.mjs',
  'game/demo-director.mjs',
  'game/demo-sources.mjs',
  'game/demo-library.mjs',
  'game/ui/demo-host.mjs',
  'game/ui/demo.css',
  'game/demo-bot-worker.mjs',
  'game/demo-data/catalog.json',
  ...editionMenuSceneResources([editionId]),
];
const requiredInventory = [];
for (const name of required) {
  assert.ok(result.files.has(name), `Compiled package omits ${name}.`);
  assert.ok(offlineByPath.has(name), `Offline package omits ${name}.`);
  const bytes = result.files.get(name);
  assert.equal(hash(bytes), hash(await read(name)), `Source bytes changed for ${name}.`);
  requiredInventory.push(offlineByPath.get(name));
}
const loadingEdges = [];
for (const name of ['game/demo-catalog.mjs', 'game/demo-director.mjs', 'game/demo-sources.mjs']) {
  assert.ok(
    editionCodeDependencies(name, result.files.get(name)).includes('game/demo-loading.mjs'),
  );
  loadingEdges.push({ from: name, to: 'game/demo-loading.mjs' });
}
assert.equal(DEMO_LIBRARY_LIMITS.bytes, 32 * 1024 * 1024);
const html = result.files.get('game/index.html').toString();
assert.ok(!html.includes('__REVEALLINE_VERSION__'));
assert.ok(html.includes(`data-build-version="${version}"`));
const runtimeInventory = JSON.parse(result.files.get('runtime-dependencies.json'));
assert.equal(runtimeInventory.entry, 'game/company.html');
assert.equal(runtimeInventory.canonicalEntry, 'game/index.html');
assertCleanInputs();
const receipt = {
  format: 'revealline-dutch-edition-memory-verification.v1',
  status: 'passed',
  releaseAdmitted: false,
  sourceRevision: expectedRevision,
  version,
  editionId,
  startedAt,
  finishedAt: new Date().toISOString(),
  elapsedSeconds: (performance.now() - started) / 1000,
  command:
    'node docs/verification/demo-qualification-2026-09-29/loading-recovery/check-dutch-edition-memory.mjs',
  execution:
    'Production edition compiler and offline generator; all package bytes retained only in memory.',
  inputs: {
    engineFiles: engine.size,
    selectedFiles: selected.size,
    uniqueFiles: inputInventory.length,
    totalBytes: inputInventory.reduce((total, row) => total + row.bytes, 0),
    inventorySha256: hash(JSON.stringify(inputInventory)),
    catalogSha256: hash(await read('game/editions/catalog.json')),
  },
  compiled: {
    files: result.files.size,
    totalBytes: [...result.files.values()].reduce((total, bytes) => total + bytes.length, 0),
    editionIds: result.runtimeCatalog.editions.map((edition) => edition.id),
    campaignIds: result.runtimeCatalog.campaigns.map((campaign) => campaign.id),
    manifestSha256: hash(result.files.get('edition-build.json')),
    runtimeDependenciesSha256: hash(result.files.get('runtime-dependencies.json')),
    completeCodeClosureValidated: true,
  },
  offline: {
    files: offline.files.length,
    fileLimit: 2000,
    totalBytes: offline.totalBytes,
    byteLimit: 64 * 1024 * 1024,
    remainingBytes: 64 * 1024 * 1024 - offline.totalBytes,
    inventorySha256: hash(result.files.get('offline-cache.json')),
    serviceWorkerSha256: hash(result.files.get('service-worker.js')),
    allInventoryBytesAndHashesVerified: true,
  },
  demoLibraryByteLimit: DEMO_LIBRARY_LIMITS.bytes,
  loadingEdges,
  exactSourceAndOfflineFiles: requiredInventory,
  outputWritten: [path.relative(root, fileURLToPath(receiptURL))],
  limitations: [
    'No compiled package, ZIP, native stage, or large output tree was written.',
    'No network, installation, browser, service-worker execution, Worker soak, or device check was performed.',
    'This is local package composition and closure evidence, not public release admission or offline disk durability.',
  ],
};
await fs.writeFile(receiptURL, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(
  JSON.stringify({
    status: receipt.status,
    editionId,
    files: receipt.compiled.files,
    offlineFiles: receipt.offline.files,
    offlineBytes: receipt.offline.totalBytes,
    remainingBytes: receipt.offline.remainingBytes,
    elapsedSeconds: receipt.elapsedSeconds,
    receipt: path.relative(root, fileURLToPath(receiptURL)),
  }),
);
