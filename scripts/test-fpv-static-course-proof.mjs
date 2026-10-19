import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { canonicalJSON, dataIdentity } from '../game/data-json.mjs';
import {
  advancedComparisonEligibility,
  createAdvancedSimulation,
  initAdvancedRuntime,
} from '../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createAircraftCourseSession } from '../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import {
  createWorldFlight,
  validateWorldCourse,
} from '../optional-practice/civilian-fpv/world-model.mjs';
import {
  aircraftCourseComparisonEligibility,
  verifyAircraftCourseArchive,
} from '../optional-practice/civilian-fpv/aircraft-archive-verifier.mjs';
import { validateAircraftCoursePresentation } from '../optional-practice/civilian-fpv/advanced-ghost-path.mjs';
import { createFlight } from '../optional-practice/civilian-fpv/model.mjs';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import { FLIGHT_COURSES } from '../optional-practice/civilian-fpv/catalogue.mjs';
import {
  listAircraftPresets,
  createPresetConfiguration,
} from '../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { aircraftPerformance } from '../optional-practice/civilian-fpv/aircraft-physics.mjs';
import { createAircraftTerrainFrame } from '../optional-practice/civilian-fpv/aircraft-terrain.mjs';
import {
  isVerifiedStaticCourseProof,
  createStaticCourseSidecar,
  verifyStaticAircraftCourse,
  createStaticCourseInputCursor,
  STATIC_COURSE_SIDECAR_BYTES,
  auditBuiltinAircraftCourse,
  prepareBuiltinWorldCourse,
} from './fpv-static-course-proof.mjs';

await initAdvancedRuntime();
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const copy = structuredClone;
const hash = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
const size = (value) => Buffer.byteLength(JSON.stringify(value));
const lesson = BEGINNER_CATALOGUE.find((entry) => entry.id === 'beginner-01').course;
function packet(
  config,
  identity,
  segments,
  { state = 'ended', kind = 'fresh', host = 'world' } = {},
) {
  const first = segments[0],
    last = segments.at(-1);
  return {
    format: 'AircraftArchivePackage.v1',
    manifest: {
      format: 'AircraftSessionArchive.v1',
      id: 'static-course-test',
      host,
      name: 'Static course test',
      createdAt: 0,
      revision: segments.length + 1,
      config,
      identity,
      origin: { kind, startTick: first.startTick },
      state,
      firstIndex: first.index,
      lastIndex: last.index,
      startTick: first.startTick,
      endTick: last.endTick,
      segmentCount: segments.length,
      payloadBytes: size(config) + segments.reduce((n, s) => n + size(s), 0),
      finalHash: last.finalHash,
      scored: false,
    },
    segments,
  };
}
async function record({
  id = 'meteor75-analog-2022',
  mode = 'self-level',
  course = lesson,
  model = 'aircraft-course-practice.v2',
  ticks = null,
  input,
  host = 'world',
  alterOptions = (x) => x,
  alterFrame = (x) => x,
  alterSample = (x) => x,
} = {}) {
  const preset = createPresetConfiguration(id),
    settings = {
      response: preset.response,
      advanced: { aircraft: preset.aircraft, controller: preset.controller },
    };
  let simulation;
  const client = {
    async initialize(options) {
      simulation = createAdvancedSimulation({
        ...alterOptions(options),
        recordingOptions: { segmentBytes: 5000 },
      });
      return { telemetry: simulation.telemetry(), comparison: simulation.comparison() };
    },
    async stageTerrainFrame(frame) {
      return simulation.stageTerrainFrame(alterFrame(frame));
    },
    async commitTerrainFrame(decision) {
      return simulation.commitTerrainFrame(decision);
    },
    async step(sample, motions) {
      simulation.enqueueInput(alterSample(sample));
      return simulation.stepMission({ motions });
    },
    dispose() {
      simulation?.dispose();
    },
  };
  const session = createAircraftCourseSession(
    { course, mode, configuration: settings, model, legacy: course.format === 'FlightCourse.v1' },
    {
      createClient: () => client,
      createMission: course.format === 'FlightCourse.v1' ? createFlight : createWorldFlight,
    },
  );
  const segments = [],
    transitions = [],
    poses = [];
  const capture = () => {
    const { missionTick: tick, position: p, orientation: q } = simulation.telemetry();
    poses.push([tick, p.x, p.y, p.z, q.x, q.y, q.z, q.w]);
  };
  const collect = () => {
    const row = simulation.readSealedSegment(segments.at(-1)?.index ?? -1);
    assert.equal(row.gap, false);
    if (row.segment) segments.push(row.segment);
  };
  try {
    await session.prepare();
    capture();
    session.arm();
    const hover = aircraftPerformance(preset.aircraft).hoverThrottle;
    for (let tick = 0; tick < (ticks ?? 650); tick++) {
      const state = session.snapshot();
      if (ticks === null && state.step === state.total) break;
      const height = state.position.y / 1000,
        climb = state.velocity.y / 1000;
      const throttle =
        state.step === 0 || (state.step >= 2 && (state.grounded || (height < 0.025 && climb < 0.1)))
          ? 0
          : Math.max(
              0,
              Math.min(
                0.65,
                hover + 0.1 * ((state.step === 1 ? 1.4 : -0.06) - height) - 0.12 * climb,
              ),
            );
      const next = await session.step(input?.(tick, state) ?? { ...neutral, throttle });
      capture();
      if (state.step !== next.step) transitions.push({ index: next.step - 1, endTick: next.ticks });
      collect();
    }
    const state = session.snapshot();
    session.pause();
    simulation.finalizeArchive(segments.at(-1)?.index ?? -1);
    collect();
    const archive = packet(simulation.configuration(), simulation.identity, segments, { host });
    return {
      archive,
      course,
      state,
      referenceIdentity: session.referenceIdentity(),
      transitions,
      poses,
      sidecar: createStaticCourseSidecar(archive, course),
    };
  } finally {
    await session.dispose();
  }
}

