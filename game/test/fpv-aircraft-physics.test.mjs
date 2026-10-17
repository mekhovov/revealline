import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listAircraftPresets,
  createPresetConfiguration,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import {
  validateAircraftPhysics,
  createAircraftController,
  createAircraftControllerTune,
  aircraftMotorPoint,
  aircraftMotorSpeedForThrust,
  aircraftElectricalPoint,
  stepAircraftPropulsion,
  aircraftBodyForces,
  allocateAircraftThrust,
  aircraftPerformance,
  aircraftCollisionRadius,
} from '../../optional-practice/civilian-fpv/aircraft-physics.mjs';
import {
  createAircraftResponseDescriptor,
  createAircraftResponseEvaluator,
} from '../../optional-practice/civilian-fpv/aircraft-response.mjs';
import {
  DEFAULT_RESPONSE,
  responseCurve,
} from '../../optional-practice/civilian-fpv/radio-profile.mjs';
import { roundDiv } from '../../optional-practice/civilian-fpv/math.mjs';
import { createRateEvaluator } from '../../optional-practice/civilian-fpv/rates.mjs';
const neutral = () => ({ roll: 0, pitch: 0, yaw: 0, throttle: 0 });
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} ≠ ${b}`);
const selected = () => createPresetConfiguration('meteor75-analog-2022').aircraft;

test('all twelve built-in aircraft have valid physical configurations and hover authority', () => {
  assert.equal(listAircraftPresets().length, 12);
  for (const preset of listAircraftPresets()) {
    const { aircraft, controller } = createPresetConfiguration(preset.id);
    assert.deepEqual(validateAircraftPhysics(aircraft), aircraft);
    assert.equal(aircraft.battery.depletion, false);
    assert.equal(controller.format, 'AdvancedControllerTune.v3');
    const performance = aircraftPerformance(aircraft);
    assert.ok(performance.thrustToWeight > 1, preset.id);
    assert.ok(performance.hoverThrottle > 0 && performance.hoverThrottle < 1, preset.id);
    const hover = aircraftElectricalPoint(aircraft, Array(4).fill(performance.hoverThrottle));
    near(
      hover.thrusts.reduce((a, b) => a + b, 0),
      aircraft.mass * 9.81,
      1e-6,
    );
    near(performance.fullThrottleCurrent, aircraftElectricalPoint(aircraft, [1, 1, 1, 1]).current);
  }
});

test('terrain admission radius covers the COM-relative body and complete propeller cylinders', () => {
  for (const preset of listAircraftPresets()) {
    const { aircraft } = createPresetConfiguration(preset.id);
    assert.ok(aircraft.radius >= aircraftCollisionRadius(aircraft), preset.id);
    aircraft.radius = aircraftCollisionRadius(aircraft) - 0.0001;
    assert.throws(() => validateAircraftPhysics(aircraft), /radius must enclose/);
  }
  const aircraft = selected();
  aircraft.geometry.bodyHalfExtents = { x: 0.2, y: 0.3, z: 0.4 };
  aircraft.geometry.centerOfMass = { x: -0.01, y: 0.02, z: 0.03 };
  near(aircraftCollisionRadius(aircraft), Math.sqrt(0.21 ** 2 + 0.32 ** 2 + 0.43 ** 2));
  assert.throws(() => validateAircraftPhysics(aircraft), /radius must enclose/);
  aircraft.radius = aircraftCollisionRadius(aircraft);
  validateAircraftPhysics(aircraft);
});

test('rotor allocator produces requested control torques with asymmetric geometry and COM', () => {
  const a = createPresetConfiguration('chimera7-pro-v2-o4').aircraft;
  a.geometry.centerOfMass = { x: 0.003, y: 0, z: 0.01 };
  for (const rotor of a.geometry.rotors) {
    rotor.position.x -= 0.003;
    rotor.position.z -= 0.01;
  }
  validateAircraftPhysics(a);
  const torque = { roll: 0.04, pitch: -0.025, yaw: 0.008 };
  const result = allocateAircraftThrust(a, {
    collective: 12,
    torque,
    voltage: a.battery.nominalVoltage,
  });
  const forces = aircraftBodyForces(a, {
    thrusts: result.thrusts,
    reactionTorques: result.thrusts.map((v) => v * a.reactionTorque),
  });
  near(forces.force.y, 12);
  near(-forces.torque.z, torque.roll);
  near(-forces.torque.x, torque.pitch);
  near(-forces.torque.y, torque.yaw);
  assert.ok(result.motors.every((v) => v >= 0 && v <= 1));
});

test('allocator desaturates every torque axis together and respects available voltage', () => {
  const a = selected(),
    torque = { roll: 50, pitch: -30, yaw: 2 };
  const result = allocateAircraftThrust(a, { collective: 0, torque, voltage: 3.3 });
  assert.equal(result.saturated, true);
  const actual = aircraftBodyForces(a, {
    thrusts: result.thrusts,
    reactionTorques: result.thrusts.map((v) => v * a.reactionTorque),
  }).torque;
  near(-actual.z / torque.roll, -actual.x / torque.pitch, 1e-8);
  near(-actual.z / torque.roll, -actual.y / torque.yaw, 1e-8);
  assert.ok(result.thrusts.every((v) => v <= aircraftMotorPoint(a, 1, 3.3).thrust + 1e-12));
  assert.ok(result.motors.every((v) => v >= a.propulsion.idleSpeed - 1e-9));
});

test('armed idle and Airmode retain torque at zero throttle; disarming stops all motors', () => {
  const aircraft = selected(),
    controller = createAircraftController({ aircraft });
  const controls = neutral(),
    sensors = neutral(),
    target = { ...neutral(), roll: 300 };
  const output = controller.step({ controls, sensors, target, dt: 0.004 });
  assert.ok(output.motors.every((v) => v >= aircraft.propulsion.idleSpeed - 1e-9));
  assert.ok(Math.max(...output.motors) > Math.min(...output.motors));
  assert.ok(controller.telemetry().achievedTorque.roll > 0);
  assert.deepEqual(
    controller.step({ controls, sensors, target, dt: 0.004, armed: false }).motors,
    [0, 0, 0, 0],
  );
});

test('electrical sag solves the load equation and enforces current limits without draining practice battery', () => {
  const a = selected();
  a.battery.currentLimit = 2;
  const point = aircraftElectricalPoint(a, [1, 1, 1, 1]);
  assert.ok(point.current <= 2 && point.current > 1.99);
  near(point.voltage + a.battery.resistance * point.current, a.battery.fullVoltage, 1e-10);
  const initial = { motorSpeeds: [1, 1, 1, 1], commands: [1, 1, 1, 1], usedAh: 0, dt: 0.004 };
  const fixed = stepAircraftPropulsion(a, initial);
  assert.equal(fixed.usedAh, 0);
  a.battery.depletion = true;
  assert.ok(stepAircraftPropulsion(a, initial).usedAh > 0);
  const depleted = aircraftElectricalPoint(a, [1, 1, 1, 1], a.battery.capacityAh);
  assert.deepEqual(depleted.thrusts, [0, 0, 0, 0]);
});

test('motor lookup and inverse use reference voltage exactly once', () => {
  const a = selected();
  a.propulsion.table = {
    referenceVoltage: 4.2,
    samples: [
      [0, 0, 0, 0],
      [0.5, 0.1, 1, 0.002],
      [1, 0.4, 3, 0.008],
    ],
  };
  validateAircraftPhysics(a);
  near(aircraftMotorPoint(a, 0.5, 4.2).thrust, 0.1);
  near(aircraftMotorPoint(a, 0.5, 2.1).thrust, 0.025);
  near(aircraftMotorPoint(a, 0.75, 4.2).thrust, 0.25);
  for (const voltage of [2.1, 4.2, 4.35])
    for (const speed of [0, 0.1, 0.4, 0.5, 0.9, 1])
      near(
        aircraftMotorSpeedForThrust(a, aircraftMotorPoint(a, speed, voltage).thrust, voltage),
        speed,
      );
  a.propulsion.table.samples[1][1] = 0.5;
  assert.throws(() => validateAircraftPhysics(a), /monotonically/);
});

test('directional drag opposes relative air motion and torque obeys body-axis convention', () => {
  const a = selected();
  a.drag.quadratic = { x: 1, y: 2, z: 3 };
  a.drag.linear = { x: 0, y: 0, z: 0 };
  const result = aircraftBodyForces(a, {
    thrusts: [0, 0, 0, 0],
    reactionTorques: [0, 0, 0, 0],
    linearVelocity: { x: 2, y: -2, z: 2 },
  });
  assert.deepEqual(result.force, { x: -4, y: 8, z: -12 });
  const single = aircraftBodyForces(a, { thrusts: [1, 0, 0, 0], reactionTorques: [0.01, 0, 0, 0] });
  assert.ok(single.torque.x > 0 && single.torque.z < 0 && single.torque.y > 0);
});

test('controller snapshot restores every filter, integrator, and motor field exactly', () => {
  const aircraft = selected(),
    controller = createAircraftController({ aircraft });
  const input = {
    controls: neutral(),
    sensors: { roll: 0.2, pitch: -0.3, yaw: 0.1 },
    target: { roll: 80, pitch: 120, yaw: -30, throttle: 0.4 },
    dt: 0.004,
  };
  for (let i = 0; i < 20; i++) controller.step(input);
  const snapshot = controller.snapshot();
  const output = controller.step(input),
    final = controller.snapshot();
  controller.restore(snapshot);
  assert.deepEqual(controller.step(input), output);
  assert.deepEqual(controller.snapshot(), final);
  const other = createAircraftController({
    aircraft: createPresetConfiguration('holybro-x650-v2').aircraft,
  });
  assert.throws(() => other.restore(snapshot), /mismatch/);
  controller.reset();
  assert.deepEqual(controller.telemetry().integral, { roll: 0, pitch: 0, yaw: 0 });
});

test('controller gains scale to large aircraft without the legacy one-Nm gain ceiling', () => {
  const a = createPresetConfiguration('holybro-x650-v2').aircraft;
  const tune = createAircraftControllerTune(a);
  const exaggerated = structuredClone(tune);
  exaggerated.gains.roll.p = 1.5;
  assert.doesNotThrow(() => createAircraftController({ aircraft: a, tune: exaggerated }));
});

test('Legacy descriptor reproduces all 2001 historical stick commands without applying body lag', () => {
  const descriptor = createAircraftResponseDescriptor(DEFAULT_RESPONSE);
  const evaluate = createAircraftResponseEvaluator(JSON.parse(JSON.stringify(descriptor)));
  for (let input = -1000; input <= 1000; input++) {
    const target = evaluate({
      roll: input / 1000,
      pitch: input / 1000,
      yaw: input / 1000,
      throttle: 0.25,
    });
    const expected =
      roundDiv(responseCurve(input, DEFAULT_RESPONSE.expo) * DEFAULT_RESPONSE.maxRate * 100, 1000) /
      100;
    for (const axis of ['roll', 'pitch', 'yaw']) assert.equal(target[axis], expected);
    assert.equal(target.throttle, 0.25);
  }
});

test('new rates apply once and self-level uses current attitude without yaw assistance', () => {
  const { response } = createPresetConfiguration('meteor75-analog-2022');
  const controls = { roll: 0.4, pitch: -0.2, yaw: 0.3, throttle: 0.6 };
  const acro = createAircraftResponseEvaluator(createAircraftResponseDescriptor(response));
  const expected = createRateEvaluator(response.rates);
  near(acro(controls).roll, expected.rate('roll', controls.roll));
  near(acro(controls).throttle, expected.throttle(controls.throttle));
  const level = createAircraftResponseEvaluator(
    createAircraftResponseDescriptor(response, { mode: 'self-level' }),
  );
  assert.throws(() => level(controls), /current attitude/);
  const target = level(controls, { x: 0, y: 0, z: 0, w: 1 });
  near(target.roll, 0.4 * response.maxTilt * 4);
  near(target.pitch, -0.2 * response.maxTilt * 4);
  near(target.yaw, acro(controls).yaw);
  const returnLevel = level(neutral(), { roll: 10, pitch: -5 });
  assert.equal(returnLevel.roll, -40);
  assert.equal(returnLevel.pitch, 20);
});

test('invalid geometry, inertias, snapshots and extra imported physics are rejected', () => {
  const a = selected();
  const badRotor = structuredClone(a);
  badRotor.geometry.rotors[1].position = { ...badRotor.geometry.rotors[0].position };
  assert.throws(() => validateAircraftPhysics(badRotor), /overlap/);
  const badInertia = structuredClone(a);
  badInertia.inertia.x = 100;
  assert.throws(() => validateAircraftPhysics(badInertia), /triangle inequality/);
  const extra = { ...a, betaflightPid: [40, 30, 20] };
  assert.throws(() => validateAircraftPhysics(extra));
  const controller = createAircraftController({ aircraft: a });
  const badState = controller.snapshot();
  badState.state.integral.roll = NaN;
  assert.throws(() => controller.restore(badState));
});

// Isolated three-axis rotational fixture: the production controller, electrical
// point and motor model coupled to I*dω/dt = torque. Full Rapier contacts and
// cross-browser qualification remain separate runtime acceptance tests.
function rotationalFixture(id, frequency, axis) {
  const { aircraft } = createPresetConfiguration(id),
    controller = createAircraftController({ aircraft });
  const dt = 1 / frequency,
    bodyAxis = { roll: 'z', pitch: 'x', yaw: 'y' };
  let motorSpeeds = [0, 0, 0, 0],
    angular = { x: 0, y: 0, z: 0 },
    peak = 0,
    area = 0;
  for (let step = 0; step < frequency * 1.5; step++) {
    const target = { ...neutral(), throttle: 0.45 };
    target[axis] = step >= frequency * 0.2 && step < frequency * 0.8 ? 200 : 0;
    const output = controller.step({
      controls: { ...neutral(), throttle: 0.45 },
      target,
      sensors: { roll: -angular.z, pitch: -angular.x, yaw: -angular.y },
      dt,
    });
    const propulsion = stepAircraftPropulsion(aircraft, {
      motorSpeeds,
      commands: output.motors,
      usedAh: 0,
      dt,
    });
    motorSpeeds = propulsion.motorSpeeds;
    const { torque } = aircraftBodyForces(aircraft, { ...propulsion, angularVelocity: angular });
    angular = Object.fromEntries(
      ['x', 'y', 'z'].map((a) => [a, angular[a] + (torque[a] / aircraft.inertia[a]) * dt]),
    );
    const rate = -angular[bodyAxis[axis]];
    peak = Math.max(peak, rate);
    area += rate * dt;
  }
  return { peak, area };
}

test('all twelve aircraft rotational step metrics converge within 2% of 2 kHz reference', () => {
  for (const preset of listAircraftPresets())
    for (const axis of ['roll', 'pitch', 'yaw']) {
      const reference = rotationalFixture(preset.id, 2000, axis);
      for (const frequency of [250, 500, 1000]) {
        const result = rotationalFixture(preset.id, frequency, axis);
        for (const metric of ['peak', 'area'])
          assert.ok(
            Math.abs(result[metric] - reference[metric]) / Math.abs(reference[metric]) <= 0.02,
            `${preset.id} ${axis} ${frequency} Hz ${metric}`,
          );
      }
    }
});

test('Legacy fractional stick boundaries use the historical symmetric rounding', () => {
  const evaluate = createAircraftResponseEvaluator(
    createAircraftResponseDescriptor(DEFAULT_RESPONSE),
  );
  for (const value of [-0.0005, -0.1235, 0.0004994, 0.0004999, 0.1235, 0.9999]) {
    const input = roundDiv(Math.round(value * 1000000), 1000);
    const target = evaluate({ ...neutral(), roll: value, throttle: Math.abs(value) });
    assert.equal(
      target.roll,
      roundDiv(responseCurve(input, DEFAULT_RESPONSE.expo) * DEFAULT_RESPONSE.maxRate * 100, 1000) /
        100,
    );
    assert.equal(target.throttle, roundDiv(Math.round(Math.abs(value) * 1000000), 1000) / 1000);
  }
});

test('cosmetic aircraft identifiers do not alter physical controller identity', () => {
  const a = selected(),
    b = structuredClone(a);
  b.id = 'my-custom-name';
  assert.equal(
    createAircraftController({ aircraft: a }).identity,
    createAircraftController({ aircraft: b }).identity,
  );
});
