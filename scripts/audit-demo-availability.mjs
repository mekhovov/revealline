#!/usr/bin/env node
/** Real-core source preparation audit. Not browser/device/visual qualification. */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { createExecutionCatalog } from '../game/campaign-contexts.mjs';
import { loadAuthoredJourneyRoute } from '../game/content-design/route-loader.mjs';
import { createSoloRouteHost } from '../game/content-design/solo-route-host.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../game/content-design/default-entry.mjs';
import { loadEditionBootstrap } from '../game/editions/bootstrap.mjs';
import { loadDemoSources } from '../game/demo-sources.mjs';
import { withDemoLoadingDeadline } from '../game/demo-loading.mjs';
import { authoritativeCheckpoint, verifyReplayAsync, MAX_REPLAY_TICKS } from '../game/replay.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const config = {
  policies: ['immediate', 'grid-center'],
  offline: false,
  workers: true,
  inventoryOnly: false,
  limit: Infinity,
  packs: [],
  levels: [],
  edition: null,
  journey: false,
  report: '.cache/demo-availability.json',
};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--journey') config.journey = true;
  else if (arg === '--edition' && args[i + 1]) config.edition = args[++i];
  else if (arg === '--offline') config.offline = true;
  else if (arg === '--without-worker') config.workers = false;
  else if (arg === '--inventory-only') config.inventoryOnly = true;
  else if (arg === '--pack' && args[i + 1]) config.packs.push(args[++i]);
  else if (arg === '--level' && args[i + 1]) config.levels.push(args[++i]);
  else if (arg === '--report' && args[i + 1]) config.report = args[++i];
  else if (arg === '--limit' && args[i + 1]) config.limit = Number(args[++i]);
  else if (arg === '--policy' && args[i + 1]) config.policies = [args[++i]];
  else throw new Error(`Unknown audit argument: ${arg}`);
}
if (!config.policies.every((p) => ['immediate', 'grid-center'].includes(p)) || !(config.limit > 0))
  throw new Error('Invalid audit policy or limit.');
if (!config.levels.every((id) => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(id)))
  throw new Error('Invalid audit level ID.');
if (config.edition && (config.journey || config.packs.length))
  throw new Error('An edition audit cannot include other communities or packs.');
const inputFiles = new Set();
const readJSON = async (name) => {
  inputFiles.add(name);
  return JSON.parse(await readFile(path.resolve(root, name), 'utf8'));
};
let entries, host;
if (config.edition) {
  const bootstrap = await loadEditionBootstrap({
    catalogURL: new URL('../game/editions/catalog.json', import.meta.url).href,
    contentBaseURL: new URL('../', import.meta.url).href,
    editionId: config.edition,
    fetcher: async (url) => {
      const name = path.relative(root, fileURLToPath(url));
      inputFiles.add(name);
      return { ok: true, text: () => readFile(path.resolve(root, name), 'utf8') };
    },
  });
  host = await createSoloRouteHost(bootstrap.route, {
    themes: bootstrap.boot.themes.themes,
    buildVersion: 'demo-availability-audit',
  });
  entries = [
    ...host.entries,
    ...createExecutionCatalog([
      {
        campaign: { ...bootstrap.boot.campaign, classRecipes: bootstrap.boot.classes },
        classRecipes: bootstrap.boot.classes,
      },
    ]).entries,
  ];
} else {
  const [campaign, classes, ...packs] = await Promise.all(
    [
      'game/content/campaign.json',
      'game/content/classes.json',
      ...(config.packs.length
        ? config.packs
        : config.journey
          ? []
          : ['game/content/packs/fpv-arcade-r5.json']),
    ].map(readJSON),
  );
  entries = createExecutionCatalog([
    { campaign: { ...campaign, classRecipes: classes }, classRecipes: classes },
    ...packs.flatMap((pack) =>
      pack.campaigns.map((campaign) => ({
        campaign: { ...campaign, classRecipes: pack.classRecipes },
        classRecipes: pack.classRecipes,
        sourcePackId: pack.id,
      })),
    ),
  ]).entries;
  if (config.journey) {
    const route = await loadAuthoredJourneyRoute(DEFAULT_JOURNEY_ROUTES.solo);
    host = await createSoloRouteHost(route, {
      themes: (await readJSON('game/content-design/themes.json')).themes,
      buildVersion: 'demo-availability-audit',
    });
    entries = [...host.entries, ...entries];
  }
}
// Pin the resolved maps/equipment as well as the implementation files. This is
// an audit of supplied installed content, never a request to install content.
const contentSnapshot = entries
  .filter((entry) => !entry.difficulty || entry.difficulty === 'standard')
  .map((entry) => ({ campaign: entry.campaign, classRecipes: entry.classRecipes }));
