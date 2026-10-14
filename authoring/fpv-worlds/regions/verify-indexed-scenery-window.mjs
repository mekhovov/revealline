/** Actual verified-source texture ownership, queries, budgets and cancellation. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRailwayIndexedCells } from './railway-valley/indexed-source.mjs';
import { compileScenerySource } from './indexed-scenery-cell.mjs';
import { prepareSceneryWindow } from './scenery-admission.mjs';
import { createVerifiedSceneryWindow } from './verified-scenery-window.mjs';
import * as THREE from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { compileTerrainCell } from './terrain-cell.mjs';
import { createVerifiedMixedWindow } from './verified-mixed-window.mjs';
const point = (x) => ({ x: x * 128000 + 64000, y: 15000, z: 64000 });
const template = (await createRailwayIndexedCells()).get('train-carriage-tank.glb');
const cells = [],
  assets = [],
  chunks = [],
  bodies = new Map();
for (let x = 0; x < 6; x++) {
  const source = structuredClone(template);
  source.cell.x = x;
  source.cell.chunkId = `tile-${x}`;
  cells.push(source);
  const ids = [];
  for (const [kind, bytes] of [
    ['scene', compileScenerySource(source).glb],
    ['collision', new TextEncoder().encode(JSON.stringify(source))],
  ]) {
    const id = `tile-${x}-${kind}`,
      path = `${id}.${kind === 'scene' ? 'glb' : 'json'}`;
    assets.push({
      id,
      kind,
      path,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    ids.push(id);
    bodies.set(path, bytes);
  }
  chunks.push({ id: source.cell.chunkId, x, z: 0, assets: ids });
}
const manifest = {
  format: 'FPVRegionManifest.v1',
  id: 'indexed-scenery-study',
  revision: 'r1',
  title: { en: 'Indexed scenery study', uk: 'Дослідження текстур' },
  grid: {
    cellSizeMm: 128000,
    minX: 0,
    minZ: 0,
    width: 6,
    depth: 1,
    floorMm: -1000,
    ceilingMm: 100000,
  },
  assets,
  chunks,
  spawns: [{ id: 'start', position: point(0) }],
};
let corrupt = false,
  requests = 0;
const sourceOptions = {
  baseURL: 'https://indexed.example/',
  fetchImpl: async (url) => {
    requests++;
    const name = new URL(url).pathname.slice(1),
      bytes = bodies.get(name);
    if (corrupt && name.endsWith('.glb')) {
      const modified = bytes.slice();
      modified[modified.length - 1] ^= 1;
      return new Response(modified);
    }
    return new Response(bytes, { status: bytes ? 200 : 404 });
  },
};
let checks = 0;
async function check(label, run) {
  await run();
  checks++;
  console.log(`PASS ${label}`);
}
await check(
  'shared exact RGBA texture, authored attributes and canonical collision queries',
  async () => {
    const options = { requiredChunkIds: ['tile-0', 'tile-1'] };
    const textured = await prepareSceneryWindow(manifest, cells.slice(0, 2), options),
      plain = await prepareSceneryWindow(
        manifest,
        cells.slice(0, 2).map((s) => s.cell),
        options,
      );
    try {
      assert.equal(textured.snapshot().textures, 1);
      assert.equal(textured.snapshot().textureBytes, 2446676);
      assert.equal(textured.snapshot().resourceBytes, textured.snapshot().geometryBytes + 2446676);
      const texture = textured.group.children[0].material.map;
      assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
      assert.equal(texture.flipY, false);
      assert.equal(texture.minFilter, THREE.NearestMipmapNearestFilter);
      const palette = template.textures[0],
        indices = Buffer.from(palette.indicesBase64, 'base64');
      for (let i = 0; i < indices.length; i++)
        assert.deepEqual(
          [...texture.image.data.slice(i * 4, i * 4 + 4)],
          [...palette.paletteRgb.slice(indices[i] * 3, indices[i] * 3 + 3), 255],
        );
      textured.group.children.forEach((mesh, i) => {
        assert.equal(mesh.material.map, texture);
        assert.deepEqual(
          mesh.geometry.attributes.position.array,
          plain.group.children[i].geometry.attributes.position.array,
        );
        assert.deepEqual(mesh.geometry.index.array, plain.group.children[i].geometry.index.array);
      });
      for (let x = 0; x < 2; x++) {
        assert.deepEqual(textured.support(point(x)), plain.support(point(x)));
        for (const z of [60000, 64000, 68000]) {
          const from = { x: x * 128000 + 58000, y: 6000, z },
            to = { x: x * 128000 + 70000, y: 6000, z };
          assert.deepEqual(textured.sweep(from, to, 220), plain.sweep(from, to, 220));
        }
      }
      let disposals = 0;
      texture.addEventListener('dispose', () => disposals++);
      textured.dispose();
      textured.dispose();
      assert.equal(disposals, 1);
      assert.equal(textured.snapshot().textureBytes, 0);
      assert.equal(textured.snapshot().textures, 0);
    } finally {
      textured.dispose();
      plain.dispose();
    }
  },
);
await check(
  'retained plus candidate textures must fit existing geometry resource ceiling',
  async () => {
    const owner = createVerifiedSceneryWindow(manifest, {
      ...sourceOptions,
      retainCommitted: true,
      maxGeometryBytes: 3 * 1024 * 1024,
    });
    try {
      const ready = await owner.transition(point(0));
      assert.equal(ready.textureBytes, 2446676);
      const retained = owner.group;
      await assert.rejects(owner.transition(point(4)), /transition-scenery-geometry-budget/);
      assert.equal(owner.group, retained);
      assert.equal(owner.snapshot().textureBytes, 2446676);
    } finally {
      await owner.dispose();
    }
  },
);
await check(
  'cancel during prewarm disposes candidate texture once and preserves retained texture',
  async () => {
    const owner = createVerifiedSceneryWindow(manifest, {
      ...sourceOptions,
      retainCommitted: true,
      maxGeometryBytes: 6 * 1024 * 1024,
    });
    try {
      await owner.transition(point(0));
      const retained = owner.group;
      let oldDisposed = 0,
        candidateDisposed = 0,
        commit = 0;
      retained.children[0].material.map.addEventListener('dispose', () => oldDisposed++);
      await assert.rejects(
        owner.transition(point(4), null, {
          prepare: async ({ group }) => {
            group.children[0].material.map.addEventListener('dispose', () => candidateDisposed++);
            owner.cancel();
          },
          commit() {
            commit++;
          },
          rollback() {},
        }),
        /cancelled/,
      );
      assert.equal(commit, 0);
      assert.equal(candidateDisposed, 1);
      assert.equal(oldDisposed, 0);
      assert.equal(owner.group, retained);
      await owner.transition(point(4));
      assert.equal(oldDisposed, 1);
      assert.equal(owner.snapshot().textureBytes, 2446676);
    } finally {
      await owner.dispose();
    }
  },
);
await check(
  'prewarm error and commit rollback release private texture without replacing old frame',
  async () => {
    const owner = createVerifiedSceneryWindow(manifest, {
      ...sourceOptions,
      retainCommitted: true,
      maxGeometryBytes: 6 * 1024 * 1024,
    });
    try {
      await owner.transition(point(0));
      const retained = owner.group;
      let disposed = 0,
        rollbacks = 0;
      for (const failAt of ['prepare', 'commit'])
        await assert.rejects(
          owner.transition(point(4), null, {
            prepare: async ({ group }) => {
              group.children[0].material.map.addEventListener('dispose', () => disposed++);
              if (failAt === 'prepare') throw new Error('deliberate prepare');
            },
            commit() {
              throw new Error('deliberate commit');
            },
            rollback() {
              rollbacks++;
            },
          }),
          /deliberate/,
        );
      assert.equal(disposed, 2);
      assert.equal(rollbacks, 1);
      assert.equal(owner.group, retained);
    } finally {
      await owner.dispose();
    }
  },
);
await check('tampered image bytes cannot pass exact-source hash admission', async () => {
  corrupt = true;
  const owner = createVerifiedSceneryWindow(manifest, sourceOptions);
  try {
    await assert.rejects(owner.transition(point(0)));
    assert.equal(owner.group, null);
    assert.equal(owner.snapshot().textureBytes, 0);
  } finally {
    corrupt = false;
    await owner.dispose();
  }
});
await check(
  'mixed terrain/scenery budget includes retained texture and preserves supported old frame',
  async () => {
    const terrainManifest = structuredClone(manifest),
      terrainBodies = new Map();
    for (const chunk of terrainManifest.chunks) {
      const cell = {
        format: 'FPVRegionCollision.v1',
        chunkId: chunk.id,
        x: chunk.x,
        z: chunk.z,
        cellSizeMm: 128000,
        samples: 33,
        heightsMm: Array(1089).fill(0),
      };
      for (const id of chunk.assets) {
        const asset = terrainManifest.assets.find((a) => a.id === id);
        const bytes =
          asset.kind === 'scene'
            ? compileTerrainCell(cell).glb
            : new TextEncoder().encode(JSON.stringify(cell));
        asset.bytes = bytes.length;
        asset.sha256 = createHash('sha256').update(bytes).digest('hex');
        terrainBodies.set(asset.path, bytes);
      }
    }
    const owner = createVerifiedMixedWindow(terrainManifest, {
      retainCommitted: true,
      maxGeometryBytes: 3 * 1024 * 1024,
      source: {
        baseURL: 'https://terrain.example/',
        fetchImpl: async (url) => new Response(terrainBodies.get(new URL(url).pathname.slice(1))),
      },
      scenery: { manifest, source: sourceOptions },
    });
    try {
      const ready = await owner.transition(point(0));
      assert.equal(ready.textureBytes, 2446676);
      assert.equal(ready.resourceBytes, ready.geometryBytes + 2446676);
      const retained = owner.group,
        support = owner.support(point(0));
      await assert.rejects(owner.transition(point(4)), /budget/);
      assert.equal(owner.group, retained);
      assert.deepEqual(owner.support(point(0)), support);
    } finally {
      await owner.dispose();
    }
  },
);
if (process.argv[2]) {
  const output = resolve(process.argv[2]);
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'region.json'), JSON.stringify(manifest, null, 2) + '\n');
  for (const [path, bytes] of bodies) await writeFile(resolve(output, path), bytes);
}
console.log(
  JSON.stringify({ checks, requests, textureBytesPerWindow: 2446676, defaultAdmission: false }),
);
