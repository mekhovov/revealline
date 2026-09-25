import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildCommunityApp } from '../src/app.mjs';
import { createTokenAuthenticator } from '../src/auth.mjs';
import { MemoryBlobStore } from '../src/blob-store.mjs';
import { MemoryCommunityRepository } from '../src/memory-repository.mjs';
import { processNextValidationJob } from '../src/worker.mjs';
import { createCommunityClient } from '../../../game/community/client.mjs';
import { createMemoryCommunityDownloadStore } from '../../../game/community/download-store.mjs';
import { createCommunityLibrary } from '../../../game/community/library.mjs';
import { createCommunityPublisher } from '../../../game/community/publisher.mjs';
import { createMemoryCommunityStateStore } from '../../../game/community/state.mjs';
import { creatorSHA256 } from '../../../game/creator/bytes.mjs';
import {
  approveCreatorBundle,
  exportCreatorBundle,
  prepareCreatorBundle,
} from '../../../game/creator/bundle.mjs';
import { createCreatorStore, installedCreatorManifests } from '../../../game/creator/installed.mjs';
import { generateCreatorProject } from '../../../game/creator/templates.mjs';
import { pngBytes } from '../../../game/test/helpers/media-fixtures.mjs';
import { memoryIndexedDB } from '../../../game/test/helpers/soundtrack-fixtures.mjs';

const themes = JSON.parse(
  await readFile(new URL('../../../game/content-design/themes.json', import.meta.url)),
).themes;
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });

async function creatorPackage({ id, name, seed }) {
  const generated = generateCreatorProject({ id, name, seed });
  const project = structuredClone(generated.project);
  const picture = new Blob([pngBytes()], { type: 'image/png' });
  const sha256 = await creatorSHA256(await picture.arrayBuffer());
  project.assets = [
    {
      format: 'AssetRevisionV1',
      id: 'picture',
      revision: '1',
      kind: 'reveal-background',
      path: `content-design/assets/creator/${sha256}.png`,
      sha256,
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
        creator: 'Integration fixture',
        picture: 'Generated fixture',
        license: 'Test permission',
      },
    },
    [{ sha256, blob: picture }],
    { decodeImage },
  );
  return exportCreatorBundle(prepared, approveCreatorBundle(prepared));
}

const fetchThroughFastify =
  (app) =>
  async (input, init = {}) => {
    const url = new URL(input);
    const body =
      init.body instanceof Blob
        ? Buffer.from(await init.body.arrayBuffer())
        : (init.body ?? undefined);
    const injected = await app.inject({
      method: init.method ?? 'GET',
      url: `${url.pathname}${url.search}`,
      headers: init.headers,
      payload: body,
    });
    const headers = new Headers();
    for (const [name, value] of Object.entries(injected.headers)) {
      if (value !== undefined)
        headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
    }
    return new Response(injected.rawPayload, { status: injected.statusCode, headers });
  };

test('real service and store client publish, page, search, report, install and owner-unlist exact bytes', async (t) => {
  let now = new Date('2026-09-25T10:00:00.000Z');
  const repository = new MemoryCommunityRepository({ clock: () => now });
  const blobStore = new MemoryBlobStore();
  const app = buildCommunityApp({
    repository,
    blobStore,
    authenticator: createTokenAuthenticator({
      'alice-token': 'creator/alice',
      'bob-token': 'creator/bob',
    }),
    maxPackageBytes: 16 * 1024 * 1024,
  });
  await app.ready();
  t.after(() => app.close());

  const fetchImpl = fetchThroughFastify(app);
  const alice = createCommunityClient({
    baseURL: 'http://community.test/',
    fetchImpl,
    authHeaders: async () => ({ authorization: 'Bearer alice-token' }),
  });
  const bob = createCommunityClient({
    baseURL: 'http://community.test/',
    fetchImpl,
    authHeaders: async () => ({ authorization: 'Bearer bob-token' }),
  });
  const publisher = createCommunityPublisher({ client: alice, decodeImage });

  const publish = async ({ blob, title, version }) => {
    await publisher.select(blob);
    const queued = await publisher.publish({
      title,
      slug: 'aurora-crossing',
      version,
    });
    assert.equal(queued.status, 'queued');
    const completed = await processNextValidationJob({
      repository,
      blobStore,
      workerId: `worker-${version}`,
      validatePackage: async () => ({
        accepted: true,
        report: { compiler: 'passed', replay: 'passed' },
      }),
    });
    assert.equal(completed.submission.status, 'published');
    return publisher.status(queued.id);
  };

  const firstBlob = await creatorPackage({ id: 'store-first', name: 'Aurora crossing', seed: 8 });
  const first = await publish({ blob: firstBlob, title: 'Aurora crossing', version: '1.0.0' });
  now = new Date('2026-09-25T10:01:00.000Z');
  const secondBlob = await creatorPackage({
    id: 'store-second',
    name: 'Aurora crossing revised',
    seed: 9,
  });
  const second = await publish({
    blob: secondBlob,
    title: 'Aurora crossing revised',
    version: '1.1.0',
  });

  const firstPage = await alice.catalog({ limit: 1 });
  assert.equal(firstPage.editions.length, 1);
  assert.ok(firstPage.nextCursor);
  const secondPage = await alice.catalog({ cursor: firstPage.nextCursor, limit: 1 });
  assert.equal(secondPage.editions.length, 1);
  assert.notEqual(firstPage.editions[0].editionId, secondPage.editions[0].editionId);

  const search = await alice.catalog({ query: 'revised' });
  assert.equal(search.editions.length, 1);
  const latest = search.editions[0];
  assert.equal(latest.editionId, second.editionId);
  assert.equal(latest.latestEditionId, second.editionId);
  assert.equal(latest.latestVersion, '1.1.0');
  assert.equal(
    (await alice.edition(first.editionId)).collectionId,
    latest.collectionId,
    'versions from one creator slug share an authoritative collection identity',
  );

  const report = await alice.reportEdition(latest.editionId, {
    reason: 'broken',
    details: 'Integration report fixture.',
  });
  assert.equal(report.report.status, 'open');

  const creatorStore = createCreatorStore({ indexedDB: memoryIndexedDB().indexedDB });
  t.after(() => creatorStore.close());
  const library = createCommunityLibrary({
    client: alice,
    creatorStore,
    stateStore: createMemoryCommunityStateStore(),
    downloadStore: createMemoryCommunityDownloadStore(),
    decodeImage,
  });
  const installed = await library.install(latest, { offline: false });
  assert.equal(installed.editionId, latest.editionId);
  assert.equal((await installedCreatorManifests(creatorStore)).length, 1);
  assert.equal((await library.status(latest.editionId)).offlinePlayable, true);

  await assert.rejects(bob.unlistEdition(latest.editionId), /not found/u);
  assert.equal((await alice.unlistEdition(latest.editionId)).status, 'unlisted');
  assert.equal((await alice.catalog({ query: 'revised' })).editions.length, 0);
  assert.equal((await library.status(latest.editionId)).offlinePlayable, true);
});
