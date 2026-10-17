import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../../game/data-json.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { createAdvancedWorkerHandler } from '../../optional-practice/civilian-fpv/advanced-worker.mjs';
import {
  verifyAircraftArchive,
  verifyAircraftArchiveInWorker,
} from '../../optional-practice/civilian-fpv/aircraft-archive-verifier.mjs';
import { createAdvancedWorkerClient } from '../../optional-practice/civilian-fpv/advanced-worker-client.mjs';

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
function recorded(t, { ticks = 12, segmentBytes = 1, checkpoint = false } = {}) {
  const simulation = createAdvancedSimulation({ ...options(), recordingOptions: { segmentBytes } });
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
