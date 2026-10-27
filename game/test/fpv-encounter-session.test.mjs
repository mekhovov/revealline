import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEncounterSession,
  createEncounterPlayback,
  replayEncounterSession,
} from '../../optional-practice/civilian-fpv/encounter-session.mjs';
import {
  createEncounterDefinition,
  encounterPhysicsCourse,
  createNativeEncounterGeometry,
  createEncounterRuntime,
  inspectEncounterRecovery,
} from '../../optional-practice/civilian-fpv/encounter-runtime.mjs';
import {
  createWorldFlight,
  initWorldRuntime,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { dataIdentity } from '../../game/data-json.mjs';
await initWorldRuntime();

test('native encounter session preserves course state and saves a paired paused boundary', async () => {
  const original = FLIGHT_COURSES[0],
    geometry = createNativeEncounterGeometry(original);
  const definition = createEncounterDefinition({
    course: original,
    activity: 'hunting',
    population: 6,
    admitActor: geometry.admitActor,
  });
  const base = createWorldFlight({
    course: encounterPhysicsCourse(original),
    encounterPhysicsOnly: true,
    unscoredPractice: true,
  });
  const session = await createEncounterSession(base, { definition, geometry });
  try {
    session.arm();
    for (let tick = 0; tick < 100; tick++)
      session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 1 });
    assert.equal(session.snapshot().encounter.ticks, 100);
    assert.equal(session.snapshot().ticks, 100);
    assert.equal(session.snapshot().encounter.shots, 13);
    const saved = await session.exportCombatRecovery({ format: 'optional-bad-presentation' });
    assert.equal(session.snapshot().status, 'paused');
    session.arm();
    session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0 });
    await session.restoreCombatRecovery(saved);
    assert.equal(session.snapshot().ticks, 100);
    assert.equal(session.snapshot().encounter.ticks, 100);
    assert.equal(session.snapshot().status, 'paused');
    assert.deepEqual(session.snapshot().combatRecording, {
      format: 'FPVEncounterRecordingStatus.v1',
      retainedFrom: 0,
      retainedTo: 100,
      complete: true,
      practiceOnly: true,
    });
    const enormousCosmetics = { ...saved, presentation: { invalid: 'x'.repeat(9 * 1024 * 1024) } };
    assert.equal((await session.restoreCombatRecovery(enormousCosmetics)).presentation, null);
    const brokenHistory = structuredClone(saved);
    brokenHistory.gameplay.recording.frames.pop();
    brokenHistory.checksum = dataIdentity(brokenHistory.gameplay);
    await assert.rejects(session.restoreCombatRecovery(brokenHistory), /recording interval/);
    assert.equal(session.snapshot().encounter.ticks, 100);
  } finally {
    await session.dispose();
  }
});

test('continuous session rolls its bounded recording and restores the retained chain', async () => {
  const course = FLIGHT_COURSES[0],
    admission = createNativeEncounterGeometry(course);
  const definition = createEncounterDefinition({
    course,
    activity: 'continuous',
    population: 6,
    admitActor: admission.admitActor,
  });
  admission.dispose();
  let state = {
    position: structuredClone(course.spawn),
    velocity: { x: 0, y: 0, z: 0 },
    orientation: [0, 0, 0, 1000000],
    ticks: 0,
    status: 'paused',
  };
  const base = {
    identity: { id: 'long-session' },
    snapshot: () => structuredClone(state),
    configureEncounterActors() {},
    stageEncounterActors() {},
    arm() {
      state.status = 'active';
    },
    pause() {
      state.status = 'paused';
    },
    step() {
      state.ticks++;
    },
    encounterCheckpoint: () => structuredClone(state),
    restoreEncounterCheckpoint(saved) {
      state = structuredClone(saved);
    },
  };
  const session = await createEncounterSession(base, {
    definition,
    geometry: { visible: () => false, sweepStatic: () => null },
  });
  try {
    session.arm();
    for (let tick = 0; tick < 12017; tick++)
      session.step({ roll: 0.123, pitch: -0.219, yaw: 0.001, throttle: 0.51, actions: 0 });
    assert.equal(session.snapshot().encounter.ticks, 12017);
    const saved = await session.exportCombatRecovery();
    assert.equal(saved.gameplay.recording.segments.length, 3);
    assert.equal(saved.gameplay.recording.frames.length, 17);
    assert.deepEqual(saved.gameplay.recording.frames[0], [123, -219, 1, 510, 0]);
    assert.equal(saved.gameplay.recording.retainedFrom, 3000);
    await session.restoreCombatRecovery(saved);
    assert.deepEqual(session.snapshot().combatRecording, {
      format: 'FPVEncounterRecordingStatus.v1',
      retainedFrom: 3000,
      retainedTo: 12017,
      complete: false,
      practiceOnly: true,
    });
    session.arm();
    session.step({ actions: 0 });
    assert.equal(session.snapshot().encounter.ticks, 12018);
  } finally {
    await session.dispose();
  }
});

