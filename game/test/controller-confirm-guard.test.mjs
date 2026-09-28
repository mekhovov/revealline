import test from 'node:test';
import assert from 'node:assert/strict';
import { attachControllerConfirmGuard } from '../ui/controller-confirm-guard.mjs';

function setup(t) {
  let time = 100,
    nativeActivations = 0,
    programmaticActivations = 0;
  const doc = new EventTarget();
  doc.defaultView = new EventTarget();
  const guard = attachControllerConfirmGuard({
    document: doc,
    now: () => time,
  });
  const emit = (type, properties = {}) => {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(properties))
      Object.defineProperty(event, key, { value });
    doc.dispatchEvent(event);
    return event;
  };
  const target = {
    id: 'sound',
    click() {
      const event = emit('click', { button: 0, detail: 0, isTrusted: false });
      if (!event.defaultPrevented) programmaticActivations++;
    },
  };
  doc.addEventListener('click', (event) => {
    if (!event.defaultPrevented && event.isTrusted === true) nativeActivations++;
  });
  t.after(() => guard.destroy());
  return {
    doc,
    guard,
    target,
    emit,
    setTime(value) {
      time = value;
    },
    get nativeActivations() {
      return nativeActivations;
    },
    get programmaticActivations() {
      return programmaticActivations;
    },
  };
}

test('Gamepad-first keyboard, pointer, and click echoes are consumed until release commit', (t) => {
  const h = setup(t);
  h.guard.begin(h.target, { buttons: [0], gamepadTimestamp: 10 });
  for (const type of ['keydown', 'keypress', 'keyup'])
    assert.equal(h.emit(type, { key: 'Enter' }).defaultPrevented, true);
  const pointer = {
    button: 0,
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
    isTrusted: true,
    sourceCapabilities: { firesTouchEvents: true },
  };
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
    assert.equal(h.emit(type, pointer).defaultPrevented, true);
  assert.equal(h.guard.activate(h.target), true);
  assert.equal(h.programmaticActivations, 1);
  h.guard.finish();
  assert.equal(h.emit('click', pointer).defaultPrevented, true);
  assert.equal(h.programmaticActivations, 1);
});

test('a release-only trusted click cannot reverse a committed controller action', (t) => {
  const h = setup(t);
  h.guard.begin(h.target);
  assert.equal(h.guard.activate(h.target), true);
  h.guard.finish();
  h.setTime(1100);
  assert.equal(h.emit('click', { button: -1, detail: 0, isTrusted: true }).defaultPrevented, true);
  assert.equal(h.programmaticActivations, 1);
  assert.equal(h.nativeActivations, 0);
});

for (const event of [
  { button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true, isTrusted: true },
  { button: 0, pointerId: 2, pointerType: 'touch', isPrimary: true, isTrusted: true },
  { button: 0, pointerId: 3, pointerType: 'pen', isPrimary: true, isTrusted: true },
  {
    button: 0,
    pointerId: 4,
    pointerType: 'mouse',
    isPrimary: true,
    isTrusted: true,
    sourceCapabilities: { firesTouchEvents: true },
  },
])
  test(`a primary ${event.pointerType} representation is owned by the transaction`, (t) => {
    const h = setup(t);
    h.guard.begin(h.target);
    assert.equal(h.emit('pointerdown', event).defaultPrevented, true);
    assert.equal(h.emit('pointerup', event).defaultPrevented, true);
    assert.equal(h.emit('click', event).defaultPrevented, true);
    assert.equal(h.guard.activate(h.target), true);
    h.guard.finish();
    assert.equal(h.programmaticActivations, 1);
  });

