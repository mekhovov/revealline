import test from 'node:test';
import assert from 'node:assert/strict';
import { createExternalChapterHost } from '../external-chapter-host.mjs';
import { createExternalChapterBackup } from '../external-chapter-backup.mjs';
import { SOURCE_EXTERNAL_CHAPTER, SOURCE_EXTERNAL_EDITIONS } from '../external-chapter-source.mjs';
import { EXTERNAL_CATALOG, prepareExternalCatalog } from '../external-chapter-catalog.mjs';
import {
  EXTERNAL_CHAPTER_LIMITS,
  emptyExternalChapterIndex,
  validateExternalChapterIndex,
} from '../external-chapter.mjs';
import { PACK_LIMITS } from '../packs.mjs';

const descriptors = Array.from({ length: 37 }, (_, i) => ({
  ...structuredClone(SOURCE_EXTERNAL_CHAPTER),
  id: `capacity-fixture-${i}`,
  campaignKey: `capacity-campaign-${i}/1/exact-fixture`,
}));
function options(knownDescriptors) {
  const unexpected = () => {
    throw new Error('Metadata admission must not open storage or borrow media.');
  };
  return {
    knownDescriptors,
    registeredEntries: [],
    indexedDB: { open: unexpected },
    storage: { getItem: unexpected },
    lockManager: { request: unexpected },
    getManagedStore: unexpected,
    writer: { writable: true },
    profileKey: 'revealline.library.dev.v1',
    packsKey: 'revealline.packs.dev.v1',
  };
}
for (const [name, create] of [
  ['host', createExternalChapterHost],
  ['backup', createExternalChapterBackup],
]) {
  test(`${name} admits 36 trusted choices without storage, refuses 37 and duplicate/invalid descriptors`, () => {
    const owner = create(options(descriptors.slice(0, 36)));
    owner.close();
    assert.throws(() => create(options(descriptors)), /bounded/i);
    assert.throws(() => create(options([descriptors[0], descriptors[0]])), /Duplicate/);
    assert.throws(() =>
      create(options([{ ...descriptors[0], media: { bytes: 1, sha256: 'wrong' } }])),
    );
  });
}
test('catalog parsing capacity never admits remote owners; all current source tuples stay exact', () => {
  assert.equal(EXTERNAL_CHAPTER_LIMITS.catalogChoices, 36);
  assert.deepEqual(prepareExternalCatalog(EXTERNAL_CATALOG), EXTERNAL_CATALOG);
  assert.equal(EXTERNAL_CATALOG.chapters.length, 12);
  for (const [i, row] of EXTERNAL_CATALOG.chapters.entries()) {
    const descriptor = SOURCE_EXTERNAL_EDITIONS[i].descriptor;
    assert.equal(row.campaignKey, descriptor.campaignKey);
    for (const kind of ['pack', 'media']) {
      assert.equal(row[kind].sha256, descriptor[kind].sha256);
      assert.equal(row[kind].bytes, descriptor[kind].bytes);
    }
  }
  const expanded = {
    ...EXTERNAL_CATALOG,
    chapters: Array.from({ length: 36 }, (_, i) => ({
      ...EXTERNAL_CATALOG.chapters[i % 12],
      id: `remote-${i}`,
    })),
  };
  assert.throws(() => prepareExternalCatalog(expanded), /differs from this game edition/);
  assert.throws(() =>
    prepareExternalCatalog({ ...expanded, chapters: [...expanded.chapters, expanded.chapters[0]] }),
  );
  const borrowed = structuredClone(EXTERNAL_CATALOG);
  borrowed.chapters[0].media = borrowed.chapters[1].media;
  assert.throws(() => prepareExternalCatalog(borrowed), /differs/);
});
test('trusted choices do not enlarge the stored index or installed pack budgets', () => {
  const index = { ...emptyExternalChapterIndex(), chapters: descriptors.slice(0, 12) };
  assert.equal(validateExternalChapterIndex(index).chapters.length, 12);
  assert.throws(() =>
    validateExternalChapterIndex({ ...index, chapters: descriptors.slice(0, 13) }),
  );
  assert.equal(PACK_LIMITS.installed, 12);
  assert.equal(PACK_LIMITS.libraryBytes, 48 * 1048576);
  assert.equal(PACK_LIMITS.maxBytes, 24 * 1048576);
  assert.equal(EXTERNAL_CHAPTER_LIMITS.packBytes, 1048576);
});
