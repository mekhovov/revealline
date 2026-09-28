import test from 'node:test';
import assert from 'node:assert/strict';
import { createControllerConfirmLifecycle } from '../ui/controller-confirm-lifecycle.mjs';

const frame = ({
  confirm = false,
  buttons = [],
  code = 'connected',
  disconnected = false,
  timestamp = 0,
} = {}) => ({
  assigned: disconnected ? null : { index: 0 },
  confirmHeld: buttons.length > 0,
  confirmButtons: buttons,
  gamepadTimestamp: timestamp,
  disconnected,
  status: { code },
  ui: { direction: null, confirm, back: false, menu: false },
});
const at = (timeMs, scope = 'menu') => ({ timeMs, scope });

test('a short tap captures on press and commits once on release', () => {
  const lifecycle = createControllerConfirmLifecycle();
  const down = lifecycle.filter(frame({ confirm: true, buttons: [0], timestamp: 10 }), at(0));
  assert.equal(down.ui.confirm, false);
  assert.equal(down.ui.confirmStart, true);
  assert.equal(lifecycle.owned(), true);
  const held = lifecycle.filter(frame({ buttons: [0], timestamp: 20 }), at(16));
  assert.equal(held.ui.confirmCommit, false);
  const up = lifecycle.filter(frame({ timestamp: 30 }), at(32));
  assert.equal(up.ui.confirmCommit, true);
  assert.deepEqual(up.confirmTransaction.buttons, [0]);
  assert.equal(lifecycle.owned(), false);
  assert.equal(lifecycle.filter(frame(), at(48)).ui.confirmCommit, false);
});

test('a five-second hold cannot commit before physical release', () => {
  const lifecycle = createControllerConfirmLifecycle();
  lifecycle.filter(frame({ confirm: true, buttons: [0] }), at(0));
  assert.equal(lifecycle.filter(frame({ buttons: [0] }), at(5000)).ui.confirmCommit, false);
  assert.equal(lifecycle.owned(), true);
  assert.equal(lifecycle.filter(frame(), at(5016)).ui.confirmCommit, true);
});

test('overlapping South and West aliases stay one transaction', () => {
  const lifecycle = createControllerConfirmLifecycle();
  assert.equal(
    lifecycle.filter(frame({ confirm: true, buttons: [0] }), at(0)).ui.confirmStart,
    true,
  );
  lifecycle.filter(frame({ buttons: [0, 2] }), at(20));
  lifecycle.filter(frame({ buttons: [2] }), at(40));
  const release = lifecycle.filter(frame(), at(60));
  assert.equal(release.ui.confirmCommit, true);
  assert.deepEqual(release.confirmTransaction.buttons, [0, 2]);
});

test('a delayed cross-alias pulse is suppressed while same-source repeat is accepted', () => {
  const lifecycle = createControllerConfirmLifecycle();
  lifecycle.filter(frame({ confirm: true, buttons: [0] }), at(0));
  lifecycle.filter(frame(), at(20));
  const alias = lifecycle.filter(frame({ confirm: true, buttons: [2] }), at(900));
  assert.equal(alias.ui.confirmStart, false);
  assert.equal(lifecycle.owned(), true);
  lifecycle.filter(frame(), at(920));
  const repeat = lifecycle.filter(frame({ confirm: true, buttons: [0] }), at(940));
  assert.equal(repeat.ui.confirmStart, true);
  assert.equal(lifecycle.filter(frame(), at(960)).ui.confirmCommit, true);
  const laterAlias = lifecycle.filter(frame({ confirm: true, buttons: [2] }), at(2300));
  assert.equal(laterAlias.ui.confirmStart, true);
});

test('scope changes and disconnect cancel without committing', () => {
  const lifecycle = createControllerConfirmLifecycle();
  lifecycle.filter(frame({ confirm: true, buttons: [0] }), at(0, 'ready'));
  assert.equal(lifecycle.filter(frame({ buttons: [0] }), at(20, 'paused')).ui.confirmCancel, true);
  assert.equal(lifecycle.filter(frame(), at(40, 'paused')).ui.confirmCommit, false);
  lifecycle.filter(frame({ confirm: true, buttons: [0] }), at(60, 'paused'));
  assert.equal(
    lifecycle.filter(frame({ disconnected: true }), at(80, 'paused')).ui.confirmCancel,
    true,
  );
  assert.equal(lifecycle.owned(), false);
});

test('custom Confirm index is retained in the transaction', () => {
  const lifecycle = createControllerConfirmLifecycle();
  lifecycle.filter(frame({ confirm: true, buttons: [7], timestamp: 123 }), at(0));
  const release = lifecycle.filter(frame({ timestamp: 150 }), at(16));
  assert.equal(release.ui.confirmCommit, true);
  assert.equal(release.confirmTransaction.originalButton, 7);
  assert.equal(release.confirmTransaction.gamepadTimestamp, 123);
});

test('invalid alias timing is rejected', () => {
  for (const aliasEchoWindowMs of [-1, 5001, NaN])
    assert.throws(() => createControllerConfirmLifecycle({ aliasEchoWindowMs }), RangeError);
});
