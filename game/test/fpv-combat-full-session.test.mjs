import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { cpus, platform, arch } from 'node:os';
import { performance } from 'node:perf_hooks';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  verifyAdvancedRecovery,
  validateAdvancedPracticeRecovery,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createAircraftCourseSession } from '../../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import { createAdvancedRegionalSession } from '../../optional-practice/civilian-fpv/advanced-regional.mjs';
import { createEncounterSession } from '../../optional-practice/civilian-fpv/encounter-session.mjs';
import {
  createEncounterDefinition,
  createEncounterRuntime,
  createNativeEncounterGeometry,
  encounterPhysicsCourse,
  validateEncounterDefinition,
} from '../../optional-practice/civilian-fpv/encounter-runtime.mjs';
import { createRegionalEncounterGeometry } from '../../optional-practice/civilian-fpv/encounter-geometry.mjs';
import {
  createWorldFlight,
  initWorldRuntime,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import {
  createRegionalSession,
  regionalReviewEntry,
} from '../../optional-practice/civilian-fpv/regional-session.mjs';
import { WORLD_CATALOGUE } from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { aircraftPerformance } from '../../optional-practice/civilian-fpv/aircraft-physics.mjs';
import { createRadioRuntime } from '../../optional-practice/civilian-fpv/radio-runtime.mjs';
import {
  defaultRadioProfile,
  FIRE_RADIO_FORMAT,
} from '../../optional-practice/civilian-fpv/radio-profile.mjs';
import { createEnduranceFixture } from '../../authoring/fpv-worlds/regions/endurance-fixture.mjs';

await initAdvancedRuntime();
await initWorldRuntime();
const copy = structuredClone;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mm = (v) => Object.fromEntries(['x', 'y', 'z'].map((k) => [k, Math.round(v[k])]));
const acceptedState = (state) => ({ ...state, events: [] });
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const preset = createPresetConfiguration('holybro-x650-v2');
const configuration = {
  response: preset.response,
  camera: preset.camera,
  advanced: { aircraft: preset.aircraft, controller: preset.controller },
};
const hover = aircraftPerformance(preset.aircraft).hoverThrottle;
const reports = [];
const timing = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    meanMs: values.reduce((sum, n) => sum + n, 0) / values.length,
    p50Ms: sorted[Math.floor(sorted.length * 0.5)],
    p95Ms: sorted[Math.floor(sorted.length * 0.95)],
    p99Ms: sorted[Math.floor(sorted.length * 0.99)],
    maxMs: sorted.at(-1),
  };
};

// Uses the production numerical solver and transaction API in-process. Browser
// worker transport, GPU drawing, DOM/layout and operating-system USB are excluded.
function clients() {
  const stats = { accepted: 0, rejected: 0, restores: 0 };
  return {
    stats,
    createClient() {
      let simulation;
      return {
        async initialize(options) {
          simulation = createAdvancedSimulation(options);
          return { telemetry: simulation.telemetry() };
        },
        async stageTerrainFrame(frame) {
          return simulation.stageTerrainFrame(frame);
        },
        async commitTerrainFrame(value) {
          return simulation.commitTerrainFrame(value);
        },
        async propose(sample, motions) {
          simulation.enqueueInput(sample);
          return simulation.proposeMission({ motions });
        },
        async commit(value) {
          stats[value.accepted ? 'accepted' : 'rejected']++;
          return simulation.commitMission(value);
        },
        async step(sample, motions) {
          simulation.enqueueInput(sample);
          return simulation.stepMission({ motions });
        },
        async telemetry() {
          return simulation.telemetry();
        },
        async snapshot() {
          return simulation.snapshot();
        },
        async restore(value) {
          stats.restores++;
          return simulation.restore(await verifyAdvancedRecovery(value));
        },
        async restorePractice(value) {
          stats.restores++;
          return simulation.restore(
            await validateAdvancedPracticeRecovery(value, {
              expectedIdentity: simulation.identity,
            }),
          );
        },
        async recording() {
          return simulation.recording();
        },
        dispose() {
          simulation?.dispose();
        },
      };
    },
  };
}

