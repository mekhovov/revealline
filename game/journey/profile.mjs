import { boundedJSON, exactKeys } from '../data-json.mjs';
import { JOURNEY_MODES } from './catalog.mjs';

export const JOURNEY_PROFILE_VERSION = 'revealline-journey-profile.v1';
export const JOURNEY_PROFILE_DATABASE = 'revealline-journey-v1';
export const JOURNEY_BACKUP_VERSION = 'revealline-journey-backup.v1';
export const JOURNEY_SCOPED_BACKUP_VERSION = 'revealline-journey-backup.v2';
const emptyModes = (make) => Object.fromEntries(JOURNEY_MODES.map((mode) => [mode, make()]));
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 1024;
const own = (object, key) => Object.hasOwn(object, key);
function validateProfileKey(key) {
  if (typeof key !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(key))
    throw new TypeError('Journey storage needs a stable profile key.');
}

function inspectProfileBackup(source, profileKey) {
  if (profileKey === 'journey') {
    const backup = inspectJourneyBackup(source);
    return { backup, normalized: backup };
  }
  const backup = boundedJSON(source, {
    maxBytes: 8 * 1024 * 1024,
    maxNodes: 100012,
    maxDepth: 12,
    maxArray: 4096,
    maxString: 1024,
  });
  if (backup?.format !== JOURNEY_SCOPED_BACKUP_VERSION || backup.profileKey !== profileKey)
    throw new TypeError(
      'This backup belongs to a different Journey edition. Progress is unchanged.',
    );
  exactKeys(backup, ['format', 'profileKey', 'profile'], 'Scoped Journey backup');
  const normalized = {
    format: JOURNEY_BACKUP_VERSION,
    profile: validateJourneyProfile(backup.profile),
  };
  return {
    backup: { format: JOURNEY_SCOPED_BACKUP_VERSION, profileKey, profile: normalized.profile },
    normalized,
  };
}

export function emptyJourneyProfile() {
  return {
    format: JOURNEY_PROFILE_VERSION,
    generation: 0,
    cursors: emptyModes(() => null),
    skipped: emptyModes(() => []),
    clears: emptyModes(() => ({})),
  };
}

export function validateJourneyProfile(source) {
  const profile = boundedJSON(source, {
    maxBytes: 4 * 1024 * 1024,
    maxNodes: 100000,
    maxDepth: 10,
    maxArray: 4096,
    maxString: 1024,
  });
  exactKeys(profile, ['format', 'generation', 'cursors', 'skipped', 'clears'], 'Journey profile');
  if (
    profile.format !== JOURNEY_PROFILE_VERSION ||
    !Number.isSafeInteger(profile.generation) ||
    profile.generation < 0
  )
    throw new TypeError('Unsupported or damaged Journey profile. Export before recovery.');
  for (const field of ['cursors', 'skipped', 'clears'])
    exactKeys(profile[field], JOURNEY_MODES, `Journey ${field}`);
  for (const mode of JOURNEY_MODES) {
    if (
      !(profile.cursors[mode] === null || text(profile.cursors[mode])) ||
      !Array.isArray(profile.skipped[mode]) ||
      !profile.skipped[mode].every(text) ||
      new Set(profile.skipped[mode]).size !== profile.skipped[mode].length ||
      !profile.clears[mode] ||
      typeof profile.clears[mode] !== 'object' ||
      Array.isArray(profile.clears[mode])
    )
      throw new TypeError('Invalid Journey mode state.');
    for (const [id, receipt] of Object.entries(profile.clears[mode])) {
      exactKeys(receipt, ['runId', 'gameplayId', 'difficulty'], 'Journey completion receipt');
      if (
        !text(id) ||
        !text(receipt.runId) ||
        !text(receipt.gameplayId) ||
        !['gentle', 'standard', 'expert'].includes(receipt.difficulty)
      )
        throw new TypeError('Invalid Journey completion receipt.');
    }
  }
  return profile;
}

export function inspectJourneyBackup(source) {
  const backup = boundedJSON(source, {
    maxBytes: 8 * 1024 * 1024,
    maxNodes: 100010,
    maxDepth: 12,
    maxArray: 4096,
    maxString: 1024,
  });
  exactKeys(backup, ['format', 'profile'], 'Journey backup');
  if (backup.format !== JOURNEY_BACKUP_VERSION) throw new TypeError('Unsupported Journey backup.');
  return { format: JOURNEY_BACKUP_VERSION, profile: validateJourneyProfile(backup.profile) };
}

