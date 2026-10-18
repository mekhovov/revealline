import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CURRENT_ART_SOURCES } from '../presentation/current-art-sources.mjs';
import {
  findCurrentArtOriginal,
  readCurrentArtImage,
  CurrentArtUnavailableError,
} from '../presentation/current-art.mjs';

const source = CURRENT_ART_SOURCES.find(
  (row) => row.kind === 'embedded' && row.sourceImagePath && row.source.kind === 'built-in',
);
const baseURL = 'https://source.invalid/release/';
const file = (path) => readFile(new URL(`../../${path}`, import.meta.url));
const pin = { path: source.sourceImagePath, ...source.image };

test('registered image fallback lookup requires the exact original path, bytes and hash', () => {
  assert.equal(findCurrentArtOriginal(pin).id, source.id);
  for (const wrong of [
    { ...pin, path: '../original.png' },
    { ...pin, bytes: pin.bytes + 1 },
    { ...pin, sha256: '0'.repeat(64) },
    null,
  ])
    assert.equal(findCurrentArtOriginal(wrong), null);
});

test('byte reader prefers the original and never decodes or downloads its pack', async () => {
  const bytes = await file(pin.path),
    calls = [];
  const result = await readCurrentArtImage(source.id, {
    baseURL,
    fetch: async (url) => {
      calls.push(url);
      return new Response(bytes);
    },
    decodeImage: () => assert.fail('Original byte reading does not own a decoded image.'),
  });
  assert.deepEqual(Buffer.from(result.bytes), bytes);
  assert.equal(result.origin.kind, 'source-original');
  assert.deepEqual(calls, [new URL(pin.path, baseURL).href]);
});

test('native fallback returns the identical original bytes after a 404 or explicit retry', async () => {
  const bytes = await file(pin.path),
    pack = await file(source.source.path);
  for (const sourceOriginal of [true, false]) {
    const calls = [],
      downloads = [];
    const result = await readCurrentArtImage(source.id, {
      baseURL,
      sourceOriginal,
      fetch: async (url) => {
        calls.push(url);
        if (url === new URL(pin.path, baseURL).href) return new Response(null, { status: 404 });
        assert.equal(url, new URL(source.source.path, baseURL).href);
        return new Response(pack);
      },
      onBytes: (count) => downloads.push(count),
    });
    assert.deepEqual(Buffer.from(result.bytes), bytes);
    assert.deepEqual(result.descriptor.owner, source.owner);
    assert.equal(result.level.id, source.owner.levelId);
    assert.equal(calls.length, sourceOriginal ? 2 : 1);
    assert.deepEqual(downloads, [pack.length]);
  }
});

test('an unavailable, mismatched or cancelled original cannot silently become another source', async () => {
  const bytes = await file(pin.path);
  for (const fetch of [
    async () => new Response(null, { status: 503 }),
    async () => new Response(Buffer.concat([bytes, Buffer.from('x')])),
    async () => new Response(Buffer.alloc(bytes.length)),
  ]) {
    let calls = 0;
    await assert.rejects(
      readCurrentArtImage(source.id, {
        baseURL,
        fetch: (...args) => {
          calls++;
          return fetch(...args);
        },
      }),
    );
    assert.equal(calls, 1);
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    readCurrentArtImage(source.id, {
      signal: controller.signal,
      fetch: () => assert.fail('Cancelled read must not fetch.'),
    }),
    { name: 'AbortError' },
  );
  await assert.rejects(readCurrentArtImage('unknown'), /registered original/);
  await assert.rejects(
    readCurrentArtImage(source.id, {
      baseURL,
      sourceOriginal: false,
      fetch: async () => new Response(null, { status: 404 }),
    }),
    CurrentArtUnavailableError,
  );
});
