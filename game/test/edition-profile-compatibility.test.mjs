import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEditionContext } from '../edition-context.mjs';
import { recoveryChannel } from '../profile-channel.mjs';
import { claimProfileWriter, profileWriterOwns } from '../profile-writer.mjs';
import {
  createExternalChapterPointerStore,
  createExternalChapterInventoryReader,
} from '../external-chapter-pointer.mjs';
import { createExternalBackupAssets } from '../external-backup-assets.mjs';
import { createProfileChannelReader } from '../profile-channel-reader.mjs';
import { prepareProfileTransfer } from '../profile-transfer.mjs';
import { emptyLibrary, exportLibrary } from '../library.mjs';
import { profileAssetFixture } from './helpers/profile-channel-idb.mjs';
import { activateInstalledEdition } from '../installed-app.mjs';

class Locks {
  held = new Set();
  async request(key, options, task) {
    task ??= options;
    if (this.held.has(key)) return task(null);
    this.held.add(key);
    try {
      return await task({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}

test('external chapter and backup adapters accept exact matching edition channels', () => {
  const indexedDB = { open() {} },
    storage = { getItem: () => null };
  for (const version of ['DEV', '0.132.5']) {
    const context = resolveEditionContext({ editionId: 'coupa-adventure', version });
    const pointer = createExternalChapterPointerStore({ ...context, indexedDB });
    assert.equal(pointer.keys.writerKey, 'revealline.company.coupa-adventure.writer');
    const backup = createExternalBackupAssets({ ...context, indexedDB, storage });
    assert.equal(backup.keys.profileKey, context.profileKey);
    const inventory = createExternalChapterInventoryReader({
      ...context,
      indexedDB,
      storage,
      lockManager: new Locks(),
    });
    assert.equal(inventory.keys.packsKey, context.packsKey);
    pointer.close();
    backup.close();
    inventory.close();
    assert.throws(
      () =>
        createExternalChapterPointerStore({
          ...context,
          indexedDB,
          packsKey: context.packsKey.replace('coupa-adventure', 'droneaid-nl-community'),
        }),
      /match/,
    );
  }
  for (const id of ['edition-coupa..dev', 'edition-coupa.release-01.2.3', 'edition-Coupa.dev'])
    assert.throws(
      () =>
        createExternalChapterPointerStore({
          indexedDB,
          profileKey: `revealline.library.${id}.v1`,
          packsKey: `revealline.packs.${id}.v1`,
        }),
      /supported/,
    );
});

test('installation selection respects the stable edition writer across engine releases', async (t) => {
  const editionId = 'coupa-adventure',
    version = '0.132.5';
  const scope = `https://example.test/editions/${editionId}/releases/v${version}/site/`;
  const locks = new Locks(),
    heldWriter = await claimProfileWriter(locks, `revealline.company.${editionId}.writer`);
  t.after(() => heldWriter.release());
  const values = new Map(),
    options = {
      locks,
      storage: { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) },
      locationRef: { href: scope + 'game/index.html' },
      readAsset: async () => null,
    };
  await assert.rejects(
    activateInstalledEdition({ editionId, version, scope }, options),
    /Close the game window/,
  );
  assert.equal(values.size, 0);
  assert.equal(
    (await activateInstalledEdition({ editionId, version, scope }, { ...options, heldWriter }))
      .activated,
    true,
  );
  assert.equal(heldWriter.writable, true);
});

test('edition recovery and transfer borrow only their authentic shared writer lease', async (t) => {
  const editionId = 'coupa-adventure',
    currentVersion = '0.132.5';
  const source = recoveryChannel('edition-coupa-adventure.release-0.132.4', currentVersion, {
    editionId,
  });
  const next = recoveryChannel('edition-coupa-adventure.release-0.132.5', currentVersion, {
    editionId,
  });
  assert.equal(source.writerKey, next.writerKey);
  const values = new Map([[source.profileKey, exportLibrary(emptyLibrary())]]);
  const storage = {
    get length() {
      return values.size;
    },
    key: (i) => [...values.keys()][i] ?? null,
    getItem: (key) => values.get(key) ?? null,
  };
  const lockManager = new Locks(),
    heldWriter = await claimProfileWriter(lockManager, source.writerKey);
  t.after(() => heldWriter.release());
  assert.equal(profileWriterOwns(heldWriter, next.writerKey), true);
  assert.equal(profileWriterOwns({ writable: true }, next.writerKey), false);
  const fixture = await profileAssetFixture([], { absent: true });
  const options = { storage, indexedDB: fixture.indexedDB, lockManager, currentVersion, editionId };
  const reader = createProfileChannelReader({ ...options, heldWriter });
  t.after(() => reader.close());
  const channel = (await reader.discover()).channels[0];
  const review = await reader.review(channel);
  assert.equal(review.profile.status, 'valid-structure');
  const forged = createProfileChannelReader({ ...options, heldWriter: { writable: true } });
  t.after(() => forged.close());
  await assert.rejects(forged.review((await forged.discover()).channels[0]), /busy/);
  const transferred = await prepareProfileTransfer(source.id, {
    ...options,
    heldWriter,
    readAsset: async () => null,
    campaigns: [],
  });
  assert.equal(transferred.source.id, source.id);
  assert.equal(
    lockManager.held.has(source.writerKey),
    true,
    'borrowed lease remains held by the player',
  );
  assert.deepEqual(fixture.model.allPuts, []);
});
