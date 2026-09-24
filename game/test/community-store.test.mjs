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
  return {
    editionId: `ed_${'a'.repeat(64)}`,
    slug: 'aurora-crossing',
    title: 'Aurora crossing',
    description: 'A calm first flight.',
    version: '1.0.0',
    packageSha256: await hash(blob),
    packageSize: blob.size,
    publishedAt: '2026-09-24T10:00:00.000Z',
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
  const oldEdition = await edition(first.blob);
  const newEdition = await edition(second.blob, {
    editionId: `ed_${'b'.repeat(64)}`,
    version: '1.1.0',
    packageSha256: await hash(second.blob),
    packageSize: second.blob.size,
    publishedAt: '2026-09-25T10:00:00.000Z',
  });
  const { library, creatorStore } = await fixture({
    editions: [newEdition, oldEdition],
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
  await library.install(newEdition, { offline: false });
  assert.equal((await installedCreatorManifests(creatorStore)).length, 2);
  catalog = await library.catalog({ installed: 'installed' });
  assert.equal(catalog.editions.length, 2);
  assert.ok(
    catalog.editions.every((row) => row.playHref.includes('../creator/player.html?edition=')),
  );
  assert.ok(catalog.editions.every((row) => row.installed));
  assert.ok(catalog.editions.every((row) => !row.updateAvailable));
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
  assert.equal((await library.status(item.editionId)).packageRetained, true);
  await library.removeDownload(item.editionId);
  const afterRemoval = await library.status(item.editionId);
  assert.equal(afterRemoval.installed, true);
  assert.equal(afterRemoval.creatorEditionId, installed.creatorEditionId);
  assert.equal(afterRemoval.packageRetained, false);
  assert.equal((await installedCreatorManifests(creatorStore)).length, 1);
  await library.retainFromInstalled(item);
  assert.equal((await library.status(item.editionId)).packageRetained, true);
  assert.equal(await hash(await downloadStore.get(item.editionId)), item.packageSha256);
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
        { submission: { status: 'queued' }, validation: { status: 'queued' } },
        { status: 202 },
      );
    if (init.method === undefined && pathname.startsWith('/v1/submissions/')) {
      const id = pathname.split('/').at(-1);
      if (ids[owner] !== id)
        return Response.json({ error: { message: 'Not found.' } }, { status: 404 });
      return Response.json({ submission: { id, status: 'queued' } });
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
});

test('catalog page renders remote metadata only with textContent', async () => {
  const page = await readFile(new URL('../community/page.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /innerHTML|insertAdjacentHTML|document\.write/u);
  assert.match(page, /textContent/u);
});
