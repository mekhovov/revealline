/** Explicit indexed-palette extension; embedded verified texels only, no image URLs. */
import {
  compileSceneryCell,
  validateSceneryCell,
  sceneryGeometryBytes,
  SCENERY_LIMITS,
} from './scenery-cell.mjs';

export const INDEXED_SCENERY_FORMAT = 'FPVRegionIndexedScenery.v1';
export const INDEXED_SCENERY_LIMITS = Object.freeze({
  jsonBytes: 1024 * 1024,
  sceneBytes: SCENERY_LIMITS.sceneBytes,
  textures: 1,
  dimension: 512,
  decodedTextureBytes: 1398100,
});
const validatedSources = new WeakSet();
const textureKeys = new WeakMap();

/** Stable content key, including sampler: equal IDs alone never alias distinct images. */
export function indexedTextureKey(texture) {
  if (textureKeys.has(texture)) return textureKeys.get(texture);
  const key = JSON.stringify([
    texture.width,
    texture.height,
    texture.paletteRgb,
    texture.indicesBase64,
    texture.magFilter,
    texture.minFilter,
    texture.wrapS,
    texture.wrapT,
  ]);
  if (Object.isFrozen(texture) && Object.isFrozen(texture.paletteRgb))
    textureKeys.set(texture, key);
  return key;
}

export function validateScenerySource(input) {
  if (
    typeof input === 'string' &&
    new TextEncoder().encode(input).length > SCENERY_LIMITS.jsonBytes
  )
    throw new TypeError('Scenery source exceeds decode allowance');
  const parsed = typeof input === 'string' ? JSON.parse(input) : input;
  return parsed?.format === INDEXED_SCENERY_FORMAT
    ? validateIndexedSceneryCell(input)
    : validateSceneryCell(input);
}

export const scenerySourceCell = (source) =>
  source.format === INDEXED_SCENERY_FORMAT ? source.cell : source;

export function scenerySourceResources(sources) {
  const textures = new Map();
  let geometryBytes = 0;
  for (const source of sources) {
    geometryBytes += sceneryGeometryBytes(scenerySourceCell(source));
    if (source.format === INDEXED_SCENERY_FORMAT) {
      // Base geometry accounting already includes a normal for every position.
      geometryBytes += source.bindings.reduce((sum, binding) => sum + binding.uvs.length * 4, 0);
      for (const texture of source.textures) textures.set(indexedTextureKey(texture), texture);
    }
  }
  const textureBytes = [...textures.values()].reduce(
    // DataTexture retains CPU base pixels alongside its GPU mip chain.
    (sum, texture) => sum + texture.width * texture.height * 4 + indexedTextureBytes(texture),
    0,
  );
  return { geometryBytes, textureBytes, resourceBytes: geometryBytes + textureBytes, textures };
}

export function compileScenerySource(source) {
  if (source.format !== INDEXED_SCENERY_FORMAT) return compileSceneryCell(source);
  const compiled = compileIndexedSceneryCell(source);
  const textureKey = indexedTextureKey(compiled.source.textures[0]);
  const bindings = new Map(compiled.source.bindings.map((binding) => [binding.surfaceId, binding]));
  return {
    ...compiled,
    surfaces: compiled.surfaces.map((surface) => {
      const binding = bindings.get(surface.id);
      return binding
        ? {
            ...surface,
            uvs: new Float32Array(binding.uvs),
            normals: new Float32Array(binding.normals),
            texture: compiled.source.textures[0],
            textureKey,
          }
        : surface;
    }),
  };
}
const fail = (test, reason) => {
  if (!test) throw new TypeError(reason);
};
const fields = (v, keys) =>
  v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((key) => Object.hasOwn(v, key));
const integer = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;

/** Includes all RGBA8 mip levels, even when a sampler does not use them. */
export function indexedTextureBytes(texture) {
  fail(
    [texture.width, texture.height].every((v) => integer(v, 1, 512)),
    'Invalid texture accounting dimensions',
  );
  let width = texture.width,
    height = texture.height,
    bytes = 0;
  do {
    bytes += width * height * 4;
    if (width === 1 && height === 1) break;
    width = Math.max(1, Math.floor(width / 2));
    height = Math.max(1, Math.floor(height / 2));
  } while (true);
  return bytes;
}

