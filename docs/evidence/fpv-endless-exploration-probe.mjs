// Manual production-runtime qualification, not additional unit-test coverage.
// Run from the repository root: node docs/evidence/fpv-endless-exploration-probe.mjs
// Emits a JSON receipt to stdout. Does not write files or run a browser.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  canonicalFreeFlightEntry,
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
  FLIGHT_WORLDS,
} from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  validateWorldCourse,
} from '../../optional-practice/civilian-fpv/world-model.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const baseline = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = [
  'optional-practice/civilian-fpv/world-app.mjs',
  'optional-practice/civilian-fpv/world-catalogue.mjs',
  'optional-practice/civilian-fpv/world-model.mjs',
  'optional-practice/civilian-fpv/world-collision.mjs',
  'optional-practice/civilian-fpv/world-demonstrations.mjs',
];
const sources = {},
  unchanged = {};
for (const path of sourceFiles) {
  sources[path] = hash(await readFile(new URL('../../' + path, import.meta.url)));
  if (/(?:world-model|world-collision|world-demonstrations)\.mjs$/.test(path)) {
    unchanged[path] =
      sources[path] ===
      hash(
        execFileSync('git', ['show', baseline + ':' + path], {
          cwd: root,
          maxBuffer: 32 * 1024 * 1024,
          env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
        }),
      );
    assert(unchanged[path], `Runtime/proof source changed from ${baseline}: ${path}`);
  }
}
const checks = [],
  worlds = [],
  longFlights = [];
function check(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
  assert(condition, name);
}

// Reproduce the app's unscored course projection, then exercise the production
// validator and simulator. This does not claim to click the actual UI handler.
function practiceCourse(source) {
  const course = structuredClone(source.course);
  course.format = 'FlightCourse.v2';
  delete course.pursuit;
  course.id = 'freeflight-verification';
  course.world ??= {
    id: source.world,
    theme: source.theme,
    style: FLIGHT_WORLDS.find((world) => world.id === source.world)?.style ?? 'hangar',
  };
  course.actors = [];
  course.rules = { ...course.rules, maxTicks: 36000 };
  course.conditions ??= { profile: 'clear', revision: 'r1' };
  course.steps = {
    'self-level': [{ type: 'survive', ticks: 36000 }],
    acro: [{ type: 'survive', ticks: 36000 }],
  };
  return validateWorldCourse(course);
}

const catalogue = [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE];
const originalCatalogue = JSON.stringify(catalogue);
const neutral = { throttle: 0, pitch: 0, roll: 0, yaw: 0 };
await initWorldRuntime();
for (const world of FLIGHT_WORLDS) {
  const source = canonicalFreeFlightEntry(catalogue, world.id);
  check(
    `${world.id}: canonical selection does not depend on catalogue order`,
    source === canonicalFreeFlightEntry([...catalogue].reverse(), world.id),
  );
  check(`${world.id}: canonical source is not a Hunt arena`, source.activity !== 'hunt');
  check(`${world.id}: canonical source is not a pursuit variant`, !source.course.pursuit);
  const course = practiceCourse(source);
  worlds.push({
    world: world.id,
    sourceCourse: source.id,
    obstacles: course.obstacles.length,
    bounds: course.bounds,
  });
  for (const mode of ['self-level', 'acro']) {
    const flight = createWorldFlight({ course, mode, unscoredPractice: true });
    try {
      check(`${world.id}/${mode}: starts disarmed`, flight.snapshot().status === 'disarmed');
      flight.arm();
      check(`${world.id}/${mode}: accepts flight input`, flight.step(neutral).status === 'active');
      let rejected = false;
      try {
        createWorldRecorder(flight);
      } catch (error) {
        rejected = /cannot create proofs/.test(error.message);
      }
      check(`${world.id}/${mode}: unscored recording is rejected`, rejected);
    } finally {
      flight.dispose();
    }
  }
}
check(
  'Source catalogue stays byte-identical in memory',
  JSON.stringify(catalogue) === originalCatalogue,
);

const imported = (id, width, obstacles, archived = false) => ({
  id,
  world: 'imported',
  packIdentity: 'pack',
  archived,
  course: {
    bounds: { min: { x: 0, z: 0 }, max: { x: width, z: width } },
    obstacles: Array.from({ length: obstacles }, () => ({})),
  },
});
const imports = [
  imported('dense-small', 10, 8),
  imported('wide-empty', 20, 0),
  imported('wide-rich', 20, 3),
  imported('archived', 30, 9, true),
];
check(
  'Imported fallback prefers widest, then richest, excludes archived entries',
  canonicalFreeFlightEntry(imports, 'imported').id === 'wide-rich',
);
check(
  'Imported fallback is independent of catalogue order',
  canonicalFreeFlightEntry([...imports].reverse(), 'imported').id === 'wide-rich',
);
check('Missing world returns no source', canonicalFreeFlightEntry(imports, 'missing') === null);

for (const mode of ['self-level', 'acro']) {
  const flight = createWorldFlight({
    course: practiceCourse(canonicalFreeFlightEntry(catalogue, 'warehouse')),
    mode,
    unscoredPractice: true,
  });
  try {
    flight.arm();
    for (let tick = 0; tick < 36003; tick++) flight.step(neutral);
    check(
      `${mode}: remains active beyond previous 12-minute limit`,
      flight.snapshot().status === 'active',
    );
    check(
      `${mode}: consumes commands beyond previous tick limit`,
      flight.snapshot().ticks === 36003,
    );
    longFlights.push({ mode, ticks: flight.snapshot().ticks, status: flight.snapshot().status });
    flight.pause();
    check(`${mode}: pauses after old limit`, flight.snapshot().status === 'paused');
    flight.arm();
    check(`${mode}: resumes after old limit`, flight.step(neutral).ticks === 36004);
    flight.reset();
    check(`${mode}: reset clears elapsed ticks`, flight.snapshot().ticks === 0);
    check(`${mode}: reset remains disarmed`, flight.snapshot().status === 'disarmed');
  } finally {
    flight.dispose();
  }
}

process.stdout.write(
  JSON.stringify(
    {
      verification: 'fpv-endless-exploration-functional-probe',
      baseline,
      node: process.version,
      result: 'PASS',
      assertionCount: checks.length,
      sources,
      unchangedRuntimeAndProofSources: unchanged,
      worlds,
      longFlights,
      checks,
      limitations: [
        'No browser interaction, rendering performance, hardware input or offline installation claim.',
        'Practice course projection matches the app handler; the handler itself needs browser verification.',
        'Imported fallback uses synthetic catalogue metadata; this is not an import pipeline qualification.',
        'No enlarged world, scenery relocation or collision-rule change is included.',
      ],
    },
    null,
    2,
  ) + '\n',
);
