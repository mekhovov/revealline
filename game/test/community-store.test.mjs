import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCommunityClient } from '../community/client.mjs';
import { createMemoryCommunityDownloadStore } from '../community/download-store.mjs';
import { createCommunityLibrary } from '../community/library.mjs';
import { createCommunityPublisher } from '../community/publisher.mjs';
import { createMemoryCommunityStateStore } from '../community/state.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import {
  approveCreatorBundle,
  exportCreatorBundle,
  prepareCreatorBundle,
} from '../creator/bundle.mjs';
import { createCreatorStore, installedCreatorManifests } from '../creator/installed.mjs';
import { generateCreatorProject } from '../creator/templates.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';

const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const hash = async (value) =>
  creatorSHA256(value instanceof Blob ? await value.arrayBuffer() : value);
async function packageFixture(name = 'Aurora crossing') {
  const generated = generateCreatorProject({
    id: 'community-picture',
    name,
    seed: 8,
  });
  const project = structuredClone(generated.project);
  project.name = name;
  const picture = new Blob([pngBytes()], { type: 'image/png' });
  const pictureHash = await hash(picture);
  project.assets = [
    {
      format: 'AssetRevisionV1',
      id: 'picture',
      revision: '1',
      kind: 'reveal-background',
      path: `content-design/assets/creator/${pictureHash}.png`,
      sha256: pictureHash,
      bytes: picture.size,
      width: 1,
      height: 1,
      alt: `${name} picture`,
      review: 'candidate',
    },
  ];
  project.missions[0].presentation.backgroundAssetId = 'picture';
  const prepared = await prepareCreatorBundle(
    {
      project,
      packId: 'collection',
      themes,
      provenance: generated.provenance,
      credits: {
        creator: 'Fixture creator',
        picture: 'Fixture picture',
        license: 'Test permission',
      },
    },
    [{ sha256: pictureHash, blob: picture }],
    { decodeImage },
  );
  const blob = exportCreatorBundle(prepared, approveCreatorBundle(prepared));
  return { prepared, blob };
}
async function edition(blob, overrides = {}) {
  const editionId = overrides.editionId ?? `ed_${'a'.repeat(64)}`;
  return {
    editionId,
    collectionId: `co_${'1'.repeat(64)}`,
    slug: 'aurora-crossing',
    title: 'Aurora crossing',
    description: 'A calm first flight.',
    version: '1.0.0',
    packageSha256: await hash(blob),
    packageSize: blob.size,
    publishedAt: '2026-09-24T10:00:00.000Z',
    latestEditionId: editionId,
    latestVersion: overrides.version ?? '1.0.0',
    previewAvailable: false,
    ...overrides,
  };
}
const fixture = async ({
  editions,
  downloads,
  stateStore = createMemoryCommunityStateStore(),
  lockManager,
}) => {
  const memory = memoryIndexedDB();
  const creatorStore = createCreatorStore({ indexedDB: memory.indexedDB });
  const downloadStore = createMemoryCommunityDownloadStore();
  const client = {
    catalog: async () => ({ editions, nextCursor: null }),
    download: async (item) => downloads.get(item.editionId),
  };
  return {
    creatorStore,
    downloadStore,
    stateStore,
    client,
    library: createCommunityLibrary({
      client,
      creatorStore,
      stateStore,
      downloadStore,
      decodeImage,
      lockManager,
    }),
  };
};

test('catalog outage is surfaced while the injected client remains account-free', async () => {
  const client = createCommunityClient({
    baseURL: 'https://community.example/',
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });
  await assert.rejects(client.catalog(), /offline/u);
});

test('catalog search, pagination, preview, reporting and unlisting use explicit service adapters', async () => {
  const calls = [];
  const publicEdition = {
    editionId: `ed_${'9'.repeat(64)}`,
    collectionId: `co_${'8'.repeat(64)}`,
    slug: 'night-flight',
    title: 'Night flight',
    description: 'A previewable campaign.',
    version: '2.0.0',
    packageSha256: '7'.repeat(64),
    packageSize: 12,
    publishedAt: '2026-09-25T10:00:00.000Z',
    latestEditionId: `ed_${'9'.repeat(64)}`,
    latestVersion: '2.0.0',
    previewAvailable: true,
  };
  const submissionId = '11111111-1111-4111-8111-111111111111';
  const client = createCommunityClient({
    baseURL: 'https://community.example/',
    authHeaders: async () => ({ authorization: 'Bearer creator-a' }),
    fetchImpl: async (url, init = {}) => {
      const requestURL = new URL(url);
      calls.push({ url: requestURL, init });
      if (requestURL.pathname === '/v1/catalog')
        return Response.json({
          editions: [publicEdition],
          nextCursor: 'next-page',
        });
      if (requestURL.pathname.endsWith('/preview'))
        return new Response(new Blob([pngBytes()], { type: 'image/png' }), {
          headers: { 'content-type': 'image/png' },
        });
      if (requestURL.pathname.endsWith('/reports'))
        return Response.json({ report: { status: 'received' } }, { status: 202 });
      if (requestURL.pathname.endsWith('/unlist'))
        return Response.json({
          submission: {
            id: submissionId,
            editionId: publicEdition.editionId,
            status: 'unlisted',
          },
        });
      throw new Error(`unexpected request ${requestURL.pathname}`);
    },
  });
  const page = await client.catalog({
    query: 'night',
    cursor: 'after-one',
    limit: 1,
  });
  assert.equal(page.nextCursor, 'next-page');
  assert.equal(calls[0].url.searchParams.get('q'), 'night');
  assert.equal(calls[0].url.searchParams.get('cursor'), 'after-one');
  assert.equal(calls[0].url.searchParams.get('limit'), '1');
  assert.equal((await client.preview(page.editions[0])).type, 'image/png');
  assert.equal(
    (await client.reportEdition(publicEdition.editionId, { reason: 'broken' })).report.status,
    'received',
  );
  assert.equal((await client.unlistEdition(publicEdition.editionId)).status, 'unlisted');
  assert.equal(calls.at(-1).init.headers.authorization, 'Bearer creator-a');
});

