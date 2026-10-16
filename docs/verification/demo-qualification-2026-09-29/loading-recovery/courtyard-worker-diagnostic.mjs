#!/usr/bin/env node
// Bounded timing diagnosis; never changes the production one-second watchdog.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { prepareBotPlayer } from '../../../../game/demo-bot-player.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../../../../game/gameplay-tuning.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../../../../game/replay.mjs';

const root = new URL('../../../../', import.meta.url);
const epochNow = () => performance.timeOrigin + performance.now();
const readJSON = async (url) => JSON.parse(await readFile(url, 'utf8'));
const previous = await readJSON(new URL('./worker-regression.json', import.meta.url));
const sourceHashes = async () =>
  Object.fromEntries(
    await Promise.all(
      Object.keys(previous.sourceSHA256).map(async (path) => [
        path,
        createHash('sha256')
          .update(await readFile(new URL(path, root)))
          .digest('hex'),
      ]),
    ),
  );
const summarize = (values) => {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  return {
    count: ordered.length,
    p95Ms: ordered.length ? ordered[Math.ceil(ordered.length * 0.95) - 1] : null,
    worstMs: ordered.length ? ordered.at(-1) : null,
  };
};
const histogramSummary = (histogram) => ({
  count: histogram.count,
  p95Ms: histogram.count ? histogram.percentile(95) / 1e6 : null,
  worstMs: histogram.count ? histogram.max / 1e6 : null,
  meanMs: histogram.count ? histogram.mean / 1e6 : null,
});
const report = {
  kind: 'revealline-courtyard-worker-diagnostic.v1',
  startedAt: new Date().toISOString(),
  runtimeHead: '55c5ec57cc1ed478b44e065951073c0bdd3c3ead',
  maxRuns: 5,
  watchdogMs: 1000,
  watchdogOverride: false,
  level: 'courtyard-exits',
  seed: 2,
  turnPolicy: 'immediate',
  gameplayTuning: 'standard',
  runs: [],
  sourceSHA256: await sourceHashes(),
  limitations: [
    'A bounded isolated Node Worker timing diagnostic, not a soak or browser/device qualification.',
    'Instrumentation adds two small timing messages and timing fields around unchanged production Worker code.',
    'Elapsed request latency includes startup, structured cloning, planner work and message scheduling.',
    'Event-loop delay measures this parent Node process; it cannot establish historical machine CPU contention.',
    'A timeout remains a recorded failure. No watchdog extension or success-only filtering is used.',
  ],
};
report.changedSinceFailedSoak = Object.keys(report.sourceSHA256).filter(
  (path) => report.sourceSHA256[path] !== previous.sourceSHA256[path],
);
assert.deepEqual(report.changedSinceFailedSoak, []);
const pack = await readJSON(new URL('game/content/packs/fpv-arcade-r5.json', root));
const level = applyGameplayTuning(
  pack.campaigns[0].levels.find((level) => level.id.endsWith('courtyard-exits')),
  resolveGameplayTuning('standard'),
);
const options = {
  seed: 2,
  turnPolicy: 'immediate',
  classId: 'scout',
  classRecipes: pack.classRecipes,
};
const started = performance.now();
for (let index = 0; index < report.maxRuns; index++) {
  const run = { run: index + 1, requests: [], errors: [], outcome: 'pending' };
  report.runs.push(run);
  let player, instance, shutdown;
  class InstrumentedWorker {
    constructor(url) {
      instance = this;
      this.callbacks = new Map();
      this.requests = new Map();
      this.worker = new Worker(
        new URL(
          `data:text/javascript,${encodeURIComponent(`
          import { parentPort } from 'node:worker_threads';
          import { performance } from 'node:perf_hooks';
          const now = () => performance.timeOrigin + performance.now();
          let active;
          globalThis.addEventListener = (type, callback) => parentPort.on(type, data => {
            active = { id: data.id, workerStartedAt: now() };
            parentPort.postMessage({ diagnostic: 'started', ...active });
            callback({ data });
          });
          globalThis.postMessage = data => parentPort.postMessage({
            diagnostic: 'result', data,
            timing: { ...active, workerFinishedAt: now() }
          });
          await import(${JSON.stringify(url.href)});
        `)}`,
        ),
        { type: 'module', execArgv: [] },
      );
      this.worker.on('message', (packet) => {
        const request = this.requests.get(packet.id ?? packet.data?.id);
        if (!request) return;
        if (packet.diagnostic === 'started') {
          request.workerStartedAt = packet.workerStartedAt;
          request.queueAndStartupMs = packet.workerStartedAt - request.sentAt;
          return;
        }
        Object.assign(request, packet.timing);
        request.receivedAt = epochNow();
        request.latencyMs = request.receivedAt - request.sentAt;
        request.computeMs = request.workerFinishedAt - request.workerStartedAt;
        request.deliveryMs = request.receivedAt - request.workerFinishedAt;
        request.outcome = packet.data.error ? 'worker-error' : 'response';
        request.metrics = packet.data.result?.metrics ?? null;
        for (const [callback, type] of this.callbacks)
          if (type === 'message') callback({ data: packet.data });
      });
      this.worker.on('error', (error) => {
        for (const [callback, type] of this.callbacks) if (type === 'error') callback(error);
      });
    }
    addEventListener(type, callback) {
      this.callbacks.set(callback, type);
    }
    removeEventListener(type, callback) {
      this.callbacks.delete(callback);
    }
    postMessage(data) {
      const request = {
        id: data.id,
        decision: data.decision,
        stateTick: data.state.tick,
        sentAt: epochNow(),
        outcome: 'pending',
      };
      this.requests.set(data.id, request);
      run.requests.push(request);
      this.worker.postMessage(data);
      request.postMessageMs = epochNow() - request.sentAt;
    }
    terminate() {
      if (this.stopped) return;
      this.stopped = true;
      for (const request of this.requests.values())
        if (request.outcome === 'pending') {
          request.outcome = 'terminated-without-response';
          request.terminationLatencyMs = epochNow() - request.sentAt;
        }
      shutdown = this.worker.terminate();
    }
  }
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();
  const utilization = performance.eventLoopUtilization();
  const runStarted = performance.now();
  try {
    // Deliberately omit watchdogMs: use the actual production default.
    player = await prepareBotPlayer(level, options, { WorkerClass: InstrumentedWorker });
    player.play();
    for (let frame = 0; player.phase === 'playing'; frame++) {
      assert.ok(frame < 8000, 'Bounded scene progress');
      await player.planning;
      if (frame === 4) {
        const before = authoritativeCheckpoint(player.state);
        player.pause();
        player.advance(2);
        assert.deepEqual(authoritativeCheckpoint(player.state), before);
        player.play();
      }
      player.advance(0.25);
    }
    run.outcome = player.phase;
    run.error = player.error;
    if (player.phase === 'error') run.errors.push(player.error);
    const recording = player.exportRecording();
    run.recordingVerified = verifyReplay(recording).match;
    run.finalTick = player.state.tick;
    run.status = player.state.status;
    run.coverage = player.state.coverage;
    run.livesLost = player.state.classic.livesLost;
    run.completionReason = player.completionReason;
  } catch (error) {
    run.outcome = 'preparation-or-diagnostic-error';
    run.errors.push({ name: error.name, message: error.message, stack: error.stack });
  } finally {
    player?.dispose();
    instance?.terminate();
    await shutdown;
    await new Promise((resolve) => setImmediate(resolve));
    histogram.disable();
    run.wallSeconds = (performance.now() - runStarted) / 1000;
    run.eventLoopDelay = histogramSummary(histogram);
    run.eventLoopUtilization = performance.eventLoopUtilization(utilization);
    run.latency = summarize(run.requests.map((request) => request.latencyMs));
    run.compute = summarize(run.requests.map((request) => request.computeMs));
    run.cleanup = {
      workerStopped: instance?.stopped ?? true,
      listeners: instance?.callbacks.size ?? 0,
    };
    console.log(
      JSON.stringify({
        run: run.run,
        outcome: run.outcome,
        requests: run.requests.length,
        latency: run.latency,
        eventLoopDelay: run.eventLoopDelay,
      }),
    );
  }
}
report.finishedAt = new Date().toISOString();
report.wallSeconds = (performance.now() - started) / 1000;
const requests = report.runs.flatMap((run) => run.requests);
report.latency = summarize(requests.map((request) => request.latencyMs));
report.compute = summarize(requests.map((request) => request.computeMs));
report.queueAndStartup = summarize(requests.map((request) => request.queueAndStartupMs));
report.delivery = summarize(requests.map((request) => request.deliveryMs));
report.timeouts = report.runs.filter((run) =>
  run.errors.some((error) => /deadline/.test(typeof error === 'string' ? error : error.message)),
).length;
report.successfulRuns = report.runs.filter(
  (run) => run.outcome === 'complete' && run.recordingVerified,
).length;
const finalHashes = await sourceHashes();
report.changedSources = Object.keys(finalHashes).filter(
  (path) => finalHashes[path] !== report.sourceSHA256[path],
);
report.causeAssessment =
  'Request timings describe only these five new attempts. They cannot determine whether the earlier watchdog event was planner CPU time, Worker scheduling, GC or host contention.';
const output = new URL('./courtyard-worker-diagnostic.json', import.meta.url);
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    successfulRuns: report.successfulRuns,
    timeouts: report.timeouts,
    latency: report.latency,
    compute: report.compute,
    wallSeconds: report.wallSeconds,
    report: fileURLToPath(output),
  }),
);
if (report.successfulRuns !== report.maxRuns || report.changedSources.length) process.exitCode = 1;
