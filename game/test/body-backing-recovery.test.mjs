import test from 'node:test';
import assert from 'node:assert/strict';
import { createBodyBackingOwner, paintBodyBacking } from '../ui/body-backing.mjs';
import { paintCharacter } from '../../authoring/motion-lab/render-character.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { FIXED_DT, stepRun } from '../core/index.mjs';

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
    [...(offscreen ? ['OffscreenCanvas'] : ['OffscreenCanvas', 'document'])].map((name) => [
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
  if (!offscreen)
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
  const paint = (source, selectedBody = body, owner) =>
    paintBodyBacking(target, selectedBody, source, 28, 14, owner);
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

function controlledTimers(t) {
  let next = 0;
  const pending = new Map(),
    history = [];
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    assert.equal(delay, 250, 'Recovery probes stay outside the frame loop.');
    const id = ++next;
    pending.set(id, callback);
    history.push(callback);
    return id;
  });
  t.mock.method(globalThis, 'clearTimeout', (id) => pending.delete(id));
  return {
    pending,
    history,
    tick() {
      for (const [id, callback] of [...pending]) {
        pending.delete(id);
        callback();
      }
    },
  };
}
function ownedBacking(t, callbacks = {}) {
  const events = [];
  const owner = createBodyBackingOwner({
    onContextLoss: (event) => {
      events.push(['lost', event]);
      callbacks.onContextLoss?.(event);
    },
    onContextRestored: (event) => {
      events.push(['restored', event]);
      callbacks.onContextRestored?.(event);
    },
  });
  t.after(() => owner.dispose());
  return { owner, events };
}
function paintActor(f, image, owner) {
  const context = new Proxy(
    {
      drawImage: (source, ...geometry) => {
        if (source !== image) f.target.drawImage(source, ...geometry);
      },
    },
    { get: (target, key) => (key in target ? target[key] : () => {}) },
  );
  paintCharacter(context, {
    body: { ...f.body, widthCells: 2, heightCells: 1, headingOffsetDegrees: 0 },
    image,
    recipe: { components: [] },
    animation: {},
    colors: { body: '#ffffff', accent: '#ffffff' },
    bodyBackingOwner: owner,
  });
}

test('shared masks notify distinct live owners once and preserve loss through cache invalidation', (t) => {
  const timers = controlledTimers(t),
    f = fixture(t, { query: true }),
    image = f.image();
  let first, second;
  first = ownedBacking(t, {
    onContextLoss: () => {
      first.owner.clear({ preserveLost: true });
      second.owner.clear({ preserveLost: true });
    },
  });
  second = ownedBacking(t);
  for (let frame = 0; frame < 20; frame++) {
    f.paint(image, f.body, first.owner);
    f.paint(image, f.body, second.owner);
  }
  assert.equal(f.surfaces.length, 1);
  assert.equal(f.queries.count, 1);
  assert.equal(timers.pending.size, 0);
  const surface = f.surfaces[0],
    expected = f.submissions[0].pixels;
  surface.lose();
  surface.lose();
  assert.equal(first.events.length, 1);
  assert.equal(second.events.length, 1);
  assert.notEqual(first.events[0][1].owner, second.events[0][1].owner);
  assert.equal(timers.pending.size, 1, 'Shared loss owns one probe, not one per painter.');
  first.owner.clear({ preserveLost: true });
  assert.equal(first.events.length, 1, 'Ordinary invalidation cannot discharge a lost owner.');
  surface.restore();
  assert.deepEqual(
    first.events.map(([kind]) => kind),
    ['lost', 'restored'],
  );
  assert.deepEqual(
    second.events.map(([kind]) => kind),
    ['lost', 'restored'],
  );
  assert.equal(first.events[0][1].owner, first.events[1][1].owner);
  assert.equal(first.events[1][1].retired, undefined);
  assert.equal(timers.pending.size, 0);
  f.paint(image, f.body, second.owner);
  assert.deepEqual(f.submissions.at(-1).pixels, expected);
  assert.deepEqual(f.draws, { source: 2, read: 2, write: 2 });
  first.owner.clear();
  surface.lose();
  assert.equal(first.events.length, 2, 'A detached healthy owner cannot receive future loss.');
  assert.equal(second.events.length, 3);
});

