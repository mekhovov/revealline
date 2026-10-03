#!/usr/bin/env node
// Manual source-bound geometry and actual recording qualification, not a unit suite.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import { WORLD_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/world-demonstrations.mjs';
import { buildStadiumStructureGeometry } from '../optional-practice/civilian-fpv/world-visuals.mjs';
import {
  initWorldRuntime,
  validateWorldCourse,
  replayWorldFlight,
  worldStateIdentity,
} from '../optional-practice/civilian-fpv/world-model.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url)),
  baseline = 'b3b23a76b4a4f41cd97e228ae1400fce96abcde8',
  args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out'))
  throw Error('Usage: node scripts/qualify-fpv-stadium-structures.mjs [--out NEW_RECEIPT.json]');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  checks = [];
function check(title, pass, detail) {
  checks.push({ title, pass, ...(detail ? { detail } : {}) });
  if (!pass) throw Error(title);
}
const immutable = {};
for (const name of [
  'world-catalogue.mjs',
  'snake-hunt-catalogue.mjs',
  'world-model.mjs',
  'world-collision.mjs',
  'world-demonstrations.mjs',
  'world-assets.mjs',
  'world-themes.mjs',
]) {
  const path = 'optional-practice/civilian-fpv/' + name,
    current = await readFile(new URL('../' + path, import.meta.url)),
    before = execFileSync('git', ['show', baseline + ':' + path], {
      cwd: ROOT,
      maxBuffer: 6 * 1024 * 1024,
      timeout: 10000,
    });
  immutable[path] = hash(current);
  check(name + ' unchanged', current.equals(before));
}
const rows = [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE],
  stadium = rows.filter((entry) => entry.course.environment === 'stadium'),
  canonical = stadium.filter((entry) =>
    entry.course.obstacles.some((item) => item.id === 'scoreboard'),
  );
check('27 Stadium / 13 canonical courses', stadium.length === 27 && canonical.length === 13);
let vertices = 0;
const geometry = [];
for (const obstacle of canonical[0].course.obstacles) {
  const size = ['x', 'y', 'z'].map((key) => (obstacle.max[key] - obstacle.min[key]) / 1000),
    groups = buildStadiumStructureGeometry(obstacle.id, size);
  let count = 0;
  for (const group of groups) {
    const position = group.geometry.attributes.position,
      uv = group.geometry.attributes.uv;
    count += position.count;
    for (let i = 0; i < position.count; i++) {
      const xyz = [position.getX(i), position.getY(i), position.getZ(i)];
      if (
        !xyz.every(
          (value, key) => Number.isFinite(value) && Math.abs(value) <= size[key] / 2 + 0.00001,
        ) ||
        !xyz.some((value, key) => Math.abs(Math.abs(value) - size[key] / 2) < 0.00001)
      )
        throw Error('Out of bounds or noncoplanar detail: ' + obstacle.id);
      if (!Number.isFinite(uv.getX(i) + uv.getY(i))) throw Error('Invalid detail UV');
    }
    group.geometry.dispose();
  }
  vertices += count;
  geometry.push({ id: obstacle.id, batches: groups.length, vertices: count });
}
check(
  'coplanar role batches bounded',
  geometry.reduce((sum, row) => sum + row.batches, 0) === 7 && vertices < 5000,
  geometry,
);
check(
  'plain beginner platform excluded',
  buildStadiumStructureGeometry('school-finish-platform', [7, 2, 7]).length === 0,
);
await initWorldRuntime();
const demonstrations = [];
for (const row of WORLD_DEMONSTRATIONS) {
  const entry = canonical.find((item) => item.id === row.proof.course);
  if (!entry) continue;
  const course = validateWorldCourse(entry.course),
    result = await replayWorldFlight(course, row.proof, { yieldControl: async () => {} });
  check(
    row.proof.course + '/' + row.proof.mode + ' replay',
    result.state.status === 'complete' &&
      worldStateIdentity(result.state) === row.proof.finalStateIdentity,
  );
  demonstrations.push({
    course: course.id,
    mode: row.proof.mode,
    ticks: result.state.ticks,
    finalStateIdentity: worldStateIdentity(result.state),
  });
}
check('21 demonstrations verified', demonstrations.length === 21);
const sourceSha256 = {};
for (const name of ['renderer.mjs', 'world-visuals.mjs'])
  sourceSha256[name] = hash(
    await readFile(new URL('../optional-practice/civilian-fpv/' + name, import.meta.url)),
  );
const receipt = {
  format: 'FPVStadiumStructuresFunctionalEvidence.v1',
  date: new Date().toISOString(),
  baseline,
  sourceSha256,
  scope:
    'Manual source-bound geometry and actual bundled demonstration replay checks; not browser, package, physical-device performance or human art acceptance.',
  checks,
  immutable,
  geometry,
  demonstrations,
};
if (args[1]) await writeFile(args[1], JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    checks: checks.length,
    passed: checks.every((row) => row.pass),
    vertices,
    triangles: vertices / 3,
    demonstrations: demonstrations.length,
  }),
);
