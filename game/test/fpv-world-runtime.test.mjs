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
import { createWorldCollision } from '../../optional-practice/civilian-fpv/world-collision.mjs';

await initWorldRuntime();
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 };
function course(overrides = {}) {
  return {
    format: 'FlightCourse.v2',
    id: 'world-test',
    revision: 'r1',
    environment: 'test-world',
    world: { id: 'test-world', theme: 'test-theme', style: 'test-style' },
    locales: Object.fromEntries(
      ['en', 'uk'].map((lang) => [lang, { title: 'World', brief: 'Fly', lesson: 'Practice' }]),
    ),
    spawn: { x: 0, y: 0, z: 0 },
    bounds: { min: { x: -10000, y: 0, z: -10000 }, max: { x: 10000, y: 15000, z: 10000 } },
    obstacles: [],
    actors: [],
    steps: {
      'self-level': [{ type: 'survive', ticks: 2000 }],
      acro: [{ type: 'survive', ticks: 2000 }],
    },
    ...overrides,
  };
}
function run(flight, recorder, count, command = neutral) {
  for (let i = 0; i < count && flight.snapshot().status === 'active'; i++) {
    flight.step(typeof command === 'function' ? command(i) : command);
    recorder?.record();
  }
  return flight.snapshot();
}
const wall = { id: 'wall', min: { x: -2000, y: 0, z: -20 }, max: { x: 2000, y: 3000, z: 20 } };

test('world validation rejects unsupported rules, duplicate actors, malformed geometry and unknown targets', () => {
  assert.throws(
    () => validateWorldCourse(course({ rules: { arbitraryScript: 'run' } })),
    /not supported/i,
  );
  assert.throws(
    () => validateWorldCourse(course({ obstacles: [{ ...wall, rotation: [0, 2, 0, 1] }] })),
    /quaternion/,
  );
  const a = { id: 'enemy', type: 'sentry', position: { x: 3000, y: 0, z: 0 } };
  assert.throws(() => validateWorldCourse(course({ actors: [a, a] })), /Unique/);
  assert.throws(
    () =>
      validateWorldCourse(
        course({
          obstacles: [
            {
              id: 'mesh',
              type: 'trimesh',
              vertices: [0, 0, 0, 1, 0, 0, 2, 0, 0],
              indices: [0, 1, 2],
            },
          ],
        }),
      ),
    /Degenerate/,
  );
  assert.throws(
    () =>
      validateWorldCourse(
        course({
          steps: {
            'self-level': [{ type: 'eliminate', targets: ['missing'] }],
            acro: [{ type: 'survive', ticks: 10 }],
          },
        }),
      ),
    /existing combat/,
  );
  assert.throws(
    () =>
      validateWorldCourse(
        course({ actors: Array.from({ length: 13 }, (_, i) => ({ ...a, id: `enemy-${i}` })) }),
      ),
    /twelve/,
  );
});

test('static sphere sweep cannot tunnel through a thin wall or rotated box', () => {
  for (const rotated of [false, true]) {
    const box = rotated
      ? { ...wall, rotation: [0, 0.7071067811865476, 0, 0.7071067811865476] }
      : wall;
    const physics = createWorldCollision(validateWorldCourse(course({ obstacles: [box] })));
    try {
      const from = rotated ? { x: 3000, y: 1000, z: 0 } : { x: 0, y: 1000, z: 3000 };
      const delta = rotated ? { x: -6000, y: 0, z: 0 } : { x: 0, y: 0, z: -6000 };
      const result = physics.moveSphere(from, delta, 220);
      assert.equal(result.contacts[0].id, 'wall');
      assert.ok(result.position[rotated ? 'x' : 'z'] >= 240, JSON.stringify(result));
    } finally {
      physics.dispose();
    }
  }
});

