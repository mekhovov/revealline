import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESPONSE_BENCH_TRACE_LIMIT,
  RESPONSE_BENCH_GATES,
  normalizeBenchConfiguration,
  responseBenchDifferences,
  responseBenchCases,
  createResponseMetrics,
  runResponseCase,
  runResponseComparison,
  responseGainCandidates,
  responseValidationVerdict,
  suggestResponseTune,
  createManualPracticeComparison,
} from '../../optional-practice/civilian-fpv/response-bench.mjs';
import {
  createPresetConfiguration,
  listAircraftPresets,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';

const config = () => createPresetConfiguration('meteor75-analog-2022');
const copy = (v) => structuredClone(v);
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} vs ${b}`);
const healthy = () => ({
  trackingError: 10,
  rmsError: 11,
  riseTimeSeconds: 0.2,
  settlingTimeSeconds: 0.4,
  releaseSettlingTimeSeconds: 0.4,
  overshootRate: 1,
  crossAxisRate: 0.1,
  saturationSeconds: 0.02,
  controlEffort: 0.0001,
  motorActivity: 0.25,
});

test('bench timing follows the current aircraft while explicit historical timing stays frozen', async () => {
  const source = config();
  assert.equal(normalizeBenchConfiguration(source).frequency, 1000);
  assert.equal(normalizeBenchConfiguration(source).backend, 'civilian-quad-aircraft.v3');
  for (const backend of ['civilian-quad-aircraft.v1', 'civilian-quad-aircraft.v2']) {
    const saved = { ...source, backend };
    assert.equal(normalizeBenchConfiguration(saved).frequency, 500);
    const result = await runResponseComparison({ saved, draft: saved });
    assert.equal(result.conditions.backend, backend);
    assert.equal(result.conditions.physicsHz, 500);
    assert.equal(result.baseline.metrics.sampleCount, 1500);
    assert.equal(result.baseline.metrics.resolutionSeconds, 0.002);
    assert.equal(result.gates.timeToleranceSeconds, 0.002);
    assert.deepEqual(result.baseline, result.candidate);
  }
  assert.equal(normalizeBenchConfiguration({ ...source, frequency: 500 }).frequency, 500);
  await assert.rejects(
    runResponseComparison({ saved: source, draft: { ...source, frequency: 500 }, scope: 'setup' }),
    /same backend and fixed frequency/,
  );
  await assert.rejects(
    runResponseComparison({
      saved: { ...source, backend: 'civilian-quad-aircraft.v1' },
      draft: { ...source, frequency: 500 },
      scope: 'setup',
    }),
    /same backend and fixed frequency/,
  );
});

test('one-kilohertz metrics measure one millisecond events and retain the three-second window', () => {
  const accumulator = createResponseMetrics({
    axis: 'roll',
    frequency: 1000,
    testCase: responseBenchCases()[0],
  });
  for (let step = 1; step <= 3000; step++) {
    const active = step > 400 && step <= 1800;
    const requestedRates = { roll: active ? 100 : 0, pitch: 0, yaw: 0 };
    accumulator.add({
      substep: step,
      requestedRates,
      achievedRates: requestedRates,
      motors: [0.5, 0.5, 0.5, 0.5],
      saturated: step === 401,
    });
  }
  const result = accumulator.finish();
  assert.equal(result.physicsHz, 1000);
  assert.equal(result.sampleCount, 3000);
  assert.equal(result.measuredSeconds, 3);
  assert.equal(result.saturationSeconds, 0.001);
  near(result.settlingTimeSeconds, 0.001);
  near(result.releaseSettlingTimeSeconds, 0.001);
  for (const frequency of [500, 1000]) {
    const baseline = { ...healthy(), physicsHz: frequency };
    assert.equal(
      responseValidationVerdict(
        baseline,
        { ...baseline, settlingTimeSeconds: 0.4015 },
        { frequency },
      ).pass,
      frequency === 500,
    );
    assert.equal(
      responseValidationVerdict(
        baseline,
        { ...baseline, physicsHz: frequency === 500 ? 1000 : 500 },
        { frequency },
      ).pass,
      false,
    );
  }
});

test('bench runs the exact historical or current backend and input clock it reports', async () => {
  await initAdvancedRuntime();
  const testCase = responseBenchCases()[0];
  for (const [backend, frequency] of [
    ['civilian-quad-aircraft.v2', 500],
    ['civilian-quad-aircraft.v3', 1000],
  ]) {
    const source = { ...config(), backend, frequency };
    const normalized = normalizeBenchConfiguration(source);
    const sim = createAdvancedSimulation({
      ...normalized,
      recording: false,
      floor: false,
      gravity: { x: 0, y: 0, z: 0 },
      wind: { x: 0, y: 0, z: 0 },
      spawn: { x: 0, y: 0, z: 0 },
      initialVelocity: { x: 0, y: 0, z: 0 },
    });
    try {
      const start = sim.checkpoint();
      assert.equal(sim.telemetry().backend, backend);
      assert.equal(sim.telemetry().frequency, frequency);
      start.state.noiseState = testCase.seed;
      sim.restoreCheckpoint(start);
      for (let tick = 0; tick < 150; tick++) {
        sim.enqueueInput({
          sequence: tick,
          timestampUs: tick * 20000,
          controls: { roll: tick >= 20 && tick < 90 ? 0.35 : 0, pitch: 0, yaw: 0, throttle: 0.5 },
        });
        sim.stepMission();
      }
      const result = await runResponseCase(source, testCase);
      assert.equal(result.finalHash, sim.stateHash());
      assert.equal(result.metrics.sampleCount, frequency * 3);
      assert.equal(result.trace.length, 150);
      assert.equal(result.trace.at(-1).seconds, 3);
    } finally {
      sim.dispose();
    }
  }
});

test('configuration snapshots support effective setups and exclude names while identifying every changed group', () => {
  const before = config(),
    original = copy(before),
    normalized = normalizeBenchConfiguration(before);
  const effective = {
    advanced: { aircraft: before.aircraft, controller: before.controller },
    response: before.response,
    camera: before.camera,
  };
  assert.deepEqual(normalizeBenchConfiguration(effective), normalized);
  before.controller.gains.roll.p *= 2;
  assert.notEqual(before.controller.gains.roll.p, normalized.controller.gains.roll.p);
  assert.ok(Object.isFrozen(normalized.controller.gains.roll));
  const renamed = copy(original);
  renamed.aircraft.id = 'another-name';
  assert.deepEqual(responseBenchDifferences(original, renamed), []);
  const changed = copy(original);
  changed.aircraft.mass *= 1.1;
  changed.controller.gains.roll.p *= 1.1;
  changed.camera.tilt++;
  changed.response.rates.axes.roll.expo++;
  changed.mode = 'self-level';
  assert.deepEqual(responseBenchDifferences(original, changed), [
    'aircraft',
    'rates',
    'controller',
    'camera',
    'assistance',
  ]);
  assert.throws(
    () => normalizeBenchConfiguration({ ...original, frequency: 250 }),
    /fixed 500 or 1000/,
  );
  assert.throws(() =>
    normalizeBenchConfiguration({ ...original, controller: { format: 'Betaflight' } }),
  );
});

test('metrics count brief saturation at every physics step, retain zero and distinguish unreached times', () => {
  const testCase = responseBenchCases()[0];
  const metrics = createResponseMetrics({ axis: 'roll', frequency: 500, testCase });
  const stalled = createResponseMetrics({ axis: 'roll', frequency: 500, testCase });
  for (let step = 1; step <= 1500; step++) {
    const began = (step - 1) / 500,
      active = began >= 0.4 && began < 1.8;
    const requestedRates = { roll: active ? 100 : 0, pitch: 0, yaw: 0 };
    const sample = {
      substep: step,
      requestedRates,
      achievedRates: { ...requestedRates },
      motors: [0.5, 0.5, 0.5, 0.5],
      saturated: step === 201 || step === 202,
    };
    metrics.add(sample);
    stalled.add({ ...sample, achievedRates: { roll: 0, pitch: 0, yaw: 0 } });
  }
  const result = metrics.finish();
  assert.equal(result.sampleCount, 1500);
  assert.equal(result.resolutionSeconds, 0.002);
  assert.equal(result.saturationSeconds, 0.004);
  assert.equal(result.trackingError, 0);
  assert.equal(result.controlEffort, 0);
  assert.equal(result.riseTimeSeconds, 0);
  near(result.settlingTimeSeconds, 0.002);
  near(result.releaseSettlingTimeSeconds, 0.002);
  assert.equal(result.motorActivity, 0.25);
  assert.equal(result.measuredSeconds, 3);
  assert.equal(stalled.finish().riseTimeSeconds, null);
  assert.equal(stalled.finish().settlingTimeSeconds, null);
  assert.throws(() => metrics.add({ substep: 1501 }), /every physics step/);
  const skipped = createResponseMetrics({ axis: 'roll', frequency: 500, testCase });
  assert.throws(() => skipped.add({ substep: 2 }), /every physics step/);
  assert.throws(() => skipped.finish(), /complete test case/);
});

test('zero and missing metrics cannot win through percentages or null coercion', () => {
  const zero = Object.fromEntries(Object.keys(healthy()).map((key) => [key, 0]));
  assert.equal(responseValidationVerdict(zero, zero).pass, true);
  assert.equal(
    responseValidationVerdict(zero, { ...zero, settlingTimeSeconds: 0.004 }).pass,
    false,
  );
  assert.equal(responseValidationVerdict(zero, { ...zero, saturationSeconds: 0.004 }).pass, false);
  assert.equal(responseValidationVerdict(zero, { ...zero, overshootRate: 0.1 }).pass, false);
  assert.equal(responseValidationVerdict(zero, { ...zero, settlingTimeSeconds: null }).pass, false);
  assert.equal(responseValidationVerdict({ ...zero, settlingTimeSeconds: null }, zero).pass, true);
  assert.equal(
    responseValidationVerdict(
      { ...zero, settlingTimeSeconds: null },
      { ...zero, settlingTimeSeconds: null },
    ).pass,
    false,
  );
  const ramp = { ...zero, riseTimeSeconds: null, settlingTimeSeconds: null, overshootRate: null };
  assert.equal(responseValidationVerdict(ramp, ramp, { shape: 'ramp' }).pass, true);
});

test('optional diagnostics leave physical hashes and recordings identical and discard rejected intervals', async () => {
  await initAdvancedRuntime();
  const plain = createAdvancedSimulation(config()),
    observed = createAdvancedSimulation(config());
  try {
    for (let tick = 0; tick < 20; tick++) {
      const input = {
        sequence: tick,
        timestampUs: tick * 20000,
        controls: { roll: tick > 4 ? 0.2 : 0, pitch: 0.04, yaw: 0, throttle: 0.5 },
      };
      plain.enqueueInput(input);
      observed.enqueueInput(input);
      const a = plain.stepMission(),
        b = observed.stepMission({ diagnostics: true });
      assert.equal(a.physicsSamples, undefined);
      assert.equal(b.physicsSamples.length, 20);
      assert.equal(b.physicsHz, 1000);
      assert.equal(plain.stateHash(), observed.stateHash());
      b.physicsSamples[0].achievedRates.roll = 1e20;
      b.physicsSamples[0].motors[0] = 0;
      assert.equal(plain.stateHash(), observed.stateHash());
    }
    assert.deepEqual(plain.recording(), observed.recording());
    const before = observed.stateHash();
    const rejected = observed.stepMission({ diagnostics: true, admitMotion: () => false });
    assert.deepEqual(rejected.physicsSamples, []);
    assert.equal(observed.stateHash(), before);
    assert.throws(() => observed.stepMission({ diagnostics: 'yes' }), /diagnostics/);
  } finally {
    plain.dispose();
    observed.dispose();
  }
});

test('production bench repeats identical trajectories, computes full resolution and bounds presentation traces', async () => {
  const before = config(),
    original = copy(before);
  const result = await runResponseComparison({ saved: before, draft: before, axis: 'roll' });
  assert.deepEqual(before, original);
  assert.deepEqual(result.baseline, result.candidate);
  assert.equal(result.baseline.metrics.physicsHz, 1000);
  assert.equal(result.baseline.metrics.sampleCount, 3000);
  assert.equal(result.conditions.physicsHz, 1000);
  assert.equal(result.conditions.inputHz, 50);
  assert.equal(result.conditions.traceHz, 50);
  assert.equal(result.gates.timeToleranceSeconds, 0.001);
  assert.equal(result.baseline.trace.length, 150);
  assert.ok(result.baseline.trace.length <= RESPONSE_BENCH_TRACE_LIMIT);
  assert.ok(result.baseline.metrics.riseTimeSeconds > 0);
  assert.ok(result.baseline.metrics.trackingError > 0);
  assert.match(result.limitation, /not a real-aircraft tune/);
  const changed = copy(before);
  changed.camera.tilt++;
  await assert.rejects(runResponseComparison({ saved: before, draft: changed }), /complete setups/);
  const complete = await runResponseComparison({ saved: before, draft: changed, scope: 'setup' });
  assert.deepEqual(complete.changedGroups, ['camera']);
  assert.equal(complete.baseline.finalHash, complete.candidate.finalHash);
});

test('every catalog aircraft is supported without changing physical or controller values', async () => {
  for (const preset of listAircraftPresets()) {
    const source = createPresetConfiguration(preset.id),
      original = copy(source);
    const result = await runResponseCase(source, responseBenchCases('yaw')[0], {
      retainTrace: false,
    });
    assert.ok(Number.isFinite(result.metrics.trackingError), preset.id);
    assert.equal(result.metrics.sampleCount, 3000, preset.id);
    assert.deepEqual(result.trace, []);
    assert.deepEqual(source, original);
  }
});

test('noise seeds are deterministic independent cases and cancellation cannot retain a partial result', async () => {
  const noisy = config();
  noisy.aircraft.sensorNoise = 0.02;
  const c = responseBenchCases('pitch')[0];
  const first = await runResponseCase(noisy, c),
    repeat = await runResponseCase(noisy, c);
  assert.deepEqual(first, repeat);
  const changed = await runResponseCase(noisy, { ...c, seed: c.seed + 1 });
  assert.notDeepEqual(first.trace, changed.trace);
  await assert.rejects(runResponseCase(noisy, { ...c, durationSeconds: 999999 }), /unbounded/);
  const aborter = new AbortController();
  const running = runResponseCase(noisy, c, { signal: aborter.signal });
  aborter.abort();
  await assert.rejects(running, { name: 'AbortError' });
});

test('candidate bounds modify exactly one nonzero axis gain and preserve filters and all setup data', () => {
  const source = config();
  source.controller.gains.roll.i = 0;
  const candidates = responseGainCandidates(source);
  assert.equal(candidates.length, 6);
  for (const candidate of candidates) {
    assert.ok(['p', 'd', 'feedforward'].includes(candidate.gain));
    near(candidate.value / candidate.previous, candidate.multiplier);
    assert.ok([0.9, 1.1].includes(candidate.multiplier));
    const restored = copy(candidate.configuration);
    restored.controller.gains.roll[candidate.gain] = candidate.previous;
    assert.deepEqual(restored, normalizeBenchConfiguration(source));
  }
});

function fakeCaseRunner(source, testCase) {
  const original = config();
  const changed = source.controller.gains.roll.p !== original.controller.gains.roll.p;
  const metrics = healthy();
  if (changed && source.controller.gains.roll.p > original.controller.gains.roll.p) {
    metrics.trackingError = 8;
    metrics.rmsError = 9;
  }
  if (testCase.shape === 'ramp') {
    metrics.riseTimeSeconds = metrics.settlingTimeSeconds = metrics.overshootRate = null;
  }
  return Promise.resolve({ testCase, metrics, trace: [], finalHash: 'test' });
}

test('assistant permits only one step of time regression at the actual configured frequency', async () => {
  for (const frequency of [1000, 500]) {
    const source = { ...config(), frequency };
    const result = await suggestResponseTune(
      { draft: source, inputReady: true },
      {
        runCase: async (value, c) => {
          assert.equal(value.frequency, frequency);
          const measured = await fakeCaseRunner(value, c);
          measured.metrics.physicsHz = frequency;
          if (value.controller.gains.roll.p > source.controller.gains.roll.p)
            measured.metrics.releaseSettlingTimeSeconds += 0.0015;
          return measured;
        },
      },
    );
    assert.equal(result.physicsHz, frequency);
    assert.equal(result.gates.timeToleranceSeconds, 1 / frequency);
    assert.equal(result.status, frequency === 500 ? 'suggestions' : 'no-clear-improvement');
  }
});

test('assistant selects a single gain only after independent direction/ramp/throttle/noise validation', async () => {
  const source = config(),
    original = copy(source),
    cases = [];
  const result = await suggestResponseTune(
    { draft: source, inputReady: true },
    {
      runCase: (value, c) => {
        cases.push(c);
        return fakeCaseRunner(value, c);
      },
    },
  );
  assert.equal(result.status, 'suggestions');
  assert.equal(result.evaluatedCandidates, 8);
  assert.equal(result.suggestions.length, 1);
  const suggestion = result.suggestions[0];
  assert.equal(suggestion.gain, 'p');
  assert.equal(suggestion.multiplier, 1.1);
  assert.equal(suggestion.validation.length, 8);
  assert.ok(suggestion.validation.every((entry) => entry.verdict.pass));
  assert.ok(new Set(cases.map((c) => c.seed)).size >= 7);
  assert.ok(cases.some((c) => c.shape === 'ramp' && c.direction === -1));
  assert.ok(cases.some((c) => c.throttle === 0.25));
  assert.ok(cases.some((c) => c.throttle === 0.75));
  assert.ok(cases.some((c) => c.axis === 'pitch'));
  assert.ok(cases.some((c) => c.axis === 'yaw'));
  assert.deepEqual(source, original);
  await assert.rejects(suggestResponseTune({ draft: source }), /calibration/);
});

test('training improvement cannot bypass a regression on any held-out condition', async () => {
  const source = config();
  const result = await suggestResponseTune(
    { draft: source, inputReady: true },
    {
      runCase: async (value, c) => {
        const result = await fakeCaseRunner(value, c);
        if (
          c.id === 'opposite-high' &&
          value.controller.gains.roll.p > source.controller.gains.roll.p
        )
          result.metrics.saturationSeconds = 0.2;
        return result;
      },
    },
  );
  assert.equal(result.status, 'no-clear-improvement');
  assert.deepEqual(result.suggestions, []);
  const zero = config();
  for (const gain of Object.keys(zero.controller.gains.roll)) zero.controller.gains.roll[gain] = 0;
  const none = await suggestResponseTune(
    { draft: zero, inputReady: true },
    { runCase: fakeCaseRunner },
  );
  assert.equal(none.evaluatedCandidates, 0);
  assert.equal(none.status, 'no-clear-improvement');
});

test('assistant cancellation stops evaluation and manual A/B cards never claim identical inputs', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(
    suggestResponseTune(
      { draft: config(), inputReady: true },
      {
        signal: controller.signal,
        runCase: async (...args) => {
          calls++;
          controller.abort();
          return fakeCaseRunner(...args);
        },
      },
    ),
    { name: 'AbortError' },
  );
  assert.equal(calls, 1);
  const changed = config();
  changed.camera.tilt++;
  const card = createManualPracticeComparison(config(), changed, {
    launch: { course: 'hover', spawn: [0, 2, 0], seed: 8 },
    inputConfiguration: { device: 'keyboard', calibration: null },
  });
  assert.equal(card.sameScriptedInputs, false);
  assert.deepEqual(card.changedGroups, ['camera']);
  assert.ok(Object.isFrozen(card.draft));
  assert.throws(() => createManualPracticeComparison(config(), changed), /conditions/);
});

test('settling reports the first following in-band physics endpoint and includes startup disturbances', () => {
  const testCase = responseBenchCases()[0],
    accumulator = createResponseMetrics({ axis: 'roll', frequency: 500, testCase });
  for (let step = 1; step <= 1500; step++) {
    const active = step > 200 && step <= 900;
    const roll = active ? (step <= 300 ? 0 : 100) : step > 900 && step <= 1000 ? 20 : 0;
    accumulator.add({
      substep: step,
      requestedRates: { roll: active ? 100 : 0, pitch: 0, yaw: 0 },
      achievedRates: { roll, pitch: step <= 100 ? 10 : 0, yaw: 0 },
      motors: step <= 100 ? [0.3, 0.7, 0.3, 0.7] : [0.5, 0.5, 0.5, 0.5],
      saturated: step <= 100,
    });
  }
  const result = accumulator.finish();
  near(result.settlingTimeSeconds, 0.202);
  near(result.releaseSettlingTimeSeconds, 0.202);
  near(result.saturationSeconds, 0.2);
  near(result.crossAxisRate, Math.sqrt((100 * 100) / 1500));
  near(result.controlEffort, (100 * 0.04) / 1500);
  near(result.motorActivity, (100 * 0.29 + 1400 * 0.25) / 1500);
  assert.equal(result.measuredSeconds, 3);
});

test('ramp release settling uses the actual ramp peak and requires the full hold duration', () => {
  const testCase = responseBenchCases('roll', { validation: true }).find(
    (c) => c.shape === 'ramp' && c.direction === 1,
  );
  const ramp = createResponseMetrics({ axis: 'roll', frequency: 500, testCase });
  const late = createResponseMetrics({
    axis: 'roll',
    frequency: 500,
    testCase: responseBenchCases()[0],
  });
  for (let step = 1; step <= 1500; step++) {
    const active = step > 200 && step <= 900;
    const requested = active ? (step - 200) / 7 : 0;
    ramp.add({
      substep: step,
      requestedRates: { roll: requested, pitch: 0, yaw: 0 },
      achievedRates: { roll: step > 900 ? 1.5 : requested, pitch: 0, yaw: 0 },
      motors: [0.5, 0.5, 0.5, 0.5],
      saturated: false,
    });
    late.add({
      substep: step,
      requestedRates: { roll: active ? 100 : 0, pitch: 0, yaw: 0 },
      achievedRates: { roll: active ? 100 : step > 900 && step <= 1450 ? 20 : 0, pitch: 0, yaw: 0 },
      motors: [0.5, 0.5, 0.5, 0.5],
      saturated: false,
    });
  }
  assert.equal(ramp.finish().riseTimeSeconds, null);
  near(ramp.finish().releaseSettlingTimeSeconds, 0.002);
  assert.equal(
    late.finish().releaseSettlingTimeSeconds,
    null,
    'only98ms of observed settling is insufficient',
  );
});

test('metric gates are bounded, explicit in their units and reject negative or non-finite evidence', () => {
  assert.equal(RESPONSE_BENCH_GATES.timeToleranceSeconds, 0.001);
  assert.equal(RESPONSE_BENCH_GATES.regression.crossAxisRate.unit, 'degrees/second');
  assert.equal(RESPONSE_BENCH_GATES.regression.motorActivity.unit, 'normalized-speed-squared');
  assert.equal(RESPONSE_BENCH_GATES.regression.controlEffort.absolute, 0.000001);
  assert.ok(Object.isFrozen(RESPONSE_BENCH_GATES.regression.controlEffort));
  for (const field of Object.keys(healthy())) {
    for (const bad of [-0.001, Infinity, NaN, undefined]) {
      assert.equal(
        responseValidationVerdict(healthy(), { ...healthy(), [field]: bad }).pass,
        false,
        field,
      );
      assert.equal(
        responseValidationVerdict({ ...healthy(), [field]: bad }, healthy()).pass,
        false,
        field,
      );
    }
  }
  const zero = Object.fromEntries(Object.keys(healthy()).map((key) => [key, 0]));
  assert.equal(responseValidationVerdict(zero, { ...zero, crossAxisRate: 0.005 }).pass, true);
  assert.equal(responseValidationVerdict(zero, { ...zero, crossAxisRate: 0.005001 }).pass, false);
  assert.equal(responseValidationVerdict(zero, { ...zero, controlEffort: 0.000001 }).pass, true);
  assert.equal(
    responseValidationVerdict(zero, { ...zero, controlEffort: 0.000001001 }).pass,
    false,
  );
  assert.equal(
    responseValidationVerdict(zero, { ...zero, motorActivity: 0.000001001 }).pass,
    false,
  );
});

test('failed candidate simulations are rejected without suppressing valid candidates or swallowing cancellation', async () => {
  const original = config();
  const result = await suggestResponseTune(
    { draft: original, inputReady: true },
    {
      runCase: async (value, c) => {
        if (value.controller.gains.roll.i !== original.controller.gains.roll.i)
          throw new Error('candidate unstable');
        return fakeCaseRunner(value, c);
      },
    },
  );
  assert.equal(result.status, 'suggestions');
  assert.equal(result.failedCases.length, 2);
  assert.ok(result.failedCases.every((c) => c.stage === 'fitting' && c.gain === 'i'));
  assert.equal(result.conditions.seededSensorNoiseEnabled, false);
  assert.equal(result.gates.timeToleranceSeconds, 0.001);
  const failedValidation = await suggestResponseTune(
    { draft: original, inputReady: true },
    {
      runCase: async (value, c) => {
        if (c.shape === 'ramp' && value.controller.gains.roll.p > original.controller.gains.roll.p)
          throw new Error('validation unstable');
        return fakeCaseRunner(value, c);
      },
    },
  );
  assert.equal(failedValidation.status, 'no-clear-improvement');
  assert.equal(failedValidation.failedCases.length, 2);
  await assert.rejects(
    suggestResponseTune(
      { draft: original, inputReady: true },
      {
        runCase: async (value, c) => {
          if (value.controller.gains.roll.p !== original.controller.gains.roll.p)
            throw new DOMException('stop', 'AbortError');
          return fakeCaseRunner(value, c);
        },
      },
    ),
    { name: 'AbortError' },
  );
});
