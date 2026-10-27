import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADVANCED_MAX_SECONDS,
  ADVANCED_RECORDING_BYTES,
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';

test(
  'maximum twelve-minute changing 60 Hz input flight exports, verifies and recovers within quota',
  { timeout: 120000 },
  async () => {
    await initAdvancedRuntime();
    const sim = createAdvancedSimulation({ floor: false, gravity: { x: 0, y: 0, z: 0 } });
    let sequence = 0,
      seed = 32456789;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    try {
      for (let tick = 0; tick < ADVANCED_MAX_SECONDS * 50; tick++) {
        while (Math.floor((sequence * 1000000) / 60) < (tick + 1) * 20000) {
          sim.enqueueInput({
            sequence,
            timestampUs: Math.floor((sequence * 1000000) / 60),
            controls: {
              roll: (random() - 0.5) * 0.02,
              pitch: (random() - 0.5) * 0.02,
              yaw: (random() - 0.5) * 0.02,
              throttle: 0.3 + random() * 0.2,
            },
          });
          sequence++;
        }
        sim.stepMission();
      }
      const record = sim.recording(),
        exported = JSON.stringify(record);
      assert.equal(record.missionTicks, 36000);
      assert.equal(record.inputs.length, 43200);
      assert.equal(record.hashes.length, 720);
      assert.equal(record.checkpoints.length, 24);
      assert.ok(new TextEncoder().encode(exported).byteLength < ADVANCED_RECORDING_BYTES);
      assert.ok(
        record.checkpoints.every(
          (checkpoint) => !checkpoint.recording && checkpoint.pending.length === 0,
        ),
      );
      assert.throws(() => sim.stepMission(), { code: 'ADVANCED_DURATION_LIMIT' });
      assert.throws(() => sim.proposeMission(), { code: 'ADVANCED_DURATION_LIMIT' });
      const replay = await replayAdvancedRecording(exported);
      assert.equal(replay.verified, true);
      assert.deepEqual(replay.telemetry, sim.telemetry());
      const recovered = await replayAdvancedRecording(exported, { throughMission: 1500 });
      sim.restore(recovered.snapshot);
      assert.equal(sim.telemetry().missionTick, 1500);
      assert.equal(sim.stateHash(), record.hashes[29][1]);
      assert.equal(sim.stepMission().admitted, true);
    } finally {
      sim.dispose();
    }
  },
);
