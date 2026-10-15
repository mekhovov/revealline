import { attitude } from './math.mjs';
import { quantizeFlightInput } from './model.mjs';
import { createRegionalFlightPrototype } from './regional/flight-prototype.mjs';
import { validateRegionManifest } from './regional/region-manifest.mjs';
import {
  validateRegionalLocationStart,
  validateSavedRegionalLocation,
} from './regional-locations.mjs';

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
        min: { x: grid.minX * grid.cellSizeMm, y: grid.floorMm, z: grid.minZ * grid.cellSizeMm },
        max: {
          x: (grid.minX + grid.width) * grid.cellSizeMm,
          y: grid.ceilingMm,
          z: (grid.minZ + grid.depth) * grid.cellSizeMm,
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
export function regionalLibraryEntry(configuration, { sha256, descriptor = null } = {}) {
  if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256))
    throw new TypeError('Installed regional identity is required');
  const entry = regionalReviewEntry(configuration, { installedIdentity: sha256 });
  if (descriptor) {
    if (descriptor.id !== entry.course.id ||
        typeof descriptor.revision !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(descriptor.revision) ||
        !['en', 'uk'].every((locale) => typeof descriptor.title?.[locale] === 'string' &&
          descriptor.title[locale].trim() && descriptor.title[locale].length <= 120))
      throw new TypeError('Installed regional presentation identity is invalid');
    // Delivery revisions may intentionally retain the older source manifest title.
    // Keep the exact installed name/version visible without changing source authority.
    entry.installedRevision = descriptor.revision;
    for (const locale of ['en', 'uk']) entry.course.locales[locale].title = descriptor.title[locale];
  }
  return entry;
}

/** Select only an authored start in the currently verified regional configuration. */
export function regionalStartingPoint(entry, spawnId) {
  if (!entry?.regional || entry.course?.format !== 'FPVRegionalFlightPresentation.v1')
    throw new TypeError('A current regional flight is required');
  const manifest = validateRegionManifest(entry.configuration.manifest);
  if (typeof spawnId !== 'string' || !manifest.spawns.some((spawn) => spawn.id === spawnId))
    throw new TypeError('Unknown regional starting point');
  const configuration = { ...entry.configuration };
  delete configuration.savedStart;
  return { ...entry, configuration: { ...configuration, manifest, spawnId } };
}

/** Bookmarks belong to one exact installed descriptor, never a similarly named revision. */
export function regionalLocationIdentity(entry) {
  if (
    !entry?.regional ||
    entry.regionalReview ||
    !/^regional-installed:[a-f0-9]{64}$/.test(entry.packIdentity)
  )
    throw new TypeError('Installed regional flight is required');
  const manifest = validateRegionManifest(entry.configuration.manifest);
  return {
    regionId: manifest.id,
    revision: manifest.revision,
    sha256: entry.packIdentity.slice(19),
  };
}

export function regionalSavedLocation(entry, value) {
  const location = validateSavedRegionalLocation(value, regionalLocationIdentity(entry));
  const savedStart = validateRegionalLocationStart(location.pose, entry.configuration.manifest);
  return { ...entry, configuration: { ...entry.configuration, savedStart } };
}

/** The production host owns input, menus and arming; this adapter owns only regional state. */
export function createRegionalSession(configuration) {
  const runtime = createRegionalFlightPrototype({ ...configuration, continuous: true });
  let lastInput = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
  const present = (state) => {
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
    snapshot: () => present(runtime.snapshot()),
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
      const state = runtime.step(axes);
      if (state.ticks > before) lastInput = quantizeFlightInput(axes);
      return present(state);
    },
  });
}

/** Presentation-only diagnosis: a graphics deadline is not missing regional source. */
export function regionalPreparationFeedback({
  stage = 'source',
  timedOut = false,
  error,
  savedStart = false,
  contextLost = false,
} = {}) {
  if (contextLost)
    return {
      kind: 'context-lost',
      restoreUnavailable: false,
      en: 'Graphics interrupted. Open Menu and Retry after graphics recover.',
      uk: 'Графіку перервано. Відкрийте меню й повторіть політ після її відновлення.',
    };
  const timeout = timedOut || error?.name === 'TimeoutError';
  if (timeout && stage === 'graphics')
    return {
      kind: 'graphics-timeout',
      restoreUnavailable: false,
      en: 'Graphics preparation took too long. Open Menu, choose Performance graphics and Retry. Flight remains paused.',
      uk: 'Підготовка графіки триває надто довго. Відкрийте меню, виберіть графіку «Швидкодія» і повторіть. Політ залишається на паузі.',
    };
  if (timeout)
    return {
      kind: 'source-timeout',
      restoreUnavailable: false,
      en: 'Area preparation took too long. Open Menu and Retry. Flight remains paused.',
      uk: 'Підготовка ділянки триває надто довго. Відкрийте меню й повторіть. Політ залишається на паузі.',
    };
  if (error?.name === 'AbortError')
    return {
      kind: 'cancelled',
      restoreUnavailable: false,
      en: 'Preparation paused. Open Menu and Retry when ready.',
      uk: 'Підготовку призупинено. Відкрийте меню й повторіть, коли будете готові.',
    };
  if (stage === 'graphics')
    return {
      kind: 'graphics-failed',
      restoreUnavailable: false,
      en: 'Graphics could not be prepared. Open Menu, choose Performance graphics and Retry.',
      uk: 'Не вдалося підготувати графіку. Відкрийте меню, виберіть графіку «Швидкодія» і повторіть.',
    };
  if (savedStart)
    return {
      kind: 'saved-place',
      restoreUnavailable: true,
      en: 'Saved place unavailable. Choose a clear starting point.',
      uk: 'Збережене місце недоступне. Виберіть вільне місце старту.',
    };
  return {
    kind: 'source-failed',
    restoreUnavailable: false,
    en: 'Area could not be prepared. Open Menu and Retry, or choose another starting point.',
    uk: 'Не вдалося підготувати ділянку. Відкрийте меню й повторіть або виберіть інше місце старту.',
  };
}
