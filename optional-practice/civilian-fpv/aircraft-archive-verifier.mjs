import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
} from '../../game/data-json.mjs';
import { validateAircraftArchivePackage } from './aircraft-archive.mjs';
import { createAircraftSimulation, replayAircraftSegment } from './advanced-aircraft-runtime.mjs';
import { initWorldRuntime } from './world-collision.mjs';
import { validateFlightCourse, createFlight } from './model.mjs';
import { createAircraftCourseSession } from './aircraft-course-session.mjs';
import { createAdvancedSimulation } from './advanced-simulation.mjs';
import { createPracticeSectorObserver } from './flight-sectors.mjs';
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

// Course reconstruction stays separate from physical archive verification.
// Adapters are native construction dependencies, never worker-message values.
export const STATIC_COURSE_VERIFIER = 'AircraftStaticCourseVerification.v1';
const models = ['aircraft-course-practice.v1', 'aircraft-course-practice.v2'];
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const fail = (code) => {
  throw Object.assign(new Error(code), { code });
};
const requireValue = (value, code) => {
  if (!value) fail(code);
};
const cancelled = (signal) => {
  if (signal?.aborted) throw new DOMException('Static course verification cancelled', 'AbortError');
};
const boundedCourse = (source) =>
  boundedJSON(source, {
    maxBytes: 4 * 1024 * 1024,
    maxNodes: 200000,
    maxArray: 60000,
    maxDepth: 12,
  });
function courseDependency(source, extra) {
  requireValue(source !== null && source !== undefined, 'missing-course-dependency');
  const value = boundedCourse(source);
  const adapter =
    value.format === 'FlightCourse.v1'
      ? { validate: validateFlightCourse, createMission: createFlight }
      : extra?.format === value.format
        ? extra
        : null;
  requireValue(
    adapter &&
      typeof adapter.validate === 'function' &&
      typeof adapter.createMission === 'function',
    'unsupported-course-format',
  );
  return { course: adapter.validate(value), createMission: adapter.createMission };
}

export function aircraftCourseMissionModel(config) {
  const adapter = config.configuration?.missionAdapter;
  if (adapter === undefined) return models[0];
  requireValue(adapter?.format === 'AircraftCourseMission.v2', 'unsupported-mission-adapter');
  exactKeys(adapter, ['format', 'floorHeightMm'], 'Static course mission adapter');
  requireValue(Number.isSafeInteger(adapter.floorHeightMm), 'invalid-mission-floor');
  return models[1];
}

function supportedCourse(archive, dep) {
  const { config, host } = archive.manifest,
    course = dep.course;
  requireValue(['academy', 'world'].includes(host), 'unsupported-archive-host');
  requireValue(
    config.configuration?.environment?.host ===
      (course.format === 'FlightCourse.v1' ? 'academy' : 'world'),
    'course-family-mismatch',
  );
  requireValue(
    !course.actors?.length && !config.dynamicColliders?.length,
    'unsupported-dynamic-course',
  );
  requireValue(
    Object.values(course.steps).every((steps) =>
      steps.every((step) => ['hold', 'gate', 'land'].includes(step.type)),
    ),
    'unsupported-course-objective',
  );
  requireValue(config.configuration.challenge === undefined, 'unsupported-challenge-wrapper');
  requireValue(
    config.frequency === 500 &&
      ['civilian-quad-aircraft-regional.v1', 'civilian-quad-aircraft-regional.v2'].includes(
        config.backend,
      ),
    'unsupported-session-backend',
  );
  if (dep.missionModel === models[1])
    requireValue(
      config.configuration.missionAdapter.floorHeightMm === course.bounds.min.y,
      'mission-floor-mismatch',
    );
}

