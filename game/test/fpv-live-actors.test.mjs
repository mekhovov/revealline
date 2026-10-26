import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorldFlight,
  createWorldRecorder,
  createWorldContinuationRecorder,
  prepareWorldContinuationReplay,
  recoverWorldFlight,
  initWorldRuntime,
  LIVE_ACTOR_RULES,
  migrateWorldFlightToLive,
  replayWorldFlight,
  SUBJECT_REPLACEMENT_TICKS,
  WORLD_MAX_TICKS,
  worldStateIdentity,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import { createAircraftCourseSession } from '../../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import { createAdvancedWorkerHandler } from '../../optional-practice/civilian-fpv/advanced-worker.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
await initWorldRuntime();
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 };
const subject = (extras = {}) => ({
  id: 'subject',
  type: 'sentry',
  role: 'civilian',
  position: { x: 0, y: 0, z: -2000 },
  health: 25,
  fireEveryTicks: 0,
  ...extras,
});
const track = {
  type: 'actor-track-v1',
  actorId: 'subject',
  minDistance: 100,
  maxDistance: 9000,
  maxRelativeSpeed: 20000,
  maxTilt: 9000,
  ticks: 1000,
  viewAngle: 9000,
  minTargetTravel: 0,
};
function course(actors = [subject()], steps = [{ type: 'survive', ticks: 2000 }]) {
  return {
    format: 'FlightCourse.v2',
    id: 'live-actor-test',
    revision: 'r1',
    environment: 'test-world',
    world: { id: 'test-world', theme: 'test-theme', style: 'test-style' },
    locales: Object.fromEntries(
      ['en', 'uk'].map((lang) => [lang, { title: 'World', brief: 'Fly', lesson: 'Practice' }]),
    ),
    spawn: { x: 0, y: 0, z: 0 },
    bounds: { min: { x: -10000, y: 0, z: -10000 }, max: { x: 10000, y: 15000, z: 10000 } },
    obstacles: [],
    actors,
    steps: { 'self-level': steps, acro: steps },
  };
}
function build(source = course(), options = {}) {
  return createWorldFlight({ course: source, actorRules: LIVE_ACTOR_RULES, ...options });
}
function tick(flight, count = 1, input = neutral) {
  let state;
  for (let i = 0; i < count; i++)
    state = flight.step(
      input,
      flight.physicalCheckpoint ? { motion: motion(flight.snapshot().position) } : {},
    );
  return state;
}
function kill(flight) {
  for (let i = 0; i < 30; i++) {
    const s = flight.step(
      { ...neutral, actions: 1 },
      flight.physicalCheckpoint ? { motion: motion(flight.snapshot().position) } : {},
    );
    if (s.actors[0].status === 'defeated') return s;
  }
  throw new Error('Actor was not hit');
}
function motion(position = { x: 0, y: 0, z: 0 }, contacts = []) {
  return {
    position,
    velocity: { x: 0, y: 0, z: 0 },
    orientation: [0, 0, 0, 1000000],
    angular: { roll: 0, pitch: 0, yaw: 0 },
    grounded: true,
    support: { id: '$floor', normal: { x: 0, y: 1000000, z: 0 }, y: 0 },
    landingSpeed: 0,
    landingTilt: 0,
    contacts,
  };
}

test('live pulses destroy every role and gameplay actor type; historical civilians remain protected', () => {
  for (const [type, role] of [
    ['patrol', 'civilian'],
    ['sentry', 'rival'],
    ['sentry', 'hostile'],
    ['drone', 'civilian'],
    ['vehicle', 'rival'],
    ['hazard', undefined],
  ]) {
    const actor = subject({ type, ...(role ? { role } : {}) });
    if (!role) delete actor.role;
    const f = build(course([actor]));
    try {
      f.arm();
      const s = kill(f);
      const death = s.events.find((e) => e.type === 'defeat');
      assert.equal(death.spawnId, 'subject:0');
      assert.equal(death.rewardEligible, true);
      assert.ok(death.impactPosition);
      assert.equal(s.actorLives.deaths, 1);
      assert.deepEqual(s.actorLives.defeated, ['subject']);
    } finally {
      f.dispose();
    }
  }
  const old = createWorldFlight({ course: course() });
  try {
    old.arm();
    tick(old, 30, { ...neutral, actions: 1 });
    assert.equal(old.snapshot().actors[0].health, 25);
  } finally {
    old.dispose();
  }
});

