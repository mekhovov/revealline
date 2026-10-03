import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createSnakeHuntPresentation } from '../../optional-practice/civilian-fpv/snake-hunt-presentation.mjs';
import {
  SNAKE_HUNT_COURSES,
  SNAKE_HUNT_PLAYLISTS,
} from '../../optional-practice/civilian-fpv/snake-hunt-catalogue.mjs';
import {
  createContactHuntState,
  catchHuntTarget,
  updateHuntTail,
  HUNT_TAIL_LIMITS,
} from '../../optional-practice/civilian-fpv/snake-hunt.mjs';
import {
  initWorldRuntime,
  createWorldFlight,
  createWorldRecorder,
  replayWorldFlight,
  recoverWorldFlight,
  worldStateIdentity,
  validateWorldCourse,
} from '../../optional-practice/civilian-fpv/world-model.mjs';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

test('hiding Sim remains preserves fresh feedback and the solid gameplay tail', () => {
  let prefs = { brutal: true, blood: true, showRemains: true };
  const scene = new THREE.Scene();
  const view = createSnakeHuntPresentation({ THREE, scene, preferences: () => prefs });
  const state = {
    ticks: 15,
    hunt: {
      tail: [{ x: 0, y: 1000, z: 0 }],
      catches: [{ tick: 10, position: { x: 0, y: 0, z: 0 }, velocity: { x: 1000, y: 0, z: 0 } }],
    },
  };
  try {
    view.update(state);
    assert.equal(view.resources().settledPieces, 4);
    prefs = { ...prefs, showRemains: false };
    view.update(state);
    assert.equal(view.resources().settledPieces, 0);
    assert.equal(view.resources().cosmeticParticles, 24);
    assert.equal(view.resources().tailLinks, 1);
    view.update(state, { reducedMotion: true });
    assert.equal(view.resources().cosmeticParticles, 0);
    assert.equal(view.resources().tailLinks, 1);
  } finally {
    view.dispose();
  }
  assert.equal(scene.children.length, 0);
});

function approach(state, target, altitude = 900) {
  const ax = clamp((target.x - state.position.x) * 0.65 - state.velocity.x * 1.4, -1800, 1800);
  const az = clamp((target.z - state.position.z) * 0.65 - state.velocity.z * 1.4, -1800, 1800);
  const ay = clamp((altitude - state.position.y) * 3 - state.velocity.y * 2, -4000, 4000);
  return {
    roll: ax / 4905,
    pitch: -az / 4905,
    yaw: 0,
    throttle: clamp((9810 + ay) / (19620 * Math.max(0.6, state.attitude.up.y / 1000000)), 0, 1),
    actions: 0,
  };
}

test('Sim Hunt has 24 distinct bounded courses in four exact six-course playlists', async () => {
  await initWorldRuntime();
  assert.equal(SNAKE_HUNT_COURSES.length, 24);
  assert.equal(new Set(SNAKE_HUNT_COURSES.map((course) => course.id)).size, 24);
  assert.equal(SNAKE_HUNT_PLAYLISTS.length, 4);
  for (const playlist of SNAKE_HUNT_PLAYLISTS) assert.equal(playlist.entries.length, 6);
  for (const source of SNAKE_HUNT_COURSES)
    for (const mode of ['self-level', 'acro']) {
      const flight = createWorldFlight({ course: source, mode });
      try {
        assert.equal(flight.identity.model, 'civilian-world-hunt.v1');
        assert.deepEqual(flight.snapshot().hunt.caught, []);
        assert.equal(flight.snapshot().status, 'disarmed');
      } finally {
        flight.dispose();
      }
    }
});

test('wrong-order catches preserve the target and each valid contact counts once', () => {
  const criterion = SNAKE_HUNT_COURSES[1].steps['self-level'][0];
  const actors = criterion.targets.map((id) => ({
    id,
    status: 'active',
    position: { x: 0, y: 0, z: 0 },
  }));
  const state = {
    ticks: 0,
    velocity: { x: 0, y: 0, z: 0 },
    events: [],
    hunt: createContactHuntState({ x: 0, y: 0, z: 0 }, 220),
  };
  assert.equal(catchHuntTarget(state, criterion, actors[1]), false);
  assert.equal(actors[1].status, 'active');
  assert.equal(catchHuntTarget(state, criterion, actors[0]), true);
  assert.equal(catchHuntTarget(state, criterion, actors[0]), false);
  assert.equal(catchHuntTarget(state, criterion, actors[1]), true);
  assert.deepEqual(state.hunt.caught, criterion.targets.slice(0, 2));
});