test('a trusted native-first activation remains the winner for a five-second hold', (t) => {
  const h = setup(t);
  assert.equal(h.emit('click', { button: -1, detail: 0, isTrusted: true }).defaultPrevented, false);
  assert.equal(h.nativeActivations, 1);
  h.setTime(120);
  assert.equal(h.guard.begin(h.doc), 'native');
  h.setTime(5120);
  assert.equal(h.guard.activate(h.target), false);
  h.guard.finish();
  assert.equal(h.programmaticActivations, 0);
  assert.equal(h.nativeActivations, 1);
});

test('an unrelated or stale native activation does not suppress release commit', (t) => {
  const h = setup(t);
  h.emit('click', { button: 0, detail: 1, isTrusted: true });
  h.setTime(400);
  h.guard.begin(h.target);
  assert.equal(h.guard.activate(h.target), true);
  h.guard.finish();
  assert.equal(h.nativeActivations, 1);
  assert.equal(h.programmaticActivations, 1);
});

test('rapid deliberate transactions each activate once', (t) => {
  const h = setup(t);
  h.guard.begin(h.target, { buttons: [0] });
  h.guard.activate(h.target);
  h.guard.finish();
  h.setTime(132);
  h.guard.begin(h.target, { buttons: [0] });
  h.guard.activate(h.target);
  h.guard.finish();
  assert.equal(h.programmaticActivations, 2);
});

test('legacy observed hosts activate once per press without opening a release transaction', (t) => {
  const h = setup(t);
  h.guard.observe(true);
  assert.equal(h.guard.activate(h.target), true);
  assert.equal(h.guard.activate(h.target), false);
  assert.equal(h.guard.active(), false);
  h.guard.observe(false);
  h.setTime(1400);
  h.guard.observe(true);
  assert.equal(h.guard.activate(h.target), true);
  assert.equal(h.guard.active(), false);
  assert.equal(h.programmaticActivations, 2);
});

test('synchronous host input cleanup cannot split a committed release transaction', (t) => {
  const events = [];
  let guard;
  const doc = new EventTarget();
  doc.defaultView = new EventTarget();
  const target = {
    id: 'start',
    click() {
      guard.cancel('input-clear');
    },
  };
  guard = attachControllerConfirmGuard({
    document: doc,
    now: () => 100,
    onTrace: (event) => events.push(event.event),
  });
  t.after(() => guard.destroy());
  guard.begin(target);
  assert.equal(guard.activate(target), true);
  guard.finish();
  assert.deepEqual(events.slice(0, 3), ['transaction-start', 'commit', 'transaction-finish']);
});

test('cancel and blur retire a transaction without activation', (t) => {
  const h = setup(t);
  h.guard.begin(h.target);
  h.guard.cancel('disconnect');
  assert.equal(h.programmaticActivations, 0);
  h.setTime(1500);
  h.guard.begin(h.target);
  h.doc.defaultView.dispatchEvent(new Event('blur'));
  assert.equal(h.guard.active(), false);
  assert.equal(h.programmaticActivations, 0);
});

test('touchscreen and keyboard work after the release grace period', (t) => {
  const h = setup(t);
  h.guard.begin(h.target);
  h.guard.activate(h.target);
  h.guard.finish();
  h.setTime(1351);
  const touch = {
    button: 0,
    pointerId: 8,
    pointerType: 'touch',
    isPrimary: true,
    isTrusted: true,
  };
  assert.equal(h.emit('pointerdown', touch).defaultPrevented, false);
  assert.equal(h.emit('pointerup', touch).defaultPrevented, false);
  assert.equal(h.emit('click', touch).defaultPrevented, false);
  assert.equal(h.emit('keydown', { key: 'Enter' }).defaultPrevented, false);
});

test('modified keys and secondary clicks are never treated as Confirm echoes', (t) => {
  const h = setup(t);
  h.guard.begin(h.target);
  assert.equal(h.emit('keydown', { key: 'Enter', altKey: true }).defaultPrevented, false);
  assert.equal(
    h.emit('pointerdown', { button: 2, pointerType: 'mouse', isTrusted: true }).defaultPrevented,
    false,
  );
});
