import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  recoverWorldFlight,
  replayWorldFlight,
  validateWorldCourse,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import {
  createPursuitActorState,
  createPursuitController,
} from '../../optional-practice/civilian-fpv/world-pursuit.mjs';
import {
  NATIVE_PURSUIT_COURSES,
  NATIVE_PURSUIT_IDENTITY,
  NATIVE_PURSUIT_V2_COURSES,
  NATIVE_PURSUIT_V2_IDENTITY,
  NATIVE_PURSUIT_PLAYLIST,
} from '../../optional-practice/civilian-fpv/native-pursuit-courses.mjs';
import { WORLD_CATALOGUE } from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import {
  compileChallengeDefinition,
  splitCourseDefinition,
} from '../../optional-practice/civilian-fpv/content-definitions.mjs';

const collision = {
  visible: () => true,
  placeActor() {},
  moveGroundActor: (actor, delta) => ({
    position: Object.fromEntries(
      ['x', 'y', 'z'].map((axis) => [axis, actor.position[axis] + delta[axis]]),
    ),
    blocked: false,
  }),
};
function fixture(course) {
  const actors = course.actors.map((actor) => {
    const policy = course.pursuit.actors.find((candidate) => candidate.id === actor.id);
    return {
      ...structuredClone(actor),
      status: 'active',
      ...(policy ? { pursuit: createPursuitActorState(policy, course.pursuit) } : {}),
    };
  });
  const state = {
    ticks: 0,
    position: { x: 17000, y: 8000, z: 17000 },
    actors,
    events: [],
    droneRadius: 180,
    tailRadius: 0,
  };
  const controller = createPursuitController(course.pursuit, course.actors);
  return {
    actors,
    state,
    step() {
      for (const actor of actors)
        if (actor.status === 'active' && actor.pursuit) controller.move(actor, state, collision);
      state.ticks++;
    },
  };
}

test('v2 Refuge announces once, retains its refuge through junctions, and rests before choosing another', () => {
  const course = structuredClone(NATIVE_PURSUIT_V2_COURSES[0]);
  course.actors = [course.actors[0]];
  course.pursuit.actors = [course.pursuit.actors[0]];
  const policy = course.pursuit.actors[0];
  course.pursuit.nodes = [
    { id: 'a', position: { x: 0, y: 0, z: 0 } },
    { id: 'b', position: { x: 3000, y: 0, z: 0 } },
    { id: 'c', position: { x: 6000, y: 0, z: 0 } },
    { id: 'd', position: { x: 3000, y: 0, z: 4000 } },
  ];
  course.pursuit.edges = [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
    { from: 'b', to: 'd' },
  ];
  policy.start = 'a';
  policy.goals = ['c', 'd'];
  course.actors[0].position = { ...course.pursuit.nodes[0].position };
  const run = fixture(validateWorldCourse(course)),
    actor = run.actors[0];
  run.state.position = { x: 3000, y: 8000, z: 4000 };
  const origin = { ...actor.position };
  run.step();
  assert.equal(actor.pursuit.phase, 'warning');
  assert.equal(actor.pursuit.goal, 'c');
  for (let i = 0; i < 39; i++) run.step();
  assert.deepEqual(actor.position, origin);
  for (let i = 0; i < 160 && actor.pursuit.node !== 'b'; i++) run.step();
  assert.equal(actor.pursuit.node, 'b');
  run.state.position = { x: 6000, y: 8000, z: 0 };
  run.step();
  assert.equal(
    actor.pursuit.goal,
    'c',
    'The announced refuge cannot switch to d at this junction.',
  );
  assert.equal(actor.pursuit.phase, 'committed');
  for (let i = 0; i < 160 && actor.pursuit.node !== 'c'; i++) run.step();
  assert.equal(actor.pursuit.phase, 'recovering');
  const rest = { ...actor.position };
  for (let i = 0; i < 79; i++) run.step();
  assert.deepEqual(actor.position, rest);
  run.step();
  assert.equal(actor.pursuit.goal, 'd');
  assert.equal(actor.pursuit.phase, 'warning');
});

