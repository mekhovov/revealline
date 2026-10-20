import { openWorldStore } from './packaged-world-store.mjs';

export const TEST_DB_NAME = 'codex-authoring-native-library-listing-bc9-20261016-contract-v1';
const SIGNATURE = 'bc9-native-listing-contract-v1';
const GENERATION = 7;
const LIMIT = 8;
const check = (condition, message) => { if (!condition) throw new Error(message); };
const requested = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const completed = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onabort = () => reject(transaction.error || new Error('Test transaction aborted.'));
  transaction.onerror = () => {};
});
const metadata = ({ assets, ...row }) => row;
function fixtureRows() {
  return Array.from({ length: 32 }, (_, index) => {
    const id = `fixture-${String(index).padStart(2, '0')}`;
    const count = index === 31 ? 32 : 64;
    const blob = new Blob([new Uint8Array([index])], { type: 'application/octet-stream' });
    const project = { id, title: `Synthetic fixture ${index}`, courses: [{ id: `${id}-course` }] };
    return { id, sha256: index.toString(16).padStart(64, '0'), project,
      installedAt: '2026-10-16T00:00:00.000Z', generation: GENERATION,
      bytes: count + new TextEncoder().encode(JSON.stringify(project)).length,
      review: { preserved: true },
      assets: new Map(Array.from({ length: count }, (_, entry) => [`${String(entry).padStart(2, '0')}.bin`, blob])),
    };
  });
}

