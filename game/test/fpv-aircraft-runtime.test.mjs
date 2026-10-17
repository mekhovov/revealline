import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initAdvancedRuntime,
  createAdvancedSimulation,
  replayAdvancedRecording,
  verifyAdvancedRecovery,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  createPresetConfiguration,
  listAircraftPresets,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { createAircraftTerrainFrame } from '../../optional-practice/civilian-fpv/aircraft-terrain.mjs';
import {
  createAircraftRecorder,
  validateAircraftRecording,
} from '../../optional-practice/civilian-fpv/aircraft-recording.mjs';
import {
  aircraftPerformance,
  stepAircraftPropulsion,
} from '../../optional-practice/civilian-fpv/aircraft-physics.mjs';
import { createAdvancedWorkerHandler } from '../../optional-practice/civilian-fpv/advanced-worker.mjs';

await initAdvancedRuntime();
const preset = () => createPresetConfiguration('meteor75-analog-2022');
const sample = (sequence, throttle = 0.4) => ({
  sequence,
  timestampUs: sequence * 20000,
  controls: { roll: sequence % 13 === 0 ? 0.02 : 0, pitch: 0, yaw: 0, throttle },
});
const ground = (shift = 0) =>
  createAircraftTerrainFrame({
    sourceIdentity: '0123456789abcdef',
    colliders: [
      {
        id: 'ground',
        vertices: [-30, shift, -30, 30, shift, -30, 30, shift, 30, -30, shift, 30],
        indices: [0, 2, 1, 0, 3, 2],
      },
    ],
  });

test('all catalog aircraft run physical self-level and Acro sessions with independent mass and geometry', () => {
  for (const item of listAircraftPresets())
    for (const mode of ['acro', 'self-level']) {
      const config = createPresetConfiguration(item.id),
        sim = createAdvancedSimulation({ ...config, mode });
      try {
        const hover = aircraftPerformance(config.aircraft).hoverThrottle;
        for (let tick = 0; tick < 20; tick++) {
          sim.enqueueInput(sample(tick, hover));
          sim.stepMission();
        }
        const telemetry = sim.telemetry();
        assert.equal(telemetry.backend, 'civilian-quad-aircraft.v1');
        assert.ok(Number.isFinite(telemetry.position.y), `${item.id} ${mode}`);
        assert.equal(telemetry.usedAh, 0);
        assert.ok(telemetry.supportHeight > 0);
        assert.equal(sim.snapshot().checkpoint.state.missionTick, 20);
      } finally {
        sim.dispose();
      }
    }
});

test('optional depletion consumes real amp-hours, survives recovery, and resets only with a fresh flight', async (t) => {
  const selected = preset();
  selected.aircraft.battery.depletion = true;
  const simulation = createAdvancedSimulation(selected),
    frequentClips = createAdvancedSimulation({
      ...selected,
      recordingOptions: { segmentBytes: 1 },
    }),
    unlimited = createAdvancedSimulation(preset());
  t.after(() => {
    simulation.dispose();
    frequentClips.dispose();
    unlimited.dispose();
  });
  const freshHash = simulation.stateHash();
  assert.notEqual(simulation.identity, unlimited.identity);
  assert.notEqual(simulation.comparison().comparisonClass, unlimited.comparison().comparisonClass);
  for (let tick = 0; tick < 250; tick++) {
    for (const item of [simulation, frequentClips, unlimited]) {
      item.enqueueInput(sample(tick, 0.6));
      item.stepMission();
    }
    if (tick % 13 === 0)
      frequentClips.finalizeArchive(frequentClips.telemetry().archiveStatus.lastSealedIndex);
  }
  const consumed = simulation.telemetry();
  assert.ok(consumed.usedAh > 0);
  assert.ok(consumed.usedAh <= (selected.aircraft.battery.currentLimit * consumed.seconds) / 3600);
  assert.equal(
    frequentClips.stateHash(),
    simulation.stateHash(),
    'Recording windows cannot accelerate battery depletion',
  );
  assert.equal(unlimited.telemetry().usedAh, 0);
  assert.ok(
    unlimited.telemetry().voltage < selected.aircraft.battery.fullVoltage,
    'Instantaneous sag remains active without depletion',
  );
  assert.equal(unlimited.configuration().aircraft.mass, selected.aircraft.mass);
  assert.equal(
    unlimited.configuration().aircraft.motorOutputLimit,
    selected.aircraft.motorOutputLimit,
  );
  const physical = stepAircraftPropulsion(selected.aircraft, {
    motorSpeeds: [0.5, 0.5, 0.5, 0.5],
    commands: [0.5, 0.5, 0.5, 0.5],
    usedAh: 0.001,
    dt: 0.002,
  });
  assert.equal(physical.usedAh, 0.001 + (physical.current * 0.002) / 3600);
  const saved = await verifyAdvancedRecovery(simulation.snapshot());
  const restored = createAdvancedSimulation(selected);
  t.after(() => restored.dispose());
  restored.restore(saved);
  assert.equal(restored.telemetry().usedAh, consumed.usedAh);
  assert.equal(restored.telemetry().voltage, consumed.voltage);
  for (const item of [simulation, restored]) {
    item.enqueueInput(sample(250, 0.6));
    item.stepMission();
  }
  assert.equal(
    restored.stateHash(),
    simulation.stateHash(),
    'Resume continues the previous charge state',
  );
  restored.reset();
  assert.equal(restored.telemetry().usedAh, 0);
  assert.equal(restored.telemetry().voltage, selected.aircraft.battery.fullVoltage);
  assert.equal(restored.stateHash(), freshHash);
});

