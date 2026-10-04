#!/usr/bin/env node
// Manual static authoring survey. It does not stand in for ordinary flight proofs.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectPack } from '../../../optional-practice/civilian-fpv/world-content.mjs';
import {
  initWorldRuntime,
  createWorldCollision,
} from '../../../optional-practice/civilian-fpv/world-collision.mjs';
import { colliderFromAnchor } from '../../../optional-practice/civilian-fpv/world-app.mjs';
import {
  Quaternion,
  Vector3,
} from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
const [packPath, receiptPath] = process.argv.slice(2);
if (!packPath || !receiptPath) throw Error('Use EXACT_PACK NEW_RECEIPT');
const bytes = await readFile(packPath),
  { project, sha256 } = await inspectPack(new Blob([bytes]));
if (project.courses.length !== 1 || project.courses[0].id !== 'harbor-docks-01')
  throw Error('Expected one-course Harbor checkpoint');
const course = project.courses[0],
  checks = [],
  axes = ['x', 'y', 'z'];
const check = (name, passed, detail) =>
  checks.push({ name, passed: !!passed, ...(detail ? { detail } : {}) });
await initWorldRuntime();
const collision = createWorldCollision(course);
try {
  check('Clear entry spawn', collision.clearSpawn(course.spawn, course.rules.droneRadius));
  check(
    'Raised quay is actual landing support',
    collision.support({ x: -2000, y: 2001, z: 34000 }, 220, 5)?.id === 'platform-quay',
  );
  check(
    'Service deck is a real named support',
    collision.support({ x: -15500, y: 5501, z: 31500 }, 220, 5)?.id === 'platform-service-deck',
  );
  check(
    'Gantry interior has actual broad open space',
    collision.clearSpawn({ x: 24000, y: 9000, z: -14000 }, 720),
  );
  check(
    'Visible east boundary blocks contact',
    !collision.clearSpawn({ x: 39500, y: 2000, z: 0 }, 220),
  );
  check(
    'Water is outside every playable X coordinate',
    course.bounds.max.x === 40000 && project.authoring.collision.includes('X43m'),
  );
  for (const box of course.obstacles) {
    const middle = axes.map((k) => (box.min[k] + box.max[k]) / 2);
    check(
      box.id + ' is a solid interior',
      !collision.clearSpawn({ x: middle[0], y: middle[1] - 220, z: middle[2] }, 220),
    );
    const anchor = project.source.colliders.find((a) => a.id === box.id);
    check(box.id + ' source marker retained', !!anchor);
    if (!anchor) continue;
    const imported = colliderFromAnchor(anchor).vertices,
      vertices = [],
      q = new Quaternion(...(box.rotation ?? [0, 0, 0, 1]));
    for (const z of [box.min.z, box.max.z])
      for (const y of [box.min.y, box.max.y])
        for (const x of [box.min.x, box.max.x])
          vertices.push(
            ...new Vector3(x - middle[0], y - middle[1], z - middle[2])
              .applyQuaternion(q)
              .toArray()
              .map((v, i) => Math.round(v + middle[i])),
          );
    check(
      box.id + ' eight authored/imported corners agree within1mm',
      imported.length === vertices.length &&
        imported.every((v, i) => Math.abs(v - vertices[i]) <= 1),
    );
  }
  for (const mode of ['self-level', 'acro']) {
    const points = [
      { ...course.spawn, y: 4500 },
      ...course.steps[mode].map((s) =>
        Object.fromEntries(axes.map((k) => [k, (s.min[k] + s.max[k]) / 2])),
      ),
    ];
    points.at(-1).y = 8000;
    for (let i = 0; i < points.length; i++) {
      const p = { ...points[i], y: points[i].y - 500 },
        radius = 720;
      check(
        mode + ' waypoint' + i + ' expanded sphere clear and within bounds',
        collision.clearSpawn(p, radius) &&
          p.x - radius >= course.bounds.min.x &&
          p.x + radius <= course.bounds.max.x &&
          p.z - radius >= course.bounds.min.z &&
          p.z + radius <= course.bounds.max.z &&
          p.y >= course.bounds.min.y &&
          p.y + 2 * radius <= course.bounds.max.y,
        { point: points[i] },
      );
      if (!i) continue;
      const from = { ...points[i - 1], y: points[i - 1].y - 500 },
        delta = Object.fromEntries(axes.map((k) => [k, p[k] - from[k]])),
        moved = collision.moveSphere(from, delta, radius);
      check(
        mode + ' swept leg' + i + ' retains extra0.5m clearance',
        !moved.contacts.length && axes.every((k) => Math.abs(moved.position[k] - p[k]) <= 3),
        { from, to: p, contacts: moved.contacts },
      );
    }
  }
} finally {
  collision.dispose();
}
const receipt = {
  format: 'FPVHarborSceneQualification.v1',
  status: checks.every((c) => c.passed) ? 'passed' : 'failed',
  scope: 'Static authoring/collision checks only; visual review and ordinary-flight proofs pending',
  pack: {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    identity: 'fpv-pack:' + sha256,
  },
  checks,
};
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify(
    {
      status: receipt.status,
      checks: checks.length,
      failed: checks.filter((c) => !c.passed),
      receiptPath,
    },
    null,
    2,
  ),
);
if (receipt.status !== 'passed') process.exitCode = 1;