test('required subject returns after250 accepted ticks with a new generation; blocked spawn waits', () => {
  const f = build(course([subject()], [track]), {
    physicalPractice: true,
    physicalRadius: 180,
    unscoredPractice: true,
  });
  try {
    f.arm();
    const dead = kill(f),
      due = dead.actors[0].replacementTick;
    assert.equal(due, dead.actors[0].defeatedTick + SUBJECT_REPLACEMENT_TICKS);
    f.pause();
    tick(f, 300);
    assert.equal(f.snapshot().ticks, dead.ticks);
    f.arm();
    while (f.snapshot().ticks < due) f.step(neutral, { motion: motion({ x: 0, y: 0, z: -2000 }) });
    f.preparePhysicalStep();
    f.cancelPhysicalStep();
    assert.equal(f.snapshot().actors[0].generation, 0);
    tick(f, 4);
    assert.equal(f.snapshot().actors[0].status, 'defeated');
    f.step(neutral, { motion: motion() });
    const replaced = tick(f);
    assert.equal(replaced.actors[0].generation, 1);
    assert.equal(replaced.actors[0].spawnId, 'subject:1');
    assert.equal(replaced.actors[0].health, 25);
    assert.equal(replaced.hold, 0);
    assert.deepEqual(replaced.actorLives.defeated, ['subject']);
    const again = kill(f);
    assert.equal(again.events.find((e) => e.type === 'defeat').rewardEligible, false);
  } finally {
    f.dispose();
  }
});

test('cancelled accepted-physics preparation rolls back a due replacement and events', () => {
  const f = build(course([subject()], [track]), {
    physicalPractice: true,
    physicalRadius: 180,
    unscoredPractice: true,
  });
  try {
    f.arm();
    kill(f);
    while (f.snapshot().ticks < f.snapshot().actors[0].replacementTick) tick(f);
    const before = f.snapshot();
    f.preparePhysicalStep();
    assert.equal(f.snapshot().actors[0].generation, 1);
    f.cancelPhysicalStep();
    assert.deepEqual(f.snapshot(), before);
    f.preparePhysicalStep();
    f.step(neutral, { motion: motion() });
    assert.equal(f.snapshot().actors[0].generation, 1);
    assert.ok(f.snapshot().events.some((e) => e.type === 'replacement'));
  } finally {
    f.dispose();
  }
});

test('future subject replacement preserves current unfinished objective progress', () => {
  const f = build(course([subject()], [{ type: 'survive', ticks: 1000 }, track]), {
    physicalPractice: true,
    physicalRadius: 180,
    unscoredPractice: true,
  });
  try {
    f.arm();
    kill(f);
    assert.equal(f.snapshot().step, 0);
    while (f.snapshot().ticks <= f.snapshot().actors[0].replacementTick) tick(f);
    assert.equal(f.snapshot().actors[0].generation, 1);
    assert.equal(f.snapshot().step, 0);
  } finally {
    f.dispose();
  }
});

test('impact requires separation and13ticks; lethal damage precedes catch', () => {
  const actor = subject({ role: 'hostile', health: 100 });
  const f = build(course([actor]), {
    physicalPractice: true,
    physicalRadius: 180,
    unscoredPractice: true,
  });
  try {
    f.arm();
    const hit = {
      id: 'subject',
      moving: true,
      normal: { x: 0, y: 0, z: 1000000 },
      relativeNormalSpeedMmS: 7000,
    };
    f.step(neutral, { motion: motion(undefined, [hit]) });
    assert.equal(f.snapshot().actors[0].health, 50);
    for (let i = 0; i < 15; i++) f.step(neutral, { motion: motion(undefined, [hit]) });
    assert.equal(f.snapshot().actors[0].health, 50);
    f.step(neutral, { motion: motion() });
    f.step(neutral, { motion: motion(undefined, [hit]) });
    assert.equal(f.snapshot().actors[0].status, 'defeated');
    assert.equal(f.snapshot().actorLives.impacts, 2);
  } finally {
    f.dispose();
  }
});

test('new proof dispatch replays damage; old proof identity remains unchanged', async () => {
  for (const actorRules of [null, LIVE_ACTOR_RULES]) {
    const c = course(),
      f = createWorldFlight({ course: c, actorRules });
    try {
      const recorder = createWorldRecorder(f);
      f.arm();
      for (let i = 0; i < 40; i++) {
        f.step({ ...neutral, actions: 1 });
        recorder.record();
      }
      const proof = recorder.export();
      assert.equal(proof.format, actorRules ? 'FlightAttempt.v4' : 'FlightAttempt.v2');
      const result = await replayWorldFlight(c, proof);
      assert.deepEqual(result.state, f.snapshot());
      assert.equal(result.state.actors[0].health, actorRules ? 0 : 25);
    } finally {
      f.dispose();
    }
  }
});