test('corrupt catalog download cannot create an installed index', async () => {
  const valid = await packageFixture();
  const item = await edition(valid.blob);
  const { library, creatorStore } = await fixture({
    editions: [item],
    downloads: new Map([[item.editionId, new Blob(['corrupt'])]]),
  });
  await assert.rejects(library.install(item, { offline: false }), /size differs/u);
  assert.deepEqual(await installedCreatorManifests(creatorStore), []);
  creatorStore.close();
});

test('immutable update installs beside the old edition and exposes offline play links', async () => {
  const first = await packageFixture('Aurora crossing');
  const second = await packageFixture('Aurora crossing revised');
  const oldEditionSource = await edition(first.blob);
  const newEdition = await edition(second.blob, {
    editionId: `ed_${'b'.repeat(64)}`,
    version: '1.1.0',
    packageSha256: await hash(second.blob),
    packageSize: second.blob.size,
    publishedAt: '2026-09-25T10:00:00.000Z',
  });
  const oldEdition = {
    ...oldEditionSource,
    latestEditionId: newEdition.editionId,
    latestVersion: newEdition.version,
  };
  const catalogEditions = [newEdition, oldEdition];
  const { library, creatorStore } = await fixture({
    editions: catalogEditions,
    downloads: new Map([
      [oldEdition.editionId, first.blob],
      [newEdition.editionId, second.blob],
    ]),
  });
  await library.install(oldEdition, { offline: false });
  let catalog = await library.catalog();
  assert.equal(
    catalog.editions.find((row) => row.editionId === oldEdition.editionId).updateAvailable,
    true,
  );
  catalogEditions.splice(0, catalogEditions.length, newEdition);
  catalog = await library.catalog();
  assert.equal(catalog.editions[0].installed, false);
  assert.equal(catalog.editions[0].updateAvailable, true);
  catalogEditions.splice(0, catalogEditions.length, newEdition, oldEdition);
  await library.install(newEdition, { offline: false });
  assert.equal((await installedCreatorManifests(creatorStore)).length, 2);
  catalog = await library.catalog({ installed: 'installed' });
  assert.equal(catalog.editions.length, 2);
  assert.ok(
    catalog.editions.every((row) => row.playHref.includes('../creator/player.html?edition=')),
  );
  assert.ok(catalog.editions.every((row) => row.installed));
  assert.ok(catalog.editions.every((row) => !row.updateAvailable));
  assert.equal(new Set(catalog.editions.map((row) => row.profileKey)).size, 2);
  assert.equal(new Set(catalog.editions.map((row) => row.attemptKey)).size, 2);
  creatorStore.close();
});

test('retained exact bytes reinstall offline into an empty runtime store', async () => {
  const source = await packageFixture('Offline crossing');
  const item = await edition(source.blob, {
    editionId: `ed_${'e'.repeat(64)}`,
  });
  const first = await fixture({
    editions: [item],
    downloads: new Map([[item.editionId, source.blob]]),
  });
  await first.library.install(item, { offline: false });
  first.creatorStore.close();

  const memory = memoryIndexedDB();
  const creatorStore = createCreatorStore({ indexedDB: memory.indexedDB });
  const offlineLibrary = createCommunityLibrary({
    client: {
      catalog: async () => ({ editions: [item], nextCursor: null }),
      download: async () => {
        throw new Error('network must not be used');
      },
    },
    creatorStore,
    stateStore: first.stateStore,
    downloadStore: first.downloadStore,
    decodeImage,
  });
  await offlineLibrary.install(item);
  const current = await offlineLibrary.status(item.editionId);
  assert.equal(current.offlinePlayable, true);
  assert.equal(current.exactRecoveryAvailable, true);
  assert.equal((await installedCreatorManifests(creatorStore)).length, 1);
  creatorStore.close();
});

test('removing a recovery download preserves manifest ownership and exact offline recovery', async () => {
  const source = await packageFixture();
  const item = await edition(source.blob);
  const { library, creatorStore, downloadStore } = await fixture({
    editions: [item],
    downloads: new Map([[item.editionId, source.blob]]),
  });
  const installed = await library.install(item, { offline: false });
  const beforeRemoval = await library.status(item.editionId);
  assert.equal(beforeRemoval.packageRetained, true);
  const review = await library.reviewDownloadRemoval(item);
  assert.equal(review.recoverySource, 'installed-runtime');
  await library.removeDownload(item, review);
  const afterRemoval = await library.status(item.editionId);
  assert.equal(afterRemoval.installed, true);
  assert.equal(afterRemoval.creatorEditionId, installed.creatorEditionId);
  assert.equal(afterRemoval.profileKey, beforeRemoval.profileKey);
  assert.equal(afterRemoval.attemptKey, beforeRemoval.attemptKey);
  assert.equal(afterRemoval.packageRetained, false);
  assert.equal(afterRemoval.exactRecoveryAvailable, true);
  assert.equal((await installedCreatorManifests(creatorStore)).length, 1);
  await library.retainFromInstalled(item);
  assert.equal((await library.status(item.editionId)).packageRetained, true);
  assert.equal(await hash(await downloadStore.get(item.editionId)), item.packageSha256);
  creatorStore.close();
});

