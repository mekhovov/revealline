/** Supported authoring lattices; 256 m keeps 33 samples at 8 m spacing. */
export const REGION_CELL_SIZES_MM = Object.freeze([128000, 256000]);
/** Authoring-only regional data contract. Not a player format or a physics adapter. */
export const REGION_FORMAT = "FPVRegionManifest.v1";
// Only this distinct profile can declare known-empty scenery cells. Terrain stays v1.
export const SPARSE_SCENERY_FORMAT = "FPVSceneryManifest.v1";
export const REGION_LIMITS = Object.freeze({
  jsonBytes: 8 * 1024 * 1024,
  cellsPerAxis: 128,
  cellSizeMm: 128000,
  assets: 4096,
  assetBytes: 64 * 1024 * 1024,
  assetsPerChunk: 16,
  residentChunks: 25,
  residentSourceBytes: 256 * 1024 * 1024,
});
const axes = ["x", "y", "z"];
const fail = (condition, message) => {
  if (!condition) throw new TypeError(message);
};
const integer = (value, min, max) =>
  Number.isSafeInteger(value) && value >= min && value <= max;
const keys = (value, expected, label) => {
  fail(
    value && typeof value === "object" && !Array.isArray(value),
    `${label}: object required`,
  );
  fail(
    Object.keys(value).length === expected.length &&
      expected.every((key) => Object.hasOwn(value, key)),
    `${label}: unexpected or missing fields`,
  );
};
const id = (value) =>
  typeof value === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(value);
const cellKey = (x, z) => `${x},${z}`;
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const position = (value, integerOnly = true) => {
  keys(value, axes, "Position");
  fail(
    axes.every(
      (axis) =>
        Number.isFinite(value[axis]) &&
        Math.abs(value[axis]) <= 100000000 &&
        (!integerOnly || Number.isSafeInteger(value[axis])),
    ),
    integerOnly
      ? "Position needs bounded integer millimetres"
      : "Position needs bounded finite millimetres",
  );
};
const freeze = (value) => {
  for (const child of Object.values(value))
    if (child && typeof child === "object") freeze(child);
  return Object.freeze(value);
};

