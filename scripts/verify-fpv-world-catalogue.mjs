/** Bounded delivery probe; no network, storage writes, or player input. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import {
  worldLibraryIndex,
  worldLibraryPage,
} from '../optional-practice/civilian-fpv/world-library.mjs';
import { installPracticeWorker } from '../optional-practice/worker-source.mjs';

const encode = (value) => new TextEncoder().encode(JSON.stringify(value)),
  hash = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  root = 'https://raw.githubusercontent.com/mekhovov/revealline/',
  commit = 'a'.repeat(40),
  pagePath = 'authoring/fpv-worlds/published/free-worlds-v2/page-2.json',
  fixture = JSON.parse(
    await readFile(
      new URL('../authoring/fpv-worlds/published/free-worlds-v2/index.json', import.meta.url),
    ),
  ),
  legacyFixture = JSON.parse(
    await readFile(
      new URL('../authoring/fpv-worlds/published/free-worlds-v1/index.json', import.meta.url),
    ),
  ),
  checks = [];
function check(name, verify) {
  verify();
  checks.push(name);
}
check('published v2 page preserves legacy admitted asset identities', () => {
  const page = worldLibraryPage(encode(fixture));
  const byId = new Map(page.worlds.map((world) => [world.id, world]));
  for (const world of worldLibraryIndex(encode(legacyFixture))) {
    assert.deepEqual(byId.get(world.id), world);
  }
  assert.equal(page.worlds.length, fixture.worlds.length);
  assert.equal(page.next, null);
});
check('v1 parser and page adapter preserve exact asset identities', () => {
  const bytes = encode({ format: 'FPVWorldLibrary.v1', worlds: fixture.worlds });
  assert.deepEqual(worldLibraryIndex(bytes), worldLibraryPage(bytes).worlds);
});
const emptyPage = encode({ format: 'FPVWorldLibrary.v2', worlds: [], next: null }),
  next = { commit, path: pagePath, sha256: hash(emptyPage), bytes: emptyPage.length };
check('continuation resolves only immutable first-party URL', () => {
  assert.equal(
    worldLibraryPage(encode({ ...fixture, next })).next.url,
    root + commit + '/' + pagePath,
  );
});
for (const [name, change] of [
  ['mutable commit', { commit: 'main' }],
  ['path traversal', { path: '../page.json' }],
  ['external address', { path: 'https://example.com/page.json' }],
  ['oversized page', { bytes: 32769 }],
  ['missing integrity', { sha256: '' }],
  ['fractional size', { bytes: 1.5 }],
])
  check('reject ' + name, () =>
    assert.throws(() => worldLibraryPage(encode({ ...fixture, next: { ...next, ...change } }))),
  );
check('reject duplicate world IDs', () =>
  assert.throws(() =>
    worldLibraryPage(encode({ ...fixture, worlds: [fixture.worlds[0], fixture.worlds[0]] })),
  ),
);
check('reject excess page entries', () =>
  assert.throws(() =>
    worldLibraryPage(encode({ ...fixture, worlds: Array(33).fill(fixture.worlds[0]) })),
  ),
);
check('reject malformed next', () =>
  assert.throws(() => worldLibraryPage(encode({ ...fixture, next: {} }))),
);
check('reject unrecognized format and keys', () => {
  assert.throws(() => worldLibraryPage(encode({ ...fixture, format: 'FPVWorldLibrary.v3' })));
  assert.throws(() => worldLibraryPage(encode({ ...fixture, executable: 'x' })));
});
async function request(data, responseBytes = emptyPage, redirected = false) {
  let listener,
    requests = 0,
    finish;
  const terminal = new Promise((resolve) => {
    finish = resolve;
  });
  const scope = {
    crypto: webcrypto,
    addEventListener(name, handler) {
      assert.equal(name, 'message');
      listener = handler;
    },
    async fetch(url, options) {
      requests++;
      assert.equal(url, data.url);
      assert.equal(options.redirect, 'error');
      assert.equal(options.credentials, 'omit');
      const response = new Response(responseBytes, {
        headers: { 'content-length': String(responseBytes.length) },
      });
      if (redirected) Object.defineProperty(response, 'redirected', { value: true });
      return response;
    },
    postMessage(message) {
      if (message.type !== 'world-progress') finish(message);
    },
  };
  installPracticeWorker(scope, [], 'probe');
  listener({ data: { type: 'world-read', ...data } });
  const result = await terminal;
  return { type: result.type, requests };
}
for (const [name, data, bytes, expected, requests, redirected] of [
  [
    'legacy bootstrap',
    { url: root + 'main/authoring/fpv-worlds/published/free-worlds-v1/index.json', bytes: 32768 },
    emptyPage,
    'world-done',
    1,
  ],
  [
    'v2 bootstrap',
    { url: root + 'main/authoring/fpv-worlds/published/free-worlds-v2/index.json', bytes: 32768 },
    emptyPage,
    'world-done',
    1,
  ],
  [
    'hashed continuation',
    { url: root + commit + '/' + pagePath, bytes: next.bytes, sha256: next.sha256 },
    emptyPage,
    'world-done',
    1,
  ],
  [
    'wrong continuation hash',
    { url: root + commit + '/' + pagePath, bytes: next.bytes, sha256: '0'.repeat(64) },
    emptyPage,
    'world-error',
    1,
  ],
  [
    'redirected continuation',
    { url: root + commit + '/' + pagePath, bytes: next.bytes, sha256: next.sha256 },
    emptyPage,
    'world-error',
    1,
    true,
  ],
  [
    'oversized continuation',
    { url: root + commit + '/' + pagePath, bytes: 32769, sha256: next.sha256 },
    emptyPage,
    'world-error',
    0,
  ],
  [
    'mutable continuation',
    { url: root + 'main/' + pagePath, bytes: next.bytes, sha256: next.sha256 },
    emptyPage,
    'world-error',
    0,
  ],
  [
    'unapproved host',
    { url: 'https://example.com/' + pagePath, bytes: next.bytes, sha256: next.sha256 },
    emptyPage,
    'world-error',
    0,
  ],
  [
    'bootstrap overflow',
    { url: root + 'main/authoring/fpv-worlds/published/free-worlds-v2/index.json', bytes: 32768 },
    new Uint8Array(32769),
    'world-error',
    1,
  ],
  [
    'exact size required',
    { url: root + commit + '/' + pagePath, bytes: next.bytes + 1, sha256: next.sha256 },
    emptyPage,
    'world-error',
    1,
  ],
]) {
  assert.deepEqual(await request(data, bytes, redirected), { type: expected, requests });
  checks.push('worker: ' + name);
}
console.log(
  JSON.stringify(
    {
      format: 'FPVCatalogueProbe.v1',
      node: process.version,
      passed: checks.length,
      checks,
      limitations: 'Controlled worker fetch responses; no native-browser or live-network claim.',
    },
    null,
    2,
  ),
);
