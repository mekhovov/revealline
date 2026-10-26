import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createAircraftCourseSession } from '../../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { aircraftPerformance } from '../../optional-practice/civilian-fpv/aircraft-physics.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';

await initAdvancedRuntime();
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
function flight({ id = 'meteor75-analog-2022', mode = 'self-level', backend, frequency } = {}) {
  const preset = createPresetConfiguration(id);
  let simulation;
  const session = createAircraftCourseSession(
    {
      course: FLIGHT_COURSES[0],
      legacy: true,
      mode,
      configuration: {
        response: preset.response,
        advanced: { aircraft: preset.aircraft, controller: preset.controller },
      },
    },
    {
      createClient: () => {
        let owned;
        return {
          async initialize(options) {
            simulation = owned = createAdvancedSimulation({
              ...options,
              ...(backend ? { backend } : {}),
              ...(frequency === undefined ? {} : { frequency }),
            });
            return { telemetry: owned.telemetry(), comparison: owned.comparison() };
          },
          stageTerrainFrame: async (frame) => owned.stageTerrainFrame(frame),
          commitTerrainFrame: async (decision) => owned.commitTerrainFrame(decision),
          step: async (sample, motions) => {
            owned.enqueueInput(sample);
            return owned.stepMission({ motions });
          },
          snapshot: async () => owned.snapshot(),
          telemetry: async () => owned.telemetry(),
          restore: async (saved) => owned.restore(saved),
          dispose: () => owned.dispose(),
        };
      },
    },
  );
  const hover = aircraftPerformance(preset.aircraft).hoverThrottle;
  const command = (state) => {
    const height = state.position.y / 1000,
      climb = state.velocity.y / 1000,
      landing = state.step >= 1;
    return {
      ...neutral,
      throttle:
        landing && (state.grounded || (height < 0.025 && climb < 0.1))
          ? 0
          : Math.max(
              0,
              Math.min(0.65, hover + 0.1 * ((landing ? -0.06 : 1.8) - height) - 0.12 * climb),
            ),
    };
  };
  return { session, command, simulation: () => simulation };
}

test('a fresh centered Academy flight completes the original lift and landing with ordinary controls', async () => {
  const run = flight();
  try {
    await run.session.prepare();
    run.session.arm();
    let peak = 0;
    for (let tick = 0; tick < 500 && run.session.snapshot().step < 2; tick++) {
      const next = await run.session.step(run.command(run.session.snapshot()));
      peak = Math.max(peak, next.position.y / 1000);
    }
    const state = run.session.snapshot();
    assert.ok(peak > 1.2, 'Actual takeoff reaches the unchanged authored hold volume');
    assert.equal(state.step, 2, `Centered landing stalled at ${JSON.stringify(state.position)}`);
    assert.equal(state.grounded, true);
    assert.equal(state.support.id, '$floor');
    assert.equal(state.advancedTelemetry.contact.support.id, 'course-boundary-y-min');
    assert.equal(state.advancedTelemetry.backend, 'civilian-quad-aircraft-regional.v3');
    assert.equal(state.status, 'active', 'Completed practice stays available');
  } finally {
    await run.session.dispose();
  }
});

const historical = JSON.parse(
  await readFile(new URL('./fixtures/fpv-aircraft-contact-v1-v2.json', import.meta.url), 'utf8'),
);
test('pre-change v1/v2 inputs, identities, hashes and raw-contact outcomes stay exact', async (t) => {
  assert.equal(historical.sourceRevision, '3738e7658f54de5e5043cd0daf4222bbc36a8d1d');
  for (const old of historical.cases)
    await t.test(old.backend, async () => {
      const run = flight({ backend: old.backend });
      try {
        await run.session.prepare();
        run.session.arm();
        const hashes = new Map(old.hashes);
        for (const [tick, command] of old.inputs.entries()) {
          await run.session.step(command);
          if (hashes.has(tick + 1))
            assert.equal(run.simulation().stateHash(), hashes.get(tick + 1));
        }
        const state = run.session.snapshot();
        assert.deepEqual(
          JSON.parse(
            JSON.stringify({
              ticks: state.ticks,
              step: state.step,
              position: state.position,
              grounded: state.grounded,
              contact: state.advancedTelemetry.contact,
            }),
          ),
          old.final,
        );
        assert.equal(run.simulation().identity, old.recovery.physical.identity);
      } finally {
        await run.session.dispose();
      }
    });
});

