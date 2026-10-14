/** Pinned geometry with an explicit palette-sampled colour derivative, not lossless texture conversion. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readRailwayPalette } from './palette-source.mjs';

export async function loadRailwayModels() {
  const receipt = JSON.parse(await readFile(new URL('./source-provenance.json', import.meta.url)));
  const root = new URL('./source/', import.meta.url);
  for (const file of receipt.files) {
    const bytes = await readFile(new URL(file.path, root));
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
  const colour = readRailwayPalette(await readFile(new URL('Textures/colormap.png', root)));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), models = new Map();
  for (const file of receipt.files.filter((f) => f.path.endsWith('.glb'))) {
    const document = await io.read(new URL(file.path, root).pathname), groups = new Map();
    let primitiveId = 0;
    document.getRoot().getDefaultScene().traverse((node) => {
      if (!node.getMesh()) return;
      const m = node.getWorldMatrix();
      for (const primitive of node.getMesh().listPrimitives()) {
        const position = primitive.getAttribute('POSITION'), uv = primitive.getAttribute('TEXCOORD_0'), indices = primitive.getIndices().getArray();
        assert.equal(primitive.getMode(), 4); assert(uv);
        const id = primitiveId++;
        for (let i = 0; i < indices.length; i += 3) {
          const face = [...indices.slice(i, i + 3)];
          const uvs = face.map((index) => uv.getElement(index, []));
          const centroid = [0, 1].map((axis) => uvs.reduce((sum, value) => sum + value[axis], 0) / 3);
          const sampled = colour(centroid).map((value) => Math.round(value * 31) / 31);
          const key = JSON.stringify(sampled);
          if (!groups.has(key)) groups.set(key, { color: sampled, positions: [], indices: [], vertices: new Map() });
          const group = groups.get(key);
          for (const index of face) {
            const vertexKey = `${id}:${index}`;
            if (!group.vertices.has(vertexKey)) {
              group.vertices.set(vertexKey, group.positions.length / 3);
              const p = position.getElement(index, []);
              for (let k = 0; k < 3; k++) group.positions.push(m[k] * p[0] + m[4 + k] * p[1] + m[8 + k] * p[2] + m[12 + k]);
            }
            group.indices.push(group.vertices.get(vertexKey));
          }
        }
      }
    });
    models.set(file.path, [...groups.values()].map(({ color, positions, indices }) => ({ color, positions, indices })));
  }
  return models;
}