test('every aircraft and both modes independently reconstruct static lesson completion and all segments', async (t) => {
  for (const preset of listAircraftPresets())
    for (const mode of ['self-level', 'acro']) {
      await t.test(`${preset.id}/${mode}`, async () => {
        const f = await record({ id: preset.id, mode });
        assert.equal(f.state.step, 3);
        assert.ok(f.archive.segments.length > 1);
        const before = canonicalJSON(f.archive);
        const result = await verifyStaticAircraftCourse(f.archive, f.sidecar);
        assert.equal(result.physics.verified, true);
        assert.equal(result.physics.verificationScope, 'complete-session');
        assert.equal(result.course.verified, true, JSON.stringify(result.course));
        assert.equal(
          Object.hasOwn(result.course, 'presentation'),
          false,
          'CLI default stays unchanged',
        );
        const visual = await verifyAircraftCourseArchive(f.archive, f.course, {
          collectReference: true,
          courseAdapter: {
            format: 'FlightCourse.v2',
            validate: validateWorldCourse,
            createMission: createWorldFlight,
          },
        });
        const { presentation, ...courseWithoutVisual } = visual.course;
        assert.deepEqual(courseWithoutVisual, result.course);
        assert.deepEqual(visual.physics, result.physics);
        assert.deepEqual(validateAircraftCoursePresentation(presentation), presentation);
        assert.deepEqual(
          presentation.path,
          f.poses,
          'raw accepted COM metres/quaternions, including exact reset and completion',
        );
        assert.deepEqual(presentation.aircraft, f.archive.manifest.config.aircraft);
        assert.equal(presentation.sourceSampleCount, f.state.ticks + 1);
        assert.equal(advancedComparisonEligibility(visual, visual).eligible, false);
        assert.equal(result.course.completedAtTick, f.state.ticks);
        assert.deepEqual(result.course.referenceIdentity, f.referenceIdentity);
        assert.deepEqual(
          result.course.splits.map(({ index, endTick }) => ({ index, endTick })),
          f.transitions,
        );
        assert.equal(result.course.verifiedSegments, f.archive.segments.length);
        assert.equal(result.scored, false);
        assert.equal(result.toolingOnly, true);
        assert.equal(isVerifiedStaticCourseProof(result), true);
        assert.equal(
          advancedComparisonEligibility(result, result).eligible,
          false,
          'tooling proof has no production comparison authority',
        );
        assert.equal(isVerifiedStaticCourseProof(copy(result)), false);
        assert.equal(isVerifiedStaticCourseProof(JSON.parse(JSON.stringify(result))), false);
        assert.throws(() => {
          result.course.completedAtTick = 0;
        }, TypeError);
        assert.equal(canonicalJSON(f.archive), before);
      });
    }
});

test('historical adapter v1 and current v2 retain their respective course behavior and reset independently', async () => {
  const course = copy(lesson);
  for (const mode of ['acro', 'self-level']) {
    course.steps[mode] = [copy(course.steps[mode][0])];
    course.steps[mode][0].min.y = -50;
    course.steps[mode][0].ticks = 4;
  }
  for (const model of ['aircraft-course-practice.v1', 'aircraft-course-practice.v2']) {
    const f = await record({ course, model, ticks: 12, input: () => neutral });
    const a = await verifyStaticAircraftCourse(f.archive, f.sidecar);
    const b = await verifyStaticAircraftCourse(f.archive, f.sidecar);
    assert.equal(a.course.verified, true, JSON.stringify(a.course));
    assert.equal(a.course.completedAtTick, 4);
    assert.deepEqual(a, b);
    const forged = {
      ...f.sidecar,
      missionModel: model.endsWith('v1')
        ? 'aircraft-course-practice.v2'
        : 'aircraft-course-practice.v1',
    };
    await assert.rejects(verifyStaticAircraftCourse(f.archive, forged), {
      code: 'mission-adapter-mismatch',
    });
  }
  const academy = copy(FLIGHT_COURSES[0]);
  for (const mode of ['acro', 'self-level']) {
    academy.steps[mode] = [copy(academy.steps[mode][0])];
    academy.steps[mode][0].ticks = 3;
  }
  const f = await record({
    course: academy,
    ticks: 200,
    input: (_tick, state) => ({
      ...neutral,
      throttle: Math.max(
        0,
        Math.min(
          0.65,
          aircraftPerformance(createPresetConfiguration('meteor75-analog-2022').aircraft)
            .hoverThrottle +
            0.1 * (1.8 - state.position.y / 1000) -
            (0.12 * state.velocity.y) / 1000,
        ),
      ),
    }),
  });
  assert.equal((await verifyStaticAircraftCourse(f.archive, f.sidecar)).course.verified, true);
});

test('dependency digests, exact course bindings and strict bounds reject mutation before a course claim', async () => {
  const f = await record({ ticks: 5, input: () => neutral });
  for (const mutate of [
    (s) => {
      s.courseSha256 = '0'.repeat(64);
    },
    (s) => {
      s.archiveSha256 = '0'.repeat(64);
    },
    (s) => {
      s.course.steps.acro[0].ticks++;
    },
    (s) => {
      s.evaluator = 'unknown';
    },
    (s) => {
      s.verified = true;
      s.splits = [{ endTick: 0 }];
    },
  ]) {
    const sidecar = copy(f.sidecar);
    mutate(sidecar);
    await assert.rejects(verifyStaticAircraftCourse(f.archive, sidecar));
  }
  const sidecar = copy(f.sidecar);
  sidecar.course.steps['self-level'][0].ticks++;
  sidecar.courseSha256 = hash(sidecar.course);
  await assert.rejects(verifyStaticAircraftCourse(f.archive, sidecar), {
    code: 'course-identity-mismatch',
  });
  const bad = copy(f.archive);
  bad.manifest.name = 'Changed';
  await assert.rejects(verifyStaticAircraftCourse(bad, f.sidecar), {
    code: 'archive-digest-mismatch',
  });
  await assert.rejects(
    verifyStaticAircraftCourse(f.archive, ' '.repeat(STATIC_COURSE_SIDECAR_BYTES + 1)),
    /byte budget/i,
  );
  const malformed = copy(f.sidecar);
  malformed.course.steps.acro = Array(65).fill(malformed.course.steps.acro[0]);
  await assert.rejects(verifyStaticAircraftCourse(f.archive, malformed), /criteria|limit/i);
});