/** Non-destructive restore: current receipts/cursors win, skips never replace a
 * clear, and unknown mission IDs survive future/previous release round trips.
 * These local progress records grant no score, unlock, replay or award authority. */
export function mergeJourneyBackup(source, backupSource) {
  const profile = validateJourneyProfile(source),
    backup = inspectJourneyBackup(backupSource).profile;
  const before = JSON.stringify(profile);
  for (const mode of JOURNEY_MODES) {
    profile.cursors[mode] ??= backup.cursors[mode];
    for (const [id, receipt] of Object.entries(backup.clears[mode])) {
      if (!own(profile.clears[mode], id)) profile.clears[mode][id] = receipt;
    }
    profile.skipped[mode] = [
      ...new Set([...profile.skipped[mode], ...backup.skipped[mode]]),
    ].filter((id) => !own(profile.clears[mode], id));
  }
  if (JSON.stringify(profile) !== before) profile.generation++;
  return validateJourneyProfile(profile);
}

/** Events contain no score authority: the host supplies only verified legal clears. */
export function applyJourneyEvent(source, event) {
  if (event?.type === 'restore') {
    exactKeys(event, ['type', 'backup'], 'Journey restore event');
    return mergeJourneyBackup(source, event.backup);
  }
  const profile = validateJourneyProfile(source);
  if (
    !event ||
    !JOURNEY_MODES.includes(event.mode) ||
    !text(event.missionId) ||
    !['select', 'skip', 'complete'].includes(event.type)
  )
    throw new TypeError('Invalid Journey progress event.');
  const { mode, missionId } = event;
  if (event.type === 'select') profile.cursors[mode] = missionId;
  if (event.type === 'skip' && !profile.skipped[mode].includes(missionId))
    profile.skipped[mode].push(missionId);
  if (event.type === 'complete') {
    if (
      !text(event.runId) ||
      !text(event.gameplayId) ||
      !['gentle', 'standard', 'expert'].includes(event.difficulty)
    )
      throw new TypeError('Journey completion requires an exact gameplay receipt.');
    if (own(profile.clears[mode], missionId)) {
      const old = profile.clears[mode][missionId];
      if (old.runId === event.runId) {
        if (old.gameplayId !== event.gameplayId || old.difficulty !== event.difficulty)
          throw new TypeError('A Journey run cannot change its completion identity.');
        return profile;
      }
    }
    Object.defineProperty(profile.clears[mode], missionId, {
      enumerable: true,
      configurable: true,
      writable: true,
      value: { runId: event.runId, gameplayId: event.gameplayId, difficulty: event.difficulty },
    });
    profile.skipped[mode] = profile.skipped[mode].filter((id) => id !== missionId);
  }
  profile.generation++;
  return validateJourneyProfile(profile);
}

/** Each read/modify/write is one IndexedDB transaction, including across tabs. */
export function createJourneyBackend({
  indexedDB = globalThis.indexedDB,
  profileKey = 'journey',
} = {}) {
  // Content-review editions may isolate progress without changing the database
  // or historical default record. Never derive this key from a release version.
  validateProfileKey(profileKey);
  let opening;
  const open = () => {
    if (!indexedDB) return Promise.reject(new Error('Journey storage is unavailable.'));
    return (opening ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(JOURNEY_PROFILE_DATABASE, 1);
      let failed = false;
      const fail = (error) => {
        failed = true;
        opening = null;
        reject(error || new Error('Journey storage could not open.'));
      };
      request.onupgradeneeded = () => request.result.createObjectStore('profiles');
      request.onerror = () => fail(request.error);
      request.onblocked = () => fail(new Error('Close an older Journey tab to update storage.'));
      request.onsuccess = () => {
        const db = request.result;
        if (failed) {
          db.close();
          return;
        }
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
    }));
  };
  async function transaction(events) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('profiles', events.length ? 'readwrite' : 'readonly'),
        store = tx.objectStore('profiles'),
        read = store.get(profileKey);
      let next, failure;
      read.onsuccess = () => {
        try {
          next =
            read.result === undefined ? emptyJourneyProfile() : validateJourneyProfile(read.result);
          for (const event of events) next = applyJourneyEvent(next, event);
          if (events.length) store.put(next, profileKey);
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(next);
      tx.onabort = tx.onerror = () =>
        reject(failure || tx.error || new Error('Journey save failed.'));
    });
  }
  return { profileKey, read: () => transaction([]), commit: transaction };
}

