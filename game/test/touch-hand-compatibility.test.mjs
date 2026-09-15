import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyLibrary, exportLibrary, importLibrary, updatePreferences } from '../library.mjs';
import { DEFAULT_TOUCH_CONTROLS, resolveTouchControls } from '../touch-controls.mjs';

function oldProfile({ hand, touch, hasHand = true, hasTouch = true } = {}) {
  const library = emptyLibrary();
  if (hasHand) library.preferences.screenSteeringHand = hand;
  else delete library.preferences.screenSteeringHand;
  if (hasTouch) library.preferences.touchControls = touch;
  else delete library.preferences.touchControls;
  return JSON.stringify(library);
}

for (const side of ['left', 'right'])
  test(`a serialized hand-only ${side} profile retains its D-pad side without changing records`, () => {
    const raw = oldProfile({ hand: side, hasTouch: false });
    const before = JSON.parse(raw);
    const imported = importLibrary(raw);
    assert.deepEqual(imported.preferences.touchControls, {
      ...DEFAULT_TOUCH_CONTROLS,
      mode: 'dpad',
      side,
    });
    assert.equal(imported.preferences.screenSteeringHand, side);
    for (const field of ['campaigns', 'gallery', 'scores', 'masteries'])
      assert.deepEqual(imported[field], before[field]);
    assert.equal(raw, JSON.stringify(before), 'The supplied serialized profile is never rewritten');
    assert.deepEqual(importLibrary(exportLibrary(imported)), imported);
  });

test('a newer null touch setting retains the current theme default despite a legacy hand value', () => {
  for (const hasHand of [true, false]) {
    const imported = importLibrary(oldProfile({ hand: 'left', touch: null, hasHand }));
    assert.equal(imported.preferences.touchControls, null);
    assert.deepEqual(
      resolveTouchControls(imported.preferences.touchControls),
      DEFAULT_TOUCH_CONTROLS,
    );
    assert.equal(imported.preferences.screenSteeringHand, 'left');
  }
});

test('a newer explicit touch configuration remains authoritative and survives preference updates and export', () => {
  const touch = { mode: 'swipe', side: 'right', size: 'large', opacity: 0.8 };
  const imported = importLibrary(oldProfile({ hand: 'left', touch }));
  assert.deepEqual(imported.preferences.touchControls, touch);
  assert.equal(imported.preferences.screenSteeringHand, 'left');
  const changed = updatePreferences(imported, {
    screenSteeringHand: 'left',
    touchControls: { ...touch, side: 'left' },
  });
  assert.deepEqual(changed.preferences.touchControls, { ...touch, side: 'left' });
  assert.equal(changed.preferences.screenSteeringHand, 'left');
  assert.deepEqual(importLibrary(exportLibrary(changed)), changed);
  assert.deepEqual(
    imported.preferences.touchControls,
    touch,
    'Updating a preference preserves the input library',
  );
});

test('profiles predating both hand fields use the current touch default without inventing a selected mode', () => {
  const imported = importLibrary(oldProfile({ hasHand: false, hasTouch: false }));
  assert.equal(imported.preferences.touchControls, null);
  assert.deepEqual(
    resolveTouchControls(imported.preferences.touchControls),
    DEFAULT_TOUCH_CONTROLS,
  );
});

test('explicit invalid legacy hands and invalid newer touch settings cannot fall through to defaults', () => {
  for (const hand of [null, false, 0, 'auto', 'LEFT', {}])
    assert.throws(() => importLibrary(oldProfile({ hand, hasTouch: false })));
  for (const touch of [
    false,
    {},
    { ...DEFAULT_TOUCH_CONTROLS, side: 'auto' },
    { ...DEFAULT_TOUCH_CONTROLS, extra: true },
  ])
    assert.throws(() => importLibrary(oldProfile({ hand: 'left', touch })));
});
