import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../../game/data-json.mjs';
import {
  advancedComparisonEligibility,
  createAdvancedSimulation,
  initAdvancedRuntime,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { createAdvancedWorkerHandler } from '../../optional-practice/civilian-fpv/advanced-worker.mjs';
import {
  verifyAircraftArchive,
  verifyAircraftArchiveInWorker,
  verifyAircraftCourseArchiveInWorker,
} from '../../optional-practice/civilian-fpv/aircraft-archive-verifier.mjs';
import { createAdvancedWorkerClient } from '../../optional-practice/civilian-fpv/advanced-worker-client.mjs';

import { createAircraftCourseSession } from '../../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { BEGINNER_CATALOGUE } from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { createFlight } from '../../optional-practice/civilian-fpv/model.mjs';
import {
  validateWorldCourse,
  createWorldFlight,
} from '../../optional-practice/civilian-fpv/world-model.mjs';

await initAdvancedRuntime();
const size = (value) => Buffer.byteLength(JSON.stringify(value));
const input = (tick) => ({
  sequence: tick,
  timestampUs: tick * 20000,
  controls: { roll: tick % 7 === 0 ? 0.1 : 0, pitch: 0, yaw: 0, throttle: 0.4 },
});
const options = () => createPresetConfiguration('meteor75-analog-2022');
const run = (simulation, tick) => {
  simulation.enqueueInput(input(tick));
  return simulation.stepMission();
};
function archive(envelope, segments, { state = 'ended', kind = envelope.origin.kind } = {}) {
  const first = segments[0],
    last = segments.at(-1);
  return {
    format: 'AircraftArchivePackage.v1',
    manifest: {
      format: 'AircraftSessionArchive.v1',
      id: 'archive-runtime',
      host: 'arena',
      name: 'Runtime archive',
      createdAt: 0,
      revision: segments.length + 1,
      identity: envelope.identity,
      config: envelope.config,
      origin: { kind, startTick: first.startTick },
      state,
      firstIndex: first.index,
      lastIndex: last.index,
      startTick: first.startTick,
      endTick: last.endTick,
      segmentCount: segments.length,
      payloadBytes:
        size(envelope.config) + segments.reduce((total, segment) => total + size(segment), 0),
      finalHash: last.finalHash,
      scored: false,
    },
    segments,
  };
}
function recorded(t, { ticks = 12, segmentBytes = 1, checkpoint = false, configuration } = {}) {
  const simulation = createAdvancedSimulation({
    ...options(),
    ...(configuration ? { configuration } : {}),
    recordingOptions: { segmentBytes },
  });
  t.after(() => simulation.dispose());
  if (checkpoint) {
    const saved = simulation.checkpoint();
    saved.state.noiseState ^= 1;
    simulation.restoreCheckpoint(saved);
  }
  const initial = simulation.readSealedSegment();
  const segments = [];
  for (let tick = 0; tick < ticks; tick++) {
    run(simulation, tick);
    const next = simulation.readSealedSegment(segments.at(-1)?.index ?? -1);
    assert.equal(next.gap, false);
    if (next.segment) segments.push(next.segment);
  }
  const ended = simulation.finalizeArchive(segments.at(-1)?.index ?? -1);
  if (ended.segment) segments.push(ended.segment);
  return { simulation, initial, segments, packet: archive(initial, segments) };
}

test('sealed segment reads are immutable, accepted-boundary only and do not change physical hashes', (t) => {
  const simulation = createAdvancedSimulation({
    ...options(),
    recordingOptions: { segmentBytes: 1 },
  });
  t.after(() => simulation.dispose());
  const original = simulation.readSealedSegment();
  assert.equal(original.origin.kind, 'fresh');
  assert.equal(original.lastSealedIndex, -1);
  simulation.enqueueInput(input(0));
  const proposal = simulation.proposeMission();
  assert.throws(() => simulation.readSealedSegment(), /transaction/i);
  simulation.commitMission({ transaction: proposal.transaction, accepted: false });
  assert.equal(simulation.readSealedSegment().lastSealedIndex, -1);
  simulation.stepMission();
  const hash = simulation.stateHash();
  const first = simulation.readSealedSegment();
  assert.equal(first.segment.index, 0);
  assert.equal(first.segment.endTick, 1);
  first.segment.events.length = 0;
  assert.equal(simulation.readSealedSegment().segment.events.length, 1);
  assert.equal(simulation.stateHash(), hash);
  assert.equal(simulation.telemetry().archiveStatus.lastSealedIndex, 0);
});

test('archive verification derives optional challenge outcomes only from canonical fresh input history', async (t) => {
  const challenge = {
    format: 'AircraftChallengeRules.v1',
    kind: 'timed-practice',
    durationTicks: 1500,
  };
  const { packet } = recorded(t, {
    ticks: 1500,
    segmentBytes: 4 * 1024 * 1024,
    configuration: { challenge },
  });
  const complete = await verifyAircraftArchive(packet);
  assert.equal(complete.challenge.verified, true);
  assert.equal(complete.challenge.scored, false);
  assert.equal(complete.challenge.progress.result.reason, 'time-elapsed');
  assert.equal(complete.challenge.progress.result.missionTick, 1500);
  const interrupted = structuredClone(packet);
  interrupted.manifest.state = 'interrupted';
  assert.equal(
    (await verifyAircraftArchive(interrupted)).challenge.verified,
    true,
    'a fresh contiguous prefix independently proves its already reached result',
  );
  const checkpoint = structuredClone(packet);
  checkpoint.manifest.origin.kind = 'checkpoint';
  assert.deepEqual((await verifyAircraftArchive(checkpoint)).challenge, {
    verified: false,
    reason: 'checkpoint-origin',
    scored: false,
  });
  const incomplete = recorded(t, {
    ticks: 10,
    configuration: { challenge },
  });
  const pending = (await verifyAircraftArchive(incomplete.packet)).challenge;
  assert.equal(pending.verified, false);
  assert.equal(pending.reason, 'incomplete-challenge');
  assert.equal(pending.progress.missionTick, 10);
  const forged = recorded(t, {
    ticks: 10,
    checkpoint: true,
    configuration: { challenge },
  });
  forged.packet.manifest.origin.kind = 'fresh';
  assert.deepEqual((await verifyAircraftArchive(forged.packet)).challenge, {
    verified: false,
    reason: 'checkpoint-origin',
    scored: false,
  });
  const invalidEndurance = recorded(t, {
    ticks: 1,
    configuration: {
      challenge: {
        format: 'AircraftChallengeRules.v1',
        kind: 'battery-endurance',
        takeoffHoldTicks: 25,
        landingHoldTicks: 50,
      },
    },
  });
  await assert.rejects(
    verifyAircraftArchive(invalidEndurance.packet),
    /requires battery depletion/,
  );
});

test('finalizing an archive seals its current tail and flying continues on the identical trajectory', (t) => {
  const simulation = createAdvancedSimulation(options()),
    control = createAdvancedSimulation(options());
  t.after(() => {
    simulation.dispose();
    control.dispose();
  });
  for (let tick = 0; tick < 5; tick++) {
    run(simulation, tick);
    run(control, tick);
  }
  assert.equal(simulation.readSealedSegment().segment, null);
  const hash = simulation.stateHash(),
    checkpoint = simulation.checkpoint();
  const ended = simulation.finalizeArchive();
  assert.equal(ended.finalizedThroughIndex, 0);
  assert.equal(ended.segment.endTick, 5);
  assert.equal(simulation.stateHash(), hash);
  assert.deepEqual(simulation.checkpoint(), checkpoint);
  assert.equal(
    simulation.finalizeArchive(0).finalizedThroughIndex,
    0,
    'Repeated end creates no empty segment',
  );
  for (let tick = 5; tick < 20; tick++) {
    run(simulation, tick);
    run(control, tick);
  }
  assert.equal(simulation.stateHash(), control.stateHash());
});

test('evicted and rewound archive cursors report a gap and restore/reset publish a new generation', (t) => {
  const simulation = createAdvancedSimulation({
    ...options(),
    recordingOptions: { segmentBytes: 1 },
  });
  t.after(() => simulation.dispose());
  const initialGeneration = simulation.telemetry().archiveStatus.generation;
  for (let tick = 0; tick < 6; tick++) run(simulation, tick);
  const read = simulation.readSealedSegment(-1);
  assert.equal(read.gap, true);
  assert.ok(read.earliestIndex > 0);
  assert.equal(read.segment.index, read.earliestIndex);
  assert.equal(simulation.readSealedSegment(500).gap, true);
  const saved = simulation.snapshot();
  simulation.restore(saved);
  assert.notEqual(simulation.telemetry().archiveStatus.generation, initialGeneration);
  assert.equal(simulation.readSealedSegment(read.earliestIndex - 1).origin.kind, 'checkpoint');
  const restoredGeneration = simulation.telemetry().archiveStatus.generation;
  simulation.restore(saved);
  assert.notEqual(simulation.telemetry().archiveStatus.generation, restoredGeneration);
  simulation.reset();
  assert.equal(simulation.readSealedSegment().origin.kind, 'fresh');
});

test('worker exposes sealed reads and final tail without replacing the flight', async (t) => {
  const replies = [],
    handler = createAdvancedWorkerHandler((reply) => replies.push(reply));
  t.after(() => handler.dispose());
  let id = 0;
  async function request(type, fields = {}) {
    await handler.receive({ type, session: 'archive-test', id: ++id, ...fields });
    const reply = replies.at(-1);
    assert.equal(reply.error, undefined);
    return reply.result;
  }
  await request('init', { options: options() });
  assert.equal((await request('read-sealed-segment')).segment, null);
  await request('step', { sample: input(0) });
  const final = await request('finalize-archive', { afterIndex: -1 });
  assert.equal(final.segment.endTick, 1);
  assert.equal((await request('step', { sample: input(1) })).telemetry.missionTick, 2);
});

test('sequential verification distinguishes complete sessions, unfinished archives and checkpoint clips', async (t) => {
  const { packet, initial, segments } = recorded(t);
  const progress = [];
  const checked = await verifyAircraftArchive(packet, {
    onProgress: (value) => progress.push(value),
  });
  assert.equal(checked.verified, true);
  assert.equal(checked.verificationScope, 'complete-session');
  assert.equal(checked.scored, false);
  assert.equal(checked.verifiedSegments, 12);
  assert.equal(Object.hasOwn(checked, 'telemetrySamples'), false);
  assert.equal(progress.at(-1).verifiedThroughMission, 12);
  assert.equal(
    (await verifyAircraftArchive(archive(initial, segments, { state: 'interrupted' })))
      .verificationScope,
    'checkpoint-clip',
  );
  const checkpoint = recorded(t, { checkpoint: true, ticks: 3 });
  assert.equal(
    (await verifyAircraftArchive(checkpoint.packet)).verificationScope,
    'checkpoint-clip',
  );
  checkpoint.packet.manifest.origin.kind = 'fresh';
  assert.equal(
    (await verifyAircraftArchive(checkpoint.packet)).verificationScope,
    'checkpoint-clip',
    'A claimed fresh origin cannot replace the canonical initial-state check',
  );
});

test('archive verifier rejects missing/reordered segments and checkpoint tampering even with refreshed checksums', async (t) => {
  const { packet, initial, segments } = recorded(t, { ticks: 4 });
  const missing = structuredClone(packet);
  missing.segments.splice(1, 1);
  await assert.rejects(verifyAircraftArchive(missing), /segment|range|manifest/i);
  const changed = structuredClone(segments);
  changed[1].checkpoint.state.noiseState ^= 1;
  for (let index = 2; index < changed.length; index++)
    changed[index].previous = dataIdentity(changed[index - 1]);
  await assert.rejects(verifyAircraftArchive(archive(initial, changed)), /checkpoint changed/);
});

test('archive verification is cancellable before starting and during a segment', async (t) => {
  const { packet } = recorded(t, { ticks: 60, segmentBytes: 1024 * 1024 });
  const before = new AbortController();
  before.abort();
  await assert.rejects(verifyAircraftArchive(packet, { signal: before.signal }), {
    name: 'AbortError',
  });
  const during = new AbortController();
  await assert.rejects(
    verifyAircraftArchive(packet, {
      signal: during.signal,
      onProgress: ({ verifiedThroughMission }) => {
        if (verifiedThroughMission >= 25) during.abort();
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(
    (await verifyAircraftArchive(packet)).verified,
    true,
    'Cancelled simulator is released before another verification',
  );
});

test('detached worker verification reports progress and cancelling it leaves the active flight worker alive', async (t) => {
  class LocalWorker {
    static instances = [];
    constructor() {
      this.listeners = new Map();
      this.terminated = false;
      this.handler = createAdvancedWorkerHandler((data) => {
        if (!this.terminated) this.listeners.get('message')?.({ data });
      });
      LocalWorker.instances.push(this);
    }
    addEventListener(type, callback) {
      this.listeners.set(type, callback);
    }
    removeEventListener(type) {
      this.listeners.delete(type);
    }
    postMessage(message) {
      void this.handler.receive(message);
    }
    terminate() {
      this.terminated = true;
      this.handler.dispose();
    }
  }
  const active = createAdvancedWorkerClient({ Worker: LocalWorker });
  t.after(() => active.dispose());
  await active.initialize(options());
  const flyingWorker = LocalWorker.instances.at(-1);
  await active.step(input(0));
  const { packet } = recorded(t, { ticks: 60, segmentBytes: 1024 * 1024 });
  const cancel = new AbortController(),
    progress = [];
  await assert.rejects(
    verifyAircraftArchiveInWorker(packet, {
      Worker: LocalWorker,
      signal: cancel.signal,
      onProgress(value) {
        progress.push(value);
        if (value.verifiedThroughMission >= 25) cancel.abort();
      },
    }),
    { name: 'AbortError' },
  );
  assert.ok(progress.length > 1);
  assert.equal(LocalWorker.instances.at(-1).terminated, true);
  assert.equal(flyingWorker.terminated, false);
  assert.equal((await active.step(input(1))).telemetry.missionTick, 2);
  const result = await verifyAircraftArchiveInWorker(packet, { Worker: LocalWorker });
  assert.equal(result.verificationScope, 'complete-session');
  assert.equal(LocalWorker.instances.at(-1).terminated, true);
  await assert.rejects(verifyAircraftArchiveInWorker(packet, { Worker: null }), /Web Workers/);
  assert.equal(flyingWorker.terminated, false);
});

async function recordedCourse(t, { family = 'world', model, ticks = 8, mode = 'self-level' } = {}) {
  const course = structuredClone(
    family === 'world' ? BEGINNER_CATALOGUE[0].course : FLIGHT_COURSES[0],
  );
  for (const flightMode of ['acro', 'self-level']) {
    const hold = structuredClone(course.steps[flightMode].find((step) => step.type === 'hold'));
    hold.min = { x: -10000, y: -1000, z: -10000 };
    hold.max = { x: 10000, y: 8000, z: 10000 };
    hold.ticks = 3;
    course.steps[flightMode] = [hold];
  }
  const preset = options();
  let simulation;
  const session = createAircraftCourseSession(
    {
      course,
      mode,
      model,
      legacy: family === 'academy',
      configuration: {
        response: preset.response,
        advanced: { aircraft: preset.aircraft, controller: preset.controller },
      },
    },
    {
      createMission: family === 'academy' ? createFlight : createWorldFlight,
      createClient: () => ({
        async initialize(config) {
          simulation = createAdvancedSimulation({
            ...config,
            recordingOptions: { segmentBytes: 5000 },
          });
          return { telemetry: simulation.telemetry() };
        },
        async stageTerrainFrame(frame) {
          return simulation.stageTerrainFrame(frame);
        },
        async commitTerrainFrame(value) {
          return simulation.commitTerrainFrame(value);
        },
        async step(sample, motions) {
          simulation.enqueueInput(sample);
          return simulation.stepMission({ motions });
        },
        dispose() {
          simulation?.dispose();
        },
      }),
    },
  );
  t.after(() => session.dispose());
  await session.prepare();
  const initial = simulation.readSealedSegment(),
    segments = [];
  session.arm();
  for (let tick = 0; tick < ticks; tick++) {
    await session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0 });
    const row = simulation.readSealedSegment(segments.at(-1)?.index ?? -1);
    if (row.segment) segments.push(row.segment);
  }
  const end = simulation.finalizeArchive(segments.at(-1)?.index ?? -1);
  if (end.segment) segments.push(end.segment);
  assert.equal(session.snapshot().step, 1);
  const packet = archive(initial, segments);
  packet.manifest.host = family;
  return { packet, course };
}
const worldCourseAdapter = {
  format: 'FlightCourse.v2',
  validate: validateWorldCourse,
  createMission: createWorldFlight,
};
class CourseWorker {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.listeners = new Map();
    this.messages = [];
    this.terminated = false;
    this.handler = createAdvancedWorkerHandler(
      (data) => {
        if (!this.terminated) this.listeners.get('message')?.({ data: structuredClone(data) });
      },
      { courseAdapter: String(url).includes('/fpv-worlds/') ? worldCourseAdapter : undefined },
    );
    CourseWorker.instances.push(this);
  }
  addEventListener(type, fn) {
    this.listeners.set(type, fn);
  }
  removeEventListener(type) {
    this.listeners.delete(type);
  }
  postMessage(message) {
    const data = structuredClone(message);
    this.messages.push(data);
    this.pending = this.handler.receive(data);
  }
  terminate() {
    this.terminated = true;
    this.handler.dispose();
  }
}
const worldWorkerURL = new URL(
  '../../optional-practice/fpv-worlds/advanced-worker.mjs',
  import.meta.url,
);

test('course worker reconstructs supported adapters and preserves separate physical-only verification', async (t) => {
  for (const family of ['academy', 'world'])
    for (const model of ['aircraft-course-practice.v1', 'aircraft-course-practice.v2']) {
      const { packet, course } = await recordedCourse(t, { family, model });
      for (const workerURL of family === 'academy'
        ? [undefined, worldWorkerURL]
        : [worldWorkerURL]) {
        const before = JSON.stringify(packet),
          progress = [];
        const result = await verifyAircraftCourseArchiveInWorker(packet, course, {
          Worker: CourseWorker,
          workerURL,
          onProgress: (value) => progress.push(value),
        });
        assert.equal(result.physics.verified, true);
        assert.equal(result.course.verified, true);
        assert.equal(result.missionModel, model);
        assert.equal(result.course.completedAtTick, 3);
        assert.equal(result.course.splits.length, 1);
        assert.equal(result.scored, false);
        assert.equal(Object.hasOwn(result, 'toolingOnly'), false);
        assert.ok(progress.some((row) => row.phase === 'physics'));
        assert.ok(progress.some((row) => row.phase === 'course'));
        assert.equal(advancedComparisonEligibility(result, result).eligible, false);
        assert.equal(JSON.stringify(packet), before);
        const worker = CourseWorker.instances.at(-1);
        assert.equal(worker.terminated, true);
        assert.equal(worker.listeners.size, 0);
        assert.equal(
          worker.messages.filter((row) => row.type === 'verify-course-archive').length,
          1,
        );
        assert.equal(
          worker.messages.some((row) => Object.hasOwn(row, 'courseAdapter')),
          false,
        );
      }
      const physical = await verifyAircraftArchiveInWorker(packet, { Worker: CourseWorker });
      assert.equal(physical.verified, true);
      assert.equal(physical.verificationScope, 'complete-session');
      assert.equal(Object.hasOwn(physical, 'course'), false);
    }
});

test('course workers report unsupported, mismatched and partial cases without promoting physical success', async (t) => {
  const { packet, course } = await recordedCourse(t);
  const academyOnly = await verifyAircraftCourseArchiveInWorker(packet, course, {
    Worker: CourseWorker,
  });
  assert.equal(academyOnly.physics.verified, true);
  assert.equal(academyOnly.course.reason, 'unsupported-course-format');
  const changed = structuredClone(course);
  changed.steps['self-level'][0].ticks++;
  for (const [current, dependency, reason] of [
    [packet, changed, 'course-identity-mismatch'],
    [packet, null, 'missing-course-dependency'],
    [
      { ...packet, manifest: { ...packet.manifest, state: 'interrupted' } },
      course,
      'course-needs-complete-reset-session',
    ],
    [
      { ...packet, manifest: { ...packet.manifest, host: 'regional' } },
      course,
      'unsupported-archive-host',
    ],
  ]) {
    const result = await verifyAircraftCourseArchiveInWorker(current, dependency, {
      Worker: CourseWorker,
      workerURL: worldWorkerURL,
    });
    assert.equal(result.physics.verified, true);
    assert.equal(result.course.verified, false);
    assert.equal(result.course.reason, reason);
    assert.equal(result.scored, false);
  }
  await assert.rejects(
    verifyAircraftCourseArchiveInWorker(
      packet,
      { ...course, evaluator: () => true },
      { Worker: CourseWorker },
    ),
    /JSON|function|unsupported/i,
  );
  await assert.rejects(
    verifyAircraftCourseArchiveInWorker(packet, course, { Worker: null }),
    /Web Workers/,
  );
});

test('course cancellation and callback errors release only the detached worker and ignore late results', async (t) => {
  const active = createAdvancedWorkerClient({ Worker: CourseWorker });
  t.after(() => active.dispose());
  await active.initialize(options());
  await active.step(input(0));
  const flying = CourseWorker.instances.at(-1),
    before = await active.snapshot();
  const { packet, course } = await recordedCourse(t, { ticks: 60 });
  for (const phase of ['physics', 'course']) {
    for (const failure of ['cancel', 'callback']) {
      const signal = new AbortController(),
        received = [];
      const run = verifyAircraftCourseArchiveInWorker(packet, course, {
        Worker: CourseWorker,
        workerURL: worldWorkerURL,
        signal: signal.signal,
        onProgress(value) {
          received.push(value);
          if (value.phase === phase) {
            if (failure === 'cancel') signal.abort();
            else throw new Error('consumer failed');
          }
        },
      });
      await assert.rejects(run, failure === 'cancel' ? { name: 'AbortError' } : /consumer failed/);
      const worker = CourseWorker.instances.at(-1),
        count = received.length;
      await worker.pending;
      assert.equal(received.length, count, 'no late owned progress after cancellation');
      assert.equal(worker.terminated, true);
      assert.equal(worker.listeners.size, 0);
      assert.equal(flying.terminated, false);
      assert.deepEqual(await active.snapshot(), before);
    }
  }
  const result = await verifyAircraftCourseArchiveInWorker(packet, course, {
    Worker: CourseWorker,
    workerURL: worldWorkerURL,
  });
  assert.equal(result.course.verified, true);
  assert.equal((await active.step(input(1))).telemetry.missionTick, 2);
});
