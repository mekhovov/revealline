import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildCommunityApp } from '../src/app.mjs';
import { createTokenAuthenticator } from '../src/auth.mjs';
import { DiskBlobStore } from '../src/blob-store.mjs';
import { MemoryCommunityRepository } from '../src/memory-repository.mjs';
import { processNextValidationJob } from '../src/worker.mjs';
import { createCreatorPackageValidator } from '../src/validator.mjs';
import { createCommunityClient } from '../../../game/community/client.mjs';
import { createCommunityPublisher } from '../../../game/community/publisher.mjs';
import { createCommunityLibrary } from '../../../game/community/library.mjs';
import { createCommunityNativeInstalled } from '../../../game/community/native-installed.mjs';
import { createMemoryCommunityDownloadStore } from '../../../game/community/download-store.mjs';
import { createMemoryCommunityStateStore } from '../../../game/community/state.mjs';
import { createCreatorStore } from '../../../game/creator/installed.mjs';
import { managedIndexedDB } from '../../../game/test/helpers/managed-idb.mjs';
import { createOverflightRiyProject } from '../../../game/overflight/riy-project.mjs';
import {
  createOverflightRiyPackage,
  createOverflightRiyLibrary,
} from '../../../game/overflight/riy-community.mjs';
import { createOverflightHuntProject } from '../../../game/overflight/raid-project.mjs';
import {
  createOverflightHuntPackage,
  createOverflightHuntLibrary,
} from '../../../game/overflight/raid-community.mjs';

// Production Fastify handlers and validators; explicit local test authentication.
// No external service, production credentials or live publication is involved.
const fetchThroughFastify =
  (app) =>
  async (input, init = {}) => {
    const url = new URL(input);
    const injected = await app.inject({
      method: init.method ?? 'GET',
      url: url.pathname + url.search,
      headers: init.headers,
      payload: init.body instanceof Blob ? Buffer.from(await init.body.arrayBuffer()) : init.body,
    });
    const headers = new Headers();
    for (const [key, value] of Object.entries(injected.headers))
      if (value !== undefined)
        headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
    return new Response(injected.rawPayload, { status: injected.statusCode, headers });
  };

for (const [family, projectFactory, packageFactory, libraryFactory] of [
  [
    'overflight-riy',
    createOverflightRiyProject,
    createOverflightRiyPackage,
    createOverflightRiyLibrary,
  ],
  [
    'overflight-hunt',
    createOverflightHuntProject,
    createOverflightHuntPackage,
    createOverflightHuntLibrary,
  ],
])
  test(`${family}: authenticated owner updates, non-owner rejection, disk upload and offline edition recovery`, async (t) => {
    const diskRoot = await mkdtemp(path.join(os.tmpdir(), 'revealline-community-riy-test-'));
    const blobStore = new DiskBlobStore({ root: diskRoot });
    const repository = new MemoryCommunityRepository();
    const app = buildCommunityApp({
      repository,
      blobStore,
      authenticator: createTokenAuthenticator({
        'alice-test': 'creator/alice',
        'bob-test': 'creator/bob',
      }),
    });
    await app.ready();
    t.after(async () => {
      await app.close();
      await rm(diskRoot, { recursive: true, force: true });
    });
    const makeClient = (token) =>
      createCommunityClient({
        baseURL: 'http://community.test/',
        fetchImpl: fetchThroughFastify(app),
        authHeaders: async () => ({ authorization: `Bearer ${token}` }),
      });
    const owner = makeClient('alice-test'),
      player = makeClient('bob-test');
    const publisher = createCommunityPublisher({ client: owner });
    const validator = createCreatorPackageValidator();
    const packages = [];
    const published = [];
    for (const [index, version] of ['1.0.0', '1.1.0'].entries()) {
      const project = projectFactory({ seed: 17031991 + index });
      const blob = new Blob([JSON.stringify(packageFactory(project), null, 2)], {
        type: 'application/json',
      });
      packages.push(blob);
      assert.equal((await publisher.select(blob)).family, family);
      const queued = await publisher.publish({ slug: family, title: `Local ${family}`, version });
      assert.equal(queued.status, 'queued');
      for (const [method, url, payload] of [
        ['GET', `/v1/submissions/${queued.id}`, undefined],
        ['PUT', `/v1/submissions/${queued.id}/package`, Buffer.from(await blob.arrayBuffer())],
        ['POST', `/v1/submissions/${queued.id}/submit`, undefined],
      ]) {
        const denied = await app.inject({
          method,
          url,
          payload,
          headers: { authorization: 'Bearer bob-test', 'content-type': 'application/octet-stream' },
        });
        assert.equal(
          denied.statusCode,
          404,
          `${method} must not expose another owner's submission`,
        );
      }
      // Reopen the on-disk store for validation: package bytes must survive the uploader object.
      const checked = await processNextValidationJob({
        repository,
        blobStore: new DiskBlobStore({ root: diskRoot }),
        validatePackage: validator,
        workerId: `local-${index}`,
      });
      assert.equal(checked.submission.status, 'published');
      published.push(await publisher.status(queued.id));
      const denied = await app.inject({
        method: 'POST',
        url: `/v1/publications/${queued.editionId}/unlist`,
        headers: { authorization: 'Bearer bob-test' },
      });
      assert.equal(denied.statusCode, 404);
    }
    const catalogue = (await player.catalog()).editions;
    assert.equal(catalogue.length, 2);
    assert.ok(catalogue.every((row) => row.family === family && !row.previewAvailable));
    assert.equal(
      catalogue[0].collectionId,
      catalogue[1].collectionId,
      'owner updates preserve collection',
    );
    assert.notEqual(catalogue[0].editionId, catalogue[1].editionId, 'editions remain immutable');
    const first = catalogue.find((row) => row.version === '1.0.0');
    const second = catalogue.find((row) => row.version === '1.1.0');
    const databases = new Map();
    const indexedDB = {
      open(name, version) {
        if (!databases.has(name)) databases.set(name, managedIndexedDB());
        return databases.get(name).indexedDB.open(name, version);
      },
    };
    const local = libraryFactory({ indexedDB });
    const installed = createCommunityNativeInstalled({ indexedDB });
    const downloads = createMemoryCommunityDownloadStore();
    let online = true;
    const library = createCommunityLibrary({
      client: {
        catalog: (...args) => player.catalog(...args),
        download: (...args) => {
          assert.ok(online, 'offline recovery must use retained exact bytes');
          return player.download(...args);
        },
      },
      creatorStore: createCreatorStore({ indexedDB }),
      nativeInstalled: installed,
      stateStore: createMemoryCommunityStateStore(),
      downloadStore: downloads,
    });
    t.after(() => {
      library.close();
      installed.close();
      local.dispose();
    });
    await library.install(first, { offline: false });
    const status = await library.status(first.editionId);
    assert.equal(status.family, family);
    assert.equal(status.installed, true);
    assert.match(
      status.playHref,
      family === 'overflight-riy' ? /operation=riy&community=/ : /raid.html\?community=/,
    );
    await library.retainFromInstalled(first);
    assert.equal(await (await downloads.get(first.editionId)).text(), await packages[0].text());
    online = false;
    await library.offloadInstalled(first, await library.reviewInstalledOffload(first));
    assert.equal((await library.status(first.editionId)).offloaded, true);
    await library.install(first);
    assert.equal((await library.status(first.editionId)).runtimeIdentity, status.runtimeIdentity);
    online = true;
    await library.install(second, { offline: false });
    assert.equal(
      (await local.list()).length,
      2,
      'the revised edition does not overwrite the first',
    );
  });
