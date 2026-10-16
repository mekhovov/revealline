import test from 'node:test';
import assert from 'node:assert/strict';
import { mountGlobalSettings } from '../ui/global-settings-view.mjs';
import { Document } from './helpers/couch-dom.mjs';

function fixture() {
  const document = new Document(),
    root = document.createElement('dialog'),
    panels = {};
  for (const category of [
    'display',
    'accessibility',
    'audio',
    'controls',
    'data',
    'content',
    'extras',
  ]) {
    const panel = document.createElement('section'),
      title = document.createElement('h2');
    title.textContent = category;
    panel.append(title);
    root.append(panel);
    panels[category] = panel;
  }
  document.body.append(root);
  root.showModal();
  return { document, root, panels };
}

function preference(initial) {
  let value = initial,
    writes = 0;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      value = next;
      writes++;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    writes: () => writes,
    listeners: () => listeners.size,
  };
}

test('two hosts share one preference owner without startup writes and release subscriptions', () => {
  const owner = preference(0.6),
    first = fixture(),
    second = fixture();
  const a = mountGlobalSettings({ ...first, bindings: { masterVolume: owner } });
  const b = mountGlobalSettings({ ...second, prefix: 'other', bindings: { masterVolume: owner } });
  const input = first.document.getElementById('global-settings-masterVolume');
  const other = second.document.getElementById('other-masterVolume');
  assert.equal(owner.writes(), 0);
  assert.equal(input.value, '0.6');
  input.value = '0.3';
  input.emit('change');
  assert.equal(owner.writes(), 1);
  assert.equal(other.value, '0.3');
  assert.equal(other.parentNode.querySelector('output').textContent, '30%');
  a.destroy();
  b.destroy();
  assert.equal(owner.listeners(), 0);
});

test('adoption preserves handlers and paired labels, retires duplicate shortcuts and restores ownership', () => {
  const f = fixture(),
    row = f.document.createElement('div'),
    label = f.document.createElement('label');
  const input = f.document.createElement('select'),
    alias = f.document.createElement('button');
  input.id = 'original-language';
  label.setAttribute('for', input.id);
  row.append(label, input, alias);
  f.root.append(row);
  let changes = 0;
  input.addEventListener('change', () => changes++);
  const settings = mountGlobalSettings({
    ...f,
    controls: { language: [label, input] },
    duplicates: { language: [alias] },
  });
  input.emit('change');
  assert.equal(changes, 1);
  assert.equal(input.parentNode, label.parentNode);
  assert.equal(alias.hidden, true);
  settings.update({ controls: { language: [label, input] } });
  assert.equal(f.root.querySelectorAll('[data-global-setting="language"]').length, 1);
  settings.destroy();
  assert.deepEqual(row.children, [label, input, alias]);
  assert.equal(alias.hidden, false);
  input.emit('change');
  assert.equal(changes, 2);
});

test('lazy providers keep canonical order, replace generated fallbacks and preserve locale focus', () => {
  const f = fixture(),
    textSize = preference('large'),
    textFace = preference('plain');
  const settings = mountGlobalSettings({ ...f, bindings: { textSize } });
  settings.update({ bindings: { textFace } });
  const group = f.panels.accessibility.querySelector('[data-global-settings]');
  assert.deepEqual(
    group.children.slice(1).map((node) => node.dataset.globalSetting),
    ['textFace', 'textSize'],
  );
  const field = f.document.getElementById('global-settings-textSize');
  field.focus();
  settings.refresh('uk');
  assert.equal(f.document.activeElement, field);
  assert.equal(field.value, 'large');
  assert.equal(field.children[1].textContent, 'Великий');
  const native = f.document.createElement('select');
  native.value = 'large';
  settings.update({ controls: { textSize: native } });
  assert.equal(textSize.listeners(), 0);
  assert.equal(f.document.getElementById('global-settings-textSize'), null);
  assert.equal(native.parentNode.querySelectorAll('select').length, 1);
  assert.ok(settings.missing().includes('appearance'));
  assert.ok(!settings.missing().includes('textSize'));
  settings.destroy();
});

test('disposing the registry never resurrects a control retired by its owner', () => {
  const f = fixture(),
    button = f.document.createElement('button');
  f.root.append(button);
  const settings = mountGlobalSettings({ ...f, controls: { offlineTools: button } });
  button.remove();
  settings.destroy();
  assert.equal(button.parentNode, null);
});

test('storage warnings and rejected changes stay visible without falsely applying values', async () => {
  const f = fixture(),
    owner = preference(false);
  owner.warning = () => 'Not saved on this device';
  const settings = mountGlobalSettings({ ...f, bindings: { masterMuted: owner } });
  const input = f.document.getElementById('global-settings-masterMuted');
  input.checked = true;
  input.emit('change');
  const status = input.parentNode.parentNode.querySelector('[role="status"]');
  assert.equal(status.textContent, 'Not saved on this device');
  assert.equal(status.hidden, false);
  settings.update({
    bindings: {
      masterMuted: { get: () => false, set: () => Promise.reject(new Error('Unavailable')) },
    },
  });
  input.checked = true;
  input.emit('change');
  await Promise.resolve();
  assert.equal(input.checked, false);
  assert.equal(status.textContent, 'Unavailable');
  settings.destroy();
});
