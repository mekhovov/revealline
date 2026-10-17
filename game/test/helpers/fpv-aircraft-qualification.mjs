import {
  createAdvancedSimulation,
  initAdvancedRuntime,
} from '../../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  createPresetConfiguration,
  listAircraftPresets,
} from '../../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { createRateEvaluator } from '../../../optional-practice/civilian-fpv/rates.mjs';
const axes = ['roll', 'pitch', 'yaw'];
const candidates = [250, 500, 1000];
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
function crossing(trace, threshold) {
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1],
      b = trace[i];
    if (a.rate < threshold && b.rate >= threshold)
      return a.time + ((b.time - a.time) * (threshold - a.rate)) / (b.rate - a.rate);
  }
  return null;
}
function response(id, frequency, axis) {
  const preset = createPresetConfiguration(id),
    evaluator = createRateEvaluator(preset.response.rates);
  let low = 0,
    high = 1;
  for (let i = 0; i < 32; i++) {
    const middle = (low + high) / 2;
    if (evaluator.rate(axis, middle) < 100) low = middle;
    else high = middle;
  }
  const stick = (low + high) / 2,
    target = evaluator.rate(axis, stick);
  const sim = createAdvancedSimulation({
    ...preset,
    frequency,
    numericalReference: frequency === 2000,
    floor: false,
    gravity: { x: 0, y: 0, z: 0 },
  });
  const trace = [],
    started = performance.now();
  try {
    for (let tick = 0; tick < 150; tick++) {
      const controls = { roll: 0, pitch: 0, yaw: 0, throttle: 0.5 };
      controls[axis] = tick >= 25 && tick < 100 ? stick : 0;
      sim.enqueueInput({ sequence: tick, timestampUs: tick * 20000, controls });
      const { telemetry } = sim.stepMission();
      trace.push({ time: telemetry.seconds, rate: telemetry.achievedRates[axis] });
    }
    const elapsedMs = performance.now() - started,
      active = trace.filter((p) => p.time >= 0.5 && p.time <= 2);
    const steady = active.filter((p) => p.time >= 1.7);
    const rise10 = crossing(active, target * 0.1),
      rise90 = crossing(active, target * 0.9);
    check(rise10 !== null && rise90 !== null, `${id} ${axis} did not reach the target`);
    return {
      elapsedMs,
      capacity: 3000 / elapsedMs,
      finalHash: sim.stateHash(),
      metrics: {
        steadyRate: steady.reduce((sum, p) => sum + p.rate, 0) / steady.length,
        riseTime: rise90 - rise10,
        peakRate: Math.max(...active.map((p) => p.rate)),
        absoluteError: active.reduce((sum, p) => sum + Math.abs(target - p.rate) * 0.02, 0),
      },
    };
  } finally {
    sim.dispose();
  }
}
function contact(id, frequency) {
  const sim = createAdvancedSimulation({
    ...createPresetConfiguration(id),
    frequency,
    numericalReference: frequency === 2000,
    floor: false,
    gravity: { x: 0, y: 0, z: 0 },
    spawn: { x: 0, y: 2, z: 2 },
    initialVelocity: { x: 0, y: 0, z: -40 },
    obstacles: [
      { id: 'thin-wall', min: { x: -10, y: -10, z: -0.03 }, max: { x: 10, y: 10, z: 0.03 } },
    ],
  });
  try {
    let minimumZ = 2;
    for (let tick = 0; tick < 25; tick++)
      for (const p of sim.stepMission().trace) minimumZ = Math.min(minimumZ, p.z);
    return { minimumZ, blocked: minimumZ > 0, finalZ: sim.telemetry().position.z };
  } finally {
    sim.dispose();
  }
}
/** Numerical and local runtime capacity checks, not hardware/flight validation.
 * Includes production Rapier controller, motors, bodies, recording and contacts.
 * Keep this browser-importable for subsequent architecture/device qualification. */