test('all fifteen aircraft complete the unchanged centered Academy lift and landing in both modes', async (t) => {
  const { listAircraftPresets } = await import(
    '../../optional-practice/civilian-fpv/aircraft-presets.mjs'
  );
  assert.equal(listAircraftPresets().length, 15);
  for (const preset of listAircraftPresets())
    for (const mode of ['acro', 'self-level'])
      await t.test(`${preset.id} · ${mode}`, async (child) => {
        const run = flight({ id: preset.id, mode });
        try {
          await run.session.prepare();
          run.session.arm();
          const transitions = [];
          let peak = 0,
            airborne = 0;
          for (let tick = 0; tick < 600 && run.session.snapshot().step < 2; tick++) {
            const previous = run.session.snapshot();
            const next = await run.session.step(run.command(previous));
            peak = Math.max(peak, next.position.y / 1000);
            airborne += next.grounded ? 0 : 1;
            if (next.step !== previous.step) transitions.push([next.step, next.ticks]);
          }
          const state = run.session.snapshot();
          const report = {
            aircraft: preset.id,
            mode,
            backend: state.advancedTelemetry.backend,
            completed: state.step,
            seconds: state.ticks / 50,
            airborneSeconds: airborne / 50,
            peakMetres: peak,
            landingSpeedMps: state.landingSpeed / 1000,
            landingTiltDegrees: state.landingTilt / 100,
            transitions,
            support: state.advancedTelemetry.contact.support?.id ?? null,
          };
          child.diagnostic(JSON.stringify(report));
          assert.equal(state.step, 2, JSON.stringify(report));
          assert.ok(
            peak > 1.2 && airborne > 100,
            'Includes real accepted flight above authored target',
          );
          assert.equal(state.support.id, '$floor');
          assert.equal(report.support, 'course-boundary-y-min');
          assert.ok(state.landingSpeed <= 1100 && state.landingTilt <= 2000);
          assert.deepEqual(
            transitions.map((row) => row[0]),
            [1, 2],
          );
          const ticks = state.ticks;
          await run.session.step(neutral);
          assert.equal(run.session.snapshot().ticks, ticks + 1);
        } finally {
          await run.session.dispose();
        }
      });
});

test('historical recovery is verified by the real worker and continues with its original backend', async (t) => {
  const { createAdvancedWorkerHandler } = await import(
    '../../optional-practice/civilian-fpv/advanced-worker.mjs'
  );
  for (const old of historical.cases)
    await t.test(old.backend, async () => {
      const replies = new Map();
      const handler = createAdvancedWorkerHandler((reply) => replies.set(reply.id, reply));
      let id = 0;
      const request = async (type, fields = {}) => {
        const own = ++id;
        await handler.receive({ id: own, session: 'old-contact', type, ...fields });
        const reply = replies.get(own);
        if (reply.error) throw new Error(reply.error);
        return reply.result;
      };
      try {
        await request('init', { options: old.options });
        await request('restore', { snapshot: old.recovery.physical });
        assert.equal((await request('telemetry')).backend, old.backend);
        for (let tick = old.recovery.mission.state.ticks; tick < old.inputs.length; tick++)
          await request('step', {
            sample: { sequence: tick, timestampUs: tick * 20000, controls: old.inputs[tick] },
          });
        const saved = await request('snapshot');
        assert.equal(saved.hash, old.hashes.at(-1)[1]);
        assert.equal(saved.config.backend, old.backend);
      } finally {
        handler.dispose();
      }
    });
});