test('regional boundary keeps flight active and freezes only the roster and combat clock until reentry', async () => {
  const course = FLIGHT_COURSES[0],
    admission = createNativeEncounterGeometry(course);
  const definition = createEncounterDefinition({
    course,
    population: 6,
    admitActor: admission.admitActor,
  });
  admission.dispose();
  const state = {
    position: structuredClone(course.spawn),
    velocity: { x: 0, y: 0, z: 0 },
    orientation: [0, 0, 0, 1000000],
    ticks: 0,
    status: 'paused',
  };
  let nextPosition = { ...course.spawn, x: definition.bounds.max.x + 1000 };
  const base = {
    identity: { id: 'regional-return' },
    snapshot: () => structuredClone(state),
    configureEncounterActors() {},
    stageEncounterActors() {},
    arm() {
      state.status = 'active';
    },
    pause() {
      state.status = 'paused';
    },
    step() {
      state.ticks++;
      state.position = nextPosition;
    },
  };
  const session = await createEncounterSession(base, {
    definition,
    regional: true,
    geometry: { visible: () => false, sweepStatic: () => null },
  });
  try {
    session.arm();
    session.step({ actions: 0 });
    assert.equal(session.snapshot().status, 'active');
    assert.equal(session.snapshot().encounter.outsideArea, true);
    const roster = session.snapshot().encounter.actors;
    session.step({ actions: 1 });
    assert.equal(session.snapshot().ticks, 2, 'Flight continues without Return or another Arm');
    assert.equal(session.snapshot().encounter.ticks, 1);
    assert.deepEqual(session.snapshot().encounter.actors, roster);
    nextPosition = course.spawn;
    session.step({ actions: 1 });
    assert.equal(session.snapshot().status, 'active');
    assert.equal(session.snapshot().encounter.outsideArea, false);
    assert.equal(session.snapshot().encounter.shots, 0);
    session.step({ actions: 0 });
    assert.equal(session.snapshot().encounter.ticks, 2);
  } finally {
    await session.dispose();
  }
});

async function boundarySession({ asynchronous = false, definition: retained, runId } = {}) {
  const course = FLIGHT_COURSES[0];
  const definition =
    retained ??
    createEncounterDefinition({
      course,
      version: 2,
      activity: 'strike',
      population: 6,
      seed: 19,
      playerDamage: 'invulnerable',
    });
  let state = {
    position: structuredClone(definition.spawn),
    velocity: { x: 0, y: 0, z: 0 },
    orientation: [0, 0, 0, 1000000],
    ticks: 0,
    status: 'paused',
  };
  let accept = true,
    failure = false,
    ready = true,
    staged;
  const base = {
    identity: { id: `boundary-${asynchronous ? 'async' : 'sync'}` },
    snapshot: () => structuredClone(state),
    configureEncounterActors() {},
    stageEncounterActors(proposal) {
      staged = structuredClone(proposal);
    },
    arm() {
      state.status = 'active';
    },
    pause() {
      state.status = 'paused';
    },
    step(input) {
      const advance = () => {
        if (failure) throw new Error('boundary worker failed');
        if (!accept) return;
        state.ticks++;
        if (input.roll === 1)
          state.position = { ...definition.spawn, x: definition.bounds.max.x + 1000 };
        if (input.roll === -1) state.position = structuredClone(definition.spawn);
      };
      return asynchronous ? Promise.resolve().then(advance) : advance();
    },
    encounterCheckpoint: () => structuredClone(state),
    restoreEncounterCheckpoint(value) {
      state = { ...structuredClone(value), status: 'paused' };
    },
  };
  const session = await createEncounterSession(base, {
    definition,
    regional: true,
    runId,
    geometry: {
      ready: () => ready,
      visible: () => false,
      sweepStatic: () => null,
      surface: (point) => ({
        position: { ...point, y: definition.spawn.y },
        normal: { x: 0, y: 1, z: 0 },
      }),
    },
  });
  return {
    session,
    setAccept(value) {
      accept = value;
    },
    setFailure(value) {
      failure = value;
    },
    setReady(value) {
      ready = value;
    },
    staged: () => staged,
  };
}

