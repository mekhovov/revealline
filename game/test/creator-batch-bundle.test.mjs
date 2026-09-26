import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assembleCreatorBatchPackage,
  assembleCreatorBatchProject,
  planCreatorBatchPackages,
  prepareCreatorBatch,
  reorderCreatorBatchItems,
  setCreatorBatchCampaigns,
} from '../creator/batch.mjs';
import { creatorBatchBundleInput, prepareCreatorBatchBundle } from '../creator/batch-bundle.mjs';
import {
  approveCreatorBundle,
  exportCreatorBundle,
  importCreatorBundle,
  prepareCreatorBundle,
} from '../creator/bundle.mjs';
import { prepareReviewedCreatorBundle } from '../creator/batch-bundle.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import {
  createCreatorStore,
  installPreparedCreatorBundle,
  installedCreatorManifests,
  loadInstalledCreatorBundle,
  reviewCreatorInstallation,
} from '../creator/installed.mjs';
import {
  createCreatorRuntime,
  creatorAttemptKey,
  creatorCampaignDestination,
  creatorEarnedMissionId,
  creatorProfileKey,
} from '../creator/runtime.mjs';
import { createJourneyBackend, createJourneyProfileStore } from '../journey/profile.mjs';
import {
  exportCreatorSource,
  importCreatorSource,
  prepareCreatorSource,
} from '../creator/drafts.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';

const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const decodeArtwork = async (dataUrl) => {
  const image = new PNGImage();
  image.src = dataUrl;
  await image.decode();
  return image;
};
const settings = {
  draftId: 'batch-bundle',
  name: 'Batch bundle',
  seed: 119,
  fit: 'contain',
};
const source = (index) => ({
  name: `picture ${index + 1}.png`,
  blob: new Blob([Uint8Array.of(index + 1)]),
});
const runtimeBlob = new Blob([pngBytes()], { type: 'image/png' });
const runtimeSha256 = await creatorSHA256(await runtimeBlob.arrayBuffer());
const prepareImage = async (blob, options) => ({
  asset: {
    format: 'AssetRevisionV1',
    id: 'creator-picture',
    revision: '1',
    kind: 'reveal-background',
    path: `content-design/assets/creator/${runtimeSha256}.png`,
    sha256: runtimeSha256,
    bytes: runtimeBlob.size,
    width: 1,
    height: 1,
    alt: options.alt,
    review: 'candidate',
  },
  runtime: { blob: runtimeBlob, sha256: runtimeSha256 },
  thumbnail: { blob: runtimeBlob, sha256: runtimeSha256 },
  original: {
    blob,
    sha256: await creatorSHA256(await blob.arrayBuffer()),
    mime: 'image/png',
  },
  editing: { fit: options.fit },
});
const credits = {
  creator: 'Batch fixture creator',
  picture: 'Owned batch fixture pictures',
  license: 'Permission to share granted by fixture author',
};

async function batchFixture(count) {
  return prepareCreatorBatch(
    Array.from({ length: count }, (_, index) => source(index)),
    settings,
    {
      prepareImage,
    },
  );
}

function contentAndAssets(batch) {
  const assembled = assembleCreatorBatchProject(batch);
  return {
    content: {
      project: assembled.project,
      packId: assembled.packId,
      themes,
      provenance: assembled.provenance,
      credits,
    },
    assets: [{ sha256: runtimeSha256, blob: runtimeBlob }],
  };
}

async function preparedBatch(count) {
  const batch = await batchFixture(count);
  const result = await prepareCreatorBatchBundle(batch, { themes, credits }, { decodeImage });
  return {
    batch,
    pack: result.prepared,
  };
}

function rewriteManifest(file, mutate) {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    const length = new DataView(bytes.buffer).getUint32(8, false);
    const manifest = JSON.parse(new TextDecoder().decode(bytes.slice(12, 12 + length)));
    mutate(manifest);
    const encoded = new TextEncoder().encode(JSON.stringify(manifest));
    const header = bytes.slice(0, 12);
    new DataView(header.buffer).setUint32(8, encoded.length, false);
    return new Blob([header, encoded, bytes.slice(12 + length)]);
  });
}