export function validateIndexedSceneryCell(input) {
  if (input && typeof input === 'object' && validatedSources.has(input)) return input;
  const json = typeof input === 'string' ? input : JSON.stringify(input);
  fail(
    typeof json === 'string' &&
      new TextEncoder().encode(json).length <= INDEXED_SCENERY_LIMITS.jsonBytes,
    'Indexed scenery exceeds source allowance',
  );
  const source = JSON.parse(json);
  fail(
    fields(source, ['format', 'cell', 'textures', 'bindings']) &&
      source.format === INDEXED_SCENERY_FORMAT,
    'Invalid indexed scenery envelope',
  );
  const cell = validateSceneryCell(source.cell);
  fail(
    Array.isArray(source.textures) && source.textures.length === 1,
    'Exactly one bounded palette texture required',
  );
  const texture = source.textures[0];
  fail(
    fields(texture, [
      'id',
      'width',
      'height',
      'paletteRgb',
      'indicesBase64',
      'magFilter',
      'minFilter',
      'wrapS',
      'wrapT',
    ]),
    'Unexpected texture fields',
  );
  fail(
    typeof texture.id === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(texture.id),
    'Invalid texture identity',
  );
  fail(
    [texture.width, texture.height].every((v) => integer(v, 1, 512) && (v & (v - 1)) === 0),
    'Texture dimensions must be bounded powers of two',
  );
  fail(
    Array.isArray(texture.paletteRgb) &&
      texture.paletteRgb.length >= 3 &&
      texture.paletteRgb.length <= 768 &&
      texture.paletteRgb.length % 3 === 0 &&
      texture.paletteRgb.every((v) => integer(v, 0, 255)),
    'Invalid opaque RGB palette',
  );
  fail(
    typeof texture.indicesBase64 === 'string' &&
      texture.indicesBase64.length === Math.ceil((texture.width * texture.height) / 3) * 4 &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(texture.indicesBase64),
    'Invalid palette index encoding',
  );
  let decoded;
  try {
    decoded = atob(texture.indicesBase64);
  } catch {
    throw new TypeError('Invalid palette index encoding');
  }
  fail(
    decoded.length === texture.width * texture.height && btoa(decoded) === texture.indicesBase64,
    'Noncanonical palette index encoding',
  );
  for (let i = 0; i < decoded.length; i++)
    fail(decoded.charCodeAt(i) < texture.paletteRgb.length / 3, 'Palette index out of range');
  fail(
    [9728, 9729].includes(texture.magFilter) &&
      [9728, 9729, 9984, 9985, 9986, 9987].includes(texture.minFilter) &&
      [33071, 33648, 10497].includes(texture.wrapS) &&
      [33071, 33648, 10497].includes(texture.wrapT),
    'Unsupported texture sampler',
  );
  fail(
    indexedTextureBytes(texture) <= INDEXED_SCENERY_LIMITS.decodedTextureBytes,
    'Texture decode budget exceeded',
  );
  fail(
    Array.isArray(source.bindings) &&
      source.bindings.length > 0 &&
      source.bindings.length <= cell.surfaces.length,
    'Invalid texture binding count',
  );
  const ids = new Set(),
    bySurface = new Map(cell.surfaces.map((s) => [s.id, s]));
  for (const binding of source.bindings) {
    fail(
      fields(binding, ['surfaceId', 'textureId', 'uvs', 'normals']),
      'Unexpected texture binding fields',
    );
    const surface = bySurface.get(binding.surfaceId);
    fail(
      surface && !ids.has(binding.surfaceId) && binding.textureId === texture.id,
      'Invalid or duplicate texture binding',
    );
    ids.add(binding.surfaceId);
    fail(
      Array.isArray(binding.uvs) &&
        binding.uvs.length === (surface.positionsMm.length / 3) * 2 &&
        binding.uvs.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 16),
      'Invalid texture coordinates',
    );
    fail(
      Array.isArray(binding.normals) &&
        binding.normals.length === surface.positionsMm.length &&
        binding.normals.every(
          (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1.00001,
        ),
      'Invalid authored normals',
    );
    for (let i = 0; i < binding.normals.length; i += 3)
      fail(
        Math.abs(Math.hypot(...binding.normals.slice(i, i + 3)) - 1) <= 0.001,
        'Authored normal must be unit length',
      );
    Object.freeze(binding.uvs);
    Object.freeze(binding.normals);
    Object.freeze(binding);
  }
  Object.freeze(texture.paletteRgb);
  Object.freeze(texture);
  Object.freeze(source.textures);
  Object.freeze(source.bindings);
  const result = Object.freeze({ ...source, cell });
  validatedSources.add(result);
  return result;
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
/** Exact indexed texels; deterministic PNG with bounded uncompressed deflate blocks. */
function encodeIndexedTexture(texture) {
  const pixels = Uint8Array.from(atob(texture.indicesBase64), (c) => c.charCodeAt(0));
  const raw = new Uint8Array((texture.width + 1) * texture.height);
  for (let y = 0; y < texture.height; y++)
    raw.set(
      pixels.subarray(y * texture.width, (y + 1) * texture.width),
      y * (texture.width + 1) + 1,
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
  ihdr[9] = 3;
  return join([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('PLTE', new Uint8Array(texture.paletteRgb)),
    pngChunk('IDAT', join(parts)),
    pngChunk('IEND', new Uint8Array()),
  ]);
}

export function compileIndexedSceneryCell(input) {
  const source = validateIndexedSceneryCell(input),
    compiled = compileSceneryCell(source.cell);
  const baseHeader = new DataView(compiled.glb.buffer),
    jsonLength = baseHeader.getUint32(12, true);
  const document = JSON.parse(new TextDecoder().decode(compiled.glb.subarray(20, 20 + jsonLength)));
  document.asset.generator = 'FPV indexed scenery authoring compiler v1';
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
    document.materials[i].pbrMetallicRoughness.baseColorTexture = { index: 0 };
  }
  const texture = source.textures[0],
    png = encodeIndexedTexture(texture);
  document.images = [{ bufferView: append(png), mimeType: 'image/png', name: texture.id }];
  document.samplers = [
    {
      magFilter: texture.magFilter,
      minFilter: texture.minFilter,
      wrapS: texture.wrapS,
      wrapT: texture.wrapT,
    },
  ];
  document.textures = [{ source: 0, sampler: 0 }];
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
  fail(
    glb.length <= INDEXED_SCENERY_LIMITS.sceneBytes,
    'Indexed scene exceeds existing GLB allowance',
  );
  return {
    source,
    ...compiled,
    glb,
    textureBytes: indexedTextureBytes(texture),
    attributeBytes: source.bindings.reduce((n, b) => n + (b.uvs.length + b.normals.length) * 4, 0),
  };
}
