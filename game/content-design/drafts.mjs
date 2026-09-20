import {
  boundedJSON,
  required,
  stableId,
  exactKeys,
  dataIdentity,
  canonicalJSON,
} from '../data-json.mjs';
import { CONTENT_PROJECT_JSON_LIMITS } from './limits.mjs';

export const CONTENT_DRAFT_DATABASE = 'revealline-content-studio-v1';
const ownDraft = (source) => {
  const project = boundedJSON(source, CONTENT_PROJECT_JSON_LIMITS);
  required(
    project?.format === 'ContentProjectV1' && stableId(project.id),
    'Expected a named content project draft.',
  );
  return project;
};
const revisionValid = (value) => Number.isSafeInteger(value) && value > 0;
const checkpointKey = (id, revision) => `${id}@${revision}`;
function checkpoint(value, id, revision) {
  required(
    value?.format === 'ContentDraftCheckpointV1' &&
      value.projectId === id &&
      revisionValid(value.revision),
    'Corrupt content draft checkpoint.',
  );
  required(value.revision === revision, 'Checkpoint revision mismatch.');
  const project = ownDraft(value.project);
  required(project.id === id, 'Checkpoint project identity mismatch.');
  return { format: value.format, projectId: id, revision: value.revision, project };
}

/** Head comparison and immutable revision insertion share one transaction.
 * Invalid geometry may be saved as a draft, but compilation still gates preview.
 * No published pack or Journey progress store is opened by this backend. */
export function createContentDraftBackend({
  indexedDB = globalThis.indexedDB,
  timeoutMs = 1500,
} = {}) {
  required(
    Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 10000,
    'Invalid storage timeout.',
  );
  let opening;
  function open() {
    if (!indexedDB) return Promise.reject(new Error('Content draft storage is unavailable.'));
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(CONTENT_DRAFT_DATABASE, 1);
      let failed = false;
      const fail = (error) => {
        failed = true;
        clearTimeout(timer);
        reject(error || new Error('Draft storage failed.'));
      };
      const timer = setTimeout(
        () => fail(new Error('Draft storage did not open in time.')),
        timeoutMs,
      );
      request.onupgradeneeded = () => {
        request.result.createObjectStore('heads');
        request.result.createObjectStore('revisions');
      };
      request.onerror = () => fail(request.error);
      request.onblocked = () =>
        fail(new Error('Close an older Studio tab to upgrade draft storage.'));
      request.onsuccess = () => {
        clearTimeout(timer);
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
    }).catch((error) => {
      opening = null;
      throw error;
    });
    return opening;
  }
  async function transact(id, action, source, expectedRevision) {
    required(stableId(id), 'Invalid draft project id.');
    const project = source === undefined ? null : ownDraft(source);
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        ['heads', 'revisions'],
        action === 'save' ? 'readwrite' : 'readonly',
      );
      const heads = tx.objectStore('heads'),
        revisions = tx.objectStore('revisions');
      let result = null,
        failure,
        finished = false;
      const finish = (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(result);
      };
      const timer = setTimeout(() => {
        failure = new Error('Draft storage did not finish in time. Keep this draft and export it.');
        try {
          tx.abort();
        } catch {
          /* Transaction may already have completed; read head before retry. */
        }
        finish(failure);
      }, timeoutMs);
      const fail = (error) => {
        failure = error;
        tx.abort();
      };
      tx.oncomplete = () => finish();
      tx.onerror = tx.onabort = () =>
        finish(failure || tx.error || new Error('Draft save failed.'));
      const head = heads.get(id);
      head.onsuccess = () => {
        try {
          const currentRevision = head.result ?? null;
          required(
            currentRevision === null || revisionValid(currentRevision),
            'Corrupt draft head.',
          );
          if (action === 'save') {
            if (currentRevision !== expectedRevision) {
              const error = new Error(
                'A newer draft exists. Reload it or save a separate project copy.',
              );
              error.code = 'draft-conflict';
              throw error;
            }
            const revision = (currentRevision ?? 0) + 1;
            required(
              revisionValid(revision),
              'Draft revision limit reached. Export a new project.',
            );
            const existing = revisions.get(checkpointKey(id, revision));
            existing.onsuccess = () => {
              try {
                required(
                  existing.result === undefined,
                  'An immutable checkpoint already occupies this revision.',
                );
                result = { format: 'ContentDraftCheckpointV1', projectId: id, revision, project };
                revisions.put(result, checkpointKey(id, revision));
                heads.put(revision, id);
              } catch (error) {
                fail(error);
              }
            };
          } else {
            const revision = expectedRevision ?? currentRevision;
            if (revision === null) return;
            const read = revisions.get(checkpointKey(id, revision));
            read.onsuccess = () => {
              try {
                result = checkpoint(read.result, id, revision);
              } catch (error) {
                fail(error);
              }
            };
          }
        } catch (error) {
          fail(error);
        }
      };
    });
  }
  return {
    read(id, revision = null) {
      required(revision === null || revisionValid(revision), 'Invalid checkpoint revision.');
      return transact(id, 'read', undefined, revision);
    },
    save(source, expectedRevision) {
      required(
        expectedRevision === null || revisionValid(expectedRevision),
        'Save requires the exact prior revision or null.',
      );
      const project = ownDraft(source);
      return transact(project.id, 'save', project, expectedRevision);
    },
  };
}

export function createDraftHistory(source, { limit = 50 } = {}) {
  required(Number.isInteger(limit) && limit >= 2 && limit <= 100, 'Invalid undo history budget.');
  let states = [ownDraft(source)],
    cursor = 0;
  const current = () => structuredClone(states[cursor]);
  return {
    current,
    canUndo: () => cursor > 0,
    canRedo: () => cursor + 1 < states.length,
    replace(candidate) {
      const next = ownDraft(candidate);
      required(next.id === states[cursor].id, 'Use a new history for a different project.');
      states = [...states.slice(0, cursor + 1), next].slice(-limit);
      cursor = states.length - 1;
      return current();
    },
    undo() {
      if (cursor > 0) cursor--;
      return current();
    },
    redo() {
      if (cursor + 1 < states.length) cursor++;
      return current();
    },
    export: () => JSON.stringify(states[cursor], null, 2),
  };
}

/** Every map edit makes an immutable new revision, scoped to one mission.
 * Existing revisions and other consumers stay intact, including published copies. */
export function forkMissionMap(source, missionId, changes) {
  const project = ownDraft(source),
    patch = boundedJSON(changes);
  exactKeys(
    patch,
    ['name', 'width', 'height', 'walls', 'foundations', 'terrain', 'spawns'],
    'map edit',
  );
  const mission = project.missions.find((m) => m.id === missionId);
  required(mission, 'Choose a mission to edit its map.');
  const original = project.maps.find(
    (m) => m.id === mission.map.id && m.revision === mission.map.revision,
  );
  required(original, 'The mission map revision is missing.');
  const next = { ...original, ...patch };
  delete next.revision;
  next.revision = `draft-${dataIdentity(next)}`;
  const existing = project.maps.find((m) => m.id === next.id && m.revision === next.revision);
  if (existing)
    required(canonicalJSON(existing) === canonicalJSON(next), 'Map revision identity collision.');
  else project.maps.push(next);
  mission.map = { id: next.id, revision: next.revision };
  project.revision = `draft-${dataIdentity(project)}`;
  return ownDraft(project);
}