/** In-memory adoption is immediate; persistence failure never prevents Next. */
export function createJourneyProfileStore({
  backend,
  profileKey = backend?.profileKey ?? 'journey',
  onStatus = () => {},
  operationTimeoutMs = 1500,
} = {}) {
  validateProfileKey(profileKey);
  backend ??= createJourneyBackend({ profileKey });
  if (backend.profileKey !== undefined && backend.profileKey !== profileKey)
    throw new TypeError('Journey backend and profile edition must agree.');
  if (!Number.isFinite(operationTimeoutMs) || operationTimeoutMs <= 0)
    throw new TypeError('Journey storage needs a positive operation timeout.');
  const bounded = (operation) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error('Journey storage is taking too long. Progress is kept in this session.'),
          ),
        operationTimeoutMs,
      );
      Promise.resolve()
        .then(operation)
        .then(resolve, reject)
        .finally(() => clearTimeout(timer));
    });
  let profile = emptyJourneyProfile(),
    pending = [],
    saving = null,
    ready = false,
    durable = false,
    error = null;
  const status = () => {
    const value = { ready, durable, pending: pending.length, error: error?.message ?? null };
    try {
      onStatus(value);
    } catch {
      // A presentation observer never owns persistence or progression.
    }
    return value;
  };
  const snapshot = () => structuredClone(profile);
  async function flush() {
    if (saving) return saving;
    saving = (async () => {
      try {
        // Loading and saving share one queue. An older read must never replace
        // a newly committed clear, including when play starts before load ends.
        const latest = validateJourneyProfile(await bounded(() => backend.read()));
        profile = pending.reduce(applyJourneyEvent, latest);
        while (pending.length) {
          const batch = [...pending];
          const saved = validateJourneyProfile(await bounded(() => backend.commit(batch)));
          pending = pending.slice(batch.length);
          profile = pending.reduce(applyJourneyEvent, saved);
        }
        durable = true;
        error = null;
      } catch (failure) {
        durable = false;
        error = failure;
      } finally {
        ready = true;
        saving = null;
        status();
      }
      return durable;
    })();
    return saving;
  }
  const recordEvents = (events) => {
    if (!Array.isArray(events) || events.length < 1 || events.length > 256)
      throw new TypeError('Journey progress needs one to 256 events per transaction.');
    const owned = structuredClone(events);
    // Validate the whole transition before publishing either its cursor or skip.
    // One status notification cannot expose a partially applied transition.
    const next = owned.reduce(applyJourneyEvent, profile);
    profile = next;
    pending.push(...owned);
    durable = false;
    status();
    void flush();
    return snapshot();
  };
  return {
    async load() {
      await flush();
      return snapshot();
    },
    snapshot,
    status,
    flush,
    backupFilename:
      profileKey === 'journey'
        ? 'revealline-journey-progress.json'
        : `revealline-${profileKey}-progress.json`,
    inspectBackup(source) {
      const { backup, normalized } = inspectProfileBackup(source, profileKey);
      return { backup, merged: mergeJourneyBackup(snapshot(), normalized) };
    },
    restore(source) {
      const owned = {
        type: 'restore',
        backup: inspectProfileBackup(source, profileKey).normalized,
      };
      profile = applyJourneyEvent(profile, owned);
      pending.push(owned);
      durable = false;
      status();
      void flush();
      return snapshot();
    },
    record(event) {
      return recordEvents([event]);
    },
    recordMany: recordEvents,
    export() {
      return JSON.stringify(
        profileKey === 'journey'
          ? { format: JOURNEY_BACKUP_VERSION, profile: snapshot() }
          : { format: JOURNEY_SCOPED_BACKUP_VERSION, profileKey, profile: snapshot() },
        null,
        2,
      );
    },
  };
}
