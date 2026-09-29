import test from 'node:test';
import assert from 'node:assert/strict';
import { attachMenuSignalLoss } from '../ui/menu-signal-loss.mjs';
import { applyAnalogSignalNoise } from '../ui/analog-signal.mjs';

function fixture({ width = 1600, height = 900, random = () => 0.5, unavailable = false } = {}) {
  let now = 0,
    next = 0,
    sourceCalls = 0,
    contextCalls = 0;
  const timers = new Map(),
    history = [],
    writes = [],
    listeners = new Map(),
    attributes = new Map();
  const state = { throws: false, absent: false, transparent: false, color: 0 };
  const doc = {
    hidden: false,
    addEventListener(name, callback) {
      listeners.set(name, callback);
    },
    removeEventListener(name, callback) {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
  };
  const source = (w, h) => {
    const pixels = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const at = (y * w + x) * 4;
        pixels[at] = x;
        pixels[at + 1] = y;
        pixels[at + 2] = 80 + state.color;
        pixels[at + 3] = state.transparent ? 0 : 255;
      }
    return pixels;
  };
  const context = {
    setTransform() {},
    clearRect() {},
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (_x, _y, w, h) => ({ data: source(w, h) }),
    putImageData(image) {
      writes.push({ time: now, pixels: image.data.slice() });
    },
  };
  const canvas = {
    ownerDocument: doc,
    width: 0,
    height: 0,
    style: {},
    setAttribute: (key, value) => attributes.set(key, value),
    // Match a hidden element's real bounds. Its positioned parent remains sized.
    getBoundingClientRect() {
      return this.hidden ? { width: 0, height: 0 } : { width, height };
    },
    parentElement: { getBoundingClientRect: () => ({ width, height }) },
    getContext(type) {
      assert.equal(type, '2d');
      contextCalls++;
      return unavailable ? null : context;
    },
  };
  const scheduler = {
    now: () => now,
    setTimeout(callback, delay) {
      const record = { id: ++next, callback, delay, at: now + delay };
      timers.set(record.id, record);
      history.push(record);
      assert.equal(timers.size, 1, 'At most one timer is owned, including during a burst.');
      return record.id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const owner = attachMenuSignalLoss({
    canvas,
    scheduler,
    random,
    drawSource(ctx, w, h) {
      sourceCalls++;
      assert.equal(ctx, context);
      assert.ok(w <= 256 && h <= 256, 'Source requests stay bounded.');
      if (state.throws) throw new Error('Unavailable source');
      return !state.absent;
    },
  });
  return {
    owner,
    canvas,
    doc,
    listeners,
    attributes,
    state,
    timers,
    history,
    writes,
    source,
    get sourceCalls() {
      return sourceCalls;
    },
    get contextCalls() {
      return contextCalls;
    },
    advance(ms) {
      const end = now + ms;
      while (timers.size) {
        const nextTimer = [...timers.values()].sort((a, b) => a.at - b.at)[0];
        if (nextTimer.at > end) break;
        now = nextTimer.at;
        timers.delete(nextTimer.id);
        nextTimer.callback();
      }
      now = end;
    },
    visible(value) {
      doc.hidden = !value;
      listeners.get('visibilitychange')?.();
    },
  };
}

test('idle owns one random delay and performs no drawing before the first burst', () => {
  const f = fixture();
  assert.equal(f.timers.size, 0);
  assert.equal(f.contextCalls, 0);
  assert.equal(f.canvas.hidden, true);
  assert.equal(f.canvas.style.pointerEvents, 'none');
  assert.equal(f.attributes.get('aria-hidden'), 'true');
  assert.ok(f.attributes.has('inert'));
  f.owner.setRunning(true);
  f.owner.setRunning(true);
  assert.equal(f.history.length, 1);
  assert.equal(f.history[0].delay, 10000);
  f.advance(9999);
  assert.equal(f.sourceCalls, 0);
  f.advance(1);
  assert.equal(f.sourceCalls, 1);
  assert.deepEqual([f.canvas.width, f.canvas.height], [256, 144]);
  assert.equal(f.canvas.style.opacity, '0', 'The burst starts transparent.');
  f.owner.dispose();
});

test('one smooth bounded burst recovers fully and leaves only its longer next delay', () => {
  const f = fixture();
  f.owner.setRunning(true);
  f.advance(10000);
  const values = [Number(f.canvas.style.opacity)];
  for (let frame = 0; frame < 8; frame++) {
    f.advance(1000 / 12);
    values.push(Number(f.canvas.style.opacity));
  }
  assert.ok(values.every((value) => value >= 0 && value <= 0.4));
  const peak = values.indexOf(Math.max(...values));
  assert.ok(peak > 0 && peak < values.length - 1);
  for (let index = 1; index <= peak; index++) assert.ok(values[index] >= values[index - 1]);
  for (let index = peak + 1; index < values.length; index++)
    assert.ok(values[index] <= values[index - 1]);
  assert.ok(values[peak] > 0.38);
  assert.ok(f.writes.length <= 9);
  for (let index = 1; index < f.writes.length; index++)
    assert.ok(f.writes[index].time - f.writes[index - 1].time >= 1000 / 12 - 0.001);
  f.advance(700 - (8 * 1000) / 12);
  assert.equal(f.canvas.hidden, true);
  assert.equal(f.canvas.style.opacity, '0');
  assert.equal(f.history.at(-1).delay, 25000);
  const reads = f.sourceCalls;
  f.advance(24999);
  assert.equal(f.sourceCalls, reads, 'No noise or source work happens in the idle gap.');
  f.advance(1);
  assert.equal(f.sourceCalls, reads + 1);
  f.owner.dispose();
});

test('the receiver uses monochrome actual source pixels, shifted rows and shared analog noise', () => {
  const f = fixture({ width: 512, height: 512 });
  f.owner.setRunning(true);
  f.advance(10000);
  const { width, height } = f.canvas,
    raw = f.source(width, height),
    gray = raw.slice(),
    expected = new Uint8ClampedArray(raw.length);
  for (let at = 0; at < gray.length; at += 4)
    gray[at] =
      gray[at + 1] =
      gray[at + 2] =
        Math.round(raw[at] * 0.2126 + raw[at + 1] * 0.7152 + raw[at + 2] * 0.0722);
  applyAnalogSignalNoise(gray, width, height, 0, expected, {
    seed: 2147483648,
    strength: 0.85,
  });
  const actual = f.writes[0].pixels;
  assert.deepEqual(actual.slice(0, width * 4), expected.slice(0, width * 4));
  const band = 128 * width * 4;
  assert.notDeepEqual(actual.slice(band, band + width * 4), expected.slice(band, band + width * 4));
  for (let at = 0; at < actual.length; at += 4) {
    assert.equal(actual[at], actual[at + 1]);
    assert.equal(actual[at], actual[at + 2]);
    assert.equal(actual[at + 3], 255);
  }
  f.state.color = 100;
  f.advance(1000 / 12);
  assert.notDeepEqual(f.writes[1].pixels, actual, 'The live source is sampled again.');
  f.owner.dispose();
});

test('portrait source sampling is aspect-preserving and bounded', () => {
  const f = fixture({ width: 900, height: 1600 });
  f.owner.setRunning(true);
  f.advance(10000);
  assert.deepEqual([f.canvas.width, f.canvas.height], [144, 256]);
  f.owner.dispose();
});

test('off and hidden immediately discard a burst, reject stale work and restart without catch-up', () => {
  const f = fixture();
  f.owner.setRunning(true);
  f.advance(10250);
  const stale = f.history.at(-1).callback,
    writes = f.writes.length;
  assert.ok(Number(f.canvas.style.opacity) > 0);
  f.owner.setRunning(false);
  assert.equal(f.canvas.hidden, true);
  assert.equal(f.timers.size, 0);
  stale();
  f.advance(90000);
  assert.equal(f.writes.length, writes);
  f.owner.setRunning(true);
  assert.equal(f.history.at(-1).delay, 10000);
  f.advance(10250);
  f.visible(false);
  assert.equal(f.timers.size, 0);
  assert.equal(f.canvas.hidden, true);
  f.advance(90000);
  f.visible(true);
  assert.equal(f.history.at(-1).delay, 10000);
  f.owner.dispose();
});

test('source reset cancels old callbacks and disposal releases every owned timer and listener', () => {
  const f = fixture();
  f.owner.setRunning(true);
  f.advance(10000);
  const stale = f.history.at(-1).callback;
  f.owner.reset();
  assert.equal(f.canvas.hidden, true);
  assert.equal(f.canvas.width, 0);
  assert.equal(f.history.at(-1).delay, 10000);
  stale();
  assert.equal(f.timers.size, 1);
  f.owner.dispose();
  f.owner.dispose();
  f.owner.reset();
  f.owner.setRunning(true);
  stale();
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
  assert.deepEqual([f.canvas.width, f.canvas.height], [0, 0]);
});

test('canvas failures stop quietly until an explicit source reset', () => {
  const f = fixture();
  f.state.throws = true;
  f.owner.setRunning(true);
  f.advance(10000);
  assert.equal(f.canvas.hidden, true);
  assert.equal(f.timers.size, 0);
  f.owner.setRunning(false);
  f.owner.setRunning(true);
  assert.equal(f.timers.size, 0);
  f.state.throws = false;
  f.owner.reset();
  f.advance(10000);
  assert.equal(f.writes.length, 1);
  f.owner.dispose();
  const noContext = fixture({ unavailable: true });
  noContext.owner.setRunning(true);
  noContext.advance(10000);
  assert.equal(noContext.timers.size, 0);
  assert.equal(noContext.canvas.hidden, true);
  noContext.owner.dispose();
});

test('absent or fully transparent source skips interference instead of producing a dark frame', () => {
  for (const state of ['absent', 'transparent']) {
    const f = fixture();
    f.state[state] = true;
    f.owner.setRunning(true);
    f.advance(10000);
    assert.equal(f.canvas.hidden, true);
    assert.equal(f.writes.length, 0);
    assert.equal(f.history.at(-1).delay, 25000);
    f.owner.dispose();
  }
});

test('injected random values stay within the authored timing ranges', () => {
  for (const value of [0, 0.999999, NaN]) {
    const f = fixture({ random: () => value });
    f.owner.setRunning(true);
    assert.ok(f.history[0].delay >= 8000 && f.history[0].delay <= 12000);
    f.advance(f.history[0].delay);
    f.advance(849);
    if (!f.canvas.hidden) f.advance(1);
    assert.equal(f.canvas.hidden, true);
    assert.ok(f.history.at(-1).delay >= 18000 && f.history.at(-1).delay <= 32000);
    f.owner.dispose();
  }
});
