/** Exact authored water presentation: unchanged source, collisions and owned resources. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { prepareSceneryWindow } from '../../../../optional-practice/civilian-fpv/regional/scenery-admission.mjs';
import { compileScenerySource } from '../../../../optional-practice/civilian-fpv/regional/indexed-scenery-cell.mjs';
import { sceneryMaterialStyle } from '../../../../optional-practice/civilian-fpv/regional/scenery-surface.mjs';
import {
  createRegionalSession,
  loadRegionalReview,
} from '../../../../optional-practice/civilian-fpv/regional-session.mjs';
import { verificationProbes } from './district-design.mjs';
const root = resolve(process.argv[2] ?? '');
assert(process.argv[2], 'Provide the exact districts-r2 source directory');
const sourceBytes = await readFile(resolve(root, 'scenery/region.json'));
assert.equal(
  createHash('sha256').update(sourceBytes).digest('hex'),
  'ba0339e6e3f8285169a4f10fe1dc456de2fab36632496412b9a7104a6e1ae4c9',
);
const manifest = JSON.parse(sourceBytes);
const sources = [];
for (const asset of manifest.assets.filter((asset) => asset.kind === 'collision')) {
  const bytes = await readFile(resolve(root, 'scenery', asset.path));
  assert.equal(bytes.length, asset.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  sources.push(JSON.parse(bytes));
}
const sourceJSON = JSON.stringify(sources);
const style = 'tropical-settlement-water';
const surfaces = sources.flatMap((source) => compileScenerySource(source).surfaces);
const sea = surfaces.find((surface) => surface.id === 'sea-surface');
assert(sea);
assert.equal(sceneryMaterialStyle(style, sea), style);
for (const mutation of [
  { id: 'other-surface' },
  { collision: 'solid' },
  { alphaMode: 'MASK' },
  { doubleSided: true },
  { color: [0.035, 0.35, 0.44] },
  { texture: { ...sea.texture, rgbaBase64: 'AAAA/w==' } },
  { texture: { ...sea.texture, width: 2 } },
  { positions: Float32Array.from(sea.positions, (_, i) => (i % 3 === 1 ? 1 : sea.positions[i])) },
  { normals: new Float32Array(sea.normals.length) },
])
  assert.equal(sceneryMaterialStyle(style, { ...sea, ...mutation }), 'plain');
assert.equal(sceneryMaterialStyle('plain', sea), 'plain');
assert.equal(sceneryMaterialStyle('urban', sea), 'plain');
for (const surface of surfaces.filter((surface) => surface.id !== 'sea-surface'))
  assert.equal(sceneryMaterialStyle(style, surface), 'plain');

const mm = (xyz) =>
  Object.fromEntries(['x', 'y', 'z'].map((axis, i) => [axis, Math.round(xyz[i] * 1000)]));
const shaderOf = (material) => {
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader: '#include <common>\n#include <color_fragment>',
  };
  material.onBeforeCompile(shader);
  return shader;
};
let baseline;
const records = [];
for (const quality of ['plain', 'performance', 'balanced', 'quality']) {
  const owner = await prepareSceneryWindow(manifest, sources, {
    requiredChunkIds: manifest.chunks.map((chunk) => chunk.id),
    surfaceStyle: quality === 'plain' ? 'plain' : style,
    surfaceQuality: quality === 'plain' ? 'balanced' : quality,
  });
  const materials = new Set(),
    textures = new Set(),
    geometries = new Set();
  let disposedMaterials = 0,
    disposedTextures = 0,
    disposedGeometries = 0;
  try {
    const hash = createHash('sha256');
    owner.group.traverse((object) => {
      if (!object.isMesh) return;
      geometries.add(object.geometry);
      materials.add(object.material);
      if (object.material.map) textures.add(object.material.map);
      for (const attribute of [object.geometry.index, ...Object.values(object.geometry.attributes)])
        hash.update(
          new Uint8Array(
            attribute.array.buffer,
            attribute.array.byteOffset,
            attribute.array.byteLength,
          ),
        );
      hash.update(JSON.stringify(object.position));
    });
    const water = [...materials].filter((material) =>
      material.name.startsWith('Coastal shoreline water'),
    );
    assert.equal(water.length, quality === 'plain' ? 0 : 1);
    for (const material of water) {
      const shader = shaderOf(material),
        uniforms = shader.uniforms;
      assert(!/uniform\s+float\s+(time|clock)/i.test(shader.fragmentShader));
      assert(!shader.vertexShader.includes('position.y +='));
      assert.equal(material.transparent, false);
      assert.equal(material.opacity, 1);
      assert.equal(material.map.image.width, 1);
      assert.equal(material.map.image.height, 1);
      for (const next of ['performance', 'quality', 'balanced', quality]) {
        material.userData.setRegionalSurfaceQuality(next);
        const nextShader = shaderOf(material);
        for (const [key, value] of Object.entries(uniforms))
          assert.equal(nextShader.uniforms[key], value);
        assert.equal(material.customProgramCacheKey(), `fpv-coastal-water-study-v1-${next}`);
        if (next === 'performance') assert(!nextShader.fragmentShader.includes('float ripple'));
        else assert(nextShader.fragmentShader.includes('fwidth(coast)'));
        const version = material.version;
        material.userData.setRegionalSurfaceQuality(next);
        assert.equal(material.version, version);
      }
      assert.throws(() => material.userData.setRegionalSurfaceQuality('ultra'));
    }
    const probes = verificationProbes.map((probe) => {
      const hit = owner.sweep(mm(probe.from), mm(probe.to), 250);
      assert.equal(hit.status, probe.clear ? 'scenery-clear' : 'scenery-hit', probe.id);
      return { id: probe.id, ...hit };
    });
    const state = {
      geometryDigest: hash.digest('hex'),
      snapshot: owner.snapshot(),
      collision: owner.collisionSnapshot(),
      probes,
    };
    if (!baseline) baseline = state;
    else
      assert.deepEqual(
        state,
        baseline,
        'Water appearance cannot change geometry, allocation or queries',
      );
    for (const material of materials)
      material.addEventListener('dispose', () => disposedMaterials++);
    for (const texture of textures) texture.addEventListener('dispose', () => disposedTextures++);
    for (const geometry of geometries)
      geometry.addEventListener('dispose', () => disposedGeometries++);
    records.push({ quality, ...state });
  } finally {
    owner.dispose();
    owner.dispose();
    assert.equal(disposedMaterials, materials.size);
    assert.equal(disposedTextures, textures.size);
    assert.equal(disposedGeometries, geometries.size);
    assert.equal(owner.group.children.length, 0);
    assert.deepEqual(owner.collisionSnapshot(), { worlds: 0, colliders: 0, rigidBodies: 0 });
    for (const key of [
      'geometryBytes',
      'textureBytes',
      'resourceBytes',
      'materials',
      'textures',
      'meshes',
    ])
      assert.equal(owner.snapshot()[key], 0);
  }
}
assert.equal(JSON.stringify(sources), sourceJSON);
const fetchImpl = async (url) => {
  const file = resolve(root, '.' + new URL(url).pathname);
  assert(file.startsWith(root + sep));
  return new Response(await readFile(file));
};
const configuration = await loadRegionalReview({
  manifestURL: '/terrain/region.json',
  sceneryURL: '/scenery/region.json',
  pageURL: 'https://water.invalid/sim',
  fetchImpl,
});
const session = createRegionalSession({
  ...configuration,
  source: { ...configuration.source, surfaceStyle: 'tropical-settlement' },
  scenery: {
    ...configuration.scenery,
    source: { ...configuration.scenery.source, surfaceStyle: style, surfaceQuality: 'performance' },
  },
});
try {
  await session.prepare();
  assert.equal(session.snapshot().status, 'paused');
  assert.equal(session.snapshot().ticks, 0);
  const names = [];
  session.root.traverse((object) => {
    if (object.isMesh) names.push(object.material.name);
  });
  assert(names.includes('Coastal shoreline water · performance'));
} finally {
  await session.dispose();
}
console.log(
  JSON.stringify(
    {
      passed: true,
      records,
      unknownSurfaceRejected: true,
      sourceUnchanged: true,
      preparedDisarmed: true,
      nativeVisualReview: false,
      animated: false,
      physicsChanged: false,
    },
    null,
    2,
  ),
);
