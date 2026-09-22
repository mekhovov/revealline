/** Publishing infrastructure only: one verified current graph plus authenticated historical bridges. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateArchivePlan,
  canonicalArchiveSite,
  assertPagesBudget,
  verifyFrozenSite,
} from '../../scripts/pages-archive.mjs';
import { planCurrentEntries, writeCurrentEntries } from '../../scripts/pages-current-entry.mjs';
import { publishedReleaseIndex, copyCatalogPresentation } from './catalog.mjs';
import {
  digest,
  jsonBytes,
  parseJSON,
  safePath,
  validateMetadata,
  metadataBridges,
  exact,
  VERSION,
  COMMIT,
  SHA,
  retainRecentMetadata,
  validReleaseRetention,
} from './metadata.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export async function readOrdinary(directory, relative, budget = 8_000_000) {
  safePath(relative);
  let file = directory;
  for (const part of relative.split('/')) {
    file = path.join(file, part);
    if ((await fs.lstat(file)).isSymbolicLink())
      throw new Error('Publication input cannot contain symbolic links.');
  }
  const info = await fs.stat(file);
  if (!info.isFile() || info.size > budget)
    throw new Error('Publication input is not a bounded ordinary file.');
  return fs.readFile(file);
}
export async function loadCatalog(directory) {
  const lockBytes = await readOrdinary(directory, 'catalog.json'),
    lock = parseJSON(lockBytes);
  if (
    !exact(lock, ['format', 'sourceRepository', 'releases']) ||
    lock.format !== 'revealline-frozen-catalog.v1' ||
    lock.sourceRepository !== 'mekhovov/revealline' ||
    !Array.isArray(lock.releases) ||
    !lock.releases.length ||
    lock.releases.length > 1024
  )
    throw new Error('Invalid frozen catalog.');
  const metadata = new Map();
  for (const pin of lock.releases) {
    if (!VERSION.test(pin.version) || metadata.has(pin.version))
      throw new Error('Invalid or duplicate catalog version.');
    const prefix = `metadata/${pin.version}/`;
    const [recordBytes, manifestBytes, checksumBytes] = await Promise.all(
      ['release.json', 'manifest.json', 'distribution.zip.sha256'].map((file) =>
        readOrdinary(directory, prefix + file),
      ),
    );
    metadata.set(pin.version, validateMetadata({ recordBytes, manifestBytes, checksumBytes, pin }));
  }
  return { lock, metadata, catalogSha256: digest(lockBytes) };
}
export async function validateAdmissions({
  directory,
  configuration,
  metadata,
  requireBrowser = true,
}) {
  if (
    !exact(configuration, [
      'format',
      'currentVersion',
      'catalogSha256',
      'allocationSha256',
      'admissions',
      'deploymentEnabled',
      'currentSourceQualification',
      'retainedReleasesPerMajor',
      'testingRoutes',
    ]) ||
    configuration.format !== 'revealline-pages-controller.v1' ||
    typeof configuration.deploymentEnabled !== 'boolean' ||
    !VERSION.test(configuration.currentVersion) ||
    !metadata.has(configuration.currentVersion) ||
    !SHA.test(configuration.catalogSha256) ||
    !SHA.test(configuration.allocationSha256) ||
    !Array.isArray(configuration.admissions) ||
    configuration.admissions.length > 64 ||
    !validReleaseRetention(configuration.retainedReleasesPerMajor) ||
    !configuration.testingRoutes ||
    typeof configuration.testingRoutes !== 'object' ||
    Array.isArray(configuration.testingRoutes) ||
    Object.keys(configuration.testingRoutes).length > 100
  )
    throw new Error('Invalid Pages controller configuration.');
  for (const [version, canonicalSite] of Object.entries(configuration.testingRoutes)) {
    if (
      version === configuration.currentVersion ||
      typeof canonicalSite !== 'string' ||
      !new RegExp(
        `^https://mekhovov\\.github\\.io/revealline-archive-[0-9]+/releases/${version.replaceAll('.', '\\.')}/site/$`,
      ).test(canonicalSite)
    )
      throw new Error('Invalid development testing route.');
  }
  if (requireBrowser && !configuration.deploymentEnabled)
    throw new Error('This reviewed controller candidate is not enabled for deployment.');
  const qualificationPin = configuration.currentSourceQualification;
  if (!exact(qualificationPin, ['path', 'sha256']) || !SHA.test(qualificationPin.sha256))
    throw new Error('Current source qualification needs an exact evidence pin.');
  const qualificationBytes = await readOrdinary(directory, qualificationPin.path);
  if (digest(qualificationBytes) !== qualificationPin.sha256)
    throw new Error('Current source qualification byte pin mismatch.');
  const qualification = parseJSON(qualificationBytes);
  if (
    qualification.format !== 'revealline-source-qualification.v1' ||
    qualification.version !== configuration.currentVersion ||
    qualification.sourceRevision !==
      metadata.get(configuration.currentVersion).record.sourceRevision ||
    !COMMIT.test(qualification.sourceTree) ||
    qualification.passed !== true ||
    qualification.allTrackedSourceContentsAndModesMatch !== true ||
    !Array.isArray(qualification.gates)
  )
    throw new Error('Current source qualification identity or result mismatch.');
  for (const gate of ['validate', 'lint', 'test', 'format', 'native-format', 'motion-syntax']) {
    const rows = qualification.gates.filter((row) => row.gate === gate);
    if (
      rows.length !== 1 ||
      !(
        rows[0].exitCode === 0 ||
        (rows[0].step?.status === 'completed' && rows[0].step?.conclusion === 'success')
      )
    )
      throw new Error(`Current source gate is not passed: ${gate}`);
  }
  const allocationsBytes = await readOrdinary(directory, 'allocations.json');
  if (digest(allocationsBytes) !== configuration.allocationSha256)
    throw new Error('Allocation byte pin mismatch.');
  const allocation = parseJSON(allocationsBytes),
    records = [...metadata.values()].map((m) => m.record),
    admitted = new Map(),
    relevantAdmissions = [];
  if (!exact(allocation, ['formatVersion', 'shards']) || !Array.isArray(allocation.shards))
    throw new Error('Invalid allocation registry.');
  // Unknown future reservations remain in the registry, never in the effective routing overlay.
  for (const admission of configuration.admissions) {
    if (
      !exact(admission, ['id', 'infrastructureCommit', 'deploymentId', 'evidence']) ||
      typeof admission.id !== 'string' ||
      admitted.has(admission.id) ||
      !COMMIT.test(admission.infrastructureCommit) ||
      !Number.isSafeInteger(admission.deploymentId) ||
      admission.deploymentId <= 0 ||
      !Array.isArray(admission.evidence) ||
      !admission.evidence.length ||
      admission.evidence.length > 64
    )
      throw new Error('Invalid archive admission.');
    const shard = allocation.shards.find((s) => s.id === admission.id);
    if (!shard) throw new Error('Admission has no allocation.');
    // Retired versions remain in the immutable catalog, but are intentionally not
    // routed or validated by a bounded public Pages deployment.
    if (!shard.versions.some((version) => metadata.has(version))) continue;
    let http = null,
      inventory = null,
      inventoryPin = null,
      browser = false;
    for (const pin of admission.evidence) {
      if (
        !exact(pin, ['path', 'sha256', 'kind']) ||
        !SHA.test(pin.sha256) ||
        !['http', 'browser', 'inventory', 'reference'].includes(pin.kind)
      )
        throw new Error('Invalid evidence pin.');
      const bytes = await readOrdinary(directory, pin.path, 16_000_000);
      if (digest(bytes) !== pin.sha256) throw new Error('Archive evidence byte pin mismatch.');
      if (pin.kind === 'reference') continue;
      const evidence = parseJSON(bytes, 16_000_000);
      if (pin.kind === 'http') {
        if (http) throw new Error('Duplicate HTTP authority.');
        if (
          evidence.status !== 'PASS' ||
          evidence.failedFiles !== 0 ||
          evidence.verifiedBytes !== evidence.expectedBytes ||
          !Number.isSafeInteger(evidence.verifiedBytes) ||
          evidence.verifiedBytes <= 0 ||
          evidence.verifiedBytes > 800_000_000 ||
          evidence.skipped?.length !== 0 ||
          evidence.base !== `https://mekhovov.github.io/${shard.repository.split('/')[1]}/`
        )
          throw new Error('Archive full-body admission failed.');
        http = evidence;
      }
      if (pin.kind === 'inventory') {
        if (
          inventory ||
          evidence.base !== `https://mekhovov.github.io/${shard.repository.split('/')[1]}/` ||
          !Array.isArray(evidence.files) ||
          evidence.files.length > 20000
        )
          throw new Error('Invalid archive inventory authority.');
        inventory = evidence;
        inventoryPin = pin;
      }
      if (pin.kind === 'browser') {
        if (
          evidence.format !== 'revealline-archive-browser-admission.v1' ||
          evidence.status !== 'PASS' ||
          evidence.archiveId !== admission.id ||
          evidence.infrastructureCommit !== admission.infrastructureCommit ||
          evidence.deploymentId !== admission.deploymentId ||
          !Array.isArray(evidence.versions) ||
          shard.versions.some((v) => metadata.has(v) && !evidence.versions.includes(v)) ||
          !Array.isArray(evidence.evidence) ||
          !evidence.evidence.length ||
          evidence.evidence.some(
            (ref) =>
              !admission.evidence.some(
                (p) => p.kind === 'reference' && p.path === ref.path && p.sha256 === ref.sha256,
              ),
          )
        )
          throw new Error('Archive browser admission failed.');
        browser = true;
      }
    }
    if (!http || !inventory || (requireBrowser && !browser))
      throw new Error(`Archive admission is incomplete: ${admission.id}`);
    const archiveFiles = new Map();
    let archiveBytes = 0;
    for (const row of inventory.files) {
      safePath(row.path);
      if (
        archiveFiles.has(row.path) ||
        !Number.isSafeInteger(row.bytes) ||
        row.bytes < 0 ||
        !SHA.test(row.sha256)
      )
        throw new Error('Invalid archive inventory row.');
      archiveFiles.set(row.path, row);
      archiveBytes += row.bytes;
    }
    if (
      http.files !== archiveFiles.size ||
      http.verifiedBytes !== archiveBytes ||
      (http.expectedInventorySha256 && http.expectedInventorySha256 !== inventoryPin.sha256)
    )
      throw new Error('Archive HTTP report is not bound to its complete inventory.');
    for (const version of shard.versions.filter((v) => metadata.has(v))) {
      const item = metadata.get(version),
        prefix = `releases/${version}/site/`;
      const rows = [
        ...item.manifest.files,
        {
          path: 'manifest.json',
          bytes: item.manifestBytes.length,
          sha256: digest(item.manifestBytes),
        },
        {
          path: 'distribution.zip.sha256',
          bytes: item.checksumBytes.length,
          sha256: digest(item.checksumBytes),
        },
      ];
      for (const row of rows) {
        const archived = archiveFiles.get(prefix + row.path);
        if (!archived || archived.bytes !== row.bytes || archived.sha256 !== row.sha256)
          throw new Error(`Archive does not preserve the pinned original: ${version}/${row.path}`);
      }
      const archivedRecord = archiveFiles.get(`releases/${version}/release.json`);
      if (
        !archivedRecord ||
        archivedRecord.bytes !== item.recordBytes.length ||
        archivedRecord.sha256 !== digest(item.recordBytes)
      )
        throw new Error('Archive release record does not match the pinned original.');
    }
    admitted.set(admission.id, shard);
    relevantAdmissions.push(admission);
  }
  const plan = {
    formatVersion: 1,
    shards: [...admitted.values()]
      .map((shard) => ({
        ...shard,
        versions: shard.versions.filter(
          (v) => metadata.has(v) && v !== configuration.currentVersion,
        ),
      }))
      .filter((s) => s.versions.length),
  };
  const shards = validateArchivePlan(
    plan,
    records,
    'mekhovov/revealline',
    configuration.currentVersion,
  );
  const canonicalSites = Object.fromEntries(
    shards.flatMap((shard) => shard.versions.map((v) => [v, canonicalArchiveSite(shard, v)])),
  );
  for (const version of metadata.keys())
    if (version !== configuration.currentVersion && !canonicalSites[version])
      throw new Error(`Historical edition lacks an admitted archive: ${version}`);
  return { plan, canonicalSites, qualification, admissions: relevantAdmissions };
}
async function writeFile(directory, relative, bytes) {
  safePath(relative);
  const file = path.join(directory, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes, { flag: 'wx' });
}
export async function directoryInventory(directory, prefix = '') {
  const rows = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name,
      absolute = path.join(directory, entry.name);
    safePath(name);
    if (entry.isDirectory()) rows.push(...(await directoryInventory(absolute, name + '/')));
    else if (entry.isFile()) {
      const bytes = await fs.readFile(absolute);
      rows.push({ path: name, bytes: bytes.length, sha256: digest(bytes) });
    } else throw new Error('Publication output contains a link or special file.');
  }
  return rows.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

// HTML entry aliases are self-contained. Runtime bodies live only in the
// immutable release graph; copying them at root would double the Pages budget.
// Keep frozen manifest evidence and the tiny metadata/icon graph that existing
// root-installed web apps may revalidate. This is not a second offline graph.
const ROOT_COMPATIBILITY_LIMITS = new Map([
  ['manifest.json', 8_000_000],
  ['manifest.webmanifest', 65_536],
  ['icons/icon-180.png', 1_048_576],
  ['icons/icon-192.png', 1_048_576],
  ['icons/icon-512.png', 1_048_576],
  ['icons/icon.svg', 65_536],
]);

export function rootCompatibilityRows(rows) {
  return rows.filter((row) => {
    const limit = ROOT_COMPATIBILITY_LIMITS.get(row.path);
    if (limit === undefined) return false;
    if (!Number.isSafeInteger(row.bytes) || row.bytes < 1 || row.bytes > limit)
      throw new Error(`Root compatibility file exceeds its byte budget: ${row.path}`);
    return true;
  });
}

export async function assemble({
  directory = path.join(root, 'publishing/pages-controller'),
  currentSite,
  outputDirectory,
  requireBrowser = true,
}) {
  const { lock, metadata: catalogMetadata, catalogSha256 } = await loadCatalog(directory),
    configuration = parseJSON(await readOrdinary(directory, 'publication.json'));
  if (catalogSha256 !== configuration.catalogSha256) throw new Error('Catalog byte pin mismatch.');
  const testingVersions = new Set(Object.keys(configuration.testingRoutes || {})),
    testingMetadata = new Map(
      [...catalogMetadata].filter(([version]) => testingVersions.has(version)),
    ),
    metadata = retainRecentMetadata(
      new Map([...catalogMetadata].filter(([version]) => !testingVersions.has(version))),
      configuration.retainedReleasesPerMajor,
    ),
    _testingRoutesExist =
      testingMetadata.size === testingVersions.size ||
      (() => {
        throw new Error('A development testing route has no frozen metadata.');
      })(),
    { canonicalSites } = await validateAdmissions({
      directory,
      configuration,
      metadata,
      requireBrowser,
    }),
    current = metadata.get(configuration.currentVersion),
    publicationMetadata = new Map([...metadata, ...testingMetadata]),
    publicationSites = { ...canonicalSites, ...configuration.testingRoutes };
  if (!outputDirectory || !currentSite || (await fs.lstat(currentSite)).isSymbolicLink())
    throw new Error('Explicit ordinary current site and output required.');
  const inputRows = await directoryInventory(currentSite);
  const originalZip = inputRows.find((row) => row.path === 'distribution.zip');
  if (
    originalZip &&
    (originalZip.sha256 !== current.record.distributionSha256 || originalZip.bytes > 800_000_000)
  )
    throw new Error('Local original ZIP identity mismatch.');
  const marker = Buffer.from('{\n  "tool": "xonix-game-cli",\n  "formatVersion": 1\n}\n');
  const currentRows = inputRows.filter((row) => row.path !== 'distribution.zip'),
    expectedRows = [
      ...current.manifest.files,
      {
        path: 'manifest.json',
        bytes: current.manifestBytes.length,
        sha256: digest(current.manifestBytes),
      },
      {
        path: 'distribution.zip.sha256',
        bytes: current.checksumBytes.length,
        sha256: digest(current.checksumBytes),
      },
      { path: '.xonix-build.json', bytes: marker.length, sha256: digest(marker) },
    ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (JSON.stringify(currentRows) !== JSON.stringify(expectedRows))
    throw new Error('Current site has mismatched, missing or extra files.');
  await verifyFrozenSite(currentSite, current.record);
  const entries = await planCurrentEntries({
    source: currentSite,
    repository: lock.sourceRepository,
    record: current.record,
  });
  const rootRows = rootCompatibilityRows(currentRows),
    rootPaths = new Set(rootRows.map((row) => row.path));
  // Refuse to replace an existing artifact. A successful build is immutable evidence.
  await fs.mkdir(outputDirectory, { recursive: false });
  for (const row of currentRows) {
    const bytes = await readOrdinary(currentSite, row.path, 800_000_000);
    if (bytes.length !== row.bytes || digest(bytes) !== row.sha256)
      throw new Error('Current asset changed during publication.');
    await writeFile(outputDirectory, `releases/${current.record.version}/site/${row.path}`, bytes);
    if (rootPaths.has(row.path)) await writeFile(outputDirectory, row.path, bytes);
  }
  let redirectedHTMLFiles = 0;
  for (const [version, item] of publicationMetadata) {
    await writeFile(outputDirectory, `releases/${version}/release.json`, item.recordBytes);
    if (version === current.record.version) continue;
    const files = metadataBridges(item, publicationSites[version]);
    for (const [relative, bytes] of files) {
      await writeFile(outputDirectory, `releases/${version}/site/${relative}`, bytes);
      if (relative.endsWith('.html')) redirectedHTMLFiles++;
    }
  }
  const catalogPresentation = await copyCatalogPresentation(currentSite, outputDirectory);
  const records = [...publicationMetadata.values()].map((m) => m.record),
    index = publishedReleaseIndex(
      records,
      lock.sourceRepository,
      current.record.version,
      publicationSites,
      { presentation: Boolean(catalogPresentation) },
    );
  await writeFile(outputDirectory, 'releases/index.json', jsonBytes(index.json));
  await writeFile(outputDirectory, 'releases/index.html', index.html);
  await writeFile(outputDirectory, 'release.json', jsonBytes(current.record));
  await writeFile(outputDirectory, '.nojekyll', '');
  await writeCurrentEntries(entries, outputDirectory);
  await writeFile(
    outputDirectory,
    'archive-routing.json',
    jsonBytes({
      formatVersion: 1,
      sourceRepository: lock.sourceRepository,
      target: 'main',
      canonicalSites: publicationSites,
      releases: records.map(({ version, sourceRevision, manifestSha256 }) => ({
        version,
        sourceRevision,
        manifestSha256,
      })),
    }),
  );
  const files = await directoryInventory(outputDirectory),
    totalBytes = files.reduce((n, row) => n + row.bytes, 0),
    budgetBytes = assertPagesBudget(totalBytes);
  return {
    format: 'revealline-metadata-pages-artifact.v1',
    currentVersion: current.record.version,
    gameSourceRevision: current.record.sourceRevision,
    catalogSha256,
    configurationSha256: digest(await readOrdinary(directory, 'publication.json')),
    totalBytes,
    budgetBytes,
    files,
    historicalBridges: publicationMetadata.size - 1,
    testingVersions: testingMetadata.size,
    redirectedHTMLFiles,
    browserAdmissionsRequired: requireBrowser,
    catalogPresentation,
    currentGraphLayout: 'single-canonical-with-root-metadata-v1',
    rootCompatibilityFiles: rootRows,
  };
}