function radioHarness(session) {
  const profile = defaultRadioProfile();
  profile.format = FIRE_RADIO_FORMAT;
  profile.switches.camera = null;
  profile.switches.fire = { button: 2, threshold: 0.5, invert: false };
  const original = copy(profile);
  const pad = {
    id: profile.device.id,
    index: 0,
    connected: true,
    mapping: '',
    axes: [0.004, 0.004, -1, 0.004, -1, 0, 0, 0],
    buttons: Array.from({ length: 24 }, () => ({ value: 0 })),
  };
  let ticks = 0;
  const runtime = createRadioRuntime({
    getGamepads: () => [pad],
    now: () => ticks * 20,
    onFreeze: () => session.pause(),
  });
  runtime.select(0);
  runtime.setProfile(profile, { restoring: true });
  assert.equal(runtime.verify(), true);
  const raw = (command) => {
    for (const key of ['roll', 'pitch', 'yaw']) {
      const row = profile.channels[key],
        value = command[key] ?? 0;
      const normalized =
        value === 0 ? 0 : Math.sign(value) * (row.deadZone + Math.abs(value) * (1 - row.deadZone));
      pad.axes[row.axis] =
        row.center + normalized * (normalized < 0 ? row.center - row.min : row.max - row.center);
    }
    pad.axes[2] = (command.throttle ?? 0) * 2 - 1;
  };
  function poll(command, fire = true) {
    raw(command);
    pad.buttons[2].value = Number(fire);
    pad.timestamp = ++ticks * 20;
    const normalized = runtime.poll();
    return { ...normalized, actions: runtime.fireHeld() ? 1 : 0 };
  }
  function arm(command = neutral) {
    // An existing saved pickup must match the controls at the paused boundary.
    pad.axes[4] = -1;
    poll(command, false);
    pad.axes[4] = 1;
    poll(command, true);
    assert.equal(runtime.status().active, true, runtime.status().reason);
    assert.equal(runtime.fireHeld(), false, 'held Fire at re-arm must not shoot');
    session.arm();
    poll(command, false);
    assert.equal(runtime.status().fireReady, true);
    assert.deepEqual(
      JSON.parse(runtime.status().profile),
      original,
      'normalized radio profile stays unchanged',
    );
  }
  arm();
  return { runtime, poll, arm, profile: original };
}

// A small authored shooting lane on unchanged shipped geometry makes completion
// deterministic. Every body/route is admitted through the normal geometry API.
function laneDefinition(course, geometry, activity, { airborne = false } = {}) {
  const definition = createEncounterDefinition({
    course,
    activity,
    difficulty: 'easy',
    population: 6,
    seed: 8341,
    admitActor: geometry.admitActor,
  });
  definition.actors = definition.actors.slice(0, 6).map((template, i) => {
    const position = {
      x: course.spawn.x,
      y: airborne ? 800 : 0,
      z: course.spawn.z - 4200 - i * 2400,
    };
    const actor = {
      ...template,
      id: `acceptance-target-${i + 1}`,
      type: 'patrol',
      role: 'hostile',
      position,
      path: [
        { ...position, x: position.x + 200 },
        { ...position, x: position.x - 200 },
      ],
      speed: 300,
      radius: 420,
      height: 2000,
      health: 25,
      fireEveryTicks: 0,
      damage: 0,
      family: 'patroller',
      material: 'organic',
      appearance: { family: 'patroller', cast: 'authored' },
      groundMotion: 'support-v1',
    };
    delete actor.vehicleModel;
    delete actor.shieldHealth;
    const admitted = geometry.admitActor(actor);
    assert.ok(admitted, `lane body ${i} must be admitted`);
    return admitted;
  });
  assert.equal(definition.actors.length, 6);
  return validateEncounterDefinition(definition);
}
function hoverCommand(state, y = 1000) {
  return {
    roll: 0,
    pitch: 0,
    yaw: 0,
    throttle: clamp(hover + (y - state.position.y) / 10000 - state.velocity.y / 6000, 0, 1),
  };
}
async function pauseAndRecover(session, radio, command) {
  radio.runtime.freeze('paused');
  const paused = session.snapshot();
  const before = copy({
    ticks: paused.ticks,
    encounter: acceptedState(paused.encounter),
    position: paused.position,
  });
  for (let i = 0; i < 25; i++) await session.step(radio.poll(command, true));
  assert.deepEqual(
    {
      ticks: session.snapshot().ticks,
      encounter: acceptedState(session.snapshot().encounter),
      position: session.snapshot().position,
    },
    before,
  );
  const start = performance.now(),
    saved = await session.exportCombatRecovery(),
    savedMs = performance.now() - start;
  const restoreStart = performance.now();
  await session.restoreCombatRecovery(saved);
  const restoredMs = performance.now() - restoreStart;
  const restored = session.snapshot();
  assert.equal(restored.ticks, before.ticks);
  assert.deepEqual(acceptedState(restored.encounter), before.encounter);
  assert.deepEqual(restored.encounter.events, [], 'restoration must not replay one-shot effects');
  for (const axis of ['x', 'y', 'z'])
    assert.ok(Math.abs(restored.position[axis] - before.position[axis]) < 0.01);
  assert.equal(restored.status, 'paused');
  radio.arm(command);
  return { saved, saveMs: savedMs, restoreMs: restoredMs };
}