test('initially lost eventless storage recovers owned holds without another paint', (t) => {
  const timers = controlledTimers(t),
    f = fixture(t, { offscreen: true, events: false, query: true, initiallyLost: true }),
    image = f.image(),
    first = ownedBacking(t),
    second = ownedBacking(t);
  f.paint(image, f.body, first.owner);
  f.paint(image, f.body, second.owner);
  assert.equal(first.events[0][0], 'lost');
  assert.equal(second.events[0][0], 'lost');
  assert.equal(timers.pending.size, 1);
  assert.deepEqual(f.draws, { source: 0, read: 0, write: 0 });
  timers.tick();
  assert.equal(timers.pending.size, 1);
  assert.equal(first.events.length, 1);
  f.surfaces[0].lost = false;
  timers.tick();
  assert.equal(timers.pending.size, 0);
  assert.equal(first.events[1][0], 'restored');
  assert.equal(second.events[1][0], 'restored');
  assert.deepEqual(f.draws, { source: 0, read: 0, write: 0 }, 'Probes never prepare pixels.');
  f.paint(image, f.body, first.owner);
  assert.deepEqual(f.draws, { source: 1, read: 1, write: 1 });
});

test('a premature restore event cannot release ownership while native storage is lost', (t) => {
  const timers = controlledTimers(t),
    f = fixture(t, { query: true }),
    image = f.image(),
    held = ownedBacking(t);
  f.paint(image, f.body, held.owner);
  const surface = f.surfaces[0];
  surface.lose();
  surface.event('contextrestored');
  assert.equal(held.events.length, 1);
  timers.tick();
  assert.equal(held.events.length, 1);
  surface.lost = false;
  timers.tick();
  assert.deepEqual(
    held.events.map(([kind]) => kind),
    ['lost', 'restored'],
  );
  assert.equal(timers.pending.size, 0);
  assert.deepEqual(f.draws, { source: 1, read: 1, write: 1 });
});

test('retiring one shared lease preserves another hold and last retirement cancels stale probes', (t) => {
  const timers = controlledTimers(t),
    f = fixture(t, { query: true }),
    image = f.image(),
    first = ownedBacking(t),
    second = ownedBacking(t);
  f.paint(image, f.body, first.owner);
  f.paint(image, f.body, second.owner);
  const surface = f.surfaces[0];
  surface.lose();
  const staleProbe = timers.history[0];
  first.owner.dispose();
  assert.equal(first.events.at(-1)[1].retired, true);
  assert.equal(second.events.length, 1);
  assert.equal(timers.pending.size, 1);
  second.owner.clear();
  assert.equal(second.events.at(-1)[1].retired, true);
  assert.equal(timers.pending.size, 0);
  staleProbe();
  surface.restore();
  surface.lose();
  assert.equal(first.events.length, 2);
  assert.equal(second.events.length, 2);
  assert.equal(timers.pending.size, 0);
  const successor = ownedBacking(t);
  f.paint(image, f.body, successor.owner);
  assert.equal(successor.events[0][0], 'lost');
  assert.notEqual(successor.events[0][1].owner, second.events[0][1].owner);
  assert.equal(timers.pending.size, 1);
  staleProbe();
  assert.equal(timers.pending.size, 1, 'A stale callback cannot orphan its successor probe.');
  surface.restore();
  assert.equal(successor.events.at(-1)[0], 'restored');
  f.paint(image, f.body, first.owner);
  surface.lose();
  assert.equal(first.events.length, 2, 'Disposed owners cannot reacquire a shared mask.');
});

test('failed owned mask preparation detaches its callbacks before replacement', (t) => {
  const f = fixture(t, { firstFailure: 'readback' }),
    image = f.image(),
    held = ownedBacking(t);
  assert.throws(() => f.paint(image, f.body, held.owner), /Readback denied/);
  f.surfaces[0].lose();
  f.surfaces[0].restore();
  assert.deepEqual(held.events, []);
  f.paint(image, f.body, held.owner);
  f.surfaces[1].lose();
  assert.equal(held.events.length, 1);
  f.surfaces[0].restore();
  assert.equal(held.events.length, 1, 'Stale storage cannot restore its replacement.');
  f.surfaces[1].restore();
  assert.equal(held.events.length, 2);
});