test('physically consistent alternative terrain, input schedule and spawn cannot prove the authored session', async () => {
  for (const [options, reason] of [
    [
      {
        alterFrame(frame) {
          const colliders = copy(frame.colliders);
          colliders[0].vertices[0] += 0.02;
          return createAircraftTerrainFrame({ sourceIdentity: frame.sourceIdentity, colliders });
        },
      },
      'generated-terrain-mismatch',
    ],
    [
      { alterSample: (sample) => ({ ...sample, sequence: sample.sequence + 7 }) },
      'unsupported-input-schedule',
    ],
    [
      {
        alterOptions: (options) => ({
          ...options,
          spawn: { ...options.spawn, y: options.spawn.y + 0.1 },
        }),
      },
      'noncanonical-session-configuration',
    ],
    [
      {
        alterOptions: (options) => ({
          ...options,
          dynamicColliders: [
            {
              id: 'moving-marker',
              position: { x: 20, y: 5, z: 20 },
              radius: 0.2,
              height: 0.4,
              shape: 'sphere',
            },
          ],
        }),
      },
      'unsupported-dynamic-course',
    ],
  ]) {
    const f = await record({ ...options, ticks: 5, input: () => neutral });
    const result = await verifyStaticAircraftCourse(f.archive, f.sidecar);
    assert.equal(result.physics.verified, true);
    assert.deepEqual(result.course, { verified: false, reason });
  }
  const course = copy(lesson);
  for (const mode of ['acro', 'self-level']) course.steps[mode] = [{ type: 'survive', ticks: 5 }];
  const f = await record({ course, ticks: 8, input: () => neutral });
  assert.equal(
    (await verifyStaticAircraftCourse(f.archive, f.sidecar)).course.reason,
    'unsupported-course-objective',
  );
});

test('clips and incomplete courses keep their separate physical scope; tampered segments cannot pass', async () => {
  const f = await record({ ticks: 220, input: () => neutral });
  const incomplete = await verifyStaticAircraftCourse(f.archive, f.sidecar);
  assert.equal(incomplete.physics.verified, true);
  assert.equal(incomplete.course.verified, false);
  assert.equal(isVerifiedStaticCourseProof(incomplete), false);
  assert.equal(incomplete.course.reason, 'incomplete-course');
  for (const archive of [
    packet(f.archive.manifest.config, f.archive.manifest.identity, f.archive.segments, {
      state: 'interrupted',
    }),
    packet(f.archive.manifest.config, f.archive.manifest.identity, f.archive.segments.slice(1), {
      kind: 'checkpoint',
    }),
  ]) {
    const result = await verifyStaticAircraftCourse(
      archive,
      createStaticCourseSidecar(archive, f.course),
    );
    assert.equal(result.physics.verificationScope, 'checkpoint-clip');
    assert.equal(result.course.reason, 'course-needs-complete-reset-session');
  }
  const changed = copy(f.archive.segments);
  changed[1].checkpoint.state.noiseState ^= 1;
  for (let i = 1; i < changed.length; i++) changed[i].previous = dataIdentity(changed[i - 1]);
  const forged = packet(f.archive.manifest.config, f.archive.manifest.identity, changed);
  await assert.rejects(
    verifyStaticAircraftCourse(forged, createStaticCourseSidecar(forged, f.course)),
    /checkpoint/,
  );
  const missing = copy(f.archive);
  missing.segments.splice(1, 1);
  assert.throws(() => createStaticCourseSidecar(missing, f.course), /missing|segments/);
});

test('cancellation and callback failures in either pass leave fresh subsequent verification unaffected', async () => {
  const f = await record({ ticks: 60, input: () => neutral });
  const before = new AbortController();
  before.abort();
  await assert.rejects(
    verifyStaticAircraftCourse(f.archive, f.sidecar, { signal: before.signal }),
    { name: 'AbortError' },
  );
  for (const phase of ['physics', 'course']) {
    const controller = new AbortController();
    await assert.rejects(
      verifyStaticAircraftCourse(f.archive, f.sidecar, {
        signal: controller.signal,
        onProgress(progress) {
          if (progress.phase === phase) controller.abort();
        },
      }),
      { name: 'AbortError' },
    );
    await assert.rejects(
      verifyStaticAircraftCourse(f.archive, f.sidecar, {
        onProgress(progress) {
          if (progress.phase === phase) throw new Error('caller progress failed');
        },
      }),
      /caller progress failed/,
    );
  }
  assert.equal((await verifyStaticAircraftCourse(f.archive, f.sidecar)).physics.verified, true);
});

