import test from 'node:test';
import assert from 'node:assert/strict';
import { attachFreshActivationGuard } from '../ui/fresh-activation-guard.mjs';

function setup(t) {
  const document = new EventTarget(),
    guard = attachFreshActivationGuard({ document });
  t.after(() => guard.destroy());
  const emit = (type, properties = {}) => {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(properties))
      Object.defineProperty(event, key, { value });
    document.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { guard, emit };
}

test('a keyboard activation held across a result boundary needs release and a fresh press', (t) => {
  const { guard, emit } = setup(t);
  assert.equal(emit('keydown', { key: 'Enter', code: 'Enter', repeat: false }), false);
  guard.requireFresh();
  assert.equal(emit('keydown', { key: 'Enter', code: 'Enter', repeat: true }), true);
  assert.equal(emit('keyup', { key: 'Enter', code: 'Enter' }), true);
  assert.equal(emit('click'), true, 'the held key release cannot click the newly focused action');
  assert.equal(emit('keydown', { key: 'Enter', code: 'Enter', repeat: false }), false);
  assert.equal(emit('click'), false, 'a new key gesture can activate');
});

test('a touch held across a result boundary cannot release into Retry', (t) => {
  const { guard, emit } = setup(t),
    held = { button: 0, isPrimary: true, pointerId: 7, pointerType: 'touch' },
    fresh = { ...held, pointerId: 8 };
  assert.equal(emit('pointerdown', held), false);
  guard.requireFresh();
  assert.equal(emit('pointerup', held), true);
  guard.requireFresh();
  assert.equal(emit('click'), true, 'the compatibility click from the old touch is consumed');
  assert.equal(emit('pointerdown', fresh), false);
  assert.equal(emit('pointerup', fresh), false);
  assert.equal(emit('click'), false, 'a separate touch gesture can activate');
});

test('a fresh controller transaction remains independent from a stale native click tail', (t) => {
  const { guard, emit } = setup(t);
  emit('pointerdown', { button: 0, isPrimary: true, pointerId: 7, pointerType: 'touch' });
  guard.requireFresh();
  emit('pointerup', { button: 0, isPrimary: true, pointerId: 7, pointerType: 'touch' });
  assert.equal(
    guard.programmatic(() => emit('click')),
    false,
  );
  assert.equal(emit('click'), true, 'only the stale native tail remains guarded');
});