test('download removal rejects a stale review and keeps the changed recovery bytes', async () => {
  const source = await packageFixture('Stale review crossing');
  const item = await edition(source.blob, {
    editionId: `ed_${'f'.repeat(64)}`,
  });
  const { library, creatorStore, downloadStore } = await fixture({
    editions: [item],
    downloads: new Map([[item.editionId, source.blob]]),
  });
  await library.install(item, { offline: false });
  const review = await library.reviewDownloadRemoval(item);
  await downloadStore.put(item.editionId, new Blob(['changed']));
  await assert.rejects(library.removeDownload(item, review), /changed/u);
  assert.equal((await downloadStore.get(item.editionId)).size, 7);
  assert.equal((await library.status(item.editionId)).installed, true);
  creatorStore.close();
});

test('exact-edition offload keeps its manifest and ownership keys, then reinstalls offline', async () => {
  const source = await packageFixture('Offload crossing');
  const item = await edition(source.blob, {
    editionId: `ed_${'4'.repeat(64)}`,
  });
  const lockNames = [];
  const { library, creatorStore } = await fixture({
    editions: [item],
    downloads: new Map([[item.editionId, source.blob]]),
    lockManager: {
      request(name, operation) {
        lockNames.push(name);
        return operation();
      },
    },
  });
  const installed = await library.install(item, { offline: false });
  const before = await library.status(item.editionId);
  const pictureHash = source.prepared.manifest.assets[0].sha256;
  assert.ok(await creatorStore.readBlob(pictureHash));

  const review = await library.reviewInstalledOffload(item);
  assert.equal(review.manifestRetained, true);
  assert.equal(review.detachedAssets, 1);
  assert.ok(review.detachableBytes > 0);
  const offloaded = await library.offloadInstalled(item, review);
  assert.equal(offloaded.installed, false);
  assert.equal(offloaded.offloaded, true);
  assert.equal(offloaded.manifestRetained, true);
  assert.equal(offloaded.packageRetained, true);
  assert.equal(offloaded.creatorEditionId, installed.creatorEditionId);
  assert.equal(offloaded.profileKey, before.profileKey);
  assert.equal(offloaded.attemptKey, before.attemptKey);
  assert.equal(await creatorStore.readBlob(pictureHash), null);
  assert.deepEqual(await installedCreatorManifests(creatorStore), []);

  await library.install(item);
  const restored = await library.status(item.editionId);
  assert.equal(restored.installed, true);
  assert.equal(restored.offloaded, false);
  assert.equal(restored.creatorEditionId, installed.creatorEditionId);
  assert.equal(restored.profileKey, before.profileKey);
  assert.equal(restored.attemptKey, before.attemptKey);
  assert.ok(await creatorStore.readBlob(pictureHash));
  assert.equal((await installedCreatorManifests(creatorStore)).length, 1);
  assert.deepEqual(lockNames, [
    `revealline-community-edition-${item.editionId}`,
    `revealline-community-edition-${item.editionId}`,
    `revealline-community-edition-${item.editionId}`,
  ]);
  creatorStore.close();
});

test('offload keeps a shared asset until every active edition relinquishes it', async () => {
  const first = await packageFixture('Shared picture one');
  const second = await packageFixture('Shared picture two');
  const firstEdition = await edition(first.blob, {
    editionId: `ed_${'5'.repeat(64)}`,
  });
  const secondEdition = await edition(second.blob, {
    editionId: `ed_${'6'.repeat(64)}`,
    slug: 'shared-picture-two',
  });
  const { library, creatorStore } = await fixture({
    editions: [firstEdition, secondEdition],
    downloads: new Map([
      [firstEdition.editionId, first.blob],
      [secondEdition.editionId, second.blob],
    ]),
  });
  await library.install(firstEdition, { offline: false });
  await library.install(secondEdition, { offline: false });
  const sharedHash = first.prepared.manifest.assets[0].sha256;
  assert.equal(sharedHash, second.prepared.manifest.assets[0].sha256);

  const firstReview = await library.reviewInstalledOffload(firstEdition);
  assert.equal(firstReview.detachedAssets, 0);
  assert.equal(firstReview.detachableBytes, 0);
  await library.offloadInstalled(firstEdition, firstReview);
  assert.ok(await creatorStore.readBlob(sharedHash));
  assert.equal((await installedCreatorManifests(creatorStore)).length, 1);

  const secondReview = await library.reviewInstalledOffload(secondEdition);
  assert.equal(secondReview.detachedAssets, 1);
  await library.offloadInstalled(secondEdition, secondReview);
  assert.equal(await creatorStore.readBlob(sharedHash), null);
  assert.deepEqual(await installedCreatorManifests(creatorStore), []);
  creatorStore.close();
});

