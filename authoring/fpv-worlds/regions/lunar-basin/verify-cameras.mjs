/** Camera-only verification against the immutable composition-r1 terrain, not a flight proof. */
import assert from 'node:assert/strict';
import { lunarViews } from './views.mjs';
import { sampledHeight } from './relief.mjs';
const receipts = [];
for (const [name, anchor, camera, target] of lunarViews) {
  const cx = Math.floor(anchor[0] / 128),
    cz = Math.floor(anchor[2] / 128);
  const bounds = [
    Math.max(0, cx - 1) * 128,
    Math.min(6, cx + 2) * 128,
    Math.max(0, cz - 1) * 128,
    Math.min(6, cz + 2) * 128,
  ];
  let minimumClearance = Infinity;
  for (let i = 0; i <= 400; i++) {
    const t = i / 400,
      p = camera.map((v, k) => v + (target[k] - v) * t);
    assert.ok(
      p[0] > bounds[0] && p[0] < bounds[1] && p[2] > bounds[2] && p[2] < bounds[3],
      `${name}: view outside resident terrain`,
    );
    const clearance = p[1] - sampledHeight(p[0], p[2]);
    minimumClearance = Math.min(minimumClearance, clearance);
    assert.ok(clearance >= 2, `${name}: sightline crosses terrain`);
  }
  const cameraClearance = camera[1] - sampledHeight(camera[0], camera[2]);
  assert.ok(cameraClearance >= 9.999, `${name}: camera too close to terrain`);
  assert.ok(camera.every(Number.isFinite) && target.every(Number.isFinite));
  receipts.push({
    name,
    cameraClearance,
    minimumClearance,
    samples: 401,
    residentBoundsM: bounds,
  });
}
assert.equal(receipts.length, 15);
console.log(
  JSON.stringify(
    {
      passed: true,
      cameras: receipts,
      geometryChanged: false,
      nativeAccepted: false,
    },
    null,
    2,
  ),
);
