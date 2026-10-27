import { canonicalJSON } from '../../../game/data-json.mjs';
import { createPresetConfiguration } from '../../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { createAircraftTerrainFrame } from '../../../optional-practice/civilian-fpv/aircraft-terrain.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
  verifyAdvancedRecovery,
} from '../../../optional-practice/civilian-fpv/advanced-simulation.mjs';

export const REGIONAL_CASES = Object.freeze([
  Object.freeze({ preset: 'meteor75-analog-2022', mode: 'self-level' }),
  Object.freeze({ preset: 'nazgul-eco-xl5-v11', mode: 'acro' }),
]);
const ticks = 96;
const check = (value, message) => {
  if (!value) throw new Error(message);
};
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
export function regionalProtocolFrames() {
  const floor = {
    id: 'floor',
    vertices: [-20, 0, -20, -20, 0, 20, 20, 0, 20, 20, 0, -20],
    indices: [0, 1, 2, 0, 2, 3],
  };
  const wall = {
    id: 'wall',
    vertices: [-10, 0, -10, 10, 0, -10, 10, 10, -10, -10, 10, -10],
    indices: [0, 1, 2, 0, 2, 3],
  };
  const extension = {
    id: 'extension',
    vertices: [20, 0, -20, 20, 0, 20, 40, 0, 20, 40, 0, -20],
    indices: [0, 1, 2, 0, 2, 3],
  };
  return [
    createAircraftTerrainFrame({ sourceIdentity: '1111111111111111', colliders: [floor, wall] }),
    createAircraftTerrainFrame({
      sourceIdentity: '2222222222222222',
      colliders: [floor, wall, extension],
    }),
    createAircraftTerrainFrame({
      sourceIdentity: '3333333333333333',
      colliders: [floor, extension],
    }),
  ];
}
export function regionalProtocolOptions(item) {
  check(
    REGIONAL_CASES.some((row) => same(row, item)),
    'Unknown Regional protocol case',
  );
  return {
    ...createPresetConfiguration(item.preset),
    mode: item.mode,
    frequency: 1000,
    floor: false,
    terrain: { format: 'AdvancedRegionalTerrain.v1' },
    spawn: { x: 0, y: 0.5, z: 0 },
    // Exercise real accepted-boundary byte rotation without simulating 60 seconds.
    recordingOptions: { segmentBytes: 2048, maxSegments: 3, maxBytes: 2 * 1024 * 1024 },
  };
}
export function directRegionalClient() {
  let sim,
    closed = false;
  return {
    async initialize(options) {
      check(!closed && !sim, 'Direct Regional owner is closed or already initialized');
      await initAdvancedRuntime();
      check(!closed, 'Direct Regional owner is closed');
      sim = createAdvancedSimulation(options);
      return { telemetry: sim.telemetry() };
    },
    async input(sample) {
      sim.enqueueInput(sample);
    },
    async step(sample) {
      if (sample) sim.enqueueInput(sample);
      return sim.stepMission();
    },
    async propose() {
      return sim.proposeMission();
    },
    async commit(decision) {
      return sim.commitMission(decision);
    },
    async stageTerrainFrame(frame) {
      return sim.stageTerrainFrame(frame);
    },
    async commitTerrainFrame(decision) {
      return sim.commitTerrainFrame(decision);
    },
    async snapshot() {
      return sim.snapshot();
    },
    async restore(saved) {
      check(!closed, 'Direct Regional owner is closed');
      const verified = await verifyAdvancedRecovery(saved);
      check(!closed, 'Direct Regional owner is closed');
      return sim.restore(verified);
    },
    async readSealedSegment(index) {
      return sim.readSealedSegment(index);
    },
    async reset() {
      return sim.reset();
    },
    dispose() {
      if (closed) return;
      closed = true;
      sim?.dispose();
    },
  };
}

/** One awaited request at a time. A fresh owner restores the actual checkpoint;
 * rollback comparisons include queued/consumed input, motors and recording data. */