test('1, 12 and 50 mission projects prepare with exact dependency closure and legacy single shape', async () => {
  for (const count of [1, 12, 50]) {
    const { pack } = await preparedBatch(count);
    assert.equal(pack.review.missions, count);
    assert.equal(pack.manifest.content.project.missions.length, count);
    assert.equal(pack.manifest.assets.length, 1); // Identical bytes are stored once by SHA-256.
    if (count === 1) {
      assert.equal(Array.isArray(pack.manifest.content.provenance), false);
      assert.equal(pack.manifest.evidence.length, 6);
    } else {
      assert.equal(pack.manifest.content.provenance.length, count);
      assert.equal(pack.manifest.evidence.length, count);
      assert.ok(pack.manifest.evidence.every((entry) => entry.routes.length === 6));
    }
    const file = exportCreatorBundle(pack, approveCreatorBundle(pack));
    assert.equal(file.size, pack.bytes);
    if (count < 50) {
      const restored = await importCreatorBundle(file, { decodeImage });
      assert.equal(restored.editionId, pack.editionId);
      assert.deepEqual(restored.manifest, pack.manifest);
    }
  }
});

test('duplicate names and bytes survive explicit split export without duplicate payloads', async () => {
  const duplicate = new Blob([Uint8Array.of(7, 7, 7)]),
    inputs = [
      { name: 'same.png', blob: duplicate },
      { name: 'same.png', blob: duplicate },
      { name: 'same.png', blob: duplicate },
      { name: 'same.png', blob: duplicate },
    ],
    batch = await prepareCreatorBatch(inputs, settings, { prepareImage }),
    plan = planCreatorBatchPackages(batch, {
      maxBytes: runtimeBlob.size * 2 + 21,
      reserveBytes: 1,
      perItemOverheadBytes: 10,
    });
  assert.equal(plan.decision, 'split-required');
  assert.deepEqual(
    batch.items.map((item) => item.fileName),
    ['same.png', 'same.png', 'same.png', 'same.png'],
  );
  assert.equal(new Set(batch.items.map((item) => item.id)).size, 4);
  assert.equal(new Set(batch.items.map((item) => item.sourceSha256)).size, 1);

  const exportedItemIds = [];
  for (const entry of plan.packages) {
    const result = await prepareCreatorBatchBundle(
        batch,
        { themes, credits, plan, part: entry.part },
        { decodeImage },
      ),
      file = exportCreatorBundle(result.prepared, approveCreatorBundle(result.prepared)),
      reopened = await importCreatorBundle(file, { decodeImage });
    assert.equal(reopened.editionId, result.prepared.editionId);
    assert.equal(reopened.manifest.assets.length, 1, 'same runtime bytes occur once per pack');
    assert.deepEqual(
      reopened.manifest.content.project.missions.map((mission) => mission.id),
      entry.itemIds,
    );
    exportedItemIds.push(...entry.itemIds);
  }
  assert.deepEqual(exportedItemIds, plan.eligibleItemIds);
});

test('campaign grouping and authored order survive transfer and drive runtime continuation order', async () => {
  let batch = await batchFixture(4);
  const order = batch.items.map((item) => item.id).reverse();
  batch = reorderCreatorBatchItems(batch, order);
  batch = setCreatorBatchCampaigns(batch, [
    { id: 'opening', name: 'Opening', itemIds: order.slice(0, 2) },
    { id: 'finale', name: 'Finale', itemIds: order.slice(2) },
  ]);
  const fixture = contentAndAssets(batch);
  const pack = await prepareCreatorBundle(fixture.content, fixture.assets, { decodeImage });
  const restored = await importCreatorBundle(
    exportCreatorBundle(pack, approveCreatorBundle(pack)),
    { decodeImage },
  );
  assert.deepEqual(restored.manifest.content.project.packs[0].campaignIds, ['opening', 'finale']);
  assert.deepEqual(
    restored.manifest.content.project.campaigns.flatMap((campaign) => campaign.missionIds),
    order,
  );
  const runtime = createCreatorRuntime(restored, { decodeImage: decodeArtwork });
  assert.deepEqual(runtime.missionOrder, order);
  assert.equal(runtime.nextMissionId(order[0]), order[1]);
  assert.equal(runtime.nextMissionId(order.at(-1)), null);
  assert.equal((await runtime.start({ missionId: order[0] })).manifest.missionId, order[0]);
  assert.equal((await runtime.start({ missionId: order[1] })).manifest.missionId, order[1]);
  runtime.dispose();
});

