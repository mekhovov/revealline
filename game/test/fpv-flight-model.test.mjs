import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Q,
  sin,
  cos,
  isqrt,
  attitude,
  integrateOrientation,
  multiplyQuaternion,
} from '../../optional-practice/civilian-fpv/math.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import {
  FLIGHT_MODEL,
  FLIGHT_HZ,
  MAX_FLIGHT_TICKS,
  createFlight,
  createFlightRecorder,
  crossesGate,
  replayFlight,
  validateFlightCourse,
} from '../../optional-practice/civilian-fpv/model.mjs';
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0.5 };
const step = (flight, n, input = neutral) => {
  for (let i = 0; i < n; i++) flight.step(input);
  return flight.snapshot();
};
const sandbox = () => {
  const course = structuredClone(FLIGHT_COURSES[0]);
  course.steps['self-level'] = [
    {
      ...course.steps['self-level'][0],
      min: { x: 15000, y: 8000, z: 15000 },
      max: { x: 16000, y: 9000, z: 16000 },
    },
  ];
  course.steps.acro = structuredClone(course.steps['self-level']);
  return course;
};
test('checked-in integer rotation identities and bounded square roots', () => {
  assert.equal(sin(0), 0);
  assert.equal(sin(9000), Q);
  assert.equal(cos(18000), -Q);
  assert.equal(sin(-9000), -Q);
  for (let n = 0; n < 10000; n += 31) {
    const r = isqrt(n);
    assert.ok(r * r <= n && (r + 1) * (r + 1) > n);
  }
  const q = integrateOrientation([0, 0, 0, Q], { roll: 0, pitch: 0, yaw: 9000 }, 1);
  assert.ok(Math.abs(attitude(q).yaw - 9000) <= 1);
  assert.deepEqual(multiplyQuaternion([0, 0, 0, Q], [0, 0, 0, Q]), [0, 0, 0, Q]);
});
test('all twelve bilingual courses and both criteria sets validate; older assisted model remains distinct', () => {
  assert.equal(FLIGHT_COURSES.length, 12);
  assert.equal(new Set(FLIGHT_COURSES.map((x) => x.id)).size, 12);
  for (const course of FLIGHT_COURSES)
    assert.deepEqual(validateFlightCourse(JSON.stringify(course)), course);
  assert.notEqual(FLIGHT_MODEL, 'assisted-gym.v1');
  assert.equal(FLIGHT_HZ, 50);
});
test('manual throttle produces thrust, gravity and momentum; neutral attitude never silently holds position', () => {
  const flight = createFlight({ course: sandbox() });
  flight.arm();
  const rising = step(flight, 50, { ...neutral, throttle: 0.7 });
  assert.ok(rising.position.y > 1000);
  assert.ok(rising.velocity.y > 0);
  const falling = step(flight, 50, { ...neutral, throttle: 0 });
  assert.ok(falling.velocity.y < 0 || falling.position.y === 0);
  flight.reset();
  flight.arm();
  step(flight, 40, { ...neutral, throttle: 0.75 });
  const accelerating = step(flight, 30, { ...neutral, pitch: 0.5, throttle: 0.55 });
  assert.ok(accelerating.velocity.z < 0);
  const drifting = step(flight, 5, neutral);
  assert.ok(drifting.velocity.z < 0);
  assert.ok(drifting.position.z < accelerating.position.z);
});
test('Self-level centres attitude while Acro keeps tilt; both retain translation', () => {
  const outcomes = {};
  for (const mode of ['self-level', 'acro']) {
    const flight = createFlight({ course: sandbox(), mode });
    flight.arm();
    step(flight, 35, { ...neutral, throttle: 0.7 });
    step(flight, 15, { ...neutral, pitch: 0.4, throttle: 0.65 });
    outcomes[mode] = step(flight, 80, { ...neutral, throttle: 0.6 });
  }
  assert.ok(
    Math.abs(outcomes['self-level'].attitude.pitch) < 300,
    JSON.stringify(outcomes['self-level'].attitude),
  );
  assert.ok(outcomes.acro.attitude.pitch > 1800, JSON.stringify(outcomes.acro.attitude));
  assert.ok(outcomes.acro.velocity.z < 0);
  assert.ok(outcomes['self-level'].velocity.z < 0);
});
test('swept gate detects directed crossings between steps with inclusive boundaries at ±1 unit', () => {
  const gate = {
    axis: 'z',
    at: 0,
    direction: -1,
    minSide: -100,
    maxSide: 100,
    minY: 100,
    maxY: 200,
  };
  for (const x of [-100, 100])
    assert.equal(crossesGate({ x, y: 100, z: 20 }, { x, y: 100, z: -20 }, gate), true);
  for (const x of [-101, 101])
    assert.equal(crossesGate({ x, y: 100, z: 20 }, { x, y: 100, z: -20 }, gate), false);
  assert.equal(crossesGate({ x: 0, y: 99, z: 20 }, { x: 0, y: 99, z: -20 }, gate), false);
  assert.equal(crossesGate({ x: 0, y: 200, z: 20 }, { x: 0, y: 200, z: 0 }, gate), true);
  assert.equal(crossesGate({ x: 0, y: 201, z: 20 }, { x: 0, y: 201, z: -20 }, gate), false);
  assert.equal(crossesGate({ x: 0, y: 150, z: -20 }, { x: 0, y: 150, z: 20 }, gate), false);
  assert.equal(crossesGate({ x: 0, y: 150, z: 0 }, { x: 0, y: 150, z: -20 }, gate), false);
});
test('holds require consecutive ticks and pause never integrates or catches up', () => {
  const course = structuredClone(FLIGHT_COURSES[0]);
  course.steps['self-level'][0] = {
    ...course.steps['self-level'][0],
    min: { x: -100, y: 0, z: -100 },
    max: { x: 100, y: 100, z: 100 },
    ticks: 5,
  };
  const flight = createFlight({ course });
  flight.arm();
  step(flight, 3, { ...neutral, throttle: 0 });
  assert.equal(flight.snapshot().hold, 3);
  flight.pause();
  const paused = flight.snapshot();
  step(flight, 50);
  assert.deepEqual(flight.snapshot(), paused);
  flight.arm();
  step(flight, 2, { ...neutral, throttle: 0 });
  assert.equal(flight.snapshot().step, 1);
});
test('fixed-width proof round trips exact state and rejects mode/course/response/continuation tampering', () => {
  const course = sandbox(),
    flight = createFlight({ course, mode: 'acro' }),
    recorder = createFlightRecorder(flight);
  flight.arm();
  for (let i = 0; i < 150; i++) {
    const input = { ...neutral, pitch: i < 20 ? 0.15 : 0, throttle: i < 30 ? 0.7 : 0.5 };
    recorder.record(input);
    flight.step(input);
  }
  const proof = recorder.export();
  assert.deepEqual(replayFlight(course, JSON.stringify(proof)).state, flight.snapshot());
  for (const key of ['model', 'courseIdentity', 'responseIdentity'])
    assert.throws(() => replayFlight(course, { ...proof, [key]: 'tampered' }));
  assert.throws(() => replayFlight(course, { ...proof, frames: [[0, 0, 0, -1]] }));
  assert.throws(() => replayFlight(course, { ...proof, completed: true }));
  const changed = structuredClone(course);
  changed.revision = 'r2';
  assert.throws(() => replayFlight(changed, proof));
  assert.equal(replayFlight(course, proof, { sampleEvery: 10 }).path.length, 15);
});
test('continuously changing input recording fits the longest attempt with explicit overflow, never truncation', () => {
  const flight = createFlight({ course: sandbox() }),
    recorder = createFlightRecorder(flight);
  for (let i = 0; i < MAX_FLIGHT_TICKS; i++)
    recorder.record({
      roll: ((i % 2001) - 1000) / 1000,
      pitch: (((i * 3) % 2001) - 1000) / 1000,
      yaw: (((i * 7) % 2001) - 1000) / 1000,
      throttle: (i % 1001) / 1000,
    });
  const proof = recorder.export();
  assert.equal(proof.frames.length, MAX_FLIGHT_TICKS);
  assert.ok(Buffer.byteLength(JSON.stringify(proof)) < 1024 * 1024);
  assert.throws(() => recorder.record(neutral), /proof full/);
});
