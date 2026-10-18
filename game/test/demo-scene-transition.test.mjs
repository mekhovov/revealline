import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoSceneTransition } from '../ui/demo-scene-transition.mjs';

function fixture() {
  let sampled = null,
    removed = false;
  const veil = {
    style: {},
    setAttribute() {},
    getContext: () => ({
      drawImage: (source) => {
        sampled = source;
      },
    }),
    remove: () => {
      removed = true;
    },
  };
  const canvas = { width: 768, height: 576, style: {}, parentElement: { append() {} } };
  const transition = createDemoSceneTransition(canvas, { createElement: () => veil });
  return { transition, canvas, veil, sampled: () => sampled, removed: () => removed };
}
test('loading fades only the displayed frame and holds darkness until a prepared scene arrives', () => {
  const f = fixture();
  f.transition.begin();
  assert.equal(f.sampled(), f.canvas);
  f.transition.paint(0.1);
  assert.ok(Number(f.veil.style.opacity) > 0 && Number(f.veil.style.opacity) < 1);
  assert.equal(f.canvas.style.opacity, '0');
  f.transition.begin(); // fallback notification must not restart departure
  for (let i = 0; i < 6; i++) f.transition.paint(0.1);
  assert.equal(f.veil.width, 0);
  assert.equal(f.canvas.style.opacity, '0');
  f.transition.ready();
  f.transition.paint(0.1);
  assert.ok(Number(f.canvas.style.opacity) > 0 && Number(f.canvas.style.opacity) < 1);
  for (let i = 0; i < 6; i++) f.transition.paint(0.1);
  assert.equal(f.canvas.style.opacity, '1');
  f.transition.dispose();
  assert.equal(f.removed(), true);
});
test('fast scene loading still finishes departure; privacy clearing discards the snapshot', () => {
  const f = fixture();
  f.transition.begin();
  f.transition.ready();
  f.transition.paint(0.1);
  assert.equal(f.canvas.style.opacity, '0');
  f.transition.clear();
  assert.equal(f.veil.hidden, true);
  assert.equal(f.veil.width, 0);
  assert.equal(f.canvas.style.opacity, '1');
  f.transition.begin();
  f.transition.ready();
  for (let i = 0; i < 4; i++) f.transition.paint(0.1, true);
  assert.equal(f.canvas.style.opacity, '1');
});

test('Next during arrival preserves its dimming and accepts the displayed reward frame', () => {
  const f = fixture(),
    video = {};
  f.transition.begin(video);
  assert.equal(f.sampled(), video);
  f.transition.ready();
  f.transition.paint(0.1);
  f.transition.begin();
  assert.equal(f.sampled(), video, 'Rapid Next keeps the same departing surface.');
  assert.equal(f.canvas.style.opacity, '0');
  for (let i = 0; i < 6; i++) f.transition.paint(0.1);
  assert.equal(f.canvas.style.opacity, '0');
  f.transition.ready();
  f.transition.paint(0.1);
  assert.ok(Number(f.canvas.style.opacity) < 1);
});

test('settled arrival and loading hold do not keep rewriting opacity', () => {
  const f = fixture();
  let writes = 0;
  for (const surface of [f.canvas, f.veil])
    surface.style = new Proxy(surface.style, {
      set(target, key, value) {
        writes++;
        target[key] = value;
        return true;
      },
    });
  f.transition.begin();
  for (let index = 0; index < 6; index++) f.transition.paint(0.1);
  const loadingWrites = writes;
  for (let index = 0; index < 60; index++) f.transition.paint(1 / 60);
  assert.equal(writes, loadingWrites, 'A settled loading veil needs no opacity mutations.');
  assert.equal(f.canvas.style.opacity, '0');
  f.transition.ready();
  for (let index = 0; index < 6; index++) f.transition.paint(0.1);
  assert.equal(f.canvas.style.opacity, '1');
  const arrivedWrites = writes;
  for (let index = 0; index < 60; index++) f.transition.paint(1 / 60);
  assert.equal(writes, arrivedWrites, 'A completed arrival needs no opacity mutations.');
  f.transition.begin();
  f.transition.paint(0.1);
  assert.ok(writes > arrivedWrites, 'A new departure still starts its real transition.');
  assert.equal(f.canvas.style.opacity, '0');
});

test('resource diagnostic retains only the currently allocated transition surface', () => {
  const f = fixture();
  assert.equal(f.transition.resourceSnapshot().pixels, 0);
  f.transition.begin();
  const held = f.transition.resourceSnapshot();
  assert.deepEqual(held, {
    canvases: 1,
    pixels: 768 * 576,
    rgbaBytesEstimate: 768 * 576 * 4,
    loading: true,
  });
  for (let i = 0; i < 20; i++) assert.deepEqual(f.transition.resourceSnapshot(), held);
  assert.equal(f.sampled(), f.canvas);
  f.transition.clear();
  assert.equal(f.transition.resourceSnapshot().pixels, 0);
  f.transition.begin();
  assert.equal(f.transition.resourceSnapshot().canvases, 1);
  f.transition.dispose();
  assert.equal(f.transition.resourceSnapshot().canvases, 0);
});
