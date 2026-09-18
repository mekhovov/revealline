import test from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { waitFor } from './helpers/wait-for.mjs';

// Actual Couch entry, BoardPainter and simulation; finite DOM, image dimensions,
// ResizeObserver and Canvas2D commands. This does not implement browser layout.
function renderingBoundary({ resizeObserver = true } = {}) {
  const frames = [],
    observers = [],
    contexts = new WeakMap(),
    styleWrites = [];
  let draws = 0;
  class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.targets = new Set();
      observers.push(this);
    }
    observe(target) {
      this.targets.add(target);
    }
    unobserve(target) {
      this.targets.delete(target);
    }
    disconnect() {
      this.targets.clear();
      this.disconnected = true;
    }
  }
  return {
    frames,
    observers,
    ResizeObserver: resizeObserver ? ResizeObserver : undefined,
    styleWrites,
    observeCanvas(canvas) {
      for (const key of ['width', 'height']) {
        let value = canvas.style[key];
        Object.defineProperty(canvas.style, key, {
          configurable: true,
          get: () => value,
          set(next) {
            styleWrites.push({ canvas, key, value: next });
            value = next;
          },
        });
      }
    },
    Image: class {
      width = 1280;
      height = 1280;
      naturalWidth = 1280;
      naturalHeight = 1280;
      set src(value) {
        this.source = value;
        if (value.startsWith('data:')) {
          const header = inspectImageDataUrl(value);
          assert.equal(header.valid, true);
          this.width = this.naturalWidth = header.width;
          this.height = this.naturalHeight = header.height;
        }
        queueMicrotask(() => this.onload?.());
      }
      get src() {
        return this.source;
      }
      async decode() {}
      removeAttribute(name) {
        assert.equal(name, 'src');
      }
    },
    contextFor(canvas) {
      if (contexts.has(canvas)) return contexts.get(canvas);
      const values = {},
        calls = [],
        stack = [];
      const context = new Proxy(
        { canvas, calls },
        {
          get(target, key) {
            if (key in target) return target[key];
            if (key in values) return values[key];
            if (key === 'measureText') return (text) => ({ width: String(text).length * 8 });
            if (key === 'createLinearGradient' || key === 'createRadialGradient')
              return () => ({ addColorStop() {} });
            return (...args) => {
              if (key === 'clearRect') calls.length = 0;
              calls.push({ op: key, args });
              if (key === 'save') stack.push({ ...values });
              if (key === 'restore') Object.assign(values, stack.pop());
            };
          },
          set(_target, key, value) {
            values[key] = value;
            return true;
          },
        },
      );
      contexts.set(canvas, context);
      return context;
    },
    onDraw(frame) {
      frames[frame.seat] = frame;
      draws++;
    },
    drawCount: () => draws,
    notify(target, width, height) {
      target.clientWidth = width;
      target.clientHeight = height;
      target._rect = { x: 0, y: 0, width, height };
      for (const observer of observers)
        if (observer.targets.has(target))
          observer.callback([{ target, contentRect: { width, height } }]);
    },
  };
}

async function action(page, id, type = 'click') {
  const element = page.$(id),
    handler = element[`on${type}`];
  let operation;
  element[`on${type}`] = (event) => (operation = handler?.(event));
  try {
    element.emit(type);
    await operation;
  } finally {
    element[`on${type}`] = handler;
  }
  page.frame(0);
}

