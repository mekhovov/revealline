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