test('offload requires unchanged exact recovery and rejects a concurrent media generation', async () => {
  const first = await packageFixture('Reviewed offload');
  const second = await packageFixture('Concurrent install');
  const firstEdition = await edition(first.blob, {
    editionId: `ed_${'7'.repeat(64)}`,
  });
  const secondEdition = await edition(second.blob, {
    editionId: `ed_${'8'.repeat(64)}`,
    slug: 'concurrent-install',
  });
  const { library, creatorStore, downloadStore } = await fixture({
    editions: [firstEdition, secondEdition],
    downloads: new Map([
      [firstEdition.editionId, first.blob],
      [secondEdition.editionId, second.blob],
    ]),
  });
  await library.install(firstEdition, { offline: false });
  const noRecoveryReview = await library.reviewDownloadRemoval(firstEdition);
  await library.removeDownload(firstEdition, noRecoveryReview);
  await assert.rejects(library.reviewInstalledOffload(firstEdition), /exact recovery package/u);
  await library.retainFromInstalled(firstEdition);

  const stale = await library.reviewInstalledOffload(firstEdition);
  await library.install(secondEdition, { offline: false });
  await assert.rejects(library.offloadInstalled(firstEdition, stale), /changed/u);
  const current = await library.status(firstEdition.editionId);
  assert.equal(current.installed, true);
  assert.equal(current.offloaded, false);
  assert.ok(await downloadStore.get(firstEdition.editionId));
  creatorStore.close();
});

test('an interrupted offload journal remains recoverable from its exact retained package', async () => {
  const source = await packageFixture('Offload journal');
  const item = await edition(source.blob, {
    editionId: `ed_${'3'.repeat(64)}`,
  });
  const memoryState = createMemoryCommunityStateStore();
  let writes = 0;
  const stateStore = {
    read: memoryState.read,
    update(mutate) {
      if (++writes === 4) throw new Error('storage unavailable');
      return memoryState.update(mutate);
    },
  };
  const { library, creatorStore } = await fixture({
    editions: [item],
    downloads: new Map([[item.editionId, source.blob]]),
    stateStore,
  });
  await library.install(item, { offline: false });
  const review = await library.reviewInstalledOffload(item);
  const result = await library.offloadInstalled(item, review);
  assert.equal(result.journalComplete, false);
  assert.equal(result.offloaded, true);
  assert.equal(result.packageRetained, true);
  assert.equal(memoryState.read().editions[0].installation, 'offloading');

  await library.install(item);
  assert.equal((await library.status(item.editionId)).installed, true);
  assert.equal(memoryState.read().editions[0].installation, 'installed');
  creatorStore.close();
});

test('staged association recovers a committed install when the final journal write fails', async () => {
  const source = await packageFixture();
  const item = await edition(source.blob);
  const memoryState = createMemoryCommunityStateStore();
  let writes = 0;
  const stateStore = {
    read: memoryState.read,
    update(mutate) {
      if (++writes === 2) throw new Error('storage unavailable');
      return memoryState.update(mutate);
    },
  };
  const { library, creatorStore } = await fixture({
    editions: [item],
    downloads: new Map([[item.editionId, source.blob]]),
    stateStore,
  });
  const result = await library.install(item, { offline: false });
  assert.equal(result.journalComplete, false);
  assert.equal((await library.status(item.editionId)).installed, true);
  assert.equal((await installedCreatorManifests(creatorStore)).length, 1);
  creatorStore.close();
});

test('two injected creator accounts publish independently and track queued status', async () => {
  const source = await packageFixture();
  const owners = [];
  const ids = {
    alice: '11111111-1111-4111-8111-111111111111',
    bob: '22222222-2222-4222-8222-222222222222',
  };
  const uploads = [];
  const clients = {};
  const publishers = {};
  const publicationStatus = { alice: 'queued', bob: 'queued' };
  const fakeFetch = async (url, init = {}) => {
    const owner = init.headers?.authorization?.replace('Bearer ', '') ?? 'public';
    const pathname = new URL(url).pathname;
    if (init.method === 'POST' && pathname === '/v1/submissions') {
      owners.push(owner);
      const body = JSON.parse(init.body);
      return Response.json(
        {
          submission: {
            id: ids[owner],
            editionId: `ed_${(owner === 'alice' ? 'c' : 'd').repeat(64)}`,
          },
          upload: {
            method: owner === 'bob' ? 'POST' : 'PUT',
            href: owner === 'bob' ? '/tus' : `/uploads/${owner}`,
            mediaType: 'application/vnd.revealline.rlpack',
            resumable: owner === 'bob',
          },
          body,
        },
        { status: 201 },
      );
    }
    if (init.method === 'PUT' && pathname.startsWith('/uploads/'))
      return Response.json({ submission: { status: 'uploaded' } });
    if (init.method === 'POST' && pathname.endsWith('/submit'))
      return Response.json(
        {
          submission: {
            id: ids[owner],
            editionId: `ed_${(owner === 'alice' ? 'c' : 'd').repeat(64)}`,
            status: 'queued',
          },
          validation: { status: 'queued' },
        },
        { status: 202 },
      );
    if (init.method === 'POST' && pathname.endsWith('/unlist')) {
      const editionId = pathname.split('/').at(-2);
      const expectedEdition = `ed_${(owner === 'alice' ? 'c' : 'd').repeat(64)}`;
      if (editionId !== expectedEdition)
        return Response.json({ error: { message: 'Not found.' } }, { status: 404 });
      publicationStatus[owner] = 'unlisted';
      return Response.json({
        submission: { id: ids[owner], editionId, status: 'unlisted' },
      });
    }
    if (init.method === undefined && pathname.startsWith('/v1/submissions/')) {
      const id = pathname.split('/').at(-1);
      if (ids[owner] !== id)
        return Response.json({ error: { message: 'Not found.' } }, { status: 404 });
      return Response.json({
        submission: {
          id,
          editionId: `ed_${(owner === 'alice' ? 'c' : 'd').repeat(64)}`,
          status: publicationStatus[owner],
        },
      });
    }
    throw new Error(`unexpected request ${init.method} ${pathname}`);
  };
  for (const owner of ['alice', 'bob']) {
    const client = createCommunityClient({
      baseURL: 'https://community.example/',
      fetchImpl: fakeFetch,
      authHeaders: async () => ({ authorization: `Bearer ${owner}` }),
      resumableUpload: async ({ descriptor, blob, onProgress }) => {
        uploads.push({ owner, href: descriptor.href, bytes: blob.size });
        onProgress?.({ uploaded: blob.size, total: blob.size });
        return { status: 'uploaded' };
      },
    });
    const publisher = createCommunityPublisher({ client, decodeImage });
    clients[owner] = client;
    publishers[owner] = publisher;
    await publisher.select(source.blob);
    const result = await publisher.publish({
      title: `${owner} campaign`,
      slug: `${owner}-campaign`,
    });
    assert.equal(result.status, 'queued');
    assert.equal(result.resumable, owner === 'bob');
    assert.equal((await publisher.status(result.id)).status, 'queued');
  }
  assert.deepEqual(owners, ['alice', 'bob']);
  assert.deepEqual(uploads, [{ owner: 'bob', href: '/tus', bytes: source.blob.size }]);
  await assert.rejects(clients.alice.submission(ids.bob), /Not found/u);
  publicationStatus.alice = 'published';
  assert.equal((await publishers.alice.status(ids.alice)).status, 'published');
  assert.equal((await publishers.alice.unlist()).status, 'unlisted');
  await assert.rejects(clients.bob.unlistEdition(`ed_${'c'.repeat(64)}`), /Not found/u);
});

