import { createRestoreContainment } from './restore-containment.mjs';
import {
  createRegionMotionQuery,
  createRegionMotionCoverageQuery,
  createRegionFlightSupportQuery,
} from './region-motion-query.mjs';
import * as THREE from '../vendor/three.module.js';
import RAPIER from '../vendor/rapier/rapier.mjs';
import {
  validateRegionManifest,
  regionalOriginReachMm,
  SPARSE_SCENERY_FORMAT,
} from './region-manifest.mjs';
import {
  validateScenerySource,
  scenerySourceCell,
  compileScenerySource,
  scenerySourceResources,
} from './indexed-scenery-cell.mjs';
import { initWorldRuntime } from '../world-collision.mjs';

import { createScenerySurface, validateScenerySurface, sceneryMaterialStyle } from './scenery-surface.mjs';

const fail = (condition, message) => {
  if (!condition) throw new TypeError(message);
};
const integerPosition = (position) =>
  position &&
  ['x', 'y', 'z'].every(
    (axis) => Number.isSafeInteger(position[axis]) && Math.abs(position[axis]) <= 100000000,
  );
const finitePosition = (position) =>
  position &&
  ['x', 'y', 'z'].every(
    (axis) => Number.isFinite(position[axis]) && Math.abs(position[axis]) <= 100000000,
  );

