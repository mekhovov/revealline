import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPlayfieldContextMenu } from '../ui/playfield-context-menu.mjs';
import { attachInput } from '../ui/input.mjs';
import { attachCouchInput } from '../couch/couch-input.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

const secondary = { button: 2, pointerType: 'mouse', pointerId: 1 };
function fixture() {
  const win = new Events(),
    doc = new Document();
  doc.parentNode = win;
  const element = (tag, id, parent = doc.body) => {
    const node = doc.createElement(tag);
    node.id = id;
    parent.append(node);
    return node;
  };
  return { win, doc, element };
}

test('only pointer context menus on an active owned canvas are prevented', () => {
  const f = fixture(),
    root = f.element('div', 'mount'),
    canvas = f.element('canvas', 'board', root),
    input = f.element('input', 'menu-input', root),
    outside = f.element('canvas', 'artwork');
  let active = true,
    bubbled = 0;
  f.doc.addEventListener('contextmenu', () => bubbled++);
  const dispose = attachPlayfieldContextMenu({ roots: [root, root, null], active: () => active });
  for (const event of [
    secondary,
    { button: 2 }, // Legacy MouseEvent.
    { button: 0, pointerType: 'touch', pointerId: 7 },
    { button: 0, pointerType: 'pen', pointerId: 9 },
  ])
    assert.equal(canvas.emit('contextmenu', event).defaultPrevented, true);
  assert.equal(bubbled, 4, 'The event remains observable; propagation is not stopped.');
  for (const target of [root, input, outside, f.doc.body])
    assert.equal(target.emit('contextmenu', secondary).defaultPrevented, false);
  active = false;
  assert.equal(canvas.emit('contextmenu', secondary).defaultPrevented, false);
  active = true;
  assert.equal(canvas.emit('contextmenu', secondary).defaultPrevented, true);
  dispose();
  dispose();
  assert.equal(canvas.emit('contextmenu', secondary).defaultPrevented, false);
  assert.equal(root.listeners.get('contextmenu').size, 0);
});

test('keyboard, assistive activation, modified requests and browser navigation stay native', () => {
  const f = fixture(),
    canvas = f.element('canvas', 'board');
  const dispose = attachPlayfieldContextMenu({ roots: [canvas], active: () => true });
  for (const event of [
    {},
    { button: 0, detail: 0 },
    { ...secondary, pointerId: -1 },
    { button: 0, pointerType: '', pointerId: -1 },
    { button: 0, pointerType: 'touch' },
    { button: 0, pointerType: 'pen', pointerId: 0 },
    ...['shiftKey', 'ctrlKey', 'altKey', 'metaKey'].map((key) => ({ ...secondary, [key]: true })),
  ])
    assert.equal(canvas.emit('contextmenu', event).defaultPrevented, false);
  for (const event of [
    { key: 'F10', code: 'F10', shiftKey: true },
    { key: 'ContextMenu', code: 'ContextMenu' },
  ]) {
    assert.equal(canvas.emit('keydown', event).defaultPrevented, false);
    // Legacy browsers may report a secondary button without pointer identity.
    assert.equal(canvas.emit('contextmenu', { button: 2 }).defaultPrevented, false);
  }
  canvas.emit('keydown', { key: 'ContextMenu' });
  canvas.emit('pointerdown', secondary);
  assert.equal(canvas.emit('contextmenu', secondary).defaultPrevented, true);
  for (const [type, event] of [
    ['keydown', { key: 'F10', code: 'F10', shiftKey: true }],
    ['keydown', { key: 'ContextMenu', code: 'ContextMenu' }],
    ['keydown', { key: '+', code: 'Equal', ctrlKey: true }],
    ['keydown', { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true }],
    ['wheel', { ctrlKey: true, deltaY: 10 }],
    ['pointerdown', secondary],
    ['pointerdown', { button: 3, pointerType: 'mouse', pointerId: 1 }],
    ['click', { detail: 0 }],
  ])
    assert.equal(canvas.emit(type, event).defaultPrevented, false);
  dispose();
});

test('Solo input owns the later-created canvas guard and releases it on destroy', (t) => {
  const f = fixture(),
    arena = f.element('div', 'game-canvas'),
    original = new Map(
      ['window', 'document', 'navigator'].map((key) => [
        key,
        Object.getOwnPropertyDescriptor(globalThis, key),
      ]),
    );
  for (const [key, value] of Object.entries({
    window: f.win,
    document: f.doc,
    navigator: { getGamepads: () => [] },
  }))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  let active = true;
  const input = attachInput({ arena, active: () => active });
  t.after(() => {
    input.destroy();
    for (const [key, descriptor] of original)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  const canvas = f.element('canvas', 'phaser-board', arena),
    artwork = f.element('canvas', 'original-artwork');
  assert.equal(canvas.emit('contextmenu', secondary).defaultPrevented, true);
  assert.equal(artwork.emit('contextmenu', secondary).defaultPrevented, false);
  active = false;
  assert.equal(canvas.emit('contextmenu', secondary).defaultPrevented, false);
  active = true;
  input.destroy();
  assert.equal(canvas.emit('contextmenu', secondary).defaultPrevented, false);
});

for (const mode of ['Versus', 'Team'])
  test(`${mode} input guards exactly its live boards and releases them on destroy`, (t) => {
    const f = fixture(),
      first = f.element('canvas', 'race-canvas-0'),
      second = f.element('canvas', 'race-canvas-1'),
      team = f.element('canvas', 'coop-canvas'),
      preview = f.element('canvas', 'coop-preview-canvas'),
      button = f.element('button', 'pause'),
      owned = mode === 'Versus' ? [first, second] : [team],
      unowned = mode === 'Versus' ? [team, preview, button] : [first, second, preview, button];
    let active = true;
    const input = attachCouchInput({
      window: f.win,
      document: f.doc,
      ...(mode === 'Team' ? { arena: team } : {}),
      active: () => active,
      getGamepads: () => [],
    });
    t.after(() => input.destroy());
    for (const canvas of owned)
      assert.equal(canvas.emit('contextmenu', secondary).defaultPrevented, true, canvas.id);
    for (const target of unowned)
      assert.equal(target.emit('contextmenu', secondary).defaultPrevented, false, target.id);
    active = false;
    for (const canvas of owned)
      assert.equal(canvas.emit('contextmenu', secondary).defaultPrevented, false, canvas.id);
    active = true;
    input.destroy();
    for (const canvas of owned)
      assert.equal(canvas.emit('contextmenu', secondary).defaultPrevented, false, canvas.id);
  });
