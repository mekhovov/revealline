import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleCreatorBatchProject,
  compareCreatorFileNames,
  parseCreatorBatchCheckpoint,
  planCreatorBatchPackages,
  prepareCreatorBatch,
  regenerateCreatorBatchItem,
  reopenCreatorBatchCheckpoint,
  reorderCreatorBatchItems,
  serializeCreatorBatchCheckpoint,
  setCreatorBatchCampaigns,
  setCreatorBatchItemExcluded,
} from '../creator/batch.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { verifyCreatorRoutes } from '../creator/templates.mjs';

const settings = {
  draftId: 'batch-draft',
  name: 'Holiday pictures',
  seed: 84721,
  fit: 'contain',
};
const input = (name, bytes, extra = {}) => ({
  name,
  blob: new Blob([Uint8Array.from(bytes)]),
  ...extra,
});
function fakePreparer({ failByte = -1, sizes = new Map(), activity } = {}) {
  return async (source, options) => {
    activity?.start();
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const originalBytes = new Uint8Array(await source.arrayBuffer());
      if (originalBytes[0] === failByte) throw new Error('This fixture cannot be decoded.');
      const originalHash = await creatorSHA256(originalBytes);
      const runtime = new Blob([
        new Uint8Array(sizes.get(originalBytes[0]) ?? 32).fill(originalBytes[0] ?? 1),
      ]);
      const runtimeHash = await creatorSHA256(await runtime.arrayBuffer());
      const thumbnail = new Blob([Uint8Array.of(originalBytes[0] ?? 1)]);
      return Object.freeze({
        asset: Object.freeze({
          format: 'AssetRevisionV1',
          id: 'creator-picture',
          revision: '1',
          kind: 'reveal-background',
          path: `content-design/assets/creator/${runtimeHash}.png`,
          sha256: runtimeHash,
          bytes: runtime.size,
          width: 1280,
          height: 640,
          alt: options.alt,
          review: 'candidate',
        }),
        runtime: Object.freeze({ blob: runtime, sha256: runtimeHash }),
        thumbnail: Object.freeze({ blob: thumbnail, sha256: '0'.repeat(64) }),
        original: Object.freeze({ blob: source, sha256: originalHash, mime: 'image/png' }),
        editing: Object.freeze({ fit: options.fit }),
      });
    } finally {
      activity?.end();
    }
  };
}

test('natural filename order is deterministic for 1, 12 and 50 item batches', async () => {
  assert.ok(compareCreatorFileNames('picture 2.png', 'picture 10.png') < 0);
  for (const count of [1, 12, 50]) {
    const files = Array.from({ length: count }, (_, index) =>
      input(`picture ${count - index}.png`, [index + 1]),
    );
    const checkpoints = [];
    const batch = await prepareCreatorBatch(files, settings, {
      prepareImage: fakePreparer(),
      onCheckpoint: (checkpoint) => checkpoints.push(checkpoint),
    });
    assert.equal(batch.items.length, count);
    assert.equal(checkpoints.length, count);
    assert.deepEqual(
      batch.items.map((item) => item.fileName),
      Array.from({ length: count }, (_, index) => `picture ${index + 1}.png`),
    );
    assert.equal(new Set(batch.items.map((item) => item.id)).size, count);
    assert.ok(batch.items.every((item) => item.status === 'ready'));
    assert.equal(assembleCreatorBatchProject(batch).project.missions.length, count);
  }
});

test('hash identities survive renamed sources and duplicate filenames remain distinct', async () => {
  const first = await prepareCreatorBatch(
    [input('same.png', [1, 2]), input('same.png', [2, 1])],
    settings,
    { prepareImage: fakePreparer() },
  );
  const renamed = await prepareCreatorBatch(
    [input('renamed-b.png', [1, 2]), input('renamed-a.png', [2, 1])],
    settings,
    { prepareImage: fakePreparer() },
  );
  assert.deepEqual(
    new Set(first.items.map((item) => item.id)),
    new Set(renamed.items.map((item) => item.id)),
  );
  assert.equal(new Set(first.items.map((item) => item.id)).size, 2);

  const duplicateBytes = await prepareCreatorBatch(
    [input('copy.png', [9]), input('copy.png', [9])],
    settings,
    { prepareImage: fakePreparer() },
  );
  assert.equal(new Set(duplicateBytes.items.map((item) => item.id)).size, 2);
  assert.equal(new Set(duplicateBytes.items.map((item) => item.sourceSha256)).size, 1);
});

test('failed items stay visible and require explicit exclusion before composition', async () => {
  let batch = await prepareCreatorBatch(
    [input('good.png', [1]), input('bad.png', [255]), input('also-good.png', [2])],
    settings,
    { prepareImage: fakePreparer({ failByte: 255 }) },
  );
  const failed = batch.items.find((item) => item.status === 'failed');
  assert.match(failed.error, /cannot be decoded/);
  await assert.rejects(async () => assembleCreatorBatchProject(batch), /Exclude each failed item/);
  batch = setCreatorBatchItemExcluded(batch, failed.id, true);
  const assembled = assembleCreatorBatchProject(batch);
  assert.equal(assembled.project.missions.length, 2);
  assert.equal(assembled.project.assets.length, 2);
  assert.equal(assembled.itemIds.includes(failed.id), false);
  assert.equal((await verifyCreatorRoutes(assembled.project, assembled.provenance[0])).length, 6);
});

