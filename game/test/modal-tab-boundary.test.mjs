import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { attachModalNavigation } from '../ui/modal-navigation.mjs';

function surface(t) {
  const doc = new Document();
  const add = (tag, id, parent = doc.body) => {
    const node = doc.createElement(tag);
    node.id = id;
    parent.append(node);
    return node;
  };
  const parent = add('dialog', 'parent'),
    child = add('dialog', 'child');
  const first = add('button', 'first', parent),
    last = add('input', 'last', parent);
  last.type = 'range';
  last.value = '0.65';
  const childFirst = add('button', 'child-first', child),
    childLast = add('button', 'child-last', child);
  const stack = attachModalNavigation({ document: doc });
  const nav = attachControllerNavigation({
    document: doc,
    keyboard: true,
    getRoot: () => stack.topDialog() ?? doc,
    getScope: () => stack.topDialog()?.id ?? 'flight',
  });
  const open = (dialog) => {
    dialog.emit('beforetoggle', { oldState: 'closed', newState: 'open' });
    dialog.open = true;
    dialog.setAttribute('open', '');
  };
  const close = (dialog) => {
    dialog.open = false;
    dialog.removeAttribute('open');
    doc.body.focus();
    dialog.emit('close');
  };
  // Native default only: interior traversal, while a modal boundary may leave
  // the document as observed in the retained browser failure. Real nav runs first.
  const press = (items, shiftKey = false, extra = {}) => {
    const origin = doc.activeElement;
    const event = origin.emit('keydown', { key: 'Tab', code: 'Tab', shiftKey, ...extra });
    if (!event.defaultPrevented) {
      const index = items.indexOf(origin),
        next = index + (shiftKey ? -1 : 1);
      (index < 0 || next < 0 || next >= items.length ? doc.body : items[next]).focus();
    }
    return event;
  };
  t.after(() => {
    nav.destroy();
    stack.destroy();
  });
  open(parent);
  first.focus();
  return { doc, add, parent, child, first, last, childFirst, childLast, open, close, press, nav };
}

test('modal Tab keeps native interior traversal and wraps only forward/reverse boundaries without activation', (t) => {
  const h = surface(t);
  let clicks = 0,
    changes = 0;
  h.first.onclick = () => clicks++;
  h.last.onchange = () => changes++;
  assert.equal(h.press([h.first, h.last]).defaultPrevented, false);
  assert.equal(h.doc.activeElement.id, 'last');
  assert.equal(h.press([h.first, h.last]).defaultPrevented, true);
  assert.equal(h.doc.activeElement.id, 'first');
  assert.equal(h.press([h.first, h.last], true).defaultPrevented, true);
  assert.equal(h.doc.activeElement.id, 'last');
  assert.equal(h.press([h.first, h.last], true).defaultPrevented, false);
  assert.equal(h.doc.activeElement.id, 'first');
  assert.equal(clicks, 0);
  assert.equal(changes, 0);
  assert.equal(h.last.value, '0.65');
});

for (const kind of [
  'hidden',
  'disabled',
  'inert',
  'invisible',
  'negative tabindex',
  'closed details',
])
  test(`modal boundary ignores a ${kind} trailing control`, (t) => {
    const h = surface(t);
    const excluded = h.add('button', 'excluded', h.parent);
    if (kind === 'invisible') excluded.style.visibility = 'hidden';
    else if (kind === 'negative tabindex') excluded.tabIndex = -1;
    else if (kind === 'closed details') {
      const details = h.add('details', 'details', h.parent);
      details.tabIndex = -1;
      details.append(excluded);
    } else excluded[kind] = true;
    h.last.focus();
    h.press([h.first, h.last]);
    assert.equal(h.doc.activeElement.id, 'first');
    h.press([h.first, h.last], true);
    assert.equal(h.doc.activeElement.id, 'last');
  });

test('nested modal boundaries follow current opening order and closing restores the parent opener', async (t) => {
  const h = surface(t);
  h.last.focus();
  h.open(h.child);
  h.childFirst.focus();
  h.press([h.childFirst, h.childLast], true);
  assert.equal(h.doc.activeElement.id, 'child-last');
  h.press([h.childFirst, h.childLast]);
  assert.equal(h.doc.activeElement.id, 'child-first');
  h.close(h.child);
  await Promise.resolve();
  assert.equal(h.doc.activeElement.id, 'last');
  h.press([h.first, h.last]);
  assert.equal(h.doc.activeElement.id, 'first');
  h.open(h.child);
  h.childLast.focus();
  h.press([h.childFirst, h.childLast]);
  assert.equal(h.doc.activeElement.id, 'child-first');
});

test('modal native inputs retain interior keys, file activation and values; boundary does not commit', (t) => {
  const h = surface(t);
  h.last.remove();
  const select = h.add('select', 'select', h.parent),
    input = h.add('input', 'file', h.parent),
    text = h.add('textarea', 'text', h.parent),
    end = h.add('button', 'end', h.parent);
  input.type = 'file';
  input.value = 'owned';
  text.value = 'draft';
  select.value = 'standard';
  let changes = 0,
    opens = 0;
  for (const node of [select, input, text]) node.onchange = () => changes++;
  input.onclick = () => opens++;
  const items = [h.first, select, input, text, end];
  select.focus();
  assert.equal(select.emit('keydown', { key: 'ArrowDown' }).defaultPrevented, false);
  assert.equal(h.press(items).defaultPrevented, false);
  assert.equal(input.emit('keydown', { key: 'Enter' }).defaultPrevented, false);
  input.click();
  assert.equal(opens, 1);
  assert.equal(h.press(items).defaultPrevented, false);
  assert.equal(h.press(items).defaultPrevented, false);
  assert.equal(h.press(items).defaultPrevented, true);
  assert.equal(h.doc.activeElement.id, 'first');
  assert.equal(changes, 0);
  assert.equal(input.value, 'owned');
  assert.equal(text.value, 'draft');
});

test('modified, already-handled and empty/nonmodal Tab remain with their existing owner', (t) => {
  const h = surface(t);
  h.last.focus();
  for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
    assert.equal(h.last.emit('keydown', { key: 'Tab', ...extra }).defaultPrevented, false);
    assert.equal(h.doc.activeElement.id, 'last');
  }
  h.last.emit('keydown', { key: 'Tab', defaultPrevented: true });
  assert.equal(h.doc.activeElement.id, 'last');
  h.first.disabled = true;
  h.last.disabled = true;
  h.parent.focus();
  assert.equal(h.parent.emit('keydown', { key: 'Tab' }).defaultPrevented, false);
  h.close(h.parent);
  h.doc.body.focus();
  assert.equal(h.doc.body.emit('keydown', { key: 'Tab' }).defaultPrevented, false);
});

test('modal Tab includes authored tabindex reading regions and preserves positive native order', (t) => {
  const h = surface(t);
  const region = h.add('section', 'reading', h.parent);
  region.setAttribute('tabindex', '0');
  h.last.focus();
  assert.equal(h.press([h.first, h.last, region]).defaultPrevented, false);
  assert.equal(h.doc.activeElement.id, 'reading');
  assert.equal(h.press([h.first, h.last, region]).defaultPrevented, true);
  assert.equal(h.doc.activeElement.id, 'first');
  assert.equal(h.press([h.first, h.last, region], true).defaultPrevented, true);
  assert.equal(h.doc.activeElement.id, 'reading');
  h.last.setAttribute('tabindex', '1');
  h.last.focus();
  assert.equal(h.press([h.last, h.first, region], true).defaultPrevented, true);
  assert.equal(h.doc.activeElement.id, 'reading');
});