async function fixture(t, { wide = false, campaign, resizeObserver = true, onMount } = {}) {
  const rendering = renderingBoundary({ resizeObserver }),
    boxes = [
      { width: 600, height: 180 },
      { width: 300, height: 400 },
    ];
  const page = await couchPage(t, {
    rendering,
    campaign,
    initialLevel: campaign ? campaign.levels[0].id : wide ? null : 'signal-01',
    fetchResponse(path) {
      if (!wide && path === '../content/packs/fpv-arcade-r5.json') return { ok: false };
      if (path instanceof URL && path.pathname.endsWith('/enemy-presentations.json'))
        return { ok: false };
    },
    beforeImport({ document, window }) {
      window.getComputedStyle = document.defaultView.getComputedStyle = (element) => ({
        display: element.hidden ? 'none' : 'block',
        visibility: 'visible',
        paddingLeft: '0px',
        paddingRight: '0px',
        paddingTop: '0px',
        paddingBottom: '0px',
        boxSizing: 'content-box',
        width: `${element.clientWidth || 0}px`,
        height: `${element.clientHeight || 0}px`,
      });
      for (const [seat, box] of boxes.entries()) {
        const canvas = document.getElementById(`race-canvas-${seat}`),
          arena = canvas.parentElement;
        rendering.observeCanvas(canvas);
        Object.assign(arena, { clientWidth: box.width, clientHeight: box.height });
        arena._rect = { x: 0, y: 0, ...box };
        // Deliberately misleading old canvas box width. Only the real host's
        // fitted displayCSSWidth handoff may correct the painter's scale.
        canvas.clientWidth = box.width;
        canvas.clientHeight = box.height;
        canvas._rect = { x: 0, y: 0, ...box };
      }
      onMount?.({ document, window, rendering });
    },
  });
  await waitFor(() => !page.$('race-start').disabled, { message: 'Actual map must prepare.' });
  await action(page, 'race-start');
  if (resizeObserver) for (const [seat, box] of boxes.entries())
    rendering.notify(page.$(`race-canvas-${seat}`).parentElement, box.width, box.height);
  page.frame(0);
  return { page, rendering, boxes };
}

function firstEnemySpan(frame, visibleWidth) {
  const enemy = frame.run.enemies[0],
    calls = frame.context.calls;
  const start = calls.findIndex(
    (call) =>
      call.op === 'translate' &&
      call.args[0] === Math.round(enemy.x * 16) &&
      call.args[1] === Math.round(enemy.y * 16),
  );
  assert.ok(start >= 0, 'The actual painter must draw the simulation-owned enemy.');
  const scale = calls.slice(start).filter((call) => call.op === 'scale')[1];
  assert.ok(scale, 'Real shared enemy silhouette sizing must be exercised.');
  return (scale.args[0] * 28 * visibleWidth) / (frame.run.width * 16);
}

for (const wide of [false, true])
  test(`actual Versus ${wide ? '2:1' : '4:3'} boards fit each seat and render at the visible bitmap scale`, async (t) => {
    const { page, rendering, boxes } = await fixture(t, { wide }),
      checkpoint = page.checkpoint();
    assert.deepEqual(
      page.renders.map((run) => run.width / run.height),
      [wide ? 2 : 4 / 3, wide ? 2 : 4 / 3],
    );
    for (const [seat, box] of boxes.entries()) {
      const frame = rendering.frames[seat],
        canvas = page.$(`race-canvas-${seat}`),
        width = Math.min(box.width, (box.height * frame.run.width) / frame.run.height);
      assert.equal(canvas.clientWidth, box.width);
      assert.ok(frame.context.calls.some((call) => call.op === 'drawImage'));
      assert.ok(
        firstEnemySpan(frame, width) >= 16 - 1e-9,
        'Height-constrained actors retain their real CSS minimum.',
      );
      assert.equal(
        frame.options.displayCSSWidth,
        width,
        'Host hands off the fitted bitmap width, not the element width.',
      );
      assert.equal(parseFloat(canvas.style.width), width);
      assert.equal(parseFloat(canvas.style.height), (width * frame.run.height) / frame.run.width);
    }
    page.frames(2, 0);
    assert.deepEqual(
      page.checkpoint(),
      checkpoint,
      'Zero-time presentation measurements do not advance the match.',
    );
  });

