import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCreatorBatchDraftBackend,
  prepareCreatorBatchDraft,
  reopenCreatorBatchDraft,
} from '../creator/batch-drafts.mjs';
import { createCreatorStore } from '../creator/installed.mjs';
import { CREATOR_TEMPLATES, generateCreatorProject } from '../creator/templates.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';

function file(name, bytes, { type = 'image/png', lastModified = 7 } = {}) {
  const blob = new Blob([bytes], { type });
  Object.defineProperties(blob, {
    name: { value: name, enumerable: true },
    lastModified: { value: lastModified, enumerable: true },
  });
  return blob;
}

const settings = {
  collectionName: 'Reloaded campaign',
  pacing: 'gentle-first',
  fit: 'cover',
  creatorCredit: 'Creator',
  pictureCredit: 'Photographer',
  license: 'Shared for play',
};

function review() {
  const duplicate = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  return {
    seed: 0x12345678,
    settings,
    items: [
      {
        id: 'picture-3',
        file: file('portrait.png', duplicate),
        title: 'Portrait opening',
        included: true,
        status: 'ready',
        result: { deliberately: 'not persisted' },
        error: '',
        generation: 2,
      },
      {
        id: 'picture-1',
        file: file('portrait.png', duplicate),
        title: 'Duplicate second',
        included: true,
        status: 'error',
        result: null,
        error: 'Unsupported picture header.',
        generation: 0,
      },
      {
        id: 'picture-2',
        file: file('excluded.png', new Uint8Array([1, 2, 3, 4])),
        title: 'Excluded failure',
        included: false,
        status: 'excluded',
        result: null,
        error: 'Cannot decode this picture.',
        generation: 1,
      },
    ],
  };
}

function generatedIdentity(state, item, index) {
  const seed = (state.seed + index + item.generation * 65537) >>> 0;
  const families = CREATOR_TEMPLATES.map(({ id }) => id);
  const templateId =
    state.settings.pacing === 'gentle-first' && index < Math.ceil(state.items.length / 3)
      ? families[0]
      : state.settings.pacing === 'steady'
        ? families[2]
        : state.settings.pacing === 'balanced'
          ? families[(seed + index) % families.length]
          : undefined;
  return generateCreatorProject({
    id: `creation-reload-${item.id}`,
    name: state.settings.collectionName,
    seed,
    ...(templateId ? { templateId } : {}),
  });
}

test('unfinished batch checkpoint preserves bytes, order, choices, pacing, errors and generation', async () => {
  const checkpoint = await prepareCreatorBatchDraft('creation-reload', review());
  assert.equal(checkpoint.assets.length, 2, 'duplicate source bytes are retained once by hash');
  assert.deepEqual(
    checkpoint.document.items.map((item) => item.id),
    ['picture-3', 'picture-1', 'picture-2'],
  );
  assert.deepEqual(checkpoint.document.settings, settings);
  assert.equal(checkpoint.document.seed, 0x12345678);
  assert.equal(checkpoint.document.items[0].generation, 2);
  assert.equal(checkpoint.document.items[1].error, 'Unsupported picture header.');

  const reopened = reopenCreatorBatchDraft(checkpoint);
  assert.equal(reopened.seed, 0x12345678);
  assert.deepEqual(reopened.resumeItemIds, ['picture-3']);
  assert.deepEqual(
    reopened.items.map(({ id, included, status, generation }) => ({
      id,
      included,
      status,
      generation,
    })),
    [
      { id: 'picture-3', included: true, status: 'queued', generation: 2 },
      { id: 'picture-1', included: true, status: 'error', generation: 0 },
      { id: 'picture-2', included: false, status: 'excluded', generation: 1 },
    ],
  );
  assert.deepEqual(
    new Uint8Array(await reopened.items[0].file.arrayBuffer()),
    new Uint8Array(await review().items[0].file.arrayBuffer()),
  );
  assert.equal(reopened.items[0].file.name, 'portrait.png');
  const before = review();
  assert.deepEqual(
    generatedIdentity(reopened, reopened.items[0], 0),
    generatedIdentity(before, before.items[0], 0),
    'restored seed, order and generation reproduce the same geometry and provenance',
  );
});

test('batch backend reopens exact bytes, rejects stale writers and replaces its retained head', async () => {
  const memory = memoryIndexedDB();
  const store = createCreatorStore({ indexedDB: memory.indexedDB });
  const backend = createCreatorBatchDraftBackend(store);
  const first = await prepareCreatorBatchDraft('creation-reload', review());
  await backend.save(first, null);

  const restored = await backend.read('creation-reload');
  assert.equal(restored.revision, 1);
  assert.deepEqual(restored.checkpoint.document, first.document);
  assert.equal(restored.checkpoint.assets.length, 2);
  await assert.rejects(backend.save(first, null), /newer creator batch draft/i);
  const corruptingBackend = createCreatorBatchDraftBackend({
    readDomainMetadata: (...args) => store.readDomainMetadata(...args),
    readSelectedBlob: async (sha256, options) =>
      sha256 === first.assets[0].sha256
        ? new Blob(['tampered source bytes'])
        : store.readSelectedBlob(sha256, options),
  });
  await assert.rejects(
    corruptingBackend.read('creation-reload'),
    /source failed its integrity check/i,
  );

  const changedReview = review();
  changedReview.items.reverse();
  changedReview.items[0].included = true;
  changedReview.items[0].status = 'queued';
  const second = await prepareCreatorBatchDraft('creation-reload', changedReview);
  await backend.save(second, 1);
  const latest = await backend.read('creation-reload');
  assert.equal(latest.revision, 2);
  assert.deepEqual(
    latest.checkpoint.document.items.map((item) => item.id),
    ['picture-2', 'picture-1', 'picture-3'],
  );
  const metadata = await store.readDomainMetadata('media');
  assert.equal(
    metadata.library.legacy.items.filter((item) =>
      item.id.startsWith('creator.batch-draft.creation-reload.'),
    ).length,
    1,
  );
  store.close();
});