test('v2 pairs arrive separately, share one rest deadline, wait together, and preserve survivor position', () => {
  const run = fixture(validateWorldCourse(NATIVE_PURSUIT_V2_COURSES[1]));
  const [first, second] = run.actors;
  for (let i = 0; i < 1200 && first.pursuit.meetingUntil === undefined; i++) {
    run.step();
    assert.ok(
      Math.hypot(first.position.x - second.position.x, first.position.z - second.position.z) >=
        first.radius + second.radius,
    );
  }
  assert.equal(first.pursuit.arrived, true);
  assert.equal(second.pursuit.arrived, true);
  assert.equal(first.pursuit.phase, 'recovering');
  assert.equal(second.pursuit.phase, 'recovering');
  assert.equal(first.pursuit.meetingUntil, second.pursuit.meetingUntil);
  const positions = run.actors.slice(0, 2).map((actor) => ({ ...actor.position }));
  for (let i = 0; i < 81; i++) run.step();
  assert.deepEqual(
    run.actors.slice(0, 2).map((actor) => actor.position),
    positions,
  );
  assert.equal(first.pursuit.phase, 'waiting');
  assert.equal(second.pursuit.phase, 'waiting');
  first.status = 'caught';
  const before = { ...second.position };
  run.step();
  assert.equal(second.pursuit.family, 'runner');
  assert.equal(second.pursuit.arrived, undefined);
  assert.equal(second.pursuit.meetingUntil, undefined);
  assert.ok(Math.hypot(second.position.x - before.x, second.position.z - before.z) <= 31);
});

test('v2 rejects a meeting with only one shared approach, while v1 admission remains unchanged', () => {
  const course = structuredClone(NATIVE_PURSUIT_V2_COURSES[1]);
  course.pursuit.nodes = ['a', 'b', 'c'].map((id, index) => ({
    id,
    position: { x: index * 4000 - 8000, y: 0, z: 6000 },
  }));
  course.pursuit.edges = [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
  ];
  for (const [index, policy] of course.pursuit.actors.entries()) {
    policy.start = course.pursuit.nodes[index].id;
    policy.goals = ['c'];
    course.actors[index].position = { ...course.pursuit.nodes[index].position };
  }
  assert.throws(() => validateWorldCourse(course), /separate graph approaches/);
  course.pursuit.format = 'FlightPursuit.v1';
  assert.doesNotThrow(() => validateWorldCourse(course));
});

test('only two sample revisions opt into v2; original catalogue and playlist dependencies remain available', () => {
  assert.equal(NATIVE_PURSUIT_V2_COURSES.length, 2);
  for (const original of NATIVE_PURSUIT_COURSES) {
    assert.equal(original.revision, 'r1');
    assert.equal(original.pursuit.format, 'FlightPursuit.v1');
    assert.deepEqual(
      WORLD_CATALOGUE.find(
        (row) => row.packIdentity === NATIVE_PURSUIT_IDENTITY && row.id === original.id,
      )?.course,
      original,
    );
  }
  assert.equal(
    NATIVE_PURSUIT_PLAYLIST.entries.filter(
      (entry) => entry.packIdentity === NATIVE_PURSUIT_V2_IDENTITY,
    ).length,
    2,
  );
  assert.equal(
    NATIVE_PURSUIT_PLAYLIST.entries.filter(
      (entry) => entry.packIdentity === NATIVE_PURSUIT_IDENTITY,
    ).length,
    4,
  );
  for (const course of NATIVE_PURSUIT_V2_COURSES) {
    assert.equal(course.revision, 'r2');
    assert.deepEqual(
      compileChallengeDefinition(splitCourseDefinition(course)).course.pursuit,
      course.pursuit,
    );
  }
});