/** Traverse one segment at a time without expanding a clock into an input array. */
export function createStaticCourseInputCursor(segments, frequency = 500) {
  requireValue(
    Array.isArray(segments) && segments.length > 0 && segments.length <= 256 && frequency === 500,
    'unsupported-input-schedule',
  );
  let segmentIndex = 0,
    eventIndex = 0,
    tick = 0,
    terrain;
  const first = segments[0];
  requireValue(first.startTick === 0, 'course-needs-canonical-reset');
  const event = first.events[0];
  requireValue(
    Array.isArray(event) && event.length === 3 && event[0] === 'terrain' && event[1] === 0,
    'missing-generated-terrain',
  );
  terrain = event[2];
  eventIndex++;
  return {
    terrain: () => terrain,
    next() {
      if (segmentIndex >= segments.length) return null;
      const segment = segments[segmentIndex];
      requireValue(
        Number.isSafeInteger(segment.endTick) && segment.endTick > tick,
        'invalid-course-clock',
      );
      const item = segment.events[eventIndex++];
      requireValue(
        Array.isArray(item) &&
          item.length === 8 &&
          item[0] === 'input' &&
          item[1] === tick * (frequency / 50) &&
          item[2] === tick &&
          item[3] === tick * 20000 &&
          Number.isSafeInteger(item[3]) &&
          item.slice(4).every(Number.isFinite) &&
          item.slice(4, 7).every((n) => n >= -1 && n <= 1) &&
          item[7] >= 0 &&
          item[7] <= 1,
        'unsupported-input-schedule',
      );
      const command = { roll: item[4], pitch: item[5], yaw: item[6], throttle: item[7] };
      tick++;
      const boundary = tick === segment.endTick;
      if (boundary) {
        requireValue(eventIndex === segment.events.length, 'unsupported-course-events');
        segmentIndex++;
        eventIndex = 0;
        if (segmentIndex < segments.length)
          requireValue(segments[segmentIndex].startTick === tick, 'course-segment-gap');
      }
      return { command, tick, segmentIndex: boundary ? segmentIndex - 1 : segmentIndex, boundary };
    },
  };
}