test('processing and hashing stay sequential and cancellation stops before later items', async () => {
  let active = 0;
  let maximum = 0;
  const activity = {
    start() {
      active++;
      maximum = Math.max(maximum, active);
    },
    end() {
      active--;
    },
  };
  await prepareCreatorBatch(
    Array.from({ length: 12 }, (_, index) => input(`${index}.png`, [index + 1])),
    settings,
    { prepareImage: fakePreparer({ activity }) },
  );
  assert.equal(maximum, 1);
  assert.equal(active, 0);

  const controller = new AbortController();
  let calls = 0;
  let checkpoints = 0;
  const prepareImage = async (...args) => {
    calls++;
    const result = await fakePreparer()(...args);
    if (calls === 2) controller.abort();
    return result;
  };
  await assert.rejects(
    prepareCreatorBatch([input('1.png', [1]), input('2.png', [2]), input('3.png', [3])], settings, {
      signal: controller.signal,
      prepareImage,
      onCheckpoint: () => checkpoints++,
    }),
    { name: 'AbortError' },
  );
  assert.equal(calls, 2);
  assert.equal(checkpoints, 1);
});

test('checkpoint reopen preserves deterministic seeds, order, grouping and output', async () => {
  const files = [input('10.png', [10]), input('2.png', [2]), input('1.png', [1])];
  let batch = await prepareCreatorBatch(files, settings, { prepareImage: fakePreparer() });
  const order = batch.items.map((item) => item.id).reverse();
  batch = reorderCreatorBatchItems(batch, order);
  batch = setCreatorBatchCampaigns(batch, [
    { id: 'opening', name: 'Opening', itemIds: order.slice(0, 1) },
    { id: 'finale', name: 'Finale', itemIds: order.slice(1) },
  ]);
  batch = await regenerateCreatorBatchItem(batch, order[1], { prepareImage: fakePreparer() });
  const serialized = serializeCreatorBatchCheckpoint(batch);
  assert.deepEqual(parseCreatorBatchCheckpoint(serialized), JSON.parse(serialized));
  const reopened = await reopenCreatorBatchCheckpoint(
    serialized,
    files.map((file) => file.blob),
    { prepareImage: fakePreparer() },
  );
  assert.equal(serializeCreatorBatchCheckpoint(reopened), serialized);
  assert.deepEqual(
    assembleCreatorBatchProject(reopened).project,
    assembleCreatorBatchProject(batch).project,
  );
  assert.deepEqual(
    reopened.items.map((item) => item.generationSeed),
    batch.items.map((item) => item.generationSeed),
  );
});

test('package planning accounts for every item and reports splits and oversize items', async () => {
  const sizes = new Map([
    [1, 25],
    [2, 25],
    [3, 90],
  ]);
  let batch = await prepareCreatorBatch(
    [input('1.png', [1]), input('2.png', [2]), input('3.png', [3])],
    settings,
    { prepareImage: fakePreparer({ sizes }) },
  );
  let plan = planCreatorBatchPackages(batch, {
    maxBytes: 69,
    reserveBytes: 10,
    perItemOverheadBytes: 5,
  });
  assert.equal(plan.decision, 'cannot-fit');
  assert.equal(plan.packages.length, 2);
  assert.equal(plan.unassigned.length, 1);
  assert.deepEqual(
    new Set([
      ...plan.packages.flatMap((part) => part.itemIds),
      ...plan.unassigned.map((x) => x.itemId),
    ]),
    new Set(plan.eligibleItemIds),
  );

  const oversized = plan.unassigned[0].itemId;
  batch = setCreatorBatchItemExcluded(batch, oversized, true);
  plan = planCreatorBatchPackages(batch, {
    maxBytes: 69,
    reserveBytes: 10,
    perItemOverheadBytes: 5,
  });
  assert.equal(plan.decision, 'split-required');
  assert.equal(plan.packages.length, 2);
  assert.deepEqual(plan.excludedItemIds, [oversized]);
});

test('package planning never silently omits an unresolved selected item', async () => {
  const batch = await prepareCreatorBatch(
    [input('good.png', [1]), input('failed.png', [255])],
    settings,
    { prepareImage: fakePreparer({ failByte: 255 }) },
  );
  const plan = planCreatorBatchPackages(batch, {
    maxBytes: 100,
    reserveBytes: 10,
    perItemOverheadBytes: 5,
  });
  assert.equal(plan.decision, 'review-required');
  assert.deepEqual(plan.failedItemIds, [batch.items.find((item) => item.status === 'failed').id]);
  assert.deepEqual(plan.unassigned, [
    {
      itemId: plan.failedItemIds[0],
      requiredBytes: null,
      reason: 'item-not-ready',
    },
  ]);
  assert.deepEqual(
    new Set([
      ...plan.packages.flatMap((part) => part.itemIds),
      ...plan.unassigned.map((x) => x.itemId),
    ]),
    new Set(plan.selectedItemIds),
  );
});