test('unrestricted practice passes twelve minutes with bounded clips and unchanged depleted-off battery', async () => {
  const sim = createAdvancedSimulation({ ...preset() });
  try {
    for (let tick = 0; tick <= 36010; tick++) {
      sim.enqueueInput(sample(tick, 0));
      sim.stepMission();
    }
    assert.ok(sim.telemetry().seconds > 720);
    assert.equal(sim.telemetry().usedAh, 0);
    assert.ok(sim.recordingStatus().retainedSegments <= 3);
    const record = sim.recording();
    assert.ok(record.startMissionTick >= 30000);
    assert.ok(record.missionTicks - record.startMissionTick <= 9000);
    const replayed = await replayAdvancedRecording(record);
    assert.equal(replayed.verificationScope, 'checkpoint-clip');
    assert.equal(replayed.scored, false);
    assert.equal(replayed.snapshot.hash, sim.stateHash());
    const verified = await verifyAdvancedRecovery(sim.snapshot());
    const restored = createAdvancedSimulation(preset());
    try {
      restored.restore(verified);
      assert.equal(restored.stateHash(), sim.stateHash());
      const next = sample(36011, 0.3);
      sim.enqueueInput(next);
      restored.enqueueInput(next);
      sim.stepMission();
      restored.stepMission();
      assert.equal(restored.stateHash(), sim.stateHash());
    } finally {
      restored.dispose();
    }
  } finally {
    sim.dispose();
  }
});

test('recording disabled, memory quota and persistence failure never change physical state', () => {
  const base = preset();
  const sims = [
    createAdvancedSimulation(base),
    createAdvancedSimulation({ ...base, recording: false }),
    createAdvancedSimulation({ ...base, recordingOptions: { maxBytes: 1, segmentBytes: 1 } }),
  ];
  try {
    for (let tick = 0; tick < 100; tick++)
      for (const sim of sims) {
        sim.enqueueInput(sample(tick));
        sim.stepMission();
        if (tick === 50) sim.reportPersistence({ error: 'quota' });
      }
    assert.deepEqual(
      sims.map((sim) => sim.stateHash()),
      [sims[0].stateHash(), sims[0].stateHash(), sims[0].stateHash()],
    );
    assert.equal(sims[1].recordingStatus().state, 'disabled');
    assert.equal(sims[2].recordingStatus().state, 'unavailable');
    sims[0].reportPersistence({ savedThroughMission: 80 });
    assert.equal(sims[0].recordingStatus().lastRecoverableSeconds, 1.6);
    assert.throws(() => sims[0].reportPersistence({ savedThroughMission: 101 }), /durable/);
  } finally {
    sims.forEach((sim) => sim.dispose());
  }
});