for (const asynchronous of [false, true])
  test(`regional v2 ${asynchronous ? 'async' : 'sync'} boundary preserves flight, roster and accepted phase recording`, async () => {
    const h = await boundarySession({ asynchronous }),
      s = h.session;
    try {
      s.arm();
      await s.step({ roll: 1, actions: 0 });
      const outside = s.snapshot(),
        roster = outside.encounter.actors;
      assert.equal(outside.status, 'active');
      assert.equal(outside.encounter.outsideArea, true);
      assert.equal(outside.encounter.ticks, 1);
      assert.equal(s.queueCombatCommand({ payload: true }), false);
      for (let count = 0; count < 3; count++) await s.step({ roll: 0, actions: 1 });
      const moving = s.snapshot();
      assert.equal(moving.status, 'active');
      assert.equal(moving.ticks, 4);
      assert.equal(moving.encounter.ticks, 1);
      assert.equal(moving.encounter.shots, 0);
      assert.deepEqual(moving.encounter.actors, roster);
      assert.deepEqual(h.staged().actors, roster);
      assert.ok(
        h
          .staged()
          .motions.every((motion) => JSON.stringify(motion.from) === JSON.stringify(motion.to)),
      );

      h.setAccept(false);
      await s.step({ roll: -1, actions: 1 });
      assert.deepEqual(
        s.snapshot(),
        moving,
        'Rejected outside flight consumes no recording or combat time',
      );
      h.setFailure(true);
      await assert.rejects(async () => s.step({ roll: -1, actions: 1 }), /boundary worker failed/);
      assert.deepEqual(s.snapshot(), moving, 'Worker failure cannot move the preserved roster');
      h.setFailure(false);
      h.setAccept(true);

      s.pause();
      const paused = s.snapshot();
      await s.step({ roll: -1, actions: 1 });
      assert.deepEqual(s.snapshot(), paused, 'Explicit pause never auto-arms outside');
      s.returnToEncounter();
      assert.equal(s.snapshot().status, 'paused', 'Navigation guidance is not an Arm command');
      s.arm();
      assert.equal(
        s.snapshot().status,
        'active',
        'Explicit Arm works outside without another prerequisite',
      );
      await s.step({ roll: -1, actions: 1 });
      assert.equal(s.snapshot().status, 'active');
      assert.equal(s.snapshot().encounter.outsideArea, false);
      assert.deepEqual(s.snapshot().encounter.actors, roster);
      assert.equal(s.snapshot().encounter.shots, 0, 'The reentry flight interval cannot fire');
      await s.step({ roll: 0, actions: 0 });
      assert.equal(s.snapshot().encounter.ticks, 2, 'Combat resumes on the next accepted interval');
      const saved = await s.exportCombatRecovery();
      assert.deepEqual(
        saved.gameplay.recording.frames.map((frame) => frame[6]),
        [0, 1, 1, 1, 1, 0],
      );
      assert.ok(
        saved.gameplay.recording.frames
          .filter((frame) => frame[6] === 1)
          .every((frame) => frame[4] === 0 && frame[5] === 0),
      );
      const proof = await replayEncounterSession(saved, {
        createSession: async (options) =>
          (await boundarySession({ ...options, asynchronous })).session,
        yieldControl: async () => {},
      });
      assert.equal(proof.verified, true);
      assert.equal(proof.sessionTicks, 6);
      assert.equal(proof.acceptedTicks, 2);
    } finally {
      await s.dispose();
    }
  });

test('regional v2 recovery outside restores paused, keeps required actors and resumes flight with one explicit Arm', async () => {
  const { session: s } = await boundarySession();
  try {
    s.arm();
    await s.step({ roll: 1 });
    await s.step({ roll: 0, actions: 1 });
    const saved = await s.exportCombatRecovery();
    await s.restoreCombatRecovery(saved);
    const restored = s.snapshot();
    assert.equal(restored.status, 'paused');
    assert.equal(restored.encounter.outsideArea, true);
    assert.deepEqual(restored.encounter.actors, saved.gameplay.encounter.state.actors);
    await s.step({ roll: -1 });
    assert.deepEqual(s.snapshot(), restored);
    s.arm();
    await s.step({ roll: 0 });
    assert.equal(s.snapshot().status, 'active');
    assert.equal(s.snapshot().ticks, 3);
    assert.equal(s.snapshot().encounter.ticks, 1);
    await s.step({ roll: -1 });
    assert.equal(s.snapshot().status, 'active');
    assert.equal(s.snapshot().encounter.outsideArea, false);
    await s.step({ roll: 0 });
    assert.equal(s.snapshot().encounter.ticks, 2);
  } finally {
    await s.dispose();
  }
});

test('regional v2 queued commands wait through outside flight and execute once after reentry', async () => {
  const { session: s } = await boundarySession();
  try {
    s.arm();
    assert.equal(s.queueCombatCommand({ switchWeapon: 1 }), true);
    assert.equal(s.queueCombatCommand({ reload: true }), true);
    await s.step({ roll: 1 });
    assert.equal(s.snapshot().encounter.lastCommandSeq, 1);
    await s.step({ roll: 0 });
    await s.step({ roll: -1 });
    assert.equal(s.snapshot().encounter.lastCommandSeq, 1);
    await s.step({ roll: 0 });
    assert.equal(s.snapshot().encounter.lastCommandSeq, 2);
    const saved = await s.exportCombatRecovery();
    assert.deepEqual(
      saved.gameplay.recording.frames.map((frame) => [frame[5], frame[6]]),
      [
        [1, 0],
        [0, 1],
        [0, 1],
        [2, 0],
      ],
    );
    assert.equal(saved.gameplay.session.commands.length, 0);
  } finally {
    await s.dispose();
  }
});

