/** Strict pinned Building Kit adapter; exact palette/UVs and explicit back faces, no player decoder. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
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

export async function loadBuildingModels() {
  const provenance = JSON.parse(
    await readFile(new URL('./source-provenance.json', import.meta.url)),
  );
  const files = new Map();
  for (const row of provenance.files) {
    const bytes = await readFile(new URL('./source/' + row.path, import.meta.url));
    assert.equal(bytes.length, row.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
    files.set(row.path, bytes);
  }
  const texture = {
    id: 'building-palette',
    ...decodePinnedPalette(files.get('Textures/colormap.png')),
    magFilter: 9728,
    minFilter: 9984,
    wrapS: 10497,
    wrapT: 10497,
  };
  const models = new Map();
  for (const [name, bytes] of files) {
    if (!name.endsWith('.glb')) continue;
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const length = bytes.readUInt32LE(12);
    assert.equal(bytes.toString('ascii', 16, 20), 'JSON');
    const doc = JSON.parse(bytes.toString('utf8', 20, 20 + length));
    const off = 20 + length;
    assert.equal(bytes.readUInt32LE(off + 4), 0x004e4942);
    const bin = bytes.subarray(off + 8);
    assert.equal(bytes.readUInt32LE(off), bin.length);
    assert(!doc.animations && !doc.skins);
    assert.equal(doc.nodes.length, 1);
    assert.deepEqual(Object.keys(doc.nodes[0]).sort(), ['mesh', 'name']);
    assert.equal(doc.meshes.length, 1);
    assert.equal(doc.meshes[0].primitives.length, 1);
    const primitive = doc.meshes[0].primitives[0];
    assert.equal(primitive.mode ?? 4, 4);
    const mat = doc.materials[primitive.material];
    assert.equal(mat.doubleSided, true);
    assert.equal(mat.alphaMode ?? 'OPAQUE', 'OPAQUE');
    assert.equal(mat.pbrMetallicRoughness.metallicFactor, 0);
    assert.equal(mat.pbrMetallicRoughness.roughnessFactor ?? 1, 1);
    assert.deepEqual(mat.pbrMetallicRoughness.baseColorFactor ?? [1, 1, 1, 1], [1, 1, 1, 1]);
    assert.equal(mat.pbrMetallicRoughness.baseColorTexture.index, 0);
    assert.equal(mat.pbrMetallicRoughness.baseColorTexture.texCoord ?? 0, 0);
    assert.deepEqual(mat.pbrMetallicRoughness.baseColorTexture.extensions, {
      KHR_texture_transform: { texCoord: 0 },
    });
    assert.equal(doc.images[0].uri, 'Textures/colormap.png');
    assert.equal(doc.images.length, 1);
    const sampler = doc.samplers[doc.textures[0].sampler];
    assert.equal(sampler.wrapS ?? 10497, 10497);
    assert.equal(sampler.wrapT ?? 10497, 10497);
    assert.equal(sampler.magFilter, 9728);
    assert.equal(sampler.minFilter, 9984);
    const access = (index) => {
      const a = doc.accessors[index],
        v = doc.bufferViews[a.bufferView];
      assert(!a.sparse && !a.normalized);
      assert.equal(v.buffer, 0);
      const count = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type];
      assert(count);
      const sizes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 },
        size = sizes[a.componentType];
      assert(size);
      const stride = v.byteStride ?? size * count;
      assert((a.byteOffset ?? 0) + (a.count - 1) * stride + size * count <= v.byteLength);
      const result = [];
      for (let i = 0; i < a.count; i++)
        for (let j = 0; j < count; j++) {
          const pos = (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * stride + j * size;
          result.push(
            a.componentType === 5126
              ? bin.readFloatLE(pos)
              : a.componentType === 5123
                ? bin.readUInt16LE(pos)
                : a.componentType === 5121
                  ? bin.readUInt8(pos)
                  : bin.readUInt32LE(pos),
          );
        }
      assert(result.every(Number.isFinite));
      return result;
    };
    const position = access(primitive.attributes.POSITION),
      normals = access(primitive.attributes.NORMAL),
      uvs = access(primitive.attributes.TEXCOORD_0),
      indices = access(primitive.indices);
    assert.equal(position.length, normals.length);
    assert.equal(uvs.length, (position.length / 3) * 2);
    const n = position.length / 3;
    assert(indices.every((i) => Number.isInteger(i) && i >= 0 && i < n));
    // Material double-sided semantics are baked into authored faces, leaving the strict player format unchanged.
    const back = [];
    for (let i = 0; i < indices.length; i += 3)
      back.push(indices[i] + n, indices[i + 2] + n, indices[i + 1] + n);
    models.set(name, {
      positions: [...position, ...position],
      normals: [...normals, ...normals.map((n) => -n || 0)],
      uvs: [...uvs, ...uvs],
      indices: [...indices, ...back],
    });
  }
  return { models, texture };
}