test('input cursor crosses twelve minutes with bounded state and rejects unsafe/noncanonical clocks', () => {
  const segments = [];
  for (let start = 0; start < 39000; start += 3000) {
    const events = start === 0 ? [['terrain', 0, { illustrative: true }]] : [];
    for (let tick = start; tick < start + 3000; tick++)
      events.push(['input', tick * 10, tick, tick * 20000, 0, 0, 0, 0]);
    segments.push({ startTick: start, endTick: start + 3000, events });
  }
  const cursor = createStaticCourseInputCursor(segments);
  let count = 0,
    next;
  while ((next = cursor.next())) {
    count++;
    assert.equal(next.tick, count);
  }
  assert.equal(count, 39000);
  assert.equal(cursor.next(), null);
  assert.equal(Object.keys(cursor).length, 2, 'no telemetry or input history API');
  assert.throws(() => createStaticCourseInputCursor(Array(257).fill(segments[0])), /schedule/);
  const bad = copy(segments[0]);
  bad.endTick = Number.MAX_SAFE_INTEGER + 1;
  assert.throws(() => createStaticCourseInputCursor([bad]).next(), /clock/);
  bad.endTick = 1;
  bad.events[1][3] = Number.MAX_SAFE_INTEGER + 1;
  assert.throws(() => createStaticCourseInputCursor([bad]).next(), /schedule/);
});

test('changed controller, rates or geometry cannot reuse a recording by regenerating dependency digests', async () => {
  const f = await record({ ticks: 8, input: () => neutral });
  for (const change of [
    (config) => {
      config.controller.gains.roll.p *= 1.1;
    },
    (config) => {
      config.response.response.rates.axes.roll.rate++;
      config.configuration.response.rates.axes.roll.rate++;
    },
    (config) => {
      config.aircraft.geometry.bodyHalfExtents.x *= 0.99;
    },
  ]) {
    const config = copy(f.archive.manifest.config);
    change(config);
    const altered = packet(config, f.archive.manifest.identity, f.archive.segments);
    const sidecar = createStaticCourseSidecar(altered, f.course);
    await assert.rejects(verifyStaticAircraftCourse(altered, sidecar), /configuration changed/);
  }
  await assert.rejects(verifyStaticAircraftCourse(f.archive, null), {
    code: 'missing-course-dependency',
  });
  const config = copy(f.archive.manifest.config);
  config.configuration.missionAdapter.format = 'AircraftCourseMission.v99';
  assert.throws(
    () =>
      createStaticCourseSidecar(
        packet(config, f.archive.manifest.identity, f.archive.segments),
        f.course,
      ),
    { code: 'unsupported-mission-adapter' },
  );
});

test('known legacy physical backend is reconstructed explicitly; ordinary reset and unsupported host stay distinct', async () => {
  const course = copy(lesson);
  for (const mode of ['acro', 'self-level']) {
    course.steps[mode] = [copy(course.steps[mode][0])];
    course.steps[mode][0].min.y = -50;
    course.steps[mode][0].ticks = 3;
  }
  const f = await record({
    course,
    model: 'aircraft-course-practice.v1',
    ticks: 5,
    input: () => neutral,
    alterOptions: (options) => ({ ...options, backend: 'civilian-quad-aircraft-regional.v1' }),
  });
  assert.equal((await verifyStaticAircraftCourse(f.archive, f.sidecar)).course.verified, true);
  const archive = copy(f.archive);
  archive.manifest.host = 'regional';
  const result = await verifyStaticAircraftCourse(
    archive,
    createStaticCourseSidecar(archive, course),
  );
  assert.equal(result.physics.verified, true);
  assert.equal(result.course.reason, 'unsupported-archive-host');
});

test('CLI binds an exact supplied dependency and writes only an unscored report without overwriting files', async (t) => {
  const course = copy(lesson);
  for (const mode of ['acro', 'self-level']) {
    course.steps[mode] = [copy(course.steps[mode][0])];
    course.steps[mode][0].min.y = -50;
    course.steps[mode][0].ticks = 3;
  }
  const f = await record({ course, ticks: 5, input: () => neutral });
  const temp = await mkdtemp(path.join(os.tmpdir(), 'static-course-proof-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const archivePath = path.join(temp, 'archive.json'),
    coursePath = path.join(temp, 'course.json'),
    sidecarPath = path.join(temp, 'sidecar.json'),
    reportPath = path.join(temp, 'report.json');
  await writeFile(archivePath, JSON.stringify(f.archive));
  await writeFile(coursePath, JSON.stringify(course));
  const cli = new URL('./fpv-static-course-proof.mjs', import.meta.url).pathname;
  execFileSync(process.execPath, [cli, 'bind', archivePath, coursePath, sidecarPath]);
  execFileSync(process.execPath, [cli, 'verify', archivePath, sidecarPath, reportPath]);
  const result = JSON.parse(await readFile(reportPath, 'utf8'));
  assert.equal(result.course.verified, true);
  assert.equal(result.scored, false);
  assert.equal(
    isVerifiedStaticCourseProof(result),
    false,
    'parsed report is not an in-process verification result',
  );
  assert.match(result.sourceRepository.revision, /^[a-f0-9]{40}$/);
  assert.equal(Object.keys(result.selectedSourceSha256).length, 11);
  const original = await readFile(reportPath, 'utf8');
  assert.throws(
    () =>
      execFileSync(process.execPath, [cli, 'verify', archivePath, sidecarPath, reportPath], {
        stdio: 'pipe',
      }),
    /EEXIST/,
  );
  assert.equal(await readFile(reportPath, 'utf8'), original);
  const oversized = path.join(temp, 'oversized.json');
  await writeFile(oversized, ' '.repeat(STATIC_COURSE_SIDECAR_BYTES + 1));
  assert.throws(
    () =>
      execFileSync(process.execPath, [cli, 'verify', archivePath, oversized], { stdio: 'pipe' }),
    /file-byte-budget/,
  );
  assert.throws(
    () =>
      execFileSync(process.execPath, [cli, 'bind', temp, coursePath, sidecarPath], {
        stdio: 'pipe',
      }),
    /file-byte-budget/,
  );
});

test('frozen pre-change mission fixture stays physically exact and does not gain v2 completion', async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL('../game/test/fixtures/fpv-aircraft-mission-v1.json', import.meta.url),
      'utf8',
    ),
  );
  const commands = fixture.frames.flatMap((frame) =>
    Array.from({ length: frame.ticks }, () => frame.controls),
  );
  const f = await record({
    id: fixture.presetId,
    mode: fixture.mode,
    model: fixture.identity.model,
    // This pre-v3 fixture must keep its original backend and fixed timing.
    alterOptions: (options) => ({
      ...options,
      backend: 'civilian-quad-aircraft-regional.v2',
      frequency: 500,
    }),
    ticks: commands.length,
    input: (tick) => commands[tick],
  });
  assert.equal(f.archive.manifest.identity, fixture.physicalIdentity);
  assert.equal(f.archive.manifest.finalHash, fixture.physicalHash);
  assert.equal(f.state.step, 0);
  const result = await verifyStaticAircraftCourse(f.archive, f.sidecar);
  assert.equal(result.physics.verified, true);
  assert.equal(result.course.verified, false);
  assert.equal(result.course.reason, 'incomplete-course');
  assert.deepEqual(result.course.splits, []);
  assert.equal(isVerifiedStaticCourseProof(result), false);
});

