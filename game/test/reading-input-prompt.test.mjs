import test from 'node:test';
import assert from 'node:assert/strict';
import { readingInputPrompt } from '../ui/reading-input-prompt.mjs';

test('keyboard instructions name actual reading keys with and without overflow', () => {
  assert.equal(
    readingInputPrompt({ modality: 'keyboard', scrollable: true }),
    'Up/Down scroll · Enter, Space or Escape returns',
  );
  assert.equal(
    readingInputPrompt({ modality: 'keyboard', scrollable: false }),
    'All text is visible · Enter, Space or Escape returns',
  );
});

test('controller instructions preserve the supplied mapping and do not mutate its labels', () => {
  const controls = Object.freeze({ confirm: 'Right bumper', back: 'West' });
  assert.equal(
    readingInputPrompt({ modality: 'controller', scrollable: true, controls }),
    'Up/Down scroll · Right bumper or West returns',
  );
  assert.equal(
    readingInputPrompt({ modality: 'controller', scrollable: false, controls }),
    'All text is visible · Right bumper or West returns',
  );
  assert.deepEqual(controls, { confirm: 'Right bumper', back: 'West' });
});

test('pointer, touch and unselected input give the visible Done action instead of controller buttons', () => {
  for (const modality of ['pointer', 'touch', undefined]) {
    assert.equal(
      readingInputPrompt({ modality, scrollable: true }),
      'Scroll to read · Done reading returns',
    );
    assert.equal(
      readingInputPrompt({ modality, scrollable: false }),
      'All text is visible · Done reading returns',
    );
  }
});
