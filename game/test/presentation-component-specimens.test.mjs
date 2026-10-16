import test from 'node:test';
import assert from 'node:assert/strict';
import { componentPreview } from '../../authoring/asset-studio/component-specimens.mjs';
import { setLocale } from '../i18n/index.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { Document } from './helpers/couch-dom.mjs';
const slots = createDefaultThemeBundle().slots;
test.after(() => setLocale('en', { persist: false }));
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
  const names = {
    checkbox: 'checkbox',
    radio: 'radio button',
    toggle: 'toggle',
    slider: 'slider',
    text: 'text field',
  };
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
    assert.equal(input.getAttribute('aria-label'), `Component specimen: ${names[kind]}`);
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

test('action specimens retain their runtime variants without pretending to be toggle buttons', () => {
  const labels = new Set();
  for (const variant of ['primary', 'secondary', 'danger']) {
    const button = draw(`ui.button.${variant}`, 'default').querySelector('button');
    assert.equal(button.classList.contains('button'), true);
    assert.equal(button.classList.contains(variant), true);
    assert.equal(button.type, 'button');
    assert.equal(button.getAttribute('aria-pressed'), null);
    assert.equal(button.dataset.specimenControl, 'true');
    labels.add(button.textContent);
    assert.equal(draw(`ui.button.${variant}`, 'disabled').querySelector('button').disabled, true);
    assert.equal(
      draw(`ui.button.${variant}`, 'loading').querySelector('button').getAttribute('aria-busy'),
      'true',
    );
  }
  assert.equal(labels.size, 3, 'Deploy, Back and Discard convey different actions.');
  const icon = draw('ui.button.icon', 'default').querySelector('button');
  assert.equal(icon.classList.contains('icon-button'), true);
  assert.equal(icon.getAttribute('aria-label'), 'Pause specimen');
  assert.equal(icon.querySelector('span').getAttribute('aria-hidden'), 'true');
  assert.equal(icon.getAttribute('aria-pressed'), null);
});

test('tab specimens expose matched panels and real keyboard selection while skipping disabled tabs', () => {
  const surface = draw('ui.button.tab', 'selected'),
    list = surface.querySelector('[role="tablist"]'),
    tabs = list.querySelectorAll('[role="tab"]'),
    panels = surface.querySelectorAll('[role="tabpanel"]');
  assert.equal(tabs.length, 2);
  assert.ok(list.getAttribute('aria-label'));
  for (const [index, tab] of tabs.entries()) {
    assert.equal(tab.getAttribute('aria-controls'), panels[index].id);
    assert.equal(panels[index].getAttribute('aria-labelledby'), tab.id);
    assert.equal(tab.getAttribute('aria-pressed'), null);
  }
  const selected = (index) => {
    for (const [i, tab] of tabs.entries()) {
      assert.equal(tab.getAttribute('aria-selected'), String(i === index));
      assert.equal(tab.tabIndex, i === index ? 0 : -1);
      assert.equal(panels[i].hidden, i !== index);
    }
  };
  selected(0);
  assert.equal(tabs[0].emit('keydown', { key: 'ArrowRight' }).defaultPrevented, true);
  selected(1);
  assert.equal(surface.ownerDocument.activeElement, tabs[1]);
  tabs[1].emit('keydown', { key: 'Home' });
  selected(0);
  tabs[0].emit('keydown', { key: 'End' });
  selected(1);
  tabs[0].click();
  selected(0);

  const disabled = draw('ui.button.tab', 'disabled'),
    disabledTabs = disabled.querySelectorAll('[role="tab"]');
  assert.equal(disabledTabs[0].disabled, true);
  disabledTabs[0].click();
  disabledTabs[1].emit('keydown', { key: 'ArrowLeft' });
  assert.equal(disabledTabs[0].getAttribute('aria-selected'), 'false');
  assert.equal(disabledTabs[1].getAttribute('aria-selected'), 'true');
  assert.equal(disabled.ownerDocument.activeElement, disabledTabs[1]);
});

test('chip specimens toggle locally and a disabled chip preserves its native state', () => {
  const chip = draw('ui.button.chip', 'selected').querySelector('button');
  chip.click();
  assert.equal(chip.getAttribute('aria-pressed'), 'false');
  chip.click();
  assert.equal(chip.getAttribute('aria-pressed'), 'true');
  const disabled = draw('ui.button.chip', 'disabled').querySelector('button');
  disabled.click();
  assert.equal(disabled.getAttribute('aria-pressed'), 'false');
});

test('component specimens update their text and accessibility labels when the locale changes', () => {
  setLocale('en', { persist: false });
  const tabs = draw('ui.button.tab', 'selected'),
    tabList = tabs.querySelector('[role="tablist"]');
  assert.equal(tabList.getAttribute('aria-label'), 'Component category specimen');

  setLocale('uk', { persist: false });
  const textInput = draw('ui.input.text', 'error'),
    input = textInput.querySelector('input');
  assert.equal(input.getAttribute('placeholder'), 'Позивний пілота');
  assert.equal(input.getAttribute('aria-label'), 'Зразок компонента: текстове поле');
  assert.equal(tabList.getAttribute('aria-label'), 'Зразок категорій компонентів');
  assert.match(textInput.textContent, /Помилка перевірки зразка/);
  assert.match(tabs.textContent, /Керування/);
  assert.match(tabs.textContent, /Аудіо/);
});
