#!/usr/bin/env node
// Manual compatibility diagnostic, not completion qualification or a runtime fix.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const [projectArg, runtimeArg, receiptArg] = process.argv.slice(2);
if (!receiptArg) throw Error('Use EXACT_PROJECT RUNTIME_ROOT NEW_RECEIPT');
const runtime = path.resolve(runtimeArg),
  projectBytes = await readFile(projectArg),
  project = JSON.parse(projectBytes),
  sha = (b) => createHash('sha256').update(b).digest('hex'),
  base = path.join(runtime, 'optional-practice/civilian-fpv/');
const model = await import(pathToFileURL(path.join(base, 'world-model.mjs'))),
  collisionModule = await import(pathToFileURL(path.join(base, 'world-collision.mjs')));
await model.initWorldRuntime();
const original = (suffix) => structuredClone(project.courses.find((c) => c.id.endsWith(suffix))),
  cube = (id, min, max) => ({ id, min, max }),
  xyz = (x, y, z) => ({ x, y, z });
const cases = [];
function add(name, source, obstacleIds, options = {}) {
  const course = original(source),
    actor = course.actors[0];
  course.id = 'harbor-diagnostic-' + String(cases.length + 1);
  course.revision = 'diagnostic-r1';
  course.obstacles = course.obstacles.filter((o) => obstacleIds.includes(o.id));
  if (options.obstacles) course.obstacles = options.obstacles;
  if (options.actor) Object.assign(actor, options.actor);
  if (options.spawn) course.spawn = options.spawn;
  course.steps = Object.fromEntries(
    ['self-level', 'acro'].map((mode) => [
      mode,
      [
        {
          type: 'hold',
          min: xyz(-1000, 15000, -1000),
          max: xyz(1000, 17000, 1000),
          ticks: 50,
          maxSpeed: 500,
          maxTilt: 1000,
          minTilt: 0,
          centred: false,
          heading: null,
        },
      ],
    ]),
  );
  course.rules.maxTicks = 10000;
  cases.push({
    name,
    course,
    expected:
      options.expected ??
      'Diagnostic only; support and motion observations retained, not a completion proof.',
  });
}
add('vehicle canonical half-space control', '05', [], {
  actor: { position: xyz(4e3, 0, 0), path: [xyz(4e3, 0, 0), xyz(4e3, 0, 18e3)] },
  spawn: xyz(-2e3, 250, 34e3),
  expected: 'Continuous movement on $floor; no finite-box contact.',
});
add('patrol canonical half-space control', '06', [], {
  actor: { position: xyz(-15500, 0, 30000), path: [xyz(-15500, 0, 30000), xyz(-15500, 0, 33500)] },
  spawn: xyz(-2e3, 250, 34e3),
  expected: 'Continuous walking on $floor; no finite-box contact.',
});
add('vehicle exact raised quay only', '05', ['platform-quay']);
add('patrol exact raised deck only', '06', ['platform-service-deck'], {
  spawn: xyz(-12000, 5750, 34000),
});
add('vehicle narrower finite support', '05', [], {
  obstacles: [cube('platform-quay', xyz(-2000, 0, -2000), xyz(10000, 2000, 22000))],
  spawn: xyz(0, 2250, 20000),
});
const indices = [
  0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5,
  3, 7, 5,
];
function mesh(box) {
  const vertices = [];
  for (const z of [box.min.z, box.max.z])
    for (const y of [box.min.y, box.max.y])
      for (const x of [box.min.x, box.max.x]) vertices.push(x, y, z);
  return { id: box.id, type: 'trimesh', vertices, indices };
}
add('vehicle same-envelope closed trimesh diagnostic', '05', [], {
  obstacles: [mesh(original('05').obstacles.find((o) => o.id === 'platform-quay'))],
  expected:
    'Diagnostic geometry representation only; not an approved content change. Mesh interiors differ from cuboid solids.',
});
add('patrol same-envelope closed trimesh diagnostic', '06', [], {
  obstacles: [mesh(original('06').obstacles.find((o) => o.id === 'platform-service-deck'))],
  spawn: xyz(-12000, 5750, 34000),
  expected: 'Diagnostic geometry representation only; not an approved content change.',
});
add('vehicle finite support with real blocking wall', '05', ['platform-quay']);
cases
  .at(-1)
  .course.obstacles.push(cube('wall-diagnostic', xyz(1000, 2000, 8000), xyz(7000, 4500, 9000)));
