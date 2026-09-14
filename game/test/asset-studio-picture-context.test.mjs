import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pictureOwnerContext } from '../../authoring/asset-studio/picture-context.mjs';
import { CURRENT_ART_SOURCES } from '../presentation/current-art-sources.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { campaignKey } from '../library.mjs';

const bytes = new Uint8Array(
  await readFile(new URL('../content/packs/classic-lab.json', import.meta.url)),
);
const pack = JSON.parse(new TextDecoder().decode(bytes));
const campaign = pack.campaigns[0],
  level = campaign.levels[0],
  theme = pack.themes[0];
const descriptor = {
  id: 'picture.test.exact',
  kind: 'external',
  fit: 'contain',
  sampling: 'nearest',
  seed: 0,
  owner: {
    baseCampaignKey: campaignKey({
      ...campaign,
      classRecipes: pack.classRecipes.filter(
        (recipe) => !campaign.classIds || campaign.classIds.includes(recipe.id),
      ),
    }),
    levelId: level.id,
    levelRevision: level.revision,
    themeId: theme.id,
  },
  source: {
    pack: {
      path: 'optional/exact/pack.json',
      bytes: bytes.length,
      sha256: await hashPresentationBytes(bytes),
    },
  },
};
const options = (overrides = {}) => ({
  baseURL: 'https://game.test/release/',
  describe: () => descriptor,
  ...overrides,
});

test('registered local picture owners retain exact level, theme and fit without image downloads', async () => {
  const rows = CURRENT_ART_SOURCES.filter((row) => row.level && row.theme);
  assert.equal(rows.length, 107);
  for (const row of rows) {
    const context = await pictureOwnerContext(row.id, {
      fetch: () => assert.fail('Local metadata needs no request.'),
    });
    assert.deepEqual(context.level, row.level);
    assert.deepEqual(context.theme, row.theme);
    assert.equal(context.fit, row.fit);
    assert.equal(Object.isFrozen(context), true);
    assert.equal('image' in context, false, 'Metadata cannot replace the selected artwork.');
  }
  assert.equal(await pictureOwnerContext('picture.future.shared'), null);
});

test('external context reads only its authenticated lightweight owner pack, preserving contain fit', async () => {
  const calls = [];
  const context = await pictureOwnerContext(
    descriptor.id,
    options({
      fetch: async (url, init) => {
        calls.push(url);
        assert.equal(init.redirect, 'error');
        return new Response(bytes);
      },
    }),
  );
  assert.deepEqual(calls, ['https://game.test/release/optional/exact/pack.json']);
  assert.deepEqual(context.level, level);
  assert.deepEqual(context.theme, theme);
  assert.equal(context.fit, 'contain');
  assert.equal('image' in context, false);
});

test('unavailable, corrupt, oversized or mismatched owners never fall back to another board', async () => {
  await assert.rejects(
    pictureOwnerContext(
      descriptor.id,
      options({ fetch: async () => new Response('', { status: 404 }) }),
    ),
    /no substitute board/i,
  );
  const corrupt = bytes.slice();
  corrupt[100] ^= 1;
  await assert.rejects(
    pictureOwnerContext(descriptor.id, options({ fetch: async () => new Response(corrupt) })),
    /immutable source pin/,
  );
  await assert.rejects(
    pictureOwnerContext(
      descriptor.id,
      options({ fetch: async () => new Response(new Uint8Array(bytes.length + 1)) }),
    ),
    /byte budget/,
  );
  const wrong = structuredClone(descriptor);
  wrong.owner.levelRevision = 'unregistered';
  await assert.rejects(
    pictureOwnerContext(
      descriptor.id,
      options({ describe: () => wrong, fetch: async () => new Response(bytes) }),
    ),
    /owner level or theme differs/,
  );
});

test('cancelled metadata reads release their reader and do not complete a late preview', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const pending = pictureOwnerContext(
    descriptor.id,
    options({
      signal: controller.signal,
      fetch: async () =>
        new Response(
          new ReadableStream({
            start(stream) {
              stream.enqueue(bytes.subarray(0, 8));
            },
            cancel() {
              cancelled = true;
            },
          }),
        ),
    }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(cancelled, true);
});
