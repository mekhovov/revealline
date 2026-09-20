import test from 'node:test';
import assert from 'node:assert/strict';
import { drawPlayerLocator } from '../ui/player-locator.mjs';
import { PRESENTATION_INK, PRESENTATION_PLATE } from '../ui/actor-presentation.mjs';

function surface() {
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => calls.push({ op: key, args, ...target });
      },
    },
  );
  return { ctx, calls };
}

test('craft locator has static dual-contrast corners, never a filled shield or altered hitbox', () => {
  const input = Object.freeze({
    x: 200,
    y: 200,
    diameter: 24,
    screenScale: 1,
    width: 1152,
    height: 576,
  });
  const { ctx, calls } = surface();
  drawPlayerLocator(ctx, input);
  assert.equal(calls.filter((c) => c.op === 'moveTo').length, 4);
  assert.equal(calls.filter((c) => c.op === 'lineTo').length, 8);
  assert.equal(
    calls.some((c) => ['arc', 'fill', 'fillRect', 'drawImage'].includes(c.op)),
    false,
  );
  const strokes = calls.filter((c) => c.op === 'stroke');
  assert.deepEqual(
    strokes.map((c) => [c.strokeStyle, c.lineWidth, c.globalAlpha]),
    [
      [PRESENTATION_PLATE, 5, 1],
      [PRESENTATION_INK, 2, 1],
    ],
  );
  assert.equal(calls[0].op, 'save');
  assert.equal(calls.at(-1).op, 'restore');
});

test('locator strokes keep CSS size and remain inside the board at all eight edge positions', () => {
  for (const widthCSS of [240, 390, 480, 960, 1152]) {
    const scale = widthCSS / 1152;
    for (const [x, y] of [
      [8, 8],
      [576, 8],
      [1144, 8],
      [8, 288],
      [1144, 288],
      [8, 568],
      [576, 568],
      [1144, 568],
    ]) {
      const { ctx, calls } = surface();
      drawPlayerLocator(ctx, {
        x,
        y,
        diameter: 24 / scale,
        screenScale: scale,
        width: 1152,
        height: 576,
      });
      const points = calls.filter((c) => ['moveTo', 'lineTo'].includes(c.op));
      for (const {
        args: [px, py],
      } of points) {
        assert(px - 2.5 / scale >= -1e-10 && px + 2.5 / scale <= 1152 + 1e-10);
        assert(py - 2.5 / scale >= -1e-10 && py + 2.5 / scale <= 576 + 1e-10);
      }
      assert.equal(calls.find((c) => c.op === 'stroke').lineWidth * scale, 5);
    }
  }
});

test('invalid geometry paints nothing; untrusted display scale remains bounded', () => {
  const base = { x: 200, y: 200, diameter: 24, screenScale: 1, width: 1152, height: 576 };
  for (const patch of [
    { x: NaN },
    { y: Infinity },
    { diameter: NaN },
    { width: 0 },
    { height: -1 },
  ]) {
    const { ctx, calls } = surface();
    drawPlayerLocator(ctx, { ...base, ...patch });
    assert.deepEqual(calls, []);
  }
  for (const screenScale of [NaN, Infinity, -1, 0, 10]) {
    const { ctx, calls } = surface();
    drawPlayerLocator(ctx, { ...base, screenScale });
    assert(calls.flatMap((c) => c.args).every(Number.isFinite));
  }
});
