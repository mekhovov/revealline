import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
} from '../../game/data-json.mjs';
import { validateAircraftPhysics, validateAircraftControllerTune } from './aircraft-physics.mjs';
import {
  createAircraftResponseDescriptor,
  createAircraftResponseEvaluator,
  validateAircraftResponseDescriptor,
} from './aircraft-response.mjs';
import { createAdvancedSimulation, initAdvancedRuntime } from './advanced-simulation.mjs';

export const RESPONSE_BENCH_FORMAT = 'FpvResponseBench.v1';
export const RESPONSE_BENCH_HZ = 500;
export const RESPONSE_BENCH_TRACE_LIMIT = 152;
export const RESPONSE_BENCH_LIMITATION =
  'Controlled Acro response rig with no gravity or contacts. These measurements describe the SIM model, not a real-aircraft tune.';
const AXES = ['roll', 'pitch', 'yaw'];
const GAINS = ['p', 'i', 'd', 'feedforward'];
const copy = (value) => structuredClone(value);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const abort = () => new DOMException('Simulation comparison cancelled.', 'AbortError');
const checkAbort = (signal) => {
  if (signal?.aborted) throw abort();
};
const freeze = (value) => {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};
export const RESPONSE_BENCH_GATES = freeze({
  minimumTrackingImprovement: { absolute: 0.005, relative: 0.005, unit: 'degrees/second' },
  regression: {
    trackingError: { absolute: 0.005, relative: 0.005, unit: 'degrees/second' },
    rmsError: { absolute: 0.005, relative: 0.005, unit: 'degrees/second' },
    overshootRate: { absolute: 0.01, relative: 0.01, unit: 'degrees/second' },
    crossAxisRate: { absolute: 0.005, relative: 0.01, unit: 'degrees/second' },
    controlEffort: { absolute: 0.000001, relative: 0.01, unit: 'normalized-speed-squared' },
    motorActivity: { absolute: 0.000001, relative: 0.01, unit: 'normalized-speed-squared' },
  },
  timeToleranceSeconds: 1 / RESPONSE_BENCH_HZ,
  settlingBand: { absoluteRate: 1, relative: 0.02, minimumHoldSeconds: 0.1 },
  measuredWindow: 'entire-three-second-case',
  unavailableTimePolicy: 'A candidate must reach the target; an unreached time never equals zero.',
});

/** Copies only the validated simulation inputs. Names, library IDs and receipts
 * are deliberately excluded; workers never consult a mutable setup library. */
export function normalizeBenchConfiguration(source) {
  const value = boundedJSON(source, { maxBytes: 128 * 1024, maxNodes: 5000, maxDepth: 20 });
  const aircraft = validateAircraftPhysics(value.aircraft ?? value.advanced?.aircraft),
    controller = validateAircraftControllerTune(value.controller ?? value.advanced?.controller);
  const response =
    value.response?.format === 'AircraftResponse.v1'
      ? validateAircraftResponseDescriptor(value.response)
      : createAircraftResponseDescriptor(value.response, { mode: value.mode ?? 'acro' });
  const camera = value.camera ?? { tilt: 10, verticalFov: 82 };
  required(
    finite(camera.tilt) &&
      camera.tilt >= -90 &&
      camera.tilt <= 90 &&
      finite(camera.verticalFov) &&
      camera.verticalFov >= 30 &&
      camera.verticalFov <= 140,
    'Invalid comparison camera',
  );
  required(
    value.frequency === undefined || value.frequency === RESPONSE_BENCH_HZ,
    'The response bench uses the fixed 500 Hz aircraft backend',
  );
  // The name of a reference aircraft is not a physical difference.
  aircraft.id = 'response-bench-aircraft';
  return freeze({
    aircraft,
    controller,
    response,
    camera: { tilt: camera.tilt, verticalFov: camera.verticalFov },
    frequency: RESPONSE_BENCH_HZ,
  });
}

export function responseBenchDifferences(saved, draft) {
  const before = normalizeBenchConfiguration(saved),
    after = normalizeBenchConfiguration(draft);
  return [
    ['aircraft', before.aircraft, after.aircraft],
    ['rates', before.response.response, after.response.response],
    ['controller', before.controller, after.controller],
    ['camera', before.camera, after.camera],
    [
      'assistance',
      { mode: before.response.mode, levelGain: before.response.levelGain },
      { mode: after.response.mode, levelGain: after.response.levelGain },
    ],
  ]
    .filter(([, a, b]) => !same(a, b))
    .map(([group]) => group);
}