test('drone takes off from support and refuses a solid-overlap spawn', () => {
  const flight = createWorldFlight({ course: course() });
  try {
    flight.arm();
    run(flight, null, 30, { ...neutral, throttle: 1 });
    assert.ok(flight.snapshot().position.y > 1000);
    assert.equal(flight.snapshot().grounded, false);
  } finally {
    flight.dispose();
  }
  assert.throws(
    () =>
      createWorldFlight({
        course: course({
          obstacles: [
            { id: 'block', min: { x: -1000, y: 0, z: -1000 }, max: { x: 1000, y: 1000, z: 1000 } },
          ],
        }),
      }),
    /overlaps/,
  );
});

test('elevated triangle platform supports a landing objective with exact surface identity', async () => {
  const landing = {
    type: 'land',
    min: { x: -1000, y: 1990, z: -1000 },
    max: { x: 1000, y: 2100, z: 1000 },
    ticks: 10,
    maxSpeed: 5000,
    maxTilt: 1000,
    minTilt: 0,
    centred: true,
    heading: null,
    surface: 'platform',
  };
  const c = course({
    spawn: { x: 0, y: 2500, z: 0 },
    obstacles: [
      {
        id: 'platform',
        type: 'trimesh',
        vertices: [-5000, 2000, -5000, -5000, 2000, 5000, 5000, 2000, 5000, 5000, 2000, -5000],
        indices: [0, 1, 2, 0, 2, 3],
      },
    ],
    steps: { 'self-level': [landing], acro: [landing] },
  });
  const flight = createWorldFlight({ course: c });
  const recorder = createWorldRecorder(flight);
  try {
    flight.arm();
    const state = run(flight, recorder, 200);
    assert.equal(state.status, 'complete');
    assert.equal(state.support.id, 'platform');
    assert.ok(state.position.y >= 2000 && state.position.y <= 2006);
    assert.equal((await replayWorldFlight(c, recorder.export())).state.status, 'complete');
  } finally {
    flight.dispose();
  }
});

test('moving actor relative sweep catches crossing trajectories between endpoints', () => {
  const c = validateWorldCourse(course());
  const physics = createWorldCollision(c);
  const actor = {
    id: 'moving',
    type: 'drone',
    radius: 300,
    height: 600,
    position: { x: -3000, y: 1000, z: 0 },
  };
  try {
    physics.addActor(actor);
    const hit = physics.castPulse({ x: 0, y: 1300, z: 2000 }, { x: 0, y: 1300, z: -2000 }, [
      { id: actor.id, from: actor.position, to: { x: 3000, y: 1000, z: 0 } },
    ]);
    assert.equal(hit.id, 'moving');
    assert.ok(hit.toi > 0 && hit.toi < 1);
  } finally {
    physics.dispose();
  }
});

test('a moving hazard contacts a resting drone after its floor movement is resolved', () => {
  const physics = createWorldCollision(validateWorldCourse(course()));
  const actor = {
    id: 'hazard',
    type: 'hazard',
    radius: 300,
    height: 600,
    position: { x: -2000, y: 0, z: 0 },
  };
  try {
    physics.addActor(actor);
    const result = physics.moveSphere({ x: 0, y: 2, z: 0 }, { x: 0, y: -4, z: 0 }, 220, [
      { id: actor.id, from: actor.position, to: { x: 2000, y: 0, z: 0 } },
    ]);
    assert.ok(result.contacts.some((hit) => hit.id === 'hazard'));
  } finally {
    physics.dispose();
  }
});

test('fictional pulses damage targets, obey cooldown and complete verified combat', async () => {
  const objective = { type: 'eliminate', targets: ['enemy'] };
  const c = course({
    actors: [
      {
        id: 'enemy',
        type: 'drone',
        position: { x: 0, y: 0, z: -2500 },
        radius: 220,
        health: 50,
        fireEveryTicks: 0,
      },
    ],
    steps: { 'self-level': [objective], acro: [objective] },
  });
  const flight = createWorldFlight({ course: c });
  const recorder = createWorldRecorder(flight);
  try {
    flight.arm();
    const state = run(flight, recorder, 100, { ...neutral, actions: 1 });
    assert.equal(state.status, 'complete');
    assert.equal(state.actors[0].health, 0);
    assert.equal(state.hits, 2);
    assert.ok(state.shots >= 2);
    assert.ok(state.ticks >= 8);
    const replay = await replayWorldFlight(c, recorder.export(), { sampleEvery: 2 });
    assert.equal(worldStateIdentity(replay.state), worldStateIdentity(state));
    assert.ok(replay.path.length > 1);
  } finally {
    flight.dispose();
  }
});

