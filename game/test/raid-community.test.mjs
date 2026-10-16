import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import {
  createOverflightHuntPackage,
  createOverflightHuntLibrary,
  overflightHuntPackageIdentity,
} from '../overflight/raid-community.mjs';
import { createOverflightLibrary, createOverflightPackage } from '../overflight/community.mjs';
import { createOverflightProject } from '../overflight/project.mjs';
import { inspectCommunityPackage } from '../community/package-family.mjs';
import { createCommunityNativeInstalled } from '../community/native-installed.mjs';
import { createCommunityLibrary } from '../community/library.mjs';
import { createMemoryCommunityDownloadStore } from '../community/download-store.mjs';
import { createMemoryCommunityStateStore } from '../community/state.mjs';
import { createCreatorStore } from '../creator/installed.mjs';
import { createCommunityPublisher } from '../community/publisher.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
const pack = () =>
  createOverflightHuntPackage(createOverflightHuntProject({ encounterSet: 'mixed' }));
const blobOf = (source = pack(), indent = 2) =>
  new Blob([JSON.stringify(source, null, indent)], { type: 'application/json' });
function stores(t) {
  const databases = new Map();
  const indexedDB = {
    open(name, version) {
      if (!databases.has(name)) databases.set(name, managedIndexedDB());
      return databases.get(name).indexedDB.open(name, version);
    },
  };
  const raid = createOverflightHuntLibrary({ indexedDB }),
    survivor = createOverflightLibrary({ indexedDB }),
    nativeInstalled = createCommunityNativeInstalled({ indexedDB });
  t.after(() => {
    raid.dispose();
    survivor.dispose();
    nativeInstalled.close();
  });
  return { indexedDB, raid, survivor, nativeInstalled };
}
test('Community admission and publisher identify Raid separately and preserve exact UTF-8 bytes', async () => {
  const blob = blobOf(),
    inspected = await inspectCommunityPackage(blob);
  assert.equal(inspected.family, 'overflight-hunt');
  assert.equal(inspected.runtimeIdentity, overflightHuntPackageIdentity(pack()));
  assert.equal(inspected.text, await blob.text());
  const selected = await createCommunityPublisher({ client: {} }).select(blob);
  assert.equal(selected.family, 'overflight-hunt');
  const altered = pack();
  altered.dependencies.motion.revision++;
  await assert.rejects(() => inspectCommunityPackage(blobOf(altered)), /closure/);
  await assert.rejects(async () =>
    inspectCommunityPackage(new Blob(['\ufeff', await blob.text()])),
  );
});
test('global install → launch → exact recovery → offload → reinstall retains Raid identity and independent Survivor data', async (t) => {
  const { indexedDB, raid, survivor, nativeInstalled } = stores(t);
  const survivorId = await survivor.install(createOverflightPackage(createOverflightProject()));
  const blob = blobOf(),
    hash = await creatorSHA256(await blob.arrayBuffer());
  const edition = {
    editionId: `ed_${hash}`,
    collectionId: `co_${'b'.repeat(64)}`,
    slug: 'overflight-raid-mixed',
    title: 'Raid mixed',
    description: 'A native finite hunt',
    version: '1.0.0',
    packageSha256: hash,
    packageSize: blob.size,
    publishedAt: '2026-10-05T12:00:00.000Z',
    family: 'overflight-hunt',
  };
  const downloadStore = createMemoryCommunityDownloadStore();
  const library = createCommunityLibrary({
    nativeInstalled,
    creatorStore: createCreatorStore({ indexedDB }),
    downloadStore,
    stateStore: createMemoryCommunityStateStore(),
    client: {
      catalog: async () => ({ editions: [edition], nextCursor: null }),
      download: async () => blob,
    },
  });
  t.after(() => library.close());
  await library.install(edition, { offline: false });
  const status = await library.status(edition.editionId);
  assert.equal(status.family, 'overflight-hunt');
  assert.equal(status.installed, true);
  assert.equal(status.playHref, `../overflight/raid.html?community=${status.runtimeIdentity}`);
  assert.deepEqual(
    compileOverflightHuntProject((await raid.load(status.runtimeIdentity)).project),
    compileOverflightHuntProject(pack().project),
  );
  await library.removeDownload(edition, await library.reviewDownloadRemoval(edition));
  await library.retainFromInstalled(edition);
  assert.equal(await (await downloadStore.get(edition.editionId)).text(), await blob.text());
  await library.offloadInstalled(edition, await library.reviewInstalledOffload(edition));
  assert.equal((await library.status(edition.editionId)).offloaded, true);
  assert.equal((await raid.list()).length, 0);
  assert.equal((await survivor.list())[0].identity, survivorId);
  await library.install(edition);
  assert.equal((await library.status(edition.editionId)).runtimeIdentity, status.runtimeIdentity);
});
test('Raid Studio ownership survives Community offload and stale reviews cannot remove a new owner', async (t) => {
  const { raid } = stores(t),
    first = await inspectCommunityPackage(blobOf()),
    second = await inspectCommunityPackage(blobOf(pack(), 0));
  await raid.installEdition(first);
  const stale = await raid.reviewEditionOffload(first.editionId);
  await raid.install(first.pack);
  await assert.rejects(() => raid.offloadEdition(stale), /changed/);
  await raid.installEdition(second);
  await raid.offloadEdition(await raid.reviewEditionOffload(first.editionId));
  assert.equal((await raid.list())[0].localOwned, true);
  assert.equal((await raid.list())[0].communityOwned, true);
  await raid.offloadEdition(await raid.reviewEditionOffload(second.editionId));
  assert.equal((await raid.list())[0].localOwned, true);
  assert.equal((await raid.list())[0].communityOwned, false);
  await raid.remove(first.runtimeIdentity);
  assert.equal((await raid.list()).length, 0);
});