test('held native shapes and synthetic stale manifolds isolate contact support boundaries', async (t) => {
  const { default: RAPIER } = await import(
    '../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs'
  );
  const originalPair = RAPIER.World.prototype.contactPair;
  const originalStep = RAPIER.World.prototype.step;
  const originalCreate = RAPIER.World.prototype.createRigidBody;
  const originalQuery = RAPIER.Collider.prototype.contactCollider;
  const preset = createPresetConfiguration('meteor75-analog-2022');
  const h = preset.aircraft.geometry.bodyHalfExtents.y;
  const xExtent = Math.max(
    ...preset.aircraft.geometry.rotors.map(
      (row) => row.position.x + preset.aircraft.geometry.propellerRadius,
    ),
  );
  let rotation = null,
    queries = [],
    tracked = true,
    acceptedPart = null;
  // Deliberately stale broad-phase evidence isolates the fallback's trust
  // boundary. Actual contact distances/normals still come from Rapier shapes;
  // the solver is held so each chosen pose has a known gap/overlap. Full
  // course tests above/below retain native solver steps and ordinary inputs.
  RAPIER.World.prototype.step = function () {};
  RAPIER.World.prototype.contactPair = function (_a, part, callback) {
    if (acceptedPart === 'first') acceptedPart = part.handle;
    if (tracked)
      callback(
        {
          numContacts: () => 1,
          contactDist: () => (part.handle === acceptedPart ? 0.001 : 0.00449),
          normal: () => ({ x: 0, y: 1, z: 0 }),
        },
        false,
      );
  };
  RAPIER.World.prototype.createRigidBody = function (descriptor) {
    const body = originalCreate.call(this, descriptor);
    if (rotation && body.isDynamic()) body.setRotation(rotation, true);
    return body;
  };
  RAPIER.Collider.prototype.contactCollider = function (other, distance) {
    const result = originalQuery.call(this, other, distance);
    queries.push({
      part: other.handle,
      threshold: distance,
      result: result && structuredClone(result),
    });
    return result;
  };
  const cases = [
    { name: 'floor overlap', floor: true, y: h - 0.0001, support: 'floor', normal: [0, 1, 0] },
    {
      name: 'named raised platform',
      y: 0.6 + h - 0.0001,
      obstacles: [{ id: 'platform', min: { x: -1, y: 0.4, z: -1 }, max: { x: 1, y: 0.6, z: 1 } }],
      support: 'platform',
      normal: [0, 1, 0],
    },
    {
      name: 'side wall',
      y: 1,
      obstacles: [
        {
          id: 'wall',
          min: { x: xExtent - 0.00001, y: 0, z: -1 },
          max: { x: xExtent + 0.2, y: 2, z: 1 },
        },
      ],
      support: null,
      normal: [-1, 0, 0],
    },
    {
      name: 'ceiling',
      y: 1,
      obstacles: [
        { id: 'ceiling', min: { x: -1, y: 1 + h - 0.00001, z: -1 }, max: { x: 1, y: 1.2, z: 1 } },
      ],
      support: null,
      normal: [0, -1, 0],
    },
    {
      name: 'stationary positive gap is not support',
      floor: true,
      y: h + 0.0001,
      support: null,
      normal: null,
    },
    {
      name: 'slow rebound within prediction tolerance is not support',
      floor: true,
      y: h + 0.0001,
      velocity: 0.087,
      support: null,
      normal: null,
    },
    { name: 'airborne beyond tolerance', floor: true, y: h + 0.004, support: null, normal: null },
    {
      name: 'separating upward',
      floor: true,
      y: h + 0.001,
      velocity: 0.4,
      support: null,
      normal: null,
    },
    {
      name: 'positive-gap approach is not support',
      floor: true,
      y: h + 0.002,
      velocity: -0.2,
      support: null,
      normal: null,
    },
    {
      name: 'gentle approach at actual overlap',
      floor: true,
      y: h - 0.0001,
      velocity: -0.2,
      support: 'floor',
      normal: [0, 1, 0],
    },
    {
      name: 'fast separation at overlap is touching but not grounded',
      floor: true,
      y: h - 0.0001,
      velocity: 0.4,
      support: 'floor',
      grounded: false,
      normal: [0, 1, 0],
    },
    { name: 'no tracked pair', floor: true, y: h, tracked: false, support: null, normal: null },
  ];
  try {
    for (const row of cases)
      await t.test(row.name, () => {
        queries = [];
        tracked = row.tracked !== false;
        rotation = null;
        const sim = createAdvancedSimulation({
          ...preset,
          floor: row.floor ?? false,
          obstacles: row.obstacles ?? [],
          gravity: { x: 0, y: 0, z: 0 },
          spawn: { x: 0, y: row.y, z: 0 },
          initialVelocity: { x: 0, y: row.velocity ?? 0, z: 0 },
        });
        try {
          sim.stepMission();
          const state = sim.telemetry(),
            contact = state.contact;
          assert.equal(contact.support?.id ?? null, row.support);
          assert.equal(contact.grounded, row.grounded ?? row.support !== null);
          if (row.normal) {
            assert.equal(contact.touching, true);
            assert.ok(
              ['x', 'y', 'z'].reduce(
                (dot, axis, index) => dot + contact.normal[axis] * row.normal[index],
                0,
              ) > 0.99,
              'Current shape normal points away from the surface: ' + JSON.stringify(contact),
            );
          } else assert.equal(contact.touching, false);
          if (tracked) {
            assert.equal(
              new Set(queries.map((query) => query.part)).size,
              5,
              'Queries use all actual body/rotor colliders',
            );
            assert.ok(queries.every((query) => query.threshold === 0.003));
          } else assert.equal(queries.length, 0, 'No extra broad scan without a tracked manifold');
        } finally {
          sim.dispose();
        }
      });
    await t.test('tilted physical hull keeps a world-space supporting normal', () => {
      rotation = { x: Math.sin(0.2 / 2), y: 0, z: 0, w: Math.cos(0.2 / 2) };
      tracked = true;
      const probe = createAdvancedSimulation({ ...preset, floor: false });
      const supportHeight = probe.telemetry().supportHeight;
      probe.dispose();
      const sim = createAdvancedSimulation({
        ...preset,
        floor: true,
        spawn: { x: 0, y: supportHeight - 0.0001, z: 0 },
        gravity: { x: 0, y: 0, z: 0 },
      });
      try {
        sim.stepMission();
        const state = sim.telemetry();
        assert.ok(Math.abs(state.orientation.x) > 0.05, 'Actual body remains tilted');
        assert.equal(state.contact.support?.id, 'floor');
        assert.ok(state.contact.support.normal.y > 0.999);
      } finally {
        sim.dispose();
      }
    });
    await t.test('an accepted manifold part preserves the entire obstacle aggregate', () => {
      rotation = null;
      tracked = true;
      queries = [];
      const sim = createAdvancedSimulation({
        ...preset,
        floor: true,
        spawn: { x: 0, y: h - 0.0001, z: 0 },
      });
      acceptedPart = 'first'; // Capture the first actual body collider passed to the native pair.
      try {
        sim.stepMission();
        assert.equal(sim.telemetry().contact.support?.id, 'floor');
        assert.equal(
          queries.length,
          0,
          'Other stale parts cannot replace valid aggregate evidence',
        );
      } finally {
        acceptedPart = null;
        sim.dispose();
      }
    });
    await t.test('disabled moving actors never supply support or trigger a shape query', () => {
      rotation = null;
      tracked = true;
      queries = [];
      const sim = createAdvancedSimulation({
        ...preset,
        floor: false,
        spawn: { x: 0, y: 0, z: 0 },
        dynamicColliders: [
          {
            id: 'disabled',
            position: { x: 0, y: 0, z: 0 },
            radius: 1,
            height: 2,
            shape: 'sphere',
            enabled: false,
          },
        ],
      });
      try {
        sim.stepMission();
        assert.equal(sim.telemetry().contact.touching, false);
        assert.equal(queries.length, 0);
      } finally {
        sim.dispose();
      }
    });
    await t.test('v1/v2 never call the new query under their existing identities', () => {
      rotation = null;
      tracked = true;
      for (const version of [1, 2]) {
        queries = [];
        const sim = createAdvancedSimulation({
          ...preset,
          backend: `civilian-quad-aircraft.v${version}`,
          floor: true,
          spawn: { x: 0, y: h, z: 0 },
        });
        try {
          sim.stepMission();
          assert.equal(sim.telemetry().contact.grounded, false);
          assert.equal(queries.length, 0);
        } finally {
          sim.dispose();
        }
      }
    });
  } finally {
    RAPIER.World.prototype.contactPair = originalPair;
    RAPIER.World.prototype.step = originalStep;
    RAPIER.World.prototype.createRigidBody = originalCreate;
    RAPIER.Collider.prototype.contactCollider = originalQuery;
  }
});

