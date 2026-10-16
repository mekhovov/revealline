/** Active pointers and retained exact revisions commit together with their Blobs. */
const DEFAULT_NAME = 'revealline-fpv-worlds-v1';
const fail = (message) => new Error(message);
const projectBytes = (project) => new TextEncoder().encode(JSON.stringify(project)).length;
const libraryFull = () =>
  Object.assign(new Error('Retained world library is full. Existing downloads are kept.'), {
    code: 'world-library-full',
  });
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
  maxRetainedBytes = 256 * 1024 * 1024,
} = {}) {
  if (
    !Number.isSafeInteger(maxRetainedBytes) ||
    maxRetainedBytes <= 0 ||
    maxRetainedBytes > 512 * 1024 * 1024
  )
    throw new TypeError('Invalid retained world byte limit.');
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
  /** Read-only early check; the later atomic install still owns race/capacity acceptance. */
  async function checkInstallCapacity({ project, sha256, assetBytes }) {
    if (
      !project?.id ||
      !/^[a-f0-9]{64}$/.test(sha256) ||
      !Number.isSafeInteger(assetBytes) ||
      assetBytes < 0
    )
      throw fail('Capacity check requires a verified prepared identity and byte total.');
    const tx = db.transaction(['projects', 'assets', 'revisions'], 'readonly'),
      done = transactionDone(tx),
      readOld = tx.objectStore('projects').get(project.id);
    let old,
      oldRetained = false,
      known = false,
      count = 0,
      retainedBytes = assetBytes + projectBytes(project);
    readOld.onsuccess = () => {
      old = readOld.result;
    };
    const cursor = tx.objectStore('revisions').openCursor();
    cursor.onsuccess = () => {
      const current = cursor.result;
      if (current) {
        const row = current.value;
        count++;
        if (row.id === project.id && row.sha256 === sha256) known = true;
        else retainedBytes += row.bytes ?? 0;
        if (old && row.id === old.id && row.sha256 === old.sha256) oldRetained = true;
        current.continue();
      } else if (old && !oldRetained && old.sha256 !== sha256) {
        // A legacy active-only revision becomes retained when a different hash is installed.
        count++;
        retainedBytes += projectBytes(old.project);
        const assets = tx.objectStore('assets').index('project').openCursor(project.id);
        assets.onsuccess = () => {
          if (assets.result) {
            retainedBytes += assets.result.value.blob.size;
            assets.result.continue();
          }
        };
      }
    };
    await done;
    const revisionCount = count + (known ? 0 : 1);
    if (revisionCount > 256 || retainedBytes > maxRetainedBytes) throw libraryFull();
    return { retainedBytes, revisionCount, limitBytes: maxRetainedBytes };
  }
  function install({ project, assets, sha256, expectedGeneration, repair = false }) {
    if (repair && !Number.isSafeInteger(expectedGeneration))
      return Promise.reject(fail('Repair requires the current library generation.'));
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
      const abort = (cause) => {
        error = cause instanceof Error ? cause : fail(cause);
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
            known = versions.find((v) => v.id === project.id && v.sha256 === sha256);
          const size = [...assets.values()].reduce((n, b) => n + b.size, projectBytes(project));
          const retainedBytes = versions.reduce(
            (n, v) => n + (v === known ? 0 : (v.bytes ?? 0)),
            size,
          );
          if ((!known && versions.length >= 256) || retainedBytes > maxRetainedBytes) {
            abort(libraryFull());
            return;
          }
          const readOld = projects.get(project.id);
          readOld.onsuccess = () => {
            const old = readOld.result;
            if (repair && (!known || !old)) {
              abort('The exact saved revision is no longer available for repair.');
              return;
            }
            const oldAssets = stored.index('project').getAll(project.id);
            oldAssets.onsuccess = () => {
              try {
                if (
                  old &&
                  old.sha256 !== sha256 &&
                  !versions.some((v) => v.id === old.id && v.sha256 === old.sha256)
                ) {
                  const oldSize = oldAssets.result.reduce(
                    (n, r) => n + r.blob.size,
                    projectBytes(old.project),
                  );
                  if (
                    versions.length + (known ? 0 : 1) + 1 > 256 ||
                    retainedBytes + oldSize > maxRetainedBytes
                  ) {
                    abort(libraryFull());
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
                // Reinstallation has already verified the incoming immutable bytes.
                // Refresh the exact retained copy too: get(id, {sha256}) prefers it.
                // Preserve its original installation metadata and every other revision.
                revisions.put({ ...(known || record), project, assets, bytes: size });
                // The project-index read already captured every old key in this
                // transaction. Queue their removal together instead of waiting
                // for another cursor round trip for each regional source file.
                if (!repair || old.sha256 === sha256) {
                  for (const { path } of oldAssets.result) stored.delete([project.id, path]);
                  for (const [path, blob] of assets)
                    stored.put({ projectId: project.id, path, blob });
                  projects.put(repair ? { ...old, project } : record);
                }
                meta.put(next, 'generation');
                result = { project, generation: next, sha256 };
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
        ? new Promise((resolve, reject) => {
            const rows = [],
              cursor = tx.objectStore('revisions').openCursor();
            cursor.onerror = () => reject(cursor.error);
            cursor.onsuccess = () => {
              const current = cursor.result;
              if (!current) return resolve(rows);
              // Keep only metadata between deliveries, not every revision's asset Map.
              const { assets, ...record } = current.value;
              void assets;
              rows.push(record);
              current.continue();
            };
          })
        : Promise.resolve([]);
    const [active, all] = await Promise.all([activeRequest, allRequest, done]);
    const result = active.map((r) => ({ ...r, active: true }));
    if (includeRevisions)
      for (const row of all)
        if (!active.some((r) => r.id === row.id && r.sha256 === row.sha256))
          result.push({ ...row, active: false });
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
    checkInstallCapacity,
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
