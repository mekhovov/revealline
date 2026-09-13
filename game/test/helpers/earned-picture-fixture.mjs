import assert from 'node:assert/strict';
import { createRun, stepRun, getSummary, FIXED_DT } from '../../core/index.mjs';
import { emptyLibrary, recordLibraryCompletion } from '../../library.mjs';
import { createManagedMediaStore } from '../../managed-media-store.mjs';
import { createStillMediaStore } from '../../media-store.mjs';
import { prepareStillAsset } from '../../media-still.mjs';
import { createPresentationPins } from '../../presentation-pins.mjs';
import { mediaFixture, libraryRecord, pngBytes, provenance } from './media-fixtures.mjs';
import { memoryIndexedDB } from './soundtrack-fixtures.mjs';

export async function earnedPictureFixture(mode = 'standard') {
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
