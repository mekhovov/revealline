import { emptyProgress, validateProgress, awardCompletion, PROGRESS_VERSION } from './progress.mjs';
import { CLASSES, RULESET, TURN_POLICIES, loadoutHash } from './core/registry.mjs';
import { normalizedLevel } from './core/level.mjs';
import { resolveKeyBindings } from './key-bindings.mjs';
import {
  boundedJSON,
  plainObject,
  stableId,
  exactKeys,
  required,
  dataIdentity,
  canonicalJSON,
} from './data-json.mjs';

export const LIBRARY_VERSION = 'xonix-library.v1';
export const LIBRARY_LIMITS = Object.freeze({
  maxBytes: 4 * 1024 * 1024,
  campaigns: 512,
  gallery: 4096,
  scores: 1000,
  perBoard: 10,
});
export class LibraryCapacityError extends RangeError {
  constructor(resource, used, limit) {
    super(
      `Library ${resource} budget exceeded${used === null ? '' : ` (${used}/${limit})`}. Existing records are preserved; export a backup and archive a library before adding more.`,
    );
    this.name = 'LibraryCapacityError';
    this.code = 'library-capacity';
    this.resource = resource;
    this.used = used;
    this.limit = limit;
  }
}
const capacity = (resource, used, limit) => {
  if (used > limit) throw new LibraryCapacityError(resource, used, limit);
};
export const LIBRARY_STORAGE_VERSION = 'xonix-library-storage.v1';
export const DEFAULT_PREFERENCES = Object.freeze({
  themeId: 'fpv',
  bodyId: 'fpv-body',
  classId: 'scout',
  turnPolicy: 'immediate',
  tapSteering: null,
  keyboardBindings: null,
  style: 'hybrid',
  showGrid: false,
  matchClassAppearance: true,
  reducedEffects: false,
  musicEnabled: false,
  musicGenre: 'synthwave',
  masterVolume: 0.8,
  musicVolume: 0.45,
  sfxVolume: 0.6,
});
const finite = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
const text = (v, limit = 160) => typeof v === 'string' && v.trim().length > 0 && v.length <= limit;
const stamp = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
const uint32 = (v) => Number.isInteger(v) && finite(v, 0, 0xffffffff);
const campaignKeyValid = (v) =>
  typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}\/[^/]{1,180}\/[0-9a-f]{16}$/.test(v);
const medalValid = (v) => ['bronze', 'silver', 'gold'].includes(v);
const sortScores = (a, b) =>
  b.score - a.score ||
  a.time - b.time ||
  a.completedAt.localeCompare(b.completedAt) ||
  a.runId.localeCompare(b.runId);