for (const asynchronous of [false, true])
  test(`regional v2 ${asynchronous ? 'async' : 'sync'} unavailable encounter geometry preserves inside flight and replays independently of residency`, async () => {
    const h = await boundarySession({ asynchronous }),
      s = h.session;
    try {
      s.arm();
      await s.step({ roll: 0 });
      const roster = s.snapshot().encounter.actors;
      assert.equal(s.queueCombatCommand({ switchWeapon: 1 }), true);
      h.setReady(false);
      for (let count = 0; count < 3; count++) await s.step({ roll: 0, actions: 1 });
      const held = s.snapshot();
      assert.equal(held.status, 'active');
      assert.equal(held.ticks, 4);
      assert.equal(held.encounter.ticks, 1);
      assert.equal(held.encounter.outsideArea, false);
      assert.equal(held.encounter.geometryWaiting, true);
      assert.equal(held.encounter.shots, 0);
      assert.equal(held.encounter.lastCommandSeq, 0);
      assert.deepEqual(held.encounter.actors, roster);
      assert.deepEqual(h.staged().actors, roster);
      h.setAccept(false);
      await s.step({ roll: 0, actions: 1 });
      assert.deepEqual(
        s.snapshot(),
        held,
        'Rejected terrain admission consumes neither clock nor command',
      );
      h.setAccept(true);
      h.setReady(true);
      await s.step({ roll: 0, actions: 0 });
      assert.equal(s.snapshot().encounter.geometryWaiting, false);
      assert.equal(s.snapshot().encounter.ticks, 2);
      assert.equal(s.snapshot().encounter.lastCommandSeq, 1);
      const saved = await s.exportCombatRecovery();
      assert.deepEqual(
        saved.gameplay.recording.frames.map((frame) => [frame[5], frame[6]]),
        [
          [0, 0],
          [0, 1],
          [0, 1],
          [0, 1],
          [1, 0],
        ],
      );
      const proof = await replayEncounterSession(saved, {
        createSession: async (options) =>
          (await boundarySession({ ...options, asynchronous })).session,
        yieldControl: async () => {},
      });
      assert.equal(
        proof.verified,
        true,
        'A ready playback region preserves recorded flight-only decisions',
      );
      assert.equal(proof.sessionTicks, 5);
      assert.equal(proof.acceptedTicks, 2);
      await s.restoreCombatRecovery(saved);
      assert.equal(s.snapshot().status, 'paused');
      assert.equal(s.snapshot().encounter.ticks, 2);
      assert.deepEqual(s.snapshot().encounter.actors, saved.gameplay.encounter.state.actors);
    } finally {
      await s.dispose();
    }
  });

test('regional v2 recorded combat phase waits for geometry without recording an unrequested flight-only interval', async () => {
  const h = await boundarySession(),
    s = h.session;
  try {
    h.setReady(false);
    const before = s.snapshot();
    assert.equal((await s.stepRecorded([0, 0, 0, 0, 0, 0, 0])).accepted, false);
    assert.equal(s.snapshot().ticks, before.ticks);
    assert.equal(s.snapshot().encounter.ticks, before.encounter.ticks);
    assert.deepEqual(s.snapshot().encounter.actors, before.encounter.actors);
    h.setReady(true);
    assert.equal((await s.stepRecorded([0, 0, 0, 0, 0, 0, 0])).accepted, true);
    assert.equal(s.snapshot().ticks, 1);
    assert.equal(s.snapshot().encounter.ticks, 1);
  } finally {
    await s.dispose();
  }
});

test('rejected and failed async aircraft steps never consume encounter time or fire', async () => {
  const course = FLIGHT_COURSES[0],
    geometry = createNativeEncounterGeometry(course);
  const definition = createEncounterDefinition({
    course,
    population: 6,
    admitActor: geometry.admitActor,
  });
  let failure = false;
  const state = {
    position: course.spawn,
    velocity: { x: 0, y: 0, z: 0 },
    orientation: [0, 0, 0, 1000000],
    ticks: 0,
    status: 'active',
  };
  const session = await createEncounterSession(
    {
      identity: { id: 'mock' },
      snapshot: () => structuredClone(state),
      configureEncounterActors() {},
      stageEncounterActors() {},
      pause() {},
      step: async () => {
        if (failure) throw new Error('worker failed');
      },
      dispose() {},
    },
    { definition, geometry },
  );
  try {
    const before = session.snapshot().encounter;
    await session.step({ actions: 1 });
    assert.deepEqual(session.snapshot().encounter, before);
    failure = true;
    await assert.rejects(session.step({ actions: 1 }), /worker failed/);
    assert.deepEqual(session.snapshot().encounter, before);
  } finally {
    await session.dispose();
  }
});

test('a synchronous combat checkpoint cannot consume a fresh Arm or capture later frames', async () => {
  const course = FLIGHT_COURSES[0],
    geometry = createNativeEncounterGeometry(course);
  const definition = createEncounterDefinition({
    course,
    activity: 'hunting',
    population: 6,
    admitActor: geometry.admitActor,
  });
  const base = createWorldFlight({
    course: encounterPhysicsCourse(course),
    encounterPhysicsOnly: true,
    unscoredPractice: true,
  });
  const session = await createEncounterSession(base, { definition, geometry });
  try {
    session.arm();
    session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0.1, actions: 0 });
    const saving = session.exportCombatRecovery();
    assert.equal(session.combatCheckpointPending(), false);
    session.arm();
    session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0.4, actions: 0 });
    const saved = await saving;
    assert.equal(session.snapshot().status, 'active');
    assert.equal(saved.gameplay.encounter.state.ticks, 1);
    assert.equal(saved.gameplay.physical.state.ticks, 1);
    assert.equal(saved.gameplay.recording.frames.length, 1);
    assert.equal(saved.checksum, dataIdentity(saved.gameplay));
  } finally {
    await session.dispose();
  }
});

