import { compileContentProject } from './content-definitions.mjs';
/** Browser/Node boundary for user-owned FPV worlds. No network or renderer dependencies. */
export const WORLD_PROJECT_FORMAT = 'FPVWorldProject.v1';
export const WORLD_PACK_FORMAT = 'FPVWorldPack.v2';
export const WORLD_PACK_MAGIC = 'RLFPV2\r\n';
const MAGIC = new Uint8Array([82, 76, 70, 80, 86, 50, 13, 10]); // RLFPV2\r\n, distinct from legacy .rlpack.
export const WORLD_LIMITS = Object.freeze({
  importBytes: 16 * 1024 ** 2,
  packBytes: 64 * 1024 ** 2,
  jsonBytes: 4 * 1024 ** 2,
  files: 128,
  nodes: 2048,
  accessors: 16384,
  vertices: 2000000,
  projects: 64,
  courses: 256,
  anchors: 1024,
  textureBytes: 16 * 1024 ** 2,
});
const encoder = new TextEncoder(),
  decoder = new TextDecoder('utf-8', { fatal: true });
const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
const assert = (value, message) => {
  if (!value) throw new TypeError(message);
};
const integer = (value, max = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(value) && value >= 0 && value <= max;
const validId = (id) =>
  typeof id === 'string' &&
  idPattern.test(id) &&
  !['__proto__', 'constructor', 'prototype'].includes(id);
const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function safeJSON(value, maxBytes = WORLD_LIMITS.jsonBytes) {
  if (typeof value === 'string') {
    assert(encoder.encode(value).length <= maxBytes, 'JSON byte budget exceeded.');
    value = JSON.parse(value);
  }
  let count = 0;
  const seen = new Set();
  function copy(v, depth) {
    assert(++count <= 200000 && depth <= 64, 'JSON structural budget exceeded.');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') {
      assert(Number.isFinite(v), 'Numbers must be finite.');
      return v;
    }
    if (typeof v === 'string') {
      assert(v.length <= 65536, 'String budget exceeded.');
      return v;
    }
    assert(v && typeof v === 'object' && !seen.has(v), 'Expected acyclic JSON data.');
    assert(
      Array.isArray(v) ||
        Object.getPrototypeOf(v) === Object.prototype ||
        Object.getPrototypeOf(v) === null,
      'Expected plain JSON data.',
    );
    seen.add(v);
    const out = Array.isArray(v) ? [] : {};
    for (const [key, d] of Object.entries(Object.getOwnPropertyDescriptors(v))) {
      if (Array.isArray(v) && key === 'length') continue;
      assert(
        !['__proto__', 'constructor', 'prototype'].includes(key) && d.enumerable && own(d, 'value'),
        'Unsafe JSON field.',
      );
      out[key] = copy(d.value, depth + 1);
    }
    seen.delete(v);
    return out;
  }
  const result = copy(value, 0);
  assert(encoder.encode(JSON.stringify(result)).length <= maxBytes, 'JSON byte budget exceeded.');
  return result;
}
export function canonicalWorldJSON(value) {
  const sort = (v) =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, sort(v[k])]),
          )
        : v;
  return JSON.stringify(sort(safeJSON(value)));
}
export async function worldSHA256(value) {
  assert(globalThis.crypto?.subtle, 'SHA-256 requires a secure browser context.');
  const bytes = await toBytes(value);
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
}
async function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  if (typeof value === 'string') return encoder.encode(value);
  throw new TypeError('Expected Blob, bytes, or text.');
}
function byteLength(value) {
  return value instanceof Blob
    ? value.size
    : typeof value === 'string'
      ? encoder.encode(value).length
      : value?.byteLength;
}
export function validateWorldPath(path) {
  assert(
    typeof path === 'string' &&
      path.length > 0 &&
      path.length <= 240 &&
      !/[\\:\x00-\x1f?#%]/.test(path) &&
      !path.startsWith('/') &&
      path.split('/').every((s) => s && s !== '.' && s !== '..'),
    'Resources must use safe relative local paths.',
  );
  return path;
}
async function fileMap(files, limit = WORLD_LIMITS.importBytes) {
  const entries = files instanceof Map ? [...files] : Object.entries(files || {});
  assert(entries.length <= WORLD_LIMITS.files, 'File count budget exceeded.');
  let sum = 0;
  const result = new Map(),
    folded = new Set();
  for (const [path, file] of entries) {
    validateWorldPath(path);
    assert(!folded.has(path.toLowerCase()), 'Duplicate or case-colliding resource path.');
    folded.add(path.toLowerCase());
    const length = byteLength(file);
    assert(integer(length, limit) && (sum += length) <= limit, 'Resource byte budget exceeded.');
    result.set(path, await toBytes(file));
  }
  return result;
}
function parseGLB(bytes) {
  assert(bytes.length >= 20, 'Truncated GLB header.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert(
    view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2,
    'Expected GLB version 2.',
  );
  assert(
    view.getUint32(8, true) === bytes.length && bytes.length % 4 === 0,
    'GLB length mismatch.',
  );
  let offset = 12,
    json,
    bin;
  while (offset < bytes.length) {
    assert(offset + 8 <= bytes.length, 'Truncated GLB chunk.');
    const length = view.getUint32(offset, true),
      type = view.getUint32(offset + 4, true);
    offset += 8;
    assert(length % 4 === 0 && offset + length <= bytes.length, 'Invalid GLB chunk length.');
    if (type === 0x4e4f534a) {
      assert(
        !json && offset === 20 && length <= WORLD_LIMITS.jsonBytes,
        'GLB requires one first JSON chunk.',
      );
      json = safeJSON(decoder.decode(bytes.subarray(offset, offset + length)).trimEnd());
    } else if (type === 0x004e4942) {
      assert(json && !bin, 'GLB has invalid BIN chunk order.');
      bin = bytes.subarray(offset, offset + length);
    } else throw new TypeError('Unsupported GLB chunk.');
    offset += length;
  }
  assert(json, 'Missing GLB JSON.');
  return { document: json, bin };
}
export function encodeWorldGLB(document, binary = new Uint8Array()) {
  const json = encoder.encode(canonicalWorldJSON(document)),
    jLength = Math.ceil(json.length / 4) * 4,
    bLength = Math.ceil(binary.length / 4) * 4,
    bytes = new Uint8Array(20 + jLength + (bLength ? 8 + bLength : 0)),
    view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.length, true);
  view.setUint32(12, jLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(32, 20, 20 + jLength);
  bytes.set(json, 20);
  if (bLength) {
    view.setUint32(20 + jLength, bLength, true);
    view.setUint32(24 + jLength, 0x004e4942, true);
    bytes.set(binary, 28 + jLength);
  }
  return bytes;
}
const SUPPORTED_EXTENSIONS = new Set([
  'KHR_materials_unlit',
  'KHR_texture_transform',
  'KHR_mesh_quantization',
  'KHR_lights_punctual',
  'KHR_materials_emissive_strength',
  'EXT_mesh_gpu_instancing',
]);
function arrayField(doc, key, max = WORLD_LIMITS.nodes) {
  const value = doc[key] ?? [];
  assert(Array.isArray(value) && value.length <= max, `${key} count budget exceeded.`);
  return value;
}
function ref(index, list, label) {
  assert(
    integer(index, list.length - 1) && list[index] !== undefined,
    `Invalid ${label} reference.`,
  );
  return list[index];
}
function vector(value, count, fallback) {
  value ??= fallback;
  assert(
    Array.isArray(value) &&
      value.length === count &&
      value.every((n) => Number.isFinite(n) && Math.abs(n) <= 1000000),
    'Invalid node transform.',
  );
  return value;
}
function multiply(a, b) {
  const out = Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}
function nodeMatrix(node) {
  if (node.matrix) {
    assert(!node.translation && !node.rotation && !node.scale, 'Node cannot mix matrix and TRS.');
    const m = vector(node.matrix, 16);
    assert(m[3] === 0 && m[7] === 0 && m[11] === 0 && m[15] === 1, 'Node matrix must be affine.');
    return m;
  }
  const [x, y, z, w] = vector(node.rotation, 4, [0, 0, 0, 1]),
    p = vector(node.translation, 3, [0, 0, 0]),
    s = vector(node.scale, 3, [1, 1, 1]);
  assert(
    Math.abs(x * x + y * y + z * z + w * w - 1) < 0.001 && s.every((v) => v !== 0),
    'Invalid node rotation or zero scale.',
  );
  return [
    (1 - 2 * y * y - 2 * z * z) * s[0],
    (2 * x * y + 2 * z * w) * s[0],
    (2 * x * z - 2 * y * w) * s[0],
    0,
    (2 * x * y - 2 * z * w) * s[1],
    (1 - 2 * x * x - 2 * z * z) * s[1],
    (2 * y * z + 2 * x * w) * s[1],
    0,
    (2 * x * z + 2 * y * w) * s[2],
    (2 * y * z - 2 * x * w) * s[2],
    (1 - 2 * x * x - 2 * y * y) * s[2],
    0,
    ...p,
    1,
  ];
}
function validateDocument(doc, binary) {
  assert(doc.asset?.version === '2.0', 'Only glTF 2.0 is supported.');
  assert(
    !doc.asset.minVersion || doc.asset.minVersion === '2.0',
    'Unsupported minimum glTF version.',
  );
  for (const extension of doc.extensionsRequired ?? [])
    assert(
      SUPPORTED_EXTENSIONS.has(extension),
      `Unsupported required extension: ${extension}. Use the offline prepare command to decode it first.`,
    );
  const buffers = arrayField(doc, 'buffers', 1),
    views = arrayField(doc, 'bufferViews', WORLD_LIMITS.accessors),
    accessors = arrayField(doc, 'accessors', WORLD_LIMITS.accessors),
    meshes = arrayField(doc, 'meshes', 512),
    nodes = arrayField(doc, 'nodes'),
    images = arrayField(doc, 'images', 64),
    textures = arrayField(doc, 'textures', 128),
    materials = arrayField(doc, 'materials', 256),
    skins = arrayField(doc, 'skins', 64);
  assert(
    (doc.extensions?.KHR_lights_punctual?.lights?.length ?? 0) <= 8,
    'At most eight imported lights.',
  );
  if (buffers.length)
    assert(buffers[0].byteLength <= binary.length && !buffers[0].uri, 'Invalid packed buffer.');
  for (const v of views) {
    assert(
      v.buffer === 0 &&
        integer(v.byteOffset ?? 0) &&
        integer(v.byteLength) &&
        (v.byteOffset ?? 0) + v.byteLength <= (buffers[0]?.byteLength ?? 0),
      'Buffer view exceeds buffer.',
    );
    if (v.byteStride !== undefined)
      assert(
        integer(v.byteStride, 252) && v.byteStride >= 4 && v.byteStride % 4 === 0,
        'Invalid buffer stride.',
      );
    assert(
      !v.extensions?.EXT_meshopt_compression && !v.extensions?.KHR_meshopt_compression,
      'Decode Meshopt with the offline preparation tool before browser import.',
    );
  }
  const sizes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 },
    counts = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  let total = 0;
  for (const a of accessors) {
    const size = sizes[a.componentType],
      components = counts[a.type];
    assert(
      size &&
        components &&
        integer(a.count, WORLD_LIMITS.vertices) &&
        a.count > 0 &&
        (total += a.count) <= WORLD_LIMITS.vertices * 4,
      'Invalid accessor or count budget exceeded.',
    );
    const dim = a.type.startsWith('MAT') ? Number(a.type.slice(3)) : 0,
      element = dim ? Math.ceil((dim * size) / 4) * 4 * dim : components * size;
    const offset = a.byteOffset ?? 0;
    assert(integer(offset) && offset % size === 0, 'Misaligned accessor.');
    if (a.bufferView !== undefined) {
      const v = ref(a.bufferView, views, 'accessor buffer view'),
        stride = v.byteStride ?? element;
      assert(
        stride >= element && offset + (a.count - 1) * stride + element <= v.byteLength,
        'Accessor exceeds its buffer view.',
      );
      assert(((v.byteOffset ?? 0) + offset) % size === 0, 'Misaligned accessor buffer.');
      if (a.componentType === 5126) {
        const data = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
        for (let i = 0; i < a.count; i++)
          for (let c = 0; c < components; c++)
            assert(
              Number.isFinite(
                data.getFloat32((v.byteOffset ?? 0) + offset + i * stride + c * 4, true),
              ),
              'Non-finite accessor value.',
            );
      }
    } else assert(offset === 0, 'Accessor without buffer view cannot have a byte offset.');
    for (const field of ['min', 'max'])
      if (a[field])
        assert(
          a[field].length === components && a[field].every(Number.isFinite),
          'Invalid accessor bounds.',
        );
    if (a.min && a.max)
      assert(
        a.min.every((n, i) => n <= a.max[i]),
        'Reversed accessor bounds.',
      );
    if (a.sparse) {
      const sparse = a.sparse;
      assert(integer(sparse.count, a.count) && sparse.count > 0, 'Invalid sparse count.');
      const iv = ref(sparse.indices?.bufferView, views, 'sparse indices'),
        vv = ref(sparse.values?.bufferView, views, 'sparse values'),
        is = sizes[sparse.indices.componentType];
      assert(
        [5121, 5123, 5125].includes(sparse.indices.componentType) &&
          !iv.byteStride &&
          !vv.byteStride,
        'Invalid sparse index type or stride.',
      );
      const io = sparse.indices.byteOffset ?? 0,
        vo = sparse.values.byteOffset ?? 0;
      assert(
        integer(io) &&
          integer(vo) &&
          io % is === 0 &&
          vo % size === 0 &&
          io + sparse.count * is <= iv.byteLength &&
          vo + sparse.count * element <= vv.byteLength,
        'Sparse data exceeds view.',
      );
      const data = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
      let previous = -1;
      for (let i = 0; i < sparse.count; i++) {
        const p = (iv.byteOffset ?? 0) + io + i * is,
          n =
            is === 1
              ? data.getUint8(p)
              : is === 2
                ? data.getUint16(p, true)
                : data.getUint32(p, true);
        assert(n > previous && n < a.count, 'Sparse indices must increase within accessor bounds.');
        previous = n;
      }
      if (a.componentType === 5126)
        for (let i = 0; i < sparse.count; i++)
          for (let c = 0; c < components; c++)
            assert(
              Number.isFinite(
                data.getFloat32((vv.byteOffset ?? 0) + vo + i * element + c * 4, true),
              ),
              'Non-finite sparse accessor value.',
            );
    }
  }
  const readerCache = new Map(),
    dataView = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  const readComponent = (type, offset) =>
    type === 5120
      ? dataView.getInt8(offset)
      : type === 5121
        ? dataView.getUint8(offset)
        : type === 5122
          ? dataView.getInt16(offset, true)
          : type === 5123
            ? dataView.getUint16(offset, true)
            : type === 5125
              ? dataView.getUint32(offset, true)
              : dataView.getFloat32(offset, true);
  function accessorReader(a) {
    if (readerCache.has(a)) return readerCache.get(a);
    const size = sizes[a.componentType],
      components = counts[a.type],
      v = a.bufferView === undefined ? null : views[a.bufferView],
      replacements = new Map();
    if (a.sparse) {
      const s = a.sparse,
        iv = views[s.indices.bufferView],
        vv = views[s.values.bufferView];
      for (let i = 0; i < s.count; i++)
        replacements.set(
          readComponent(
            s.indices.componentType,
            (iv.byteOffset ?? 0) + (s.indices.byteOffset ?? 0) + i * sizes[s.indices.componentType],
          ),
          (vv.byteOffset ?? 0) + (s.values.byteOffset ?? 0) + i * components * size,
        );
    }
    const read = (i, c = 0) => {
      const replacement = replacements.get(i);
      return replacement !== undefined
        ? readComponent(a.componentType, replacement + c * size)
        : v
          ? readComponent(
              a.componentType,
              (v.byteOffset ?? 0) +
                (a.byteOffset ?? 0) +
                i * (v.byteStride ?? components * size) +
                c * size,
            )
          : 0;
    };
    readerCache.set(a, read);
    return read;
  }
  for (const mesh of meshes) {
    assert(
      Array.isArray(mesh.primitives) &&
        mesh.primitives.length > 0 &&
        mesh.primitives.length <= 1024,
      'Invalid primitive list.',
    );
    for (const p of mesh.primitives) {
      assert(
        !p.extensions?.KHR_draco_mesh_compression,
        'Decode Draco with the offline preparation tool before browser import.',
      );
      assert(p.attributes && own(p.attributes, 'POSITION'), 'Mesh primitive requires POSITION.');
      const pos = ref(p.attributes.POSITION, accessors, 'position');
      assert(pos.type === 'VEC3', 'POSITION must be VEC3.');
      for (const i of Object.values(p.attributes))
        assert(ref(i, accessors, 'attribute').count === pos.count, 'Attribute count mismatch.');
      if (p.indices !== undefined) {
        const a = ref(p.indices, accessors, 'indices');
        assert(
          a.type === 'SCALAR' && [5121, 5123, 5125].includes(a.componentType),
          'Invalid mesh indices.',
        );
        const read = accessorReader(a);
        for (let i = 0; i < a.count; i++)
          assert(read(i) < pos.count, 'Mesh index exceeds vertex count.');
      }
      if (p.material !== undefined) ref(p.material, materials, 'material');
      assert(p.mode === undefined || integer(p.mode, 6), 'Invalid primitive mode.');
    }
  }
  let texturePixels = 0;
  for (const image of images) {
    assert(
      !image.uri && ['image/png', 'image/jpeg'].includes(image.mimeType),
      'Only embedded PNG/JPEG textures are admitted.',
    );
    const v = ref(image.bufferView, views, 'image');
    assert(v.byteLength <= WORLD_LIMITS.textureBytes, 'Texture byte budget exceeded.');
    const imageBytes = binary.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength),
      imageView = new DataView(imageBytes.buffer, imageBytes.byteOffset, imageBytes.byteLength);
    let width, height;
    if (image.mimeType === 'image/png') {
      assert(
        imageBytes.length >= 33 &&
          [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => imageBytes[i] === n) &&
          imageView.getUint32(8) === 13 &&
          imageView.getUint32(12) === 0x49484452,
        'Invalid PNG header.',
      );
      width = imageView.getUint32(16);
      height = imageView.getUint32(20);
    } else {
      assert(
        imageBytes.length >= 4 && imageBytes[0] === 255 && imageBytes[1] === 216,
        'Invalid JPEG header.',
      );
      let offset = 2;
      while (offset + 4 <= imageBytes.length) {
        assert(imageBytes[offset] === 255, 'Invalid JPEG marker.');
        while (imageBytes[offset] === 255) offset++;
        const marker = imageBytes[offset++];
        if (marker === 0xd9 || marker === 0xda) break;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        assert(offset + 2 <= imageBytes.length, 'Truncated JPEG segment.');
        const length = imageView.getUint16(offset);
        assert(length >= 2 && offset + length <= imageBytes.length, 'Invalid JPEG segment.');
        if ([0xc0, 0xc1, 0xc2].includes(marker)) {
          assert(length >= 8, 'Invalid JPEG dimensions.');
          height = imageView.getUint16(offset + 3);
          width = imageView.getUint16(offset + 5);
          break;
        }
        offset += length;
      }
    }
    assert(
      integer(width, 4096) &&
        width > 0 &&
        integer(height, 4096) &&
        height > 0 &&
        (texturePixels += width * height) <= 32 * 1024 * 1024,
      'Texture dimensions or decoded pixel budget exceeded.',
    );
  }
  for (const texture of textures) {
    ref(texture.source, images, 'texture source');
    if (texture.sampler !== undefined) ref(texture.sampler, doc.samplers ?? [], 'sampler');
  }
  const parents = new Map();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    nodeMatrix(n);
    if (n.mesh !== undefined) ref(n.mesh, meshes, 'node mesh');
    if (n.skin !== undefined) {
      ref(n.skin, skins, 'skin');
      assert(n.mesh !== undefined, 'A skinned node needs a mesh.');
    }
    for (const child of n.children ?? []) {
      ref(child, nodes, 'child');
      assert(!parents.has(child), 'Nodes cannot have multiple parents.');
      parents.set(child, i);
    }
  }
  const done = new Set(),
    active = new Set();
  function visit(i, depth) {
    assert(depth <= 64 && !active.has(i), 'Node cycle or depth budget exceeded.');
    if (done.has(i)) return;
    active.add(i);
    for (const c of nodes[i].children ?? []) visit(c, depth + 1);
    active.delete(i);
    done.add(i);
  }
  nodes.forEach((_, i) => visit(i, 0));
  for (const skin of skins) {
    assert(
      Array.isArray(skin.joints) &&
        skin.joints.length > 0 &&
        skin.joints.length <= 64 &&
        new Set(skin.joints).size === skin.joints.length,
      'A rig must contain 1–64 unique joints.',
    );
    for (const joint of skin.joints) ref(joint, nodes, 'skin joint');
    if (skin.skeleton !== undefined) ref(skin.skeleton, nodes, 'skin skeleton');
    if (skin.inverseBindMatrices !== undefined) {
      const a = ref(skin.inverseBindMatrices, accessors, 'inverse bind matrices');
      assert(
        a.type === 'MAT4' && a.componentType === 5126 && a.count >= skin.joints.length,
        'Invalid inverse bind matrices.',
      );
    }
  }
  for (const node of nodes)
    if (node.skin !== undefined)
      for (const primitive of meshes[node.mesh].primitives) {
        const joints = ref(primitive.attributes.JOINTS_0, accessors, 'joint attribute'),
          weights = ref(primitive.attributes.WEIGHTS_0, accessors, 'weight attribute');
        assert(
          joints.type === 'VEC4' &&
            [5121, 5123].includes(joints.componentType) &&
            weights.type === 'VEC4' &&
            [5121, 5123, 5126].includes(weights.componentType),
          'Invalid skin attribute types.',
        );
        const read = accessorReader(joints);
        for (let i = 0; i < joints.count; i++)
          for (let c = 0; c < 4; c++)
            assert(read(i, c) < skins[node.skin].joints.length, 'Skin joint index exceeds rig.');
        const readWeight = accessorReader(weights);
        for (let i = 0; i < weights.count; i++)
          for (let c = 0; c < 4; c++)
            assert(readWeight(i, c) >= 0, 'Skin weights must be nonnegative.');
      }
  function scalarValues(a) {
    assert(
      a.bufferView !== undefined && !a.sparse,
      'Animation time tracks require a non-sparse buffer view.',
    );
    const v = views[a.bufferView],
      data = new DataView(binary.buffer, binary.byteOffset, binary.byteLength),
      values = [];
    for (let i = 0; i < a.count; i++)
      values.push(
        data.getFloat32((v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (v.byteStride ?? 4), true),
      );
    return values;
  }
  const semanticAncestors = new Set();
  for (let i = 0; i < nodes.length; i++)
    if (nodes[i].extras?.rl) {
      let ancestor = i;
      while (ancestor !== undefined) {
        semanticAncestors.add(ancestor);
        ancestor = parents.get(ancestor);
      }
    }
  let animationKeys = 0;
  for (const animation of arrayField(doc, 'animations', 32)) {
    assert(
      Array.isArray(animation.channels) &&
        animation.channels.length > 0 &&
        animation.channels.length <= 128 &&
        Array.isArray(animation.samplers) &&
        animation.samplers.length <= 128,
      'Animation track budget exceeded.',
    );
    const targets = new Set();
    for (const channel of animation.channels) {
      const node = channel.target?.node,
        field = channel.target?.path,
        sampler = ref(channel.sampler, animation.samplers, 'animation sampler');
      ref(node, nodes, 'animation target');
      assert(
        ['translation', 'rotation', 'scale'].includes(field),
        'Only skeletal/object translation, rotation, and scale animation is admitted. Bake morph animation separately.',
      );
      assert(
        !semanticAncestors.has(node),
        'Animation cannot move a gameplay marker or its ancestor. Use separate cosmetic geometry.',
      );
      const target = `${node}:${field}`;
      assert(!targets.has(target), 'Duplicate animation target.');
      targets.add(target);
      const input = ref(sampler.input, accessors, 'animation time'),
        output = ref(sampler.output, accessors, 'animation output'),
        interpolation = sampler.interpolation ?? 'LINEAR';
      assert(
        ['LINEAR', 'STEP', 'CUBICSPLINE'].includes(interpolation) &&
          input.componentType === 5126 &&
          input.type === 'SCALAR' &&
          input.count <= 4096 &&
          (animationKeys += input.count) <= 100000,
        'Animation key budget or interpolation is invalid.',
      );
      assert(
        output.componentType === 5126 &&
          output.type === (field === 'rotation' ? 'VEC4' : 'VEC3') &&
          output.count === input.count * (interpolation === 'CUBICSPLINE' ? 3 : 1),
        'Animation output shape mismatch.',
      );
      const times = scalarValues(input);
      assert(
        times.every((v, i) => v >= 0 && (i === 0 || v > times[i - 1])),
        'Animation times must be nonnegative and strictly increasing.',
      );
    }
  }
  return { nodes, parents };
}
function extractMetadata(doc, nodes, parents) {
  const anchors = [],
    colliders = [],
    diagnostics = [],
    ids = new Set();
  const scenes = arrayField(doc, 'scenes', 64),
    scene = scenes.length
      ? ref(doc.scene ?? 0, scenes, 'scene')
      : { nodes: nodes.map((_, i) => i).filter((i) => !parents.has(i)) };
  const seen = new Set();
  function walk(index, parent) {
    const node = ref(index, nodes, 'scene node');
    assert(!seen.has(index), 'Duplicate scene node.');
    seen.add(index);
    const matrix = multiply(parent, nodeMatrix(node)),
      semantic = node.extras?.rl;
    if (semantic) {
      assert(
        typeof semantic === 'object' && validId(semantic.id) && !ids.has(semantic.id),
        'Semantic anchors need unique stable extras.rl.id values.',
      );
      ids.add(semantic.id);
      const kind = semantic.kind ?? semantic.type;
      assert(
        ['spawn', 'gate', 'checkpoint', 'landing', 'collider', 'landmark', 'actor'].includes(kind),
        `Unsupported semantic kind: ${kind}.`,
      );
      const value = {
        ...safeJSON(semantic),
        kind,
        id: semantic.id,
        node: index,
        position: { x: matrix[12], y: matrix[13], z: matrix[14] },
        matrix,
      };
      assert(
        anchors.length + colliders.length < WORLD_LIMITS.anchors,
        'Semantic anchor budget exceeded.',
      );
      if (kind === 'collider') {
        const size = vector(semantic.size, 3, [1, 1, 1]);
        assert(
          size.every((n) => n > 0),
          'Collider size must be positive.',
        );
        value.size = size;
        colliders.push(value);
      } else anchors.push(value);
    }
    for (const child of node.children ?? []) walk(child, matrix);
  }
  for (const root of scene.nodes ?? []) {
    assert(!parents.has(root), 'Scene root has a parent.');
    walk(root, identity());
  }
  if (!anchors.some((a) => a.kind === 'spawn'))
    diagnostics.push({
      severity: 'warning',
      code: 'missing-spawn',
      message: 'Add a spawn marker before publishing a course.',
    });
  if (!colliders.length)
    diagnostics.push({
      severity: 'warning',
      code: 'missing-colliders',
      message: 'Display meshes do not create flight collisions. Add simplified collider markers.',
    });
  return { anchors, colliders, diagnostics, units: 'metres', up: 'Y' };
}
/** Resolves only provided local files, validates bounded data, and creates one self-contained GLB. */
export async function inspectImport({
  files,
  entry,
  id = 'imported-world',
  title = 'Imported world',
  license = null,
} = {}) {
  assert(validId(id), 'Invalid world id.');
  const resources = await fileMap(files);
  validateWorldPath(entry);
  const input = resources.get(entry);
  assert(input, 'Missing model entry.');
  let doc, embedded;
  if (/\.glb$/i.test(entry)) ({ document: doc, bin: embedded } = parseGLB(input));
  else {
    assert(/\.gltf$/i.test(entry), 'Select a .glb or .gltf file.');
    doc = safeJSON(decoder.decode(input));
  }
  const base = entry.includes('/') ? entry.slice(0, entry.lastIndexOf('/') + 1) : '',
    used = new Set([entry]),
    pieces = [],
    offsets = [];
  let length = 0;
  const append = (bytes) => {
    const start = length;
    pieces.push({ start, bytes });
    length += Math.ceil(bytes.length / 4) * 4;
    assert(length <= WORLD_LIMITS.importBytes, 'Packed model exceeds byte budget.');
    return start;
  };
  const local = (uri) => {
    validateWorldPath(uri);
    const path = base + uri,
      data = resources.get(path);
    assert(data, `Missing local resource: ${path}.`);
    used.add(path);
    return data;
  };
  for (const [i, buffer] of arrayField(doc, 'buffers', 128).entries()) {
    const bytes = buffer.uri ? local(buffer.uri) : i === 0 && embedded;
    assert(
      bytes &&
        integer(buffer.byteLength, WORLD_LIMITS.importBytes) &&
        buffer.byteLength <= bytes.length &&
        bytes.length - buffer.byteLength <= (buffer.uri ? 0 : 3),
      'Buffer length mismatch.',
    );
    offsets.push(append(bytes.subarray(0, buffer.byteLength)));
  }
  for (const view of arrayField(doc, 'bufferViews', WORLD_LIMITS.accessors)) {
    assert(
      integer(view.buffer, offsets.length - 1) && offsets[view.buffer] !== undefined,
      'Invalid source buffer reference.',
    );
    const sourceBuffer = doc.buffers[view.buffer];
    assert(
      integer(view.byteOffset ?? 0) &&
        integer(view.byteLength) &&
        (view.byteOffset ?? 0) + view.byteLength <= sourceBuffer.byteLength,
      'Source buffer view exceeds buffer.',
    );
    view.byteOffset = offsets[view.buffer] + (view.byteOffset ?? 0);
    view.buffer = 0;
  }
  for (const image of arrayField(doc, 'images', 512))
    if (image.uri) {
      const bytes = local(image.uri),
        mime = /\.png$/i.test(image.uri)
          ? 'image/png'
          : /\.jpe?g$/i.test(image.uri)
            ? 'image/jpeg'
            : null;
      assert(mime, 'Only PNG/JPEG textures can be imported.');
      doc.bufferViews ??= [];
      image.bufferView = doc.bufferViews.length;
      doc.bufferViews.push({ buffer: 0, byteOffset: append(bytes), byteLength: bytes.length });
      image.mimeType = mime;
      delete image.uri;
    }
  const binary = new Uint8Array(length);
  for (const piece of pieces) binary.set(piece.bytes, piece.start);
  doc.buffers = length ? [{ byteLength: length }] : [];
  const { nodes, parents } = validateDocument(doc, binary),
    metadata = extractMetadata(doc, nodes, parents);
  for (const path of resources.keys())
    if (!used.has(path))
      metadata.diagnostics.push({
        severity: 'info',
        code: 'unused-resource',
        path,
        message: 'This file is not referenced by the selected model.',
      });
  const modelBlob = new Blob([encodeWorldGLB(doc, binary)], { type: 'model/gltf-binary' });
  assert(
    modelBlob.size <= WORLD_LIMITS.importBytes,
    'Final GLB exceeds the 16 MiB playable model budget.',
  );
  const sourceHash = await worldSHA256(modelBlob);
  return {
    format: 'FPVImport.v1',
    id,
    title: String(title).slice(0, 200),
    document: doc,
    metadata,
    modelBlob,
    sourceHash,
    license,
  };
}

