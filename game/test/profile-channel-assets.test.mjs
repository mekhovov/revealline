import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileChannelAssets } from '../profile-channel-assets.mjs';
import { recoveryChannel } from '../profile-channel.mjs';
import { profileAssetFixture } from './helpers/profile-channel-idb.mjs';

const channel = recoveryChannel('release-v0.39.0', 'v0.40.0');
test('no-upgrade reader preserves absent, stored null, stored undefined and ordinary values', async () => {
  const f = await profileAssetFixture([
    [channel.packsKey, null],
    [channel.indexKey, undefined],
    [channel.externalJournalKey, { pending: true }],
  ]);
  const reader = createProfileChannelAssets(f);
  const result = await reader.snapshot(channel);
  assert.deepEqual(result.value, {
    packs: { present: true, value: null },
    index: { present: true, value: undefined },
    backup: { present: false, value: undefined },
    external: { present: true, value: { pending: true } },
  });
  assert.deepEqual(f.model.contents(), f.before);
  assert.deepEqual(f.model.allPuts, []);
  assert(
    f.opens.every(
      (open) => open.name === 'revealline-assets-v1' && open.requestedVersion === undefined,
    ),
  );
  assert.equal(f.reads.filter(([kind]) => kind === 'count').length, 4);
  reader.close();
});
test('missing database creation is aborted and newer schema is preserved and refused', async () => {
  const missing = await profileAssetFixture([], { absent: true });
  const reader = createProfileChannelAssets(missing);
  assert.deepEqual(await reader.keys(), { state: 'absent' });
  assert.deepEqual(missing.model.contents(), new Map());
  reader.close();
  const newer = await profileAssetFixture([], { version: 2 });
  const other = createProfileChannelAssets(newer);
  await assert.rejects(other.snapshot(channel), /unsupported/);
  assert.deepEqual(newer.model.contents(), newer.before);
  assert.deepEqual(newer.model.allPuts, []);
  other.close();
});
test('a close at the resolved-absence boundary refuses stale absence', async () => {
  const f = await profileAssetFixture([], { absent: true });
  const reader = createProfileChannelAssets(f);
  f.controls.beforeError = () => queueMicrotask(() => reader.close());
  await assert.rejects(reader.keys(), /closed/);
  assert.deepEqual(f.model.contents(), new Map());
});
test('cancelled late successful opens close their connection without reading', async () => {
  const f = await profileAssetFixture();
  f.controls.holdSuccess = true;
  const reader = createProfileChannelAssets(f),
    controller = new AbortController();
  const promise = reader.keys({ signal: controller.signal });
  const rejected = assert.rejects(promise, { name: 'AbortError' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(typeof f.controls.release, 'function');
  const before = f.model.closed;
  controller.abort();
  await rejected;
  f.controls.release();
  assert.equal(f.model.closed, before + 1);
  assert.deepEqual(f.reads, []);
  reader.close();
});
test('key enumeration requests an explicit finite bound and rejects overflow', async () => {
  const f = await profileAssetFixture([
    ['one', null],
    ['two', null],
  ]);
  const reader = createProfileChannelAssets(f);
  await assert.rejects(reader.keys({ limit: 1 }), /Too many/);
  assert.deepEqual(f.reads, [['keys', undefined, 2]]);
  assert.deepEqual(f.model.contents(), f.before);
  reader.close();
});