async function v2Session(options = {}) {
  const course = FLIGHT_COURSES[0],
    admission = createNativeEncounterGeometry(course);
  const definition = createEncounterDefinition({
    course,
    version: 2,
    activity: 'hunting',
    population: 6,
    admitActor: admission.admitActor,
    ...options,
  });
  admission.dispose();
  let state = {
    position: structuredClone(course.spawn),
    velocity: { x: 0, y: 0, z: 0 },
    orientation: [0, 0, 0, 1000000],
    ticks: 0,
    status: 'paused',
  };
  let accept = true,
    crash = false,
    ready = true,
    contacts = [];
  const base = {
    identity: { id: 'v2-test' },
    snapshot: () => structuredClone(state),
    configureEncounterActors() {},
    stageEncounterActors() {},
    encounterMotion: () => ({ contacts }),
    arm() {
      if (state.status !== 'crashed') state.status = 'active';
    },
    pause() {
      if (state.status !== 'crashed') state.status = 'paused';
    },
    step() {
      if (accept) {
        state.ticks++;
        if (crash) state.status = 'crashed';
      }
    },
    encounterCheckpoint: () => structuredClone(state),
    restoreEncounterCheckpoint(saved) {
      state = structuredClone(saved);
      state.status = 'paused';
    },
  };
  const geometry = {
    ready: () => ready,
    visible: () => false,
    sweepStatic: () => null,
    surface: (p) => ({ position: { ...p, y: course.spawn.y }, normal: { x: 0, y: 1, z: 0 } }),
  };
  const runtime = createEncounterRuntime(definition, { geometry });
  const session = await createEncounterSession(base, { definition, geometry, runtime });
  return {
    session,
    base,
    definition,
    runtime,
    geometry,
    setReady(v) {
      ready = v;
    },
    setContacts(v) {
      contacts = v;
    },
    setAccept(v) {
      accept = v;
    },
    setCrash(v) {
      crash = v;
    },
    setPosition(p) {
      state.position = p;
    },
  };
}
test('v2 queued commands survive rejected steps, are recorded once, and restore without duplicate execution', async () => {
  const h = await v2Session(),
    s = h.session;
  try {
    s.arm();
    h.setAccept(false);
    assert.equal(s.queueCombatCommand({ switchWeapon: 1 }), true);
    s.step({ actions: 0, throttle: 0 });
    assert.equal(s.snapshot().encounter.weaponIndex, 0);
    assert.equal(s.snapshot().encounter.ticks, 0);
    const pending = await s.exportCombatRecovery();
    assert.equal(pending.gameplay.session.commands.length, 1);
    await s.restoreCombatRecovery(pending);
    h.setAccept(true);
    s.arm();
    s.step({ actions: 0, throttle: 0 });
    assert.equal(s.snapshot().encounter.weaponIndex, 1);
    assert.equal(s.snapshot().encounter.lastCommandSeq, 1);
    s.step({ actions: 0, throttle: 0 });
    const saved = await s.exportCombatRecovery();
    assert.deepEqual(
      saved.gameplay.recording.frames.map((f) => [f[4], f[5], f[6]]),
      [
        [8, 1, 0],
        [0, 0, 0],
      ],
    );
    await s.restoreCombatRecovery(saved);
    s.arm();
    s.step({ actions: 0 });
    assert.equal(s.snapshot().encounter.lastCommandSeq, 1);
    assert.equal(s.snapshot().encounter.weaponIndex, 1);
  } finally {
    await s.dispose();
  }
});
test('v2 pause cancels unsent commands and cannot trigger ordnance upon resume', async () => {
  const { session: s } = await v2Session();
  try {
    s.arm();
    assert.equal(s.queueCombatCommand({ payload: true }), true);
    s.pause();
    assert.equal(s.queueCombatCommand({ detonate: true }), false);
    s.arm();
    s.step({ actions: 0 });
    assert.equal(s.snapshot().encounter.ordnance.length, 0);
    assert.equal(s.snapshot().encounter.payloadAmmo, 3);
  } finally {
    await s.dispose();
  }
});
test('Strike aftermath is separately recorded, can pause, and restores paused', async () => {
  const h = await v2Session({ activity: 'strike' }),
    s = h.session;
  try {
    h.setPosition({ ...h.definition.spawn, y: h.definition.spawn.y + 5000 });
    s.arm();
    s.queueCombatCommand({ payload: true });
    s.step({ actions: 0 });
    h.setCrash(true);
    s.step({ actions: 0 });
    assert.equal(s.snapshot().encounter.phase, 'aftermath');
    const physicalTick = s.snapshot().ticks,
      combatTick = s.snapshot().encounter.ticks;
    s.pause();
    s.step({ actions: 0 });
    assert.equal(s.snapshot().encounter.ticks, combatTick);
    s.arm();
    s.step({ actions: 0 });
    assert.equal(s.snapshot().ticks, physicalTick);
    assert.equal(s.snapshot().encounter.ticks, combatTick + 1);
    const saved = await s.exportCombatRecovery();
    assert.equal(saved.gameplay.recording.frames.at(-1)[6], 2);
    await s.restoreCombatRecovery(saved);
    assert.equal(s.snapshot().status, 'paused');
  } finally {
    await s.dispose();
  }
});

test('Strike aftermath publishes terminal timeout and never steps a finished encounter', async () => {
  const h = await v2Session({ activity: 'strike' }),
    s = h.session;
  try {
    s.arm();
    s.queueCombatCommand({ payload: true });
    s.step({ actions: 0 });
    h.setCrash(true);
    s.step({ actions: 0 });
    const frozen = s.snapshot().encounter.actors.map((a) => a.position),
      physical = s.snapshot().ticks;
    for (let i = 0; i < 1002 && s.snapshot().status === 'active'; i++) s.step({ actions: 0 });
    assert.equal(s.snapshot().status, 'failed');
    assert.equal(s.snapshot().encounter.result.reason, 'player-defeated');
    assert.equal(s.snapshot().ticks, physical);
    assert.deepEqual(
      s.snapshot().encounter.actors.map((a) => a.position),
      frozen,
    );
    const tick = s.snapshot().encounter.ticks;
    s.step({ actions: 0 });
    assert.equal(s.snapshot().encounter.ticks, tick);
  } finally {
    await s.dispose();
  }
});

