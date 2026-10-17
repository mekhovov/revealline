import { canonicalJSON, required } from '../../game/data-json.mjs';
import { validateAircraftArchivePackage } from './aircraft-archive.mjs';
import { createAircraftSimulation, replayAircraftSegment } from './advanced-aircraft-runtime.mjs';
import { initWorldRuntime } from './world-collision.mjs';
import { createAdvancedWorkerClient } from './advanced-worker-client.mjs';
import {
  createAircraftChallengeProgress,
  validateAircraftChallengeRules,
} from './aircraft-challenge.mjs';

/** Browser entry point: cancellation and worker failures affect this detached
 * verifier only, never the worker that owns a currently flying aircraft. */
export async function verifyAircraftArchiveInWorker(
  source,
  { signal, onProgress, Worker, workerURL, verificationWatchdogMs } = {},
) {
  const cancelled = () => new DOMException('Aircraft archive verification cancelled', 'AbortError');
  if (signal?.aborted) throw cancelled();
  const checked = validateAircraftArchivePackage(source);
  const client = createAdvancedWorkerClient({
    ...(Worker === undefined ? {} : { Worker }),
    ...(workerURL === undefined ? {} : { url: workerURL }),
    ...(verificationWatchdogMs === undefined ? {} : { verificationWatchdogMs }),
  });
  const abort = () => client.dispose(cancelled());
  signal?.addEventListener('abort', abort, { once: true });
  try {
    if (signal?.aborted) throw cancelled();
    await client.initialize({
      ...checked.manifest.config,
      numericalReference: checked.manifest.config.frequency === 2000,
      recording: false,
    });
    return await client.verifyArchive(checked, { onProgress });
  } finally {
    signal?.removeEventListener('abort', abort);
    client.dispose();
  }
}

/** Verify bounded archives sequentially. A single simulator and the current
 * segment are sufficient; no historical telemetry or ghost path is collected. */
export async function verifyAircraftArchive(source, { signal, onProgress } = {}) {
  const cancelled = () => {
    if (signal?.aborted)
      throw new DOMException('Aircraft archive verification cancelled', 'AbortError');
  };
  cancelled();
  const { manifest, segments } = validateAircraftArchivePackage(source);
  required(segments.length > 0, 'Aircraft archive has no saved flight segments');
  await initWorldRuntime();
  cancelled();
  const simulation = createAircraftSimulation({
    ...manifest.config,
    numericalReference: manifest.config.frequency === 2000,
    recording: false,
  });
  try {
    required(simulation.identity === manifest.identity, 'Aircraft archive configuration changed');
    const first = segments[0];
    const canonicalOrigin =
      first.startTick === 0 &&
      first.index === 0 &&
      first.previous === null &&
      canonicalJSON(simulation.checkpoint()) === canonicalJSON(first.checkpoint) &&
      simulation.stateHash() === first.initialHash;
    const challengeRules =
      manifest.config.configuration.challenge === undefined
        ? null
        : validateAircraftChallengeRules(manifest.config.configuration.challenge);
    required(
      challengeRules?.kind !== 'battery-endurance' || manifest.config.aircraft.battery.depletion,
      'Battery endurance requires battery depletion',
    );
    const freshChallenge = manifest.origin.kind === 'fresh' && canonicalOrigin;
    const challenge =
      challengeRules && freshChallenge
        ? createAircraftChallengeProgress(challengeRules, {
            capacityAh: manifest.config.aircraft.battery.capacityAh,
          })
        : null;
    let verifiedSegments = 0;
    const report = (verifiedThroughMission) =>
      onProgress?.({
        verifiedSegments,
        totalSegments: segments.length,
        verifiedThroughMission,
        startMissionTick: manifest.startTick,
        missionTicks: manifest.endTick,
      });
    simulation.restoreCheckpoint(first.checkpoint);
    report(manifest.startTick);
    for (const segment of segments) {
      cancelled();
      required(
        canonicalJSON(simulation.checkpoint()) === canonicalJSON(segment.checkpoint),
        'Aircraft archive checkpoint changed between segments',
      );
      required(
        simulation.stateHash() === segment.initialHash,
        'Aircraft archive starting hash changed',
      );
      await replayAircraftSegment(simulation, segment, {
        frequency: manifest.config.frequency,
        signal,
        yieldEvery: 25,
        onMissionTelemetry: (telemetry) => {
          challenge?.advance(telemetry);
          if (telemetry.missionTick % 25 === 0) report(telemetry.missionTick);
        },
      });
      verifiedSegments++;
      report(segment.endTick);
    }
    cancelled();
    required(simulation.stateHash() === manifest.finalHash, 'Aircraft archive final hash changed');
    return {
      verified: true,
      verificationScope:
        manifest.state === 'ended' && manifest.origin.kind === 'fresh' && canonicalOrigin
          ? 'complete-session'
          : 'checkpoint-clip',
      startMissionTick: manifest.startTick,
      verifiedThroughMission: manifest.endTick,
      verifiedSegments,
      finalHash: manifest.finalHash,
      comparison: simulation.comparison(),
      experimental: true,
      scored: false,
      ...(challengeRules
        ? {
            challenge: challenge
              ? {
                  verified: Boolean(challenge.snapshot().result),
                  progress: challenge.snapshot(),
                  scored: false,
                  ...(challenge.snapshot().result ? {} : { reason: 'incomplete-challenge' }),
                }
              : { verified: false, reason: 'checkpoint-origin', scored: false },
          }
        : {}),
    };
  } catch (error) {
    cancelled();
    throw error;
  } finally {
    simulation.dispose();
  }
}
