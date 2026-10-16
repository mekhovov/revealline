// Authored regression cases. Automated execution remains waived.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sameActorAnimationContext,
  mountActorAnimationControls,
} from '../../authoring/asset-studio/animation-controls.mjs';
import { croppedImage } from '../../authoring/asset-studio/scene-preview.mjs';
import { pageActorArtPool } from '../presentation/actor-art-pool.mjs';
import {
  ACTOR_CLIPS,
  createSoldierAnimation,
  sampleActorAnimation,
} from '../presentation/actor-animation.mjs';

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
const canvases = (node) => (node.tag === 'canvas' ? [node] : node.children.flatMap(canvases));
const previewBytes = (48 + 56 + 64 + 144) * 144 * 4;
const settle = async () => {
  for (let i = 0; i < 80; i++) await Promise.resolve();
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
  assert.equal(pageActorArtPool(f.document).stats().leases, 5);
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

test('animation preview backing storage is accounted, released on collapse and recreated on explicit preview', async (t) => {
  const f = fixture();
  decoder(t, async () => ({ width: 4, height: 4, close() {} }));
  const errors = [],
    controls = mountActorAnimationControls({
      ...f,
      onApply() {},
      onError: (error) => errors.push(error),
    }),
    root = f.after.next,
    canvas = canvases(root)[0],
    buttons = root.children.filter((node) => node.tag === 'button'),
    pool = pageActorArtPool(f.document);
  assert.equal(canvas.width, 0);
  assert.equal(pool.stats().reservedBytes, 0);
  buttons[0].onclick();
  await settle();
  assert.equal(canvas.width, 48);
  assert.equal(canvas.height, 144);
  assert.equal(pool.stats().reservedBytes, previewBytes + 64);
  root.open = false;
  root.listeners.get('toggle')();
  assert.equal(canvas.width, 0);
  assert.equal(pool.stats().reservedBytes, 0);
  buttons[1].onclick();
  await settle();
  assert.equal(canvas.width, 48);
  assert.equal(pool.stats().reservedBytes, previewBytes + 64);
  controls.dispose();
  assert.equal(canvas.width, 0);
  assert.equal(pool.stats().reservedBytes, 0);
  assert.deepEqual(errors, []);
});

test('narrow Studio panels wrap pooled specimens without shrinking labelled native actor sizes', async () => {
  const f = fixture(),
    draws = [];
  f.asset.animation = createSoldierAnimation('studio-native-size-review', ['torso']);
  const controls = mountActorAnimationControls({
    ...f,
    drawActor(...args) {
      draws.push({ x: args[1], y: args[2], size: args[3] });
    },
    onApply() {},
    onError(error) {
      throw error;
    },
  });
  const root = f.after.next,
    group = root.children.find((node) => node.tag === 'div');
  group.clientWidth = 224;
  root.children.find((node) => node.tag === 'button').onclick();
  await settle();
  assert.equal(group.style.display, 'flex');
  assert.equal(group.style.flexWrap, 'wrap');
  assert.deepEqual(
    draws.map(({ size }) => size),
    [16, 24, 32, 112],
  );
  const previews = canvases(root);
  assert.equal(previews.length, 4);
  for (const [index, preview] of previews.entries()) {
    assert.equal(parseFloat(preview.style.width), preview.width);
    assert.equal(parseFloat(preview.style.height), preview.height);
    assert.equal(preview.style.maxWidth, 'none');
    assert.ok(
      preview.width <= group.clientWidth,
      'Each independent specimen fits the narrow panel',
    );
    assert.ok(draws[index].x + draws[index].size < preview.width);
    assert.equal(group.children[index].style.flex, '0 0 144px');
  }
  assert.equal(pageActorArtPool(f.document).stats().reservedBytes, previewBytes);
  controls.suspend();
  assert.ok(previews.every((canvas) => canvas.width === 0 && canvas.height === 0));
  assert.equal(pageActorArtPool(f.document).stats().reservedBytes, 0);
  controls.dispose();
});

test('a nearly full page refuses the animation canvas before decoding an atlas and recovers after offload', async (t) => {
  const f = fixture();
  let decoded = 0;
  decoder(t, async () => {
    decoded++;
    return { width: 4, height: 4, close() {} };
  });
  const errors = [],
    controls = mountActorAnimationControls({
      ...f,
      onApply() {},
      onError: (error) => errors.push(error),
    }),
    pool = pageActorArtPool(f.document),
    height = (pool.stats().limit - 64) / 4,
    filler = await pool.acquire({
      key: 'remaining-visible-art',
      width: 1,
      height,
      load: () => ({ width: 1, height }),
    }),
    root = f.after.next,
    canvas = canvases(root)[0],
    buttons = root.children.filter((node) => node.tag === 'button');
  buttons[0].onclick();
  await settle();
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /decoded byte budget/);
  assert.equal(decoded, 0);
  assert.equal(canvas.width, 0);
  assert.equal(pool.stats().reservedBytes, pool.stats().limit - 64);
  filler.release();
  buttons[1].onclick();
  await settle();
  assert.equal(decoded, 1);
  assert.equal(canvas.width, 48);
  controls.dispose();
  assert.equal(pool.stats().reservedBytes, 0);
});

