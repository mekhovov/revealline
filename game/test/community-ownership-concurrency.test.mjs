// Authored ownership regressions. Automated suites remain explicitly waived and unrun.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import {
  createClassicSnakeCommunityLibrary,
  CLASSIC_PACKAGE_FORMAT,
} from '../snake/classic-community.mjs';
import { createCommunityClassicInstalled } from '../community/classic-installed.mjs';
import { inspectCommunityPackage } from '../community/package-family.mjs';
import { createCommunityLibrary } from '../community/library.mjs';
import { createCommunityStateStore, COMMUNITY_STATE_KEY } from '../community/state.mjs';
import { createMemoryCommunityDownloadStore } from '../community/download-store.mjs';
import { createCreatorStore } from '../creator/installed.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
const requireAuthoring = createRequire(
  new URL('../../authoring/fpv-worlds/package.json', import.meta.url),
);
const { IDBFactory } = requireAuthoring('fake-indexeddb');
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
async function content(name = 'Shared pursuit', pretty = false) {
  const level = CLASSIC_SNAKE_LEVELS[0];
  const pack = {
    format: CLASSIC_PACKAGE_FORMAT,
    title: { en: name, uk: 'Спільне переслідування' },
    entries: [{ title: level.title, description: level.description, level: level.level }],
  };
  const blob = new Blob([JSON.stringify(pack, null, pretty ? 2 : undefined)]);
  const inspected = await inspectCommunityPackage(blob);
  return {
    blob,
    inspected,
    edition: {
      editionId: `ed_${inspected.editionId}`,
      collectionId: null,
      slug: 'shared-pursuit',
      title: name,
      description: 'Native pursuit',
      version: '1.0.0',
      packageSha256: inspected.editionId,
      packageSize: blob.size,
      publishedAt: '2026-10-03T12:00:00.000Z',
      family: 'classic',
    },
  };
}
function setup(t, indexedDB, rows, installed) {
  const states = createCommunityStateStore({ indexedDB, storage: null });
  const creator = createCreatorStore({ indexedDB });
  const library = createCommunityLibrary({
    client: {
      catalog: async () => ({ editions: rows.map((row) => row.edition), nextCursor: null }),
      download: async (edition) =>
        rows.find((row) => row.edition.editionId === edition.editionId).blob,
    },
    creatorStore: creator,
    classicInstalled: installed,
    stateStore: states,
    downloadStore: createMemoryCommunityDownloadStore(),
    lockManager: null,
  });
  t.after(() => {
    library.close();
    creator.close();
  });
  return { library, states };
}
test('different edition installs merge their journals even when native completion is reversed', async (t) => {
  const indexedDB = new IDBFactory(),
    a = await content('First pursuit'),
    b = await content('Second pursuit');
  const entered = deferred(),
    release = deferred();
  const nativeA = createCommunityClassicInstalled({ indexedDB }),
    nativeB = createCommunityClassicInstalled({ indexedDB });
  const left = setup(t, indexedDB, [a, b], {
    ...nativeA,
    async install(row) {
      const result = await nativeA.install(row);
      entered.resolve();
      await release.promise;
      return result;
    },
  });
  const right = setup(t, indexedDB, [a, b], nativeB);
  const first = left.library.install(a.edition, { offline: false });
  await entered.promise;
  await right.library.install(b.edition, { offline: false });
  release.resolve();
  await first;
  assert.equal((await left.library.status(a.edition.editionId)).installed, true);
  assert.equal((await left.library.status(b.edition.editionId)).installed, true);
  assert.deepEqual(
    new Set((await right.states.read()).editions.map((row) => row.editionId)),
    new Set([a.edition.editionId, b.edition.editionId]),
  );
});
test('failed offload rollback cannot overwrite another tab installation', async (t) => {
  const indexedDB = new IDBFactory(),
    a = await content('Offload pursuit'),
    b = await content('Concurrent pursuit');
  const entered = deferred(),
    release = deferred();
  const native = createCommunityClassicInstalled({ indexedDB });
  const left = setup(t, indexedDB, [a, b], {
    ...native,
    async offload() {
      entered.resolve();
      await release.promise;
      throw new Error('Native storage changed');
    },
  });
  const right = setup(t, indexedDB, [a, b], createCommunityClassicInstalled({ indexedDB }));
  await left.library.install(a.edition, { offline: false });
  const review = await left.library.reviewInstalledOffload(a.edition);
  const pending = left.library.offloadInstalled(a.edition, review);
  const rejected = assert.rejects(pending, /Native storage changed/);
  await entered.promise;
  await right.library.install(b.edition, { offline: false });
  release.resolve();
  await rejected;
  assert.equal((await left.library.status(a.edition.editionId)).installed, true);
  assert.equal((await left.library.status(b.edition.editionId)).installed, true);
});
test('Classic generation rejects stale reviews and keeps another exact-byte owner', async (t) => {
  const indexedDB = new IDBFactory(),
    a = await content(),
    b = await content(undefined, true);
  const first = createCommunityClassicInstalled({ indexedDB }),
    second = createCommunityClassicInstalled({ indexedDB });
  t.after(() => {
    first.close();
    second.close();
  });
  assert.notEqual(a.inspected.editionId, b.inspected.editionId);
  assert.equal(a.inspected.runtimeIdentity, b.inspected.runtimeIdentity);
  await first.install(a.inspected);
  const stale = await first.reviewOffload(a.inspected.editionId);
  await second.install(b.inspected);
  await assert.rejects(first.offload(stale), /changed/);
  await first.offload(await first.reviewOffload(a.inspected.editionId));
  assert.equal((await first.storage(a.inspected.editionId)).offloaded, true);
  assert.equal((await second.storage(b.inspected.editionId)).installed, true);
  assert.equal(await (await second.export(b.inspected.editionId)).text(), await b.blob.text());
});
test('Studio and Community release only their own references to a Snake recipe', async (t) => {
  const indexedDB = new IDBFactory(),
    row = await content();
  const studio = createClassicSnakeCommunityLibrary({ indexedDB }),
    community = createCommunityClassicInstalled({ indexedDB });
  t.after(() => {
    studio.close();
    community.close();
  });
  await community.install(row.inspected);
  await studio.install(row.inspected.pack, { owner: 'studio' });
  const localReview = await community.reviewOffload(row.inspected.editionId);
  assert.equal(localReview.localCopyRetained, true);
  await community.offload(localReview);
  assert.equal((await community.storage(row.inspected.editionId)).localCopyRetained, true);
  assert.equal(
    (await studio.load(row.inspected.runtimeIdentity)).identity,
    row.inspected.runtimeIdentity,
  );
  await community.install(row.inspected);
  await studio.remove(row.inspected.runtimeIdentity);
  assert.equal((await community.storage(row.inspected.editionId)).installed, true);
  await community.offload(await community.reviewOffload(row.inspected.editionId));
  await assert.rejects(studio.load(row.inspected.runtimeIdentity), /not installed/);
});
async function seedRecord(t, indexedDB, key, value) {
  const backend = createProfileRecordBackend({
    key,
    indexedDB,
    empty: () => value,
    validate: (row) => row,
  });
  t.after(() => backend.close());
  await backend.update(() => value);
  return backend;
}
test('legacy Classic split records migrate without discarding ambiguous local owners or old progress', async (t) => {
  const indexedDB = new IDBFactory(),
    row = await content();
  const { runtimeIdentity, editionId, text, pack } = row.inspected;
  const oldLibrary = {
    format: 'revealline-classic-library.v1',
    packages: { [runtimeIdentity]: pack },
  };
  const oldReceipts = {
    format: 'community-classic-installed.v1',
    editions: {
      [editionId]: {
        runtimeIdentity,
        title: pack.title.en,
        count: 1,
        text,
      },
    },
  };
  const original = await seedRecord(t, indexedDB, oldLibrary.format, oldLibrary);
  const receipts = await seedRecord(t, indexedDB, oldReceipts.format, oldReceipts);
  const progressKey = `classic-snake-progress.proof.v2/community/${runtimeIdentity}`;
  const progress = await seedRecord(t, indexedDB, progressKey, { retained: 'proof bytes' });
  const native = createClassicSnakeCommunityLibrary({ indexedDB }),
    installed = createCommunityClassicInstalled({ indexedDB });
  t.after(() => {
    native.close();
    installed.close();
  });
  assert.equal((await installed.storage(editionId)).installed, true);
  assert.equal((await native.list())[0].localOwner, 'legacy');
  await installed.offload(await installed.reviewOffload(editionId));
  assert.equal((await native.load(runtimeIdentity)).identity, runtimeIdentity);
  assert.deepEqual(await original.read(), oldLibrary);
  assert.deepEqual(await receipts.read(), oldReceipts);
  assert.deepEqual(await progress.read(), { retained: 'proof bytes' });
  const reopened = createCommunityClassicInstalled({ indexedDB });
  t.after(() => reopened.close());
  assert.equal((await reopened.storage(editionId)).offloaded, true); // No repeated resurrection from old receipts.
});
test('journal migration keeps old localStorage bytes and rejects malformed recovery state', async (t) => {
  const indexedDB = new IDBFactory(),
    row = await content();
  const old = JSON.stringify({
    format: 'revealline-community-library.v1',
    editions: [
      {
        editionId: row.edition.editionId,
        collectionId: null,
        creatorEditionId: row.inspected.editionId,
        slug: row.edition.slug,
        version: row.edition.version,
        packageSha256: row.edition.packageSha256,
        installation: 'staged',
        installedAt: null,
        family: 'classic',
        runtimeIdentity: row.inspected.runtimeIdentity,
      },
    ],
  });
  const storage = {
    getItem: (key) => (key === COMMUNITY_STATE_KEY ? old : null),
    setItem: () => {
      throw new Error('Legacy bytes must remain untouched');
    },
  };
  const state = createCommunityStateStore({ indexedDB, storage });
  t.after(() => state.close());
  assert.deepEqual(await state.read(), JSON.parse(old));
  assert.equal(storage.getItem(COMMUNITY_STATE_KEY), old);
  const reopened = createCommunityStateStore({
    indexedDB,
    storage: { getItem: () => '{old bytes are no longer authoritative' },
  });
  t.after(() => reopened.close());
  assert.deepEqual(await reopened.read(), JSON.parse(old));
  const bad = createCommunityStateStore({
    indexedDB: new IDBFactory(),
    storage: { getItem: () => '{broken' },
  });
  t.after(() => bad.close());
  await assert.rejects(bad.read());
});

test('simultaneous offload and canonical-equivalent install never strand the new receipt', async (t) => {
  const indexedDB = new IDBFactory(),
    a = await content(),
    b = await content(undefined, true);
  const first = createCommunityClassicInstalled({ indexedDB }),
    second = createCommunityClassicInstalled({ indexedDB });
  t.after(() => {
    first.close();
    second.close();
  });
  await first.install(a.inspected);
  const review = await first.reviewOffload(a.inspected.editionId);
  const outcomes = await Promise.allSettled([first.offload(review), second.install(b.inspected)]);
  assert.equal(outcomes[1].status, 'fulfilled');
  if (outcomes[0].status === 'rejected') assert.match(outcomes[0].reason.message, /changed/);
  assert.equal((await second.storage(b.inspected.editionId)).installed, true);
  assert.equal(await (await second.export(b.inspected.editionId)).text(), await b.blob.text());
});