test('Custom campaign reload continues at the first uncleared mission and retains its latest reward', async () => {
  const order = Array.from({ length: 12 }, (_, index) => `picture-${index + 1}`),
    database = managedIndexedDB(),
    profileKey = `custom-${'a'.repeat(64)}`,
    backend = createJourneyBackend({ indexedDB: database.indexedDB, profileKey }),
    original = createJourneyProfileStore({ profileKey, backend });
  await original.load();
  for (const [index, missionId] of order.slice(0, 2).entries())
    original.record({
      type: 'complete',
      mode: 'solo',
      missionId,
      runId: `clear-${index + 1}`,
      gameplayId: `gameplay-${index + 1}`,
      difficulty: 'standard',
    });
  assert.equal(await original.flush(), true);
  const reopened = createJourneyProfileStore({
    profileKey,
    backend: createJourneyBackend({ indexedDB: database.indexedDB, profileKey }),
  });
  await reopened.load();
  const progress = reopened.snapshot();
  assert.equal(progress.cursors.solo, null, 'older creator clears may have no saved cursor');
  assert.deepEqual(creatorCampaignDestination(order, progress), {
    missionId: order[2],
    complete: false,
    explicit: false,
  });
  assert.equal(creatorEarnedMissionId(order, progress), order[1]);

  reopened.record({ type: 'select', mode: 'solo', missionId: order[4] });
  assert.equal(creatorCampaignDestination(order, reopened.snapshot()).missionId, order[4]);
  assert.equal(
    creatorCampaignDestination(order, progress, { missionId: order[8] }).missionId,
    order[8],
    'an exact mission-library choice wins over continuation',
  );
  assert.throws(
    () => creatorCampaignDestination(order, progress, { missionId: 'outside-edition' }),
    /installed edition/,
  );

  progress.cursors.solo = order[1];
  for (const missionId of order)
    progress.clears.solo[missionId] = {
      runId: `complete-${missionId}`,
      gameplayId: `gameplay-${missionId}`,
      difficulty: 'standard',
    };
  assert.deepEqual(creatorCampaignDestination(order, progress), {
    missionId: order.at(-1),
    complete: true,
    explicit: false,
  });
  assert.equal(creatorEarnedMissionId(order, progress), order[1]);
});

