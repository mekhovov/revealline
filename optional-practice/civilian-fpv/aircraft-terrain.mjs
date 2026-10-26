import { boundedJSON, dataIdentity, exactKeys, required } from '../../game/data-json.mjs';
import {
  createAdvancedTerrainFrame,
  validateAdvancedTerrainFrame,
  packTerrainCollider,
} from './advanced-terrain.mjs';

export const AIRCRAFT_TERRAIN_FORMAT = 'AircraftCollisionFrame.v1';
export function createAircraftTerrainFrame(source) {
  const value = boundedJSON(source, {
    maxBytes: 4 * 1024 * 1024,
    maxNodes: 1300000,
    maxArray: 786432,
    maxDepth: 6,
    maxString: 128,
  });
  exactKeys(value, ['sourceIdentity', 'colliders'], 'Aircraft scene source');
  required(
    /^[a-f0-9]{16}$/.test(value.sourceIdentity) &&
      Array.isArray(value.colliders) &&
      value.colliders.length > 0 &&
      value.colliders.length <= 512,
    'Invalid aircraft scene',
  );
  const ids = new Set();
  let vertices = 0,
    triangles = 0;
  const colliders = value.colliders
    .map((collider) => {
      const checked = createAdvancedTerrainFrame({
        sourceIdentity: value.sourceIdentity,
        colliders: [collider],
      }).colliders[0];
      required(!ids.has(checked.id), 'Duplicate aircraft scene collider');
      ids.add(checked.id);
      vertices += checked.vertices.length / 3;
      triangles += checked.indices.length / 3;
      required(
        vertices <= 131072 && triangles <= 262144,
        'Aircraft scene geometry exceeds capacity',
      );
      return checked;
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    format: AIRCRAFT_TERRAIN_FORMAT,
    identity: dataIdentity({
      format: AIRCRAFT_TERRAIN_FORMAT,
      sourceIdentity: value.sourceIdentity,
      colliders: colliders.map((collider) => packTerrainCollider(collider).key),
    }),
    sourceIdentity: value.sourceIdentity,
    colliders,
  };
}
export function validateAircraftTerrainFrame(source) {
  if (source?.format !== AIRCRAFT_TERRAIN_FORMAT) return validateAdvancedTerrainFrame(source);
  exactKeys(source, ['format', 'identity', 'sourceIdentity', 'colliders'], 'Aircraft scene');
  const checked = createAircraftTerrainFrame({
    sourceIdentity: source.sourceIdentity,
    colliders: source.colliders,
  });
  required(checked.identity === source.identity, 'Aircraft scene identity changed');
  return checked;
}
