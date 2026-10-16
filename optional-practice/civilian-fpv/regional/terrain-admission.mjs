import {
  createRegionMotionQuery,
  createRegionFlightSupportQuery,
} from "./region-motion-query.mjs";
import * as THREE from "../vendor/three.module.js";
import RAPIER from "../vendor/rapier/rapier.mjs";
import { validateRegionManifest, regionalOriginReachMm, REGION_FORMAT } from "./region-manifest.mjs";
import { compileTerrainCell, validateTerrainSeams } from "./terrain-cell.mjs";
import {
  createTerrainSurface,
  validateTerrainSurface,
} from "./terrain-surface.mjs";
import { createTerrainNormals } from "./terrain-normals.mjs";
import { initWorldRuntime } from "../world-collision.mjs";

const fail = (condition, message) => {
  if (!condition) throw new TypeError(message);
};
const integerPosition = (position) =>
  position &&
  ["x", "y", "z"].every(
    (axis) =>
      Number.isSafeInteger(position[axis]) &&
      Math.abs(position[axis]) <= 100000000,
  );
const finitePosition = (position) =>
  position &&
  ["x", "y", "z"].every(
    (axis) =>
      Number.isFinite(position[axis]) && Math.abs(position[axis]) <= 100000000,
  );

/** Detached authoring preview and isolated terrain query world. Never attaches to the SIM. */
export async function prepareTerrainWindow(
  manifestInput,
  cellsInput,
  {
    requiredChunkIds,
    originMm = { x: 0, y: 0, z: 0 },
    maxGeometryBytes = 2 * 1024 * 1024,
    surfaceStyle = "plain",
    surfaceQuality = "balanced",
  } = {},
) {
  const manifest = validateRegionManifest(manifestInput),
    cells = validateTerrainSeams(cellsInput);
  fail(manifest.format === REGION_FORMAT, 'Terrain requires the complete terrain manifest profile');
  const surface = validateTerrainSurface(surfaceStyle, surfaceQuality);
  fail(integerPosition(originMm), "Invalid local origin");
  originMm = Object.freeze({ ...originMm });
  fail(
    Number.isSafeInteger(maxGeometryBytes) &&
      maxGeometryBytes > 0 &&
      maxGeometryBytes <= 2 * 1024 * 1024,
    "Invalid geometry allowance",
  );
  fail(
    Array.isArray(requiredChunkIds) &&
      requiredChunkIds.length > 0 &&
      requiredChunkIds.length <= 25 &&
      new Set(requiredChunkIds).size === requiredChunkIds.length,
    "Explicit required chunk ids needed",
  );
  const chunks = new Map(manifest.chunks.map((chunk) => [chunk.id, chunk]));
  const byCell = new Map(cells.map((cell) => [`${cell.x},${cell.z}`, cell]));
  for (const cell of cells) {
    const chunk = chunks.get(cell.chunkId);
    fail(
      chunk &&
        chunk.x === cell.x &&
        chunk.z === cell.z &&
        cell.cellSizeMm === manifest.grid.cellSizeMm,
      "Terrain does not match manifest cell",
    );
    fail(
      cell.heightsMm.every(
        (h) => h >= manifest.grid.floorMm && h <= manifest.grid.ceilingMm,
      ),
      "Terrain exceeds region vertical bounds",
    );
    fail(
      Math.abs(cell.x * cell.cellSizeMm - originMm.x) <= regionalOriginReachMm(manifest.grid.cellSizeMm) &&
        Math.abs(cell.z * cell.cellSizeMm - originMm.z) <= regionalOriginReachMm(manifest.grid.cellSizeMm) &&
        Math.abs(originMm.y) <= 2000000,
      "Terrain window must use a nearby origin",
    );
  }
  const suppliedIds = new Set(cells.map((cell) => cell.chunkId));
  fail(
    requiredChunkIds.every((id) => suppliedIds.has(id)),
    "Required terrain missing",
  );
  // Positions, indices and shared-grid normals; excludes engine internals and temporary GLB buffers.
  const geometryBytes = cells.length * (1089 * 3 * 4 * 2 + 32 * 32 * 6 * 4);
  fail(geometryBytes <= maxGeometryBytes, "Terrain geometry budget exceeded");
  await initWorldRuntime();
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    group = new THREE.Group(),
    geometries = [];
  const material = createTerrainSurface({ ...surface, originMm });
  const colliderIds = new Map();
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    group.clear();
    for (const geometry of geometries) geometry.dispose();
    material.dispose();
    world.free();
    colliderIds.clear();
    byCell.clear();
  }
  try {
    const normalsFor = createTerrainNormals(cells);
    for (const cell of cells) {
      const { positions, indices } = compileTerrainCell(cell);
      const geometry = new THREE.BufferGeometry();
      geometries.push(geometry);
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(normalsFor(cell), 3),
      );
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = cell.chunkId;
      const local = {
        x: (cell.x * cell.cellSizeMm - originMm.x) / 1000,
        y: -originMm.y / 1000,
        z: (cell.z * cell.cellSizeMm - originMm.z) / 1000,
      };
      mesh.position.set(local.x, local.y, local.z);
      group.add(mesh);
      const collider = world.createCollider(
        RAPIER.ColliderDesc.trimesh(positions, indices).setTranslation(
          local.x,
          local.y,
          local.z,
        ),
      );
      colliderIds.set(collider.handle, cell.chunkId);
    }
    world.step();
    group.updateMatrixWorld(true);
  } catch (error) {
    dispose();
    throw error;
  }
  const live = () => fail(!disposed, "Terrain window disposed");
  const local = (point) => ({
    x: (point.x - originMm.x) / 1000,
    y: (point.y - originMm.y) / 1000,
    z: (point.z - originMm.z) / 1000,
  });
  function covers(from, to = from, radius = 0) {
    // Conservatively require the full swept horizontal AABB. A missing cell is never clear terrain.
    const minX = Math.floor(
        (Math.min(from.x, to.x) - radius) / manifest.grid.cellSizeMm,
      ),
      maxX = Math.floor(
        (Math.max(from.x, to.x) + radius) / manifest.grid.cellSizeMm,
      );
    const minZ = Math.floor(
        (Math.min(from.z, to.z) - radius) / manifest.grid.cellSizeMm,
      ),
      maxZ = Math.floor(
        (Math.max(from.z, to.z) + radius) / manifest.grid.cellSizeMm,
      );
    if ((maxX - minX + 1) * (maxZ - minZ + 1) > 25) return false;
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++)
        if (!byCell.has(`${x},${z}`)) return false;
    return true;
  }
  return Object.freeze({
    flightSupport: createRegionFlightSupportQuery({
      world,
      local,
      covers,
      colliderIds,
      layer: "terrain",
      live,
      originYMm: originMm.y,
    }),
    castMotion: createRegionMotionQuery({
      world,
      local,
      covers,
      colliderIds,
      layer: "terrain",
      live,
    }),
    group,
    // Read actual Rapier sets only on explicit diagnostic demand, never after free().
    collisionSnapshot: () => ({
      worlds: disposed ? 0 : 1,
      colliders: disposed ? 0 : world.colliders.len(),
      rigidBodies: disposed ? 0 : world.bodies.len(),
    }),
    snapshot: () => ({
      terrainPrepared: !disposed,
      flightReady: false,
      disposed,
      cells: disposed ? 0 : cells.length,
      geometryBytes: disposed ? 0 : geometryBytes,
      surface,
    }),
    support(positionMm, maxDropMm = 10000) {
      live();
      fail(
        finitePosition(positionMm) &&
          Number.isSafeInteger(maxDropMm) &&
          maxDropMm > 0 &&
          maxDropMm <= 4000000,
        "Invalid support query",
      );
      if (!covers(positionMm)) return { status: "unknown-cell" };
      const hit = world.castRayAndGetNormal(
        new RAPIER.Ray(local(positionMm), { x: 0, y: -1, z: 0 }),
        maxDropMm / 1000,
        true,
      );
      if (!hit) return { status: "no-support" };
      return {
        status: "terrain-hit",
        chunkId: colliderIds.get(hit.collider.handle),
        heightMm: positionMm.y - hit.timeOfImpact * 1000,
        normal: { ...hit.normal },
      };
    },
    sweep(fromMm, toMm, radiusMm = 200) {
      live();
      fail(
        finitePosition(fromMm) &&
          finitePosition(toMm) &&
          Number.isSafeInteger(radiusMm) &&
          radiusMm > 0 &&
          radiusMm <= 2000,
        "Invalid sweep query",
      );
      if (!covers(fromMm, toMm, radiusMm)) return { status: "unknown-cell" };
      const from = local(fromMm),
        to = local(toMm),
        delta = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
      const hit = world.castShape(
        from,
        { x: 0, y: 0, z: 0, w: 1 },
        delta,
        new RAPIER.Ball(radiusMm / 1000),
        0,
        1,
        true,
      );
      return hit
        ? {
            status: "terrain-hit",
            chunkId: colliderIds.get(hit.collider.handle),
            fraction: hit.time_of_impact,
          }
        : { status: "terrain-clear" };
    },
    dispose,
  });
}
