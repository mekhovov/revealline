import { createRegionMotionQuery, createRegionFlightSupportQuery } from './region-motion-query.mjs';
import * as THREE from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
import RAPIER from '../../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';
import { validateRegionManifest } from './region-manifest.mjs';
import { compileSceneryCell, validateSceneryCell, sceneryGeometryBytes } from './scenery-cell.mjs';
import { initWorldRuntime } from '../../../optional-practice/civilian-fpv/world-collision.mjs';

import { createScenerySurface, validateScenerySurface } from './scenery-surface.mjs';

const fail = (condition, message) => {
  if (!condition) throw new TypeError(message);
};
const integerPosition = (position) =>
  position &&
  ['x', 'y', 'z'].every(
    (axis) => Number.isSafeInteger(position[axis]) && Math.abs(position[axis]) <= 100000000,
  );

/** Detached authoring preview and isolated scenery query world. Never attaches to the SIM. */
export async function prepareSceneryWindow(
  manifestInput,
  cellsInput,
  {
    requiredChunkIds,
    originMm = { x: 0, y: 0, z: 0 },
    maxGeometryBytes = 8 * 1024 * 1024,
    surfaceStyle = 'plain',
  } = {},
) {
  fail(
    Array.isArray(cellsInput) && cellsInput.length > 0 && cellsInput.length <= 25,
    'Scenery needs 1–25 cells',
  );
  validateScenerySurface(surfaceStyle);
  const manifest = validateRegionManifest(manifestInput),
    cells = cellsInput.map(validateSceneryCell);
  fail(integerPosition(originMm), 'Invalid local origin');
  originMm = Object.freeze({ ...originMm });
  fail(
    Number.isSafeInteger(maxGeometryBytes) &&
      maxGeometryBytes > 0 &&
      maxGeometryBytes <= 8 * 1024 * 1024,
    'Invalid geometry allowance',
  );
  fail(
    Array.isArray(requiredChunkIds) &&
      requiredChunkIds.length > 0 &&
      requiredChunkIds.length <= 25 &&
      new Set(requiredChunkIds).size === requiredChunkIds.length,
    'Explicit required chunk ids needed',
  );
  const chunks = new Map(manifest.chunks.map((chunk) => [chunk.id, chunk]));
  const byCell = new Map(cells.map((cell) => [`${cell.x},${cell.z}`, cell]));
  for (const cell of cells) {
    const chunk = chunks.get(cell.chunkId);
    fail(chunk && chunk.x === cell.x && chunk.z === cell.z, 'Scenery does not match manifest cell');
    fail(
      cell.surfaces.every((surface) =>
        surface.positionsMm.every(
          (v, i) => i % 3 !== 1 || (v >= manifest.grid.floorMm && v <= manifest.grid.ceilingMm),
        ),
      ),
      'Scenery exceeds region vertical bounds',
    );
    fail(
      Math.abs(cell.x * 128000 - originMm.x) <= 640000 &&
        Math.abs(cell.z * 128000 - originMm.z) <= 640000 &&
        Math.abs(originMm.y) <= 2000000,
      'Scenery window must use a nearby origin',
    );
  }
  const suppliedIds = new Set(cells.map((cell) => cell.chunkId));
  fail(
    suppliedIds.size === cells.length && byCell.size === cells.length,
    'Duplicate scenery cells',
  );
  fail(
    requiredChunkIds.every((id) => suppliedIds.has(id)),
    'Required scenery missing',
  );
  // Positions, indices and Three-generated normals; excludes engine internals and temporary GLB buffers.
  const geometryBytes = cells.reduce((sum, cell) => sum + sceneryGeometryBytes(cell), 0);
  fail(geometryBytes <= maxGeometryBytes, 'Scenery geometry budget exceeded');
  await initWorldRuntime();
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    group = new THREE.Group(),
    geometries = [];
  const materials = [],
    byColor = new Map();
  const colliderIds = new Map();
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    group.clear();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    world.free();
    byColor.clear();
    colliderIds.clear();
    byCell.clear();
  }
  try {
    for (const cell of cells) {
      for (const surface of compileSceneryCell(cell).surfaces) {
        const { positions, indices } = surface;
        const key = surface.color.join(',');
        let material = byColor.get(key);
        if (!material) {
          material = createScenerySurface({ style: surfaceStyle, color: surface.color, originMm });
          byColor.set(key, material);
          materials.push(material);
        }
        const geometry = new THREE.BufferGeometry();
        geometries.push(geometry);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = cell.chunkId;
        const local = {
          x: (cell.x * 128000 - originMm.x) / 1000,
          y: -originMm.y / 1000,
          z: (cell.z * 128000 - originMm.z) / 1000,
        };
        mesh.position.set(local.x, local.y, local.z);
        group.add(mesh);
        const collider = world.createCollider(
          RAPIER.ColliderDesc.trimesh(positions, indices).setTranslation(local.x, local.y, local.z),
        );
        colliderIds.set(collider.handle, cell.chunkId);
      }
    }
    world.step();
    group.updateMatrixWorld(true);
  } catch (error) {
    dispose();
    throw error;
  }
  const live = () => fail(!disposed, 'Scenery window disposed');
  const local = (point) => ({
    x: (point.x - originMm.x) / 1000,
    y: (point.y - originMm.y) / 1000,
    z: (point.z - originMm.z) / 1000,
  });
  function covers(from, to = from, radius = 0) {
    // Conservatively require the full swept horizontal AABB. A missing cell is never clear scenery.
    const minX = Math.floor((Math.min(from.x, to.x) - radius) / 128000),
      maxX = Math.floor((Math.max(from.x, to.x) + radius) / 128000);
    const minZ = Math.floor((Math.min(from.z, to.z) - radius) / 128000),
      maxZ = Math.floor((Math.max(from.z, to.z) + radius) / 128000);
    if ((maxX - minX + 1) * (maxZ - minZ + 1) > 25) return false;
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++) if (!byCell.has(`${x},${z}`)) return false;
    return true;
  }
  return Object.freeze({
    flightSupport: createRegionFlightSupportQuery({
      world,
      local,
      covers,
      colliderIds,
      layer: 'scenery',
      live,
      originYMm: originMm.y,
    }),
    castMotion: createRegionMotionQuery({
      world,
      local,
      covers,
      colliderIds,
      layer: 'scenery',
      live,
    }),
    group,
    snapshot: () => ({
      sceneryPrepared: !disposed,
      flightReady: false,
      disposed,
      cells: disposed ? 0 : cells.length,
      geometryBytes: disposed ? 0 : geometryBytes,
      meshes: disposed ? 0 : geometries.length,
      colliders: colliderIds.size,
      materials: disposed ? 0 : materials.length,
    }),
    support(positionMm, maxDropMm = 10000) {
      live();
      fail(
        integerPosition(positionMm) &&
          Number.isSafeInteger(maxDropMm) &&
          maxDropMm > 0 &&
          maxDropMm <= 4000000,
        'Invalid support query',
      );
      if (!covers(positionMm)) return { status: 'unknown-cell' };
      const hit = world.castRayAndGetNormal(
        new RAPIER.Ray(local(positionMm), { x: 0, y: -1, z: 0 }),
        maxDropMm / 1000,
        true,
      );
      if (!hit) return { status: 'no-support' };
      return {
        status: 'scenery-hit',
        chunkId: colliderIds.get(hit.collider.handle),
        heightMm: positionMm.y - hit.timeOfImpact * 1000,
        normal: { ...hit.normal },
      };
    },
    overlap(positionMm, radiusMm = 200) {
      live();
      fail(
        integerPosition(positionMm) &&
          Number.isSafeInteger(radiusMm) &&
          radiusMm > 0 &&
          radiusMm <= 2000,
        'Invalid overlap query',
      );
      if (!covers(positionMm, positionMm, radiusMm)) return { status: 'unknown-cell' };
      const hit = world.intersectionWithShape(
        local(positionMm),
        { x: 0, y: 0, z: 0, w: 1 },
        new RAPIER.Ball(radiusMm / 1000),
      );
      return { status: hit ? 'scenery-hit' : 'scenery-clear' };
    },
    sweep(fromMm, toMm, radiusMm = 200) {
      live();
      fail(
        integerPosition(fromMm) &&
          integerPosition(toMm) &&
          Number.isSafeInteger(radiusMm) &&
          radiusMm > 0 &&
          radiusMm <= 2000,
        'Invalid sweep query',
      );
      if (!covers(fromMm, toMm, radiusMm)) return { status: 'unknown-cell' };
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
            status: 'scenery-hit',
            chunkId: colliderIds.get(hit.collider.handle),
            fraction: hit.time_of_impact,
          }
        : { status: 'scenery-clear' };
    },
    dispose,
  });
}