cases.at(-1).expected =
  'A correction must still stop at the actual wall, with no pass-through or endpoint snap.';
add('vehicle finite support ending before target', '05', [], {
  obstacles: [cube('platform-quay', xyz(-2000, 0, -2000), xyz(10000, 2000, 9000))],
  spawn: xyz(0, 2250, 4000),
  expected:
    'A correction must retain support and stop at the actual ledge, without hidden ground or authored endpoint snap.',
});
const receipt = {
  format: 'FPVHarborGroundActorDiagnostic.v1',
  scope:
    'Actual unchanged createWorldFlight ordinary neutral inputs for3000ticks/case. Synthetic minimal geometry cases; no completed route, replacement collider or runtime acceptance claim.',
  project: {
    path: path.resolve(projectArg),
    bytes: projectBytes.length,
    sha256: sha(projectBytes),
  },
  runtime: await Promise.all(
    ['world-model.mjs', 'world-collision.mjs', 'vendor/rapier/rapier.mjs'].map(async (file) => {
      const bytes = await readFile(path.join(base, file));
      return { path: file, bytes: bytes.length, sha256: sha(bytes) };
    }),
  ),
  tickHz: model.WORLD_FLIGHT_HZ,
  cases: [],
};
for (const item of cases) {
  const course = model.validateWorldCourse(item.course),
    actor = course.actors[0],
    flight = model.createWorldFlight({ course, mode: 'self-level' }),
    survey = collisionModule.createWorldCollision(course),
    samples = [],
    supports = {},
    heightRange = [Infinity, -Infinity];
  let travel = 0,
    blockedTicks = 0,
    maxStill = 0,
    still = 0,
    missingSupport = 0;
  try {
    flight.arm();
    let state = flight.snapshot();
    for (let i = 0; i < 3000; i++) {
      const previous = state.actors[0];
      state = flight.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 });
      const actual = state.actors[0],
        delta = Math.hypot(
          ...['x', 'y', 'z'].map((k) => actual.position[k] - previous.position[k]),
        );
      travel += delta;
      blockedTicks += Number(actual.blocked);
      still = delta === 0 ? still + 1 : 0;
      maxStill = Math.max(maxStill, still);
      heightRange[0] = Math.min(heightRange[0], actual.position.y);
      heightRange[1] = Math.max(heightRange[1], actual.position.y);
      const support = survey.support(
        { ...actual.position, y: actual.position.y + 20 },
        actual.radius,
        40,
      );
      if (!support) missingSupport++;
      else supports[support.id] = (supports[support.id] ?? 0) + 1;
      if (i % 250 === 0)
        samples.push({
          tick: state.ticks,
          position: actual.position,
          blocked: actual.blocked,
          support,
        });
    }
    receipt.cases.push({
      name: item.name,
      expected: item.expected,
      course,
      travel,
      blockedTicks,
      maxStill,
      missingSupport,
      supports,
      heightRange,
      samples,
      final: state.actors[0],
      status: state.status,
    });
  } finally {
    flight.dispose();
    survey.dispose();
  }
}
await writeFile(receiptArg, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify(
    receipt.cases.map(
      ({ name, travel, blockedTicks, maxStill, missingSupport, heightRange, final }) => ({
        name,
        travel,
        blockedTicks,
        maxStill,
        missingSupport,
        heightRange,
        final: final.position,
      }),
    ),
    null,
    2,
  ),
);