test('v3 course archives verify full physics and mission tails while old arena worker admissions remain available', async (t) => {
  const { verifyAircraftCourseArchive } = await import(
    '../../optional-practice/civilian-fpv/aircraft-archive-verifier.mjs'
  );
  const { createAdvancedWorkerHandler } = await import(
    '../../optional-practice/civilian-fpv/advanced-worker.mjs'
  );
  const { AIRCRAFT_ARENA_BACKENDS, AIRCRAFT_TERRAIN_BACKENDS } = await import(
    '../../optional-practice/civilian-fpv/advanced-aircraft-runtime.mjs'
  );
  const run = flight(),
    segments = [];
  const size = (value) => Buffer.byteLength(JSON.stringify(value));
  let completed;
  try {
    await run.session.prepare();
    const sim = run.simulation(),
      start = sim.readSealedSegment();
    run.session.arm();
    for (let tick = 0; tick < 600; tick++) {
      await run.session.step(run.command(run.session.snapshot()));
      const state = run.session.snapshot();
      if (state.step === 2 && completed === undefined) completed = state.ticks;
      const read = sim.readSealedSegment(segments.at(-1)?.index ?? -1);
      assert.equal(read.gap, false);
      if (read.segment) segments.push(read.segment);
      if (completed !== undefined && state.ticks > completed + 20) break;
    }
    assert.ok(completed);
    run.session.pause();
    const end = sim.finalizeArchive(segments.at(-1)?.index ?? -1);
    if (end.segment) segments.push(end.segment);
    const first = segments[0],
      last = segments.at(-1);
    const archive = {
      format: 'AircraftArchivePackage.v1',
      manifest: {
        format: 'AircraftSessionArchive.v1',
        id: 'v3-course',
        host: 'academy',
        name: 'Centered landing',
        createdAt: 0,
        revision: segments.length + 1,
        identity: start.identity,
        config: start.config,
        origin: { kind: 'fresh', startTick: 0 },
        state: 'ended',
        firstIndex: first.index,
        lastIndex: last.index,
        startTick: 0,
        endTick: last.endTick,
        segmentCount: segments.length,
        payloadBytes: size(start.config) + segments.reduce((sum, row) => sum + size(row), 0),
        finalHash: last.finalHash,
        scored: false,
      },
      segments,
    };
    const verified = await verifyAircraftCourseArchive(archive, FLIGHT_COURSES[0], {
      collectReference: true,
    });
    assert.equal(verified.physics.verified, true);
    assert.equal(verified.course.verified, true);
    assert.equal(verified.course.completedAtTick, completed);
    assert.equal(verified.course.presentation.completedAtTick, completed);
    assert.equal(verified.course.presentation.path.at(-1)[0], completed);
    assert.ok(last.endTick > completed);
    assert.equal(verified.scored, false);
    const tampered = structuredClone(archive);
    tampered.segments
      .at(-1)
      .events.filter((row) => row[0] === 'input')
      .at(-1)[7] = 1;
    await assert.rejects(
      verifyAircraftCourseArchive(tampered, FLIGHT_COURSES[0]),
      /hash|checkpoint|changed final state/i,
    );
  } finally {
    await run.session.dispose();
  }
  assert.deepEqual(
    AIRCRAFT_ARENA_BACKENDS.map((value) => value.split('.').at(-1)),
    ['v1', 'v2', 'v3'],
  );
  assert.deepEqual(
    AIRCRAFT_TERRAIN_BACKENDS.map((value) => value.split('.').at(-1)),
    ['v1', 'v2', 'v3'],
  );
  for (const backend of AIRCRAFT_ARENA_BACKENDS)
    await t.test(`worker recording ${backend}`, async () => {
      const preset = createPresetConfiguration('meteor75-analog-2022');
      const sim = createAdvancedSimulation({ ...preset, backend });
      const replies = new Map(),
        handler = createAdvancedWorkerHandler((reply) => replies.set(reply.id, reply));
      let id = 0;
      const request = async (type, fields = {}) => {
        const own = ++id;
        await handler.receive({ id: own, session: 'contact-arena', type, ...fields });
        const reply = replies.get(own);
        if (reply.error) throw new Error(reply.error);
        return reply.result;
      };
      try {
        sim.enqueueInput({ sequence: 0, timestampUs: 0, controls: neutral });
        sim.stepMission();
        await request('init', { options: { ...preset, backend } });
        const checked = await request('verify-recording', { recording: sim.recording() });
        assert.equal(checked.verified, true);
        const capabilities = sim.controllerCapabilities();
        assert.equal(
          capabilities.groundIntegralPolicy,
          backend.endsWith('.v1') ? undefined : 'supported-reset.v1',
        );
        assert.throws(
          () => createAdvancedSimulation({ ...preset, backend: 'civilian-quad-aircraft.v99' }),
          /Unsupported aircraft backend/,
        );
      } finally {
        sim.dispose();
        handler.dispose();
      }
    });
});

