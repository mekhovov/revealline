import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { createFlightMenuNavigation } from '../../optional-practice/civilian-fpv/input.mjs';

for (const kind of ['select', 'range']) {
  test(`SIM Settings keyboard navigates past ${kind}, confirms once and cancels edits`, (t) => {
    const doc = new Document();
    const root = doc.createElement('section');
    root.classList.add('native-settings');
    root.dataset.menuLayout = 'vertical';
    doc.body.append(root);
    const field = doc.createElement(kind === 'select' ? 'select' : 'input');
    field.id = 'setting';
    if (kind === 'select') {
      field.options = ['first', 'second', 'third'].map((value) => ({ value }));
      Object.defineProperty(field, 'selectedOptions', {
        get: () => field.options.filter((option) => option.value === field.value),
      });
      field.value = 'first';
    } else Object.assign(field, { type: 'range', min: '0', max: '10', step: '1', value: '4' });
    const next = doc.createElement('button');
    next.id = 'next';
    root.append(field, next);
    let changes = 0,
      backs = 0;
    field.addEventListener('change', () => changes++);
    const nav = createFlightMenuNavigation({
      document: doc,
      window: doc.defaultView,
      getContext: () => ({ root, key: 'settings' }),
      onBack: () => backs++,
    });
    t.after(() => nav.dispose());
    const key = (key, repeat = false) => {
      const event = doc.activeElement.emit('keydown', { key, repeat });
      doc.activeElement.emit('keyup', { key });
      return event;
    };
    field.focus();
    const original = field.value;
    assert.equal(key('ArrowDown').defaultPrevented, true);
    assert.equal(doc.activeElement, next);
    assert.equal(field.value, original);
    key('ArrowUp');
    assert.equal(doc.activeElement, field);
    key('Enter');
    assert.equal(nav.snapshot().editing, field.id);
    key('ArrowDown');
    key('Escape');
    assert.equal(field.value, original);
    assert.equal(changes, 0);
    assert.equal(backs, 0);
    key('Enter');
    key('ArrowDown');
    key('Enter', true);
    assert.equal(changes, 0);
    key('Enter');
    assert.equal(changes, 1);
    assert.notEqual(field.value, original);
    key('ArrowDown');
    assert.equal(doc.activeElement, next);
  });
}
