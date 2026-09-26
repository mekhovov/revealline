import { boundedJSON, exactKeys } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import { JOURNEY_MODES } from './catalog.mjs';
import {
  emptyJourneyPictures,
  validateJourneyPictures,
  validateJourneyPictureCompletions,
  applyJourneyPictureEvent,
} from './pictures.mjs';

export const JOURNEY_PROFILE_VERSION = 'revealline-journey-profile.v1';
export const JOURNEY_PROFILE_DATABASE = 'revealline-journey-v1';
export const JOURNEY_BACKUP_VERSION = 'revealline-journey-backup.v1';
export const JOURNEY_SCOPED_BACKUP_VERSION = 'revealline-journey-backup.v2';
export const JOURNEY_PICTURE_BACKUP_VERSION = 'revealline-journey-backup.v3';
const emptyModes = (make) => Object.fromEntries(JOURNEY_MODES.map((mode) => [mode, make()]));
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 1024;
const own = (object, key) => Object.hasOwn(object, key);
const journeyStructuralMessages = {
  object: () => t('errors:journey.objectRequired'),
  unsupported: ({ key }) => t('errors:journey.unsupportedField', { key }),
};
const exactJourneyKeys = (value, allowed, label) =>
  exactKeys(value, allowed, label, journeyStructuralMessages);
function validateProfileKey(key) {
  if (typeof key !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(key))
    throw new TypeError(t('errors:journey.stableProfileKeyRequired'));
}

function pictureEditionId(profileKey) {
  if (profileKey === 'journey') return null;
  return profileKey.startsWith('journey-') ? profileKey.slice('journey-'.length) : profileKey;
}

