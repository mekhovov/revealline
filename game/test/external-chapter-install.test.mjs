import test from 'node:test';
import assert from 'node:assert/strict';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createExternalChapterPointerStore } from '../external-chapter-pointer.mjs';
import {
  createExternalChapterInstaller,
  isRetainedPictureReview,
  RETAINED_PICTURE_JOURNAL_FORMAT,
} from '../external-chapter-install.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { emptyPackLibrary, exportPackLibrary, installPack } from '../packs.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { stillAuthoringKeys } from '../ui/still-media-catalog.mjs';
import { buildExternalPilot } from '../../authoring/library/external-chapter-pilot/build.mjs';

const pilot = await buildExternalPilot();
// Original hashes and compiler PNG CRC/scanlines are real. Repeat store decodes
// model native dimensions from the same authenticated header, not a browser codec.
async function decodeImage(value) {
  const url =
    typeof value === 'string'
      ? value
      : `data:image/png;base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`;
  const h = inspectImageDataUrl(url);
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
async function setup(t) {
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
    hook = null;
  const manager = createManagedMediaStore({
    indexedDB: media.indexedDB,
    richStillMedia: true,
    estimate: async () => ({ quota, usage: 0 }),
  });
  const store = createStillMediaStore({ managedStore: manager, decodeImage });
  const wrapped = {
    ...pointer,
    async compareAndSwap(before, after, options) {
      await hook?.('before', before, after);
      const result = await pointer.compareAndSwap(before, after, options);
      await hook?.('after', before, after);
      return result;
    },
  };
  const options = {
    pointerStore: wrapped,
    managedStore: manager,
    writer,
    lockManager: locks,
    storage: { getItem: (k) => values.get(k) ?? null },
    registeredEntries: [],
    decodeImage,
  };
  let installer = createExternalChapterInstaller(options);
  await store.read();
  await pointer.snapshot();
  t.after(() => {
    installer.close();
    store.close();
    manager.close();
    pointer.close();
    writer.release();
  });
  return {
    pointer,
    writer,
    locks,
    assets,
    media,
    values,
    manager,
    store,
    get installer() {
      return installer;
    },
    restart() {
      installer.close();
      installer = createExternalChapterInstaller(options);
    },
    set hook(v) {
      hook = v;
    },
    set quota(v) {
      quota = v;
    },
  };
}
async function assertInstalled(h) {
  const pointer = await h.pointer.snapshot();
  assert.equal(pointer.journal, null);
  assert.deepEqual(pointer.index.chapters, [pilot.descriptor]);
  assert.equal(JSON.parse(pointer.packs).packs[0].id, pilot.descriptor.id);
  const media = await h.store.read();
  assert.equal(media.generation, 1);
  assert.equal(
    media.assets.reduce((n, a) => n + a.blob.size, 0),
    8024867,
  );
  assert.deepEqual(
    media.document.library.assignments,
    pilot.prepared.imported.document.library.assignments,
  );
  for (const asset of media.assets) {
    const original = pilot.prepared.imported.assets.find((x) => x.sha256 === asset.sha256);
    assert.deepEqual(await asset.blob.arrayBuffer(), await original.blob.arrayBuffer());
  }
}
test('real two-store install commits originals before one atomic pointer publication, with exact bytes and no profile/session writes', async (t) => {
  const h = await setup(t),
    events = [];
  h.hook = async (when, before, after) => {
    if (when === 'before')
      events.push([after.journal?.phase ?? 'complete', (await h.store.read()).generation]);
  };
  const result = await h.installer.install(pilot.prepared);
  assert.equal(result.status, 'installed');
  assert.deepEqual(events, [
    ['prepared', 0],
    ['media-committed', 1],
    ['published', 1],
    ['complete', 1],
  ]);
  await assertInstalled(h);
  assert.equal(h.values.size, 0);
  assert.equal(h.assets.allPuts.filter(([, k]) => k === h.pointer.keys.packsKey).length, 1);
  await assert.rejects(h.installer.install(pilot.prepared), /replacement|migration/);
});
for (const [when, phase] of [
  ['after', 'prepared'],
  ['before', 'media-committed'],
  ['before', 'published'],
  ['after', 'published'],
  ['before', null],
]) {
  test(`crash ${when} ${phase ?? 'final journal clear'} preserves recovery and completes without recommitting originals`, async (t) => {
    const h = await setup(t);
    let once = true;
    h.hook = (at, _before, after) => {
      if (once && at === when && (after.journal?.phase ?? null) === phase) {
        once = false;
        throw new Error('Simulated interrupted host');
      }
    };
    await assert.rejects(h.installer.install(pilot.prepared), /interrupted/);
    assert.ok((await h.pointer.snapshot()).journal);
    h.hook = null;
    h.restart();
    assert.equal((await h.installer.recover(pilot.prepared)).status, 'installed');
    await assertInstalled(h);
  });
}
test('failed pointer second put rolls back publication and journal phase together', async (t) => {
  const h = await setup(t);
  h.hook = (when, _before, next) => {
    if (when === 'before' && next.journal?.phase === 'published') h.assets.failAnyPutAt = 2;
  };
  await assert.rejects(h.installer.install(pilot.prepared), /storage write failure/);
  h.assets.failAnyPutAt = null;
  h.hook = null;
  const p = await h.pointer.snapshot();
  assert.equal(p.packs, null);
  assert.equal(p.journal.phase, 'media-committed');
  await h.installer.recover(pilot.prepared);
  await assertInstalled(h);
});
test('abort after originals commit and before pointer publication leaves old pointer and recoverable originals', async (t) => {
  const h = await setup(t),
    controller = new AbortController();
  h.hook = (when, _before, next) => {
    if (when === 'before' && next.journal?.phase === 'media-committed') controller.abort();
  };
  await assert.rejects(h.installer.install(pilot.prepared, { signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.equal((await h.pointer.snapshot()).packs, null);
  assert.equal((await h.store.read()).generation, 1);
  h.hook = null;
  await h.installer.recover(pilot.prepared);
  await assertInstalled(h);
});
test('reported quota refusal leaves media and pointer unchanged; same journal can resume after space is available', async (t) => {
  const h = await setup(t);
  h.quota = 0;
  await assert.rejects(h.installer.install(pilot.prepared), /storage space/);
  assert.equal((await h.pointer.snapshot()).packs, null);
  assert.equal((await h.store.read()).generation, 0);
  assert.equal(h.media.contents().get('reservations').size, 0);
  h.quota = Infinity;
  await h.installer.recover(pilot.prepared);
  await assertInstalled(h);
});
test('foreign pack pointer, foreign generation and post-publication media change never clear the journal or roll back originals', async (t) => {
  for (const kind of ['pointer', 'generation', 'after-publication']) {
    const h = await setup(t);
    let once = true;
    h.hook = async (when, _before, next) => {
      const boundary = kind === 'after-publication' ? 'published' : 'media-committed';
      if (!once || when !== 'after' || next.journal?.phase !== boundary) return;
      once = false;
      if (kind === 'pointer') {
        const snapshot = await h.pointer.snapshot();
        await h.pointer.compareAndSwap(snapshot, {
          ...snapshot,
          packs: exportPackLibrary(emptyPackLibrary()),
        });
      } else {
        const current = await h.store.read();
        const prepared = await h.store.prepare(current.document.library, current.assets, {
          previous: current.document,
          executionCatalog: createExecutionCatalog([]),
        });
        await h.store.commit(prepared, { expectedGeneration: current.generation });
      }
      throw new Error('Foreign writer boundary');
    };
    await assert.rejects(h.installer.install(pilot.prepared), /Foreign/);
    const before = await h.pointer.snapshot(),
      media = await h.store.read();
    h.hook = null;
    await assert.rejects(h.installer.recover(pilot.prepared), /foreign|changed/);
    assert.deepEqual(await h.pointer.snapshot(), before);
    assert.deepEqual(await h.store.read(), media);
  }
});
test('pre-existing historical binding cannot be silently replaced even when its pack is absent', async (t) => {
  const h = await setup(t),
    library = structuredClone(pilot.prepared.imported.document.library);
  const p = { ...library.presentations[0], revision: 2, description: 'Already retained picture B' };
  library.presentations.push(p);
  library.assignments[0].revision = 2;
  const prepared = await h.store.prepare(library, pilot.prepared.imported.assets, {
    executionCatalog: pilot.prepared.executionCatalog,
  });
  await h.store.commit(prepared, { expectedGeneration: 0 });
  const before = await h.store.read();
  await assert.rejects(h.installer.install(pilot.prepared), /binding conflicts/);
  assert.deepEqual(await h.store.read(), before);
  assert.deepEqual(await h.pointer.snapshot(), { packs: null, journal: null, index: null });
});
test('writer, lock, backup marker, cancellation and forged prepared capability refuse before any journal write', async (t) => {
  const h = await setup(t);
  await assert.rejects(h.installer.install({ ...pilot.prepared }), /Prepare exact/);
  const c = new AbortController();
  c.abort();
  await assert.rejects(h.installer.install(pilot.prepared, { signal: c.signal }), {
    name: 'AbortError',
  });
  h.values.set(h.pointer.keys.lockKey, 'foreign');
  await assert.rejects(h.installer.install(pilot.prepared), /backup lock/);
  h.values.clear();
  h.locks.held.add(h.pointer.keys.lockKey);
  await assert.rejects(h.installer.install(pilot.prepared), /owns the profile lock/);
  h.locks.held.delete(h.pointer.keys.lockKey);
  h.writer.release();
  await assert.rejects(h.installer.install(pilot.prepared), /writer lease/);
  assert.equal(h.assets.allPuts.length, 0);
  assert.equal((await h.store.read()).generation, 0);
});

test('side-by-side pilot retains the exact embedded edition and actual old suspended attempt; it does not perform migration', async (t) => {
  const { createRun, stepRun, FIXED_DT } = await import('../core/index.mjs');
  const { createRecorder, recordInput } = await import('../replay.mjs');
  const { suspendSession, restoreSession } = await import('../sessions.mjs');
  const { resolvePackCampaign } = await import('../packs.mjs');
  const { campaignKey } = await import('../library.mjs');
  const h = await setup(t),
    resolved = resolvePackCampaign(pilot.prior, pilot.prior.campaigns[0].id),
    key = campaignKey(resolved.campaign);
  const level = resolved.campaign.levels[0],
    setupRun = {
      classId: 'scout',
      classRecipes: pilot.prior.classRecipes,
      turnPolicy: 'grid-center',
      seed: 1,
    },
    run = createRun(level, setupRun),
    recorder = createRecorder(level, setupRun);
  for (let i = 0; i < 80; i++) {
    const input = { direction: 'down' };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
  }
  const oldSave = JSON.stringify(
    suspendSession({
      run,
      recorder,
      campaignKey: key,
      themeId: pilot.prior.themes[0].id,
      bodyId: pilot.prior.themes[0].player,
      runId: 'old-embedded-flight',
      savedAt: '2026-09-13T00:00:00.000Z',
      continuation: { direction: 'down' },
    }),
  );
  h.values.set('revealline.suspended.dev.v1', oldSave);
  const prior = exportPackLibrary(installPack(emptyPackLibrary(), pilot.prior));
  await h.pointer.compareAndSwap(await h.pointer.snapshot(), {
    packs: prior,
    journal: null,
    index: null,
  });
  await h.installer.install(pilot.prepared);
  const after = await h.pointer.snapshot();
  assert.equal(JSON.parse(after.packs).packs.length, 2);
  assert.deepEqual(JSON.parse(after.packs).packs[0], JSON.parse(prior).packs[0]);
  assert.equal(h.values.get('revealline.suspended.dev.v1'), oldSave);
  const restored = await restoreSession(JSON.parse(oldSave), {
    campaign: resolved.campaign,
    campaignKey: key,
  });
  assert.equal(restored.run.tick, 80);
  assert.equal(restored.session.presentationPins, undefined);
  assert.equal(
    JSON.parse(after.packs).packs[0].levelVisuals[0].visualOverrides.background.dataUrl,
    pilot.prior.levelVisuals[0].visualOverrides.background.dataUrl,
  );
});

test('corrupt committed original blocks recovery without changing pointer, index, metadata or deleting history', async (t) => {
  const h = await setup(t);
  h.hook = (when, _before, next) => {
    if (when === 'before' && next.journal?.phase === 'media-committed')
      throw new Error('Interrupted after media');
  };
  await assert.rejects(h.installer.install(pilot.prepared), /Interrupted/);
  h.hook = null;
  const before = await h.pointer.snapshot(),
    hash = pilot.descriptor.originals[0].sha256;
  const req = h.media.indexedDB.open('revealline-soundtrack-v1', 3);
  const db = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('mediaBlobs', 'readwrite');
    tx.objectStore('mediaBlobs').put(new Blob(['corrupt']), hash);
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  const raw = h.media.contents();
  await assert.rejects(h.installer.recover(pilot.prepared), /byte|hash|original|length|ledger/i);
  assert.deepEqual(await h.pointer.snapshot(), before);
  assert.deepEqual(h.media.contents(), raw);
});

test('native pointer guard rejects old backup journal, mismatched channel, cancelled write and foreign index CAS', async (t) => {
  const h = await setup(t);
  assert.throws(
    () =>
      createExternalChapterPointerStore({
        indexedDB: h.assets.indexedDB,
        profileKey: 'revealline.library.dev.v1',
        packsKey: 'revealline.packs.release-0.34.0.v1',
      }),
    /channel/,
  );
  const initial = await h.pointer.snapshot(),
    c = new AbortController();
  c.abort();
  await assert.rejects(
    h.pointer.compareAndSwap(
      initial,
      { ...initial, journal: { draft: true } },
      { signal: c.signal },
    ),
    { name: 'AbortError' },
  );
  const next = {
    ...initial,
    index: { format: 'revealline-external-chapter-index.v1', chapters: [] },
  };
  await h.pointer.compareAndSwap(initial, next);
  await assert.rejects(
    h.pointer.compareAndSwap(initial, { ...initial, journal: { foreign: true } }),
    /changed/,
  );
  const req = h.assets.indexedDB.open('revealline-assets-v1', 1);
  const db = await new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readwrite');
    tx.objectStore('assets').put({ unfinished: true }, h.pointer.keys.backupJournalKey);
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  await assert.rejects(h.installer.install(pilot.prepared), /backup journal/);
});

test('pointer channels preserve the existing bounded release-v spelling and refuse mismatched variants', async (t) => {
  const assets = managedIndexedDB();
  for (const channel of ['dev', 'release-0.34.0', 'release-v0.34.0', 'release-v99999.0.1']) {
    const keys = stillAuthoringKeys(channel);
    const profileKey = keys.writer.slice(0, -'.writer'.length);
    const pointer = createExternalChapterPointerStore({
      indexedDB: assets.indexedDB,
      profileKey,
      packsKey: keys.packs,
    });
    t.after(() => pointer.close());
    assert.equal(pointer.keys.profileKey, profileKey);
    assert.equal(pointer.keys.packsKey, keys.packs);
    assert.equal(pointer.keys.lockKey, keys.lock);
    const before = await pointer.snapshot();
    assert.deepEqual(before, { packs: null, journal: null, index: null });
    const after = {
      ...before,
      index: { format: 'revealline-external-chapter-index.v1', chapters: [] },
    };
    await pointer.compareAndSwap(before, after);
    assert.deepEqual(await pointer.snapshot(), after);
  }
  for (const channel of [
    'release-00.34.0',
    'release-v000.34.0',
    'release-100000.0.0',
    'release-v0.34.0/other',
  ]) {
    assert.throws(() => stillAuthoringKeys(channel), /channel/);
    assert.throws(
      () =>
        createExternalChapterPointerStore({
          indexedDB: assets.indexedDB,
          profileKey: `revealline.library.${channel}.v1`,
          packsKey: `revealline.packs.${channel}.v1`,
        }),
      /channel/,
    );
  }
  for (const [profile, packs] of [
    ['release-v0.34.0', 'release-0.34.0'],
    ['release-0.34.0', 'release-v0.34.0'],
  ]) {
    assert.throws(
      () =>
        createExternalChapterPointerStore({
          indexedDB: assets.indexedDB,
          profileKey: `revealline.library.${profile}.v1`,
          packsKey: `revealline.packs.${packs}.v1`,
        }),
      /channel/,
    );
  }
});

async function retainDifferentPicture(h, revision = 2) {
  const current = await h.store.read();
  const library = current.generation
    ? structuredClone(current.document.library)
    : structuredClone(pilot.prepared.imported.document.library);
  library.presentations.push({
    ...library.presentations[0],
    revision,
    description: `Retained ${revision}`,
  });
  library.assignments[0].revision = revision;
  await h.store.commit(
    await h.store.prepare(library, pilot.prepared.imported.assets, {
      ...(current.generation ? { previous: current.document } : {}),
      executionCatalog: pilot.prepared.executionCatalog,
    }),
    { expectedGeneration: current.generation },
  );
}
async function pictureConflict(h) {
  let refusal;
  try {
    await h.installer.install(pilot.prepared);
  } catch (error) {
    refusal = error;
  }
  assert.equal(isRetainedPictureReview(refusal), true);
  assert.equal(refusal.conflicts.length, 1);
  assert.equal(refusal.conflicts[0].levelName, 'Orchard Crossing');
  assert.equal(refusal.conflicts[0].original.revision, 1);
  assert.equal(refusal.conflicts[0].retained.revision, 2);
  return refusal;
}
test('explicit fresh picture review installs exact originals without replacing retained assignments', async (t) => {
  const h = await setup(t);
  await retainDifferentPicture(h);
  const before = await h.store.read(),
    review = await pictureConflict(h);
  assert.deepEqual(await h.store.read(), before);
  assert.deepEqual(await h.pointer.snapshot(), { packs: null, journal: null, index: null });
  assert.equal(
    (await h.installer.install(pilot.prepared, { pictureReview: review })).status,
    'installed',
  );
  assert.equal(isRetainedPictureReview(review), false);
  const after = await h.store.read();
  assert.equal(after.generation, before.generation + 1);
  assert.deepEqual(after.document, before.document);
  assert.deepEqual(await h.pointer.snapshot().then((x) => x.index.chapters), [pilot.descriptor]);
  for (const asset of after.assets) {
    const original = pilot.prepared.imported.assets.find((x) => x.sha256 === asset.sha256);
    assert.deepEqual(await asset.blob.arrayBuffer(), await original.blob.arrayBuffer());
  }
});
test('picture confirmation refuses forged, foreign and changed-generation reviews without writes', async (t) => {
  const h = await setup(t),
    other = await setup(t);
  await retainDifferentPicture(h);
  await retainDifferentPicture(other);
  const review = await pictureConflict(h),
    foreign = await pictureConflict(other);
  const before = await h.store.read();
  for (const pictureReview of [{ ...review }, foreign])
    await assert.rejects(h.installer.install(pilot.prepared, { pictureReview }), /review expired/);
  assert.deepEqual(await h.store.read(), before);
  await retainDifferentPicture(h, 3);
  const newer = await h.store.read();
  await assert.rejects(
    h.installer.install(pilot.prepared, { pictureReview: review }),
    /review expired/,
  );
  assert.deepEqual(await h.store.read(), newer);
  assert.deepEqual(await h.pointer.snapshot(), { packs: null, journal: null, index: null });
});
for (const phase of ['prepared', 'media-committed', 'published', null]) {
  test(`confirmed retained-picture install recovers crash after ${phase ?? 'journal clear'} without replacing assignments`, async (t) => {
    const h = await setup(t);
    await retainDifferentPicture(h);
    const review = await pictureConflict(h),
      before = await h.store.read();
    let once = true;
    h.hook = (when, _before, next) => {
      if (when === 'after' && (next.journal?.phase ?? null) === phase && once) {
        once = false;
        if (next.journal) assert.equal(next.journal.format, RETAINED_PICTURE_JOURNAL_FORMAT);
        throw new Error('Retained-picture crash');
      }
    };
    await assert.rejects(
      h.installer.install(pilot.prepared, { pictureReview: review }),
      /Retained-picture crash/,
    );
    h.hook = null;
    h.restart();
    if (phase !== null)
      assert.equal((await h.installer.recover(pilot.prepared)).status, 'installed');
    else assert.equal((await h.pointer.snapshot()).journal, null);
    const after = await h.store.read();
    assert.equal(after.generation, before.generation + 1);
    assert.deepEqual(after.document, before.document);
    assert.deepEqual((await h.pointer.snapshot()).index.chapters, [pilot.descriptor]);
  });
}

for (const corrupt of ['unsupported-policy', 'legacy-with-extra-policy']) {
  test(`retained-picture journal rejects ${corrupt} without committing media`, async (t) => {
    const h = await setup(t);
    await retainDifferentPicture(h);
    const review = await pictureConflict(h),
      before = await h.store.read();
    h.hook = (when, _before, next) => {
      if (when === 'before' && next.journal?.phase === 'prepared') {
        if (corrupt === 'unsupported-policy') next.journal.assignmentPolicy = 'replace';
        else next.journal.format = 'revealline-external-chapter-install.v1';
      }
    };
    await assert.rejects(
      h.installer.install(pilot.prepared, { pictureReview: review }),
      /journal|Unsupported|unknown/i,
    );
    assert.deepEqual(await h.store.read(), before);
    assert.equal((await h.pointer.snapshot()).packs, null);
    h.hook = null;
    await assert.rejects(h.installer.recover(pilot.prepared), /journal|Unsupported|unknown/i);
    assert.deepEqual(await h.store.read(), before);
  });
}