async function runSession(session, { id, ticks, expectedResult, physics, hoverFlight = false }) {
  const radio = radioHarness(session),
    durations = [],
    recoveries = [],
    seenEvents = new Set();
  let maxHeight = -Infinity,
    acceptedEvents = 0,
    command = neutral;
  const started = performance.now();
  for (let index = 0; index < ticks; index++) {
    const before = session.snapshot();
    command = hoverFlight ? hoverCommand(before) : neutral;
    const start = performance.now();
    const state = await session.step(radio.poll(command));
    durations.push(performance.now() - start);
    assert.equal(state.failure ?? null, null);
    assert.equal(state.ticks, index + 1);
    assert.equal(state.encounter.ticks, index + 1);
    assert.ok(Object.values(state.position).every(Number.isFinite));
    maxHeight = Math.max(maxHeight, state.position.y);
    for (const event of state.events) {
      assert.equal(seenEvents.has(event.eventId), false);
      seenEvents.add(event.eventId);
      acceptedEvents++;
    }
    if ([2000, 6000].includes(index + 1))
      recoveries.push(await pauseAndRecover(session, radio, command));
    if (expectedResult && state.status === 'complete') break;
    assert.equal(state.status, 'active');
  }
  const state = session.snapshot();
  if (expectedResult) assert.equal(state.encounter.result?.reason, expectedResult);
  if (expectedResult === 'time-complete') assert.equal(state.encounter.ticks, 9000);
  assert.ok(state.encounter.shots > 0);
  assert.ok(
    state.encounter.kills > 0,
    `expected physical pulse hits: ${JSON.stringify(state.encounter)}`,
  );
  if (hoverFlight) assert.ok(maxHeight > 500, 'real aircraft must take off');
  const finalStart = performance.now(),
    saved = await session.exportCombatRecovery();
  const saveMs = performance.now() - finalStart,
    restoreStart = performance.now();
  await session.restoreCombatRecovery(saved);
  const restoreMs = performance.now() - restoreStart;
  assert.equal(session.snapshot().ticks, state.ticks);
  assert.deepEqual(acceptedState(session.snapshot().encounter), acceptedState(state.encounter));
  assert.deepEqual(
    session.snapshot().encounter.events,
    [],
    'restoration must not duplicate accepted events',
  );
  if (ticks > 12000) {
    assert.equal(saved.gameplay.recording.retainedFrom, Math.floor(ticks / 3000) * 3000 - 9000);
    assert.equal(saved.gameplay.recording.segments.length, 3);
    assert.equal(saved.gameplay.recording.frames.length, ticks % 3000);
    assert.equal(session.snapshot().combatRecording.complete, false);
  }
  const physical = saved.gameplay.physical.simulation ?? saved.gameplay.physical.physical;
  let resumedTick = null;
  if (!expectedResult) {
    radio.arm(command);
    const resumed = await session.step(radio.poll(command));
    assert.equal(resumed.ticks, state.ticks + 1);
    assert.equal(resumed.encounter.ticks, state.encounter.ticks + 1);
    assert.equal(resumed.status, 'active');
    resumedTick = resumed.encounter.ticks;
  }
  const report = {
    id,
    backend: physics,
    simulatedSeconds: state.encounter.ticks / 50,
    acceptedTicks: state.encounter.ticks,
    wallMs: performance.now() - started,
    stepCpu: timing(durations),
    stepWindows: Array.from({ length: Math.ceil(durations.length / 3000) }, (_, index) => ({
      from: index * 3000,
      to: Math.min(durations.length, (index + 1) * 3000),
      ...timing(durations.slice(index * 3000, (index + 1) * 3000)),
    })),
    shots: state.encounter.shots,
    hits: state.encounter.hits,
    kills: state.encounter.kills,
    wave: state.encounter.wave,
    result: state.encounter.result,
    acceptedEvents,
    distinctEvents: seenEvents.size,
    maxHeightMm: maxHeight,
    pauseRecoveryBoundaries: recoveries.map((row) => ({
      tick: row.saved.gameplay.encounter.state.ticks,
      saveMs: row.saveMs,
      restoreMs: row.restoreMs,
    })),
    finalRecovery: {
      saveMs,
      restoreMs,
      bytes: Buffer.byteLength(JSON.stringify(saved)),
      physicalRecording: physical?.recordingStatus ?? null,
      resumedTick,
      retainedFrom: saved.gameplay.recording.retainedFrom,
      retainedTo: state.encounter.ticks,
    },
    profilePreserved: true,
  };
  reports.push(report);
  return report;
}

