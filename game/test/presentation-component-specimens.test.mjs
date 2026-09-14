import test from 'node:test';
import assert from 'node:assert/strict';
import { componentPreview } from '../../authoring/asset-studio/component-specimens.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { Document } from './helpers/couch-dom.mjs';
const slots = createDefaultThemeBundle().slots;
const draw = (id, state, file = false) => {
  const document = new Document(),
    surface = document.createElement('div');
  document.body.append(surface);
  componentPreview(
    surface,
    slots.find((slot) => slot.id === id),
    {
      state,
      assetGeometry: { nineSlice: { top: 6, right: 5, bottom: 7, left: 4 } },
    },
    file ? 'data:image/png;base64,c3BlY2ltZW4=' : null,
  );
  return surface;
};

test('component input specimens use native kinds, preserve selected state, and label errors', () => {
  for (const [kind, type] of [
    ['checkbox', 'checkbox'],
    ['radio', 'radio'],
    ['toggle', 'checkbox'],
    ['slider', 'range'],
    ['text', 'text'],
  ]) {
    const surface = draw(`ui.input.${kind}`, 'selected', true),
      input = surface.querySelector('input');
    assert.equal(input.type, type);
    assert.equal(input.getAttribute('aria-label'), `Component specimen ${kind}`);
    assert.equal(input.style.borderImageWidth, '6px 5px 7px 4px');
    if (['checkbox', 'radio', 'toggle'].includes(kind)) {
      assert.equal(input.checked, true);
      assert.equal(input.style.borderImageSlice, '6 5 7 4');
    }
    if (kind === 'toggle') assert.equal(input.getAttribute('role'), 'switch');
    if (kind === 'slider') assert.equal(input.value, '62');
    input.checked = false;
    assert.equal(input.checked, false, 'The isolated specimen remains a native editable input.');
  }
  assert.equal(
    draw('ui.input.text', 'error').querySelector('input').getAttribute('aria-invalid'),
    'true',
  );
  assert.equal(draw('ui.input.select', 'disabled').querySelector('select').disabled, true);
});

test('tooltip and chip library specimens have real associations and no fake telemetry', () => {
  const tooltip = draw('ui.tooltip', 'default'),
    trigger = tooltip.querySelector('button'),
    hint = tooltip.querySelector('[role="tooltip"]');
  assert.equal(trigger.getAttribute('aria-describedby'), hint.id);
  const chip = draw('ui.button.chip', 'selected').querySelector('button');
  assert.equal(chip.getAttribute('aria-pressed'), 'true');
  assert.equal(chip.classList.contains('chip'), true);
  const signal = draw('hud.signal', 'default', true);
  assert.match(signal.querySelector('.specimen-semantic').textContent, /symbol specimen only/);
  assert.match(
    signal.querySelector('.bounded-label').textContent,
    /not a live game control, telemetry/,
  );
  assert.equal(signal.querySelector('progress'), null);
});

test('opaque button frames preserve the state background and authored border geometry', () => {
  for (const slot of [
    'ui.button.primary',
    'ui.button.secondary',
    'ui.button.tab',
    'ui.button.chip',
  ]) {
    assert.equal(
      draw(slot, 'default', true).querySelector('button').style.borderImageSlice,
      '6 5 7 4 fill',
    );
    for (const state of ['selected', 'pressed', 'hover', 'focus', 'disabled']) {
      const button = draw(slot, state, true).querySelector('button');
      assert.equal(button.style.borderImageSlice, '6 5 7 4', `${slot} ${state}`);
      assert.equal(button.style.borderImageWidth, '6px 5px 7px 4px');
    }
  }
});
