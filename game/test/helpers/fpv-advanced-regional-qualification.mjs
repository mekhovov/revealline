import {
  ADVANCED_REGIONAL_BACKEND,
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
} from '../../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createAdvancedTerrainFrame } from '../../../optional-practice/civilian-fpv/advanced-terrain.mjs';
import { createAdvancedWorkerClient } from '../../../optional-practice/civilian-fpv/advanced-worker-client.mjs';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const check = (value, message) => {
  if (!value) throw new Error(message);
};
export function regionalQualificationOptions() {
  return {
    floor: false,
    terrain: { format: 'AdvancedRegionalTerrain.v1' },
    spawn: { x: 0, y: 2, z: 2 },
    initialVelocity: { x: 0, y: 0, z: -40 },
  };
}
export function regionalQualificationFrames() {
  const floor = {
    id: 'terrain-floor',
    vertices: [-50, 0, -50, -50, 0, 50, 50, 0, 50, 50, 0, -50],
    indices: [0, 1, 2, 0, 2, 3],
  };
  const wall = {
    id: 'scenery-wall',
    vertices: [-10, 0, 0, 10, 0, 0, 10, 10, 0, -10, 10, 0],
    indices: [0, 1, 2, 0, 2, 3],
  };
  const extension = {
    id: 'terrain-east',
    vertices: [50, 0, -50, 50, 0, 50, 100, 0, 50, 100, 0, -50],
    indices: [0, 1, 2, 0, 2, 3],
  };
  return [
    createAdvancedTerrainFrame({ sourceIdentity: '1111111111111111', colliders: [floor, wall] }),
    createAdvancedTerrainFrame({
      sourceIdentity: '2222222222222222',
      colliders: [extension, wall, floor],
    }),
    createAdvancedTerrainFrame({
      sourceIdentity: '3333333333333333',
      colliders: [floor, extension],
    }),
  ];
}
export const regionalQualificationInput = (tick) => ({
  sequence: tick,
  timestampUs: tick * 20000,
  controls: { roll: 0, pitch: 0, yaw: tick >= 160 ? 0.015 : 0, throttle: tick >= 160 ? 0.7 : 0 },
});
export const regionalQualificationFrameAt = (tick) =>
  tick === 0 ? 0 : tick === 50 ? 1 : tick === 100 ? 2 : tick === 150 ? 0 : tick === 200 ? 1 : null;
