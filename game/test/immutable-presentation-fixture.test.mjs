import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createImmutablePresentationFixture } from './helpers/immutable-presentation-fixture.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'solo-immutable-fixture-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return pathToFileURL(`${path}/`);
}
async function asset(root, bytes) {
  const url = new URL(`${digest(bytes)}.png`, root);
  await writeFile(url, bytes);
  return url;
}
function gate() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('verified immutable bytes retain first-read provenance and independent caller ownership', async (t) => {
  const root = await directory(t),
    bytes = Buffer.from('verified original bytes');
  const url = await asset(root, bytes),
    reader = createImmutablePresentationFixture({ root });
  const first = await reader.read(url);
  first[0] = 0;
  const second = await reader.read(url);
  assert.deepEqual(second, bytes);
  second[1] = 0;
  assert.deepEqual(await reader.read(url), bytes);
  const report = reader.snapshot();
  assert.equal(report.reads, 1);
  assert.equal(report.hits, 2);
  assert.equal(report.retainedBytes, bytes.length);
  assert.deepEqual(report.pending, []);
  assert.deepEqual(
    report.sources.map(({ sha256, bytes }) => ({ sha256, bytes })),
    [{ sha256: digest(bytes), bytes: bytes.length }],
  );
  report.sources[0].sha256 = 'changed';
  assert.equal(reader.snapshot().sources[0].sha256, digest(bytes));
});

test('corrupt, oversized, missing and rejected reads are never cached and can recover', async (t) => {
  const root = await directory(t),
    bytes = Buffer.from('expected');
  const url = new URL(`${digest(bytes)}.png`, root);
  const reader = createImmutablePresentationFixture({ root, maximumAssetBytes: bytes.length });
  await assert.rejects(reader.read(url), /ENOENT/);
  await writeFile(url, Buffer.from('corrupt!'));
  await assert.rejects(reader.read(url), /hash mismatch/);
  await writeFile(url, Buffer.alloc(bytes.length + 1));
  await assert.rejects(reader.read(url), /file-size boundary/);
  assert.equal(reader.snapshot().retainedEntries, 0);
  assert.deepEqual(reader.snapshot().pending, []);
  await writeFile(url, bytes);
  assert.deepEqual(await reader.read(url), bytes);
  assert.equal(reader.snapshot().reads, 4);
  assert.equal(reader.snapshot().failures, 3);
  let attempts = 0;
  const rejected = createImmutablePresentationFixture({
    root,
    readAsset: async () => {
      if (++attempts === 1) throw new Error('injected read rejection');
      return bytes;
    },
  });
  await assert.rejects(rejected.read(url), /injected read rejection/);
  assert.deepEqual(await rejected.read(url), bytes);
  assert.equal(attempts, 2);
});

test('concurrent requests share one read but pending admission and copy ownership stay bounded', async (t) => {
  const root = await directory(t),
    bytes = Buffer.from('same bytes'),
    held = gate();
  const url = new URL(`${digest(bytes)}.png`, root);
  let reads = 0;
  const reader = createImmutablePresentationFixture({
    root,
    maximumPending: 1,
    readAsset: async () => {
      reads++;
      await held.promise;
      return bytes;
    },
  });
  const first = reader.read(url),
    second = reader.read(url);
  await assert.rejects(reader.read(new URL(`${'a'.repeat(64)}.png`, root)), /pending-read bound/);
  assert.equal(reader.snapshot().pending.length, 1);
  assert.equal(reader.snapshot().joined, 1);
  held.resolve();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(reads, 1);
  a[0] = 0;
  assert.deepEqual(b, bytes);
  assert.deepEqual(reader.snapshot().pending, []);
});

test('read provenance keeps advancing when gameplay freezes performance.now', async (t) => {
  const root = await directory(t),
    bytes = Buffer.from('monotonic source'),
    held = gate();
  const prior = Object.getOwnPropertyDescriptor(performance, 'now');
  Object.defineProperty(performance, 'now', { configurable: true, value: () => 0 });
  try {
    const reader = createImmutablePresentationFixture({
      root,
      readAsset: async () => {
        await held.promise;
        return bytes;
      },
    });
    const result = reader.read(new URL(`${digest(bytes)}.png`, root));
    await delay(10);
    assert.ok(reader.snapshot().pending[0].elapsedMs >= 5);
    held.resolve();
    assert.deepEqual(await result, bytes);
    assert.ok(reader.snapshot().sources[0].firstReadMs >= 5);
  } finally {
    held.resolve();
    if (prior) Object.defineProperty(performance, 'now', prior);
    else delete performance.now;
  }
});

