/** Original collision/terrain parity and visual contour admission; no native art claim. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { scenerySourceCell } from '../indexed-scenery-cell.mjs';
import { surfaceMm } from './design.mjs';
const [beforeRoot, afterRoot] = process.argv.slice(2);
assert(beforeRoot && afterRoot, 'Provide original and contour source folders');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const file = async (root, path) => readFile(resolve(root, path));
const manifest = async (root, layer) => JSON.parse(await file(root, layer + '/region.json'));
const oldTerrain = await manifest(beforeRoot, 'terrain'),
  terrain = await manifest(afterRoot, 'terrain');
const oldScenery = await manifest(beforeRoot, 'scenery'),
  scenery = await manifest(afterRoot, 'scenery');
assert.equal(oldTerrain.revision, 'relief-r1');
assert.equal(terrain.revision, 'relief-r2-contours');
assert.equal(scenery.revision, terrain.revision);
assert.deepEqual(terrain.assets, oldTerrain.assets);
assert.deepEqual(terrain.chunks, oldTerrain.chunks);
assert.deepEqual(terrain.spawns, oldTerrain.spawns);
assert.deepEqual(terrain.grid, oldTerrain.grid);
let exactTerrainFiles = 0,
  exactSolidSurfaces = 0,
  exactOtherVisualSurfaces = 0,
  contourVertices = 0,
  contourTriangles = 0,
  interpolatedVertices = 0,
  maxTerrainErrorMm = 0,
  maxHeightContourErrorMm = 0;
for (const asset of terrain.assets) {
  const old = await file(beforeRoot, 'terrain/' + asset.path),
    next = await file(afterRoot, 'terrain/' + asset.path);
  assert.equal(sha(old), asset.sha256);
  assert.deepEqual(next, old);
  exactTerrainFiles++;
}
const isContour = (s) =>
  [
    [0.9, 0.94, 0.96],
    [0.48, 0.51, 0.52],
  ].some((c) => c.every((v, i) => s.color[i] === v));
async function sources(root, m) {
  const rows = new Map();
  for (const asset of m.assets.filter((a) => a.kind === 'collision')) {
    const bytes = await file(root, 'scenery/' + asset.path);
    assert.equal(sha(bytes), asset.sha256);
    const input = JSON.parse(bytes),
      cell = scenerySourceCell(input);
    rows.set(cell.chunkId, { input, cell });
  }
  return rows;
}
const oldRows = await sources(beforeRoot, oldScenery),
  rows = await sources(afterRoot, scenery);
function kept(row, solid) {
  if (!row) return [];
  return row.cell.surfaces.flatMap((s) => {
    const binding = row.input.bindings.find((b) => b.surfaceId === s.id),
      isSolid = binding.collision !== 'visual-only';
    if (solid ? !isSolid : isSolid || isContour(s)) return [];
    const { id, ...surface } = s;
    const { surfaceId, ...rest } = binding;
    return [
      {
        surface,
        binding: rest,
        textures: row.input.textures.filter((t) => t.id === binding.textureId),
      },
    ];
  });
}
for (const id of new Set([...oldRows.keys(), ...rows.keys()])) {
  const old = oldRows.get(id),
    next = rows.get(id);
  const oldSolid = kept(old, true),
    newSolid = kept(next, true);
  assert.deepEqual(
    newSolid,
    oldSolid,
    'Solid source vertices/indices/material bindings exactly retained: ' + id,
  );
  exactSolidSurfaces += oldSolid.length;
  const oldOther = kept(old, false),
    newOther = kept(next, false);
  assert.deepEqual(newOther, oldOther, 'Water/road/other visual source unchanged: ' + id);
  exactOtherVisualSurfaces += oldOther.length;
  if (!next) continue;
  for (const s of next.cell.surfaces.filter(isContour)) {
    const binding = next.input.bindings.find((b) => b.surfaceId === s.id);
    assert.equal(binding.collision, 'visual-only');
    const snow = s.color[0] === 0.9;
    for (let i = 0; i < s.positionsMm.length; i += 3) {
      const x = s.positionsMm[i] / 1000 + next.cell.x * 256,
        y = s.positionsMm[i + 1],
        z = s.positionsMm[i + 2] / 1000 + next.cell.z * 256;
      const error = Math.abs(y - 3 - surfaceMm(x, z));
      maxTerrainErrorMm = Math.max(maxTerrainErrorMm, error);
      assert(error <= 0.501, 'Visual vertex remains on exact canonical plane +3mm');
      if (x % 8 !== 0 || z % 8 !== 0) interpolatedVertices++;
      const outside = snow ? Math.max(0, 480003 - y) : Math.max(0, 330003 - y, y - 480003);
      maxHeightContourErrorMm = Math.max(maxHeightContourErrorMm, outside);
      assert(outside <= 20, 'Only millimetre quantization, no whole-square threshold overshoot');
      contourVertices++;
    }
    contourTriangles += s.indices.length / 3;
  }
}
assert(interpolatedVertices > 1000, 'Height contours add real sub-grid intersections');
assert(exactTerrainFiles === 512 && exactSolidSurfaces > 0);
console.log(
  JSON.stringify(
    {
      format: 'FPVAlpineContourVerification.v1',
      beforeTerrainSHA256: sha(await file(beforeRoot, 'terrain/region.json')),
      afterTerrainSHA256: sha(await file(afterRoot, 'terrain/region.json')),
      beforeScenerySHA256: sha(await file(beforeRoot, 'scenery/region.json')),
      afterScenerySHA256: sha(await file(afterRoot, 'scenery/region.json')),
      exactTerrainFiles,
      exactSolidSurfaces,
      exactOtherVisualSurfaces,
      contourVertices,
      contourTriangles,
      interpolatedVertices,
      maxTerrainErrorMm,
      maxHeightContourErrorMm,
      nativeVisualAcceptance: false,
    },
    null,
    2,
  ),
);