test('Strike delayed bomb victory reaches the host result and exposes its selected target', async () => {
  const h = await v2Session({ activity: 'strike' }),
    s = h.session;
  try {
    const objective = s.snapshot().encounter.objectiveTarget;
    assert.ok(objective && objective.kind === 'strike');
    h.geometry.visible = () => true;
    h.geometry.sweepStatic = (from, to, radius) =>
      from.y >= radius && to.y < radius
        ? {
            toi: (from.y - radius) / (from.y - to.y),
            position: { ...to, y: radius },
            normal: { x: 0, y: 1, z: 0 },
            surfaceId: 'floor',
          }
        : null;
    h.setPosition({ ...objective.position, y: objective.position.y + 2500 });
    s.arm();
    s.queueCombatCommand({ payload: true });
    s.step({ actions: 0 });
    h.setCrash(true);
    s.step({ actions: 0 });
    for (let i = 0; i < 200 && s.snapshot().status === 'active'; i++) s.step({ actions: 0 });
    assert.equal(s.snapshot().status, 'complete');
    assert.equal(s.snapshot().encounter.result.reason, 'strike-complete');
    assert.doesNotThrow(() => s.step({ actions: 0 }));
  } finally {
    await s.dispose();
  }
});

test('v2 Start next wave is accepted once, recorded with bit64, and held through rejected physics', async () => {
  const h = await v2Session({
      activity: 'continuous',
      playerDamage: 'invulnerable',
      enemyDamage: 'one-hit',
    }),
    s = h.session;
  try {
    s.arm();
    for (const actor of s.snapshot().encounter.actors.filter((a) => a.type !== 'prop')) {
      h.setContacts([
        { actorId: actor.slotId, normal: { x: 1, y: 0, z: 0 }, relativeNormalSpeedMmS: 20000 },
      ]);
      s.step({ actions: 0 });
    }
    h.setContacts([]);
    assert.equal(s.snapshot().encounter.phase, 'intermission');
    const before = s.snapshot().encounter.nextWaveTick;
    s.nextWave();
    assert.equal(s.snapshot().encounter.nextWaveTick, before);
    h.setAccept(false);
    s.step({ actions: 0 });
    assert.equal(s.snapshot().encounter.wave, 1);
    h.setAccept(true);
    s.step({ actions: 0 });
    assert.equal(s.snapshot().encounter.wave, 2);
    const saved = await s.exportCombatRecovery();
    assert.equal(saved.gameplay.recording.frames.at(-1)[4], 64);
    await s.restoreCombatRecovery(saved);
    assert.equal(s.snapshot().encounter.wave, 2);
  } finally {
    await s.dispose();
  }
});

test('geometry rejection holds aircraft, encounter, recording and commands including aftermath', async () => {
  const h = await v2Session({ activity: 'strike' }),
    s = h.session;
  try {
    s.arm();
    s.queueCombatCommand({ switchWeapon: 1 });
    h.setReady(false);
    s.step({ actions: 0 });
    assert.equal(s.snapshot().ticks, 0);
    assert.equal(s.snapshot().encounter.ticks, 0);
    assert.equal(s.snapshot().encounter.geometryWaiting, true);
    h.setReady(true);
    s.step({ actions: 0 });
    assert.equal(s.snapshot().encounter.weaponIndex, 1);
    s.queueCombatCommand({ payload: true });
    s.step({ actions: 0 });
    h.setCrash(true);
    s.step({ actions: 0 });
    const tick = s.snapshot().encounter.ticks,
      record = s.snapshot().combatRecording.retainedTo;
    h.setReady(false);
    s.step({ actions: 0 });
    assert.equal(s.snapshot().encounter.ticks, tick);
    assert.equal(s.snapshot().combatRecording.retainedTo, record);
    h.setReady(true);
    s.step({ actions: 0 });
    assert.equal(s.snapshot().encounter.ticks, tick + 1);
  } finally {
    await s.dispose();
  }
});

test('v2 recovery rejects command/recording inconsistencies without changing the accepted boundary', async () => {
  const { session: s } = await v2Session();
  try {
    s.arm();
    s.queueCombatCommand({ switchWeapon: 1 });
    s.step({ actions: 0 });
    const original = await s.exportCombatRecovery();
    for (const mutate of [
      (g) => {
        g.session.nextCommandSeq = 1;
      },
      (g) => {
        g.recording.frames[0][4] = 24;
      },
      (g) => {
        g.recording.frames[0][5] = 0;
      },
      (g) => {
        g.recording.frames[0][6] = 2;
      },
    ]) {
      const saved = structuredClone(original);
      mutate(saved.gameplay);
      saved.checksum = dataIdentity(saved.gameplay);
      await assert.rejects(s.restoreCombatRecovery(saved));
      assert.equal(s.snapshot().encounter.lastCommandSeq, 1);
    }
  } finally {
    await s.dispose();
  }
});