test('v3 accepted contact, controller, queued input and recording state roll back with rejected mission or terrain intervals', async () => {
  const { createAircraftTerrainFrame } = await import(
    '../../optional-practice/civilian-fpv/aircraft-terrain.mjs'
  );
  const run = flight();
  try {
    await run.session.prepare();
    run.session.arm();
    let airborne = false;
    for (let tick = 0; tick < 500; tick++) {
      const next = await run.session.step(run.command(run.session.snapshot()));
      airborne ||= next.position.y > 1000;
      if (airborne && next.grounded) break;
    }
    const sim = run.simulation();
    assert.equal(sim.telemetry().contact.support?.id, 'course-boundary-y-min');
    const tick = sim.telemetry().missionTick;
    sim.enqueueInput({ sequence: tick, timestampUs: tick * 20000, controls: neutral });
    const before = sim.snapshot();
    const proposal = sim.proposeMission();
    sim.commitMission({ transaction: proposal.transaction, accepted: false });
    assert.deepEqual(sim.snapshot(), before);
    const frame = createAircraftTerrainFrame({
      sourceIdentity: '1122334455667788',
      colliders: before.checkpoint.terrain.colliders,
    });
    const staged = sim.stageTerrainFrame(frame);
    sim.commitTerrainFrame({ transaction: staged.transaction, accepted: false });
    assert.deepEqual(sim.snapshot(), before);
    const accepted = sim.stepMission();
    assert.equal(accepted.telemetry.missionTick, tick + 1);
    assert.equal(accepted.telemetry.consumedSequence, tick);
    assert.equal(accepted.telemetry.backend, 'civilian-quad-aircraft-regional.v3');
  } finally {
    await run.session.dispose();
  }
});

