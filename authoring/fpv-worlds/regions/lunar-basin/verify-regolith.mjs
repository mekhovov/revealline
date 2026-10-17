/** Exact mixed-owner geometry/collision parity; shader assembly is not native GPU acceptance. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createVerifiedMixedWindow } from '../../../../optional-practice/civilian-fpv/regional/verified-mixed-window.mjs';
import { createTerrainSurface } from '../../../../optional-practice/civilian-fpv/regional/terrain-surface.mjs';
import {
  createScenerySurface,
  sceneryMaterialStyle,
} from '../../../../optional-practice/civilian-fpv/regional/scenery-surface.mjs';
assert(process.argv[2], 'Provide the unchanged composition-r1 source directory');
const root = resolve(process.argv[2]),
  hash = (b) => createHash('sha256').update(b).digest('hex');
const prep = JSON.parse(await readFile(resolve(root, 'preparation.json')));
const manifests = {},
  sources = {},
  bodies = new Map();
for (const layer of ['terrain', 'scenery']) {
  const bytes = await readFile(resolve(root, layer, 'region.json'));
  assert.equal(hash(bytes), prep[layer + 'ManifestSHA256']);
  manifests[layer] = JSON.parse(bytes);
  assert.equal(manifests[layer].id, 'lunar-basin-study');
  assert.equal(manifests[layer].revision, 'composition-r1');
  for (const asset of manifests[layer].assets) {
    const bytes = await readFile(resolve(root, layer, asset.path));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(hash(bytes), asset.sha256);
    bodies.set('/' + layer + '/' + asset.path, bytes);
  }
  sources[layer] = {
    baseURL: 'https://lunar.invalid/' + layer + '/',
    fetchImpl: async (url) => {
      const bytes = bodies.get(new URL(url).pathname);
      assert(bytes);
      return new Response(bytes);
    },
  };
}
const receipts = [];
for (const start of manifests.terrain.spawns) {
  let reference;
  for (const quality of ['plain', 'performance', 'balanced', 'quality']) {
    const owner = createVerifiedMixedWindow(manifests.terrain, {
      source: {
        ...sources.terrain,
        surfaceStyle: quality === 'plain' ? 'plain' : 'lunar-regolith',
        surfaceQuality: quality === 'plain' ? 'balanced' : quality,
      },
      scenery: {
        manifest: manifests.scenery,
        source: {
          ...sources.scenery,
          surfaceStyle: quality === 'plain' ? 'plain' : 'lunar-survey',
          surfaceQuality: quality === 'plain' ? 'balanced' : quality,
        },
      },
    });
    const snapshot = await owner.transition(start.position);
    const geometry = createHash('sha256'),
      materials = new Set();
    owner.group.traverse((mesh) => {
      if (!mesh.isMesh) return;
      for (const a of [
        mesh.geometry.attributes.position,
        mesh.geometry.attributes.normal,
        mesh.geometry.index,
      ])
        geometry.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength));
      const material = mesh.material;
      materials.add(material);
      assert.equal(material.transparent, false);
      assert.equal(material.opacity, 1);
      assert.equal(material.depthWrite, true);
      assert.equal(material.map, null);
      assert.equal(material.displacementMap, null);
    });
    if (quality !== 'plain') {
      assert.ok([...materials].some((material) => material.name === `Lunar regolith · ${quality}`));
      assert.ok([...materials].some((material) => material.name.startsWith('Lunar rock')));
      for (const material of materials) {
        assert.ok(material.name.startsWith('Lunar '));
        shaderOf(material);
      }
    }
    const actual = {
      geometry: geometry.digest('hex'),
      bytes: snapshot.geometryBytes,
      support: owner.support(start.position, 10000),
      sweep: owner.sweep(start.position, { ...start.position, y: start.position.y - 10000 }),
    };
    if (reference) assert.deepEqual(actual, reference);
    else reference = actual;
    assert.equal(actual.support.status, 'terrain-hit');
    assert.equal(actual.sweep.status, 'terrain-hit');
    const disposed = new Map([...materials].map((m) => [m, 0]));
    for (const m of materials)
      m.addEventListener('dispose', () => disposed.set(m, disposed.get(m) + 1));
    owner.dispose();
    owner.dispose();
    for (const count of disposed.values()) assert.equal(count, 1);
    assert.equal(owner.snapshot().geometryBytes, 0);
  }
  receipts.push({
    start: start.id,
    geometryBytes: reference.bytes,
    windows: 4,
    collisionAndGeometryIdentical: true,
  });
}
function shaderOf(material) {
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader:
      '#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>',
  };
  material.onBeforeCompile(shader);
  return shader;
}
const palettes = [
  [0.25, 0.27, 0.29],
  [0.51, 0.5, 0.47],
  [0.7, 0.69, 0.64],
  [0.57, 0.62, 0.64],
  [0.75, 0.52, 0.21],
];
for (const quality of ['performance', 'balanced', 'quality']) {
  for (const color of [null, ...palettes]) {
    const make = (originMm) =>
      color
        ? createScenerySurface({ style: 'lunar-survey', quality, color, originMm })
        : createTerrainSurface({ style: 'lunar-regolith', quality, originMm });
    const a = make({ x: 128000, y: 0, z: 256000 }),
      b = make({ x: 256000, y: 0, z: 384000 });
    const sa = shaderOf(a),
      sb = shaderOf(b);
    assert.equal(sa.vertexShader, sb.vertexShader);
    assert.equal(sa.fragmentShader, sb.fragmentShader);
    for (const shader of [sa, sb]) {
      const origin = shader.uniforms[color ? 'lunarSurveyOrigin' : 'lunarOrigin'].value;
      const global = [350, 29, 410],
        local = global.map((n, i) => n - [origin.x, origin.y, origin.z][i]);
      assert.deepEqual(
        local.map((n, i) => n + [origin.x, origin.y, origin.z][i]),
        global,
      );
      assert.ok(!/transformed\s*[+*\-/]?=/.test(shader.vertexShader));
      assert.ok(!/\bdiscard\b|gl_FragDepth/.test(shader.fragmentShader));
    }
    const oldVersion = a.version;
    a.userData.setRegionalSurfaceQuality(quality === 'quality' ? 'performance' : 'quality');
    assert.ok(a.version > oldVersion);
    assert.notEqual(a.customProgramCacheKey(), b.customProgramCacheKey());
    a.dispose();
    b.dispose();
  }
}
assert.equal(
  sceneryMaterialStyle('lunar-survey', { color: [0.51, 0.5, 0.47], texture: {} }),
  'plain',
);
assert.equal(sceneryMaterialStyle('lunar-survey', { color: [0.5, 0.5, 0.5] }), 'plain');
for (const color of palettes)
  assert.equal(sceneryMaterialStyle('lunar-survey', { color }), 'lunar-survey');
assert.throws(() =>
  createTerrainSurface({
    style: 'lunar-regolith',
    quality: 'ultra',
    originMm: { x: 0, y: 0, z: 0 },
  }),
);
console.log(
  JSON.stringify(
    {
      passed: true,
      districts: receipts,
      sourceFilesVerified: bodies.size,
      texturesAdded: 0,
      newRuntimeModules: 0,
      geometryChanged: false,
      nativeGPUAccepted: false,
      playerAdmission: false,
    },
    null,
    2,
  ),
);
