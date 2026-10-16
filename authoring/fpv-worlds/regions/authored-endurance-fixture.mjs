/** Authored workload only. Commands are a test pilot, never player input or game progress. */
import { prepareRegionalDownload } from '../../../optional-practice/civilian-fpv/regional-delivery.mjs';

export const AUTHORED_ENDURANCE_PIN = Object.freeze({
  url: 'https://raw.githubusercontent.com/mekhovov/revealline/622fade3a7a4e70021cab9c509c1116d0378ad2b/authoring/fpv-worlds/regions/urban-bando/delivery-review-r2/delivery.json',
  bytes: 6603,
  sha256: '9a7d157d2d5fd197c632b870bd9b9ebacd62015ad0084605712185064c8ae73a',
});
export const AUTHORED_ENDURANCE_ROUTE = Object.freeze([
  Object.freeze({ id: 'mill-road', position: Object.freeze({ x: 64000, y: 12000, z: 16000 }) }),
  Object.freeze({
    id: 'container-road',
    position: Object.freeze({ x: 320000, y: 12000, z: 16000 }),
  }),
  Object.freeze({ id: 'tower-court', position: Object.freeze({ x: 320000, y: 12000, z: 200000 }) }),
  Object.freeze({
    id: 'parking-approach',
    position: Object.freeze({ x: 64000, y: 12000, z: 200000 }),
  }),
  Object.freeze({
    id: 'west-service-road',
    position: Object.freeze({ x: 16000, y: 12000, z: 200000 }),
  }),
  Object.freeze({
    id: 'mill-west-approach',
    position: Object.freeze({ x: 16000, y: 12000, z: 16000 }),
  }),
]);
const fail = (value, message) => {
  if (!value) throw new Error(message);
};
export async function createAuthoredEnduranceFixture({ fetchImpl = fetch, signal } = {}) {
  const checked = await prepareRegionalDownload(AUTHORED_ENDURANCE_PIN, {
    pageURL: 'https://authored-endurance.invalid/review',
    fetchImpl,
    signal,
  });
  const descriptor = checked.descriptor;
  fail(
    descriptor.id === 'urban-earthworks-study' && descriptor.revision === 'review-r2',
    'Unexpected authored revision',
  );
  fail(
    descriptor.terrain.sha256 ===
      '66ef229f0812c31432bb8b3daac6f16e3dcaea19f44be00395a614bfa587afd7',
    'Unexpected terrain manifest',
  );
  fail(
    descriptor.scenery.sha256 ===
      '9ae41033e9a73261eeee3ff2339ceaa0e2f6b47367b212fc1f2de470ca8dacb6',
    'Unexpected scenery manifest',
  );
  fail(
    descriptor.files.length === 38 && descriptor.totalBytes === 2268846,
    'Unexpected authored source envelope',
  );
  const files = new Map();
  for (const entry of descriptor.files) {
    signal?.throwIfAborted();
    files.set('/' + entry.path, new Uint8Array(await checked.assets.get(entry.path).arrayBuffer()));
  }
  const decode = (path) =>
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(files.get('/' + path)));
  const terrain = decode(descriptor.terrain.path),
    scenery = decode(descriptor.scenery.path);
  fail(terrain.spawns[0].id === 'mill-court', 'Unchanged authored start required');
  const solidSurfaces = scenery.assets
    .filter((entry) => entry.kind === 'collision')
    .reduce(
      (total, entry) =>
        total +
        decode('scenery/' + entry.path).surfaces.filter(
          (surface) => surface.collision !== 'visual-only',
        ).length,
      0,
    );
  // One committed plus one staged pair; count the whole exact region as a conservative cap.
  const colliderUpperBound = 2 * (terrain.chunks.length + solidSurfaces);
  fail(
    Number.isSafeInteger(colliderUpperBound) && colliderUpperBound <= 1024,
    'Unexpected source collider envelope',
  );
  let released = false,
    reads = 0;
  const source = {
    baseURL: 'https://authored-endurance-cache.invalid/terrain/',
    fetchImpl: async (url, options = {}) => {
      options.signal?.throwIfAborted();
      fail(!released, 'Authored source cache released');
      const target = new URL(url);
      fail(
        target.origin === 'https://authored-endurance-cache.invalid' &&
          !target.search &&
          !target.hash,
        'Unverified source request',
      );
      const bytes = files.get(target.pathname);
      fail(bytes, 'Missing verified source; never network fallback');
      reads++;
      return new Response(bytes);
    },
  };
  return {
    terrain: { manifest: terrain, source: { ...source, surfaceStyle: 'urban' } },
    scenery: {
      manifest: scenery,
      source: { ...source, baseURL: 'https://authored-endurance-cache.invalid/scenery/' },
    },
    identity: {
      descriptor: AUTHORED_ENDURANCE_PIN,
      terrainManifestSHA256: descriptor.terrain.sha256,
      sceneryManifestSHA256: descriptor.scenery.sha256,
      verifiedPayloadFiles: descriptor.files.length,
      verifiedPayloadBytes: descriptor.totalBytes,
      source: 'Immutable admitted Urban review-r2; road/court circuit, no geometry or spawn edits',
      route: AUTHORED_ENDURANCE_ROUTE,
      solidScenerySurfaces: solidSurfaces,
      colliderUpperBound,
    },
    createPilot: createAuthoredEndurancePilot,
    cacheSnapshot: () => ({
      files: files.size,
      bytes: released ? 0 : descriptor.totalBytes,
      reads,
      released,
    }),
    dispose() {
      released = true;
      files.clear();
    },
  };
}

export function createAuthoredEndurancePilot() {
  let target = 0,
    accepted = 0;
  const visits = Array(AUTHORED_ENDURANCE_ROUTE.length).fill(0);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  return {
    snapshot: () => ({
      target: AUTHORED_ENDURANCE_ROUTE[target].id,
      acceptedWaypoints: accepted,
      completedCircuits: Math.floor(Math.max(0, accepted - 1) / visits.length),
      visits: [...visits],
    }),
    command(state) {
      let goal = AUTHORED_ENDURANCE_ROUTE[target].position;
      if (
        Math.hypot(state.position.x - goal.x, state.position.z - goal.z) < 2500 &&
        Math.abs(state.position.y - goal.y) < 1000 &&
        Math.hypot(state.velocity.x, state.velocity.z) < 2000
      ) {
        visits[target]++;
        accepted++;
        target = (target + 1) % visits.length;
        goal = AUTHORED_ENDURANCE_ROUTE[target].position;
      }
      const roll = clamp(
        (goal.x - state.position.x) / 180000 - state.velocity.x / 18000,
        -0.18,
        0.18,
      );
      const pitch = -clamp(
        (goal.z - state.position.z) / 180000 - state.velocity.z / 18000,
        -0.18,
        0.18,
      );
      const throttle = clamp(
        0.5 +
          (goal.y - state.position.y) / 140000 -
          state.velocity.y / 24000 +
          (Math.abs(roll) + Math.abs(pitch)) * 0.015,
        0.2,
        0.8,
      );
      return { roll, pitch, yaw: 0, throttle };
    },
  };
}