test('aircraft identities ignore names and camera, allow personal rotation curves, and bind throttle, battery and wind', () => {
  const base = preset(),
    changedRates = structuredClone(base.response);
  changedRates.rates.axes.roll.rate += 10;
  const a = createAdvancedSimulation({
    ...base,
    configuration: { profileId: 'one', camera: { fov: 80 }, advanced: base },
  });
  const b = createAdvancedSimulation({
    ...base,
    configuration: { profileId: 'two', camera: { fov: 100 }, advanced: base },
  });
  const c = createAdvancedSimulation({ ...base, response: changedRates });
  const baseline = createAdvancedSimulation(base);
  const limited = structuredClone(base);
  limited.response.rates.throttle.limitType = 'scale';
  limited.response.rates.throttle.limitPercent = 70;
  const withLimit = createAdvancedSimulation(limited);
  const battery = structuredClone(base);
  battery.aircraft.battery.depletion = true;
  const withBattery = createAdvancedSimulation(battery);
  const withWind = createAdvancedSimulation({ ...base, wind: { x: 2, y: 0, z: 0 } });
  try {
    assert.equal(a.identity, b.identity);
    assert.notEqual(c.identity, baseline.identity);
    assert.equal(c.comparison().comparisonClass, baseline.comparison().comparisonClass);
    for (const different of [withLimit, withBattery, withWind])
      assert.notEqual(
        different.comparison().comparisonClass,
        baseline.comparison().comparisonClass,
      );
    assert.throws(
      () => createAdvancedSimulation({ ...base, rateEvaluator: () => ({}) }),
      /serializable/,
    );
  } finally {
    for (const sim of [a, b, c, baseline, withLimit, withBattery, withWind]) sim.dispose();
  }
});

test('deactivated spherical actors retain authoritative poses across restore, and failed recording adoption is atomic', async () => {
  const options = {
    ...preset(),
    dynamicColliders: [
      {
        id: 'tail',
        position: { x: 2, y: 1, z: 0 },
        radius: 0.2,
        height: 0.4,
        shape: 'sphere',
        enabled: false,
      },
      {
        id: 'inactive-tail',
        position: { x: 4, y: 1, z: 0 },
        radius: 0.2,
        height: 0.4,
        shape: 'sphere',
        enabled: false,
      },
    ],
  };
  const sim = createAdvancedSimulation(options);
  try {
    for (let tick = 0; tick < 5; tick++)
      sim.stepMission({
        motions: [
          {
            id: 'tail',
            from: { x: 2 + tick * 0.1, y: 1, z: 0 },
            to: { x: 2 + (tick + 1) * 0.1, y: 1, z: 0 },
            enabled: tick > 1,
          },
        ],
      });
    assert.equal(sim.telemetry().dynamicColliders[0].enabled, true);
    assert.equal(sim.telemetry().dynamicColliders[0].position.x, 2.5);
    assert.equal(sim.telemetry().dynamicColliders[1].enabled, false);
    await verifyAdvancedRecovery(sim.snapshot());
    const before = sim.snapshot(),
      broken = structuredClone(before);
    broken.recording.segments[0].finalHash = '00000000';
    assert.throws(() => sim.restore(broken), /range/);
    assert.deepEqual(sim.snapshot(), before);
  } finally {
    sim.dispose();
  }
});

test('terrain rejection and a segment-boundary rejection roll back every physical and recording field', async () => {
  const sim = createAdvancedSimulation({
    ...preset(),
    terrain: { format: 'AdvancedRegionalTerrain.v1' },
    floor: false,
  });
  try {
    let staged = sim.stageTerrainFrame(ground());
    sim.commitTerrainFrame({ transaction: staged.transaction, accepted: true });
    for (let tick = 0; tick < 2999; tick++) sim.stepMission();
    const before = sim.snapshot(),
      recording = sim.recording();
    sim.enqueueInput(sample(2999));
    const queued = sim.snapshot();
    const proposed = sim.proposeMission();
    sim.commitMission({ transaction: proposed.transaction, accepted: false });
    assert.deepEqual(sim.snapshot(), queued);
    assert.deepEqual(sim.recording(), recording);
    sim.stepMission();
    assert.equal(sim.recording().segments.length, 2);
    staged = sim.stageTerrainFrame(ground(-0.2));
    sim.commitTerrainFrame({ transaction: staged.transaction, accepted: false });
    assert.equal(sim.telemetry().terrain.frameIdentity, before.checkpoint.terrain.identity);
    const checked = await replayAdvancedRecording(sim.recording());
    assert.equal(checked.snapshot.hash, sim.stateHash());
  } finally {
    sim.dispose();
  }
});