const sourceFiles = [
  ...new Set([
    ...inputFiles,
    'scripts/audit-demo-availability.mjs',
    'game/i18n/index.mjs',
    'game/i18n/catalogs.mjs',
    'game/mastery.mjs',
    ...(await readdir(path.join(root, 'game')))
      .filter(
        (n) =>
          n.endsWith('.mjs') && /^(demo|replay|campaign|gameplay-tuning|data-json|library)/.test(n),
      )
      .map((n) => `game/${n}`),
    ...(await readdir(path.join(root, 'game/core')))
      .filter((n) => n.endsWith('.mjs'))
      .map((n) => `game/core/${n}`),
    ...(await readdir(path.join(root, 'game/demo-data')))
      .filter((n) => n.endsWith('.json'))
      .map((n) => `game/demo-data/${n}`),
  ]),
];
const hashes = async () =>
  Object.fromEntries(
    await Promise.all(
      sourceFiles.map(async (name) => [
        name,
        createHash('sha256')
          .update(await readFile(path.resolve(root, name)))
          .digest('hex'),
      ]),
    ),
  );
let adapterListeners = 0;
const workers = new Set(),
  shutdowns = new Set();
class AuditWorker {
  constructor(url) {
    this.handlers = new Map();
    this.worker = new Worker(
      new URL(
        `data:text/javascript,${encodeURIComponent(`import {parentPort} from 'node:worker_threads'; globalThis.postMessage = data => parentPort.postMessage(data); globalThis.addEventListener = (type, fn) => parentPort.on(type, data => fn({data})); await import(${JSON.stringify(url.href)});`)}`,
      ),
      { type: 'module', execArgv: [] },
    );
    workers.add(this);
  }
  addEventListener(type, fn) {
    const wrapper = type === 'message' ? (data) => fn({ data }) : fn;
    this.handlers.set(fn, [type, wrapper]);
    adapterListeners++;
    this.worker.on(type, wrapper);
  }
  removeEventListener(type, fn) {
    const entry = this.handlers.get(fn);
    if (entry) {
      this.worker.off(entry[0], entry[1]);
      this.handlers.delete(fn);
      adapterListeners--;
    }
  }
  postMessage(data) {
    this.worker.postMessage(data);
  }
  terminate() {
    if (!workers.delete(this)) return this.shutdown;
    const pending = (this.shutdown = this.worker.terminate());
    shutdowns.add(pending);
    pending.finally(() => shutdowns.delete(pending));
    return pending;
  }
}
const fetchAsset = async (url, { signal } = {}) => {
  if (config.offline && !url.pathname.endsWith('/catalog.json'))
    return new Response('', { status: 404 });
  const file = fileURLToPath(url);
  if (!file.startsWith(path.join(root, 'game') + path.sep))
    throw new Error('Audit fetch outside game assets.');
  return new Response(await readFile(file, { signal }));
};
const started = performance.now();
const report = {
  format: 'revealline-demo-availability.v1',
  startedAt: new Date().toISOString(),
  config: { ...config, limit: Number.isFinite(config.limit) ? config.limit : null },
  qualification:
    'Node real-core preparation and replay verification. Not real hardware, browser scheduling, audio or viewing quality.',
  sources: [],
  sourceHashes: await hashes(),
  contentSHA256: createHash('sha256').update(JSON.stringify(contentSnapshot)).digest('hex'),
  levelCoverage: [],
  discovery: [],
  changedSources: [],
  errors: [],
};
const reportPath = path.resolve(root, config.report);
await mkdir(path.dirname(reportPath), { recursive: true });
const save = async () => {
  report.elapsedSeconds = (performance.now() - started) / 1000;
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
};
try {
  for (const turnPolicy of config.policies) {
    const discoveryStart = performance.now();
    const registered = await loadDemoSources({
      entries,
      library: { list: async () => [] },
      turnPolicy,
      fetch: fetchAsset,
      WorkerClass: config.workers ? AuditWorker : null,
    });
    const sources = config.levels.length
      ? registered.filter((source) => config.levels.includes(source.levelId))
      : registered;
    for (const id of config.levels)
      if (!sources.some((source) => source.levelId === id))
        throw new Error(`Requested audit level is not registered: ${id}`);
    report.discovery.push({
      turnPolicy,
      elapsedMs: Math.round(performance.now() - discoveryStart),
      sources: sources.length,
      registeredSources: registered.length,
    });
    for (const entry of entries.filter(
      (entry) => !entry.difficulty || entry.difficulty === 'standard',
    ))
      for (const level of entry.campaign.levels.filter(
        (level) => !config.levels.length || config.levels.includes(level.id),
      ))
        report.levelCoverage.push({
          executionKey: entry.executionKey,
          levelId: level.id,
          turnPolicy,
          sourceIds: sources
            .filter((source) => source.entry === entry && source.levelId === level.id)
            .map((source) => source.id),
        });
    for (const [index, source] of sources.entries()) {
      const row = {
        id: source.id,
        levelKey: source.levelKey,
        kind: source.kind,
        turnPolicy,
        status: 'not-exercised',
      };
      report.sources.push(row);
      if (config.inventoryOnly || index >= config.limit) continue;
      const before = performance.now();
      let player;
      try {
        player = await withDemoLoadingDeadline((signal) => source.create({ signal }), {
          onLateResult: (value) => value?.dispose(),
        });
        row.preparationMs = Math.round(performance.now() - before);
        player.play();
        let frames = 0;
        while (player.phase === 'playing') {
          await player.planning;
          player.advance(0.25);
          if (
            ++frames > Math.ceil(MAX_REPLAY_TICKS / 30) + 120 ||
            performance.now() - before > 120000
          )
            throw new Error('Playback exceeded bounded progress limit.');
          if (frames % 60 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (player.phase !== 'complete' || !['won', 'lost'].includes(player.state.status))
          throw new Error(`Nonterminal endpoint: ${player.phase}/${player.state.status}`);
        const recording = player.exportRecording();
        const verified = await verifyReplayAsync(recording);
        if (
          !verified.match ||
          authoritativeCheckpoint(player.state).hash !== recording.checkpoint.hash
        )
          throw new Error('Final checkpoint did not reproduce.');
        Object.assign(row, {
          status: 'verified',
          result: player.state.status,
          simulationSeconds: recording.ticks / 120,
          coverage: player.state.coverage,
          lives: player.state.lives,
        });
      } catch (error) {
        Object.assign(row, {
          status: 'failed',
          error: { name: error.name, code: error.code ?? null, message: error.message },
        });
      } finally {
        player?.dispose();
        await Promise.all([...shutdowns]);
        row.elapsedMs = Math.round(performance.now() - before);
        console.log(JSON.stringify(row));
        await save();
      }
    }
  }
} catch (error) {
  report.errors.push({ name: error.name, message: error.message });
} finally {
  host?.preparer.dispose();
  report.cleanup = { ownersBeforeForcedCleanup: workers.size, listeners: adapterListeners };
  for (const worker of workers) worker.terminate();
  await Promise.all([...shutdowns]);
  const finalHashes = await hashes();
  report.changedSources = sourceFiles.filter(
    (name) => report.sourceHashes[name] !== finalHashes[name],
  );
  report.finishedAt = new Date().toISOString();
  for (const level of report.levelCoverage)
    level.verifiedSourceIds = level.sourceIds.filter((id) =>
      report.sources.some(
        (source) =>
          source.id === id &&
          source.turnPolicy === level.turnPolicy &&
          source.status === 'verified',
      ),
    );
  report.summary = {
    registered: report.sources.length,
    registeredLevels: report.levelCoverage.length,
    usableLevels: report.levelCoverage.filter((level) => level.verifiedSourceIds.length).length,
    verified: report.sources.filter((s) => s.status === 'verified').length,
    failed: report.sources.filter((s) => s.status === 'failed').length,
    notExercised: report.sources.filter((s) => s.status === 'not-exercised').length,
    remainingWorkers: workers.size,
    uncoveredLevels: report.levelCoverage.filter((level) => !level.sourceIds.length).length,
  };
  report.passed =
    !report.errors.length &&
    !report.cleanup.ownersBeforeForcedCleanup &&
    !report.cleanup.listeners &&
    !report.changedSources.length &&
    !report.summary.failed &&
    !report.summary.notExercised &&
    !report.summary.uncoveredLevels &&
    report.summary.verified > 0;
  if (!report.passed && !config.inventoryOnly) process.exitCode = 1;
  await save();
}