test('a new course session uses v3, restored v2 stays immutable, and a later fresh session uses v3 again', async () => {
  const old = historical.cases.find((row) => row.backend.endsWith('.v2'));
  const run = flight();
  try {
    await run.session.prepare();
    assert.equal(
      run.session.snapshot().advancedTelemetry.backend,
      'civilian-quad-aircraft-regional.v3',
    );
    const currentReference = run.session.referenceIdentity();
    await run.session.restoreRecovery(old.recovery);
    assert.equal(run.session.snapshot().advancedTelemetry.backend, old.backend);
    assert.notDeepEqual(run.session.referenceIdentity(), currentReference);
    assert.equal(run.session.snapshot().status, 'paused');
    assert.deepEqual(
      (await run.session.exportRecovery()).physical.config,
      old.recovery.physical.config,
    );
    run.session.arm();
    for (let tick = 120; tick < 200; tick++) await run.session.step(old.inputs[tick]);
    assert.equal(run.simulation().stateHash(), new Map(old.hashes).get(200));
  } finally {
    await run.session.dispose();
  }
  const fresh = flight();
  try {
    await fresh.session.prepare();
    assert.equal(
      fresh.session.snapshot().advancedTelemetry.backend,
      'civilian-quad-aircraft-regional.v3',
    );
    assert.equal(fresh.session.snapshot().ticks, 0);
  } finally {
    await fresh.session.dispose();
  }
});