test('actual Versus resize follows independent touch pads and Large text without replacing either run', async (t) => {
  const { page, rendering } = await fixture(t, { wide: true }),
    runs = [...page.renders],
    checkpoint = page.checkpoint(),
    pictures = page.drawOptions.map((options) => options.backdrop),
    arenas = [0, 1].map((seat) => page.$(`race-canvas-${seat}`).parentElement);
  await action(page, 'race-pause');
  await action(page, 'race-options');
  page.$('race-touch-0').value = 'always';
  await action(page, 'race-touch-0', 'change');
  page.$('race-touch-1').value = 'off';
  await action(page, 'race-touch-1', 'change');
  page.$('race-text-size').value = 'large';
  await action(page, 'race-text-size', 'change');
  assert.equal(page.doc.body.dataset.textSize, 'large');
  await action(page, 'race-options-back');
  await action(page, 'race-start');
  assert.deepEqual(
    page.doc.querySelectorAll('.race-pad').map((pad) => pad.hidden),
    [false, true],
  );

  // Native layout is represented by independent observed content boxes, never
  // calculated by this fake DOM. Seat 0 loses height to its visible touch pad.
  rendering.notify(arenas[0], 600, 160);
  rendering.notify(arenas[1], 300, 220);
  page.frame(0);
  assert.deepEqual(
    page.drawOptions.map((options) => options.displayCSSWidth),
    [320, 300],
  );
  for (const seat of [0, 1]) {
    assert.equal(page.renders[seat], runs[seat]);
    assert.equal(page.drawOptions[seat].backdrop, pictures[seat]);
    assert.ok(firstEnemySpan(rendering.frames[seat], [320, 300][seat]) >= 16 - 1e-9);
  }
  const writes = rendering.styleWrites.length;
  rendering.notify(arenas[0], 600, 160);
  rendering.notify(arenas[1], 300, 220);
  page.frames(3, 0);
  assert.equal(
    rendering.styleWrites.length,
    writes,
    'Equal deliveries/ordinary frames do not rewrite canvas sizes.',
  );

  // A separate existing limitation: below 288px on a 72-column board, the
  // shared 64-pixel logical body cap wins over the desired 16 CSS px minimum.
  // This regression records the correct handoff without claiming that the
  // footprint correction also qualifies this narrower actor-readability case.
  rendering.notify(arenas[0], 600, 120);
  page.frame(0);
  assert.equal(page.drawOptions[0].displayCSSWidth, 240);
  const narrowSpan = firstEnemySpan(rendering.frames[0], 240);
  assert.ok(
    narrowSpan > 13.3 && narrowSpan < 13.4,
    'The existing ~13.33px cap remains explicit follow-on work.',
  );

  // Rotation crosses the constraint for only one seat; both painters retain
  // their original runs, picture bindings and independently fitted scale.
  rendering.notify(arenas[0], 280, 400);
  page.win.emit('resize');
  page.frame(0);
  assert.deepEqual(
    page.drawOptions.map((options) => options.displayCSSWidth),
    [280, 300],
  );
  assert.deepEqual(page.checkpoint(), checkpoint);
});

test('actual Versus zero/hidden bounds recover and stale observer callbacks cannot survive disposal', async (t) => {
  const { page, rendering } = await fixture(t),
    arenas = [0, 1].map((seat) => page.$(`race-canvas-${seat}`).parentElement),
    runs = [...page.renders];
  rendering.notify(arenas[0], 0, 0);
  rendering.notify(arenas[1], 300, 0);
  page.frame(0);
  for (const seat of [0, 1]) {
    assert.equal(
      page.drawOptions[seat].displayCSSWidth,
      undefined,
      'Unavailable is not a zero/NaN renderer scale.',
    );
    assert.equal(page.$(`race-canvas-${seat}`).style.width, '0px');
    assert.equal(page.$(`race-canvas-${seat}`).style.height, '0px');
  }

  page.doc.hidden = true;
  page.doc.emit('visibilitychange');
  page.win.emit('pagehide', { persisted: true });
  const previous = rendering.observers.at(-1),
    writes = rendering.styleWrites.length,
    checkpoint = page.checkpoint();
  assert.ok(previous.disconnected, 'A cached page retires its observer ownership.');
  previous.callback([{ target: arenas[0], contentRect: { width: 999, height: 999 } }]);
  assert.equal(rendering.styleWrites.length, writes);
  page.doc.hidden = false;
  page.win.emit('pageshow', { persisted: true });
  assert.notEqual(rendering.observers.at(-1), previous);
  await action(page, 'race-start');
  rendering.notify(arenas[0], 300, 400);
  rendering.notify(arenas[1], 600, 180);
  page.frame(0);
  assert.deepEqual(
    page.drawOptions.map((options) => options.displayCSSWidth),
    [300, 240],
  );
  assert.deepEqual(page.renders, runs);
  assert.deepEqual(
    page.checkpoint(),
    checkpoint,
    'Restoring the view does not simulate elapsed background time.',
  );

  const current = rendering.observers.at(-1);
  page.win.emit('pagehide', { persisted: false });
  assert.equal(page.pendingFrames(), 0, 'Terminal departure cancels the actual host RAF.');
  assert.ok(current.disconnected);
  const finalWrites = rendering.styleWrites.length,
    finalDraws = rendering.drawCount();
  for (const observer of [previous, current])
    observer.callback([{ target: arenas[0], contentRect: { width: 500, height: 500 } }]);
  page.win.emit('resize');
  page.win.emit('pageshow', { persisted: true });
  page.frames(3, 0);
  assert.equal(rendering.styleWrites.length, finalWrites);
  assert.equal(rendering.drawCount(), finalDraws);
  assert.equal(page.pendingFrames(), 0);
});


