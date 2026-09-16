import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { inspectImageDataUrl } from '../content.mjs';

// Real app, pack selection, body binding and BoardPainter. Only Phaser, decoded
// images and Canvas2D calls are modeled; no claim about actual raster quality.
function renderingHarness(displayCSSWidth) {
  const contexts = new WeakMap();
  let frame;
  return {
    displayCSSWidth,
    Image: class {
      naturalWidth = 1280;
      naturalHeight = 1280;
      width = 1280;
      height = 1280;
      set src(value) {
        this.source = value;
        if (value.startsWith('data:')) {
          const header = inspectImageDataUrl(value);
          assert.equal(header.valid, true);
          this.width = this.naturalWidth = header.width;
          this.height = this.naturalHeight = header.height;
        } else {
          const png = readFileSync(new URL(value));
          assert.equal(png.toString('ascii', 1, 4), 'PNG');
          this.width = this.naturalWidth = png.readUInt32BE(16);
          this.height = this.naturalHeight = png.readUInt32BE(20);
        }
        queueMicrotask(() => this.onload?.());
      }
      get src() {
        return this.source;
      }
    },
    contextFor(canvas) {
      if (contexts.has(canvas)) return contexts.get(canvas);
      const calls = [],
        values = {},
        stack = [];
      const context = new Proxy(
        { canvas, calls },
        {
          get(target, key) {
            if (key in target) return target[key];
            if (key in values) return values[key];
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
    onDraw(value) {
      frame = value;
    },
    get frame() {
      return frame;
    },
  };
}

function playerSpan({ painter, context, run }, displayCSSWidth) {
  const draw = context.calls.find((c) => c.op === 'drawImage' && c.args[0] === painter.image);
  assert.ok(draw, 'the bound player image must actually reach the painter');
  return (Math.max(draw.args[3], draw.args[4]) * displayCSSWidth) / run.width;
}
function firstEnemySpan({ context, run }, displayCSSWidth) {
  const enemy = run.enemies[0];
  const start = context.calls.findIndex(
    (c) =>
      c.op === 'translate' &&
      c.args[0] === Math.round(enemy.x * 16) &&
      c.args[1] === Math.round(enemy.y * 16),
  );
  assert.ok(start >= 0);
  // Body bank is the first scale, then the original 28-unit pixel silhouette
  // is fitted to its cosmetic diameter. Its contact ring is drawn afterward.
  const scale = context.calls.slice(start).filter((c) => c.op === 'scale')[1];
  return (scale.args[0] * 28 * displayCSSWidth) / (run.width * 16);
}

for (const width of [306, 600]) {
  test(`actual solo host passes ${width}px visible width into its detached legacy and Classic textures`, async (t) => {
    const rendering = renderingHarness(width),
      page = await soloPage(t, { titleScreen: true, rendering });
    await settle(() => rendering.frame.painter.image !== null, 'initial player image loaded');
    page.frame(0);
    const canvas = page.$('game-canvas').querySelector('canvas');
    assert.equal(canvas.clientWidth, width);
    assert.equal(rendering.frame.run.width, 48);
    assert.equal(rendering.frame.context.canvas.clientWidth, 0);
    assert.equal(rendering.frame.context.canvas.isConnected, false);
    assert.equal(rendering.frame.options.displayCSSWidth, width);
    const minimum = width >= 480 ? 24 : 16;
    assert.ok(playerSpan(rendering.frame, width) >= minimum - 1e-9);

    page.$('shell-play').click();
    assert.equal(page.$('shell-missions').open, true);
    page.$('shell-prepare').click();
    assert.equal(page.$('mission-picker-setup').open, true);
    page.change('pack-select', 'fpv-arcade-r5');
    await settle(
      () =>
        !page.$('pack-select').disabled &&
        page.$('pack-select').value === 'fpv-arcade-r5' &&
        page.doc.body.dataset.pictureState === 'ready',
      'The explicitly selected Classic chapter and its original picture must be ready.',
    );
    page.frame(0);
    await settle(() => rendering.frame.painter.image !== null, 'Daybreak player image loaded');
    page.frame(0);
    const current = rendering.frame,
      checkpoint = authoritativeCheckpoint(current.run);
    assert.equal(
      current.run.ruleset,
      'xonix-core.v5',
      `${page.$('pack-status').textContent}; ${page.$('run-message').textContent}; ${page.errors}`,
    );
    assert.equal(current.run.width, 72);
    assert.equal(current.painter.bodyId, 'fpv-body');
    assert.match(current.painter.image.src, /authoring\/motion-lab\/assets\/fpv-body\.png$/);
    assert.equal(current.context.canvas.width, 1152);
    assert.equal(current.context.canvas.clientWidth, 0);
    assert.equal(current.options.displayCSSWidth, width);
    assert.ok(playerSpan(current, width) >= minimum - 1e-9);
    assert.ok(playerSpan(current, width) <= 32 + 1e-9);
    assert.ok(firstEnemySpan(current, width) >= (width >= 480 ? 24 : 16) - 1e-9);
    assert.ok(firstEnemySpan(current, width) <= 32 + 1e-9);
    assert.ok(
      current.context.calls.some(
        (c) =>
          c.op === 'arc' &&
          c.args[0] === current.run.player.x * 16 &&
          c.args[1] === current.run.player.y * 16 &&
          c.args[2] === current.run.rules.playerRadius * 16,
      ),
    );

    // Reproduce the old missing handoff using the same detached texture. This
    // is deliberately too small and demonstrates why a positive canvas fixture
    // alone could not catch the real host regression.
    current.painter.draw(current.context, current.run, 0, {
      ...current.options,
      displayCSSWidth: null,
    });
    assert.ok(playerSpan(current, width) < minimum);
    assert.ok(firstEnemySpan(current, width) < (width >= 480 ? 18 : 12));

    canvas.clientWidth = width === 306 ? 600 : 306;
    page.frame(0);
    assert.equal(rendering.frame.options.displayCSSWidth, canvas.clientWidth);
    assert.ok(
      playerSpan(rendering.frame, canvas.clientWidth) >= (canvas.clientWidth >= 480 ? 24 : 16),
    );
    assert.deepEqual(authoritativeCheckpoint(rendering.frame.run), checkpoint);
    assert.deepEqual(page.errors, []);
  });
}