function records(value, label, max = WORLD_LIMITS.courses) {
  assert(Array.isArray(value) && value.length <= max, `${label} count budget exceeded.`);
  const ids = new Set();
  for (const item of value) {
    assert(item && validId(item.id) && !ids.has(item.id), `${label} requires unique ids.`);
    ids.add(item.id);
  }
  return value;
}
/** Editable source and overrides are independent of the deterministic course schemas. */
export function resolveProject(input) {
  const p = safeJSON(input);
  assert(p?.format === WORLD_PROJECT_FORMAT && validId(p.id), 'Invalid FPV world project.');
  assert(
    typeof p.title === 'string' && p.title.length > 0 && p.title.length <= 200,
    'Project title is required.',
  );
  assert(p.world && validId(p.world.id), 'World id is required.');
  if (p.world.modelAsset) validateWorldPath(p.world.modelAsset);
  for (const field of ['courses', 'themes', 'campaigns', 'playlists'])
    p[field] = records(p[field] ?? [], field);
  if (p.definitions) p.courses = compileContentProject(p.definitions).map((entry) => entry.course);
  const courses = new Set(p.courses.map((c) => c.id));
  for (const list of [...p.campaigns, ...p.playlists])
    for (const id of list.courseIds ?? []) assert(courses.has(id), `Missing course ${id}.`);
  p.source ??= { hash: null, anchors: [], colliders: [] };
  p.source.anchors = records(p.source.anchors ?? [], 'source anchors', WORLD_LIMITS.anchors);
  p.source.colliders = records(p.source.colliders ?? [], 'source colliders', WORLD_LIMITS.anchors);
  p.overrides ??= {};
  assert(
    !Array.isArray(p.overrides) && typeof p.overrides === 'object',
    'Overrides must be an object.',
  );
  for (const [id, change] of Object.entries(p.overrides))
    assert(
      validId(id) && change && typeof change === 'object' && !Array.isArray(change),
      'Invalid semantic override.',
    );
  p.provenance ??= [];
  assert(
    Array.isArray(p.provenance) && p.provenance.length <= WORLD_LIMITS.files,
    'Invalid provenance list.',
  );
  return p;
}
export function projectFromImport(imported, { id = imported.id, title = imported.title } = {}) {
  return resolveProject({
    format: WORLD_PROJECT_FORMAT,
    id,
    title,
    world: { id, title, modelAsset: `models/${id}.glb`, sourceHash: imported.sourceHash },
    source: {
      hash: imported.sourceHash,
      anchors: imported.metadata.anchors,
      colliders: imported.metadata.colliders,
    },
    courses: [],
    themes: [],
    campaigns: [],
    playlists: [],
    overrides: {},
    provenance: imported.license ? [{ asset: `models/${id}.glb`, license: imported.license }] : [],
  });
}
export function compilePlayable(input) {
  const p = resolveProject(input),
    apply = (item) => {
      const override = p.overrides[item.id];
      if (override?.deleted) return null;
      const result = { ...item, ...override, id: item.id };
      if (result.matrix) result.matrix = [...nodeMatrix({ matrix: result.matrix })];
      if (override?.position) {
        const { x, y, z } = override.position;
        vector([x, y, z], 3);
        result.matrix ??= identity();
        result.matrix.splice(12, 3, x, y, z);
      }
      if (result.matrix)
        result.position = { x: result.matrix[12], y: result.matrix[13], z: result.matrix[14] };
      if (result.size)
        assert(
          vector(result.size, 3).every((n) => n > 0),
          'Collider size must be positive.',
        );
      return result;
    };
  return {
    world: {
      ...p.world,
      anchors: p.source.anchors.map(apply).filter(Boolean),
      colliders: p.source.colliders.map(apply).filter(Boolean),
    },
    courses: p.courses,
    themes: p.themes,
    campaigns: p.campaigns,
    playlists: p.playlists,
  };
}
export function mergeReimport(input, imported) {
  const p = resolveProject(input),
    old = new Map([...p.source.anchors, ...p.source.colliders].map((a) => [a.id, a])),
    next = new Map(
      [...imported.metadata.anchors, ...imported.metadata.colliders].map((a) => [a.id, a]),
    ),
    diagnostics = [...imported.metadata.diagnostics];
  for (const id of Object.keys(p.overrides)) {
    if (!next.has(id))
      diagnostics.push({
        severity: 'warning',
        code: 'orphan-override',
        id,
        message: 'The source removed this marker; its override is retained for review.',
      });
    else if (old.has(id) && canonicalWorldJSON(old.get(id)) !== canonicalWorldJSON(next.get(id)))
      diagnostics.push({
        severity: 'info',
        code: 'override-preserved',
        id,
        message: 'Source changed; local override remains in effect.',
      });
  }
  p.source = {
    hash: imported.sourceHash,
    anchors: imported.metadata.anchors,
    colliders: imported.metadata.colliders,
  };
  p.world.sourceHash = imported.sourceHash;
  return { project: resolveProject(p), diagnostics };
}
export function resolveExperience(input, { courseId, themeId, playlistId, campaignId } = {}) {
  const p = compilePlayable(input),
    playlist = playlistId ? p.playlists.find((v) => v.id === playlistId) : null,
    campaign = campaignId ? p.campaigns.find((v) => v.id === campaignId) : null;
  if (playlistId) assert(playlist, 'Unknown playlist.');
  if (campaignId) assert(campaign, 'Unknown campaign.');
  courseId ??= playlist?.courseIds?.[0] ?? campaign?.courseIds?.[0] ?? p.courses[0]?.id;
  const course = courseId ? p.courses.find((v) => v.id === courseId) : null,
    theme = themeId ? p.themes.find((v) => v.id === themeId) : (p.themes[0] ?? null);
  if (courseId) assert(course, 'Unknown course.');
  if (themeId) assert(theme, 'Unknown theme.');
  return { world: p.world, course, theme, playlist, campaign };
}

