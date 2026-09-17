import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAbilityState, validateAbilityPresets } from '../../authoring/motion-lab/ability.mjs';
import { paintAbilityStage } from '../../authoring/motion-lab/render-ability.mjs';
import { canvasTextFonts } from '../text-face.mjs';

const config = validateAbilityPresets(
  JSON.parse(
    readFileSync(
      new URL('../../authoring/motion-lab/ability-presets.json', import.meta.url),
      'utf8',
    ),
  ),
);
const presets = JSON.parse(
  readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url), 'utf8'),
);
const family = 'fpv-front',
  player = { x: 6, y: 6 },
  colors = presets.themes[family].colors;
const themeFont = '"Field Kit UI", "Field Kit Mono", sans-serif';
function paint(state, options = {}, definitions = config) {
  const commands = [],
    labels = [];
  const ctx = new Proxy(
    {},
    {
      set(target, key, value) {
        target[key] = value;
        if (key !== 'font') commands.push([key, value]);
        return true;
      },
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'measureText')
          return (text) => ({
            width: String(text).length * Number.parseFloat(ctx.font.split(' ')[1]) * 0.5,
          });
        if (key === 'fillText') return (text, x, y) => labels.push({ text, x, y, font: ctx.font });
        return (...args) => commands.push([key, ...args]);
      },
    },
  );
  paintAbilityStage(ctx, state, definitions, player, { colors, pixels: 20, family, ...options });
  return { commands, labels };
}

test('Motion ability labels retain historical defaults and support Standard/Large Theme/Plain without changing stage commands', () => {
  const state = createAbilityState(config),
    before = structuredClone(state),
    original = paint(state);
  assert.ok(original.labels.length > 0);
  for (const label of original.labels) assert.equal(label.font, `500 0.7px ${themeFont}`);
  for (const pixels of [4, 20, 40])
    for (const face of ['pixel', 'plain'])
      for (const labelPixels of [14, 18]) {
        const labelFont = canvasTextFonts(face, { ui: themeFont }).ui;
        const result = paint(state, { pixels, labelFont, labelPixels });
        const reference = paint(state, { pixels });
        assert.deepEqual(
          result.commands,
          reference.commands,
          'Only label font and its edge fitting may differ',
        );
        assert.deepEqual(
          result.labels.map((item) => item.text),
          reference.labels.map((item) => item.text),
        );
        for (const item of result.labels) {
          const logical = Number.parseFloat(item.font.split(' ')[1]);
          assert.ok(
            logical * pixels >= labelPixels - 1e-10,
            'Minimum describes CSS pixels at actual board scale',
          );
          assert.ok(item.font.endsWith(labelFont));
          assert.ok(Number.isFinite(item.x) && Number.isFinite(item.y));
          const half = Array.from(item.text).length * logical * 0.25;
          assert.ok(item.x - half >= 0.2 - 1e-10 && item.x + half <= 47.8 + 1e-10);
          assert.ok(item.y - logical >= 0.2 - 1e-10);
          assert.ok(item.y + logical * 0.25 <= 35.8 + 1e-10);
        }
      }
  assert.deepEqual(state, before);
});

test('Motion label policy preserves concealed and revealed note content and does not advance the toy state', () => {
  const state = createAbilityState(config),
    note = state.targets.find((target) => target.kind === 'note');
  assert.ok(note);
  const concealed = paint(state, { labelPixels: 18, labelFont: 'system-ui' }).labels.map(
    (item) => item.text,
  );
  assert.ok(concealed.includes('?'));
  assert.equal(concealed.includes(note.label), false);
  note.revealedUntil = state.time + 1;
  const before = structuredClone(state),
    revealed = paint(state, { labelPixels: 18, labelFont: 'system-ui' }).labels.map(
      (item) => item.text,
    );
  assert.ok(revealed.includes(note.label));
  assert.deepEqual(state, before);
  state.time = note.revealedUntil;
  const expired = paint(state, { labelPixels: 18, labelFont: 'system-ui' }).labels.map(
    (item) => item.text,
  );
  assert.equal(expired.includes(note.label), false);
  assert.ok(expired.includes('?'));
});

test('Motion long canvas labels fit without changing stage geometry, effects or toy state', () => {
  const state = createAbilityState(config);
  state.effects = [
    { type: 'dash', x: 3, y: 4, toX: 6, toY: 4, until: 1 },
    { type: 'drop', x: 7, y: 8, radius: 1, until: 1 },
  ];
  state.wake = [{ x: 4, y: 4, until: 1, duration: 1 }];
  state.fields = [{ x: 24, y: 18, radius: 1 }];
  state.projectiles = [{ x: 12, y: 13 }];
  state.targets.find((target) => target.kind === 'air').netProgress = 0.2;
  state.targets.find((target) => target.kind === 'ground').status = 'clear';
  const baseline = paint(state, { pixels: 4, labelPixels: 18 });
  const definitions = structuredClone(config),
    extended = structuredClone(state);
  const long = 'Ґанок Єдність Імпульс Їжак — довга назва '.repeat(8);
  definitions.vocabulary[family].hazeLabel = long;
  definitions.vocabulary[family].supplyLabel = long;
  for (const target of extended.targets) target.label = long;
  const before = structuredClone(extended),
    configBefore = structuredClone(definitions);
  const result = paint(extended, { pixels: 4, labelPixels: 18 }, definitions);
  assert.deepEqual(
    result.commands,
    baseline.commands,
    'Only painted label text and coordinates change.',
  );
  assert.equal(result.labels.length, baseline.labels.length);
  assert.ok(
    result.labels.filter((item) => item.text !== '?').every((item) => item.text.endsWith('…')),
  );
  assert.equal(result.labels.filter((item) => item.text === '?').length, 2);
  for (const item of result.labels) {
    const fontSize = Number.parseFloat(item.font.split(' ')[1]);
    const half = item.text.length * fontSize * 0.25;
    assert.ok(item.x - half >= 0.2 - 1e-10 && item.x + half <= 47.8 + 1e-10);
    assert.ok(fontSize * 4 >= 18);
  }
  assert.deepEqual(extended, before);
  assert.deepEqual(definitions, configBefore);
});
