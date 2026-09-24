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
const fixture = async ({ editions, downloads, stateStore = createMemoryCommunityStateStore() }) => {
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
    library: createCommunityLibrary({
      client,
      creatorStore,
      stateStore,
      downloadStore,
      decodeImage,
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

test('staged association recovers a committed install when the final journal write fails', async () => {
  const source = await packageFixture();
  const item = await edition(source.blob);
  const memoryState = createMemoryCommunityStateStore();
  let writes = 0;
  const stateStore = {
    read: memoryState.read,
    write(value) {
      if (++writes === 2) throw new Error('storage unavailable');
      return memoryState.write(value);
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

test('catalog page renders remote metadata only with textContent', async () => {
  const page = await readFile(new URL('../community/page.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /innerHTML|insertAdjacentHTML|document\.write/u);
  assert.match(page, /textContent/u);
});
