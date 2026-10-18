#!/usr/bin/env node
/** Full production admission in memory. No distribution or ZIP is written. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const json = async (name) => JSON.parse(await readFile(path.join(root, name)));
const relevant = (name) =>
  /^(game\/(demo[^/]*|demo-modes\/[^/]+|ui\/demo-[^/]+)|optional-practice\/civilian-fpv\/(demo-[^/]+|demonstration-resolver\.mjs|world-app\.mjs)|game\/(main|snake\/classic-app|overflight\/app)\.mjs)$/.test(
    name,
  ) ||
  [
    'game/controller-router.mjs',
    'game/ui/native-menus.mjs',
    'game/ui/mode-play-shell.mjs',
    'game/ui/mode-play-shell.css',
    'game/ui/owned-phaser-game.mjs',
    'game/overflight/renderer.mjs',
    'optional-practice/civilian-fpv/flight-fullscreen.mjs',
  ].includes(name) ||
  name.startsWith('game/demo-data/') ||
  name.startsWith('optional-practice/civilian-fpv/demo-data/');

export const isOfflineDiagnosticArtifact = (name) =>
  /(?:^|\/)scripts\/(?:demo-tick-|diagnose-demo-ticks|qualify-demo-ticks)/.test(name) ||
  /\.(?:trace|receipt)\.json$/.test(name);

/** Resolve only authored relative body URLs; duplicate references count once. */
export function demoPackagingRequirements({
  soloCatalogs,
  simIndex,
  snakeCatalog,
  survivalCatalog,
  survivalVariants,
}) {
  const payloads = new Set();
  const addSolo = (url, diagnostics) => {
    assert.equal(typeof url, 'string', 'Demo body URL must be a string.');
    assert.match(
      url,
      /^\.\/demo-data\/[a-zA-Z0-9._/-]+\.replay\.json$/,
      'Demo body URL must stay in game/demo-data.',
    );
    assert.ok(!url.split('/').includes('..'), 'Demo body URL cannot traverse directories.');
    const target = `game/${url.slice(2)}`;
    payloads.add(target);
    if (diagnostics) payloads.add(target.replace(/\.replay\.json$/, '.diagnostics.json'));
  };
  for (const catalog of soloCatalogs)
    for (const clip of catalog.clips) {
      const diagnostics = clip.id.startsWith('solo-qualified-');
      for (const url of [
        clip.replayURL,
        ...(clip.replayVariants ?? []),
        ...(clip.runtimePerformances ?? []).map((row) => row.replayURL),
      ])
        addSolo(url, diagnostics);
    }
  for (const row of simIndex.entries) {
    assert.match(row.file, /^[a-zA-Z0-9._-]+\.json$/, 'SIM payload must be a local filename.');
    payloads.add(`optional-practice/civilian-fpv/demo-data/${row.file}`);
  }
  for (const row of snakeCatalog.entries) {
    assert.match(row.levelId, /^[a-zA-Z0-9_-]+$/);
    payloads.add(`game/demo-data/snake/${row.levelId}.replay.json`);
  }
  for (const row of survivalCatalog.entries) {
    assert.match(row.levelId, /^[a-zA-Z0-9_-]+$/);
    for (const variant of ['', ...survivalVariants]) {
      assert.match(variant, /^[a-zA-Z0-9_-]*$/);
      payloads.add(
        `game/demo-data/survival/${row.levelId}${variant ? `.${variant}` : ''}.replay.json`,
      );
    }
  }
  return [...payloads].sort();
}

