import test from 'node:test';
import assert from 'node:assert/strict';
import { createExternalChapterBackup } from '../external-chapter-backup.mjs';
import {
  createExternalBackupAssets,
  EXTERNAL_BACKUP_JOURNAL_FORMAT,
} from '../external-backup-assets.mjs';
import { prepareBackup, exportBackup, BACKUP_FORMAT, EXTERNAL_BACKUP_FORMAT } from '../backup.mjs';
import { commitBackup, recoverBackupImport } from '../backup-storage.mjs';
import { emptyLibrary, updatePreferences } from '../library.mjs';
import { emptyPackLibrary, installPack, exportPackLibrary } from '../packs.mjs';
import { emptyExternalChapterIndex } from '../external-chapter.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { prepareMediaBundleRestore, commitMediaBundleRestore } from '../media-bundle.mjs';
import { createBackupPictureIdentityResolver } from '../ui/picture-identity.mjs';
import { prepareProfileTransfer, transferFingerprint } from '../profile-transfer.mjs';
import { buildExternalPilot } from '../../authoring/library/external-chapter-pilot/build.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

// The real compiler fully verifies all three original PNGs. Repeated runtime
// decoding uses their authentic headers; this is modeled IDB/codec qualification.
const pilot = await buildExternalPilot();
const packs = installPack(emptyPackLibrary(), pilot.prepared.pack);
const index = { ...emptyExternalChapterIndex(), chapters: [pilot.descriptor] };
async function decodeImage(value) {
  const header = inspectImageDataUrl(
    typeof value === 'string'
      ? value
      : `data:image/png;base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`,
  );
  assert.equal(header.valid, true);
  return { naturalWidth: header.width, naturalHeight: header.height };
}
class Locks {
  held = new Set();
  async request(key, options, action) {
    if (typeof options === 'function') {
      action = options;
      options = {};
    }
    if (this.held.has(key)) return action(null);
    this.held.add(key);
    try {
      return await action({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
// Deliberately model loss of an adapter completion reply AFTER the underlying
// native transaction has committed. This is not a claim that a browser emits
// abort after complete; it exercises the owned compensating recovery boundary.
function uncertainAssetReply(indexedDB) {
  let armed = false,
    lost = 0;
  const databases = new WeakMap();
  function wrapDatabase(db) {
    if (databases.has(db)) return databases.get(db);
    const proxy = new Proxy(db, {
      get(target, key) {
        if (key !== 'transaction') return Reflect.get(target, key);
        return (...args) => {
          const tx = target.transaction(...args);
          let clearing = false,
            replyError = null;
          return new Proxy(tx, {
            get(real, field) {
              if (field === 'error' && replyError) return replyError;
              if (field !== 'objectStore') return Reflect.get(real, field);
              return (name) => {
                const store = real.objectStore(name);
                return new Proxy(store, {
                  get(object, member) {
                    if (member !== 'put') return Reflect.get(object, member);
                    return (value, id) => {
                      if (name === 'assets' && id.endsWith('.backup-journal') && value === null)
                        clearing = true;
                      return object.put(value, id);
                    };
                  },
                });
              };
            },
            set(real, field, handler) {
              if (field === 'oncomplete') {
                real.oncomplete = (...values) => {
                  if (armed && clearing) {
                    armed = false;
                    lost++;
                    replyError = new Error('Modeled finalization reply lost after commit.');
                    real.onabort?.();
                  } else handler(...values);
                };
              } else Reflect.set(real, field, handler);
              return true;
            },
          });
        };
      },
    });
    databases.set(db, proxy);
    return proxy;
  }
  return {
    get lost() {
      return lost;
    },
    arm() {
      armed = true;
    },
    indexedDB: {
      open(...args) {
        const request = indexedDB.open(...args);
        return new Proxy(request, {
          get(target, key) {
            if (key === 'result' && target.result) return wrapDatabase(target.result);
            return Reflect.get(target, key);
          },
        });
      },
    },
  };
}
async function setup(t, channel = 'dev') {
  const idb = managedIndexedDB(),
    media = managedIndexedDB(),
    locks = new Locks(),
    local = new Map();
  const writer = { writable: true };
  const uncertain = uncertainAssetReply(idb.indexedDB);
  let localFault = () => {},
    decodeHook = null;
  const localWrites = [];
  const storage = {
    get length() {
      return local.size;
    },
    key: (i) => [...local.keys()][i] ?? null,
    getItem: (key) => local.get(key) ?? null,
    setItem(key, value) {
      localFault(key, value);
      local.set(key, String(value));
      localWrites.push([key, value]);
    },
    removeItem(key) {
      localFault(key, null);
      local.delete(key);
      localWrites.push([key, null]);
    },
  };
  const manager = createManagedMediaStore({ indexedDB: media.indexedDB, storyMedia: true });
  const still = createStillMediaStore({ managedStore: manager, decodeImage });
  let borrowed = 0;
  const config = {
    indexedDB: uncertain.indexedDB,
    storage,
    writer,
    lockManager: locks,
    profileKey: `revealline.library.${channel}.v1`,
    packsKey: `revealline.packs.${channel}.v1`,
    registeredEntries: [],
    knownDescriptors: [pilot.descriptor],
    getManagedStore: () => {
      borrowed++;
      return manager;
    },
    decodeImage: async (...args) => {
      await decodeHook?.();
      return decodeImage(...args);
    },
  };
  let companion = createExternalChapterBackup(config);
  const keys = companion.assets.keys;
  const put = async (key, value) => {
    await companion.assets.snapshot();
    const db = await new Promise((resolve, reject) => {
      const r = idb.indexedDB.open('revealline-assets-v1', 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('assets', 'readwrite');
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
        tx.objectStore('assets').put(value, key);
      });
    } finally {
      db.close();
    }
  };
  const api = {
    ...keys,
    storage,
    readAsset: async (key) => structuredClone(idb.contents().get('assets')?.get(key) ?? null),
    writeAsset: async (key, value) => {
      await put(key, value);
    },
    withLock: (work) =>
      locks.request(keys.lockKey, { mode: 'exclusive' }, (held) => {
        assert.ok(held);
        return work();
      }),
    commitProfile: async (library, options) => {
      assert.equal(storage.getItem(keys.lockKey), options.writeLock.token);
      storage.setItem(keys.profileKey, JSON.stringify(library));
      return { ok: true };
    },
    get externalBackup() {
      return companion;
    },
  };
  const options = () => ({
    decodeImage,
    prepareExternalChapters: companion.prepareExternalChapters,
  });
  const contents = (external = true) => ({
    library: emptyLibrary(),
    packs: external ? packs : emptyPackLibrary(),
    session: null,
    externalChapters: external ? index : emptyExternalChapterIndex(),
  });
  const prepare = async (external = true) =>
    prepareBackup({ format: EXTERNAL_BACKUP_FORMAT, ...contents(external) }, options());
  const installMedia = async () => {
    const review = await prepareMediaBundleRestore(pilot.prepared.imported, {
      store: still,
      assignmentMode: 'restore',
      decodeImage,
    });
    await commitMediaBundleRestore(review);
  };
  t.after(() => {
    companion.close();
    still.close();
    manager.close();
  });
  return {
    idb,
    uncertain,
    media,
    locks,
    local,
    localWrites,
    storage,
    writer,
    manager,
    still,
    keys,
    api,
    options,
    contents,
    prepare,
    installMedia,
    put,
    get companion() {
      return companion;
    },
    get borrowed() {
      return borrowed;
    },
    fault: (fn) => {
      localFault = fn;
    },
    decode: (fn) => {
      decodeHook = fn;
    },
    restart() {
      companion.close();
      companion = createExternalChapterBackup(config);
    },
  };
}

test('legacy backup JSON stays byte-compatible and explicit v2 requires the trusted companion', async (t) => {
  const h = await setup(t);
  const ordinary = { library: emptyLibrary(), packs: emptyPackLibrary(), session: null };
  const prepared = await prepareBackup({ format: BACKUP_FORMAT, ...ordinary });
  assert.equal(
    await exportBackup(ordinary),
    JSON.stringify({ format: BACKUP_FORMAT, ...prepared }),
  );
  await assert.rejects(
    prepareBackup({ format: EXTERNAL_BACKUP_FORMAT, ...h.contents() }),
    /supported descriptor companion/,
  );
  assert.equal(h.borrowed, 0);
  assert.equal(h.media.openCount, 0);
});

test('metadata-only v2 export retains exact descriptor and fingerprints it without claiming available originals', async (t) => {
  const h = await setup(t);
  const text = await exportBackup(h.contents(), h.options());
  const saved = JSON.parse(text);
  assert.deepEqual(saved.externalChapters, index);
  assert.equal(saved.format, EXTERNAL_BACKUP_FORMAT);
  assert.equal(text.includes('data:image/'), false);
  assert.equal(h.borrowed, 0);
  const prepared = await prepareBackup(text, h.options());
  assert.notEqual(
    await transferFingerprint(prepared),
    await transferFingerprint(await h.prepare(false)),
  );
  const result = await commitBackup(prepared, h.api);
  assert.equal(result.ok, false);
  assert.match(result.warning, /missing|Restore/);
  assert.equal(h.idb.allPuts.length, 0);
  assert.equal(h.localWrites.length, 0);
});

test('foreign, changed and omitted descriptors refuse compact-only authority', async (t) => {
  const h = await setup(t);
  const v1 = { format: BACKUP_FORMAT, library: emptyLibrary(), packs, session: null };
  await assert.rejects(prepareBackup(v1, h.options()), /needs its descriptor index/);
  const changed = h.contents();
  changed.externalChapters = structuredClone(index);
  changed.externalChapters.chapters[0].media.sha256 = '0'.repeat(64);
  await assert.rejects(
    prepareBackup({ format: EXTERNAL_BACKUP_FORMAT, ...changed }, h.options()),
    /trusted external/,
  );
  const absent = { ...h.contents(), packs: emptyPackLibrary() };
  await assert.rejects(
    prepareBackup({ format: EXTERNAL_BACKUP_FORMAT, ...absent }, h.options()),
    /differs from the installed pack/,
  );
  const unknown = createExternalChapterBackup({
    indexedDB: h.idb.indexedDB,
    storage: h.storage,
    writer: h.writer,
    lockManager: h.locks,
    profileKey: h.keys.profileKey,
    packsKey: h.keys.packsKey,
    getManagedStore: () => h.manager,
  });
  t.after(() => unknown.close());
  await assert.rejects(
    prepareBackup(
      { format: EXTERNAL_BACKUP_FORMAT, ...h.contents() },
      { ...h.options(), prepareExternalChapters: unknown.prepareExternalChapters },
    ),
    /trusted external/,
  );
});

test('fresh paired-original restore then v2 commit publishes both assets together without any media write', async (t) => {
  const h = await setup(t);
  await h.installMedia();
  const mediaBefore = h.media.contents(),
    puts = h.media.allPuts.length;
  const result = await commitBackup(await h.prepare(), h.api);
  assert.equal(result.ok, true, result.warning);
  const state = await h.companion.assets.snapshot();
  assert.deepEqual(JSON.parse(state.packs), packs);
  assert.deepEqual(state.index, index);
  assert.equal(state.backup, null);
  assert.equal(state.external, null);
  assert.equal(h.storage.getItem(h.keys.lockKey), null);
  assert.equal(h.media.allPuts.length, puts);
  assert.deepEqual(h.media.contents(), mediaBefore);
  const saved = await h.companion.snapshot(() => ({
    library: emptyLibrary(),
    packs,
    session: null,
  }));
  assert.deepEqual(saved.externalChapters, index);
});

test('explicit empty v2 Undo preserves exact original bytes and historical records; v1 cannot strip index', async (t) => {
  const h = await setup(t);
  await h.installMedia();
  const prior = await h.companion.snapshot(() => ({
    library: emptyLibrary(),
    packs: emptyPackLibrary(),
    session: null,
  }));
  const undo = await prepareBackup({ format: EXTERNAL_BACKUP_FORMAT, ...prior }, h.options());
  assert.equal((await commitBackup(await h.prepare(), h.api)).ok, true);
  const retained = h.media.contents();
  const v1 = await prepareBackup(
    { format: BACKUP_FORMAT, library: emptyLibrary(), packs: emptyPackLibrary(), session: null },
    h.options(),
  );
  const refused = await commitBackup(v1, h.api);
  assert.equal(refused.ok, false);
  assert.match(refused.warning, /explicit backup.v2/);
  assert.equal((await commitBackup(undo, h.api)).ok, true);
  assert.deepEqual((await h.companion.assets.snapshot()).index, emptyExternalChapterIndex());
  assert.deepEqual(h.media.contents(), retained);
  const snapshot = await h.still.readMetadata();
  const resolver = createBackupPictureIdentityResolver({ baseEntries: [], metadata: snapshot });
  const catalog = resolver({ originals: [], packs: emptyPackLibrary(), campaigns: [] });
  for (const original of pilot.descriptor.originals) {
    assert.equal(
      catalog.has({
        baseCampaignKey: pilot.descriptor.campaignKey,
        levelId: original.levelId,
        levelRevision: original.levelRevision,
        themeId: pilot.descriptor.themeId,
      }),
      true,
    );
    assert.equal(
      (await h.still.readAsset(snapshot, original.assetId, { decodeImage })).blob.size,
      original.bytes,
    );
  }
});

test('profile failure rolls back raw pack/index/profile/session values with no media changes', async (t) => {
  const h = await setup(t);
  await h.installMedia();
  h.local.set(h.keys.profileKey, 'exact invalid old profile');
  h.local.set(h.keys.sessionKey, 'exact old session');
  await h.put(h.keys.packsKey, 'old invalid pack bytes');
  const before = await h.companion.assets.snapshot(),
    mediaBefore = h.media.contents();
  h.api.commitProfile = async () => ({ ok: false, warning: 'deliberate profile refusal' });
  const result = await commitBackup(await h.prepare(), h.api);
  assert.equal(result.ok, false);
  assert.equal(result.rolledBack, true, result.warning);
  assert.deepEqual(await h.companion.assets.snapshot(), before);
  assert.equal(h.storage.getItem(h.keys.profileKey), 'exact invalid old profile');
  assert.equal(h.storage.getItem(h.keys.sessionKey), 'exact old session');
  assert.deepEqual(h.media.contents(), mediaBefore);
});

test('native pair transaction abort never exposes a lone new pack pointer or index', async (t) => {
  const h = await setup(t);
  await h.installMedia();
  let failed = false;
  h.idb.onAnyPut = ({ key, tx }) => {
    if (!failed && key === h.keys.indexKey) {
      failed = true;
      tx.abort();
    }
  };
  const result = await commitBackup(await h.prepare(), h.api);
  assert.equal(result.ok, false);
  assert.equal(result.rolledBack, true, result.warning);
  const after = await h.companion.assets.snapshot();
  assert.equal(after.packs, null);
  assert.equal(after.index, null);
  assert.equal(after.backup, null);
});

async function interrupted(h) {
  const before = await h.companion.assets.snapshot();
  const value = h.companion.assets.journal({
    format: EXTERNAL_BACKUP_JOURNAL_FORMAT,
    token: 'owned-interruption',
    targets: {
      profileKey: h.keys.profileKey,
      packsKey: h.keys.packsKey,
      sessionKey: h.keys.sessionKey,
      lockKey: h.keys.lockKey,
      indexKey: h.keys.indexKey,
    },
    previous: {
      profile: 'raw profile before',
      session: 'raw session before',
      packs: before.packs,
      index: before.index,
    },
    next: { packs: exportPackLibrary(packs), index },
  });
  h.storage.setItem(h.keys.lockKey, value.token);
  await h.companion.assets.begin(before, value);
  await h.companion.assets.publish(value);
  h.local.set(h.keys.profileKey, 'partial profile');
  h.local.set(h.keys.sessionKey, 'partial session');
  return value;
}
test('restart recovery restores exact native pair and local values from the owned v2 journal', async (t) => {
  const h = await setup(t);
  await interrupted(h);
  h.restart();
  const result = await recoverBackupImport(h.api);
  assert.equal(result.ok, true, result.warning);
  assert.equal(result.recovered, true);
  const state = await h.companion.assets.snapshot();
  assert.equal(state.index, null);
  assert.equal(state.packs, null);
  assert.equal(state.backup, null);
  assert.equal(h.storage.getItem(h.keys.profileKey), 'raw profile before');
  assert.equal(h.storage.getItem(h.keys.sessionKey), 'raw session before');
});

test('mixed journals and changed ownership keep all raw recovery data untouched', async (t) => {
  const h = await setup(t);
  const journal = await interrupted(h);
  await h.put(h.keys.externalJournalKey, { exact: 'other journal' });
  const before = await h.companion.assets.snapshot(),
    locals = new Map(h.local);
  let result = await recoverBackupImport(h.api);
  assert.equal(result.ok, false);
  assert.match(result.warning, /mixed journals/);
  assert.deepEqual(await h.companion.assets.snapshot(), before);
  assert.deepEqual(h.local, locals);
  await h.put(h.keys.externalJournalKey, null);
  h.local.set(h.keys.lockKey, 'another-owner');
  result = await recoverBackupImport(h.api);
  assert.equal(result.ok, false);
  assert.match(result.warning, /Another operation/);
  assert.deepEqual((await h.companion.assets.snapshot()).backup, journal);
});

test('failed recovery retains the journal and succeeds after storage becomes available', async (t) => {
  const h = await setup(t);
  const journal = await interrupted(h);
  h.fault((key) => {
    if (key === h.keys.profileKey) throw new Error('local quota');
  });
  const first = await recoverBackupImport(h.api);
  assert.equal(first.ok, false);
  assert.equal(first.recoveryRequired, true);
  assert.deepEqual((await h.companion.assets.snapshot()).backup, journal);
  assert.equal(h.storage.getItem(h.keys.lockKey), journal.token);
  h.fault(() => {});
  assert.equal((await recoverBackupImport(h.api)).ok, true);
});

test('missing/corrupt original refuses before journal and does not change descriptor metadata', async (t) => {
  const h = await setup(t);
  await h.installMedia();
  const hash = pilot.descriptor.originals[0].sha256;
  const db = await new Promise((resolve, reject) => {
    const request = h.media.indexedDB.open('revealline-soundtrack-v1', 4);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('mediaBlobs', 'readwrite');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
    tx.objectStore('mediaBlobs').put(
      new Blob([new Uint8Array(pilot.descriptor.originals[0].bytes)]),
      hash,
    );
  });
  db.close();
  const before = h.idb.allPuts.length,
    metadata = await h.still.readMetadata();
  const result = await commitBackup(await h.prepare(), h.api);
  assert.equal(result.ok, false);
  assert.match(result.warning, /byte length|SHA-256|missing/);
  assert.equal(h.idb.allPuts.length, before);
  assert.equal(h.localWrites.length, 0);
  assert.deepEqual(await h.still.readMetadata(), metadata);
});

test('preparation cancellation and changed current snapshot never produce adoption or native writes', async (t) => {
  const h = await setup(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    prepareBackup(
      { format: EXTERNAL_BACKUP_FORMAT, ...h.contents() },
      { ...h.options(), signal: controller.signal },
    ),
    { name: 'AbortError' },
  );
  let reads = 0;
  await assert.rejects(
    h.companion.snapshot(() => ({
      library: reads++ ? updatePreferences(emptyLibrary(), { musicEnabled: true }) : emptyLibrary(),
      packs: emptyPackLibrary(),
      session: null,
    })),
    /snapshot changed/,
  );
  assert.equal(h.idb.allPuts.length, 0);
  assert.equal(h.localWrites.length, 0);
});

test('source-locked transfer fingerprints exact raw bytes and preserves its descriptor without source writes', async (t) => {
  const h = await setup(t, 'release-v0.34.0');
  h.local.set(h.keys.profileKey, JSON.stringify(emptyLibrary()));
  await h.put(h.keys.packsKey, exportPackLibrary(packs));
  await h.put(h.keys.indexKey, index);
  const puts = h.idb.allPuts.length,
    local = new Map(h.local);
  const options = {
    storage: h.storage,
    readAsset: h.api.readAsset,
    lockManager: h.locks,
    currentVersion: '0.35.0',
    ...h.options(),
    readExternalSnapshot: h.companion.readExternalSnapshot,
  };
  const first = await prepareProfileTransfer('release-v0.34.0', options);
  assert.deepEqual(first.prepared.externalChapters, index);
  assert.equal(h.idb.allPuts.length, puts);
  assert.deepEqual(h.local, local);
  assert.equal(h.borrowed, 0);
  h.local.set(h.keys.profileKey, JSON.stringify(emptyLibrary(), null, 2));
  const second = await prepareProfileTransfer('release-v0.34.0', options);
  assert.deepEqual(second.prepared, first.prepared);
  assert.notEqual(second.fingerprint, first.fingerprint);
});

test('legacy release source with no index still reads through the optional source adapter', async (t) => {
  const h = await setup(t, 'release');
  h.local.set(h.keys.profileKey, JSON.stringify(emptyLibrary()));
  const result = await prepareProfileTransfer('release', {
    storage: h.storage,
    readAsset: h.api.readAsset,
    lockManager: h.locks,
    currentVersion: '0.35.0',
    ...h.options(),
    readExternalSnapshot: h.companion.readExternalSnapshot,
  });
  assert.equal(Object.hasOwn(result.prepared, 'externalChapters'), false);
  assert.equal(h.idb.allPuts.length, 0);
});

test('cross-key journal and stale raw assets refuse native publication', async (t) => {
  const h = await setup(t);
  const journal = await interrupted(h);
  assert.throws(
    () =>
      h.companion.assets.journal({
        ...journal,
        targets: { ...journal.targets, indexKey: 'foreign' },
      }),
    /different keys/,
  );
  await h.put(h.keys.packsKey, 'foreign write after interruption');
  const before = await h.companion.assets.snapshot();
  const result = await recoverBackupImport(h.api);
  assert.equal(result.ok, false);
  assert.match(result.warning, /outside the owned transaction/);
  assert.deepEqual(await h.companion.assets.snapshot(), before);
});

test('native assets remain read-only without a current writer and reject fabricated adapters', async (t) => {
  const h = await setup(t);
  const journal = await interrupted(h);
  h.writer.writable = false;
  await assert.rejects(h.companion.assets.restore(journal), /writer lease/);
  const result = await commitBackup(await h.prepare(false), {
    ...h.api,
    externalBackup: { assets: h.companion.assets },
  });
  assert.equal(result.ok, false);
  assert.match(result.warning, /verified external backup companion/);
  const reader = createExternalBackupAssets({
    indexedDB: h.idb.indexedDB,
    storage: h.storage,
    profileKey: h.keys.profileKey,
    packsKey: h.keys.packsKey,
  });
  t.after(() => reader.close());
  assert.deepEqual((await reader.snapshot()).backup, journal);
});

test('cancellation while verifying real original bytes stops before the backup journal', async (t) => {
  const h = await setup(t);
  await h.installMedia();
  const controller = new AbortController();
  h.decode(() => controller.abort());
  const before = h.idb.allPuts.length;
  const result = await commitBackup(await h.prepare(), { ...h.api, signal: controller.signal });
  assert.equal(result.ok, false);
  assert.match(result.warning, /cancelled/);
  assert.equal(h.idb.allPuts.length, before);
  assert.equal(h.localWrites.length, 0);
});

test('a concurrent original metadata generation change invalidates commit before any journal write', async (t) => {
  const h = await setup(t);
  await h.installMedia();
  const current = await h.still.read();
  const preparedMedia = await h.still.prepare(current.document.library, current.assets, {
    previous: current.document,
    executionCatalog: pilot.prepared.executionCatalog,
  });
  let changed = false;
  h.decode(async () => {
    if (changed) return;
    changed = true;
    await h.still.commit(preparedMedia, { expectedGeneration: current.generation });
  });
  const before = h.idb.allPuts.length;
  const result = await commitBackup(await h.prepare(), h.api);
  assert.equal(result.ok, false);
  assert.match(result.warning, /Media changed|media changed/);
  assert.equal(h.idb.allPuts.length, before);
  assert.equal(h.localWrites.length, 0);
});

test('legacy backup journal beside an indexed chapter refuses automatic recovery', async (t) => {
  const h = await setup(t);
  const journal = {
    format: 'xonix-backup-journal.v1',
    token: 'old',
    targets: {
      profileKey: h.keys.profileKey,
      packsKey: h.keys.packsKey,
      sessionKey: h.keys.sessionKey,
      lockKey: h.keys.lockKey,
    },
    previous: { profile: null, session: null, packs: null },
  };
  await h.put(h.keys.indexKey, index);
  await h.put(h.keys.journalKey, journal);
  const before = await h.companion.assets.snapshot(),
    puts = h.idb.allPuts.length;
  const result = await recoverBackupImport(h.api);
  assert.equal(result.ok, false);
  assert.match(result.warning, /legacy backup journal beside/);
  assert.deepEqual(await h.companion.assets.snapshot(), before);
  assert.equal(h.idb.allPuts.length, puts);
  assert.equal(h.localWrites.length, 0);
});

test('real earned external poster remains resolvable after explicit replacement and its saved flight cannot silently lose the pack', async (t) => {
  const { readFile } = await import('node:fs/promises');
  const { createRun, stepRun, getSummary, FIXED_DT } = await import('../core/index.mjs');
  const { createRecorder, recordInput } = await import('../replay.mjs');
  const { suspendSession } = await import('../sessions.mjs');
  const { recordLibraryCompletion } = await import('../library.mjs');
  const { createPictureIdentityCatalog } = await import('../ui/picture-identity.mjs');
  const { validateMediaLibrary } = await import('../media-library.mjs');
  const { hydrateStoredStillMedia } = await import('../media-storage-record.mjs');
  const { createFlightPresentationPins } = await import('../flight-media-pins.mjs');
  const { emptyStoredStories } = await import('../story-storage-record.mjs');
  const h = await setup(t);
  await h.installMedia();
  const { metadata } = await h.still.readPresentationMetadata();
  const entry = pilot.prepared.executionCatalog.select(pilot.descriptor.campaignKey, 'standard');
  const identityCatalog = createPictureIdentityCatalog({ entries: [entry], metadata });
  const library = validateMediaLibrary(hydrateStoredStillMedia(metadata.document).library, {
    identityCatalog,
  });
  const level = entry.campaign.levels[0];
  const pins = await createFlightPresentationPins({
    library,
    identityCatalog,
    executionKey: entry.executionKey,
    levelId: level.id,
    levelRevision: level.revision,
    themeIds: [pilot.descriptor.themeId],
    stillDocument: metadata.document,
    storyDocument: emptyStoredStories(),
  });
  assert.equal(pins.choices[0].picture.kind, 'still');
  assert.equal(pins.choices[0].story, null);
  const options = {
    classId: 'scout',
    seed: 1,
    turnPolicy: 'immediate',
    classRecipes: entry.campaign.classRecipes,
  };
  const route = JSON.parse(
    await readFile(new URL('../replays/fpv-arcade-r5-routes.json', import.meta.url), 'utf8'),
  ).routes.find(
    (r) =>
      r.packId === 'fpv-arcade-r5' && r.difficulty === 'standard' && r.turnPolicy === 'immediate',
  );
  const run = createRun(level, options);
  for (const segment of route.segments)
    for (let tick = 0; tick < segment.ticks && run.status === 'running'; tick++)
      stepRun(run, segment.input, FIXED_DT);
  assert.equal(run.status, 'won');
  const earned = recordLibraryCompletion(emptyLibrary(), {
    campaign: entry.campaign,
    result: getSummary(run),
    sourcePackId: pilot.descriptor.id,
    themeId: pilot.descriptor.themeId,
    bodyId: 'fpv-body',
    runId: 'actual-external-earned',
    completedAt: '2026-09-13T15:00:00.000Z',
    presentationPins: pins,
    mediaIdentityCatalog: identityCatalog,
  });
  assert.equal(earned.pictureReceipts.length, 1);
  assert.equal(earned.storyReceipts[0].storyPin, null);
  const backupOptions = {
    ...h.options(),
    resolveMediaIdentityCatalog: createBackupPictureIdentityResolver({ baseEntries: [], metadata }),
  };
  const withChapter = await prepareBackup(
    { format: EXTERNAL_BACKUP_FORMAT, ...h.contents(), library: earned },
    backupOptions,
  );
  assert.equal((await commitBackup(withChapter, h.api)).ok, true);
  const before = h.media.contents();
  const removed = await prepareBackup(
    { format: EXTERNAL_BACKUP_FORMAT, ...h.contents(false), library: earned },
    backupOptions,
  );
  assert.deepEqual(removed.library.pictureReceipts, earned.pictureReceipts);
  assert.deepEqual(removed.library.storyReceipts, earned.storyReceipts);
  assert.equal((await commitBackup(removed, h.api)).ok, true);
  assert.deepEqual(h.media.contents(), before);
  const retained = createPictureIdentityCatalog({
    entries: [],
    metadata: await h.still.readMetadata(),
  });
  assert.equal(retained.has(earned.pictureReceipts[0].presentationPin.identity), true);
  const active = createRun(level, options),
    recorder = createRecorder(level, options);
  for (let tick = 0; tick < 3; tick++) {
    const input = { direction: 'down' };
    recordInput(recorder, input);
    stepRun(active, input, FIXED_DT);
  }
  const session = suspendSession({
    run: active,
    recorder,
    campaignKey: entry.executionKey,
    themeId: pilot.descriptor.themeId,
    bodyId: 'fpv-body',
    runId: 'saved-external',
    savedAt: '2026-09-13T15:01:00.000Z',
    continuation: { direction: 'down' },
    presentationPins: pins,
  });
  await assert.rejects(
    prepareBackup(
      { format: EXTERNAL_BACKUP_FORMAT, ...h.contents(false), library: earned, session },
      backupOptions,
    ),
    /matching included pack/,
  );
  const complete = await prepareBackup(
    { format: EXTERNAL_BACKUP_FORMAT, ...h.contents(), library: earned, session },
    backupOptions,
  );
  assert.deepEqual(complete.session.presentationPins, session.presentationPins);
});

test('supported metadata backup still refuses pack-only export that would strip the index', async (t) => {
  const h = await setup(t);
  await h.put(h.keys.packsKey, exportPackLibrary(packs));
  await h.put(h.keys.indexKey, index);
  const before = h.idb.allPuts.length;
  await h.companion.assertSupported({ kind: 'backup' });
  await assert.rejects(
    h.companion.assertSupported({ kind: 'packs' }),
    /Pack-only export would omit/,
  );
  assert.equal(h.idb.allPuts.length, before);
  assert.equal(h.borrowed, 0);
});

test('source external journal and non-writer target are refused without local writes', async (t) => {
  const h = await setup(t, 'release-v0.34.0');
  h.local.set(h.keys.profileKey, JSON.stringify(emptyLibrary()));
  await h.put(h.keys.externalJournalKey, { pending: 'exact external state' });
  const before = await h.companion.assets.snapshot(),
    puts = h.idb.allPuts.length;
  await assert.rejects(
    prepareProfileTransfer('release-v0.34.0', {
      storage: h.storage,
      readAsset: h.api.readAsset,
      lockManager: h.locks,
      currentVersion: '0.35.0',
      ...h.options(),
      readExternalSnapshot: h.companion.readExternalSnapshot,
    }),
    /pending backup\/external/,
  );
  assert.deepEqual(await h.companion.assets.snapshot(), before);
  assert.equal(h.idb.allPuts.length, puts);
  await h.put(h.keys.externalJournalKey, null);
  h.writer.writable = false;
  const result = await commitBackup(await h.prepare(false), h.api);
  assert.equal(result.ok, false);
  assert.match(result.warning, /writer lease/);
  assert.equal(h.localWrites.length, 0);
});

test('modeled reply loss after committed final journal clear re-establishes owned recovery and rolls back exact values', async (t) => {
  const h = await setup(t);
  await h.installMedia();
  h.local.set(h.keys.profileKey, 'exact prior profile bytes');
  h.local.set(h.keys.sessionKey, 'exact prior slot bytes');
  const before = await h.companion.assets.snapshot(),
    mediaBefore = h.media.contents();
  h.uncertain.arm();
  const result = await commitBackup(await h.prepare(), h.api);
  assert.equal(h.uncertain.lost, 1);
  assert.equal(result.ok, false);
  assert.equal(result.rolledBack, true, result.warning);
  assert.equal(result.recoveryRequired, false);
  assert.match(result.warning, /reply lost after commit/);
  assert.deepEqual(await h.companion.assets.snapshot(), before);
  assert.equal(h.storage.getItem(h.keys.profileKey), 'exact prior profile bytes');
  assert.equal(h.storage.getItem(h.keys.sessionKey), 'exact prior slot bytes');
  assert.equal(h.storage.getItem(h.keys.lockKey), null);
  assert.deepEqual(h.media.contents(), mediaBefore);
});