test('catalog page renders remote metadata only with safe localized text bindings', async () => {
  const page = await readFile(new URL('../community/page.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /innerHTML|insertAdjacentHTML|document\.write/u);
  assert.match(page, /localizedText/u);
});

test('publisher retries the same immutable submission after an interrupted resumable upload', async () => {
  const source = await packageFixture('Resume crossing');
  const submission = {
    id: '33333333-3333-4333-8333-333333333333',
    editionId: `ed_${'e'.repeat(64)}`,
    status: 'draft',
  };
  let creates = 0;
  let uploads = 0;
  const client = {
    async createSubmission() {
      creates += 1;
      return {
        submission,
        upload: { href: '/v1/uploads', resumable: true, protocol: 'tus-1.0' },
      };
    },
    async uploadSubmission() {
      uploads += 1;
      if (uploads === 1) throw new Error('Upload interrupted at 4 bytes.');
    },
    async submit(id) {
      assert.equal(id, submission.id);
      return { submission: { ...submission, status: 'queued' } };
    },
  };
  const publisher = createCommunityPublisher({ client, decodeImage });
  await publisher.select(source.blob);
  const input = { title: 'Resume crossing', slug: 'resume-crossing', version: '1.0.0' };
  await assert.rejects(publisher.publish(input), /interrupted/u);
  assert.equal((await publisher.publish(input)).status, 'queued');
  assert.equal(creates, 1);
  assert.equal(uploads, 2);
});

test('Installed enumerates verified local editions across an outage and a fresh library instance', async () => {
  const content = await packageFixture();
  const published = await edition(content.blob);
  const h = await fixture({
    editions: [published],
    downloads: new Map([[published.editionId, content.blob]]),
  });
  await h.library.install(published, { offline: false });
  let networkCalls = 0;
  h.client.catalog = async () => {
    networkCalls++;
    throw new Error('catalog offline');
  };
  const cached = await h.library.catalog({ installed: 'installed' });
  assert.equal(cached.editions[0].title, published.title);
  assert.equal(cached.editions[0].managementAvailable, true);
  const reopened = createCommunityLibrary({ ...h, decodeImage });
  const local = await reopened.catalog({ installed: 'installed' });
  assert.equal(networkCalls, 0);
  assert.equal(local.editions.length, 1);
  assert.equal(
    local.editions[0].title,
    published.slug,
    'historical journal provides a truthful stable name',
  );
  assert.equal(local.editions[0].managementAvailable, false);
  assert.equal(
    local.editions[0].publishedAt,
    undefined,
    'local inventory does not invent remote publication metadata',
  );
  assert.equal(local.editions[0].packageSize, undefined);
  assert.equal(local.editions[0].installed, true);
  assert.equal(
    local.editions[0].playHref,
    `../creator/player.html?edition=${content.prepared.editionId}`,
  );
  assert.equal(local.editions[0].previewAvailable, false);
  assert.equal(
    (await reopened.catalog({ installed: 'installed', query: 'AURORA' })).editions.length,
    1,
  );
  assert.equal(
    (await reopened.catalog({ installed: 'installed', query: 'absent' })).editions.length,
    0,
  );
  h.creatorStore.close();
});

test('local Installed excludes offloaded and staged-only content and paginates exact editions', async () => {
  const content = await packageFixture();
  const h = await fixture({ editions: [], downloads: new Map() });
  const published = await edition(content.blob);
  const ids = ['a', 'b', 'c'].map((letter) => `ed_${letter.repeat(64)}`);
  for (const editionId of ids) {
    const item = { ...published, editionId };
    await h.downloadStore.put(editionId, content.blob);
    await h.library.install(item);
  }
  const first = await h.library.catalog({ installed: 'installed', limit: 1 });
  assert.deepEqual(
    first.editions.map((item) => item.editionId),
    [ids[0]],
  );
  const second = await h.library.catalog({
    installed: 'installed',
    limit: 1,
    cursor: first.nextCursor,
  });
  assert.deepEqual(
    second.editions.map((item) => item.editionId),
    [ids[1]],
  );
  const third = await h.library.catalog({
    installed: 'installed',
    limit: 1,
    cursor: second.nextCursor,
  });
  assert.deepEqual(
    third.editions.map((item) => item.editionId),
    [ids[2]],
  );
  assert.equal(third.nextCursor, null);
  await assert.rejects(
    h.library.catalog({ installed: 'installed', cursor: 'remote-cursor' }),
    /cursor/u,
  );
  await assert.rejects(h.library.catalog({ installed: 'installed', limit: 0 }), /limit/u);
  const review = await h.library.reviewInstalledOffload(published);
  await h.library.offloadInstalled(published, review);
  assert.equal(
    (await h.library.catalog({ installed: 'installed' })).editions.length,
    0,
    'shared exact runtime is actually offloaded, regardless of other journal entries',
  );
  await h.stateStore.update((state) => {
    state.editions[0].installation = 'staged';
    return state;
  });
  assert.equal((await h.library.catalog({ installed: 'installed' })).editions.length, 0);
  h.creatorStore.close();
});

test('Installed refuses unrelated cached metadata and honors cancellation before local reads', async () => {
  const content = await packageFixture();
  const published = await edition(content.blob);
  const h = await fixture({
    editions: [published],
    downloads: new Map([[published.editionId, content.blob]]),
  });
  await h.library.install(published, { offline: false });
  await h.stateStore.update((state) => {
    state.editions[0].version = 'historical-version';
    return state;
  });
  const result = await h.library.catalog({ installed: 'installed' });
  assert.equal(result.editions[0].managementAvailable, false);
  assert.equal(result.editions[0].title, published.slug);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    h.library.catalog({ installed: 'installed', signal: controller.signal }),
    /abort/iu,
  );
  h.creatorStore.close();
});

test('local Installed uses each native runtime owner and never upgrades retained packages to Play', async () => {
  const stateStore = createMemoryCommunityStateStore();
  const families = ['classic', 'team', 'fpv', 'overflight', 'overflight-hunt', 'overflight-riy'];
  const linked = families.map((family, index) => ({
    editionId: `ed_${String(index + 1).repeat(64)}`,
    collectionId: null,
    creatorEditionId: String(index + 1).repeat(64),
    slug: family,
    version: '1',
    packageSha256: 'f'.repeat(64),
    family,
    runtimeIdentity:
      family === 'team' ? 'a'.repeat(64) : family === 'fpv' ? 'local-world' : 'b'.repeat(16),
    installation: 'installed',
    installedAt: null,
  }));
  await stateStore.update((state) => ({ ...state, editions: linked }));
  const installed = new Set(linked.map((item) => item.creatorEditionId));
  const library = createCommunityLibrary({
    client: {
      catalog() {
        throw new Error('Local inventory must not contact the service');
      },
    },
    creatorStore: {},
    stateStore,
    downloadStore: createMemoryCommunityDownloadStore(),
    classicInstalled: { storage: async (id) => ({ installed: installed.has(id) }) },
    nativeInstalled: {
      storage: async (item) => ({ installed: installed.has(item.creatorEditionId) }),
    },
  });
  const result = await library.catalog({ installed: 'installed' });
  assert.equal(result.editions.length, families.length);
  const destinations = [
    '/snake/play.html?',
    '/couch/relay-rescue.html?',
    '/civilian-fpv/index.html?',
    '/overflight/play.html?community=',
    '/overflight/raid.html?',
    '/overflight/play.html?operation=riy',
  ];
  for (let index = 0; index < families.length; index++) {
    assert.equal(result.editions[index].family, families[index]);
    assert.ok(result.editions[index].playHref.includes(destinations[index]));
  }
  installed.delete(linked[1].creatorEditionId);
  assert.equal((await library.catalog({ installed: 'installed' })).editions.length, 5);
});

test('one unavailable local runtime remains visible without hiding healthy installed games', async () => {
  const stateStore = createMemoryCommunityStateStore();
  const editions = ['fpv', 'team'].map((family, index) => ({
    editionId: `ed_${String(index + 1).repeat(64)}`,
    collectionId: null,
    creatorEditionId: String(index + 1).repeat(64),
    slug: family,
    version: '1',
    packageSha256: 'a'.repeat(64),
    family,
    runtimeIdentity: family === 'fpv' ? 'local-world' : 'b'.repeat(64),
    installation: 'installed',
    installedAt: null,
  }));
  await stateStore.update((state) => ({ ...state, editions }));
  const library = createCommunityLibrary({
    client: {},
    creatorStore: {},
    stateStore,
    downloadStore: createMemoryCommunityDownloadStore(),
    nativeInstalled: {
      storage: async (item) => {
        if (item.family === 'fpv') throw new Error('optional store unavailable');
        return { installed: true };
      },
    },
  });
  const result = await library.catalog({ installed: 'installed' });
  assert.equal(result.editions.length, 2);
  assert.equal(result.editions[0].localUnavailable, true);
  assert.equal(result.editions[0].installed, false);
  assert.equal(result.editions[0].playHref, undefined);
  assert.equal(result.editions[1].installed, true);
  assert.match(result.editions[1].playHref, /relay-rescue/u);
});

const offlineClient = {
  catalog() {
    throw new Error('Recovery must not contact the catalog');
  },
  download() {
    throw new Error('Recovery must not download');
  },
};
const reopenLocalLibrary = (h, overrides = {}) =>
  createCommunityLibrary({
    client: offlineClient,
    creatorStore: h.creatorStore,
    stateStore: h.stateStore,
    downloadStore: h.downloadStore,
    decodeImage,
    ...overrides,
  });

test('fresh offline recovery restores an offloaded Creator edition and its exact progress owner', async (t) => {
  const { createJourneyBackend } = await import('../journey/profile.mjs');
  const { managedIndexedDB } = await import('./helpers/managed-idb.mjs');
  const { loadInstalledCreatorBundle } = await import('../creator/installed.mjs');
  const content = await packageFixture(),
    published = await edition(content.blob);
  const h = await fixture({
    editions: [published],
    downloads: new Map([[published.editionId, content.blob]]),
  });
  t.after(() => h.creatorStore.close());
  await h.library.install(published, { offline: false });
  const original = await h.library.status(published.editionId);
  const progressDisk = managedIndexedDB();
  const progress = createJourneyBackend({ ...progressDisk, profileKey: original.profileKey });
  await progress.commit([
    {
      type: 'complete',
      mode: 'solo',
      missionId: 'picture-1',
      runId: 'retained-run',
      gameplayId: 'exact-gameplay',
      difficulty: 'standard',
      stars: 2,
    },
  ]);
  const originalProgress = await progress.read();
  await h.library.offloadInstalled(published, await h.library.reviewInstalledOffload(published));
  const locks = [];
  let writes = 0;
  const fresh = reopenLocalLibrary(h, {
    lockManager: {
      request(name, work) {
        locks.push(name);
        return work();
      },
    },
    downloadStore: {
      ...h.downloadStore,
      put() {
        writes++;
        throw new Error('Do not replace the recovery copy');
      },
    },
  });
  assert.deepEqual((await fresh.catalog({ installed: 'installed' })).editions, []);
  const row = (await fresh.catalog({ installed: 'recovery' })).editions[0];
  assert.equal(row.recoveryCopy, true);
  assert.equal(row.retainedBytes, content.blob.size);
  assert.equal(row.title, published.slug);
  assert.equal(row.publishedAt, undefined);
  assert.equal(row.packageSize, undefined);
  assert.equal(row.installed, false);
  assert.equal(row.playHref, null);
  const restored = await fresh.restoreRetained(row.editionId);
  assert.equal(restored.journalComplete, true);
  const after = await fresh.status(row.editionId);
  assert.equal(after.installed, true);
  assert.equal(after.playHref, original.playHref);
  assert.equal(after.profileKey, original.profileKey);
  assert.equal(after.attemptKey, original.attemptKey);
  assert.deepEqual(await progress.read(), originalProgress);
  const playable = await loadInstalledCreatorBundle(h.creatorStore, after.creatorEditionId, {
    decodeImage,
  });
  assert.equal(playable.editionId, content.prepared.editionId);
  assert.deepEqual(
    await (await h.downloadStore.get(row.editionId)).arrayBuffer(),
    await content.blob.arrayBuffer(),
  );
  assert.equal(writes, 0);
  assert.deepEqual(locks, [`revealline-community-edition-${published.editionId}`]);
});

test('recovery rejects missing, altered, malformed or mismatched exact bytes before any owner write', async (t) => {
  const content = await packageFixture(),
    published = await edition(content.blob);
  const h = await fixture({
    editions: [published],
    downloads: new Map([[published.editionId, content.blob]]),
  });
  t.after(() => h.creatorStore.close());
  await h.library.install(published, { offline: false });
  await h.library.offloadInstalled(published, await h.library.reviewInstalledOffload(published));
  const original = await h.stateStore.read();
  for (const kind of ['missing', 'altered', 'malformed', 'identity', 'family', 'runtime']) {
    await h.stateStore.write(original);
    await h.downloadStore.put(published.editionId, content.blob);
    if (kind === 'missing') await h.downloadStore.remove(published.editionId);
    if (kind === 'altered') await h.downloadStore.put(published.editionId, new Blob(['tampered']));
    if (kind === 'malformed') {
      const malformed = new Blob(['{}']);
      await h.downloadStore.put(published.editionId, malformed);
    }
    if (kind === 'malformed')
      await h.stateStore.update((state) => ({
        ...state,
        editions: [
          {
            ...state.editions[0],
            packageSha256: '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
          },
        ],
      }));
    if (kind === 'identity')
      await h.stateStore.update((state) => {
        state.editions[0].creatorEditionId = 'f'.repeat(64);
        return state;
      });
    if (kind === 'family')
      await h.stateStore.update((state) => {
        Object.assign(state.editions[0], { family: 'team', runtimeIdentity: 'f'.repeat(64) });
        return state;
      });
    if (kind === 'runtime')
      await h.stateStore.update((state) => {
        state.editions[0].runtimeIdentity = 'unexpected';
        return state;
      });
    const before = await h.stateStore.read(),
      retained = await h.downloadStore.get(published.editionId),
      media = await h.creatorStore.readDomain('media');
    let writes = 0;
    const fresh = reopenLocalLibrary(h, {
      stateStore: {
        read: () => h.stateStore.read(),
        update() {
          writes++;
          throw new Error('Unexpected journal write');
        },
      },
    });
    await assert.rejects(fresh.restoreRetained(published.editionId), undefined, kind);
    assert.equal(writes, 0, kind);
    assert.deepEqual(await h.stateStore.read(), before, kind);
    assert.deepEqual(await h.creatorStore.readDomain('media'), media, kind);
    assert.deepEqual(
      await (await h.downloadStore.get(published.editionId))?.arrayBuffer(),
      await retained?.arrayBuffer(),
      kind,
    );
  }
});

test('recovery listing isolates unreadable copies, includes staged entries and owns its search/cursor', async (t) => {
  const content = await packageFixture(),
    published = await edition(content.blob);
  const h = await fixture({
    editions: [published],
    downloads: new Map([[published.editionId, content.blob]]),
  });
  t.after(() => h.creatorStore.close());
  await h.library.install(published, { offline: false });
  const original = (await h.stateStore.read()).editions[0];
  const rows = ['1', '2', '3', '4'].map((n) => ({
    ...original,
    editionId: `ed_${n.repeat(64)}`,
    slug: `copy-${n}`,
    installation: 'staged',
  }));
  await h.stateStore.write({ format: 'revealline-community-library.v1', editions: rows });
  for (const row of rows.slice(1)) await h.downloadStore.put(row.editionId, content.blob);
  const fresh = reopenLocalLibrary(h, {
    downloadStore: {
      ...h.downloadStore,
      get(id) {
        if (id === rows[0].editionId) throw new Error('Unreadable cache entry');
        return h.downloadStore.get(id);
      },
    },
  });
  await h.downloadStore.remove(rows[3].editionId);
  const first = await fresh.catalog({ installed: 'recovery', limit: 2 });
  assert.equal(first.editions.length, 2);
  assert.equal(first.editions[0].localUnavailable, true);
  assert.equal(first.editions[0].recoveryAvailable, false);
  assert.equal(first.editions[0].retainedBytes, undefined);
  assert.equal(first.editions[1].recoveryAvailable, true);
  assert.equal(first.nextCursor, `recovery:${rows[1].editionId}`);
  const next = await fresh.catalog({ installed: 'recovery', limit: 2, cursor: first.nextCursor });
  assert.deepEqual(
    next.editions.map((row) => row.editionId),
    [rows[2].editionId],
  );
  assert.equal(next.nextCursor, null);
  assert.deepEqual(
    (await fresh.catalog({ installed: 'recovery', query: 'COPY-2' })).editions.map(
      (row) => row.editionId,
    ),
    [rows[1].editionId],
  );
  await assert.rejects(
    fresh.catalog({ installed: 'installed', cursor: first.nextCursor }),
    /cursor/,
  );
  await assert.rejects(
    fresh.catalog({ installed: 'recovery', cursor: `local:${rows[0].editionId}` }),
    /cursor/,
  );
  await fresh.restoreRetained(rows[1].editionId);
  assert.equal((await fresh.status(rows[1].editionId)).installed, true);
});

test('local reinstall rechecks the retained copy and association after admission review', async (t) => {
  const content = await packageFixture(),
    published = await edition(content.blob);
  const h = await fixture({
    editions: [published],
    downloads: new Map([[published.editionId, content.blob]]),
  });
  t.after(() => h.creatorStore.close());
  await h.library.install(published, { offline: false });
  await h.library.offloadInstalled(published, await h.library.reviewInstalledOffload(published));
  const original = await h.stateStore.read();
  for (const kind of ['copy', 'association']) {
    await h.stateStore.write(original);
    await h.downloadStore.put(published.editionId, content.blob);
    const creatorStore = {
      ...h.creatorStore,
      async readDomain(...args) {
        const result = await h.creatorStore.readDomain(...args);
        if (kind === 'copy') await h.downloadStore.put(published.editionId, new Blob(['changed']));
        else
          await h.stateStore.update((state) => {
            state.editions[0].version = 'new-local-choice';
            return state;
          });
        return result;
      },
    };
    const fresh = reopenLocalLibrary(h, { creatorStore });
    await assert.rejects(fresh.restoreRetained(published.editionId), /changed/);
    assert.deepEqual(await installedCreatorManifests(h.creatorStore), []);
    assert.equal((await h.stateStore.read()).editions[0].installation, 'offloaded');
  }
});

test('local reinstall reports incomplete final journal separately from a committed runtime', async (t) => {
  const content = await packageFixture(),
    published = await edition(content.blob);
  const h = await fixture({
    editions: [published],
    downloads: new Map([[published.editionId, content.blob]]),
  });
  t.after(() => h.creatorStore.close());
  await h.library.install(published, { offline: false });
  await h.library.offloadInstalled(published, await h.library.reviewInstalledOffload(published));
  let writes = 0;
  const fresh = reopenLocalLibrary(h, {
    stateStore: {
      read: () => h.stateStore.read(),
      update(mutate) {
        if (++writes === 2) throw new Error('Final write unavailable');
        return h.stateStore.update(mutate);
      },
    },
  });
  assert.equal((await fresh.restoreRetained(published.editionId)).journalComplete, false);
  assert.equal((await fresh.status(published.editionId)).installed, true);
  assert.equal((await h.stateStore.read()).editions[0].installation, 'staged');
  assert.ok(await h.downloadStore.get(published.editionId));
});
