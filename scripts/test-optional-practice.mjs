import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, webcrypto } from 'node:crypto';
import {
  buildOptionalPractice,
  OPTIONAL_PRACTICE_ROOT,
  OPTIONAL_PRACTICE_LIMITS,
} from './build-optional-practice.mjs';
import { ICON_MASTER } from './brand-icons.mjs';
import { readBuildConfig } from './game-cli.mjs';
import { installPracticeWorker } from '../optional-practice/civilian-flight/worker-template.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('optional practice archives are reproducible, admitted completely and absent from core build inputs', async () => {
  const first = await buildOptionalPractice(root),
    second = await buildOptionalPractice(root);
  assert.deepEqual(first.zip, second.zip);
  assert.deepEqual(first.manifest, second.manifest);
  assert.equal(first.manifest.core, false);
  assert.equal(first.manifest.qualification, 'development-only');
  const entries = new Map(first.entries.map((entry) => [entry.name, entry.bytes]));
  assert.equal(first.manifest.files.length, entries.size - 1);
  for (const file of first.manifest.files) {
    assert.equal(entries.get(file.path).length, file.bytes);
    assert.equal(hash(entries.get(file.path)), file.sha256);
  }
  assert.ok(
    first.manifest.files.every((file) => !/game\/content\/|editions\/|authoring\//.test(file.path)),
  );
  // Enforce the production budget over the complete output, including its manifest.
  assert.deepEqual(first.manifest.limits, OPTIONAL_PRACTICE_LIMITS);
  assert.ok(first.entries.length <= OPTIONAL_PRACTICE_LIMITS.files);
  assert.ok(
    first.entries.reduce((sum, entry) => sum + entry.bytes.length, 0) <=
      OPTIONAL_PRACTICE_LIMITS.bytes,
  );
  assert.ok(!entries.has(ICON_MASTER), 'The full-size icon master is build tooling only');
  const core = await readBuildConfig(root);
  assert.ok(
    core.include.every(
      (included) =>
        !OPTIONAL_PRACTICE_ROOT.startsWith(`${included}/`) &&
        !included.startsWith(OPTIONAL_PRACTICE_ROOT),
    ),
  );
  assert.match(entries.get('game/i18n/catalogs.mjs').toString(), /dataJson/);
  assert.doesNotMatch(
    entries.get('game/i18n/catalogs.mjs').toString(),
    /coupa|droneaid|completionRewards/i,
  );
  const identity = JSON.parse(entries.get(`${OPTIONAL_PRACTICE_ROOT}app.webmanifest`));
  assert.equal(identity.id, './civilian-flight-practice');
  assert.equal(identity.scope, './');
  assert.deepEqual(
    identity.icons.map((icon) => icon.sizes),
    ['192x192', '512x512'],
  );
  for (const icon of identity.icons) {
    const bytes = entries.get(OPTIONAL_PRACTICE_ROOT + icon.src.slice(2));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), Number(icon.sizes.split('x')[0]));
  }
  await assert.rejects(
    buildOptionalPractice(root, { engineCommit: 'a'.repeat(40) }),
    /commit and tree/,
  );
});
test('an unexpected runtime import fails closed before a package can be published', async (t) => {
  const built = await buildOptionalPractice(root),
    fixture = await mkdtemp(path.join(tmpdir(), 'optional-practice-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  for (const entry of built.entries) {
    const target = path.join(fixture, entry.name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, entry.bytes);
  }
  const template = OPTIONAL_PRACTICE_ROOT + 'worker-template.mjs';
  await writeFile(path.join(fixture, template), await readFile(path.join(root, template)));
  for (const locale of ['en', 'uk']) {
    const name = `game/locales/${locale}/errors.json`,
      target = path.join(fixture, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await readFile(path.join(root, name)));
  }
  const app = path.join(fixture, OPTIONAL_PRACTICE_ROOT, 'app.mjs');
  await writeFile(app, `import '../../game/app.mjs';\n${await readFile(app, 'utf8')}`);
  await assert.rejects(buildOptionalPractice(fixture), /not admitted: game\/app.mjs/);
});

function workerFixture({ corrupt = false, quota = false, existing = false, stalled = false } = {}) {
  const base = 'https://example.test/one/optional-practice/civilian-flight/';
  const own = `revealline.optional.civilian-flight.v1:${new URL(base).pathname}:`;
  const other =
    'revealline.optional.civilian-flight.v1:/two/optional-practice/civilian-flight/:keep';
  const bytes = Buffer.from('exact optional bytes');
  const pins = [
    { path: 'index.html', bytes: bytes.length, sha256: hash(bytes) },
    { path: 'app.mjs', bytes: bytes.length, sha256: hash(bytes) },
  ];
  const stores = new Map([
    [own + 'old', new Map()],
    [other, new Map()],
    ['game-core', new Map()],
  ]);
  if (existing) stores.set(own + 'new', new Map([['sentinel', new Response('retained')]]));
  const listeners = new Map(),
    deleted = [];
  let activation = 0,
    puts = 0;
  const scope = {
    registration: { scope: base },
    crypto: webcrypto,
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    caches: {
      keys: async () => [...stores.keys()],
      match: async (url, { cacheName }) => stores.get(cacheName)?.get(url)?.clone(),
      delete: async (name) => {
        deleted.push(name);
        return stores.delete(name);
      },
      open: async (name) => {
        if (!stores.has(name)) stores.set(name, new Map());
        return {
          put: async (url, response) => {
            if (quota && ++puts === 2) throw new Error('Quota');
            stores.get(name).set(url, response);
          },
          match: async (url) => stores.get(name).get(url)?.clone(),
        };
      },
    },
    fetch: async (_url, { signal }) =>
      stalled
        ? new Promise((_resolve, reject) =>
            signal.addEventListener('abort', () => reject(new Error('Cancelled')), { once: true }),
          )
        : new Response(corrupt ? 'wrong' : bytes),
    skipWaiting: async () => {
      activation++;
    },
    clients: { claim: async () => {} },
  };
  installPracticeWorker(scope, pins, 'new');
  const run = async (name) => {
    let result;
    listeners.get(name)({
      waitUntil(value) {
        result = value;
      },
    });
    return result;
  };
  return { base, listeners, stores, own, other, deleted, run, activation: () => activation };
}
test('worker reports progress, validates cached dependencies and detects eviction', async () => {
  const f = workerFixture(),
    progress = [];
  f.listeners.get('message')({
    data: { type: 'practice-progress' },
    ports: [{ postMessage: (data) => progress.push(data) }],
  });
  await f.run('install');
  assert(progress.some((item) => item.phase === 'verifying'));
  assert.equal(progress.at(-1).phase, 'ready');
  assert.equal(progress.at(-1).downloaded, progress.at(-1).total);
  const ready = async () => {
    let result, pending;
    f.listeners.get('message')({
      data: { type: 'practice-status' },
      ports: [
        {
          postMessage: (data) => {
            result = data;
          },
        },
      ],
      waitUntil: (value) => {
        pending = value;
      },
    });
    await pending;
    return result.ready;
  };
  assert.equal(await ready(), true);
  f.stores.get(f.own + 'new').delete(f.base + 'app.mjs');
  assert.equal(await ready(), false);
});
test('cancel discards only the incomplete version and keeps previous and foreign caches', async () => {
  const f = workerFixture({ stalled: true });
  const pending = f.run('install');
  await new Promise((resolve) => setImmediate(resolve));
  f.listeners.get('message')({ data: { type: 'practice-cancel' }, ports: [] });
  await assert.rejects(pending, /Cancelled/);
  assert(!f.stores.has(f.own + 'new'));
  assert(f.stores.has(f.own + 'old'));
  assert(f.stores.has(f.other));
});
test('optional worker verifies every byte before activation and only replaces its own scope cache', async () => {
  const fixture = workerFixture();
  await fixture.run('install');
  assert.equal(fixture.activation(), 0, 'A worker never forcibly replaces an active session');
  assert.equal(fixture.stores.get(fixture.own + 'new').size, 2);
  await fixture.run('activate');
  assert.deepEqual(fixture.deleted, [], 'Keep one previous cache in this exact scope');
  assert.ok(fixture.stores.has(fixture.other));
  assert.ok(fixture.stores.has('game-core'));
});
test('corruption or quota prevents optional activation and preserves previously installed caches', async () => {
  for (const options of [{ corrupt: true }, { quota: true }, { corrupt: true, existing: true }]) {
    const fixture = workerFixture(options);
    await assert.rejects(fixture.run('install'));
    assert.equal(fixture.activation(), 0);
    assert.ok(fixture.stores.has(fixture.own + 'old'));
    assert.ok(fixture.stores.has(fixture.other));
    assert.ok(fixture.stores.has('game-core'));
    assert.equal(fixture.stores.has(fixture.own + 'new'), !!options.existing);
  }
});
