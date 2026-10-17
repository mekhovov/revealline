/** Bounded production scenery admission; no player stores or browser automation. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { validateRgbaSceneryCell, compileRgbaSceneryCell } from './rgba-scenery-cell.mjs';
import {
  compileScenerySource,
  scenerySourceResources,
  validateScenerySource,
} from './indexed-scenery-cell.mjs';
import { prepareSceneryWindow } from './scenery-admission.mjs';
import { createVerifiedSceneryWindow } from './verified-scenery-window.mjs';
const require = createRequire(import.meta.url),
  validator = require('gltf-validator');
const pixels = Buffer.from([30, 150, 60, 0, 40, 180, 70, 255, 60, 200, 80, 255, 10, 100, 30, 0]);
const surface = (id, x) => ({
  id,
  positionsMm: [x, 0, 60000, x, 4000, 60000, x, 4000, 68000, x, 0, 68000],
  indices: [0, 1, 2, 0, 2, 3],
  color: [1, 1, 1],
});
const binding = (surfaceId, collision, alphaMode) => ({
  surfaceId,
  textureId: 'leaf',
  uvs: [0, 0, 1, 0, 1, 1, 0, 1],
  normals: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
  colors:
    collision === 'visual-only'
      ? [0.2, 0.3, 0.1, 1, 0.3, 0.4, 0.2, 0.5, 0.4, 0.5, 0.3, 1, 0.2, 0.3, 0.1, 1]
      : [],
  alphaMode,
  alphaCutoff: alphaMode === 'MASK' ? 0.4 : 0,
  doubleSided: alphaMode === 'MASK',
  collision,
});
const source = {
  format: 'FPVRegionRgbaScenery.v1',
  cell: {
    format: 'FPVRegionScenery.v1',
    chunkId: 'tile-0',
    x: 0,
    z: 0,
    cellSizeMm: 128000,
    surfaces: [surface('foliage', 62000), surface('structure', 66000)],
  },
  textures: [
    {
      id: 'leaf',
      width: 2,
      height: 2,
      rgbaBase64: pixels.toString('base64'),
      magFilter: 9729,
      minFilter: 9987,
      wrapS: 10497,
      wrapT: 10497,
    },
  ],
  bindings: [binding('foliage', 'visual-only', 'MASK'), binding('structure', 'solid', 'OPAQUE')],
};
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log('PASS ' + name);
}
const hash = (b) => createHash('sha256').update(b).digest('hex');
const bytes = new TextEncoder().encode(JSON.stringify(source)),
  glb = compileScenerySource(source).glb;
const manifest = {
  format: 'FPVRegionManifest.v1',
  id: 'rgba-study',
  revision: 'r1',
  title: { en: 'RGBA material study', uk: 'Дослідження матеріалів RGBA' },
  grid: {
    cellSizeMm: 128000,
    minX: 0,
    minZ: 0,
    width: 1,
    depth: 1,
    floorMm: -1000,
    ceilingMm: 100000,
  },
  assets: [
    { id: 'cell-scene', kind: 'scene', path: 'scene.glb', bytes: glb.length, sha256: hash(glb) },
    {
      id: 'cell-collision',
      kind: 'collision',
      path: 'collision.json',
      bytes: bytes.length,
      sha256: hash(bytes),
    },
  ],
  chunks: [{ id: 'tile-0', x: 0, z: 0, assets: ['cell-scene', 'cell-collision'] }],
  spawns: [{ id: 'start', position: { x: 64000, y: 10000, z: 64000 } }],
};
await check('strict material/pixel/source rejection', () => {
  for (const mutate of [
    (s) => (s.textures[0].width = 512),
    (s) => (s.textures[0].rgbaBase64 += 'A'),
    (s) => (s.textures[0].rgbaBase64 = '!'.repeat(24)),
    (s) => (s.textures[0].url = 'https://bad.invalid/a.png'),
    (s) => (s.bindings[0].uvs[0] = Infinity),
    (s) => (s.bindings[0].normals[0] = NaN),
    (s) => (s.bindings[0].colors[0] = Infinity),
    (s) => (s.bindings[0].colors[0] = -0.1),
    (s) => s.bindings[0].colors.pop(),
    (s) => (s.bindings[0].alphaCutoff = NaN),
    (s) => (s.bindings[0].alphaMode = 'BLEND'),
    (s) => (s.bindings[0].collision = undefined),
    (s) => (s.bindings[0].doubleSided = 'true'),
    (s) => s.bindings.pop(),
    (s) => (s.bindings[1].surfaceId = 'foliage'),
  ]) {
    const bad = structuredClone(source);
    mutate(bad);
    assert.throws(() => validateRgbaSceneryCell(bad));
  }
  const tooMany = structuredClone(source);
  tooMany.textures = Array.from({ length: 5 }, (_, i) => ({
    ...tooMany.textures[0],
    id: 'texture-' + i,
  }));
  assert.throws(() => validateRgbaSceneryCell(tooMany), /count/);
  const aggregate = structuredClone(source);
  aggregate.textures = Array.from({ length: 2 }, (_, i) => ({
    ...source.textures[0],
    id: 'texture-' + i,
    width: 256,
    height: 256,
    rgbaBase64: Buffer.alloc(256 * 256 * 4).toString('base64'),
  }));
  assert.throws(() => validateRgbaSceneryCell(aggregate), /aggregate/);
  const text = ' '.repeat(1024 * 1024) + JSON.stringify(source);
  assert.throws(() => validateScenerySource(text), /allowance/);
});
await check(
  'canonical GLB retains exact RGBA alpha texels and material/collision semantics',
  async () => {
    assert.deepEqual(compileRgbaSceneryCell(source).glb, glb);
    const valid = await validator.validateBytes(glb, { maxIssues: 100 });
    assert.equal(valid.issues.numErrors, 0);
    assert.equal(valid.issues.numWarnings, 0);
    const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength),
      jl = view.getUint32(12, true),
      doc = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jl))),
      bin = glb.subarray(28 + jl);
    assert.equal(doc.accessors[doc.meshes[0].primitives[0].attributes.COLOR_0].type, 'VEC4');
    assert.equal(doc.meshes[0].primitives[1].attributes.COLOR_0, undefined);
    assert.equal(doc.materials[0].alphaMode, 'MASK');
    assert.equal(doc.materials[0].alphaCutoff, 0.4);
    assert.equal(doc.materials[1].alphaMode, 'OPAQUE');
    assert.equal(doc.meshes[0].primitives[0].extras.collision, 'visual-only');
    assert.equal(doc.meshes[0].primitives[1].extras.collision, 'solid');
    const bv = doc.bufferViews[doc.images[0].bufferView],
      png = bin.subarray(bv.byteOffset, bv.byteOffset + bv.byteLength);
    const idat = [];
    for (let at = 8; at < png.length; ) {
      const n = new DataView(png.buffer, png.byteOffset + at, 4).getUint32(0),
        kind = new TextDecoder().decode(png.subarray(at + 4, at + 8));
      if (kind === 'IDAT') idat.push(png.subarray(at + 8, at + 8 + n));
      at += n + 12;
    }
    const raw = inflateSync(Buffer.concat(idat));
    assert.deepEqual(Buffer.concat([raw.subarray(1, 9), raw.subarray(10, 18)]), pixels);
  },
);
await check('texture sharing respects actual content and sampler, not ID', () => {
  const validated = validateRgbaSceneryCell(source);
  assert.equal(scenerySourceResources([validated, validated]).textures.size, 1);
  const changed = structuredClone(source);
  changed.textures[0].wrapS = 33071;
  assert.equal(
    scenerySourceResources([validated, validateRgbaSceneryCell(changed)]).textures.size,
    2,
  );
});
await check(
  'visual foliage has no collision; solid structure and authored material remain',
  async () => {
    const owner = await prepareSceneryWindow(manifest, [source], { requiredChunkIds: ['tile-0'] });
    try {
      assert.equal(owner.snapshot().textures, 1);
      assert.equal(owner.collisionSnapshot().colliders, 1);
      const collisionMeshes = owner.collisionMeshes();
      assert.deepEqual(
        collisionMeshes.map((mesh) => mesh.id),
        ['scenery:tile-0:1'],
      );
      assert.equal(
        collisionMeshes[0].vertices[0],
        66,
        'Advanced export retains the solid wall only',
      );
      const [leaf, wall] = owner.group.children;
      assert.equal(leaf.material.map, wall.material.map);
      assert.notEqual(leaf.material, wall.material);
      assert.equal(leaf.material.vertexColors, true);
      assert.equal(wall.material.vertexColors, false);
      assert.deepEqual(
        leaf.geometry.getAttribute('color').array,
        new Float32Array(source.bindings[0].colors),
      );
      const tintBytes = source.bindings[0].colors.length * 4;
      const untinted = structuredClone(source);
      untinted.bindings[0].colors = [];
      assert.equal(
        scenerySourceResources([validateRgbaSceneryCell(source)]).geometryBytes -
          scenerySourceResources([validateRgbaSceneryCell(untinted)]).geometryBytes,
        tintBytes,
      );
      assert.equal(leaf.material.alphaTest, 0.4);
      assert.equal(wall.material.alphaTest, 0);
      assert.deepEqual(Buffer.from(leaf.material.map.image.data), pixels);
      assert.equal(
        owner.sweep({ x: 60000, y: 2000, z: 64000 }, { x: 64000, y: 2000, z: 64000 }, 200).status,
        'scenery-clear',
      );
      assert.equal(
        owner.sweep({ x: 64000, y: 2000, z: 64000 }, { x: 68000, y: 2000, z: 64000 }, 200).status,
        'scenery-hit',
      );
      let disposed = 0;
      leaf.material.map.addEventListener('dispose', () => disposed++);
      owner.dispose();
      owner.dispose();
      assert.equal(disposed, 1);
      assert.equal(owner.snapshot().textures, 0);
      assert.equal(owner.snapshot().resourceBytes, 0);
      assert.deepEqual(owner.collisionSnapshot(), { worlds: 0, colliders: 0, rigidBodies: 0 });
    } finally {
      owner.dispose();
    }
  },
);
await check(
  'verified-source admission and cancellation release only private resources',
  async () => {
    const files = new Map([
        ['scene.glb', glb],
        ['collision.json', bytes],
      ]),
      owner = createVerifiedSceneryWindow(manifest, {
        baseURL: 'https://rgba.example/',
        fetchImpl: async (url) => new Response(files.get(new URL(url).pathname.slice(1))),
        retainCommitted: true,
      });
    try {
      await owner.transition(manifest.spawns[0].position);
      const retained = owner.group;
      assert.ok(owner.snapshot().textureBytes > 0);
      let disposed = 0;
      await assert.rejects(
        owner.transition(manifest.spawns[0].position, null, {
          prepare: async ({ group }) => {
            group.children[0].material.map.addEventListener('dispose', () => disposed++);
            owner.cancel();
          },
          commit() {
            throw Error('must not commit');
          },
          rollback() {},
        }),
        /cancelled/,
      );
      assert.equal(disposed, 1);
      assert.equal(owner.group, retained);
      assert.ok(owner.snapshot().textureBytes > 0);
    } finally {
      await owner.dispose();
    }
    assert.equal(owner.snapshot().textureBytes, 0);
  },
);
console.log(`PASS ${checks}/${checks} RGBA scenery production checks`);