test('enemy pulses can defeat the drone, while intervening geometry blocks both sides', () => {
  const actor = {
    id: 'enemy',
    type: 'drone',
    position: { x: 0, y: 0, z: -2000 },
    radius: 220,
    fireEveryTicks: 10,
    damage: 50,
    projectileSpeed: 10000,
  };
  const flight = createWorldFlight({ course: course({ actors: [actor] }) });
  try {
    flight.arm();
    assert.equal(run(flight, null, 100).status, 'failed');
  } finally {
    flight.dispose();
  }
  const blocked = createWorldFlight({
    course: course({
      actors: [actor],
      obstacles: [
        { id: 'cover', min: { x: -1000, y: 0, z: -1100 }, max: { x: 1000, y: 4000, z: -900 } },
      ],
    }),
  });
  try {
    blocked.arm();
    const state = run(blocked, null, 100, { ...neutral, actions: 1 });
    assert.equal(state.health, 100);
    assert.equal(state.actors[0].health, 50);
    assert.equal(state.hits, 0);
  } finally {
    blocked.dispose();
  }
});

test('authored ground and vehicle patrols stop at solid map obstacles', () => {
  for (const type of ['patrol', 'vehicle']) {
    const c = course({
      spawn: { x: 5000, y: 0, z: 5000 },
      obstacles: [
        { id: 'barrier', min: { x: -100, y: 0, z: -2000 }, max: { x: 100, y: 3000, z: 2000 } },
      ],
      actors: [
        {
          id: 'patrol',
          type,
          position: { x: -3000, y: 0, z: 0 },
          path: [{ x: 3000, y: 0, z: 0 }],
          speed: 3000,
          fireEveryTicks: 0,
        },
      ],
    });
    const flight = createWorldFlight({ course: c });
    try {
      flight.arm();
      const actor = run(flight, null, 160).actors[0];
      assert.ok(actor.position.x < -300, JSON.stringify(actor));
      assert.ok(actor.position.x > -3000);
      assert.ok(Math.abs(actor.position.y) <= 15);
      assert.equal(actor.blocked, true);
    } finally {
      flight.dispose();
    }
  }
});

test('ground patrols climb authored 0.15 m steps and supported slopes', () => {
  for (const ramp of [false, true]) {
    const obstacle = ramp
      ? {
          id: 'ramp',
          type: 'trimesh',
          vertices: [0, 0, -2000, 0, 0, 2000, 4000, 1000, 2000, 4000, 1000, -2000],
          indices: [0, 1, 2, 0, 2, 3],
        }
      : { id: 'step', min: { x: 0, y: 0, z: -2000 }, max: { x: 7000, y: 150, z: 2000 } };
    const flight = createWorldFlight({
      course: course({
        spawn: { x: -8000, y: 0, z: 5000 },
        obstacles: [obstacle],
        actors: [
          {
            id: 'walker',
            type: 'patrol',
            position: { x: -2000, y: 0, z: 0 },
            path: [{ x: 3000, y: ramp ? 750 : 150, z: 0 }],
            speed: 3000,
            fireEveryTicks: 0,
          },
        ],
      }),
    });
    try {
      flight.arm();
      const actor = run(flight, null, 110).actors[0];
      assert.ok(actor.position.x > 2000, JSON.stringify(actor));
      assert.ok(actor.position.y >= (ramp ? 500 : 145), JSON.stringify(actor));
    } finally {
      flight.dispose();
    }
  }
});

