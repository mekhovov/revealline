import { REGION_CELL_SIZES_MM } from "./region-manifest.mjs";
/** Terrain-only authoring contract. No caves, overhangs, scenery or flight admission. */
export const TERRAIN_FORMAT = "FPVRegionCollision.v1";
export const TERRAIN_SAMPLES = 33;
const COUNT = TERRAIN_SAMPLES ** 2;
const fail = (condition, message) => {
  if (!condition) throw new TypeError(message);
};
const integer = (value, min, max) =>
  Number.isSafeInteger(value) && value >= min && value <= max;

export function validateTerrainCell(input) {
  const json = typeof input === "string" ? input : JSON.stringify(input);
  fail(
    typeof json === "string" && new TextEncoder().encode(json).length <= 16384,
    "Terrain source exceeds 16 KiB",
  );
  const cell = JSON.parse(json);
  const fields = [
    "format",
    "chunkId",
    "x",
    "z",
    "cellSizeMm",
    "samples",
    "heightsMm",
  ];
  fail(
    cell &&
      Object.keys(cell).length === fields.length &&
      fields.every((key) => Object.hasOwn(cell, key)),
    "Unexpected terrain fields",
  );
  fail(
    cell.format === TERRAIN_FORMAT &&
      /^[a-z][a-z0-9-]{0,63}$/.test(cell.chunkId),
    "Invalid terrain identity",
  );
  fail(
    integer(cell.x, -128, 255) && integer(cell.z, -128, 255),
    "Invalid terrain cell coordinate",
  );
  fail(
    REGION_CELL_SIZES_MM.includes(cell.cellSizeMm) &&
      cell.samples === TERRAIN_SAMPLES,
    "Unsupported terrain lattice",
  );
  fail(
    Array.isArray(cell.heightsMm) &&
      cell.heightsMm.length === COUNT &&
      cell.heightsMm.every((value) => integer(value, -2000000, 2000000)),
    "Terrain needs 1089 bounded integer heights",
  );
  Object.freeze(cell.heightsMm);
  return Object.freeze(cell);
}

/** Exact integer equality, including shared corners. Only neighbouring supplied cells are compared. */
export function validateTerrainSeams(inputs) {
  fail(
    Array.isArray(inputs) && inputs.length > 0 && inputs.length <= 25,
    "Terrain window needs 1–25 cells",
  );
  const cells = inputs.map(validateTerrainCell),
    byCell = new Map(),
    ids = new Set();
  for (const cell of cells) {
    fail(cell.cellSizeMm === cells[0].cellSizeMm, "Mixed terrain cell sizes");
    const key = `${cell.x},${cell.z}`;
    fail(
      !byCell.has(key) && !ids.has(cell.chunkId),
      "Duplicate terrain cell or id",
    );
    byCell.set(key, cell);
    ids.add(cell.chunkId);
  }
  for (const cell of cells) {
    const right = byCell.get(`${cell.x + 1},${cell.z}`),
      next = byCell.get(`${cell.x},${cell.z + 1}`);
    for (let i = 0; i < 33; i++) {
      if (right)
        fail(
          cell.heightsMm[i * 33 + 32] === right.heightsMm[i * 33],
          "Terrain X seam mismatch",
        );
      if (next)
        fail(
          cell.heightsMm[32 * 33 + i] === next.heightsMm[i],
          "Terrain Z seam mismatch",
        );
    }
  }
  return Object.freeze(cells);
}

/** One shared triangulation for the visible surface and Rapier. Coordinates local to cell corner, metres. */
export function compileTerrainCell(input) {
  const cell = validateTerrainCell(input);
  const spacing = cell.cellSizeMm / 32000;
  const positions = new Float32Array(COUNT * 3),
    indices = new Uint32Array(32 * 32 * 6);
  for (let z = 0; z < 33; z++)
    for (let x = 0; x < 33; x++) {
      const i = z * 33 + x;
      positions.set(
        [x * spacing, cell.heightsMm[i] / 1000, z * spacing],
        i * 3,
      );
    }
  let offset = 0;
  for (let z = 0; z < 32; z++)
    for (let x = 0; x < 32; x++) {
      const a = z * 33 + x,
        b = a + 1,
        c = a + 33,
        d = c + 1;
      indices.set([a, c, b, b, c, d], offset);
      offset += 6;
    }
  return { cell, positions, indices, glb: encodeGlb(cell, positions, indices) };
}

function encodeGlb(cell, positions, indices) {
  const binary = new Uint8Array(positions.byteLength + indices.byteLength),
    view = new DataView(binary.buffer);
  positions.forEach((value, i) => view.setFloat32(i * 4, value, true));
  indices.forEach((value, i) =>
    view.setUint32(positions.byteLength + i * 4, value, true),
  );
  const minHeight = Math.min(...positions.filter((_, i) => i % 3 === 1)),
    maxHeight = Math.max(...positions.filter((_, i) => i % 3 === 1));
  const document = {
    asset: { version: "2.0", generator: "FPV regional terrain compiler v1" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: cell.chunkId, mesh: 0 }],
    meshes: [
      {
        primitives: [
          { attributes: { POSITION: 0 }, indices: 1, mode: 4, material: 0 },
        ],
      },
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [0.32, 0.38, 0.23, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      },
    ],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: positions.byteLength,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: positions.byteLength,
        byteLength: indices.byteLength,
        target: 34963,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: COUNT,
        type: "VEC3",
        min: [0, minHeight, 0],
        max: [cell.cellSizeMm / 1000, maxHeight, cell.cellSizeMm / 1000],
      },
      {
        bufferView: 1,
        componentType: 5125,
        count: indices.length,
        type: "SCALAR",
      },
    ],
  };
  const json = new TextEncoder().encode(JSON.stringify(document)),
    padded = Math.ceil(json.length / 4) * 4;
  const result = new Uint8Array(12 + 8 + padded + 8 + binary.length),
    header = new DataView(result.buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, result.length, true);
  header.setUint32(12, padded, true);
  header.setUint32(16, 0x4e4f534a, true);
  result.fill(32, 20, 20 + padded);
  result.set(json, 20);
  header.setUint32(20 + padded, binary.length, true);
  header.setUint32(24 + padded, 0x004e4942, true);
  result.set(binary, 28 + padded);
  return result;
}
