import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { waitForChapterSelection } from './helpers/chapter-install-wait.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { openMissionLibrary } from './helpers/library-selection.mjs';

// Real app, pack selection, body binding and BoardPainter. Only Phaser, decoded
// images and Canvas2D calls are modeled; no claim about actual raster quality.
function renderingHarness(displayCSSWidth) {
  const contexts = new WeakMap();
  let frame;
  return {
    displayCSSWidth,
    Image: class extends PNGImage {
      set src(value) {
        if (!value || value.startsWith('data:') || value.startsWith('blob:')) {
          super.src = value;
          return;
        }
        // Actor body bindings stay file-backed and decode their actual bytes;
        // only stored reveal-picture Blob/data decoding uses the shared helper.
        const png = readFileSync(new URL(value));
        assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
        this.source = value;
        this.fileSha256 = createHash('sha256').update(png).digest('hex');
        this.width = this.naturalWidth = png.readUInt32BE(16);
        this.height = this.naturalHeight = png.readUInt32BE(20);
        assert.ok(this.width > 0 && this.height > 0);
        this.pending = Promise.resolve();
        queueMicrotask(() => {
          if (this.source === value) this.onload?.();
        });
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

const approvedImages = {
  'player.scout.compact': ['827da59e870daf2e8548168399449bd894b4cdf7953a1f8ca48a7ed6df8f8d91', 32],
  'player.scout.detailed': ['3fa6527474d2da84fed128052df7ee8ac2b34a25eaf5a162d21be849a12fd65c', 64],
  'enemy.bouncer': ['e35ca174c360d5a572c72e6be448666cf3da1438cf0d91f8ea7ff8c221b8eb5e', 32],
};
function approvedImage(painter, slot) {
  const sprite = painter.presentation?.image(slot),
    [sha256, size] = approvedImages[slot];
  assert.ok(sprite, `Approved ${slot} must be decoded, not substituted by a fallback.`);
  assert.equal(sprite.asset.id, `${slot}.field-kit`);
  assert.equal(sprite.asset.revision, 2);
  assert.equal(sprite.asset.file.sha256, sha256);
  assert.equal(sprite.image.naturalWidth ?? sprite.image.width, size);
  assert.equal(sprite.image.naturalHeight ?? sprite.image.height, size);
  return sprite.image;
}
function playerSpan({ painter, context, run }, displayCSSWidth, sourceBody = false) {
  assert.equal(painter.style, 'hybrid');
  let image, binding;
  if (sourceBody) {
    // This retained Classic chapter deliberately owns its original source body.
    assert.equal(painter.bodyId, 'fpv-body');
    image = painter.image;
    binding = 'retained fpv-body source';
    assert.match(image.src, /authoring\/motion-lab\/assets\/fpv-body\.png$/);
    assert.equal(
      image.fileSha256,
      '31a742f952415fb9dd2742eb9ba7ef1dc7a5aedca4593d817713c61932fe68c4',
    );
    assert.equal(image.naturalWidth, 1254);
    assert.equal(image.naturalHeight, 1254);
  } else {
    assert.equal(painter.bodyId, 'fpv-scout-v1');
    assert.equal(
      painter.image.fileSha256,
      '5d0b29fc773e08e8fdbed1e6a03726c7a16e2c5c06e89e163ab211d032cac957',
    );
    binding = displayCSSWidth < 480 ? 'player.scout.compact' : 'player.scout.detailed';
    image = approvedImage(painter, binding);
  }
  const draw = context.calls.find((c) => c.op === 'drawImage' && c.args[0] === image);
  // A decoded source body alone is insufficient when the approved release
  // presentation owns this attempt. Require its actual compact/detailed draw.
  assert.ok(draw, `The bound ${binding} image must actually reach the painter.`);
  return (Math.max(draw.args[3], draw.args[4]) * displayCSSWidth) / run.width;
}

function firstEnemySpan({ painter, context, run }, displayCSSWidth) {
  const enemy = run.enemies[0],
    image = approvedImage(painter, 'enemy.bouncer');
  assert.equal(enemy.type, 'bouncer');
  const start = context.calls.findIndex(
    (c) =>
      c.op === 'translate' &&
      c.args[0] === Math.round(enemy.x * 16) &&
      c.args[1] === Math.round(enemy.y * 16),
  );
  assert.ok(start >= 0);
  const draw = context.calls.slice(start).find((c) => c.op === 'drawImage' && c.args[0] === image);
  assert.ok(draw, 'The first bouncer draws its exact approved release image.');
  return (Math.max(draw.args[3], draw.args[4]) * displayCSSWidth) / (run.width * 16);
}

for (const width of [306, 600]) {
  test(`actual solo host passes ${width}px visible width into its detached legacy and Classic textures`, async (t) => {
    const rendering = renderingHarness(width),
      page = await soloPage(t, { titleScreen: true, rendering });
    await settle(
      () => rendering.frame.painter.image !== null,
      `Initial player image loaded: ${JSON.stringify({
        body: rendering.frame.painter.bodyId,
        warning: rendering.frame.painter.lookWarning,
        asset: page.$('asset-status')?.textContent,
        errors: page.errors.map(String),
      })}`,
    );
    page.frame(0);
    const canvas = page.$('game-canvas').querySelector('canvas');
    assert.equal(canvas.clientWidth, width);
    assert.equal(rendering.frame.run.width, 48);
    assert.equal(rendering.frame.context.canvas.clientWidth, 0);
    assert.equal(rendering.frame.context.canvas.isConnected, false);
    assert.equal(rendering.frame.options.displayCSSWidth, width);
    const minimum = width >= 480 ? 24 : 16;
    assert.ok(playerSpan(rendering.frame, width) >= minimum - 1e-9);

    await openMissionLibrary(page, 'shell-play');
    assert.equal(page.$('journey-chooser').open, true);
    assert.equal(page.$('journey-chooser').contains(page.$('mission-picker-setup')), true);
    // Model the native Flight setup disclosure; real selector/painter paths run.
    page.$('mission-picker-setup').open = true;
    page.$('mission-picker-setup').emit('toggle');
    assert.equal(page.$('mission-picker-setup').open, true);
    page.change('pack-select', 'fpv-arcade-r5');
    await waitForChapterSelection(
      t,
      page,
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
    assert.ok(playerSpan(current, width, true) >= minimum - 1e-9);
    assert.ok(playerSpan(current, width, true) <= 32 + 1e-9);
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
    assert.ok(playerSpan(current, width, true) < minimum);
    assert.ok(firstEnemySpan(current, width) < (width >= 480 ? 18 : 12));

    canvas.clientWidth = width === 306 ? 600 : 306;
    page.frame(0);
    assert.equal(rendering.frame.options.displayCSSWidth, canvas.clientWidth);
    assert.ok(
      playerSpan(rendering.frame, canvas.clientWidth, true) >=
        (canvas.clientWidth >= 480 ? 24 : 16),
    );
    assert.deepEqual(authoritativeCheckpoint(rendering.frame.run), checkpoint);
    assert.deepEqual(page.errors, []);
  });
}
