import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdvancedRegionalSession } from '../../optional-practice/civilian-fpv/advanced-regional.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  verifyAdvancedRecovery,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  listAircraftPresets,
  createPresetConfiguration,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { DEFAULT_RESPONSE } from '../../optional-practice/civilian-fpv/radio-profile.mjs';
import { createVerifiedFlightGeometry } from '../../optional-practice/civilian-fpv/regional/verified-flight-geometry.mjs';
import { createEnduranceFixture } from '../../authoring/fpv-worlds/regions/endurance-fixture.mjs';
await initAdvancedRuntime();
const fixture = await createEnduranceFixture();
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };

async function sessionFixture(
  t,
  id,
  {
    mode = 'acro',
    response,
    mixed = false,
    transformProposal,
    beforeProposal,
    coverage,
    challenge,
    backend,
  } = {},
) {
  let simulation, options;
  const preset = createPresetConfiguration(id);
  const session = createAdvancedRegionalSession(
    {
      manifest: fixture.terrain.manifest,
      source: fixture.terrain.source,
      ...(mixed ? { geometryProfile: 'terrain-scenery-v1', scenery: fixture.scenery } : {}),
      advanced: { aircraft: preset.aircraft, controller: preset.controller },
      response: response ?? preset.response,
      mode,
      ...(challenge ? { challenge } : {}),
    },
    {
      createClient() {
        let owner;
        return {
          async initialize(next) {
            options = { ...next, ...(backend ? { backend } : {}) };
            owner = simulation = createAdvancedSimulation(options);
            return { telemetry: owner.telemetry() };
          },
          async propose(sample) {
            owner.enqueueInput(sample);
            const proposal = owner.proposeMission();
            await beforeProposal?.();
            return transformProposal ? transformProposal(proposal) : proposal;
          },
          async commit(decision) {
            return owner.commitMission(decision);
          },
          async stageTerrainFrame(frame) {
            return owner.stageTerrainFrame(frame);
          },
          async commitTerrainFrame(decision) {
            return owner.commitTerrainFrame(decision);
          },
          async snapshot() {
            return owner.snapshot();
          },
          async restore(saved) {
            return owner.restore(await verifyAdvancedRecovery(saved));
          },
          async reportPersistence(status) {
            return owner.reportPersistence(status);
          },
          async recording() {
            return owner.recording();
          },
          async readSealedSegment(afterIndex) {
            return owner.readSealedSegment(afterIndex);
          },
          async finalizeArchive(afterIndex) {
            return owner.finalizeArchive(afterIndex);
          },
          dispose() {
            owner?.dispose();
          },
        };
      },
      ...(coverage
        ? {
            createGeometry(...args) {
              const owner = createVerifiedFlightGeometry(...args);
              return {
                ...owner,
                motionCoverage: (...input) => coverage(...input) ?? owner.motionCoverage(...input),
              };
            },
          }
        : {}),
    },
  );
  t.after(() => session.dispose());
  await session.prepare();
  return { session, simulation: () => simulation, options: () => options };
}

test('current Regional host resumes historical v1 recovery and continues with the original solver', async (t) => {
  const historical = await sessionFixture(t, 'meteor75-analog-2022', {
    backend: 'civilian-quad-aircraft-regional.v1',
  });
  const current = await sessionFixture(t, 'meteor75-analog-2022');
  assert.equal(current.simulation().configuration().backend, 'civilian-quad-aircraft-regional.v2');
  historical.session.arm();
  const controls = { ...neutral, throttle: 0.5 };
  for (let tick = 0; tick < 30; tick++) await historical.session.step(controls);
  historical.session.pause();
  const saved = await historical.session.captureRecovery();
  await current.session.restoreRecovery(saved);
  assert.equal(current.session.snapshot().status, 'paused');
  assert.equal(current.simulation().configuration().backend, 'civilian-quad-aircraft-regional.v1');
  assert.equal(current.simulation().stateHash(), historical.simulation().stateHash());
  historical.session.arm();
  current.session.arm();
  for (let tick = 0; tick < 20; tick++) {
    await historical.session.step(controls);
    await current.session.step(controls);
  }
  historical.session.pause();
  current.session.pause();
  const expected = current.simulation().stateHash();
  assert.equal(
    expected,
    historical.simulation().stateHash(),
    'Continuation uses the original solver',
  );
  for (const backend of ['civilian-quad-aircraft-regional.v99', 'civilian-quad-aircraft.v1']) {
    const invalid = structuredClone(saved);
    invalid.simulation.config.backend = backend;
    await assert.rejects(current.session.restoreRecovery(invalid), /backend/);
    assert.equal(current.simulation().stateHash(), expected);
  }
});