test('live mission checkpoints validate generation and events; restore keeps required replacement', () => {
  const c = course([subject()], [track]),
    f = build(c, { physicalPractice: true, physicalRadius: 180, unscoredPractice: true }),
    g = build(c, { physicalPractice: true, physicalRadius: 180, unscoredPractice: true });
  try {
    f.arm();
    kill(f);
    f.pause();
    const saved = f.physicalCheckpoint();
    assert.equal(saved.format, 'AircraftMissionCheckpoint.v2');
    g.restorePhysicalCheckpoint(saved);
    assert.deepEqual(g.snapshot(), f.snapshot());
    const bad = structuredClone(saved);
    bad.state.actors[0].spawnId = 'subject:99';
    assert.throws(() => g.restorePhysicalCheckpoint(bad), /generation/);
  } finally {
    f.dispose();
    g.dispose();
  }
});

test('verified old native Continue becomes paused unscored live practice without rewriting old evidence', () => {
  const old = createWorldFlight({ course: course() });
  let next;
  try {
    const recorder = createWorldRecorder(old);
    old.arm();
    for (let i = 0; i < 3; i++) {
      old.step(neutral);
      recorder.record();
    }
    old.pause();
    const proof = recorder.export();
    next = migrateWorldFlightToLive(old);
    assert.equal(next.identity.actorRules, LIVE_ACTOR_RULES);
    assert.equal(next.snapshot().ticks, 3);
    assert.equal(next.snapshot().status, 'paused');
    assert.throws(() => createWorldRecorder(next), /Unscored/);
    assert.deepEqual(recorder.export(), proof);
    next.arm();
    assert.equal(kill(next).actors[0].health, 0);
  } finally {
    old.dispose();
    next?.dispose();
  }
});

function client() {
  const replies = new Map();
  const handler = createAdvancedWorkerHandler((reply) => replies.set(reply.id, reply));
  let id = 0;
  async function request(type, fields = {}) {
    const key = ++id;
    await handler.receive({ id: key, session: 'live-actors-test', type, ...fields });
    const reply = replies.get(key);
    replies.delete(key);
    if (reply.error) throw new Error(reply.error);
    return reply.result;
  }
  return {
    initialize: (options) => request('init', { options }),
    stageTerrainFrame: (frame) => request('stage-terrain', { frame }),
    commitTerrainFrame: (decision) => request('commit-terrain', { decision }),
    step: (sample, motions) => request('step', { sample, motions }),
    propose: (sample, motions) => request('propose', { sample, motions }),
    commit: (decision) => request('commit', { decision }),
    snapshot: () => request('snapshot'),
    telemetry: () => request('telemetry'),
    restore: (snapshot) => request('restore', { snapshot }),
    dispose: () => handler.dispose(),
  };
}

test('Advanced native accepts live generation checkpoints and migrates old verified Continue', async () => {
  const preset = createPresetConfiguration('meteor75-analog-2022');
  const config = {
    response: preset.response,
    camera: preset.camera,
    advanced: { aircraft: preset.aircraft, controller: preset.controller },
  };
  const make = (actorRules) =>
    createAircraftCourseSession(
      { course: course(), mode: 'self-level', configuration: config, actorRules },
      { createClient: client, createMission: createWorldFlight },
    );
  const old = make(null),
    next = make(LIVE_ACTOR_RULES),
    fresh = make(LIVE_ACTOR_RULES);
  try {
    await old.prepare();
    old.arm();
    await old.step(neutral);
    old.pause();
    const saved = await old.exportRecovery();
    await next.prepare();
    await next.restoreRecovery(saved);
    await next.migrateActorRules();
    assert.equal(next.identity.actorRules, LIVE_ACTOR_RULES);
    next.arm();
    await next.step({ ...neutral, actions: 1 });
    next.pause();
    const live = await next.exportRecovery();
    assert.equal(live.mission.format, 'AircraftMissionCheckpoint.v2');
    await fresh.prepare();
    await fresh.restoreRecovery(live);
    assert.equal(fresh.snapshot().ticks, 2);
    assert.deepEqual(fresh.snapshot().actorLives, next.snapshot().actorLives);
  } finally {
    await old.dispose();
    await next.dispose();
    await fresh.dispose();
  }
});

