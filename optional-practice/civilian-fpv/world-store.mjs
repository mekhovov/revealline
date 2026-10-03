/** Active pointers and retained exact revisions commit together with their Blobs. */
const DEFAULT_NAME = 'revealline-fpv-worlds-v1';
const fail = (message) => new Error(message);
const request = (value) =>
  new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || fail('World transaction aborted.'));
    tx.onerror = () => {};
  });
}
export async function openWorldStore({
  indexedDB = globalThis.indexedDB,
  name = DEFAULT_NAME,
} = {}) {
  if (!indexedDB) throw fail('IndexedDB is unavailable. Export your world to keep it.');
  const opening = indexedDB.open(name, 2);
  opening.onupgradeneeded = () => {
    const db = opening.result;
    if (!db.objectStoreNames.contains('projects'))
      db.createObjectStore('projects', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('assets'))
      db.createObjectStore('assets', { keyPath: ['projectId', 'path'] }).createIndex(
        'project',
        'projectId',
      );
    if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    if (!db.objectStoreNames.contains('revisions'))
      db.createObjectStore('revisions', { keyPath: ['id', 'sha256'] }).createIndex('project', 'id');
  };
  const db = await new Promise((resolve, reject) => {
    let rejected = false;
    opening.onsuccess = () => (rejected ? opening.result.close() : resolve(opening.result));
    opening.onerror = () => {
      rejected = true;
      reject(opening.error);
    };
    opening.onblocked = () => {
      rejected = true;
      reject(fail('Close older world-library tabs to update storage.'));
    };
  });
  db.onversionchange = () => db.close();
  async function generation() {
    const tx = db.transaction('meta', 'readonly'),
      done = transactionDone(tx),
      result = (await request(tx.objectStore('meta').get('generation'))) ?? 0;
    await done;
    return result;
  }
  function install({ project, assets, sha256, expectedGeneration }) {
    if (!project?.id || !(assets instanceof Map) || !/^[a-f0-9]{64}$/.test(sha256))
      return Promise.reject(fail('Install requires a verified prepared pack.'));
    for (const blob of assets.values())
      if (!(blob instanceof Blob)) return Promise.reject(fail('World assets must be Blobs.'));
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'assets', 'meta', 'revisions'], 'readwrite'),
        meta = tx.objectStore('meta'),
        stored = tx.objectStore('assets'),
        projects = tx.objectStore('projects'),
        revisions = tx.objectStore('revisions');
      let result, error;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () =>
        reject(
          error || tx.error || fail('World installation aborted; previous revision retained.'),
        );
      tx.onerror = () => {};
      const abort = (message) => {
        error = fail(message);
        tx.abort();
      };
      const read = meta.get('generation');
      read.onsuccess = () => {
        const current = read.result ?? 0;
        if (expectedGeneration !== undefined && current !== expectedGeneration) {
          error = fail('World library changed. Reload before saving.');
          error.code = 'generation-conflict';
          tx.abort();
          return;
        }
        const readVersions = revisions.getAll();
        readVersions.onsuccess = () => {
          const versions = readVersions.result,
            known = versions.some((v) => v.id === project.id && v.sha256 === sha256);
          const size = [...assets.values()].reduce(
            (n, b) => n + b.size,
            new TextEncoder().encode(JSON.stringify(project)).length,
          );
          if (
            !known &&
            (versions.length >= 256 ||
              versions.reduce((n, v) => n + (v.bytes ?? 0), size) > 256 * 1024 * 1024)
          ) {
            abort(
              'Retained world library is full. Export and remove unused packs before installing another.',
            );
            return;
          }
          const readOld = projects.get(project.id);
          readOld.onsuccess = () => {
            const old = readOld.result;
            const oldAssets = stored.index('project').getAll(project.id);
            oldAssets.onsuccess = () => {
              try {
                if (old && !versions.some((v) => v.id === old.id && v.sha256 === old.sha256)) {
                  const oldSize = oldAssets.result.reduce(
                    (n, r) => n + r.blob.size,
                    new TextEncoder().encode(JSON.stringify(old.project)).length,
                  );
                  if (
                    versions.length + (known ? 0 : 1) + 1 > 256 ||
                    versions.reduce((n, v) => n + (v.bytes ?? 0), oldSize + (known ? 0 : size)) >
                      256 * 1024 * 1024
                  ) {
                    abort('Retained world library is full. Export and remove unused packs first.');
                    return;
                  }
                  const oldMap = new Map(oldAssets.result.map((r) => [r.path, r.blob]));
                  revisions.put({
                    ...old,
                    assets: oldMap,
                    bytes: oldSize,
                  });
                }
                const next = current + 1,
                  record = {
                    id: project.id,
                    project,
                    sha256,
                    generation: next,
                    installedAt: new Date().toISOString(),
                  };
                if (!known) revisions.put({ ...record, assets, bytes: size });
                const cursor = stored.index('project').openCursor(project.id);
                cursor.onsuccess = () => {
                  if (cursor.result) {
                    cursor.result.delete();
                    cursor.result.continue();
                    return;
                  }
                  try {
                    for (const [path, blob] of assets)
                      stored.put({ projectId: project.id, path, blob });
                    projects.put(record);
                    meta.put(next, 'generation');
                    result = { project, generation: next, sha256 };
                  } catch (cause) {
                    error = cause;
                    tx.abort();
                  }
                };
              } catch (cause) {
                error = cause;
                tx.abort();
              }
            };
          };
        };
      };
    });
  }
  async function get(id, { sha256 } = {}) {
    const tx = db.transaction(['projects', 'assets', 'revisions'], 'readonly'),
      done = transactionDone(tx);
    const recordRequest = request(tx.objectStore('projects').get(id)),
      assetRequest = request(tx.objectStore('assets').index('project').getAll(id));
    const revisionRequest = sha256
      ? request(tx.objectStore('revisions').get([id, sha256]))
      : Promise.resolve(null);
    const [record, rows, revision] = await Promise.all([
      recordRequest,
      assetRequest,
      revisionRequest,
    ]);
    await done;
    if (revision) return { ...revision, active: record?.sha256 === sha256 };
    return record && (!sha256 || record.sha256 === sha256)
      ? { ...record, assets: new Map(rows.map((r) => [r.path, r.blob])), active: true }
      : null;
  }
  async function list({ includeRevisions = false } = {}) {
    const tx = db.transaction(['projects', 'revisions'], 'readonly'),
      done = transactionDone(tx),
      activeRequest = request(tx.objectStore('projects').getAll()),
      allRequest = includeRevisions
        ? request(tx.objectStore('revisions').getAll())
        : Promise.resolve([]);
    const [active, all] = await Promise.all([activeRequest, allRequest]);
    await done;
    const result = active.map((r) => ({ ...r, active: true }));
    if (includeRevisions)
      for (const row of all)
        if (!active.some((r) => r.id === row.id && r.sha256 === row.sha256)) {
          const { assets, ...record } = row;
          void assets;
          result.push({ ...record, active: false });
        }
    return result;
  }
  async function activate(id, sha256, { expectedGeneration } = {}) {
    const revision = await get(id, { sha256 });
    if (!revision) throw fail('This exact revision is not installed.');
    return install({ ...revision, expectedGeneration });
  }
  async function removalSnapshot(id) {
    // Read the deletion boundary and its generation together. A later mutation
    // must invalidate the review instead of silently deleting newly added data.
    const tx = db.transaction(['projects', 'revisions', 'meta'], 'readonly'),
      done = transactionDone(tx),
      activeRequest = request(tx.objectStore('projects').get(id)),
      generationRequest = request(tx.objectStore('meta').get('generation'));
    const metadata = (row) => ({
      sha256: row.sha256,
      courseIds: (row.project?.courses ?? []).map((course) => course.id),
    });
    let retainedTitle;
    const revisionsRequest = new Promise((resolve, reject) => {
      const rows = new Map(),
        cursor = tx.objectStore('revisions').index('project').openCursor(id);
      cursor.onerror = () => reject(cursor.error);
      cursor.onsuccess = () => {
        if (!cursor.result) return resolve(rows);
        const row = cursor.result.value;
        retainedTitle ??= row.project?.title;
        rows.set(row.sha256, metadata(row));
        cursor.result.continue();
      };
    });
    const [active, currentGeneration, revisions] = await Promise.all([
      activeRequest,
      generationRequest,
      revisionsRequest,
      done,
    ]);
    // Legacy installations may have an active pointer without a retained row.
    if (active) revisions.set(active.sha256, metadata(active));
    if (!active && !revisions.size) return null;
    return {
      id,
      title: active?.project?.title ?? retainedTitle ?? id,
      generation: currentGeneration ?? 0,
      revisions: [...revisions.values()].map((revision) => ({
        ...revision,
        active: revision.sha256 === active?.sha256,
      })),
    };
  }
  /** Remove a single edition without destroying other retained revisions or proofs. */
  function removeRevision(id, sha256, { expectedGeneration } = {}) {
    if (
      typeof id !== 'string' ||
      !/^[a-f0-9]{64}$/.test(sha256) ||
      !Number.isSafeInteger(expectedGeneration)
    )
      return Promise.reject(fail('Review the exact world revision before offloading.'));
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'assets', 'meta', 'revisions'], 'readwrite');
      const meta = tx.objectStore('meta'),
        projects = tx.objectStore('projects'),
        revisions = tx.objectStore('revisions');
      const generationRequest = meta.get('generation'),
        activeRequest = projects.get(id),
        revisionRequest = revisions.get([id, sha256]);
      let ready = 0,
        error,
        next;
      const abort = (message) => {
        error = fail(message);
        tx.abort();
      };
      const stage = () => {
        if (++ready !== 3) return;
        const generation = generationRequest.result ?? 0,
          active = activeRequest.result;
        if (
          generation !== expectedGeneration ||
          (!revisionRequest.result && active?.sha256 !== sha256)
        )
          return abort('World revision changed. Review offloading again.');
        revisions.delete([id, sha256]);
        next = generation + 1;
        meta.put(next, 'generation');
        if (active?.sha256 === sha256) {
          projects.delete(id);
          const cursor = tx.objectStore('assets').index('project').openCursor(id);
          cursor.onsuccess = () => {
            if (cursor.result) {
              cursor.result.delete();
              cursor.result.continue();
            }
          };
        }
      };
      generationRequest.onsuccess = activeRequest.onsuccess = revisionRequest.onsuccess = stage;
      tx.oncomplete = () => resolve({ generation: next });
      tx.onabort = () => reject(error ?? tx.error ?? fail('World offload aborted.'));
      tx.onerror = () => {};
    });
  }
  function remove(id, { expectedGeneration } = {}) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'assets', 'meta', 'revisions'], 'readwrite'),
        meta = tx.objectStore('meta');
      let error, next;
      tx.oncomplete = () => resolve({ generation: next });
      tx.onabort = () => reject(error || tx.error || fail('World deletion aborted.'));
      tx.onerror = () => {};
      const read = meta.get('generation');
      read.onsuccess = () => {
        const current = read.result ?? 0;
        if (expectedGeneration !== undefined && current !== expectedGeneration) {
          error = fail('World library changed.');
          error.code = 'generation-conflict';
          tx.abort();
          return;
        }
        // Removing a pack removes active and retained visuals. Proof bytes live in
        // the independent records store and are deliberately never deleted here.
        let remaining = 2;
        const finish = () => {
          if (--remaining) return;
          tx.objectStore('projects').delete(id);
          next = current + 1;
          meta.put(next, 'generation');
        };
        for (const [store, index] of [
          ['assets', 'project'],
          ['revisions', 'project'],
        ]) {
          const cursor = tx.objectStore(store).index(index).openCursor(id);
          cursor.onsuccess = () => {
            if (cursor.result) {
              cursor.result.delete();
              cursor.result.continue();
            } else finish();
          };
        }
      };
    });
  }
  return {
    generation,
    install,
    get,
    list,
    activate,
    removalSnapshot,
    removeRevision,
    remove,
    close: () => db.close(),
  };
}
export const createWorldStore = openWorldStore;
