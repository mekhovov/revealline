import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../core/registry.mjs';
import { campaignKey } from '../library.mjs';
import { createExternalRecoveryCatalog } from '../external-recovery-catalog.mjs';
import { createExternalChapterBackup } from '../external-chapter-backup.mjs';
import { emptyExternalChapterIndex } from '../external-chapter.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'recovery-fixture',
  revision: '1',
  title: 'Recovery fixture',
  classRecipes: structuredClone(CLASSES),
  levels: [
    {
      version: 'xonix-level.v1',
      id: 'map',
      revision: '1',
      name: 'Stored map',
      width: 48,
      height: 36,
      spawn: { x: 24.5, y: 0.5 },
      walls: [],
      enemies: [],
      objectives: [],
      supplies: [],
      goal: { coverage: 0.3 },
    },
  ],
};
const descriptor = {
  format: 'revealline-external-chapter.v1',
  id: 'exact-edition',
  revision: 1,
  source: { id: 'separate-source', bytes: 10, sha256: 'a'.repeat(64) },
  pack: { bytes: 10, sha256: 'b'.repeat(64) },
  media: { bytes: 10, sha256: 'c'.repeat(64) },
  campaignKey: campaignKey(campaign),
  themeId: 'fpv',
  originals: [1, 2, 3].map((i) => ({
    assetId: `picture-${i}`,
    presentationId: `presentation-${i}`,
    levelId: `map-${i}`,
    levelRevision: '1',
    sha256: String(i).repeat(64),
    bytes: 12,
    mime: 'image/png',
    width: 1,
    height: 1,
  })),
};
test('trusted registration is the only source of built-in execution authority and owns immutable catalog results', async () => {
  const registry = createExternalRecoveryCatalog({
    registeredEntries: [{ campaign, themes: [{ id: 'fpv' }] }],
  });
  const content = await registry.catalog(null, null);
  assert(content.executions.select(campaignKey(campaign), 'standard'));
  assert(content.executions.select(campaignKey(campaign), 'gentle'));
  assert.equal(content.index.chapters.length, 0);
  assert(Object.isFrozen(content));
  assert(Object.isFrozen(content.entries));
  assert.throws(() => content.entries.push({ campaign }), TypeError);
  assert.throws(() => registry.closure({ ...content }, {}), /trusted registry/);
  const other = createExternalRecoveryCatalog();
  assert.throws(() => other.closure(content, {}), /trusted registry/);
  assert.equal((await other.catalog(null, null)).executions.entries.length, 0);
});
test('claimed installed descriptors cannot replace the finite trusted registry or a complete matching pack', async () => {
  const index = { ...emptyExternalChapterIndex(), chapters: [descriptor] };
  await assert.rejects(
    createExternalRecoveryCatalog().catalog(null, index),
    /trusted external edition/,
  );
  const known = createExternalRecoveryCatalog({ knownDescriptors: [descriptor] });
  await assert.rejects(known.catalog(null, index), /gameplay differs/);
  const different = structuredClone(index);
  different.chapters[0].pack.sha256 = 'd'.repeat(64);
  await assert.rejects(known.catalog(null, different), /trusted external edition/);
  assert.throws(
    () => createExternalRecoveryCatalog({ knownDescriptors: [descriptor, descriptor] }),
    /Duplicate/,
  );
});
test('cancelled pure catalog preparation refuses without storage or runtime fallback', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(createExternalRecoveryCatalog().catalog(null, null, controller.signal), {
    name: 'AbortError',
  });
});

test('existing backup companion delegates pure preparation and preserves closed/cancelled guards without opening stores', async () => {
  const forbid = () => assert.fail('Pure catalog preparation must not access storage.');
  const companion = createExternalChapterBackup({
    indexedDB: { open: forbid },
    storage: { getItem: forbid },
    profileKey: 'revealline.library.release-v0.40.0.v1',
    packsKey: 'revealline.packs.release-v0.40.0.v1',
    lockManager: { request: forbid },
    getManagedStore: forbid,
    knownDescriptors: [descriptor],
  });
  await companion.prepareExternalChapters(null, null);
  await assert.rejects(
    companion.prepareExternalChapters(null, {
      ...emptyExternalChapterIndex(),
      chapters: [descriptor],
    }),
    /gameplay differs/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    companion.prepareExternalChapters(null, null, { signal: controller.signal }),
    { name: 'AbortError' },
  );
  companion.close();
  await assert.rejects(companion.prepareExternalChapters(null, null), /closed/);
});
