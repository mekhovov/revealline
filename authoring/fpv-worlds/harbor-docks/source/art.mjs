// Original offline authoring utilities. No browser-runtime dependency is added.
import { deflateSync } from 'node:zlib';
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { encodeWorldGLB } from '../../../../optional-practice/civilian-fpv/world-content.mjs';

export const xyz = (a) =>
  Object.fromEntries(['x', 'y', 'z'].map((k, i) => [k, Math.round(a[i] * 1000)]));
export const noise = (x, z) => {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return (value ^ 0xffffffff) >>> 0;
}
function texturePNG(kind = 'paint') {
  const size = 256,
    raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const at = y * (size * 4 + 1) + 1 + x * 4;
      // Metre-scaled original paint ribs/fine aggregate, no identifiable tiled blotch.
      const rib = Math.cos((x / size) * Math.PI * 16);
      const v = Math.round(
        kind === 'ground'
          ? 185 + (noise(x, y) - 0.5) * 42 + (noise(x + 29, y + 11) - 0.5) * 12
          : 218 + rib * 9 + (noise(x, y) - 0.5) * 22,
      );
      raw[at] = raw[at + 1] = raw[at + 2] = v;
      raw[at + 3] = 255;
    }
  const chunk = (type, data) => {
    const tag = Buffer.from(type),
      result = Buffer.alloc(12 + data.length);
    result.writeUInt32BE(data.length);
    tag.copy(result, 4);
    data.copy(result, 8);
    result.writeUInt32BE(crc(Buffer.concat([tag, data])), 8 + data.length);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function createArtwork(paints) {
  const batches = new Map();
  function add(shape, role, at = [0, 0, 0], rotate = [0, 0, 0], tint = 1) {
    const flat = shape.index ? shape.toNonIndexed() : shape.clone();
    shape.dispose();
    flat.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...at),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotate)),
        new THREE.Vector3(1, 1, 1),
      ),
    );
    if (!flat.attributes.normal) flat.computeVertexNormals();
    const batch = batches.get(role) ?? { positions: [], normals: [], uvs: [], colors: [] };
    if (tint !== 1) batch.tinted = true;
    const p = flat.attributes.position.array,
      n = flat.attributes.normal.array;
    batch.positions.push(...p);
    batch.normals.push(...n);
    for (let i = 0; i < p.length; i += 9) {
      const a = new THREE.Vector3(...p.slice(i, i + 3));
      const face = new THREE.Vector3(...p.slice(i + 3, i + 6))
        .sub(a)
        .cross(new THREE.Vector3(...p.slice(i + 6, i + 9)).sub(a));
      const ax = Math.abs(face.x),
        ay = Math.abs(face.y),
        az = Math.abs(face.z);
      for (let j = i; j < i + 9; j += 3) {
        const metres = role === 'asphalt' ? 1.5 : role === 'concrete' ? 2 : 2;
        batch.uvs.push(
          (ax > ay && ax > az ? p[j + 2] : p[j]) / metres,
          (ay >= ax && ay >= az ? p[j + 2] : p[j + 1]) / metres,
        );
        const variation = role === 'lawn' ? 0.84 + noise(p[j] / 4, p[j + 2] / 4) * 0.16 : tint;
        batch.colors.push(variation, variation, variation, 1);
      }
    }
    batches.set(role, batch);
    flat.dispose();
  }
  const box = (role, size, at, rotate) => add(new THREE.BoxGeometry(...size), role, at, rotate);
  function encode(boxes, anchors, revision = 'r1') {
    const doc = {
      asset: {
        version: '2.0',
        generator: 'RevealLine original Harbor Docks ' + revision,
        extras: { fpvScenery: true },
      },
      extensionsUsed: ['REVEALLINE_surface_coating'],
      extensionsRequired: ['REVEALLINE_surface_coating'],
      scene: 0,
      scenes: [{ nodes: [] }],
      nodes: [],
      meshes: [],
      materials: [],
      accessors: [],
      bufferViews: [],
      buffers: [{ byteLength: 0 }],
    };
    const pieces = [];
    let offset = 0,
      triangles = 0;
    function attribute(values, width, color = false) {
      const data = color
        ? new Uint8Array(values.map((v) => Math.round(v * 255)))
        : new Float32Array(values);
      const bytes = new Uint8Array(data.buffer),
        view =
          doc.bufferViews.push({
            buffer: 0,
            byteOffset: offset,
            byteLength: bytes.length,
            target: 34962,
          }) - 1;
      pieces.push(bytes);
      offset += bytes.length;
      const accessor = {
        bufferView: view,
        componentType: color ? 5121 : 5126,
        count: values.length / width,
        type: 'VEC' + width,
        ...(color ? { normalized: true } : {}),
      };
      if (width === 3) {
        accessor.min = [0, 1, 2].map((k) => Math.min(...values.filter((_, i) => i % 3 === k)));
        accessor.max = [0, 1, 2].map((k) => Math.max(...values.filter((_, i) => i % 3 === k)));
      }
      return doc.accessors.push(accessor) - 1;
    }
    for (const [role, batch] of batches) {
      const definition = paints[role],
        color = new THREE.Color(definition[0]);
      const material =
        doc.materials.push({
          name: role,
          ...(definition[4]
            ? { extensions: { REVEALLINE_surface_coating: { version: 1, kind: 'opaque-finish' } } }
            : {}),
          pbrMetallicRoughness: {
            baseColorFactor: [color.r, color.g, color.b, 1],
            metallicFactor: definition[2] ?? 0,
            roughnessFactor: definition[1],
            ...(definition[3]
              ? { baseColorTexture: { index: definition[3] === 'ground' ? 1 : 0 } }
              : {}),
          },
        }) - 1;
      const mesh =
        doc.meshes.push({
          name: role,
          primitives: [
            {
              attributes: {
                POSITION: attribute(batch.positions, 3),
                NORMAL: attribute(batch.normals, 3),
                ...(definition[3] ? { TEXCOORD_0: attribute(batch.uvs, 2) } : {}),
                ...(role === 'lawn' || batch.tinted
                  ? { COLOR_0: attribute(batch.colors, 4, true) }
                  : {}),
              },
              material,
            },
          ],
        }) - 1;
      doc.scenes[0].nodes.push(doc.nodes.push({ name: role, mesh }) - 1);
      triangles += batch.positions.length / 9;
    }
    for (const { position, ...semantics } of anchors)
      doc.scenes[0].nodes.push(
        doc.nodes.push({ name: semantics.id, translation: position, extras: { rl: semantics } }) -
          1,
      );
    for (const b of boxes)
      doc.scenes[0].nodes.push(
        doc.nodes.push({
          name: b.id,
          translation: ['x', 'y', 'z'].map((k) => (b.min[k] + b.max[k]) / 2000),
          ...(b.rotation ? { rotation: b.rotation } : {}),
          extras: {
            rl: {
              id: b.id,
              kind: 'collider',
              size: ['x', 'y', 'z'].map((k) => (b.max[k] - b.min[k]) / 1000),
            },
          },
        }) - 1,
      );
    doc.images = [];
    for (const kind of ['paint', 'ground']) {
      const padding = (4 - (offset % 4)) % 4;
      if (padding) {
        pieces.push(new Uint8Array(padding));
        offset += padding;
      }
      const image = texturePNG(kind),
        imageView =
          doc.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: image.length }) - 1;
      pieces.push(image);
      offset += image.length;
      doc.images.push({
        name: 'original-harbor-' + kind + '-256',
        mimeType: 'image/png',
        bufferView: imageView,
      });
    }
    doc.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
    doc.textures = [
      { sampler: 0, source: 0 },
      { sampler: 0, source: 1 },
    ];
    doc.buffers[0].byteLength = offset;
    const binary = new Uint8Array(offset);
    let position = 0;
    for (const bytes of pieces) {
      binary.set(bytes, position);
      position += bytes.length;
    }
    return {
      bytes: encodeWorldGLB(doc, binary),
      statistics: {
        triangles,
        materials: doc.materials.length,
        nodes: doc.nodes.length,
        textures: 2,
        colliders: boxes.length,
      },
    };
  }
  return { add, box, encode };
}