/** Returns a detached, frozen manifest; rejects incomplete grids and unresolved assets. */
export function validateRegionManifest(input) {
  const json = typeof input === "string" ? input : JSON.stringify(input);
  fail(
    typeof json === "string" &&
      new TextEncoder().encode(json).byteLength <= REGION_LIMITS.jsonBytes,
    "Region JSON exceeds authoring limit",
  );
  const value = JSON.parse(json);
  keys(
    value,
    ["format", "id", "revision", "title", "grid", "assets", "chunks", "spawns"],
    "Region",
  );
  fail(
    [REGION_FORMAT, SPARSE_SCENERY_FORMAT].includes(value.format) && id(value.id) && id(value.revision),
    "Invalid region identity",
  );
  keys(value.title, ["en", "uk"], "Title");
  fail(
    Object.values(value.title).every(
      (text) => typeof text === "string" && text.trim() && text.length <= 120,
    ),
    "Region needs EN/UK titles",
  );
  const grid = value.grid;
  keys(
    grid,
    ["cellSizeMm", "minX", "minZ", "width", "depth", "floorMm", "ceilingMm"],
    "Grid",
  );
  fail(REGION_CELL_SIZES_MM.includes(grid.cellSizeMm), "Unsupported cell size");
  fail(
    ["minX", "minZ"].every((key) => integer(grid[key], -128, 128)),
    "Invalid grid origin",
  );
  fail(
    ["width", "depth"].every((key) =>
      integer(grid[key], 1, REGION_LIMITS.cellsPerAxis),
    ),
    "Invalid grid extent",
  );
  fail(
    integer(grid.floorMm, -2000000, 2000000) &&
      integer(grid.ceilingMm, -2000000, 2000000) &&
      grid.floorMm < grid.ceilingMm,
    "Invalid vertical bounds",
  );
  fail(
    Array.isArray(value.assets) &&
      (value.assets.length > 0 || value.format === SPARSE_SCENERY_FORMAT) &&
      value.assets.length <= REGION_LIMITS.assets,
    "Invalid asset count",
  );
  const assetMap = new Map(),
    paths = new Set();
  for (const asset of value.assets) {
    keys(asset, ["id", "path", "sha256", "bytes", "kind"], "Asset");
    fail(
      id(asset.id) && !assetMap.has(asset.id),
      "Invalid or duplicate asset id",
    );
    fail(
      typeof asset.path === "string" &&
        asset.path.length <= 240 &&
        /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:glb|json|png|jpg|jpeg)$/.test(
          asset.path,
        ) &&
        !paths.has(asset.path.toLowerCase()),
      "Invalid or duplicate local asset path",
    );
    fail(
      typeof asset.sha256 === "string" && /^[a-f0-9]{64}$/.test(asset.sha256),
      "Invalid SHA-256",
    );
    fail(
      integer(asset.bytes, 1, REGION_LIMITS.assetBytes),
      "Invalid asset byte count",
    );
    fail(
      ["scene", "collision", "texture"].includes(asset.kind),
      "Unknown asset kind",
    );
    fail(
      asset.kind !== "scene" || asset.path.endsWith(".glb"),
      "Scene asset must be GLB",
    );
    fail(
      asset.kind !== "collision" || asset.path.endsWith(".json"),
      "Collision declaration must be JSON",
    );
    fail(
      asset.kind !== "texture" || /\.(png|jpe?g)$/.test(asset.path),
      "Texture asset must be PNG/JPEG",
    );
    assetMap.set(asset.id, asset);
    paths.add(asset.path.toLowerCase());
  }
  fail(
    Array.isArray(value.chunks) &&
      value.chunks.length === grid.width * grid.depth,
    "Grid must contain every cell exactly once",
  );
  const cells = new Set(),
    chunkIds = new Set(),
    usedAssets = new Set();
  for (const chunk of value.chunks) {
    keys(chunk, ["id", "x", "z", "assets"], "Chunk");
    fail(
      id(chunk.id) && !chunkIds.has(chunk.id),
      "Invalid or duplicate chunk id",
    );
    fail(
      integer(chunk.x, grid.minX, grid.minX + grid.width - 1) &&
        integer(chunk.z, grid.minZ, grid.minZ + grid.depth - 1),
      "Chunk outside grid",
    );
    const cell = cellKey(chunk.x, chunk.z);
    fail(!cells.has(cell), "Duplicate cell");
    fail(
      Array.isArray(chunk.assets) &&
        (chunk.assets.length >= 2 || (value.format === SPARSE_SCENERY_FORMAT && chunk.assets.length === 0)) &&
        chunk.assets.length <= REGION_LIMITS.assetsPerChunk &&
        new Set(chunk.assets).size === chunk.assets.length,
      "Invalid chunk assets",
    );
    fail(
      chunk.assets.every(
        (assetId) => typeof assetId === "string" && assetMap.has(assetId),
      ),
      "Unresolved asset reference",
    );
    fail(
      (value.format === SPARSE_SCENERY_FORMAT && chunk.assets.length === 0) || ["scene", "collision"].every((kind) =>
        chunk.assets.some((assetId) => assetMap.get(assetId).kind === kind),
      ),
      "Each cell needs explicit scene and collision declarations",
    );
    for (const assetId of chunk.assets) usedAssets.add(assetId);
    cells.add(cell);
    chunkIds.add(chunk.id);
  }
  fail(usedAssets.size === assetMap.size, "Unused assets are not admitted");
  fail(
    Array.isArray(value.spawns) &&
      value.spawns.length > 0 &&
      value.spawns.length <= 64,
    "Invalid spawn count",
  );
  const spawnIds = new Set();
  for (const spawn of value.spawns) {
    keys(spawn, ["id", "position"], "Spawn");
    fail(id(spawn.id) && !spawnIds.has(spawn.id), "Invalid or duplicate spawn");
    assertWithin(spawn.position, grid);
    spawnIds.add(spawn.id);
  }
  return freeze(value);
}

function assertWithin(point, grid, integerOnly = true) {
  position(point, integerOnly);
  fail(
    point.x >= grid.minX * grid.cellSizeMm &&
      point.x <= (grid.minX + grid.width) * grid.cellSizeMm &&
      point.z >= grid.minZ * grid.cellSizeMm &&
      point.z <= (grid.minZ + grid.depth) * grid.cellSizeMm &&
      point.y >= grid.floorMm &&
      point.y <= grid.ceilingMm,
    "Position outside region",
  );
}

