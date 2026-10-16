import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRewardCosmeticRegistry } from '../rewards/cosmetics.mjs';
import { acquireRewardCosmeticImage } from '../rewards/cosmetic-image.mjs';
import { mountRewardCosmetic } from '../ui/reward-cosmetic.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';

function fixture(image = false) {
  const bytes = pngBytes(),
    asset = {
      id: 'cosmetic',
      path: 'game/cosmetic.png',
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      approved: true,
      publication: 'public',
      dependencies: [],
    };
  const registry = createRewardCosmeticRegistry({
    presets: {
      characters: {
        glider: {
          label: 'Glider',
          src: image ? '../../game/cosmetic.png' : null,
          sampling: 'linear',
          widthCells: 1,
          heightCells: 1,
          headingOffsetDegrees: 0,
          animationRecipe: 'still',
          rotors: [],
        },
      },
      animationRecipes: { still: { components: [] } },
      rewardCharacters: ['glider'],
    },
    assets: [asset],
  });
  const payload = {
    id: 'character',
    type: 'cosmetic',
    recipeId: 'glider',
    recipeRevision: registry[0].recipeRevision,
    locales: { en: { title: 'Glider' }, uk: { title: 'Планер' } },
  };
  return { bytes, asset, registry, payload };
}
function surface(t, reduced = false) {
  const doc = new Document(),
    root = doc.createElement('div');
  doc.body.append(root);
  const original = doc.createElement.bind(doc);
  t.mock.method(doc, 'createElement', (tag) => {
    const node = original(tag);
    if (tag === 'canvas')
      node.getContext = () =>
        new Proxy(
          {},
          {
            get: (target, key) => target[key] ?? (() => {}),
            set: (target, key, value) => ((target[key] = value), true),
          },
        );
    return node;
  });
  const frames = new Map();
  let listeners = 0,
    frameId = 0;
  const window = {
    performance: { now: () => 0 },
    requestAnimationFrame(fn) {
      const id = ++frameId;
      frames.set(id, fn);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  };
  const motionPreferences = {
    snapshot: () => ({ effectiveReducedEffects: reduced }),
    subscribe(fn) {
      listeners++;
      fn(this.snapshot());
      return () => listeners--;
    },
  };
  return { container: root, window, motionPreferences, frames, listeners: () => listeners };
}

test('cosmetic preview shares the body renderer and releases frames, subscriptions and decoded images across twenty cycles', async (t) => {
  const f = fixture(true),
    host = surface(t);
  let activeImages = 0,
    chosen = 0;
  for (let i = 0; i < 20; i++) {
    const view = mountRewardCosmetic({
      ...f,
      ...host,
      onChoose: () => chosen++,
      acquire: async () => {
        activeImages++;
        return {
          image: { width: 1, height: 1 },
          dispose() {
            activeImages--;
          },
        };
      },
    });
    assert.equal(await view.ready, true);
    assert.equal(host.frames.size, 0, 'Motion starts only by explicit action.');
    host.container.querySelector('[data-cosmetic-action="animate"]').onclick();
    assert.equal(host.frames.size, 1);
    host.container.querySelector('[data-cosmetic-action="choose"]').onclick();
    view.dispose();
    view.dispose();
    assert.equal(activeImages, 0);
    assert.equal(host.listeners(), 0);
    assert.equal(host.frames.size, 0);
    assert.equal(host.container.children.length, 0);
  }
  assert.equal(chosen, 20);
  const still = surface(t, true),
    view = mountRewardCosmetic({ ...fixture(), ...still, preview: true, onChoose: () => chosen++ });
  assert.equal(await view.ready, true);
  const choose = still.container.querySelector('[data-cosmetic-action="choose"]');
  assert.equal(choose.hidden, true);
  choose.onclick();
  still.container.querySelector('[data-cosmetic-action="animate"]').onclick();
  assert.equal(still.frames.size, 0);
  assert.equal(chosen, 20);
  view.dispose();
});

test('missing exact recipes/images have recovery and retry without accepting late disposed image leases', async (t) => {
  const f = fixture(true),
    host = surface(t);
  let calls = 0,
    released = 0;
  const view = mountRewardCosmetic({
    ...f,
    ...host,
    onRecover() {},
    acquire: async () => {
      calls++;
      if (calls === 1) return null;
      return { image: { width: 1, height: 1 }, dispose: () => released++ };
    },
  });
  assert.equal(await view.ready, false);
  assert.equal(host.container.querySelector('[data-cosmetic-action="choose"]').disabled, true);
  assert.equal(host.container.querySelector('[data-cosmetic-action="recover"]').hidden, false);
  await host.container.querySelector('[data-cosmetic-action="retry"]').onclick();
  view.dispose();
  assert.equal(released, 1);
  let finish;
  const late = mountRewardCosmetic({
    ...f,
    ...host,
    acquire: () => new Promise((resolve) => (finish = resolve)),
  });
  late.dispose();
  finish({ image: {}, dispose: () => released++ });
  await late.ready;
  assert.equal(released, 2);
  assert.equal(host.frames.size, 0);
  assert.equal(host.listeners(), 0);
  const unavailable = mountRewardCosmetic({ ...f, ...host, registry: [] });
  assert.equal(await unavailable.ready, false);
  unavailable.dispose();
});

test('cosmetic originals enforce exact hashes, MIME/dimensions and bounded cancellation using the shared image decoder', async () => {
  const f = fixture(true),
    recipe = f.registry[0];
  let closed = 0;
  const readLocalAsset = async () => ({ asset: f.asset, bytes: f.bytes });
  const image = () => ({ width: 1, height: 1, close: () => closed++ });
  const lease = await acquireRewardCosmeticImage(recipe, {
    readLocalAsset,
    decodeImage: async () => image(),
  });
  lease.dispose();
  lease.dispose();
  assert.equal(closed, 1);
  await assert.rejects(
    acquireRewardCosmeticImage(recipe, {
      readLocalAsset: async () => ({ asset: f.asset, bytes: new Uint8Array(f.bytes.length) }),
      decodeImage: async () => image(),
    }),
    /exact revision/,
  );
  await assert.rejects(
    acquireRewardCosmeticImage(recipe, {
      readLocalAsset: async () => ({ asset: { ...f.asset, path: 'bad.txt' }, bytes: f.bytes }),
      decodeImage: async () => image(),
    }),
    /poster|media/i,
  );
  await assert.rejects(
    acquireRewardCosmeticImage(recipe, {
      readLocalAsset,
      decodeImage: async () => ({ width: 2, height: 1, close() {} }),
    }),
    /dimensions/,
  );
  const controller = new AbortController();
  let finish, started;
  const ready = new Promise((resolve) => (started = resolve));
  const pending = acquireRewardCosmeticImage(recipe, {
    readLocalAsset,
    signal: controller.signal,
    decodeImage: () => {
      started();
      return new Promise((resolve) => (finish = resolve));
    },
  });
  await ready;
  controller.abort();
  await assert.rejects(pending, /cancel/i);
  finish(image());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(closed, 2);
});
