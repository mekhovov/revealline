/** Bounded Regional capacity probe. This is one host/fixture, not rollout qualification. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, freemem, loadavg, platform, release, totalmem } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker as ThreadWorker } from 'node:worker_threads';
import { createAdvancedRegionalSession } from '../optional-practice/civilian-fpv/advanced-regional.mjs';
import { createAdvancedWorkerClient } from '../optional-practice/civilian-fpv/advanced-worker-client.mjs';
import { createEnduranceFixture } from '../authoring/fpv-worlds/regions/endurance-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.argv[2] ?? 'docs/fpv-regional-contact-capacity.json';
if (process.argv.length > 3)
  throw new Error('Usage: node scripts/fpv-regional-contact-capacity.mjs [output.json]');
async function sourceHashes() {
  const pending = [
    'scripts/fpv-regional-contact-capacity.mjs',
    'scripts/fpv-regional-contact-worker.mjs',
  ];
  const visited = new Map();
  while (pending.length) {
    const name = pending.shift();
    if (visited.has(name)) continue;
    const bytes = await readFile(path.join(root, name));
    visited.set(name, {
      path: name,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
    });
    for (const match of bytes
      .toString()
      .matchAll(/\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]/g)) {
      const specifier = match[1] ?? match[2];
      if (specifier.startsWith('.'))
        pending.push(path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier)));
    }
  }
  return [...visited.values()].sort((a, b) => a.path.localeCompare(b.path));
}
class WorkerBridge {
  constructor() {
    this.listeners = new Map();
    this.worker = new ThreadWorker(new URL('./fpv-regional-contact-worker.mjs', import.meta.url), {
      workerData: 'fpv-regional-capacity',
    });
  }
  addEventListener(type, listener) {
    const wrapped = type === 'message' ? (data) => listener({ data }) : listener;
    this.listeners.set(listener, [type, wrapped]);
    this.worker.on(type, wrapped);
  }
  removeEventListener(_type, listener) {
    const entry = this.listeners.get(listener);
    if (entry) this.worker.off(...entry);
    this.listeners.delete(listener);
  }
  postMessage(message) {
    this.worker.postMessage(message);
  }
  terminate() {
    return this.worker.terminate();
  }
}
function hostObservation() {
  return {
    at: new Date().toISOString(),
    monotonicMs: performance.now(),
    loadAverages: loadavg(),
    freeBytes: freemem(),
    totalBytes: totalmem(),
    cpuTimes: cpus().map((cpu) => cpu.times),
    processMemory: process.memoryUsage(),
  };
}
function cpuBusyPercent(before, after) {
  assert.equal(after.length, before.length, 'Processor inventory changed during measurement');
  return after.map((times, index) => {
    const elapsed = Object.keys(times).reduce(
      (sum, key) => sum + times[key] - before[index][key],
      0,
    );
    return elapsed > 0 ? (100 * (elapsed - (times.idle - before[index].idle))) / elapsed : null;
  });
}
const sources = await sourceHashes();
const source = await createEnduranceFixture();
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const runs = [];
for (const mixed of [false, true]) {
  const session = createAdvancedRegionalSession(
    {
      manifest: source.terrain.manifest,
      source: source.terrain.source,
      ...(mixed ? { geometryProfile: 'terrain-scenery-v1', scenery: source.scenery } : {}),
    },
    { createClient: () => createAdvancedWorkerClient({ Worker: WorkerBridge, watchdogMs: 60000 }) },
  );
  try {
    const preparationStart = performance.now();
    await session.prepare();
    const preparationMs = performance.now() - preparationStart;
    assert.equal(session.arm(), true);
    const hostBefore = hostObservation(),
      cpuBefore = process.cpuUsage(),
      eventLoopBefore = performance.eventLoopUtilization(),
      intervals = [];
    const start = performance.now();
    for (let tick = 0; tick < 500; tick++) {
      const tickStart = performance.now();
      const state = await session.step(neutral);
      intervals.push(performance.now() - tickStart);
      assert.equal(state.status, 'active', `Flight stopped: ${state.reason}`);
    }
    const elapsedMs = performance.now() - start;
    const processCpu = process.cpuUsage(cpuBefore),
      mainEventLoop = performance.eventLoopUtilization(eventLoopBefore),
      hostAfter = hostObservation(),
      busy = cpuBusyPercent(hostBefore.cpuTimes, hostAfter.cpuTimes);
    intervals.sort((a, b) => a - b);
    session.pause();
    const recovery = await session.captureRecovery(),
      recording = await session.recording();
    const realTimeCapacity = 10000 / elapsedMs;
    assert.equal(session.snapshot().grounded, true);
    assert.ok(session.snapshot().contacts > 0);
    runs.push({
      profile: mixed ? 'terrain-scenery-v1' : 'terrain-v1',
      missionTicks: 500,
      simulatedSeconds: 10,
      elapsedMs,
      realTimeCapacity,
      passesCapacityGate: realTimeCapacity >= 2,
      observation: {
        timing:
          'CPU counter snapshots bracket this measured loop; initialization, export and recovery are outside it. Process CPU includes all process threads. Event-loop utilization describes the main thread only.',
        startedAt: hostBefore.at,
        endedAt: hostAfter.at,
        hostSampleElapsedMs: hostAfter.monotonicMs - hostBefore.monotonicMs,
        loadAveragesBefore: hostBefore.loadAverages,
        loadAveragesAfter: hostAfter.loadAverages,
        hostCpuBusyPercent: busy,
        meanHostCpuBusyPercent: busy.every((value) => value !== null)
          ? busy.reduce((sum, value) => sum + value, 0) / busy.length
          : null,
        processCpuMicroseconds: processCpu,
        processCpuToWallRatio: (processCpu.user + processCpu.system) / (elapsedMs * 1000),
        mainEventLoop,
        freeBytesBefore: hostBefore.freeBytes,
        freeBytesAfter: hostAfter.freeBytes,
        totalBytes: hostAfter.totalBytes,
        processMemoryBefore: hostBefore.processMemory,
        processMemoryAfter: hostAfter.processMemory,
        missionIntervalMs: {
          median: intervals[Math.floor(intervals.length / 2)],
          p95: intervals[Math.ceil(intervals.length * 0.95) - 1],
          maximum: intervals.at(-1),
        },
      },
      preparationMs,
      grounded: session.snapshot().grounded,
      contacts: session.snapshot().contacts,
      recordingBytes: Buffer.byteLength(JSON.stringify(recording)),
      recoveryBytes: Buffer.byteLength(JSON.stringify(recovery)),
      terrainColliders: recording.terrainColliders.length,
      triangles: recording.terrainColliders.reduce(
        (count, collider) => count + Buffer.from(collider.indices, 'base64').length / 12,
        0,
      ),
      terrainFrames: recording.terrainFrames.length,
      terrainEvents: recording.terrainEvents.length,
    });
  } finally {
    await session.dispose();
  }
}
assert.deepEqual(
  await sourceHashes(),
  sources,
  'Sources changed while measuring; rerun the capacity probe',
);
const result = {
  format: 'AdvancedRegionalCapacityEvidence.v1',
  generatedAt: new Date().toISOString(),
  host: {
    platform: platform(),
    architecture: arch(),
    release: release(),
    node: process.version,
    cpu: cpus()[0]?.model ?? null,
    logicalProcessors: cpus().length,
  },
  status: 'experimental',
  scored: false,
  minimumRealTimeCapacity: 2,
  scope:
    'Actual dedicated Node worker, production message protocol, verified terrain admission, complete rollback snapshots, compact recording and landing. Initialization is measured separately.',
  limits: [
    'One macOS host; does not qualify supported browsers, architectures, mobile/native wrappers, or the full device matrix.',
    'Small stationary fixture with one terrain frame; does not establish dense-scene, streamed-frame, or maximum-duration capacity.',
    'Single measurement per profile; runtime load and warm-up can change measured capacity.',
  ],
  passed: runs.every((run) => run.passesCapacityGate),
  runs,
  sources,
};
await writeFile(path.resolve(root, output), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output, passed: result.passed, runs }, null, 2));