test(
  'full aircraft hunt completes with real radio pulses, accepted targets, pauses and paired recovery',
  { timeout: 180000 },
  async () => {
    const course = WORLD_CATALOGUE.find((entry) => !entry.legacy).course;
    const geometry = createNativeEncounterGeometry(course),
      definition = laneDefinition(course, geometry, 'hunting');
    const runtime = createEncounterRuntime(definition, { geometry }),
      client = clients();
    const base = createAircraftCourseSession(
      {
        course: encounterPhysicsCourse(course),
        mode: 'self-level',
        configuration,
        encounterActors: runtime.snapshot().actors,
      },
      { createClient: client.createClient, createMission: createWorldFlight },
    );
    const session = await createEncounterSession(base, { definition, geometry, runtime });
    try {
      await session.prepare();
      const result = await runSession(session, {
        id: 'native-aircraft-full-hunt',
        ticks: 9000,
        expectedResult: 'time-complete',
        physics: 'aircraft-500Hz/native',
        hoverFlight: true,
      });
      assert.equal(client.stats.accepted, 9000);
      result.workerTransactions = client.stats;
    } finally {
      await session.dispose();
    }
  },
);

test(
  'finite native elimination clears every required target via actual radio shots',
  { timeout: 60000 },
  async () => {
    const course = WORLD_CATALOGUE.find((entry) => !entry.legacy).course;
    const geometry = createNativeEncounterGeometry(course),
      definition = laneDefinition(course, geometry, 'elimination');
    const base = createWorldFlight({
      course: encounterPhysicsCourse(course),
      mode: 'self-level',
      encounterPhysicsOnly: true,
      unscoredPractice: true,
    });
    const session = await createEncounterSession(base, { definition, geometry });
    try {
      const result = await runSession(session, {
        id: 'native-standard-elimination',
        ticks: 2000,
        expectedResult: 'targets-cleared',
        physics: 'standard/native',
      });
      assert.equal(result.kills, 6);
    } finally {
      await session.dispose();
    }
  },
);

test(
  'regional aircraft continuous session rolls combat history while radio, physics and recovery stay active',
  { timeout: 240000 },
  async () => {
    const fixture = await createEnduranceFixture(),
      client = clients();
    // This starts safely on the flat course, with sufficient negative-Z space for the authored lane.
    const spawn = { x: 64000, y: 1000, z: 30000 };
    const manifest = copy(fixture.terrain.manifest);
    manifest.spawns[0].position = spawn;
    const base = createAdvancedRegionalSession(
      { manifest, source: fixture.terrain.source, mode: 'self-level', ...configuration },
      { createClient: client.createClient },
    );
    await base.prepare();
    const entry = regionalReviewEntry({ manifest, source: fixture.terrain.source });
    const geometry = createRegionalEncounterGeometry(base.encounterGeometry(), {
      bounds: entry.course.bounds,
      player: base.snapshot(),
    });
    const course = { ...entry.course, bounds: geometry.area, spawn: mm(base.snapshot().position) };
    const definition = laneDefinition(course, geometry, 'continuous'),
      runtime = createEncounterRuntime(definition, { geometry });
    const session = await createEncounterSession(base, {
      definition,
      geometry,
      runtime,
      regional: true,
    });
    try {
      const result = await runSession(session, {
        id: 'regional-aircraft-continuous-retention',
        ticks: 36017,
        physics: 'aircraft-500Hz/regional',
        hoverFlight: true,
      });
      assert.equal(client.stats.accepted, 36018);
      assert.ok(result.wave > 1);
      assert.ok(result.finalRecovery.physicalRecording.retainedFromSeconds > 0);
      assert.equal(result.finalRecovery.physicalRecording.state, 'recording');
      assert.equal(result.finalRecovery.resumedTick, 36018);
      result.workerTransactions = client.stats;
    } finally {
      await session.dispose();
    }
  },
);

