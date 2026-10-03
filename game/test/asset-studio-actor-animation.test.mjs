// Authored regression cases. Automated execution remains waived.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sameActorAnimationContext,
  mountActorAnimationControls,
} from '../../authoring/asset-studio/animation-controls.mjs';
import { croppedImage } from '../../authoring/asset-studio/scene-preview.mjs';
import { pageActorArtPool } from '../presentation/actor-art-pool.mjs';

const fixture = () => {
  const document = {};
  const canvas = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
  class Node {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.style = {};
      this.listeners = new Map();
      this.value = '';
    }
    append(...items) {
      this.children.push(...items);
    }
    after(item) {
      this.next = item;
    }
    addEventListener(name, fn) {
      this.listeners.set(name, fn);
    }
    remove() {
      this.removed = true;
    }
    getContext() {
      return canvas;
    }
  }
  document.createElement = (tag) => new Node(tag);
  const after = new Node('button');
  const asset = {
    id: 'enemy.runner',
    revision: 1,
    kind: 'image',
    file: { sha256: 'a'.repeat(64), width: 4, height: 4 },
    geometry: { frame: { x: 0, y: 0, width: 4, height: 4 }, pivot: { x: 0.5, y: 0.5 } },
  };
  let context = {
    document: {},
    asset,
    slot: { id: 'enemy.runner', group: 'enemies' },
    blob: new Blob(['review']),
  };
  return {
    document,
    after,
    asset,
    getContext: () => context,
    setContext: (value) => {
      context = value;
    },
  };
};
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function decoder(t, fn) {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, value: fn });
  t.after(() => {
    if (old) Object.defineProperty(globalThis, 'createImageBitmap', old);
    else delete globalThis.createImageBitmap;
  });
}

test('animation edits cannot cross immutable collection ownership even when slot/revision names match', () => {
  const owner = { document: {}, asset: { id: 'a', revision: 1 }, slot: { id: 'enemy.runner' } };
  assert.equal(sameActorAnimationContext(owner, { ...owner }), true);
  assert.equal(sameActorAnimationContext(owner, { ...owner, document: {} }), false);
  assert.equal(
    sameActorAnimationContext(owner, { ...owner, asset: { id: 'a', revision: 2 } }),
    false,
  );
  assert.equal(sameActorAnimationContext(owner, { ...owner, slot: null }), false);
});

test('Studio refresh and disposal release preview leases and refuse a stale Stage', async (t) => {
  const f = fixture(),
    errors = [];
  let closed = 0,
    applied = 0;
  decoder(t, async () => ({ width: 4, height: 4, close: () => closed++ }));
  const controls = mountActorAnimationControls({
    ...f,
    onApply: () => applied++,
    onError: (error) => errors.push(error),
  });
  const buttons = f.after.next.children.filter((node) => node.tag === 'button');
  buttons[0].onclick();
  await settle();
  assert.equal(pageActorArtPool(f.document).stats().leases, 1);
  f.setContext({ ...f.getContext(), document: {} });
  controls.refresh();
  assert.equal(pageActorArtPool(f.document).stats().reservedBytes, 0);
  buttons[2].onclick();
  assert.equal(applied, 0);
  assert.equal(errors.length, 1);
  assert.equal(closed, 1);
  buttons[0].onclick();
  await settle();
  controls.dispose();
  assert.equal(pageActorArtPool(f.document).stats().reservedBytes, 0);
  assert.equal(closed, 2);
});

test('closing a pending animation preview retires its reservation when decoding finishes', async (t) => {
  const f = fixture();
  let finish,
    closed = 0;
  decoder(
    t,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const controls = mountActorAnimationControls({
    ...f,
    onApply() {},
    onError(error) {
      throw error;
    },
  });
  f.after.next.children.find((node) => node.tag === 'button').onclick();
  await settle();
  controls.suspend();
  assert.equal(pageActorArtPool(f.document).stats().reservedBytes, 64);
  finish({ width: 4, height: 4, close: () => closed++ });
  await settle();
  assert.equal(pageActorArtPool(f.document).stats().reservedBytes, 0);
  assert.equal(closed, 1);
  controls.dispose();
});

test('paired animated context previews share the page atlas and release both owners exactly once', async (t) => {
  const f = fixture();
  let decoded = 0,
    closed = 0;
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: f.document });
  t.after(() => {
    if (prior) Object.defineProperty(globalThis, 'document', prior);
    else delete globalThis.document;
  });
  decoder(t, async () => {
    decoded++;
    return { width: 4, height: 4, close: () => closed++ };
  });
  const asset = { ...f.asset, animation: {} },
    bytes = new Map([[asset.file.sha256, new Blob(['review'])]]),
    left = [],
    right = [];
  const [a, b] = await Promise.all([
    croppedImage(asset, bytes, { isCurrent: () => true }, (release) => left.push(release)),
    croppedImage(asset, bytes, { isCurrent: () => true }, (release) => right.push(release)),
  ]);
  assert.strictEqual(a, b);
  assert.equal(decoded, 1);
  left.forEach((release) => release());
  assert.equal(closed, 0);
  right.forEach((release) => release());
  assert.equal(closed, 1);
  assert.equal(pageActorArtPool(f.document).stats().reservedBytes, 0);
});
