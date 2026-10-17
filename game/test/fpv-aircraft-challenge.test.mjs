import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../data-json.mjs';
import {
  AIRCRAFT_CHALLENGE_RULES,
  validateAircraftChallengeRules,
  validateAircraftChallengeProgress,
  prepareAircraftChallenge,
  createAircraftChallengeProgress,
  withAircraftChallenge,
} from '../../optional-practice/civilian-fpv/aircraft-challenge.mjs';

const timed = (durationTicks = 1500) => ({
  format: AIRCRAFT_CHALLENGE_RULES,
  kind: 'timed-practice',
  durationTicks,
});
const endurance = () => ({
  format: AIRCRAFT_CHALLENGE_RULES,
  kind: 'battery-endurance',
  takeoffHoldTicks: 25,
  landingHoldTicks: 50,
});
const telemetry = (missionTick, grounded = false, usedAh = 0) => ({
  missionTick,
  contact: { grounded },
  usedAh,
});
const configuration = () => ({
  response: { model: 'legacy' },
  camera: { tilt: 20, fov: 90 },
  advanced: {
    aircraft: { format: 'AdvancedAircraft.v2', battery: { capacityAh: 0.45, depletion: false } },
    controller: { p: 1 },
  },
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

function fakeSession(rules, { regional = false, sample = telemetry } = {}) {
  let state = { status: 'prepared', advancedTelemetry: null },
    stepWait = null,
    saveWait = null,
    restoreWait = null,
    failRestore = false;
  const calls = { steps: 0, restores: 0, saves: 0, disposed: 0 };
  const snapshot = () => structuredClone(state);
  return {
    calls,
    snapshot,
    identity: { kind: regional ? 'regional' : 'course' },
    aircraft: () => configuration().advanced.aircraft,
    stepPending: () => false,
    async prepare() {
      state.advancedTelemetry = sample(0);
      return snapshot();
    },
    arm() {
      state.status = 'active';
    },
    pause() {
      state.status = 'paused';
    },
    async step() {
      if (state.status !== 'active') return snapshot();
      calls.steps++;
      await stepWait;
      state.advancedTelemetry = sample(state.advancedTelemetry.missionTick + 1);
      return snapshot();
    },
    async exportRecovery() {
      calls.saves++;
      await saveWait;
      const physical = {
        format: 'AdvancedAircraftSnapshot.v1',
        identity: 'frozen-simulation-identity',
        hash: '01234567',
        checkpoint: { state: structuredClone(state.advancedTelemetry) },
        config: {
          configuration: { challenge: structuredClone(rules) },
          aircraft: { battery: { capacityAh: 0.45, depletion: true } },
        },
      };
      return regional
        ? { format: 'AdvancedRegionalRecovery.v2', simulation: physical }
        : { format: 'AircraftCourseRecovery.v1', physical };
    },
    async restoreRecovery(packet, { signal } = {}) {
      calls.restores++;
      assert.notEqual(state.status, 'active', 'pause before restore');
      await restoreWait;
      signal?.throwIfAborted();
      if (failRestore) throw new Error('Detached physics verification failed');
      state.advancedTelemetry = structuredClone(
        (packet.physical ?? packet.simulation).checkpoint.state,
      );
      state.status = 'prepared';
      return snapshot();
    },
    setStepWait(value) {
      stepWait = value;
    },
    setSaveWait(value) {
      saveWait = value;
    },
    setRestoreWait(value) {
      restoreWait = value;
    },
    setRestoreFailure(value) {
      failRestore = value;
    },
    async dispose() {
      calls.disposed++;
    },
  };
}

test('ordinary practice preserves its exact configuration and session; optional rules are bounded', () => {
  const config = configuration(),
    oldIdentity = dataIdentity(config),
    session = fakeSession(timed());
  assert.equal(prepareAircraftChallenge(config), config);
  assert.equal(prepareAircraftChallenge(config, null), config);
  assert.equal(withAircraftChallenge(session), session);
  assert.equal(withAircraftChallenge(session, { rules: null }), session);
  assert.equal(dataIdentity(config), oldIdentity);
  assert.equal(Object.hasOwn(config, 'challenge'), false);
  for (const invalid of [
    timed(1499),
    timed(1501),
    timed(180001),
    timed(Infinity),
    { ...timed(), format: 'AircraftChallengeRules.v2' },
    { ...timed(), stopFlight: true },
    { ...endurance(), landingHoldTicks: 1 },
    { ...endurance(), kind: 'unlimited' },
  ])
    assert.throws(() => validateAircraftChallengeRules(invalid));
  assert.deepEqual(validateAircraftChallengeRules(timed(180000)), timed(180000));
  assert.deepEqual(validateAircraftChallengeRules(endurance()), endurance());
  assert.throws(() => prepareAircraftChallenge({ response: {} }, timed()), /physical aircraft/);
});

test('explicit endurance clones frozen attempt conditions without overwriting saved battery preferences', () => {
  const config = configuration();
  const prepared = prepareAircraftChallenge(config, endurance());
  assert.equal(prepared.advanced.aircraft.battery.depletion, true);
  assert.equal(config.advanced.aircraft.battery.depletion, false);
  assert.deepEqual(prepared.response, config.response);
  assert.deepEqual(prepared.camera, config.camera);
  prepared.advanced.controller.p = 3;
  assert.equal(config.advanced.controller.p, 1);
  const timedConfig = prepareAircraftChallenge(config, timed());
  assert.equal(timedConfig.advanced.aircraft.battery.depletion, false);
  config.advanced.aircraft.battery.depletion = true;
  assert.equal(prepareAircraftChallenge(config, timed()).advanced.aircraft.battery.depletion, true);
  assert.notEqual(dataIdentity(timedConfig), dataIdentity(prepared));
});

test('timed challenges use accepted mission intervals and freeze results while flight ticks continue', () => {
  const clock = createAircraftChallengeProgress(timed());
  assert.deepEqual(clock.advance(telemetry(0)), clock.snapshot());
  for (let i = 1; i < 1500; i++) clock.advance(telemetry(i));
  assert.equal(clock.snapshot().result, null);
  const before = clock.snapshot();
  clock.advance(telemetry(1499)); // paused, terrain wait, or duplicate worker result
  assert.deepEqual(clock.snapshot(), before);
  assert.throws(() => clock.advance(telemetry(1501)), /intervals are missing/);
  assert.deepEqual(clock.snapshot(), before);
  clock.advance(telemetry(1500));
  const result = clock.snapshot().result;
  assert.deepEqual(result, {
    reason: 'time-elapsed',
    missionTick: 1500,
    elapsedTicks: 1500,
    airborneTicks: 0,
  });
  for (let i = 1501; i <= 2000; i++) clock.advance(telemetry(i));
  assert.equal(clock.snapshot().missionTick, 2000);
  assert.equal(clock.snapshot().elapsedTicks, 1500);
  assert.deepEqual(clock.snapshot().result, result);
  assert.equal(clock.snapshot().scored, false);
  assert.deepEqual(validateAircraftChallengeProgress(clock.snapshot(), timed()), clock.snapshot());
  const longPractice = { ...clock.snapshot(), missionTick: Number.MAX_SAFE_INTEGER - 1 };
  clock.restore(longPractice);
  clock.advance(telemetry(Number.MAX_SAFE_INTEGER));
  assert.equal(clock.snapshot().missionTick, Number.MAX_SAFE_INTEGER);
  assert.equal(clock.snapshot().elapsedTicks, 1500);
  assert.throws(
    () => clock.advance(telemetry(Number.MAX_SAFE_INTEGER + 1)),
    /accepted mission tick/,
  );
});

test('endurance uses complete-aircraft contacts, requires takeoff, and credits airborne intervals only', () => {
  const flight = createAircraftChallengeProgress(endurance(), { capacityAh: 0.45 });
  for (let i = 1; i <= 24; i++) flight.advance({ ...telemetry(i), position: { y: -500 } });
  assert.equal(flight.snapshot().airborneTicks, 0);
  flight.advance(telemetry(25, true)); // a short bounce never starts the objective
  for (let i = 26; i <= 50; i++) flight.advance(telemetry(i));
  assert.equal(flight.snapshot().takeoffTick, 26);
  assert.equal(flight.snapshot().airborneTicks, 25);
  for (let i = 51; i <= 99; i++) flight.advance(telemetry(i, true));
  assert.equal(flight.snapshot().result, null);
  assert.equal(flight.snapshot().airborneTicks, 25);
  flight.advance(telemetry(100));
  assert.equal(flight.snapshot().groundedRunTicks, 0);
  for (let i = 101; i <= 150; i++) flight.advance(telemetry(i, true));
  assert.deepEqual(flight.snapshot().result, {
    reason: 'landed',
    missionTick: 150,
    elapsedTicks: 125,
    airborneTicks: 26,
  });
  assert.deepEqual(
    validateAircraftChallengeProgress(flight.snapshot(), endurance()),
    flight.snapshot(),
  );
  flight.advance(telemetry(151));
  assert.equal(flight.snapshot().airborneTicks, 26);
});

test('actual consumed charge ends endurance, including an exhausted battery before takeoff', () => {
  assert.throws(() => createAircraftChallengeProgress(endurance()), /capacity/);
  const flight = createAircraftChallengeProgress(endurance(), { capacityAh: 0.45 });
  for (let i = 1; i <= 35; i++) flight.advance(telemetry(i, false, i === 35 ? 0.45 : 0.1));
  assert.equal(flight.snapshot().result.reason, 'battery-empty');
  assert.equal(flight.snapshot().result.airborneTicks, 35);
  const grounded = createAircraftChallengeProgress(endurance(), { capacityAh: 0.45 });
  grounded.advance(telemetry(1, true, 0.45));
  assert.equal(grounded.snapshot().result.airborneTicks, 0);
  assert.equal(grounded.snapshot().takeoffTick, null);
  assert.deepEqual(
    validateAircraftChallengeProgress(grounded.snapshot(), endurance()),
    grounded.snapshot(),
  );
  const before = flight.snapshot();
  for (const bad of [
    { missionTick: 36, usedAh: 0.1 },
    telemetry(36, false, -1),
    telemetry(36, false, 0.46),
    telemetry(36, false, NaN),
  ])
    assert.throws(() => flight.advance(bad), /contacts and actual consumed/);
  assert.deepEqual(flight.snapshot(), before);
});

test('bounded progress restore validates counters and cannot change the active clock on failure', () => {
  const rules = endurance(),
    progress = createAircraftChallengeProgress(rules, { capacityAh: 0.45 });
  for (let i = 1; i <= 30; i++) progress.advance(telemetry(i));
  const saved = progress.snapshot();
  const candidate = createAircraftChallengeProgress(rules, { capacityAh: 0.45 });
  assert.deepEqual(candidate.restore(saved), saved);
  for (const bad of [
    { ...saved, rulesIdentity: 'mismatch' },
    { ...saved, scored: true },
    { ...saved, airborneTicks: 31 },
    { ...saved, elapsedTicks: 29 },
    { ...saved, takeoffTick: 0 },
    { ...saved, groundedRunTicks: 50 },
    {
      ...saved,
      result: { reason: 'landed', missionTick: 30, elapsedTicks: 30, airborneTicks: 30 },
    },
    { ...saved, unknown: true },
  ]) {
    assert.throws(() => candidate.restore(bad));
    assert.deepEqual(candidate.snapshot(), saved);
  }
  const timedProgress = createAircraftChallengeProgress(timed());
  assert.throws(() => timedProgress.restore({ ...timedProgress.snapshot(), missionTick: 1500 }));
});

test('session facade keeps flying after the exact timed result and does not count pauses', async () => {
  const base = fakeSession(timed()),
    flight = withAircraftChallenge(base, { rules: timed() });
  await flight.prepare();
  flight.arm();
  for (let i = 0; i < 1501; i++) await flight.step({ throttle: 0.5 });
  assert.equal(flight.snapshot().status, 'active');
  assert.equal(flight.snapshot().challenge.missionTick, 1501);
  assert.equal(flight.snapshot().challenge.result.missionTick, 1500);
  flight.pause();
  await flight.step({ throttle: 1 });
  assert.equal(flight.snapshot().challenge.missionTick, 1501);
  assert.deepEqual(flight.identity, base.identity);
  assert.deepEqual(flight.aircraft(), base.aircraft());
  await flight.dispose();
  await flight.dispose();
  assert.equal(base.calls.disposed, 1);
});

test('duplicate concurrent steps count once and checkpointing waits at the accepted interval boundary', async () => {
  const rules = timed(),
    base = fakeSession(rules),
    flight = withAircraftChallenge(base, { rules }),
    step = deferred(),
    save = deferred();
  await flight.prepare();
  flight.arm();
  base.setStepWait(step.promise);
  base.setSaveWait(save.promise);
  const first = flight.step(),
    second = flight.step(),
    saving = flight.exportRecovery();
  assert.equal(first, second);
  assert.equal(base.calls.steps, 1);
  assert.equal(flight.stepPending(), true);
  step.resolve();
  await first;
  assert.equal(flight.snapshot().challenge.missionTick, 1);
  await flight.step();
  assert.equal(base.calls.steps, 1);
  save.resolve();
  const packet = await saving;
  assert.equal(packet.progress.missionTick, 1);
  assert.equal(packet.session.physical.checkpoint.state.missionTick, 1);
  assert.equal(flight.stepPending(), false);
});

test('course and Regional recovery retain charge and progress; only a fresh session starts again', async () => {
  for (const regional of [false, true]) {
    const rules = endurance(),
      options = { regional, sample: (i) => telemetry(i, false, i * 0.001) },
      base = fakeSession(rules, options),
      flight = withAircraftChallenge(base, { rules, capacityAh: 0.45 });
    await flight.prepare();
    flight.arm();
    for (let i = 0; i < 30; i++) await flight.step();
    const saved = await flight.exportRecovery();
    for (let i = 0; i < 5; i++) await flight.step();
    flight.pause();
    const restored = await flight.restoreRecovery(saved);
    assert.equal(restored.challenge.missionTick, 30);
    assert.equal(restored.challenge.airborneTicks, 30);
    assert.equal(restored.advancedTelemetry.usedAh, 0.03);
    flight.arm();
    await flight.step();
    assert.equal(flight.snapshot().challenge.airborneTicks, 31);
    const fresh = withAircraftChallenge(fakeSession(rules, options), { rules, capacityAh: 0.45 });
    await fresh.prepare();
    assert.equal(fresh.snapshot().challenge.missionTick, 0);
    assert.equal(fresh.snapshot().advancedTelemetry.usedAh, 0);
    await flight.dispose();
    await fresh.dispose();
  }
});

test('mismatched recovery and failed detached verification leave both active progress and charge unchanged', async () => {
  const rules = endurance(),
    base = fakeSession(rules, { sample: (i) => telemetry(i, false, i * 0.001) }),
    flight = withAircraftChallenge(base, { rules, capacityAh: 0.45 });
  await flight.prepare();
  flight.arm();
  for (let i = 0; i < 30; i++) await flight.step();
  const saved = await flight.exportRecovery();
  await flight.step();
  flight.pause();
  const before = flight.snapshot();
  for (const alter of [
    (p) => (p.rules = timed()),
    (p) => (p.progress.missionTick = 100),
    (p) => (p.checksum = 'different'),
    (p) => (p.session.physical.hash = '76543210'),
    (p) => (p.session.physical.config.aircraft.battery.capacityAh = 0.9),
  ]) {
    const bad = structuredClone(saved);
    alter(bad);
    await assert.rejects(flight.restoreRecovery(bad));
    assert.deepEqual(flight.snapshot(), before);
  }
  assert.equal(base.calls.restores, 0);
  base.setRestoreFailure(true);
  await assert.rejects(flight.restoreRecovery(saved), /Detached physics verification failed/);
  assert.deepEqual(flight.snapshot(), before);
  base.setRestoreFailure(false);
  const abort = new AbortController(),
    wait = deferred();
  base.setRestoreWait(wait.promise);
  const restoring = flight.restoreRecovery(saved, { signal: abort.signal });
  await Promise.resolve();
  abort.abort();
  wait.resolve();
  await assert.rejects(restoring, { name: 'AbortError' });
  assert.deepEqual(flight.snapshot(), before);
  await flight.dispose();
});
