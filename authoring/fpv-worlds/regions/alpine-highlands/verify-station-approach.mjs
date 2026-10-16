/** Additive solid source, original-content parity, grounded members and actual route sweeps. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import { validateRegionManifest } from '../region-manifest.mjs';
import { validateScenerySource, compileScenerySource } from '../indexed-scenery-cell.mjs';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
import { createRegionalSession } from '../../../../optional-practice/civilian-fpv/regional-session.mjs';
import { routes, surfaceMm } from './design.mjs';
import {
  stationApproachCell,
  stationApproachPieces,
  approachPieceGeometry,
} from './station-approach.mjs';

const [base, output] = process.argv.slice(2).map((path) => resolve(path));
assert(base && output);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const receipt = JSON.parse(await readFile(resolve(output, 'station-approach.json')));
const prefix = 'station-approach-';
async function load(root) {
  const manifests = {},
    sources = {};
  for (const layer of ['terrain', 'scenery']) {
    const bytes = await readFile(resolve(root, layer, 'region.json'));
    const manifest = (manifests[layer] = validateRegionManifest(bytes.toString()));
    const files = new Map();
    for (const asset of manifest.assets) {
      const body = await readFile(resolve(root, layer, asset.path));
      assert.equal(body.length, asset.bytes);
      assert.equal(sha(body), asset.sha256);
      files.set('/' + asset.path, body);
    }
    sources[layer] = {
      baseURL: `https://${layer}.invalid/`,
      files,
      fetchImpl: async (url) => {
        const bytes = files.get(new URL(url).pathname);
        return new Response(bytes, { status: bytes ? 200 : 404 });
      },
    };
  }
  return { manifests, sources };
}
const before = await load(base),
  after = await load(output);
assert.deepEqual(after.manifests.terrain.assets, before.manifests.terrain.assets);
for (const layer of ['terrain', 'scenery']) {
  for (const key of ['grid', 'spawns', 'chunks'])
    assert.deepEqual(
      after.manifests[layer][key],
      before.manifests[layer][key],
      `${key} stays exact`,
    );
}
const pieces = stationApproachPieces();
assert.equal(pieces.length, 58);
assert.equal(new Set(pieces.map((piece) => piece.id)).size, pieces.length);
assert.equal(receipt.addedCollisionTriangles, 696);
assert.equal(receipt.addedTexturePixels, 0);
assert(receipt.maxRetainedCandidateResourceBytes <= 8 * 1024 * 1024);
assert(receipt.sourceBytes <= 64 * 1024 * 1024);

// Independent physical attachment checks: foundations envelop all sampled ground corners;
// beam endpoints share the declared crown/foot or existing upper support planes.
let footings = 0;
for (const piece of pieces) {
  const geometry = approachPieceGeometry(piece);
  try {
    geometry.computeBoundingBox();
    assert(geometry.boundingBox.min.z >= 3152 && geometry.boundingBox.max.z <= 3204);
    assert(geometry.boundingBox.min.x >= 3173 && geometry.boundingBox.max.x <= 3514);
    if (piece.id.startsWith('lookout-knee'))
      assert(
        geometry.boundingBox.max.y > 599.05,
        'Knee braces embed into the original deck underside at 599 m',
      );
    if (!piece.id.includes('shoe')) continue;
    footings++;
    const [x, y, z] = piece.center,
      [width, height, depth] = piece.size;
    for (const dx of [-width / 2, 0, width / 2])
      for (const dz of [-depth / 2, 0, depth / 2]) {
        const floor = surfaceMm(x + dx, z + dz) / 1000;
        assert(y - height / 2 < floor, `${piece.id} cannot float`);
        assert(y + height / 2 > floor, `${piece.id} reaches the surface`);
      }
  } finally {
    geometry.dispose();
  }
}
assert.equal(footings, 10);
let oldCells = 0,
  changedCells = 0,
  newTriangles = 0;
for (const asset of after.manifests.scenery.assets.filter((asset) => asset.kind === 'collision')) {
  const original = validateScenerySource(
    JSON.parse(before.sources.scenery.files.get('/' + asset.path)),
  );
  const detailed = validateScenerySource(
    JSON.parse(after.sources.scenery.files.get('/' + asset.path)),
  );
  const prior = {
    ...detailed,
    cell: {
      ...detailed.cell,
      surfaces: detailed.cell.surfaces.filter((surface) => !surface.id.startsWith(prefix)),
    },
    bindings: detailed.bindings.filter((binding) => !binding.surfaceId.startsWith(prefix)),
  };
  assert.deepEqual(
    prior,
    original,
    'Removing only added members recovers every old source property exactly',
  );
  assert.deepEqual(
    stationApproachCell(original).source,
    detailed,
    'Deterministic repeat preparation',
  );
  assert.deepEqual(stationApproachCell(detailed).source, detailed, 'Prepared source is idempotent');
  oldCells++;
  const added = detailed.cell.surfaces.filter((surface) => surface.id.startsWith(prefix));
  if (!added.length) continue;
  changedCells++;
  for (const surface of added) {
    const binding = detailed.bindings.find((binding) => binding.surfaceId === surface.id);
    assert.equal(binding.collision, 'solid');
    assert.equal(binding.alphaMode, 'OPAQUE');
    assert.equal(binding.textureId, 'original-white');
    newTriangles += surface.indices.length / 3;
  }
  const glb = compileScenerySource(detailed).glb;
  assert.deepEqual(
    Buffer.from(glb),
    after.sources.scenery.files.get(`/${detailed.cell.chunkId}.glb`),
  );
  const validated = await validator.validateBytes(glb);
  assert.equal(validated.issues.numErrors, 0);
  assert.equal(validated.issues.numWarnings, 0);
}
assert.equal(oldCells, 104);
assert.equal(changedCells, 2);
assert.equal(newTriangles, 696);
const mm = ([x, y, z]) => ({
  x: Math.round(x * 1000),
  y: Math.round(y * 1000),
  z: Math.round(z * 1000),
});
function ownerFor(data, quality) {
  return createVerifiedMixedWindow(data.manifests.terrain, {
    source: { ...data.sources.terrain, surfaceQuality: quality },
    scenery: {
      manifest: data.manifests.scenery,
      source: { ...data.sources.scenery, surfaceStyle: 'alpine-overlays', surfaceQuality: quality },
    },
  });
}
const localRoutes = routes.filter(
  (route) =>
    route.from[0] > 3090 && route.to[0] > 3090 && route.from[2] > 2920 && route.to[2] > 2920,
);
assert(localRoutes.length >= 4);
const probeIds = [
  'pylon-0-raker-0',
  'pylon-1-raker-0',
  'pylon-2-raker-0',
  'lookout-knee-x-3480-3170',
];
const newProbes = probeIds.map((id) => {
  const piece = pieces.find((piece) => piece.id === id);
  const center = piece.from.map((value, axis) => (value + piece.to[axis]) / 2);
  const dx = piece.to[0] - piece.from[0],
    dy = piece.to[1] - piece.from[1],
    length = Math.hypot(dx, dy);
  const normal = [(dy / length) * 1.5, (-dx / length) * 1.5, 0];
  return {
    id,
    center,
    from: center.map((value, axis) => value - normal[axis]),
    to: center.map((value, axis) => value + normal[axis]),
  };
});
const tiers = [];
for (const quality of ['performance', 'balanced', 'quality']) {
  const oldOwner = ownerFor(before, quality),
    owner = ownerFor(after, quality);
  try {
    for (const probe of newProbes) {
      await oldOwner.transition(mm(probe.center));
      await owner.transition(mm(probe.center));
      assert.equal(
        oldOwner.sweep(mm(probe.from), mm(probe.to), 250).status,
        'terrain-clear',
        `${probe.id} was originally open`,
      );
      assert.equal(
        owner.sweep(mm(probe.from), mm(probe.to), 250).status,
        'terrain-hit',
        `${probe.id} has actual new collision`,
      );
    }
    for (const route of localRoutes) {
      await owner.transition(mm(route.from.map((value, axis) => (value + route.to[axis]) / 2)));
      for (const offset of [-route.halfWidth, 0, route.halfWidth])
        assert.equal(
          owner.sweep(
            mm([route.from[0], route.from[1], route.from[2] + offset]),
            mm([route.to[0], route.to[1], route.to[2] + offset]),
            250,
          ).status,
          'terrain-clear',
          route.id,
        );
    }
    for (let repeat = 0; repeat < 6; repeat++) {
      await owner.transition(mm([repeat % 2 ? 3260 : 3400, 580, 3100]));
      for (const [from, to] of [
        [
          [3296, 564, 3100],
          [3504, 564, 3100],
        ],
        [
          [3504, 564, 3100],
          [3296, 564, 3100],
        ],
        [
          [3495, 580, 3158],
          [3495, 580, 3210],
        ],
        [
          [3520, 602, 3185],
          [3500, 602, 3185],
        ],
      ])
        assert.equal(
          owner.sweep(mm(from), mm(to), 250).status,
          'terrain-clear',
          'Concourse, low lookout bay and deck entrance stay open',
        );
    }
    await owner.transition(mm([3400, 564, 3100]));
    for (const z of [3068, 3132])
      assert.equal(
        owner.sweep(mm([3400, 564, 3100]), mm([3400, 564, z]), 250).status,
        'terrain-hit',
        'Existing station walls remain solid',
      );
    const state = owner.snapshot();
    tiers.push({
      quality,
      geometryBytes: state.geometryBytes,
      textureBytes: state.textureBytes,
      resourceBytes: state.resourceBytes,
      localRouteSweeps: localRoutes.length * 3,
      newSolidProbes: newProbes.length,
    });
  } finally {
    await oldOwner.dispose();
    await owner.dispose();
    for (const active of [oldOwner, owner]) {
      assert.equal(active.snapshot().resourceBytes, 0);
      assert.equal(active.snapshot().reservedGeometryBytes, 0);
    }
  }
}
assert.deepEqual(
  tiers.map(({ geometryBytes, textureBytes }) => [geometryBytes, textureBytes]),
  Array(3).fill([tiers[0].geometryBytes, tiers[0].textureBytes]),
);
for (const mode of ['acro', 'self-level']) {
  const session = createRegionalSession({
    manifest: after.manifests.terrain,
    source: after.sources.terrain,
    scenery: { manifest: after.manifests.scenery, source: after.sources.scenery },
    geometryProfile: 'terrain-scenery-v1',
    spawnId: 'summit-station',
    initialHeading: 9000,
    mode,
  });
  try {
    await session.prepare();
    assert.equal(session.snapshot().status, 'paused');
    assert.equal(session.snapshot().position.y, 564000);
  } finally {
    await session.dispose();
    assert.equal(session.snapshot().terrain.geometryBytes, 0);
  }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      originalCellsAndPropertiesExact: oldCells,
      changedCells,
      addedSolidPieces: pieces.length,
      addedSolidTriangles: newTriangles,
      newCollisionProbesPerTier: newProbes.length,
      terrainAssetBytesUnchanged: true,
      existingTextureBytesUnchanged: true,
      groundedFoundations: footings,
      tiers,
      repeatedTransitionsPerTier: 6,
      openPassagesPerTransition: 4,
      disarmedModes: 2,
      disposalZero: true,
      nativeAccepted: false,
      playerReady: false,
      receipt,
    },
    null,
    2,
  ),
);
