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
if (project.courses.length !== 1 || project.courses[0].id !== 'festival-grounds-01')
  throw Error('Expected one-course Festival checkpoint');
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
    'Lawn floor is the actual landing support',
    collision.support({ x: 0, y: 1, z: 25000 }, 220, 5)?.id === '$floor',
  );
  check(
    'Sound desk has a real landing support',
    collision.support({ x: -2000, y: 1651, z: -22500 }, 220, 5)?.id === 'platform-sound-desk',
  );
  check(
    'Entry arch is physically open below its beam',
    collision.clearSpawn({ x: 0, y: 3000, z: 30000 }, 720),
  );
  check(
    'Stage front is physically open below its supported roof',
    collision.clearSpawn({ x: 0, y: 3000, z: -20000 }, 720),
  );
  if (course.revision === 'r3') {
    check(
      'Picnic table has a real top support',
      collision.support({ x: -35700, y: 911, z: 16000 }, 220, 5)?.id === 'picnic-west-top',
    );
    check(
      'The middle below the table is physically open',
      collision.clearSpawn({ x: -35700, y: 120, z: 16000 }, 220),
    );
    check(
      'The table legs block real contact',
      !collision.clearSpawn({ x: -35700, y: 120, z: 14430 }, 220),
    );
    const from = { x: -32000, y: 400, z: 10000 },
      to = { x: -32000, y: 400, z: 23000 };
    const moved = collision.moveSphere(from, { x: 0, y: 0, z: to.z - from.z }, 720);
    check(
      'West six-metre lane center retains extra0.5m swept clearance',
      !moved.contacts.length && axes.every((k) => Math.abs(moved.position[k] - to[k]) <= 3),
      { from, to, contacts: moved.contacts },
    );
    check(
      'Table stops50mm short of the painted lane boundary',
      course.obstacles.find((b) => b.id === 'picnic-west-top').max.x === -35050,
    );
  }
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
      { ...course.spawn, y: 2500 },
      ...course.steps[mode].map((s) =>
        Object.fromEntries(axes.map((k) => [k, (s.min[k] + s.max[k]) / 2])),
      ),
    ];
    points.at(-1).y = 5500;
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
  format: 'FPVFestivalSceneQualification.v1',
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