export function campaignKey(campaign) {
  required(stableId(campaign?.id) && text(campaign?.revision, 60), 'Campaign identity is invalid.');
  return `${campaign.id}/${encodeURIComponent(campaign.revision)}/${dataIdentity({ ruleset: RULESET, levels: campaign.levels.map(normalizedLevel), classRecipes: campaign.classRecipes ?? CLASSES })}`;
}
export function boardIdentity({ campaign, level, recipe, turnPolicy, seed, classRoute = [] }) {
  required(
    TURN_POLICIES.includes(turnPolicy) && uint32(seed),
    'Board steering or seed is invalid.',
  );
  return `board-v1-${dataIdentity({ campaignKey: campaignKey(campaign), level: normalizedLevel(level), recipe, turnPolicy, seed, classRoute })}`;
}
export function emptyLibrary() {
  return {
    format: LIBRARY_VERSION,
    preferences: { ...DEFAULT_PREFERENCES },
    campaigns: {},
    gallery: [],
    scores: [],
  };
}
function preferencesValid(preferences) {
  exactKeys(preferences, Object.keys(DEFAULT_PREFERENCES), 'preferences');
  for (const key of ['themeId', 'bodyId', 'classId'])
    required(stableId(preferences[key]), `preferences.${key} is invalid.`);
  required(TURN_POLICIES.includes(preferences.turnPolicy), 'preferences.turnPolicy is invalid.');
  required(
    preferences.tapSteering === null || typeof preferences.tapSteering === 'boolean',
    'preferences.tapSteering must be null (device default), true or false.',
  );
  if (preferences.keyboardBindings !== null)
    preferences.keyboardBindings = resolveKeyBindings(preferences.keyboardBindings);
  required(
    ['hybrid', 'microtile', 'props'].includes(preferences.style),
    'preferences.style is invalid.',
  );
  for (const key of ['showGrid', 'reducedEffects', 'musicEnabled', 'matchClassAppearance'])
    required(typeof preferences[key] === 'boolean', `preferences.${key} must be boolean.`);
  required(
    ['synthwave', 'chiptune', 'rock', 'metal', 'ambient'].includes(preferences.musicGenre),
    'preferences.musicGenre is invalid.',
  );
  for (const key of ['masterVolume', 'musicVolume', 'sfxVolume'])
    required(finite(preferences[key], 0, 1), `preferences.${key} must be 0..1.`);
}
function stats(value, withVariants = false) {
  exactKeys(
    value,
    ['score', 'time', 'medals', 'clean', ...(withVariants ? ['variants'] : [])],
    'progress record',
  );
  required(
    finite(value.score, 0, 1e9) &&
      finite(value.time, 0, 7200) &&
      Number.isInteger(value.medals) &&
      finite(value.medals, 1, 3) &&
      typeof value.clean === 'boolean',
    'Progress statistics are invalid.',
  );
  if (withVariants) {
    required(
      plainObject(value.variants) &&
        Object.keys(value.variants).length > 0 &&
        Object.keys(value.variants).length <= 256,
      'Progress variants are invalid.',
    );
    for (const [key, v] of Object.entries(value.variants)) {
      const parts = key.split('/');
      required(
        (parts.length === 5 ||
          (parts.length === 7 &&
            /^roster-v1-[0-9a-f]{8}$/.test(parts[5]) &&
            /^route-v1-[0-9a-f]{16}$/.test(parts[6]))) &&
          TURN_POLICIES.includes(parts[0]) &&
          stableId(parts[1]) &&
          text(parts[2], 240) &&
          /^loadout-v1-[0-9a-f]{8}$/.test(parts[3]) &&
          /^(0|[1-9]\d*)$/.test(parts[4]) &&
          uint32(Number(parts[4])),
        'Progress variant identity is invalid.',
      );
      try {
        required(
          encodeURIComponent(decodeURIComponent(parts[2])) === parts[2],
          'Progress revision encoding is invalid.',
        );
      } catch {
        throw new TypeError('Progress revision encoding is invalid.');
      }
      stats(v);
    }
  }
}
function genericProgress(progress) {
  exactKeys(progress, ['version', 'campaignId', 'revision', 'clears', 'seen'], 'progress');
  required(
    progress.version === PROGRESS_VERSION &&
      stableId(progress.campaignId) &&
      text(progress.revision, 60),
    'Progress identity is invalid.',
  );
  required(
    plainObject(progress.clears) && Object.keys(progress.clears).length <= 128,
    'Progress clears are invalid.',
  );
  for (const [key, value] of Object.entries(progress.clears)) {
    required(stableId(key), 'Level identity is invalid.');
    stats(value, true);
  }
  required(
    Array.isArray(progress.seen) &&
      progress.seen.length <= 256 &&
      progress.seen.every((v) => text(v, 159)) &&
      new Set(progress.seen).size === progress.seen.length,
    'Progress run identities are invalid.',
  );
}
function checkLibrary(candidate, { campaigns = [] } = {}) {
  let value;
  try {
    value = boundedJSON(candidate, {
      maxBytes: LIBRARY_LIMITS.maxBytes,
      maxNodes: 500000,
      maxArray: 8192,
    });
  } catch (error) {
    if (/byte budget/.test(error.message))
      throw new LibraryCapacityError('bytes', null, LIBRARY_LIMITS.maxBytes);
    throw error;
  }
  exactKeys(value, ['format', 'preferences', 'campaigns', 'gallery', 'scores'], 'library');
  required(value.format === LIBRARY_VERSION, 'Unsupported player library version.');
  // Additive v1 preference migration preserves already-saved release-candidate profiles.
  if (plainObject(value.preferences) && !Object.hasOwn(value.preferences, 'matchClassAppearance'))
    value.preferences.matchClassAppearance = false;
  if (plainObject(value.preferences) && !Object.hasOwn(value.preferences, 'masterVolume'))
    value.preferences.masterVolume = DEFAULT_PREFERENCES.masterVolume;
  if (plainObject(value.preferences) && !Object.hasOwn(value.preferences, 'tapSteering'))
    value.preferences.tapSteering = DEFAULT_PREFERENCES.tapSteering;
  if (plainObject(value.preferences) && !Object.hasOwn(value.preferences, 'keyboardBindings'))
    value.preferences.keyboardBindings = DEFAULT_PREFERENCES.keyboardBindings;
  preferencesValid(value.preferences);
  required(plainObject(value.campaigns), 'Library campaigns must be an object.');
  capacity('campaigns', Object.keys(value.campaigns).length, LIBRARY_LIMITS.campaigns);
  const known = new Map(campaigns.map((c) => [campaignKey(c), c]));
  for (const [key, progress] of Object.entries(value.campaigns)) {
    required(campaignKeyValid(key), 'Library campaign key is invalid.');
    genericProgress(progress);
    required(
      key.startsWith(`${progress.campaignId}/${encodeURIComponent(progress.revision)}/`),
      'Progress does not match its campaign identity.',
    );
    if (known.has(key))
      required(
        validateProgress(progress, known.get(key)),
        'Saved progress does not match this campaign.',
      );
  }
  required(Array.isArray(value.gallery), 'Gallery must be an array.');
  capacity('gallery', value.gallery.length, LIBRARY_LIMITS.gallery);
  const galleryKeys = new Set();
  for (const item of value.gallery) {
    if (plainObject(item) && !Object.hasOwn(item, 'seed')) item.seed = 1;
    exactKeys(
      item,
      [
        'key',
        'campaignKey',
        'levelId',
        'levelRevision',
        'levelName',
        'themeId',
        'bodyId',
        'sourcePackId',
        'seed',
        'score',
        'time',
        'medal',
        'completedAt',
        'runId',
      ],
      'gallery entry',
    );
    required(
      /^gallery-v1-[0-9a-f]{16}$/.test(item.key) && !galleryKeys.has(item.key),
      'Gallery identity is invalid or duplicated.',
    );
    galleryKeys.add(item.key);
    required(
      campaignKeyValid(item.campaignKey) &&
        Object.hasOwn(value.campaigns, item.campaignKey) &&
        Object.hasOwn(value.campaigns[item.campaignKey].clears, item.levelId),
      'Gallery entry needs a completed level.',
    );
    for (const key of ['levelId', 'themeId', 'bodyId'])
      required(stableId(item[key]), `Gallery ${key} is invalid.`);
    required(
      item.sourcePackId === null || stableId(item.sourcePackId),
      'Gallery pack identity is invalid.',
    );
    required(
      uint32(item.seed) &&
        text(item.levelRevision, 80) &&
        text(item.levelName, 280) &&
        text(item.runId, 159) &&
        finite(item.score, 0, 1e9) &&
        finite(item.time, 0, 7200) &&
        medalValid(item.medal) &&
        stamp(item.completedAt),
      'Gallery metadata is invalid.',
    );
    required(
      item.key === `gallery-v1-${dataIdentity([item.campaignKey, item.levelId, item.themeId])}`,
      'Gallery key does not match its content.',
    );
  }
  required(
    Array.isArray(value.scores) && value.scores.length <= LIBRARY_LIMITS.scores,
    'Local scoreboard budget exceeded.',
  );
  const scoreIds = new Set(),
    counts = new Map();
  for (const item of value.scores) {
    exactKeys(
      item,
      [
        'boardId',
        'campaignKey',
        'levelId',
        'levelName',
        'classId',
        'classRevision',
        'turnPolicy',
        'seed',
        'score',
        'time',
        'medal',
        'completedAt',
        'runId',
        'switches',
        'classRoute',
      ],
      'local score',
    );
    const key = `${item.boardId}/${item.runId}`;
    required(
      /^board-v1-[0-9a-f]{16}$/.test(item.boardId) && !scoreIds.has(key),
      'Score identity is invalid or duplicated.',
    );
    scoreIds.add(key);
    counts.set(item.boardId, (counts.get(item.boardId) ?? 0) + 1);
    required(
      counts.get(item.boardId) <= LIBRARY_LIMITS.perBoard,
      'Scoreboard has too many entries for this board.',
    );
    required(
      campaignKeyValid(item.campaignKey) &&
        Object.hasOwn(value.campaigns, item.campaignKey) &&
        Object.hasOwn(value.campaigns[item.campaignKey].clears, item.levelId),
      'Scores need a completed campaign level.',
    );
    required(
      stableId(item.levelId) &&
        stableId(item.classId) &&
        text(item.levelName, 280) &&
        text(item.classRevision, 80) &&
        TURN_POLICIES.includes(item.turnPolicy) &&
        uint32(item.seed),
      'Score configuration is invalid.',
    );
    required(
      finite(item.score, 0, 1e9) &&
        finite(item.time, 0, 7200) &&
        medalValid(item.medal) &&
        stamp(item.completedAt) &&
        text(item.runId, 159),
      'Score statistics are invalid.',
    );
    required(
      Number.isInteger(item.switches) &&
        finite(item.switches, 0, 4096) &&
        Array.isArray(item.classRoute) &&
        item.classRoute.length > 0 &&
        item.classRoute.length <= 128 &&
        item.classRoute.every(stableId) &&
        item.classRoute[0] === item.classId,
      'Score class route is invalid.',
    );
  }
  return value;
}
export function validateLibrary(value, options) {
  try {
    checkLibrary(value, options);
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}
export function importLibrary(candidate, options) {
  required(candidate !== null && candidate !== undefined, 'Choose a player library to import.');
  // A recovered local storage envelope is also usable as an explicit import;
  // its old storage generation is deliberately not adopted by the caller.
  return storedLibrary(candidate, options).library;
}
export function exportLibrary(library) {
  return JSON.stringify(checkLibrary(library));
}
export function progressFor(library, campaign) {
  const progress = library.campaigns[campaignKey(campaign)];
  return progress && validateProgress(progress, campaign)
    ? structuredClone(progress)
    : emptyProgress(campaign);
}
export function setCampaignProgress(library, campaign, progress) {
  const next = checkLibrary(library);
  required(validateProgress(progress, campaign), 'Cannot import incompatible campaign progress.');
  genericProgress(progress);
  next.campaigns[campaignKey(campaign)] = structuredClone(progress);
  return checkLibrary(next, { campaigns: [campaign] });
}
export function updatePreferences(library, patch) {
  const next = checkLibrary(library),
    safe = boundedJSON(patch);
  exactKeys(safe, Object.keys(DEFAULT_PREFERENCES), 'preferences');
  next.preferences = { ...next.preferences, ...safe };
  preferencesValid(next.preferences);
  return next;
}
export function recordLibraryCompletion(
  library,
  {
    campaign,
    result,
    runId,
    themeId,
    bodyId,
    completedAt = new Date().toISOString(),
    sourcePackId = null,
    practice = false,
  },
) {
  const next = checkLibrary(library),
    old = progressFor(next, campaign);
  const progress = awardCompletion(old, campaign, result, { runId, practice });
  if (progress === old) return library;
  const key = campaignKey(campaign),
    level = campaign.levels.find((l) => l.id === result.levelId),
    recipe = (campaign.classRecipes ?? CLASSES).find((c) => c.id === result.classId);
  next.campaigns[key] = progress;
  const galleryKey = `gallery-v1-${dataIdentity([key, level.id, themeId])}`;
  const gallery = {
    key: galleryKey,
    campaignKey: key,
    levelId: level.id,
    levelRevision: level.revision,
    levelName: level.name,
    themeId,
    bodyId,
    sourcePackId,
    seed: result.seed,
    score: result.score,
    time: result.time,
    medal: result.medal,
    completedAt,
    runId,
  };
  const previous = next.gallery.find((entry) => entry.key === galleryKey);
  if (
    !previous ||
    result.score > previous.score ||
    (result.score === previous.score && result.time < previous.time)
  )
    next.gallery = [gallery, ...next.gallery.filter((entry) => entry.key !== galleryKey)];
  const history = result.classHistory ?? [
    {
      classId: result.classId,
      classRevision: result.classRevision,
      loadoutHash: result.loadoutHash,
      tick: 0,
    },
  ];
  required(
    Array.isArray(history) && history.length > 0 && history.length <= 4096,
    'Class history is invalid.',
  );
  const classRoute = [];
  for (const entry of history) {
    const c = (campaign.classRecipes ?? CLASSES).find((r) => r.id === entry.classId);
    required(
      c &&
        entry.classRevision === c.revision &&
        entry.loadoutHash === loadoutHash(c) &&
        Number.isInteger(entry.tick) &&
        entry.tick >= 0,
      'Class history does not match the registered roster.',
    );
    if (classRoute.at(-1) !== entry.classId) classRoute.push(entry.classId);
  }
  const switches = result.switches ?? Math.max(0, history.length - 1);
  // Very long switch routes still award the completion/gallery but deliberately do not bloat local score files.
  if (classRoute.length <= 128) {
    const boardId = boardIdentity({
      campaign,
      level,
      recipe,
      turnPolicy: result.turnPolicy,
      seed: result.seed,
      classRoute,
    });
    const entry = {
      boardId,
      campaignKey: key,
      levelId: level.id,
      levelName: level.name,
      classId: recipe.id,
      classRevision: recipe.revision,
      turnPolicy: result.turnPolicy,
      seed: result.seed,
      score: result.score,
      time: result.time,
      medal: result.medal,
      completedAt,
      runId,
      switches,
      classRoute,
    };
    const same = [...next.scores.filter((r) => r.boardId === boardId && r.runId !== runId), entry]
      .sort(sortScores)
      .slice(0, LIBRARY_LIMITS.perBoard);
    next.scores = [...same, ...next.scores.filter((r) => r.boardId !== boardId)].slice(
      0,
      LIBRARY_LIMITS.scores,
    );
  }
  return checkLibrary(next, { campaigns: [campaign] });
}
export function scoresFor(library, boardId) {
  return library.scores
    .filter((entry) => entry.boardId === boardId)
    .map((entry) => structuredClone(entry))
    .sort(sortScores);
}
/** Readout is bounded by the same validator as save/export, not a quota guarantee. */
export function libraryCapacity(library) {
  const value = checkLibrary(library),
    bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  return {
    bytes,
    maxBytes: LIBRARY_LIMITS.maxBytes,
    percent: (bytes / LIBRARY_LIMITS.maxBytes) * 100,
    campaigns: Object.keys(value.campaigns).length,
    maxCampaigns: LIBRARY_LIMITS.campaigns,
    gallery: value.gallery.length,
    maxGallery: LIBRARY_LIMITS.gallery,
    scores: value.scores.length,
    maxScores: LIBRARY_LIMITS.scores,
  };
}
const combinedStats = (a, b) => ({
  score: Math.max(a.score, b.score),
  time: Math.min(a.time, b.time),
  medals: Math.max(a.medals, b.medals),
  clean: a.clean || b.clean,
});
/** Ordinary concurrent writes combine achievements; explicit replacement uses a new generation. */
export function mergeLibraries(local, remote, { baseline = null } = {}) {
  const left = checkLibrary(local),
    right = checkLibrary(remote),
    base = baseline === null ? null : checkLibrary(baseline);
  const next = structuredClone(right);
  for (const key of Object.keys(DEFAULT_PREFERENCES))
    if (!base || canonicalJSON(left.preferences[key]) !== canonicalJSON(base.preferences[key]))
      next.preferences[key] = left.preferences[key];
  for (const [key, localProgress] of Object.entries(left.campaigns)) {
    const remoteProgress = next.campaigns[key];
    if (!remoteProgress) {
      next.campaigns[key] = localProgress;
      continue;
    }
    for (const [levelId, localClear] of Object.entries(localProgress.clears)) {
      const remoteClear = remoteProgress.clears[levelId];
      if (!remoteClear) {
        remoteProgress.clears[levelId] = localClear;
        continue;
      }
      // Remote additions follow the local baseline; both sides' aggregate bests survive.
      const variants = { ...localClear.variants };
      for (const [id, stats] of Object.entries(remoteClear.variants))
        variants[id] = variants[id] ? combinedStats(variants[id], stats) : stats;
      remoteProgress.clears[levelId] = {
        ...combinedStats(localClear, remoteClear),
        variants: Object.fromEntries(Object.entries(variants).slice(-256)),
      };
    }
    remoteProgress.seen = [...new Set([...remoteProgress.seen, ...localProgress.seen])].slice(-256);
  }
  const gallery = new Map(right.gallery.map((entry) => [entry.key, entry]));
  for (const entry of left.gallery) {
    const old = gallery.get(entry.key);
    if (!old || sortScores(entry, old) < 0) gallery.set(entry.key, entry);
  }
  next.gallery = [...gallery.values()].sort(
    (a, b) => b.completedAt.localeCompare(a.completedAt) || a.key.localeCompare(b.key),
  );
  const scoreRows = new Map();
  for (const entry of [...right.scores, ...left.scores]) {
    const id = `${entry.boardId}/${entry.runId}`,
      old = scoreRows.get(id);
    if (!old || sortScores(entry, old) < 0) scoreRows.set(id, entry);
  }
  const groups = new Map();
  for (const entry of scoreRows.values()) {
    const group = groups.get(entry.boardId) || [];
    group.push(entry);
    groups.set(entry.boardId, group);
  }
  next.scores = [...groups.values()]
    .flatMap((group) => group.sort(sortScores).slice(0, LIBRARY_LIMITS.perBoard))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt) || sortScores(a, b))
    .slice(0, LIBRARY_LIMITS.scores);
  return checkLibrary(next);
}
function storedLibrary(raw, options) {
  if (raw === null) return { library: emptyLibrary(), generation: 'legacy' };
  let value;
  try {
    value = boundedJSON(raw, {
      maxBytes: LIBRARY_LIMITS.maxBytes + 4096,
      maxNodes: 500000,
      maxArray: 8192,
    });
  } catch (error) {
    if (
      typeof raw === 'string' &&
      new TextEncoder().encode(raw).byteLength > LIBRARY_LIMITS.maxBytes
    )
      throw new LibraryCapacityError('bytes', null, LIBRARY_LIMITS.maxBytes);
    throw error;
  }
  if (value.format !== LIBRARY_STORAGE_VERSION)
    return { library: checkLibrary(value, options), generation: 'legacy' };
  exactKeys(value, ['format', 'generation', 'library'], 'stored library');
  required(
    value.generation === 'legacy' || /^generation-[a-zA-Z0-9-]{1,100}$/.test(value.generation),
    'Stored library generation is invalid.',
  );
  return { library: checkLibrary(value.library, options), generation: value.generation };
}
export function loadLibrary(storage, key, options) {
  let raw = null;
  try {
    raw = storage.getItem(key);
    return { ...storedLibrary(raw, options), warning: '', recovery: null };
  } catch {
    return {
      library: emptyLibrary(),
      generation: 'legacy',
      warning:
        'The player library could not be read. Existing bytes will be preserved before replacement; export your session if storage is unavailable.',
      recovery: raw,
    };
  }
}
/** `baseline` is the last adopted profile, not the edited candidate. Successful
 * callers adopt both returned library and generation. A replacement (import,
 * Undo or explicit archive reset) invalidates older tabs instead of resurrecting
 * deliberately removed records. Portable exports remain raw xonix-library.v1.
 */
