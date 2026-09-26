import test from 'node:test';
import assert from 'node:assert/strict';
import { fitEditionBoard } from '../ui/edition-play-layout.mjs';

test('complete board fits remaining phone, tablet and desktop space without changing its aspect', () => {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [1024, 768],
    [1920, 1080],
    [3440, 1440],
  ]) {
    for (const aspect of [1, 4 / 3, 2, 3]) {
      const inset = {
        top: 104,
        bottom: height > width ? 190 : 70,
        left: width > height ? 156 : 4,
        right: 4,
      };
      const fit = fitEditionBoard({ width, height, aspect, ...inset });
      assert.ok(fit.x >= inset.left && fit.y >= inset.top);
      assert.ok(fit.x + fit.width <= width - inset.right + 1e-8);
      assert.ok(fit.y + fit.height <= height - inset.bottom + 1e-8);
      assert.ok(Math.abs(fit.width / fit.height - aspect) < 1e-8);
      assert.ok(
        Math.abs(fit.width - (width - inset.left - inset.right)) < 1e-8 ||
          Math.abs(fit.height - (height - inset.top - inset.bottom)) < 1e-8,
      );
    }
  }
});

test('invalid and exhausted viewports cannot produce unbounded CSS geometry', () => {
  assert.throws(() => fitEditionBoard({ width: 300, height: 500, aspect: Infinity }));
  assert.deepEqual(fitEditionBoard({ width: 300, height: 100, aspect: 2, top: 100 }), {
    x: 150,
    y: 100,
    width: 0,
    height: 0,
  });
});
