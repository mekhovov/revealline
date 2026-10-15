/** Original CC0 structural kit around the existing station approach. Explicit solid source. */
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { surfaceMm } from './design.mjs';

export const APPROACH_COLOURS = Object.freeze({
  steel: Object.freeze([0.18, 0.26, 0.29]),
  masonry: Object.freeze([0.43, 0.45, 0.42]),
  bearing: Object.freeze([0.62, 0.37, 0.12]),
});
const prefix = 'station-approach-';

/** Metres; use the same canonical terrain interpolation as the existing supports. */
export function stationApproachPieces() {
  const pieces = [];
  const box = (id, center, size, material) => pieces.push({ id, center, size, material });
  const beam = (id, from, to, width, material = 'steel') =>
    pieces.push({ id, from, to, width, material });
  const footing = (id, x, z, width) => {
    const heights = [-width / 2, width / 2].flatMap((dx) =>
      [-width / 2, width / 2].map((dz) => surfaceMm(x + dx, z + dz) / 1000),
    );
    const bottom = Math.min(...heights) - 0.35,
      top = Math.max(...heights) + 0.7;
    box(id, [x, (bottom + top) / 2, z], [width, top - bottom, width], 'masonry');
    return top;
  };
  for (const [i, x] of [3310, 3250, 3190].entries()) {
    const z = 3155,
      top = 580 - i * 9,
      spread = [6, 9, 14][i],
      width = [0.72, 1.0, 1.8][i];
    const feet = [-1, 1].map((side) => ({
      x: x + side * spread,
      top: footing(`pylon-${i}-shoe-${side}`, x + side * spread, z, 3.6 + width),
    }));
    for (const [j, foot] of feet.entries())
      beam(`pylon-${i}-raker-${j}`, [foot.x, foot.top - 0.15, z], [x, top - 0.6, z], width);
    const firstTie = Math.max(...feet.map((foot) => foot.top)) + 2.0,
      atHeight = (foot, y) =>
        foot.x + (x - foot.x) * ((y - foot.top + 0.15) / (top - 0.6 - foot.top + 0.15)),
      levels = Math.max(1, Math.ceil((top - 4 - firstTie) / 18));
    for (let level = 0; level <= levels; level++) {
      const y = firstTie + ((top - 4 - firstTie) * level) / levels;
      beam(
        `pylon-${i}-tie-${level}`,
        [atHeight(feet[0], y), y, z],
        [atHeight(feet[1], y), y, z],
        Math.max(0.45, width * 0.6),
      );
      if (level) {
        const previousY = firstTie + ((top - 4 - firstTie) * (level - 1)) / levels,
          side = level % 2;
        beam(
          `pylon-${i}-web-${level}`,
          [atHeight(feet[side], previousY), previousY, z],
          [atHeight(feet[1 - side], y), y, z],
          Math.max(0.4, width * 0.5),
        );
      }
    }
    for (const side of [-1, 1])
      box(
        `pylon-${i}-bearing-${side}`,
        [x + side * 4.2, top + 1.15, z],
        [2.4, 0.6, 2.4],
        'bearing',
      );
  }
  // Knee braces remain near the existing upper corners, preserving the low central bay.
  for (const x of [3480, 3510])
    for (const z of [3170, 3200]) {
      footing(`lookout-shoe-${x}-${z}`, x, z, 5.4);
      beam(`lookout-knee-x-${x}-${z}`, [x, 591, z], [x + (x === 3480 ? 8 : -8), 599.2, z], 0.72);
      beam(`lookout-knee-z-${x}-${z}`, [x, 591, z], [x, 599.2, z + (z === 3170 ? 8 : -8)], 0.72);
    }
  // A low, legible lookout edge; a wide eastern opening remains below the roof.
  for (const x of [3477, 3513])
    for (const z of [3167, 3203])
      box(`lookout-edge-post-${x}-${z}`, [x, 601.7, z], [0.5, 1.4, 0.5], 'steel');
  for (const z of [3167, 3203])
    beam(`lookout-edge-x-${z}`, [3477, 602.3, z], [3513, 602.3, z], 0.32);
  beam('lookout-edge-west', [3477, 602.3, 3167], [3477, 602.3, 3203], 0.32);
  beam('lookout-edge-east-north', [3513, 602.3, 3167], [3513, 602.3, 3179], 0.32);
  beam('lookout-edge-east-south', [3513, 602.3, 3191], [3513, 602.3, 3203], 0.32);
  return pieces;
}

