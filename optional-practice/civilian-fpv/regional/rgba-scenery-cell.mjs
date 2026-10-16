/** Bounded embedded RGBA scenery. Explicit visual/collision classification; no image decoder. */
import { compileSceneryCell, validateSceneryCell, SCENERY_LIMITS } from './scenery-cell.mjs';
export const RGBA_SCENERY_FORMAT = 'FPVRegionRgbaScenery.v1';
export const RGBA_SCENERY_LIMITS = Object.freeze({
  jsonBytes: SCENERY_LIMITS.jsonBytes,
  sceneBytes: SCENERY_LIMITS.sceneBytes,
  textures: 4,
  dimension: 256,
  totalPixels: 65536,
});
const validated = new WeakSet(),
  keys = new WeakMap();
const fail = (test, message) => {
  if (!test) throw new TypeError(message);
};
const fields = (v, names) =>
  v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === names.length &&
  names.every((n) => Object.hasOwn(v, n));
const integer = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
export function rgbaTextureKey(texture) {
  if (keys.has(texture)) return keys.get(texture);
  const key = JSON.stringify([
    'rgba8',
    texture.width,
    texture.height,
    texture.rgbaBase64,
    texture.magFilter,
    texture.minFilter,
    texture.wrapS,
    texture.wrapT,
  ]);
  if (Object.isFrozen(texture)) keys.set(texture, key);
  return key;
}
export function validateRgbaSceneryCell(input) {
  if (input && typeof input === 'object' && validated.has(input)) return input;
  const json = typeof input === 'string' ? input : JSON.stringify(input);
  fail(
    typeof json === 'string' &&
      new TextEncoder().encode(json).length <= RGBA_SCENERY_LIMITS.jsonBytes,
    'RGBA scenery exceeds source allowance',
  );
  const source = JSON.parse(json);
  fail(
    fields(source, ['format', 'cell', 'textures', 'bindings']) &&
      source.format === RGBA_SCENERY_FORMAT,
    'Invalid RGBA scenery envelope',
  );
  source.cell = validateSceneryCell(source.cell);
  fail(
    Array.isArray(source.textures) && source.textures.length > 0 && source.textures.length <= 4,
    'Invalid RGBA texture count',
  );
  let pixels = 0;
  const textureIds = new Set();
  for (const t of source.textures) {
    fail(
      fields(t, [
        'id',
        'width',
        'height',
        'rgbaBase64',
        'magFilter',
        'minFilter',
        'wrapS',
        'wrapT',
      ]),
      'Unexpected RGBA texture fields',
    );
    fail(
      typeof t.id === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(t.id) && !textureIds.has(t.id),
      'Invalid or duplicate RGBA texture ID',
    );
    textureIds.add(t.id);
    fail(
      [t.width, t.height].every((v) => integer(v, 1, 256) && (v & (v - 1)) === 0),
      'RGBA dimensions must be bounded powers of two',
    );
    pixels += t.width * t.height;
    fail(pixels <= 65536, 'RGBA aggregate pixel allowance exceeded');
    const length = t.width * t.height * 4;
    fail(
      typeof t.rgbaBase64 === 'string' &&
        t.rgbaBase64.length === Math.ceil(length / 3) * 4 &&
        /^[A-Za-z0-9+/]+={0,2}$/.test(t.rgbaBase64),
      'Invalid RGBA encoding',
    );
    let decoded;
    try {
      decoded = atob(t.rgbaBase64);
    } catch {
      throw new TypeError('Invalid RGBA encoding');
    }
    fail(decoded.length === length && btoa(decoded) === t.rgbaBase64, 'Noncanonical RGBA encoding');
    fail(
      [9728, 9729].includes(t.magFilter) &&
        [9728, 9729, 9984, 9985, 9986, 9987].includes(t.minFilter) &&
        [33071, 33648, 10497].includes(t.wrapS) &&
        [33071, 33648, 10497].includes(t.wrapT),
      'Unsupported RGBA sampler',
    );
    Object.freeze(t);
  }
  fail(
    Array.isArray(source.bindings) && source.bindings.length === source.cell.surfaces.length,
    'Every RGBA surface requires an explicit material/collision binding',
  );
  const surfaces = new Map(source.cell.surfaces.map((s) => [s.id, s])),
    bound = new Set(),
    usedTextures = new Set();
  for (const b of source.bindings) {
    fail(
      fields(b, [
        'surfaceId',
        'textureId',
        'uvs',
        'normals',
        'colors',
        'alphaMode',
        'alphaCutoff',
        'doubleSided',
        'collision',
      ]),
      'Unexpected RGBA binding fields',
    );
    const surface = surfaces.get(b.surfaceId);
    fail(
      surface && !bound.has(b.surfaceId) && textureIds.has(b.textureId),
      'Invalid RGBA surface/texture binding',
    );
    bound.add(b.surfaceId);
    usedTextures.add(b.textureId);
    fail(
      Array.isArray(b.uvs) &&
        b.uvs.length === (surface.positionsMm.length / 3) * 2 &&
        b.uvs.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 16),
      'Invalid RGBA UVs',
    );
    fail(
      Array.isArray(b.normals) &&
        b.normals.length === surface.positionsMm.length &&
        b.normals.every(
          (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1.00001,
        ),
      'Invalid RGBA normals',
    );
    fail(
      Array.isArray(b.colors) &&
        (b.colors.length === 0 || b.colors.length === (surface.positionsMm.length / 3) * 4) &&
        b.colors.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1),
      'Invalid RGBA vertex colours',
    );
    for (let i = 0; i < b.normals.length; i += 3)
      fail(
        Math.abs(Math.hypot(...b.normals.slice(i, i + 3)) - 1) <= 0.001,
        'RGBA normal must have unit length',
      );
    fail(
      ['OPAQUE', 'MASK'].includes(b.alphaMode) &&
        typeof b.alphaCutoff === 'number' &&
        Number.isFinite(b.alphaCutoff) &&
        b.alphaCutoff >= 0 &&
        b.alphaCutoff <= 1 &&
        (b.alphaMode !== 'OPAQUE' || b.alphaCutoff === 0),
      'Unsupported RGBA alpha material',
    );
    fail(
      typeof b.doubleSided === 'boolean' && ['solid', 'visual-only'].includes(b.collision),
      'Explicit RGBA side/collision required',
    );
    Object.freeze(b.uvs);
    Object.freeze(b.normals);
    Object.freeze(b.colors);
    Object.freeze(b);
  }
  fail(usedTextures.size === textureIds.size, 'Unused RGBA textures are not admitted');
  Object.freeze(source.textures);
  Object.freeze(source.bindings);
  Object.freeze(source);
  validated.add(source);
  return source;
}
const join = (parts) => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(kind, bytes) {
  const out = new Uint8Array(bytes.length + 12),
    view = new DataView(out.buffer);
  view.setUint32(0, bytes.length);
  out.set(new TextEncoder().encode(kind), 4);
  out.set(bytes, 8);
  view.setUint32(bytes.length + 8, crc32(out.subarray(4, bytes.length + 8)));
  return out;
}
/** Exact RGBA texels; deterministic PNG with bounded uncompressed deflate blocks. */
function encodeRgbaTexture(texture) {
  const pixels = Uint8Array.from(atob(texture.rgbaBase64), (c) => c.charCodeAt(0));
  const raw = new Uint8Array((texture.width * 4 + 1) * texture.height);
  for (let y = 0; y < texture.height; y++)
    raw.set(
      pixels.subarray(y * texture.width * 4, (y + 1) * texture.width * 4),
      y * (texture.width * 4 + 1) + 1,
    );
  const parts = [new Uint8Array([0x78, 0x01])];
  for (let offset = 0; offset < raw.length; offset += 65535) {
    const size = Math.min(65535, raw.length - offset),
      block = new Uint8Array(size + 5),
      view = new DataView(block.buffer);
    block[0] = offset + size === raw.length ? 1 : 0;
    view.setUint16(1, size, true);
    view.setUint16(3, 65535 - size, true);
    block.set(raw.subarray(offset, offset + size), 5);
    parts.push(block);
  }
  let a = 1,
    b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const adler = new Uint8Array(4);
  new DataView(adler.buffer).setUint32(0, ((b << 16) | a) >>> 0);
  parts.push(adler);
  const ihdr = new Uint8Array(13),
    header = new DataView(ihdr.buffer);
  header.setUint32(0, texture.width);
  header.setUint32(4, texture.height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return join([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', join(parts)),
    pngChunk('IEND', new Uint8Array()),
  ]);
}

export function compileRgbaSceneryCell(input) {
  const source = validateRgbaSceneryCell(input),
    compiled = compileSceneryCell(source.cell);
  const baseHeader = new DataView(compiled.glb.buffer),
    jsonLength = baseHeader.getUint32(12, true);
  const document = JSON.parse(new TextDecoder().decode(compiled.glb.subarray(20, 20 + jsonLength)));
  document.asset.generator = 'FPV RGBA scenery authoring compiler v1';
  const parts = [compiled.glb.slice(28 + jsonLength)];
  let length = parts[0].length;
  function append(bytes, target) {
    const padding = (4 - (length % 4)) % 4;
    if (padding) {
      parts.push(new Uint8Array(padding));
      length += padding;
    }
    const view = document.bufferViews.length;
    document.bufferViews.push({
      buffer: 0,
      byteOffset: length,
      byteLength: bytes.length,
      ...(target ? { target } : {}),
    });
    parts.push(bytes);
    length += bytes.length;
    return view;
  }
  function attribute(values, type, components) {
    const bytes = new Uint8Array(values.length * 4),
      view = new DataView(bytes.buffer);
    values.forEach((value, i) => view.setFloat32(i * 4, value, true));
    const index = document.accessors.length;
    document.accessors.push({
      bufferView: append(bytes, 34962),
      componentType: 5126,
      count: values.length / components,
      type,
    });
    return index;
  }
  for (const binding of source.bindings) {
    const i = source.cell.surfaces.findIndex((s) => s.id === binding.surfaceId),
      primitive = document.meshes[0].primitives[i];
    primitive.attributes.TEXCOORD_0 = attribute(binding.uvs, 'VEC2', 2);
    primitive.attributes.NORMAL = attribute(binding.normals, 'VEC3', 3);
    if (binding.colors.length) primitive.attributes.COLOR_0 = attribute(binding.colors, 'VEC4', 4);
    const textureIndex = source.textures.findIndex((t) => t.id === binding.textureId);
    const material = document.materials[i];
    material.pbrMetallicRoughness.baseColorTexture = { index: textureIndex };
    material.doubleSided = binding.doubleSided;
    material.alphaMode = binding.alphaMode;
    if (binding.alphaMode === 'MASK') material.alphaCutoff = binding.alphaCutoff;
    primitive.extras = { collision: binding.collision };
  }
  document.images = source.textures.map((texture) => ({
    bufferView: append(encodeRgbaTexture(texture)),
    mimeType: 'image/png',
    name: texture.id,
  }));
  document.samplers = source.textures.map(({ magFilter, minFilter, wrapS, wrapT }) => ({
    magFilter,
    minFilter,
    wrapS,
    wrapT,
  }));
  document.textures = source.textures.map((_, i) => ({ source: i, sampler: i }));
  if (length % 4) {
    const padding = new Uint8Array(4 - (length % 4));
    parts.push(padding);
    length += padding.length;
  }
  document.buffers[0].byteLength = length;
  const json = new TextEncoder().encode(JSON.stringify(document)),
    padded = Math.ceil(json.length / 4) * 4;
  const glb = new Uint8Array(28 + padded + length),
    header = new DataView(glb.buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, glb.length, true);
  header.setUint32(12, padded, true);
  header.setUint32(16, 0x4e4f534a, true);
  glb.fill(32, 20, 20 + padded);
  glb.set(json, 20);
  header.setUint32(20 + padded, length, true);
  header.setUint32(24 + padded, 0x004e4942, true);
  glb.set(join(parts), 28 + padded);
  fail(glb.length <= RGBA_SCENERY_LIMITS.sceneBytes, 'RGBA scene exceeds existing GLB allowance');
  return {
    source,
    ...compiled,
    glb,
    surfaces: compiled.surfaces.map((surface) => {
      const binding = source.bindings.find((b) => b.surfaceId === surface.id),
        texture = source.textures.find((t) => t.id === binding.textureId);
      return {
        ...surface,
        uvs: new Float32Array(binding.uvs),
        normals: new Float32Array(binding.normals),
        colors: binding.colors.length ? new Float32Array(binding.colors) : null,
        texture,
        textureKey: rgbaTextureKey(texture),
        alphaMode: binding.alphaMode,
        alphaCutoff: binding.alphaCutoff,
        doubleSided: binding.doubleSided,
        collision: binding.collision,
      };
    }),
    attributeBytes: source.bindings.reduce(
      (n, b) => n + (b.uvs.length + b.normals.length + b.colors.length) * 4,
      0,
    ),
  };
}