test('v3 defaults to qualified 1000 Hz while v1/v2 defaults and explicit timing remain frozen', () => {
  const preset = createPresetConfiguration('meteor75-analog-2022');
  for (const version of [1, 2, 3])
    for (const frequency of [undefined, 250, 500, 1000]) {
      const sim = createAdvancedSimulation({
        ...preset,
        backend: `civilian-quad-aircraft.v${version}`,
        ...(frequency === undefined ? {} : { frequency }),
      });
      try {
        const expected = frequency ?? (version === 3 ? 1000 : 500);
        assert.equal(sim.telemetry().frequency, expected);
        assert.equal(sim.telemetry().missionHz, 50);
        sim.enqueueInput({ sequence: 0, timestampUs: 0, controls: neutral });
        const result = sim.stepMission();
        assert.equal(result.telemetry.substep, expected / 50);
        assert.equal(result.telemetry.seconds, 0.02);
      } finally {
        sim.dispose();
      }
    }
});

test('a fresh 1000 Hz course restores an explicitly recorded v3 500 Hz session unchanged', async () => {
  const source = flight({ frequency: 500 }),
    target = flight();
  try {
    await source.session.prepare();
    await target.session.prepare();
    source.session.arm();
    for (let tick = 0; tick < 12; tick++)
      await source.session.step(source.command(source.session.snapshot()));
    source.session.pause();
    const saved = await source.session.exportRecovery();
    assert.equal(target.simulation().configuration().frequency, 1000);
    await target.session.restoreRecovery(saved);
    assert.equal(target.simulation().configuration().frequency, 500);
    assert.deepEqual((await target.session.exportRecovery()).physical, saved.physical);
    source.session.arm();
    target.session.arm();
    for (let tick = 0; tick < 10; tick++) {
      const command = source.command(source.session.snapshot());
      await source.session.step(command);
      await target.session.step(command);
      assert.equal(target.simulation().stateHash(), source.simulation().stateHash());
    }
  } finally {
    await source.session.dispose();
    await target.session.dispose();
  }
});

test('static course input cursors bind both supported physics schedules to the unchanged 50 Hz clock', async () => {
  const { createStaticCourseInputCursor } = await import(
    '../../optional-practice/civilian-fpv/aircraft-archive-verifier.mjs'
  );
  const segment = (frequency) => [
    {
      startTick: 0,
      endTick: 2,
      events: [
        ['terrain', 0, {}],
        ['input', 0, 0, 0, 0, 0, 0, 0],
        ['input', frequency / 50, 1, 20000, 0, 0, 0, 0],
      ],
    },
  ];
  for (const frequency of [500, 1000]) {
    const cursor = createStaticCourseInputCursor(segment(frequency), frequency);
    assert.equal(cursor.next().tick, 1);
    assert.equal(cursor.next().tick, 2);
    assert.equal(cursor.next(), null);
    const wrong = createStaticCourseInputCursor(segment(frequency === 500 ? 1000 : 500), frequency);
    wrong.next();
    assert.throws(() => wrong.next(), /unsupported-input-schedule/);
  }
  const old = createStaticCourseInputCursor(segment(500));
  old.next();
  assert.equal(old.next().tick, 2);
  assert.throws(
    () => createStaticCourseInputCursor(segment(250), 250),
    /unsupported-input-schedule/,
  );
});
