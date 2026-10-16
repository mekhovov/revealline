/** Pinned CC0 input adapter. No arbitrary file or remote image import. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  Matrix4,
  Matrix3,
  Vector3,
} from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { INDEXED_SCENERY_FORMAT } from '../indexed-scenery-cell.mjs';

export function decodePinnedPalette(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let width,
    height,
    palette,
    ended = false;
  const compressed = [];
  for (let offset = 8; offset < bytes.length; ) {
    assert(!ended && offset + 12 <= bytes.length);
    const length = bytes.readUInt32BE(offset),
      kind = bytes.toString('ascii', offset + 4, offset + 8);
    assert(offset + length + 12 <= bytes.length);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (kind === 'IHDR') {
      assert.equal(offset, 8);
      assert.equal(length, 13);
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(width, 512);
      assert.equal(height, 512);
      assert.deepEqual([...data.subarray(8)], [8, 3, 0, 0, 0]);
    } else if (kind === 'PLTE') {
      assert(!palette);
      assert.equal(length, 768);
      palette = data;
    } else if (kind === 'IDAT') {
      assert(palette);
      compressed.push(data);
    } else if (kind === 'IEND') {
      assert.equal(length, 0);
      ended = true;
    } else throw new TypeError(`Unsupported pinned image chunk ${kind}`);
    offset += length + 12;
  }
  assert(ended && palette && compressed.length);
  const raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: (width + 1) * height });
  assert.equal(raw.length, (width + 1) * height);
  const pixels = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (width + 1)];
    assert(filter <= 4);
    for (let x = 0; x < width; x++) {
      const i = y * width + x,
        left = x ? pixels[i - 1] : 0,
        above = y ? pixels[i - width] : 0,
        corner = x && y ? pixels[i - width - 1] : 0;
      const prediction = left + above - corner,
        a = Math.abs(prediction - left),
        b = Math.abs(prediction - above),
        c = Math.abs(prediction - corner);
      const correction = [
        0,
        left,
        above,
        Math.floor((left + above) / 2),
        a <= b && a <= c ? left : b <= c ? above : corner,
      ][filter];
      pixels[i] = (raw[y * (width + 1) + x + 1] + correction) & 255;
    }
  }
  return { paletteRgb: [...palette], indicesBase64: pixels.toString('base64'), width, height };
}

export async function createRailwayIndexedCells() {
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
              Math.round(p.x * 2500) + 64000,
              Math.round(p.y * 2500) + 4000,
              Math.round(p.z * 2500) + 64000,
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
          const id = `model-part-${surfaces.length}`;
          surfaces.push({
            id,
            positionsMm,
            indices: [...primitive.getIndices().getArray()],
            color: [1, 1, 1],
          });
          bindings.push({ surfaceId: id, textureId: 'kenney-colormap', uvs, normals });
        }
      });
    result.set(file.path, {
      format: INDEXED_SCENERY_FORMAT,
      cell: {
        format: 'FPVRegionScenery.v1',
        chunkId: 'railway-palette-study',
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
