import { attitude } from './math.mjs';
import { quantizeFlightInput } from './model.mjs';
import { createRegionalFlightPrototype } from './regional/flight-prototype.mjs';
import { validateRegionManifest } from './regional/region-manifest.mjs';

/** Explicit review input. This is not a World.v1 course or a catalogue admission. */
export async function loadRegionalReview({
  manifestURL,
  sceneryURL = null,
  pageURL,
  fetchImpl = globalThis.fetch,
  signal,
}) {
  const page = new URL(pageURL);
  async function read(value) {
    const url = new URL(value, page);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== page.origin ||
      url.username ||
      url.password
    )
      throw new TypeError('Regional review sources must be on this site');
    const response = await fetchImpl(url.href, { signal, credentials: 'omit', redirect: 'error' });
    if (!response.ok || !response.body) throw new Error('Region manifest download failed');
    const reader = response.body.getReader(),
      parts = [];
    let size = 0;
    try {
      while (true) {
        signal?.throwIfAborted();
        const { done, value: bytes } = await reader.read();
        if (done) break;
        size += bytes.length;
        if (size > 8 * 1024 * 1024) throw new Error('Region manifest is too large');
        parts.push(bytes);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    return {
      manifest: validateRegionManifest(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
      source: { baseURL: new URL('.', url).href, fetchImpl },
    };
  }
  const terrain = await read(manifestURL);
  const scenery = sceneryURL ? await read(sceneryURL) : null;
  signal?.throwIfAborted();
  return { ...terrain, scenery, geometryProfile: scenery ? 'terrain-scenery-v1' : 'terrain-v1' };
}

/** UI metadata is deliberately a different format, never submitted to World validation/proofs. */
export function regionalReviewEntry(configuration, { installedIdentity = null } = {}) {
  const manifest = validateRegionManifest(configuration.manifest),
    { grid } = manifest;
  const brief = installedIdentity
    ? {
        en: 'Regional free flight · unscored. Scenery is saved on this device. If a required area is unavailable, flight pauses safely; retry when ready.',
        uk: 'Вільний політ у регіоні · без заліку. Місцевість збережено на пристрої. Якщо потрібна ділянка недоступна, політ безпечно зупиняється; повторіть, коли будете готові.',
      }
    : {
        en: 'Regional free flight · review · unscored. If terrain is unavailable, flight pauses safely; resume when ready.',
        uk: 'Вільний політ у регіоні · перевірка · без заліку. Якщо місцевість недоступна, політ безпечно зупиняється; продовжуйте, коли готові.',
      };
  return {
    id: installedIdentity
      ? `regional-${manifest.id}-${installedIdentity.slice(0, 12)}`
      : `regional-review-${manifest.id}`,
    packIdentity: installedIdentity
      ? `regional-installed:${installedIdentity}`
      : `regional-review:${manifest.id}:${manifest.revision}`,
    regional: true,
    regionalReview: !installedIdentity,
    freeFlight: true,
    configuration: { ...configuration, manifest },
    course: {
      format: 'FPVRegionalFlightPresentation.v1',
      id: manifest.id,
      locales: Object.fromEntries(
        ['en', 'uk'].map((locale) => [
          locale,
          { title: manifest.title[locale], brief: brief[locale] },
        ]),
      ),
      bounds: {
        min: { x: grid.minX * 128000, y: grid.floorMm, z: grid.minZ * 128000 },
        max: {
          x: (grid.minX + grid.width) * 128000,
          y: grid.ceilingMm,
          z: (grid.minZ + grid.depth) * 128000,
        },
      },
      steps: { acro: [], 'self-level': [] },
      actors: [],
      obstacles: [],
      rules: { droneRadius: 220 },
    },
  };
}

/** Only verified installed descriptor identities enter the ordinary regional Library. */
export function regionalLibraryEntry(configuration, { sha256 } = {}) {
  if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256))
    throw new TypeError('Installed regional identity is required');
  return regionalReviewEntry(configuration, { installedIdentity: sha256 });
}

/** Select only an authored start in the currently verified regional configuration. */
export function regionalStartingPoint(entry, spawnId) {
  if (!entry?.regional || entry.course?.format !== 'FPVRegionalFlightPresentation.v1')
    throw new TypeError('A current regional flight is required');
  const manifest = validateRegionManifest(entry.configuration.manifest);
  if (typeof spawnId !== 'string' || !manifest.spawns.some((spawn) => spawn.id === spawnId))
    throw new TypeError('Unknown regional starting point');
  return { ...entry, configuration: { ...entry.configuration, manifest, spawnId } };
}

/** The production host owns input, menus and arming; this adapter owns only regional state. */
export function createRegionalSession(configuration) {
  const runtime = createRegionalFlightPrototype({ ...configuration, continuous: true });
  let lastInput = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
  const snapshot = () => {
    const state = runtime.snapshot();
    return {
      ...state,
      attitude: attitude(state.orientation),
      lastInput: { ...lastInput },
      step: 0,
      total: 0,
      hold: 0,
      events: [],
      actors: [],
      projectiles: [],
      score: 0,
    };
  };
  return Object.freeze({
    root: runtime.root,
    snapshot,
    prepare: runtime.prepare,
    cancelPreparation: runtime.cancelPreparation,
    arm: runtime.arm,
    pause: runtime.pause,
    dispose: runtime.dispose,
    step(input) {
      const axes = Object.fromEntries(
        ['roll', 'pitch', 'yaw', 'throttle'].map((key) => [key, input[key]]),
      );
      const before = runtime.snapshot().ticks;
      runtime.step(axes);
      if (runtime.snapshot().ticks > before) lastInput = quantizeFlightInput(axes);
      return snapshot();
    },
  });
}