test('rapid animation owner replacement waits for the old codec without losing the new preview', async (t) => {
  const f = fixture();
  let finish,
    decoded = 0,
    closed = 0;
  decoder(t, () => {
    decoded++;
    if (decoded === 1)
      return new Promise((resolve) => {
        finish = resolve;
      });
    return { width: 4, height: 4, close: () => closed++ };
  });
  const errors = [],
    controls = mountActorAnimationControls({
      ...f,
      onApply() {},
      onError: (error) => errors.push(error),
    }),
    root = f.after.next,
    canvas = canvases(root)[0],
    load = root.children.find((node) => node.tag === 'button');
  load.onclick();
  await settle();
  f.setContext({ ...f.getContext(), document: {} });
  controls.refresh();
  load.onclick();
  await settle();
  assert.equal(decoded, 1);
  assert.deepEqual(errors, []);
  finish({ width: 4, height: 4, close: () => closed++ });
  await settle();
  assert.equal(decoded, 2);
  assert.equal(closed, 1);
  assert.equal(canvas.width, 48);
  assert.equal(pageActorArtPool(f.document).stats().leases, 5);
  assert.deepEqual(errors, []);
  controls.dispose();
  assert.equal(closed, 2);
  assert.equal(pageActorArtPool(f.document).stats().reservedBytes, 0);
});

test('a retired animation decoder failure cannot replace the new owner with an error', async (t) => {
  const f = fixture();
  let fail,
    decoded = 0;
  decoder(t, () => {
    if (decoded++ === 0)
      return new Promise((resolve, reject) => {
        fail = reject;
      });
    return { width: 4, height: 4, close() {} };
  });
  const errors = [],
    controls = mountActorAnimationControls({
      ...f,
      onApply() {},
      onError: (error) => errors.push(error),
    }),
    root = f.after.next,
    load = root.children.find((node) => node.tag === 'button');
  load.onclick();
  await settle();
  f.setContext({ ...f.getContext(), document: {} });
  controls.refresh();
  load.onclick();
  await settle();
  fail(new Error('Retired codec rejected its source'));
  await settle();
  assert.equal(decoded, 2);
  assert.deepEqual(errors, []);
  assert.equal(canvases(root)[0].width, 48);
  controls.dispose();
  assert.equal(pageActorArtPool(f.document).stats().reservedBytes, 0);
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
    croppedImage(asset, bytes, { isCurrent: () => true, slotId: 'enemy.bouncer' }, (release) =>
      left.push(release),
    ),
    croppedImage(asset, bytes, { isCurrent: () => true, slotId: 'enemy.bouncer' }, (release) =>
      right.push(release),
    ),
  ]);
  assert.strictEqual(a, b);
  assert.equal(decoded, 1);
  left.forEach((release) => release());
  assert.equal(closed, 0);
  right.forEach((release) => release());
  assert.equal(closed, 1);
  assert.equal(pageActorArtPool(f.document).stats().reservedBytes, 0);
});

test('closing a Studio crop rejects immediately but preserves the source until its codec settles', async (t) => {
  const f = fixture(),
    prior = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: f.document });
  t.after(() => {
    if (prior) Object.defineProperty(globalThis, 'document', prior);
    else delete globalThis.document;
  });
  let finish,
    sourceClosed = 0,
    cropClosed = 0;
  const original = { width: 4, height: 4, close: () => sourceClosed++ };
  decoder(t, async (source) => {
    if (source instanceof Blob) return original;
    assert.strictEqual(source, original);
    return new Promise((resolve) => (finish = resolve));
  });
  const asset = structuredClone(f.asset),
    owned = [],
    pool = pageActorArtPool(f.document);
  asset.geometry.frame = { x: 1, y: 1, width: 2, height: 2 };
  const pending = croppedImage(
      asset,
      new Map([[asset.file.sha256, new Blob(['review'])]]),
      { isCurrent: () => true, slotId: 'enemy.bouncer' },
      (release) => owned.push(release),
    ),
    rejected = assert.rejects(pending, { name: 'AbortError' });
  await settle();
  assert.equal(typeof finish, 'function');
  owned.forEach((release) => release());
  await rejected;
  assert.equal(sourceClosed, 0);
  assert.equal(pool.stats().reservedBytes, 64 + 16);
  finish({ width: 2, height: 2, close: () => cropClosed++ });
  await settle();
  assert.equal(sourceClosed, 1);
  assert.equal(cropClosed, 1);
  assert.equal(pool.stats().reservedBytes, 0);
});

