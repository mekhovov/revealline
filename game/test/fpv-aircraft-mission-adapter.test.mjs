import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalJSON, dataIdentity } from '../data-json.mjs';
import {
  aircraftMissionMotion,
  createAircraftCourseSession,
} from '../../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import { BEGINNER_CATALOGUE } from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import {
  createWorldFlight,
  initWorldRuntime,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createAdvancedWorkerHandler } from '../../optional-practice/civilian-fpv/advanced-worker.mjs';
import {
  AIRCRAFT_CATALOG_REVISION,
  createPresetConfiguration,
  listAircraftPresets,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { aircraftPerformance } from '../../optional-practice/civilian-fpv/aircraft-physics.mjs';
import { withAircraftChallenge } from '../../optional-practice/civilian-fpv/aircraft-challenge.mjs';

const LEGACY = 'aircraft-course-practice.v1';
const CURRENT = 'aircraft-course-practice.v2';
const adapter = (floorHeightMm = 0) => ({ format: 'AircraftCourseMission.v2', floorHeightMm });
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const course = BEGINNER_CATALOGUE.find((entry) => entry.id === 'beginner-01').course;
const configuration = (id = 'meteor75-analog-2022') => {
  const preset = createPresetConfiguration(id);
  return {
    response: preset.response,
    camera: preset.camera,
    advanced: { aircraft: preset.aircraft, controller: preset.controller },
  };
};
const telemetryAt = (height, { grounded = true, id = 'course-boundary-y-min' } = {}) => ({
  position: { x: 0, y: height + 0.02, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
  achievedRates: { roll: 0, pitch: 0, yaw: 0 },
  supportHeight: 0.02,
  contact: {
    grounded,
    impactSpeed: 0.15,
    normal: { x: 0, y: 1, z: 0 },
    support: grounded ? { id, normal: { x: 0, y: 1, z: 0 } } : null,
    ids: [id, 'side-wall'],
    entries: [
      { id, normal: { x: 0, y: 1, z: 0 } },
      { id: 'side-wall', normal: { x: 1, y: 0, z: 0 } },
    ],
  },
});

function createClient() {
  let simulation;
  return {
    async initialize(options) {
      simulation = createAdvancedSimulation(options);
      return { telemetry: simulation.telemetry() };
    },
    async stageTerrainFrame(frame) {
      return simulation.stageTerrainFrame(frame);
    },
    async commitTerrainFrame(decision) {
      return simulation.commitTerrainFrame(decision);
    },
    async step(sample, motions) {
      simulation.enqueueInput(sample);
      return simulation.stepMission({ motions });
    },
    async snapshot() {
      return simulation.snapshot();
    },
    async telemetry() {
      return simulation.telemetry();
    },
    async restore(saved) {
      return simulation.restore(saved);
    },
    dispose() {
      simulation?.dispose();
    },
  };
}

// Exercise the real worker request handler and its recovery verifier, without a
// browser transport or a second unverified direct-simulation restore shortcut.
function createVerifiedClient() {
  const replies = new Map();
  const handler = createAdvancedWorkerHandler((reply) => replies.set(reply.id, reply));
  let sequence = 0;
  async function request(type, values = {}) {
    const id = ++sequence;
    await handler.receive({ id, session: 'mission-adapter-test', type, ...values });
    const result = replies.get(id);
    replies.delete(id);
    if (result.error) throw new Error(result.error);
    return result.result;
  }
  return {
    initialize: (options) => request('init', { options }),
    stageTerrainFrame: (frame) => request('stage-terrain', { frame }),
    commitTerrainFrame: (decision) => request('commit-terrain', { decision }),
    step: (sample, motions) => request('step', { sample, motions }),
    snapshot: () => request('snapshot'),
    telemetry: () => request('telemetry'),
    restore: (snapshot) => request('restore', { snapshot }),
    dispose: () => handler.dispose(),
  };
}
const build = (model = CURRENT, extras = {}, client = createClient) =>
  createAircraftCourseSession(
    { course, mode: 'self-level', configuration: configuration(), model, ...extras },
    { createClient: client, createMission: createWorldFlight },
  );
const reseal = (source) => {
  const saved = structuredClone(source);
  delete saved.checksum;
  return { ...saved, checksum: dataIdentity(saved) };
};

test('v2 maps only confirmed floor support, with an unrounded bounded contact tolerance', () => {
  const sample = telemetryAt(-0.001);
  const old = aircraftMissionMotion(sample, 0.02);
  const current = aircraftMissionMotion(sample, 0.02, adapter());
  assert.equal(old.position.y, -1);
  assert.equal(old.support.id, 'course-boundary-y-min');
  assert.equal(current.position.y, 0);
  assert.equal(current.support.y, 0);
  assert.equal(current.support.id, '$floor');
  for (const field of [
    'velocity',
    'orientation',
    'angular',
    'contacts',
    'landingSpeed',
    'landingTilt',
  ])
    assert.deepEqual(current[field], old[field], field);
  assert.equal(sample.contact.support.id, 'course-boundary-y-min', 'Telemetry is not rewritten');
  for (const floor of [-2000, 0, 2000]) {
    for (const separation of [-0.0029, 0, 0.0029]) {
      const motion = aircraftMissionMotion(
        telemetryAt(floor / 1000 + separation),
        0.02,
        adapter(floor),
      );
      assert.equal(motion.position.y, floor);
      assert.equal(motion.support.y, floor);
    }
    for (const separation of [-0.0031, 0.0031]) {
      const sample = telemetryAt(floor / 1000 + separation);
      assert.equal(
        aircraftMissionMotion(sample, 0.02, adapter(floor)).position.y,
        aircraftMissionMotion(sample, 0.02).position.y,
        'Rounded3mm cannot admit3.1mm',
      );
    }
  }
  for (const height of [-0.003, 0.003]) {
    const edge = telemetryAt(0);
    edge.position.y = height;
    edge.supportHeight = 0;
    assert.equal(aircraftMissionMotion(edge, 0, adapter()).position.y, 0);
  }
  for (const sample of [
    telemetryAt(-0.001, { id: 'landing-platform' }),
    telemetryAt(-0.001, { grounded: false }),
    { ...telemetryAt(-0.001), contact: { ...telemetryAt(-0.001).contact, support: null } },
    {
      ...telemetryAt(-0.001),
      contact: {
        ...telemetryAt(-0.001).contact,
        support: { id: 'course-boundary-y-min', normal: { x: 1, y: 0, z: 0 } },
      },
    },
  ])
    assert.deepEqual(
      aircraftMissionMotion(sample, 0.02, adapter()),
      aircraftMissionMotion(sample, 0.02),
    );
  assert.throws(
    () =>
      aircraftMissionMotion(sample, 0.02, { ...adapter(), format: 'AircraftCourseMission.v99' }),
    /Unsupported/,
  );
});

test('the authored lesson landing predicate rejects raw boundary IDs and accepts mapped floor support only', async () => {
  await initWorldRuntime();
  for (const [descriptor, supportId, expected] of [
    [null, 'course-boundary-y-min', 2],
    [adapter(), 'course-boundary-y-min', 3],
    [adapter(), 'landing-platform', 2],
  ]) {
    const mission = createWorldFlight({
      course,
      mode: 'self-level',
      unscoredPractice: true,
      physicalPractice: true,
      physicalRadius: 56,
    });
    try {
      mission.arm();
      for (const [height, grounded, count] of [
        [0, true, 40],
        [1.4, false, 50],
        [0, true, 60],
      ])
        for (let tick = 0; tick < count; tick++)
          mission.step(neutral, {
            motion: aircraftMissionMotion(
              telemetryAt(height, { grounded, id: supportId }),
              0.02,
              descriptor,
            ),
          });
      assert.equal(mission.snapshot().step, expected);
      assert.equal(mission.snapshot().status, 'active', 'Completed practice continues');
    } finally {
      mission.dispose();
    }
  }
});

test('every catalog aircraft completes ground check, takeoff and soft landing with ordinary controls in both modes', async (t) => {
  await initAdvancedRuntime();
  await initWorldRuntime();
  for (const preset of listAircraftPresets())
    for (const mode of ['self-level', 'acro']) {
      await t.test(`${preset.id} · ${mode}`, async (child) => {
        const settings = configuration(preset.id);
        const session = build(CURRENT, { mode, configuration: settings });
        const report = {
          kind: 'aircraftMissionQualification',
          catalogRevision: AIRCRAFT_CATALOG_REVISION,
          aircraft: preset.id,
          presetRevision: preset.revision,
          mode,
          course: course.id,
          missionModel: session.identity.model,
          passed: false,
        };
        try {
          await session.prepare();
          session.arm();
          const hover = aircraftPerformance(settings.advanced.aircraft).hoverThrottle;
          let airborneTicks = 0,
            maxHeight = 0,
            maxGroundedLandingSpeed = 0,
            maxGroundedLandingTilt = 0;
          const transitions = [];
          for (let tick = 0; tick < 600 && session.snapshot().step < 3; tick++) {
            const state = session.snapshot();
            const height = state.position.y / 1000,
              climb = state.velocity.y / 1000;
            const target = state.step === 1 ? 1.4 : -0.06;
            const throttle =
              state.step === 0 ||
              (state.step >= 2 && (state.grounded || (height < 0.025 && climb < 0.1)))
                ? 0
                : Math.max(0, Math.min(0.65, hover + 0.1 * (target - height) - 0.12 * climb));
            const next = await session.step({ ...neutral, throttle });
            airborneTicks += next.grounded ? 0 : 1;
            maxHeight = Math.max(maxHeight, next.position.y / 1000);
            if (next.step !== state.step)
              transitions.push({ completedObjectives: next.step, seconds: next.ticks / 50 });
            if (state.step >= 2 && next.grounded) {
              maxGroundedLandingSpeed = Math.max(maxGroundedLandingSpeed, next.landingSpeed / 1000);
              maxGroundedLandingTilt = Math.max(maxGroundedLandingTilt, next.landingTilt / 100);
            }
          }
          const result = session.snapshot();
          Object.assign(report, {
            completedObjectives: result.step,
            elapsedSeconds: result.ticks / 50,
            airborneSeconds: airborneTicks / 50,
            maximumHeightMetres: maxHeight,
            maxGroundedLandingSpeedMps: maxGroundedLandingSpeed,
            maxGroundedLandingTiltDegrees: maxGroundedLandingTilt,
            objectiveTransitions: transitions,
            missionSupport: result.support?.id ?? null,
            physicalSupport: result.advancedTelemetry.contact.support?.id ?? null,
            backend: result.advancedTelemetry.backend,
          });
          assert.equal(result.step, 3, `${preset.id}/${mode}: completed authored objectives`);
          assert.equal(result.status, 'active');
          assert.ok(
            airborneTicks > 100 && maxHeight > 1,
            'Includes sustained actual physical flight',
          );
          assert.equal(result.support.id, '$floor');
          assert.ok(result.landingSpeed <= 1500 && result.landingTilt <= 2500);
          assert.ok(maxGroundedLandingSpeed <= 1.5 && maxGroundedLandingTilt <= 25);
          assert.deepEqual(
            transitions.map((entry) => entry.completedObjectives),
            [1, 2, 3],
          );
          assert.equal(result.advancedTelemetry.contact.support.id, 'course-boundary-y-min');
          const tick = result.ticks;
          await session.step(neutral);
          assert.equal(session.snapshot().ticks, tick + 1);
          session.pause();
          const saved = await session.exportRecovery();
          assert.deepEqual(saved.physical.config.configuration.missionAdapter, adapter());
          assert.deepEqual(saved.physical.config.aircraft, settings.advanced.aircraft);
          assert.deepEqual(saved.physical.config.controller, settings.advanced.controller);
          assert.deepEqual(saved.physical.config.response.response, settings.response);
          Object.assign(report, {
            physicsFrequencyHz: saved.physical.config.frequency,
            aircraftIdentity: dataIdentity(saved.physical.config.aircraft),
            controllerIdentity: dataIdentity(saved.physical.config.controller),
            responseIdentity: dataIdentity(saved.physical.config.response.response),
            physicalConfigurationIdentity: saved.physical.identity,
          });
          await session.restoreRecovery(saved);
          assert.equal(session.snapshot().step, 3);
          assert.equal(session.snapshot().status, 'paused');
          report.passed = true;
        } catch (error) {
          report.failure = error.message;
          throw error;
        } finally {
          child.diagnostic(JSON.stringify(report));
          await session.dispose();
        }
      });
    }
});

test('pre-change v1 fixture retains exact raw floor behavior and worker-verified recovery semantics', async (t) => {
  await initAdvancedRuntime();
  await initWorldRuntime();
  const fixture = JSON.parse(
    await readFile(new URL('./fixtures/fpv-aircraft-mission-v1.json', import.meta.url), 'utf8'),
  );
  const old = build(LEGACY);
  const current = build(CURRENT, {}, createVerifiedClient);
  t.after(() => Promise.all([old.dispose(), current.dispose()]));
  await old.prepare();
  await current.prepare();
  const currentBaseline = await current.exportRecovery();
  assert.equal(current.identity, current.identity, 'Identity remains referentially stable');
  old.arm();
  for (const frame of fixture.frames)
    for (let tick = 0; tick < frame.ticks; tick++) await old.step(frame.controls);
  old.pause();
  const historical = await old.exportRecovery();
  assert.deepEqual(historical.identity, fixture.identity);
  assert.equal(historical.physical.hash, fixture.physicalHash);
  assert.equal(historical.physical.identity, fixture.physicalIdentity);
  // This is a saved JSON fixture; JSON represents both signed zeros as0.
  assert.equal(canonicalJSON(historical.mission), canonicalJSON(fixture.mission));
  assert.equal(historical.mission.state.step, 0, 'Historical -1mm ground check is preserved');
  assert.equal(Object.hasOwn(historical.physical.config.configuration, 'missionAdapter'), false);
  await current.restoreRecovery(historical);
  assert.equal(current.identity.model, LEGACY);
  assert.equal(
    canonicalJSON((await current.exportRecovery()).mission),
    canonicalJSON(fixture.mission),
  );
  old.arm();
  current.arm();
  for (let tick = 0; tick < 20; tick++) {
    await old.step(neutral);
    await current.step(neutral);
  }
  old.pause();
  current.pause();
  const continued = await current.exportRecovery();
  const reference = await old.exportRecovery();
  assert.deepEqual(continued.mission, reference.mission);
  assert.equal(continued.physical.hash, reference.physical.hash);
  const mixed = structuredClone(historical);
  mixed.identity.model = CURRENT;
  await assert.rejects(current.restoreRecovery(reseal(mixed)), /identity|configuration/i);
  assert.deepEqual(await current.exportRecovery(), continued, 'Failed restore is atomic');
  mixed.identity.model = 'aircraft-course-practice.v99';
  await assert.rejects(current.restoreRecovery(reseal(mixed)), /configuration/i);
  assert.deepEqual(await current.exportRecovery(), continued);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    current.restoreRecovery(currentBaseline, { signal: controller.signal }),
    /cancelled/,
  );
  assert.deepEqual(await current.exportRecovery(), continued);
  await current.restoreRecovery(currentBaseline);
  assert.equal(current.identity.model, CURRENT);
  const recovered = await current.exportRecovery();
  assert.deepEqual(recovered.identity, currentBaseline.identity);
  assert.equal(recovered.physical.hash, currentBaseline.physical.hash);
  assert.equal(
    canonicalJSON(recovered.physical.checkpoint),
    canonicalJSON(currentBaseline.physical.checkpoint),
  );
  assert.equal(canonicalJSON(recovered.mission), canonicalJSON(currentBaseline.mission));
  assert.deepEqual(recovered.physical.config.configuration.missionAdapter, adapter());
});

test('challenge wrappers forward the accepted restored mission identity', async (t) => {
  await initAdvancedRuntime();
  await initWorldRuntime();
  const rules = {
    format: 'AircraftChallengeRules.v1',
    kind: 'timed-practice',
    durationTicks: 1500,
  };
  const make = (model) => {
    const settings = { ...configuration(), challenge: rules };
    return withAircraftChallenge(build(model, { configuration: settings }), {
      rules,
      capacityAh: settings.advanced.aircraft.battery.capacityAh,
    });
  };
  const old = make(LEGACY),
    current = make(CURRENT);
  t.after(() => Promise.all([old.dispose(), current.dispose()]));
  await old.prepare();
  await current.prepare();
  old.arm();
  await old.step(neutral);
  old.pause();
  await current.restoreRecovery(await old.exportRecovery());
  assert.equal(current.identity.model, LEGACY);
  assert.equal((await current.exportRecovery()).session.identity.model, LEGACY);
});
