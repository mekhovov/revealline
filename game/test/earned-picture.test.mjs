import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, getSummary, FIXED_DT } from '../core/index.mjs';
import { emptyLibrary, recordLibraryCompletion } from '../library.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { createPresentationPins } from '../presentation-pins.mjs';
import { resolveEarnedPicture, acquireEarnedPicture } from '../ui/earned-picture.mjs';
import { mediaFixture, libraryRecord, pngBytes, provenance } from './helpers/media-fixtures.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';

async function fixture(mode = 'standard') {
  const f = mediaFixture(true),
    memory = memoryIndexedDB();
  const prepared = await prepareStillAsset(
    new Blob([pngBytes()]),
    { id: 'picture-a', provenance: provenance() },
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  const library = libraryRecord(f.identity);
  library.assets = [prepared.asset];
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, richStillMedia: true });
  const store = createStillMediaStore({
    managedStore: manager,
    decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  });
  await store.commit(
    await store.prepare(library, [{ sha256: prepared.asset.sha256, blob: prepared.blob }], {
      executionCatalog: f.catalog,
    }),
    { expectedGeneration: 0 },
  );
  const metadata = await store.readMetadata();
  const entry = f.catalog.entries.find((e) => e.difficulty === mode),
    level = entry.campaign.levels[0];
  const run = createRun(level, { classRecipes: entry.campaign.classRecipes });
  for (let tick = 0; tick < 1000 && run.status === 'running'; tick++)
    stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.status, 'won');
  const pins = createPresentationPins({
    library: metadata.document.library,
    identityCatalog: f.identityCatalog,
    ...f.request(mode),
    themeIds: ['fpv', 'retro'],
  });
  const profile = recordLibraryCompletion(emptyLibrary(), {
    campaign: entry.campaign,
    result: getSummary(run),
    runId: 'first-clear',
    bodyId: 'fpv-body',
    themeId: 'fpv',
    completedAt: '2026-09-13T08:00:00.000Z',
    mediaIdentityCatalog: f.identityCatalog,
    presentationPins: pins,
  });
  return {
    ...f,
    store,
    manager,
    metadata,
    profile,
    item: profile.gallery[0],
    receipt: profile.pictureReceipts[0],
    entries: f.catalog.entries,
  };
}

test('an actual earned original remains viewable with exact Gentle context after its pack is removed', async () => {
  const f = await fixture('gentle');
  const picture = resolveEarnedPicture({ ...f, entries: [] });
  assert.equal(picture.archived, true);
  assert.equal(picture.replayable, false);
  assert.equal(picture.celebratable, false);
  assert.equal(picture.difficulty, 'gentle');
  assert.equal(picture.level.revision, f.item.levelRevision);
  assert.equal(picture.receipt.presentationPin.assetId, 'picture-a');
  assert.equal(picture.entry.executionKey, f.item.campaignKey);
  const disposed = [];
  const result = await acquireEarnedPicture(
    { ...f, entries: [] },
    {
      URLImpl: { createObjectURL: () => 'blob:owned', revokeObjectURL: (u) => disposed.push(u) },
      decodeImage: async () => ({
        width: 1,
        height: 1,
        close() {
          disposed.push('image');
        },
      }),
    },
  );
  assert.equal(result.backdrop.pin.sha256, f.receipt.presentationPin.sha256);
  result.release();
  result.release();
  assert.equal(disposed.filter((x) => x === 'blob:owned').length, 1);
  assert.equal(f.profile.gallery.length, 1, 'viewing does not award or install');
  f.manager.close();
});

test('later assignment and better-score seed do not replace the first earned presentation', async () => {
  const f = await fixture();
  const edited = structuredClone(f.metadata.document.library);
  edited.presentations.push({ ...edited.presentations[0], revision: 2 });
  edited.assignments[0].revision = 2;
  const saved = await f.store.read();
  await f.store.commit(
    await f.store.prepare(edited, saved.assets, {
      executionCatalog: f.catalog,
      previous: saved.document,
    }),
    { expectedGeneration: saved.generation },
  );
  const metadata = await f.store.readMetadata();
  const picture = resolveEarnedPicture({ ...f, metadata, item: { ...f.item, seed: 999 } });
  assert.equal(metadata.document.library.assignments[0].revision, 2);
  assert.equal(picture.receipt.presentationPin.presentationRevision, 1);
  assert.equal(picture.item.seed, f.receipt.seed);
  assert.equal(picture.replayable, true);
  f.manager.close();
});

test('foreign map/world/owner receipts reject instead of selecting current artwork', async () => {
  const f = await fixture();
  for (const change of [
    (r) => (r.galleryKey = 'gallery-v1-0000000000000000'),
    (r) => (r.presentationPin.identity.baseCampaignKey = 'unrelated/campaign'),
    (r) => (r.presentationPin.identity.themeId = 'retro'),
  ]) {
    const receipt = structuredClone(f.receipt);
    change(receipt);
    assert.throws(() => resolveEarnedPicture({ ...f, receipt }));
  }
  f.manager.close();
});

test('legacy rows use installed authored art and remain unavailable without their exact pack', async () => {
  const f = await fixture();
  assert.equal(resolveEarnedPicture({ ...f, receipt: null }).entry, f.entries[0]);
  assert.equal(resolveEarnedPicture({ ...f, receipt: null, entries: [] }), null);
  const receipt = {
    ...f.receipt,
    presentationPin: { kind: 'legacy', identity: f.receipt.presentationPin.identity },
  };
  assert.deepEqual(resolveEarnedPicture({ ...f, receipt }).receipt, receipt);
  assert.equal(
    resolveEarnedPicture({ ...f, receipt, item: { ...f.item, seed: 999 } }).item.seed,
    receipt.seed,
  );
  const foreign = structuredClone(receipt);
  foreign.presentationPin.identity.baseCampaignKey = 'unrelated/campaign';
  assert.throws(() => resolveEarnedPicture({ ...f, receipt: foreign }), /owner/);
  assert.equal(resolveEarnedPicture({ ...f, receipt, entries: [] }), null);
  f.manager.close();
});