test('native v1/v2 proofs pin distinct models, and v2 recovery retains commitment and pair state', async () => {
  await initWorldRuntime();
  const command = { throttle: 0.5, roll: 0, pitch: 0, yaw: 0, actions: 0 };
  for (const course of [...NATIVE_PURSUIT_COURSES.slice(2, 3), ...NATIVE_PURSUIT_V2_COURSES]) {
    const flight = createWorldFlight({ course });
    let resumed;
    try {
      const recorder = createWorldRecorder(flight);
      flight.arm();
      for (let tick = 0; tick < (course.id.endsWith('meeting-yard') ? 780 : 75); tick++) {
        flight.step(command);
        recorder.record();
      }
      const proof = recorder.export();
      assert.equal(proof.format, 'FlightAttempt.v3');
      assert.equal(
        proof.model,
        course.pursuit.format === 'FlightPursuit.v2'
          ? 'civilian-world-pursuit.v2'
          : 'civilian-world-pursuit.v1',
      );
      resumed = await recoverWorldFlight(course, proof);
      resumed.flight.arm();
      for (let tick = 0; tick < 20; tick++) {
        flight.step(command);
        recorder.record();
        resumed.flight.step(command);
        resumed.recorder.record();
      }
      assert.deepEqual(resumed.recorder.export(), recorder.export());
      const other = structuredClone(course);
      other.pursuit.format =
        course.pursuit.format === 'FlightPursuit.v2' ? 'FlightPursuit.v1' : 'FlightPursuit.v2';
      await assert.rejects(replayWorldFlight(other, proof), /Exact world, runtime/);
    } finally {
      resumed?.flight.dispose();
      flight.dispose();
    }
  }
});

test('v2 rejects distinct arrival edges whose approach routes send partners head-on', () => {
  const course = structuredClone(NATIVE_PURSUIT_V2_COURSES[1]);
  course.pursuit.nodes = [
    ['a', 0, 0],
    ['b', 3000, 0],
    ['meeting', 6000, 0],
    ['c', 3000, 3000],
    ['d', 0, -6000],
  ].map(([id, x, z]) => ({ id, position: { x, y: 0, z } }));
  course.pursuit.edges = [
    ['a', 'b'],
    ['b', 'meeting'],
    ['c', 'b'],
    ['a', 'd'],
    ['d', 'meeting'],
  ].map(([from, to]) => ({ from, to }));
  for (const [index, start] of ['a', 'c'].entries()) {
    course.pursuit.actors[index].start = start;
    course.pursuit.actors[index].goals = ['meeting'];
    course.actors[index].position = {
      ...course.pursuit.nodes.find((node) => node.id === start).position,
    };
  }
  assert.throws(() => validateWorldCourse(course), /separate graph approaches/);
  course.pursuit.format = 'FlightPursuit.v1';
  assert.doesNotThrow(() => validateWorldCourse(course));
});

test('v2 rejects physically overlapping approaches even when their graph IDs are distinct', () => {
  const course = structuredClone(NATIVE_PURSUIT_V2_COURSES[1]);
  course.pursuit.nodes = [
    ['a', -10000],
    ['b', -5000],
    ['meeting', 0],
  ].map(([id, x]) => ({ id, position: { x, y: 0, z: 6000 } }));
  course.pursuit.edges = [
    { from: 'a', to: 'meeting' },
    { from: 'b', to: 'meeting' },
  ];
  for (const [index, start] of ['a', 'b'].entries()) {
    course.pursuit.actors[index].start = start;
    course.pursuit.actors[index].goals = ['meeting'];
    course.actors[index].position = {
      ...course.pursuit.nodes.find((node) => node.id === start).position,
    };
  }
  assert.throws(() => validateWorldCourse(course), /separate graph approaches/);
  course.pursuit.format = 'FlightPursuit.v1';
  assert.doesNotThrow(() => validateWorldCourse(course));
});
