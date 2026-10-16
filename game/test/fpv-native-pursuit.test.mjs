import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  recoverWorldFlight,
  replayWorldFlight,
  validateWorldCourse,
  worldStateIdentity,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import {
  createPursuitActorState,
  createPursuitController,
  pursuitContactProtected,
} from '../../optional-practice/civilian-fpv/world-pursuit.mjs';
import { NATIVE_PURSUIT_COURSES } from '../../optional-practice/civilian-fpv/native-pursuit-courses.mjs';
import { SNAKE_HUNT_COURSES } from '../../optional-practice/civilian-fpv/snake-hunt-catalogue.mjs';
import {
  splitCourseDefinition,
  compileChallengeDefinition,
} from '../../optional-practice/civilian-fpv/content-definitions.mjs';
import {
  pursuitFromWaypoints,
  removePursuitActor,
} from '../../optional-practice/civilian-fpv/world-pursuit-editor.mjs';
import { evaluateWorldResult } from '../../optional-practice/civilian-fpv/world-progress.mjs';
const clone = structuredClone;
const command = { throttle: 0.5, roll: 0, pitch: 0, yaw: 0, actions: 0 };
const flatCollision = {
  visible: () => true,
  placeActor() {},
  moveGroundActor: (actor, delta) => ({
    position: { x: actor.position.x + delta.x, y: 0, z: actor.position.z + delta.z },
    blocked: false,
  }),
};
function scenario(index, family) {
  const course = validateWorldCourse(NATIVE_PURSUIT_COURSES[index]);
  const policy = course.pursuit.actors[0];
  if (family) policy.family = family;
  const actor = {
    ...clone(course.actors[0]),
    status: 'active',
    pursuit: createPursuitActorState(policy, course.pursuit),
  };
  const state = {
    ticks: 0,
    position: { x: actor.position.x, y: 1000, z: actor.position.z + 3000 },
    actors: [actor],
    events: [],
    droneRadius: 180,
    tailRadius: 0,
  };
  return { course, actor, state, controller: createPursuitController(course.pursuit) };
}

test('native successor samples admit both flight modes and preserve Studio definitions exactly', async () => {
  await initWorldRuntime();
  for (const source of NATIVE_PURSUIT_COURSES) {
    const accepted = validateWorldCourse(source);
    const compiled = compileChallengeDefinition(splitCourseDefinition(accepted)).course;
    assert.deepEqual(compiled.pursuit, accepted.pursuit);
    assert.deepEqual(compiled.actors, accepted.actors);
    assert.deepEqual(compiled.steps, accepted.steps);
    for (const mode of ['self-level', 'acro']) {
      const flight = createWorldFlight({ course: compiled, mode });
      try {
        const original = createWorldFlight({ course: accepted, mode });
        try {
          assert.deepEqual(flight.identity, original.identity);
        } finally {
          original.dispose();
        }
        assert.equal(flight.identity.model, 'civilian-world-pursuit.v1');
      } finally {
        flight.dispose();
      }
    }
  }
});

test('v2 retains its model and rejects silently attached pursuit rules', async () => {
  await initWorldRuntime();
  const course = clone(SNAKE_HUNT_COURSES[0]);
  const flight = createWorldFlight({ course });
  try {
    assert.equal(flight.identity.model, 'civilian-world-hunt.v1');
    assert.equal(createWorldRecorder(flight).export().format, 'FlightAttempt.v2');
    assert.equal(flight.snapshot().pursuit, undefined);
  } finally {
    flight.dispose();
  }
  course.pursuit = clone(NATIVE_PURSUIT_COURSES[0].pursuit);
  assert.throws(() => validateWorldCourse(course));
});

test('graph admission rejects blocked edges, unsupported footing and disconnected goals', async () => {
  await initWorldRuntime();
  const course = clone(NATIVE_PURSUIT_COURSES[0]);
  course.obstacles.push({
    id: 'blocked-route',
    min: { x: -9000, y: 0, z: -200 },
    max: { x: -7000, y: 3000, z: 200 },
  });
  assert.throws(() => createWorldFlight({ course }), /clearance|support/);
  const floating = clone(NATIVE_PURSUIT_COURSES[0]);
  for (const node of floating.pursuit.nodes) node.position.y += 1000;
  floating.actors[0].position.y += 1000;
  assert.throws(() => createWorldFlight({ course: floating }), /ground|support/);
  const disconnected = clone(NATIVE_PURSUIT_COURSES[0]);
  disconnected.pursuit.edges = disconnected.pursuit.edges.filter(
    (edge) => ![edge.from, edge.to].includes('node-1'),
  );
  assert.throws(() => validateWorldCourse(disconnected), /connected/);
});

