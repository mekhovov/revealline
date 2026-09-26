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
import {
  createCreatorStore,
  installedCreatorManifests,
  loadInstalledCreatorBundle,
} from '../../../game/creator/installed.mjs';
import { createCreatorRuntime, creatorProfileKey } from '../../../game/creator/runtime.mjs';
import { generateCreatorProject } from '../../../game/creator/templates.mjs';
import { createJourneyBackend, createJourneyProfileStore } from '../../../game/journey/profile.mjs';
import { managedIndexedDB } from '../../../game/test/helpers/managed-idb.mjs';
import { pngBytes } from '../../../game/test/helpers/media-fixtures.mjs';
import { PNGImage } from '../../../game/test/helpers/png-image.mjs';
import { memoryIndexedDB } from '../../../game/test/helpers/soundtrack-fixtures.mjs';

const themes = JSON.parse(
  await readFile(new URL('../../../game/content-design/themes.json', import.meta.url)),
).themes;
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const decodeArtwork = async (dataURL) => {
  const image = new PNGImage();
  image.src = dataURL;
  await image.decode();
  return image;
};

function replayCommands(replay) {
  return replay.segments.flatMap((segment) =>
    Array.from({ length: segment.ticks }, () => segment.input),
  );
}

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

test('creator A publishes and player B discovers, installs, reloads, completes and replays offline', async (t) => {
  let now = new Date('2026-09-25T10:00:00.000Z');
  const repository = new MemoryCommunityRepository({ clock: () => now });
  const blobStore = new MemoryBlobStore();
  const app = buildCommunityApp({
    repository,
    blobStore,
    authenticator: createTokenAuthenticator({
      'alice-token': 'creator/alice',
      'bob-token': 'creator/bob',
      'admin-token': { subject: 'operator/admin', roles: ['admin'] },
    }),
    maxPackageBytes: 16 * 1024 * 1024,
  });
  await app.ready();
  let appClosed = false;
  t.after(async () => {
    if (!appClosed) await app.close();
  });

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
  const administrator = createCommunityClient({
    baseURL: 'http://community.test/',
    fetchImpl,
    authHeaders: async () => ({ authorization: 'Bearer admin-token' }),
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

  const firstPage = await bob.catalog({ limit: 1 });
  assert.equal(firstPage.editions.length, 1);
  assert.ok(firstPage.nextCursor);
  const secondPage = await bob.catalog({ cursor: firstPage.nextCursor, limit: 1 });
  assert.equal(secondPage.editions.length, 1);
  assert.notEqual(firstPage.editions[0].editionId, secondPage.editions[0].editionId);

  const search = await bob.catalog({ query: 'revised' });
  assert.equal(search.editions.length, 1);
  const latest = search.editions[0];
  assert.equal(latest.editionId, second.editionId);
  assert.equal(latest.latestEditionId, second.editionId);
  assert.equal(latest.latestVersion, '1.1.0');
  assert.equal(
    (await bob.edition(first.editionId)).collectionId,
    latest.collectionId,
    'versions from one creator slug share an authoritative collection identity',
  );

  const report = await bob.reportEdition(latest.editionId, {
    reason: 'broken',
    details: 'Integration report fixture.',
  });
  assert.equal(report.report.status, 'open');
  const moderationQueue = await administrator.listAdminReports({ status: 'open' });
  assert.equal(moderationQueue.reports.length, 1);
  assert.equal(moderationQueue.reports[0].id, report.report.id);
  assert.equal(moderationQueue.reports[0].editionId, latest.editionId);

  const creatorDisk = memoryIndexedDB();
  const creatorStore = createCreatorStore({ indexedDB: creatorDisk.indexedDB });
  const library = createCommunityLibrary({
    client: bob,
    creatorStore,
    stateStore: createMemoryCommunityStateStore(),
    downloadStore: createMemoryCommunityDownloadStore(),
    decodeImage,
  });
  const installed = await library.install(latest, { offline: false });
  assert.equal(installed.editionId, latest.editionId);
  assert.equal((await installedCreatorManifests(creatorStore)).length, 1);
  const installedStatus = await library.status(latest.editionId);
  assert.equal(installedStatus.offlinePlayable, true);
  assert.equal(installedStatus.creatorEditionId, installed.creatorEditionId);
  assert.equal(installedStatus.profileKey, creatorProfileKey(installed.creatorEditionId));

  const firstLoad = await loadInstalledCreatorBundle(creatorStore, installed.creatorEditionId, {
    decodeImage,
  });
  const firstRuntime = createCreatorRuntime(firstLoad, { decodeImage: decodeArtwork });
  const route = firstLoad.manifest.evidence.find(
    (entry) => entry.difficulty === 'standard' && entry.turnPolicy === 'immediate',
  );
  assert(route, 'published package retains its verified standard/immediate route');
  const commands = replayCommands(route.replay);
  const split = Math.floor(commands.length / 2);
  const firstAttempt = await firstRuntime.start({
    missionId: route.missionId,
    difficulty: route.difficulty,
    turnPolicy: route.turnPolicy,
  });
  for (const command of commands.slice(0, split)) firstRuntime.step(command);
  assert.equal(firstAttempt.run.status, 'running');
  const unfinished = firstRuntime.suspend();
  assert.equal(unfinished.editionId, installed.creatorEditionId);
  assert.equal(unfinished.session.replay.ticks, split);
  firstRuntime.dispose();

  await assert.rejects(bob.unlistEdition(latest.editionId), /not found/u);
  assert.equal((await alice.unlistEdition(latest.editionId)).status, 'unlisted');
  const resolution = await administrator.resolveAdminReport(
    report.report.id,
    'Confirmed creator removal; retain the report audit record.',
  );
  assert.equal(resolution.report.status, 'resolved');
  assert.deepEqual((await administrator.listAdminReports({ status: 'open' })).reports, []);
  assert.equal((await bob.catalog({ query: 'revised' })).editions.length, 0);
  assert.equal((await library.status(latest.editionId)).offlinePlayable, true);

  await app.close();
  appClosed = true;
  creatorStore.close();

  const offlineStore = createCreatorStore({ indexedDB: creatorDisk.indexedDB });
  t.after(() => offlineStore.close());
  const offlinePack = await loadInstalledCreatorBundle(offlineStore, installed.creatorEditionId, {
    decodeImage,
  });
  const offlineRuntime = createCreatorRuntime(offlinePack, { decodeImage: decodeArtwork });
  const restored = await offlineRuntime.restore(unfinished);
  assert.equal(restored.run.tick, split);
  for (const command of commands.slice(split)) offlineRuntime.step(command);
  assert.equal(restored.run.status, 'won');
  const receipt = await offlineRuntime.completion();
  assert.equal(receipt.missionId, route.missionId);
  assert.ok(receipt.gameplayId.startsWith(`${installed.creatorEditionId}:`));

  const progressDisk = managedIndexedDB();
  const profileKey = creatorProfileKey(installed.creatorEditionId);
  const profile = createJourneyProfileStore({
    backend: createJourneyBackend({ indexedDB: progressDisk.indexedDB, profileKey }),
  });
  await profile.load();
  profile.record(receipt);
  assert.equal(await profile.flush(), true);

  const reloadedProfile = createJourneyProfileStore({
    backend: createJourneyBackend({ indexedDB: progressDisk.indexedDB, profileKey }),
  });
  await reloadedProfile.load();
  assert.deepEqual(reloadedProfile.snapshot().clears.solo[receipt.missionId], {
    runId: receipt.runId,
    gameplayId: receipt.gameplayId,
    difficulty: receipt.difficulty,
  });
  const mission = offlinePack.manifest.content.project.missions.find(
    (entry) => entry.id === receipt.missionId,
  );
  assert(mission, 'the exact completed mission remains installed after reload');
  const earnedPicture = offlinePack.manifest.content.project.assets.find(
    (asset) => asset.id === mission.presentation.backgroundAssetId,
  );
  assert(earnedPicture, 'the exact completed mission retains its picture binding');
  assert(
    offlinePack.assets.some((asset) => asset.sha256 === earnedPicture.sha256),
    'the completed mission can resolve its exact earned picture entirely offline',
  );

  const offlineReplay = createCreatorRuntime(offlinePack, { decodeImage: decodeArtwork });
  const replayed = await offlineReplay.start({
    missionId: receipt.missionId,
    difficulty: receipt.difficulty,
    turnPolicy: route.turnPolicy,
  });
  offlineReplay.step(commands[0]);
  assert.equal(replayed.run.tick, 1);
  offlineReplay.dispose();
  offlineRuntime.dispose();
});