/** Same ordered production identity used by the browser qualification freeze. */
async function sourceSnapshot(directories, filter) {
  const files = execFileSync('rg', ['--files', ...directories], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
    .trim()
    .split('\n')
    .filter(filter)
    .sort();
  const hash = createHash('sha256');
  const digests = new Map();
  let bytes = 0;
  for (const name of files) {
    const body = await readFile(path.join(root, name));
    const sha256 = digest(body);
    digests.set(name, sha256);
    bytes += body.length;
    hash.update(name + '\0').update(Buffer.from(sha256, 'hex'));
  }
  return { sha256: hash.digest('hex'), files: files.length, bytes, digests };
}
const productionSource = (name) =>
  /\.(mjs|js|json|css|html)$/.test(name) &&
  !name.includes('/test/') &&
  !name.endsWith('.test.mjs') &&
  !name.endsWith('/coverage.json');
export const demoPackagingEmissionSources = (entries) =>
  entries.filter((entry) => relevant(entry.name) && productionSource(entry.name));

const snapshotSummary = ({ sha256, files, bytes }) => ({ sha256, files, bytes });

export async function qualifyDemoPackaging({
  reportPath = '.cache/shared-demos-final-packaging.json',
} = {}) {
  const output = path.resolve(root, reportPath);
  try {
    await stat(output);
    throw new Error(`Refusing to overwrite existing packaging evidence: ${output}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const sourceRevision = git('rev-parse', 'HEAD');
  const mainRevision = git('rev-parse', 'origin/main');
  const integrationBase = git('merge-base', 'HEAD', 'origin/main');
  const started = new Date().toISOString();
  const before = await sourceSnapshot(
    ['game', 'optional-practice', 'publishing'],
    productionSource,
  );
  const buildBefore = await sourceSnapshot(
    ['scripts'],
    (name) => /\.mjs$/.test(name) && !path.basename(name).startsWith('test-'),
  );
  console.log(
    JSON.stringify({
      phase: 'source-snapshot',
      ...snapshotSummary(before),
      sourceRevision,
      started,
    }),
  );
  const { prepareBuildProject } = await import('./game-cli.mjs');
  const { buildOptionalPractice } = await import('./build-optional-practice.mjs');
  const { projectDefaultRuntimeMetadata } = await import('./default-runtime-metadata.mjs');
  const { SURVIVAL_DEMO_RUNTIME_VARIANTS } = await import(
    '../game/demo-modes/survival-runtime-variants.mjs'
  );
  const project = await prepareBuildProject({ root });
  console.log(JSON.stringify({ phase: 'hosted-build-validated', files: project.entries.length }));
  const names = new Set(project.entries.map((entry) => entry.name));
  for (const name of [
    'game/demo-settings.mjs',
    'game/demo-runtime.mjs',
    'game/demo-modes/sim.mjs',
    'game/ui/demo-entry.mjs',
    'game/ui/owned-phaser-game.mjs',
    'game/overflight/renderer.mjs',
  ])
    assert.ok(names.has(name), `Missing shared runtime dependency: ${name}`);
  const catalogNames = [
    'catalog.json',
    'catalog.journey-current.json',
    'catalog.journey-archive.json',
  ];
  const soloCatalogs = await Promise.all(
    catalogNames.map((name) => json(`game/demo-data/${name}`)),
  );
  const simIndex = await json('optional-practice/civilian-fpv/demo-data/index.json');
  const snakeCatalog = await json('game/demo-data/snake/catalog.json');
  const survivalCatalog = await json('game/demo-data/survival/catalog.json');
  const metadata = [
    ...catalogNames.map((name) => `game/demo-data/${name}`),
    'optional-practice/civilian-fpv/demo-data/index.json',
    'game/demo-data/snake/catalog.json',
    'game/demo-data/survival/catalog.json',
  ];
  const required = demoPackagingRequirements({
    soloCatalogs,
    simIndex,
    snakeCatalog,
    survivalCatalog,
    survivalVariants: SURVIVAL_DEMO_RUNTIME_VARIANTS,
  });
  const missing = [...metadata, ...required].filter((name) => !names.has(name));
  const core = JSON.parse(
    project.entries.find((entry) => entry.name === 'offline-cache.json').bytes,
  );
  const optional = await buildOptionalPractice(root, { packageId: 'fpv-worlds' });
  const sim = project.entries.filter((entry) =>
    entry.name.startsWith('optional-practice/civilian-fpv/demo-data/'),
  );
  const report = {
    sourceRevision,
    mainRevision,
    integrationBase,
    started,
    sourceFingerprint: snapshotSummary(before),
    buildFingerprint: snapshotSummary(buildBefore),
    materializedBuild: false,
    files: project.manifest.files.length,
    bytes: project.manifest.totalBytes,
    simPerformances: simIndex.entries.length,
    simFiles: sim.length,
    simBytes: sim.reduce((sum, entry) => sum + entry.bytes.length, 0),
    soloClips: soloCatalogs.reduce((sum, catalog) => sum + catalog.clips.length, 0),
    snakePerformances: snakeCatalog.entries.length,
    survivalPerformances: survivalCatalog.entries.length,
    requiredPayloadsAndDiagnostics: required.length,
    missingPayloads: missing,
    coreCacheFiles: core.files.length,
    coreCacheBytes: core.files.reduce((sum, entry) => sum + entry.bytes, 0),
    coreCacheLimits: { files: 2000, bytes: 80 * 1024 * 1024 },
    simCoreCacheEntries: core.files.filter((entry) =>
      entry.path.includes('civilian-fpv/demo-data/'),
    ),
    coreDemoPayloads: core.files.filter(
      (entry) =>
        entry.path.startsWith('game/demo-data/') &&
        /\.(replay|diagnostics)\.json$/.test(entry.path),
    ),
    offlineDiagnosticArtifacts: project.entries
      .filter((entry) => isOfflineDiagnosticArtifact(entry.name))
      .map((entry) => entry.name),
    standalone: {
      files: optional.entries.length,
      bytes: optional.entries.reduce((sum, entry) => sum + entry.bytes.length, 0),
      zipBytes: optional.zip.length,
      limits: optional.manifest.limits,
      demonstrations: optional.entries.filter((entry) => entry.name.includes('/demo-data/')).length,
      offlineDiagnosticArtifacts: optional.entries
        .filter((entry) => isOfflineDiagnosticArtifact(entry.name))
        .map((entry) => entry.name),
    },
  };
  const emitted = demoPackagingEmissionSources(project.entries);
  const expected = [];
  report.sourceDigests = [];
  for (const entry of emitted) {
    const body = await readFile(path.join(root, entry.name));
    assert.ok(before.digests.has(entry.name), `Source snapshot omitted ${entry.name}`);
    report.sourceDigests.push({
      path: entry.name,
      sourceSha256: digest(body),
      sha256: digest(entry.bytes),
    });
    expected.push({ name: entry.name, bytes: body });
  }
  // This finite upstream projection checks AST/tokens/comments/newlines itself.
  // It permits its known formatting projection, never arbitrary source drift.
  await projectDefaultRuntimeMetadata(root, expected);
  const expectedByName = new Map(expected.map((entry) => [entry.name, entry]));
  report.unexpectedEmissionChanges = emitted
    .filter((entry) => !entry.bytes.equals(expectedByName.get(entry.name).bytes))
    .map((entry) => entry.name);
  report.intentionalDistributionProjections = emitted
    .filter((entry) => digest(entry.bytes) !== before.digests.get(entry.name))
    .map((entry) => entry.name);
  const after = await sourceSnapshot(['game', 'optional-practice', 'publishing'], productionSource);
  const buildAfter = await sourceSnapshot(
    ['scripts'],
    (name) => /\.mjs$/.test(name) && !path.basename(name).startsWith('test-'),
  );
  report.finalSourceFingerprint = snapshotSummary(after);
  report.finalBuildFingerprint = snapshotSummary(buildAfter);
  report.finished = new Date().toISOString();
  report.complete =
    missing.length === 0 &&
    report.simCoreCacheEntries.length === 0 &&
    report.coreDemoPayloads.length === 0 &&
    report.offlineDiagnosticArtifacts.length === 0 &&
    report.standalone.offlineDiagnosticArtifacts.length === 0 &&
    report.standalone.demonstrations === 0 &&
    report.unexpectedEmissionChanges.length === 0 &&
    after.sha256 === before.sha256 &&
    buildBefore.sha256 === buildAfter.sha256 &&
    git('rev-parse', 'HEAD') === sourceRevision;
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  assert.equal(report.complete, true, `Packaging qualification failed; inspect ${output}`);
  console.log(
    JSON.stringify(
      {
        ...report,
        sourceDigests: `${report.sourceDigests.length} exact hashes retained in report`,
      },
      null,
      2,
    ),
  );
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(
    args.length <= 1 && (!args.length || args[0].startsWith('--report=')),
    'Use optional --report=path.json.',
  );
  await qualifyDemoPackaging({
    ...(args.length ? { reportPath: args[0].slice('--report='.length) } : {}),
  });
}
