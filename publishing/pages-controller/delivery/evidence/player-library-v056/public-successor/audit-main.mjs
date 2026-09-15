#!/usr/bin/env node
/** Cache-only read-only public audit; no generation, source builds or release writes. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { BASE, expectedTypes, inspect } from './http-engine.mjs';

export const HOME = path.dirname(fileURLToPath(import.meta.url));
export const SOURCE = '20f017963e6f3875ce6388a198a6fb601e0aea40';
export const TREE = 'b48ab534db3a202ee070802957944fa898d864ef';
export const VERSION = 'v0.56.0';
export const RETAINED_CATALOG_SHA = '8b27f33322a7291f127051a1a53ff3b5fafa60c29f4499a3c5d2c80023eac19d';
export const QUALIFICATION_SHA = '9f02b6c92499a9f88e1b874366d3719c6dfb878ff460e50b2800259b4af68cfc';
export const sha = (raw) => createHash('sha256').update(raw).digest('hex');
const encode = (value) => JSON.stringify(value, null, 2) + '\n';
const require = (ok, message) => { if (!ok) throw new Error(message); };
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const commit = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const positive = (value) => Number.isSafeInteger(value) && value > 0;

export function safePath(value) {
  require(typeof value === 'string' && value.length > 0 && value.length < 1024 &&
    !/[\\\x00-\x1f\x7f]/.test(value) &&
    value.split('/').every((part) => part && part !== '.' && part !== '..'), 'Unsafe inventory path.');
  // Encoding each path segment prevents queries, fragments, schemes and percent escapes from changing scope.
  const url = new URL(value.split('/').map(encodeURIComponent).join('/'), BASE);
  require(url.origin === 'https://mekhovov.github.io' && url.pathname.startsWith('/revealline/'),
    'Inventory escaped the approved public prefix.');
  return value;
}

export function validateRows(rows) {
  require(Array.isArray(rows) && rows.length > 0 && rows.length <= 20000, 'Invalid inventory size.');
  const found = new Set();
  for (const row of rows) {
    require(row && Object.keys(row).sort().join(',') === 'bytes,path,sha256', 'Unexpected inventory fields.');
    safePath(row.path);
    require(!found.has(row.path) && Number.isSafeInteger(row.bytes) && row.bytes >= 0 &&
      row.bytes <= 800_000_000 && sha256(row.sha256), 'Invalid or duplicate inventory row.');
    found.add(row.path);
    expectedTypes(row.path);
  }
  require(rows.reduce((n, r) => n + r.bytes, 0) <= 950_000_000, 'Main artifact exceeds the unchanged950MB cap.');
  return rows;
}

function rowEquals(actual, expected) {
  return actual && actual.bytes === expected.bytes && actual.sha256 === expected.sha256;
}

export function validateQualification(qualification) {
  require(qualification.format === 'revealline-source-qualification.v1' && qualification.version === VERSION &&
    qualification.passed === true && qualification.sourceRevision === SOURCE && qualification.sourceTree === TREE &&
    qualification.allTrackedSourceContentsAndModesMatch === true &&
    Array.isArray(qualification.gates) && qualification.gates.length === 6 &&
    new Set(qualification.gates.map((g) => g.gate)).size === 6 &&
    ['validate', 'lint', 'test', 'format', 'native-format', 'motion-syntax'].every((name) =>
      qualification.gates.some((g) => g.gate === name && g.step?.status === 'completed' && g.step?.conclusion === 'success')),
    'Exact frozen source qualification failed.');
}

/** Pure contract check. It validates declarations/identities, not subjective or browser claims. */
export function validateModels(binding, models, raws, retainedCatalog) {
  require(binding.format === 'revealline-final-main-public-binding.v1' && binding.base === BASE &&
    binding.currentVersion === VERSION && binding.gameSourceRevision === SOURCE && binding.qualifiedSourceTree === TREE &&
    commit(binding.controllerCommit) && commit(binding.controllerTree) && positive(binding.deploymentId) &&
    positive(binding.runId) && sha256(binding.inventorySha256), 'Binding identity differs.');
  const { receipt, deployment, statuses, run, manifest, record, qualification, catalog, configuration } = models;
  const catalogSha = binding.pins.catalog.sha256, manifestSha = binding.pins.manifest.sha256,
    recordSha = binding.pins.record.sha256, qualificationSha = binding.pins.qualification.sha256;
  require(sha(raws.catalog) === catalogSha && catalog.format === 'revealline-frozen-catalog.v1' &&
    catalog.sourceRepository === 'mekhovov/revealline' && Array.isArray(catalog.releases) &&
    catalog.releases.length >= retainedCatalog.releases.length + 1 && catalog.releases.length <= 1000 &&
    configuration.format === 'revealline-pages-controller.v1' && configuration.catalogSha256 === catalogSha &&
    configuration.currentVersion === VERSION && configuration.deploymentEnabled === true &&
    configuration.retainedReleasesPerMajor === 100 && configuration.testingRoutes &&
    typeof configuration.testingRoutes === 'object' && !Array.isArray(configuration.testingRoutes) &&
    Object.keys(configuration.testingRoutes).length === 0 &&
    configuration.currentSourceQualification?.sha256 === qualificationSha,
    'Pinned full-history publication policy differs; comparison routes require a new reviewed helper.');
  const versions = new Set();
  for (const entry of catalog.releases) {
    require(/^v\d+\.\d+\.\d+$/.test(entry.version) && !versions.has(entry.version) &&
      commit(entry.sourceRevision) && commit(entry.tagObject) &&
      ['recordSha256', 'manifestSha256', 'checksumSha256'].every((key) => sha256(entry[key])),
      'Invalid or duplicate frozen catalog entry.');
    versions.add(entry.version);
  }
  for (const old of retainedCatalog.releases) {
    const current = catalog.releases.find((entry) => entry.version === old.version);
    require(current && Object.keys(old).every((key) => current[key] === old[key]),
      'Previously retained frozen authority missing or rewritten: ' + old.version);
  }
  const current = catalog.releases.find((entry) => entry.version === VERSION);
  require(current?.sourceRevision === SOURCE && current.recordSha256 === recordSha &&
    current.manifestSha256 === manifestSha, 'Current release missing from exact pinned catalog.');
  const testingVersions = [];
  require(receipt.format === 'revealline-metadata-pages-artifact.v1' && receipt.currentVersion === VERSION &&
    receipt.gameSourceRevision === SOURCE && receipt.qualifiedSourceTree === TREE &&
    receipt.controllerCommit === binding.controllerCommit && receipt.controllerTree === binding.controllerTree &&
    receipt.publishable === true && receipt.browserAdmissionsRequired === true && receipt.budgetBytes === 950_000_000 &&
    receipt.catalogSha256 === catalogSha && receipt.configurationSha256 === sha(raws.configuration) &&
    receipt.historicalBridges === catalog.releases.length - 1 && receipt.testingVersions === 0,
    'Hosted artifact receipt is not the approved publishable controller/source.');
  const rows = validateRows(receipt.files);
  require(receipt.totalBytes === rows.reduce((n, r) => n + r.bytes, 0) &&
    binding.inventorySha256 === sha(Buffer.from(encode(rows))), 'Pinned complete artifact inventory differs.');
  require(deployment.id === binding.deploymentId && deployment.sha === binding.controllerCommit &&
    deployment.ref === 'main' && deployment.environment === 'github-pages' &&
    deployment.url === `https://api.github.com/repos/mekhovov/revealline/deployments/${binding.deploymentId}`,
    'Deployment identity is not the expected main controller.');
  require(Array.isArray(statuses) && statuses.length > 0 && statuses[0].state === 'success' &&
    statuses[0].deployment_url === deployment.url &&
    new URL(statuses[0].environment_url).href === BASE,
    'Latest pinned deployment status is not successful at approved main.');
  require(run.id === binding.runId && run.head_sha === binding.controllerCommit && run.head_branch === 'main' &&
    run.status === 'completed' && run.conclusion === 'success' && ['push', 'workflow_dispatch'].includes(run.event) &&
    run.path === '.github/workflows/publish-frozen-pages.yml' &&
    run.html_url === `https://github.com/mekhovov/revealline/actions/runs/${binding.runId}`,
    'Expected main publication run did not succeed.');
  const expectedRun = `https://github.com/mekhovov/revealline/actions/runs/${binding.runId}`;
  require(statuses[0].log_url === expectedRun || statuses[0].log_url?.startsWith(expectedRun + '/') ||
    String(deployment.payload?.workflow_run_id) === String(binding.runId), 'Deployment/run linkage is missing.');
  require(sha(raws.manifest) === manifestSha && sha(raws.record) === recordSha &&
    sha(raws.qualification) === qualificationSha, 'Pinned frozen source authority changed.');
  require(manifest.formatVersion === 1 && manifest.version === VERSION && manifest.sourceRevision === SOURCE &&
    record.formatVersion === 1 && sha256(record.sourceArchiveSha256) && record.version === VERSION && record.sourceRevision === SOURCE && record.manifestSha256 === manifestSha &&
    sha256(record.distributionSha256), 'Original source metadata identity differs.');
  const manifestRows = validateRows(manifest.files);
  require(manifest.totalBytes === manifestRows.reduce((n, r) => n + r.bytes, 0),
    'Frozen manifest byte count differs.');
  require(qualificationSha === QUALIFICATION_SHA, 'Reviewed v056 qualification pin differs.');
  validateQualification(qualification);
  const byPath = new Map(rows.map((r) => [r.path, r]));
  const prefix = `releases/${VERSION}/site/`;
  const marker = Buffer.from('{\n  "tool": "xonix-game-cli",\n  "formatVersion": 1\n}\n');
  const checksum = Buffer.from(record.distributionSha256 + '  distribution.zip\n');
  require(current.checksumSha256 === sha(checksum), 'Catalog distribution checksum differs.');
  const original = [...manifestRows,
    { path: 'manifest.json', bytes: raws.manifest.length, sha256: manifestSha },
    { path: '.xonix-build.json', bytes: marker.length, sha256: sha(marker) },
    { path: 'distribution.zip.sha256', bytes: checksum.length, sha256: sha(checksum) }];
  validateRows(original); // Reject duplicate authority paths, including reserved originals.
  for (const row of original)
    require(rowEquals(byPath.get(prefix + row.path), row), 'Canonical current byte missing or changed: ' + row.path);
  require(rows.filter((r) => r.path.startsWith(prefix)).length === original.length,
    'Unexpected canonical current body.');
  require(rowEquals(byPath.get(`releases/${VERSION}/release.json`), { bytes: raws.record.length, sha256: recordSha }),
    'Canonical current release record differs.');
  const observedVersions = [...new Set(rows.filter((r) => /^releases\/v[^/]+\//.test(r.path))
    .map((r) => r.path.split('/')[1]))].sort();
  const catalogVersions = catalog.releases.map((r) => r.version).sort();
  require(JSON.stringify(observedVersions) === JSON.stringify(catalogVersions),
    'Main edition paths differ from exact pinned catalog.');
  for (const entry of catalog.releases)
    require(byPath.get(`releases/${entry.version}/release.json`)?.sha256 === entry.recordSha256,
      'Frozen catalog release record missing or changed: ' + entry.version);
  for (const name of ['release.json', 'game/build-info.json', 'game/index.html', 'manifest.json', 'service-worker.js',
    '.nojekyll', '.xonix-build.json', 'archive-routing.json', 'releases/index.html', 'releases/index.json'])
    require(byPath.has(name), 'Required current graph/alias/worker missing: ' + name);
  const criticalPaths = ['release.json', 'game/build-info.json', 'game/index.html', 'manifest.json',
    `releases/${VERSION}/release.json`, ...['game/build-info.json', 'game/index.html', 'manifest.json'].map((n) => prefix + n)];
  require(criticalPaths.every((p) => byPath.has(p)), 'Critical identity entry absent.');
  return { rows, criticalPaths, catalogVersions, testingVersions,
    hiddenFiles: rows.filter((r) => r.path.split('/').some((p) => p.startsWith('.'))).map((r) => r.path) };
}

async function ordinaryTree(target, boundary) {
  const absolute = path.resolve(target), base = path.resolve(boundary);
  require(absolute === base || absolute.startsWith(base + path.sep), 'File escaped cache authority.');
  let current = base;
  require((await fs.lstat(base)).isDirectory() && !(await fs.lstat(base)).isSymbolicLink() &&
    await fs.realpath(base) === base, 'Nonordinary or symlinked authority root.');
  for (const part of path.relative(base, absolute).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    require(!(await fs.lstat(current)).isSymbolicLink(), 'Symlink authority component.');
  }
  return absolute;
}

async function readSmall(file, boundary, limit = 16_000_000) {
  await ordinaryTree(file, boundary);
  const stat = await fs.lstat(file);
  require(stat.isFile() && stat.size <= limit, 'Authority must be a bounded ordinary file.');
  return fs.readFile(file);
}

export async function loadAuthority(bindingFile, bindingSha, { home = HOME } = {}) {
  require(sha256(bindingSha), 'Explicit reviewed binding SHA256 required.');
  const inputRoot = path.join(home, 'inputs');
  await ordinaryTree(inputRoot, home);
  const retainedFile = path.join(home, 'retained-catalog.json');
  const retainedRaw = await readSmall(retainedFile, home);
  require(sha(retainedRaw) === RETAINED_CATALOG_SHA, 'Retained catalog authority changed.');
  const retainedCatalog = JSON.parse(retainedRaw);
  const raw = await readSmall(bindingFile, inputRoot, 64_000);
  require(sha(raw) === bindingSha, 'Binding SHA changed.');
  const binding = JSON.parse(raw), models = {}, raws = {};
  const names = ['receipt', 'deployment', 'statuses', 'run', 'manifest', 'record', 'qualification', 'catalog', 'configuration'];
  require(binding.pins && Object.keys(binding.pins).sort().join(',') === [...names].sort().join(','),
    'Exactly nine pinned authority files required.');
  const reads = [{ file: path.resolve(bindingFile), sha256: bindingSha }];
  const seenPins = new Set([path.basename(bindingFile)]);
  for (const name of names) {
    const pin = binding.pins[name];
    require(pin && /^[a-z0-9][a-z0-9.-]*\.json$/.test(pin.path) && positive(pin.bytes) &&
      pin.bytes <= 16_000_000 && sha256(pin.sha256), 'Invalid authority pin: ' + name);
    require(!seenPins.has(pin.path), 'Duplicate authority file path: ' + pin.path);
    seenPins.add(pin.path);
    const file = path.join(path.dirname(bindingFile), pin.path);
    raws[name] = await readSmall(file, inputRoot);
    require(raws[name].length === pin.bytes && sha(raws[name]) === pin.sha256, 'Pinned authority changed: ' + name);
    models[name] = JSON.parse(raws[name]); reads.push({ file, sha256: pin.sha256 });
  }
  const result = validateModels(binding, models, raws, retainedCatalog);
  return { ...result, binding, bindingSha, models, reads };
}

export function isTransient(row) {
  return row.transportError === true || row.status === 429 || row.status >= 500;
}

/** Each execution starts fresh; failed rows are never relabeled by a later run. */
export async function auditRows(rows, { inspectImpl = inspect, append = async () => {}, delay =
  (ms) => new Promise((resolve) => setTimeout(resolve, ms)), progress = () => {} } = {}) {
  const results = [], attempts = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(8, rows.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= rows.length) return;
      let row;
      for (let attempt = 1; attempt <= 3; attempt++) {
        row = await inspectImpl(rows[index], attempt);
        require(row.path === rows[index].path && row.attempt === attempt, 'Inspection ownership changed.');
        attempts.push(row); await append('attempts.jsonl', row);
        if (row.ok || !isTransient(row) || attempt === 3) break;
        const serverDelay = /^\d+$/.test(row.retryAfter || '') ? Number(row.retryAfter) * 1000 : 0;
        await delay(Math.min(60_000, Math.max(attempt * 2000, serverDelay)));
      }
      results.push(row); const completed = results.length;
      await append('results.jsonl', row); progress(completed, rows.length);
    }
  }));
  return { results, attempts };
}