function validateAxis(axis) {
  required(AXES.includes(axis), 'Choose roll, pitch or yaw for the response bench');
  return axis;
}
function makeCase(
  axis,
  {
    id = 'step-release',
    shape = 'step',
    direction = 1,
    throttle = 0.5,
    seed = 0x52ca31,
    stick = 0.35,
  } = {},
) {
  return freeze({
    id,
    axis: validateAxis(axis),
    shape,
    direction,
    throttle,
    seed,
    stick,
    startSeconds: 0.4,
    releaseSeconds: 1.8,
    durationSeconds: 3,
  });
}
function validateCase(source) {
  const value = boundedJSON(source, { maxBytes: 2048, maxNodes: 24, maxDepth: 2 });
  exactKeys(
    value,
    [
      'id',
      'axis',
      'shape',
      'direction',
      'throttle',
      'seed',
      'stick',
      'startSeconds',
      'releaseSeconds',
      'durationSeconds',
    ],
    'Response test case',
  );
  validateAxis(value.axis);
  required(
    typeof value.id === 'string' &&
      value.id.length > 0 &&
      value.id.length <= 80 &&
      ['step', 'ramp'].includes(value.shape) &&
      [-1, 1].includes(value.direction) &&
      finite(value.throttle) &&
      value.throttle >= 0 &&
      value.throttle <= 1 &&
      finite(value.stick) &&
      value.stick > 0 &&
      value.stick <= 1 &&
      Number.isSafeInteger(value.seed) &&
      value.seed > 0 &&
      value.seed <= 0xffffffff &&
      value.startSeconds === 0.4 &&
      value.releaseSeconds === 1.8 &&
      value.durationSeconds === 3,
    'Invalid or unbounded response test case',
  );
  return value;
}
export function responseBenchCases(axis = 'roll', { validation = false } = {}) {
  validateAxis(axis);
  if (!validation) return [makeCase(axis)];
  return [
    makeCase(axis, { id: 'opposite-low', direction: -1, throttle: 0.25, seed: 0x71937 }),
    makeCase(axis, { id: 'opposite-high', direction: -1, throttle: 0.75, seed: 0x31865 }),
    makeCase(axis, { id: 'positive-low', throttle: 0.25, seed: 0x61523 }),
    makeCase(axis, { id: 'positive-high', throttle: 0.75, seed: 0x41721 }),
    makeCase(axis, {
      id: 'ramp-negative',
      shape: 'ramp',
      direction: -1,
      throttle: 0.35,
      seed: 0x91613,
    }),
    makeCase(axis, { id: 'ramp-positive', shape: 'ramp', throttle: 0.65, seed: 0x12139 }),
    ...AXES.filter((other) => other !== axis).map((other, index) =>
      makeCase(other, {
        id: `cross-axis-${other}`,
        direction: -1,
        throttle: 0.5,
        seed: 0x62231 + index * 0x1327,
      }),
    ),
  ];
}

/** Online accumulation at physics frequency. No historical substep array is
 * retained. null means not reached (or not applicable for a ramp), never zero. */
