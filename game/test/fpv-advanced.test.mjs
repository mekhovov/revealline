import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdvancedController } from '../../optional-practice/civilian-fpv/advanced-controller.mjs';
import {
  ADVANCED_AIRCRAFT_TEMPLATES,
  ADVANCED_QUALIFICATION,
  advancedFlightIdentities,
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
  validateAdvancedAircraft,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createRateProfile } from '../../optional-practice/civilian-fpv/rates.mjs';

await initAdvancedRuntime();
const controls = (roll = 0, throttle = 0.5) => ({ roll, pitch: 0, yaw: 0, throttle });
const sample = (sequence, values = controls()) => ({
  sequence,
  timestampUs: sequence * 20000,
  controls: values,
});

test('independent controller bounds motors, unwinds saturation and restores all filters', () => {
  const controller = createAdvancedController();
  const input = {
    controls: controls(1),
    target: { roll: 1998, pitch: 1998, yaw: 1998, throttle: 0.5 },
    sensors: { roll: 0, pitch: 0, yaw: 0 },
    dt: 0.002,
  };
  for (let index = 0; index < 1000; index++)
    assert.ok(controller.step(input).motors.every((motor) => motor >= 0 && motor <= 1));
  assert.equal(controller.telemetry().saturated, true);
  assert.ok(
    Object.values(controller.telemetry().integral).every((value) => Math.abs(value) <= 0.12),
  );
  const snapshot = controller.snapshot();
  const expected = controller.step({ ...input, target: { ...input.target, throttle: 0 } });
  assert.deepEqual(expected.motors, [0, 0, 0, 0]);
  assert.deepEqual(controller.telemetry().integral, { roll: 0, pitch: 0, yaw: 0 });
  controller.restore(snapshot);
  assert.deepEqual(
    controller.step({ ...input, target: { ...input.target, throttle: 0 } }),
    expected,
  );
  assert.equal(controller.capabilities().controllerCompatibility, 'independent-sim');
  assert.throws(() => controller.restore({ ...snapshot, identity: 'other' }), /another tune/);
});

test('coupled Advanced flight follows frozen rate profile at 50 Hz mission intervals', () => {
  const profile = createRateProfile({ axes: { roll: { rcRate: 10, rate: 90, expo: 0 } } });
  const sim = createAdvancedSimulation({ rateProfile: profile, floor: false });
  try {
    profile.axes.roll.rate = 1;
    sim.enqueueInput(sample(0, controls(1)));
    const result = sim.stepMission();
    assert.equal(result.telemetry.requestedRates.roll, 900);
    assert.equal(result.telemetry.missionTick, 1);
    assert.equal(result.telemetry.substep, result.telemetry.frequency / 50);
    assert.equal(result.trace.length, result.telemetry.frequency / 50 + 1);
    assert.equal(result.telemetry.scored, false);
    assert.equal(result.telemetry.devicePollHz, null);
    assert.equal(result.telemetry.consumedSequence, 0);
    assert.ok(result.telemetry.motorSpeeds.every((motor) => motor >= 0 && motor <= 1));
    assert.notEqual(result.telemetry.achievedRates.roll, result.telemetry.requestedRates.roll);
  } finally {
    sim.dispose();
  }
});