test('same-step lethal contact cannot catch; replacement can later complete the same logical Hunt', () => {
  const hunt = {
    type: 'hunt-contact-v1',
    targets: ['subject'],
    ordered: false,
    tail: { linksPerCatch: 0, maxLinks: 0, neckDistance: 5000, radius: 250 },
  };
  const f = build(course([subject({ role: 'hostile' })], [hunt]), {
    physicalPractice: true,
    physicalRadius: 180,
    unscoredPractice: true,
  });
  try {
    f.arm();
    const contact = {
      id: 'subject',
      moving: true,
      normal: { x: 0, y: 0, z: 1000000 },
      relativeNormalSpeedMmS: 6000,
    };
    f.step(neutral, { motion: motion(undefined, [contact]) });
    assert.equal(f.snapshot().actors[0].status, 'defeated');
    assert.deepEqual(f.snapshot().hunt.caught, []);
    assert.equal(f.snapshot().step, 0);
    const due = f.snapshot().actors[0].replacementTick;
    while (f.snapshot().ticks <= due) tick(f);
    assert.equal(f.snapshot().actors[0].generation, 1);
    f.step(neutral, { motion: motion(undefined, [{ ...contact, relativeNormalSpeedMmS: 0 }]) });
    const s = f.snapshot();
    assert.deepEqual(s.hunt.caught, ['subject']);
    assert.equal(s.step, 1);
    assert.equal(s.events.find((e) => e.type === 'catch').rewardEligible, false);
    f.validatePhysicalCheckpoint(f.physicalCheckpoint());
  } finally {
    f.dispose();
  }
});

test('live momentum catches keep accepted speed; ordinary and wrong-order contacts still stop', () => {
  const run = (live, retainMomentum, wrongOrder = false) => {
    const hunt = {
      type: 'hunt-contact-v1',
      targets: wrongOrder ? ['later', 'subject'] : ['subject'],
      ordered: wrongOrder,
      tail: { linksPerCatch: 0, maxLinks: 0, neckDistance: 5000, radius: 250 },
      ...(retainMomentum ? { contactPolicy: 'retain-momentum-v1' } : {}),
    };
    const actors = [subject({ role: 'hostile', health: 1000 })];
    if (wrongOrder)
      actors.push(subject({ id: 'later', role: 'hostile', position: { x: 5000, y: 0, z: -5000 } }));
    const source = course(actors, [hunt]);
    const flight = createWorldFlight({
      course: source,
      ...(live ? { actorRules: LIVE_ACTOR_RULES } : {}),
    });
    try {
      flight.arm();
      for (let i = 0; i < 800; i++) {
        const state = flight.snapshot(),
          clamp = (value, min, max) => Math.max(min, Math.min(max, value)),
          az = clamp((-2000 - state.position.z) * 0.65 - state.velocity.z * 1.4, -1800, 1800),
          ay = clamp((900 - state.position.y) * 3 - state.velocity.y * 2, -4000, 4000);
        const next = flight.step({
          ...neutral,
          pitch: -az / 4905,
          throttle: clamp(
            (9810 + ay) / (19620 * Math.max(0.6, state.attitude.up.y / 1000000)),
            0,
            1,
          ),
        });
        if (next.hunt.caught.length) return next;
        if (wrongOrder && next.position.z < -1000 && next.contacts > state.contacts) return next;
      }
      assert.fail('The native flight did not reach its subject');
    } finally {
      flight.dispose();
    }
  };
  const historical = run(false, true),
    live = run(true, true),
    stopped = run(true, false),
    rejected = run(true, true, true);
  assert.equal(live.ticks, historical.ticks);
  assert.deepEqual(live.velocity, historical.velocity);
  assert.ok(live.velocity.z < -100);
  assert.ok(Math.abs(stopped.velocity.z) < 10);
  assert.equal(live.hunt.caught[0], 'subject');
  assert.deepEqual(rejected.hunt.caught, []);
  assert.equal(rejected.actors[0].status, 'active');
  assert.ok(Math.abs(rejected.velocity.z) < 10);
});

