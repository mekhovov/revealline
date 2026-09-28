import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runFlightGoldenFixtures,
  runFlightDemonstrationFixtures,
} from './helpers/fpv-portability.mjs';
import { createFlight } from '../../optional-practice/civilian-fpv/model.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';
import { createRadioRuntime } from '../../optional-practice/civilian-fpv/radio-runtime.mjs';
import { Quaternion, Vector3 } from '../../optional-practice/civilian-fpv/vendor/three.module.js';

function fly(course, frames, mode = 'self-level') {
  const flight = createFlight({ course, mode }),
    snapshots = [];
  flight.arm();
  for (const frame of frames)
    snapshots.push(
      flight.step(
        Object.fromEntries(['roll', 'pitch', 'yaw', 'throttle'].map((key, i) => [key, frame[i]])),
        { quantized: true },
      ),
    );
  return snapshots;
}

test('Node exactly matches all24 successful demonstration golden checkpoints without awarding progress', () => {
  const rows = runFlightDemonstrationFixtures();
  assert.equal(rows.length, 24);
  assert.equal(new Set(rows.map((row) => `${row.course}/${row.mode}`)).size, 24);
});

test('portable authority stress pins every250ticks across full acro rotations, yaw quadrants, gravity and bounded contacts', () => {
  const rows = runFlightGoldenFixtures();
  assert.equal(rows.length, 26);
  for (const row of rows.slice(24)) {
    assert.equal(row.ticks, 3000);
    assert.deepEqual(
      row.checkpoints.map((item) => item.tick),
      Array.from({ length: 12 }, (_, i) => (i + 1) * 250),
    );
    assert.deepEqual(row.coverage.yawQuadrants, [0, 1, 2, 3]);
    assert.ok(row.coverage.contacts > 1000);
    assert.ok(row.coverage.boundaryTicks > 1000);
    assert.ok(row.coverage.groundedTicks > 100);
    assert.equal(row.coverage.invertedTicks > 0, row.mode === 'acro');
  }
});

test('a denied browser Gamepad request remains a diagnosable, unarmed device-selection failure', () => {
  const runtime = createRadioRuntime({
    getGamepads() {
      throw new DOMException('Denied', 'SecurityError');
    },
  });
  assert.equal(runtime.select(0), false);
  assert.equal(runtime.status().reason, 'unavailable');
  assert.equal(runtime.status().active, false);
  assert.equal(runtime.status().selected, null);
  assert.deepEqual(runtime.poll(), { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
  assert.equal(runtime.status().reason, 'unavailable');
});

test('real Three.js poses agree with model right-roll, forward-pitch and right-yaw controls in both modes', () => {
  const course = structuredClone(FLIGHT_COURSES[0]);
  const target = {
    ...course.steps['self-level'][0],
    min: { x: 15000, y: 8000, z: 15000 },
    max: { x: 16000, y: 9000, z: 16000 },
  };
  course.steps = { 'self-level': [target], acro: [target] };
  for (const mode of ['self-level', 'acro'])
    for (const control of ['roll', 'pitch', 'yaw']) {
      const flight = createFlight({ course, mode });
      flight.arm();
      for (let i = 0; i < 30; i++) flight.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0.75 });
      for (let i = 0; i < 12; i++)
        flight.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0.65, [control]: 0.5 });
      const state = flight.snapshot(),
        orientation = new Quaternion(
          ...state.orientation.map((value) => value / 1000000),
        ).normalize(),
        up = new Vector3(0, 1, 0).applyQuaternion(orientation),
        forward = new Vector3(0, 0, -1).applyQuaternion(orientation);
      for (const axis of ['x', 'y', 'z'])
        assert.ok(Math.abs(up[axis] - state.attitude.up[axis] / 1000000) < 0.00001);
      assert.ok(state.attitude[control] > 0);
      if (control === 'roll') {
        assert.ok(up.x > 0);
        assert.ok(state.velocity.x > 0);
      }
      if (control === 'pitch') {
        assert.ok(forward.y < 0);
        assert.ok(up.z < 0);
        assert.ok(state.velocity.z < 0);
      }
      if (control === 'yaw') {
        assert.ok(forward.x > 0);
        assert.ok(Math.abs(up.y - 1) < 0.00001);
      }
    }
});

test('touchdown preserves impact speed: the exact landing threshold passes and one unit below remains incomplete', () => {
  const proof = FLIGHT_DEMONSTRATIONS[0],
    original = fly(FLIGHT_COURSES[0], proof.frames),
    final = original.at(-1),
    speed = final.landingSpeed;
  assert.ok(speed > 0 && speed <= 1100);
  for (const offset of [0, -1]) {
    const course = structuredClone(FLIGHT_COURSES[0]);
    course.steps['self-level'].at(-1).maxSpeed = speed + offset;
    const states = fly(course, proof.frames),
      landed = states.at(-1);
    assert.equal(landed.position.y, 0);
    assert.equal(landed.landingSpeed, speed);
    assert.equal(landed.status, offset === 0 ? 'complete' : 'active');
    if (offset === -1) {
      assert.equal(landed.hold, 0);
      assert.equal(landed.step, course.steps['self-level'].length - 1);
    }
    const contact = states.findIndex(
      (state, i) => i > 0 && states[i - 1].position.y > 0 && state.position.y === 0,
    );
    assert.ok(contact > 0);
    assert.equal(states[contact].landingSpeed, speed);
  }
});

test('swept obstacles stop a real directional flight without tunnelling and ignore author array order', () => {
  const course = structuredClone(FLIGHT_COURSES[2]);
  course.obstacles = [
    { id: 'front', min: { x: -10000, y: 0, z: -5100 }, max: { x: 10000, y: 10000, z: -5000 } },
    { id: 'rear', min: { x: -10000, y: 0, z: -5500 }, max: { x: 10000, y: 10000, z: -5400 } },
  ];
  const proof = FLIGHT_DEMONSTRATIONS.find(
      (p) => p.course === course.id && p.mode === 'self-level',
    ),
    states = fly(course, proof.frames);
  assert.ok(states.at(-1).contacts > 0);
  assert.ok(states.every((state) => state.position.z >= -4900));
  assert.notEqual(states.at(-1).status, 'complete');
  course.obstacles.reverse();
  assert.deepEqual(fly(course, proof.frames), states);
});
