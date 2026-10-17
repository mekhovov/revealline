import { boundedJSON } from '../../game/data-json.mjs';
import { AIRCRAFT_RECORDING_FORMAT, AIRCRAFT_RECORDING_BYTES } from './aircraft-recording.mjs';
import { AIRCRAFT_BACKEND } from './advanced-aircraft-runtime.mjs';
import {
  ADVANCED_BACKEND,
  ADVANCED_RECORDING_BYTES,
  AdvancedFlightLimitError,
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
  verifyAdvancedRecovery,
} from './advanced-simulation.mjs';

/** Serial request processing keeps init, steps and restores in one ownership
 * order. Device polling belongs to the window; this worker never calls it. */
export function createAdvancedWorkerHandler(postMessage) {
  let simulation = null,
    session = null,
    queue = Promise.resolve();
  async function execute(message) {
    const { id, session: requestSession, type } = message ?? {};
    if (
      !Number.isSafeInteger(id) ||
      typeof requestSession !== 'string' ||
      requestSession.length > 100
    )
      return;
    try {
      let result;
      if (type === 'init') {
        await initAdvancedRuntime();
        const next = createAdvancedSimulation(message.options);
        simulation?.dispose();
        simulation = next;
        session = requestSession;
        result = {
          identity: simulation.identity,
          qualification: simulation.qualification(),
          capabilities: simulation.controllerCapabilities(),
          telemetry: simulation.telemetry(),
          comparison: simulation.comparison(),
        };
      } else {
        if (!simulation || requestSession !== session)
          throw new Error('Stale or uninitialized Advanced worker session');
        switch (type) {
          case 'input':
            simulation.enqueueInput(message.sample);
            result = { accepted: true };
            break;
          case 'step':
            if (message.sample) simulation.enqueueInput(message.sample);
            result = simulation.stepMission({ motions: message.motions });
            break;
          case 'propose':
            if (message.sample) simulation.enqueueInput(message.sample);
            result = simulation.proposeMission({ motions: message.motions });
            break;
          case 'commit':
            result = simulation.commitMission(message.decision);
            break;
          case 'stage-terrain':
            result = simulation.stageTerrainFrame(message.frame);
            break;
          case 'commit-terrain':
            result = simulation.commitTerrainFrame(message.decision);
            break;
          case 'telemetry':
            result = simulation.telemetry();
            break;
          case 'snapshot':
            result = simulation.snapshot();
            break;
          case 'restore': {
            const receivingSimulation = simulation;
            const saved = await verifyAdvancedRecovery(message.snapshot, {
              expectedIdentity: receivingSimulation.identity,
            });
            if (simulation !== receivingSimulation || session !== requestSession)
              throw new Error('Advanced recovery was cancelled.');
            result = receivingSimulation.restore(saved);
            break;
          }
          case 'recording':
            result = simulation.recording();
            break;
          case 'recording-status':
            result = simulation.recordingStatus?.() ?? null;
            break;
          case 'recording-persistence':
            result = simulation.reportPersistence?.(message.status) ?? null;
            break;
          case 'verify-recording': {
            const record = boundedJSON(message.recording, {
              maxBytes: AIRCRAFT_RECORDING_BYTES,
              maxNodes: 3000000,
              maxArray: 500000,
              maxString: 12 * 1024 * 1024,
              maxDepth: 40,
            });
            if (
              !['AdvancedRecording.v1', AIRCRAFT_RECORDING_FORMAT].includes(record.format) ||
              ![ADVANCED_BACKEND, AIRCRAFT_BACKEND].includes(simulation.configuration().backend)
            )
              throw new Error('Comparison ghosts require an Advanced reference arena recording.');
            if (!(record.missionTicks > 0))
              throw new Error('Comparison recording has no flight samples.');
            const path = [];
            const checked = await replayAdvancedRecording(record, {
              onMissionTelemetry(sample) {
                path.push([
                  sample.missionTick,
                  sample.position.x,
                  sample.position.y,
                  sample.position.z,
                  sample.orientation.x,
                  sample.orientation.y,
                  sample.orientation.z,
                  sample.orientation.w,
                ]);
              },
            });
            if (
              !['complete', 'checkpoint-clip'].includes(checked.verificationScope) ||
              !checked.verified
            )
              throw new Error('Comparison recording was not completely verified.');
            const reference = simulation.comparison();
            if (checked.comparison.comparisonClass !== reference.comparisonClass)
              throw new Error(
                'Comparison requires the same aircraft, controller, throttle, timing and arena. Rotation rates may differ.',
              );
            if (path.length !== record.missionTicks - (record.startMissionTick ?? 0) + 1)
              throw new Error('Verified comparison path is incomplete.');
            result = {
              verified: true,
              scored: false,
              comparison: checked.comparison,
              missionTicks: record.missionTicks,
              startMissionTick: record.startMissionTick ?? 0,
              verificationScope: checked.verificationScope,
              path,
            };
            break;
          }
          case 'reset':
            simulation.reset();
            result = simulation.telemetry();
            break;
          case 'dispose':
            simulation.dispose();
            simulation = null;
            session = null;
            result = { disposed: true };
            break;
          default:
            throw new Error('Unknown Advanced worker request');
        }
      }
      postMessage({ id, session: requestSession, result });
    } catch (error) {
      postMessage({
        id,
        session: requestSession,
        error: error instanceof Error ? error.message : 'Advanced worker failed',
        ...(error instanceof AdvancedFlightLimitError &&
        ['ADVANCED_DURATION_LIMIT', 'ADVANCED_RECORDING_LIMIT'].includes(error.code)
          ? { code: error.code }
          : {}),
      });
    }
  }
  return {
    receive(message) {
      queue = queue.then(() => execute(message));
      return queue;
    },
    dispose() {
      simulation?.dispose();
      simulation = null;
      session = null;
    },
  };
}

if (typeof self !== 'undefined' && typeof document === 'undefined') {
  const handler = createAdvancedWorkerHandler((message) => self.postMessage(message));
  self.addEventListener('message', ({ data }) => {
    void handler.receive(data);
  });
}