test('byte, entry and diagnostic bounds do not suppress validation of uncached sources', async (t) => {
  const root = await directory(t),
    a = Buffer.from('first'),
    b = Buffer.from('second');
  const aURL = await asset(root, a),
    bURL = await asset(root, b);
  const reader = createImmutablePresentationFixture({
    root,
    maximumBytes: a.length,
    maximumEntries: 1,
  });
  await reader.read(aURL);
  for (let index = 0; index < 12; index++) assert.deepEqual(await reader.read(bURL), b);
  const report = reader.snapshot();
  assert.equal(report.retainedEntries, 1);
  assert.equal(report.retainedBytes, a.length);
  assert.equal(report.uncached, 12);
  assert.equal(report.sources.length, 1);
  assert.equal(report.sourceRecordsDropped, 12);
  assert.equal(report.worstReads.length, 8);
  await writeFile(bURL, 'broken');
  await assert.rejects(reader.read(bURL), /hash mismatch/);
  for (const options of [
    { maximumBytes: 0 },
    { maximumEntries: 257 },
    { maximumPending: 9 },
    { maximumAssetBytes: 1024 * 1024 + 1 },
  ])
    assert.throws(() => createImmutablePresentationFixture({ root, ...options }), /bound/);
});

test('mutable manifests and files outside the exact image namespace are reread unchanged', async (t) => {
  const root = await directory(t),
    reader = createImmutablePresentationFixture({ root });
  for (const name of ['runtime.json', `${'b'.repeat(64)}.json`, 'picture.png']) {
    const url = new URL(name, root);
    await writeFile(url, 'first');
    assert.equal(String(await reader.read(url)), 'first');
    await writeFile(url, 'second');
    assert.equal(String(await reader.read(url)), 'second');
  }
  assert.equal(reader.snapshot().requests, 0);
  assert.equal(reader.snapshot().retainedBytes, 0);
});

test('a custom fetch gate still blocks required picture readiness even when exact bytes are cached', async (t) => {
  const reader = createImmutablePresentationFixture(),
    held = gate();
  const name = '77a93635bc7d39976bbf571f056a68f75ef43e1b655b6512fd293b2b568306e3.png';
  await reader.read(new URL(`../presentation/compiled/assets/${name}`, import.meta.url));
  let requested = false;
  t.after(() => held.resolve());
  const h = await soloPage(t, {
    presentationFixture: reader,
    waitForPictures: false,
    initialReadyTimeoutMs: 15000,
    fetchResponse: async (path) => {
      if (String(path).endsWith(name)) {
        requested = true;
        await held.promise;
      }
    },
  });
  await waitFor(() => requested, { timeoutMs: 15000 });
  assert.equal(h.doc.body.dataset.pictureState, 'pending');
  assert.equal(reader.snapshot().hits, 0, 'The custom transport gate runs before cache admission.');
  held.resolve();
  await settle(
    () => h.doc.body.dataset.pictureState === 'ready',
    'Real picture readiness after the custom gate',
    { timeoutMs: 15000 },
  );
  assert.ok(reader.snapshot().hits >= 1);
  assert.equal(h.rendered.run.tick, 0);
  assert.deepEqual(h.errors, []);
});

test('the unchanged 15-second readiness failure retains bounded pending read provenance', async (t) => {
  const held = gate();
  const prior = Object.getOwnPropertyDescriptor(performance, 'now');
  const reader = createImmutablePresentationFixture({
    readAsset: async () => {
      Object.defineProperty(performance, 'now', { configurable: true, value: () => 0 });
      await held.promise;
      throw new Error('released diagnostic fixture');
    },
  });
  try {
    await assert.rejects(
      soloPage(t, {
        presentationFixture: reader,
        initialReadyTimeoutMs: 15000,
      }),
      (error) => {
        const report = JSON.parse(error.message.split('\n').at(-1));
        assert.match(report.phase, /initial picture choice/);
        assert.equal(report.timeoutMs, 15000);
        assert.ok(report.elapsedMs >= 15000);
        assert.equal(report.pictureState, 'pending');
        // Public failure diagnostics retain a bounded count, not the fixture's
        // private per-read provenance array.
        const pending = reader.snapshot().pending;
        assert.ok(Number.isInteger(report.presentationFixture.pending));
        assert.ok(report.presentationFixture.pending > 0);
        assert.ok(report.presentationFixture.pending <= 8);
        assert.equal(report.presentationFixture.pending, pending.length);
        assert.ok(pending.some((row) => row.elapsedMs > 0));
        assert.equal(report.presentationFixture.retainedBytes, 0);
        assert.equal(report.presentationFixture.failures, 0);
        assert.ok(Buffer.byteLength(JSON.stringify(report)) < 65536);
        return true;
      },
    );
  } finally {
    if (prior) Object.defineProperty(performance, 'now', prior);
    else delete performance.now;
    held.resolve();
  }
});
