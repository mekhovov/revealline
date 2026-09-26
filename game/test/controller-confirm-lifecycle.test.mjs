import test from 'node:test';
import assert from 'node:assert/strict';
import { createControllerConfirmLifecycle } from '../ui/controller-confirm-lifecycle.mjs';

const frame = ({
  confirm = false,
  held = false,
  code = 'connected',
  disconnected = false,
} = {}) => ({
  assigned: disconnected ? null : { index: 0 },
  confirmHeld: held,
  disconnected,
  status: { code },
  ui: { direction: null, confirm, back: false, menu: false },
});

test('a short-tap release pulse remains one Confirm activation', () => {
  const lifecycle = createControllerConfirmLifecycle();
  assert.equal(lifecycle.filter(frame({ confirm: true, held: true }), 0).ui.confirm, true);
  assert.equal(lifecycle.owned(), true);
  assert.equal(lifecycle.filter(frame(), 16).ui.confirm, false);
  assert.equal(lifecycle.filter(frame({ confirm: true, held: true }), 32).ui.confirm, false);
  assert.equal(lifecycle.filter(frame(), 48).ui.confirm, false);
  lifecycle.filter(frame(), 168);
  assert.equal(lifecycle.owned(), false);
  assert.equal(lifecycle.filter(frame({ confirm: true, held: true }), 184).ui.confirm, true);
});

test('a long hold and joining own the complete gesture without an activation deadline', () => {
  const lifecycle = createControllerConfirmLifecycle();
  lifecycle.filter(frame({ held: true, code: 'joined' }), 0);
  assert.equal(lifecycle.owned(), true);
  assert.equal(lifecycle.filter(frame({ held: true }), 5000).ui.confirm, false);
  assert.equal(lifecycle.owned(), true);
  lifecycle.filter(frame(), 5016);
  lifecycle.filter(frame(), 5136);
  assert.equal(lifecycle.owned(), false);
});

test('stable neutral can rearm on the next sampled press and disconnect clears ownership', () => {
  const lifecycle = createControllerConfirmLifecycle();
  lifecycle.filter(frame({ confirm: true, held: true }), 0);
  lifecycle.filter(frame(), 10);
  assert.equal(lifecycle.filter(frame({ confirm: true, held: true }), 130).ui.confirm, true);
  lifecycle.filter(frame({ disconnected: true }), 140);
  assert.equal(lifecycle.owned(), false);
});

test('invalid release timing is rejected', () => {
  for (const releaseMs of [-1, 1001, NaN])
    assert.throws(() => createControllerConfirmLifecycle({ releaseMs }), RangeError);
});
