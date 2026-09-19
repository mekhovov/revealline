#!/usr/bin/env node
/** Cache-only read-only public audit; no generation, source builds or release writes. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { BASE, expectedTypes, inspect } from './http-engine.mjs';
import { summarizeCatalogCohorts } from './catalog-cohorts.mjs';

export const HOME = path.dirname(fileURLToPath(import.meta.url));
export const SOURCE = '8ae70850db00777eb9afb233ff8a881fc26714f0';
export const TREE = '3b52b721c2000b316bcc52a3132d011703089888';
export const VERSION = 'v0.64.1';
export const RETAINED_CATALOG_SHA = '7fe38250a9d213d78288d5d0eb97a5c9d7d2b177664ee5f6e4dc74804fae3ec8';
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


const RETAINED_ADMISSION_SHA256 = {
  "archive-01": "30ecd1276921fd8732ef79360d010dd92a0b3cc153a687b959d9147dbac3f355",
  "archive-02": "5f59ba78503d84a56f5753f41bf701d0e15aa268e5536126e1aaf5f4c58e7126",
  "archive-03": "ce9470a95a86eba74da449b610ca175d98eec98af9dc602413d7f38a04f401a8",
  "archive-04": "82567ad621d6b001884b0c745c493e7363294f911f8ee1db57753fad22d54a24",
  "archive-05": "66d5f72e0e90718cfe970f639c981246b5f644961c84cc04119e9410000baddc",
  "archive-06": "a29ba86d4afdda2b25de2a84706279b308221c836d380a9a35b2068f36503719",
  "archive-07": "7016c3000e0074d5178a9f0a18182f4fb5a5c153a32beab7b41c39603e7cbce5",
  "archive-08": "ff99b6c3ae4dd23061ce484f744a8247af7ed16456e0cb82b115b5e406125a1b",
  "archive-09": "2946bdb6bc3afa46a6acd6d95317bbe1ddf2dd0c9f0a4e4debf0dee0e029df55",
  "archive-10": "8b2008414e19d2acc93669a22f9a3b6d9ba576e0d6c6e4bbdc8cfe4c49f5c04d",
  "archive-11": "b0e18fd78ed49316b0b592227595ee6818b0c14df848f811ba6247a295a7a882",
  "archive-12": "09972ec3765a3f4879922531f509500bc99af9c659dcb42d1b26582ccdc57a97",
  "archive-13": "a3d5908253b1ea0aa96b18511bcaccdd4b9b6cbc5ea6b6f49511d5fe96d6d514",
  "archive-14": "53d47425ed438415a219b27dafa9560c1e996edde4beeb78c50db1938f7dc2b5",
  "archive-15": "4399f1159fa061be901feb0c7ec1e95b3aa50bffbbe9a96ee046756494ccf83a",
  "archive-16": "70a00a1e4126d318eeff13ff0d83082db63c20a562572f26c965c971608c9368",
  "archive-17": "7e4c116dcc6daceceac581e0a0846c4eee7d7506867ceb483101f67f241937b4",
  "archive-18": "c85240000b5f1c106cb9d5f59a93c99b4ab374464ba90b047518763379c4e4db",
  "archive-19": "0f06646c4062ce36fd2917e8f7c8cc5284218b8313d30ef96835cbf248a0a4e2",
  "archive-20": "06eaa05114a4af57fffc0d656af0fefd41355440a6af3fedda25c249b059fcf7",
  "archive-21": "79056c153626a68ce31ed45a000746808917deb69b08ba644f4944d65406cd8b",
  "archive-22": "62c890cef104f7f7de313648dd00e0ed5f57b38041487b1581684b3858bf88d9",
  "archive-23": "b181d91fb47fa88ced61fb7a087ef569db06c50403d97f114cce9575973e2ffa",
  "archive-24": "02674ea866c213907efd0159ba9bc4c12dfb2cd79ccbbd8400c4215db0010826",
  "archive-25": "5339947d6fdd576d9b3a2e51bbb0a464a46dfbac4d166c9cafb2c30645910174",
  "archive-26": "71a4510439fa22a90e6a7b538f2b0f4b91416861d6f16964d1960f05be8a7c16",
  "archive-27": "4ba6e6c2844e4a1d429905e3f903e96594f52b63b72cfb35e05c0c6b19525a5a",
  "archive-28": "a83c91b376f1f2d5ea6fda54cba625af4d372dadf304977352474cd33c6cab1a",
  "archive-29": "4deeb0cb9554b7167214ffb1f88eaf4f63b3bb008af9ff5a62d2dde512ce909d",
  "archive-30": "9d0f92dcd48a08af6b6531b63f4483226f91810635c78a2edbedec3280623466"
};
const canonicalAdmission = (v) => Array.isArray(v) ? '[' + v.map(canonicalAdmission).join(',') + ']' :
  v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonicalAdmission(v[k])).join(',') + '}' : JSON.stringify(v);
export function validateAdmissions(configuration, receipt) {
  require(Array.isArray(configuration.admissions) && configuration.admissions.length === 31 &&
    receipt.admittedArchives === 31 && Array.isArray(receipt.observations) && receipt.observations.length === 31,
    'Exactly31 archive admissions and observations required.');
  const expectedIds = Array.from({ length: 31 }, (_, i) => 'archive-' + String(i + 1).padStart(2, '0'));
  const ids = configuration.admissions.map(a => a.id), observedIds = receipt.observations.map(a => a.archiveId);
  require(new Set(ids).size === 31 && new Set(observedIds).size === 31 &&
    expectedIds.every(id => ids.includes(id) && observedIds.includes(id)), 'Archive admission identities differ.');
  for (const a of configuration.admissions) {
    require(commit(a.infrastructureCommit) && positive(a.deploymentId) && Array.isArray(a.evidence) && a.evidence.length > 0,
      'Incomplete archive admission.');
    const paths = new Set();
    for (const e of a.evidence) {
      safePath(e.path);
      require((a.id !== 'archive-31' || e.path.startsWith('evidence/archive-31/')) && !paths.has(e.path) && sha256(e.sha256) &&
        ['http', 'inventory', 'browser', 'reference'].includes(e.kind), 'Invalid archive evidence pin.');
      paths.add(e.path);
    }
    require(['http', 'inventory', 'browser'].every(kind => a.evidence.some(e => e.kind === kind)),
      'Archive admission lacks required evidence roles.');
    const o = receipt.observations.find(o => o.archiveId === a.id);
    require(o.infrastructureCommit === a.infrastructureCommit && o.deploymentId === a.deploymentId &&
      o.deploymentState === 'success', 'Archive receipt observation differs from admission.');
    if (a.id === 'archive-31') {
      require(a.infrastructureCommit === '2ff1b312872857cf04b485f9c987a26c0432f356' && a.deploymentId === 6540533321,
        'Archive31 must use the accepted v64 append.');
    } else require(sha(Buffer.from(canonicalAdmission(a))) === RETAINED_ADMISSION_SHA256[a.id],
      'Previously admitted archive authority changed: ' + a.id);
  }
  return { total: 31, retainedUnchanged: 30, updated: ['archive-31'], externalBodiesReaudited: false };
}

function rowEquals(actual, expected) {
  return actual && actual.bytes === expected.bytes && actual.sha256 === expected.sha256;
}

/** Pure contract check. It validates declarations/identities, not subjective or browser claims. */
export function validateModels(binding, models, raws, retainedCatalog) {
  require(binding.reviewed === true, 'Explicitly reviewed binding required.');
  require(binding.format === 'revealline-final-main-public-binding.v1' && binding.base === BASE &&
    binding.currentVersion === VERSION && binding.gameSourceRevision === SOURCE && binding.qualifiedSourceTree === TREE &&
    commit(binding.controllerCommit) && commit(binding.controllerTree) && positive(binding.deploymentId) &&
    positive(binding.runId) && sha256(binding.inventorySha256), 'Binding identity differs.');
  const { receipt, deployment, statuses, run, manifest, record, qualification, catalog, configuration } = models;
  const catalogSha = binding.pins.catalog.sha256, manifestSha = binding.pins.manifest.sha256,
    recordSha = binding.pins.record.sha256, qualificationSha = binding.pins.qualification.sha256;
  require(sha(raws.catalog) === catalogSha && catalog.format === 'revealline-frozen-catalog.v1' &&
    catalog.sourceRepository === 'mekhovov/revealline' && Array.isArray(catalog.releases) &&
    catalog.releases.length === 100 && retainedCatalog.releases.length === 99 &&
    configuration.format === 'revealline-pages-controller.v1' && configuration.catalogSha256 === catalogSha &&
    configuration.currentVersion === VERSION && configuration.deploymentEnabled === true &&
    configuration.retainedReleasesPerMajor === 'all' && configuration.testingRoutes &&
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
  const archiveAdmissions = validateAdmissions(configuration, receipt);
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
  require(qualification.passed === true && qualification.sourceRevision === SOURCE && qualification.sourceTree === TREE &&
    qualification.actualCheckoutCommit === SOURCE && qualification.actualCheckoutTree === TREE &&
    Array.isArray(qualification.gates) && qualification.gates.length === 6 &&
    new Set(qualification.gates.map((g) => g.gate)).size === 6 &&
    ['validate', 'lint', 'test', 'format', 'native-format', 'motion-syntax'].every((name) =>
      qualification.gates.some((g) => g.gate === name && g.step?.conclusion === 'success')),
    'Exact frozen source qualification failed.');
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
  return { rows, criticalPaths, catalogVersions, testingVersions, archiveAdmissions,
    catalogCohorts: summarizeCatalogCohorts(catalog.releases, retainedCatalog.releases),
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
    visibleFrozenVersions: authority.catalogVersions, comparisonOnlyVersions: authority.testingVersions,
    catalogCohorts: authority.catalogCohorts, archiveAdmissions: authority.archiveAdmissions };
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
  const pins = await Promise.all(['audit-main.mjs', 'http-engine.mjs', 'catalog-cohorts.mjs', 'retained-catalog.json'].map(async (name) =>
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
