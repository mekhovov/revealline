import test from 'node:test';
import assert from 'node:assert/strict';
import { BoardPainter } from '../ui/render.mjs';
import { createSignalReception } from '../ui/signal-reception.mjs';
import { createJammerPictureFilter } from '../ui/jammer-picture.mjs';
import { createSignalNoiseAtlas } from '../ui/analog-signal.mjs';
import { createBattlefieldGroundSurface } from '../presentation/battlefield-ground.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));
function factory() {
  const surfaces = [];
  function create(width = 1, height = 1) {
    const calls = [],
      listeners = new Map(),
      stack = [];
    const canvas = {
      width,
      height,
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name) => listeners.delete(name),
    };
    const ctx = new Proxy(
      {
        canvas,
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        getImageData() {
          throw new Error('Rendering may not read pixels');
        },
        save() {
          stack.push([this.globalAlpha, this.globalCompositeOperation]);
        },
        restore() {
          [this.globalAlpha, this.globalCompositeOperation] = stack.pop();
        },
      },
      {
        get(target, key) {
          return key in target
            ? target[key]
            : (...args) =>
                calls.push({
                  op: key,
                  args,
                  alpha: target.globalAlpha,
                  composite: target.globalCompositeOperation,
                });
        },
      },
    );
    canvas.getContext = () => ctx;
    surfaces.push({ canvas, ctx, calls, listeners });
    return canvas;
  }
  return { create, surfaces };
}

test('cell caches invalidate capture, erosion, equal-coverage swaps and geometry without touching authority', () => {
  const painter = new BoardPainter({});
  const cells = new Uint8Array([1, 0, 0, 1, 2, 0]);
  const before = cells.slice();
  const first = painter.boardCells(cells, 3, 2);
  assert.equal(painter.boardCells(cells, 3, 2), first);
  assert.equal(painter.boardCells(cells.slice(), 3, 2), first);
  assert.deepEqual(cells, before);
  [cells[0], cells[1]] = [cells[1], cells[0]];
  const swapped = painter.boardCells(cells, 3, 2);
  assert.notEqual(swapped, first);
  assert.notDeepEqual(swapped.covered, first.covered);
  assert.notDeepEqual(swapped.boundary, first.boundary);
  cells[1] = 0;
  assert.notEqual(painter.boardCells(cells, 3, 2), swapped);
  const old = painter.cellRuns;
  assert.notEqual(painter.boardCells(cells, 2, 3), old);
  painter.invalidate();
  assert.equal(painter.cellRuns, null);
  painter.dispose();
});

