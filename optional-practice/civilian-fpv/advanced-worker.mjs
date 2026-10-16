import { createAdvancedSimulation, initAdvancedRuntime } from './advanced-simulation.mjs';

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
            result = simulation.stepMission();
            break;
          case 'propose':
            if (message.sample) simulation.enqueueInput(message.sample);
            result = simulation.proposeMission();
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
          case 'restore':
            result = simulation.restore(message.snapshot);
            break;
          case 'recording':
            result = simulation.recording();
            break;
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