test('one preview can close before a shared crop starts without rejecting the surviving preview', async (t) => {
  const f = fixture(),
    prior = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: f.document });
  t.after(() => {
    if (prior) Object.defineProperty(globalThis, 'document', prior);
    else delete globalThis.document;
  });
  let crops = 0,
    sourceClosed = 0,
    cropClosed = 0;
  const original = { width: 4, height: 4, close: () => sourceClosed++ },
    crop = { width: 2, height: 2, close: () => cropClosed++ };
  decoder(t, async (source) => {
    if (source instanceof Blob) return original;
    assert.strictEqual(source, original);
    assert.equal(sourceClosed, 0);
    crops++;
    return crop;
  });
  const asset = structuredClone(f.asset),
    bytes = new Map([[asset.file.sha256, new Blob(['review'])]]),
    left = [],
    right = [];
  asset.geometry.frame = { x: 1, y: 1, width: 2, height: 2 };
  const first = croppedImage(
      asset,
      bytes,
      {
        slotId: 'enemy.bouncer',
        isCurrent() {
          // Both original acquisitions have settled. Close the first owner
          // before the new crop's scheduled load callback is allowed to run.
          queueMicrotask(() => left.forEach((release) => release()));
          return true;
        },
      },
      (release) => left.push(release),
    ),
    rejected = assert.rejects(first, { name: 'AbortError' }),
    second = croppedImage(
      asset,
      bytes,
      { slotId: 'enemy.bouncer', isCurrent: () => true },
      (release) => right.push(release),
    );
  await rejected;
  assert.strictEqual(await second, crop);
  assert.equal(crops, 1);
  assert.equal(sourceClosed, 0);
  assert.equal(cropClosed, 0);
  right.forEach((release) => release());
  assert.equal(sourceClosed, 1);
  assert.equal(cropClosed, 1);
  assert.equal(pageActorArtPool(f.document).stats().reservedBytes, 0);
});

test('Studio clip selection reaches the procedural sampler with stationary warning/recovery pose vocabulary', async () => {
  const f = fixture(),
    calls = [];
  f.asset.animation = createSoldierAnimation('studio-clip-regression', ['torso', 'arms', 'boots']);
  const original = structuredClone(f.asset);
  const controls = mountActorAnimationControls({
    ...f,
    drawActor(...args) {
      calls.push(args.at(-1));
    },
    onApply() {
      assert.fail('Preview cannot stage an immutable revision');
    },
    onError(error) {
      throw error;
    },
  });
  const root = f.after.next;
  root.children.find((node) => node.tag === 'button').onclick();
  await settle();
  const clip = root.children.flatMap((node) => node.children).find((node) => node.tag === 'select');
  for (const name of ACTOR_CLIPS) {
    calls.length = 0;
    clip.value = name;
    clip.oninput();
    assert.equal(calls.length, 4, 'Every admitted review size receives the same selected clip');
    for (const options of calls) {
      assert.equal(options.animationClip, name);
      assert.strictEqual(
        sampleActorAnimation(options.animation, {
          clip: options.animationClip,
          timeMs: options.timeMs,
        }),
        options.animation.frames.find(
          (frame) => frame.id === options.animation.clips[name].frames[0],
        ),
      );
      if (name === 'anticipation') {
        assert.equal(options.state, 'warning');
        assert.equal(options.phase, 'warning');
      } else if (name === 'recovery') {
        assert.equal(options.state, 'recover');
        assert.equal(options.phase, 'rest');
      } else if (name === 'aim' || name === 'fire') {
        assert.equal(options.state, 'warning');
        assert.equal(options.phase, name);
      } else if (name === 'move') assert.equal(options.state, 'walk');
    }
  }
  assert.deepEqual(f.asset, original);
  controls.dispose();
});

