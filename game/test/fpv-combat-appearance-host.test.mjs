import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatAppearanceChoice } from '../../optional-practice/civilian-fpv/combat-appearance.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
function fixture(options = {}) {
  const values = new Map(),
    calls = [],
    cached = options.cached ?? null;
  if (options.selected) values.set('revealline.fpv.character-art.v1', options.selected);
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  const store = {
    load: async () => cached,
    save: async (pack) => calls.push(['save', pack]),
    close: () => calls.push(['close']),
  };
  const choice = createCombatAppearanceChoice({
    storage,
    descriptor: { url: 'https://example.test/pack.json', sha256: 'a'.repeat(64) },
    openStore: async () => store,
    download: async () => {
      calls.push(['download']);
      return { sha256: 'a'.repeat(64) };
    },
    ...options,
  });
  return { choice, calls, values, store };
}

test('art hydration and selection never download; missing Realistic keeps Current playable', async () => {
  const { choice, calls } = fixture({ selected: 'realistic' });
  await choice.ready;
  assert.equal(choice.snapshot().active, 'current');
  assert.equal(choice.snapshot().issue, 'missing');
  choice.select('current');
  choice.select('realistic');
  assert.equal(calls.length, 0);
  assert.equal(choice.pack(), null);
  choice.dispose();
});

test('verified cached art is restored independently of destructive-effects preferences', async () => {
  const pack = { sha256: 'a'.repeat(64) },
    { choice, values } = fixture({ cached: pack, selected: 'realistic' });
  await choice.ready;
  assert.equal(choice.pack(), pack);
  assert.equal(choice.snapshot().active, 'realistic');
  choice.select('current');
  assert.equal(choice.pack(), null);
  assert.equal(choice.snapshot().installed, true);
  assert.deepEqual([...values.keys()], ['revealline.fpv.character-art.v1']);
  choice.select('realistic');
  assert.equal(choice.pack(), pack);
  choice.dispose();
});

test('only explicit successful download saves and selects the admitted pack', async () => {
  const { choice, calls } = fixture();
  await choice.ready;
  assert.equal(await choice.download(), true);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ['download', 'save'],
  );
  assert.equal(choice.snapshot().active, 'realistic');
  assert.equal(choice.snapshot().pending, false);
  choice.dispose();
});

test('bad and cancelled downloads preserve current art and never cache partial bytes', async () => {
  const pending = deferred(),
    { choice, calls } = fixture({ download: () => pending.promise });
  await choice.ready;
  const operation = choice.download();
  choice.select('current');
  pending.resolve({ sha256: 'a'.repeat(64) });
  assert.equal(await operation, false);
  assert.equal(choice.snapshot().active, 'current');
  assert.equal(calls.length, 0);
  choice.dispose();
  const failed = fixture({
    download: async () => {
      throw new Error('hash mismatch');
    },
  });
  await failed.choice.ready;
  assert.equal(await failed.choice.download(), false);
  assert.equal(failed.choice.snapshot().issue, 'download');
  assert.equal(failed.choice.snapshot().active, 'current');
  failed.choice.dispose();
});

test('quota failure retains an admitted session pack with an explicit storage notice', async () => {
  const { choice } = fixture({
    openStore: async () => ({
      load: async () => null,
      save: async () => {
        throw new Error('quota');
      },
      close() {},
    }),
  });
  await choice.ready;
  assert.equal(await choice.download(), true);
  assert.equal(choice.snapshot().active, 'realistic');
  assert.equal(choice.snapshot().storageIssue, true);
  choice.dispose();
});

test('late hydration cannot reopen a disposed owner or leave loaded art retained', async () => {
  const loading = deferred(),
    { choice } = fixture({
      selected: 'realistic',
      openStore: async () => ({
        load: () => loading.promise,
        close() {},
      }),
    });
  await Promise.resolve();
  choice.dispose();
  loading.resolve({ sha256: 'a'.repeat(64) });
  await choice.ready;
  assert.equal(choice.pack(), null);
});

test('invalid cached art stays Current until an explicit verified replacement is saved', async () => {
  const { choice } = fixture({
    selected: 'realistic',
    openStore: async () => ({
      load: async () => {
        throw new Error('invalid hash');
      },
      save: async () => {},
      close() {},
    }),
  });
  await choice.ready;
  assert.equal(choice.snapshot().issue, 'invalid-cache');
  assert.equal(choice.snapshot().active, 'current');
  assert.equal(choice.snapshot().storageIssue, false);
  assert.equal(await choice.download(), true);
  assert.equal(choice.snapshot().active, 'realistic');
  assert.equal(choice.snapshot().issue, null);
  choice.dispose();
});