test('middle-mission recovery keeps its exact reward and cannot migrate to a changed edition', async () => {
  const pictureSources = await Promise.all(
      [
        'fixtures/motion-background/static-default.png',
        '../assets/field-kit/sprites/enemy-bouncer.png',
      ].map((path) => readFile(new URL(path, import.meta.url))),
    ),
    dimensions = (blob) =>
      blob.arrayBuffer().then((buffer) => {
        const view = new DataView(buffer);
        return { naturalWidth: view.getUint32(16), naturalHeight: view.getUint32(20) };
      }),
    exactImage = async (sourceBlob, options) => {
      const original = new Blob([await sourceBlob.arrayBuffer()], { type: 'image/png' }),
        sha256 = await creatorSHA256(await original.arrayBuffer()),
        { naturalWidth: width, naturalHeight: height } = await dimensions(original);
      return {
        asset: {
          format: 'AssetRevisionV1',
          id: 'creator-picture',
          revision: '1',
          kind: 'reveal-background',
          path: `content-design/assets/creator/${sha256}.png`,
          sha256,
          bytes: original.size,
          width,
          height,
          alt: options.alt,
          review: 'candidate',
        },
        runtime: { blob: original, sha256 },
        thumbnail: { blob: original, sha256 },
        original: { blob: original, sha256, mime: 'image/png' },
        editing: { fit: options.fit },
      };
    },
    batch = await prepareCreatorBatch(
      pictureSources.map((bytes, index) => ({
        name: `distinct-${index + 1}.png`,
        blob: new Blob([bytes], { type: 'image/png' }),
      })),
      { ...settings, draftId: 'middle-recovery' },
      { prepareImage: exactImage },
    ),
    prepared = await prepareCreatorBatchBundle(
      batch,
      { themes, credits },
      { decodeImage: dimensions },
    ),
    pack = prepared.prepared,
    missionIds = pack.manifest.content.project.campaigns.flatMap((campaign) => campaign.missionIds),
    middleMissionId = missionIds[1],
    route = pack.manifest.evidence
      .find(({ missionId }) => missionId === middleMissionId)
      .routes.find(
        ({ difficulty, turnPolicy }) => difficulty === 'standard' && turnPolicy === 'immediate',
      );
  assert.equal(route.replay.segments.length, 1, 'the fixture needs one resumable route segment');

  const first = createCreatorRuntime(pack, { decodeImage: decodeArtwork }),
    attempt = await first.start({ missionId: middleMissionId }),
    command = route.replay.segments[0].input,
    recoveryTick = Math.min(30, route.replay.segments[0].ticks - 1);
  for (let tick = 0; tick < recoveryTick; tick++) first.step(command);
  const saved = first.suspend(),
    restoredRuntime = createCreatorRuntime(pack, { decodeImage: decodeArtwork }),
    restored = await restoredRuntime.restore(JSON.stringify(saved));
  assert.equal(restored.manifest.missionId, middleMissionId);
  assert.equal(restored.run.tick, attempt.run.tick);
  for (let tick = recoveryTick; tick < route.replay.segments[0].ticks; tick++)
    restoredRuntime.step(command);
  assert.equal(restored.run.status, 'won');
  const receipt = await restoredRuntime.completion(),
    middleMission = pack.manifest.content.project.missions.find(({ id }) => id === middleMissionId),
    firstMission = pack.manifest.content.project.missions.find(({ id }) => id === missionIds[0]),
    middlePicture = pack.manifest.content.project.assets.find(
      ({ id }) => id === middleMission.presentation.backgroundAssetId,
    ),
    firstPicture = pack.manifest.content.project.assets.find(
      ({ id }) => id === firstMission.presentation.backgroundAssetId,
    );
  assert.equal(receipt.missionId, middleMissionId);
  assert.notEqual(middlePicture.sha256, firstPicture.sha256);
  assert.equal(
    pack.assets.find(({ sha256 }) => sha256 === middlePicture.sha256).blob.size,
    middlePicture.bytes,
  );

  const changedBatch = reorderCreatorBatchItems(
      batch,
      [...batch.items].reverse().map(({ id }) => id),
    ),
    changed = (
      await prepareCreatorBatchBundle(
        changedBatch,
        { themes, credits },
        { decodeImage: dimensions },
      )
    ).prepared;
  assert.notEqual(changed.editionId, pack.editionId);
  assert.notEqual(creatorAttemptKey(changed.editionId), creatorAttemptKey(pack.editionId));
  const changedRuntime = createCreatorRuntime(changed, { decodeImage: decodeArtwork });
  await assert.rejects(
    changedRuntime.restore(JSON.stringify(saved)),
    /different installed edition/,
  );

  const database = managedIndexedDB(),
    originalProfile = createJourneyProfileStore({
      profileKey: creatorProfileKey(pack.editionId),
      backend: createJourneyBackend({
        indexedDB: database.indexedDB,
        profileKey: creatorProfileKey(pack.editionId),
      }),
    });
  await originalProfile.load();
  originalProfile.record(receipt);
  assert.equal(await originalProfile.flush(), true);
  const changedProfile = createJourneyProfileStore({
    profileKey: creatorProfileKey(changed.editionId),
    backend: createJourneyBackend({
      indexedDB: database.indexedDB,
      profileKey: creatorProfileKey(changed.editionId),
    }),
  });
  await changedProfile.load();
  assert.deepEqual(changedProfile.snapshot().clears.solo, {});
  assert.equal(originalProfile.snapshot().clears.solo[middleMissionId].runId, receipt.runId);
  first.dispose();
  restoredRuntime.dispose();
  changedRuntime.dispose();
});

