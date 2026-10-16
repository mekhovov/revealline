/** Exact assets, palette, reachable corridors and production collider/resource ownership. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
import { loadBuildingModels } from './indexed-source.mjs';
const variant = process.argv[3];
assert(!variant || variant === 'courtyard-r3', 'Unknown Hillside verification variant');
const { routes, probes, spawns, placements, roads, heightMm, roadTopMm } = await import(
  variant ? './courtyard-r3/design.mjs' : './design.mjs'
);
const root = process.argv[2];
assert(root, 'Provide exact hillside source');
const prep = JSON.parse(await readFile(resolve(root, 'preparation.json'))),
  manifests = {},
  sources = {},
  cells = [],
  before = [];
let canonicalGLBs = 0;
for (const layer of ['terrain', 'scenery']) {
  const directory = resolve(root, layer),
    manifestBytes = await readFile(resolve(directory, 'region.json'));
  assert.equal(
    createHash('sha256').update(manifestBytes).digest('hex'),
    prep[layer + 'ManifestSHA256'],
  );
  manifests[layer] = JSON.parse(manifestBytes);
  const bodies = new Map();
  for (const asset of manifests[layer].assets) {
    const file = resolve(directory, asset.path),
      bytes = await readFile(file);
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    before.push([file, bytes]);
    bodies.set('/' + asset.path, bytes);
    if (asset.kind === 'scene') {
      const result = await validator.validateBytes(bytes);
      assert.equal(result.issues.numErrors, 0, asset.path);
      assert.equal(result.issues.numWarnings, 0, asset.path);
      canonicalGLBs++;
    } else if (layer === 'scenery') cells.push(JSON.parse(bytes));
  }
  sources[layer] = {
    baseURL: `https://${layer}.invalid/`,
    fetchImpl: async (url) =>
      new Response(bodies.get(new URL(url).pathname), {
        status: bodies.has(new URL(url).pathname) ? 200 : 404,
      }),
  };
}
const { models, texture } = await loadBuildingModels();
for (const p of placements) {
  const source = cells.find(
      (s) => s.cell.x === Math.floor(p.x / 128) && s.cell.z === Math.floor(p.z / 128),
    ),
    model = models.get(p.asset),
    actual = source.cell.surfaces.find((s) => s.id === p.id),
    binding = source.bindings.find((b) => b.surfaceId === p.id);
  assert.deepEqual(source.textures, [texture]);
  assert.deepEqual(binding.uvs, model.uvs);
  assert.deepEqual(actual.indices, model.indices);
  assert.deepEqual(actual.color, [1, 1, 1]);
  const c = Math.cos(p.yaw),
    s = Math.sin(p.yaw),
    positions = [],
    normals = [];
  for (let i = 0; i < model.positions.length; i += 3) {
    const x = model.positions[i] * p.scale,
      z = model.positions[i + 2] * p.scale;
    positions.push(
      Math.round((p.x - source.cell.x * 128 + c * x + s * z) * 1000),
      Math.round((p.y + model.positions[i + 1] * p.scale) * 1000),
      Math.round((p.z - source.cell.z * 128 - s * x + c * z) * 1000),
    );
    normals.push(
      c * model.normals[i] + s * model.normals[i + 2],
      model.normals[i + 1],
      -s * model.normals[i] + c * model.normals[i + 2],
    );
  }
  assert.deepEqual(
    actual.positionsMm,
    positions.map((v) => v || 0),
  );
  assert.deepEqual(
    binding.normals,
    normals.map((v) => v || 0),
  );
}
let roadVertices = 0;
for (const source of cells)
  for (const surface of source.cell.surfaces) {
    if (!roads.some((road) => road.id === surface.id)) continue;
    for (let i = 0; i < surface.positionsMm.length; i += 3) {
      const x = (surface.positionsMm[i] + source.cell.x * 128000) / 1000,
        z = (surface.positionsMm[i + 2] + source.cell.z * 128000) / 1000,
        offset = surface.positionsMm[i + 1] - heightMm(x, z);
      assert([roadTopMm, -20].includes(offset), `Conforming road vertex ${surface.id}/${i}`);
      roadVertices++;
    }
  }
assert(roadVertices > 0, 'Terrain-conforming roads are required');
const mm = (p) => ({
    x: Math.round(p[0] * 1000),
    y: Math.round(p[1] * 1000),
    z: Math.round(p[2] * 1000),
  }),
  results = [],
  windows = [];
let queries = 0;
const roadContinuity = [];
for (const quality of ['performance', 'balanced', 'quality']) {
  const owner = createVerifiedMixedWindow(manifests.terrain, {
    source: { ...sources.terrain, surfaceQuality: quality },
    scenery: {
      manifest: manifests.scenery,
      source: { ...sources.scenery, surfaceQuality: quality },
    },
  });
  try {
    await owner.transition(mm([192, 60, 192]));
    assert.equal(owner.snapshot().textureBytes, 2446676);
    for (const route of routes)
      for (let segment = 1; segment < route.points.length; segment++) {
        const a = route.points[segment - 1],
          b = route.points[segment],
          dx = b[0] - a[0],
          dz = b[2] - a[2],
          length = Math.hypot(dx, dz),
          n = Math.max(1, Math.ceil(length / 2));
        for (const offset of [-route.halfWidth, 0, route.halfWidth]) {
          const point = (t) =>
            a.map(
              (v, k) =>
                v +
                (b[k] - v) * t +
                (k === 0 ? (-dz / length) * offset : k === 2 ? (dx / length) * offset : 0),
            );
          for (let i = 0; i < n; i++) {
            const hit = owner.sweep(mm(point(i / n)), mm(point((i + 1) / n)), 250);
            assert.equal(
              hit.status,
              'terrain-clear',
              `${quality}/${route.id}/${segment}/${offset}/${i}: ${JSON.stringify(hit)}`,
            );
            queries++;
          }
        }
      }
    // Low passes and exact support across both ramp breaks, including cell seams.
    // The original horizontal slabs fail these checks by up to 1.5 m.
    let supportQueries = 0,
      lowPassQueries = 0,
      maxSupportErrorMm = 0;
    const lanes = [128, 256].flatMap((x) => [-4, 0, 4].map((dx) => x + dx));
    for (const x of [...lanes, 192])
      for (const [start, end] of x === 192
        ? [
            [108, 114],
            [236, 242],
          ]
        : [
            [108, 148],
            [236, 276],
          ]) {
        for (let z = start; z <= end; z += 0.5) {
          const target = heightMm(x, z) + roadTopMm;
          const support = owner.support({ x: x * 1000, y: target + 1000, z: z * 1000 }, 2000);
          assert.equal(support.status, 'terrain-hit', `road support ${x},${z}`);
          assert.equal(support.layer, 'scenery', `road top ${x},${z}`);
          const error = Math.abs(support.heightMm - target);
          assert(
            error <= 2,
            `${quality} road must follow terrain at ${x},${z}: ${JSON.stringify(support)}`,
          );
          maxSupportErrorMm = Math.max(maxSupportErrorMm, error);
          supportQueries++;
          if (z < end) {
            const hit = owner.sweep(
              mm([x, target / 1000 + 0.5, z]),
              mm([x, (heightMm(x, z + 0.5) + roadTopMm) / 1000 + 0.5, z + 0.5]),
              250,
            );
            assert.equal(
              hit.status,
              'terrain-clear',
              `${quality} road low pass ${x},${z}: ${JSON.stringify(hit)}`,
            );
            lowPassQueries++;
          }
        }
      }
    roadContinuity.push({
      quality,
      supportQueries,
      lowPassQueries,
      maxSupportErrorMm,
      clearanceAboveRoadM: 0.5,
      sweptRadiusM: 0.25,
    });
    queries += supportQueries + lowPassQueries;
    for (const p of probes) {
      const hit = owner.sweep(mm(p.from), mm(p.to), 250);
      assert.equal(hit.status, p.clear ? 'terrain-clear' : 'terrain-hit', p.id);
      if (!p.clear) assert.equal(hit.layer, 'scenery');
      results.push({ quality, id: p.id, status: hit.status });
      queries++;
    }
    for (const spawn of spawns) {
      await owner.transition(spawn.position, { positionMm: spawn.position, radiusMm: 250 });
      assert.equal(owner.snapshot().state, 'ready');
      assert.equal(owner.support(spawn.position, 30000).status, 'terrain-hit', spawn.id);
      queries++;
    }
    for (const [x, z] of [
      [64, 64],
      [192, 64],
      [320, 64],
      [320, 192],
      [320, 320],
      [192, 320],
      [64, 320],
      [64, 192],
      [192, 192],
    ]) {
      await owner.transition(mm([x, 60, z]));
      const s = owner.snapshot();
      assert.equal(s.state, 'ready');
      assert(s.resourceBytes * 2 <= 8 * 1024 * 1024);
      windows.push({
        quality,
        x,
        z,
        geometryBytes: s.geometryBytes,
        textureBytes: s.textureBytes,
        resourceBytes: s.resourceBytes,
        collision: owner.collisionSnapshot(),
      });
    }
  } finally {
    await owner.dispose();
    for (const key of [
      'geometryBytes',
      'textureBytes',
      'resourceBytes',
      'sourceBytes',
      'reservedGeometryBytes',
      'reservedSourceBytes',
    ])
      assert.equal(owner.snapshot()[key], 0);
    assert(
      Object.values(owner.collisionSnapshot())
        .filter(Number.isFinite)
        .every((n) => n === 0),
    );
    assert.equal(owner.group, null);
  }
}
for (const [file, bytes] of before) assert.deepEqual(await readFile(file), bytes);
console.log(
  JSON.stringify(
    {
      passed: true,
      sourcePins: { terrain: prep.terrainManifestSHA256, scenery: prep.sceneryManifestSHA256 },
      canonicalGLBs,
      exactLicensedPlacements: placements.length,
      palettePixels: 'Exact512×512 indexed pixels retained',
      doubleSided: 'Original triangles and explicitly reversed back faces retained',
      queries,
      roadVertices,
      roadContinuity,
      results,
      windows,
      disposed: true,
      playerReady: false,
      claim:
        'Source/collision/owner checks only; native appearance, package and default admission remain pending.',
    },
    null,
    2,
  ),
);
