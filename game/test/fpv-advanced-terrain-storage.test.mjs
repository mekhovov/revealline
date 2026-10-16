import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADVANCED_MAX_SECONDS,
  ADVANCED_RECORDING_BYTES,
  ADVANCED_REGIONAL_RECOVERY_BYTES,
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
  verifyAdvancedRecovery,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createAdvancedTerrainFrame } from '../../optional-practice/civilian-fpv/advanced-terrain.mjs';
const size = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const adopt = (sim, frame) => {
  const staged = sim.stageTerrainFrame(frame);
  sim.commitTerrainFrame({ transaction: staged.transaction, accepted: true });
};
test(
  'twelve-minute changing input and streamed frames export, replay and recover under shared quotas',
  { timeout: 180000 },
  async (t) => {
    await initAdvancedRuntime();
    const floor = { id: 'terrain-common', vertices: [], indices: [] };
    for (let z = 0; z <= 16; z++)
      for (let x = 0; x <= 16; x++) floor.vertices.push((x - 8) * 100, 0, (z - 8) * 100);
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const a = z * 17 + x;
        floor.indices.push(a, a + 17, a + 18, a, a + 18, a + 1);
      }
    const frames = Array.from({ length: 64 }, (_, i) =>
      createAdvancedTerrainFrame({
        sourceIdentity: (i + 1).toString(16).padStart(16, '0'),
        colliders: [
          floor,
          {
            id: `tile-${i}`,
            vertices: [1000 + i * 10, 0, 0, 1000 + i * 10, 0, 10, 1010 + i * 10, 0, 10],
            indices: [0, 1, 2],
          },
        ],
      }),
    );
    const sim = createAdvancedSimulation({
      floor: false,
      terrain: { format: 'AdvancedRegionalTerrain.v1' },
      spawn: { x: 0, y: 1, z: 0 },
    });
    let sequence = 0,
      seed = 32456789;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    try {
      for (let tick = 0; tick < ADVANCED_MAX_SECONDS * 50; tick++) {
        if (tick % 100 === 0) adopt(sim, frames[(tick / 100) % frames.length]);
        while (Math.floor((sequence * 1000000) / 60) < (tick + 1) * 20000) {
          sim.enqueueInput({
            sequence,
            timestampUs: Math.floor((sequence * 1000000) / 60),
            controls: {
              roll: (random() - 0.5) * 0.002,
              pitch: (random() - 0.5) * 0.002,
              yaw: (random() - 0.5) * 0.002,
              throttle: random() * 0.05,
            },
          });
          sequence++;
        }
        sim.stepMission();
      }
      const record = sim.recording(),
        snapshot = sim.snapshot(),
        envelope = {
          format: 'AdvancedRegionalRecovery.v1',
          environment: { fixture: 'storage' },
          simulation: snapshot,
        },
        exported = JSON.stringify(record);
      assert.equal(record.inputs.length, 43200);
      assert.equal(record.terrainColliders.length, 65);
      assert.equal(record.terrainFrames.length, 64);
      assert.equal(record.terrainEvents.length, 360);
      assert.equal(record.checkpoints.length, 24);
      assert.ok(
        record.checkpoints.every(
          (value) =>
            value.format === 'AdvancedRegionalCheckpoint.v1' && !value.world && !value.recording,
        ),
      );
      assert.ok(size(record) < ADVANCED_RECORDING_BYTES);
      assert.ok(size(envelope) < ADVANCED_REGIONAL_RECOVERY_BYTES);
      const telemetry = sim.telemetry();
      const verificationStarted = performance.now();
      sim.restore(await verifyAdvancedRecovery(JSON.stringify(snapshot)));
      const recoveryVerificationMs = performance.now() - verificationStarted;
      assert.deepEqual(sim.telemetry(), telemetry);
      const replay = await replayAdvancedRecording(exported);
      assert.deepEqual(replay.telemetry, telemetry);
      const recovered = await replayAdvancedRecording(exported, { throughMission: 1500 });
      sim.restore(recovered.snapshot);
      assert.equal(sim.telemetry().missionTick, 1500);
      assert.equal(sim.stepMission().admitted, true);
      t.diagnostic(
        JSON.stringify({
          recordingBytes: size(record),
          recoveryBytes: size(envelope),
          colliderDefinitions: 65,
          frameDefinitions: 64,
          frameEvents: 360,
          inputs: 43200,
          checkpoints: 24,
          maximumSeconds: ADVANCED_MAX_SECONDS,
          recoveryVerificationMs,
        }),
      );
    } finally {
      sim.dispose();
    }
  },
);