test('ordinary stick flight crosses a static gate; misses and reverse direction do not complete it', async () => {
  const hover = aircraftPerformance(
    createPresetConfiguration('meteor75-analog-2022').aircraft,
  ).hoverThrottle;
  for (const variant of ['crossing', 'wrong-direction', 'miss']) {
    const course = copy(lesson);
    const gate = {
      type: 'gate',
      axis: 'x',
      at: 500,
      direction: variant === 'wrong-direction' ? -1 : 1,
      minSide: variant === 'miss' ? 5000 : -2000,
      maxSide: variant === 'miss' ? 6000 : 2000,
      minY: 200,
      maxY: 4000,
    };
    for (const mode of ['acro', 'self-level']) course.steps[mode] = [gate];
    const f = await record({
      course,
      ticks: 220,
      input: (tick, state) => ({
        ...neutral,
        roll: tick < 80 ? 0 : 0.15,
        throttle: Math.max(
          0,
          Math.min(
            0.65,
            hover + 0.1 * (1.4 - state.position.y / 1000) - (0.12 * state.velocity.y) / 1000,
          ),
        ),
      }),
    });
    assert.ok(
      f.state.position.x > gate.at,
      JSON.stringify({ variant, position: f.state.position }),
    );
    assert.equal(f.state.step, variant === 'crossing' ? 1 : 0);
    const result = await verifyStaticAircraftCourse(f.archive, f.sidecar);
    assert.equal(result.physics.verified, true);
    assert.equal(result.course.verified, variant === 'crossing');
    assert.deepEqual(
      result.course.splits.map(({ index, endTick }) => ({ index, endTick })),
      f.transitions,
    );
  }
});

// Genuine generated Academy flight: ordinary stick commands, no state corrections.
const academyFlight = (() => {
  let pending;
  return () =>
    (pending ??= record({
      course: FLIGHT_COURSES[0],
      host: 'academy',
      input: (tick, state) => {
        const height = state.position.y / 1000,
          climb = state.velocity.y / 1000,
          hover = aircraftPerformance(
            createPresetConfiguration('meteor75-analog-2022').aircraft,
          ).hoverThrottle;
        return {
          ...neutral,
          throttle:
            state.step > 0 && (state.grounded || (height < 0.025 && climb < 0.1))
              ? 0
              : Math.max(
                  0,
                  Math.min(
                    0.65,
                    hover + 0.1 * ((state.step === 0 ? 1.8 : -0.06) - height) - 0.12 * climb,
                  ),
                ),
        };
      },
    }));
})();

test('built-in audit resolves full authored Academy content and checks native ownership before copying', async () => {
  const f = await academyFlight();
  assert.equal(f.state.step, FLIGHT_COURSES[0].steps['self-level'].length);
  const before = canonicalJSON(f.archive);
  const result = await auditBuiltinAircraftCourse(f.archive, 'flight-01', 'r1');
  assert.equal(result.format, 'AircraftBuiltinCourseAudit.v1');
  assert.equal(result.course.verified, true);
  assert.equal(result.ownedProofAssessment.eligible, true);
  assert.equal(result.ownedProofAssessment.reason, 'compatible-unscored-practice');
  assert.deepEqual(result.course.referenceIdentity, f.referenceIdentity);
  assert.deepEqual(result.builtinCourse, {
    catalogue: 'FLIGHT_COURSES',
    id: 'flight-01',
    revision: 'r1',
  });
  assert.equal(result.courseSha256, hash(FLIGHT_COURSES[0]));
  assert.equal(result.archiveSha256, hash(f.archive));
  assert.equal(result.admission, 'scored-admission-not-enabled');
  assert.equal(result.scored, false);
  assert.equal(result.defaultEligible, false);
  assert.equal(Object.keys(result.selectedSourceSha256).length, 12);
  assert.match(
    result.selectedSourceSha256['optional-practice/civilian-fpv/catalogue.mjs'],
    /^[a-f0-9]{64}$/,
  );
  assert.equal(aircraftCourseComparisonEligibility(result, result).eligible, false);
  assert.equal(aircraftCourseComparisonEligibility(copy(result), copy(result)).eligible, false);
  assert.equal(isVerifiedStaticCourseProof(result), false);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.course.referenceIdentity));
  assert.ok(Object.isFrozen(result.ownedProofAssessment));
  assert.equal(canonicalJSON(f.archive), before);
});

