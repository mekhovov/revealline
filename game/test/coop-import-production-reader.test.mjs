import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPresentationHost } from '../presentation/host.mjs';
import { createCoopPresentation } from '../couch/coop-presentation.mjs';
import {
  COOP_PICTURE_BINDINGS,
  COOP_HISTORICAL_IMPORT_PICTURE_POLICY,
} from '../couch/coop-picture-bindings.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const compiledURL = new URL('../presentation/compiled/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('runtime.json', compiledURL), 'utf8'));
const facts = new Map(
  Object.values(manifest.resolved.assets)
    .filter((asset) => asset.file)
    .map((asset) => [asset.file.sha256, asset.file]),
);
const picture = COOP_HISTORICAL_IMPORT_PICTURE_POLICY.picture;
const picturePath = `assets/${picture.sha256}.png`;
const baseURL = 'https://release.test/game/presentation/compiled/';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
// Production reads and WebCrypto finish on elapsed time, not a fixed number of turns.
const until = (check) =>
  waitFor(check, { message: 'Expected production picture request did not begin.' });
// Observe immediately so cleanup cannot leave a rejection unhandled if waiting fails.
const outcome = (promise) =>
  promise.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );

async function fixture(t, { responseForPicture } = {}) {
  const calls = {
    fetches: [],
    pictures: [],
    uiDecodes: [],
    teamDecodes: [],
    releases: [],
    revoked: [],
  };
  let urls = 0;
  const document = { fonts: new Set() };
  const host = createPresentationHost({
    baseURL,
    document,
    async fetch(url, options) {
      assert.ok(url.startsWith(baseURL));
      const relative = url.slice(baseURL.length);
      assert.ok(
        relative === 'runtime.json' || /^assets\/[a-f0-9]{64}\.(png|woff2)$/.test(relative),
      );
      assert.equal(options.redirect, 'error');
      assert.equal(options.credentials, 'same-origin');
      const request = { url, relative, signal: options.signal };
      calls.fetches.push(request);
      const bytes = await readFile(new URL(relative, compiledURL));
      if (relative === picturePath) {
        calls.pictures.push(request);
        const response = await responseForPicture?.({ bytes, request, calls });
        if (response) return response;
      }
      return new Response(bytes, { headers: { 'content-length': String(bytes.length) } });
    },
    async decodeImage(blob) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const file = facts.get(hash(bytes));
      assert.ok(file, 'The real loader authenticated a declared original before decoding.');
      calls.uiDecodes.push(file.sha256);
      return { width: file.width, height: file.height, close() {} };
    },
    cropImage() {
      assert.fail('This exact compiled release has no cropped visible images.');
    },
    createObjectURL: () => `blob:production-reader-${++urls}`,
    revokeObjectURL: (url) => calls.revoked.push(url),
    fontFactory(family) {
      const face = {
        family,
        async load() {
          return face;
        },
      };
      return face;
    },
  });
  t.after(() => host.close());
  const snapshot = await host.load();
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'historical-production-reader';
  pack.levels[0].revision = '2';
  const lease = createCoopPresentation({
    bindings: COOP_PICTURE_BINDINGS,
    historicalImportPolicy: COOP_HISTORICAL_IMPORT_PICTURE_POLICY,
    getSnapshot: host.current,
    // This is the production method, not an injected replacement picture reader.
    readPicture: host.readPicture,
    async decodeImage(blob) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      assert.equal(hash(bytes), picture.sha256);
      const image = { naturalWidth: 1152, naturalHeight: 576, sha256: hash(bytes) };
      calls.teamDecodes.push(image);
      return { image, release: () => calls.releases.push(image) };
    },
  });
  t.after(() => lease.dispose());
  const request = {
    pack,
    levelId: pack.levels[0].id,
    themeId: 'fpv',
    attemptId: 'import-production-1',
  };
  return { host, snapshot, pack, lease, request, calls };
}

