/** Manual visual-seam verification; collision remains the canonical triangle mesh. */
import assert from 'node:assert/strict';
import { createTerrainNormals } from './terrain-normals.mjs';
const cells = [];
for (let z = -1; z <= 0; z++)
  for (let x = -1; x <= 0; x++)
    cells.push({
      x,
      z,
      cellSizeMm: 128000,
      heightsMm: Array.from({ length: 1089 }, (_, i) => {
        const gx = x * 32 + (i % 33),
          gz = z * 32 + Math.floor(i / 33);
        return gx * gx * 8 + gz * gz * 4 + gx * 100;
      }),
    });
const before = JSON.stringify(cells),
  normalFor = createTerrainNormals(cells);
const frames = cells.map((c) => normalFor(c));
const sample = (values, x, z) => Array.from(values.slice((z * 33 + x) * 3, (z * 33 + x) * 3 + 3));
for (let i = 0; i < 33; i++) {
  assert.deepEqual(sample(frames[0], 32, i), sample(frames[1], 0, i));
  assert.deepEqual(sample(frames[2], 32, i), sample(frames[3], 0, i));
  assert.deepEqual(sample(frames[0], i, 32), sample(frames[2], i, 0));
  assert.deepEqual(sample(frames[1], i, 32), sample(frames[3], i, 0));
}
console.log('PASS 132 shared-edge samples including four-cell corner use identical normals');
for (const frame of frames)
  for (let i = 0; i < frame.length; i += 3) {
    assert(Math.abs(Math.hypot(...frame.slice(i, i + 3)) - 1) < 1e-6);
    assert(frame[i + 1] > 0);
  }
console.log('PASS all 4356 normals are finite, upward and unit length');
const reordered = createTerrainNormals([...cells].reverse());
for (let i = 0; i < cells.length; i++) assert.deepEqual(reordered(cells[i]), frames[i]);
assert.equal(JSON.stringify(cells), before);
console.log('PASS ordering-independent presentation and unchanged source heights');
const flat = { x: 0, z: 0, cellSizeMm: 128000, heightsMm: Array(1089).fill(100) };
for (const value of createTerrainNormals([flat])(flat).values()) assert(Number.isFinite(value));
assert.deepEqual(sample(createTerrainNormals([flat])(flat), 0, 0), [-0, 1, -0]);
console.log('PASS isolated outer borders stay finite with one-sided differences');