test('actual Versus fallback refits both boards before drawing a changed encounter hint without ResizeObserver', async (t) => {
  const pack = JSON.parse(await readFile(new URL('../content/packs/sentinel-relay.json', import.meta.url), 'utf8'));
  let geometryReads = 0;
  const { page, rendering } = await fixture(t, {
    campaign: pack.campaigns[0],
    resizeObserver: false,
    onMount({ document }) {
      for (const seat of [0, 1]) {
        const arena = document.getElementById(`race-canvas-${seat}`).parentElement;
        arena.clientWidth = 600;
        // A finite responsive layout boundary follows the real DOM cue state.
        // No observer, resize event, or direct run/encounter mutation causes it.
        Object.defineProperty(arena, 'clientHeight', {
          configurable: true,
          get() {
            geometryReads++;
            return document.getElementById(`racer-encounter-${seat}`).dataset.phase === 'warning'
              ? [225, 234][seat]
              : 300;
          },
        });
      }
    },
  });
  assert.equal(rendering.observers.length, 0);
  assert.deepEqual(page.drawOptions.map((options) => options.displayCSSWidth), [400, 400]);
  const runs = [...page.renders],
    pictures = page.drawOptions.map((options) => options.backdrop),
    initialCopy = [0, 1].map((seat) => page.$(`racer-encounter-instruction-${seat}`).textContent),
    transitionPaints = [],
    onDraw = rendering.onDraw;
  rendering.onDraw = (frame) => {
    onDraw(frame);
    if (frame.run.tick === 241)
      transitionPaints.push({
        seat: frame.seat,
        width: frame.options.displayCSSWidth,
        phases: [0, 1].map((seat) => page.$(`racer-encounter-${seat}`).dataset.phase),
      });
  };
  while (page.renders[0].tick < 241) page.frame(1000 / 120);
  assert.deepEqual([0, 1].map((seat) => page.$(`racer-encounter-${seat}`).dataset.phase), ['warning', 'warning']);
  assert.notDeepEqual([0, 1].map((seat) => page.$(`racer-encounter-instruction-${seat}`).textContent), initialCopy);
  assert.deepEqual(page.drawOptions.map((options) => options.displayCSSWidth), [300, 312], 'Changed encounter hints refresh both fitted widths without a window resize.');
  assert.deepEqual(transitionPaints, [
    { seat: 0, width: 300, phases: ['warning', 'warning'] },
    { seat: 1, width: 312, phases: ['warning', 'warning'] },
  ], 'Both HUDs settle before either real BoardPainter consumes the new scale.');
  for (const seat of [0, 1]) {
    assert.equal(page.renders[seat], runs[seat]);
    assert.equal(page.drawOptions[seat].backdrop, pictures[seat]);
    assert.ok(firstEnemySpan(rendering.frames[seat], [300, 312][seat]) >= 16 - 1e-9);
  }
  const checkpoint = page.checkpoint(),
    reads = geometryReads;
  page.frames(3, 0);
  assert.equal(geometryReads, reads, 'An unchanged fallback layout key does not read geometry on every frame.');
  assert.deepEqual(page.checkpoint(), checkpoint);
});