test('missing, corrupt and unrelated media cannot enter a batch bundle', async () => {
  const batch = await batchFixture(3);
  const fixture = contentAndAssets(batch);
  await assert.rejects(prepareCreatorBundle(fixture.content, [], { decodeImage }), /missing/);
  await assert.rejects(
    prepareCreatorBundle(
      fixture.content,
      [
        {
          sha256: runtimeSha256,
          blob: new Blob([pngBytes().map((byte, index) => (index ? byte : byte ^ 1))]),
        },
      ],
      { decodeImage },
    ),
    /PNG|bytes differ/,
  );
  const pack = await prepareCreatorBundle(
    fixture.content,
    [...fixture.assets, { sha256: 'a'.repeat(64), blob: new Blob(['private original']) }],
    { decodeImage },
  );
  const file = exportCreatorBundle(pack, approveCreatorBundle(pack));
  assert.equal((await file.text()).includes('private original'), false);
});

test('forged mission-scoped evidence and stale approvals fail closed', async () => {
  const { pack } = await preparedBatch(3);
  const approval = approveCreatorBundle(pack);
  assert.throws(() => exportCreatorBundle({ ...pack }, approval), /stale/);
  const file = exportCreatorBundle(pack, approval);
  const forged = await rewriteManifest(file, (manifest) => {
    manifest.evidence[1].routes[0].missionId = manifest.evidence[0].missionId;
  });
  await assert.rejects(importCreatorBundle(forged, { decodeImage }), /evidence|identity/);
  const controller = new AbortController();
  controller.abort();
  const { compatibility: _compatibility, ...content } = pack.manifest.content;
  await assert.rejects(
    prepareCreatorBundle(content, pack.assets, { signal: controller.signal, decodeImage }),
    { name: 'AbortError' },
  );
});

test('immutable batch editions install together and source backup roundtrips every runtime picture', async () => {
  const first = await preparedBatch(3);
  const secondBatch = await prepareCreatorBatch(
    [source(0), source(1), { ...source(2), title: 'Changed title' }],
    settings,
    { prepareImage },
  );
  const nextFixture = contentAndAssets(secondBatch);
  const second = await prepareCreatorBundle(nextFixture.content, nextFixture.assets, {
    decodeImage,
  });
  assert.notEqual(first.pack.editionId, second.editionId);

  const memory = memoryIndexedDB();
  const store = createCreatorStore({ indexedDB: memory.indexedDB });
  for (const pack of [first.pack, second]) {
    const approval = approveCreatorBundle(pack);
    await installPreparedCreatorBundle(
      store,
      pack,
      approval,
      await reviewCreatorInstallation(store, pack, approval),
      { decodeImage },
    );
  }
  assert.deepEqual(
    new Set((await installedCreatorManifests(store)).map((manifest) => manifest.editionId)),
    new Set([first.pack.editionId, second.editionId]),
  );
  const reopenedPack = await loadInstalledCreatorBundle(store, first.pack.editionId, {
    decodeImage,
  });
  assert.equal(reopenedPack.editionId, first.pack.editionId);

  const { compatibility: _compatibility, ...content } = reopenedPack.manifest.content;
  const originals = [new Blob(['first private original']), new Blob(['second private original'])];
  const originalAssets = await Promise.all(
    originals.map(async (blob) => ({
      sha256: await creatorSHA256(await blob.arrayBuffer()),
      blob,
    })),
  );
  const sourceBackup = await prepareCreatorSource(
    {
      draftId: 'batch-source',
      content,
      editing: { fit: 'contain' },
      originalSha256: originalAssets.map((asset) => asset.sha256),
    },
    [...reopenedPack.assets, ...originalAssets],
  );
  const restored = await importCreatorSource(exportCreatorSource(sourceBackup));
  assert.deepEqual(restored.document, sourceBackup.document);
  assert.equal(restored.document.content.project.missions.length, 3);
  assert.equal(restored.assets.length, 3);
  assert.deepEqual(
    new Set(await Promise.all(restored.assets.map((asset) => asset.blob.text()))),
    new Set([await runtimeBlob.text(), 'first private original', 'second private original']),
  );
  store.close();
});

