import test from 'node:test';
import assert from 'node:assert/strict';
import { paintBodyBacking } from '../ui/body-backing.mjs';

// Deterministic ownership controls, not a native raster or device qualification.
function fixture(
  t,
  {
    offscreen = false,
    events = true,
    eventHandlers = events,
    query = false,
    initiallyLost = false,
    firstFailure = null,
  } = {},
) {
  const descriptors = new Map(
    ['OffscreenCanvas', 'document'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  t.after(() => {
    for (const [name, descriptor] of descriptors)
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
  });
  const surfaces = [],
    submissions = [],
    queries = { count: 0 },
    dimensions = { count: 0 },
    draws = { source: 0, read: 0, write: 0 };
  class Surface {
    constructor(width = 0, height = 0) {
      this.width = width;
      this.height = height;
      this.lost = initiallyLost;
      this.pixels = null;
      this.listeners = new Map();
      this.context = {
        drawImage: (image) => {
          assert.equal(this.lost, false, 'A lost backing must not read its source.');
          draws.source++;
          this.pixels = image.pixels.slice();
        },
        getImageData: () => {
          assert.equal(this.lost, false, 'A lost backing must not read pixels.');
          draws.read++;
          if (firstFailure === 'readback' && surfaces[0] === this && draws.read === 1)
            throw new Error('Readback denied.');
          return { data: this.pixels.slice() };
        },
        putImageData: (data) => {
          assert.equal(this.lost, false, 'A lost backing must not write pixels.');
          draws.write++;
          this.pixels = data.data.slice();
        },
        ...(query
          ? {
              isContextLost: () => {
                queries.count++;
                return this.lost;
              },
            }
          : {}),
      };
      if (!events) this.addEventListener = undefined;
      if (eventHandlers) {
        this.oncontextlost = null;
        this.oncontextrestored = null;
      }
      surfaces.push(this);
    }
    getContext(kind, options) {
      assert.equal(kind, '2d');
      assert.deepEqual(options, { willReadFrequently: true });
      return firstFailure === 'context' && surfaces[0] === this ? null : this.context;
    }
    addEventListener(type, callback) {
      const callbacks = this.listeners.get(type) ?? [];
      callbacks.push(callback);
      this.listeners.set(type, callbacks);
    }
    event(type) {
      let prevented = false;
      for (const callback of this.listeners.get(type) ?? [])
        callback({ preventDefault: () => (prevented = true) });
      assert.equal(prevented, false, 'Canvas2D must retain automatic restoration.');
    }
    lose() {
      this.lost = true;
      this.pixels?.fill(0);
      this.event('contextlost');
    }
    restore() {
      this.lost = false;
      this.pixels?.fill(0);
      this.event('contextrestored');
    }
  }
  Object.defineProperty(globalThis, 'OffscreenCanvas', {
    configurable: true,
    value: offscreen ? Surface : undefined,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: (tag) => {
        assert.equal(tag, 'canvas');
        assert.equal(offscreen, false);
        return new Surface();
      },
    },
  });
  const target = {
    drawImage: (canvas, ...geometry) => {
      assert.equal(canvas.lost, false, 'An unavailable backing must not be submitted.');
      submissions.push({ canvas, geometry, pixels: canvas.pixels.slice() });
    },
  };
  const body = {
    bodyBacking: { kind: 'opaque-interior', color: '#123456' },
    presentationPivot: { x: 0.25, y: 0.75 },
  };
  const image = () => {
    const pixels = new Uint8ClampedArray(7 * 7 * 4);
    for (let y = 1; y <= 5; y++)
      for (let x = 1; x <= 5; x++)
        if (x === 1 || x === 5 || y === 1 || y === 5) pixels[(y * 7 + x) * 4 + 3] = 255;
    pixels[(2 * 7 + 2) * 4 + 3] = 128;
    return {
      get naturalWidth() {
        dimensions.count++;
        return 7;
      },
      get naturalHeight() {
        dimensions.count++;
        return 7;
      },
      pixels,
    };
  };
  const paint = (source, selectedBody = body) =>
    paintBodyBacking(target, selectedBody, source, 28, 14);
  return { surfaces, submissions, queries, dimensions, draws, body, image, paint, target };
}

for (const offscreen of [false, true])
  test(`interior backing restores the same ${offscreen ? 'OffscreenCanvas' : 'HTML canvas'} without repeated loss work`, (t) => {
    const f = fixture(t, { offscreen, query: true }),
      image = f.image(),
      original = image.pixels.slice();
    f.paint(image);
    const surface = f.surfaces[0],
      expected = f.submissions[0].pixels;
    assert.equal(f.surfaces.length, 1);
    assert.equal(expected[(3 * 7 + 3) * 4 + 3], 255);
    assert.equal(expected[3], 0, 'The exterior remains transparent.');
    assert.equal(expected[(1 * 7 + 1) * 4 + 3], 0, 'Original opaque pixels are not backing.');
    assert.deepEqual([...expected.slice((3 * 7 + 3) * 4, (3 * 7 + 3) * 4 + 3)], [18, 52, 86]);
    assert.deepEqual(f.submissions[0].geometry, [-7, -10.5, 28, 14]);
    f.paint(image);
    assert.equal(f.queries.count, 1, 'Healthy event-supported hits do not poll native state.');
    assert.equal(f.dimensions.count, 2, 'Cache hits do not reread native image dimensions.');
    assert.deepEqual(f.draws, { source: 1, read: 1, write: 1 });
    surface.lose();
    for (let frame = 0; frame < 20; frame++) f.paint(image);
    assert.equal(f.surfaces.length, 1);
    assert.equal(f.submissions.length, 2);
    assert.deepEqual(f.draws, { source: 1, read: 1, write: 1 });
    surface.restore();
    assert.deepEqual(
      f.draws,
      { source: 1, read: 1, write: 1 },
      'Restoration does no eager readback.',
    );
    f.paint(image);
    assert.equal(f.submissions.at(-1).canvas, surface);
    assert.deepEqual(f.submissions.at(-1).pixels, expected);
    assert.deepEqual(f.submissions.at(-1).geometry, [-7, -10.5, 28, 14]);
    f.paint(image);
    assert.deepEqual(f.draws, { source: 2, read: 2, write: 2 });
    surface.lose();
    f.paint(image);
    surface.restore();
    f.paint(image);
    assert.equal(f.surfaces.length, 1);
    assert.deepEqual(f.submissions.at(-1).pixels, expected);
    assert.deepEqual(f.draws, { source: 3, read: 3, write: 3 });
    assert.deepEqual(image.pixels, original);
    assert.equal(surface.listeners.get('contextlost').length, 1);
    assert.equal(surface.listeners.get('contextrestored').length, 1);
  });

test('native loss state detects an eventless OffscreenCanvas loss and restoration', (t) => {
  const f = fixture(t, { offscreen: true, events: false, query: true }),
    image = f.image();
  f.paint(image);
  const surface = f.surfaces[0],
    expected = f.submissions[0].pixels;
  surface.lose();
  for (let frame = 0; frame < 20; frame++) f.paint(image);
  assert.equal(f.surfaces.length, 1);
  assert.equal(f.submissions.length, 1);
  assert.deepEqual(f.draws, { source: 1, read: 1, write: 1 });
  surface.restore();
  f.paint(image);
  assert.deepEqual(f.submissions.at(-1).pixels, expected);
  assert.deepEqual(f.draws, { source: 2, read: 2, write: 2 });
});

test('an initially lost backing waits on its single surface before its first pixel read', (t) => {
  const f = fixture(t, { offscreen: true, query: true, initiallyLost: true }),
    image = f.image();
  for (let frame = 0; frame < 20; frame++) f.paint(image);
  assert.equal(f.surfaces.length, 1);
  assert.equal(f.submissions.length, 0);
  assert.deepEqual(f.draws, { source: 0, read: 0, write: 0 });
  f.surfaces[0].restore();
  f.paint(image);
  assert.equal(f.submissions.length, 1);
  assert.deepEqual(f.draws, { source: 1, read: 1, write: 1 });
});

test('independent image and color owners survive late events from another backing', (t) => {
  const f = fixture(t),
    first = f.image(),
    next = f.image(),
    otherColor = { ...f.body, bodyBacking: { kind: 'opaque-interior', color: '#FFFFFF' } };
  f.paint(first);
  f.paint(next);
  f.paint(first, otherColor);
  const [retired, successor, other] = f.surfaces,
    expected = f.submissions.at(-1).pixels;
  retired.lose();
  retired.restore();
  retired.lose();
  f.paint(next);
  f.paint(first, otherColor);
  assert.equal(f.surfaces.length, 3);
  assert.deepEqual(f.draws, { source: 3, read: 3, write: 3 });
  assert.equal(f.submissions.at(-2).canvas, successor);
  assert.equal(f.submissions.at(-1).canvas, other);
  assert.deepEqual(f.submissions.at(-1).pixels, expected);
  f.paint(first);
  assert.equal(f.submissions.length, 5, 'Only the independently lost owner is withheld.');
});

test('without loss features the established backing remains cached and disc geometry is unchanged', (t) => {
  const f = fixture(t, { events: false }),
    image = f.image();
  for (let frame = 0; frame < 20; frame++) f.paint(image);
  assert.equal(f.surfaces.length, 1);
  assert.deepEqual(f.draws, { source: 1, read: 1, write: 1 });
  const operations = [],
    ctx = {
      beginPath: () => operations.push('begin'),
      arc: (...args) => operations.push(args),
      fill: () => operations.push('fill'),
    };
  paintBodyBacking(
    ctx,
    { bodyBacking: { kind: 'disc', color: '#abcdef', radiusRatio: 0.4 } },
    image,
    28,
    14,
  );
  assert.equal(ctx.fillStyle, '#abcdef');
  assert.deepEqual(operations, ['begin', [0, 0, 5.6000000000000005, 0, Math.PI * 2], 'fill']);
  assert.equal(f.surfaces.length, 1);
});

test('native loss state wins over a premature restore event and later recovers without an event', (t) => {
  const f = fixture(t, { query: true }),
    image = f.image();
  f.paint(image);
  const surface = f.surfaces[0],
    expected = f.submissions[0].pixels;
  surface.lose();
  surface.event('contextrestored');
  f.paint(image);
  assert.equal(f.submissions.length, 1);
  assert.deepEqual(f.draws, { source: 1, read: 1, write: 1 });
  surface.lost = false;
  f.paint(image);
  assert.deepEqual(f.submissions.at(-1).pixels, expected);
  assert.equal(f.surfaces.length, 1);
  assert.deepEqual(f.draws, { source: 2, read: 2, write: 2 });
});

for (const firstFailure of ['context', 'readback'])
  test(`a failed initial ${firstFailure} remains visible and cannot poison a newer backing`, (t) => {
    const f = fixture(t, { firstFailure }),
      image = f.image();
    assert.throws(
      () => f.paint(image),
      firstFailure === 'context' ? /context unavailable/ : /Readback denied/,
    );
    assert.equal(f.submissions.length, 0);
    f.paint(image);
    const replacement = f.surfaces[1],
      expected = f.submissions[0].pixels,
      before = { ...f.draws };
    assert.equal(f.surfaces.length, 2);
    f.surfaces[0].lose();
    f.surfaces[0].restore();
    f.paint(image);
    assert.equal(f.submissions.at(-1).canvas, replacement);
    assert.deepEqual(f.submissions.at(-1).pixels, expected);
    assert.deepEqual(f.draws, before);
    assert.equal(f.surfaces.length, 2);
  });

test('generic event-target support alone retains native loss fallback', (t) => {
  const f = fixture(t, { events: true, eventHandlers: false, query: true }),
    image = f.image();
  f.paint(image);
  const surface = f.surfaces[0],
    expected = f.submissions[0].pixels;
  surface.lost = true;
  surface.pixels.fill(0);
  for (let frame = 0; frame < 20; frame++) f.paint(image);
  assert.equal(f.surfaces.length, 1);
  assert.equal(f.submissions.length, 1);
  assert.deepEqual(f.draws, { source: 1, read: 1, write: 1 });
  surface.lost = false;
  f.paint(image);
  assert.deepEqual(f.submissions.at(-1).pixels, expected);
  assert.equal(f.queries.count, 22);
  assert.deepEqual(f.draws, { source: 2, read: 2, write: 2 });
});
