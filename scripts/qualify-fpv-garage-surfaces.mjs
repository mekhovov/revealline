#!/usr/bin/env node
// Manual source-bound geometry, collision support and recording qualification; no unit suite.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import { WORLD_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/world-demonstrations.mjs';
import { buildGarageSurfaceGeometry } from '../optional-practice/civilian-fpv/world-visuals.mjs';
import {
  initWorldRuntime,
  validateWorldCourse,
  replayWorldFlight,
  createWorldFlight,
  worldStateIdentity,
} from '../optional-practice/civilian-fpv/world-model.mjs';
import { createWorldCollision } from '../optional-practice/civilian-fpv/world-collision.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url)),
  baseline = 'a1cb86c85cd52db7256ad2ed16c30c8f40f90c32',
  args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out'))
  throw Error('Usage: node scripts/qualify-fpv-garage-surfaces.mjs [--out NEW_RECEIPT.json]');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  checks = [],
  structureIds = [
    'garage-ramp',
    'garage-deck',
    ...[0, 1].flatMap((i) => [0, 1, 2].map((j) => `column-${i}-${j}`)),
  ],
  expectedCourseIds = [
    ...Array.from({ length: 8 }, (_, i) => `garage-${String(i + 1).padStart(2, '0')}`),
    'beginner-41',
  ];