export function approachPieceGeometry(piece) {
  const length = piece.from
    ? new THREE.Vector3(...piece.from).distanceTo(new THREE.Vector3(...piece.to))
    : null;
  const geometry = new THREE.BoxGeometry(...(piece.size ?? [piece.width, length, piece.width]));
  if (piece.from) {
    const from = new THREE.Vector3(...piece.from),
      to = new THREE.Vector3(...piece.to);
    geometry.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        to.clone().sub(from).normalize(),
      ),
    );
    geometry.translate(...from.add(to).multiplyScalar(0.5).toArray());
  } else geometry.translate(...piece.center);
  return geometry;
}

/** Additive cells only: all prior surfaces, bindings and texture objects remain exact. */
export function stationApproachCell(source) {
  if (source.cell.z !== 12 || ![12, 13].includes(source.cell.x)) return { source, pieceIds: [] };
  if (source.cell.surfaces.some((surface) => surface.id.startsWith(prefix)))
    return { source, pieceIds: [], alreadyPrepared: true };
  const groups = new Map(),
    pieceIds = [];
  for (const piece of stationApproachPieces()) {
    const geometry = approachPieceGeometry(piece);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    const x = Math.floor(bounds.getCenter(new THREE.Vector3()).x / 256),
      z = Math.floor(bounds.getCenter(new THREE.Vector3()).z / 256);
    if (x !== source.cell.x || z !== source.cell.z) {
      geometry.dispose();
      continue;
    }
    if (
      bounds.min.x < x * 256 ||
      bounds.max.x > (x + 1) * 256 ||
      bounds.min.z < z * 256 ||
      bounds.max.z > (z + 1) * 256
    )
      throw new Error('Structural piece crosses a cell; explicit clipping is required');
    if (!groups.has(piece.material))
      groups.set(piece.material, { positionsMm: [], normals: [], indices: [] });
    const group = groups.get(piece.material),
      offset = group.positionsMm.length / 3;
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      group.positionsMm.push(
        Math.round(geometry.attributes.position.getX(i) * 1000) - x * 256000,
        Math.round(geometry.attributes.position.getY(i) * 1000),
        Math.round(geometry.attributes.position.getZ(i) * 1000) - z * 256000,
      );
      group.normals.push(
        ...['getX', 'getY', 'getZ'].map(
          (get) => Math.round(geometry.attributes.normal[get](i) * 1e6) / 1e6,
        ),
      );
    }
    group.indices.push(...Array.from(geometry.index.array, (index) => index + offset));
    pieceIds.push(piece.id);
    geometry.dispose();
  }
  if (!pieceIds.length) return { source, pieceIds };
  const surfaces = [...source.cell.surfaces],
    bindings = [...source.bindings];
  for (const [material, group] of groups) {
    const id = prefix + material;
    surfaces.push({
      id,
      color: [...APPROACH_COLOURS[material]],
      positionsMm: group.positionsMm,
      indices: group.indices,
    });
    bindings.push({
      surfaceId: id,
      textureId: 'original-white',
      uvs: Array((group.positionsMm.length / 3) * 2).fill(0),
      normals: group.normals,
      colors: [],
      alphaMode: 'OPAQUE',
      alphaCutoff: 0,
      doubleSided: true,
      collision: 'solid',
    });
  }
  return { source: { ...source, cell: { ...source.cell, surfaces }, bindings }, pieceIds };
}
