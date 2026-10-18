import {
  createAdvancedSimulation,
  initAdvancedRuntime,
} from '../../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  createPresetConfiguration,
  listAircraftPresets,
} from '../../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { aircraftPerformance } from '../../../optional-practice/civilian-fpv/aircraft-physics.mjs';
import { aircraftAttitude } from '../../../optional-practice/civilian-fpv/aircraft-response.mjs';

const axes = ['roll', 'pitch', 'yaw'];
const controls = (throttle) => ({ roll: 0, pitch: 0, yaw: 0, throttle });
const upright = (q) => 1 - 2 * (q.x * q.x + q.z * q.z);
const largestRate = (sample) => Math.max(...Object.values(sample.achievedRates).map(Math.abs));
function advance(simulation, tick, input) {
  simulation.enqueueInput({ sequence: tick, timestampUs: tick * 20000, controls: input });
  return simulation.stepMission().telemetry;
}

/** Production flight with gravity and contacts. These are controllability
 * checks, not measured-aircraft fidelity or the zero-gravity response bench. */
export function aircraftTakeoffQualification(id, mode) {
  const preset = createPresetConfiguration(id);
  const hover = aircraftPerformance(preset.aircraft).hoverThrottle;
  const half = preset.aircraft.geometry.bodyHalfExtents.y;
  const sim = createAdvancedSimulation({
    ...preset,
    mode,
    spawn: { x: 0, y: Math.max(half, 0.06) + 0.002, z: 0 },
    recording: false,
  });
  let minimumUpright = 1;
  let floorContact = false;
  try {
    for (let tick = 0; tick < 400; tick++) {
      const sample = advance(sim, tick, controls(Math.min(hover + 0.025, tick * 0.007)));
      minimumUpright = Math.min(minimumUpright, upright(sample.orientation));
      floorContact ||= sample.contact.grounded;
    }
    const final = sim.telemetry();
    return {
      mode,
      hover,
      floorContact,
      minimumUpright,
      height: final.position.y,
      rate: largestRate(final),
      attitude: aircraftAttitude(final.orientation),
      hash: sim.stateHash(),
    };
  } finally {
    sim.dispose();
  }
}

export function aircraftHoverQualification(id) {
  const preset = createPresetConfiguration(id);
  const hover = aircraftPerformance(preset.aircraft).hoverThrottle;
  const sim = createAdvancedSimulation({
    ...preset,
    spawn: { x: 0, y: 20, z: 0 },
    recording: false,
  });
  let previousVelocity;
  try {
    for (let tick = 0; tick < 250; tick++) {
      const sample = advance(sim, tick, controls(hover));
      if (tick === 149) previousVelocity = sample.velocity.y;
    }
    const final = sim.telemetry();
    return {
      height: final.position.y,
      upright: upright(final.orientation),
      rate: largestRate(final),
      // Startup with stopped motors loses height; hover is not altitude hold.
      meanVerticalAcceleration: (final.velocity.y - previousVelocity) / 2,
    };
  } finally {
    sim.dispose();
  }
}

export function aircraftAxisQualification(id, mode, axis) {
  const preset = createPresetConfiguration(id);
  const hover = aircraftPerformance(preset.aircraft).hoverThrottle;
  const sim = createAdvancedSimulation({
    ...preset,
    mode,
    spawn: { x: 0, y: 50, z: 0 },
    recording: false,
  });
  let peakRate = 0;
  let peakOtherRate = 0;
  let minimumUpright = 1;
  let endOfCommand;
  // A 200ms half-stick keyboard tap in Acro; a 1s hold in self-level.
  const release = mode === 'acro' ? 60 : 100;
  try {
    for (let tick = 0; tick < 250; tick++) {
      const input = controls(hover + 0.015);
      if (tick >= 50 && tick < release) input[axis] = 0.5;
      const sample = advance(sim, tick, input);
      peakRate = Math.max(peakRate, sample.achievedRates[axis]);
      peakOtherRate = Math.max(
        peakOtherRate,
        ...axes
          .filter((other) => other !== axis)
          .map((other) => Math.abs(sample.achievedRates[other])),
      );
      minimumUpright = Math.min(minimumUpright, upright(sample.orientation));
      if (tick === release - 1)
        endOfCommand = {
          rate: sample.achievedRates[axis],
          attitude: aircraftAttitude(sample.orientation),
          requested: sample.requestedRates[axis],
        };
    }
    const final = sim.telemetry();
    return {
      mode,
      axis,
      minimumUpright,
      peakRate,
      peakOtherRate,
      endOfCommand,
      releasedRate: largestRate(final),
      finalAttitude: aircraftAttitude(final.orientation),
      finalHeight: final.position.y,
    };
  } finally {
    sim.dispose();
  }
}

export function aircraftGroundReleaseQualification(id, mode, { backend, holdSeconds = 15 } = {}) {
  const preset = createPresetConfiguration(id);
  const hover = aircraftPerformance(preset.aircraft).hoverThrottle;
  const sim = createAdvancedSimulation({
    ...preset,
    ...(backend ? { backend } : {}),
    mode,
    spawn: { x: 0, y: preset.aircraft.geometry.bodyHalfExtents.y, z: 0 },
    recording: false,
  });
  let minimumUpright = 1;
  try {
    for (let tick = 0; tick < (holdSeconds + 8) * 50; tick++) {
      const input = controls(
        tick < holdSeconds * 50 ? 0 : Math.min(hover + 0.04, (tick - holdSeconds * 50) * 0.007),
      );
      if (tick < holdSeconds * 50) input.roll = 0.5;
      const sample = advance(sim, tick, input);
      minimumUpright = Math.min(minimumUpright, upright(sample.orientation));
    }
    const final = sim.telemetry();
    return {
      mode,
      backend: final.backend,
      minimumUpright,
      height: final.position.y,
      rate: largestRate(final),
      finalAttitude: aircraftAttitude(final.orientation),
      hash: sim.stateHash(),
    };
  } finally {
    sim.dispose();
  }
}

export async function runAircraftFlightQualification({ onPreset } = {}) {
  await initAdvancedRuntime();
  const aircraft = [];
  for (const { id } of listAircraftPresets()) {
    const row = {
      id,
      hover: aircraftHoverQualification(id),
      takeoff: ['acro', 'self-level'].map((mode) => aircraftTakeoffQualification(id, mode)),
      axes: ['acro', 'self-level'].flatMap((mode) =>
        axes.map((axis) => aircraftAxisQualification(id, mode, axis)),
      ),
    };
    aircraft.push(row);
    onPreset?.(row);
  }
  return {
    format: 'AircraftFlightQualification.v1',
    gravity: 9.81,
    frequency: 500,
    aircraft,
    limitation:
      'Software controllability with default catalog settings; not measured flight fidelity.',
  };
}