// Facades belong only to the explicitly supplied test factory. No native/global
// prototype or instance is patched, and native requests/results remain unchanged.
function makeFactory(rawFactory) {
  let rawDatabase = null, phase = null, lastTransaction = null, opens = 0;
  const databaseFacades = new WeakMap();
  const current = () => phase;
  const begin = (label) => {
    check(!phase, 'A test observation is already active.');
    lastTransaction = null;
    phase = { label, transactions: 0, modes: [], stores: [], revisionRequests: 0,
      deliveredAssetRows: 0, deliveredMapEntries: 0, maxRowsPerDelivery: 0 };
  };
  const end = () => { const result = phase; phase = null; lastTransaction = null; return result; };
  function databaseFacade(db) {
    if (databaseFacades.has(db)) return databaseFacades.get(db);
    const facade = new Proxy(db, {
      get(target, key) {
        if (key !== 'transaction') {
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
        return (...args) => {
          const tx = target.transaction(...args), observation = current();
          if (observation) {
            observation.transactions++;
            observation.modes.push(tx.mode);
            observation.stores.push(Array.from(tx.objectStoreNames));
            lastTransaction = tx;
          }
          const storeFacades = new Map();
          return new Proxy(tx, {
            get(transaction, property) {
              if (property !== 'objectStore') {
                const value = Reflect.get(transaction, property, transaction);
                return typeof value === 'function' ? value.bind(transaction) : value;
              }
              return (name) => {
                const store = transaction.objectStore(name);
                if (name !== 'revisions' || !observation) return store;
                if (storeFacades.has(name)) return storeFacades.get(name);
                const wrapped = new Proxy(store, {
                  get(objectStore, method) {
                    if (!['get', 'getAll', 'openCursor'].includes(method)) {
                      const value = Reflect.get(objectStore, method, objectStore);
                      return typeof value === 'function' ? value.bind(objectStore) : value;
                    }
                    return (...parameters) => {
                      observation.revisionRequests++;
                      const reading = objectStore[method](...parameters);
                      reading.addEventListener('success', () => {
                        if (current() !== observation) return;
                        const result = reading.result;
                        const rows = Array.isArray(result) ? result : [result?.value ?? result];
                        let assetRows = 0, entries = 0;
                        for (const row of rows) if (row?.assets instanceof Map) {
                          assetRows++; entries += row.assets.size;
                        }
                        observation.deliveredAssetRows += assetRows;
                        observation.deliveredMapEntries += entries;
                        observation.maxRowsPerDelivery = Math.max(observation.maxRowsPerDelivery, assetRows);
                      });
                      return reading;
                    };
                  },
                });
                storeFacades.set(name, wrapped);
                return wrapped;
              };
            },
            set(transaction, property, value) { return Reflect.set(transaction, property, value, transaction); },
          });
        };
      },
      set(target, key, value) { return Reflect.set(target, key, value, target); },
    });
    databaseFacades.set(db, facade);
    return facade;
  }
  return {
    indexedDB: { open(name, version) {
      check(name === TEST_DB_NAME && version === 2, 'Only the explicit version-two test database is allowed.');
      opens++;
      const opening = rawFactory.open(name, version);
      return new Proxy(opening, {
        get(target, key) {
          if (key === 'result') {
            rawDatabase = target.result;
            return databaseFacade(rawDatabase);
          }
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
        set(target, key, value) { return Reflect.set(target, key, value, target); },
      });
    } },
    begin, end,
    abortCurrent() { check(lastTransaction && phase, 'No test read is active.'); lastTransaction.abort(); },
    rawDatabase: () => rawDatabase,
    openCount: () => opens,
  };
}

export function createContract(rawFactory, { digest = async (text) => {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
} } = {}) {
  const factory = makeFactory(rawFactory), rows = fixtureRows();
  let store = null, ready = false, busy = false, baseline = null;
  const report = {
    format: 'codex-native-library-listing-contract-v1', databaseName: TEST_DB_NAME,
    sourceHead: 'bc9bc71f192729f0661a0483d7d64609c1973343',
    packagedModuleSha256: '6050ac77adf52c2b757b851c444a4b1430a8cbca34a9048713e540601ebcca22',
    fixture: { retainedRows: 32, retainedBlobReferences: 2016, activeShadowBlobReferences: 32,
      totalPersistedBlobReferences: 2048, uniqueOneByteBlobValues: 32, generation: GENERATION },
    scope: 'Explicit tiny synthetic component test; supplied factory facades change object identity. Native requests, results and transactions are real. No player database, renderer, heap/time/FPS, restart, offline, quota or public-persistence acceptance.',
    actions: [], droppedActions: 0,
  };
  const record = (result) => {
    if (report.actions.length === LIMIT) { report.actions.shift(); report.droppedActions++; }
    report.actions.push(result); return result;
  };
  async function counts() {
    const db = factory.rawDatabase();
    const tx = db.transaction(['projects', 'assets', 'revisions', 'meta'], 'readonly');
    const done = completed(tx);
    const requests = ['projects', 'assets', 'revisions', 'meta'].map((name) => requested(tx.objectStore(name).count()));
    const [projects, assets, revisions, meta] = await Promise.all([...requests, done]);
    return { projects, assets, revisions, meta };
  }
  async function fingerprint() {
    const content = [];
    for (let index = 0; index < rows.length; index++) {
      const expected = rows[index], saved = await store.get(expected.id, { sha256: expected.sha256 });
      check(saved && saved.active === (index === 31), 'Exact revision or active identity differs.');
      const { active, ...storedMetadata } = metadata(saved);
      check(JSON.stringify(storedMetadata) === JSON.stringify(metadata(expected)), 'Stored metadata differs.');
      check(saved.assets instanceof Map && saved.assets.size === expected.assets.size, 'Stored asset map differs.');
      const blobReads = new WeakMap(), files = [];
      for (const [path, blob] of saved.assets) {
        check(expected.assets.has(path) && blob instanceof Blob && blob.size === 1, 'Synthetic asset identity differs.');
        if (!blobReads.has(blob)) blobReads.set(blob, blob.arrayBuffer());
        const value = Array.from(new Uint8Array(await blobReads.get(blob)));
        check(value.length === 1 && value[0] === index, 'Synthetic content differs.');
        files.push([path, value]);
      }
      content.push([storedMetadata, active, files]);
    }
    const active = await store.get(rows[31].id);
    check(active?.active && active.assets.size === 32, 'Active shadow lookup differs.');
    for (const blob of active.assets.values()) check(new Uint8Array(await blob.arrayBuffer())[0] === 31, 'Active shadow content differs.');
    const generation = await store.generation(), sizes = await counts();
    check(generation === GENERATION, 'Generation changed.');
    check(JSON.stringify(sizes) === JSON.stringify({ projects: 1, assets: 32, revisions: 32, meta: 2 }), 'Store counts changed.');
    return { sha256: await digest(JSON.stringify({ content, generation, sizes })), generation, counts: sizes };
  }
  async function run(label, action) {
    check(!busy, 'Another fixture action is active.'); busy = true;
    try { return record({ action: label, accepted: true, ...(await action()) }); }
    catch (error) { return record({ action: label, accepted: false, error: String(error?.message || error).slice(0, 240) }); }
    finally { busy = false; }
  }
  return {
    name: TEST_DB_NAME,
    snapshot: () => structuredClone({ ...report, ready, opens: factory.openCount() }),
    seed: () => run('seed', async () => {
      check(!ready, 'Fixture is already ready. Use List metadata or Abort read.');
      store ||= await openWorldStore({ indexedDB: factory.indexedDB, name: TEST_DB_NAME });
      const db = factory.rawDatabase();
      const read = db.transaction('meta', 'readonly'), readDone = completed(read);
      const [marker] = await Promise.all([requested(read.objectStore('meta').get('native-contract-fixture')), readDone]);
      const before = await counts();
      let reused = false;
      if (marker?.signature === SIGNATURE) {
        check(JSON.stringify(before) === JSON.stringify({ projects: 1, assets: 32, revisions: 32, meta: 2 }), 'Existing test fixture has unexpected counts; left unchanged.');
        reused = true;
      } else {
        check(Object.values(before).every((count) => count === 0), 'Unknown nonempty test database refused; left unchanged.');
        const tx = db.transaction(['projects', 'assets', 'revisions', 'meta'], 'readwrite'), done = completed(tx);
        for (const row of rows) tx.objectStore('revisions').add(row);
        tx.objectStore('projects').add(metadata(rows[31]));
        for (const [path, blob] of rows[31].assets) tx.objectStore('assets').add({ projectId: rows[31].id, path, blob });
        tx.objectStore('meta').add(GENERATION, 'generation');
        tx.objectStore('meta').add({ signature: SIGNATURE }, 'native-contract-fixture');
        await done;
      }
      baseline = await fingerprint(); ready = true;
      return { reused, content: baseline, databaseVersion: db.version };
    }),
    list: () => run('list-metadata', async () => {
      check(ready, 'Seed the explicitly named fixture first.');
      factory.begin('list');
      let listed, observation;
      try { listed = await store.list({ includeRevisions: true }); }
      finally { observation = factory.end(); }
      const expected = [ { ...metadata(rows[31]), active: true }, ...rows.slice(0, 31).map((row) => ({ ...metadata(row), active: false })) ];
      check(JSON.stringify(listed) === JSON.stringify(expected), 'Active-first or primary-key metadata order differs.');
      check(listed.every((row) => !('assets' in row)), 'An asset map leaked into metadata.');
      check(observation.transactions === 1 && observation.modes.every((mode) => mode === 'readonly'), 'Listing did not use one readonly transaction.');
      check(observation.revisionRequests === 1 && observation.deliveredAssetRows === 32 && observation.maxRowsPerDelivery === 1 && observation.deliveredMapEntries === 2016, 'Retained payload fan-out differs.');
      // Mutate only the returned clone, then prove the saved fixture is unchanged.
      listed[0].project.title = 'Only this returned clone changed';
      const after = await fingerprint();
      check(after.sha256 === baseline.sha256, 'Content or generation changed after listing.');
      return { metadataRows: expected.length, activeFirst: true, retainedPrimaryKeyOrder: true, assetsOmitted: true,
        returnedCloneIsolation: true, observation, contentUnchanged: true, content: after };
    }),
    abort: () => run('abort-read', async () => {
      check(ready, 'Seed the explicitly named fixture first.');
      factory.begin('abort');
      let rejected = false, rejectionName = null, observation;
      try {
        const pending = store.list({ includeRevisions: true });
        // Deliberate synthetic test: queued readonly requests, before delivery.
        // Never touches a player transaction or manufactures a connection close.
        factory.abortCurrent();
        try { await pending; } catch (error) { rejected = true; rejectionName = String(error?.name || 'Error'); }
      } finally { observation = factory.end(); }
      check(rejected && observation.transactions === 1 && observation.modes.every((mode) => mode === 'readonly'), 'Aborted readonly listing did not reject.');
      const after = await fingerprint();
      check(after.sha256 === baseline.sha256, 'Content or generation changed after intentional readonly abort.');
      return { abortPoint: 'after requests queued, before first native delivery', rejected, rejectionName,
        partialSuccessReturned: false, observation, contentUnchanged: true, connectionStillUsable: true, content: after };
    }),
    close() { check(!busy, 'Cannot close during an action.'); store?.close(); ready = false; },
  };
}
