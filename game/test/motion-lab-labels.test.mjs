import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAbilityState, validateAbilityPresets } from '../../authoring/motion-lab/ability.mjs';
import {
  createAbilityLabelPainter,
  describeAbilityLabels,
} from '../../authoring/motion-lab/ability-labels.mjs';

const config = validateAbilityPresets(
  JSON.parse(
    readFileSync(
      new URL('../../authoring/motion-lab/ability-presets.json', import.meta.url),
      'utf8',
    ),
  ),
);
const style = { family: 'system-ui', minimum: 18 };
const descriptor = (canvasText, x = 24, y = 18) => ({ canvasText, x, y });
function context({ ink = false, factor = 0.6 } = {}) {
  return {
    calls: [],
    measured: [],
    factor,
    measureText(text) {
      this.measured.push(text);
      const size = Number.parseFloat(this.font.split(' ')[1]);
      const width = Array.from(text).length * size * this.factor;
      return ink
        ? {
            width,
            actualBoundingBoxLeft: width / 2 + 0.1,
            actualBoundingBoxRight: width / 2 + 0.15,
            actualBoundingBoxAscent: size * 0.8,
            actualBoundingBoxDescent: size * 0.3,
          }
        : { width };
    },
    fillText(...args) {
      this.calls.push({ args, font: this.font, metrics: this.measureText(args[0]) });
    },
  };
}
function assertInside(call) {
  const [, x, y] = call.args;
  const size = Number.parseFloat(call.font.split(' ')[1]);
  const { metrics } = call;
  const left = metrics.actualBoundingBoxLeft ?? metrics.width / 2;
  const right = metrics.actualBoundingBoxRight ?? metrics.width / 2;
  const ascent = metrics.actualBoundingBoxAscent ?? size;
  const descent = metrics.actualBoundingBoxDescent ?? size * 0.25;
  assert.ok(x - left >= 0.2 - 1e-10);
  assert.ok(x + right <= 47.8 + 1e-10);
  assert.ok(y - ascent >= 0.2 - 1e-10);
  assert.ok(y + descent <= 35.8 + 1e-10);
  assert.equal(call.args.length, 3, 'No maxWidth compression is passed to canvas.');
}

test('Motion label descriptors cover actual stage roles without changing authored or toy state', () => {
  const state = createAbilityState(config),
    before = structuredClone(state);
  const definitions = structuredClone(config);
  state.targets.find((target) => target.kind === 'ground').status = 'clear';
  before.targets.find((target) => target.kind === 'ground').status = 'clear';
  const labels = describeAbilityLabels(state, config, 'fpv-front');
  assert.equal(
    labels.length,
    config.stage.haze.length + config.stage.supplyPads.length + state.targets.length,
  );
  assert.equal(new Set(labels.map((item) => item.key)).size, labels.length);
  assert.deepEqual(
    new Set(labels.map((item) => item.kind)),
    new Set(['haze', 'pad', 'note', 'ground', 'air', 'delivery', 'relay']),
  );
  assert.equal(labels.find((item) => item.key === 'target:tile-a').canvasText, 'A');
  assert.equal(labels.find((item) => item.key === 'target:tile-a').text, 'Tile A');
  assert.equal(labels.find((item) => item.key === 'target:tile-a').status, 'clear');
  assert.equal(labels.find((item) => item.kind === 'pad').canvasText, 'Supply pad · R');
  assert.equal(labels.find((item) => item.kind === 'pad').text, 'Supply pad');
  assert.equal(labels.find((item) => item.kind === 'haze').text, 'Synthetic radio haze');
  assert.deepEqual(state, before);
  assert.deepEqual(config, definitions);
});

test('Motion note descriptors conceal before first scan and exactly at expiry without leaking authored text', () => {
  const state = createAbilityState(config),
    note = state.targets.find((target) => target.kind === 'note');
  const text = 'Таємна їжа ґрунтової експедиції';
  note.label = text;
  const own = () =>
    describeAbilityLabels(state, config, 'fpv-front').find(
      (item) => item.key === `target:${note.id}`,
    );
  assert.equal(own().canvasText, '?');
  assert.equal(own().text, 'Concealed note');
  assert.equal(JSON.stringify(own()).includes(text), false);
  note.revealedUntil = 2;
  state.time = 1.999;
  assert.equal(own().text, text);
  assert.equal(own().concealed, false);
  state.time = 2;
  assert.equal(own().text, 'Concealed note');
  assert.equal(own().concealed, true);
  assert.equal(own().status, 'ready', 'A scanned note does not become a completed marker.');
  Object.defineProperty(note, 'label', {
    get() {
      throw new Error('Concealed authored text was read');
    },
  });
  const ctx = context();
  createAbilityLabelPainter()(ctx, own(), 4, '#fff', style);
  assert.equal(ctx.calls[0].args[0], '?');
  assert.equal(
    ctx.measured.some((value) => value.includes(text)),
    false,
  );
});

