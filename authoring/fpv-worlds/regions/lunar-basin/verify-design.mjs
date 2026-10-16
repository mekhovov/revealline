import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const plan = JSON.parse(await readFile(new URL('./design.json', import.meta.url)));
assert.equal(plan.status, 'design-only-no-generated-world');
assert.equal(plan.districts.length, 6);
assert.equal(plan.grid.width * plan.grid.cellSizeMm, 768000);
assert.equal(plan.grid.depth * plan.grid.cellSizeMm, 768000);
assert.equal(plan.grid.cellSizeMm / (plan.grid.samples - 1), 4000);
assert.equal(plan.budget.retainedAndStagedHardBytes, 8388608);
assert.equal(plan.budget.deliveryHardBytes, 67108864);
assert(plan.budget.eachWindowTargetBytes * 2 <= plan.budget.retainedAndStagedHardBytes);
const ids = new Set();
const claim = id => { assert(!ids.has(id), `Duplicate design ID: ${id}`); ids.add(id); };
const inside = ([x, z], [minX, minZ, maxX, maxZ], inset = 0) =>
  x >= minX + inset && x <= maxX - inset && z >= minZ + inset && z <= maxZ - inset;
const counts = {};
let landmarks = 0;
let routes = 0;
const startDistances = [];
for (const d of plan.districts) {
  claim(d.id);
  assert(inside(d.startXZMm, d.boundsXZMm, 12000), `${d.id} start outside reserved inset`);
  assert.equal(d.landmarks.length, 2);
  assert.equal(d.routes.length, 2);
  for (const l of d.landmarks) {
    claim(l.id);
    landmarks++;
    assert(inside(l.centerXZMm, d.boundsXZMm));
    const [x, z] = l.centerXZMm;
    const [w, h] = l.footprintMm;
    assert(inside([x - w / 2, z - h / 2], d.boundsXZMm));
    assert(inside([x + w / 2, z + h / 2], d.boundsXZMm));
  }
  const near = Math.min(...d.landmarks.map(l => Math.hypot(...l.centerXZMm.map((v, i) => v - d.startXZMm[i]))));
  assert(near <= 150000, `${d.id} nearest feature exceeds approach target`);
  startDistances.push({ id: d.id, nearestLandmarkDistanceMm: Math.round(near) });
  for (const r of d.routes) {
    claim(r.id);
    routes++;
    counts[r.difficulty] = (counts[r.difficulty] || 0) + 1;
    assert(r.waypointsXZMm.length >= 4);
    assert(r.waypointsXZMm.every(p => inside(p, d.boundsXZMm)));
    assert(r.landmarkIds.every(id => d.landmarks.some(l => l.id === id)));
    assert(r.minimumClearDiameterMm >= 8000);
    assert.equal(r.verification, 'planned-not-flight-verified');
  }
}
assert.equal(landmarks, 12);
assert.equal(routes, 12);
const reached = new Set([plan.districts[0].id]);
for (let pass = 0; pass < plan.districts.length; pass++) {
  for (const link of plan.connections) {
    assert(plan.districts.some(d => d.id === link.fromDistrict));
    assert(plan.districts.some(d => d.id === link.toDistrict));
    assert(link.minimumClearDiameterMm >= 24000);
    if (reached.has(link.fromDistrict) || reached.has(link.toDistrict)) {
      reached.add(link.fromDistrict);
      reached.add(link.toDistrict);
    }
  }
}
assert.equal(reached.size, 6);
const receipt = {
  status: 'design-arithmetic-and-references-only',
  districts: 6, landmarks, routePolylines: routes, difficultyCounts: counts,
  connectedDesignDistricts: reached.size, terrainCells: 36, terrainSamples: 39204,
  startDistances,
  notVerified: ['Geometry', 'Terrain-resolved route Y', 'Collision clearance', 'Resource use', 'Flight', 'Native appearance', 'Delivery', 'Library admission'],
};
await writeFile(new URL('./design-verification.json', import.meta.url), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
