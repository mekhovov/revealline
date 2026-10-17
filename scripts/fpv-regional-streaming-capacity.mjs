/** Authored Regional streaming probe; automated test pilot, never player input or qualification of hardware. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { arch, cpus, freemem, loadavg, platform, release, totalmem } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker as ThreadWorker } from 'node:worker_threads';
import * as THREE from '../optional-practice/civilian-fpv/vendor/three.module.js';
import { createAdvancedRegionalSession } from '../optional-practice/civilian-fpv/advanced-regional.mjs';
import { createAdvancedWorkerClient } from '../optional-practice/civilian-fpv/advanced-worker-client.mjs';
import { createVerifiedFlightGeometry } from '../optional-practice/civilian-fpv/regional/verified-flight-geometry.mjs';
import { ADVANCED_TERRAIN_LIMITS } from '../optional-practice/civilian-fpv/advanced-terrain.mjs';
import { createRateProfile } from '../optional-practice/civilian-fpv/rates.mjs';
import {
  initAdvancedRuntime,
  replayAdvancedRecording,
} from '../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  createAuthoredEnduranceFixture,
  AUTHORED_ENDURANCE_ROUTE,
} from '../authoring/fpv-worlds/regions/authored-endurance-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
const output = process.argv[3];
const mixed = process.argv[4] === '--mixed';
assert.ok(
  ['--correctness', '--measure'].includes(mode) &&
    output &&
    (process.argv.length === 4 || (process.argv.length === 5 && mixed)),
  'Usage: node scripts/fpv-regional-streaming-capacity.mjs --correctness|--measure report.json [--mixed]',
);
const authoredDirectory = 'authoring/fpv-worlds/regions/urban-bando/delivery-review-r2';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const clone = (value) => structuredClone(value);
const immediate = () => new Promise((resolve) => setImmediate(resolve));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
async function sources() {
  const pending = [
    'scripts/fpv-regional-streaming-capacity.mjs',
    'scripts/fpv-regional-contact-worker.mjs',
  ];
  async function directory(relative) {
    for (const item of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, item.name);
      if (item.isDirectory()) await directory(name);
      else pending.push(name);
    }
  }
  await directory(authoredDirectory);
  const entries = new Map();
  while (pending.length) {
    const name = pending.shift();
    if (entries.has(name)) continue;
    const bytes = await readFile(path.join(root, name));
    entries.set(name, { path: name, bytes: bytes.length, sha256: hash(bytes) });
    if (!/\.(?:mjs|js)$/.test(name)) continue;
    for (const match of bytes
      .toString()
      .matchAll(/\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]/g)) {
      const specifier = match[1] ?? match[2];
      if (specifier.startsWith('.'))
        pending.push(path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier)));
    }
  }
  return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
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
    cpuTimes: cpus().map((cpu) => cpu.times),
    loadAverages: loadavg(),
    freeBytes: freemem(),
    totalBytes: totalmem(),
    memory: process.memoryUsage(),
  };
}
function hostDelta(before, after) {
  return after.cpuTimes.map((times, index) => {
    const elapsed = Object.keys(times).reduce(
      (sum, key) => sum + times[key] - before.cpuTimes[index][key],
      0,
    );
    return elapsed > 0
      ? (100 * (elapsed - times.idle + before.cpuTimes[index].idle)) / elapsed
      : null;
  });
}
function pilot() {
  let waypoint = 0;
  const visits = Array(AUTHORED_ENDURANCE_ROUTE.length).fill(0);
  return {
    snapshot: () => ({ waypoint, visits: [...visits] }),
    command(state) {
      let goal = AUTHORED_ENDURANCE_ROUTE[waypoint].position;
      const p = Object.fromEntries(
        ['x', 'y', 'z'].map((axis) => [axis, state.position[axis] / 1000]),
      );
      const v = Object.fromEntries(
        ['x', 'y', 'z'].map((axis) => [axis, state.velocity[axis] / 1000]),
      );
      if (
        Math.hypot(p.x - goal.x / 1000, p.z - goal.z / 1000) < 3 &&
        Math.abs(p.y - goal.y / 1000) < 1 &&
        Math.hypot(v.x, v.z) < 3
      ) {
        visits[waypoint]++;
        waypoint = (waypoint + 1) % AUTHORED_ENDURANCE_ROUTE.length;
        goal = AUTHORED_ENDURANCE_ROUTE[waypoint].position;
      }
      const acceleration = new THREE.Vector3(
        clamp((clamp((goal.x / 1000 - p.x) * 0.6, -8, 8) - v.x) * 1.4, -4, 4) +
          0.08 * v.x +
          0.035 * v.x * Math.abs(v.x),
        9.81 + clamp((goal.y / 1000 - p.y) * 2 - v.y * 1.8, -4, 4),
        clamp((clamp((goal.z / 1000 - p.z) * 0.6, -8, 8) - v.z) * 1.4, -4, 4) +
          0.08 * v.z +
          0.035 * v.z * Math.abs(v.z),
      );
      const target = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        acceleration.clone().normalize(),
      );
      const current = new THREE.Quaternion().copy(state.advancedTelemetry.orientation);
      const error = current.clone().conjugate().multiply(target);
      if (error.w < 0) for (const axis of ['x', 'y', 'z', 'w']) error[axis] *= -1;
      const gain = (-2 * 2.8 * 180) / Math.PI / 400;
      return {
        roll: clamp(error.z * gain, -0.4, 0.4),
        pitch: clamp(error.x * gain, -0.4, 0.4),
        yaw: clamp(error.y * gain, -0.4, 0.4),
        throttle: clamp(
          Math.sqrt((0.65 * acceleration.length()) / 24) / (state.advancedTelemetry.voltage / 22.2),
          0.1,
          0.8,
        ),
      };
    },
  };
}
async function fixture() {
  return createAuthoredEnduranceFixture({
    fetchImpl: async (url, options = {}) => {
      options.signal?.throwIfAborted();
      const target = new URL(url);
      const prefix = '/mekhovov/revealline/622fade3a7a4e70021cab9c509c1116d0378ad2b/';
      assert.equal(target.origin, 'https://raw.githubusercontent.com');
      assert.ok(target.pathname.startsWith(prefix + authoredDirectory + '/'));
      assert.equal(target.search + target.hash, '');
      return new Response(await readFile(path.join(root, target.pathname.slice(prefix.length))));
    },
  });
}
const initialSources = await sources();
await initAdvancedRuntime();
const authored = await fixture();
const runs = [];
let mixedAdmission;
{
  const owner = createVerifiedFlightGeometry(authored.terrain.manifest, {
    profile: 'terrain-scenery-v1',
    source: authored.terrain.source,
    scenery: authored.scenery,
    retainCommitted: true,
  });
  try {
    await owner.transition(authored.terrain.manifest.spawns[0].position);
    const frame = owner.collisionFrame();
    const windows = [];
    for (let z = 0; z < 3; z++)
      for (let x = 0; x < 3; x++) {
        await owner.transition({ x: x * 128000 + 64000, y: 12000, z: z * 128000 + 64000 });
        const window = owner.collisionFrame();
        windows.push({
          x,
          z,
          colliders: window.colliders.length,
          vertices: window.colliders.reduce(
            (sum, collider) => sum + collider.vertices.length / 3,
            0,
          ),
          triangles: window.colliders.reduce(
            (sum, collider) => sum + collider.indices.length / 3,
            0,
          ),
          jsonBytes: Buffer.byteLength(JSON.stringify(window)),
        });
      }
    mixedAdmission = {
      windows,
      jsonBytes: Buffer.byteLength(JSON.stringify(frame)),
      vertices: frame.colliders.reduce((sum, collider) => sum + collider.vertices.length / 3, 0),
      colliders: frame.colliders.length,
      triangles: frame.colliders.reduce((sum, collider) => sum + collider.indices.length / 3, 0),
      accepted: false,
      expectedError: 'Terrain frame collider count exceeds limit',
    };
  } finally {
    await owner.dispose();
  }
  let client;
  const session = createAdvancedRegionalSession(
    {
      manifest: authored.terrain.manifest,
      source: authored.terrain.source,
      scenery: authored.scenery,
      geometryProfile: 'terrain-scenery-v1',
    },
    {
      createClient() {
        client = createAdvancedWorkerClient({ Worker: WorkerBridge, watchdogMs: 60000 });
        return client;
      },
    },
  );
  try {
    if (mixedAdmission.colliders > ADVANCED_TERRAIN_LIMITS.colliders) {
      await assert.rejects(session.prepare(), { message: mixedAdmission.expectedError });
    } else {
      await session.prepare();
      mixedAdmission.accepted = true;
      delete mixedAdmission.expectedError;
    }
    const snapshot = await client.snapshot();
    assert.equal(snapshot.state.missionTick, 0);
    assert.equal(snapshot.recording.inputs.length, 0);
    assert.equal(session.arm(), mixedAdmission.accepted);
    session.pause();
    mixedAdmission.unstartedFlightPreserved = true;
    mixedAdmission.status = session.snapshot().status;
    mixedAdmission.reason = session.snapshot().reason;
  } finally {
    await session.dispose();
  }
}
mixedAdmission.colliderLimit = ADVANCED_TERRAIN_LIMITS.colliders;
console.log(JSON.stringify({ mixedAdmission }));
if (mixed)
  assert.ok(
    mixedAdmission.windows.every((window) => window.colliders <= ADVANCED_TERRAIN_LIMITS.colliders),
    'The unchanged collider limit must admit every selected Urban window',
  );
const correctness = mode === '--correctness';
const expectedTicks = 6000;
let diagnostic = { stage: 'setup' };
try {
  for (let repetition = 0; repetition < (correctness ? 1 : 3); repetition++) {
    let rawClient,
      rejectionBefore,
      rejectionAfter,
      rejectCoverage = false;
    let stagedFrames = 0,
      frameWait = null,
      releaseFrame = null,
      holdFrame = false,
      heldFrameOnce = false;
    let heldFrameStarted;
    const frameStarted = new Promise((resolve) => {
      heldFrameStarted = resolve;
    });
    const frameSummaries = [];
    const testPilot = pilot();
    const session = createAdvancedRegionalSession(
      {
        manifest: authored.terrain.manifest,
        source: authored.terrain.source,
        geometryProfile: mixed ? 'terrain-scenery-v1' : 'terrain-v1',
        ...(mixed ? { scenery: authored.scenery } : {}),
        rateProfile: createRateProfile({
          axes: Object.fromEntries(
            ['roll', 'pitch', 'yaw'].map((axis) => [axis, { rcRate: 40, rate: 40, expo: 0 }]),
          ),
        }),
      },
      {
        createClient() {
          rawClient = createAdvancedWorkerClient({ Worker: WorkerBridge, watchdogMs: 60000 });
          return {
            ...rawClient,
            async propose(sample) {
              if (rejectCoverage) {
                await rawClient.input(sample);
                rejectionBefore = await rawClient.snapshot();
                return rawClient.propose();
              }
              return rawClient.propose(sample);
            },
            async commit(decision) {
              const result = await rawClient.commit(decision);
              if (rejectCoverage) rejectionAfter = await rawClient.snapshot();
              return result;
            },
            async stageTerrainFrame(frame) {
              stagedFrames++;
              frameSummaries.push({
                colliders: frame.colliders.length,
                triangles: frame.colliders.reduce(
                  (total, collider) => total + collider.indices.length / 3,
                  0,
                ),
              });
              if (
                correctness &&
                holdFrame &&
                !heldFrameOnce &&
                session.snapshot().status === 'active'
              ) {
                heldFrameOnce = true;
                frameWait = new Promise((resolve) => {
                  releaseFrame = resolve;
                });
                heldFrameStarted();
                await frameWait;
              }
              return rawClient.stageTerrainFrame(frame);
            },
          };
        },
        createGeometry(...args) {
          const owner = createVerifiedFlightGeometry(...args);
          return {
            ...owner,
            motionCoverage(...query) {
              if (rejectCoverage) return { status: 'terrain-unknown' };
              return owner.motionCoverage(...query);
            },
          };
        },
      },
    );
    try {
      diagnostic = { repetition: repetition + 1, stage: 'prepare-initial' };
      const preparationStart = performance.now();
      await session.prepare();
      const preparationMs = performance.now() - preparationStart;
      assert.equal(session.arm(), true);
      let state = session.snapshot(),
        calls = 0,
        waits = 0,
        rejection = null,
        waitEvidence = null;
      const points = [],
        terrainWaits = [];
      const intervals = [];
      const before = hostObservation(),
        processCpu = process.cpuUsage(),
        eventLoop = performance.eventLoopUtilization();
      const start = performance.now();
      while (state.ticks < expectedTicks) {
        diagnostic = {
          repetition: repetition + 1,
          stage: 'mission-loop',
          missionTick: state.ticks,
          positionMm: clone(state.position),
          streaming: clone(state.streaming),
          contacts: state.contacts,
          grounded: state.grounded,
          stagedFrames,
          route: testPilot.snapshot(),
        };
        if (correctness && state.ticks === 10 && !rejection) {
          rejectCoverage = true;
          state = await session.step(testPilot.command(state));
          assert.equal(state.reason, 'terrain-required');
          assert.equal(state.ticks, 10);
          assert.deepEqual(
            rejectionAfter,
            rejectionBefore,
            'Rejected mission preserves complete physics, controller, motors, battery, input queue and recorder',
          );
          rejection = {
            missionTick: state.ticks,
            completeSnapshotSHA256: hash(JSON.stringify(rejectionAfter)),
            exactSnapshotPreserved: true,
          };
          rejectCoverage = false;
          diagnostic.stage = 'prepare-after-rejection-or-coverage-wait';
          await session.prepare();
          assert.equal(session.arm(), true);
          state = session.snapshot();
          holdFrame = true;
        }
        if (frameWait) {
          await frameStarted;
          const prior = await rawClient.snapshot();
          const held = await session.step(testPilot.command(state));
          assert.deepEqual(
            await rawClient.snapshot(),
            prior,
            'Frame wait cannot advance physics, inputs or recording',
          );
          assert.equal(held.ticks, prior.state.missionTick);
          waitEvidence = {
            missionTick: held.ticks,
            completeSnapshotSHA256: hash(JSON.stringify(prior)),
            exactSnapshotPreserved: true,
          };
          releaseFrame();
          frameWait = null;
        }
        const lastTick = state.ticks,
          previousTelemetry = clone(state.advancedTelemetry);
        const tickStart = performance.now();
        state = await session.step(testPilot.command(state));
        intervals.push(performance.now() - tickStart);
        calls++;
        if (state.status === 'paused' && state.reason === 'terrain-required') {
          assert.equal(state.ticks, lastTick);
          assert.deepEqual(state.advancedTelemetry, previousTelemetry);
          terrainWaits.push({
            missionTick: state.ticks,
            positionMm: clone(state.position),
            streamingFailure: state.streaming.failure,
          });
          if (correctness) console.log(JSON.stringify({ terrainWait: terrainWaits.at(-1) }));
          releaseFrame?.();
          frameWait = null;
          diagnostic.stage = 'prepare-after-rejection-or-coverage-wait';
          await session.prepare();
          assert.equal(session.arm(), true);
          state = session.snapshot();
        }
        assert.equal(
          state.status,
          'active',
          `Flight stopped at ${state.ticks}: ${state.reason} ${state.failure ?? ''}`,
        );
        assert.equal(state.advancedTelemetry.frequency, 250);
        if (state.ticks === lastTick) waits++;
        // Allow streamed publication to acquire its between-mission boundary.
        // Browser mission calls naturally have a scheduled gap; count this yield in capacity.
        await immediate();
        assert.ok(calls < expectedTicks + 10000, 'Bounded streaming wait exceeded');
        if (state.ticks % 250 === 0 && points.at(-1)?.tick !== state.ticks)
          points.push({
            tick: state.ticks,
            positionMm: clone(state.position),
            originMm: clone(state.originMm),
            grounded: state.grounded,
          });
        if (correctness && state.ticks % 500 === 0 && lastTick !== state.ticks)
          console.log(
            JSON.stringify({
              tick: state.ticks,
              position: state.position,
              stagedFrames,
              pilot: testPilot.snapshot(),
            }),
          );
      }
      diagnostic.stage = 'finish-streaming';
      const finishStreaming = session.recording();
      await Promise.race([finishStreaming, frameStarted]);
      if (frameWait) {
        const prior = await rawClient.snapshot();
        const held = await session.step(testPilot.command(state));
        assert.deepEqual(await rawClient.snapshot(), prior);
        assert.equal(held.ticks, prior.state.missionTick);
        waitEvidence = {
          missionTick: held.ticks,
          completeSnapshotSHA256: hash(JSON.stringify(prior)),
          exactSnapshotPreserved: true,
        };
        releaseFrame();
        frameWait = null;
      }
      await finishStreaming;
      const elapsedMs = performance.now() - start;
      const after = hostObservation(),
        cpu = process.cpuUsage(processCpu),
        mainEventLoop = performance.eventLoopUtilization(eventLoop);
      session.pause();
      const recovery = await session.captureRecovery();
      const recording = await session.recording();
      diagnostic.stage = 'verify-and-readmit-recovery';
      const recoveryStart = performance.now();
      await session.restoreRecovery(recovery);
      const recoveredRecording = await session.recording();
      const recoveredSnapshot = await session.captureRecovery();
      assert.deepEqual(recoveredSnapshot.simulation.state, recovery.simulation.state);
      assert.deepEqual(recoveredSnapshot.simulation.controller, recovery.simulation.controller);
      for (const key of ['config', 'identity', 'missionTicks', 'inputs', 'hashes', 'checkpoints'])
        assert.deepEqual(recoveredRecording[key], recording[key], `Recovery preserves ${key}`);
      assert.deepEqual(
        recoveredRecording.terrainEvents.slice(0, recording.terrainEvents.length),
        recording.terrainEvents,
      );
      assert.ok(
        recoveredRecording.terrainEvents
          .slice(recording.terrainEvents.length)
          .every((event) => event[0] === expectedTicks * 5),
        'Re-admission can only append current-boundary terrain events',
      );
      const recoveredReplay = await replayAdvancedRecording(recoveredRecording);
      assert.equal(recoveredReplay.verified, true);
      assert.deepEqual(recoveredReplay.telemetry.position, state.advancedTelemetry.position);
      const recoveryMs = performance.now() - recoveryStart;
      diagnostic.stage = 'replay';
      const replayStart = performance.now();
      const replay = await replayAdvancedRecording(recording);
      assert.equal(replay.verified, true);
      assert.equal(replay.verificationScope, 'complete');
      assert.equal(replay.telemetry.missionTick, expectedTicks);
      assert.deepEqual(replay.telemetry.position, state.advancedTelemetry.position);
      assert.ok(recording.terrainEvents.length >= 3, 'Must publish multiple actual terrain frames');
      assert.ok(
        testPilot.snapshot().visits.reduce((a, b) => a + b, 0) >= 2,
        'Must reach at least two unchanged authored route points',
      );
      if (correctness) {
        assert.ok(rejection);
        assert.ok(waitEvidence);
      }
      intervals.sort((a, b) => a - b);
      const capacity = (expectedTicks * 20) / elapsedMs;
      const busy = hostDelta(before, after);
      runs.push({
        repetition: repetition + 1,
        missionTicks: expectedTicks,
        simulatedSeconds: expectedTicks / 50,
        ...(correctness
          ? {}
          : {
              elapsedMs,
              realTimeCapacity: capacity,
              passesCapacityGate: capacity >= 2,
              missionCallMs: {
                median: intervals[Math.floor(intervals.length / 2)],
                p95: intervals[Math.ceil(intervals.length * 0.95) - 1],
                maximum: intervals.at(-1),
              },
              observation: {
                before,
                after,
                hostCpuBusyPercent: busy,
                processCpuMicroseconds: cpu,
                processCpuToWallRatio: (cpu.user + cpu.system) / (elapsedMs * 1000),
                mainEventLoop,
              },
            }),
        preparationMs,
        calls,
        terrainWaits,
        frameWaitCalls: waits,
        stagedFrames,
        frameSummaries,
        route: testPilot.snapshot(),
        points,
        rejection,
        waitEvidence,
        recordingBytes: Buffer.byteLength(JSON.stringify(recording)),
        recoveryBytes: Buffer.byteLength(JSON.stringify(recovery)),
        terrainFrames: recording.terrainFrames.length,
        terrainEvents: recording.terrainEvents.length,
        colliderPayloads: recording.terrainColliders.length,
        finalHash: recording.finalHash,
        recoveryVerified: {
          exactConsumedHistoryPreserved: true,
          exactControllerAndDynamicsPreserved: true,
          additionalTerrainReadmissionEvents:
            recoveredRecording.terrainEvents.length - recording.terrainEvents.length,
          readmittedRecordingReplayVerified: true,
          elapsedMs: recoveryMs,
          physicsSnapshotBytes: Buffer.from(recovery.simulation.world, 'base64').length,
        },
        replay: {
          verified: true,
          verificationScope: replay.verificationScope,
          elapsedMs: performance.now() - replayStart,
          finalPositionExact: true,
        },
      });
    } finally {
      releaseFrame?.();
      await session.dispose();
    }
  }
} catch (error) {
  await writeFile(
    path.resolve(root, output),
    JSON.stringify(
      {
        format: 'AdvancedRegionalStreamingEvidence.v1',
        generatedAt: new Date().toISOString(),
        passed: false,
        mode: correctness ? 'correctness-only' : 'capacity',
        candidateColliderLimit: ADVANCED_TERRAIN_LIMITS.colliders,
        measuredGeometryProfile: mixed ? 'terrain-scenery-v1' : 'terrain-v1',
        diagnostic,
        failure: { name: error.name, message: error.message, stack: error.stack },
        mixedAdmission,
        completedRuns: runs,
        sources: initialSources,
        sourcesStable: JSON.stringify(await sources()) === JSON.stringify(initialSources),
      },
      null,
      2,
    ) + '\n',
  );
  throw error;
} finally {
  authored.dispose();
}
assert.deepEqual(
  await sources(),
  initialSources,
  'Sources changed while running; retain the output and rerun only against stable sources',
);
const result = {
  format: 'AdvancedRegionalStreamingEvidence.v1',
  generatedAt: new Date().toISOString(),
  mode: correctness ? 'correctness-only' : 'capacity',
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
  defaultEligible: false,
  frequency: 250,
  fixture: authored.identity,
  mixedAdmission,
  measuredGeometryProfile: mixed ? 'terrain-scenery-v1' : 'terrain-v1',
  scope: `Unmodified, digest-admitted Urban review-r2 ${mixed ? 'terrain/scenery' : 'terrain-only'}; authored road/court route driven by an explicitly synthetic acro test pilot through production Regional adapter and real worker protocol.`,
  timing:
    'Measured loop includes pilot computation, main-thread admission, actual worker round trips, snapshots/recording inside mission transactions, automatic streaming preparation/adoption, and an explicit event-loop yield after every mission call. Initial preparation, source verification, export/replay and correctness injections are excluded from capacity runs. No render, network download or USB hardware is included.',
  limits: [
    ...(!mixedAdmission.accepted
      ? [
          'The full authored mixed window exceeds the unchanged 64-collider budget and remains unqualified. Its explicit negative admission result is retained; no colliders were pruned or caps raised.',
        ]
      : []),
    'One Apple host and Node worker runtime only; no broader browser/device qualification.',
    'Two-minute moving authored-region workload, not maximum-duration capacity or arbitrary dense scenes.',
    'Local verified asset cache excludes network transfer; Three.js scene preparation is included but no GPU rendering.',
    'Automated test pilot validates software workload only; not physical input, pilot evaluation or measured aircraft fidelity.',
  ],
  minimumRealTimeCapacity: 2,
  passed: runs.every((run) => correctness || run.passesCapacityGate),
  runs,
  sources: initialSources,
};
await writeFile(path.resolve(root, output), JSON.stringify(result, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      output,
      passed: result.passed,
      runs: runs.map(({ repetition, realTimeCapacity, terrainEvents, stagedFrames, route }) => ({
        repetition,
        realTimeCapacity,
        terrainEvents,
        stagedFrames,
        route,
      })),
    },
    null,
    2,
  ),
);
if (!result.passed) process.exitCode = 1;
