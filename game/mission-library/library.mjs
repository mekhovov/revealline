/** A browsing registry, never a gameplay catalogue or a progression sequence.
 * Only exact registered rows can reach their original owner's adapters. */
import { t } from '../i18n/index.mjs';

export const LIBRARY_COLLECTIONS = Object.freeze(['Journey', 'Classic', 'Custom']);
export const LIBRARY_MODES = Object.freeze(['solo', 'versus', 'team']);
export const LIBRARY_TAGS = Object.freeze([
  ...LIBRARY_COLLECTIONS,
  'Remix',
  'Ukrainian',
  'FPV',
  'Arcade',
  'Tactical',
  'Practice',
]);

function text(value, label, maximum = 1024) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    throw new TypeError(
      t('errors:missionLibrary.needsField', {
        field: t(`errors:missionLibrary.field.${label}`),
      }),
    );
  return value;
}

// Length-delimited JSON components avoid collisions between arbitrary authored
// IDs containing slashes, colons or strings that happen to match edition names.
export function libraryMissionId({ owner, edition, campaign, mission, revision = '' }) {
  return JSON.stringify([
    text(owner, 'owner'),
    text(edition, 'edition'),
    text(campaign, 'campaign'),
    text(mission, 'mission'),
    typeof revision === 'string' ? revision : String(revision),
  ]);
}

function readiness(value) {
  if (!value || !['ready', 'download', 'unavailable'].includes(value.state))
    throw new TypeError(t('errors:missionLibrary.availabilityRequired'));
  if (value.state === 'download' && (!Number.isSafeInteger(value.bytes) || value.bytes <= 0))
    throw new TypeError(t('errors:missionLibrary.downloadBytes'));
  if (value.state === 'unavailable') text(value.reason, 'unavailableReason');
  return Object.freeze({
    state: value.state,
    ...(value.state === 'download' ? { bytes: value.bytes } : {}),
    ...(value.state === 'unavailable' ? { reason: value.reason, retry: value.retry === true } : {}),
  });
}

/** Each source supplies already validated runtime references or trusted metadata
 * plus adapters that resolve it through the existing host validator. A metadata
 * row is NOT proof that a pack is installed, decoded, owned, or safe to launch. */