test('native continuation stores a new bounded timeline and verifies its original boundary', async () => {
  const c = course(),
    old = createWorldFlight({ course: c });
  let live, recovered;
  try {
    const recorder = createWorldRecorder(old);
    old.arm();
    for (let i = 0; i < 3; i++) {
      old.step(neutral);
      recorder.record();
    }
    old.pause();
    const boundary = recorder.export();
    live = migrateWorldFlightToLive(old);
    const continuation = createWorldContinuationRecorder(live, { boundaryProof: boundary });
    live.arm();
    for (let i = 0; i < 25; i++) {
      live.step({ ...neutral, actions: 1 });
      continuation.record();
    }
    live.pause();
    const packet = continuation.export();
    assert.equal(packet.frames.length, 25);
    assert.deepEqual(packet.boundaryProof, boundary);
    assert.equal(packet.unscored, true);
    const prepared = await prepareWorldContinuationReplay(c, packet);
    try {
      assert.equal(prepared.flight.snapshot().ticks, 3);
      assert.equal(prepared.flight.snapshot().status, 'paused');
      assert.equal(prepared.flight.identity.actorRules, LIVE_ACTOR_RULES);
      assert.deepEqual(prepared.frames, packet.frames);
      assert.equal(prepared.mode, 'self-level');
      prepared.frames[0][0] = 1000;
      assert.notEqual(prepared.frames[0][0], packet.frames[0][0]);
    } finally {
      prepared.flight.dispose();
    }
    const watched = await replayWorldFlight(c, packet);
    assert.equal(watched.unscored, true);
    assert.deepEqual(watched.state.actors, live.snapshot().actors);
    recovered = await recoverWorldFlight(c, packet);
    assert.equal(recovered.flight.snapshot().ticks, 28);
    recovered.flight.arm();
    recovered.flight.step(neutral);
    recovered.recorder.record();
    assert.equal(recovered.recorder.export().frames.length, 26);
    const damaged = structuredClone(packet);
    damaged.boundaryProof.frames[0][0] = 1000;
    await assert.rejects(() => recoverWorldFlight(c, damaged), /match|evidence/);
  } finally {
    old.dispose();
    live?.dispose();
    recovered?.flight.dispose();
  }
});

test('full continuation keeps a verified retained boundary while practice keeps flying', async () => {
  const c = course([]),
    old = createWorldFlight({ course: c });
  let live;
  try {
    const original = createWorldRecorder(old);
    old.arm();
    old.step(neutral);
    original.record();
    old.pause();
    const boundary = original.export();
    live = migrateWorldFlightToLive(old);
    const recorder = createWorldContinuationRecorder(live, { boundaryProof: boundary });
    assert.deepEqual(recorder.recordingStatus(), {
      recordedFrames: 0,
      maxFrames: WORLD_MAX_TICKS,
      retainedTick: 1,
      exhausted: false,
    });
    live.arm();
    assert.throws(() => recorder.record(), /exactly one accepted/);
    live.step(neutral);
    assert.throws(() => recorder.record({ ...neutral, actions: 1 }), /consumed continuation/);
    assert.equal(recorder.record(), true);
    for (let i = 1; i < WORLD_MAX_TICKS; i++) {
      live.step(neutral);
      assert.equal(recorder.record(), true);
    }
    const retainedIdentity = worldStateIdentity(live.snapshot());
    const retained = recorder.export();
    const fullPrefix = createWorldContinuationRecorder(live, {
      boundaryProof: boundary,
      prefix: retained.frames,
    });
    assert.equal(retained.finalStateIdentity, retainedIdentity);
    assert.equal(retained.frames.length, WORLD_MAX_TICKS);
    for (let i = 0; i < 3; i++) {
      live.step(neutral);
      assert.equal(recorder.record(), false);
    }
    assert.equal(live.snapshot().status, 'active');
    assert.equal(live.snapshot().ticks, WORLD_MAX_TICKS + 4);
    assert.deepEqual(recorder.recordingStatus(), {
      recordedFrames: WORLD_MAX_TICKS,
      maxFrames: WORLD_MAX_TICKS,
      retainedTick: WORLD_MAX_TICKS + 1,
      exhausted: true,
    });
    assert.deepEqual(recorder.export(), retained);
    assert.equal(fullPrefix.record(), false);
    assert.deepEqual(fullPrefix.export(), retained);
    assert.deepEqual(retained.boundaryProof, boundary);
    const replay = await replayWorldFlight(c, retained, {
      yieldControl: async () => {},
      includeSectors: true,
    });
    assert.equal(replay.state.ticks, WORLD_MAX_TICKS + 1);
    assert.equal(worldStateIdentity(replay.state), retainedIdentity);
    assert.deepEqual(replay.sectors, []);
  } finally {
    old.dispose();
    live?.dispose();
  }
});

