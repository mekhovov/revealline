import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDownloadMetadata } from '../download-initialization.mjs';

const buildId = 'a'.repeat(64);
const catalogue = {
  format: 'revealline-offline-content.v2',
  version: '1',
  groups: [{ id: 'base', kind: 'gameplay', requires: [], files: [] }],
  files: [],
};
const core = { buildId, files: [{ path: 'game/index.html', bytes: 1, sha256: 'b'.repeat(64) }] };
const options = { baseURL: 'https://example.test/game/', buildId };

test('metadata loads as one validated pair; updates bypass the HTTP cache', async () => {
  const calls = [];
  const result = await loadDownloadMetadata({
    ...options,
    updating: true,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return Response.json(url.pathname.endsWith('offline-content.json') ? catalogue : core);
    },
  });
  assert.deepEqual(result, { catalogue, core });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ init }) => init.cache === 'no-store' && init.signal));
});

test('a failed load can be retried without partial metadata or storage mutations', async () => {
  let fail = true;
  const fetch = async (url) => {
    if (fail && url.pathname.endsWith('offline-cache.json'))
      return new Response('', { status: 503 });
    return Response.json(url.pathname.endsWith('offline-content.json') ? catalogue : core);
  };
  await assert.rejects(loadDownloadMetadata({ ...options, fetch }), {
    localization: { key: 'interface:downloads.catalogueMissing' },
  });
  fail = false;
  assert.deepEqual(await loadDownloadMetadata({ ...options, fetch }), { catalogue, core });
});

test('a different build is rejected before download consent', async () => {
  await assert.rejects(
    loadDownloadMetadata({
      ...options,
      fetch: async (url) =>
        Response.json(
          url.pathname.endsWith('offline-content.json')
            ? catalogue
            : { ...core, buildId: 'c'.repeat(64) },
        ),
    }),
    { localization: { key: 'interface:downloads.publishedBuildChanged' } },
  );
});

test('timeout covers stalled response bodies even when the transport ignores abort', async () => {
  const signals = [];
  await assert.rejects(
    loadDownloadMetadata({
      ...options,
      timeoutMs: 10,
      fetch: async (_, { signal }) => {
        signals.push(signal);
        return { ok: true, json: () => new Promise(() => {}) };
      },
    }),
    { localization: { key: 'interface:downloads.loadingTimedOut' } },
  );
  assert.ok(signals.every((signal) => signal.aborted));
});
