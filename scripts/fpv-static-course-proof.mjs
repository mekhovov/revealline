#!/usr/bin/env node
/** Offline diagnostic tooling only. Not imported by either simulator or its workers. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { open, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { boundedJSON, canonicalJSON, dataIdentity, exactKeys } from '../game/data-json.mjs';
import { validateFlightCourse, createFlight } from '../optional-practice/civilian-fpv/model.mjs';
import {
  validateWorldCourse,
  createWorldFlight,
} from '../optional-practice/civilian-fpv/world-model.mjs';
import { createAircraftCourseSession } from '../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import { createAdvancedSimulation } from '../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  validateAircraftArchivePackage,
  AIRCRAFT_ARCHIVE_PACKAGE_BYTES,
} from '../optional-practice/civilian-fpv/aircraft-archive.mjs';
import { verifyAircraftArchive } from '../optional-practice/civilian-fpv/aircraft-archive-verifier.mjs';
import { createPracticeSectorObserver } from '../optional-practice/civilian-fpv/flight-sectors.mjs';

export const STATIC_COURSE_VERIFIER = 'AircraftStaticCourseVerification.v1';
export const STATIC_COURSE_SIDECAR = 'AircraftStaticCourseDependency.v1';
export const STATIC_COURSE_SIDECAR_BYTES = 4 * 1024 * 1024 + 4096;
const verifiedReports = new WeakSet();
export const isVerifiedStaticCourseProof = (report) => verifiedReports.has(report);
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const models = ['aircraft-course-practice.v1', 'aircraft-course-practice.v2'];
const sha256 = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const fail = (code, message = code) => {
  throw Object.assign(new Error(message), { code });
};
const requireValue = (value, code) => {
  if (!value) fail(code);
};
const cancelled = (signal) => {
  if (signal?.aborted) throw new DOMException('Static course verification cancelled', 'AbortError');
};
const root = fileURLToPath(new URL('../', import.meta.url));
// Selected implementation pins, not a claim of a complete transitive source closure.
const sourceFiles = [
  'scripts/fpv-static-course-proof.mjs',
  ...[
    'aircraft-course-session',
    'model',
    'world-model',
    'advanced-aircraft-runtime',
    'advanced-simulation',
    'aircraft-archive-verifier',
    'aircraft-terrain',
    'flight-sectors',
  ].map((name) => `optional-practice/civilian-fpv/${name}.mjs`),
];
function repositorySource() {
  const git = (args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
  return {
    revision: git(['rev-parse', 'HEAD']),
    tree: git(['rev-parse', 'HEAD^{tree}']),
    workingTreeChanges: Boolean(git(['status', '--porcelain', '--untracked-files=normal'])),
  };
}
async function sourcePins() {
  return Object.fromEntries(
    await Promise.all(
      sourceFiles.map(async (name) => [
        name,
        createHash('sha256')
          .update(await readFile(path.join(root, name)))
          .digest('hex'),
      ]),
    ),
  );
}
function courseValue(source) {
  const value = boundedJSON(source, {
    maxBytes: 4 * 1024 * 1024,
    maxNodes: 200000,
    maxArray: 60000,
    maxDepth: 12,
  });
  if (value.format === 'FlightCourse.v1') return validateFlightCourse(value);
  if (value.format === 'FlightCourse.v2') return validateWorldCourse(value);
  fail('unsupported-course-format');
}
function modelFor(config) {
  const adapter = config.configuration?.missionAdapter;
  if (adapter === undefined) return models[0];
  requireValue(adapter?.format === 'AircraftCourseMission.v2', 'unsupported-mission-adapter');
  exactKeys(adapter, ['format', 'floorHeightMm'], 'Static course mission adapter');
  requireValue(Number.isSafeInteger(adapter.floorHeightMm), 'invalid-mission-floor');
  return models[1];
}
export function createStaticCourseSidecar(archiveSource, courseSource) {
  const archive = validateAircraftArchivePackage(archiveSource),
    course = courseValue(courseSource);
  requireValue(
    dataIdentity(course) === archive.manifest.config.configuration?.environment?.course,
    'course-identity-mismatch',
  );
  return {
    format: STATIC_COURSE_SIDECAR,
    evaluator: STATIC_COURSE_VERIFIER,
    missionModel: modelFor(archive.manifest.config),
    archiveSha256: sha256(archive),
    courseSha256: sha256(course),
    course,
  };
}
function dependency(source, archive) {
  requireValue(source !== null && source !== undefined, 'missing-course-dependency');
  const value = boundedJSON(source, {
    maxBytes: STATIC_COURSE_SIDECAR_BYTES,
    maxNodes: 200030,
    maxArray: 60000,
    maxDepth: 14,
  });
  exactKeys(
    value,
    ['format', 'evaluator', 'missionModel', 'archiveSha256', 'courseSha256', 'course'],
    'Static course dependency',
  );
  requireValue(
    value.format === STATIC_COURSE_SIDECAR && value.evaluator === STATIC_COURSE_VERIFIER,
    'unsupported-evaluator',
  );
  const course = courseValue(value.course);
  requireValue(value.archiveSha256 === sha256(archive), 'archive-digest-mismatch');
  requireValue(value.courseSha256 === sha256(course), 'course-digest-mismatch');
  requireValue(
    dataIdentity(course) === archive.manifest.config.configuration?.environment?.course,
    'course-identity-mismatch',
  );
  requireValue(
    value.missionModel === modelFor(archive.manifest.config),
    'mission-adapter-mismatch',
  );
  return { ...value, course };
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
export async function verifyStaticAircraftCourse(
  archiveSource,
  sidecarSource,
  { signal, onProgress = () => {} } = {},
) {
  cancelled(signal);
  const archive = validateAircraftArchivePackage(archiveSource),
    dep = dependency(sidecarSource, archive);
  const pins = await sourcePins(),
    repository = repositorySource();
  cancelled(signal);
  const physics = await verifyAircraftArchive(archive, {
    signal,
    onProgress: (progress) => onProgress({ phase: 'physics', ...progress }),
  });
  const report = {
    format: STATIC_COURSE_VERIFIER,
    toolingOnly: true,
    scored: false,
    archiveSha256: dep.archiveSha256,
    courseSha256: dep.courseSha256,
    missionModel: dep.missionModel,
    selectedSourceSha256: pins,
    sourceRepository: repository,
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
    requireValue(
      physics.verificationScope === 'complete-session',
      'course-needs-complete-reset-session',
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
        createMission: dep.course.format === 'FlightCourse.v1' ? createFlight : createWorldFlight,
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
  requireValue(
    same(pins, await sourcePins()) && same(repository, repositorySource()),
    'evaluator-source-changed',
  );
  freeze(report);
  if (report.course.verified) verifiedReports.add(report);
  return report;
}

async function readBounded(file, limit) {
  const handle = await open(file, 'r');
  try {
    const info = await handle.stat();
    requireValue(info.isFile() && info.size <= limit, 'file-byte-budget');
    // Read at most the admitted size plus one, even if the file grows after stat.
    const bytes = Buffer.alloc(info.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await handle.read(bytes, length, bytes.length - length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    requireValue(length <= info.size, 'file-changed-during-read');
    return bytes.subarray(0, length).toString('utf8');
  } finally {
    await handle.close();
  }
}
async function main(args) {
  const [command, archivePath, dependencyPath, out, ...rest] = args;
  requireValue(
    ['bind', 'verify'].includes(command) &&
      archivePath &&
      dependencyPath &&
      !rest.length &&
      (command !== 'bind' || out),
    'usage: bind ARCHIVE COURSE SIDECAR | verify ARCHIVE SIDECAR [REPORT]',
  );
  const archive = await readBounded(archivePath, AIRCRAFT_ARCHIVE_PACKAGE_BYTES);
  if (command === 'bind') {
    const course = await readBounded(dependencyPath, 4 * 1024 * 1024);
    await writeFile(out, JSON.stringify(createStaticCourseSidecar(archive, course)) + '\n', {
      flag: 'wx',
    });
    return;
  }
  const abort = new AbortController(),
    cancel = () => abort.abort();
  process.once('SIGINT', cancel);
  try {
    const report = await verifyStaticAircraftCourse(
      archive,
      await readBounded(dependencyPath, STATIC_COURSE_SIDECAR_BYTES),
      { signal: abort.signal },
    );
    const bytes = JSON.stringify(report, null, 2) + '\n';
    if (out) await writeFile(out, bytes, { flag: 'wx' });
    else process.stdout.write(bytes);
    if (!report.course.verified) process.exitCode = 2;
  } finally {
    process.removeListener('SIGINT', cancel);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      JSON.stringify({ error: error.message, code: error.code ?? error.name, scored: false }) +
        '\n',
    );
    process.exitCode = error.name === 'AbortError' ? 130 : 1;
  });
}