function check(title, pass, detail) {
  checks.push({ title, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  if (!pass) throw Error(title);
}
const immutable = {},
  sourceSha256 = {};
for (const name of [
  'world-catalogue.mjs',
  'snake-hunt-catalogue.mjs',
  'expressive-hunt-courses.mjs',
  'world-model.mjs',
  'world-collision.mjs',
  'world-demonstrations.mjs',
  'world-assets.mjs',
  'world-themes.mjs',
  'world-progress.mjs',
]) {
  const relative = 'optional-practice/civilian-fpv/' + name,
    current = await readFile(new URL('../' + relative, import.meta.url)),
    before = execFileSync('git', ['show', baseline + ':' + relative], {
      cwd: ROOT,
      maxBuffer: 6 * 1024 * 1024,
      timeout: 10000,
    });
  immutable[relative] = hash(current);
  check(name + ' byte-identical to baseline', current.equals(before));
}
for (const name of ['renderer.mjs', 'world-visuals.mjs'])
  sourceSha256[name] = hash(
    await readFile(new URL('../optional-practice/civilian-fpv/' + name, import.meta.url)),
  );
const rows = [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE],
  garage = rows.filter((r) => r.course.environment === 'garage'),
  canonical = garage.filter((r) => r.course.obstacles.some((o) => structureIds.includes(o.id))),
  snake = garage.filter((r) => !canonical.includes(r));
check(
  '18 Garage courses contain exactly 9 canonical and 9 unaffected Snake layouts',
  garage.length === 18 &&
    canonical.length === 9 &&
    snake.length === 9 &&
    JSON.stringify(canonical.map((r) => r.id).sort()) ===
      JSON.stringify(expectedCourseIds.sort()) &&
    canonical.every((r) => structureIds.every((id) => r.course.obstacles.some((o) => o.id === id))),
);
const inventory = {
  totalCourses: rows.length,
  worldCourses: WORLD_CATALOGUE.length,
  schoolCourses: BEGINNER_CATALOGUE.length,
  environmentCount: new Set(rows.map((r) => r.course.environment)).size,
  garageCourses: garage.length,
  canonical: canonical.map((r) => r.id),
  unchangedSnake: snake.map((r) => ({ id: r.id, obstacles: r.course.obstacles.map((o) => o.id) })),
};
const sub = (a, b) => a.map((n, i) => n - b[i]),
  dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  unit = (v) => v.map((n) => n / Math.hypot(...v));
// Canonical Garage ramp triangles are rendered DoubleSide; plane containment
// is independent of their retained inward source winding. Detail winding is checked below.
function onTriangle(point, a, b, c, normal) {
  const ab = sub(b, a),
    ac = sub(c, a),
    n = unit(cross(ab, ac)),
    ap = sub(point, a);
  if (Math.abs(dot(ap, n)) > 1e-5 || Math.abs(dot(n, normal)) < 0.99999) return false;
  const d00 = dot(ab, ab),
    d01 = dot(ab, ac),
    d11 = dot(ac, ac),
    d20 = dot(ap, ab),
    d21 = dot(ap, ac),
    denominator = d00 * d11 - d01 * d01,
    v = (d11 * d20 - d01 * d21) / denominator,
    w = (d00 * d21 - d01 * d20) / denominator;
  return v >= -1e-5 && w >= -1e-5 && v + w <= 1 + 1e-5;
}
function confined(obstacle, point, normal) {
  if (obstacle.type === 'trimesh') {
    for (let i = 0; i < obstacle.indices.length; i += 3) {
      const triangle = obstacle.indices
        .slice(i, i + 3)
        .map((index) => obstacle.vertices.slice(index * 3, index * 3 + 3).map((n) => n / 1000));
      if (onTriangle(point, ...triangle, normal)) return true;
    }
    return false;
  }
  const half = ['x', 'y', 'z'].map((axis) => (obstacle.max[axis] - obstacle.min[axis]) / 2000);
  return (
    point.every((v, i) => Number.isFinite(v) && Math.abs(v) <= half[i] + 1e-5) &&
    point.some(
      (v, i) => Math.abs(Math.abs(v) - half[i]) < 1e-5 && Math.abs(normal[i] - Math.sign(v)) < 1e-5,
    )
  );
}
let vertices = 0;
const geometry = [],
  ramp = canonical[0].course.obstacles.find((o) => o.id === 'garage-ramp'),
  deck = canonical[0].course.obstacles.find((o) => o.id === 'garage-deck'),
  rampPoints = Array.from({ length: ramp.vertices.length / 3 }, (_, i) =>
    ramp.vertices.slice(i * 3, i * 3 + 3).map((n) => n / 1000),
  ),
  crestY = Math.max(...rampPoints.map((p) => p[1])),
  crest = rampPoints.filter((p) => p[1] === crestY),
  crestZ = crest[0][2],
  seamPoints = { 'garage-ramp': [], 'garage-deck': [] },
  nearPoint = (a, b) => a.every((n, i) => Math.abs(n - b[i]) < 1e-5);
check(
  'Authored ramp crest and deck edge share their derived plane',
  crest.length === 2 &&
    crest.every((p) => p[2] === crestZ) &&
    deck.max.y / 1000 === crestY &&
    deck.max.z / 1000 === crestZ &&
    Math.min(...crest.map((p) => p[0])) === deck.min.x / 1000 &&
    Math.max(...crest.map((p) => p[0])) === deck.max.x / 1000,
);
for (const obstacle of canonical[0].course.obstacles.filter((o) => structureIds.includes(o.id))) {
  const before = JSON.stringify(obstacle),
    groups = buildGarageSurfaceGeometry(obstacle);
  let count = 0;
  check(
    obstacle.id + ' has bounded role/layer surface batches',
    groups.length > 0 &&
      groups.every(
        (g) =>
          ['concrete', 'steel', 'rubber', 'enamel'].includes(g.role) &&
          Number.isInteger(g.layer) &&
          g.layer > 0,
      ),
  );
  for (const { geometry: g, role } of groups) {
    const p = g.attributes.position,
      n = g.attributes.normal,
      uv = g.attributes.uv;
    count += p.count;
    check(
      obstacle.id + ' detail has finite triangle attributes',
      p.count > 0 &&
        p.count % 3 === 0 &&
        n?.count === p.count &&
        uv?.count === p.count &&
        [p, n, uv].every((a) => Array.from(a.array).every(Number.isFinite)),
    );
    for (let i = 0; i < p.count; i += 3) {
      const triangle = [0, 1, 2].map((j) => [p.getX(i + j), p.getY(i + j), p.getZ(i + j)]),
        normal = [n.getX(i), n.getY(i), n.getZ(i)],
        winding = unit(cross(sub(triangle[1], triangle[0]), sub(triangle[2], triangle[0])));
      if (
        dot(winding, normal) < 0.99999 ||
        !triangle.every((v) => confined(obstacle, v, normal)) ||
        !confined(
          obstacle,
          [0, 1, 2].map((axis) => triangle.reduce((s, p) => s + p[axis], 0) / 3),
          normal,
        )
      )
        throw Error('Noncoplanar, inward or out-of-bounds detail: ' + obstacle.id);
    }
    if (role === 'enamel' && seamPoints[obstacle.id]) {
      const origin = ['x', 'y', 'z'].map((axis) =>
        obstacle.type === 'trimesh' ? 0 : (obstacle.min[axis] + obstacle.max[axis]) / 2000,
      );
      for (let i = 0; i < p.count; i++) {
        const point = [p.getX(i), p.getY(i), p.getZ(i)].map((v, axis) => v + origin[axis]);
        if (Math.abs(point[1] - crestY) < 1e-5 && Math.abs(point[2] - crestZ) < 1e-5)
          seamPoints[obstacle.id].push({ point, uv: [uv.getX(i), uv.getY(i)] });
      }
    }
    g.dispose();
  }
  check(obstacle.id + ' input obstacle remains immutable', JSON.stringify(obstacle) === before);
  vertices += count;
  geometry.push({ id: obstacle.id, batches: groups.length, vertices: count });
}
check(
  'Total detail work remains bounded',
  geometry.reduce((n, g) => n + g.batches, 0) <= 16 && vertices < 24000,
  geometry,
);
const uniqueSeamPoints = Object.fromEntries(
    Object.entries(seamPoints).map(([id, points]) => [
      id,
      points.filter((p, i) => points.findIndex((other) => nearPoint(p.point, other.point)) === i),
    ]),
  ),
  paintSeam = uniqueSeamPoints['garage-ramp'].map((ramp) => ({
    ramp,
    deck: uniqueSeamPoints['garage-deck'].find((deck) => nearPoint(ramp.point, deck.point)),
  }));
check(
  'Both enamel edge bands meet at four matching ramp/deck crest vertices',
  Object.values(uniqueSeamPoints).every((points) => points.length === 4) &&
    paintSeam.every((p) => p.deck),
  paintSeam,
);
check(
  'Ramp/deck crest paint retains equal six-metre world UV phase',
  Object.values(seamPoints)
    .flat()
    .every((p) => p.uv.every((v, i) => Math.abs(v - p.point[i === 0 ? 0 : 2] / 6) < 1e-6)) &&
    paintSeam.every((p) => p.ramp.uv.every((v, i) => Math.abs(v - p.deck.uv[i]) < 1e-6)),
  paintSeam,
);
for (const row of garage)
  for (const o of row.course.obstacles.filter((o) => !structureIds.includes(o.id))) {
    const groups = buildGarageSurfaceGeometry(o);
    check(row.id + '/' + o.id + ' remains excluded', groups.length === 0);
    for (const g of groups) g.geometry.dispose();
  }
await initWorldRuntime();
const supportProbes = [];
for (const id of ['garage-02', 'beginner-41']) {
  const course = validateWorldCourse(rows.find((r) => r.id === id).course),
    collision = createWorldCollision(course),
    radius = course.rules.droneRadius;
  try {
    for (const [name, position, expectedId, expectedY] of [
      ['deck-top', { x: -30000, y: 5020, z: -18000 }, 'garage-deck', 5001],
      ['ramp-low', { x: -30000, y: 1020, z: 9600 }, 'garage-ramp', 1006],
      ['ramp-middle', { x: -30000, y: 2520, z: 3000 }, 'garage-ramp', 2506],
      ['ramp-high', { x: -30000, y: 4020, z: -3600 }, 'garage-ramp', 4006],
      ['floor-under-deck', { x: -30000, y: 20, z: -18000 }, '$floor', 0],
      ['outside-deck-west', { x: -35010, y: 5020, z: -18000 }, null, null],
      ['outside-deck-east', { x: -23990, y: 5020, z: -18000 }, null, null],
      ['outside-ramp-west', { x: -35010, y: 2520, z: 3000 }, null, null],
      ['outside-ramp-east', { x: -23990, y: 2520, z: 3000 }, null, null],
      [
        'school-deck',
        { x: 0, y: 5020, z: -16000 },
        id === 'beginner-41' ? 'school-upper-deck' : null,
        id === 'beginner-41' ? 5001 : null,
      ],
    ]) {
      const support = collision.support(position, radius, 100);
      check(
        id + '/' + name + ' retains support identity and exact height',
        (support?.id ?? null) === expectedId && (support?.y ?? null) === expectedY,
      );
      if (expectedId === 'garage-ramp')
        check(
          id + '/' + name + ' retains slope normal',
          JSON.stringify(support.normal) === JSON.stringify({ x: 0, y: 975133, z: 221621 }),
        );
      supportProbes.push({ course: id, name, position, radius, drop: 100, support });
    }
    for (const [name, position] of [
      ['ramp-toe', { x: -30000, y: 20, z: 13990 }],
      ['ramp-crest', { x: -30000, y: 5020, z: -7990 }],
      ['deck-ramp-seam', { x: -30000, y: 5020, z: -8000 }],
      ['deck-inside-west-edge', { x: -34990, y: 5020, z: -18000 }],
      ['deck-inside-east-edge', { x: -24010, y: 5020, z: -18000 }],
    ]) {
      const support = collision.support(position, radius, 100);
      check(
        id + '/' + name + ' remains a supported canonical surface',
        !!support && ['garage-ramp', 'garage-deck'].includes(support.id),
      );
      supportProbes.push({ course: id, name, position, radius, drop: 100, support });
    }
  } finally {
    collision.dispose();
  }
}
const demonstrations = [],
  landingWitnesses = [];
for (const row of WORLD_DEMONSTRATIONS) {
  const entry = canonical.find((r) => r.id === row.proof.course);
  if (!entry) continue;
  const course = validateWorldCourse(entry.course),
    proof = row.proof,
    result = await replayWorldFlight(course, proof, { yieldControl: async () => {} });
  check(
    course.id + '/' + proof.mode + ' actual replay completes exactly',
    result.state.status === 'complete' &&
      worldStateIdentity(result.state) === proof.finalStateIdentity,
  );
  demonstrations.push({
    course: course.id,
    mode: proof.mode,
    ticks: result.state.ticks,
    finalStateIdentity: worldStateIdentity(result.state),
    contacts: result.state.contacts,
    health: result.state.health,
  });
  if (!['garage-02', 'beginner-41'].includes(course.id)) continue;
  const flight = createWorldFlight({ course, mode: proof.mode, response: proof.response });
  try {
    flight.arm();
    let before = flight.snapshot(),
      landed = null,
      departed = null;
    const expectedSurface = course.id === 'garage-02' ? 'garage-deck' : 'school-upper-deck';
    for (const frame of proof.frames) {
      const state = flight.step(
          Object.fromEntries(
            ['roll', 'pitch', 'yaw', 'throttle', 'actions'].map((key, i) => [key, frame[i]]),
          ),
          { quantized: true },
        ),
        target = course.steps[proof.mode][before.step];
      if (
        !landed &&
        target?.type === 'land' &&
        target.surface === expectedSurface &&
        state.step > before.step
      ) {
        check(
          course.id + '/' + proof.mode + ' elevated landing completes on exact support',
          state.grounded &&
            state.support?.id === expectedSurface &&
            state.landingSpeed <= target.maxSpeed &&
            state.landingTilt <= target.maxTilt,
        );
        landed = {
          tick: state.ticks,
          step: state.step,
          position: state.position,
          support: state.support,
          landingSpeed: state.landingSpeed,
          landingTilt: state.landingTilt,
        };
      }
      if (
        landed &&
        !departed &&
        state.ticks > landed.tick &&
        !state.grounded &&
        state.position.y > landed.position.y + 50
      )
        departed = {
          tick: state.ticks,
          step: state.step,
          position: state.position,
          support: state.support,
        };
      before = state;
    }
    check(
      course.id + '/' + proof.mode + ' leaves elevated support and completes unchanged',
      !!landed && !!departed && worldStateIdentity(before) === proof.finalStateIdentity,
    );
    landingWitnesses.push({ course: course.id, mode: proof.mode, landed, departed });
  } finally {
    flight.dispose();
  }
}
check(
  'All 17 Garage demonstrations and three elevated support witnesses verified',
  demonstrations.length === 17 && landingWitnesses.length === 3,
);
check(
  'All 38,251 recorded commands retained',
  demonstrations.reduce((sum, row) => sum + row.ticks, 0) === 38251,
);
for (const [relative, digest] of Object.entries(immutable))
  check(
    relative + ' remains immutable after verification',
    hash(await readFile(new URL('../' + relative, import.meta.url))) === digest,
  );
for (const [name, digest] of Object.entries(sourceSha256))
  check(
    name + ' remains bound after verification',
    hash(await readFile(new URL('../optional-practice/civilian-fpv/' + name, import.meta.url))) ===
      digest,
  );
const receipt = {
  format: 'FPVGarageSurfacesFunctionalEvidence.v1',
  date: new Date().toISOString(),
  baseline,
  integratedMain: baseline,
  originalBaseline: '822188e9bebdcf3d46119b48bfd0558e708eb051',
  sourceSha256,
  scope:
    'Manual source-bound canonical geometry, collision support and actual bundled demonstration replay; no browser, package, physical-device performance or human art acceptance claim.',
  passed: checks.every((c) => c.pass),
  checks,
  immutable,
  inventory,
  geometry,
  paintSeam,
  supportProbes,
  demonstrations,
  landingWitnesses,
};
if (args[1]) await writeFile(args[1], JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    checks: checks.length,
    passed: receipt.passed,
    vertices,
    triangles: vertices / 3,
    paintSeamPoints: paintSeam.length,
    demonstrations: demonstrations.length,
    supportProbes: supportProbes.length,
    landingWitnesses: landingWitnesses.length,
  }),
);
