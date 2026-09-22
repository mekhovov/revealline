import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createJourneyBackend,
  createJourneyProfileStore,
  emptyJourneyProfile,
} from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { SoloElement } from './helpers/solo-dom.mjs';
import { attachJourneyBackup } from '../ui/journey-backup.mjs';

const profileKey = 'journey-whole-spatial-v1';
const events = (mode, suffix) => [
  { type: 'select', mode, missionId: `candidate/pack/campaign/cursor-${suffix}` },
  { type: 'skip', mode, missionId: `candidate/pack/campaign/skip-${suffix}` },
  {
    type: 'complete',
    mode,
    missionId: 'candidate/pack/campaign/same-level',
    runId: `run-${suffix}`,
    gameplayId: `gameplay-${suffix}`,
    difficulty: 'standard',
  },
];

test('review and historical profiles isolate cursors, clears and skips bidirectionally; Solo/Versus share review record', async () => {
  const disk = managedIndexedDB();
  const historical = createJourneyBackend(disk);
  const review = createJourneyBackend({ ...disk, profileKey });
  const original = await historical.commit(events('solo', 'old'));
  assert.deepEqual(await review.read(), emptyJourneyProfile());
  await review.commit(events('solo', 'new'));
  const secondMode = createJourneyBackend({ ...disk, profileKey });
  await secondMode.commit(events('versus', 'race'));
  const reviewed = await review.read();
  assert.match(reviewed.cursors.solo, /cursor-new$/);
  assert.match(reviewed.cursors.versus, /cursor-race$/);
  assert.equal(reviewed.clears.solo['candidate/pack/campaign/same-level'].runId, 'run-new');
  assert.deepEqual(await historical.read(), original);
  await historical.commit(events('versus', 'old-race'));
  assert.deepEqual(await secondMode.read(), reviewed);
  const nextRelease = createJourneyBackend({ ...disk, profileKey });
  assert.deepEqual(await nextRelease.read(), reviewed);
  assert.deepEqual(new Set(disk.allPuts.map(([, key]) => key)), new Set(['journey', profileKey]));
});

test('review storage failure preserves session progress and retry/export without writing legacy records', async () => {
  const disk = managedIndexedDB();
  const backend = createJourneyBackend({ ...disk, profileKey });
  const store = createJourneyProfileStore({ backend });
  await store.load();
  disk.failAnyPutAt = 1;
  store.recordMany(events('solo', 'session'));
  assert.equal(await store.flush(), false);
  assert.equal(store.status().durable, false);
  const backup = JSON.parse(store.export());
  assert.match(backup.profile.cursors.solo, /cursor-session$/);
  assert.deepEqual(await backend.read(), emptyJourneyProfile());
  disk.failAnyPutAt = null;
  assert.equal(await store.flush(), true);
  assert.deepEqual(await backend.read(), backup.profile);
  assert.deepEqual(await createJourneyBackend(disk).read(), emptyJourneyProfile());
});

test('profile keys reject malformed input before opening storage', () => {
  const disk = managedIndexedDB();
  for (const profileKey of [null, '', '../journey', {}, 'X', 'a'.repeat(81)])
    assert.throws(() => createJourneyBackend({ ...disk, profileKey }), /stable profile key/);
  assert.equal(disk.openCount, 0);
});

test('scoped backups round-trip only within their edition; legacy v1 exports remain unchanged', async () => {
  const disk = managedIndexedDB();
  const old = createJourneyProfileStore({ backend: createJourneyBackend(disk) });
  const review = createJourneyProfileStore({
    backend: createJourneyBackend({ ...disk, profileKey }),
  });
  await Promise.all([old.load(), review.load()]);
  old.recordMany(events('solo', 'old'));
  review.recordMany(events('versus', 'new'));
  await Promise.all([old.flush(), review.flush()]);
  const legacy = old.export(),
    scoped = review.export();
  assert.equal(JSON.parse(legacy).format, 'revealline-journey-backup.v1');
  assert.equal(JSON.parse(scoped).profileKey, profileKey);
  assert.equal(JSON.parse(scoped).format, 'revealline-journey-backup.v2');
  assert.notEqual(old.backupFilename, review.backupFilename);
  for (const [store, wrong] of [
    [old, scoped],
    [review, legacy],
    [review, { ...JSON.parse(scoped), profileKey: 'another-edition' }],
  ]) {
    const before = store.snapshot();
    assert.throws(() => store.inspectBackup(wrong));
    assert.throws(() => store.restore(wrong));
    assert.deepEqual(store.snapshot(), before);
    assert.equal(store.status().pending, 0);
  }
  const restored = createJourneyProfileStore({
    backend: createJourneyBackend({ ...managedIndexedDB(), profileKey }),
  });
  await restored.load();
  restored.restore(scoped);
  assert.equal(await restored.flush(), true);
  assert.deepEqual(restored.snapshot().clears, review.snapshot().clears);
  assert.throws(
    () => createJourneyProfileStore({ backend: createJourneyBackend(disk), profileKey }),
    /must agree/,
  );
});

test('backup UI rejects foreign edition before enabling Apply and exports a scoped filename', async () => {
  const profile = createJourneyProfileStore({
    backend: createJourneyBackend({ ...managedIndexedDB(), profileKey }),
  });
  const old = createJourneyProfileStore({ backend: createJourneyBackend(managedIndexedDB()) });
  await Promise.all([profile.load(), old.load()]);
  const document = new Document();
  document.createElement = (tag) => new SoloElement(document, tag);
  let exported;
  const ui = attachJourneyBackup({
    document,
    profile,
    exportFile: async (value, filename) => {
      exported = { value, filename };
      return { message: 'exported' };
    },
  });
  const $ = (id) => document.getElementById(id);
  ui.open();
  $('journey-backup-file').files = [{ size: 1000, text: async () => old.export() }];
  await $('journey-backup-file').onchange();
  assert.equal($('journey-backup-apply').disabled, true);
  assert.match($('journey-backup-status').textContent, /different Journey edition/);
  assert.deepEqual(profile.snapshot(), emptyJourneyProfile());
  $('journey-backup-file').files = [{ size: 1000, text: async () => profile.export() }];
  await $('journey-backup-file').onchange();
  assert.equal($('journey-backup-apply').disabled, false);
  await $('journey-backup-export').onclick();
  assert.equal(exported.filename, profile.backupFilename);
  assert.equal(exported.value.profileKey, profileKey);
});
