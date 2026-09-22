/** A browsing registry, never a gameplay catalogue or a progression sequence.
 * Only exact registered rows can reach their original owner's adapters. */
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
    throw new TypeError(`Mission library needs ${label}.`);
  return value;
}

// Length-delimited JSON components avoid collisions between arbitrary authored
// IDs containing slashes, colons or strings that happen to match edition names.
export function libraryMissionId({ owner, edition, campaign, mission, revision = '' }) {
  return JSON.stringify([
    text(owner, 'an owner'),
    text(edition, 'an edition'),
    text(campaign, 'a campaign'),
    text(mission, 'a mission'),
    typeof revision === 'string' ? revision : String(revision),
  ]);
}

function readiness(value) {
  if (!value || !['ready', 'download', 'unavailable'].includes(value.state))
    throw new TypeError('An owner must report explicit mission availability.');
  if (value.state === 'download' && (!Number.isSafeInteger(value.bytes) || value.bytes <= 0))
    throw new TypeError('A downloadable mission needs its exact positive byte size.');
  if (value.state === 'unavailable') text(value.reason, 'an unavailable reason');
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
    disposed = false;
  const emit = () => {
    for (const listener of listeners) listener();
  };
  function requireRow(row, mode) {
    const binding = authority.get(row);
    if (disposed || !binding || owners.get(binding.owner.id) !== binding.owner)
      throw new Error('This mission selection is stale. Refresh the library and try again.');
    if (mode !== undefined && (!LIBRARY_MODES.includes(mode) || !row.modes.includes(mode)))
      throw new Error('This mission does not support the selected mode.');
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
  }
  function cancelOwner(owner) {
    for (const row of owner.rows) {
      for (const controller of pending.get(row)?.values() ?? []) controller.abort();
      failures.delete(row);
    }
  }
  function register(source) {
    if (disposed) throw new Error('The mission library is closed.');
    text(source.id, 'a source ID');
    text(source.editionId, 'an edition ID');
    text(source.edition, 'an edition name', 160);
    if (
      !LIBRARY_COLLECTIONS.includes(source.collection) ||
      !Array.isArray(source.entries) ||
      source.entries.length > 4096 ||
      typeof source.describe !== 'function' ||
      typeof source.availability !== 'function' ||
      typeof source.launch !== 'function'
    )
      throw new TypeError('A mission source needs collection, entries and owner adapters.');
    const owner = { ...source, rows: [] };
    const ids = new Set();
    for (const entry of source.entries) {
      const info = source.describe(entry);
      text(info.campaignKey, 'a campaign identity');
      const id = libraryMissionId({
        owner: source.id,
        edition: source.editionId,
        campaign: info.campaignKey,
        mission: info.id,
        revision: info.revision ?? '',
      });
      if (ids.has(id)) throw new TypeError('A source contains a duplicate mission identity.');
      ids.add(id);
      if (
        !Array.isArray(info.modes) ||
        !info.modes.length ||
        new Set(info.modes).size !== info.modes.length ||
        info.modes.some((mode) => !LIBRARY_MODES.includes(mode))
      )
        throw new TypeError('A mission needs validated supported modes.');
      const tags = [...new Set([source.collection, ...(info.tags ?? [])])];
      if (
        tags.some(
          (tag) =>
            !LIBRARY_TAGS.includes(tag) ||
            (LIBRARY_COLLECTIONS.includes(tag) && tag !== source.collection),
        )
      )
        throw new TypeError('A mission has an invalid or conflicting collection tag.');
      if (!Number.isInteger(info.levelIndex) || info.levelIndex < 0)
        throw new TypeError('A mission needs its original authored position.');
      const row = Object.freeze({
        id,
        runtimeId: info.id,
        ownerId: source.id,
        editionId: source.editionId,
        edition: source.edition,
        collection: source.collection,
        campaignKey: JSON.stringify([source.id, source.editionId, info.campaignKey]),
        campaignTitle: text(info.campaignTitle, 'a campaign title', 160),
        name: text(info.name, 'a mission name', 160),
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
    if (count > 4096) throw new TypeError('The mission library contains too many missions.');
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
      return rows.find((row) => row.id === id) ?? null;
    },
    forMode(mode) {
      if (!LIBRARY_MODES.includes(mode)) throw new TypeError('Unknown library mode.');
      return rows.filter((row) => row.modes.includes(mode));
    },
    search(query = '', { mode = 'solo', collection = '', campaign = '', tag = '' } = {}) {
      if (
        !LIBRARY_MODES.includes(mode) ||
        (collection && !LIBRARY_COLLECTIONS.includes(collection))
      )
        throw new TypeError('Unknown library filter.');
      const words = String(query)
        .normalize('NFKC')
        .toLocaleLowerCase()
        .trim()
        .split(/\s+/u)
        .filter(Boolean);
      return rows.filter(
        (row) =>
          row.modes.includes(mode) &&
          (!collection || row.collection === collection) &&
          (!campaign || row.campaignKey === campaign) &&
          (!tag || row.tags.includes(tag)) &&
          words.every((word) =>
            `${row.name} ${row.campaignTitle} ${row.edition} ${row.tags.join(' ')} ${row.rules} ${row.hook}`
              .normalize('NFKC')
              .toLocaleLowerCase()
              .includes(word),
          ),
      );
    },
    availability,
    progress(row, mode) {
      const { owner, entry } = requireRow(row, mode);
      return owner.progress?.(entry, mode) ?? '';
    },
    card(row, mode) {
      const { owner, entry } = requireRow(row, mode);
      return owner.card?.(entry, mode) ?? null;
    },
    async prepare(row, { mode = 'solo', signal } = {}) {
      const { owner, entry } = requireRow(row, mode);
      const state = availability(row, mode);
      requireRow(row, mode); // Availability may reconcile an installed owner.
      if (state.state === 'ready') return state;
      if (state.state === 'preparing') throw new Error('This mission is already preparing.');
      if (typeof owner.prepare !== 'function' || (state.state === 'unavailable' && !state.retry))
        throw new Error(state.reason || 'This mission cannot be prepared.');
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
          typeof error?.message === 'string' ? error.message : 'Preparation failed.',
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
        throw new Error('Prepare this mission before choosing Play.');
      requireRow(row, mode);
      // The host still owns its runtime validation, departure guard and atomic
      // picture adoption. Never pass a lookup-by-name replacement for entry.
      return owner.launch(entry, { ...context, mode });
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('A listener must be a function.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      for (const owner of owners.values()) cancelOwner(owner);
      owners.clear();
      rows = Object.freeze([]);
      listeners.clear();
    },
  });
}
