import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { createEnemyPresentations } from '../enemy-presentations.mjs';
import {
  createEnemyBodyAssets,
  createEnemyImagePool,
  loadEnemyDrawable,
} from '../ui/enemy-body-assets.mjs';

const model = createEnemyPresentations(
  JSON.parse(readFileSync(new URL('../content/enemy-presentations.json', import.meta.url))),
);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const frame = (type, themeId = 'fpv') => ({ type, themeId });

test('two consumers share one decoded body and release it after the final lease', async () => {
  const pending = deferred();
  let loads = 0,
    closes = 0;
  const pool = createEnemyImagePool({
    load: () => {
      loads++;
      return pending.promise;
    },
  });
  const left = pool.acquire(model.entries[0]);
  const right = pool.acquire(model.entries[0]);
  await tick();
  assert.equal(loads, 1);
  const image = { id: 'exact-hunter' };
  pending.resolve({
    image,
    release() {
      closes++;
    },
    kind: 'bitmap',
    rgbaBytes: 65536,
  });
  await tick();
  assert.equal(left.current().image, image);
  assert.equal(right.current().image, image);
  left.release();
  assert.equal(closes, 0);
  assert.equal(right.current().image, image);
  right.release();
  right.release();
  assert.equal(closes, 1);
  assert.equal(pool.size(), 0);
});

test('cancelled late decoder cannot attach to the next look and is disposed', async () => {
  const old = deferred();
  let calls = 0,
    oldClosed = 0;
  const pool = createEnemyImagePool({
    load: () =>
      ++calls === 1 ? old.promise : Promise.resolve({ image: { id: 'new' }, release() {} }),
  });
  const first = pool.acquire(model.entries[0]);
  await tick();
  first.release();
  const second = pool.acquire(model.entries[0]);
  await tick();
  assert.equal(second.current().image.id, 'new');
  old.resolve({
    image: { id: 'old' },
    release() {
      oldClosed++;
    },
  });
  await tick();
  assert.equal(oldClosed, 1);
  assert.equal(second.current().image.id, 'new');
  second.release();
});

test('active types only, separate bosses, uploads and non-FPV skin changes release defaults', async () => {
  const loaded = [],
    closed = [];
  const pool = createEnemyImagePool({
    load: async (record) => {
      loaded.push(record.type);
      return {
        image: { type: record.type },
        release() {
          closed.push(record.type);
        },
      };
    },
  });
  let catalogs = 0;
  const assets = createEnemyBodyAssets({
    pool,
    catalog: async () => {
      catalogs++;
      return model;
    },
  });
  assets.update([frame('bouncer', 'ukraine')]);
  await tick();
  assert.equal(catalogs, 0);
  assert.deepEqual(loaded, []);
  assets.update([frame('lane-boss'), frame('relay-sentinel'), frame('lane-boss')]);
  await tick();
  await tick();
  assert.deepEqual(loaded, ['lane-boss', 'relay-sentinel']);
  assert.equal(assets.current(frame('lane-boss')).image.type, 'lane-boss');
  assert.equal(assets.current(frame('relay-sentinel')).image.type, 'relay-sentinel');
  assets.update([frame('lane-boss'), frame('relay-sentinel')], { boss: { dataUrl: 'explicit' } });
  assert.equal(assets.current(frame('lane-boss')), null);
  assert.deepEqual(closed, ['lane-boss', 'relay-sentinel']);
  assert.equal(pool.size(), 0);
  assets.clear();
});

test('late catalog cannot load a retired context; failed image retries only after a boundary', async () => {
  const pending = deferred();
  let loads = 0;
  const pool = createEnemyImagePool({
    load: async () => {
      loads++;
      throw new Error('unavailable');
    },
  });
  const retired = createEnemyBodyAssets({ pool, catalog: () => pending.promise });
  retired.update([frame('bouncer')]);
  await tick();
  retired.clear();
  pending.resolve(model);
  await tick();
  assert.equal(loads, 0);
  const active = createEnemyBodyAssets({ pool, catalog: async () => model });
  active.update([frame('bouncer')]);
  await tick();
  await tick();
  assert.equal(active.current(frame('bouncer')), null);
  assert.match(active.status(), /vector body/);
  for (let i = 0; i < 10; i++) active.update([frame('bouncer')]);
  await tick();
  assert.equal(loads, 1);
  active.clear();
  active.update([frame('bouncer')]);
  await tick();
  assert.equal(loads, 2);
  active.clear();
});

