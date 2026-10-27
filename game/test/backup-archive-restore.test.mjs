import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackupArchiveRestore } from '../backup-archive-restore.mjs';
import { prepareBackupArchive } from '../backup-archive.mjs';
import { inspectBackupArchive } from '../backup-archive-inspection.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createStoryMediaStore } from '../story-media-store.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { createJourneyBackend, createJourneyProfileStore } from '../journey/profile.mjs';
import { backupSetFixture } from './helpers/backup-set-fixture.mjs';
import { memoryIndexedDB, structuralProbe } from './helpers/soundtrack-fixtures.mjs';
import { inspectionEnvironment } from './helpers/victory-story-fixture.mjs';

// Real archive validation and storage owners; finite IndexedDB/decoder boundary.
// No native codec, browser persistence or physical-device qualification claim.
async function setup(t, options = {}) {
  const fixture = await backupSetFixture(),
    memory = memoryIndexedDB(),
    manager = createManagedMediaStore({
      indexedDB: memory.indexedDB,
      storyMedia: true,
      soundtrackCatalogue: true,
    }),
    mediaStore = createStillMediaStore({
      managedStore: manager,
      decodeImage: fixture.source.decodeImage,
    }),
    storyStore = createStoryMediaStore({
      managedStore: manager,
      decodeImage: fixture.source.decodeImage,
    }),
    audioStore = createSoundtrackStore({ managedStore: manager }),
    journey = createJourneyProfileStore({ backend: createJourneyBackend(memoryIndexedDB()) }),
    incoming = createJourneyProfileStore({ backend: createJourneyBackend(memoryIndexedDB()) });
  incoming.record({
    type: 'complete',
    mode: 'solo',
    missionId: 'restored',
    runId: 'archive-run',
    gameplayId: 'archive-game',
    difficulty: 'expert',
  });
  await incoming.flush();
  fixture.source.journey = {
    identity: () => incoming.stateRevision(),
    read: (o) => incoming.exportAsync(o),
  };
  const archive = await prepareBackupArchive(fixture.source),
    inspection = await inspectBackupArchive(archive.files[0].blob);
  let identity = 'destination';
  const restore = createBackupArchiveRestore({
    identity: () => identity,
    mediaStore,
    storyStore,
    audioStore,
    journey,
    decodeImage: fixture.source.decodeImage,
    probeMedia: structuralProbe,
    storyInspection: inspectionEnvironment().options,
    ...options,
  });
  t.after(async () => {
    await storyStore.close();
    manager.close();
  });
  return {
    fixture,
    memory,
    manager,
    mediaStore,
    storyStore,
    audioStore,
    journey,
    restore,
    file: (id) => inspection.files.find((f) => f.id === id),
    changeIdentity: () => {
      identity = 'other-destination';
    },
  };
}

test('archive components use actual staged owners in picture/story/music/Journey order without importing game data', async (t) => {
  const h = await setup(t);
  for (const id of ['media', 'story', 'audio', 'journey']) {
    const review = await h.restore.prepare(h.file(id));
    assert.equal(review.review.kind, id);
    assert.deepEqual(await review.commit(), { state: 'saved' });
    await review.dispose();
    await assert.rejects(review.commit(), /Review this component again/);
  }
  assert.equal((await h.mediaStore.read()).assets.length, h.fixture.still.assets.length);
  assert.equal((await h.storyStore.exportInventory()).assets.length, 1);
  assert.equal((await h.audioStore.read()).assets.length, 1);
  assert.equal(h.journey.snapshot().clears.solo.restored.runId, 'archive-run');
  const repeated = await h.restore.prepare(h.file('journey'));
  assert.equal(repeated.review.added, 0, 'Journey retry merges idempotently');
  await repeated.commit();
});

test('changed destination blocks a prepared component and never commits its originals', async (t) => {
  const h = await setup(t),
    review = await h.restore.prepare(h.file('media'));
  h.changeIdentity();
  await assert.rejects(review.commit(), /current game changed/);
  assert.equal((await h.mediaStore.read()).generation, 0);
});

test('another music writer invalidates the review without replacing it or rolling back pictures', async (t) => {
  const h = await setup(t);
  await (await h.restore.prepare(h.file('media'))).commit();
  const review = await h.restore.prepare(h.file('audio'));
  await h.audioStore.commit(h.fixture.audio.prepared, { expectedGeneration: 0 });
  await assert.rejects(review.commit(), /changed|generation|stale/i);
  assert.equal((await h.audioStore.read()).generation, 1);
  assert.equal((await h.mediaStore.read()).generation, 1);
});

test('cancelling a story review releases its staged reservation and commits no story', async (t) => {
  const h = await setup(t);
  await (await h.restore.prepare(h.file('media'))).commit();
  const review = await h.restore.prepare(h.file('story'));
  await review.dispose();
  await assert.rejects(review.commit(), /Review this story restore/);
  assert.equal((await h.storyStore.exportInventory()).generation, 0);
  const retry = await h.restore.prepare(h.file('story'));
  assert.deepEqual(await retry.commit(), { state: 'saved' });
});

test('post-commit music adoption failure remains saved with an actionable notice', async (t) => {
  const h = await setup(t, {
    afterAudio: () => {
      throw new Error('player unavailable');
    },
  });
  const review = await h.restore.prepare(h.file('audio'));
  assert.deepEqual(await review.commit(), { state: 'saved', notice: 'reloadMusic' });
  assert.equal((await h.audioStore.read()).generation, 1);
});

test('Journey destination changes require a new review and a flush failure is reported as partial', async (t) => {
  const h = await setup(t),
    review = await h.restore.prepare(h.file('journey'));
  h.journey.record({ type: 'skip', mode: 'solo', missionId: 'other' });
  await assert.rejects(review.commit(), /Journey progress changed/);
  await h.journey.flush();
  const restore = createBackupArchiveRestore({
    identity: () => 'current',
    journey: { ...h.journey, flush: async () => false },
  });
  const retry = await restore.prepare(h.file('journey'));
  assert.deepEqual(await retry.commit(), { state: 'partial', notice: 'sessionOnly' });
  assert.ok(h.journey.snapshot().clears.solo.restored);
});

test('aborted preparation and damaged component bytes cannot create a restore capability', async (t) => {
  const h = await setup(t),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(h.restore.prepare(h.file('media'), { signal: controller.signal }), {
    name: 'AbortError',
  });
  await assert.rejects(
    h.restore.prepare({ id: 'audio', blob: new Blob(['invalid']) }),
    /Truncated/,
  );
  assert.equal((await h.audioStore.read()).generation, 0);
});