/** Translation only: callers must separately migrate renderer/physics/actors together. */
export function regionToLocal(point, origin) {
  position(point, false);
  position(origin);
  return Object.fromEntries(
    axes.map((axis) => [axis, point[axis] - origin[axis]]),
  );
}
export function regionToGlobal(point, origin) {
  position(point, false);
  position(origin);
  const result = Object.fromEntries(
    axes.map((axis) => [axis, point[axis] + origin[axis]]),
  );
  position(result, false);
  return result;
}

/** Builds its bounded lookup once. Plans do not fetch assets or infer collision readiness. */
export function createRegionPlanner(input) {
  const manifest = validateRegionManifest(input),
    grid = manifest.grid;
  const cells = new Map(
    manifest.chunks.map((chunk) => [cellKey(chunk.x, chunk.z), chunk]),
  );
  const chunks = new Map(manifest.chunks.map((chunk) => [chunk.id, chunk]));
  const assets = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  return (
    point,
    { resident = [], maxSourceBytes = REGION_LIMITS.residentSourceBytes } = {},
  ) => {
    assertWithin(point, grid, false);
    fail(
      Array.isArray(resident) &&
        resident.length <= REGION_LIMITS.residentChunks &&
        new Set(resident).size === resident.length &&
        resident.every((chunkId) => chunks.has(chunkId)),
      "Invalid resident chunk set",
    );
    fail(
      integer(maxSourceBytes, manifest.format === SPARSE_SCENERY_FORMAT ? 0 : 1, REGION_LIMITS.residentSourceBytes),
      "Invalid source byte budget",
    );
    // The closed outer edge belongs to the last cell, never a nonexistent neighbour.
    const x = Math.min(
      grid.minX + grid.width - 1,
      Math.floor(point.x / grid.cellSizeMm),
    );
    const z = Math.min(
      grid.minZ + grid.depth - 1,
      Math.floor(point.z / grid.cellSizeMm),
    );
    const candidates = [];
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        const chunk = cells.get(cellKey(x + dx, z + dz));
        if (chunk)
          candidates.push({
            chunk,
            distance: Math.max(Math.abs(dx), Math.abs(dz)),
            squared: dx * dx + dz * dz,
          });
      }
    candidates.sort(
      (a, b) =>
        a.distance - b.distance ||
        a.squared - b.squared ||
        compare(a.chunk.id, b.chunk.id),
    );
    const required = candidates
      .filter((item) => item.distance <= 1)
      .map((item) => item.chunk);
    const selected = [...required],
      assetIds = new Set(required.flatMap((chunk) => chunk.assets));
    let sourceBytes = [...assetIds].reduce(
      (sum, assetId) => sum + assets.get(assetId).bytes,
      0,
    );
    if (sourceBytes > maxSourceBytes)
      return {
        blocked: "required-source-budget",
        requiredChunks: required.map((chunk) => chunk.id),
        requiredSourceBytes: sourceBytes,
        targetChunks: [],
        acquireChunks: [],
        releaseChunks: [],
        acquireAssets: [],
        releaseAssets: [],
      };
    for (const item of candidates.filter(
      (candidate) => candidate.distance > 1,
    )) {
      const extra = item.chunk.assets.filter(
        (assetId) => !assetIds.has(assetId),
      );
      const bytes = extra.reduce(
        (sum, assetId) => sum + assets.get(assetId).bytes,
        0,
      );
      if (sourceBytes + bytes <= maxSourceBytes) {
        selected.push(item.chunk);
        sourceBytes += bytes;
        for (const assetId of extra) assetIds.add(assetId);
      }
    }
    const selectedIds = new Set(selected.map((chunk) => chunk.id));
    const residentIds = new Set(resident),
      residentAssets = new Set(
        resident.flatMap((chunkId) => chunks.get(chunkId).assets),
      );
    return {
      blocked: null,
      origin: {
        x: x * grid.cellSizeMm + grid.cellSizeMm / 2,
        y: 0,
        z: z * grid.cellSizeMm + grid.cellSizeMm / 2,
      },
      requiredChunks: required.map((chunk) => chunk.id),
      targetChunks: [...selectedIds],
      sourceBytes,
      releaseChunks: resident
        .filter((chunkId) => !selectedIds.has(chunkId))
        .sort(compare),
      acquireChunks: [...selectedIds].filter(
        (chunkId) => !residentIds.has(chunkId),
      ),
      releaseAssets: [...residentAssets]
        .filter((assetId) => !assetIds.has(assetId))
        .sort(compare),
      acquireAssets: [...assetIds]
        .filter((assetId) => !residentAssets.has(assetId))
        .sort(compare),
    };
  };
}