test('original hash and dimensions gate bitmap decode, with exact resize request and disposal', async (t) => {
  const bytes = new Uint8Array(29);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = new DataView(bytes.buffer);
  header.setUint32(16, 1254);
  header.setUint32(20, 1254);
  const record = {
    ...model.entries[0],
    width: 1254,
    height: 1254,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  delete record.derivation;
  const saved = Object.getOwnPropertyDescriptors(globalThis);
  t.after(() => {
    for (const key of ['fetch', 'crypto', 'createImageBitmap'])
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
      else delete globalThis[key];
  });
  let decodes = 0,
    closed = 0;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  globalThis.fetch = async () => new Response(bytes);
  globalThis.createImageBitmap = async (blob, options) => {
    decodes++;
    assert.equal(blob.size, bytes.length);
    assert.deepEqual(options, { resizeWidth: 128, resizeHeight: 128, resizeQuality: 'pixelated' });
    return {
      width: 128,
      height: 128,
      close() {
        closed++;
      },
    };
  };
  const signal = new AbortController().signal;
  await assert.rejects(
    loadEnemyDrawable({ ...record, sha256: '0'.repeat(64) }, { signal }),
    /hash differs/,
  );
  assert.equal(decodes, 0);
  for (const offset of [16, 20]) {
    const wrongDimensions = bytes.slice();
    new DataView(wrongDimensions.buffer).setUint32(offset, 1253);
    globalThis.fetch = async () => new Response(wrongDimensions);
    await assert.rejects(
      loadEnemyDrawable(
        { ...record, sha256: createHash('sha256').update(wrongDimensions).digest('hex') },
        { signal },
      ),
      /PNG dimensions differ/,
    );
    assert.equal(decodes, 0, 'Correctly hashed wrong dimensions must fail before decoding');
  }
  globalThis.fetch = async () => new Response(bytes);
  const value = await loadEnemyDrawable(record, { signal });
  assert.equal(value.kind, 'bitmap');
  assert.equal(value.rgbaBytes, 65536);
  value.release();
  assert.equal(closed, 1);
});

test('all seven actual runtime PNGs use their own verified transport before decoding', async (t) => {
  const saved = Object.getOwnPropertyDescriptors(globalThis);
  t.after(() => {
    for (const key of ['fetch', 'crypto', 'createImageBitmap'])
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
      else delete globalThis[key];
  });
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  let current,
    decodes = 0,
    closes = 0;
  globalThis.fetch = async (url) => {
    assert.equal(url.href, new URL(`../../${current.src}`, import.meta.url).href);
    assert.ok(!url.pathname.includes('/originals/'));
    return new Response(readFileSync(url));
  };
  globalThis.createImageBitmap = async (blob, options) => {
    decodes++;
    assert.equal(blob.size, current.bytes);
    assert.deepEqual(options, { resizeWidth: 128, resizeHeight: 128, resizeQuality: 'pixelated' });
    return {
      width: 128,
      height: 128,
      close() {
        closes++;
      },
    };
  };
  const signal = new AbortController().signal;
  for (const record of model.entries) {
    current = record;
    const image = await loadEnemyDrawable(record, { signal });
    assert.equal(image.rgbaBytes, 65536);
    image.release();
  }
  assert.equal(decodes, 7);
  assert.equal(closes, 7);
  await assert.rejects(
    loadEnemyDrawable({ ...current, sha256: '0'.repeat(64) }, { signal }),
    /hash differs/,
  );
  assert.equal(decodes, 7, 'A false runtime identity must refuse before decode');
});
