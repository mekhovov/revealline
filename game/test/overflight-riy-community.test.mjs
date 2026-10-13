import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
} from '../overflight/riy-project.mjs';
import {
  createOverflightRiyPackage,
  createOverflightRiyLibrary,
  overflightRiyPackageIdentity,
} from '../overflight/riy-community.mjs';
import { inspectCommunityPackage } from '../community/package-family.mjs';
import { createCommunityNativeInstalled } from '../community/native-installed.mjs';
import { createCommunityLibrary } from '../community/library.mjs';
import { createMemoryCommunityDownloadStore } from '../community/download-store.mjs';
import { createMemoryCommunityStateStore } from '../community/state.mjs';
import { createCommunityPublisher } from '../community/publisher.mjs';
import { createCreatorStore } from '../creator/installed.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const pack = () =>
  createOverflightRiyPackage(createOverflightRiyProject({ encounterSet: 'mixed' }));
const blobOf = (value = pack(), indent = 2) =>
  new Blob([JSON.stringify(value, null, indent)], { type: 'application/json' });
async function installedFixture(t) {
  // The shared finite model owns one database. Keep the native profile and
  // Creator databases independent, as browsers do, without an optional Studio
  // dependency that is absent from the root Creator CI installation.
  const databases = new Map();
  const indexedDB = {
    open(name, version) {
      if (!databases.has(name)) databases.set(name, managedIndexedDB());
      return databases.get(name).indexedDB.open(name, version);
    },
  };
  const local = createOverflightRiyLibrary({ indexedDB });
  const nativeInstalled = createCommunityNativeInstalled({ indexedDB });
  t.after(() => {
    local.dispose();
    nativeInstalled.close();
  });
  return { indexedDB, local, nativeInstalled, databases };
}
const editionOf = async (blob) => {
  const hash = await creatorSHA256(await blob.arrayBuffer());
  return {
    editionId: `ed_${hash}`,
    collectionId: `co_${'a'.repeat(64)}`,
    slug: 'overflight-mixed',
    title: 'Overflight mixed',
    description: 'A native sortie',
    version: '1.0.0',
    packageSha256: hash,
    packageSize: blob.size,
    publishedAt: '2026-10-05T12:00:00.000Z',
    family: 'overflight-riy',
  };
};

test('global family and publisher admission preserve Riy bytes and reject resource closure changes', async () => {
  const blob = blobOf(),
    result = await inspectCommunityPackage(blob);
  assert.equal(result.family, 'overflight-riy');
  assert.equal(result.text, await blob.text());
  assert.equal(result.editionId, await creatorSHA256(await blob.arrayBuffer()));
  assert.equal(result.runtimeIdentity, overflightRiyPackageIdentity(result.pack));
  assert.equal(result.missions, 1);
  const publisher = createCommunityPublisher({ client: {} });
  const selected = await publisher.select(blob);
  assert.equal(selected.family, 'overflight-riy');
  assert.equal(selected.suggestedTitle, result.pack.project.title.en);
  for (const mutate of [
    (value) => {
      value.dependencies.effects.revision++;
    },
    (value) => {
      value.project.resources.motion.revision++;
      value.dependencies.motion.revision++;
    },
    (value) => {
      value.project.encounters[0].families = ['unknown'];
    },
    (value) => {
      value.dependencies.remote = 'https://example.invalid/asset.js';
    },
    (value) => {
      value.script = 'run()';
    },
  ]) {
    const invalid = structuredClone(pack());
    mutate(invalid);
    await assert.rejects(() => inspectCommunityPackage(blobOf(invalid)));
  }
  await assert.rejects(async () =>
    inspectCommunityPackage(new Blob(['\ufeff', await blob.text()])),
  );
});

test('global install, exact recovery, offload and reinstall use the native Riy library', async (t) => {
  const { indexedDB, local, nativeInstalled } = await installedFixture(t);
  const blob = blobOf(),
    edition = await editionOf(blob);
  const creatorStore = createCreatorStore({ indexedDB });
  const downloadStore = createMemoryCommunityDownloadStore();
  const library = createCommunityLibrary({
    nativeInstalled,
    creatorStore,
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
  assert.equal(status.family, 'overflight-riy');
  assert.equal(status.installed, true);
  assert.equal(status.attemptKey, null);
  assert.equal(status.profileKey, null);
  assert.equal(
    status.playHref,
    `../overflight/play.html?operation=riy&community=${status.runtimeIdentity}`,
  );
  const installed = (await local.list())[0];
  assert.equal(installed.localOwned, false);
  assert.equal(installed.communityOwned, true);
  assert.deepEqual(
    compileOverflightRiyProject(installed.project),
    compileOverflightRiyProject(pack().project),
  );
  assert.equal((await library.catalog()).editions[0].installed, true);
  await local.remove(installed.identity);
  assert.equal(
    (await library.status(edition.editionId)).installed,
    true,
    'local removal cannot detach Community ownership',
  );
  const removal = await library.reviewDownloadRemoval(edition);
  await library.removeDownload(edition, removal);
  await library.retainFromInstalled(edition);
  assert.equal(await (await downloadStore.get(edition.editionId)).text(), await blob.text());
  await library.offloadInstalled(edition, await library.reviewInstalledOffload(edition));
  assert.equal((await library.status(edition.editionId)).offloaded, true);
  assert.equal((await local.list()).length, 0);
  await library.install(edition);
  assert.equal((await library.status(edition.editionId)).runtimeIdentity, status.runtimeIdentity);
  assert.equal((await local.list()).length, 1);
});