async function nativeReplaySession({ definition, runId } = {}) {
  const course = FLIGHT_COURSES[0],
    geometry = createNativeEncounterGeometry(course);
  definition ??= createEncounterDefinition({
    course,
    version: 2,
    activity: 'hunting',
    population: 6,
    playerDamage: 'invulnerable',
    admitActor: geometry.admitActor,
  });
  return createEncounterSession(
    createWorldFlight({
      course: encounterPhysicsCourse(course),
      encounterPhysicsOnly: true,
      unscoredPractice: true,
    }),
    { definition, geometry, runId },
  );
}
async function replayFixture() {
  const session = await nativeReplaySession();
  try {
    session.arm();
    session.queueCombatCommand({ payload: true });
    session.pause(); // An unsent command leaves a valid sequence gap.
    session.arm();
    for (let tick = 0; tick < 125; tick++) {
      if (tick === 3) session.queueCombatCommand({ switchWeapon: 1 });
      if (tick === 50) session.queueCombatCommand({ reload: true });
      if (tick === 90) session.queueCombatCommand({ switchWeapon: 0 });
      session.step({
        roll: 0.00019,
        pitch: -0.00037,
        yaw: 0.00041,
        throttle: 0.00029,
        actions: tick % 15 < 5 ? 1 : 0,
      });
    }
    return await session.exportCombatRecovery();
  } finally {
    await session.dispose();
  }
}
test('v2 native combat replay reproduces quantized radio controls and accepted commands through physical simulation', async () => {
  const saved = await replayFixture();
  assert.equal(saved.gameplay.recording.frames[3][5], 2);
  const proof = await replayEncounterSession(saved, {
    createSession: nativeReplaySession,
    yieldControl: async () => {},
  });
  assert.equal(proof.verified, true);
  assert.equal(proof.practiceOnly, true);
  assert.equal(proof.sessionTicks, 125);
  assert.equal(proof.acceptedTicks, 125);
});
test('v2 replay rejects rewritten accepted controls despite an updated recovery checksum', async () => {
  const saved = await replayFixture();
  saved.gameplay.recording.frames[7][2] = 500;
  saved.checksum = dataIdentity(saved.gameplay);
  await assert.rejects(
    replayEncounterSession(saved, {
      createSession: nativeReplaySession,
      yieldControl: async () => {},
    }),
    /does not reproduce/,
  );
});
test('v2 playback exposes accepted progress and cancellation without continuing rewards', async () => {
  const saved = await replayFixture(),
    abort = new AbortController();
  const playback = await createEncounterPlayback(saved, {
    createSession: nativeReplaySession,
    signal: abort.signal,
  });
  try {
    assert.deepEqual(
      {
        cursor: playback.snapshot().cursor,
        total: playback.snapshot().total,
        verified: playback.snapshot().verified,
      },
      { cursor: 0, total: 125, verified: false },
    );
    assert.equal((await playback.step()).cursor, 1);
    await assert.rejects(playback.finish(), /Complete every recorded interval/);
    abort.abort(new Error('cancelled by viewer'));
    await assert.rejects(playback.step(), /cancelled by viewer/);
    assert.equal(playback.snapshot().cursor, 1);
  } finally {
    await playback.dispose();
  }
});
test('v2 replay rejects truncated recording intervals and a different backend before playback', async () => {
  const saved = await replayFixture();
  const shortened = structuredClone(saved);
  shortened.gameplay.recording.frames.shift();
  shortened.gameplay.recording.retainedFrom = 1;
  shortened.gameplay.recording.segmentStart = 1;
  shortened.checksum = dataIdentity(shortened.gameplay);
  let invoked = false;
  await assert.rejects(
    createEncounterPlayback(shortened, {
      createSession: async () => {
        invoked = true;
      },
    }),
    /no longer contains its beginning/,
  );
  assert.equal(invoked, false);
  let disposed = false;
  await assert.rejects(
    createEncounterPlayback(saved, {
      createSession: async () => ({
        stepRecorded() {},
        exportCombatRecovery() {},
        identity: { wrong: true },
        dispose() {
          disposed = true;
        },
      }),
    }),
    /backend identity differs/,
  );
  assert.equal(disposed, true);
});

test('v2 retains a complete six-minute attempt and rolls only beyond twelve full segments', async () => {
  const course = FLIGHT_COURSES[0],
    geometry = createNativeEncounterGeometry(course);
  const definition = createEncounterDefinition({
    course,
    version: 2,
    activity: 'continuous',
    population: 6,
    playerDamage: 'invulnerable',
    admitActor: geometry.admitActor,
    admitServicePad: geometry.admitServicePad,
  });
  geometry.dispose();
  definition.actors = definition.actors
    .slice(0, 1)
    .map((a) => ({ ...a, path: [], speed: 0, fireEveryTicks: 0 }));
  let physical = {
    position: structuredClone(course.spawn),
    velocity: { x: 0, y: 0, z: 0 },
    orientation: [0, 0, 0, 1000000],
    ticks: 0,
    status: 'paused',
  };
  const session = await createEncounterSession(
    {
      identity: { id: 'v2-retention' },
      snapshot: () => structuredClone(physical),
      configureEncounterActors() {},
      stageEncounterActors() {},
      arm() {
        physical.status = 'active';
      },
      pause() {
        physical.status = 'paused';
      },
      step() {
        physical.ticks++;
      },
      encounterCheckpoint: () => structuredClone(physical),
      restoreEncounterCheckpoint(value) {
        physical = structuredClone(value);
      },
    },
    { definition, geometry: { visible: () => false, sweepStatic: () => null } },
  );
  try {
    session.arm();
    for (let i = 0; i < 18000; i++) session.step({ actions: 0 });
    assert.equal(session.snapshot().combatRecording.complete, true);
    assert.equal(session.snapshot().combatRecording.retainedTo, 18000);
    for (let i = 18000; i < 39017; i++) session.step({ actions: 0 });
    const saved = await session.exportCombatRecovery();
    assert.equal(saved.gameplay.recording.segments.length, 12);
    assert.equal(saved.gameplay.recording.retainedFrom, 3000);
    assert.equal(saved.gameplay.recording.frames.length, 17);
    await session.restoreCombatRecovery(saved);
    assert.equal(session.snapshot().combatRecording.retainedTo, 39017);
    assert.equal(session.snapshot().combatRecording.complete, false);
  } finally {
    await session.dispose();
  }
});

