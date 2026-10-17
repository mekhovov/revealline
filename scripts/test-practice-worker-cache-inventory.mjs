import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceWorkerCacheInventory } from './practice-worker-cache-inventory.mjs';

const revision = 'a'.repeat(64),
  sha256 = 'b'.repeat(64);
function fixture({ id = 'civilian-fpv', launcher = false, pins, source } = {}) {
  const baseURL = `http://127.0.0.1:4321/revealline/practice/${id}/${launcher ? 'app/' : `releases/v0.151.1/site/optional-practice/${id}/`}`;
  pins ??= [{ path: launcher ? 'index.html' : '../../game/app.mjs', bytes: 12, sha256 }];
  return {
    baseURL,
    cacheName: `revealline.optional.${id === 'civilian-flight' ? 'civilian-flight' : 'package'}.v1:${new URL(baseURL).pathname}:${revision}`,
    workerBytes: Buffer.from(
      source ??
        `(function worker(){throw new Error("MUST NOT EXECUTE");})(self,${JSON.stringify(pins)},${JSON.stringify(revision)});`,
    ),
  };
}

test('extracts runtime and launcher pins for all three apps without executing the function', () => {
  for (const id of ['civilian-flight', 'civilian-fpv', 'fpv-worlds'])
    for (const launcher of [false, true]) {
      const input = fixture({ id, launcher });
      const result = practiceWorkerCacheInventory(input);
      assert.equal(result.name, input.cacheName);
      assert.deepEqual(result.files, [
        {
          url: new URL(launcher ? 'index.html' : '../../game/app.mjs', input.baseURL).href,
          bytes: 12,
          sha256,
        },
      ]);
    }
});

test('rejects dynamic arguments, extra statements, and non-generated call structure', () => {
  for (const source of [
    `(function(){})(self, loadPins(), "${revision}")`,
    `(function(){})(self, [...pins], "${revision}")`,
    `(function(){})(self, [{"path":getPath(),"bytes":1,"sha256":"${sha256}"}], "${revision}")`,
    `(function(){})(self, [], getRevision())`,
    `(function(){})(window, [], "${revision}")`,
    `(function(){})(self, [], "${revision}", 1)`,
    `(() => {})(self, [], "${revision}")`,
    `(function(){})(self, [], "${revision}"); attack();`,
  ])
    assert.throws(() => practiceWorkerCacheInventory(fixture({ source })));
});

test('rejects unknown pins, unsafe dependencies, escapes and duplicate resolved URLs', () => {
  const pin = { path: 'index.html', bytes: 12, sha256 };
  const invalid = [
    [],
    [null],
    [{ ...pin, unknown: true }],
    [{ path: pin.path, bytes: 12 }],
    ...[
      '../../../outside.js',
      '/outside',
      '//evil.test/x',
      'https://evil.test/x',
      '%2e%2e/x',
      '..\\x',
      'x?q=1',
      'x#hash',
      'x y',
    ].map((path) => [{ ...pin, path }]),
    [pin, { ...pin, path: './index.html' }],
    Array(513).fill(pin),
    ...[-1, 1.1, 64 * 1024 * 1024 + 1].map((bytes) => [{ ...pin, bytes }]),
    [{ ...pin, sha256: 'bad' }],
    Array.from({ length: 5 }, (_, i) => ({ ...pin, path: `${i}.bin`, bytes: 64 * 1024 * 1024 })),
  ];
  for (const pins of invalid) assert.throws(() => practiceWorkerCacheInventory(fixture({ pins })));
  assert.throws(() =>
    practiceWorkerCacheInventory(
      fixture({ launcher: true, pins: [{ ...pin, path: '../current.json' }] }),
    ),
  );
});

test('rejects mismatched revisions/cache namespaces and noncanonical loopback scopes', () => {
  const input = fixture();
  for (const cacheName of [
    input.cacheName.replace(revision, 'c'.repeat(64)),
    input.cacheName.replace('.package.', '.civilian-flight.'),
    input.cacheName.replace('v0.151.1', 'v0.151.2'),
  ])
    assert.throws(() => practiceWorkerCacheInventory({ ...input, cacheName }));
  for (const baseURL of [
    input.baseURL + '?x=1',
    input.baseURL + '#x',
    input.baseURL.replace('127.0.0.1', 'localhost'),
    input.baseURL.replace('http:', 'https:'),
    input.baseURL.replace('127.0.0.1', 'u:p@127.0.0.1'),
    input.baseURL.replace('/optional-practice/civilian-fpv/', '/optional-practice/fpv-worlds/'),
    input.baseURL.replace('/app/', '/elsewhere/').replace('/site/', '/other/'),
  ])
    assert.throws(() => practiceWorkerCacheInventory({ ...input, baseURL }));
  assert.throws(() =>
    practiceWorkerCacheInventory({ ...input, workerBytes: Buffer.alloc(1024 * 1024 + 1) }),
  );
  assert.throws(() =>
    practiceWorkerCacheInventory({ ...input, workerBytes: input.workerBytes.toString() }),
  );
});