export function createResponseMetrics({ axis, frequency = RESPONSE_BENCH_HZ, testCase }) {
  validateAxis(axis);
  required(frequency === RESPONSE_BENCH_HZ, 'Unsupported response metric resolution');
  const dt = 1 / frequency,
    c = validateCase(testCase),
    sign = c.direction;
  required(c.axis === axis, 'Response case axis changed');
  let samples = 0,
    measured = 0,
    absolute = 0,
    squared = 0,
    cross = 0,
    effort = 0,
    motorActivity = 0,
    saturated = 0,
    target = null,
    rise10 = null,
    rise90 = null,
    peak = 0,
    lastOutside = null,
    lastReleaseOutside = null,
    activeSamples = 0,
    releaseSamples = 0,
    lastStep = 0,
    lastTime = 0;
  function add(sample) {
    required(
      sample.substep === lastStep + 1 && sample.substep <= c.durationSeconds * frequency,
      'Response metrics require every physics step in order',
    );
    required(
      AXES.every((a) => finite(sample.requestedRates?.[a]) && finite(sample.achievedRates?.[a])) &&
        Array.isArray(sample.motors) &&
        sample.motors.length === 4 &&
        sample.motors.every((v) => finite(v) && v >= 0 && v <= 1) &&
        typeof sample.saturated === 'boolean',
      'Invalid response physics sample',
    );
    lastStep = sample.substep;
    lastTime = sample.substep / frequency;
    samples++;
    const beganAt = (sample.substep - 1) / frequency;
    measured++;
    const requested = sample.requestedRates[axis],
      actual = sample.achievedRates[axis];
    const error = requested - actual;
    absolute += Math.abs(error);
    squared += error * error;
    cross += AXES.filter((a) => a !== axis).reduce(
      (sum, a) => sum + sample.achievedRates[a] ** 2,
      0,
    );
    if (sample.saturated) saturated++;
    const meanMotor = sample.motors.reduce((a, b) => a + b, 0) / 4;
    effort += sample.motors.reduce((sum, v) => sum + (v - meanMotor) ** 2, 0) / 4;
    motorActivity += sample.motors.reduce((sum, v) => sum + v * v, 0) / 4;
    // Startup disturbances and effort count too; only rise/settling metrics
    // begin at the commanded maneuver and use the observed physics endpoints.
    if (beganAt < c.startSeconds) return;
    if (beganAt < c.releaseSeconds) {
      activeSamples++;
      target = Math.max(target ?? 0, Math.abs(requested));
      if (c.shape === 'step') {
        const projected = sign * actual;
        peak = Math.max(peak, projected);
        if (target > 1e-9) {
          if (rise10 === null && projected >= target * 0.1) rise10 = lastTime;
          if (rise90 === null && projected >= target * 0.9) rise90 = lastTime;
          if (
            Math.abs(requested - actual) >
            Math.max(
              RESPONSE_BENCH_GATES.settlingBand.absoluteRate,
              target * RESPONSE_BENCH_GATES.settlingBand.relative,
            )
          )
            lastOutside = lastTime;
        }
      }
    } else {
      releaseSamples++;
      if (
        Math.abs(actual) >
        Math.max(
          RESPONSE_BENCH_GATES.settlingBand.absoluteRate,
          (target ?? Math.abs(requested)) * RESPONSE_BENCH_GATES.settlingBand.relative,
        )
      )
        lastReleaseOutside = lastTime;
    }
  }
  function finish() {
    required(
      samples === c.durationSeconds * frequency && measured > 0,
      'Response metrics require a complete test case',
    );
    const settledAt = (lastOutside ?? c.startSeconds) + dt,
      releasedAt = (lastReleaseOutside ?? c.releaseSeconds) + dt;
    const hasTarget = c.shape === 'step' && target > 1e-9;
    return {
      physicsHz: frequency,
      resolutionSeconds: dt,
      sampleCount: samples,
      measuredSeconds: measured * dt,
      trackingError: absolute / measured,
      rmsError: Math.sqrt(squared / measured),
      riseTimeSeconds: hasTarget && rise10 !== null && rise90 !== null ? rise90 - rise10 : null,
      settlingTimeSeconds:
        hasTarget &&
        activeSamples &&
        c.releaseSeconds - settledAt >= RESPONSE_BENCH_GATES.settlingBand.minimumHoldSeconds - 1e-12
          ? Math.max(0, settledAt - c.startSeconds)
          : null,
      releaseSettlingTimeSeconds:
        releaseSamples &&
        lastTime - releasedAt >= RESPONSE_BENCH_GATES.settlingBand.minimumHoldSeconds - 1e-12
          ? Math.max(0, releasedAt - c.releaseSeconds)
          : null,
      overshootRate: hasTarget ? Math.max(0, peak - target) : null,
      crossAxisRate: Math.sqrt(cross / measured),
      saturationSeconds: saturated * dt,
      controlEffort: effort / measured,
      motorActivity: motorActivity / measured,
    };
  }
  return { add, finish };
}

function controlsAt(c, tick) {
  const seconds = tick / 50,
    active = seconds >= c.startSeconds && seconds < c.releaseSeconds;
  const amplitude =
    c.shape === 'ramp'
      ? Math.min(1, Math.max(0, (seconds - c.startSeconds) / (c.releaseSeconds - c.startSeconds)))
      : 1;
  return {
    roll: 0,
    pitch: 0,
    yaw: 0,
    throttle: c.throttle,
    [c.axis]: active ? c.direction * c.stick * amplitude : 0,
  };
}