function createSceneryTexture(source) {
  let pixels;
  if (Object.hasOwn(source, 'rgbaBase64')) {
    pixels = Uint8Array.from(atob(source.rgbaBase64), (c) => c.charCodeAt(0));
  } else {
    const indices = atob(source.indicesBase64);
    pixels = new Uint8Array(indices.length * 4);
    for (let i = 0; i < indices.length; i++) {
      const palette = indices.charCodeAt(i) * 3;
      pixels[i * 4] = source.paletteRgb[palette];
      pixels[i * 4 + 1] = source.paletteRgb[palette + 1];
      pixels[i * 4 + 2] = source.paletteRgb[palette + 2];
      pixels[i * 4 + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(
    pixels,
    source.width,
    source.height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  const filters = new Map([
    [9728, THREE.NearestFilter],
    [9729, THREE.LinearFilter],
    [9984, THREE.NearestMipmapNearestFilter],
    [9985, THREE.LinearMipmapNearestFilter],
    [9986, THREE.NearestMipmapLinearFilter],
    [9987, THREE.LinearMipmapLinearFilter],
  ]);
  const wraps = new Map([
    [33071, THREE.ClampToEdgeWrapping],
    [33648, THREE.MirroredRepeatWrapping],
    [10497, THREE.RepeatWrapping],
  ]);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.generateMipmaps = source.minFilter >= 9984;
  texture.magFilter = filters.get(source.magFilter);
  texture.minFilter = filters.get(source.minFilter);
  texture.wrapS = wraps.get(source.wrapS);
  texture.wrapT = wraps.get(source.wrapT);
  texture.name = source.id;
  texture.needsUpdate = true;
  return texture;
}

/** Detached authoring preview and isolated scenery query world. Never attaches to the SIM. */
export async function prepareSceneryWindow(
  manifestInput,
  cellsInput,
  {
    requiredChunkIds,
    originMm = { x: 0, y: 0, z: 0 },
    maxGeometryBytes = 8 * 1024 * 1024,
    surfaceStyle = 'plain',
    surfaceQuality = 'balanced',
  } = {},
) {
  const manifest = validateRegionManifest(manifestInput),
    sparse = manifest.format === SPARSE_SCENERY_FORMAT;
  fail(
    Array.isArray(cellsInput) && (cellsInput.length > 0 || sparse) && cellsInput.length <= 25,
    'Scenery needs 1–25 cells',
  );
  validateScenerySurface(surfaceStyle, surfaceQuality);
  const sources = cellsInput.map(validateScenerySource),
    cells = sources.map(scenerySourceCell);
  fail(integerPosition(originMm), 'Invalid local origin');
  originMm = Object.freeze({ ...originMm });
  fail(
    Number.isSafeInteger(maxGeometryBytes) &&
      (maxGeometryBytes > 0 || (sparse && maxGeometryBytes === 0)) &&
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
    fail(
      chunk &&
        (!sparse || chunk.assets.length > 0) &&
        chunk.x === cell.x &&
        chunk.z === cell.z &&
        cell.cellSizeMm === manifest.grid.cellSizeMm,
      'Scenery does not match manifest cell',
    );
    fail(
      cell.surfaces.every((surface) =>
        surface.positionsMm.every(
          (v, i) => i % 3 !== 1 || (v >= manifest.grid.floorMm && v <= manifest.grid.ceilingMm),
        ),
      ),
      'Scenery exceeds region vertical bounds',
    );
    fail(
      Math.abs(cell.x * cell.cellSizeMm - originMm.x) <=
        regionalOriginReachMm(manifest.grid.cellSizeMm) &&
        Math.abs(cell.z * cell.cellSizeMm - originMm.z) <=
          regionalOriginReachMm(manifest.grid.cellSizeMm) &&
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
    requiredChunkIds.every(
      (id) => suppliedIds.has(id) || (sparse && chunks.get(id)?.assets.length === 0),
    ),
    'Required scenery missing',
  );
  // Known-empty coverage comes only from this validated, hash-bound manifest.
  // No absent payload, missing required cell or caller-provided empty mesh can grant clearance.
  for (const id of requiredChunkIds) {
    const chunk = chunks.get(id);
    fail(chunk, 'Unknown required scenery cell');
    if (sparse && chunk.assets.length === 0) {
      fail(
        Math.abs(chunk.x * manifest.grid.cellSizeMm - originMm.x) <=
          regionalOriginReachMm(manifest.grid.cellSizeMm) &&
          Math.abs(chunk.z * manifest.grid.cellSizeMm - originMm.z) <=
            regionalOriginReachMm(manifest.grid.cellSizeMm) &&
          Math.abs(originMm.y) <= 2000000,
        'Scenery window must use a nearby origin',
      );
      byCell.set(`${chunk.x},${chunk.z}`, chunk);
    }
  }
  // Positions, indices and Three-generated normals; excludes engine internals and temporary GLB buffers.
  const { geometryBytes, textureBytes, resourceBytes } = scenerySourceResources(sources);
  fail(resourceBytes <= maxGeometryBytes, 'Scenery geometry/texture budget exceeded');
  await initWorldRuntime();
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    group = new THREE.Group(),
    geometries = [];
  const materials = [],
    byColor = new Map(),
    textures = new Map();
  const colliderIds = new Map();
  const restoreMeshes = [];
  const restoreContainment = createRestoreContainment(restoreMeshes);
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    group.clear();
    restoreContainment.dispose();
    restoreMeshes.length = 0;
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures.values()) texture.dispose();
    textures.clear();
    for (const material of materials) material.map = null;
    geometries.length = 0;
    materials.length = 0;
    world.free();
    byColor.clear();
    colliderIds.clear();
    byCell.clear();
  }
  try {
    for (const source of sources) {
      const cell = scenerySourceCell(source);
      for (const surface of compileScenerySource(source).surfaces) {
        const { positions, indices } = surface;
        const textureKey = surface.textureKey ?? '';
        const materialStyle = sceneryMaterialStyle(surfaceStyle, surface);
        const key = JSON.stringify([
          materialStyle,
          surface.color,
          textureKey,
          surface.alphaMode ?? 'OPAQUE',
          surface.alphaCutoff ?? 0,
          surface.doubleSided ?? true,
          Boolean(surface.colors),
        ]);
        let material = byColor.get(key);
        if (!material) {
          material = createScenerySurface({
            style: materialStyle,
            quality: surfaceQuality,
            color: surface.color,
            originMm,
          });
          if (surface.alphaMode) {
            material.alphaTest = surface.alphaMode === 'MASK' ? surface.alphaCutoff : 0;
            material.side = surface.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
          }
          material.vertexColors = Boolean(surface.colors);
          materials.push(material);
          if (surface.texture) {
            let texture = textures.get(textureKey);
            if (!texture) {
              texture = createSceneryTexture(surface.texture);
              textures.set(textureKey, texture);
            }
            material.map = texture;
          }
          byColor.set(key, material);
        }
        const geometry = new THREE.BufferGeometry();
        geometries.push(geometry);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        if (surface.normals)
          geometry.setAttribute('normal', new THREE.BufferAttribute(surface.normals, 3));
        else geometry.computeVertexNormals();
        if (surface.uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(surface.uvs, 2));
        if (surface.colors)
          geometry.setAttribute('color', new THREE.BufferAttribute(surface.colors, 4));
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = cell.chunkId;
        const local = {
          x: (cell.x * cell.cellSizeMm - originMm.x) / 1000,
          y: -originMm.y / 1000,
          z: (cell.z * cell.cellSizeMm - originMm.z) / 1000,
        };
        mesh.position.set(local.x, local.y, local.z);
        group.add(mesh);
        if (surface.collision === 'visual-only') continue;
        restoreMeshes.push({ positions, indices, translation: local });
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
    const minX = Math.floor((Math.min(from.x, to.x) - radius) / manifest.grid.cellSizeMm),
      maxX = Math.floor((Math.max(from.x, to.x) + radius) / manifest.grid.cellSizeMm);
    const minZ = Math.floor((Math.min(from.z, to.z) - radius) / manifest.grid.cellSizeMm),
      maxZ = Math.floor((Math.max(from.z, to.z) + radius) / manifest.grid.cellSizeMm);
    if ((maxX - minX + 1) * (maxZ - minZ + 1) > 25) return false;
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++) if (!byCell.has(`${x},${z}`)) return false;
    return true;
  }
  return Object.freeze({
    motionCoverage: createRegionMotionCoverageQuery({ covers, live }),
    prepareRestoreProof: (assertCurrent) => {
      live();
      return restoreContainment.prepare(assertCurrent);
    },
    restoreClearance(positionMm, radiusMm = 220) {
      live();
      fail(
        finitePosition(positionMm) &&
          Number.isSafeInteger(radiusMm) &&
          radiusMm > 0 &&
          radiusMm <= 2000,
        'Invalid restore query',
      );
      if (!covers(positionMm, positionMm, radiusMm))
        return { status: 'ambiguous', reason: 'unknown-cell' };
      return restoreContainment.classify(local(positionMm));
    },
    restoreSnapshot: restoreContainment.snapshot,
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
    // Read actual Rapier sets only on explicit diagnostic demand, never after free().
    collisionMeshes() {
      live();
      return sources.flatMap((source) => {
        const cell = scenerySourceCell(source);
        return compileScenerySource(source).surfaces.flatMap((surface, index) =>
          surface.collision === 'visual-only' ? [] : [{
            id: `scenery:${cell.chunkId}:${index}`,
            vertices: Array.from(surface.positions),
            indices: Array.from(surface.indices),
            translation: {
              x: (cell.x * cell.cellSizeMm - originMm.x) / 1000,
              y: -originMm.y / 1000,
              z: (cell.z * cell.cellSizeMm - originMm.z) / 1000,
            },
          }]);
      });
    },
    collisionSnapshot: () => ({
      worlds: disposed ? 0 : 1,
      colliders: disposed ? 0 : world.colliders.len(),
      rigidBodies: disposed ? 0 : world.bodies.len(),
    }),
    snapshot: () => ({
      sceneryPrepared: !disposed,
      flightReady: false,
      disposed,
      cells: disposed ? 0 : byCell.size,
      geometryBytes: disposed ? 0 : geometryBytes,
      textureBytes: disposed ? 0 : textureBytes,
      resourceBytes: disposed ? 0 : resourceBytes,
      textures: textures.size,
      meshes: disposed ? 0 : geometries.length,
      colliders: colliderIds.size,
      materials: disposed ? 0 : materials.length,
    }),
    support(positionMm, maxDropMm = 10000) {
      live();
      fail(
        finitePosition(positionMm) &&
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
        finitePosition(positionMm) &&
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
        finitePosition(fromMm) &&
          finitePosition(toMm) &&
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