export function createMissionLibrary(sources = []) {
  const owners = new Map(),
    authority = new WeakMap(),
    pending = new Map(),
    failures = new Map();
  const listeners = new Set();
  const scoped = (store, row, mode) => store.get(row)?.get(mode);
  const setScoped = (store, row, mode, value) => {
    if (!store.has(row)) store.set(row, new Map());
    store.get(row).set(mode, value);
  };
  const clearScoped = (store, row, mode) => {
    store.get(row)?.delete(mode);
    if (store.get(row)?.size === 0) store.delete(row);
  };
  let rows = Object.freeze([]),
    byId = new Map(),
    rowsByMode = new Map(LIBRARY_MODES.map((mode) => [mode, Object.freeze([])])),
    disposed = false;
  const emit = () => {
    for (const listener of listeners) listener();
  };
  function requireRow(row, mode) {
    const binding = authority.get(row);
    if (disposed || !binding || owners.get(binding.owner.id) !== binding.owner)
      throw new Error(t('errors:missionLibrary.staleSelection'));
    if (mode !== undefined && (!LIBRARY_MODES.includes(mode) || !row.modes.includes(mode)))
      throw new Error(t('errors:missionLibrary.unsupportedMode'));
    return binding;
  }
  function rebuild() {
    rows = Object.freeze(
      [...owners.values()]
        .flatMap((owner) => owner.rows)
        .sort(
          (a, b) =>
            LIBRARY_COLLECTIONS.indexOf(a.collection) - LIBRARY_COLLECTIONS.indexOf(b.collection),
        ),
    );
    // The unified selector asks for exact identities repeatedly while it
    // reconciles focus, availability and lazy previews. Keep those lookups
    // linear in the number of rendered cards, not quadratic in the complete
    // installed catalogue. Rebuild the derived indexes only after the owner
    // replacement has been accepted so stale rows never become authoritative.
    byId = new Map(rows.map((row) => [row.id, row]));
    rowsByMode = new Map(
      LIBRARY_MODES.map((mode) => [
        mode,
        Object.freeze(rows.filter((row) => row.modes.includes(mode))),
      ]),
    );
  }
  function cancelOwner(owner) {
    for (const row of owner.rows) {
      for (const controller of pending.get(row)?.values() ?? []) controller.abort();
      failures.delete(row);
    }
  }
  function register(source) {
    if (disposed) throw new Error(t('errors:missionLibrary.closed'));
    text(source.id, 'sourceId');
    text(source.editionId, 'editionId');
    text(source.edition, 'editionName', 160);
    if (
      source.automaticContinuation !== undefined &&
      typeof source.automaticContinuation !== 'boolean'
    )
      throw new TypeError(t('errors:missionLibrary.automaticContinuationBoolean'));
    if (
      !LIBRARY_COLLECTIONS.includes(source.collection) ||
      !Array.isArray(source.entries) ||
      source.entries.length > 4096 ||
      typeof source.describe !== 'function' ||
      typeof source.availability !== 'function' ||
      typeof source.launch !== 'function'
    )
      throw new TypeError(t('errors:missionLibrary.sourceAdapters'));
    const owner = { ...source, rows: [] };
    const ids = new Set();
    for (const entry of source.entries) {
      const info = source.describe(entry);
      text(info.campaignKey, 'campaignIdentity');
      const id = libraryMissionId({
        owner: source.id,
        edition: source.editionId,
        campaign: info.campaignKey,
        mission: info.id,
        revision: info.revision ?? '',
      });
      if (ids.has(id)) throw new TypeError(t('errors:missionLibrary.duplicateIdentity'));
      ids.add(id);
      if (
        !Array.isArray(info.modes) ||
        !info.modes.length ||
        new Set(info.modes).size !== info.modes.length ||
        info.modes.some((mode) => !LIBRARY_MODES.includes(mode))
      )
        throw new TypeError(t('errors:missionLibrary.supportedModes'));
      const tags = [...new Set([source.collection, ...(info.tags ?? [])])];
      if (
        tags.some(
          (tag) =>
            !LIBRARY_TAGS.includes(tag) ||
            (LIBRARY_COLLECTIONS.includes(tag) && tag !== source.collection),
        )
      )
        throw new TypeError(t('errors:missionLibrary.collectionTag'));
      if (!Number.isInteger(info.levelIndex) || info.levelIndex < 0)
        throw new TypeError(t('errors:missionLibrary.authoredPosition'));
      const row = Object.freeze({
        id,
        runtimeId: info.id,
        ownerId: source.id,
        editionId: source.editionId,
        edition: source.edition,
        collection: source.collection,
        automaticContinuation: source.automaticContinuation !== false,
        campaignKey: JSON.stringify([source.id, source.editionId, info.campaignKey]),
        campaignTitle: text(info.campaignTitle, 'campaignTitle', 160),
        name: text(info.name, 'missionName', 160),
        levelIndex: info.levelIndex,
        modes: Object.freeze([...info.modes]),
        tags: Object.freeze(tags),
        rules: typeof info.rules === 'string' ? info.rules.slice(0, 2048) : '',
        hook: typeof info.hook === 'string' ? info.hook.slice(0, 2048) : '',
      });
      owner.rows.push(row);
      authority.set(row, { owner, entry });
    }
    const count = [...owners.values()]
      .filter((item) => item.id !== source.id)
      .reduce((sum, item) => sum + item.rows.length, owner.rows.length);
    if (count > 4096) throw new TypeError(t('errors:missionLibrary.tooManyMissions'));
    // Build the complete replacement before invalidating the accepted owner.
    const previous = owners.get(source.id);
    if (previous) cancelOwner(previous);
    owners.set(source.id, owner);
    rebuild();
    emit();
    return Object.freeze([...owner.rows]);
  }
  function availability(row, mode = 'solo') {
    const { owner, entry } = requireRow(row, mode);
    if (scoped(pending, row, mode)) return Object.freeze({ state: 'preparing' });
    if (scoped(failures, row, mode))
      return Object.freeze({
        state: 'unavailable',
        reason: scoped(failures, row, mode),
        retry: true,
      });
    return readiness(owner.availability(entry, mode));
  }
  function presentation(row) {
    const { owner, entry } = requireRow(row);
    const value = owner.presentation?.(entry);
    const translated = {};
    for (const field of ['name', 'campaignTitle', 'edition', 'hook'])
      translated[field] = typeof value?.[field] === 'string' ? value[field] : row[field];
    return Object.freeze(translated);
  }
  for (const source of sources) register(source);
  return Object.freeze({
    get missions() {
      return rows;
    },
    register,
    remove(id) {
      const owner = owners.get(id);
      if (!owner) return false;
      cancelOwner(owner);
      owners.delete(id);
      rebuild();
      emit();
      return true;
    },
    find(id) {
      return byId.get(id) ?? null;
    },
    forMode(mode) {
      if (!LIBRARY_MODES.includes(mode))
        throw new TypeError(t('errors:missionLibrary.unknownMode'));
      return rowsByMode.get(mode);
    },
    search(query = '', { mode = 'solo', collection = '', campaign = '', tag = '' } = {}) {
      if (
        !LIBRARY_MODES.includes(mode) ||
        (collection && !LIBRARY_COLLECTIONS.includes(collection))
      )
        throw new TypeError(t('errors:missionLibrary.unknownFilter'));
      const words = String(query)
        .normalize('NFKC')
        .toLocaleLowerCase()
        .trim()
        .split(/\s+/u)
        .filter(Boolean);
      return rowsByMode.get(mode).filter((row) => {
        const display = words.length ? presentation(row) : row;
        return (
          row.modes.includes(mode) &&
          (!collection || row.collection === collection) &&
          (!campaign || row.campaignKey === campaign) &&
          (!tag || row.tags.includes(tag)) &&
          words.every((word) =>
            `${display.name} ${display.campaignTitle} ${display.edition} ${display.hook} ${row.name} ${row.campaignTitle} ${row.edition} ${row.tags.join(' ')} ${row.rules} ${row.hook}`
              .normalize('NFKC')
              .toLocaleLowerCase()
              .includes(word),
          )
        );
      });
    },
    presentation,
    availability,
    progress(row, mode) {
      const { owner, entry } = requireRow(row, mode);
      return owner.progress?.(entry, mode) ?? '';
    },
    completion(row, mode) {
      const { owner, entry } = requireRow(row, mode);
      return owner.completion?.(entry, mode) ?? null;
    },
    card(row, mode) {
      const { owner, entry } = requireRow(row, mode);
      return owner.card?.(entry, mode) ?? null;
    },
    details(row, mode) {
      const { owner, entry } = requireRow(row, mode);
      const value = owner.details?.(entry, mode);
      const bounded = (value, fallback = '') =>
        typeof value === 'string' ? value.slice(0, 2048) : fallback;
      return Object.freeze({
        challenge: bounded(value?.challenge, row.rules),
        route: bounded(value?.route, row.hook),
        mastery: bounded(value?.mastery),
      });
    },
    async prepare(row, { mode = 'solo', signal } = {}) {
      const { owner, entry } = requireRow(row, mode);
      const state = availability(row, mode);
      requireRow(row, mode); // Availability may reconcile an installed owner.
      if (state.state === 'ready') return state;
      if (state.state === 'preparing') throw new Error(t('errors:missionLibrary.alreadyPreparing'));
      if (typeof owner.prepare !== 'function' || (state.state === 'unavailable' && !state.retry))
        throw new Error(state.reason || t('errors:missionLibrary.cannotPrepare'));
      if (signal?.aborted) return { state: 'cancelled' };
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      clearScoped(failures, row, mode);
      setScoped(pending, row, mode, controller);
      emit();
      try {
        const cancelled = new Promise((resolve) =>
          controller.signal.addEventListener('abort', () => resolve(false), { once: true }),
        );
        const completed = await Promise.race([
          Promise.resolve().then(() => {
            if (controller.signal.aborted) return false;
            return Promise.resolve(owner.prepare(entry, { mode, signal: controller.signal })).then(
              () => true,
            );
          }),
          cancelled,
        ]);
        if (!completed || controller.signal.aborted || owners.get(owner.id) !== owner)
          return { state: 'cancelled' };
        return readiness(owner.availability(entry, mode));
      } catch (error) {
        if (controller.signal.aborted || owners.get(owner.id) !== owner)
          return { state: 'cancelled' };
        setScoped(
          failures,
          row,
          mode,
          typeof error?.message === 'string'
            ? error.message
            : t('errors:missionLibrary.preparationFailed'),
        );
        throw error;
      } finally {
        signal?.removeEventListener('abort', abort);
        if (scoped(pending, row, mode) === controller) clearScoped(pending, row, mode);
        emit();
      }
    },
    cancel(row, { mode } = {}) {
      if (mode !== undefined) scoped(pending, row, mode)?.abort();
      else for (const controller of pending.get(row)?.values() ?? []) controller.abort();
    },
    launch(row, { mode = 'solo', ...context } = {}) {
      const { owner, entry } = requireRow(row, mode);
      if (availability(row, mode).state !== 'ready')
        throw new Error(t('errors:missionLibrary.prepareBeforePlay'));
      requireRow(row, mode);
      // The host still owns its runtime validation, departure guard and atomic
      // picture adoption. Never pass a lookup-by-name replacement for entry.
      return owner.launch(entry, { ...context, mode, libraryMissionId: row.id });
    },
    subscribe(listener) {
      if (typeof listener !== 'function')
        throw new TypeError(t('errors:missionLibrary.listenerFunction'));
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      for (const owner of owners.values()) cancelOwner(owner);
      owners.clear();
      rows = Object.freeze([]);
      byId = new Map();
      rowsByMode = new Map(LIBRARY_MODES.map((mode) => [mode, Object.freeze([])]));
      listeners.clear();
    },
  });
}