test('terrain rejection rolls back physics, controller, battery, noise, input and recording', () => {
  const aircraft = validateAdvancedAircraft();
  aircraft.sensorNoise = 0.02;
  aircraft.vibration = 0.01;
  const sim = createAdvancedSimulation({ aircraft });
  try {
    sim.enqueueInput(sample(0, controls(0.2)));
    const before = sim.snapshot(),
      hash = sim.stateHash();
    assert.equal(sim.stepMission({ admitMotion: () => false }).admitted, false);
    assert.deepEqual(sim.snapshot(), before);
    assert.throws(
      () => sim.stepMission({ admitMotion: () => Promise.resolve(false) }),
      /must return a boolean/,
    );
    assert.deepEqual(sim.snapshot(), before);
    assert.equal(sim.stateHash(), hash);
    assert.throws(
      () =>
        sim.stepMission({
          admitMotion: () => {
            throw new Error('terrain unavailable');
          },
        }),
      /terrain unavailable/,
    );
    assert.deepEqual(sim.snapshot(), before);
    const candidate = sim.proposeMission();
    assert.throws(() => sim.enqueueInput(sample(1)), /pending mission/);
    assert.throws(
      () => sim.commitMission({ transaction: candidate.transaction + 1, accepted: true }),
      /Unknown/,
    );
    sim.commitMission({ transaction: candidate.transaction, accepted: false });
    assert.deepEqual(sim.snapshot(), before);
    const committed = sim.stepMission();
    sim.restore(before);
    assert.deepEqual(sim.stepMission(), committed);
  } finally {
    sim.dispose();
  }
});

test('compact recording preserves consumed input, replay, reset and partial recovery', async () => {
  const sim = createAdvancedSimulation({ rateProfile: createRateProfile(), floor: false });
  try {
    const untouched = sim.stateHash();
    for (let tick = 0; tick < 120; tick++) {
      sim.enqueueInput(sample(tick, controls(tick < 50 ? 0.1 : -0.1)));
      sim.stepMission();
    }
    const proof = sim.recording();
    assert.equal(proof.inputs.length, 120);
    assert.equal(proof.inputs.filter((event) => event.length === 7).length, 2);
    assert.equal(proof.checkpoints.length, 0);
    assert.equal(proof.hashes.length, 2);
    assert.ok(JSON.stringify(proof).length < 12000);
    const replay = await replayAdvancedRecording(JSON.stringify(proof));
    assert.equal(replay.verified, true);
    assert.deepEqual(replay.telemetry, sim.telemetry());
    const recovery = await replayAdvancedRecording(proof, { throughMission: 37 });
    assert.equal(recovery.telemetry.missionTick, 37);
    assert.equal(recovery.verifiedThroughMission, 50);
    assert.equal(recovery.verificationScope, 'prefix');
    const changed = structuredClone(proof);
    changed.inputs[0][3] = 0.2;
    await assert.rejects(replayAdvancedRecording(changed), /verification failed/);
    await assert.rejects(
      replayAdvancedRecording(changed, { throughMission: 37 }),
      /verification failed/,
    );
    const changedTail = structuredClone(proof);
    changedTail.inputs[118] = [...changedTail.inputs[118].slice(0, 3), 0.3, 0, 0, 0.5];
    await assert.rejects(
      replayAdvancedRecording(changedTail, { throughMission: 119 }),
      /verification failed/,
    );
    const missing = structuredClone(proof);
    missing.hashes = [];
    await assert.rejects(replayAdvancedRecording(missing), /coverage/);
    sim.reset();
    assert.equal(sim.stateHash(), untouched);
  } finally {
    sim.dispose();
  }
});

test('radio timestamps are consumed once; late samples and stale sequences are explicit', () => {
  const sim = createAdvancedSimulation();
  try {
    sim.enqueueInput({ sequence: 0, timestampUs: 8000, controls: controls(0.2) });
    sim.enqueueInput({ sequence: 2, timestampUs: 8000, controls: controls(0.4) });
    sim.stepMission();
    assert.equal(sim.telemetry().consumedSequence, 2);
    assert.deepEqual(sim.recording().inputs[0].slice(0, 3), [
      sim.telemetry().frequency * 0.008,
      2,
      8000,
    ]);
    assert.throws(
      () => sim.enqueueInput({ sequence: 1, timestampUs: 9000, controls: controls() }),
      /increasing/,
    );
    assert.throws(
      () => sim.enqueueInput({ sequence: 3, timestampUs: 7000, controls: controls() }),
      /monotonic/,
    );
    sim.stepMission();
    assert.equal(sim.recording().inputs.length, 1);
    assert.equal(sim.telemetry().sampleAgeUs, 32000);
  } finally {
    sim.dispose();
  }
});