test('reviewed split parts contain exact mission, campaign, provenance and media closure', async () => {
  const batch = await batchFixture(5);
  const plan = planCreatorBatchPackages(batch, {
    maxBytes: runtimeBlob.size * 2 + 21,
    reserveBytes: 1,
    perItemOverheadBytes: 10,
  });
  assert.equal(plan.decision, 'split-required');
  assert.ok(plan.packages.length > 1);
  const all = [];
  for (const entry of plan.packages) {
    const part = assembleCreatorBatchPackage(batch, plan, entry.part);
    assert.deepEqual(part.itemIds, entry.itemIds);
    assert.deepEqual(
      part.project.campaigns.flatMap((campaign) => campaign.missionIds),
      entry.itemIds,
    );
    assert.deepEqual(
      part.provenance.map((provenance) => provenance.missionId),
      entry.itemIds,
    );
    assert.equal(part.assets.length, 1);
    const input = creatorBatchBundleInput(batch, {
      themes,
      credits,
      plan,
      part: entry.part,
    });
    assert.deepEqual(input.assets, part.assets);
    const pack = (
      await prepareCreatorBatchBundle(
        batch,
        { themes, credits, plan, part: entry.part },
        { decodeImage },
      )
    ).prepared;
    assert.equal(pack.review.missions, entry.itemIds.length);
    all.push(...entry.itemIds);
  }
  assert.deepEqual(all, plan.eligibleItemIds);

  const staleBatch = reorderCreatorBatchItems(
    batch,
    [...batch.items].reverse().map((item) => item.id),
  );
  assert.throws(() => assembleCreatorBatchPackage(staleBatch, plan, 1), /Recalculate/);
});

test('review-card preparations combine without unrelated media and retain private source originals', async () => {
  const reviewed = [];
  for (let index = 0; index < 3; index++) {
    const itemBatch = await prepareCreatorBatch(
      [source(index)],
      {
        ...settings,
        draftId: `review-item-${index + 1}`,
        seed: settings.seed + index,
      },
      { prepareImage },
    );
    const item = itemBatch.items[0];
    const assembled = assembleCreatorBatchProject(itemBatch);
    const prepared = await prepareCreatorBundle(
      {
        project: assembled.project,
        packId: assembled.packId,
        themes,
        provenance: assembled.provenance[0],
        credits,
      },
      [{ sha256: item.image.runtime.sha256, blob: item.image.runtime.blob }],
      { decodeImage },
    );
    reviewed.push({ result: { prepared, image: item.image } });
  }
  const result = await prepareReviewedCreatorBundle(
    reviewed.reverse(),
    {
      draftId: 'reviewed-batch',
      collectionName: 'Reviewed cards',
      creatorCredit: credits.creator,
      pictureCredit: credits.picture,
      license: credits.license,
    },
    { decodeImage },
  );
  assert.equal(result.prepared.review.missions, 3);
  assert.deepEqual(
    result.prepared.manifest.content.project.campaigns[0].missionIds,
    reviewed.map(({ result: { prepared } }) => prepared.manifest.content.provenance.missionId),
  );
  assert.equal(result.prepared.assets.length, 1, 'identical runtime bytes are stored once');
  assert.equal(result.originalSha256.length, 3);
  assert.equal(result.sourceAssets.length, 4, 'source closure is one runtime plus three originals');
  assert.equal(
    result.sourceAssets.some((asset) => asset.sha256 === 'a'.repeat(64)),
    false,
    'unrelated browser media is not included',
  );
});
