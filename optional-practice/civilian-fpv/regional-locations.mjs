/** Local, exact-revision places. Stored data never bypasses restore geometry admission. */
import { validateRegionManifest } from './regional/region-manifest.mjs';
const FORMAT = 'FPVRegionalLocations.v1';
const MAX_PLACES = 200;
const MAX_PER_REVISION = 20;
const MAX_BYTES = 128 * 1024;
const fail = (code) => Object.assign(new Error(code), { code });
const keys = (value, expected) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== [...expected].sort().join(',')
  )
    throw fail('regional-location-invalid');
};
const slug = (value) => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value);

export function validateRegionalLocationIdentity(value) {
  keys(value, ['regionId', 'revision', 'sha256']);
  if (
    !slug(value.regionId) ||
    !slug(value.revision) ||
    typeof value.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.sha256)
  )
    throw fail('regional-location-invalid');
  return { ...value };
}

export function validateRegionalLocationPose(value) {
  keys(value, ['position', 'heading']);
  keys(value.position, ['x', 'y', 'z']);
  if (
    !Object.values(value.position).every((n) => Number.isFinite(n) && Math.abs(n) <= 100000000) ||
    !Number.isSafeInteger(value.heading) ||
    value.heading < 0 ||
    value.heading >= 36000
  )
    throw fail('regional-location-invalid');
  return { position: { ...value.position }, heading: value.heading };
}

export function validateRegionalLocationStart(value, input) {
  const pose = validateRegionalLocationPose(value),
    { grid } = validateRegionManifest(input);
  const p = pose.position,
    radius = 220;
  if (
    p.x - radius < grid.minX * grid.cellSizeMm ||
    p.x + radius > (grid.minX + grid.width) * grid.cellSizeMm ||
    p.z - radius < grid.minZ * grid.cellSizeMm ||
    p.z + radius > (grid.minZ + grid.depth) * grid.cellSizeMm ||
    p.y < grid.floorMm ||
    p.y + 2 * radius > grid.ceilingMm
  )
    throw fail('regional-location-outside');
  return pose;
}

function label(value) {
  if (
    typeof value !== 'string' ||
    value.length > 128 ||
    !value.trim() ||
    [...value].length > 64 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    throw fail('regional-location-label');
  return value.trim();
}
const sameIdentity = (a, b) => ['regionId', 'revision', 'sha256'].every((key) => a[key] === b[key]);
function record(value) {
  keys(value, ['id', 'identity', 'label', 'pose', 'createdAt']);
  if (
    typeof value.id !== 'string' ||
    !/^[a-zA-Z0-9-]{1,64}$/.test(value.id) ||
    !Number.isSafeInteger(value.createdAt) ||
    value.createdAt < 0
  )
    throw fail('regional-location-invalid');
  return {
    id: value.id,
    identity: validateRegionalLocationIdentity(value.identity),
    label: label(value.label),
    pose: validateRegionalLocationPose(value.pose),
    createdAt: value.createdAt,
  };
}
export function validateSavedRegionalLocation(value, identity) {
  const result = record(value);
  if (!sameIdentity(result.identity, validateRegionalLocationIdentity(identity)))
    throw fail('regional-location-revision');
  return result;
}
function state(value) {
  if (value === undefined) return { format: FORMAT, generation: 0, locations: [] };
  keys(value, ['format', 'generation', 'locations']);
  if (
    value.format !== FORMAT ||
    !Number.isSafeInteger(value.generation) ||
    value.generation < 0 ||
    !Array.isArray(value.locations) ||
    value.locations.length > MAX_PLACES
  )
    throw fail('regional-location-invalid');
  const locations = value.locations.map(record),
    ids = new Set(),
    counts = new Map();
  for (const place of locations) {
    if (ids.has(place.id)) throw fail('regional-location-invalid');
    ids.add(place.id);
    const key = JSON.stringify(place.identity),
      count = (counts.get(key) ?? 0) + 1;
    if (count > MAX_PER_REVISION) throw fail('regional-location-full');
    counts.set(key, count);
  }
  const result = { format: FORMAT, generation: value.generation, locations };
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_BYTES)
    throw fail('regional-location-full');
  return result;
}

/** Separate DB: no world revisions, playlists or proofs are changed or deleted. */
export async function openRegionalLocations({
  indexedDB = globalThis.indexedDB,
  name = 'revealline-fpv-regional-locations-v1',
  newId = () => globalThis.crypto.randomUUID(),
  now = () => Date.now(),
} = {}) {
  if (!indexedDB) throw fail('regional-location-storage');
  const opening = indexedDB.open(name, 1);
  opening.onupgradeneeded = () => opening.result.createObjectStore('state');
  const db = await new Promise((resolve, reject) => {
    let rejected = false;
    opening.onsuccess = () => (rejected ? opening.result.close() : resolve(opening.result));
    opening.onerror = () => {
      rejected = true;
      reject(opening.error);
    };
    opening.onblocked = () => {
      rejected = true;
      reject(fail('regional-location-storage'));
    };
  });
  db.onversionchange = () => db.close();
  function transaction(write, apply) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('state', write ? 'readwrite' : 'readonly'),
        store = tx.objectStore('state');
      let result, error;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(error ?? tx.error ?? fail('regional-location-storage'));
      tx.onerror = () => {};
      const read = store.get('library');
      read.onsuccess = () => {
        try {
          const current = state(read.result);
          result = apply(current);
          if (write) store.put(state(current), 'library');
        } catch (cause) {
          error = cause;
          tx.abort();
        }
      };
    });
  }
  const generation = (current, expected) => {
    if (!Number.isSafeInteger(expected) || current.generation !== expected)
      throw fail('generation-conflict');
    if (expected >= Number.MAX_SAFE_INTEGER) throw fail('regional-location-full');
  };
  return Object.freeze({
    async list(identity) {
      identity = validateRegionalLocationIdentity(identity);
      return transaction(false, (current) => ({
        generation: current.generation,
        locations: current.locations.filter((place) => sameIdentity(place.identity, identity)),
      }));
    },
    async add(identity, value, { expectedGeneration } = {}) {
      identity = validateRegionalLocationIdentity(identity);
      keys(value, ['label', 'pose']);
      const next = record({
        id: newId(),
        identity,
        label: value.label,
        pose: value.pose,
        createdAt: now(),
      });
      return transaction(true, (current) => {
        generation(current, expectedGeneration);
        if (current.locations.some((place) => place.id === next.id))
          throw fail('regional-location-conflict');
        if (
          current.locations.length >= MAX_PLACES ||
          current.locations.filter((place) => sameIdentity(place.identity, identity)).length >=
            MAX_PER_REVISION
        )
          throw fail('regional-location-full');
        current.locations.push(next);
        current.generation++;
        return { generation: current.generation, location: structuredClone(next) };
      });
    },
    async remove(identity, id, { expectedGeneration } = {}) {
      identity = validateRegionalLocationIdentity(identity);
      return transaction(true, (current) => {
        generation(current, expectedGeneration);
        const index = current.locations.findIndex(
          (place) => place.id === id && sameIdentity(place.identity, identity),
        );
        if (index < 0) throw fail('regional-location-missing');
        current.locations.splice(index, 1);
        current.generation++;
        return { generation: current.generation };
      });
    },
    close: () => db.close(),
  });
}