function install(sim, frame) {
  const staged = sim.stageTerrainFrame(frame);
  sim.commitTerrainFrame({ transaction: staged.transaction, accepted: true });
}
export async function runAdvancedRegionalQualification() {
  await initAdvancedRuntime();
  const sim = createAdvancedSimulation(regionalQualificationOptions()),
    frames = regionalQualificationFrames(),
    hashes = [];
  const started = performance.now();
  try {
    install(sim, frames[0]);
    const initialHash = sim.stateHash();
    let saved,
      landed,
      minimumZ = 2;
    for (let tick = 0; tick < 200; tick++) {
      const index = regionalQualificationFrameAt(tick);
      if (tick && index !== null) install(sim, frames[index]);
      if (tick === 43) {
        const before = sim.snapshot(),
          staged = sim.stageTerrainFrame(frames[2]);
        sim.commitTerrainFrame({ transaction: staged.transaction, accepted: false });
        check(same(before, sim.snapshot()), 'Rejected terrain frame changed physics/history');
        const unchanged = sim.stageTerrainFrame(frames[0]);
        check(unchanged.unchanged, 'Identical terrain was rebuilt');
        sim.commitTerrainFrame({ transaction: unchanged.transaction, accepted: true });
        check(same(before, sim.snapshot()), 'Identical terrain changed physics/history');
      }
      sim.enqueueInput(regionalQualificationInput(tick));
      if (tick === 73) {
        const before = sim.snapshot(),
          proposed = sim.proposeMission();
        sim.commitMission({ transaction: proposed.transaction, accepted: false });
        check(same(before, sim.snapshot()), 'Rejected terrain mission changed hidden state');
      }
      const result = sim.stepMission();
      if (tick < 50) for (const point of result.trace) minimumZ = Math.min(minimumZ, point.z);
      if (tick === 99) saved = sim.snapshot();
      if (tick === 149) landed = sim.telemetry();
      if ((tick + 1) % 10 === 0) hashes.push([tick + 1, sim.stateHash()]);
    }
    install(sim, frames[1]); // A final-boundary frame is part of replay and recovery.
    const record = sim.recording(),
      telemetry = sim.telemetry(),
      elapsedMs = performance.now() - started;
    check(minimumZ > 0, 'Regional wall collision tunneled');
    check(
      landed.terrain.grounded && landed.terrain.contacts > 0,
      'Regional landing did not resolve',
    );
    check(
      telemetry.position.y > landed.position.y + 0.5,
      'Regional aircraft could not take off after landing',
    );
    const replay = await replayAdvancedRecording(record),
      partial = await replayAdvancedRecording(record, { throughMission: 100 });
    check(same(replay.telemetry, telemetry), 'Regional replay diverged');
    for (const snapshot of [saved, partial.snapshot]) {
      sim.restore(snapshot);
      for (let tick = 100; tick < 200; tick++) {
        const index = regionalQualificationFrameAt(tick);
        if (index !== null) install(sim, frames[index]);
        sim.enqueueInput(regionalQualificationInput(tick));
        sim.stepMission();
      }
      install(sim, frames[1]);
      check(same(record, sim.recording()), 'Regional frame recovery continuation diverged');
    }
    sim.reset();
    install(sim, frames[0]);
    check(sim.stateHash() === initialHash, 'Regional reset diverged');
    return {
      backend: ADVANCED_REGIONAL_BACKEND,
      initialHash,
      hashes,
      identity: record.identity,
      simulationIdentity: record.simulationIdentity,
      terrainIdentity: record.terrainIdentity,
      finalHash: record.finalHash,
      periodicHashes: record.hashes,
      consumedInputs: record.inputs,
      finalTelemetry: telemetry,
      geometry: {
        colliders: record.terrainColliders.length,
        frames: record.terrainFrames.length,
        events: record.terrainEvents,
      },
      contact: { minimumZ, landedHeight: landed.position.y, landed: true, takeoff: true },
      checks: {
        frameRollback: true,
        identicalFrameNoop: true,
        missionRollback: true,
        fullReplay: true,
        partialRecovery: true,
        snapshotContinuation: true,
        reset: true,
      },
      elapsedMs,
      capacity: 4000 / elapsedMs,
    };
  } finally {
    sim.dispose();
  }
}
export async function runAdvancedRegionalWorkerQualification() {
  let client = createAdvancedWorkerClient();
  const frames = regionalQualificationFrames();
  const install = async (frame) => {
    const staged = await client.stageTerrainFrame(frame);
    await client.commitTerrainFrame({ transaction: staged.transaction, accepted: true });
  };
  try {
    await client.initialize(regionalQualificationOptions());
    await install(frames[0]);
    const initial = await client.snapshot();
    let saved;
    const started = performance.now();
    for (let tick = 0; tick < 200; tick++) {
      const index = regionalQualificationFrameAt(tick);
      if (tick && index !== null) await install(frames[index]);
      if (tick === 43) {
        const before = await client.snapshot(),
          stage = await client.stageTerrainFrame(frames[2]);
        await client.commitTerrainFrame({ transaction: stage.transaction, accepted: false });
        check(same(before, await client.snapshot()), 'Worker frame rollback diverged');
      }
      await client.step(regionalQualificationInput(tick));
      if (tick === 99) {
        saved = await client.snapshot();
        await new Promise((resolve) => setTimeout(resolve, 40));
        check(same(saved, await client.snapshot()), 'Paused Regional worker advanced');
      }
    }
    await install(frames[1]);
    const record = await client.recording(),
      telemetry = await client.telemetry(),
      elapsedMs = performance.now() - started;
    await client.reset();
    await install(frames[0]);
    check(same(initial, await client.snapshot()), 'Regional worker reset diverged');
    const outstanding = client.request('snapshot').then(
      () => false,
      () => true,
    );
    client.dispose();
    check(await outstanding, 'Regional interruption retained pending request');
    client = createAdvancedWorkerClient();
    await client.initialize(regionalQualificationOptions());
    await client.restore(saved);
    for (let tick = 100; tick < 200; tick++) {
      const index = regionalQualificationFrameAt(tick);
      if (index !== null) await install(frames[index]);
      await client.step(regionalQualificationInput(tick));
    }
    await install(frames[1]);
    check(same(record, await client.recording()), 'Regional interrupted worker recovery diverged');
    return {
      simulationIdentity: record.simulationIdentity,
      terrainIdentity: record.terrainIdentity,
      finalHash: record.finalHash,
      periodicHashes: record.hashes,
      consumedInputs: record.inputs,
      finalTelemetry: telemetry,
      elapsedMs,
      capacity: 4000 / elapsedMs,
      checks: {
        realModuleWorker: true,
        terrainFrameRollback: true,
        pause: true,
        reset: true,
        interruption: true,
        recovery: true,
      },
    };
  } finally {
    client.dispose();
  }
}
export function compareRegionalRuntimes(baseline, candidate) {
  const fields = Object.keys(baseline).filter((key) => !['elapsedMs', 'capacity'].includes(key));
  const differences = fields.filter((key) => !same(baseline[key], candidate[key]));
  return { matched: differences.length === 0, differences };
}
