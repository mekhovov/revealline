/** Explicit colour-only scenery profile. No external textures, animations or player admission. */
export const SCENERY_FORMAT = 'FPVRegionScenery.v1';
export const SCENERY_LIMITS = Object.freeze({
  jsonBytes: 1024 * 1024,
  sceneBytes: 512 * 1024,
  surfaces: 128,
  vertices: 8192,
  indices: 24576,
  geometryBytes: 512 * 1024,
});
const fail = (condition, message) => {
  if (!condition) throw new TypeError(message);
};
const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
const fields = (value, names) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === names.length &&
  names.every((name) => Object.hasOwn(value, name));

export function validateSceneryCell(input) {
  const json = typeof input === 'string' ? input : JSON.stringify(input);
  fail(
    typeof json === 'string' && new TextEncoder().encode(json).length <= SCENERY_LIMITS.jsonBytes,
    'Scenery source exceeds decode allowance',
  );
  const cell = JSON.parse(json);
  fail(
    fields(cell, ['format', 'chunkId', 'x', 'z', 'cellSizeMm', 'surfaces']),
    'Unexpected scenery fields',
  );
  fail(
    cell.format === SCENERY_FORMAT &&
      typeof cell.chunkId === 'string' &&
      /^[a-z][a-z0-9-]{0,63}$/.test(cell.chunkId),
    'Invalid scenery identity',
  );
  fail(
    integer(cell.x, -128, 255) && integer(cell.z, -128, 255) && cell.cellSizeMm === 128000,
    'Invalid scenery cell',
  );
  fail(
    Array.isArray(cell.surfaces) &&
      cell.surfaces.length > 0 &&
      cell.surfaces.length <= SCENERY_LIMITS.surfaces,
    'Invalid scenery surface count',
  );
  const ids = new Set();
  let vertices = 0,
    indices = 0;
  for (const surface of cell.surfaces) {
    fail(
      fields(surface, ['id', 'positionsMm', 'indices', 'color']),
      'Unexpected scenery surface fields',
    );
    fail(
      typeof surface.id === 'string' &&
        /^[a-z][a-z0-9-]{0,63}$/.test(surface.id) &&
        !ids.has(surface.id),
      'Invalid or duplicate scenery surface',
    );
    ids.add(surface.id);
    fail(
      Array.isArray(surface.color) &&
        surface.color.length === 3 &&
        surface.color.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1),
      'Invalid scenery colour',
    );
    const p = surface.positionsMm,
      ix = surface.indices;
    fail(
      Array.isArray(p) &&
        p.length >= 9 &&
        p.length % 3 === 0 &&
        p.length <= SCENERY_LIMITS.vertices * 3,
      'Invalid scenery positions',
    );
    fail(
      p.every((v, i) => integer(v, i % 3 === 1 ? -2000000 : 0, i % 3 === 1 ? 2000000 : 128000)),
      'Scenery exceeds cell ownership',
    );
    fail(
      Array.isArray(ix) &&
        ix.length >= 3 &&
        ix.length % 3 === 0 &&
        ix.length <= SCENERY_LIMITS.indices &&
        ix.every((i) => integer(i, 0, p.length / 3 - 1)),
      'Invalid scenery triangles',
    );
    vertices += p.length / 3;
    indices += ix.length;
    fail(
      vertices <= SCENERY_LIMITS.vertices && indices <= SCENERY_LIMITS.indices,
      'Scenery complexity allowance exceeded',
    );
    for (let i = 0; i < ix.length; i += 3) {
      const a = ix[i] * 3,
        b = ix[i + 1] * 3,
        c = ix[i + 2] * 3;
      const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]],
        v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
      fail(
        u[1] * v[2] - u[2] * v[1] !== 0 ||
          u[2] * v[0] - u[0] * v[2] !== 0 ||
          u[0] * v[1] - u[1] * v[0] !== 0,
        'Degenerate scenery triangle',
      );
    }
    Object.freeze(p);
    Object.freeze(ix);
    Object.freeze(surface.color);
    Object.freeze(surface);
  }
  Object.freeze(cell.surfaces);
  return Object.freeze(cell);
}

export function sceneryGeometryBytes(cell) {
  return cell.surfaces.reduce((sum, s) => sum + s.positionsMm.length * 8 + s.indices.length * 4, 0);
}

/** Millimetre-quantized positions and the same triangles feed both GLB and physics. */
export function compileSceneryCell(input) {
  const cell = validateSceneryCell(input);
  const surfaces = cell.surfaces.map((s) => ({
    id: s.id,
    color: s.color,
    positions: new Float32Array(s.positionsMm.map((n) => n / 1000)),
    indices: new Uint32Array(s.indices),
  }));
  const byteLength = surfaces.reduce(
    (n, s) => n + s.positions.byteLength + s.indices.byteLength,
    0,
  );
  const binary = new Uint8Array(byteLength),
    view = new DataView(binary.buffer);
  const document = {
    asset: { version: '2.0', generator: 'FPV regional scenery compiler v1' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: cell.chunkId, mesh: 0 }],
    meshes: [{ primitives: [] }],
    materials: [],
    buffers: [{ byteLength }],
    bufferViews: [],
    accessors: [],
  };
  let offset = 0;
  for (const s of surfaces) {
    const accessor = document.accessors.length,
      material = document.materials.length;
    const bounds = [0, 1, 2].map((axis) =>
      Array.from(s.positions).filter((_, i) => i % 3 === axis),
    );
    for (const [array, target] of [
      [s.positions, 34962],
      [s.indices, 34963],
    ]) {
      document.bufferViews.push({
        buffer: 0,
        byteOffset: offset,
        byteLength: array.byteLength,
        target,
      });
      array.forEach((v, i) =>
        target === 34962
          ? view.setFloat32(offset + i * 4, v, true)
          : view.setUint32(offset + i * 4, v, true),
      );
      offset += array.byteLength;
    }
    document.accessors.push(
      {
        bufferView: accessor,
        componentType: 5126,
        count: s.positions.length / 3,
        type: 'VEC3',
        min: bounds.map((a) => Math.min(...a)),
        max: bounds.map((a) => Math.max(...a)),
      },
      { bufferView: accessor + 1, componentType: 5125, count: s.indices.length, type: 'SCALAR' },
    );
    document.materials.push({
      name: s.id,
      pbrMetallicRoughness: {
        baseColorFactor: [...s.color, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
      doubleSided: true,
    });
    document.meshes[0].primitives.push({
      attributes: { POSITION: accessor },
      indices: accessor + 1,
      mode: 4,
      material,
    });
  }
  const json = new TextEncoder().encode(JSON.stringify(document)),
    padded = Math.ceil(json.length / 4) * 4;
  const glb = new Uint8Array(28 + padded + binary.length),
    header = new DataView(glb.buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, glb.length, true);
  header.setUint32(12, padded, true);
  header.setUint32(16, 0x4e4f534a, true);
  glb.fill(32, 20, 20 + padded);
  glb.set(json, 20);
  header.setUint32(20 + padded, binary.length, true);
  header.setUint32(24 + padded, 0x004e4942, true);
  glb.set(binary, 28 + padded);
  fail(
    glb.length <= SCENERY_LIMITS.sceneBytes &&
      sceneryGeometryBytes(cell) <= SCENERY_LIMITS.geometryBytes,
    'Compiled scenery exceeds allowance',
  );
  return { cell, surfaces, glb };
}
