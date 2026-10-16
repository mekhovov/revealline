import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextDraft } from '../ui/controller-text-draft.mjs';

test('multiline JSON caret, selection, newline, tab and undo preserve authored text', () => {
  const draft = createTextDraft('{\n  "name": "їжак"\n}');
  draft.action('home');
  draft.action('up');
  draft.action('end');
  draft.action('insert', ',');
  draft.action('insert', '\n\t"count": 2');
  assert.equal(draft.snapshot().value, '{\n  "name": "їжак",\n\t"count": 2\n}');
  draft.action('undo');
  assert.equal(draft.snapshot().value, '{\n  "name": "їжак",\n}');
  draft.action('redo');
  draft.action('home');
  draft.action('select');
  draft.action('end');
  assert.equal(
    draft.snapshot().value.slice(draft.snapshot().start, draft.snapshot().end),
    '\t"count": 2',
  );
  draft.action('insert', '  "count": 3');
  assert.deepEqual(JSON.parse(draft.snapshot().value), { name: 'їжак', count: 3 });
});

test('Unicode deletion does not split emoji and replacement obeys maxlength atomically', () => {
  const draft = createTextDraft('A😀ї', { maxLength: 4 });
  draft.action('left');
  draft.action('backspace');
  assert.equal(draft.snapshot().value, 'Aї');
  draft.action('undo');
  assert.equal(draft.snapshot().value, 'A😀ї');
  assert.equal(draft.snapshot().start, 3);
  assert.equal(draft.snapshot().end, 3, 'undo restores the original collapsed caret');
  draft.action('redo');
  assert.equal(draft.action('insert', '😀'), true);
  assert.equal(draft.action('insert', '!'), false);
  assert.equal(draft.snapshot().value, 'A😀ї');
  draft.action('all');
  draft.action('insert', 'ґєії');
  assert.equal(draft.snapshot().value, 'ґєії');
  draft.action('undo');
  assert.equal(draft.snapshot().value, 'A😀ї');
});

test('native selection direction and edits compose with controller insertion', () => {
  const draft = createTextDraft('first second');
  draft.adopt('first second', 6, 12, 'backward');
  assert.equal(draft.snapshot().direction, 'backward');
  draft.action('insert', 'другий');
  assert.equal(draft.snapshot().value, 'first другий');
  draft.adopt('physical keyboard', 0, 8);
  draft.action('insert', 'controller');
  assert.equal(draft.snapshot().value, 'controller keyboard');
});

test('caret navigation retains empty lines and never lands inside an emoji', () => {
  const draft = createTextDraft('\n😀abc\n\nx');
  draft.action('up');
  assert.equal(draft.snapshot().start, 7);
  draft.action('up');
  assert.equal(draft.snapshot().start, 1);
  draft.action('up');
  assert.equal(draft.snapshot().start, 0);
  draft.action('down');
  assert.equal(draft.snapshot().start, 1);
  draft.action('right');
  assert.equal(draft.snapshot().start, 3);
});