test('runner uses committed position-only decisions and never enters an occupied head cell', () => {
  const { actor, state, controller } = scenario(0);
  controller.move(actor, state, flatCollision);
  const heading = clone(actor.pursuit.heading);
  state.position = { x: actor.position.x + 3000, y: 1000, z: actor.position.z };
  for (let i = 0; i < 10; i++) controller.move(actor, state, flatCollision);
  assert.deepEqual(actor.pursuit.heading, heading);
  const before = clone(actor.position);
  state.position = { ...actor.position, y: 500 };
  controller.move(actor, state, flatCollision);
  assert.equal(actor.blocked, true);
  assert.deepEqual(actor.position, before);
});

test('sprinter announces its exact burst direction and then exposes recovery', () => {
  const { actor, state, controller } = scenario(1);
  controller.move(actor, state, flatCollision);
  assert.equal(actor.pursuit.phase, 'warning');
  const before = clone(actor.position),
    heading = clone(actor.pursuit.heading);
  for (let i = 0; i < 39; i++) controller.move(actor, state, flatCollision);
  assert.deepEqual(actor.position, before);
  controller.move(actor, state, flatCollision);
  assert.equal(actor.pursuit.phase, 'burst');
  assert.deepEqual(actor.pursuit.heading, heading);
  assert.ok(Math.hypot(actor.position.x - before.x, actor.position.z - before.z) <= 60);
  for (let i = 0; i < 20; i++) controller.move(actor, state, flatCollision);
  assert.equal(actor.pursuit.phase, 'recovering');
});

test('surviving pair becomes a runner without replacing its accepted identity', () => {
  const { course, actor, state, controller } = scenario(4);
  const other = { ...clone(course.actors[1]), status: 'active' };
  state.actors.push(other);
  controller.move(actor, state, flatCollision);
  assert.equal(actor.pursuit.family, 'rendezvous-pair');
  other.status = 'caught';
  controller.move(actor, state, flatCollision);
  assert.equal(actor.pursuit.family, 'runner');
  assert.equal(actor.id, course.actors[0].id);
});

test('shield side boundary stays exposed and Brace uses its pre-step phase', () => {
  const actor = {
    position: { x: 0, y: 0, z: 0 },
    pursuit: {
      family: 'shield-bearer',
      heading: { x: 0, z: -1000000 },
      phase: 'turning',
      nextHeading: { x: 1000000, z: 0 },
    },
  };
  assert.equal(pursuitContactProtected(actor, { x: 1000, z: 0 }), false);
  assert.equal(pursuitContactProtected(actor, { x: 0, z: -1000 }), true);
  assert.equal(pursuitContactProtected(actor, { x: 0, z: 1000 }), false);
  actor.pursuit.family = 'brace-trooper';
  actor.pursuit.phase = 'warning';
  const accepted = clone(actor);
  actor.pursuit.phase = 'recovering';
  assert.equal(pursuitContactProtected(accepted, { x: 0, z: 0 }), true);
  assert.equal(pursuitContactProtected(actor, { x: 0, z: 0 }), false);
});

test('native recording replays and restores pursuit phases; tampered or historical proof versions fail', async () => {
  await initWorldRuntime();
  const course = NATIVE_PURSUIT_COURSES[5];
  const flight = createWorldFlight({ course });
  let recovered;
  try {
    const recorder = createWorldRecorder(flight);
    flight.arm();
    for (let i = 0; i < 47; i++) {
      flight.step(command);
      recorder.record();
    }
    const prefix = recorder.export();
    assert.equal(prefix.format, 'FlightAttempt.v3');
    recovered = await recoverWorldFlight(course, prefix);
    recovered.flight.arm();
    for (let i = 0; i < 30; i++) {
      flight.step(command);
      recorder.record();
      recovered.flight.step(command);
      recovered.recorder.record();
    }
    const proof = recorder.export();
    assert.equal(recovered.recorder.export().finalStateIdentity, proof.finalStateIdentity);
    const verified = await replayWorldFlight(course, proof);
    assert.equal(worldStateIdentity(verified.state), proof.finalStateIdentity);
    await assert.rejects(replayWorldFlight(course, { ...proof, format: 'FlightAttempt.v2' }));
    await assert.rejects(replayWorldFlight(course, { ...proof, finalStateIdentity: 'forged' }));
  } finally {
    flight.dispose();
    recovered?.flight.dispose();
  }
});

test('courier is optional in both objective modes and records a separate catch without changing score or quota', () => {
  const course = validateWorldCourse(NATIVE_PURSUIT_COURSES[2]);
  assert.ok(Object.values(course.steps).every((steps) => !steps[0].targets.includes('pursuit-2')));
  const state = {
    status: 'complete',
    step: 1,
    ticks: 50,
    contacts: 0,
    hunt: { caught: ['pursuit-1'], failure: null },
    pursuit: { bonusCaught: ['pursuit-2'] },
  };
  const result = evaluateWorldResult(course, { mode: 'self-level', session: 'practice' }, state);
  const base = evaluateWorldResult(
    course,
    { mode: 'self-level', session: 'practice' },
    { ...state, pursuit: undefined },
  );
  assert.equal(result.score, base.score);
  assert.equal(result.bonusCatches, 1);
  assert.equal(result.catches, 1);
  const bad = clone(course);
  bad.steps.acro[0].targets.push('pursuit-2');
  assert.throws(() => validateWorldCourse(bad), /optional/);
});

