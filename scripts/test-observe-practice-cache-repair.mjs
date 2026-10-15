import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  CACHE_REPAIR_IDS,
  CACHE_REPAIR_PROTOCOL,
  validateCacheRepairPlan,
  cacheRepairSpec,
  injectCacheRepairFault,
  readCacheRepairState,
  assertCacheRepairPreservation,
  observePracticeCacheRepair,
} from './observe-practice-cache-repair.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const plan = () => ({
  format: 'PracticeCacheRepairPlan.v1',
  protocol: CACHE_REPAIR_PROTOCOL,
  caseId: 'unit-fixture',
  bundle: '.',
  envelopeSha256: 'a'.repeat(64),
  sourceRevision: 'b'.repeat(40),
  sourceTree: 'c'.repeat(40),
  packages: Object.fromEntries(CACHE_REPAIR_IDS.map((id) => [id, 'd'.repeat(64)])),
});
test('C7 plan pins all three packages and refuses credentials, scripts and unbounded input', () => {
  assert.deepEqual(validateCacheRepairPlan(plan()), plan());
  for (const change of [
    { packages: {} },
    { packages: { ...plan().packages, extra: 'a'.repeat(64) } },
    { packages: { ...plan().packages, 'civilian-fpv': 'latest' } },
    { sourceRevision: 'main' },
    { password: 'secret' },
    { script: 'execute()' },
    { bundle: '' },
    { caseId: '../escape' },
  ])
    assert.throws(() => validateCacheRepairPlan({ ...plan(), ...change }));
  assert.throws(() => validateCacheRepairPlan(' '.repeat(65537)));
});
test('fault scopes require one known app, exact version and local server', () => {
  for (const id of CACHE_REPAIR_IDS) {
    const spec = cacheRepairSpec(id, 'v1.2.3', 'http://127.0.0.1:9999');
    assert(spec.scope.endsWith(`optional-practice/${id}/`));
    assert(spec.cachePrefix.includes(new URL(spec.scope).pathname));
  }
  assert.throws(() => cacheRepairSpec('unknown', 'v1.2.3', 'http://127.0.0.1:9999'));
  assert.throws(() => cacheRepairSpec('civilian-fpv', '../bad', 'http://127.0.0.1:9999'));
  assert.throws(() => cacheRepairSpec('civilian-fpv', 'v1.2.3', 'https://example.com'));
});
function fixture(id = 'civilian-fpv') {
  const spec = cacheRepairSpec(id, 'v1.2.3', 'http://127.0.0.1:9999');
  const bytes = Buffer.from('original entry'),
    cacheName = spec.cachePrefix + 'r1';
  const expected = { url: spec.entry, bytes: bytes.length, sha256: hash(bytes) };
  const cached = new Map([
    [spec.entry, bytes],
    [spec.scope + 'asset.png', Buffer.from('keep')],
  ]);
  const calls = [],
    registrations = [
      {
        scope: spec.scope,
        active: { scriptURL: spec.scope + 'worker.js', state: 'activated' },
        unregister: async () => {
          calls.push('unregister');
          registrations.splice(0, 1);
          return true;
        },
      },
    ];
  const context = {
    URL,
    TextEncoder,
    Uint8Array,
    crypto: webcrypto,
    location: new URL(spec.launcher),
    navigator: { serviceWorker: { getRegistrations: async () => registrations } },
    localStorage: {
      getItem: (key) => {
        assert.equal(key, spec.pointerKey);
        return '{}';
      },
    },
    caches: {
      keys: async () => [cacheName],
      open: async (name) => {
        assert.equal(name, cacheName);
        calls.push('open');
        return {
          keys: async () => [...cached.keys()].map((url) => ({ url })),
          match: async (request) => {
            const value = cached.get(request.url ?? request);
            return value ? new Response(value) : undefined;
          },
          delete: async (url) => {
            calls.push(['delete', url]);
            return cached.delete(url);
          },
        };
      },
    },
  };
  const invoke = (fn, input) => runInNewContext(`(${fn.toString()})(input)`, { ...context, input });
  return { spec, cacheName, expected, cached, calls, registrations, invoke };
}
test('missing-dependency fault removes exactly one original owned entry for each app', async () => {
  for (const id of CACHE_REPAIR_IDS) {
    const f = fixture(id);
    const result = await f.invoke(injectCacheRepairFault, { ...f, kind: 'missing-dependency' });
    assert.equal(result.kind, 'missing-dependency');
    assert.equal(f.cached.has(f.spec.entry), false);
    assert.equal(f.cached.has(f.spec.scope + 'asset.png'), true);
    assert.equal(f.registrations.length, 1);
    assert.equal(f.calls.filter((call) => Array.isArray(call)).length, 1);
  }
});
test('missing-worker fault never opens or alters cache bytes', async () => {
  const f = fixture(),
    before = [...f.cached];
  await f.invoke(injectCacheRepairFault, { kind: 'missing-worker', spec: f.spec });
  assert.deepEqual(f.calls, ['unregister']);
  assert.deepEqual([...f.cached], before);
});
test('fault refuses foreign, malformed, redirected ownership or changed dependency before mutation', async () => {
  for (const changed of ['origin', 'scope', 'family', 'cache', 'member', 'hash', 'worker']) {
    const f = fixture(),
      input = {
        spec: { ...f.spec },
        kind: 'missing-dependency',
        cacheName: f.cacheName,
        expected: { ...f.expected },
      };
    if (changed === 'origin')
      input.spec.scope = input.spec.scope.replace('127.0.0.1', 'example.com');
    if (changed === 'scope') input.spec.scope = 'http://127.0.0.1:9999/';
    if (changed === 'family') input.spec.cachePrefix = 'revealline.optional.';
    if (changed === 'cache') input.cacheName = 'unrelated-cache';
    if (changed === 'member') input.expected.url = f.spec.scope + 'asset.png';
    if (changed === 'hash') input.expected.sha256 = 'e'.repeat(64);
    if (changed === 'worker') {
      input.kind = 'missing-worker';
      f.registrations[0].active.scriptURL = f.spec.scope + 'other.js';
    }
    await assert.rejects(f.invoke(injectCacheRepairFault, input));
    assert(!f.calls.some((call) => Array.isArray(call) || call === 'unregister'));
    assert(f.cached.has(f.spec.entry));
  }
});
test('read-only state fingerprints exact cache contents and empty pointer without credentials', async () => {
  const f = fixture(),
    result = await f.invoke(readCacheRepairState, f.spec);
  assert.equal(result.hasReference, false);
  assert.equal(result.pointerSha256, hash('{}'));
  assert.equal(result.caches[0].rows.length, 2);
  assert.equal(
    result.caches[0].rows.find((row) => row.url === f.spec.entry).sha256,
    f.expected.sha256,
  );
  assert(!f.calls.some((call) => Array.isArray(call) || call === 'unregister'));
});
test('preservation permits target installation changes but rejects sibling pointer/cache/data changes', () => {
  const before = {
    apps: Object.fromEntries(CACHE_REPAIR_IDS.map((id) => [id, { pointer: id, caches: [id] }])),
    records: { profileSha256: 'nonempty-fixture' },
  };
  const after = structuredClone(before);
  after.apps['civilian-fpv'] = {};
  assert.doesNotThrow(() => assertCacheRepairPreservation(before, after, 'civilian-fpv'));
  after.apps['fpv-worlds'].pointer = 'changed';
  assert.throws(() => assertCacheRepairPreservation(before, after, 'civilian-fpv'));
  after.apps['fpv-worlds'] = before.apps['fpv-worlds'];
  after.records.profileSha256 = 'lost';
  assert.throws(() => assertCacheRepairPreservation(before, after, 'civilian-fpv'));
});
test('failed admission retains a failure report and refuses existing evidence output', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'cache-repair-unit-'));
  try {
    const planFile = path.join(root, 'plan.json'),
      output = path.join(root, 'evidence');
    await writeFile(planFile, JSON.stringify(plan()));
    const report = await observePracticeCacheRepair({
      planFile,
      output,
      playwrightModule: 'unused',
      password: 'unit-secret',
    });
    assert.equal(report.passed, false);
    assert.equal(report.procedureComplete, false);
    assert.equal(report.cleanup.completed, true);
    assert.equal(report.resourceAcquisitions.length, 0);
    const bytes = await readFile(path.join(output, 'report.json'), 'utf8');
    assert(!bytes.includes('unit-secret'));
    await assert.rejects(
      observePracticeCacheRepair({ planFile, output, playwrightModule: 'unused' }),
      /EEXIST/,
    );
    assert.equal(await readFile(path.join(output, 'report.json'), 'utf8'), bytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
