import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { mountSpritePanel } from '../../authoring/asset-studio/sprite-panel.mjs';
import { resolveAuthoringEditor } from '../ui/authoring-editors.mjs';

function fixture(t) {
  const document = new Document(),
    globals = new Map(
      ['document', 'ImageData'].map((key) => [
        key,
        Object.getOwnPropertyDescriptor(globalThis, key),
      ]),
    );
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'ImageData', {
    configurable: true,
    value: class {
      constructor(pixels, width, height) {
        Object.assign(this, { data: new Uint8ClampedArray(pixels), width, height });
      }
    },
  });
  t.after(() => {
    for (const [key, descriptor] of globals)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  const createElement = document.createElement.bind(document);
  document.createElement = (tag) => {
    const element = createElement(tag);
    if (tag === 'canvas') {
      const context = {
        putImageData: (image) => {
          element.image = image;
        },
        fillRect() {},
        strokeRect() {},
      };
      element.getContext = () => context;
      // Encoding is a boundary: inspect exactly which RGBA bytes the real panel
      // submits. Actual PNG decode/export is covered by the browser workflow.
      element.toBlob = (done) => done(new Blob([element.image.data]));
    }
    return element;
  };
  for (const id of [
    'sprite-canvas',
    'sprite-workbench',
    'sprite-color',
    'sprite-alpha',
    'sprite-zoom',
    'sprite-tool',
    'sprite-undo',
    'sprite-redo',
    'sprite-cursor',
    'replace-palette-color',
    'replace-color',
    'move-selection',
    'selection-dx',
    'selection-dy',
    'use-sprite',
    'sprite-palette',
  ]) {
    const element = document.createElement(id === 'sprite-canvas' ? 'canvas' : 'button');
    element.id = id;
    document.body.append(element);
  }
  const $ = (id) => document.getElementById(id);
  $('sprite-color').value = '#123456';
  $('sprite-alpha').value = '255';
  $('sprite-zoom').value = '4';
  $('sprite-tool').value = 'line';
  let prepared;
  const panel = mountSpritePanel({
    onPrepare: async (blob) => {
      prepared = new Uint8Array(await blob.arrayBuffer());
    },
    onError: (error) => {
      throw error;
    },
    runOperation: (_label, fn) => fn({ check() {} }),
  });
  panel.open(4, 4);
  return {
    $,
    panel,
    prepared: () => prepared,
    canvas: $('sprite-canvas'),
    adapter: resolveAuthoringEditor($('sprite-canvas')),
  };
}

test('real Sprite panel cancels a controller anchor with immediate feedback, retains the canvas, and exports only the new line', async (t) => {
  const f = fixture(t);
  assert.equal(f.adapter.enter(), true);
  f.adapter.handle({ confirm: true });
  f.adapter.handle({ direction: 'right' });
  assert.match(f.$('sprite-cursor').textContent, /end point/);
  assert.equal(
    f.adapter.handle({ back: true }),
    undefined,
    'first Back cancels the pending anchor without leaving',
  );
  assert.equal(f.adapter.isCurrent(), true);
  assert.doesNotMatch(
    f.$('sprite-cursor').textContent,
    /end point/,
    'cancel feedback updates before another input',
  );
  assert.equal(f.panel.hasEdits(), false);
  assert.equal(f.$('sprite-undo').disabled, true);
  f.adapter.handle({ confirm: true });
  assert.equal(f.panel.hasEdits(), false, 'the next Confirm starts a fresh anchor');
  f.adapter.handle({ direction: 'down' });
  f.adapter.handle({ confirm: true });
  assert.equal(f.panel.hasEdits(), true);
  assert.equal(f.adapter.handle({ back: true }), 'cancel', 'Back with no unfinished anchor exits');
  f.adapter.exit();
  f.$('sprite-undo').focus();
  f.$('sprite-undo').click();
  assert.equal(f.panel.hasEdits(), false);
  assert.equal(
    f.$('sprite-redo').ownerDocument.activeElement,
    f.$('sprite-redo'),
    'history endpoint stays reachable',
  );
  f.$('sprite-redo').click();
  await f.$('use-sprite').onclick();
  const expected = new Uint8Array(4 * 4 * 4);
  expected.set([0x12, 0x34, 0x56, 255], 4);
  expected.set([0x12, 0x34, 0x56, 255], (4 + 1) * 4);
  assert.deepEqual(
    f.prepared(),
    expected,
    'canceled first point contributes no pixels to prepared bytes',
  );
});

test('real Sprite keyboard Escape cancels its pending line and subsequent Space starts a fresh anchor', (t) => {
  const f = fixture(t);
  f.canvas.focus();
  f.canvas.emit('keydown', { key: ' ', code: 'Space' });
  f.canvas.emit('keydown', { key: 'ArrowRight' });
  f.canvas.emit('keydown', { key: 'Escape' });
  assert.equal(f.panel.hasEdits(), false);
  assert.doesNotMatch(f.$('sprite-cursor').textContent, /end point/);
  f.canvas.emit('keydown', { key: ' ', code: 'Space' });
  assert.equal(f.panel.hasEdits(), false);
  f.canvas.emit('keydown', { key: 'ArrowDown' });
  f.canvas.emit('keydown', { key: ' ', code: 'Space' });
  assert.equal(f.panel.hasEdits(), true);
  f.canvas.emit('keydown', { key: 'z', ctrlKey: true });
  assert.equal(f.panel.hasEdits(), false);
});
