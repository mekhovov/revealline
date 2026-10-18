#!/usr/bin/env node
/** Complete in-memory publication candidate audit; never uploads or admits a deployment. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm, stat } from 'node:fs/promises';
import { frozenOptionalPackageOverlay } from '../publishing/optional-package-promotion.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classicDemoSourcePaths } from './demo-native-dependencies.mjs';
import { projectDefaultRuntimeMetadata } from './default-runtime-metadata.mjs';
import { prepareBuildProject, collectBuildFiles, readBuildConfig } from './game-cli.mjs';
import { parse } from '../publishing/vendor/acorn-8.18.0.mjs';
import { demoPackagingRequirements, readEmittedOfflineConfig } from './qualify-demo-packaging.mjs';
import { SOLO_BUILTIN_DEMO_INDEX } from '../game/demo-modes/solo-builtins-index.mjs';
import { loadAuthoredJourneyRoute } from '../game/content-design/route-loader.mjs';
import { SURVIVAL_DEMO_RUNTIME_VARIANTS } from '../game/demo-modes/survival-runtime-variants.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const json = async (name) => JSON.parse(await readFile(path.resolve(root, name)));
const evidence = 'docs/qualification/shared-demos/';
export const defaultBaselines = {
  inventory: evidence + 'main-pages-baseline-inventory-461ace.json',
  archive: evidence + 'main-pages-baseline-archive-receipt-461ace.json',
};
async function fingerprint(directories = ['game', 'optional-practice', 'publishing']) {
  const paths = execFileSync('rg', ['--files', ...directories], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
    .trim()
    .split('\n')
    .filter(
      (p) =>
        /\.(mjs|js|json|css|html)$/.test(p) &&
        !p.includes('/test/') &&
        !p.endsWith('.test.mjs') &&
        !p.endsWith('/coverage.json'),
    )
    .sort();
  const h = createHash('sha256');
  let bytes = 0;
  for (const p of paths) {
    const b = await readFile(path.join(root, p));
    bytes += b.length;
    h.update(p + '\0').update(Buffer.from(sha(b), 'hex'));
  }
  return { sha256: h.digest('hex'), files: paths.length, bytes };
}
/** Only the existing distribution metadata projection may change source bytes.
 * Authored packs, images, replays, and generated full Journey sources stay exact. */
export async function demoNativeDependencyBytes(name, bytes) {
  if (name !== 'game/content/mission-library-index.json') return bytes;
  const entries = [{ name, bytes }];
  await projectDefaultRuntimeMetadata(root, entries);
  return entries[0].bytes;
}

/** Compare the actual worker policy against source originals present in build
 * inputs but absent from the emitted profile, independently of its callback. */
export function omittedOriginalWorkerProof(entries, originals) {
  const byPath = new Map(entries.map((entry) => [entry.name, entry]));
  const config = readEmittedOfflineConfig(
    byPath.get('service-worker.js').bytes,
    byPath.get('offline-cache.json').bytes,
  );
  const omitted = originals.filter((row) => !byPath.has(row.path));
  const expected = omitted.map((row) => row.path).sort();
  if (expected.length)
    assert.deepEqual(
      config.omittedSourceOriginals,
      expected,
      'Worker omitted-original inventory must exactly match emitted omissions.',
    );
  else
    assert.equal(
      Object.hasOwn(config, 'omittedSourceOriginals'),
      false,
      'Worker must omit its original-omission policy when no originals are removed.',
    );
  const registered = new Set(
    [...(config.files ?? []), ...(config.downloadFiles ?? [])].map((row) => row.path),
  );
  for (const name of expected)
    assert.ok(
      !byPath.has(name) && !registered.has(name),
      `Omitted original collides with retained/offline content: ${name}`,
    );
  const fallbackPaths = [
    ...new Set(
      omitted.flatMap((row) => {
        assert.ok(
          row.owners.length && row.owners.every((owner) => owner.fallbackPaths.length),
          `Omitted original needs native fallback owners: ${row.path}`,
        );
        return row.owners.flatMap((owner) => owner.fallbackPaths);
      }),
    ),
  ].sort();
  for (const name of fallbackPaths) {
    assert.ok(byPath.has(name), `Omitted-original fallback is not retained: ${name}`);
    assert.ok(
      registered.has(name),
      `Omitted-original fallback is not registered for offline use: ${name}`,
    );
  }
  return {
    workerConfigMatchesCache: true,
    inventoryMatchesRemovedOriginals: true,
    count: expected.length,
    paths: expected,
    fallbackCount: fallbackPaths.length,
    fallbackPaths,
    collisions: [],
  };
}