test('projectile admission remains bounded while firing continuously', () => {
  const flight = createWorldFlight({
    course: course({ rules: { fireCooldown: 2, projectileSpeed: 1000, projectileTicks: 1000 } }),
  });
  try {
    flight.arm();
    const state = run(flight, null, 200, { ...neutral, actions: 1 });
    assert.equal(state.projectiles.length, 64);
    assert.equal(state.shots, 64);
  } finally {
    flight.dispose();
  }
});

test('pause freezes every subsystem; recovered command prefix resumes with the same final hash', async () => {
  const c = course({
    actors: [
      {
        id: 'patrol',
        type: 'patrol',
        position: { x: 5000, y: 0, z: 5000 },
        path: [{ x: 6000, y: 0, z: 5000 }],
        fireEveryTicks: 0,
      },
    ],
  });
  const flight = createWorldFlight({ course: c });
  const recorder = createWorldRecorder(flight);
  let recovered;
  try {
    flight.arm();
    run(flight, recorder, 40, { ...neutral, throttle: 0.6, actions: 1 });
    flight.pause();
    const paused = flight.snapshot();
    flight.step({ ...neutral, actions: 1 });
    assert.deepEqual(flight.snapshot(), paused);
    recovered = await recoverWorldFlight(c, recorder.export());
    assert.equal(recovered.flight.snapshot().status, 'paused');
    flight.arm();
    recovered.flight.arm();
    run(flight, recorder, 30, { ...neutral, throttle: 0.4 });
    run(recovered.flight, recovered.recorder, 30, { ...neutral, throttle: 0.4 });
    assert.equal(
      worldStateIdentity(flight.snapshot()),
      worldStateIdentity(recovered.flight.snapshot()),
    );
    assert.deepEqual(recorder.export(), recovered.recorder.export());
  } finally {
    flight.dispose();
    recovered?.flight.dispose();
  }
});

test('reset is deterministic; themes can change but rules, visibility and tampered commands cannot', async () => {
  const c = course();
  const flight = createWorldFlight({ course: c });
  try {
    let recorder = createWorldRecorder(flight);
    flight.arm();
    run(flight, recorder, 30, { ...neutral, throttle: 0.8 });
    const proof = recorder.export();
    flight.reset();
    recorder = createWorldRecorder(flight);
    flight.arm();
    run(flight, recorder, 30, { ...neutral, throttle: 0.8 });
    assert.deepEqual(recorder.export(), proof);
    const skin = clone(c);
    skin.world.theme = 'other-theme';
    skin.locales.en.title = 'New title';
    assert.equal((await replayWorldFlight(skin, proof)).state.ticks, 30);
    await assert.rejects(
      replayWorldFlight({ ...c, conditions: { profile: 'night', revision: 'r1' } }, proof),
      /Exact world/,
    );
    await assert.rejects(
      replayWorldFlight({ ...c, rules: { playerHealth: 200 } }, proof),
      /Exact world/,
    );
    const changed = clone(proof);
    changed.frames[2][3] = 0;
    await assert.rejects(replayWorldFlight(c, changed), /state does not match/);
    const aborted = new AbortController();
    aborted.abort();
    await assert.rejects(replayWorldFlight(c, proof, { signal: aborted.signal }), /abort/i);
  } finally {
    flight.dispose();
  }
});
const clone = (value) => structuredClone(value);

test('recorder requires the consumed command and rejects skipped ticks', () => {
  const flight = createWorldFlight({ course: course() });
  const recorder = createWorldRecorder(flight);
  try {
    flight.arm();
    flight.step(neutral);
    assert.throws(() => recorder.record({ ...neutral, throttle: 1 }), /exact command/);
    recorder.record();
    flight.step(neutral);
    flight.step(neutral);
    assert.throws(() => recorder.record(), /exactly once/);
    assert.throws(() => recorder.export(), /Unrecorded/);
  } finally {
    flight.dispose();
  }
  assert.throws(() => flight.snapshot(), /disposed/);
});
