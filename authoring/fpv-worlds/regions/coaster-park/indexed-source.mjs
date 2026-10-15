/** Pinned CC0 input adapter. No arbitrary file or remote image import. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  Matrix4,
  Matrix3,
  Vector3,
} from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { INDEXED_SCENERY_FORMAT } from '../indexed-scenery-cell.mjs';
import { decodePinnedPalette } from '../railway-valley/indexed-source.mjs';

export async function createCoasterIndexedCells() {
  const receipt = JSON.parse(await readFile(new URL('./source-provenance.json', import.meta.url)));
  const root = new URL('./source/', import.meta.url);
  for (const file of receipt.files) {
    const bytes = await readFile(new URL(file.path, root));
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
  const palette = decodePinnedPalette(await readFile(new URL('Textures/colormap.png', root)));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
    result = new Map();
  for (const file of receipt.files.filter((f) => f.path.endsWith('.glb'))) {
    const document = await io.read(new URL(file.path, root).pathname),
      surfaces = [],
      bindings = [];
    document
      .getRoot()
      .getDefaultScene()
      .traverse((node) => {
        if (!node.getMesh()) return;
        const matrix = new Matrix4().fromArray(node.getWorldMatrix()),
          normalMatrix = new Matrix3().getNormalMatrix(matrix);
        for (const primitive of node.getMesh().listPrimitives()) {
          const material = primitive.getMaterial(),
            info = material.getBaseColorTextureInfo();
          assert.equal(primitive.getMode(), 4);
          assert.equal(material.getAlphaMode(), 'OPAQUE');
          assert.deepEqual(material.getBaseColorFactor(), [1, 1, 1, 1]);
          assert.equal(material.getMetallicFactor(), 0);
          assert.equal(material.getRoughnessFactor(), 1);
          assert.equal(info.getTexCoord(), 0);
          assert.equal(info.getMagFilter(), 9728);
          assert.equal(info.getMinFilter(), 9984);
          assert.equal(info.getWrapS(), 10497);
          assert.equal(info.getWrapT(), 10497);
          const transform = info.getExtension('KHR_texture_transform');
          if (transform) {
            assert.deepEqual(transform.getOffset(), [0, 0]);
            assert.deepEqual(transform.getScale(), [1, 1]);
            assert.equal(transform.getRotation(), 0);
          }
          const position = primitive.getAttribute('POSITION'),
            uv = primitive.getAttribute('TEXCOORD_0'),
            normal = primitive.getAttribute('NORMAL');
          assert(uv && normal);
          const positionsMm = [],
            normals = [],
            uvs = [];
          for (let i = 0; i < position.getCount(); i++) {
            const p = new Vector3().fromArray(position.getElement(i, [])).applyMatrix4(matrix);
            positionsMm.push(
              Math.round(p.x * 6000) + 64000,
              Math.round(p.y * 6000) + 4000,
              Math.round(p.z * 6000) + 64000,
            );
            normals.push(
              ...new Vector3()
                .fromArray(normal.getElement(i, []))
                .applyNormalMatrix(normalMatrix)
                .toArray()
                .map((v) => v || 0),
            );
            uvs.push(...uv.getElement(i, []).map((v) => v || 0));
          }
          // The pinned kit is double-sided. Bake the back faces with opposite normals
          // so the existing single-sided indexed format preserves its appearance.
          assert.equal(material.getDoubleSided(), true);
          const vertexCount = positionsMm.length / 3;
          const indices = [...primitive.getIndices().getArray()];
          const frontIndices = [...indices];
          positionsMm.push(...positionsMm);
          uvs.push(...uvs);
          normals.push(...normals.map((v) => -v || 0));
          for (let i = 0; i < frontIndices.length; i += 3)
            indices.push(
              vertexCount + frontIndices[i],
              vertexCount + frontIndices[i + 2],
              vertexCount + frontIndices[i + 1],
            );
          const id = `model-part-${surfaces.length}`;
          surfaces.push({
            id,
            positionsMm,
            indices,
            color: [1, 1, 1],
          });
          bindings.push({ surfaceId: id, textureId: 'kenney-colormap', uvs, normals });
        }
      });
    result.set(file.path, {
      format: INDEXED_SCENERY_FORMAT,
      cell: {
        format: 'FPVRegionScenery.v1',
        chunkId: 'coaster-palette-study',
        x: 0,
        z: 0,
        cellSizeMm: 128000,
        surfaces,
      },
      textures: [
        {
          id: 'kenney-colormap',
          ...palette,
          magFilter: 9728,
          minFilter: 9984,
          wrapS: 10497,
          wrapT: 10497,
        },
      ],
      bindings,
    });
  }
  return result;
}
