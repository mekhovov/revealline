import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  isBuildInputPath,
  readBuildConfig,
  safeRelative,
  validateBuildReferences,
} from './game-cli.mjs';
import { validateDownloadCatalogue } from '../game/download-catalogue.mjs';
import { projectDefaultRuntimeMetadata } from './default-runtime-metadata.mjs';
import {
  soloBuildVerificationArguments,
  verifyExternalBuildArchive,
} from './solo-build-archive.mjs';
import { inspectSoloWorkerClosure, SOLO_MP3_WORKER_FILES } from './solo-build-worker-closure.mjs';

// Read-only with respect to both source and artifact; only the report is written.
// This checks an existing build, not publication admission or physical-device
// qualification. Run after source edits finish, outside timing observations.
// An external ZIP requires the independent extraction receipt. This verifier
// recomputes its digest and binds that receipt to the verified local manifest;
// retain both reports. It neither copies nor independently re-expands that ZIP.
const args = soloBuildVerificationArguments(process.argv.slice(2));
const { artifact: artifactArgument, output } = args;
const option = (name, fallback) => args[name] ?? fallback;
const sourceRoot = await realpath(option('source', fileURLToPath(new URL('../', import.meta.url))));
const artifact = resolve(artifactArgument);
const outputPath = resolve(output);
assert.ok(
  outputPath !== artifact && !outputPath.startsWith(`${artifact}${sep}`),
  'The report must be outside the read-only artifact.',
);
if (args.archive)
  for (const input of [args.archive, `${args.archive}.sha256`, args['archive-receipt']])
    assert.notEqual(outputPath, resolve(input), 'The report cannot overwrite archive evidence.');