export function saveLibrary(...args) {
  return saveLibraryAttempt(...args);
}
function saveLibraryAttempt(
  storage,
  key,
  library,
  recovery = null,
  {
    baseline = null,
    generation = 'legacy',
    mode = 'merge',
    writeLock = { key: `${key}.backup-lock`, token: null },
  } = {},
  attempt = 0,
) {
  let candidate = library;
  try {
    required(['merge', 'replace'].includes(mode), 'Unsupported library save mode.');
    candidate = checkLibrary(library);
    required(
      plainObject(writeLock) &&
        typeof writeLock.key === 'string' &&
        (writeLock.token === null || typeof writeLock.token === 'string'),
      'Library write lock is invalid.',
    );
    const locked = () => {
      const token = storage.getItem(writeLock.key);
      return token !== null && token !== writeLock.token;
    };
    if (locked())
      return {
        ok: false,
        conflict: true,
        library: candidate,
        generation,
        warning:
          'A backup import or recovery is updating this library. Local progress is kept in this tab; wait for it to finish before saving or export your session.',
      };
    const raw = storage.getItem(key);
    let current;
    try {
      current = storedLibrary(raw);
    } catch (error) {
      if (recovery !== null && (raw === recovery || raw === null))
        current = { library: emptyLibrary(), generation };
      else
        return {
          ok: false,
          conflict: true,
          library: candidate,
          generation,
          warning:
            'The stored library changed or could not be read. Your local progress is kept in this tab; export it before reloading or replacing the saved profile.',
        };
    }
    if (mode === 'merge' && current.generation !== generation)
      return {
        ok: false,
        conflict: true,
        library: candidate,
        generation,
        warning:
          'Another tab imported or replaced this player library. Your local progress is kept in this tab; export it, then reload before choosing which library to keep.',
      };
    const merged =
      mode === 'replace' ? candidate : mergeLibraries(candidate, current.library, { baseline });
    const nextGeneration =
      mode === 'replace'
        ? `generation-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
        : generation;
    const encoded = JSON.stringify({
      format: LIBRARY_STORAGE_VERSION,
      generation: nextGeneration,
      library: merged,
    });
    if (recovery !== null) {
      const prefix = `${key}.recovery.${Date.now()}`;
      let backup = prefix,
        suffix = 0;
      while (storage.getItem(backup) !== null) {
        required(++suffix <= 1000, 'Too many recovery files.');
        backup = `${prefix}.${suffix}`;
      }
      storage.setItem(backup, recovery);
    }
    required(
      !locked(),
      'A backup import acquired the library lock. Local progress is kept in this tab.',
    );
    // A merge may be expensive for a large library. Re-read before committing
    // rather than overwriting a value another tab wrote during that work.
    if (storage.getItem(key) !== raw) {
      if (mode === 'merge' && attempt < 2)
        return saveLibraryAttempt(
          storage,
          key,
          library,
          recovery,
          { baseline, generation, mode, writeLock },
          attempt + 1,
        );
      return {
        ok: false,
        conflict: true,
        library: candidate,
        generation,
        warning:
          'The library changed again while saving. Your local progress is kept in this tab; retry saving or export it before reloading.',
      };
    }
    storage.setItem(key, encoded);
    return {
      ok: true,
      warning: '',
      library: merged,
      generation: nextGeneration,
      capacity: libraryCapacity(merged),
    };
  } catch (error) {
    return {
      ok: false,
      library: candidate,
      generation,
      capacityError:
        error instanceof LibraryCapacityError
          ? { code: error.code, resource: error.resource, used: error.used, limit: error.limit }
          : null,
      warning: `Library remains available in this session; export a backup. ${error.message.slice(0, 240)}`,
    };
  }
}