test('accepted Advanced contact trace damages an actor; a cancelled worker proposal does not', async () => {
  const preset = createPresetConfiguration('meteor75-analog-2022');
  const configuration = {
    response: preset.response,
    advanced: { aircraft: preset.aircraft, controller: preset.controller },
  };
  for (const reject of [false, true]) {
    const createClient = () => {
      const worker = client();
      return {
        ...worker,
        async propose(sample, motions) {
          const proposal = await worker.propose(sample, motions);
          return {
            ...proposal,
            movingContacts: [
              { id: 'subject', normal: { x: 0, y: 0, z: 1 }, relativeNormalSpeed: 6 },
            ],
          };
        },
        commit(decision) {
          if (reject && decision.accepted) throw new Error('Injected worker cancellation');
          return worker.commit(decision);
        },
      };
    };
    const flight = createAircraftCourseSession(
      { course: course(), mode: 'self-level', configuration, actorRules: LIVE_ACTOR_RULES },
      { createClient, createMission: createWorldFlight },
    );
    try {
      await flight.prepare();
      flight.arm();
      if (reject) {
        await assert.rejects(() => flight.step(neutral), /cancellation/);
        assert.equal(flight.snapshot().ticks, 0);
        assert.equal(flight.snapshot().actors[0].health, 25);
        assert.deepEqual(flight.defeatHistory(), []);
      } else {
        await flight.step(neutral);
        assert.equal(flight.snapshot().actors[0].status, 'defeated');
        assert.equal(flight.defeatHistory().length, 1);
        assert.equal(flight.defeatHistory()[0].cause, 'impact');
      }
    } finally {
      await flight.dispose();
    }
  }
});

test('native accepted defeat history reconstructs on replay and cannot mutate proof identity', async () => {
  const c = course(),
    flight = build(c);
  let recovered;
  try {
    const recorder = createWorldRecorder(flight);
    flight.arm();
    for (let i = 0; i < 25; i++) {
      flight.step({ ...neutral, actions: 1 });
      recorder.record();
    }
    flight.pause();
    const before = recorder.export(),
      history = flight.defeatHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].eventId, `${history[0].spawnId}:${history[0].tick}:defeat`);
    assert.equal(history[0].appearance.cast, undefined);
    history[0].position.x = 999999;
    assert.deepEqual(recorder.export(), before);
    recovered = await recoverWorldFlight(c, before);
    assert.deepEqual(recovered.flight.defeatHistory(), flight.defeatHistory());
  } finally {
    flight.dispose();
    recovered?.flight.dispose();
  }
});

test('destroying the current tracked subject resets only that unfinished hold', () => {
  const f = build(course([subject()], [track]), {
    physicalPractice: true,
    physicalRadius: 180,
    unscoredPractice: true,
  });
  try {
    f.arm();
    const air = { ...motion({ x: 0, y: 1000, z: 0 }), grounded: false, support: null };
    for (let i = 0; i < 5; i++) f.step(neutral, { motion: air });
    assert.equal(f.snapshot().hold, 5);
    f.step(neutral, {
      motion: {
        ...air,
        contacts: [
          {
            id: 'subject',
            moving: true,
            normal: { x: 0, y: 0, z: 1000000 },
            relativeNormalSpeedMmS: 6000,
          },
        ],
      },
    });
    assert.equal(f.snapshot().hold, 0);
    assert.equal(f.snapshot().actorTrack.reason, 'subject-replacement');
    assert.equal(f.snapshot().step, 0);
  } finally {
    f.dispose();
  }
});

test('logical elimination credit survives an earlier required-subject replacement', () => {
  const f = build(
    course(
      [subject({ role: 'hostile' })],
      [{ type: 'survive', ticks: 1000 }, { type: 'eliminate', targets: ['subject'] }, track],
    ),
    { physicalPractice: true, physicalRadius: 180, unscoredPractice: true },
  );
  try {
    f.arm();
    const dead = kill(f);
    assert.equal(dead.hold, dead.ticks);
    while (f.snapshot().ticks < 1001) tick(f);
    assert.equal(f.snapshot().actors[0].generation, 1);
    assert.equal(f.snapshot().actors[0].status, 'active');
    assert.equal(f.snapshot().step, 2);
    assert.deepEqual(f.snapshot().actorLives.defeated, ['subject']);
  } finally {
    f.dispose();
  }
});