test('echo history and growth are bounded while stationary draws cannot advance them', () => {
  const criterion = SNAKE_HUNT_COURSES.at(-1).steps['self-level'][0];
  const hunt = createContactHuntState({ x: 0, y: 0, z: 0 }, 220);
  hunt.caught = [...criterion.targets];
  for (let i = 0; i < 400; i++) updateHuntTail(hunt, criterion, { x: i * 250, y: 1000, z: 0 }, 220);
  assert.equal(hunt.path.length, HUNT_TAIL_LIMITS.path);
  assert.equal(hunt.tail.length, criterion.targets.length * criterion.tail.linksPerCatch);
  assert(hunt.tail.length <= HUNT_TAIL_LIMITS.links);
  const before = structuredClone(hunt);
  updateHuntTail(hunt, criterion, { x: 399 * 250, y: 1000, z: 0 }, 220);
  assert.deepEqual(hunt, before);
});

test('contact-only fictional targets reject civilians, guns and impossible mixed objectives', () => {
  for (const mutate of [
    (c) => {
      c.actors[0].role = 'civilian';
    },
    (c) => {
      c.actors[0].fireEveryTicks = 100;
    },
    (c) => {
      c.steps.acro.push({ type: 'eliminate', targets: [c.actors[0].id] });
    },
  ]) {
    const course = structuredClone(SNAKE_HUNT_COURSES[0]);
    mutate(course);
    assert.throws(() => validateWorldCourse(course));
  }
});

test('actual swept humanoid contacts complete the course and replay, without shooting', async () => {
  await initWorldRuntime();
  const course = SNAKE_HUNT_COURSES[0];
  const flight = createWorldFlight({ course });
  try {
    const recorder = createWorldRecorder(flight);
    flight.arm();
    for (let tick = 0; tick < 5000 && flight.snapshot().status === 'active'; tick++) {
      const state = flight.snapshot();
      flight.step(
        approach(state, state.actors.find((actor) => actor.status === 'active').position),
      );
      recorder.record();
    }
    assert.equal(flight.snapshot().status, 'complete');
    assert.equal(flight.snapshot().hunt.caught.length, 3);
    assert.equal(flight.snapshot().shots, 0);
    const proof = recorder.export();
    const checked = await replayWorldFlight(course, proof);
    assert.equal(worldStateIdentity(checked.state), proof.finalStateIdentity);
  } finally {
    flight.dispose();
  }
});

test('echo collision survives paused proof recovery and exact input continuation', async () => {
  await initWorldRuntime();
  const course = SNAKE_HUNT_COURSES[1];
  const flight = createWorldFlight({ course });
  let restored;
  try {
    const recorder = createWorldRecorder(flight);
    let phase = 0,
      prefix;
    flight.arm();
    for (let tick = 0; tick < 5000 && flight.snapshot().status === 'active'; tick++) {
      const state = flight.snapshot();
      if (state.hunt.caught.length && phase === 0) phase = 1;
      if (phase === 1 && state.position.z < -12000) phase = 2;
      const target =
        phase === 0
          ? state.actors[0].position
          : { x: -12000, y: 0, z: phase === 1 ? -14000 : 12000 };
      flight.step(approach(state, target));
      recorder.record();
      if (flight.snapshot().ticks === 700) prefix = recorder.export();
    }
    assert.equal(flight.snapshot().hunt.failure, 'echo-tail');
    const proof = recorder.export();
    restored = await recoverWorldFlight(course, prefix);
    assert.equal(restored.state.status, 'paused');
    restored.flight.arm();
    for (const frame of proof.frames.slice(prefix.frames.length)) {
      restored.flight.step(
        Object.fromEntries(
          ['roll', 'pitch', 'yaw', 'throttle', 'actions'].map((key, i) => [key, frame[i]]),
        ),
        { quantized: true },
      );
      restored.recorder.record();
    }
    assert.equal(restored.recorder.export().finalStateIdentity, proof.finalStateIdentity);
  } finally {
    restored?.flight.dispose();
    flight.dispose();
  }
});