export async function execute({ bindingFile, bindingSha, mode, runName }, { home = HOME,
  inspectImpl = inspect, delay, stdout = (s) => process.stdout.write(s) } = {}) {
  require(['check', 'critical', 'full'].includes(mode), 'Explicit check/critical/full mode required.');
  require(mode === 'check' ? !runName : /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(runName || ''),
    'Use a unique bounded run name; --check has no output directory.');
  const authority = await loadAuthority(bindingFile, bindingSha, { home });
  const { binding, models, hiddenFiles } = authority;
  const identity = { base: BASE, currentVersion: VERSION, gameSourceRevision: SOURCE, qualifiedSourceTree: TREE,
    controllerCommit: binding.controllerCommit, controllerTree: binding.controllerTree,
    deploymentId: binding.deploymentId, runId: binding.runId, bindingSha256: bindingSha,
    artifactReceiptSha256: binding.pins.receipt.sha256, expectedInventorySha256: binding.inventorySha256,
    configurationSha256: binding.pins.configuration.sha256, catalogSha256: binding.pins.catalog.sha256,
    visibleFrozenVersions: authority.catalogVersions, comparisonOnlyVersions: authority.testingVersions };
  if (mode === 'check') {
    const report = { status: 'PREPARED_AUTHORITY_ONLY', ...identity, files: authority.rows.length,
      expectedBytes: models.receipt.totalBytes, hiddenFiles, networkRequests: 0,
      outputWrites: 0, publicAcceptance: false };
    stdout(encode(report)); return report;
  }
  const runs = path.join(home, 'runs'); await fs.mkdir(runs, { recursive: true });
  await ordinaryTree(runs, home);
  const output = path.join(runs, runName); await fs.mkdir(output); // Exclusive; never overwrite earlier evidence.
  const startedAt = new Date().toISOString();
  let chain = Promise.resolve();
  const append = (file, row) => { chain = chain.then(() => fs.appendFile(path.join(output, file), JSON.stringify(row) + '\n')); return chain; };
  const pins = await Promise.all(['audit-main.mjs', 'http-engine.mjs', 'retained-catalog.json'].map(async (name) =>
    ({ file: path.join(HOME, name), sha256: sha(await fs.readFile(path.join(HOME, name))) })));
  try {
    const rows = mode === 'critical' ? authority.rows.filter((r) => authority.criticalPaths.includes(r.path)) : authority.rows;
    await fs.writeFile(path.join(output, 'inventory.json'), encode({ ...identity, fullInventory: authority.rows,
      selectedPaths: rows.map((r) => r.path), hiddenFiles, mode }), { flag: 'wx' });
    let last = 0;
    const { results, attempts } = await auditRows(rows, { inspectImpl, append, delay,
      progress: (done, total) => { if (Date.now() - last > 2000 || done === total) {
        last = Date.now(); process.stderr.write(`${done}/${total} bodies completed (${mode})\n`);
      } } });
    await chain;
    const changed = [];
    for (const pin of [...authority.reads, ...pins]) {
      try {
        const boundary = authority.reads.includes(pin) ? path.join(home, 'inputs') : HOME;
        if (sha(await readSmall(pin.file, boundary)) !== pin.sha256) changed.push(pin.file);
      }
      catch { changed.push(pin.file); }
    }
    const failed = results.filter((r) => !r.ok);
    const full = mode === 'full', ok = !failed.length && !changed.length && results.length === rows.length;
    const report = { status: ok ? (full ? 'PASS' : 'PARTIAL_CRITICAL_PASS') : 'FAIL', ...identity,
      startedAt, finishedAt: new Date().toISOString(), mode, fullInventoryFiles: authority.rows.length,
      files: rows.length, completedFiles: results.length, expectedBytes: rows.reduce((n, r) => n + r.bytes, 0),
      verifiedBytes: results.filter((r) => r.ok).reduce((n, r) => n + r.bytes, 0), failedFiles: failed.length,
      retries: attempts.length - rows.length, skipped: [], uninspectedFiles: authority.rows.length - rows.length,
      allArtifactBodiesVerified: full && ok, criticalBrowserSmokeMayStart: mode === 'critical' && ok,
      concurrency: 8, requestTimeoutMs: 300000, attemptsPerBody: 3, sourcePinsUnchanged: !changed.length,
      changedAuthorities: changed, failures: failed, runnerPins: pins,
      rootGraphAndAliasesAndWorkersIncluded: full, retainedHistoricalBridgesIncluded: full,
      publicBrowserAcceptance: false, boundaries: 'Decoded HTTP bodies and required MIME only. Critical mode is partial; even a full pass does not prove browser play, offline, storage, migration or physical-device behavior. Pinned deployment snapshots are historical evidence, not a live API polling claim.' };
    await fs.writeFile(path.join(output, 'report.json'), encode(report), { flag: 'wx' }); stdout(encode(report)); return report;
  } catch (error) {
    await chain.catch(() => {});
    await fs.writeFile(path.join(output, 'fatal.json'), encode({ status: 'FAIL', ...identity, startedAt,
      finishedAt: new Date().toISOString(), error: `${error.name}: ${error.message}` }), { flag: 'wx' });
    throw error;
  }
}

async function main() {
  const options = {}; const args = process.argv.slice(2);
  while (args.length) {
    const key = args.shift();
    require(['--binding', '--binding-sha', '--out', '--check', '--critical'].includes(key) && !(key in options), 'Invalid/duplicate argument.');
    options[key] = ['--check', '--critical'].includes(key) ? true : args.shift();
  }
  require(options['--binding'] && options['--binding-sha'] && !(options['--check'] && options['--critical']),
    'Usage: node audit-main.mjs --binding inputs/FINAL/binding.json --binding-sha SHA256 [--check | --critical --out NEW_NAME | --out NEW_NAME]');
  const report = await execute({ bindingFile: path.resolve(options['--binding']), bindingSha: options['--binding-sha'],
    mode: options['--check'] ? 'check' : options['--critical'] ? 'critical' : 'full', runName: options['--out'] });
  if (report.status === 'FAIL') process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(error.message); process.exitCode = 1;
});
