import test from 'node:test';
import assert from 'node:assert/strict';
import { createExternalChapterHost } from '../external-chapter-host.mjs';
import { createExternalChapterInstaller } from '../external-chapter-install.mjs';
import { createExternalChapterPointerStore } from '../external-chapter-pointer.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createStoryMediaStore } from '../story-media-store.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';
import {
  emptyPackLibrary,
  exportPackLibrary,
  installPack,
  preparePack,
  removePack,
} from '../packs.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { buildExternalPilot } from '../../authoring/library/external-chapter-pilot/build.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { fixture as audioFixture } from './helpers/soundtrack-fixtures.mjs';
import { createStoryFixture, inspectionEnvironment } from './helpers/victory-story-fixture.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const pilot = await buildExternalPilot();
const audio = await audioFixture();
// Real compiler PNG CRC/scanline checks, original bytes/hashes and real adapters.
// Repeated decodes model authenticated header dimensions, not browser hardware.
async function decodeImage(value) {
  const h = inspectImageDataUrl(
    typeof value === 'string'
      ? value
      : `data:image/png;base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`,
  );
  assert.equal(h.valid, true);
  return { naturalWidth: h.width, naturalHeight: h.height };
}
class Locks {
  held = new Set();
  async request(key, _options, action) {
    if (this.held.has(key)) return action(null);
    this.held.add(key);
    try {
      return await action({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
async function setup(t, options = {}) {
  const assets = managedIndexedDB(),
    media = managedIndexedDB(),
    locks = new Locks(),
    values = new Map();
  const pointer = createExternalChapterPointerStore({
    indexedDB: assets.indexedDB,
    profileKey: 'revealline.library.dev.v1',
    packsKey: 'revealline.packs.dev.v1',
  });
  const writer = await claimProfileWriter(locks, pointer.keys.writerKey);
  let quota = Infinity,
    borrows = 0,
    hook = null;
  const manager = createManagedMediaStore({
    indexedDB: media.indexedDB,
    storyMedia: true,
    estimate: async () => ({ quota, usage: 0 }),
  });
  const still = createStillMediaStore({ managedStore: manager, decodeImage });
  const config = {
    indexedDB: assets.indexedDB,
    profileKey: pointer.keys.profileKey,
    packsKey: pointer.keys.packsKey,
    storage: { getItem: (key) => values.get(key) ?? null },
    lockManager: locks,
    writer,
    getManagedStore: async () => {
      borrows++;
      await hook?.();
      return manager;
    },
    registeredEntries: [],
    knownDescriptors: [pilot.descriptor],
    decodeImage,
    ...options,
  };
  let host = createExternalChapterHost(config);
  async function put(key, value) {
    await pointer.snapshot().catch(() => {});
    const db = await new Promise((resolve, reject) => {
      const r = assets.indexedDB.open('revealline-assets-v1', 1);
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
  }
  t.after(() => {
    host.close();
    still.close();
    manager.close();
    pointer.close();
    writer.release();
  });
  return {
    assets,
    media,
    locks,
    values,
    pointer,
    writer,
    manager,
    still,
    config,
    put,
    get host() {
      return host;
    },
    get borrows() {
      return borrows;
    },
    set hook(value) {
      hook = value;
    },
    set quota(value) {
      quota = value;
    },
    restart() {
      host.close();
      host = createExternalChapterHost(config);
    },
  };
}
const request = (snapshot, difficulty = 'standard') => {
  const entry = snapshot.executionCatalog.select(pilot.descriptor.campaignKey, difficulty);
  return {
    executionKey: entry.executionKey,
    levelId: entry.campaign.levels[0].id,
    levelRevision: entry.campaign.levels[0].revision,
    themeId: 'fpv',
  };
};
async function ordinary() {
  const value = structuredClone(pilot.prepared.pack);
  value.id = 'ordinary-test';
  value.campaigns[0].id = 'ordinary-campaign';
  return (await preparePack(value, { decodeImage })).pack;
}

test('ordinary empty/read/write path stays lazy and native CAS preserves old embedded contract', async (t) => {
  const h = await setup(t);
  assert.equal(h.assets.openCount, 0);
  assert.equal(h.media.openCount, 0);
  const before = await h.host.inspect();
  assert.equal(before.status, 'checked');
  const review = await h.host.prepareMutation(before, installPack(before.packs, await ordinary()));
  const result = await h.host.commitMutation(review);
  assert.equal(result.status, 'committed');
  assert.equal(result.packs.packs.length, 1);
  assert.equal(h.borrows, 0);
  assert.equal(h.media.openCount, 0);
  assert.equal((await h.pointer.snapshot()).index, null);
  assert.throws(() => h.host.commitMutation(review), /single-use/);
});

test('shared DB4 install, exact authored defaults, Gentle mapping and separate readiness preserve audio and story domain', async (t) => {
  const h = await setup(t);
  await h.manager.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  const f = createStoryFixture();
  await h.still.commit(
    await h.still.prepare(f.library, [{ sha256: f.pin.sha256, blob: new Blob([pngBytes()]) }], {
      executionCatalog: f.catalog,
    }),
    { expectedGeneration: 0 },
  );
  const stories = createStoryMediaStore({ managedStore: h.manager, decodeImage });
  await stories.commit(
    await stories.stage(
      { descriptor: f.descriptor, blob: f.blob },
      inspectionEnvironment().options,
    ),
  );
  const storyState = await stories.readMetadata();
  await stories.commit(
    await stories.stageBinding(
      { picturePin: f.pin, story: { id: f.descriptor.id, revision: 1 } },
      { expectedGeneration: storyState.generation, ...inspectionEnvironment().options },
    ),
  );
  t.after(() => stories.close());
  const beforeAudio = await h.manager.readDomain('audio');
  const beforeStory = await h.manager.readDomain('story');
  const result = await h.host.install(pilot.prepared);
  assert.equal(result.status, 'installed');
  const snapshot = await h.host.inspect();
  assert.equal(snapshot.status, 'checked');
  const ready = await h.host.readiness(snapshot, pilot.descriptor.id);
  assert.equal(ready.pins.length, 3);
  for (const difficulty of ['standard', 'gentle']) {
    const selected = await h.host.authoredPicture(snapshot, request(snapshot, difficulty));
    assert.deepEqual(selected.pin, ready.pins[0]);
    const original = await selected.store.readAsset(selected.metadata, selected.pin.assetId, {
      decodeImage,
    });
    assert.deepEqual(
      await original.blob.arrayBuffer(),
      await pilot.prepared.imported.assets
        .find((a) => a.sha256 === selected.pin.sha256)
        .blob.arrayBuffer(),
    );
  }
  assert.deepEqual(await h.manager.readDomain('audio'), beforeAudio);
  assert.deepEqual(await h.manager.readDomain('story'), beforeStory);
  assert.equal(h.values.size, 0);
  assert.equal(h.assets.allPuts.filter(([, key]) => key === h.pointer.keys.packsKey).length, 1);
});

test('cleared assignment and valid newer B do not erase the exact authored A; saved pin shapes are not requests', async (t) => {
  const h = await setup(t);
  await h.host.install(pilot.prepared);
  const first = await h.still.read();
  const next = structuredClone(first.document.library);
  const b = structuredClone(next.presentations[0]);
  b.revision = 2;
  b.description = 'Later B';
  next.presentations.push(b);
  next.assignments[0].revision = 2;
  await h.still.commit(
    await h.still.prepare(next, first.assets, {
      previous: first.document,
      executionCatalog: pilot.prepared.executionCatalog,
    }),
    { expectedGeneration: first.generation },
  );
  let snapshot = await h.host.inspect();
  const a = await h.host.authoredPicture(snapshot, request(snapshot));
  assert.equal(a.pin.presentationRevision, 1);
  const current = await h.still.read();
  const cleared = structuredClone(current.document.library);
  cleared.assignments = [];
  await h.still.commit(
    await h.still.prepare(cleared, current.assets, {
      previous: current.document,
      executionCatalog: createExecutionCatalog([]),
    }),
    { expectedGeneration: current.generation },
  );
  snapshot = await h.host.inspect();
  assert.deepEqual((await h.host.authoredPicture(snapshot, request(snapshot))).pin, a.pin);
  await assert.rejects(h.host.authoredPicture(snapshot, a.pin), /execution|original/);
});

test('known compact pack alone is refused without opening shared media; no ID-suffix heuristics', async (t) => {
  const h = await setup(t);
  await h.put(
    h.pointer.keys.packsKey,
    exportPackLibrary(installPack(emptyPackLibrary(), pilot.prepared.pack)),
  );
  await assert.rejects(h.host.inspect(), /descriptor index/);
  assert.equal(h.borrows, 0);
  await h.put(
    h.pointer.keys.packsKey,
    exportPackLibrary(installPack(emptyPackLibrary(), await ordinary())),
  );
  assert.equal((await h.host.inspect()).status, 'checked');
});

for (const [backup, external, expected] of [
  [true, false, 'backup-recovery'],
  [false, true, 'external-recovery'],
  [true, true, 'mixed-journals'],
]) {
  test(`coherent pending journal snapshot reports ${expected} and preserves rows`, async (t) => {
    const h = await setup(t);
    if (backup) await h.put(h.pointer.keys.backupJournalKey, { held: 'backup' });
    if (external) await h.put(h.pointer.keys.journalKey, { held: 'external' });
    const writes = h.assets.allPuts.length;
    const result = await h.host.inspect();
    assert.deepEqual(result, { status: 'recovery-required', reason: expected });
    await assert.rejects(h.host.recover(pilot.prepared), /backup|journal|recovery|JSON/);
    assert.equal(h.assets.allPuts.length, writes);
    assert.equal(h.borrows, external && !backup ? 1 : 0);
  });
}

test('interrupted native publication is withheld across restart and explicit recovery avoids nested-lock deadlock', async (t) => {
  const h = await setup(t);
  let fail = true;
  const installer = createExternalChapterInstaller({
    pointerStore: {
      ...h.pointer,
      async compareAndSwap(before, next, options) {
        const result = await h.pointer.compareAndSwap(before, next, options);
        if (fail && next.journal?.phase === 'published') {
          fail = false;
          throw new Error('Interrupted after native publication');
        }
        return result;
      },
    },
    managedStore: h.manager,
    writer: h.writer,
    lockManager: h.locks,
    storage: h.config.storage,
    registeredEntries: [],
    decodeImage,
  });
  await assert.rejects(installer.install(pilot.prepared), /Interrupted/);
  installer.close();
  h.restart();
  assert.deepEqual(await h.host.inspect(), {
    status: 'recovery-required',
    reason: 'external-recovery',
  });
  const generation = (await h.still.readMetadata()).generation;
  assert.equal((await h.host.recover(pilot.prepared)).status, 'installed');
  assert.equal((await h.still.readMetadata()).generation, generation);
  assert.equal((await h.host.inspect()).status, 'checked');
});

test('ordinary mutation preserves external index; external removal and changed same-ID gameplay refuse before writes', async (t) => {
  const h = await setup(t);
  await h.host.install(pilot.prepared);
  const snapshot = await h.host.inspect(),
    before = await h.pointer.snapshot();
  await assert.rejects(
    h.host.prepareMutation(snapshot, removePack(snapshot.packs, pilot.descriptor.id)),
    /gameplay differs/,
  );
  const altered = structuredClone(snapshot.packs);
  altered.packs[0].description += 'changed';
  await assert.rejects(h.host.prepareMutation(snapshot, altered), /gameplay differs/);
  const result = await h.host.commitMutation(
    await h.host.prepareMutation(snapshot, installPack(snapshot.packs, await ordinary())),
  );
  assert.equal(result.packs.packs.length, 2);
  assert.deepEqual((await h.pointer.snapshot()).index, before.index);
});

test('changed pointer, index or backup marker invalidates single-use reviewed write; fake reviews refuse', async (t) => {
  const h = await setup(t);
  const snapshot = await h.host.inspect();
  const review = await h.host.prepareMutation(
    snapshot,
    installPack(snapshot.packs, await ordinary()),
  );
  await h.put(h.pointer.keys.indexKey, {
    format: 'revealline-external-chapter-index.v1',
    chapters: [],
  });
  await assert.rejects(h.host.commitMutation(review), /snapshot changed/);
  assert.throws(() => h.host.commitMutation(review), /single-use/);
  assert.throws(() => h.host.commitMutation(structuredClone(review)), /single-use/);
  const fresh = await h.host.inspect(),
    next = await h.host.prepareMutation(fresh, fresh.packs);
  h.values.set(h.pointer.keys.lockKey, 'backup');
  await assert.rejects(h.host.commitMutation(next), /Recover pending/);
  assert.equal((await h.pointer.snapshot()).packs, null);
});

test('actual selected Blob corruption refuses readiness even with intact validated metadata', async (t) => {
  const h = await setup(t);
  await h.host.install(pilot.prepared);
  const db = await new Promise((resolve) => {
    const r = h.media.indexedDB.open('revealline-soundtrack-v1', 4);
    r.onsuccess = () => resolve(r.result);
  });
  const hash = pilot.descriptor.originals[0].sha256;
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
  const snapshot = await h.host.inspect();
  assert.equal(snapshot.status, 'checked');
  await assert.rejects(h.host.readiness(snapshot, pilot.descriptor.id), /SHA-256/);
});

test('lost writer/occupied backup lock/closed host refuse mutations without affecting borrowed manager', async (t) => {
  const h = await setup(t);
  const snapshot = await h.host.inspect();
  h.locks.held.add(h.pointer.keys.lockKey);
  await assert.rejects(h.host.prepareMutation(snapshot, snapshot.packs), /owns/);
  h.locks.held.delete(h.pointer.keys.lockKey);
  h.writer.release();
  await assert.rejects(h.host.prepareMutation(snapshot, snapshot.packs), /writer/);
  h.host.close();
  await assert.rejects(h.host.inspect(), /closed/);
  assert.equal((await h.manager.readDomain('story')).generation, 0);
});

test('abort during lazy manager return allocates no borrowed store or late snapshot', async (t) => {
  const h = await setup(t);
  await h.host.install(pilot.prepared);
  h.restart();
  let release;
  h.hook = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const controller = new AbortController();
  const pending = h.host.inspect({ signal: controller.signal });
  await waitFor(() => release);
  controller.abort();
  release();
  await assert.rejects(pending, { name: 'AbortError' });
  h.hook = null;
  assert.equal((await h.host.inspect()).status, 'checked');
});

test('mutating caller next pack during preparation cannot change reviewed native publication', async (t) => {
  const h = await setup(t),
    snapshot = await h.host.inspect();
  const next = structuredClone(installPack(snapshot.packs, await ordinary()));
  const promise = h.host.prepareMutation(snapshot, next);
  next.packs[0].description = 'caller changed after call';
  const review = await promise;
  const result = await h.host.commitMutation(review);
  assert.notEqual(result.packs.packs[0].description, next.packs[0].description);
});

test('manager timeout and close reject deferred acquisition without closing the borrowed owner', async (t) => {
  const h = await setup(t, { timeoutMs: 25 });
  await h.host.install(pilot.prepared);
  h.restart();
  let release;
  h.hook = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  await assert.rejects(h.host.inspect(), /manager acquisition timed out/);
  release();
  h.hook = null;
  assert.equal((await h.host.inspect()).status, 'checked');
  h.restart();
  release = null;
  h.hook = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const pending = h.host.inspect();
  await waitFor(() => release);
  h.host.close();
  release();
  await assert.rejects(pending, /cancelled|closed/);
  assert.equal((await h.manager.readDomain('story')).generation, 0);
});

test('failed native ordinary CAS is atomic and consumed review cannot be retried blindly', async (t) => {
  const h = await setup(t);
  await h.host.install(pilot.prepared);
  const snapshot = await h.host.inspect(),
    before = await h.pointer.snapshot();
  const review = await h.host.prepareMutation(
    snapshot,
    installPack(snapshot.packs, await ordinary()),
  );
  h.assets.failAnyPutAt = 1;
  await assert.rejects(h.host.commitMutation(review), /storage write failure/);
  h.assets.failAnyPutAt = null;
  assert.deepEqual(await h.pointer.snapshot(), before);
  assert.throws(() => h.host.commitMutation(review), /single-use/);
});

test('missing native Blob retains exact authored metadata but refuses both readiness and authored selection', async (t) => {
  const h = await setup(t);
  await h.host.install(pilot.prepared);
  const db = await new Promise((resolve) => {
    const r = h.media.indexedDB.open('revealline-soundtrack-v1', 4);
    r.onsuccess = () => resolve(r.result);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('mediaBlobs', 'readwrite');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
    tx.objectStore('mediaBlobs').delete(pilot.descriptor.originals[0].sha256);
  });
  db.close();
  const snapshot = await h.host.inspect();
  await assert.rejects(h.host.readiness(snapshot, pilot.descriptor.id), /original is missing/);
  await assert.rejects(h.host.authoredPicture(snapshot, request(snapshot)), /original is missing/);
  assert.equal((await h.pointer.snapshot()).journal, null);
});

test('quota refusal leaves a recoverable journal and no published gameplay or evicted originals', async (t) => {
  const h = await setup(t);
  h.quota = 1;
  await assert.rejects(h.host.install(pilot.prepared), /quota|storage|space/i);
  const state = await h.pointer.snapshot();
  assert.equal(state.packs, null);
  assert.equal(state.index, null);
  assert.ok(state.journal);
  assert.equal((await h.host.inspect()).reason, 'external-recovery');
  assert.equal((await h.still.read()).assets.length, 0);
  h.quota = Infinity;
  assert.equal((await h.host.recover(pilot.prepared)).status, 'installed');
});

test('trusted descriptor inputs are snapshotted and conflicting index cannot masquerade as that edition', async (t) => {
  const known = structuredClone(pilot.descriptor);
  const h = await setup(t, { knownDescriptors: [known] });
  known.media.sha256 = '0'.repeat(64);
  await h.host.install(pilot.prepared);
  const state = await h.pointer.snapshot(),
    changed = structuredClone(state.index);
  changed.chapters[0].media.sha256 = '0'.repeat(64);
  await h.put(h.pointer.keys.indexKey, changed);
  await assert.rejects(h.host.inspect(), /trusted external/);
  assert.equal((await h.pointer.snapshot()).index.chapters[0].media.sha256, '0'.repeat(64));
});

test('an unregistered prepared descriptor cannot opt itself into the host', async (t) => {
  const h = await setup(t, { knownDescriptors: [] });
  await assert.rejects(h.host.install(pilot.prepared), /explicitly registered/);
  assert.equal(h.borrows, 0);
  assert.equal(h.assets.allPuts.length, 0);
});

test('pack changes while actual selected-original decoding is deferred cannot publish stale readiness', async (t) => {
  let defer = false,
    release;
  const h = await setup(t, {
    decodeImage: async (value) => {
      if (defer) {
        defer = false;
        await new Promise((resolve) => {
          release = resolve;
        });
      }
      return decodeImage(value);
    },
  });
  await h.host.install(pilot.prepared);
  const snapshot = await h.host.inspect();
  defer = true;
  const pending = h.host.readiness(snapshot, pilot.descriptor.id);
  await waitFor(() => release);
  await h.put(
    h.pointer.keys.packsKey,
    exportPackLibrary(installPack(snapshot.packs, await ordinary())),
  );
  release();
  await assert.rejects(pending, /snapshot changed/);
});

test('registered owner inputs are owned before later mutation without opening media', async (t) => {
  const f = createStoryFixture();
  const entries = structuredClone(
    f.catalog.entries.filter((entry) => entry.difficulty === 'standard'),
  );
  const h = await setup(t, { registeredEntries: entries });
  const originalKey = entries[0].executionKey;
  entries[0].campaign.levels[0].revision = '999';
  entries[0].baseCampaign.levels[0].revision = '999';
  const snapshot = await h.host.inspect();
  assert.equal(snapshot.executionCatalog.entries[0].executionKey, originalKey);
  assert.notEqual(snapshot.executionCatalog.entries[0].campaign.levels[0].revision, '999');
  assert.equal(h.borrows, 0);
});

test('native absent index is uncharged; a persisted index contributes its exact bytes', async (t) => {
  const h = await setup(t);
  const raw = exportPackLibrary(installPack(emptyPackLibrary(), await ordinary()));
  await h.put(h.pointer.keys.packsKey, raw);
  const absent = await h.host.inspect();
  assert.equal(absent.usage.packBytes, Buffer.byteLength(raw));
  assert.equal(absent.usage.indexBytes, 0);
  const index = { format: 'revealline-external-chapter-index.v1', chapters: [] };
  await h.put(h.pointer.keys.indexKey, index);
  const present = await h.host.inspect();
  assert.equal(present.usage.packBytes, absent.usage.packBytes);
  assert.equal(present.usage.indexBytes, Buffer.byteLength(JSON.stringify(index)));
  assert.equal(h.borrows, 0);
});

test('explicit retained-picture review crosses temporary installer ownership and keeps authored defaults separate', async (t) => {
  const h = await setup(t),
    library = structuredClone(pilot.prepared.imported.document.library);
  library.presentations.push({
    ...library.presentations[0],
    revision: 2,
    description: 'Custom retained picture',
  });
  library.assignments[0].revision = 2;
  await h.still.commit(
    await h.still.prepare(library, pilot.prepared.imported.assets, {
      executionCatalog: pilot.prepared.executionCatalog,
    }),
    { expectedGeneration: 0 },
  );
  const before = await h.still.read();
  let pictureReview;
  try {
    await h.host.install(pilot.prepared);
  } catch (error) {
    pictureReview = error;
  }
  assert.equal(pictureReview.name, 'RetainedPictureAssignmentConflict');
  assert.deepEqual(await h.still.read(), before);
  assert.equal((await h.host.install(pilot.prepared, { pictureReview })).status, 'installed');
  assert.deepEqual((await h.still.read()).document, before.document);
  const snapshot = await h.host.inspect();
  const selected = await h.host.authoredPicture(snapshot, request(snapshot));
  assert.equal(selected.pin.presentationRevision, 1);
  assert.equal((await h.still.read()).document.library.assignments[0].revision, 2);
  assert.equal(h.values.size, 0);
});