test('optional launch metadata preserves exact regional start while remaining independent of gameplay validity', async () => {
  const session = await nativeReplaySession();
  try {
    const saved = await session.exportCombatRecovery();
    const launch = {
      format: 'FPVCombatLaunch.v1',
      configuration: { response: { rates: 1 } },
      mode: 'acro',
      regional: {
        spawnId: 'start-a',
        savedStart: { position: { x: 1.5, y: 20, z: 3 }, heading: 1200 },
        initialHeading: 'region-centre',
        continuous: true,
        geometryProfile: 'terrain-v1',
      },
    };
    assert.deepEqual(inspectEncounterRecovery({ ...saved, launch }).saved.launch, launch);
    const bad = structuredClone(launch);
    bad.regional.savedStart.heading = -1;
    assert.equal(inspectEncounterRecovery({ ...saved, launch: bad }).saved.launch, null);
    assert.equal(inspectEncounterRecovery(saved).saved.launch, null);
  } finally {
    await session.dispose();
  }
});

test('accepted combat step reuses committed snapshots while public snapshots retain copy isolation', async () => {
  const h = await v2Session();
  await h.session.dispose();
  const runtime = createEncounterRuntime(h.definition, { geometry: h.geometry });
  let physicalReads = 0,
    fullReads = 0,
    commits = 0;
  const session = await createEncounterSession(
    {
      ...h.base,
      snapshot() {
        physicalReads++;
        return h.base.snapshot();
      },
    },
    {
      definition: h.definition,
      geometry: h.geometry,
      runtime: {
        ...runtime,
        snapshot(...args) {
          fullReads++;
          return runtime.snapshot(...args);
        },
        commit(...args) {
          commits++;
          return runtime.commit(...args);
        },
      },
    },
  );
  try {
    session.arm();
    physicalReads = fullReads = commits = 0;
    const accepted = session.step({ actions: 0 });
    assert.equal(accepted.ticks, 1);
    assert.equal(physicalReads, 2, 'only before and after physical copies are needed');
    assert.equal(fullReads, 0, 'the accepted commit already returns the encounter copy');
    assert.equal(commits, 1);
    accepted.actors[0].position.x += 999999;
    const saved = session.snapshot();
    assert.notEqual(saved.actors[0].position.x, accepted.actors[0].position.x);
    saved.encounter.actors[0].appearance.family = 'external-change';
    assert.notEqual(session.snapshot().encounter.actors[0].appearance.family, 'external-change');
  } finally {
    await session.dispose();
  }
});

test('frame views are frozen, reuse one accepted view and avoid full runtime snapshot copies', async () => {
  const h = await v2Session();
  await h.session.dispose();
  const runtime = createEncounterRuntime(h.definition, { geometry: h.geometry });
  let fullReads = 0,
    frameCommits = 0;
  const session = await createEncounterSession(h.base, {
    definition: h.definition,
    geometry: h.geometry,
    runtime: {
      ...runtime,
      snapshot(...args) {
        fullReads++;
        return runtime.snapshot(...args);
      },
      commitFrame(options) {
        frameCommits++;
        return runtime.commitFrame(options);
      },
    },
  });
  try {
    session.arm();
    fullReads = 0;
    const first = session.stepFrame({ actions: 0 });
    assert.equal(first.ticks, 1);
    assert.equal(fullReads, 0);
    assert.equal(frameCommits, 1);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.actors[0].position), true);
    assert.throws(() => {
      first.actors[0].position.x++;
    }, TypeError);
    assert.equal(Object.hasOwn(first.actors[0], 'path'), false);
    const again = session.frameSnapshot();
    assert.equal(again.actors, first.actors);
    assert.equal(fullReads, 0);
    const full = session.snapshot();
    assert.ok(Array.isArray(full.actors[0].path));
    full.actors[0].position.x += 999999;
    assert.notEqual(session.frameSnapshot().actors[0].position.x, full.actors[0].position.x);
    const before = JSON.stringify(first);
    const next = session.stepFrame({ actions: 0 });
    assert.notEqual(next.actors, first.actors);
    assert.equal(JSON.stringify(first), before);
    assert.equal(next.encounter.ticks, 2);
  } finally {
    await session.dispose();
  }
});