test('Studio route conversion is explicit and removal cleans pair ownership', () => {
  const course = clone(SNAKE_HUNT_COURSES[0]);
  const original = clone(course);
  course.actors[0].path = [{ ...course.actors[0].position, x: course.actors[0].position.x + 3000 }];
  pursuitFromWaypoints(course, course.actors[0].id);
  assert.equal(course.format, 'FlightCourse.v3');
  assert.deepEqual(course.actors[0].path, []);
  assert.doesNotThrow(() => validateWorldCourse(course));
  assert.equal(original.format, 'FlightCourse.v2');
  const pair = clone(NATIVE_PURSUIT_COURSES[4]);
  removePursuitActor(pair, 'pursuit-1');
  assert.equal(pair.pursuit.actors[0].family, 'runner');
  assert.equal(pair.pursuit.actors[0].pair, null);
});

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function intercept(state, target) {
  const ax = clamp((target.x - state.position.x) * 0.65 - state.velocity.x * 1.4, -1800, 1800);
  const az = clamp((target.z - state.position.z) * 0.65 - state.velocity.z * 1.4, -1800, 1800);
  const ay = clamp((900 - state.position.y) * 3 - state.velocity.y * 2, -4000, 4000);
  return {
    roll: ax / 4905,
    pitch: -az / 4905,
    yaw: 0,
    throttle: clamp((9810 + ay) / (19620 * Math.max(0.6, state.attitude.up.y / 1000000)), 0, 1),
    actions: 0,
  };
}

test('a native shield front collision deals 25 hull damage, respects 20 tick cooldown and never grants the catch', async () => {
  await initWorldRuntime();
  const course = clone(NATIVE_PURSUIT_COURSES[0]);
  const policy = course.pursuit.actors[0];
  policy.family = 'shield-bearer';
  policy.goals = [policy.start];
  const actor = course.actors[0];
  const initial = createPursuitActorState(policy, course.pursuit);
  course.spawn = {
    x: actor.position.x + Math.round(initial.heading.x * 0.003),
    y: 0,
    z: actor.position.z + Math.round(initial.heading.z * 0.003),
  };
  const flight = createWorldFlight({ course });
  try {
    flight.arm();
    let lastDamage = -Infinity,
      impacts = 0;
    for (let i = 0; i < 1500 && flight.snapshot().status === 'active'; i++) {
      const before = flight.snapshot();
      const state = flight.step(intercept(before, actor.position));
      if (state.events.some((event) => event.type === 'protected-contact')) {
        assert.equal(before.health - state.health, 25);
        assert.ok(state.ticks - lastDamage >= 20);
        lastDamage = state.ticks;
        impacts++;
      }
      assert.equal(state.hunt.caught.length, 0);
    }
    assert.ok(impacts > 0, 'The flight reached the announced front-facing contact region');
  } finally {
    flight.dispose();
  }
});

test('Shield keeps its initial heading for 0.8 seconds even on a short edge', () => {
  const nodes = [
    { id: 'a', position: { x: 0, y: 0, z: 0 } },
    { id: 'b', position: { x: 600, y: 0, z: 0 } },
    { id: 'c', position: { x: 600, y: 0, z: 600 } },
    { id: 'd', position: { x: 0, y: 0, z: 600 } },
  ];
  const policy = {
    id: 'shield',
    family: 'shield-bearer',
    start: 'a',
    goals: ['b', 'c', 'd', 'a'],
    pair: null,
  };
  const source = {
    nodes,
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'd' },
      { from: 'd', to: 'a' },
    ],
    actors: [policy],
  };
  const actor = {
    id: policy.id,
    position: { ...nodes[0].position },
    radius: 100,
    height: 1800,
    status: 'active',
    pursuit: createPursuitActorState(policy, source),
  };
  const state = {
    ticks: 0,
    position: { x: 10000, y: 1000, z: 10000 },
    actors: [actor],
    events: [],
    droneRadius: 180,
  };
  const controller = createPursuitController(source),
    initial = { ...actor.pursuit.heading };
  for (let tick = 0; tick < 40; tick++) {
    controller.move(actor, state, flatCollision);
    assert.deepEqual(actor.pursuit.heading, initial);
  }
  controller.move(actor, state, flatCollision);
  assert.equal(actor.pursuit.phase, 'turning');
  assert.deepEqual(actor.pursuit.heading, initial);
});