test('Regional optional challenge rules remain frozen in worker identity and reject cross-rule recovery', async (t) => {
  const challenge = {
    format: 'AircraftChallengeRules.v1',
    kind: 'timed-practice',
    durationTicks: 1500,
  };
  const ordinary = await sessionFixture(t, 'meteor75-analog-2022');
  const timed = await sessionFixture(t, 'meteor75-analog-2022', { challenge });
  assert.equal(Object.hasOwn(ordinary.options().configuration, 'challenge'), false);
  assert.deepEqual(timed.options().configuration.challenge, challenge);
  assert.notEqual(ordinary.simulation().identity, timed.simulation().identity);
  assert.notDeepEqual(ordinary.simulation().comparison(), timed.simulation().comparison());
  const saved = await timed.session.captureRecovery();
  await assert.rejects(ordinary.session.restoreRecovery(saved), /configuration/);
  assert.equal(ordinary.session.snapshot().ticks, 0);
  await assert.rejects(
    sessionFixture(t, 'meteor75-analog-2022', {
      challenge: { ...challenge, durationTicks: 1 },
    }),
    /duration/,
  );
  await assert.rejects(
    sessionFixture(t, 'meteor75-analog-2022', {
      challenge: {
        format: 'AircraftChallengeRules.v1',
        kind: 'battery-endurance',
        takeoffHoldTicks: 25,
        landingHoldTicks: 50,
      },
    }),
    /requires battery depletion/,
  );
});

test('every aircraft enters Regional practice in Acro and self-level with frozen rates and real dimensions', async (t) => {
  for (const preset of listAircraftPresets())
    for (const mode of ['acro', 'self-level']) {
      const h = await sessionFixture(t, preset.id, { mode });
      assert.equal(h.options().response.mode, mode);
      assert.equal(h.options().aircraft.format, 'AdvancedAircraft.v2');
      assert.equal(h.session.snapshot().mode, mode);
      assert.ok(h.session.snapshot().aircraftRadiusMm > 0);
      assert.ok(h.session.snapshot().aircraftSupportHeightMm > 0);
      assert.equal(h.session.arm(), true);
      const result = await h.session.step({ ...neutral, throttle: 0.3 });
      assert.equal(result.ticks, 1, preset.id);
      assert.equal(result.status, 'active');
      assert.equal(result.advancedTelemetry.usedAh, 0);
      assert.ok(result.recordingStatus);
      await h.session.dispose();
    }
});

test('Regional archive bridge shares accepted boundaries with recovery and exposes each restored generation', async (t) => {
  const h = await sessionFixture(t, 'meteor75-analog-2022');
  const initial = await h.session.readSealedSegment();
  assert.equal(initial.generation, h.session.snapshot().advancedTelemetry.archiveStatus.generation);
  const backgroundRead = h.session.readSealedSegment();
  assert.equal(h.session.arm(), true, 'a background archive read must retain Arm');
  await backgroundRead;
  await h.session.step(neutral);
  assert.throws(() => h.session.finalizeArchive(), /Pause before/);
  const [read, recovery] = await Promise.all([
    h.session.readSealedSegment(),
    h.session.exportRecovery(),
  ]);
  assert.equal(read.format, 'AircraftSealedRead.v1');
  assert.equal(recovery.format, 'AdvancedRegionalRecovery.v2');
  h.session.pause();
  const ending = h.session.finalizeArchive();
  assert.equal(h.session.arm(), false, 'final tail sealing retains its pause guard');
  const final = await ending;
  assert.equal(final.segment.endTick, 1);
  assert.equal(final.finalizedThroughIndex, 0);
  await h.session.restoreRecovery(recovery);
  const first = await h.session.readSealedSegment();
  assert.notEqual(first.generation, initial.generation);
  assert.equal(first.origin.kind, 'checkpoint');
  await h.session.restoreRecovery(recovery);
  assert.notEqual((await h.session.readSealedSegment()).generation, first.generation);
});

test('Regional keeps Legacy input response on the selected aircraft without silent rate replacement', async (t) => {
  const h = await sessionFixture(t, 'meteor75-analog-2022', {
    mode: 'self-level',
    response: DEFAULT_RESPONSE,
  });
  assert.deepEqual(h.options().response.response, DEFAULT_RESPONSE);
  h.session.arm();
  const result = await h.session.step({ ...neutral, roll: 0.5, throttle: 0.4 });
  assert.equal(result.mode, 'self-level');
  assert.equal(result.advancedTelemetry.requestedRates.yaw, 0);
});