const runFile = promisify(execFile);
const git = async (...args) =>
  (await runFile('git', args, { cwd: sourceRoot, maxBuffer: 16 * 1024 * 1024 })).stdout;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function digest(file) {
  let bytes = 0;
  const value = createHash('sha256');
  for await (const chunk of createReadStream(file)) {
    bytes += chunk.length;
    value.update(chunk);
  }
  return { bytes, sha256: value.digest('hex') };
}
const report = {
  kind: 'finished Solo artifact integrity and current runtime byte comparison',
  artifact,
  sourceRoot,
  status: 'failed',
  failures: [],
  transformedSourcesSkipped: [],
  supportedSourceProjections: [],
};
const check = (condition, reason, detail = {}) => {
  if (!condition) report.failures.push({ reason, ...detail });
};
try {
  const artifactRoot = await realpath(artifact);
  const artifactPath = async (name) => {
    safeRelative(name);
    const file = await realpath(resolve(artifactRoot, name));
    assert.ok(file.startsWith(`${artifactRoot}${sep}`), 'Artifact reference escaped its root.');
    return file;
  };
  const marker = JSON.parse(await readFile(await artifactPath('.xonix-build.json'), 'utf8'));
  assert.equal(marker.tool, 'xonix-game-cli', 'Wait for a completed build ownership marker.');
  assert.equal(marker.formatVersion, 1);
  const statusBefore = await git('status', '--porcelain=v1', '--untracked-files=normal');
  const headBefore = (await git('rev-parse', 'HEAD')).trim();
  const base = (
    await git('rev-parse', '--verify', '--end-of-options', `${option('base', 'HEAD')}^{commit}`)
  ).trim();
  report.source = {
    headContextOnly: headBefore,
    comparisonBase: base,
    dirty: Boolean(statusBefore),
    wholeTreeRevision: statusBefore ? null : headBefore,
    status: statusBefore.split('\n').filter(Boolean),
  };
  const manifestBytes = await readFile(await artifactPath('manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.formatVersion, 1);
  assert.ok(Array.isArray(manifest.files));
  const byPath = new Map();
  for (const row of manifest.files) {
    safeRelative(row.path);
    assert.ok(Number.isSafeInteger(row.bytes) && row.bytes >= 0);
    assert.match(row.sha256, /^[a-f0-9]{64}$/);
    assert.ok(!byPath.has(row.path), `Duplicate manifest path: ${row.path}`);
    byPath.set(row.path, row);
  }
  report.manifest = {
    sha256: hash(manifestBytes),
    version: manifest.version,
    declaredSourceRevision: manifest.sourceRevision,
    files: byPath.size,
    bytes: manifest.totalBytes,
  };
  check(
    [...byPath.values()].reduce((sum, row) => sum + row.bytes, 0) === manifest.totalBytes,
    'Manifest byte total differs.',
  );
  let verifiedBytes = 0;
  for (const row of byPath.values()) {
    try {
      const actual = await digest(await artifactPath(row.path));
      check(
        actual.bytes === row.bytes && actual.sha256 === row.sha256,
        'Artifact digest differs.',
        {
          path: row.path,
          expected: { bytes: row.bytes, sha256: row.sha256 },
          actual,
        },
      );
      verifiedBytes += actual.bytes;
    } catch (error) {
      check(false, 'Manifest file cannot be verified.', { path: row.path, error: error.message });
    }
  }
  report.verifiedArtifactBytes = verifiedBytes;
  const config = await readBuildConfig(sourceRoot);
  const changed = new Set([
    ...(await git('diff', '--name-only', '-z', base, '--')).split('\0').filter(Boolean),
    ...(await git('ls-files', '--others', '--exclude-standard', '-z')).split('\0').filter(Boolean),
  ]);
  const included = (name) =>
    config.include.some((entry) => name === entry || name.startsWith(`${entry}/`)) &&
    isBuildInputPath(name);
  const dirtyPaths = new Set([
    ...(await git('diff', '--name-only', '-z', 'HEAD', '--')).split('\0').filter(Boolean),
    ...(await git('ls-files', '--others', '--exclude-standard', '-z')).split('\0').filter(Boolean),
  ]);
  report.source.dirtyDirectBuildInputs = [...dirtyPaths].filter(included);
  report.source.otherDirtyPaths = [...dirtyPaths].filter((name) => !included(name));
  report.source.directBuildInputsRevision = report.source.dirtyDirectBuildInputs.length
    ? null
    : headBefore;
  if (manifest.sourceRevision !== null) {
    assert.match(manifest.sourceRevision, /^[a-f0-9]{40,64}$/);
    report.source.declaredBuildRevision = (
      await git('rev-parse', '--verify', '--end-of-options', `${manifest.sourceRevision}^{commit}`)
    ).trim();
    assert.equal(report.source.declaredBuildRevision, manifest.sourceRevision);
    let declaredRevisionIsAncestor = false;
    try {
      await git('merge-base', '--is-ancestor', manifest.sourceRevision, headBefore);
      declaredRevisionIsAncestor = true;
    } catch (error) {
      if (error.code !== 1) throw error;
    }
    report.source.declaredRevisionIsAncestor = declaredRevisionIsAncestor;
    const changedDirectInputsSinceDeclaredRevision = (
      await git('diff', '--name-only', '-z', manifest.sourceRevision, headBefore, '--')
    )
      .split('\0')
      .filter(Boolean)
      .filter(included);
    report.source.changedDirectInputsSinceDeclaredRevision =
      changedDirectInputsSinceDeclaredRevision;
    check(
      declaredRevisionIsAncestor &&
        !changedDirectInputsSinceDeclaredRevision.length &&
        !report.source.dirtyDirectBuildInputs.length,
      'Declared build revision does not match the current clean direct inputs.',
    );
  }
  const compare = new Set([
    ...SOLO_MP3_WORKER_FILES,
    ...[...byPath.keys()].filter((name) => /\.(?:m?js|css)$/.test(name)),
    ...[...changed].filter(included),
  ]);
  const sourceDigests = new Map();
  for (const name of compare) {
    // HTML receives launch/version/offline/access metadata. This verifier does
    // not pretend those generated bytes should equal the raw source document.
    if (
      name.endsWith('.html') ||
      name === 'game/build-info.json' ||
      name === 'game/content-design/route-loader.mjs'
    ) {
      report.transformedSourcesSkipped.push(name);
      continue;
    }
    let sourceBytes;
    try {
      sourceBytes = await readFile(resolve(sourceRoot, name));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (changed.has(name))
        check(!byPath.has(name), 'Deleted source remains packaged.', { path: name });
      continue; // Generated modules can exist only in the artifact.
    }
    const current = { bytes: sourceBytes.length, sha256: hash(sourceBytes) };
    sourceDigests.set(name, current);
    const projected = { name, bytes: sourceBytes };
    await projectDefaultRuntimeMetadata(sourceRoot, [projected]);
    const expected = { bytes: projected.bytes.length, sha256: hash(projected.bytes) };
    if (current.sha256 !== expected.sha256)
      report.supportedSourceProjections.push({ path: name, source: current, expected });
    const packaged = byPath.get(name);
    check(
      packaged?.bytes === expected.bytes && packaged?.sha256 === expected.sha256,
      'Packaged runtime differs from its supported current-source projection.',
      { path: name, source: current, expected, packaged: packaged ?? null },
    );
  }
  report.runtimeSourcesCompared = sourceDigests.size;
  // The ordinary builder replaces the source route factory with pinned JSON
  // descriptors. Check its exact emitted adapter and every descriptor binding,
  // without recompiling all historical content or executing packaged code.
  const routeLoader = (
    await readFile(await artifactPath('game/content-design/route-loader.mjs'))
  ).toString();
  const routeConstants = routeLoader.match(
    /\nconst CURRENT = ([^\n]+);\nconst ROUTES = ([^\n]+);\n/,
  );
  assert.ok(routeConstants, 'Expected the generated published route adapter.');
  const current = JSON.parse(routeConstants[1]),
    routes = JSON.parse(routeConstants[2]);
  check(
    routeLoader ===
      `import { loadRouteSnapshot } from './route-snapshot.mjs';\nconst CURRENT = ${JSON.stringify(current)};\nconst ROUTES = ${JSON.stringify(routes)};\nexport async function loadAuthoredJourneyRoute(id, options = {}) {\n  const descriptor = id === CURRENT.id && !options.fullSource ? CURRENT : ROUTES[id];\n  return descriptor ? loadRouteSnapshot(descriptor, options) : null;\n}\n`,
    'Generated route adapter differs from the supported build transform.',
  );
  for (const descriptor of [current, ...Object.values(routes)]) {
    const name = `game/content-design/${descriptor.path}`;
    safeRelative(name);
    const packaged = byPath.get(name);
    check(
      packaged?.bytes === descriptor.bytes && packaged?.sha256 === descriptor.sha256,
      'Generated route descriptor differs from packaged bytes.',
      { path: name },
    );
  }
  report.generatedRouteDescriptors = Object.keys(routes).length + 1;
  try {
    const references = await validateBuildReferences(artifactRoot, [...byPath.keys()]);
    report.references = {
      valid: references.literalReferencesValid,
      navigationWarnings: references.navigationWarnings,
    };
  } catch (error) {
    report.references = { valid: false, error: error.message };
    check(false, 'Packaged import/resource closure failed.', { error: error.message });
  }
  const core = JSON.parse(await readFile(await artifactPath('offline-cache.json'), 'utf8'));
  const catalogue = validateDownloadCatalogue(
    JSON.parse(await readFile(await artifactPath('offline-content.json'), 'utf8')),
  );
  const inventory = JSON.parse(
    await readFile(await artifactPath('offline-inventory.json'), 'utf8'),
  );
  assert.equal(core.format, 'revealline-offline.v1');
  assert.equal(inventory.format, 'revealline-offline-inventory.v1');
  for (const [name, value] of [
    ['core', core],
    ['catalogue', catalogue],
    ['inventory', inventory],
  ]) {
    check(value.version === manifest.version, 'Offline version differs.', { inventory: name });
    const seen = new Set();
    for (const row of value.files) {
      check(!seen.has(row.path), 'Duplicate offline descriptor.', {
        inventory: name,
        path: row.path,
      });
      seen.add(row.path);
      const packaged = byPath.get(row.path);
      if (!packaged && row.kind === 'soundtrack') continue; // Declared optional remote recording.
      check(
        packaged?.bytes === row.bytes && packaged?.sha256 === row.sha256,
        'Offline descriptor differs from packaged bytes.',
        { inventory: name, path: row.path },
      );
    }
  }
  const workerClosure = inspectSoloWorkerClosure({
    sourcePaths: sourceDigests,
    manifestPaths: byPath,
    coreFiles: core.files,
    inventoryFiles: inventory.files,
  });
  report.workerClosureContract = workerClosure.contract;
  report.workerClosure = workerClosure.rows;
  report.failures.push(...workerClosure.failures);
  const template = await readFile(
    resolve(sourceRoot, 'game/offline/service-worker.template.js'),
    'utf8',
  );
  if (manifest.sourceRevision !== null)
    check(
      hash(template) ===
        hash(
          await git('show', `${manifest.sourceRevision}:game/offline/service-worker.template.js`),
        ),
      'Service-worker source template differs from the declared build revision.',
    );
  const emittedWorker = await readFile(await artifactPath('service-worker.js'));
  check(
    hash(emittedWorker) ===
      hash(template.replace('__XONIX_OFFLINE_CONFIG__', JSON.stringify(core))),
    'Service worker differs from current template and exact core configuration.',
  );
  report.offline = {
    buildId: core.buildId,
    coreFiles: core.files.length,
    downloadFiles: catalogue.files.length,
    inventoryFiles: inventory.files.length,
  };
  if (args.archive)
    report.zip = await verifyExternalBuildArchive({
      archive: args.archive,
      receipt: args['archive-receipt'],
      artifactRoot,
      manifestBytes,
    });
  else {
    const archive = await digest(await artifactPath('distribution.zip'));
    const checksum = (await readFile(await artifactPath('distribution.zip.sha256'), 'utf8')).trim();
    check(checksum === `${archive.sha256}  distribution.zip`, 'ZIP checksum differs.');
    report.zip = {
      ...archive,
      check: 'sidecar digest; ZIP members are not independently re-expanded',
    };
  }
  for (const [name, initial] of sourceDigests) {
    const final = await digest(resolve(sourceRoot, name));
    check(
      final.bytes === initial.bytes && final.sha256 === initial.sha256,
      'Source changed during verification.',
      { path: name },
    );
  }
  check(
    (await git('rev-parse', 'HEAD')).trim() === headBefore,
    'Source HEAD changed during verification.',
  );
  report.source.statusAtFinish = (await git('status', '--porcelain=v1', '--untracked-files=normal'))
    .split('\n')
    .filter(Boolean);
  const dirtyDirectInputsAtFinish = [
    ...(await git('diff', '--name-only', '-z', 'HEAD', '--')).split('\0').filter(Boolean),
    ...(await git('ls-files', '--others', '--exclude-standard', '-z')).split('\0').filter(Boolean),
  ].filter(included);
  report.source.dirtyDirectBuildInputsAtFinish = dirtyDirectInputsAtFinish;
  check(
    JSON.stringify([...new Set(dirtyDirectInputsAtFinish)].sort()) ===
      JSON.stringify([...report.source.dirtyDirectBuildInputs].sort()),
    'Direct build-input status changed during verification.',
  );
  check(
    hash(await readFile(await artifactPath('manifest.json'))) === report.manifest.sha256,
    'Artifact manifest changed during verification.',
  );
  report.status = report.failures.length ? 'failed' : 'passed';
} catch (error) {
  report.status = error.code === 'ENOENT' && !report.manifest ? 'not-ready' : 'failed';
  report.failures.push({ reason: error.message });
} finally {
  if (report.status !== 'passed') process.exitCode = report.status === 'not-ready' ? 2 : 1;
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({
      status: report.status,
      failures: report.failures.length,
      report: resolve(output),
    }),
  );
}
