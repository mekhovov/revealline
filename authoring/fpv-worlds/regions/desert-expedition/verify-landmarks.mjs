/** Exact scene/collision parity, retained terrain and real mixed-window route clearance. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import { compileSceneryCell } from '../scenery-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
import { CELL_M, SAMPLE_M, heightMm, surfaceMm } from './desert-design.mjs';

const [parent, root] = process.argv.slice(2);
assert(parent && root, 'Provide retained natural-r1 and generated landmark source');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const receipt = JSON.parse(await readFile(resolve(root, 'preparation.json')));
const old = JSON.parse(await readFile(resolve(parent, 'preparation.json')));
const manifests = {},
  sources = {},
  bodies = new Map(),
  cells = new Map();
let canonicalScenery = 0,
  retainedTerrainAssets = 0;
for (const profile of ['terrain', 'scenery']) {
  const body = await readFile(resolve(root, profile, 'region.json'));
  assert.equal(sha(body), receipt[`${profile}ManifestSHA256`]);
  const manifest = validateRegionManifest(body.toString());
  manifests[profile] = manifest;
  assert.equal(manifest.revision, 'landmarks-r1');
  assert.equal(manifest.grid.cellSizeMm, 512000);
  assert.deepEqual(
    manifest.spawns,
    JSON.parse(await readFile(resolve(parent, 'terrain/region.json'))).spawns,
  );
  for (const asset of manifest.assets) {
    const bytes = await readFile(resolve(root, profile, asset.path));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(sha(bytes), asset.sha256);
    bodies.set(`/${profile}/${asset.path}`, bytes);
    if (profile === 'terrain') {
      assert.deepEqual(bytes, await readFile(resolve(parent, profile, asset.path)));
      retainedTerrainAssets++;
    } else if (asset.kind === 'collision')
      cells.set(asset.id.replace(/-collision$/, ''), JSON.parse(bytes));
  }
  sources[profile] = {
    baseURL: `https://desert.invalid/${profile}/`,
    fetchImpl: async (url) => {
      const data = bodies.get(new URL(url).pathname);
      assert(data, `Unexpected asset request ${url}`);
      return new Response(data);
    },
  };
}
assert.equal(retainedTerrainAssets, 2048);
assert.deepEqual(manifests.terrain.grid, manifests.scenery.grid);
for (const cell of cells.values()) {
  const canonical = compileSceneryCell(cell);
  assert.deepEqual(Buffer.from(canonical.glb), bodies.get(`/scenery/${cell.chunkId}.glb`));
  const report = await validator.validateBytes(new Uint8Array(canonical.glb));
  assert.equal(report.issues.numErrors, 0);
  assert.equal(report.issues.numWarnings, 0);
  canonicalScenery++;
}
assert.equal(canonicalScenery, receipt.populatedSceneryCells);
const owner = createVerifiedMixedWindow(manifests.terrain, {
  source: sources.terrain,
  scenery: { manifest: manifests.scenery, source: sources.scenery },
});
const mm = ([x, y, z]) => ({
  x: Math.round(x * 1000),
  y: Math.round(y * 1000),
  z: Math.round(z * 1000),
});
let windowKey,
  transitions = 0,
  peakGeometryBytes = 0,
  routeSweeps = 0,
  grounded = 0,
  starts = 0;
const contacts = [];
async function prepare(point) {
  const key = `${Math.floor(point.x / 512000)},${Math.floor(point.z / 512000)}`;
  if (key === windowKey) return;
  await owner.transition(point);
  windowKey = key;
  transitions++;
  const state = owner.snapshot();
  assert(state.provenance.chunks.length <= 9);
  peakGeometryBytes = Math.max(peakGeometryBytes, state.geometryBytes);
  assert(state.geometryBytes < 8 * 1024 * 1024);
}
try {
  // Recheck original broad route corridors as well as the six new close-range compositions.
  for (const route of [...receipt.routes, ...old.routes]) {
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1],
        b = route.points[i],
        length = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const normal = [-(b[2] - a[2]) / length, (b[0] - a[0]) / length];
      const stride = receipt.routes.includes(route) ? 1 : 16;
      for (const side of [-1, 0, 1])
        for (let distance = 0; distance < length; distance += stride) {
          const point = (d) =>
            mm([
              a[0] + ((b[0] - a[0]) * d) / length + normal[0] * route.halfWidthM * side,
              a[1] + ((b[1] - a[1]) * d) / length,
              a[2] + ((b[2] - a[2]) * d) / length + normal[1] * route.halfWidthM * side,
            ]);
          const from = point(distance),
            to = point(Math.min(length, distance + stride));
          await prepare(from);
          const result = owner.sweep(from, to, 250);
          assert.equal(
            result.status,
            'terrain-clear',
            `${route.id}: ${JSON.stringify({ from, to, result })}`,
          );
          routeSweeps++;
        }
    }
  }
  for (const object of receipt.objects) {
    const cell = cells.get(object.chunkId),
      surface = cell.surfaces.find((value) => value.id === object.id);
    assert(surface);
    const points = [];
    for (let i = 0; i < surface.indices.length; i += 3) {
      const p = [0, 0, 0];
      for (const index of surface.indices.slice(i, i + 3))
        for (let axis = 0; axis < 3; axis++) p[axis] += surface.positionsMm[index * 3 + axis] / 3;
      p[0] += cell.x * CELL_M * 1000;
      p[2] += cell.z * CELL_M * 1000;
      if (p[1] > surfaceMm(p[0] / 1000, p[2] / 1000) + 1000) points.push(p);
    }
    points.sort((a, b) => b[1] - a[1]);
    assert(points.length, `${object.id}: no exposed above-ground surface`);
    const p = points[0],
      from = { x: Math.round(p[0]), y: object.topMm + 3000, z: Math.round(p[2]) };
    await prepare(from);
    const hit = owner.support(from, object.requestedHeightM * 1000 + 5000);
    assert.equal(hit.status, 'terrain-hit', object.id);
    assert.equal(hit.layer, 'scenery', object.id);
    assert(hit.heightMm >= p[1] - 30, object.id);
    contacts.push({
      id: object.id,
      x: from.x / 1000,
      z: from.z / 1000,
      surfaceHeightMm: hit.heightMm,
    });
    // Verify the enclosing linear samples, not merely the formation's centre.
    for (
      let x = Math.floor(object.boundsMm[0][0] / 1000 / SAMPLE_M) * SAMPLE_M;
      x <= Math.ceil(object.boundsMm[0][1] / 1000 / SAMPLE_M) * SAMPLE_M;
      x += SAMPLE_M
    )
      for (
        let z = Math.floor(object.boundsMm[1][0] / 1000 / SAMPLE_M) * SAMPLE_M;
        z <= Math.ceil(object.boundsMm[1][1] / 1000 / SAMPLE_M) * SAMPLE_M;
        z += SAMPLE_M
      )
        assert(object.baseMm < heightMm(x, z), `${object.id}: floating base`);
    grounded++;
  }
  for (const spawn of manifests.terrain.spawns) {
    await prepare(spawn.position);
    assert.equal(
      owner.sweep(spawn.position, { ...spawn.position, y: spawn.position.y + 5000 }, 250).status,
      'terrain-clear',
    );
    starts++;
  }
} finally {
  await owner.dispose();
}
assert.equal(owner.snapshot().geometryBytes, 0);
console.log(
  JSON.stringify(
    {
      passed: true,
      retainedTerrainAssets,
      canonicalScenery,
      populatedSceneryCells: cells.size,
      transitions,
      routeSweeps,
      grounded,
      starts,
      peakGeometryBytes,
      solidContacts: contacts,
      sourceUnchanged: true,
      disposed: true,
      nativeVisualAccepted: false,
      playerReady: false,
    },
    null,
    2,
  ),
);
