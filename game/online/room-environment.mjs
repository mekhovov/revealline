import { boundedJSON, exactKeys, required } from '../data-json.mjs';
import {
  snapshotAttemptAppearance,
  restoreAttemptAppearance,
} from '../presentation/attempt-appearance.mjs';
import { prepareIndustrialRoomEnvironmentSource } from '../presentation/industrial-environments.mjs';

/** Room content is already hash-bound by native admission. Only a complete
 * built-in recipe in the immutable local source table can acquire chapter art;
 * self-declared catalogue names and installed editions grant no authority. */
export function prepareRoomEnvironment(recipe, { signal } = {}) {
  if (!recipe?.content || recipe.content.source?.kind !== 'builtin') return Promise.resolve(null);
  return prepareIndustrialRoomEnvironmentSource({
    family: recipe.family,
    mode: recipe.mode,
    catalogueId: recipe.content.catalogueId,
    source: recipe.level,
    signal,
  });
}

const FORMAT = 'revealline-private-room-appearance.v1';
export const ROOM_APPEARANCE_KEY = 'revealline.private-room.appearance.v1';
const ownerKeys = ['service', 'roomId', 'contentHash', 'generation'];
function owner(value) {
  required(
    typeof value.service === 'string' &&
      value.service.length <= 2048 &&
      /^[a-f0-9]{32}$/.test(value.roomId) &&
      /^[a-f0-9]{64}$/.test(value.contentHash) &&
      Number.isSafeInteger(value.generation) &&
      value.generation >= 0,
    'Invalid room artwork owner.',
  );
  return Object.fromEntries(ownerKeys.map((key) => [key, value[key]]));
}
export function roomAppearanceIdentity(service, snapshot) {
  return owner({
    service,
    roomId: snapshot.roomId,
    contentHash: snapshot.contentHash,
    generation: snapshot.generation,
  });
}
export function serializeRoomAppearance(identity, appearance) {
  return JSON.stringify({
    format: FORMAT,
    ...owner(identity),
    appearance: snapshotAttemptAppearance(appearance),
  });
}
/** Undefined means a new room/generation; explicit null is retained historical
 * presentation. The authenticated candidate is required again after page reload. */
export function restoreRoomAppearance(raw, identity, candidate) {
  if (!raw) return undefined;
  const value = boundedJSON(raw, { maxBytes: 8192, maxDepth: 6 });
  exactKeys(value, ['format', ...ownerKeys, 'appearance'], 'room artwork');
  required(
    value.format === FORMAT && Object.hasOwn(value, 'appearance'),
    'Unsupported room artwork.',
  );
  owner(value);
  owner(identity);
  if (ownerKeys.some((key) => value[key] !== identity[key])) return undefined;
  return restoreAttemptAppearance(value.appearance, candidate);
}
