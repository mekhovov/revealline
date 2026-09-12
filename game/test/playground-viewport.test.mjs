import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePreviewSize, PREVIEW_SIZE_LIMITS } from '../playground/viewport.mjs';

test('custom preview accepts exact integer boundaries, presets and short-window breakpoints', () => {
  for (const [width, height] of [
    [240, 2560],
    [2560, 240],
    [390, 844],
    [844, 500],
    [844, 501],
    [844, 520],
    [1101, 501],
    [1280, 720],
  ]) {
    assert.deepEqual(resolvePreviewSize(width, height), { width, height });
    assert.deepEqual(resolvePreviewSize(String(width), String(height)), { width, height });
  }
  assert.deepEqual(resolvePreviewSize(' 0844 ', ' 0501 '), { width: 844, height: 501 });
  assert.ok(Object.isFrozen(PREVIEW_SIZE_LIMITS));
});

test('invalid or partially valid custom dimensions never produce an adopted size', () => {
  for (const invalid of [
    239,
    2561,
    500.5,
    -500,
    NaN,
    Infinity,
    null,
    undefined,
    true,
    '',
    ' ',
    '501.5',
    '1e3',
    '0x200',
    '844px',
    [],
    {},
  ]) {
    assert.throws(() => resolvePreviewSize(invalid, 501), /Width must be a whole number/);
    assert.throws(() => resolvePreviewSize(844, invalid), /Height must be a whole number/);
  }
});

test('dimension validation never coerces objects and returns independent plain values', () => {
  let called = false;
  const invalid = {
    valueOf() {
      called = true;
      return 844;
    },
    toString() {
      called = true;
      return '844';
    },
  };
  assert.throws(() => resolvePreviewSize(invalid, 501), /Width/);
  assert.equal(called, false);
  const first = resolvePreviewSize('844', '501');
  first.width = 1;
  assert.deepEqual(resolvePreviewSize('844', '501'), { width: 844, height: 501 });
});