test(
  'regional radio return flight crosses real terrain boundaries and preserves the frozen encounter',
  { timeout: 120000 },
  async () => {
    const fixture = await createEnduranceFixture();
    const base = createRegionalSession({
      manifest: fixture.terrain.manifest,
      source: fixture.terrain.source,
      mode: 'self-level',
    });
    await base.prepare();
    const entry = regionalReviewEntry({
      manifest: fixture.terrain.manifest,
      source: fixture.terrain.source,
    });
    const geometry = createRegionalEncounterGeometry(base.encounterGeometry(), {
      bounds: entry.course.bounds,
      player: base.snapshot(),
    });
    const definition = createEncounterDefinition({
      course: { ...entry.course, bounds: geometry.area, spawn: mm(base.snapshot().position) },
      activity: 'hunting',
      population: 6,
      difficulty: 'easy',
      seed: 815,
      admitActor: geometry.admitActor,
    });
    const session = await createEncounterSession(base, { definition, geometry, regional: true });
    const radio = radioHarness(session),
      durations = [];
    const targetX = 160000;
    let crossed = false,
      outside = null,
      frozen = null,
      command = neutral,
      maxX = -Infinity,
      streamWaits = 0;
    const started = performance.now();
    try {
      for (let tick = 0; tick < 6000; tick++) {
        const before = session.snapshot();
        const target = crossed ? definition.spawn.x : targetX;
        const roll = clamp(
          (target - before.position.x) / 180000 - before.velocity.x / 18000,
          -0.3,
          0.3,
        );
        command = {
          roll,
          pitch: 0,
          yaw: 0,
          throttle: clamp(
            0.5 +
              (20000 - before.position.y) / 140000 -
              before.velocity.y / 24000 +
              Math.abs(roll) * 0.015,
            0.2,
            0.8,
          ),
        };
        const start = performance.now(),
          state = await session.step(radio.poll(command));
        durations.push(performance.now() - start);
        maxX = Math.max(maxX, state.position.x);
        if (state.encounter.outsideArea && !outside) {
          outside = { ticks: state.ticks, position: copy(state.position) };
          frozen = acceptedState(state.encounter);
          delete frozen.outsideArea;
          delete frozen.returning;
          assert.equal(state.status, 'paused');
          radio.runtime.freeze('outside-encounter');
          session.returnToEncounter();
          radio.arm(command);
        }
        if (state.encounter.outsideArea) {
          const now = acceptedState(state.encounter);
          delete now.outsideArea;
          delete now.returning;
          assert.deepEqual(
            now,
            frozen,
            'the combat clock, actors, projectiles and scoring freeze outside',
          );
        }
        if (!crossed && state.position.x >= 150000) crossed = true;
        if (crossed && !state.encounter.outsideArea) {
          assert.equal(
            state.status,
            'paused',
            'return pauses before player explicitly resumes combat',
          );
          assert.ok(
            state.recentres >= 2,
            'actual outward and inward cell crossings recenter the world',
          );
          const recoveryStart = performance.now(),
            saved = await session.exportCombatRecovery();
          await session.restoreCombatRecovery(saved);
          assert.equal(session.snapshot().ticks, state.ticks);
          assert.equal(session.snapshot().recentres, state.recentres);
          reports.push({
            id: 'regional-standard-radio-boundary-return',
            backend: 'standard/regional',
            simulatedFlightSeconds: state.ticks / 50,
            acceptedFlightTicks: state.ticks,
            acceptedCombatTicks: state.encounter.ticks,
            recentres: state.recentres,
            maxXMm: maxX,
            outsideBoundary: outside,
            returnedPosition: state.position,
            wallMs: performance.now() - started,
            stepCpu: timing(durations),
            restoreBoundaryMs: performance.now() - recoveryStart,
            terrainRequests: fixture.terrain.requests(),
            streamWaits,
            frozenCombatPreserved: true,
            profilePreserved: true,
          });
          return;
        }
        if (
          state.status === 'paused' &&
          !state.encounter.outsideArea &&
          state.reason !== 'prepared'
        ) {
          streamWaits++;
          await base.prepare();
          radio.runtime.freeze('terrain');
          radio.arm(command);
        }
        // Allow the production resident-window preparation job to commit between frames.
        if (tick % 20 === 0) await new Promise((resolve) => setImmediate(resolve));
      }
      assert.fail(
        `return flight did not finish: ${JSON.stringify({ state: session.snapshot().position, maxX, crossed, outside, reason: session.snapshot().reason })}`,
      );
    } finally {
      await session.dispose();
    }
  },
);

test.after(async () => {
  if (process.env.FPV_COMBAT_ACCEPTANCE_OUTPUT)
    await writeFile(
      process.env.FPV_COMBAT_ACCEPTANCE_OUTPUT,
      JSON.stringify(
        {
          format: 'FPVCombatFullSessionAcceptance.v1',
          measuredAt: new Date().toISOString(),
          environment: {
            node: process.version,
            platform: platform(),
            architecture: arch(),
            cpu: cpus()[0]?.model,
          },
          measurement:
            'Full production session/solver/radio CPU path in-process; excludes browser renderer, worker transport, DOM and physical USB.',
          runs: reports,
        },
        null,
        2,
      ) + '\n',
    );
});