export function mainPagesAuditFailures(report) {
  const errors = [];
  if (report.omittedOriginalWorker?.error) errors.push(report.omittedOriginalWorker.error);
  if (!report.headStable || !report.sourceStable)
    errors.push('Source or HEAD changed during qualification.');
  for (const [key, label] of [
    ['missingPayloads', 'required demo payload'],
    ['mismatchedPayloads', 'changed demo payload'],
    ['missingNative', 'native source dependency'],
    ['mismatchedNative', 'changed native dependency'],
  ])
    for (const row of report[key] ?? [])
      errors.push(`Missing or invalid ${label}: ${typeof row === 'string' ? row : row.path}`);
  for (const name of report.literalDemoModuleClosure.missingModules)
    errors.push(`Missing literal module dependency: ${name}`);
  if (report.finalStaged.bytes > report.rollingMainPagesLimitBytes)
    errors.push('Staged candidate exceeds the unchanged rolling Main Pages limit.');
  if (report.archiveSizeModel.bytes > report.rollingMainPagesLimitBytes)
    errors.push(
      'Baseline-calibrated archive size model exceeds the unchanged rolling Main Pages limit.',
    );
  return errors;
}
export async function qualifyDemoMainPages({
  reportPath,
  baselineInventory = defaultBaselines.inventory,
  baselineArchive: baselineArchivePath = defaultBaselines.archive,
} = {}) {
  assert.ok(
    typeof reportPath === 'string' && reportPath.endsWith('.json'),
    'Pass a new --report path ending in .json.',
  );
  const output = path.resolve(root, reportPath),
    inventoryOutput = output.replace(/\.json$/, '.inventory.json');
  for (const filename of [output, inventoryOutput]) {
    try {
      await stat(filename);
      throw new Error(`Refusing to overwrite existing evidence: ${filename}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const baselineBytes = await readFile(path.resolve(root, baselineInventory));
  const baselineInventoryObject = JSON.parse(baselineBytes),
    baselineFiles = baselineInventoryObject.files;
  const baselineArchiveBytes = await readFile(path.resolve(root, baselineArchivePath));
  const baselineArchive = JSON.parse(baselineArchiveBytes);
  assert.equal(
    sha(baselineBytes),
    baselineArchive.inventorySha256,
    'Baseline inventory must match its measured archive receipt.',
  );
  assert.equal(
    baselineInventoryObject.completeInventory,
    true,
    'Baseline inventory must be complete.',
  );
  assert.equal(
    baselineInventoryObject.sourceRevision,
    baselineArchive.sourceRevision,
    'Baseline receipts must bind the same source.',
  );
  assert.equal(baselineFiles.length, baselineArchive.files);
  assert.equal(
    baselineFiles.reduce((n, row) => n + row.bytes, 0),
    baselineArchive.stagedBytes,
  );
  const baselineModel = gnuTarSize(baselineFiles);
  assert.equal(
    baselineModel.bytes,
    baselineArchive.archiveBytes,
    'Archive model must reproduce the actual pinned baseline measurement.',
  );
  const started = new Date().toISOString(),
    sourceRevision = git('rev-parse', 'HEAD'),
    before = await fingerprint(),
    buildBefore = await fingerprint(['scripts', 'authoring']);
  console.log(JSON.stringify({ phase: 'start', sourceRevision, sourceFingerprint: before }));
  const project = await prepareBuildProject({
    root,
    sourceRevision,
    publicationProfile: 'main-pages',
  });
  const entries = new Map(project.entries.map((e) => [e.name, e]));
  console.log(
    JSON.stringify({ phase: 'prepared', files: entries.size, bytes: project.manifest.totalBytes }),
  );
  const soloCatalogs = await Promise.all(
      ['catalog', 'catalog.journey-current', 'catalog.journey-archive'].map((p) =>
        json(`game/demo-data/${p}.json`),
      ),
    ),
    simIndex = await json('optional-practice/civilian-fpv/demo-data/index.json'),
    snakeCatalog = await json('game/demo-data/snake/catalog.json'),
    survivalCatalog = await json('game/demo-data/survival/catalog.json');
  const required = demoPackagingRequirements({
    soloCatalogs,
    simIndex,
    snakeCatalog,
    survivalCatalog,
    survivalVariants: SURVIVAL_DEMO_RUNTIME_VARIANTS,
  });
  const requiredNative = [];
  const commonClassic = [
    'game/content/base-artwork.json',
    'game/content/campaign.json',
    'game/content/classes.json',
    'game/content/themes.json',
    'game/content/mission-library-index.json',
    'authoring/motion-lab/presets.json',
  ];
  requiredNative.push(...commonClassic.map((p) => ({ path: p, owner: 'solo-classic' })));
  const classicCatalog = await json('game/demo-data/catalog.json'),
    missionIndex = await json('game/content/mission-library-index.json');
  const selectedRows = classicCatalog.clips.map((clip) => {
    const matches = missionIndex.missions.filter(
      (row) =>
        ['base', 'bundled', 'archived'].includes(row.source) &&
        row.campaignKey === clip.campaignKey &&
        row.levelId === clip.levelId &&
        row.modes?.includes('solo'),
    );
    assert.equal(matches.length, 1, `Unique native Classic source ${clip.id}`);
    return matches[0];
  });
  const selectedPaths = [...new Set(selectedRows.map((row) => row.sourceFile.path))];
  const nativeEntries = await Promise.all(
    [
      'game/demo-data/catalog.json',
      'game/content/mission-library-index.json',
      ...selectedPaths,
    ].map(async (name) => ({ name, bytes: await readFile(path.join(root, name)) })),
  );
  const selectedNative = classicDemoSourcePaths(nativeEntries);
  const classic = [...selectedNative].sort().map((p) => ({
    path: p,
    levels: new Set(
      selectedRows
        .filter((row) => row.sourceFile.path === p)
        .map((row) => `${row.campaignKey}:${row.levelId}`),
    ).size,
    present: entries.has(p),
  }));
  requiredNative.push(...classic.map((row) => ({ path: row.path, owner: 'solo-classic' })));
  const journeys = [],
    generatedNative = new Map();
  for (const routeId of [...new Set(SOLO_BUILTIN_DEMO_INDEX.map((r) => r.routeId))]) {
    const rows = SOLO_BUILTIN_DEMO_INDEX.filter((r) => r.routeId === routeId),
      route = await loadAuthoredJourneyRoute(routeId, { fullSource: true });
    const snapshot = `game/content-design/runtime/${routeId}.json`,
      assetPaths = new Set();
    for (const row of rows) {
      const missions = route.source.missions.filter((m) => m.id === row.levelId);
      assert.equal(missions.length, 1);
      const id = missions[0].presentation.backgroundAssetId;
      if (id) {
        const asset = route.source.assets.find((a) => a.id === id);
        assert.ok(asset);
        assetPaths.add(`game/${asset.path}`);
      }
    }
    requiredNative.push(
      { path: snapshot, owner: routeId },
      ...[...assetPaths].map((p) => ({ path: p, owner: routeId })),
    );
    const snapshotBytes = Buffer.from(JSON.stringify(route));
    generatedNative.set(snapshot, snapshotBytes);
    journeys.push({
      routeId,
      levels: rows.length,
      snapshot,
      present: entries.has(snapshot),
      snapshotBytes: snapshotBytes.length,
      snapshotSha256: sha(snapshotBytes),
      selectedAssetPaths: [...assetPaths].sort(),
      missingAssets: [...assetPaths].filter((p) => !entries.has(p)),
    });
  }
  const roots = [
    'authoring/production/preview.mjs',
    'authoring/design-atlas/reveal-audit.mjs',
    'authoring/design-atlas/reveal-audit-viewer.mjs',
    'game/demo-modes/solo.mjs',
    'game/demo-modes/solo-catalog.mjs',
    'game/demo-modes/snake.mjs',
    'game/demo-modes/sim.mjs',
    'game/demo-modes/survival.mjs',
  ];
  const visited = new Set(),
    missingModules = [],
    queue = [...roots];
  while (queue.length) {
    const name = queue.shift();
    if (visited.has(name)) continue;
    visited.add(name);
    const item = entries.get(name);
    if (!item) {
      missingModules.push(name);
      continue;
    }
    if (!/\.(mjs|js)$/.test(name)) continue;
    const ast = parse(item.bytes.toString(), { ecmaVersion: 'latest', sourceType: 'module' });
    const literals = [];
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (
        [
          'ImportDeclaration',
          'ExportNamedDeclaration',
          'ExportAllDeclaration',
          'ImportExpression',
        ].includes(node.type) &&
        node.source?.type === 'Literal' &&
        typeof node.source.value === 'string'
      )
        literals.push(node.source.value);
      for (const v of Object.values(node)) {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') walk(v);
      }
    }
    walk(ast);
    for (const spec of literals)
      if (spec.startsWith('.'))
        queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(name), spec)));
  }
  const missingNative = requiredNative.filter((r) => !entries.has(r.path));
  const mismatchedNative = [];
  for (const name of new Set(requiredNative.map((row) => row.path))) {
    if (!entries.has(name)) continue;
    const source = await demoNativeDependencyBytes(
      name,
      generatedNative.get(name) ?? (await readFile(path.join(root, name))),
    );
    if (sha(source) !== sha(entries.get(name).bytes))
      mismatchedNative.push({
        path: name,
        expectedSHA256: sha(source),
        actualSHA256: sha(entries.get(name).bytes),
      });
  }
  const mismatchedPayloads = [];
  for (const name of required) {
    if (!entries.has(name)) continue;
    const source = await readFile(path.join(root, name));
    if (sha(source) !== sha(entries.get(name).bytes)) mismatchedPayloads.push(name);
  }
  const payloadBytes = project.manifest.totalBytes + project.manifestBytes.length;
  // Stage only the small generated metadata using its real producer; all gameplay
  // and practice bodies remain in memory. No expanded distribution or ZIP is written.
  const finalEntries = new Map(entries);
  const overlay = await frozenOptionalPackageOverlay(
    await json('publishing/pages-controller/optional-packages.json'),
    {
      targetBasePath: '/revealline/',
      readReleaseAsset: () =>
        assert.fail('This local evidence run cannot silently download selected package releases.'),
    },
  );
  for (const [name, bytes] of overlay) {
    assert.ok(!finalEntries.has(name));
    finalEntries.set(name, { name, bytes });
  }
  const markerName = '.xonix-build.json';
  assert.ok(!finalEntries.has(markerName));
  finalEntries.set(markerName, {
    name: markerName,
    bytes: Buffer.from(
      JSON.stringify({ tool: 'xonix-game-cli', formatVersion: 1 }, null, 2) + '\n',
    ),
  });
  const metadataRoot = await mkdtemp(path.join(root, '.cache/main-pages-metadata-'));
  try {
    const staged = path.join(metadataRoot, 'main-pages');
    await mkdir(path.join(staged, 'game'), { recursive: true });
    await writeFile(path.join(staged, 'game/index.html'), entries.get('game/index.html').bytes);
    execFileSync(process.execPath, ['scripts/write-main-pages-metadata.mjs'], {
      cwd: root,
      env: {
        ...process.env,
        RUNNER_TEMP: metadataRoot,
        SOURCE_SHA: sourceRevision,
        SOURCE_COMMITTED_AT: git('show', '-s', '--format=%cI', sourceRevision),
        BUILD_VERSION: `main-${sourceRevision.slice(0, 12)}`,
      },
    });
    for (const name of ['main-deployment.json', 'release.json', 'releases/index.html']) {
      assert.ok(!finalEntries.has(name));
      finalEntries.set(name, { name, bytes: await readFile(path.join(staged, name)) });
    }
  } finally {
    await rm(metadataRoot, { recursive: true, force: true });
  }
  const stagedFiles = [...finalEntries]
    .map(([name, entry]) => ({ path: name, bytes: entry.bytes.length, sha256: sha(entry.bytes) }))
    .sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  const stagedBytes = stagedFiles.reduce((n, r) => n + r.bytes, 0);
  const archiveModel = gnuTarSize(stagedFiles);
  const catalogue = JSON.parse(entries.get('offline-content.json').bytes),
    ownerMap = new Map();
  for (const g of catalogue.groups)
    for (const p of g.files) {
      if (!ownerMap.has(p)) ownerMap.set(p, []);
      ownerMap.get(p).push(g.id);
    }
  const bySize = new Map(stagedFiles.map((r) => [r.path, r.bytes]));
  const groups = catalogue.groups
    .map((g) => ({
      id: g.id,
      category: g.category,
      files: g.files.length,
      directBytes: g.files.reduce((n, p) => n + (bySize.get(p) ?? 0), 0),
      exclusiveBytes: g.files
        .filter((p) => ownerMap.get(p).length === 1)
        .reduce((n, p) => n + (bySize.get(p) ?? 0), 0),
    }))
    .sort((a, b) => b.directBytes - a.directBytes);
  const baselineByPath = new Map(baselineFiles.map((r) => [r.path, r]));
  const changes = stagedFiles
    .filter((r) => baselineByPath.get(r.path)?.sha256 !== r.sha256)
    .map((r) => ({
      ...r,
      beforeBytes: baselineByPath.get(r.path)?.bytes ?? 0,
      deltaBytes: r.bytes - (baselineByPath.get(r.path)?.bytes ?? 0),
    }));
  const removed = baselineFiles.filter((r) => !finalEntries.has(r.path));
  const addedBodyBytes = changes.reduce((n, r) => n + r.deltaBytes, 0),
    removedBodyBytes = removed.reduce((n, r) => n + r.bytes, 0);
  assert.equal(
    stagedBytes - baselineFiles.reduce((n, r) => n + r.bytes, 0),
    addedBodyBytes - removedBodyBytes,
  );
  const currentArt = (await import('../game/presentation/current-art-sources.mjs'))
    .CURRENT_ART_SOURCES;
  const sourceInputPaths = new Set(await collectBuildFiles(root, await readBuildConfig(root)));
  const originals = [...new Set(currentArt.map((r) => r.sourceImagePath).filter(Boolean))]
    .filter((p) => sourceInputPaths.has(p))
    .map((p) => ({
      path: p,
      bytes: currentArt.find((row) => row.sourceImagePath === p).image.bytes,
      sha256: currentArt.find((row) => row.sourceImagePath === p).image.sha256,
      retained: finalEntries.has(p),
      sourcePresent: true,
      owners: currentArt
        .filter((r) => r.sourceImagePath === p)
        .map((r) => ({
          id: r.id,
          kind: r.kind,
          fallbackPaths:
            r.kind === 'external' ? [r.source.pack.path, r.source.media.path] : [r.source.path],
        })),
    }));
  for (const original of originals) {
    const bytes = await readFile(path.join(root, original.path));
    assert.equal(sha(bytes), original.sha256);
    assert.equal(bytes.length, original.bytes);
    if (!original.retained)
      for (const owner of original.owners)
        for (const p of owner.fallbackPaths)
          assert.ok(finalEntries.has(p), `Retained native source fallback ${p}`);
  }
  let omittedOriginalWorker;
  try {
    omittedOriginalWorker = omittedOriginalWorkerProof(project.entries, originals);
  } catch (error) {
    omittedOriginalWorker = { error: String(error.message) };
  }
  const after = await fingerprint(),
    buildAfter = await fingerprint(['scripts', 'authoring']);
  const report = {
    format: 'revealline-demo-main-pages-inspection.v1',
    started,
    finished: new Date().toISOString(),
    sourceRevision,
    sourceFingerprint: before,
    finalSourceFingerprint: after,
    buildInputFingerprint: buildBefore,
    finalBuildInputFingerprint: buildAfter,
    auditScriptSha256: sha(await readFile(new URL(import.meta.url))),
    headStable: sourceRevision === git('rev-parse', 'HEAD'),
    sourceStable: before.sha256 === after.sha256 && buildBefore.sha256 === buildAfter.sha256,
    publicationProfile: 'main-pages',
    materializedBuild: false,
    files: project.entries.length,
    payloadBytesIncludingManifest: payloadBytes,
    manifestDescriptor: { bytes: project.manifestBytes.length, sha256: sha(project.manifestBytes) },
    rollingMainPagesLimitBytes: 980000000,
    rollingCoreHeadroomBeforeOtherHostedComponents: 980000000 - payloadBytes,
    releasePlanningBudgetBytes: 950000000,
    wholeSiteCapacityAccepted: false,
    completeHostedFileInventory: true,
    publicEligible: false,
    publicationAssessment: 'not-performed',
    missingHostedComponents: [
      'Actual uploaded Pages artifact; this local run models GNU tar size but does not publish or admit an artifact',
    ],
    requiredPayloadsAndDiagnostics: required.length,
    missingPayloads: required.filter((p) => !entries.has(p)),
    mismatchedPayloads,
    literalDemoModuleClosure: { roots, files: visited.size, missingModules },
    requiredNativePaths: [...new Set(requiredNative.map((r) => r.path))].length,
    missingNative,
    mismatchedNative,
    nativeMetadataProjection: {
      path: 'game/content/mission-library-index.json',
      producer: 'scripts/default-runtime-metadata.mjs#projectDefaultRuntimeMetadata',
      contract:
        'Existing lossless JSON compaction only; all authored native sources retain exact byte checks.',
    },
    classic,
    journeys,
    finalStaged: {
      files: stagedFiles.length,
      bytes: stagedBytes,
      headroomBytes: 980000000 - stagedBytes,
      overlayFiles: overlay.size,
      metadataFiles: 4,
    },
    archiveSizeModel: {
      ...archiveModel,
      headroomBytes: 980000000 - archiveModel.bytes,
      baseline: {
        sourceRevision: baselineArchive.sourceRevision,
        actualMeasuredArchiveBytes: baselineArchive.archiveBytes,
        model: baselineModel,
        exactMatch: true,
      },
      actualUploadedArtifact: false,
    },
    ownershipGroups: groups,
    baselineEvidence: {
      inventory: { path: baselineInventory, sha256: sha(baselineBytes) },
      archive: { path: baselineArchivePath, sha256: sha(baselineArchiveBytes) },
    },
    baselineDelta: {
      sourceRevision: baselineArchive.sourceRevision,
      stagedBytes: stagedBytes - baselineArchive.stagedBytes,
      changedOrAddedFiles: changes.length,
      changedOrAddedDeltaBytes: addedBodyBytes,
      removedFiles: removed.length,
      removedBytes: removedBodyBytes,
      changes,
      removed,
    },
    sourceOriginals: originals,
    omittedOriginalWorker,
    limitations: [
      'This is a complete in-memory staged-file candidate with actual metadata producers, not upload or deployment admission. The archive figure is a baseline-calibrated GNU tar size model.',
      'Native dependency audit covers catalog-selected authored Classic source bodies and base artwork, exact Journey full-source snapshots and selected backgrounds, plus literal demo module imports; dynamic data-driven asset transport remains independently qualified.',
    ],
  };
  report.errors = mainPagesAuditFailures(report);
  report.complete = report.errors.length === 0;
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await writeFile(inventoryOutput, JSON.stringify({ sourceRevision, files: stagedFiles }) + '\n', {
    flag: 'wx',
  });
  console.log(
    JSON.stringify(
      {
        ...report,
        baselineDelta: { ...report.baselineDelta, changes: undefined, removed: undefined },
        sourceOriginals: undefined,
        ownershipGroups: undefined,
        classic: classic.filter((r) => !r.present),
        journeys: journeys.map(({ selectedAssetPaths, ...r }) => r),
      },
      null,
      2,
    ),
  );
  return report;
}
export function gnuTarSize(files) {
  assert.ok(Array.isArray(files), 'Archive inventory must be complete.');
  const paths = new Set();
  for (const row of files) {
    assert.ok(
      typeof row.path === 'string' &&
        row.path.length &&
        !row.path.startsWith('/') &&
        !row.path.includes('\\') &&
        !/[\x00-\x1f]/.test(row.path) &&
        row.path.split('/').every((part) => part && part !== '.' && part !== '..'),
      'Archive inventory needs safe regular file paths.',
    );
    assert.ok(!paths.has(row.path), 'Archive inventory cannot duplicate a path.');
    paths.add(row.path);
    assert.ok(
      Number.isSafeInteger(row.bytes) && row.bytes >= 0,
      'Archive body size must be a bounded integer.',
    );
  }
  const directories = new Set(['.']);
  for (const { path: p } of files) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join('/'));
  }
  const names = [
    ...files.map((r) => ({ name: './' + r.path, bytes: r.bytes })),
    ...[...directories].map((p) => ({ name: p === '.' ? './' : './' + p + '/', bytes: 0 })),
  ];
  assert.ok(
    [...directories].every((name) => !paths.has(name)),
    'Archive files cannot also own directories.',
  );
  let longPaths = 0;
  const blocks = names.reduce((n, r) => {
    const length = Buffer.byteLength(r.name);
    assert.ok(length < 512, 'Bounded GNU long-name header assumption.');
    if (length > 100) longPaths++;
    return n + 512 + Math.ceil(r.bytes / 512) * 512 + (length > 100 ? 1024 : 0);
  }, 1024);
  assert.ok(Number.isSafeInteger(blocks), 'Archive byte arithmetic must be exact.');
  return {
    bytes: Math.ceil(blocks / 10240) * 10240,
    files: files.length,
    directories: directories.size,
    longPaths,
    blockBytes: 512,
    recordBytes: 10240,
    terminalBytes: 1024,
    format:
      'GNU tar with long-name records; regular files and parent directories; no xattrs, sparse bodies, links, or PAX metadata',
  };
}

export function mainPagesAuditArguments(args) {
  const result = {};
  const names = new Map([
    ['report', 'reportPath'],
    ['baseline-inventory', 'baselineInventory'],
    ['baseline-archive', 'baselineArchive'],
  ]);
  for (const arg of args) {
    const match = /^--([^=]+)=(.+)$/.exec(arg);
    assert.ok(match && names.has(match[1]), `Unknown argument: ${arg}`);
    const key = names.get(match[1]);
    assert.ok(!Object.hasOwn(result, key), `Duplicate argument: ${arg}`);
    result[key] = match[2];
  }
  assert.ok(result.reportPath, 'An explicit --report=path.json is required.');
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await qualifyDemoMainPages(mainPagesAuditArguments(process.argv.slice(2)));
    if (!report.complete) process.exitCode = 1;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
