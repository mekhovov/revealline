/** Verify exact generated source bytes and real collision corridors before visual review. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
import { routes, spawns, placements } from './design.mjs';
import { createRailwayIndexedCells } from './indexed-source.mjs';

const output = process.argv[2];
assert(output, 'Provide the generated Railway pilot directory');
const manifests = {},
  sources = {},
  before = [],
  cells = [];
let canonicalGLBs = 0;
for (const profile of ['terrain', 'scenery']) {
  const directory = resolve(output, profile),
    bodies = new Map();
  manifests[profile] = JSON.parse(await readFile(resolve(directory, 'region.json'), 'utf8'));
  for (const asset of manifests[profile].assets) {
    const bytes = await readFile(resolve(directory, asset.path));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    if (asset.kind === 'scene') {
      const report = await validator.validateBytes(bytes);
      assert.equal(report.issues.numErrors, 0, asset.path);
      assert.equal(report.issues.numWarnings, 0, asset.path);
      canonicalGLBs++;
    } else if (profile === 'scenery') cells.push(JSON.parse(bytes));
    bodies.set('/' + asset.path, bytes);
    before.push([resolve(directory, asset.path), Buffer.from(bytes)]);
  }
  sources[profile] = {
    baseURL: `https://${profile}.invalid/`,
    fetchImpl: async (url) =>
      new Response(bodies.get(new URL(url).pathname), {
        status: bodies.has(new URL(url).pathname) ? 200 : 404,
      }),
  };
}
const models = await createRailwayIndexedCells();
let exactLicensedPrimitives = 0;
for (const [id, name, x, y, z] of placements) {
  const model = models.get(name),
    source = cells.find(
      (s) => (s.cell ?? s).x === Math.floor(x / 128) && (s.cell ?? s).z === Math.floor(z / 128),
    );
  const cell = source.cell;
  assert.deepEqual(source.textures, model.textures);
  model.cell.surfaces.forEach((surface, i) => {
    const surfaceId = `${id}-part-${i}`,
      actual = cell.surfaces.find((s) => s.id === surfaceId);
    assert.deepEqual(actual.indices, surface.indices, `${id}: no removed triangles`);
    assert.deepEqual(
      actual.positionsMm,
      surface.positionsMm.map(
        (v, axis) =>
          v +
          (axis % 3 === 0
            ? x * 1000 - 64000 - cell.x * 128000
            : axis % 3 === 1
              ? y * 1000 - 4000
              : z * 1000 - 64000 - cell.z * 128000),
      ),
    );
    assert.deepEqual(
      source.bindings.find((b) => b.surfaceId === surfaceId),
      { ...model.bindings[i], surfaceId },
    );
    exactLicensedPrimitives++;
  });
}
const owner = createVerifiedMixedWindow(manifests.terrain, {
  source: sources.terrain,
  scenery: { manifest: manifests.scenery, source: sources.scenery },
});
const mm = (p) => ({
  x: Math.round(p[0] * 1000),
  y: Math.round(p[1] * 1000),
  z: Math.round(p[2] * 1000),
});
let queries = 0;
try {
  // The centre cell loads the complete bounded 3x3 representative area.
  await owner.transition(mm([192, 30, 192]));
  const full = owner.snapshot();
  assert.equal(full.provenance.chunks.length, 9);
  assert(full.geometryBytes + full.textureBytes < 6 * 1024 * 1024);
  assert.equal(full.textureBytes, 2446676, 'The palette must be shared within this window');
  for (const route of routes) {
    const a = route.from,
      b = route.to;
    const dx = b[0] - a[0],
      dz = b[2] - a[2],
      length = Math.hypot(dx, dz);
    const samples = Math.ceil(length / 2);
    for (const offset of [-route.halfWidth, 0, route.halfWidth]) {
      const point = (t) =>
        a.map(
          (v, k) =>
            v +
            (b[k] - v) * t +
            (k === 0 ? (-dz / length) * offset : k === 2 ? (dx / length) * offset : 0),
        );
      for (let n = 0; n < samples; n++) {
        const hit = owner.sweep(mm(point(n / samples)), mm(point((n + 1) / samples)), 250);
        assert.equal(
          hit.status,
          'terrain-clear',
          `${route.id} lane ${offset}, sample ${n}: ${JSON.stringify(hit)}`,
        );
        queries++;
      }
    }
  }
  for (const [id, from, to, layer] of [
    ['hall-wall', [275, 20, 70], [285, 20, 70], 'scenery'],
    ['bridge-deck', [192, 18, 160], [192, 10, 160], 'scenery'],
    ['bridge-pier', [184, 4, 176], [190, 4, 176], 'scenery'],
    ['station-roof', [166, 28, 66], [166, 22, 66], 'scenery'],
    ['freight-tank', [228, 18, 58], [240, 18, 58], 'scenery'],
    ['valley-ground', [100, 0, 180], [100, -12, 180], 'terrain'],
  ]) {
    const hit = owner.sweep(mm(from), mm(to), 250);
    assert.equal(hit.status, 'terrain-hit', id);
    assert.equal(hit.layer, layer, id);
    queries++;
  }
  // Safe starts require support and a real overlap check in the same owner as flight.
  for (const spawn of spawns) {
    const state = await owner.transition(spawn.position, {
      positionMm: spawn.position,
      radiusMm: 250,
    });
    assert(state.terrainReady, spawn.id);
    assert.equal(owner.support(spawn.position, 30000).status, 'terrain-hit', spawn.id);
    queries++;
  }
  await owner.dispose();
  assert.equal(owner.snapshot().geometryBytes, 0);
  assert.equal(owner.snapshot().textureBytes, 0);
  for (const [path, bytes] of before) assert.deepEqual(await readFile(path), bytes);
  console.log(
    JSON.stringify(
      {
        passed: true,
        canonicalGLBs,
        exactLicensedPrimitives,
        clearRoutes: routes.length,
        realCollisionQueries: queries,
        safeSpawns: spawns.length,
        fullWindowGeometryBytes: full.geometryBytes,
        textureBytes: full.textureBytes,
        resourceBytes: full.geometryBytes + full.textureBytes,
        disposed: true,
        sourceUnchanged: true,
        playerReady: false,
      },
      null,
      2,
    ),
  );
} finally {
  await owner.dispose();
}