test('the production host lazily supplies exact generic Team originals and Retry performs no second read', async (t) => {
  const f = await fixture(t);
  assert.equal(
    f.calls.pictures.length,
    0,
    'Shared UI readiness alone does not fetch reveal pictures.',
  );
  const stages = [];
  const first = await f.lease.select({ ...f.request, onStatus: ({ stage }) => stages.push(stage) });
  assert.equal(first.snapshot, f.snapshot);
  assert.equal(first.choice.levelRevision, '2');
  assert.equal(first.choice.picture.sha256, picture.sha256);
  assert.equal(first.fit, 'contain');
  assert.equal(first.sampling, 'nearest');
  assert.ok(
    stages.includes('downloading') && stages.includes('verifying') && stages.includes('decoding'),
  );
  assert.equal(f.calls.pictures.length, 1);
  assert.equal(f.calls.pictures[0].url, baseURL + picturePath);
  assert.equal(f.calls.teamDecodes.length, 1);
  assert.equal(await f.lease.select(f.request), first);
  assert.equal(f.lease.confirm(f.request), first);
  assert.equal(f.calls.pictures.length, 1);
  const successor = await f.lease.select({
    ...f.request,
    levelId: f.pack.levels[1].id,
    attemptId: 'import-production-2',
  });
  assert.equal(successor.choice.levelId, 'relay-yard');
  assert.equal(successor.choice.picture.sha256, first.choice.picture.sha256);
  assert.notEqual(successor.image, first.image);
  assert.deepEqual(f.calls.releases, [first.image]);
  assert.equal(f.calls.pictures.length, 2);
});

for (const failure of ['corrupt', 'truncated', 'redirected']) {
  test(`production ${failure} response rejects required art and explicit Retry recovers`, async (t) => {
    let fail = true;
    const f = await fixture(t, {
      responseForPicture: ({ bytes }) => {
        if (!fail) return;
        const content = Buffer.from(bytes);
        if (failure === 'corrupt') content[content.length - 1] ^= 1;
        const response = new Response(
          failure === 'truncated' ? content.subarray(0, content.length - 1) : content,
          { headers: { 'content-length': String(bytes.length) } },
        );
        if (failure === 'redirected')
          Object.defineProperty(response, 'redirected', { value: true });
        return response;
      },
    });
    await assert.rejects(
      f.lease.select(f.request),
      /hash mismatch|Truncated presentation file|Presentation file unavailable/,
    );
    assert.equal(f.lease.current(), null);
    assert.equal(f.calls.teamDecodes.length, 0);
    fail = false;
    const ready = await f.lease.select(f.request);
    assert.equal(ready.choice.picture.sha256, picture.sha256);
    assert.equal(f.calls.pictures.length, 2);
    assert.equal(f.calls.teamDecodes.length, 1);
  });
}

test('cancelling a held production fetch retires late bytes and a new deliberate Retry owns its image', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await fixture(t, {
    responseForPicture: async ({ calls }) => {
      if (calls.pictures.length === 1) await gate.promise;
    },
  });
  const controller = new AbortController();
  const pending = outcome(f.lease.select({ ...f.request, signal: controller.signal }));
  await until(() => f.calls.pictures.length === 1);
  controller.abort();
  assert.equal(f.calls.pictures[0].signal.aborted, true);
  const newer = await f.lease.select(f.request);
  assert.equal(f.calls.teamDecodes.length, 1);
  gate.resolve();
  assert.equal((await pending).error?.name, 'AbortError');
  assert.equal(f.lease.current(), newer);
  assert.equal(f.calls.teamDecodes.length, 1);
  assert.equal(f.calls.releases.length, 0);
});

test('a real host snapshot replacement rejects its old pending picture instead of adopting stale release bytes', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await fixture(t, {
    responseForPicture: async ({ calls }) => {
      if (calls.pictures.length === 1) await gate.promise;
    },
  });
  const pending = outcome(f.lease.select(f.request));
  await until(() => f.calls.pictures.length === 1);
  const replacement = await f.host.load();
  assert.notEqual(replacement, f.snapshot);
  gate.resolve();
  assert.match((await pending).error?.message ?? '', /release changed|presentation changed/);
  assert.equal(f.calls.teamDecodes.length, 0);
  assert.equal(f.lease.current(), null);
  const ready = await f.lease.select({ ...f.request, attemptId: 'import-after-reload' });
  assert.equal(ready.snapshot, replacement);
  assert.equal(f.calls.teamDecodes.length, 1);
});

test('the production reader refuses unsupported slots without issuing a picture request', async (t) => {
  const f = await fixture(t);
  const count = f.calls.fetches.length;
  await assert.rejects(f.host.readPicture('picture.team-fixture'), /No compiled FPV original/);
  await assert.rejects(f.host.readPicture('../outside.png'), /No compiled FPV original/);
  assert.equal(f.calls.fetches.length, count);
  assert.equal(f.calls.pictures.length, 0);
});