test('terrain intersecting only a large aircraft rotor is rejected with complete checkpoint rollback', () => {
  const configuration = createPresetConfiguration('holybro-x650-v2');
  const sim = createAdvancedSimulation({
    ...configuration,
    terrain: { format: 'AdvancedRegionalTerrain.v1' },
    floor: false,
  });
  try {
    const before = sim.snapshot();
    const geometry = configuration.aircraft.geometry;
    const rotor = geometry.rotors.find((item) => item.position.x > 0);
    const x = rotor.position.x + geometry.propellerRadius * 0.7;
    const z = rotor.position.z;
    assert.ok(x > geometry.bodyHalfExtents.x + Math.abs(geometry.centerOfMass.x));
    const frame = createAircraftTerrainFrame({
      sourceIdentity: '0123456789abcdef',
      colliders: [
        {
          id: 'rotor-only-wall',
          vertices: [x, 1, z - 0.15, x, 3, z - 0.15, x, 3, z + 0.15, x, 1, z + 0.15],
          indices: [0, 1, 2, 0, 2, 3],
        },
      ],
    });
    assert.throws(() => sim.stageTerrainFrame(frame), /intersects.*collision geometry/);
    assert.deepEqual(sim.snapshot(), before);
  } finally {
    sim.dispose();
  }
});

test('accepted moving actor samples replay, and arbitrary checkpoint hulls are rejected', async () => {
  const config = {
    ...preset(),
    dynamicColliders: [{ id: 'actor', position: { x: 3, y: 1, z: 0 }, radius: 0.3, height: 2 }],
  };
  const sim = createAdvancedSimulation(config);
  try {
    for (let tick = 0; tick < 20; tick++)
      sim.stepMission({
        motions: [
          {
            id: 'actor',
            from: { x: 3 + tick / 100, y: 1, z: 0 },
            to: { x: 3 + (tick + 1) / 100, y: 1, z: 0 },
          },
        ],
      });
    assert.equal((await replayAdvancedRecording(sim.recording())).snapshot.hash, sim.stateHash());
    const corrupt = sim.snapshot();
    corrupt.checkpoint.state.motorSpeeds[0] = 2;
    assert.throws(() => sim.restore(corrupt), /dynamics/);
  } finally {
    sim.dispose();
  }
});

test('segments reject missing, reordered and modified data without treating checkpoint-origin clips as complete flights', () => {
  const checkpoint = { state: { missionTick: 0 } };
  const recorder = createAircraftRecorder({
    identity: '0123456789abcdef',
    config: {},
    checkpoint,
    hash: '00000000',
  });
  for (let tick = 1; tick <= 6000; tick++)
    recorder.append({
      tick,
      stateHash: '00000000',
      checkpoint: () => ({ state: { missionTick: tick } }),
    });
  const valid = recorder.recording();
  validateAircraftRecording(valid);
  const missing = structuredClone(valid);
  missing.segments.splice(1, 1);
  assert.throws(() => validateAircraftRecording(missing), /Missing|reordered/);
  const changed = structuredClone(valid);
  changed.segments[1].checkpoint.state.missionTick++;
  assert.throws(() => validateAircraftRecording(changed), /segment/);
});

test('high-cadence clips rotate before the import event limit even with a larger byte budget', () => {
  const recorder = createAircraftRecorder({
    identity: '0123456789abcdef',
    config: {},
    checkpoint: { state: { missionTick: 0 } },
    hash: '00000000',
    segmentBytes: 4 * 1024 * 1024,
  });
  for (let tick = 1; tick <= 2600; tick++)
    recorder.append({
      tick,
      events: Array.from({ length: 10 }, (_, offset) => {
        const step = (tick - 1) * 10 + offset;
        return ['input', step, step, step * 2000, 0, 0, 0, 0];
      }),
      stateHash: '00000000',
      checkpoint: () => ({ state: { missionTick: tick } }),
    });
  const record = validateAircraftRecording(recorder.recording());
  assert.equal(record.segments.length, 2);
  assert.equal(record.segments[0].endTick, 2400);
  assert.equal(record.segments[1].startTick, 2400);
  assert.equal(record.missionTicks, 2600);
  assert.equal(recorder.status().state, 'recording');
});

