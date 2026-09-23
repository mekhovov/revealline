import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadReleaseAsset } from './release-asset.mjs';

const repository = 'mekhovov/revealline';
const version = 'v0.95.0';
const name = 'source-qualification.json';
const assetURL = 'https://api.github.com/repos/mekhovov/revealline/releases/assets/123';

function responses(bytes = Buffer.from('qualified')) {
  return [
    new Response(
      JSON.stringify({
        draft: false,
        prerelease: false,
        assets: [{ name, size: bytes.length, state: 'uploaded', url: assetURL }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
    new Response(bytes, { status: 200 }),
  ];
}

test('downloads the exact private release asset through authenticated API endpoints', async () => {
  const bytes = Buffer.from('qualified');
  const queue = responses(bytes);
  const calls = [];
  const actual = await downloadReleaseAsset({
    repository,
    version,
    name,
    token: 'secret',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return queue.shift();
    },
  });
  assert.deepEqual(actual, bytes);
  assert.deepEqual(
    calls.map(({ url, options }) => [url, options.headers.Accept, options.headers.Authorization]),
    [
      [
        'https://api.github.com/repos/mekhovov/revealline/releases/tags/v0.95.0',
        'application/vnd.github+json',
        'Bearer secret',
      ],
      [assetURL, 'application/octet-stream', 'Bearer secret'],
    ],
  );
});

test('refuses absent credentials, missing assets and changed asset sizes', async () => {
  await assert.rejects(
    downloadReleaseAsset({ repository, version, name, token: '', fetchImpl: async () => null }),
    /GH_TOKEN is required/,
  );
  await assert.rejects(
    downloadReleaseAsset({
      repository,
      version,
      name,
      token: 'secret',
      fetchImpl: async () =>
        new Response(JSON.stringify({ draft: false, prerelease: false, assets: [] }), {
          status: 200,
        }),
    }),
    /does not publish/,
  );
  const queue = responses(Buffer.from('qualified'));
  queue[0] = new Response(
    JSON.stringify({
      draft: false,
      prerelease: false,
      assets: [{ name, size: 10, state: 'uploaded', url: assetURL }],
    }),
    { status: 200 },
  );
  await assert.rejects(
    downloadReleaseAsset({
      repository,
      version,
      name,
      token: 'secret',
      fetchImpl: async () => queue.shift(),
    }),
    /size does not match/,
  );
});
