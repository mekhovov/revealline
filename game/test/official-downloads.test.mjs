import { memoryCaches } from './helpers/official-caches.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  createOfficialDownloads,
  assetDigest,
  OFFICIAL_CACHE,
  officialAssetURL,
  verifiedDownload,
  withOptionalMusicDownload,
} from '../official-downloads.mjs';
import { downloadFiles } from '../download-catalogue.mjs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const origin = 'https://game.example';

test('music yields before fetching when another window is already playing', async () => {
  let requested = false,
    closed = false;
  class Channel {
    postMessage(message) {
      if (message.probe) this.onmessage({ data: { active: true } });
    }
    close() {
      closed = true;
    }
  }
  await assert.rejects(
    withOptionalMusicDownload(
      null,
      async () => {
        requested = true;
      },
      { BroadcastChannel: Channel },
    ),
    { name: 'AbortError' },
  );
  assert.equal(requested, false);
  assert.equal(closed, true);
});
const locks = {
  async request(name, options, work) {
    return (work || options)({ name });
  },
};
async function file(path, text) {
  return {
    path,
    bytes: Buffer.byteLength(text),
    sha256: await assetDigest(new TextEncoder().encode(text)),
    mime: 'text/plain',
  };
}
const a = await file('chapter.json', 'first chapter'),
  b = await file('reward.png', 'second picture');