test('built-in audit rejects unknown revisions, altered same-ID courses and supplied authority claims', async () => {
  const f = await academyFlight();
  for (const [id, revision, code] of [
    ['unknown', 'r1', 'unknown-builtin-course'],
    ['flight-01', 'r2', 'builtin-course-revision-mismatch'],
  ])
    await assert.rejects(auditBuiltinAircraftCourse(f.archive, id, revision), { code });
  for (const key of [
    'course',
    'sidecar',
    'report',
    'policy',
    'scored',
    'defaultEligible',
    'courseAdapter',
    'Worker',
    'workerURL',
  ]) {
    await assert.rejects(
      auditBuiltinAircraftCourse(f.archive, 'flight-01', 'r1', { [key]: {} }),
      /not supported/i,
    );
  }
  const changed = copy(FLIGHT_COURSES[0]);
  for (const mode of ['acro', 'self-level']) {
    changed.steps[mode] = [copy(lesson.steps[mode][0])];
    changed.steps[mode][0].min.y = -50;
    changed.steps[mode][0].ticks = 3;
  }
  const modified = await record({
    course: changed,
    host: 'academy',
    ticks: 5,
    input: () => neutral,
  });
  assert.equal(
    (await verifyStaticAircraftCourse(modified.archive, modified.sidecar)).course.verified,
    true,
  );
  await assert.rejects(auditBuiltinAircraftCourse(modified.archive, 'flight-01', 'r1'), {
    code: 'builtin-course-identity-mismatch',
  });
});

test('built-in audit refuses mutable catalogue edits at entry or during either pass', async () => {
  const f = await academyFlight(),
    course = FLIGHT_COURSES[0];
  const original = course.locales.en.title;
  const change = () => {
    course.locales.en.title = 'Changed course under the same ID';
  };
  try {
    change();
    await assert.rejects(auditBuiltinAircraftCourse(f.archive, 'flight-01', 'r1'), {
      code: 'builtin-catalogue-changed',
    });
  } finally {
    course.locales.en.title = original;
  }
  for (const phase of ['physics', 'course']) {
    try {
      await assert.rejects(
        auditBuiltinAircraftCourse(f.archive, 'flight-01', 'r1', {
          onProgress(progress) {
            if (progress.phase === phase) change();
          },
        }),
        { code: 'builtin-catalogue-changed' },
      );
    } finally {
      course.locales.en.title = original;
    }
  }
  assert.equal(
    (await auditBuiltinAircraftCourse(f.archive, 'flight-01', 'r1')).ownedProofAssessment.eligible,
    true,
  );
});

test('built-in audit cancellation and progress failures leave no adopted result', async () => {
  const f = await academyFlight();
  const before = new AbortController();
  before.abort();
  await assert.rejects(
    auditBuiltinAircraftCourse(f.archive, 'flight-01', 'r1', { signal: before.signal }),
    { name: 'AbortError' },
  );
  for (const phase of ['physics', 'course']) {
    const controller = new AbortController();
    await assert.rejects(
      auditBuiltinAircraftCourse(f.archive, 'flight-01', 'r1', {
        signal: controller.signal,
        onProgress(progress) {
          if (progress.phase === phase) controller.abort();
        },
      }),
      { name: 'AbortError' },
    );
    await assert.rejects(
      auditBuiltinAircraftCourse(f.archive, 'flight-01', 'r1', {
        onProgress(progress) {
          if (progress.phase === phase) throw new Error('progress failed');
        },
      }),
      /progress failed/,
    );
  }
  assert.equal(
    (await auditBuiltinAircraftCourse(f.archive, 'flight-01', 'r1')).ownedProofAssessment.eligible,
    true,
  );
});

test('built-in audit preserves incomplete and interrupted scope without scored admission', async () => {
  const f = await record({
    course: FLIGHT_COURSES[0],
    host: 'academy',
    ticks: 8,
    input: () => neutral,
  });
  for (const state of ['ended', 'interrupted']) {
    const archive = packet(
      f.archive.manifest.config,
      f.archive.manifest.identity,
      f.archive.segments,
      { state, host: 'academy' },
    );
    const result = await auditBuiltinAircraftCourse(archive, 'flight-01', 'r1');
    assert.equal(result.physics.verified, true);
    assert.equal(result.course.verified, false);
    assert.equal(result.ownedProofAssessment.eligible, false);
    assert.equal(result.scored, false);
    assert.equal(result.defaultEligible, false);
    assert.equal(
      result.physics.verificationScope,
      state === 'ended' ? 'complete-session' : 'checkpoint-clip',
    );
  }
});