test('Studio follows an explicit overhead review link while preserving its historical default', async (t) => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'location');
  t.after(() => {
    if (prior) Object.defineProperty(globalThis, 'location', prior);
    else delete globalThis.location;
  });
  for (const [search, revision] of [
    ['', 'industrial-pilot-v1'],
    ['?artReview=industrial-overhead-v2', 'industrial-overhead-v2'],
  ]) {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { href: `https://example.test/authoring/asset-studio/${search}` },
    });
    const f = fixture(),
      calls = [];
    f.asset.animation = createSoldierAnimation('studio-review-revision', ['torso']);
    const controls = mountActorAnimationControls({
      ...f,
      drawActor(...args) {
        calls.push(args.at(-1));
      },
      onApply() {},
      onError(error) {
        throw error;
      },
    });
    f.after.next.children.find((node) => node.tag === 'button').onclick();
    await settle();
    assert.equal(calls.length, 4);
    assert.ok(calls.every((options) => options.artRevision === revision));
    controls.dispose();
  }
});

test('Studio can scrub to the last frame of a maximum-duration admitted atlas clip', async (t) => {
  const f = fixture(),
    animation = structuredClone(createSoldierAnimation('studio-long-clip', ['torso']));
  animation.rig = 'sprite.v1';
  animation.frames = Array.from({ length: 32 }, (_, index) => ({
    id: `long-frame-${index}`,
    durationMs: 2000,
    stride: 0,
    breath: 0,
    accessory: 0,
    region: { x: index === 31 ? 3 : 0, y: 0, width: 1, height: 1 },
  }));
  for (const clip of Object.values(animation.clips)) clip.frames = [animation.frames[0].id];
  animation.clips.move.frames = animation.frames.map((frame) => frame.id);
  f.asset.animation = animation;
  decoder(t, async () => ({ width: 4, height: 4, close() {} }));
  const controls = mountActorAnimationControls({
    ...f,
    onApply() {
      assert.fail('Scrubbing cannot stage an asset revision');
    },
    onError(error) {
      throw error;
    },
  });
  const root = f.after.next,
    nested = root.children.flatMap((node) => node.children),
    clip = nested.find((node) => node.tag === 'select'),
    time = nested.find((node) => node.type === 'range'),
    readout = nested.find((node) => node.tag === 'output'),
    drawnRegions = [];
  canvases(root)[0].getContext('2d').drawImage = (_image, x, y) => drawnRegions.push([x, y]);
  root.children.find((node) => node.tag === 'button').onclick();
  await settle();
  clip.value = 'move';
  clip.oninput();
  assert.equal(Number(time.max), 63999);
  assert.equal(Number(time.step), 1);
  time.value = time.max;
  drawnRegions.length = 0;
  time.oninput();
  assert.match(readout.textContent, /63999 \/ 63999/);
  assert.deepEqual(drawnRegions, [
    [3, 0],
    [3, 0],
    [3, 0],
    [3, 0],
  ]);
  clip.value = 'idle';
  clip.oninput();
  assert.equal(Number(time.max), 1999);
  assert.equal(Number(time.value), 1999, 'A shorter clip clamps the existing scrub position');
  assert.match(readout.textContent, /1999 \/ 1999/);
  assert.deepEqual(f.asset.animation, animation);
  controls.dispose();
  assert.equal(pageActorArtPool(f.document).stats().reservedBytes, 0);
});

test('Studio offers only admitted clips and replaces a removed optional selection with labelled Idle', async () => {
  const f = fixture(),
    calls = [],
    animation = structuredClone(createSoldierAnimation('studio-optional-clips', ['torso']));
  f.asset.animation = animation;
  const controls = mountActorAnimationControls({
    ...f,
    drawActor(...args) {
      calls.push(args.at(-1));
    },
    onApply() {},
    onError(error) {
      throw error;
    },
  });
  const root = f.after.next,
    buttons = root.children.filter((node) => node.tag === 'button'),
    nested = root.children.flatMap((node) => node.children),
    clip = nested.find((node) => node.tag === 'select'),
    input = nested.find((node) => node.tag === 'textarea');
  buttons[0].onclick();
  await settle();
  clip.value = 'fire';
  clip.oninput();
  assert.equal(calls.at(-1).animationClip, 'fire');
  const edited = JSON.parse(input.value);
  delete edited.clips.aim;
  delete edited.clips.fire;
  input.value = JSON.stringify(edited);
  calls.length = 0;
  buttons[1].onclick();
  await settle();
  assert.equal(clip.value, 'idle');
  assert.equal(calls.length, 4);
  assert.ok(calls.every((options) => options.animationClip === 'idle'));
  for (const option of clip.children) {
    const missing = option.value === 'aim' || option.value === 'fire';
    assert.equal(option.hidden, missing);
    assert.equal(option.disabled, missing);
  }
  assert.ok(f.asset.animation.clips.fire, 'Preview editing does not mutate the original asset');
  controls.dispose();
});
