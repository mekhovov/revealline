/** Exact geometry/UV audit, canonical GLBs and three-tier production resource lifetime. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import { createVerifiedMixedWindow } from '../../verified-mixed-window.mjs';
import { compileScenerySource, scenerySourceResources } from '../../indexed-scenery-cell.mjs';
const [baseline, root] = process.argv.slice(2);
assert(baseline && root);
const hash = (b) => createHash('sha256').update(b).digest('hex');
const prep = JSON.parse(await readFile(resolve(root, 'preparation.json'))),
  manifests = {},
  sources = {},
  cells = [];
let canonicalGLBs = 0,
  collisionSurfaces = 0,
  protectedTexels = 0,
  changedBindings = 0;
for (const layer of ['terrain', 'scenery']) {
  const bytes = await readFile(resolve(root, layer, 'region.json'));
  assert.equal(hash(bytes), prep[layer + 'ManifestSHA256']);
  const manifest = JSON.parse(bytes);
  manifests[layer] = manifest;
  const bodies = new Map();
  for (const asset of manifest.assets) {
    const body = await readFile(resolve(root, layer, asset.path));
    assert.equal(body.length, asset.bytes);
    assert.equal(hash(body), asset.sha256);
    bodies.set('/' + asset.path, body);
    if (asset.kind === 'scene') {
      const result = await validator.validateBytes(body);
      assert.equal(result.issues.numErrors, 0, asset.path);
      assert.equal(result.issues.numWarnings, 0, asset.path);
      canonicalGLBs++;
    }
    const old = await readFile(resolve(baseline, layer, asset.path));
    if (layer === 'terrain') {
      assert.deepEqual(body, old);
      continue;
    }
    if (asset.kind !== 'collision') continue;
    const current = JSON.parse(body),
      previous = JSON.parse(old);
    cells.push(current);
    assert.deepEqual(
      current.cell,
      previous.cell,
      'Every surface ID, color, vertex and triangle remains exact',
    );
    collisionSurfaces += current.cell.surfaces.length;
    assert.equal(current.bindings.length, previous.bindings.length);
    for (const [i, binding] of current.bindings.entries()) {
      const before = previous.bindings[i];
      assert.deepEqual({ ...binding, uvs: before.uvs }, before);
      if (JSON.stringify(binding.uvs) !== JSON.stringify(before.uvs)) {
        assert(prep.materialSurfaces.includes(binding.surfaceId));
        changedBindings++;
      }
    }
    const a = current.textures[0],
      b = previous.textures[0],
      pa = Buffer.from(a.indicesBase64, 'base64'),
      pb = Buffer.from(b.indicesBase64, 'base64');
    assert.deepEqual({ ...a, paletteRgb: b.paletteRgb, indicesBase64: b.indicesBase64 }, b);
    // Complete UV rectangle plus >40-pixel gutter, under either vertical convention.
    for (let y = 0; y < 512; y++)
      for (let x = 128; x < 416; x++)
        if (y < 144 || y >= 376) {
          const at = y * 512 + x;
          assert.deepEqual(
            a.paletteRgb.slice(pa[at] * 3, pa[at] * 3 + 3),
            b.paletteRgb.slice(pb[at] * 3, pb[at] * 3 + 3),
          );
          protectedTexels++;
        }
    const scene = manifest.assets.find((a) => a.path === asset.path.replace('.json', '.glb'));
    assert.equal(hash(compileScenerySource(current).glb), scene.sha256);
  }
  sources[layer] = {
    baseURL: `https://${layer}.invalid/`,
    fetchImpl: async (url) => {
      const body = bodies.get(new URL(url).pathname);
      return new Response(body, { status: body ? 200 : 404 });
    },
  };
}
assert.equal(changedBindings, 14);
const resources = scenerySourceResources(cells);
assert.equal(resources.textures.size, 1);
assert.equal(resources.geometryBytes, prep.geometryBytes);
assert.equal(resources.textureBytes, prep.textureBytes);
const tiers = [];
for (const quality of ['performance', 'balanced', 'quality']) {
  const owner = createVerifiedMixedWindow(manifests.terrain, {
    source: { ...sources.terrain, surfaceStyle: 'hillside-town', surfaceQuality: quality },
    scenery: {
      manifest: manifests.scenery,
      source: { ...sources.scenery, surfaceQuality: quality },
    },
  });
  try {
    await owner.transition({ x: 192000, y: 60000, z: 192000 });
    const live = owner.snapshot();
    assert.equal(live.textureBytes, prep.textureBytes);
    await owner.dispose();
    const disposed = owner.snapshot(),
      collision = owner.collisionSnapshot();
    for (const field of [
      'geometryBytes',
      'textureBytes',
      'resourceBytes',
      'sourceBytes',
      'reservedGeometryBytes',
      'reservedSourceBytes',
    ])
      assert.equal(disposed[field], 0, field);
    for (const field of ['worlds', 'colliders', 'rigidBodies'])
      assert.equal(collision[field], 0, field);
    assert.equal(owner.group, null);
    tiers.push({ quality, live, disposed, collision });
  } finally {
    await owner.dispose();
  }
}
const receipt = {
  format: 'FPVHillsideCourtMaterialsReview.v1',
  canonicalGLBs,
  collisionSurfaces,
  changedBindings,
  protectedTexels,
  geometryBytes: resources.geometryBytes,
  textureBytes: resources.textureBytes,
  sharedTextures: resources.textures.size,
  retainedAndCandidateBytes: prep.retainedAndCandidateBytes,
  terrainManifestSHA256: prep.terrainManifestSHA256,
  sceneryManifestSHA256: prep.sceneryManifestSHA256,
  tiers,
  limits:
    'Source/material ownership only; no native appearance, device FPS, Library or offline claim',
};
await writeFile(
  resolve(root, 'material-verification.json'),
  JSON.stringify(receipt, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      canonicalGLBs,
      collisionSurfaces,
      changedBindings,
      protectedTexels,
      geometryBytes: resources.geometryBytes,
      textureBytes: resources.textureBytes,
      tiers: tiers.length,
    },
    null,
    2,
  ),
);