test('small and large aircraft land on verified terrain using hull support rather than a sphere', async (t) => {
  for (const id of ['meteor75-analog-2022', 'holybro-x650-v2']) {
    const h = await sessionFixture(t, id);
    h.session.arm();
    let result;
    for (let step = 0; step < 150; step++) {
      result = await h.session.step(neutral);
      if (result.grounded) break;
    }
    assert.equal(result.status, 'active', `${id}: ${result.reason}`);
    assert.equal(
      result.grounded,
      true,
      `${id}: ${JSON.stringify({ position: result.position, velocity: result.velocity, terrain: result.advancedTelemetry.terrain })}`,
    );
    assert.ok(Math.abs(result.position.y) < 10, `${id} bottom ${result.position.y}`);
    assert.ok(result.aircraftSupportHeightMm < result.aircraftRadiusMm);
    h.session.pause();
    const saved = await h.session.captureRecovery();
    assert.equal(saved.format, 'AdvancedRegionalRecovery.v2');
    const restored = await h.session.restoreRecovery(saved);
    assert.equal(restored.ticks, result.ticks);
    assert.equal(restored.grounded, true);
    assert.equal(h.session.arm(), true);
    await h.session.step(neutral);
  }
});

test('rejected Regional aircraft motion restores controller, motors, battery and recordings', async (t) => {
  let reject = false;
  const h = await sessionFixture(t, 'meteor75-analog-2022', {
    coverage() {
      return reject ? { status: 'unknown-cell' } : null;
    },
  });
  h.session.arm();
  await h.session.step({ ...neutral, throttle: 0.5 });
  h.session.pause();
  const before = await h.session.captureRecovery();
  h.session.arm();
  reject = true;
  const result = await h.session.step({ roll: 0.6, pitch: 0.4, yaw: 0.5, throttle: 0.8 });
  assert.equal(result.reason, 'terrain-required');
  const after = await h.session.captureRecovery();
  assert.deepEqual(after.simulation.checkpoint.controller, before.simulation.checkpoint.controller);
  assert.deepEqual(
    after.simulation.checkpoint.state.motorSpeeds,
    before.simulation.checkpoint.state.motorSpeeds,
  );
  assert.equal(after.simulation.checkpoint.state.usedAh, before.simulation.checkpoint.state.usedAh);
  assert.deepEqual(after.simulation.recording, before.simulation.recording);
});

test('Regional validates every substep hull extent and reports real landing tilt', async (t) => {
  const h = await sessionFixture(t, 'meteor75-analog-2022', {
    transformProposal(proposal) {
      return {
        ...proposal,
        trace: proposal.trace.map((p, i) => (i === 1 ? { ...p, supportHeight: NaN } : p)),
      };
    },
  });
  h.session.arm();
  await assert.rejects(h.session.step(neutral), /hull bounds/);
  assert.equal(h.session.snapshot().ticks, 0);
  const tilted = await sessionFixture(t, 'meteor75-analog-2022');
  tilted.session.arm();
  let result;
  for (let step = 0; step < 8; step++)
    result = await tilted.session.step({ ...neutral, roll: 0.8, throttle: 0.5 });
  assert.ok(result.landingTilt > 0);
});

test('Regional live autosave drains the accepted interval without pausing flight; quota errors preserve flying', async (t) => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const h = await sessionFixture(t, 'meteor75-analog-2022', { beforeProposal: () => pending });
  h.session.arm();
  const step = h.session.step({ ...neutral, throttle: 0.4 });
  const saving = h.session.exportRecovery();
  assert.equal(h.session.snapshot().status, 'active');
  release();
  await step;
  const saved = await saving;
  assert.equal(saved.simulation.checkpoint.state.missionTick, 1);
  assert.equal(h.session.snapshot().status, 'active');
  const checkpointOnly = h.session.exportRecovery();
  assert.equal(h.session.stepPending(), true);
  await checkpointOnly;
  assert.equal(h.session.stepPending(), false);
  await h.session.reportPersistence({ savedThroughMission: 1 });
  assert.equal(h.session.snapshot().recordingStatus.lastRecoverableSeconds, 0.02);
  await h.session.reportPersistence({ error: 'QuotaExceededError' });
  assert.equal(h.session.snapshot().recordingStatus.error, 'storage-unavailable');
  const next = await h.session.step({ ...neutral, throttle: 0.4 });
  assert.equal(next.status, 'active');
  assert.equal(next.ticks, 2);
});

test('cancelled Regional file restore leaves the current aircraft and recording intact', async (t) => {
  const h = await sessionFixture(t, 'meteor75-analog-2022');
  h.session.arm();
  await h.session.step({ ...neutral, throttle: 0.4 });
  h.session.pause();
  const saved = await h.session.captureRecovery();
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(h.session.restoreRecovery(saved, { signal: cancelled.signal }), {
    name: 'AbortError',
  });
  assert.deepEqual(await h.session.captureRecovery(), saved);
});
