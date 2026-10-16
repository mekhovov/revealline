import { boundedJSON, dataIdentity, exactKeys, required } from '../../game/data-json.mjs';

export const ADVANCED_TERRAIN_FORMAT = 'AdvancedRegionalCollisionFrame.v1';
export const ADVANCED_TERRAIN_LIMITS = Object.freeze({
  frameBytes: 2 * 1024 * 1024,
  colliders: 64,
  vertices: 65536,
  triangles: 131072,
  frames: 512,
  events: 2048,
  coordinate: 1000000,
});
const identityPattern = /^[a-f0-9]{16}$/;
const safeId = (value) =>
  typeof value === 'string' &&
  /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value) &&
  !value.includes('..') &&
  !['constructor', 'prototype', '__proto__'].includes(value);
const canonicalFrame = (source) =>
  boundedJSON(source, {
    maxBytes: ADVANCED_TERRAIN_LIMITS.frameBytes,
    maxNodes: 650000,
    maxArray: ADVANCED_TERRAIN_LIMITS.triangles * 3,
    maxString: 128,
    maxDepth: 6,
  });
function base64(bytes) {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 8192)
    text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(text);
}
function decode(text, limit) {
  required(
    typeof text === 'string' &&
      text.length <= (limit * 4) / 3 + 8 &&
      /^[A-Za-z0-9+/]*={0,2}$/.test(text),
    'Invalid packed terrain geometry',
  );
  const bytes = Uint8Array.from(atob(text), (character) => character.charCodeAt(0));
  required(
    bytes.length <= limit && bytes.length % 4 === 0 && base64(bytes) === text,
    'Invalid packed terrain byte length',
  );
  return new DataView(bytes.buffer);
}
function packValues(values, integer) {
  const bytes = new Uint8Array(values.length * 4),
    view = new DataView(bytes.buffer);
  for (let index = 0; index < values.length; index++) {
    if (integer) view.setUint32(index * 4, values[index], true);
    else view.setFloat32(index * 4, values[index], true);
  }
  return base64(bytes);
}
function normalize(source) {
  exactKeys(source, ['sourceIdentity', 'colliders'], 'Terrain frame source');
  required(
    identityPattern.test(source.sourceIdentity),
    'Verified terrain source identity required',
  );
  required(
    Array.isArray(source.colliders) &&
      source.colliders.length > 0 &&
      source.colliders.length <= ADVANCED_TERRAIN_LIMITS.colliders,
    'Terrain frame collider count exceeds limit',
  );
  let vertices = 0,
    triangles = 0;
  const ids = new Set();
  const colliders = source.colliders
    .map((collider) => {
      exactKeys(collider, ['id', 'vertices', 'indices'], 'Terrain collider');
      required(
        safeId(collider.id) && !ids.has(collider.id),
        'Terrain collider IDs must be unique path-safe names',
      );
      ids.add(collider.id);
      required(
        Array.isArray(collider.vertices) &&
          collider.vertices.length >= 9 &&
          collider.vertices.length % 3 === 0 &&
          Array.isArray(collider.indices) &&
          collider.indices.length >= 3 &&
          collider.indices.length % 3 === 0,
        'Terrain triangle arrays required',
      );
      vertices += collider.vertices.length / 3;
      triangles += collider.indices.length / 3;
      required(
        vertices <= ADVANCED_TERRAIN_LIMITS.vertices &&
          triangles <= ADVANCED_TERRAIN_LIMITS.triangles,
        'Terrain geometry exceeds frame budget',
      );
      const points = collider.vertices.map((value) => {
        required(
          Number.isFinite(value) && Math.abs(value) <= ADVANCED_TERRAIN_LIMITS.coordinate,
          'Terrain vertex is outside fixed simulation coordinates',
        );
        return Math.fround(value) || 0;
      });
      const indices = collider.indices.map((value) => {
        required(
          Number.isSafeInteger(value) && value >= 0 && value < points.length / 3,
          'Terrain triangle index is out of bounds',
        );
        return value;
      });
      for (let index = 0; index < indices.length; index += 3) {
        const a = indices[index] * 3,
          b = indices[index + 1] * 3,
          c = indices[index + 2] * 3;
        const u = [
            points[b] - points[a],
            points[b + 1] - points[a + 1],
            points[b + 2] - points[a + 2],
          ],
          v = [points[c] - points[a], points[c + 1] - points[a + 1], points[c + 2] - points[a + 2]];
        const cross = [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ];
        required(
          cross.some((value) => Math.abs(value) > 1e-12),
          'Degenerate terrain triangle',
        );
      }
      return { id: collider.id, vertices: points, indices };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const packed = colliders.map(packTerrainCollider);
  const identity = dataIdentity({
    format: ADVANCED_TERRAIN_FORMAT,
    sourceIdentity: source.sourceIdentity,
    colliders: packed.map((collider) => collider.key),
  });
  return {
    format: ADVANCED_TERRAIN_FORMAT,
    identity,
    sourceIdentity: source.sourceIdentity,
    colliders,
  };
}
export function createAdvancedTerrainFrame(source) {
  return normalize(canonicalFrame(source));
}
export function validateAdvancedTerrainFrame(source) {
  const frame = canonicalFrame(source);
  exactKeys(frame, ['format', 'identity', 'sourceIdentity', 'colliders'], 'Terrain frame');
  required(
    frame.format === ADVANCED_TERRAIN_FORMAT && identityPattern.test(frame.identity),
    'Unsupported terrain frame',
  );
  const normalized = normalize({
    sourceIdentity: frame.sourceIdentity,
    colliders: frame.colliders,
  });
  required(normalized.identity === frame.identity, 'Terrain geometry identity changed');
  return normalized;
}
export function packTerrainCollider(collider) {
  const packed = {
    id: collider.id,
    vertices: packValues(collider.vertices, false),
    indices: packValues(collider.indices, true),
  };
  return { key: dataIdentity(packed), ...packed };
}
export function unpackTerrainCollider(source) {
  exactKeys(source, ['key', 'id', 'vertices', 'indices'], 'Packed terrain collider');
  required(
    safeId(source.id) && identityPattern.test(source.key),
    'Invalid packed terrain identity',
  );
  const vertices = decode(source.vertices, ADVANCED_TERRAIN_LIMITS.vertices * 12),
    indices = decode(source.indices, ADVANCED_TERRAIN_LIMITS.triangles * 12);
  const collider = {
    id: source.id,
    vertices: Array.from({ length: vertices.byteLength / 4 }, (_, i) =>
      vertices.getFloat32(i * 4, true),
    ),
    indices: Array.from({ length: indices.byteLength / 4 }, (_, i) =>
      indices.getUint32(i * 4, true),
    ),
  };
  const normalized = normalize({ sourceIdentity: '0000000000000000', colliders: [collider] })
    .colliders[0];
  required(packTerrainCollider(normalized).key === source.key, 'Packed terrain geometry changed');
  return normalized;
}
export function terrainHistoryIdentity(record) {
  return dataIdentity({
    colliders: record.terrainColliders.map((collider) => collider.key),
    frames: record.terrainFrames,
    events: record.terrainEvents,
  });
}
export function terrainHistoryBytes(record) {
  return new TextEncoder().encode(
    JSON.stringify({
      terrainColliders: record.terrainColliders,
      terrainFrames: record.terrainFrames,
      terrainEvents: record.terrainEvents,
    }),
  ).byteLength;
}
function terrainFrameFromHistory(record, index, cache) {
  const descriptor = record.terrainFrames[index];
  required(descriptor && Array.isArray(descriptor.colliders), 'Missing terrain frame');
  exactKeys(descriptor, ['identity', 'sourceIdentity', 'colliders'], 'Recorded terrain frame');
  required(
    identityPattern.test(descriptor.identity) &&
      identityPattern.test(descriptor.sourceIdentity) &&
      descriptor.colliders.length > 0 &&
      descriptor.colliders.length <= ADVANCED_TERRAIN_LIMITS.colliders,
    'Invalid recorded terrain frame',
  );
  let vertices = 0,
    triangles = 0,
    previousId = '',
    bytes = JSON.stringify({
      format: ADVANCED_TERRAIN_FORMAT,
      ...descriptor,
      colliders: [],
    }).length;
  const colliders = descriptor.colliders.map((key, colliderIndex) => {
    const entry = cache.get(key);
    required(entry, 'Missing recorded terrain collider');
    const collider = entry.collider;
    required(collider.id > previousId, 'Recorded terrain colliders must have unique stable order');
    previousId = collider.id;
    vertices += collider.vertices.length / 3;
    triangles += collider.indices.length / 3;
    bytes += entry.bytes + (colliderIndex ? 1 : 0);
    return collider;
  });
  required(
    vertices <= ADVANCED_TERRAIN_LIMITS.vertices &&
      triangles <= ADVANCED_TERRAIN_LIMITS.triangles &&
      bytes <= ADVANCED_TERRAIN_LIMITS.frameBytes,
    'Recorded terrain frame exceeds geometry budget',
  );
  required(
    dataIdentity({
      format: ADVANCED_TERRAIN_FORMAT,
      sourceIdentity: descriptor.sourceIdentity,
      colliders: descriptor.colliders,
    }) === descriptor.identity,
    'Recorded terrain frame identity changed',
  );
  // A decoded collider is immutable and shared by every referencing frame.
  // Re-normalizing per frame would amplify a small packed import hundreds of times.
  return { format: ADVANCED_TERRAIN_FORMAT, ...descriptor, colliders };
}
export function validateTerrainHistory(record, { substeps, missionSteps }) {
  required(
    Array.isArray(record.terrainColliders) &&
      record.terrainColliders.length <=
        ADVANCED_TERRAIN_LIMITS.frames * ADVANCED_TERRAIN_LIMITS.colliders &&
      Array.isArray(record.terrainFrames) &&
      record.terrainFrames.length <= ADVANCED_TERRAIN_LIMITS.frames &&
      Array.isArray(record.terrainEvents) &&
      record.terrainEvents.length <= ADVANCED_TERRAIN_LIMITS.events,
    'Invalid terrain history budget',
  );
  const colliderKeys = new Set(),
    frameKeys = new Set(),
    cache = new Map();
  for (const collider of record.terrainColliders) {
    required(!colliderKeys.has(collider.key), 'Duplicate terrain collider history');
    colliderKeys.add(collider.key);
    const decoded = unpackTerrainCollider(collider);
    Object.freeze(decoded.vertices);
    Object.freeze(decoded.indices);
    Object.freeze(decoded);
    cache.set(collider.key, { collider: decoded, bytes: JSON.stringify(decoded).length });
  }
  const frames = record.terrainFrames.map((_, index) => {
    const frame = terrainFrameFromHistory(record, index, cache);
    required(!frameKeys.has(frame.identity), 'Duplicate terrain frame history');
    frameKeys.add(frame.identity);
    return frame;
  });
  let previous = -1;
  const usedFrames = new Set(),
    usedColliders = new Set();
  let lastFrame = null;
  for (const event of record.terrainEvents) {
    required(
      Array.isArray(event) &&
        event.length === 2 &&
        Number.isSafeInteger(event[0]) &&
        event[0] >= previous &&
        event[0] <= substeps &&
        event[0] % missionSteps === 0 &&
        Number.isSafeInteger(event[1]) &&
        event[1] >= 0 &&
        event[1] < frames.length,
      'Invalid terrain frame event',
    );
    required(event[1] !== lastFrame, 'Redundant terrain frame event');
    lastFrame = event[1];
    if (!usedFrames.has(event[1])) {
      required(event[1] === usedFrames.size, 'Terrain frame history must follow first use');
      usedFrames.add(event[1]);
      for (const key of record.terrainFrames[event[1]].colliders) {
        if (usedColliders.has(key)) continue;
        required(
          record.terrainColliders[usedColliders.size]?.key === key,
          'Terrain collider history must follow first use',
        );
        usedColliders.add(key);
      }
    }
    previous = event[0];
  }
  required(
    substeps === 0 || record.terrainEvents[0]?.[0] === 0,
    'Initial terrain frame is missing',
  );
  required(
    usedFrames.size === frames.length && usedColliders.size === record.terrainColliders.length,
    'Unused terrain history entries',
  );
  return frames;
}