test('owned layers paint once, invalidate dependencies, keep alpha outside cache and recover context loss', () => {
  const f = factory(),
    target = f.create(100, 80).getContext('2d');
  const events = [];
  const painter = new BoardPainter(
    {},
    {
      layerCanvasFactory: f.create,
      onContextLoss: (event) => events.push(['lost', event.source]),
      onContextRestored: (event) => events.push(['restored', event.source]),
    },
  );
  let paints = 0;
  const paint = (ctx) => {
    paints++;
    ctx.fillRect(1, 2, 3, 4);
  };
  target.globalAlpha = 0.5;
  painter.paintLayer('terrain', target, 100, 80, ['one'], paint);
  painter.paintLayer('terrain', target, 100, 80, ['one'], paint);
  assert.equal(paints, 1);
  assert.equal(f.surfaces[1].calls.find((call) => call.op === 'fillRect').alpha, 1);
  assert.ok(f.surfaces[0].calls.every((call) => call.alpha === 0.5));
  painter.paintLayer('terrain', target, 100, 80, ['two'], paint);
  assert.equal(paints, 2);
  const layer = f.surfaces[1];
  let prevented = false;
  layer.listeners.get('contextlost')({
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, false);
  painter.paintLayer('terrain', target, 100, 80, ['two'], paint);
  assert.equal(paints, 3, 'lost surface uses direct safe paint');
  layer.listeners.get('contextrestored')();
  painter.paintLayer('terrain', target, 100, 80, ['two'], paint);
  assert.equal(paints, 4, 'restored storage needs a complete repaint');
  assert.deepEqual(events, [
    ['lost', 'terrain'],
    ['restored', 'terrain'],
  ]);
  painter.paintLayer('huge', target, 4096, 4096, [], paint);
  assert.equal(f.surfaces.length, 2, 'oversized caches retain the direct renderer');
  assert.equal(painter.cacheStats.pixels, 8000);
  painter.dispose();
  assert.equal(layer.canvas.width, 0);
  assert.equal(layer.listeners.size, 0);
});

test('prepared reception and jammer frames never read source pixels or regenerate per-frame noise', () => {
  const f = factory(),
    target = f.create(960, 480).getContext('2d');
  const atlas = createSignalNoiseAtlas({ canvasFactory: f.create });
  atlas.prepare();
  const writes = () =>
    f.surfaces.flatMap((surface) => surface.calls).filter((call) => call.op === 'putImageData')
      .length;
  assert.equal(writes(), 4);
  for (let frame = 0; frame < 60; frame++) atlas.draw(target, 960, 480, frame, 0.7);
  assert.equal(writes(), 4);
  const reception = createSignalReception({ canvasFactory: f.create });
  reception.prepare();
  const run = { tick: 0, status: 'running', seed: 7, levelId: 'one' };
  reception.advance(run, 0, { mode: 'ready' });
  const before = writes();
  const acquired = reception.advance(run, 0.01, { mode: 'playing' });
  assert.equal(acquired.kind, 'acquire');
  assert.equal(reception.draw(target, 960, 480, acquired), true);
  assert.equal(writes(), before, 'starting the attempt keeps its prepared atlas');
  assert.equal(reception.advance(run, 0, { mode: 'playing', reduced: true }).kind, null);
  const filter = createJammerPictureFilter({ canvasFactory: f.create });
  filter.prepare();
  const image = { width: 1600, height: 900, complete: true };
  const output = filter.select(image, { strength: 0.8, time: 1, animate: true });
  assert.notEqual(output, image);
  assert.ok(output.width <= 512 && output.height <= 512);
  const prepared = writes();
  for (let frame = 0; frame < 60; frame++)
    filter.select(image, { strength: 0.8, time: frame / 12, animate: true });
  assert.equal(writes(), prepared);
  assert.ok(
    f.surfaces.some((surface) =>
      surface.calls.some(
        (call) =>
          call.op === 'drawImage' && call.composite === 'destination-in' && call.args[0] === image,
      ),
    ),
  );
  assert.equal(filter.select(image, { strength: 0 }), image);
  reception.dispose();
  filter.clear();
  atlas.clear();
});

test('look readiness waits for decode and retired non-cancelable decodes keep the reservation', async (t) => {
  const original = globalThis.Image,
    pending = [];
  globalThis.Image = class {
    constructor() {
      this.width = this.height = 10;
      pending.push(this);
    }
    set src(value) {
      this.source = value;
    }
    removeAttribute() {
      this.removed = true;
    }
    decode() {
      return new Promise((resolve) => {
        this.completeDecode = resolve;
      });
    }
  };
  t.after(() => {
    if (original === undefined) delete globalThis.Image;
    else globalThis.Image = original;
  });
  const presets = {
    characters: { body: { animationRecipe: 'one' } },
    animationRecipes: { one: {} },
  };
  const painter = new BoardPainter(presets);
  painter.makeArt = () => ({});
  t.after(() => painter.dispose());
  const look = painter.setLook({ id: 'plain' }, 'body', { player: { dataUrl: 'first' } });
  await tick();
  pending[0].onload();
  await tick();
  let ready = false;
  const wait = painter.whenReady().then(
    () => {
      ready = true;
    },
    (error) => {
      assert.equal(error.name, 'AbortError');
    },
  );
  await tick();
  assert.equal(ready, false);
  assert.equal(painter.resourceSnapshot().legacyImages.active, 1);
  const retries = [];
  for (let i = 0; i < 20; i++) {
    retries.push(painter.setLook({ id: 'plain' }, 'body', { player: { dataUrl: `retry-${i}` } }));
    await tick();
  }
  assert.equal(
    painter.resourceSnapshot().legacyImages.pending,
    1,
    'retired queued work is physically removed',
  );
  assert.equal(painter.resourceSnapshot().legacyImages.reservedPixels, 100);
  assert.equal(pending.length, 1, 'no replacement starts before the old decoder settles');
  assert.equal(pending[0].removed, true);
  pending[0].completeDecode();
  await tick();
  assert.equal(pending.length, 2);
  pending[1].onload();
  await tick();
  pending[1].completeDecode();
  await Promise.all([look, ...retries, wait]);
  assert.equal(pending[1].source, 'retry-19');
  assert.equal(painter.image, pending[1]);
  assert.equal(painter.resourceSnapshot().legacyImages.retainedPixels, 100);
  painter.dispose();
  assert.equal(painter.resourceSnapshot().legacyImages.retainedPixels, 0);
});

test('retiring multiple lost surfaces settles distinct owners without canceling restoration', () => {
  const f = factory(),
    target = f.create(64, 64).getContext('2d'),
    owners = new Set();
  const painter = new BoardPainter(
    {},
    {
      layerCanvasFactory: f.create,
      onContextLoss: ({ owner }) => owners.add(owner),
      onContextRestored: ({ owner }) => {
        owners.delete(owner);
        if (!owners.size) painter.invalidate();
      },
    },
  );
  for (const name of ['picture', 'concealment'])
    painter.paintLayer(name, target, 64, 64, [], () => {});
  f.surfaces[1].listeners.get('contextlost')();
  f.surfaces[2].listeners.get('contextlost')();
  assert.equal(owners.size, 2);
  const revision = painter.paintRevision;
  painter.invalidate();
  assert.equal(owners.size, 0);
  assert.equal(painter.layers.size, 0);
  assert.ok(painter.paintRevision > revision);
  for (const surface of f.surfaces.slice(1)) assert.equal(surface.listeners.size, 0);
  painter.dispose();
});

test('procedural picture and ground sources rebuild lost pixels and retire lost owners', () => {
  const f = factory(),
    owners = new Set();
  const callbacks = {
    onContextLoss: ({ owner }) => owners.add(owner),
    onContextRestored: ({ owner }) => owners.delete(owner),
  };
  const painter = new BoardPainter({}, callbacks);
  let generated = 0;
  painter.makeArt = () => {
    generated++;
    return f.create(384, 288);
  };
  painter.setBackgroundArt({ id: 'fixture' });
  const art = f.surfaces.at(-1),
    first = painter.background;
  art.listeners.get('contextlost')();
  assert.equal(owners.size, 1);
  art.listeners.get('contextrestored')();
  assert.equal(owners.size, 0);
  assert.equal(generated, 2);
  assert.notEqual(painter.background, first);
  assert.equal(first.width, 0);
  const ground = createBattlefieldGroundSurface({ canvasFactory: f.create, ...callbacks });
  const initial = ground.prepare('field-crossing', 1152, 576);
  const source = f.surfaces.at(-1);
  source.listeners.get('contextlost')();
  assert.equal(ground.prepare('field-crossing', 1152, 576), null);
  source.listeners.get('contextrestored')();
  assert.notEqual(ground.prepare('field-crossing', 1152, 576), initial);
  assert.equal(owners.size, 0);
  f.surfaces.at(-1).listeners.get('contextlost')();
  ground.clear();
  assert.equal(owners.size, 0);
  f.surfaces
    .find((surface) => surface.canvas === painter.background)
    .listeners.get('contextlost')();
  painter.dispose();
  assert.equal(owners.size, 0);
});