test('Motion short labels and exact-fit text retain text and minimum size without compression', () => {
  const painter = createAbilityLabelPainter();
  for (const minimum of [14, 18])
    for (const pixels of [4, 20, 40]) {
      const ctx = context();
      painter(ctx, descriptor('Ґ Є І Ї'), pixels, '#fff', { ...style, minimum });
      assert.equal(ctx.calls[0].args[0], 'Ґ Є І Ї');
      assert.ok(Number.parseFloat(ctx.calls[0].font.split(' ')[1]) * pixels >= minimum - 1e-10);
      assertInside(ctx.calls[0]);
    }
  const ctx = context();
  ctx.measureText = (text) => ({ width: text === 'exact fit' ? 47.6 : 1 });
  painter(ctx, descriptor('exact fit'), 20, '#fff', style);
  assert.equal(ctx.calls[0].args[0], 'exact fit');
  assertInside(ctx.calls[0]);
});

for (const text of [
  'A long sentence with several words that cannot fit on a small board.',
  'Ґанок Єдність Імпульс Їжак: українські написи мають залишатися читабельними.',
  'UnbrokenWord'.repeat(40),
  'ї\u0301ʼп’ять'.repeat(30),
])
  test(`Motion long-label fitting keeps complete graphemes: ${text.slice(0, 18)}`, () => {
    const ctx = context({ ink: true });
    createAbilityLabelPainter()(ctx, descriptor(text, 47.5, 35.5), 4, '#fff', style);
    assert.equal(ctx.calls.length, 1);
    const result = ctx.calls[0].args[0];
    assert.ok(result.endsWith('…'));
    const prefix = result.slice(0, -1);
    const boundaries = new Set(['']);
    let current = '';
    for (const part of new Intl.Segmenter('uk', { granularity: 'grapheme' }).segment(text)) {
      current += part.segment;
      boundaries.add(current.trimEnd());
    }
    assert.ok(boundaries.has(prefix), 'Ellipsis never splits a combining sequence.');
    assertInside(ctx.calls[0]);
  });

test('Motion fitting clamps ink at all stage edges and relocates bottom-pad captions inside the board', () => {
  const painter = createAbilityLabelPainter();
  for (const x of [0.5, 47.5])
    for (const y of [0.5, 35.5]) {
      const ctx = context({ ink: true });
      painter(ctx, descriptor('Їжак', x, y), 4, '#fff', style);
      assertInside(ctx.calls[0]);
    }
  const altered = structuredClone(config);
  altered.stage.supplyPads[0].y = 35.5;
  altered.stage.supplyPads[0].radius = 4;
  validateAbilityPresets(altered);
  const label = describeAbilityLabels(createAbilityState(altered), altered, 'fpv-front').find(
    (item) => item.kind === 'pad',
  );
  assert.ok(label.y > 36, 'The authored caption anchor can be outside the board.');
  const ctx = context({ ink: true });
  painter(ctx, label, 4, '#fff', style);
  assertInside(ctx.calls[0]);
});

test('Motion invalid or tiny board scale never paints invalid or undersized labels', () => {
  const painter = createAbilityLabelPainter();
  for (const pixels of [0, -1, NaN, Infinity, 0.01, Number.MIN_VALUE]) {
    const ctx = context();
    painter(ctx, descriptor('Impossible label'), pixels, '#fff', style);
    assert.equal(ctx.calls.length, 0);
  }
  const ctx = context();
  ctx.measureText = () => ({ width: Infinity });
  painter(ctx, descriptor('Unavailable metrics'), 4, '#fff', style);
  assert.equal(ctx.calls.length, 0);
});

test('Motion safely uses an ellipsis when no grapheme segmenter is available', () => {
  const painter = createAbilityLabelPainter({ segmenter: null }),
    ctx = context();
  painter(ctx, descriptor('ї\u0301'), 20, '#fff', style);
  assert.equal(ctx.calls[0].args[0], 'ї\u0301');
  painter(ctx, descriptor('ї\u0301'.repeat(100)), 4, '#fff', style);
  assert.equal(ctx.calls[1].args[0], '…');
  assertInside(ctx.calls[1]);
});

test('Motion fitting remeasures font metrics after a font changes instead of retaining stale bounds', () => {
  const painter = createAbilityLabelPainter(),
    ctx = context();
  const label = descriptor('МіжнароднаДужеДовгаНазва'.repeat(3));
  painter(ctx, label, 4, '#fff', style);
  ctx.factor = 1.2;
  painter(ctx, label, 4, '#fff', style);
  assert.ok(ctx.calls[1].args[0].length < ctx.calls[0].args[0].length);
  assertInside(ctx.calls[1]);
});

test('Motion grapheme cache is reused and bounded; oversized labels still fit safely', () => {
  const real = new Intl.Segmenter('uk', { granularity: 'grapheme' });
  const calls = new Map();
  const painter = createAbilityLabelPainter({
    segmenter: {
      segment(text) {
        calls.set(text, (calls.get(text) ?? 0) + 1);
        return real.segment(text);
      },
    },
  });
  const first = 'LongUnbrokenLabel'.repeat(4),
    ctx = context();
  painter(ctx, descriptor(first), 4, '#fff', style);
  painter(ctx, descriptor(first), 4, '#fff', style);
  assert.equal(calls.get(first), 1);
  for (let i = 0; i < 200; i++) painter(ctx, descriptor(`${i}${first}`), 4, '#fff', style);
  painter(ctx, descriptor(first), 4, '#fff', style);
  assert.equal(calls.get(first), 2, 'Old labels leave the bounded cache.');
  painter(ctx, descriptor('Ї'.repeat(10000)), 4, '#fff', style);
  assertInside(ctx.calls.at(-1));
  assert.ok(ctx.calls.at(-1).args[0].endsWith('…'));
});