/** Two independent passes. No result is admitted to production comparison or awards. */
export async function verifyAircraftCourseArchive(
  archiveSource,
  courseSource,
  { signal, onProgress = () => {}, courseAdapter } = {},
) {
  cancelled(signal);
  const archive = validateAircraftArchivePackage(archiveSource);
  const physics = await verifyAircraftArchive(archive, {
    signal,
    onProgress: (progress) => onProgress({ phase: 'physics', ...progress }),
  });
  const report = {
    format: STATIC_COURSE_VERIFIER,
    scored: false,
    physics: {
      verified: true,
      verificationScope: physics.verificationScope,
      finalHash: physics.finalHash,
      verifiedThroughMission: physics.verifiedThroughMission,
    },
    course: { verified: false, reason: 'incomplete-course' },
  };
  let session, simulation;
  try {
    report.missionModel = aircraftCourseMissionModel(archive.manifest.config);
    requireValue(
      physics.verificationScope === 'complete-session',
      'course-needs-complete-reset-session',
    );
    const dep = {
      ...courseDependency(courseSource, courseAdapter),
      missionModel: report.missionModel,
    };
    requireValue(
      dataIdentity(dep.course) === archive.manifest.config.configuration?.environment?.course,
      'course-identity-mismatch',
    );
    supportedCourse(archive, dep);
    const { config } = archive.manifest,
      cursor = createStaticCourseInputCursor(archive.segments);
    const client = {
      async initialize(options) {
        // Backend is the one explicit historical numerical selector. Other
        // configuration must be reproduced by the ordinary course session.
        simulation = createAdvancedSimulation({
          ...options,
          backend: config.backend,
          recording: false,
        });
        requireValue(
          same(simulation.configuration(), config),
          'noncanonical-session-configuration',
        );
        requireValue(
          same(simulation.checkpoint(), archive.segments[0].checkpoint) &&
            simulation.stateHash() === archive.segments[0].initialHash,
          'noncanonical-session-reset',
        );
        return { telemetry: simulation.telemetry() };
      },
      async stageTerrainFrame(frame) {
        requireValue(same(frame, cursor.terrain()), 'generated-terrain-mismatch');
        return simulation.stageTerrainFrame(frame);
      },
      async commitTerrainFrame(decision) {
        return simulation.commitTerrainFrame(decision);
      },
      async step(sample, motions) {
        requireValue(!motions?.length, 'unsupported-dynamic-course');
        simulation.enqueueInput(sample);
        return simulation.stepMission({ motions });
      },
      dispose() {
        simulation?.dispose();
        simulation = null;
      },
    };
    session = createAircraftCourseSession(
      {
        course: dep.course,
        mode: config.response.mode,
        legacy: dep.course.format === 'FlightCourse.v1',
        model: dep.missionModel,
        configuration: {
          advanced: { aircraft: config.aircraft, controller: config.controller },
          response: config.configuration.response,
        },
      },
      {
        createClient: () => client,
        createMission: dep.createMission,
      },
    );
    await session.prepare();
    cancelled(signal);
    const observer = createPracticeSectorObserver();
    observer.reset(session.snapshot());
    session.arm();
    let item,
      completedAtTick = null,
      segmentCount = 0,
      hashIndex = 0;
    while ((item = cursor.next())) {
      cancelled(signal);
      const state = await session.step(item.command);
      requireValue(
        state.ticks === item.tick && observer.consume(state),
        'course-mission-clock-mismatch',
      );
      const segment = archive.segments[item.segmentIndex];
      if (segment.hashes[hashIndex]?.[0] === item.tick) {
        requireValue(
          simulation.stateHash() === segment.hashes[hashIndex++][1],
          'course-periodic-hash-mismatch',
        );
      }
      if (completedAtTick === null && state.step === state.total) completedAtTick = state.ticks;
      if (item.boundary) {
        requireValue(
          hashIndex === segment.hashes.length && simulation.stateHash() === segment.finalHash,
          'course-segment-final-mismatch',
        );
        const next = archive.segments[item.segmentIndex + 1];
        if (next)
          requireValue(
            same(simulation.checkpoint(), next.checkpoint),
            'course-segment-checkpoint-mismatch',
          );
        segmentCount++;
        hashIndex = 0;
      }
      if (item.tick % 25 === 0 || item.boundary) {
        onProgress({
          phase: 'course',
          verifiedThroughMission: item.tick,
          totalMissionTicks: archive.manifest.endTick,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    cancelled(signal);
    requireValue(
      simulation.stateHash() === archive.manifest.finalHash &&
        session.snapshot().ticks === archive.manifest.endTick,
      'course-final-mismatch',
    );
    report.course = {
      verified: completedAtTick !== null,
      ...(completedAtTick === null ? { reason: 'incomplete-course' } : {}),
      mode: config.response.mode,
      completedAtTick,
      missionHz: 50,
      verifiedSegments: segmentCount,
      verifiedThroughMission: archive.manifest.endTick,
      splits: observer.snapshot().rows,
    };
  } catch (error) {
    cancelled(signal);
    if (!error.code) throw error;
    report.course = { verified: false, reason: error.code };
  } finally {
    await session?.dispose();
    simulation?.dispose();
  }
  cancelled(signal);
  return report;
}

/** Dedicated, cancellable course proof; never grants scored comparison eligibility. */
export async function verifyAircraftCourseArchiveInWorker(
  source,
  courseSource,
  { signal, onProgress, Worker, workerURL, verificationWatchdogMs } = {},
) {
  const cancelled = () => new DOMException('Aircraft archive verification cancelled', 'AbortError');
  if (signal?.aborted) throw cancelled();
  const checked = validateAircraftArchivePackage(source);
  const course = courseSource == null ? null : boundedCourse(courseSource);
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
    return await client.verifyCourseArchive(checked, course, { onProgress });
  } finally {
    signal?.removeEventListener('abort', abort);
    client.dispose();
  }
}