/** Binary .rlpack v2: fixed magic, LE manifest length, canonical manifest, ordered raw assets. */
export async function preparePack(input, { assets = new Map() } = {}) {
  const project = resolveProject(input),
    map = await fileMap(assets, WORLD_LIMITS.packBytes),
    entries = [];
  for (const [path, bytes] of [...map].sort(([a], [b]) => a.localeCompare(b)))
    entries.push({ path, bytes: bytes.length, sha256: await worldSHA256(bytes) });
  if (project.world.modelAsset)
    assert(map.has(project.world.modelAsset), 'Missing world model asset.');
  const manifest = { format: WORLD_PACK_FORMAT, project, assets: entries },
    json = encoder.encode(canonicalWorldJSON(manifest)),
    header = new Uint8Array(12);
  header.set(MAGIC);
  new DataView(header.buffer).setUint32(8, json.length, true);
  const blob = new Blob([header, json, ...entries.map((e) => map.get(e.path))], {
    type: 'application/x-revealline-fpv-pack',
  });
  assert(blob.size <= WORLD_LIMITS.packBytes, 'Pack exceeds byte budget.');
  return blob;
}
export async function inspectPack(value) {
  assert(integer(byteLength(value), WORLD_LIMITS.packBytes), 'Pack exceeds byte budget.');
  const bytes = await toBytes(value);
  assert(
    bytes.length >= 12 && MAGIC.every((n, i) => bytes[i] === n),
    'Not an FPV .rlpack v2. Use the existing library importer for legacy .rlpack files.',
  );
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, true);
  assert(
    length > 0 && length <= WORLD_LIMITS.jsonBytes && 12 + length <= bytes.length,
    'Invalid pack manifest length.',
  );
  const manifest = safeJSON(decoder.decode(bytes.subarray(12, 12 + length)));
  assert(manifest.format === WORLD_PACK_FORMAT, 'Unsupported FPV pack format.');
  const project = resolveProject(manifest.project);
  assert(
    Array.isArray(manifest.assets) && manifest.assets.length <= WORLD_LIMITS.files,
    'Invalid asset list.',
  );
  const assets = new Map(),
    folded = new Set();
  let offset = 12 + length;
  for (const a of manifest.assets) {
    validateWorldPath(a.path);
    assert(!folded.has(a.path.toLowerCase()), 'Duplicate asset path.');
    folded.add(a.path.toLowerCase());
    assert(
      integer(a.bytes, WORLD_LIMITS.packBytes) &&
        offset + a.bytes <= bytes.length &&
        /^[a-f0-9]{64}$/.test(a.sha256),
      'Invalid asset descriptor.',
    );
    const data = bytes.subarray(offset, offset + a.bytes);
    assert((await worldSHA256(data)) === a.sha256, `Asset hash mismatch: ${a.path}.`);
    assets.set(
      a.path,
      new Blob([data], {
        type: /\.glb$/i.test(a.path) ? 'model/gltf-binary' : 'application/octet-stream',
      }),
    );
    offset += a.bytes;
  }
  assert(offset === bytes.length, 'Trailing pack bytes.');
  if (project.world.modelAsset) {
    assert(assets.has(project.world.modelAsset), 'Pack is missing its model.');
    await inspectImport({
      files: new Map([[project.world.modelAsset, assets.get(project.world.modelAsset)]]),
      entry: project.world.modelAsset,
      id: project.world.id,
    });
  }
  return { manifest, project, assets, sha256: await worldSHA256(bytes) };
}
export async function installPack(value, { store, expectedGeneration } = {}) {
  assert(store && typeof store.install === 'function', 'An IndexedDB world store is required.');
  const prepared = await inspectPack(value);
  return store.install({ ...prepared, expectedGeneration });
}
export async function exportEditedProject(project, { assets, format = 'zip' } = {}) {
  if (format === 'rlpack') return preparePack(project, { assets });
  assert(format === 'zip', 'Edited project export supports zip or rlpack.');
  const { exportEditableZip } = await import('./world-zip.mjs');
  return exportEditableZip(project, { assets });
}