export async function runRegionalProtocolCase(
  item,
  {
    createClient = directRegionalClient,
    signal,
    onProgress = () => {},
    pause = () => new Promise((resolve) => setTimeout(resolve, 30)),
  } = {},
) {
  const frames = regionalProtocolFrames(),
    options = regionalProtocolOptions(item);
  let client,
    pending = 0,
    peakPending = 0,
    maxObservedInputPending = 0,
    owners = 0,
    disposed = 0;
  const stop = () => {
    if (client) {
      const owned = client;
      client = null;
      owned.dispose();
      disposed++;
    }
  };
  const cancelled = () => signal?.throwIfAborted();
  const call = async (method, ...args) => {
    cancelled();
    check(client, 'Regional owner is closed');
    pending++;
    peakPending = Math.max(peakPending, pending);
    try {
      const value = await client[method](...args);
      cancelled();
      if (method === 'snapshot') {
        maxObservedInputPending = Math.max(
          maxObservedInputPending,
          value.checkpoint.pending.length,
        );
        check(value.checkpoint.pending.length <= 1, 'Observed input queue exceeded fixture bound');
      }
      return value;
    } catch (error) {
      cancelled();
      throw error;
    } finally {
      pending--;
    }
  };
  const open = async () => {
    cancelled();
    client = createClient();
    owners++;
    await call('initialize', options);
  };
  const install = async (frame, accepted = true) => {
    const stage = await call('stageTerrainFrame', frame);
    await call('commitTerrainFrame', { transaction: stage.transaction, accepted });
    return stage;
  };
  const input = (tick) => ({
    sequence: tick,
    timestampUs: tick * 20000,
    controls: {
      roll: tick >= 40 && tick < 45 ? 0.03 : 0,
      pitch: tick >= 55 && tick < 60 ? -0.025 : 0,
      yaw: tick >= 70 ? 0.04 : 0,
      throttle: tick < 20 ? 0 : 0.55,
    },
  });
  const frameAt = (tick) => (tick === 20 ? 1 : tick === 48 ? 2 : tick === 72 ? 0 : null);
  signal?.addEventListener('abort', stop, { once: true });
  try {
    await open();
    await install(frames[0]);
    const initial = await call('snapshot');
    check(
      initial.config.backend === 'civilian-quad-aircraft-regional.v3' &&
        initial.config.frequency === 1000,
      'Fixture must use current Regional v3 at 1000 Hz',
    );
    let saved,
      rollbackAt = null,
      lastSealed = -1,
      maxRetained = 0,
      frameCommits = 1;
    const boundaries = [];
    const advance = async (tick) => {
      const index = frameAt(tick);
      if (index !== null) {
        await install(frames[index]);
        frameCommits++;
      }
      await call('step', input(tick));
    };
    for (let tick = 0; tick < ticks; tick++) {
      await advance(tick);
      const archive = await call('readSealedSegment', lastSealed);
      check(!archive.gap, 'Fixture lost an unread sealed segment');
      if (archive.segment) {
        lastSealed = archive.segment.index;
        boundaries.push([archive.segment.endTick, archive.segment.finalHash]);
      }
      if (rollbackAt === null && tick >= 20 && archive.segment?.endTick === tick + 1) {
        rollbackAt = tick + 1;
        const beforeTerrain = await call('snapshot');
        await install(frames[2], false);
        check(
          same(beforeTerrain, await call('snapshot')),
          'Rejected terrain changed accepted state/recording',
        );
        const currentFrame = beforeTerrain.checkpoint.terrain;
        const unchanged = await install(currentFrame);
        check(
          unchanged.unchanged && same(beforeTerrain, await call('snapshot')),
          'Identical terrain rebuilt or changed recording',
        );
        await call('input', input(tick + 1));
        const beforeMission = await call('snapshot'),
          proposed = await call('propose');
        check(beforeMission.checkpoint.pending.length === 1, 'Unexpected queued input at rollback');
        await call('commit', { transaction: proposed.transaction, accepted: false });
        check(
          same(beforeMission, await call('snapshot')),
          'Rejected mission changed input/controller/recording',
        );
        // The queued sample remains queued after rollback; consume it exactly once.
        const index = frameAt(tick + 1);
        if (index !== null) {
          await install(frames[index]);
          frameCommits++;
        }
        await call('step');
        tick++;
      }
      if (tick === 63) {
        saved = await call('snapshot');
        await pause();
        cancelled();
        check(same(saved, await call('snapshot')), 'Paused worker advanced');
      }
      if (tick % 16 === 15) {
        const current = await call('snapshot');
        maxRetained = Math.max(maxRetained, current.recordingStatus.retainedSegments);
        check(
          current.recordingStatus.retainedSegments <= 3 &&
            current.recordingStatus.retainedBytes <= 2 * 1024 * 1024,
          'Recorder exceeded fixture bounds',
        );
        onProgress({ preset: item.preset, phase: 'flight', tick: tick + 1, total: ticks });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    check(
      saved && rollbackAt !== null && boundaries.length >= 2,
      'Fixture did not exercise recovery and multiple segment boundaries',
    );
    const final = await call('snapshot');
    check(final.checkpoint.state.missionTick === ticks, 'Unexpected mission count');
    check(final.checkpoint.pending.length === 0, 'Final input queue was not consumed');
    const replay = await replayAdvancedRecording(final.recording, { signal });
    cancelled();
    check(
      replay.verified && replay.snapshot.hash === final.hash,
      'Regional retained-clip replay diverged',
    );
    stop();
    await open();
    await call('restore', saved);
    for (let tick = 64; tick < ticks; tick++) await advance(tick);
    const recovered = await call('snapshot');
    check(
      final.hash === recovered.hash &&
        same(final.checkpoint, recovered.checkpoint) &&
        same(final.recording, recovered.recording),
      'Fresh-worker recovery changed state, inputs or recording',
    );
    await call('reset');
    await install(frames[0]);
    check(same(initial, await call('snapshot')), 'Reset changed initial Regional state');
    const result = {
      ...item,
      backend: final.config.backend,
      frequency: final.config.frequency,
      identity: final.identity,
      finalHash: final.hash,
      recoveredHash: recovered.hash,
      acceptedSequence: final.checkpoint.state.acceptedSequence,
      consumedSequence: final.checkpoint.state.consumedSequence,
      consumedTimestampUs: final.checkpoint.state.consumedTimestampUs,
      finalState: final.checkpoint.state,
      finalController: final.checkpoint.controller,
      maxObservedInputPending,
      boundaries,
      rollbackAt,
      frameCommits,
      peakPending,
      maxRetained,
      replayScope: replay.verificationScope,
      retainedClipReplayExecutor: 'caller-thread',
      retainedFromTick: final.recording.startMissionTick,
      throughTick: ticks,
      owners,
      checks: {
        terrainRollback: true,
        missionRollback: true,
        identicalFrame: true,
        pause: true,
        reset: true,
        newOwnerRecovery: true,
        retainedClipReplay: true,
      },
      scored: false,
      defaultEligible: false,
    };
    stop();
    check(owners === disposed && peakPending === 1, 'Worker owner or request bounds failed');
    return result;
  } finally {
    signal?.removeEventListener('abort', stop);
    stop();
  }
}