test('built-in CLI resolves revision and writes only a new diagnostic file', async (t) => {
  const f = await academyFlight(),
    temp = await mkdtemp(path.join(os.tmpdir(), 'builtin-course-audit-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const archivePath = path.join(temp, 'archive.json'),
    reportPath = path.join(temp, 'report.json');
  await writeFile(archivePath, JSON.stringify(f.archive));
  const cli = new URL('./fpv-static-course-proof.mjs', import.meta.url).pathname;
  const args = [cli, 'audit-builtin', archivePath, 'flight-01', 'r1', reportPath];
  execFileSync(process.execPath, args);
  const original = await readFile(reportPath, 'utf8'),
    result = JSON.parse(original);
  assert.equal(result.ownedProofAssessment.eligible, true);
  assert.equal(result.scored, false);
  assert.equal(result.defaultEligible, false);
  assert.throws(() => execFileSync(process.execPath, args, { stdio: 'pipe' }), /EEXIST/);
  assert.equal(await readFile(reportPath, 'utf8'), original);
  for (const extra of [['flight-01', 'r9'], ['unknown', 'r1'], ['flight-01']]) {
    try {
      execFileSync(process.execPath, [cli, 'audit-builtin', archivePath, ...extra], {
        stdio: 'pipe',
      });
      assert.fail('Invalid built-in selection accepted');
    } catch (error) {
      const failure = JSON.parse(error.stderr.toString());
      assert.equal(failure.scored, false);
      assert.equal(failure.defaultEligible, false);
      assert.equal(error.status, 1);
    }
  }
});

test('built-in audit aborts selected source mutation in a disposable repository only', async (t) => {
  const f = await academyFlight(),
    temp = await mkdtemp(path.join(os.tmpdir(), 'builtin-course-source-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const root = new URL('../', import.meta.url).pathname;
  await mkdir(path.join(temp, 'scripts'));
  await mkdir(path.join(temp, 'optional-practice/civilian-fpv'), { recursive: true });
  // Only these two files are writable copies. All other imports remain read-only inputs.
  const sources = [
    'scripts/fpv-static-course-proof.mjs',
    'optional-practice/civilian-fpv/catalogue.mjs',
  ];
  for (const source of sources) await copyFile(path.join(root, source), path.join(temp, source));
  for (const name of ['game', 'node_modules'])
    await symlink(path.join(root, name), path.join(temp, name));
  for (const name of await readdir(path.join(root, 'optional-practice/civilian-fpv'))) {
    if (name === 'catalogue.mjs') continue;
    await symlink(
      path.join(root, 'optional-practice/civilian-fpv', name),
      path.join(temp, 'optional-practice/civilian-fpv', name),
    );
  }
  const git = (args) => execFileSync('git', args, { cwd: temp, stdio: 'pipe' });
  git(['init', '--quiet']);
  git(['add', '--', ...sources]);
  git([
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    '-c',
    'commit.gpgsign=false',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '--quiet',
    '-m',
    'Disposable audit fixture',
  ]);
  await writeFile(path.join(temp, 'archive.json'), JSON.stringify(f.archive));
  const before = await Promise.all(sources.map((name) => readFile(path.join(root, name), 'utf8')));
  const script = `
    import assert from 'node:assert/strict';
    import { readFileSync, writeFileSync } from 'node:fs';
    import { auditBuiltinAircraftCourse } from './scripts/fpv-static-course-proof.mjs';
    const archive = JSON.parse(readFileSync('archive.json', 'utf8'));
    const sources = ${JSON.stringify(sources)};
    for (const name of sources) {
      const original = readFileSync(name, 'utf8');
      let changed = false;
      try {
        await assert.rejects(auditBuiltinAircraftCourse(archive, 'flight-01', 'r1', {
          onProgress() { if (!changed) { changed = true; writeFileSync(name, original + '\\n// Disposable mutation.\\n'); } },
        }), { code: 'evaluator-source-changed' });
        assert.equal(changed, true);
      } finally { writeFileSync(name, original); }
    }
    assert.equal((await auditBuiltinAircraftCourse(archive, 'flight-01', 'r1')).ownedProofAssessment.eligible, true);
  `;
  execFileSync(process.execPath, ['--input-type=module'], {
    cwd: temp,
    input: script,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  assert.deepEqual(
    await Promise.all(sources.map((name) => readFile(path.join(root, name), 'utf8'))),
    before,
  );
});

// A short ordinary-input recording binds selection to real authored World data.
// Preparation is not a flight proof and does not need a completed recording.
const worldPreparationFlight = (() => {
  let pending;
  return () =>
    (pending ??= record({
      course: WORLD_CATALOGUE.find((entry) => entry.id === 'warehouse-01').course,
      ticks: 8,
      input: () => neutral,
    }));
})();
const worldSelection = {
  catalogue: 'WORLD_CATALOGUE',
  id: 'warehouse-01',
  revision: 'r1',
};

test('World preparation resolves full named catalog content without claiming verification or ownership', async () => {
  const f = await worldPreparationFlight(),
    before = canonicalJSON(f.archive),
    entry = WORLD_CATALOGUE.find((item) => item.id === worldSelection.id),
    result = prepareBuiltinWorldCourse(f.archive, worldSelection);
  assert.equal(result.format, 'AircraftBuiltinWorldCoursePreparation.v1');
  assert.deepEqual(result.builtinCourse, { ...worldSelection, packIdentity: entry.packIdentity });
  assert.deepEqual(result.course, validateWorldCourse(entry.course));
  assert.equal(result.archiveSha256, hash(f.archive));
  assert.equal(result.courseSha256, hash(result.course));
  assert.equal(result.catalogueContentSha256, hash(WORLD_CATALOGUE));
  assert.equal(result.toolingOnly, true);
  assert.equal(result.scored, false);
  assert.equal(result.defaultEligible, false);
  assert.deepEqual(result.verification, {
    physics: 'not-run',
    course: 'not-run',
    nativeOwnership: 'not-established',
  });
  assert.equal(aircraftCourseComparisonEligibility(result, result).eligible, false);
  assert.equal(isVerifiedStaticCourseProof(result), false);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.course.steps['self-level']));
  assert.notEqual(result.course, entry.course);
  assert.throws(() => (result.course.locales.en.title = 'Changed'), TypeError);
  assert.equal(canonicalJSON(f.archive), before);
  assert.equal(f.state.step, 0, 'A bound recording has not completed this authored course');
  const diagnostic = await verifyStaticAircraftCourse(f.archive, f.sidecar);
  assert.equal(diagnostic.physics.verified, true);
  assert.equal(diagnostic.course.verified, false);
  assert.equal(aircraftCourseComparisonEligibility(diagnostic, diagnostic).eligible, false);
});

test('World preparation keeps Flight School and World namespaces explicit', async () => {
  const f = await record({ ticks: 8, input: () => neutral }),
    selection = { catalogue: 'BEGINNER_CATALOGUE', id: 'beginner-01', revision: 'r1' },
    result = prepareBuiltinWorldCourse(f.archive, selection);
  assert.deepEqual(result.course, validateWorldCourse(lesson));
  assert.equal(result.builtinCourse.catalogue, 'BEGINNER_CATALOGUE');
  assert.equal(result.defaultEligible, false);
  for (const selected of [
    { ...selection, catalogue: 'WORLD_CATALOGUE' },
    { ...worldSelection, catalogue: 'BEGINNER_CATALOGUE' },
    { ...worldSelection, id: 'unknown' },
  ])
    assert.throws(() => prepareBuiltinWorldCourse(f.archive, selected), {
      code: 'unknown-or-ambiguous-builtin-world-course',
    });
  assert.throws(
    () => prepareBuiltinWorldCourse(f.archive, { ...worldSelection, id: 'flight-01' }),
    { code: 'unsupported-builtin-world-course-family' },
  );
});

test('World preparation rejects unbounded selectors and supplied authority fields', async () => {
  const { archive } = await worldPreparationFlight();
  for (const key of ['catalogue', 'id', 'revision'])
    for (const value of [null, 1, {}, '', 'a'.repeat(81), '../warehouse-01', ' warehouse-01'])
      assert.throws(() => prepareBuiltinWorldCourse(archive, { ...worldSelection, [key]: value }), {
        code: 'invalid-builtin-world-selection',
      });
  for (const key of [
    'course',
    'sidecar',
    'report',
    'policy',
    'courseAdapter',
    'Worker',
    'workerURL',
    'scored',
    'defaultEligible',
  ])
    assert.throws(
      () => prepareBuiltinWorldCourse(archive, { ...worldSelection, [key]: {} }),
      /not supported/i,
    );
  assert.throws(
    () => prepareBuiltinWorldCourse(archive, { ...worldSelection, catalogue: 'FLIGHT_COURSES' }),
    { code: 'unknown-builtin-world-catalogue' },
  );
  assert.throws(() => prepareBuiltinWorldCourse(archive, { ...worldSelection, revision: 'r9' }), {
    code: 'builtin-world-course-revision-mismatch',
  });
});

test('World preparation rejects unsupported dynamic and non-native course families', async () => {
  const { archive } = await worldPreparationFlight();
  const dynamic = WORLD_CATALOGUE.find(
      (entry) =>
        !entry.legacy && entry.course.format === 'FlightCourse.v2' && entry.course.actors.length,
    ),
    otherFamily = WORLD_CATALOGUE.find(
      (entry) =>
        !entry.legacy &&
        entry.course.format !== 'FlightCourse.v2' &&
        WORLD_CATALOGUE.filter((candidate) => candidate.id === entry.id).length === 1,
    );
  assert.ok(dynamic);
  assert.ok(otherFamily);
  const ambiguous = WORLD_CATALOGUE.find(
    (entry) => WORLD_CATALOGUE.filter((candidate) => candidate.id === entry.id).length > 1,
  );
  assert.ok(ambiguous);
  assert.throws(() => prepareBuiltinWorldCourse(archive, { ...worldSelection, id: ambiguous.id }), {
    code: 'unknown-or-ambiguous-builtin-world-course',
  });
  assert.throws(
    () =>
      prepareBuiltinWorldCourse(archive, {
        catalogue: 'BEGINNER_CATALOGUE',
        id: 'beginner-43',
        revision: 'r1',
      }),
    { code: 'unsupported-course-objective' },
  );
  for (const [entry, code] of [
    [dynamic, 'unsupported-dynamic-course'],
    [otherFamily, 'unsupported-builtin-world-course-family'],
  ])
    assert.throws(
      () =>
        prepareBuiltinWorldCourse(archive, {
          catalogue: 'WORLD_CATALOGUE',
          id: entry.id,
          revision: entry.course.revision,
        }),
      { code },
    );
});

test('World preparation binds complete course content and the archive host family', async () => {
  const f = await worldPreparationFlight(),
    changed = copy(f.course);
  changed.locales.en.brief += ' Modified same-ID content.';
  const altered = await record({ course: changed, ticks: 8, input: () => neutral });
  assert.equal(
    (await verifyStaticAircraftCourse(altered.archive, altered.sidecar)).physics.verified,
    true,
  );
  assert.throws(() => prepareBuiltinWorldCourse(altered.archive, worldSelection), {
    code: 'builtin-world-course-identity-mismatch',
  });
  const otherHost = packet(
    f.archive.manifest.config,
    f.archive.manifest.identity,
    f.archive.segments,
    {
      host: 'academy',
    },
  );
  assert.throws(() => prepareBuiltinWorldCourse(otherHost, worldSelection), {
    code: 'unsupported-builtin-world-archive-host',
  });
  const otherFamily = await record({
    course: f.course,
    ticks: 8,
    input: () => neutral,
    alterOptions: (options) => ({
      ...options,
      configuration: {
        ...options.configuration,
        environment: { ...options.configuration.environment, host: 'academy' },
      },
    }),
  });
  assert.throws(() => prepareBuiltinWorldCourse(otherFamily.archive, worldSelection), {
    code: 'course-family-mismatch',
  });
});

test('World preparation rejects mutable catalog changes and preserves prepared copies', async () => {
  const { archive } = await worldPreparationFlight(),
    result = prepareBuiltinWorldCourse(archive, worldSelection),
    before = canonicalJSON(result),
    entry = WORLD_CATALOGUE.find((item) => item.id === 'warehouse-01'),
    title = entry.course.locales.en.title;
  try {
    entry.course.locales.en.title = 'Modified source after preparation';
    assert.throws(() => prepareBuiltinWorldCourse(archive, worldSelection), {
      code: 'builtin-world-catalogue-changed',
    });
    assert.equal(canonicalJSON(result), before);
  } finally {
    entry.course.locales.en.title = title;
  }
  assert.deepEqual(prepareBuiltinWorldCourse(archive, worldSelection), result);
});