const bodies = new Map([
  [a.path, 'first chapter'],
  [b.path, 'second picture'],
]);
function setup() {
  const caches = memoryCaches(),
    calls = [];
  let reject = null;
  const request = async (url) => {
    const path = new URL(url).pathname.split('/').at(-1);
    calls.push(path);
    if (reject === path) throw new TypeError('Connection lost while browser still reports online.');
    return new Response(bodies.get(path));
  };
  const options = { caches, origin, locks, fetch: request };
  return {
    caches,
    calls,
    options,
    store: createOfficialDownloads(options),
    fail(path) {
      reject = path;
    },
  };
}
const job = {
  edition: 'edition-a',
  group: 'gameplay',
  files: [a, b],
  baseURL: `${origin}/releases/a/site/`,
};
test('connection loss preserves committed files and a new downloader resumes only the missing file', async () => {
  const h = setup();
  h.fail(b.path);
  await assert.rejects(h.store.download(job), /Connection lost/);
  assert.equal((await h.store.inspect(job.files, { verify: true })).ready, false);
  assert.equal((await h.store.states())[0].complete, false);
  h.fail(null);
  const reopened = createOfficialDownloads(h.options);
  await reopened.download(job);
  assert.deepEqual(h.calls, [a.path, b.path, b.path]);
  assert.equal((await reopened.inspect(job.files, { verify: true })).ready, true);
});
test('pause preserves the completed file and cancellation never marks the group complete', async () => {
  const h = setup(),
    controller = new AbortController();
  await assert.rejects(
    h.store.download({
      ...job,
      signal: controller.signal,
      onProgress(report) {
        if (report.readyBytes === a.bytes) controller.abort();
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal((await h.store.inspect([a])).ready, true);
  assert.equal((await h.store.states())[0].complete, false);
  await h.store.download(job);
  assert.deepEqual(h.calls, [a.path, b.path]);
});
test('quota failure preserves existing files and a retry resumes atomically', async () => {
  const h = setup(),
    originalOpen = h.caches.open;
  let fail = true;
  h.caches.open = async (name) => {
    const cache = await originalOpen(name),
      put = cache.put;
    cache.put = async (key, response) => {
      if (name === OFFICIAL_CACHE && key.endsWith(b.sha256) && fail)
        throw new DOMException('Disk full', 'QuotaExceededError');
      return put(key, response);
    };
    return cache;
  };
  await assert.rejects(h.store.download(job), { name: 'QuotaExceededError' });
  assert.equal((await h.store.inspect([a], { verify: true })).ready, true);
  fail = false;
  await h.store.download(job);
  assert.deepEqual(h.calls, [a.path, b.path, b.path]);
});
test('same-sized corruption is detected and only the damaged file is repaired', async () => {
  const h = setup();
  await h.store.download(job);
  await (
    await h.caches.open(OFFICIAL_CACHE)
  ).put(
    officialAssetURL(a.sha256, origin),
    new Response('x'.repeat(a.bytes), { headers: { 'Content-Length': String(a.bytes) } }),
  );
  assert.equal((await h.store.inspect(job.files, { verify: true })).corrupt.length, 1);
  assert.equal(await h.store.read(a.sha256), null);
  await h.store.download(job);
  assert.deepEqual(h.calls, [a.path, b.path, a.path]);
});
test('updates reuse hashes across editions and removal retains shared references and user caches', async () => {
  const h = setup();
  await h.store.download(job);
  await h.store.download({ ...job, edition: 'edition-b', files: [a] });
  await (await h.caches.open('user-imports')).put(`${origin}/owned`, new Response('user bytes'));
  await h.store.remove('edition-a', 'gameplay');
  assert.equal((await h.store.inspect([a])).ready, true);
  assert.equal((await h.store.inspect([b])).ready, false);
  assert.equal(
    await (await (await h.caches.open('user-imports')).match(`${origin}/owned`)).text(),
    'user bytes',
  );
  assert.deepEqual(h.calls, [a.path, b.path]);
});
test('failed music leaves game readiness intact and imported bytes avoid a network request', async () => {
  const h = setup();
  await h.store.download({ ...job, files: [a] });
  h.fail(b.path);
  await assert.rejects(
    h.store.download({ ...job, edition: 'soundtracks', group: 'album', files: [b] }),
  );
  assert.equal((await h.store.inspect([a], { verify: true })).ready, true);
  await h.store.download({
    ...job,
    edition: 'soundtracks',
    group: 'album',
    files: [b],
    readExisting: () => new Blob([bodies.get(b.path)]),
  });
  assert.deepEqual(h.calls, [a.path, b.path]);
});
test('partial, truncated, oversized, corrupt and redirected downloads cannot be committed', async () => {
  for (const response of [
    new Response('x', { status: 206 }),
    new Response('x'),
    new Response('x'.repeat(a.bytes + 1)),
    new Response('x'.repeat(a.bytes)),
  ])
    await assert.rejects(
      verifiedDownload(a, `${origin}/${a.path}`, { fetch: async () => response }),
    );
  await assert.rejects(
    verifiedDownload(a, `${origin}/${a.path}`, {
      fetch: async () => ({ ok: true, status: 200, redirected: true }),
    }),
  );
});
test('game closure includes shared artwork without including or depending on soundtracks', () => {
  const catalogue = {
    format: 'revealline-offline-content.v1',
    files: [
      { ...a, kind: 'gameplay' },
      { ...b, kind: 'soundtrack' },
    ],
    groups: [
      { id: 'shared', kind: 'gameplay', requires: [], files: [a.path] },
      { id: 'chapter', kind: 'gameplay', requires: ['shared'], files: [] },
      { id: 'album', kind: 'soundtrack', requires: [], files: [b.path] },
    ],
  };
  assert.deepEqual(
    downloadFiles(catalogue, ['chapter']).map((f) => f.sha256),
    [a.sha256],
  );
  catalogue.groups[0].requires.push('album');
  assert.throws(() => downloadFiles(catalogue, ['chapter']), /dependency/);
});

test('played chapter retains its complete runtime and artwork after deselection while unplayed bytes are freed', async () => {
  const h = setup(),
    runtime = { ...(await file('runtime.mjs', 'exact chapter runtime')), kind: 'gameplay' },
    chapter = { ...a, kind: 'gameplay' },
    artwork = { ...b, kind: 'gameplay' },
    unplayed = { ...(await file('unplayed.json', 'unplayed chapter')), kind: 'gameplay' };
  bodies.set(runtime.path, 'exact chapter runtime');
  bodies.set(unplayed.path, 'unplayed chapter');
  const files = [runtime, chapter, artwork, unplayed];
  await h.store.download({ ...job, files });
  await (await h.caches.open('user-imports')).put(`${origin}/owned`, new Response('user bytes'));
  await h.store.pin({
    edition: job.edition,
    group: 'solo:chapter',
    files: [runtime, chapter, artwork],
  });
  await h.store.pin({
    edition: job.edition,
    group: 'solo:chapter',
    files: [runtime, chapter, artwork],
  });
  assert.equal(
    (await h.store.states()).filter((state) => state.edition === 'played-dependencies').length,
    1,
  );
  await h.store.retain({ ...job, files: [], selection: [] });
  assert.equal((await h.store.inspect([runtime, chapter, artwork], { verify: true })).ready, true);
  assert.equal((await h.store.inspect([unplayed], { verify: true })).ready, false);
  await h.store.remove(job.edition, job.group);
  const offline = createOfficialDownloads({
    ...h.options,
    fetch: () => {
      throw new Error('Network blocked');
    },
  });
  await offline.pin({
    edition: job.edition,
    group: 'solo:chapter',
    files: [runtime, chapter, artwork],
  });
  assert.equal((await offline.inspect([runtime, chapter, artwork], { verify: true })).ready, true);
  assert.equal(
    await (await (await h.caches.open('user-imports')).match(`${origin}/owned`)).text(),
    'user bytes',
  );
  assert.deepEqual(
    h.calls,
    files.map((item) => item.path),
  );
});

test('missing, corrupt, aborted and soundtrack files cannot acquire a played chapter owner', async () => {
  const h = setup(),
    files = [
      { ...a, kind: 'gameplay' },
      { ...b, kind: 'gameplay' },
    ],
    pin = { edition: job.edition, group: 'solo:chapter', files };
  await assert.rejects(h.store.pin(pin), /Verify this complete chapter/);
  await h.store.download(job);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(h.store.pin({ ...pin, signal: controller.signal }), { name: 'AbortError' });
  await assert.rejects(
    h.store.pin({ ...pin, files: [{ ...a, kind: 'soundtrack' }] }),
    /Gameplay retention/,
  );
  await (
    await h.caches.open(OFFICIAL_CACHE)
  ).put(
    officialAssetURL(a.sha256, origin),
    new Response('x'.repeat(a.bytes), { headers: { 'Content-Length': String(a.bytes) } }),
  );
  await assert.rejects(h.store.pin(pin), /Verify this complete chapter/);
  assert.equal(
    (await h.store.states()).some((state) => state.edition === 'played-dependencies'),
    false,
  );
});
