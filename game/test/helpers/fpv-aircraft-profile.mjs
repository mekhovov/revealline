import RAPIER from '../../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
} from '../../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createPresetConfiguration } from '../../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { createAdvancedWorkerClient } from '../../../optional-practice/civilian-fpv/advanced-worker-client.mjs';
import { aircraftCourseTerrain } from '../../../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import { FLIGHT_COURSES } from '../../../optional-practice/civilian-fpv/catalogue.mjs';

/** Diagnostic wrappers forward the same receiver, arguments, return and errors.
 * Timings are inclusive and may overlap; they are never summed as exclusive CPU. */
export function installAircraftProfile() {
  let counters = {};
  const restores = [];
  for (const [target, name, label] of [
    [RAPIER.World.prototype, 'step', 'solverStep'],
    [RAPIER.World.prototype, 'takeSnapshot', 'physicsSnapshot'],
    [RAPIER.World.prototype, 'contactPair', 'trackedContactPair'],
    [RAPIER.Collider.prototype, 'contactCollider', 'currentShapeContact'],
  ]) {
    const original = target[name];
    if (typeof original !== 'function') throw new Error(`Missing profiler target ${label}`);
    target[name] = function (...args) {
      const started = performance.now();
      try {
        return Reflect.apply(original, this, args);
      } finally {
        const row = (counters[label] ??= { calls: 0, elapsedMs: 0 });
        row.calls++;
        row.elapsedMs += performance.now() - started;
      }
    };
    restores.push(() => {
      target[name] = original;
    });
  }
  return {
    read: () => structuredClone(counters),
    reset: () => {
      counters = {};
    },
    dispose: () => restores.forEach((restore) => restore()),
  };
}
export async function runAircraftRepresentativeProfile({
  scenario,
  instrumented = false,
  workerURL,
} = {}) {
  const landing = scenario === 'cetus-floor',
    worker = !landing;
  const preset = landing ? 'cetus-x-betaflight-2022' : 'meteor75-analog-2022';
  const config = {
    ...createPresetConfiguration(preset),
    frequency: 1000,
    mode: landing ? 'acro' : 'self-level',
    ...(landing
      ? {
          floor: false,
          terrain: { format: 'AdvancedRegionalTerrain.v1' },
          spawn: { x: 0, y: 1, z: 0 },
        }
      : {}),
  };
  await initAdvancedRuntime();
  let owner;
  class ObservedWorker extends globalThis.Worker {
    constructor(...args) {
      super(...args);
      owner = this;
    }
  }
  const query = (reset = false) =>
    new Promise((resolve) => {
      const token = `profile-${Math.random()}`;
      const listener = (event) => {
        if (event.data?.type === 'qualification-profile' && event.data.token === token) {
          owner.removeEventListener('message', listener);
          resolve(event.data.profile);
        }
      };
      owner.addEventListener('message', listener);
      owner.postMessage({ type: 'qualification-profile', token, reset });
    });
  const profiler = instrumented && !worker ? installAircraftProfile() : null;
  const initStart = performance.now();
  const sim = worker
    ? createAdvancedWorkerClient({ Worker: ObservedWorker, url: workerURL })
    : createAdvancedSimulation(config);
  if (worker) await sim.initialize(config);
  if (landing) {
    const staged = sim.stageTerrainFrame(aircraftCourseTerrain(FLIGHT_COURSES[0]));
    sim.commitTerrainFrame({ transaction: staged.transaction, accepted: true });
  }
  const initializationMs = performance.now() - initStart;
  if (worker) await query(true);
  profiler?.reset();
  const count = landing ? 75 : 80,
    durations = [],
    started = performance.now();
  let lowest = Infinity,
    contacts = 0,
    final;
  try {
    for (let tick = 0; tick < count; tick++) {
      const input = {
        sequence: tick,
        timestampUs: tick * 20000,
        controls: {
          roll: tick >= 15 && tick < 35 ? 0.12 : 0,
          pitch: tick >= 40 && tick < 60 ? -0.1 : 0,
          yaw: tick >= 65 ? 0.15 : 0,
          throttle: tick < 10 ? 0.2 : 0.45,
        },
      };
      const before = performance.now();
      const step = worker ? await sim.step(input) : sim.stepMission();
      if (worker && tick === 39) await sim.snapshot();
      durations.push(performance.now() - before);
      final = step.telemetry;
      for (const p of step.trace) lowest = Math.min(lowest, p.y - p.supportHeight);
      contacts = Math.max(contacts, final.contact.contacts);
    }
    const elapsedMs = performance.now() - started;
    const counters = worker ? await query() : (profiler?.read() ?? {});
    const snapshot = await sim.snapshot();
    return {
      scenario,
      preset,
      mode: config.mode,
      worker,
      instrumented,
      backend: snapshot.config?.backend ?? final.backend,
      initializationMs,
      elapsedMs,
      capacity: (count * 20) / elapsedMs,
      finalHash: snapshot.hash,
      counters,
      perMissionMs: durations,
      minimumSupportY: lowest,
      contacts,
      finalTelemetry: final,
    };
  } finally {
    sim.dispose();
    profiler?.dispose();
  }
}
