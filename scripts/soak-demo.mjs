#!/usr/bin/env node
/** Accelerated simulation soak, not wall-time/browser/GPU/device qualification. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { createExecutionCatalog } from '../game/campaign-contexts.mjs';
import { createDemoDirector } from '../game/demo-director.mjs';
import { loadDemoSources } from '../game/demo-sources.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../game/replay.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const usage =
  'node --expose-gc scripts/soak-demo.mjs [--simulation-seconds 7200] [--report .cache/demo-soak-report.json]';
const args = process.argv.slice(2);
let requestedSeconds = 7200,
  reportFile = path.join(ROOT, '.cache/demo-soak-report.json');
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--simulation-seconds' && args[i + 1]) requestedSeconds = Number(args[++i]);
  else if (args[i] === '--report' && args[i + 1]) reportFile = path.resolve(args[++i]);
  else throw new Error(usage);
}
assert.ok(
  Number.isFinite(requestedSeconds) && requestedSeconds >= 1 && requestedSeconds <= 86400,
  usage,
);

class SoakWorker {
  static owners = 0;
  static running = 0;
  static listeners = 0;
  static created = 0;
  static peakRunning = 0;
  static shutdowns = new Set();
  constructor(url) {
    this.listeners = new Map();
    this.worker = new Worker(
      new URL(
        `data:text/javascript,${encodeURIComponent(`
      import { parentPort } from 'node:worker_threads';
      globalThis.postMessage = data => parentPort.postMessage(data);
      globalThis.addEventListener = (type, fn) => parentPort.on(type, data => fn({data}));
      await import(${JSON.stringify(url.href)});
    `)}`,
      ),
      { type: 'module', execArgv: [] },
    );
    SoakWorker.created++;
    SoakWorker.owners++;
    SoakWorker.running++;
    SoakWorker.peakRunning = Math.max(SoakWorker.peakRunning, SoakWorker.running);
    this.worker.once('exit', () => {
      SoakWorker.running--;
    });
  }
  addEventListener(type, listener) {
    const wrapper = type === 'message' ? (data) => listener({ data }) : listener;
    this.listeners.set(listener, [type, wrapper]);
    this.worker.on(type, wrapper);
    SoakWorker.listeners++;
  }
  removeEventListener(type, listener) {
    const entry = this.listeners.get(listener);
    if (entry) {
      this.worker.off(type, entry[1]);
      this.listeners.delete(listener);
      SoakWorker.listeners--;
    }
  }
  postMessage(data) {
    this.worker.postMessage(data);
  }
  terminate() {
    if (this.stopped) return;
    this.stopped = true;
    SoakWorker.owners--;
    const shutdown = this.worker.terminate();
    SoakWorker.shutdowns.add(shutdown);
    shutdown.finally(() => SoakWorker.shutdowns.delete(shutdown));
  }
}

const readJSON = async (name) => JSON.parse(await readFile(path.join(ROOT, name), 'utf8'));
const sourceFiles = [
  'scripts/soak-demo.mjs',
  'game/demo-director.mjs',
  'game/demo-sources.mjs',
  'game/demo-catalog.mjs',
  'game/demo-bot.mjs',
  'game/demo-bot-player.mjs',
  'game/demo-bot-worker.mjs',
  'game/replay.mjs',
  'game/replay-player.mjs',
  'game/campaign-contexts.mjs',
  'game/campaign-difficulty.mjs',
  'game/data-json.mjs',
  'game/gameplay-tuning.mjs',
  'game/gameplay-tuning-v1.mjs',
  'game/gameplay-tuning-v2.mjs',
  'game/gameplay-tuning-v3.mjs',
  'game/content/campaign.json',
  'game/content/classes.json',
  'game/content/packs/fpv-arcade-r5.json',
  ...(await readdir(path.join(ROOT, 'game/core')))
    .filter((name) => name.endsWith('.mjs'))
    .map((name) => `game/core/${name}`),
  ...(await readdir(path.join(ROOT, 'game/demo-data')))
    .filter((name) => name.endsWith('.json'))
    .map((name) => `game/demo-data/${name}`),
];
const sourceHashes = async () =>
  Object.fromEntries(
    await Promise.all(
      sourceFiles.map(async (file) => [
        file,
        createHash('sha256')
          .update(await readFile(path.join(ROOT, file)))
          .digest('hex'),
      ]),
    ),
  );
const localFetch = async (url, { signal } = {}) => {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const file = fileURLToPath(url);
  assert.ok(file.startsWith(path.join(ROOT, 'game') + path.sep));
  const body = await readFile(file, { signal });
  return new Response(body, { status: 200, headers: { 'content-length': String(body.length) } });
};
const deterministicRandom = () => {
  let value = 20260928;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
};
const players = { created: 0, disposed: 0, live: 0, peakLive: 0 };
function trackPlayer(player) {
  let disposed = false;
  players.created++;
  players.live++;
  players.peakLive = Math.max(players.peakLive, players.live);
  const dispose = () => {
    assert.equal(disposed, false, 'Director must dispose each player exactly once.');
    disposed = true;
    players.disposed++;
    players.live--;
    player.dispose?.();
  };
  return Object.defineProperties(
    {},
    Object.fromEntries(
      [...new Set([...Object.keys(player), 'dispose'])].map((key) => [
        key,
        {
          enumerable: true,
          get: () => (key === 'dispose' ? dispose : player[key]),
        },
      ]),
    ),
  );
}
const report = {
  kind: 'revealline-demo-accelerated-soak.v1',
  startedAt: new Date().toISOString(),
  requestedSimulationSeconds: requestedSeconds,
  actualSimulationSeconds: 0,
  wallSeconds: 0,
  frameSeconds: 0.25,
  passed: false,
  scenes: 0,
  replayScenes: 0,
  botScenes: 0,
  verifiedRecordings: 0,
  pauseChecks: 0,
  sources: {},
  policies: {},
  sceneOutcomes: [],
  memory: [],
  errors: [],
  preparationFailures: [],
  expectedExhaustionHandoffs: 0,
  sourceSHA256: await sourceHashes(),
  qualification:
    'Accelerated core/director/real-worker verification. Not two wall hours, browser rendering, GPU, touch/controller hardware, audio or human watchability qualification.',
};
function sampleMemory() {
  globalThis.gc?.();
  report.memory.push({
    scenes: report.scenes,
    simulationSeconds: report.actualSimulationSeconds,
    forcedGC: typeof globalThis.gc === 'function',
    ...process.memoryUsage(),
    livePlayers: players.live,
    liveWorkerOwners: SoakWorker.owners,
    runningWorkerThreads: SoakWorker.running,
    adapterListeners: SoakWorker.listeners,
  });
}
const started = performance.now();
let director;
try {
  const [campaign, classes, pack] = await Promise.all([
    readJSON('game/content/campaign.json'),
    readJSON('game/content/classes.json'),
    readJSON('game/content/packs/fpv-arcade-r5.json'),
  ]);
  const entries = createExecutionCatalog([
    { campaign: { ...campaign, classRecipes: classes }, classRecipes: classes, sourcePackId: null },
    {
      campaign: { ...pack.campaigns[0], classRecipes: pack.classRecipes },
      classRecipes: pack.classRecipes,
      sourcePackId: pack.id,
    },
  ]).entries;
  const random = deterministicRandom();
  sampleMemory();
  for (const turnPolicy of ['immediate', 'grid-center']) {
    let policyTicks = 0,
      priorLevel = null,
      policyScenes = 0,
      mustReplay = false;
    const sources = await loadDemoSources({
      entries,
      library: { list: async () => [] },
      turnPolicy,
      fetch: localFetch,
      WorkerClass: SoakWorker,
    });
    assert.ok(sources.some((s) => s.kind === 'replay') && sources.some((s) => s.kind === 'bot'));
    const visited = new Set();
    director = createDemoDirector({
      sources,
      random,
      prepare: async (source, setup) => {
        try {
          return trackPlayer(await source.create(setup));
        } catch (error) {
          report.preparationFailures.push({
            source: source.id,
            name: error.name,
            message: error.message,
          });
          throw error;
        }
      },
    });
    assert.equal(await director.start(), true);
    while (policyTicks < requestedSeconds * 60) {
      const source = director.source,
        player = director.player;
      assert.equal(director.phase, 'playing');
      assert.ok(source && player);
      if (mustReplay)
        assert.equal(source.kind, 'replay', 'Exhaustion must hand off to a reviewed replay.');
      mustReplay = false;
      assert.notEqual(source.levelKey, priorLevel, 'No consecutive same-level scene.');
      priorLevel = source.levelKey;
      let frame = 0;
      const sceneStart = performance.now();
      while (director.phase === 'playing') {
        // Accelerated rendering must not outrun asynchronously prepared controls.
        // Every macro still observes the production watchdog and real Worker path.
        await player.planning;
        if (frame++ === 4) {
          const before = authoritativeCheckpoint(player.state);
          director.suspend();
          director.advance(2);
          assert.equal(director.phase, 'paused');
          assert.deepEqual(authoritativeCheckpoint(player.state), before);
          assert.equal(await director.play(), true);
          report.pauseChecks++;
        }
        const beforeTick = player.state.tick;
        const result = director.advance(0.25);
        assert.notEqual(
          result.reason,
          'source-error',
          `Source ${source.id}: ${player.error || director.error}`,
        );
        const ticks = player.state.tick - beforeTick;
        assert.ok(ticks >= 0 && ticks <= 31);
        policyTicks += ticks;
        report.actualSimulationSeconds += ticks / 120;
        assert.ok(frame < 8000, 'A scene must make bounded progress.');
      }
      assert.equal(director.phase, 'complete', `${source.id}: ${director.error}`);
      assert.deepEqual(director.failedSourceIds, []);
      const recording = player.exportRecording();
      assert.equal(verifyReplay(recording).match, true);
      assert.equal(authoritativeCheckpoint(player.state).hash, recording.checkpoint.hash);
      assert.ok(['running', 'won'].includes(recording.summary.status));
      const livesLost =
        player.state.classic?.livesLost ?? player.state.rules.lives - player.state.lives;
      assert.equal(livesLost, 0, 'Qualified scenes do not lose a life.');
      assert.ok(player.state.coverage > 0, 'Each scene demonstrates an actual capture.');
      if (source.kind === 'bot' && player.completionReason === 'no-safe-macro') {
        report.expectedExhaustionHandoffs++;
        mustReplay = true;
        assert.equal(player.state.player.cutting, false);
        assert.equal(player.state.player.speed, 0);
      }
      report.sceneOutcomes.push({
        source: source.id,
        turnPolicy,
        status: recording.summary.status,
        ticks: recording.ticks,
        seed: recording.summary.seed,
        coverage: player.state.coverage,
        livesLost,
        completionReason: player.completionReason ?? null,
      });
      report.verifiedRecordings++;
      report.scenes++;
      policyScenes++;
      if (source.kind === 'bot') report.botScenes++;
      else report.replayScenes++;
      visited.add(source.id);
      const key = `${turnPolicy}/${source.id}`;
      report.sources[key] ??= {
        kind: source.kind,
        scenes: 0,
        simulationSeconds: 0,
        wallSeconds: 0,
      };
      report.sources[key].scenes++;
      report.sources[key].simulationSeconds += recording.ticks / 120;
      report.sources[key].wallSeconds += (performance.now() - sceneStart) / 1000;
      if (report.scenes % 20 === 0) {
        await Promise.all([...SoakWorker.shutdowns]);
        sampleMemory();
        console.log(
          JSON.stringify({
            scenes: report.scenes,
            simulatedSeconds: Math.round(report.actualSimulationSeconds),
            wallSeconds: Math.round((performance.now() - started) / 1000),
            workerOwners: SoakWorker.owners,
            listeners: SoakWorker.listeners,
            heapMiB: +(process.memoryUsage().heapUsed / 1048576).toFixed(1),
          }),
        );
      }
      if (policyTicks < requestedSeconds * 60) assert.equal(await director.next(), true);
    }
    report.policies[turnPolicy] = {
      scenes: policyScenes,
      simulationSeconds: policyTicks / 120,
      availableSources: sources.length,
      visitedSources: visited.size,
    };
    if (requestedSeconds >= 600)
      assert.equal(visited.size, sources.length, 'Every source must actually appear.');
    director.dispose();
    director = null;
    await Promise.all([...SoakWorker.shutdowns]);
    assert.equal(players.live, 0);
    assert.equal(SoakWorker.owners, 0);
    assert.equal(SoakWorker.running, 0);
    assert.equal(SoakWorker.listeners, 0);
    sampleMemory();
  }
  report.passed = true;
} catch (error) {
  report.errors.push({ name: error.name, message: error.message, stack: error.stack });
  process.exitCode = 1;
} finally {
  director?.dispose();
  await Promise.all([...SoakWorker.shutdowns]);
  sampleMemory();
  report.wallSeconds = (performance.now() - started) / 1000;
  report.finishedAt = new Date().toISOString();
  report.players = players;
  report.workers = {
    created: SoakWorker.created,
    liveOwners: SoakWorker.owners,
    running: SoakWorker.running,
    peakRunning: SoakWorker.peakRunning,
    listeners: SoakWorker.listeners,
  };
  const finalSources = await sourceHashes();
  report.changedSources = sourceFiles.filter(
    (file) => report.sourceSHA256[file] !== finalSources[file],
  );
  if (report.changedSources.length) {
    report.passed = false;
    process.exitCode = 1;
    report.errors.push({
      name: 'SourceChanged',
      message: `Source changed during qualification: ${report.changedSources.join(', ')}`,
    });
  }
  await mkdir(path.dirname(reportFile), { recursive: true });
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      passed: report.passed,
      scenes: report.scenes,
      actualSimulationSeconds: +report.actualSimulationSeconds.toFixed(3),
      wallSeconds: +report.wallSeconds.toFixed(3),
      verifiedRecordings: report.verifiedRecordings,
      replayScenes: report.replayScenes,
      botScenes: report.botScenes,
      players,
      workers: report.workers,
      errors: report.errors.map((e) => e.message),
      reportFile,
    }),
  );
}
