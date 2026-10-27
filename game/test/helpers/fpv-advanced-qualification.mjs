import {
  ADVANCED_BACKEND,
  ADVANCED_DEFAULT_HZ,
  ADVANCED_FREQUENCIES,
  ADVANCED_QUALIFICATION,
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
  validateAdvancedAircraft,
} from '../../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createAdvancedWorkerClient } from '../../../optional-practice/civilian-fpv/advanced-worker-client.mjs';

const axes = ['roll', 'pitch', 'yaw'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function requireCheck(condition, message) {
  if (!condition) throw new Error(message);
}
export function qualificationInput(tick) {
  return {
    sequence: tick,
    // Offset samples inside an interval to exercise sample availability rather
    // than treating every controller tick as a new device reading.
    timestampUs: tick * 20000 + (tick % 4) * 1000,
    controls: {
      roll: ((tick % 23) - 11) / 200,
      pitch: ((tick % 17) - 8) / 180,
      yaw: ((tick % 13) - 6) / 100,
      throttle: 0.34 + (tick % 7) / 100,
    },
  };
}
export function qualificationOptions() {
  const aircraft = validateAdvancedAircraft();
  aircraft.sensorNoise = 0.02;
  aircraft.vibration = 0.01;
  return {
    aircraft,
    floor: false,
    gravity: { x: 0, y: 0, z: 0 },
    spawn: { x: 0, y: 2, z: 2 },
    initialVelocity: { x: 0, y: 0, z: -40 },
    obstacles: [{ id: 'thin-wall', min: { x: -5, y: -5, z: -0.01 }, max: { x: 5, y: 5, z: 0.01 } }],
  };
}

/** This fixture is shared unchanged by Node, page and real module-worker tests.
 * Exact checkpoint hashes include Rapier bytes and controller/motor/filter state. */
export async function runAdvancedDeterminismQualification() {
  await initAdvancedRuntime();
  const simulation = createAdvancedSimulation(qualificationOptions());
  try {
    const initialHash = simulation.stateHash(),
      hashes = [];
    let recoverySnapshot,
      pausedSnapshot,
      minimumZ = 2;
    for (let tick = 0; tick < 200; tick++) {
      simulation.enqueueInput(qualificationInput(tick));
      if (tick === 43) {
        const before = simulation.snapshot();
        const proposal = simulation.proposeMission();
        simulation.commitMission({ transaction: proposal.transaction, accepted: false });
        requireCheck(same(before, simulation.snapshot()), 'Terrain rejection changed hidden state');
      }
      const result = simulation.stepMission();
      // The initial impact must be blocked; after it the drone is free to fly
      // around the finite fixture, so only the first second is a contact gate.
      if (tick < 50) for (const position of result.trace) minimumZ = Math.min(minimumZ, position.z);
      if (tick === 72) recoverySnapshot = simulation.snapshot();
      if (tick === 99) {
        pausedSnapshot = simulation.snapshot();
        simulation.telemetry();
        requireCheck(
          same(pausedSnapshot, simulation.snapshot()),
          'Telemetry advanced paused flight',
        );
      }
      if ((tick + 1) % 10 === 0) hashes.push([tick + 1, simulation.stateHash()]);
    }
    const recording = simulation.recording(),
      telemetry = simulation.telemetry();
    const replay = await replayAdvancedRecording(JSON.stringify(recording));
    requireCheck(replay.verified && same(replay.telemetry, telemetry), 'Full replay diverged');
    const partial = await replayAdvancedRecording(recording, { throughMission: 73 });
    requireCheck(partial.verifiedThroughMission === 100, 'Partial recovery was not hash verified');
    simulation.restore(partial.snapshot);
    requireCheck(same(simulation.telemetry(), partial.telemetry), 'Partial restore failed');
    for (let tick = 73; tick < 200; tick++) {
      simulation.enqueueInput(qualificationInput(tick));
      simulation.stepMission();
    }
    requireCheck(same(recording, simulation.recording()), 'Recovered recording diverged');
    simulation.restore(recoverySnapshot);
    for (let tick = 73; tick < 200; tick++) {
      simulation.enqueueInput(qualificationInput(tick));
      simulation.stepMission();
    }
    requireCheck(same(recording, simulation.recording()), 'Snapshot continuation diverged');
    simulation.reset();
    requireCheck(simulation.stateHash() === initialHash, 'Reset changed initial state');
    for (let tick = 0; tick < 200; tick++) {
      simulation.enqueueInput(qualificationInput(tick));
      simulation.stepMission();
    }
    requireCheck(same(recording, simulation.recording()), 'Reset rerun diverged');
    requireCheck(minimumZ > 0, 'Reference quad tunneled through wall');
    return {
      backend: ADVANCED_BACKEND,
      frequency: ADVANCED_DEFAULT_HZ,
      identity: simulation.identity,
      initialHash,
      hashes,
      finalHash: recording.finalHash,
      consumedInputs: recording.inputs,
      finalTelemetry: telemetry,
      contact: { blocked: minimumZ > 0, minimumZ },
      checks: {
        rejectedTerrainRollback: true,
        pausedTelemetryDoesNotAdvance: true,
        fullReplay: true,
        verifiedPartialRecovery: true,
        snapshotContinuation: true,
        resetRepeat: true,
      },
    };
  } finally {
    simulation.dispose();
  }
}

function crossing(trace, threshold) {
  for (let index = 1; index < trace.length; index++) {
    const previous = trace[index - 1],
      current = trace[index];
    if (previous.rate < threshold && current.rate >= threshold)
      return (
        previous.time +
        ((current.time - previous.time) * (threshold - previous.rate)) /
          (current.rate - previous.rate)
      );
  }
  return null;
}
function response(frequency, axis) {
  const simulation = createAdvancedSimulation({
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
      controls[axis] = tick >= 25 && tick < 100 ? 0.25 : 0;
      simulation.enqueueInput({ sequence: tick, timestampUs: tick * 20000, controls });
      const { telemetry } = simulation.stepMission();
      trace.push({ time: telemetry.seconds, rate: telemetry.achievedRates[axis] });
    }
    const elapsedMs = performance.now() - started;
    const active = trace.filter((point) => point.time >= 0.5 && point.time <= 2);
    const steady = active.filter((point) => point.time >= 1.7);
    const rise10 = crossing(active, 10),
      rise90 = crossing(active, 90);
    requireCheck(rise10 !== null && rise90 !== null, `${axis} response never reached 90% target`);
    return {
      elapsedMs,
      capacity: 3000 / elapsedMs,
      metrics: {
        steadyRate: steady.reduce((sum, point) => sum + point.rate, 0) / steady.length,
        riseTime: rise90 - rise10,
        peakRate: Math.max(...active.map((point) => point.rate)),
        absoluteError: active.reduce((sum, point) => sum + Math.abs(100 - point.rate) * 0.02, 0),
      },
      finalHash: simulation.stateHash(),
    };
  } finally {
    simulation.dispose();
  }
}
function contact(frequency) {
  const simulation = createAdvancedSimulation({
    ...qualificationOptions(),
    frequency,
    numericalReference: frequency === 2000,
  });
  try {
    let minimumZ = 2;
    for (let tick = 0; tick < 50; tick++)
      for (const point of simulation.stepMission().trace) minimumZ = Math.min(minimumZ, point.z);
    return { blocked: minimumZ > 0, minimumZ, finalZ: simulation.telemetry().position.z };
  } finally {
    simulation.dispose();
  }
}

/** Repeated, warmed measurements include snapshot/recording overhead but not
 * renderer cost. Capacity is conservative: the slowest measured repetition. */
export async function runAdvancedTimingQualification({ repetitions = 3 } = {}) {
  requireCheck(
    Number.isInteger(repetitions) && repetitions >= 1 && repetitions <= 10,
    'Invalid timing repetitions',
  );
  await initAdvancedRuntime();
  response(250, 'roll');
  const reference = {
    frequency: 2000,
    axes: Object.fromEntries(axes.map((axis) => [axis, response(2000, axis)])),
    contact: contact(2000),
  };
  const candidates = ADVANCED_FREQUENCIES.map((frequency) => {
    const results = Object.fromEntries(
      axes.map((axis) => {
        const runs = Array.from({ length: repetitions }, () => response(frequency, axis));
        const errors = Object.fromEntries(
          Object.entries(runs[0].metrics).map(([metric, value]) => [
            metric,
            Math.abs(value - reference.axes[axis].metrics[metric]) /
              Math.max(Math.abs(reference.axes[axis].metrics[metric]), 1e-9),
          ]),
        );
        return [
          axis,
          {
            metrics: runs[0].metrics,
            relativeErrors: errors,
            elapsedMs: runs.map((run) => run.elapsedMs),
            minimumCapacity: Math.min(...runs.map((run) => run.capacity)),
            repeatHashesAgree: runs.every((run) => run.finalHash === runs[0].finalHash),
          },
        ];
      }),
    );
    const collision = contact(frequency);
    return {
      frequency,
      axes: results,
      contact: collision,
      accuracyPass: Object.values(results).every((result) =>
        Object.values(result.relativeErrors).every((error) => error <= 0.02),
      ),
      contactsPass: collision.blocked && reference.contact.blocked,
      capacityPass: Object.values(results).every((result) => result.minimumCapacity >= 2),
      repetitionPass: Object.values(results).every((result) => result.repeatHashesAgree),
    };
  });
  return {
    reference,
    candidates,
    repetitions,
    selectedHzOnThisRuntime:
      candidates.find(
        (candidate) =>
          candidate.accuracyPass &&
          candidate.contactsPass &&
          candidate.capacityPass &&
          candidate.repetitionPass,
      )?.frequency ?? null,
    frozenExperimentalDefaultHz: ADVANCED_DEFAULT_HZ,
    qualification: ADVANCED_QUALIFICATION,
  };
}

export async function runAdvancedWorkerQualification() {
  let client = createAdvancedWorkerClient();
  try {
    const options = qualificationOptions(),
      initialized = await client.initialize(options);
    const initial = await client.snapshot();
    let saved;
    const started = performance.now();
    for (let tick = 0; tick < 200; tick++) {
      if (tick === 43) {
        await client.input(qualificationInput(tick));
        const before = await client.snapshot();
        const proposal = await client.propose();
        await client.commit({ transaction: proposal.transaction, accepted: false });
        requireCheck(
          same(before, await client.snapshot()),
          'Worker terrain rejection changed hidden state',
        );
        await client.step();
      } else await client.step(qualificationInput(tick));
      if (tick === 72) saved = await client.snapshot();
      if (tick === 99) {
        const before = await client.snapshot();
        await new Promise((resolve) => setTimeout(resolve, 40));
        requireCheck(
          same(before, await client.snapshot()),
          'Idle worker advanced paused simulation',
        );
      }
    }
    const elapsedMs = performance.now() - started;
    const recording = await client.recording(),
      telemetry = await client.telemetry();
    await client.reset();
    requireCheck(same(initial, await client.snapshot()), 'Worker reset changed initial state');
    // Terminate with a genuinely outstanding request; no mocked worker is used.
    const outstanding = client.request('snapshot').then(
      () => false,
      () => true,
    );
    client.dispose();
    requireCheck(await outstanding, 'Terminated worker retained pending request');
    client = createAdvancedWorkerClient();
    await client.initialize(options);
    await client.restore(saved);
    for (let tick = 73; tick < 200; tick++) await client.step(qualificationInput(tick));
    requireCheck(same(recording, await client.recording()), 'New worker recovery diverged');
    requireCheck(same(telemetry, await client.telemetry()), 'New worker telemetry diverged');
    return {
      identity: initialized.identity,
      finalHash: recording.finalHash,
      periodicHashes: recording.hashes,
      consumedInputs: recording.inputs,
      finalTelemetry: telemetry,
      elapsedMsIncludingRequestsPauseAndSnapshots: elapsedMs,
      capacityIncludingRequestsPauseAndSnapshots: 4000 / elapsedMs,
      checks: {
        realModuleWorker: true,
        rejectedTerrainRollback: true,
        wallClockPause: true,
        reset: true,
        pendingRequestInterrupted: true,
        newWorkerSnapshotRecovery: true,
      },
    };
  } finally {
    client.dispose();
  }
}

export function compareAdvancedRuntimes(baseline, candidate) {
  const fields = [
    'backend',
    'frequency',
    'identity',
    'initialHash',
    'hashes',
    'finalHash',
    'consumedInputs',
    'finalTelemetry',
    'contact',
    'checks',
  ];
  const differences = fields.filter((field) => !same(baseline[field], candidate[field]));
  return { matched: differences.length === 0, differences };
}
