import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpriteEditor, spriteDocument } from '../presentation/sprite-editor.mjs';
const red = [240, 120, 121, 255],
  cyan = [120, 220, 232, 255],
  clear = [0, 0, 0, 0];

test('bounded sprite documents own their bytes and reject mismatched imports', () => {
  const original = spriteDocument(4, 4),
    editor = createSpriteEditor(original);
  original.pixels.fill(255);
  assert.deepEqual(editor.pixel(0, 0), clear);
  const copy = editor.snapshot();
  copy.pixels.fill(255);
  assert.deepEqual(editor.pixel(0, 0), clear);
  assert.throws(() => spriteDocument(129, 1));
  assert.throws(() => spriteDocument(4, 4, new Uint8ClampedArray(4)));
});
test('a closed shape contains flood fill, with undo and branchable redo', () => {
  const editor = createSpriteEditor(spriteDocument(8, 8));
  editor.rectangle(1, 1, 6, 6, red);
  editor.fill(3, 3, cyan);
  assert.deepEqual(editor.pixel(0, 0), clear);
  assert.deepEqual(editor.pixel(1, 3), red);
  assert.deepEqual(editor.pixel(3, 3), cyan);
  editor.undo();
  assert.deepEqual(editor.pixel(3, 3), clear);
  editor.redo();
  assert.deepEqual(editor.pixel(3, 3), cyan);
  editor.undo();
  editor.line(2, 2, 5, 5, red);
  assert.equal(editor.redo(), false);
});
test('invalid strokes and clipped moves never partially change the document', () => {
  const editor = createSpriteEditor(spriteDocument(8, 8));
  assert.throws(() =>
    editor.stroke(
      [
        [0, 0],
        [9, 2],
      ],
      red,
    ),
  );
  assert.deepEqual(editor.pixel(0, 0), clear);
  assert.deepEqual(editor.history(), { undo: 0, redo: 0 });
  editor.stroke(
    [
      [2, 2],
      [4, 2],
    ],
    red,
  );
  const before = editor.snapshot();
  assert.throws(() => editor.moveSelection({ x: 2, y: 2, width: 3, height: 1 }, 7, 0));
  assert.deepEqual(editor.snapshot(), before);
});
test('overlapping selection moves preserve the selected source, and rotations round trip', () => {
  const editor = createSpriteEditor(spriteDocument(6, 4));
  editor.stroke([[1, 1]], red);
  editor.stroke([[2, 1]], cyan);
  editor.moveSelection({ x: 1, y: 1, width: 2, height: 1 }, 1, 0);
  assert.deepEqual(editor.pixel(1, 1), clear);
  assert.deepEqual(editor.pixel(2, 1), red);
  assert.deepEqual(editor.pixel(3, 1), cyan);
  const before = editor.snapshot();
  for (let i = 0; i < 4; i++) editor.transform('rotate');
  assert.deepEqual(editor.snapshot(), before);
  editor.replaceColor(red, cyan);
  assert.deepEqual(editor.pixel(2, 1), cyan);
  editor.undo();
  assert.deepEqual(editor.pixel(2, 1), red);
});