/** Uses production bodies, controller, motors and response evaluator. The
 * empty, gravity-free rig avoids contact/environment differences in PID tests. */
export async function runResponseCase(source, testCase, { signal, retainTrace = true } = {}) {
  const config = normalizeBenchConfiguration(source),
    c = validateCase(testCase);
  checkAbort(signal);
  await initAdvancedRuntime();
  checkAbort(signal);
  const metrics = createResponseMetrics({ axis: c.axis, testCase: c });
  const sim = createAdvancedSimulation({
    aircraft: config.aircraft,
    controller: config.controller,
    response: createAircraftResponseDescriptor(config.response.response, { mode: 'acro' }),
    frequency: RESPONSE_BENCH_HZ,
    recording: false,
    floor: false,
    gravity: { x: 0, y: 0, z: 0 },
    wind: { x: 0, y: 0, z: 0 },
    spawn: { x: 0, y: 0, z: 0 },
    initialVelocity: { x: 0, y: 0, z: 0 },
  });
  const trace = [];
  try {
    // Only this private unrecorded rig receives a different initial noise state.
    // Recovery validation still checks the full production checkpoint.
    const checkpoint = sim.checkpoint();
    checkpoint.state.noiseState = c.seed;
    sim.restoreCheckpoint(checkpoint);
    for (let tick = 0; tick < c.durationSeconds * 50; tick++) {
      checkAbort(signal);
      sim.enqueueInput({
        sequence: tick,
        timestampUs: tick * 20000,
        controls: controlsAt(c, tick),
      });
      const { physicsSamples } = sim.stepMission({ diagnostics: true });
      for (const sample of physicsSamples) metrics.add(sample);
      if (retainTrace) {
        const sample = physicsSamples.at(-1);
        required(trace.length < RESPONSE_BENCH_TRACE_LIMIT, 'Response trace capacity reached');
        trace.push({
          seconds: sample.seconds,
          requested: sample.requestedRates[c.axis],
          achieved: sample.achievedRates[c.axis],
          crossAxis: Math.sqrt(
            AXES.filter((a) => a !== c.axis).reduce((s, a) => s + sample.achievedRates[a] ** 2, 0),
          ),
          saturated: physicsSamples.some((p) => p.saturated),
        });
      }
      // Yield between bounded batches so same-thread test harnesses can cancel;
      // the real UI cancels by terminating this job's dedicated worker.
      if (tick % 25 === 24) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const evaluator = createAircraftResponseEvaluator(
      createAircraftResponseDescriptor(config.response.response),
    );
    return {
      testCase: copy(c),
      metrics: metrics.finish(),
      trace,
      targetRate: evaluator({
        roll: 0,
        pitch: 0,
        yaw: 0,
        throttle: c.throttle,
        [c.axis]: c.direction * c.stick,
      })[c.axis],
      finalHash: sim.stateHash(),
    };
  } finally {
    sim.dispose();
  }
}

export async function runResponseComparison(request, { signal, onProgress = () => {} } = {}) {
  const saved = normalizeBenchConfiguration(request.saved),
    draft = normalizeBenchConfiguration(request.draft),
    axis = validateAxis(request.axis ?? 'roll'),
    scope = request.scope ?? 'controller',
    changedGroups = responseBenchDifferences(saved, draft);
  required(['controller', 'setup'].includes(scope), 'Choose PID comparison or complete setups');
  required(
    scope === 'setup' || changedGroups.every((group) => group === 'controller'),
    'PID comparison changes controller settings only. Choose Compare complete setups for other changes.',
  );
  checkAbort(signal);
  const testCase = responseBenchCases(axis)[0];
  onProgress({ stage: 'saved', completed: 0, total: 2 });
  const baseline = await runResponseCase(saved, testCase, { signal });
  checkAbort(signal);
  onProgress({ stage: 'draft', completed: 1, total: 2 });
  const candidate = await runResponseCase(draft, testCase, { signal });
  checkAbort(signal);
  return {
    format: RESPONSE_BENCH_FORMAT,
    kind: 'comparison',
    scope,
    axis,
    changedGroups,
    savedIdentity: dataIdentity(saved),
    draftIdentity: dataIdentity(draft),
    conditions: {
      physicsHz: RESPONSE_BENCH_HZ,
      inputHz: 50,
      traceHz: 50,
      mode: 'acro',
      gravity: false,
      contacts: false,
      seed: testCase.seed,
      sameScriptedInputs: true,
      freshBattery: true,
      savedSensorNoise: saved.aircraft.sensorNoise,
      draftSensorNoise: draft.aircraft.sensorNoise,
    },
    gates: copy(RESPONSE_BENCH_GATES),
    baseline,
    candidate,
    limitation: RESPONSE_BENCH_LIMITATION,
  };
}

/** Only one strictly bounded nonzero gain changes. Filters, rates, physics and
 * all other controller fields are copied exactly. Zero gains stay zero. */
export function responseGainCandidates(source, axis = 'roll') {
  const config = normalizeBenchConfiguration(source);
  validateAxis(axis);
  const candidates = [];
  for (const gain of GAINS) {
    const previous = config.controller.gains[axis][gain];
    if (previous <= 0) continue;
    for (const multiplier of [0.9, 1.1]) {
      const value = previous * multiplier;
      if (value > 1000 || value <= 0) continue;
      const candidate = copy(config);
      candidate.controller.gains[axis][gain] = value;
      candidates.push({
        axis,
        gain,
        previous,
        value,
        multiplier,
        configuration: freeze(candidate),
      });
    }
  }
  return candidates;
}

/** Absolute floors handle zero/near-zero values; time tolerance is one physics
 * step, not a percentage of an unreached or arbitrarily small measurement. */
export function responseValidationVerdict(baseline, candidate, { shape = 'step' } = {}) {
  const reasons = [];
  for (const [metric, { absolute: floor, relative }] of Object.entries(
    RESPONSE_BENCH_GATES.regression,
  )) {
    if (shape === 'ramp' && metric === 'overshootRate') continue;
    const a = baseline[metric],
      b = candidate[metric];
    if (!finite(a) || !finite(b) || a < 0 || b < 0 || b > a + Math.max(floor, a * relative))
      reasons.push(metric);
  }
  for (const metric of [
    'riseTimeSeconds',
    'settlingTimeSeconds',
    'releaseSettlingTimeSeconds',
    'saturationSeconds',
  ]) {
    if (shape === 'ramp' && ['riseTimeSeconds', 'settlingTimeSeconds'].includes(metric)) continue;
    const a = baseline[metric],
      b = candidate[metric];
    if (
      !finite(b) ||
      b < 0 ||
      (a !== null &&
        (!finite(a) || a < 0 || b > a + RESPONSE_BENCH_GATES.timeToleranceSeconds + 1e-12))
    )
      reasons.push(metric);
  }
  return { pass: reasons.length === 0, reasons };
}
const trackingImproved = (a, b) =>
  finite(a) &&
  finite(b) &&
  a >= 0 &&
  b >= 0 &&
  b <
    a -
      Math.max(
        RESPONSE_BENCH_GATES.minimumTrackingImprovement.absolute,
        a * RESPONSE_BENCH_GATES.minimumTrackingImprovement.relative,
      );

export async function suggestResponseTune(
  request,
  { signal, onProgress = () => {}, runCase = runResponseCase } = {},
) {
  required(
    request.inputReady === true,
    'Check input connection, mapping and calibration before asking for tuning suggestions.',
  );
  const source = normalizeBenchConfiguration(request.draft),
    axis = validateAxis(request.axis ?? 'roll'),
    fitting = responseBenchCases(axis)[0],
    candidates = responseGainCandidates(source, axis);
  checkAbort(signal);
  onProgress({ stage: 'baseline', completed: 0, total: candidates.length + 1 });
  const baseline = await runCase(source, fitting, { signal, retainTrace: false });
  const qualified = [],
    failedCases = [];
  const attemptCandidate = async (candidate, testCase, stage) => {
    try {
      const result = await runCase(candidate.configuration, testCase, {
        signal,
        retainTrace: false,
      });
      required(result?.metrics, 'Candidate produced no response metrics');
      return result;
    } catch (error) {
      checkAbort(signal);
      if (error?.name === 'AbortError') throw error;
      failedCases.push({
        axis: candidate.axis,
        gain: candidate.gain,
        multiplier: candidate.multiplier,
        stage,
        caseId: testCase.id,
        reason: 'simulation-failed',
      });
      return null;
    }
  };
  for (const [index, candidate] of candidates.entries()) {
    checkAbort(signal);
    const result = await attemptCandidate(candidate, fitting, 'fitting');
    if (
      result &&
      trackingImproved(baseline.metrics.trackingError, result.metrics.trackingError) &&
      responseValidationVerdict(baseline.metrics, result.metrics).pass
    )
      qualified.push({ ...candidate, fit: result });
    onProgress({ stage: 'fitting', completed: index + 2, total: candidates.length + 1 });
  }
  // Selection uses training data only. Holdout evidence cannot promote a
  // training loser; at most three candidates advance to bounded validation.
  qualified.sort((a, b) => a.fit.metrics.trackingError - b.fit.metrics.trackingError);
  const finalists = qualified.slice(0, 3),
    validationCases = responseBenchCases(axis, { validation: true });
  const validated = [],
    validationBaseline = [];
  if (finalists.length) {
    for (const testCase of validationCases) {
      checkAbort(signal);
      validationBaseline.push(await runCase(source, testCase, { signal, retainTrace: false }));
    }
    for (const [index, candidate] of finalists.entries()) {
      const results = [];
      for (const [caseIndex, testCase] of validationCases.entries()) {
        checkAbort(signal);
        const result = await attemptCandidate(candidate, testCase, 'validation');
        results.push({
          testCase,
          baseline: validationBaseline[caseIndex].metrics,
          candidate: result?.metrics ?? null,
          verdict: result
            ? responseValidationVerdict(
                validationBaseline[caseIndex].metrics,
                result.metrics,
                testCase,
              )
            : { pass: false, reasons: ['simulation-failed'] },
        });
        onProgress({
          stage: 'validation',
          completed: index * validationCases.length + caseIndex + 1,
          total: finalists.length * validationCases.length,
        });
      }
      const mean = (field) =>
        results.reduce((sum, entry) => sum + entry[field].trackingError, 0) / results.length;
      if (
        results.every((entry) => entry.verdict.pass) &&
        trackingImproved(mean('baseline'), mean('candidate'))
      ) {
        const { configuration, ...description } = candidate;
        validated.push({
          ...description,
          controller: copy(configuration.controller),
          validation: results,
          fittingBaseline: baseline.metrics,
        });
      }
    }
  }
  checkAbort(signal);
  return {
    format: RESPONSE_BENCH_FORMAT,
    kind: 'suggestions',
    axis,
    draftIdentity: dataIdentity(source),
    status: validated.length ? 'suggestions' : 'no-clear-improvement',
    suggestions: validated,
    evaluatedCandidates: candidates.length,
    validatedCandidates: finalists.length,
    failedCases,
    physicsHz: RESPONSE_BENCH_HZ,
    conditions: {
      sensorNoise: source.aircraft.sensorNoise,
      vibration: source.aircraft.vibration,
      seededSensorNoiseEnabled: source.aircraft.sensorNoise > 0,
    },
    gates: copy(RESPONSE_BENCH_GATES),
    limitation: RESPONSE_BENCH_LIMITATION,
  };
}

/** This is a human trial card, never evidence of identical pilot inputs. The
 * caller freezes its launch/calibration and records each pilot's feedback. */
export function createManualPracticeComparison(saved, draft, { launch, inputConfiguration } = {}) {
  const before = normalizeBenchConfiguration(saved),
    after = normalizeBenchConfiguration(draft);
  required(launch && inputConfiguration, 'Manual comparison requires launch and input conditions');
  return freeze(
    boundedJSON(
      {
        format: 'FpvManualComparison.v1',
        saved: before,
        draft: after,
        changedGroups: responseBenchDifferences(before, after),
        launch,
        inputConfiguration,
        sameScriptedInputs: false,
        guidance: [
          'Hover, then a short roll input and release.',
          'Repeat the same maneuver in each setup. Record comfort and control separately.',
        ],
        feedback: { saved: '', draft: '' },
      },
      { maxBytes: 256 * 1024, maxNodes: 10000, maxDepth: 24 },
    ),
  );
}