test('BoardPainter character leases survive loss invalidation and retire on replacement or disposal', (t) => {
  const timers = controlledTimers(t),
    f = fixture(t, { query: true }),
    image = f.image(),
    losses = new Set(),
    events = [];
  const painter = new BoardPainter(
    {},
    {
      onContextLoss(event) {
        losses.add(event.owner);
        events.push(['lost', event]);
        painter.invalidate();
      },
      onContextRestored(event) {
        losses.delete(event.owner);
        events.push(['restored', event]);
        if (!losses.size) painter.invalidate();
      },
    },
  );
  t.after(() => painter.dispose());
  paintActor(f, image, painter.bodyBacking);
  f.surfaces[0].lose();
  assert.equal(losses.size, 1, 'Reentrant invalidation cannot erase the paused owner.');
  assert.equal(events.length, 1);
  assert.equal(timers.pending.size, 1);
  f.surfaces[0].restore();
  assert.equal(losses.size, 0);
  assert.equal(events.length, 2);
  assert.equal(timers.pending.size, 0);
  paintActor(f, image, painter.bodyBacking);
  f.surfaces[0].lose();
  assert.equal(losses.size, 1);
  painter.setLevel({ id: 'replacement' });
  assert.equal(losses.size, 0);
  assert.equal(events.at(-1)[1].retired, true);
  assert.equal(timers.pending.size, 0);
  f.surfaces[0].restore();
  paintActor(f, image, painter.bodyBacking);
  f.surfaces[0].lose();
  assert.equal(losses.size, 1);
  painter.dispose();
  assert.equal(losses.size, 0);
  const count = events.length;
  f.surfaces[0].restore();
  f.surfaces[0].lose();
  assert.equal(events.length, count);
  assert.equal(timers.pending.size, 0);
});

test('an inert native loss query cannot emit restoration or schedule recovery for healthy storage', (t) => {
  const timers = controlledTimers(t),
    f = fixture(t, { events: false, query: true }),
    image = f.image(),
    held = ownedBacking(t);
  f.paint(image);
  const query = t.mock.method(f.surfaces[0].context, 'isContextLost', () => undefined);
  for (let frame = 0; frame < 20; frame++) f.paint(image, f.body, held.owner);
  assert.equal(query.mock.callCount(), 20);
  assert.deepEqual(held.events, [], 'A neutral native query does not restore an unlost owner.');
  assert.equal(timers.pending.size, 0);
  assert.equal(f.surfaces.length, 1);
  assert.deepEqual(f.draws, { source: 1, read: 1, write: 1 });
});

test(
  'a masked character surface pauses Solo and repaints before explicit Resume',
  { timeout: 120000 },
  async (t) => {
    const page = await soloPage(t),
      f = fixture(t, { offscreen: true }),
      image = f.image(),
      original = BoardPainter.prototype.draw;
    let painter;
    // The established host models the board renderer. Forward its recording and
    // exercise the real character/backing path with that host's real painter lease.
    const draw = t.mock.method(BoardPainter.prototype, 'draw', function (...args) {
      original.apply(this, args);
      painter = this;
      paintActor(f, image, this.bodyBacking);
    });
    const start = async () => {
      page.$('start-button').click();
      await settle(
        () => page.doc.body.dataset.flightState === 'running',
        'Owned renderer is ready.',
        {
          timeoutMs: 20000,
        },
      );
      page.frame(0);
    };
    try {
      await start();
      page.key('ArrowDown');
      page.frame(100);
      const run = page.rendered.run,
        before = authoritativeCheckpoint(run),
        surface = f.surfaces[0],
        reads = f.draws.read;
      assert.ok(surface, 'Prepared character drawing must acquire its mask lease.');
      surface.lose();
      assert.equal(page.doc.body.dataset.flightState, 'paused');
      page.$('start-button').click();
      page.frame(1000);
      assert.deepEqual(authoritativeCheckpoint(run), before);
      assert.equal(f.draws.read, reads, 'A paused lost mask performs no pixel preparation.');
      surface.restore();
      page.frame(0);
      page.frame(10000);
      assert.equal(page.doc.body.dataset.flightState, 'paused');
      assert.deepEqual(authoritativeCheckpoint(run), before);
      assert.ok(f.draws.read > reads, 'Restoration repaints the backing while the run is paused.');
      await start();
      assert.equal(page.rendered.run, run);
      assert.deepEqual(authoritativeCheckpoint(run), before);
      const expected = structuredClone(run);
      for (let tick = 0; tick < 12; tick++) stepRun(expected, { direction: 'down' }, FIXED_DT);
      page.frame(100);
      assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(expected));
      assert.deepEqual(page.errors, []);
    } finally {
      draw.mock.restore();
      painter?.bodyBacking.dispose();
    }
  },
);
