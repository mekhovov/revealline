#!/usr/bin/env node
/** Offline diagnostic tooling only. Not imported by either simulator or its workers. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { open, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { boundedJSON, canonicalJSON, dataIdentity, exactKeys } from '../game/data-json.mjs';
import { validateFlightCourse } from '../optional-practice/civilian-fpv/model.mjs';
import { FLIGHT_COURSES } from '../optional-practice/civilian-fpv/catalogue.mjs';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import {
  validateWorldCourse,
  createWorldFlight,
} from '../optional-practice/civilian-fpv/world-model.mjs';
import {
  validateAircraftArchivePackage,
  AIRCRAFT_ARCHIVE_PACKAGE_BYTES,
} from '../optional-practice/civilian-fpv/aircraft-archive.mjs';
import {
  STATIC_COURSE_VERIFIER,
  aircraftCourseMissionModel as modelFor,
  aircraftCourseComparisonEligibility,
  verifyAircraftCourseArchive,
} from '../optional-practice/civilian-fpv/aircraft-archive-verifier.mjs';
export {
  STATIC_COURSE_VERIFIER,
  createStaticCourseInputCursor,
} from '../optional-practice/civilian-fpv/aircraft-archive-verifier.mjs';

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
    'advanced-ghost-path',
    'aircraft-physics',
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
async function sourcePins(files = sourceFiles) {
  return Object.fromEntries(
    await Promise.all(
      files.map(async (name) => [
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
// Module-owned validated copies; a caller cannot supply or alter the audit's rules.
const builtinCourses = freeze(FLIGHT_COURSES.map(courseValue));
const builtinSourceFiles = [...sourceFiles, 'optional-practice/civilian-fpv/catalogue.mjs'];
function unchangedBuiltinCatalogue() {
  requireValue(same(FLIGHT_COURSES, builtinCourses), 'builtin-catalogue-changed');
}

// Data selection only. A later native World worker must establish proof ownership.
const worldCatalogues = new Map(
  [
    ['WORLD_CATALOGUE', WORLD_CATALOGUE],
    ['BEGINNER_CATALOGUE', BEGINNER_CATALOGUE],
  ].map(([name, source]) => [
    name,
    {
      source,
      digest: sha256(source),
      entries: freeze(
        source.map((entry) => ({
          id: entry.id,
          legacy: entry.legacy,
          packIdentity: entry.packIdentity,
          course: structuredClone(entry.course),
        })),
      ),
    },
  ]),
);

/** Resolve repository-owned World content without verifying or admitting a flight. */
export function prepareBuiltinWorldCourse(archiveSource, selection) {
  exactKeys(selection, ['catalogue', 'id', 'revision'], 'Built-in World course selection');
  const { catalogue, id, revision } = selection;
  requireValue(
    [catalogue, id, revision].every(
      (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value),
    ),
    'invalid-builtin-world-selection',
  );
  const selected = worldCatalogues.get(catalogue);
  requireValue(selected, 'unknown-builtin-world-catalogue');
  requireValue(sha256(selected.source) === selected.digest, 'builtin-world-catalogue-changed');
  const matches = selected.entries.filter((entry) => entry.id === id);
  requireValue(matches.length === 1, 'unknown-or-ambiguous-builtin-world-course');
  const entry = matches[0];
  requireValue(
    entry.legacy === false && entry.course.format === 'FlightCourse.v2' && entry.course.id === id,
    'unsupported-builtin-world-course-family',
  );
  const course = courseValue(entry.course);
  requireValue(course.revision === revision, 'builtin-world-course-revision-mismatch');
  requireValue(!course.actors?.length, 'unsupported-dynamic-course');
  requireValue(
    Object.values(course.steps).every((steps) =>
      steps.every((step) => ['hold', 'gate', 'land'].includes(step.type)),
    ),
    'unsupported-course-objective',
  );
  const archive = validateAircraftArchivePackage(archiveSource),
    { config } = archive.manifest;
  requireValue(archive.manifest.host === 'world', 'unsupported-builtin-world-archive-host');
  requireValue(config.configuration?.environment?.host === 'world', 'course-family-mismatch');
  requireValue(!config.dynamicColliders?.length, 'unsupported-dynamic-course');
  requireValue(config.configuration.challenge === undefined, 'unsupported-challenge-wrapper');
  requireValue(
    dataIdentity(course) === config.configuration.environment.course,
    'builtin-world-course-identity-mismatch',
  );
  return freeze({
    format: 'AircraftBuiltinWorldCoursePreparation.v1',
    toolingOnly: true,
    experimental: true,
    scored: false,
    defaultEligible: false,
    verification: {
      physics: 'not-run',
      course: 'not-run',
      nativeOwnership: 'not-established',
    },
    builtinCourse: { catalogue, id, revision, packIdentity: entry.packIdentity },
    course: structuredClone(course),
    archiveSha256: sha256(archive),
    courseSha256: sha256(course),
    catalogueContentSha256: selected.digest,
  });
}