function inspectProfileBackup(source, profileKey) {
  const candidate = boundedJSON(source, { maxBytes: 16 * 1024 * 1024, maxNodes: 200020 });
  if (candidate?.format === JOURNEY_PICTURE_BACKUP_VERSION) {
    exactJourneyKeys(
      candidate,
      ['format', 'profileKey', 'profile', 'pictures'],
      'Journey picture backup',
    );
    if (candidate.profileKey !== profileKey)
      throw new TypeError(t('errors:journey.differentEdition'));
    const profile = validateJourneyProfile(candidate.profile),
      pictures = validateJourneyPictureCompletions(profile, candidate.pictures, {
        editionId: pictureEditionId(profileKey),
      });
    return {
      backup: { ...candidate, profile, pictures },
      normalized: { format: JOURNEY_BACKUP_VERSION, profile },
      pictures,
    };
  }

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
    throw new TypeError(t('errors:journey.differentEdition'));
  exactJourneyKeys(backup, ['format', 'profileKey', 'profile'], 'Scoped Journey backup');
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
  exactJourneyKeys(
    profile,
    ['format', 'generation', 'cursors', 'skipped', 'clears'],
    'Journey profile',
  );
  if (
    profile.format !== JOURNEY_PROFILE_VERSION ||
    !Number.isSafeInteger(profile.generation) ||
    profile.generation < 0
  )
    throw new TypeError(t('errors:journey.damagedProfile'));
  for (const field of ['cursors', 'skipped', 'clears'])
    exactJourneyKeys(profile[field], JOURNEY_MODES, `Journey ${field}`);
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
      throw new TypeError(t('errors:journey.invalidModeState'));
    for (const [id, receipt] of Object.entries(profile.clears[mode])) {
      exactJourneyKeys(
        receipt,
        ['runId', 'gameplayId', 'difficulty'],
        'Journey completion receipt',
      );
      if (
        !text(id) ||
        !text(receipt.runId) ||
        !text(receipt.gameplayId) ||
        !['gentle', 'standard', 'expert'].includes(receipt.difficulty)
      )
        throw new TypeError(t('errors:journey.invalidCompletionReceipt'));
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
  exactJourneyKeys(backup, ['format', 'profile'], 'Journey backup');
  if (backup.format !== JOURNEY_BACKUP_VERSION)
    throw new TypeError(t('errors:journey.unsupportedBackup'));
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
    exactJourneyKeys(event, ['type', 'backup'], 'Journey restore event');
    return mergeJourneyBackup(source, event.backup);
  }
  const profile = validateJourneyProfile(source);
  if (
    !event ||
    !JOURNEY_MODES.includes(event.mode) ||
    !text(event.missionId) ||
    !['select', 'skip', 'complete'].includes(event.type)
  )
    throw new TypeError(t('errors:journey.invalidProgressEvent'));
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
      throw new TypeError(t('errors:journey.exactReceiptRequired'));
    if (own(profile.clears[mode], missionId)) {
      const old = profile.clears[mode][missionId];
      if (old.runId === event.runId) {
        if (old.gameplayId !== event.gameplayId || old.difficulty !== event.difficulty)
          throw new TypeError(t('errors:journey.completionIdentityChanged'));
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
    if (!indexedDB) return Promise.reject(new Error(t('errors:journey.storageUnavailable')));
    return (opening ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(JOURNEY_PROFILE_DATABASE, 1);
      let failed = false;
      const fail = (error) => {
        failed = true;
        opening = null;
        reject(error || new Error(t('errors:journey.storageOpenFailed')));
      };
      request.onupgradeneeded = () => request.result.createObjectStore('profiles');
      request.onerror = () => fail(request.error);
      request.onblocked = () => fail(new Error(t('errors:journey.closeOlderTab')));
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
        read = store.get(profileKey),
        pictureRead = store.get(`${profileKey}:pictures.v1`);
      let next,
        failure,
        remaining = 2;
      const loaded = () => {
        if (--remaining) return;
        try {
          next = {
            profile:
              read.result === undefined
                ? emptyJourneyProfile()
                : validateJourneyProfile(read.result),
            pictures:
              pictureRead.result === undefined
                ? emptyJourneyPictures()
                : validateJourneyPictures(pictureRead.result),
          };
          for (const event of events)
            next = applyStateEvent(next, event, pictureEditionId(profileKey));
          if (events.length) store.put(next.profile, profileKey);
          if (events.some((event) => event.picture !== undefined || event.pictures !== undefined))
            store.put(next.pictures, `${profileKey}:pictures.v1`);
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      read.onsuccess = pictureRead.onsuccess = loaded;
      tx.oncomplete = () => resolve(next);
      tx.onabort = tx.onerror = () =>
        reject(failure || tx.error || new Error(t('errors:journey.saveFailed')));
    });
  }
  return {
    profileKey,
    read: async () => (await transaction([])).profile,
    commit: async (events) => (await transaction(events)).profile,
    readState: () => transaction([]),
    commitState: transaction,
  };
}
function applyStateEvent(state, event, editionId = null) {
  const { pictures, ...profileEvent } = event;
  const profile = applyJourneyEvent(state.profile, profileEvent);
  if (event.type === 'restore' && pictures !== undefined)
    validateJourneyPictureCompletions(profile, pictures, { editionId });
  return { profile, pictures: applyJourneyPictureEvent(state.pictures, event) };
}
function validateState(state) {
  return {
    profile: validateJourneyProfile(state.profile),
    pictures: validateJourneyPictures(state.pictures),
  };
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
    throw new TypeError(t('errors:journey.backendEditionMismatch'));
  if (!Number.isFinite(operationTimeoutMs) || operationTimeoutMs <= 0)
    throw new TypeError(t('errors:journey.positiveTimeoutRequired'));
  const bounded = (operation) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(t('errors:journey.storageTimeout'))),
        operationTimeoutMs,
      );
      Promise.resolve()
        .then(operation)
        .then(resolve, reject)
        .finally(() => clearTimeout(timer));
    });
  let profile = emptyJourneyProfile(),
    pictures = emptyJourneyPictures(),
    pending = [],
    saving = null,
    ready = false,
    durable = false,
    error = null,
    stateRevision = 0;
  const editionId = pictureEditionId(profileKey),
    applyEvent = (state, event) => applyStateEvent(state, event, editionId);
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
  const pictureSnapshot = () => structuredClone(pictures);
  const adopt = (state) => {
    ({ profile, pictures } = state);
    stateRevision++;
  };
  const readState = async () =>
    backend.readState
      ? validateState(await backend.readState())
      : { profile: validateJourneyProfile(await backend.read()), pictures: emptyJourneyPictures() };
  const commitState = async (events) => {
    if (backend.commitState) return validateState(await backend.commitState(events));
    if (events.some((event) => event.picture !== undefined || event.pictures !== undefined))
      throw new Error(t('errors:journey.pictureReceiptsUnsupported'));
    return {
      profile: validateJourneyProfile(await backend.commit(events)),
      pictures: emptyJourneyPictures(),
    };
  };
  async function flush() {
    if (saving) return saving;
    saving = (async () => {
      try {
        // Loading and saving share one queue. An older read must never replace
        // a newly committed clear, including when play starts before load ends.
        const latest = await bounded(readState);
        adopt(pending.reduce(applyEvent, latest));
        while (pending.length) {
          const batch = [...pending];
          const saved = await bounded(() => commitState(batch));
          pending = pending.slice(batch.length);
          adopt(pending.reduce(applyEvent, saved));
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
      throw new TypeError(t('errors:journey.eventBatchSize'));
    const owned = structuredClone(events);
    // Validate the whole transition before publishing either its cursor or skip.
    // One status notification cannot expose a partially applied transition.
    const next = owned.reduce(applyEvent, { profile, pictures });
    adopt(next);
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
    pictures: pictureSnapshot,
    stateRevision: () => stateRevision,
    status,
    flush,
    backupFilename:
      profileKey === 'journey'
        ? 'revealline-journey-progress.json'
        : `revealline-${profileKey}-progress.json`,
    inspectBackup(source) {
      const { backup, normalized, pictures: restored } = inspectProfileBackup(source, profileKey);
      const merged = applyEvent(
        { profile, pictures },
        { type: 'restore', backup: normalized, ...(restored ? { pictures: restored } : {}) },
      );
      return { backup, merged: merged.profile, pictures: merged.pictures };
    },
    restore(source) {
      const inspected = inspectProfileBackup(source, profileKey);
      return recordEvents([
        {
          type: 'restore',
          backup: inspected.normalized,
          ...(inspected.pictures ? { pictures: inspected.pictures } : {}),
        },
      ]);
    },
    record(event) {
      return recordEvents([event]);
    },
    recordMany: recordEvents,
    export() {
      return JSON.stringify(
        pictures.records.length
          ? {
              format: JOURNEY_PICTURE_BACKUP_VERSION,
              profileKey,
              profile: snapshot(),
              pictures: pictureSnapshot(),
            }
          : profileKey === 'journey'
            ? { format: JOURNEY_BACKUP_VERSION, profile: snapshot() }
            : { format: JOURNEY_SCOPED_BACKUP_VERSION, profileKey, profile: snapshot() },
        null,
        2,
      );
    },
  };
}
