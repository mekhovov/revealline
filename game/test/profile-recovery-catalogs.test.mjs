import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  RECOVERY_CATALOG_PIN,
  parseRecoveryCatalogs,
  loadProfileRecoveryCatalogs,
} from '../profile-recovery-catalogs.mjs';
import { createProfileChannelReader } from '../profile-channel-reader.mjs';

const raw = new Uint8Array(
  await readFile(new URL('../content/recovery-catalogs.json', import.meta.url)),
);
test('reviewed source registries preserve six exact aliases and full distinct descriptor cohorts', async () => {
  const rows = await parseRecoveryCatalogs(raw, 'v0.42.0');
  assert.deepEqual(
    rows.map((row) => row.channelId),
    [
      'release-v0.39.0',
      'release-0.39.0',
      'release-v0.40.0',
      'release-0.40.0',
      'release-v0.41.0',
      'release-0.41.0',
    ],
  );
  assert.deepEqual(
    rows.map((row) => row.knownDescriptors.length),
    [12, 12, 12, 12, 16, 16],
  );
  assert.deepEqual(rows[4].knownDescriptors.slice(0, 12), rows[0].knownDescriptors);
  assert.deepEqual(rows[0].registeredEntries, rows[4].registeredEntries);
  assert.equal(Object.isFrozen(rows[0].registeredEntries[0].campaign), true);
  let storageCalls = 0;
  const reader = createProfileChannelReader({
    currentVersion: '0.42.0',
    recoveryCatalogs: rows,
    storage: {
      get length() {
        storageCalls++;
        throw Error('No discovery');
      },
    },
    indexedDB: {
      open() {
        storageCalls++;
        throw Error('No DB');
      },
    },
    lockManager: {},
  });
  await reader.close();
  assert.equal(storageCalls, 0);
});
test('built-version gates exclude future channels without inventing dev, earlier or normalized aliases', async () => {
  assert.deepEqual(
    (await parseRecoveryCatalogs(raw, 'v0.39.0')).map((row) => row.channelId),
    ['release-v0.39.0', 'release-0.39.0'],
  );
  assert.equal((await parseRecoveryCatalogs(raw, '0.40.0')).length, 4);
  assert.deepEqual(await parseRecoveryCatalogs(raw, '0.38.0'), []);
  await assert.rejects(parseRecoveryCatalogs(raw, 'DEV'));
});
test('same-length changed descriptor or source label and oversized/truncated inputs cannot grant registry authority', async () => {
  for (const changed of [raw.slice(1), new Uint8Array(raw.length + 1), new Uint8Array(raw)]) {
    if (changed.length === raw.length) changed[changed.length - 30] ^= 1;
    await assert.rejects(parseRecoveryCatalogs(changed, '0.42.0'), /reviewed identity/);
  }
  assert.equal(raw.length, RECOVERY_CATALOG_PIN.bytes);
});
test('loader requests only its packaged URL and refuses HTTP, oversize and corrupted payloads', async () => {
  const calls = [];
  const rows = await loadProfileRecoveryCatalogs('0.40.0', {
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(raw);
    },
  });
  assert.equal(rows.length, 4);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, new URL('../content/recovery-catalogs.json', import.meta.url).href);
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.cache, 'no-store');
  for (const response of [
    new Response('missing', { status: 404 }),
    new Response(new Uint8Array(raw.length + 1)),
    new Response(raw.slice(1)),
  ])
    await assert.rejects(loadProfileRecoveryCatalogs('0.40.0', { fetch: async () => response }));
});
test('cancelled delayed catalog fetch settles promptly and cancels the later response body', async () => {
  const controller = new AbortController();
  let finish,
    cancelled = 0;
  const promise = loadProfileRecoveryCatalogs('0.40.0', {
    signal: controller.signal,
    fetch: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(promise, /abort/i);
  finish(
    new Response(
      new ReadableStream({
        cancel() {
          cancelled++;
        },
      }),
    ),
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cancelled, 1);
});

test('caller mutation while the real digest is pending cannot change parsed trusted data', async (t) => {
  const originalDigest = globalThis.crypto.subtle.digest;
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  t.mock.method(globalThis.crypto.subtle, 'digest', function (...args) {
    const digest = originalDigest.apply(this, args);
    return digest.then(async (result) => {
      await held;
      return result;
    });
  });
  const caller = new Uint8Array(raw);
  const expected = JSON.parse(new TextDecoder().decode(raw)).catalogs[0].registeredEntries[0]
    .campaign;
  const result = parseRecoveryCatalogs(caller, '0.40.0');
  await new Promise((resolve) => setImmediate(resolve));
  const text = new TextDecoder().decode(caller);
  const title = JSON.stringify(expected.title);
  assert.ok(text.includes(title));
  const changed = text.replace(title, JSON.stringify('X'.repeat(expected.title.length)));
  assert.equal(changed.length, text.length);
  caller.set(new TextEncoder().encode(changed));
  release();
  assert.deepEqual((await result)[0].registeredEntries[0].campaign, expected);
});