test('CCD prevents a reference quad crossing a 2 cm wall at 40 m/s at all candidate frequencies', () => {
  for (const frequency of [250, 500, 1000]) {
    const sim = createAdvancedSimulation({
      frequency,
      gravity: { x: 0, y: 0, z: 0 },
      floor: false,
      spawn: { x: 0, y: 2, z: 2 },
      initialVelocity: { x: 0, y: 0, z: -40 },
      obstacles: [{ id: 'wall', min: { x: -5, y: -5, z: -0.01 }, max: { x: 5, y: 5, z: 0.01 } }],
    });
    try {
      for (let tick = 0; tick < 40; tick++)
        assert.ok(sim.stepMission().trace.every((position) => position.z > 0));
    } finally {
      sim.dispose();
    }
  }
});

test('templates are independent physical data; comparison permits rates but keeps throttle limits', () => {
  assert.equal(Object.isFrozen(ADVANCED_AIRCRAFT_TEMPLATES.whoop.battery), true);
  for (const aircraft of ['whoop', 'freestyle', 'racing']) {
    const sim = createAdvancedSimulation({ aircraft, floor: false });
    try {
      sim.enqueueInput(sample(0, controls(0.1)));
      for (let tick = 0; tick < 30; tick++) sim.stepMission();
      assert.ok(Math.abs(sim.telemetry().achievedRates.roll) < 500);
    } finally {
      sim.dispose();
    }
  }
  const first = advancedFlightIdentities({ rates: { roll: 400 }, throttle: { limitPercent: 100 } });
  const otherRates = advancedFlightIdentities({
    rates: { roll: 800 },
    throttle: { limitPercent: 100 },
  });
  const limited = advancedFlightIdentities({
    rates: { roll: 400 },
    throttle: { limitPercent: 75 },
  });
  assert.notEqual(first.simulationIdentity, otherRates.simulationIdentity);
  assert.equal(first.comparisonClass, otherRates.comparisonClass);
  assert.notEqual(first.comparisonClass, limited.comparisonClass);
  assert.equal(ADVANCED_QUALIFICATION.defaultEligible, false);
  assert.equal(ADVANCED_QUALIFICATION.scored, false);
});

test('snapshot restore rejects another configuration without changing live state', () => {
  const first = createAdvancedSimulation(),
    other = createAdvancedSimulation({ aircraft: 'whoop' });
  try {
    const before = first.stateHash();
    assert.throws(() => first.restore(other.snapshot()), /Invalid complete Advanced snapshot/);
    assert.equal(first.stateHash(), before);
    const malformed = first.snapshot();
    malformed.state.motorSpeeds = [0, 0, 0];
    assert.throws(() => first.restore(malformed), /dynamics snapshot/);
    assert.equal(first.stateHash(), before);
    assert.throws(() => createAdvancedSimulation({ frequency: 2000 }), /Unsupported fixed/);
  } finally {
    first.dispose();
    other.dispose();
  }
});

test('aircraft labels do not change physics identity; fastest motor setting remains bounded', () => {
  const aircraft = validateAdvancedAircraft();
  const renamed = { ...aircraft, id: 'my-custom-drone' };
  const first = createAdvancedSimulation({ aircraft }),
    second = createAdvancedSimulation({ aircraft: renamed });
  try {
    assert.equal(first.identity, second.identity);
  } finally {
    first.dispose();
    second.dispose();
  }
  aircraft.motorTimeConstant = 0.001;
  const fast = createAdvancedSimulation({ aircraft });
  try {
    fast.enqueueInput(sample(0, controls(1, 1)));
    for (let tick = 0; tick < 25; tick++)
      assert.ok(
        fast.stepMission().telemetry.motorSpeeds.every((speed) => speed >= 0 && speed <= 1),
      );
    const saved = fast.snapshot();
    fast.stepMission();
    fast.restore(saved);
    assert.equal(fast.telemetry().missionTick, 25);
  } finally {
    fast.dispose();
  }
});