test('large terrain checkpoints do not consume the stream budget and restored streams rotate identically', () => {
  const identity = '0123456789abcdef',
    hash = '00000000';
  const checkpoint = (tick) => ({
    identity,
    state: { missionTick: tick },
    world: 'x'.repeat(1200 * 1024),
  });
  const options = { identity, config: {}, checkpoint: checkpoint(0), hash };
  const recorder = createAircraftRecorder(options);
  const append = (owner, tick, events = []) =>
    owner.append({
      tick,
      events,
      stateHash: hash,
      checkpoint: () => checkpoint(tick),
    });
  for (let tick = 1; tick <= 3000; tick++) append(recorder, tick);
  let saved = recorder.recording();
  assert.deepEqual(
    saved.segments.map(({ startTick, endTick }) => [startTick, endTick]),
    [
      [0, 3000],
      [3000, 3000],
    ],
  );
  assert.ok(recorder.status().retainedBytes > 2 * 1200 * 1024);
  for (let tick = 3001; tick <= 6000; tick++) append(recorder, tick);
  saved = recorder.recording();
  assert.deepEqual(
    saved.segments.map(({ startTick, endTick }) => [startTick, endTick]),
    [
      [0, 3000],
      [3000, 6000],
      [6000, 6000],
    ],
  );
  const restored = createAircraftRecorder(options);
  restored.restore(saved);
  for (let tick = 6001; tick <= 9000; tick++) {
    append(recorder, tick);
    append(restored, tick);
  }
  assert.deepEqual(restored.recording(), recorder.recording());
  assert.equal(recorder.recording().segments[0].startTick, 3000);

  const smallStream = createAircraftRecorder({ ...options, segmentBytes: 100 });
  append(smallStream, 1, [['input', 0, 0, 0, 0, 0, 0, 0]]);
  const partial = smallStream.recording();
  assert.equal(partial.segments.length, 1);
  const resumed = createAircraftRecorder({ ...options, segmentBytes: 100 });
  resumed.restore(partial);
  for (let tick = 2; tick <= 8; tick++) {
    const events = [['input', tick * 10, tick, tick * 20000, 0, 0, 0, 0]];
    append(smallStream, tick, events);
    append(resumed, tick, events);
    assert.deepEqual(resumed.recording(), smallStream.recording());
  }
  assert.ok(smallStream.recording().segments.length > 1, 'event growth still rotates early');

  const hashes = createAircraftRecorder({ ...options, segmentBytes: 50 });
  for (let tick = 1; tick <= 75; tick++) append(hashes, tick);
  const resumedHashes = createAircraftRecorder({ ...options, segmentBytes: 50 });
  resumedHashes.restore(hashes.recording());
  for (let tick = 76; tick <= 200; tick++) {
    append(hashes, tick);
    append(resumedHashes, tick);
  }
  assert.equal(hashes.recording().segments[0].endTick, 150);
  assert.deepEqual(resumedHashes.recording(), hashes.recording());

  const limited = createAircraftRecorder({
    ...options,
    segmentBytes: 100,
    maxBytes: 1250 * 1024,
  });
  append(limited, 1, [['terrain', 0, 'y'.repeat(60 * 1024)]]);
  assert.ok(limited.status().retainedBytes <= 1250 * 1024);
  const oversized = createAircraftRecorder({
    ...options,
    segmentBytes: 100,
    maxBytes: 1000 * 1024,
  });
  assert.equal(oversized.status().state, 'unavailable');
  assert.equal(oversized.status().error, 'recording-capacity');
  assert.doesNotThrow(() => append(oversized, 1));
  assert.equal(oversized.status().currentSeconds, 0.02);
});

test('worker transports aircraft descriptors, actor motion and recording persistence without function callbacks', async () => {
  const replies = [],
    handler = createAdvancedWorkerHandler((value) => replies.push(value));
  try {
    await handler.receive({
      id: 1,
      session: 'aircraft',
      type: 'init',
      options: { ...preset(), mode: 'self-level' },
    });
    assert.equal(replies.at(-1).error, undefined);
    await handler.receive({ id: 2, session: 'aircraft', type: 'step', sample: sample(0) });
    assert.equal(replies.at(-1).result.telemetry.missionTick, 1);
    await handler.receive({
      id: 3,
      session: 'aircraft',
      type: 'recording-persistence',
      status: { savedThroughMission: 1 },
    });
    assert.equal(replies.at(-1).result.lastRecoverableSeconds, 0.02);
  } finally {
    handler.dispose();
  }
});