/** Offline preparation only: resolve shipped Academy content, never a supplied sidecar. */
export async function auditBuiltinAircraftCourse(archiveSource, courseId, revision, options = {}) {
  exactKeys(options, ['signal', 'onProgress'], 'Built-in course audit options');
  const { signal, onProgress = () => {} } = options;
  cancelled(signal);
  unchangedBuiltinCatalogue();
  const course = builtinCourses.find((entry) => entry.id === courseId);
  requireValue(course, 'unknown-builtin-course');
  requireValue(course.revision === revision, 'builtin-course-revision-mismatch');
  const archive = validateAircraftArchivePackage(archiveSource);
  requireValue(
    dataIdentity(course) === archive.manifest.config.configuration?.environment?.course,
    'builtin-course-identity-mismatch',
  );
  const pins = await sourcePins(builtinSourceFiles),
    repository = repositorySource();
  cancelled(signal);
  const result = await verifyAircraftCourseArchive(archive, course, { signal, onProgress });
  cancelled(signal);
  // Assess the native owner's exact result before making a diagnostic copy.
  const ownedProofAssessment = aircraftCourseComparisonEligibility(result, result);
  unchangedBuiltinCatalogue();
  requireValue(
    same(pins, await sourcePins(builtinSourceFiles)) && same(repository, repositorySource()),
    'evaluator-source-changed',
  );
  cancelled(signal);
  unchangedBuiltinCatalogue();
  return freeze({
    ...result,
    format: 'AircraftBuiltinCourseAudit.v1',
    evaluator: STATIC_COURSE_VERIFIER,
    toolingOnly: true,
    experimental: true,
    scored: false,
    defaultEligible: false,
    admission: 'scored-admission-not-enabled',
    builtinCourse: { catalogue: 'FLIGHT_COURSES', id: course.id, revision: course.revision },
    ownedProofAssessment,
    archiveSha256: sha256(archive),
    courseSha256: sha256(course),
    selectedSourceSha256: pins,
    sourceRepository: repository,
  });
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
/** Node-only dependency binding and source diagnostics around the shared two-pass kernel. */
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
  const result = await verifyAircraftCourseArchive(archive, dep.course, {
    signal,
    onProgress,
    courseAdapter: {
      format: 'FlightCourse.v2',
      validate: validateWorldCourse,
      createMission: createWorldFlight,
    },
  });
  cancelled(signal);
  requireValue(
    same(pins, await sourcePins()) && same(repository, repositorySource()),
    'evaluator-source-changed',
  );
  const report = freeze({
    ...result,
    toolingOnly: true,
    archiveSha256: dep.archiveSha256,
    courseSha256: dep.courseSha256,
    selectedSourceSha256: pins,
    sourceRepository: repository,
  });
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
  if (args[0] === 'audit-builtin') {
    const [, archivePath, courseId, revision, out, ...rest] = args;
    requireValue(
      archivePath && courseId && revision && !rest.length,
      'usage: audit-builtin ARCHIVE COURSE_ID REVISION [REPORT]',
    );
    const abort = new AbortController(),
      cancel = () => abort.abort();
    process.once('SIGINT', cancel);
    try {
      const report = await auditBuiltinAircraftCourse(
        await readBounded(archivePath, AIRCRAFT_ARCHIVE_PACKAGE_BYTES),
        courseId,
        revision,
        { signal: abort.signal },
      );
      const bytes = JSON.stringify(report, null, 2) + '\n';
      if (out) await writeFile(out, bytes, { flag: 'wx' });
      else process.stdout.write(bytes);
      if (!report.ownedProofAssessment.eligible) process.exitCode = 2;
    } finally {
      process.removeListener('SIGINT', cancel);
    }
    return;
  }
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
      JSON.stringify({
        error: error.message,
        code: error.code ?? error.name,
        scored: false,
        ...(process.argv[2] === 'audit-builtin' ? { defaultEligible: false } : {}),
      }) + '\n',
    );
    process.exitCode = error.name === 'AbortError' ? 130 : 1;
  });
}