export async function runAircraftTimingQualification({ repetitions = 2, onPreset } = {}) {
  check(
    Number.isInteger(repetitions) && repetitions >= 1 && repetitions <= 5,
    'Invalid repetitions',
  );
  await initAdvancedRuntime();
  response('meteor75-analog-2022', 250, 'roll');
  const aircraft = [];
  for (const preset of listAircraftPresets()) {
    const reference = {
      frequency: 2000,
      axes: Object.fromEntries(axes.map((a) => [a, response(preset.id, 2000, a)])),
      contact: contact(preset.id, 2000),
    };
    const results = candidates.map((frequency) => {
      const axisResults = Object.fromEntries(
        axes.map((axis) => {
          const runs = Array.from({ length: repetitions }, () =>
            response(preset.id, frequency, axis),
          );
          return [
            axis,
            {
              metrics: runs[0].metrics,
              relativeErrors: Object.fromEntries(
                Object.entries(runs[0].metrics).map(([metric, value]) => [
                  metric,
                  Math.abs(value - reference.axes[axis].metrics[metric]) /
                    Math.max(1e-9, Math.abs(reference.axes[axis].metrics[metric])),
                ]),
              ),
              minimumCapacity: Math.min(...runs.map((run) => run.capacity)),
              repeatHashesAgree: runs.every((run) => run.finalHash === runs[0].finalHash),
            },
          ];
        }),
      );
      const collision = contact(preset.id, frequency);
      return {
        frequency,
        axes: axisResults,
        contact: collision,
        accuracyPass: Object.values(axisResults).every((a) =>
          Object.values(a.relativeErrors).every((error) => error <= 0.02),
        ),
        capacityPass: Object.values(axisResults).every((a) => a.minimumCapacity >= 2),
        contactsPass: collision.blocked && reference.contact.blocked,
        repetitionPass: Object.values(axisResults).every((a) => a.repeatHashesAgree),
      };
    });
    const result = { preset: preset.id, reference, candidates: results };
    aircraft.push(result);
    onPreset?.(result);
  }
  const selectedHzOnThisRuntime =
    candidates.find((frequency) =>
      aircraft.every((p) => {
        const c = p.candidates.find((item) => item.frequency === frequency);
        return c.accuracyPass && c.capacityPass && c.contactsPass && c.repetitionPass;
      }),
    ) ?? null;
  return {
    format: 'AircraftTimingQualification.v1',
    referenceHz: 2000,
    repetitions,
    selectedHzOnThisRuntime,
    aircraft,
    limitation:
      'Local numerical and performance evidence; not real-aircraft fidelity or the complete platform matrix.',
  };
}

/** Cross-engine hashes include the production body/controller state. Worker
 * recovery terminates the original owner and continues in a newly initialized
 * dedicated worker, preserving the exact consumed samples. */
export async function runAircraftDeterminismQualification({ worker = false } = {}) {
  const { createAdvancedWorkerClient } = await import(
    '../../../optional-practice/civilian-fpv/advanced-worker-client.mjs'
  );
  const { verifyAdvancedRecovery } = await import(
    '../../../optional-practice/civilian-fpv/advanced-simulation.mjs'
  );
  await initAdvancedRuntime();
  const results = [];
  for (const preset of listAircraftPresets())
    for (const mode of ['acro', 'self-level']) {
      const config = { ...createPresetConfiguration(preset.id), mode, frequency: 500 };
      const sample = (tick) => ({
        sequence: tick,
        timestampUs: tick * 20000,
        controls: {
          roll: tick >= 15 && tick < 35 ? 0.12 : 0,
          pitch: tick >= 40 && tick < 60 ? -0.1 : 0,
          yaw: tick >= 65 ? 0.15 : 0,
          throttle: tick < 10 ? 0.2 : 0.45,
        },
      });
      let sim = worker ? createAdvancedWorkerClient() : createAdvancedSimulation(config);
      const initialize = async () => {
        if (worker) await sim.initialize(config);
      };
      const step = async (tick) => {
        if (worker) return sim.step(sample(tick));
        sim.enqueueInput(sample(tick));
        return sim.stepMission();
      };
      const snapshot = async () => (worker ? sim.snapshot() : sim.snapshot());
      await initialize();
      try {
        let saved;
        for (let tick = 0; tick < 80; tick++) {
          await step(tick);
          if (tick === 39) saved = await snapshot();
        }
        const final = await snapshot();
        const recording = await sim.recording();
        if (worker) {
          sim.dispose();
          sim = createAdvancedWorkerClient();
          await initialize();
          await sim.restore(saved);
        } else sim.restore(await verifyAdvancedRecovery(saved));
        for (let tick = 40; tick < 80; tick++) await step(tick);
        const continued = await snapshot();
        check(
          final.hash === continued.hash,
          `${preset.id} ${mode} ${worker ? 'worker' : 'direct'} recovery diverged`,
        );
        results.push({
          preset: preset.id,
          mode,
          identity: final.identity,
          finalHash: final.hash,
          continuationHash: continued.hash,
          recordedFinalHash: recording.finalHash,
          consumedSequence: final.checkpoint.state.consumedSequence,
          consumedTimestampUs: final.checkpoint.state.consumedTimestampUs,
        });
      } finally {
        sim.dispose();
      }
    }
  return { frequency: 500, worker, cases: results };
}
