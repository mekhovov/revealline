import { validateThemeBundle } from './model.mjs';
import { verifyThemeAssets } from './bundle.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { decodePresentationDocument, encodePresentationDocument } from './document-codec.mjs';

// Deliberately independent of player, soundtrack and original-media databases.
export const STUDIO_DATABASE = 'revealline-presentation-studio-v1';
const KEY = 'workspace';
const LIBRARY = 'theme-workspaces.v1';
const workspaceKey = (id) => `theme-workspace:${id}`;
const emptyLibrary = () => ({ version: 1, migrated: false, activeId: null, entries: [] });
function workspaceIdentity(id, name) {
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(id)) throw new Error('Invalid workspace ID.');
  if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 120))
    throw new Error('A workspace needs a name of at most 120 characters.');
}
function generatedWorkspaceId(index, kind) {
  let counter = index.entries.length;
  while (index.entries.some((entry) => entry.id === `${kind}-${counter}`)) counter++;
  return `${kind}-${counter}`;
}
const closedError = () => new Error('This studio connection is closed.');
function verifySavedHistory(document, current) {
  if (!current) return;
  if (!Number.isSafeInteger(current.generation) || current.generation < 1)
    throw new Error('The stored studio revision is invalid.');
  const previous = validateThemeBundle(decodePresentationDocument(current.document));
  if (document.id !== previous.id || document.revision < previous.revision)
    throw new Error('Saving must retain the same studio document and its immutable history.');
  if (document.revision === previous.revision) {
    if (canonicalJSON(document) !== canonicalJSON(previous))
      throw new Error('A changed studio document must advance its revision.');
    return;
  }
  // Several unsaved actions may be committed together. Keep every saved record
  // and require a contiguous run of new revisions, rather than only one action.
  for (const field of ['slots', 'assets', 'themes', 'collections']) {
    const old = new Map(previous[field].map((row) => [`${row.id}@${row.revision}`, row]));
    const next = new Map(document[field].map((row) => [`${row.id}@${row.revision}`, row]));
    for (const [key, row] of old)
      if (canonicalJSON(next.get(key)) !== canonicalJSON(row))
        throw new Error(`Immutable ${field} history changed.`);
    const newest = new Map();
    for (const row of previous[field])
      newest.set(row.id, Math.max(newest.get(row.id) ?? 0, row.revision));
    for (const row of [...document[field]].sort((a, b) => a.revision - b.revision)) {
      if (old.has(`${row.id}@${row.revision}`)) continue;
      if (row.revision !== (newest.get(row.id) ?? 0) + 1)
        throw new Error(`New ${field} revisions must retain their complete history.`);
      newest.set(row.id, row.revision);
    }
  }
}
export function createStudioStore({ indexedDB = globalThis.indexedDB } = {}) {
  let connection = null;
  let closed = false;
  async function database() {
    if (closed) throw closedError();
    if (!indexedDB)
      throw new Error(
        'Local studio storage is unavailable. Export a theme bundle to keep your work.',
      );
    if (!connection) {
      const owner = { db: null, promise: null, reject: null, abandoned: false };
      connection = owner;
      owner.promise = new Promise((resolve, reject) => {
        const rejectOpen = (error) => {
          owner.abandoned = true;
          if (connection === owner) connection = null;
          reject(error);
        };
        owner.reject = rejectOpen;
        let request;
        try {
          request = indexedDB.open(STUDIO_DATABASE, 1);
        } catch (error) {
          rejectOpen(error);
          return;
        }
        request.onupgradeneeded = () => {
          if (closed || owner.abandoned || connection !== owner) request.transaction.abort();
          else request.result.createObjectStore('drafts');
        };
        request.onerror = () => {
          rejectOpen(request.error);
        };
        request.onblocked = () => {
          rejectOpen(new Error('Close the other asset studio tab and retry.'));
        };
        request.onsuccess = () => {
          const db = request.result;
          if (closed || owner.abandoned || connection !== owner) {
            db.close();
            rejectOpen(closedError());
            return;
          }
          owner.db = db;
          db.onversionchange = () => {
            db.close();
            if (connection === owner) connection = null;
          };
          db.onclose = () => {
            if (connection === owner) connection = null;
          };
          resolve({ db, owner });
        };
      });
      return owner.promise;
    }
    return connection.promise;
  }
  async function transaction(mode, operation, keys = [KEY]) {
    const { db, owner } = await database();
    if (closed) throw closedError();
    return new Promise((resolve, reject) => {
      let result, failure;
      let tx;
      try {
        tx = db.transaction('drafts', mode);
      } catch (error) {
        if (connection === owner) connection = null;
        db.close();
        reject(error);
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(failure ?? tx.error ?? new Error('Studio storage failed.'));
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Studio storage was cancelled.'));
      const store = tx.objectStore('drafts');
      const values = new Array(keys.length);
      let remaining = keys.length;
      keys.forEach((key, index) => {
        const request = store.get(key);
        request.onsuccess = () => {
          values[index] = request.result ?? null;
          if (--remaining) return;
          try {
            result = operation(store, ...values);
          } catch (error) {
            failure = error;
            tx.abort();
          }
        };
      });
    });
  }
  async function decode(record) {
    if (!record) return null;
    if (!Number.isSafeInteger(record.generation) || record.generation < 1)
      throw new Error('The stored studio revision is invalid.');
    const document = validateThemeBundle(decodePresentationDocument(record.document));
    const assets = await verifyThemeAssets(document, record.assets);
    return { generation: record.generation, document, assets };
  }
  const api = {
    async load() {
      const record = await transaction('readonly', (_store, value) => value);
      return decode(record);
    },
    async save(source, sourceAssets, { expectedGeneration = 0 } = {}) {
      if (
        !Number.isSafeInteger(expectedGeneration) ||
        expectedGeneration < 0 ||
        expectedGeneration === Number.MAX_SAFE_INTEGER
      )
        throw new Error('Invalid expected studio generation.');
      // Verification owns all bytes before opening the short atomic transaction.
      const document = validateThemeBundle(source);
      const storedDocument = JSON.parse(encodePresentationDocument(document));
      const assets = await verifyThemeAssets(document, sourceAssets);
      return transaction('readwrite', (store, current) => {
        if ((current?.generation ?? 0) !== expectedGeneration)
          throw new Error('This draft changed in another tab. Reload the studio before saving.');
        verifySavedHistory(document, current);
        const generation = expectedGeneration + 1;
        store.put({ generation, document: storedDocument, assets }, KEY);
        return { generation, document, assets };
      });
    },
    /** The small index never contains asset history or bytes. Each draft is an
     * independent record; creating a theme cannot grow another theme's ledger. */
    async listWorkspaces() {
      return transaction('readonly', (_store, index) => index ?? emptyLibrary(), [LIBRARY]);
    },
    async loadWorkspace(id) {
      workspaceIdentity(id);
      return decode(await transaction('readonly', (_store, record) => record, [workspaceKey(id)]));
    },
    async selectWorkspace(id) {
      workspaceIdentity(id);
      return transaction(
        'readwrite',
        (store, index, record) => {
          if (!record || !index?.entries.some((entry) => entry.id === id))
            throw new Error('The selected workspace is unavailable.');
          const next = { ...index, activeId: id };
          store.put(next, LIBRARY);
          return next;
        },
        [LIBRARY, workspaceKey(id)],
      );
    },
    async createWorkspace(source, sourceAssets, { id = source.id, name } = {}) {
      const document = validateThemeBundle(source);
      name ??= document.themes.find(
        (theme) =>
          theme.id === document.selection.theme.id &&
          theme.revision === document.selection.theme.revision,
      ).name;
      workspaceIdentity(id, name);
      const assets = await verifyThemeAssets(document, sourceAssets);
      const record = {
        generation: 1,
        document: JSON.parse(encodePresentationDocument(document)),
        assets,
      };
      return transaction(
        'readwrite',
        (store, index, existing) => {
          index ??= emptyLibrary();
          if (
            existing ||
            index.entries.some((entry) => entry.id === id || entry.documentId === document.id)
          )
            throw new Error(
              'This theme identity already has a workspace. Open it, or duplicate the imported theme with a new identity.',
            );
          store.put(record, workspaceKey(id));
          store.put(
            {
              ...index,
              activeId: id,
              entries: [...index.entries, { id, name: name.trim(), documentId: document.id }],
            },
            LIBRARY,
          );
          return { id, name: name.trim(), generation: 1, document, assets };
        },
        [LIBRARY, workspaceKey(id)],
      );
    },
    async saveWorkspace(id, source, sourceAssets, { expectedGeneration = 0 } = {}) {
      workspaceIdentity(id);
      if (
        !Number.isSafeInteger(expectedGeneration) ||
        expectedGeneration < 1 ||
        expectedGeneration === Number.MAX_SAFE_INTEGER
      )
        throw new Error('Invalid expected studio generation.');
      const document = validateThemeBundle(source);
      const assets = await verifyThemeAssets(document, sourceAssets);
      const storedDocument = JSON.parse(encodePresentationDocument(document));
      return transaction(
        'readwrite',
        (store, index, current) => {
          if (!index?.entries.some((entry) => entry.id === id) || !current)
            throw new Error('The selected workspace is unavailable.');
          if (current.generation !== expectedGeneration)
            throw new Error('This draft changed in another tab. Reload the studio before saving.');
          verifySavedHistory(document, current);
          const generation = expectedGeneration + 1;
          store.put({ generation, document: storedDocument, assets }, workspaceKey(id));
          return { generation, document, assets };
        },
        [LIBRARY, workspaceKey(id)],
      );
    },
    /** Only the explicit import-replacement action uses this API. Preserve the
     * replaced draft as a separately openable recovery workspace atomically. */
    async replaceWorkspace(id, source, sourceAssets, { expectedGeneration } = {}) {
      workspaceIdentity(id);
      if (
        !Number.isSafeInteger(expectedGeneration) ||
        expectedGeneration < 1 ||
        expectedGeneration === Number.MAX_SAFE_INTEGER
      )
        throw new Error('Invalid expected studio generation.');
      const document = validateThemeBundle(source);
      const assets = await verifyThemeAssets(document, sourceAssets);
      const storedDocument = JSON.parse(encodePresentationDocument(document));
      return transaction(
        'readwrite',
        (store, index, current) => {
          const entry = index?.entries.find((row) => row.id === id);
          if (!entry || !current || current.generation !== expectedGeneration)
            throw new Error(
              'This draft changed in another tab. Reload the studio before replacing.',
            );
          if (entry.documentId !== document.id)
            throw new Error('Replacement must retain the same imported theme identity.');
          const recoveryId = generatedWorkspaceId(index, 'recovery');
          if (index.entries.some((row) => row.id === recoveryId))
            throw new Error(
              'Recovery workspace already exists. Reload the studio before replacing.',
            );
          store.put(current, workspaceKey(recoveryId));
          store.put(
            { generation: current.generation + 1, document: storedDocument, assets },
            workspaceKey(id),
          );
          store.put(
            {
              ...index,
              activeId: id,
              entries: [
                ...index.entries,
                {
                  ...entry,
                  id: recoveryId,
                  name: `${entry.name.slice(0, 80)} (recovery r${current.generation})`,
                  recovery: true,
                },
              ],
            },
            LIBRARY,
          );
          return { generation: current.generation + 1, document, assets };
        },
        [LIBRARY, workspaceKey(id)],
      );
    },
    /** Copy-once migration. The old key remains a recovery copy. Both the new
     * record and marker commit together, so quota failure is safely retryable. */
    async migrateLegacyWorkspace() {
      const index = await api.listWorkspaces();
      if (index.migrated) return index;
      const legacy = await api.load();
      const record = legacy && {
        ...legacy,
        document: JSON.parse(encodePresentationDocument(legacy.document)),
      };
      return transaction(
        'readwrite',
        (store, currentIndex, currentLegacy) => {
          currentIndex ??= emptyLibrary();
          if (currentIndex.migrated) return currentIndex;
          if ((currentLegacy?.generation ?? 0) !== (legacy?.generation ?? 0))
            throw new Error(
              'The legacy draft changed during migration. Reload the studio before retrying.',
            );
          const existing =
            legacy && currentIndex.entries.find((entry) => entry.documentId === legacy.document.id);
          const next = { ...currentIndex, migrated: true };
          if (legacy && !existing) {
            const id = generatedWorkspaceId(currentIndex, 'legacy');
            const theme = legacy.document.themes.find(
              (row) =>
                row.id === legacy.document.selection.theme.id &&
                row.revision === legacy.document.selection.theme.revision,
            );
            store.put(record, workspaceKey(id));
            next.entries = [
              ...next.entries,
              { id, name: theme.name, documentId: legacy.document.id },
            ];
            next.activeId ??= id;
          }
          store.put(next, LIBRARY);
          return next;
        },
        [LIBRARY, KEY],
      );
    },
    async close() {
      closed = true;
      const owner = connection;
      connection = null;
      if (owner) {
        owner.reject(closedError());
        owner.db?.close();
      }
    },
  };
  return Object.freeze(api);
}
