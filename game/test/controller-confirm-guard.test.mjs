import test from 'node:test';
import assert from 'node:assert/strict';
import { attachControllerConfirmGuard } from '../ui/controller-confirm-guard.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { resolveControllerBindings } from '../controller-bindings.mjs';

function setup(t, options = {}) {
  const { guardNow, ...routerOptions } = options;
  const pad = {
    index: 0,
    id: 'Steam Deck',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  let pads = [pad],
    unavailable = false,
    nativeEvents = 0;
  const router = createControllerRouter({
    autoJoin: true,
    navigationAliases: true,
    eventTarget: null,
    readPads: () => {
      if (unavailable) throw new Error('Unavailable');
      return pads;
    },
    ...routerOptions,
  });
  const doc = new EventTarget();
  doc.defaultView = new EventTarget();
  const guard = attachControllerConfirmGuard({
    document: doc,
    confirmPressed: router.menuConfirmPressed,
    ...(guardNow ? { now: guardNow } : {}),
  });
  for (const type of [
    'keydown',
    'keypress',
    'keyup',
    'pointerdown',
    'pointerup',
    'mousedown',
    'mouseup',
    'click',
  ])
    doc.addEventListener(type, () => nativeEvents++);
  const sample = (scope = 'menu') => router.sample({ scope });
  const emit = (type, properties = {}) => {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(properties))
      Object.defineProperty(event, key, { value });
    doc.dispatchEvent(event);
    return event.defaultPrevented;
  };
  const activate = (properties = { button: 0, detail: 0 }) => {
    let prevented = null;
    const accepted = guard.activate({
      click() {
        prevented = emit('click', properties);
      },
    });
    return { accepted, prevented };
  };
  sample();
  t.after(() => {
    guard.destroy();
    router.destroy();
  });
  return {
    pad,
    router,
    guard,
    doc,
    sample,
    emit,
    activate,
    get nativeEvents() {
      return nativeEvents;
    },
    setPads: (value) => {
      pads = value;
    },
    deny: () => {
      unavailable = true;
    },
  };
}

for (const key of ['Enter', ' '])
  for (const order of ['native-first', 'gamepad-first'])
    test(`${key === ' ' ? 'Space' : 'Enter'} mirrored from A is consumed ${order}, including keyup`, (t) => {
      const h = setup(t);
      h.pad.buttons[0].pressed = true;
      if (order === 'gamepad-first') assert.equal(h.sample().ui.confirm, true);
      assert.equal(h.emit('keydown', { key }), true);
      if (order === 'native-first') assert.equal(h.sample().ui.confirm, true);
      assert.equal(h.emit('keydown', { key, repeat: true }), true);
      assert.equal(h.sample().ui.confirm, false, 'Holding A cannot apply twice');
      h.pad.buttons[0].pressed = false;
      h.sample();
      assert.equal(
        h.emit('keyup', { key }),
        true,
        'Space release cannot activate a second control',
      );
      assert.equal(h.nativeEvents, 0, 'No native input reaches the menu cancellation handler');
      h.pad.buttons[0].pressed = true;
      assert.equal(h.sample().ui.confirm, true, 'A separate press is still accepted');
    });

for (const order of ['native-first', 'gamepad-first'])
  test(`A plus a desktop mouse click is consumed ${order}, while controller .click() runs`, (t) => {
    const h = setup(t);
    const mouse = { button: 0, pointerType: 'mouse', detail: 1, isTrusted: true };
    h.pad.buttons[0].pressed = true;
    if (order === 'gamepad-first') assert.equal(h.sample().ui.confirm, true);
    assert.equal(h.emit('pointerdown', mouse), true);
    assert.equal(h.emit('mousedown', mouse), true);
    if (order === 'native-first') assert.equal(h.sample().ui.confirm, true);
    assert.deepEqual(h.activate(), { accepted: true, prevented: false });
    h.pad.buttons[0].pressed = false;
    h.sample();
    assert.equal(h.emit('pointerup', mouse), true);
    assert.equal(h.emit('mouseup', mouse), true);
    assert.equal(h.emit('click', mouse), true);
    assert.equal(h.nativeEvents, 1);
    assert.equal(h.emit('pointerdown', mouse), false, 'Next ordinary mouse gesture is usable');
    assert.equal(h.emit('click', mouse), false);
  });

for (const source of [
  {
    name: 'touch pointer',
    event: { button: 0, pointerId: 7, pointerType: 'touch', isPrimary: true, detail: 1 },
  },
  {
    name: 'pen pointer',
    event: { button: 0, pointerId: 9, pointerType: 'pen', isPrimary: true, detail: 1 },
  },
  {
    name: 'touch-derived compatibility pointer',
    event: {
      button: 0,
      pointerId: 11,
      pointerType: 'mouse',
      isPrimary: true,
      detail: 1,
      sourceCapabilities: { firesTouchEvents: true },
    },
  },
])
  for (const order of ['native-first', 'gamepad-first'])
    test(`A owns its ${source.name} echo ${order}`, (t) => {
      const h = setup(t),
        trusted = { ...source.event, isTrusted: true };
      h.pad.buttons[0].pressed = true;
      if (order === 'gamepad-first') assert.equal(h.sample().ui.confirm, true);
      assert.equal(h.emit('pointerdown', trusted), true);
      assert.equal(h.emit('mousedown', trusted), true);
      if (order === 'native-first') assert.equal(h.sample().ui.confirm, true);
      assert.deepEqual(h.activate(), { accepted: true, prevented: false });
      h.pad.buttons[0].pressed = false;
      h.sample();
      assert.equal(h.emit('pointerup', trusted), true);
      assert.equal(h.emit('mouseup', trusted), true);
      assert.equal(h.emit('click', trusted), true);
      assert.equal(h.nativeEvents, 1, 'only the intended controller activation reaches the page');
    });

test('menu confirm survives resume and its native tail cannot pause the new flight', (t) => {
  const h = setup(t);
  h.pad.buttons[0].pressed = true;
  assert.equal(h.sample().ui.confirm, true);
  h.router.clear();
  h.sample('flight');
  assert.equal(h.emit('keydown', { key: ' ' }), true);
  h.pad.buttons[0].pressed = false;
  h.sample('flight');
  assert.equal(h.emit('keyup', { key: ' ' }), true);
  h.pad.buttons[0].pressed = true;
  assert.equal(
    h.emit('keydown', { key: ' ' }),
    false,
    'A new flight gesture is not a menu confirm',
  );
});

test('a sampled Confirm owns delayed keyboard and mouse echoes after A is released', (t) => {
  let time = 100;
  const h = setup(t, { guardNow: () => time });
  h.pad.buttons[0].pressed = true;
  assert.equal(h.sample().ui.confirm, true);
  h.guard.observe(true);
  h.pad.buttons[0].pressed = false;
  h.sample();
  h.guard.observe(false);

  time = 350;
  assert.equal(h.emit('keydown', { key: 'Enter' }), true);
  assert.equal(h.emit('keypress', { key: 'Enter' }), true);
  assert.equal(h.emit('keyup', { key: 'Enter' }), true);
  const mouse = { button: 0, pointerType: 'mouse', detail: 1, isTrusted: true };
  assert.equal(h.emit('pointerdown', mouse), true);
  assert.equal(h.emit('pointerup', mouse), true);
  assert.equal(h.emit('click', mouse), true);

  time = 1351;
  assert.equal(h.emit('keydown', { key: 'Enter' }), false);
  assert.equal(h.emit('pointerdown', mouse), false);
});

test('a trusted click-only Steam echo is consumed while controller click() remains usable', (t) => {
  let time = 100;
  const h = setup(t, { guardNow: () => time });
  h.pad.buttons[0].pressed = true;
  assert.equal(h.sample().ui.confirm, true);
  h.guard.observe(true);
  assert.deepEqual(h.activate(), { accepted: true, prevented: false });
  h.pad.buttons[0].pressed = false;
  h.sample();
  h.guard.observe(false);

  time = 1100;
  assert.equal(
    h.emit('click', { button: 0, detail: 0, isTrusted: true }),
    true,
    'a release-activated trusted Chrome click cannot apply the action twice',
  );
  time = 1351;
  assert.equal(
    h.emit('click', { button: 0, detail: 0, isTrusted: true }),
    false,
    'a later independent trusted click remains usable',
  );
});

test('a controller activation owns untrusted and direct-touch release clicks until grace expires', (t) => {
  let time = 100,
    activations = 0;
  const h = setup(t, { guardNow: () => time });
  const target = {
    click() {
      const prevented = h.emit('click', { button: 0, detail: 0, isTrusted: false });
      if (!prevented) activations++;
    },
  };

  h.pad.buttons[0].pressed = true;
  assert.equal(h.sample().ui.confirm, true);
  h.guard.observe(true);
  assert.equal(h.guard.activate(target), true);
  assert.equal(activations, 1, 'the controller transaction activates once');
  assert.equal(
    h.emit('click', { button: 0, detail: 0, isTrusted: false }),
    true,
    'an untrusted compatibility click is not mistaken for the controller transaction',
  );

  h.pad.buttons[0].pressed = false;
  h.sample();
  h.guard.observe(false);
  time = 116;
  const directTouch = {
    button: 0,
    pointerId: 23,
    pointerType: 'touch',
    isPrimary: true,
    detail: 1,
    isTrusted: true,
  };
  assert.equal(h.emit('pointerdown', directTouch), true);
  assert.equal(h.emit('pointerup', directTouch), true);
  assert.equal(h.emit('click', directTouch), true, 'the release click cannot undo the action');
  assert.equal(activations, 1);

  time = 1351;
  assert.equal(h.emit('pointerdown', directTouch), false, 'a later touchscreen gesture is usable');
  assert.equal(h.emit('pointerup', directTouch), false);
  assert.equal(h.emit('click', directTouch), false);
});

test('an incomplete primary-pointer echo expires without swallowing the next native click', (t) => {
  let time = 100;
  const h = setup(t, { guardNow: () => time });
  h.pad.buttons[0].pressed = true;
  assert.equal(h.sample().ui.confirm, true);
  h.guard.observe(true);
  assert.equal(
    h.emit('pointerdown', {
      button: 0,
      pointerId: 7,
      pointerType: 'touch',
      isPrimary: true,
      isTrusted: true,
    }),
    true,
  );
  h.pad.buttons[0].pressed = false;
  h.sample();
  h.guard.observe(false);

  time = 1351;
  assert.equal(
    h.emit('click', {
      button: 0,
      pointerId: 7,
      pointerType: 'touch',
      isPrimary: true,
      detail: 1,
      isTrusted: true,
    }),
    false,
  );
});

test('a fresh direct touchscreen gesture takes ownership as soon as A is released', (t) => {
  let time = 100;
  const h = setup(t, { guardNow: () => time });
  h.pad.buttons[0].pressed = true;
  assert.equal(h.sample().ui.confirm, true);
  h.guard.observe(true);
  h.pad.buttons[0].pressed = false;
  h.sample();
  h.guard.observe(false);

  time = 116;
  const touch = {
    button: 0,
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
    detail: 1,
    isTrusted: true,
  };
  assert.equal(h.emit('pointerdown', touch), false);
  assert.equal(h.emit('pointerup', touch), false);
  assert.equal(h.emit('click', touch), false);
});

test('a touch-derived compatibility gesture remains owned after A is released', (t) => {
  let time = 100;
  const h = setup(t, { guardNow: () => time });
  h.pad.buttons[0].pressed = true;
  assert.equal(h.sample().ui.confirm, true);
  h.guard.observe(true);
  h.pad.buttons[0].pressed = false;
  h.sample();
  h.guard.observe(false);

  time = 116;
  const compatibility = {
    button: 0,
    pointerId: 7,
    pointerType: 'mouse',
    isPrimary: true,
    detail: 1,
    isTrusted: true,
    sourceCapabilities: { firesTouchEvents: true },
  };
  assert.equal(h.emit('pointerdown', compatibility), true);
  assert.equal(h.emit('pointerup', compatibility), true);
  assert.equal(h.emit('click', compatibility), true);
});

test('a trusted Steam click arriving before the next gamepad frame is consumed', (t) => {
  const h = setup(t);
  h.pad.buttons[0].pressed = true;
  assert.equal(
    h.emit('click', { button: 0, detail: 0, isTrusted: true }),
    true,
    'the live gamepad probe owns a native-first click',
  );
  assert.equal(h.sample().ui.confirm, true, 'the same press still reaches controller navigation');
  assert.deepEqual(h.activate(), { accepted: true, prevented: false });
});

test('a native click that wins the first frame suppresses the matching controller click', (t) => {
  let time = 100;
  const h = setup(t, { guardNow: () => time });

  assert.equal(
    h.emit('click', {
      button: -1,
      pointerId: -1,
      pointerType: '',
      detail: 0,
      isTrusted: true,
    }),
    false,
    'the first trusted activation remains usable before Gamepad state catches up',
  );
  h.pad.buttons[0].pressed = true;
  assert.equal(h.sample().ui.confirm, true);
  h.guard.observe(true);
  time = 116;
  assert.deepEqual(
    h.activate(),
    { accepted: false, prevented: null },
    'the later controller activation cannot apply the same press twice',
  );
  assert.equal(h.nativeEvents, 1, 'exactly one activation reaches the control');
});

for (const source of [
  {
    name: 'touch pointer',
    event: { button: 0, pointerId: 7, pointerType: 'touch', detail: 1, isTrusted: true },
  },
  {
    name: 'touch-derived compatibility click',
    event: {
      button: 0,
      pointerType: 'mouse',
      detail: 1,
      isTrusted: true,
      sourceCapabilities: { firesTouchEvents: true },
    },
  },
])
  test(`a ${source.name} activation can win before the Gamepad frame`, (t) => {
    let time = 100;
    const h = setup(t, { guardNow: () => time });

    assert.equal(
      h.emit('click', source.event),
      false,
      'standalone native activation reaches the page',
    );
    h.pad.buttons[0].pressed = true;
    assert.equal(h.sample().ui.confirm, true);
    h.guard.observe(true);
    time = 116;
    assert.deepEqual(
      h.activate(),
      { accepted: false, prevented: null },
      'the later controller activation cannot repeat the touch-classified activation',
    );
    assert.equal(h.nativeEvents, 1);
  });

test('a long-held A owns its keyboard and non-pointer release without a polling deadline', (t) => {
  let time = 100;
  const h = setup(t, { guardNow: () => time });

  assert.equal(h.emit('keydown', { key: ' ' }), false, 'native input can lead Gamepad state');
  h.pad.buttons[0].pressed = true;
  assert.equal(h.sample().ui.confirm, true);
  h.guard.observe(true);

  time = 10_000;
  h.pad.buttons[0].pressed = false;
  h.sample();
  h.guard.observe(false);
  assert.equal(h.emit('keyup', { key: ' ' }), true, 'release default is canceled');
  assert.equal(
    h.emit('click', {
      button: -1,
      pointerId: -1,
      pointerType: '',
      detail: 0,
      isTrusted: true,
    }),
    true,
    'the release click is consumed even when it is not a mouse click',
  );
  assert.equal(h.nativeEvents, 1, 'only the leading keydown reaches native listeners');
});

test('a delayed native tail cannot activate the first control after paused Home opens', (t) => {
  let time = 100,
    homeOpen = false,
    resumed = false;
  const h = setup(t, { guardNow: () => time });
  h.pad.buttons[0].pressed = true;
  assert.equal(h.sample().ui.confirm, true);
  h.guard.observe(true);
  homeOpen = true;
  h.pad.buttons[0].pressed = false;
  h.sample();

  time = 260;
  const prevented = h.emit('keydown', { key: 'Enter' });
  if (!prevented) {
    homeOpen = false;
    resumed = true;
  }
  h.emit('keyup', { key: 'Enter' });
  assert.equal(prevented, true);
  assert.equal(homeOpen, true);
  assert.equal(resumed, false);
});

test('the echo window follows a long-held A press through its release', (t) => {
  let time = 100;
  const h = setup(t, { guardNow: () => time });
  h.pad.buttons[0].pressed = true;
  assert.equal(h.sample().ui.confirm, true);
  h.guard.observe(true);
  time = 1200;
  h.guard.observe(true);
  h.pad.buttons[0].pressed = false;
  h.sample();
  h.guard.observe(false);

  time = 1600;
  assert.equal(h.emit('keydown', { key: 'Enter' }), true);
  assert.equal(h.emit('keyup', { key: 'Enter' }), true);
  time = 2451;
  assert.equal(h.emit('keydown', { key: 'Enter' }), false);
});

test('a lifecycle boundary blocks stale Confirm until a neutral frame, then restores keyboard', (t) => {
  let time = 100;
  const h = setup(t, { guardNow: () => time });
  h.pad.buttons[0].pressed = true;
  assert.equal(h.sample().ui.confirm, true);
  h.guard.observe(true);
  h.guard.requireNeutral();

  time = 5000;
  assert.equal(h.emit('keydown', { key: 'Enter' }), true, 'held Confirm remains authoritative');
  assert.equal(h.emit('keyup', { key: 'Enter' }), true);
  h.pad.buttons[0].pressed = false;
  h.sample();
  h.guard.observe(false);
  assert.equal(h.emit('keydown', { key: 'Enter' }), false, 'fresh keyboard works after neutral');
});

test('a neutral controller does not suppress keyboard, mouse, touch, pen, text, or shortcuts', (t) => {
  const h = setup(t);
  for (const key of ['Enter', ' ', 'x', 'ArrowDown'])
    assert.equal(h.emit('keydown', { key }), false);
  assert.equal(h.emit('pointerdown', { button: 0, pointerType: 'mouse' }), false);
  for (const pointerType of ['touch', 'pen']) {
    const event = { button: 0, pointerType, detail: 1, isTrusted: true };
    for (const type of ['pointerdown', 'pointerup', 'click'])
      assert.equal(h.emit(type, event), false);
  }
  assert.equal(
    h.emit('pointerdown', { button: 0, sourceCapabilities: { firesTouchEvents: true } }),
    false,
  );
  assert.equal(h.emit('pointerdown', { button: 2, pointerType: 'mouse' }), false);
  assert.equal(h.emit('keydown', { key: 'x' }), false);
  assert.equal(h.emit('keydown', { key: 'Enter', altKey: true }), false);
});

test('the guard follows custom Confirm bindings and default West alias', (t) => {
  const h = setup(t);
  h.pad.buttons[2].pressed = true;
  assert.equal(h.emit('keydown', { key: 'Enter' }), true);
  h.emit('keyup', { key: 'Enter' });
  h.pad.buttons[2].pressed = false;
  const bindings = resolveControllerBindings(null);
  [bindings.menu.buttons.confirm, bindings.menu.buttons.back] = [
    bindings.menu.buttons.back,
    bindings.menu.buttons.confirm,
  ];
  h.router.setBindings(bindings);
  h.sample();
  for (const index of [0, 2]) {
    h.pad.buttons[index].pressed = true;
    assert.equal(h.emit('keydown', { key: 'Enter' }), false);
    h.pad.buttons[index].pressed = false;
  }
  h.pad.buttons[1].pressed = true;
  assert.equal(h.emit('keydown', { key: 'Enter' }), true);
  assert.equal(h.sample().ui.confirm, true);
});

test('the live probe neither consumes edges nor adopts a different/disconnected controller', (t) => {
  const h = setup(t);
  h.pad.buttons[0].pressed = true;
  assert.equal(h.router.menuConfirmPressed(), true);
  assert.equal(h.router.menuConfirmPressed(), true);
  assert.equal(h.sample().ui.confirm, true);
  h.setPads([{ ...h.pad, id: 'Replacement controller' }]);
  assert.equal(h.router.menuConfirmPressed(), false);
  h.setPads([{ ...h.pad, connected: false }]);
  assert.equal(h.router.menuConfirmPressed(), false);
  h.setPads([{ ...h.pad, mapping: '' }]);
  assert.equal(h.router.menuConfirmPressed(), false);
  h.deny();
  assert.equal(h.router.menuConfirmPressed(), false);
});

test('blur and disposal retire incomplete native gestures', (t) => {
  const h = setup(t);
  h.pad.buttons[0].pressed = true;
  assert.equal(h.emit('keydown', { key: 'Enter' }), true);
  h.doc.defaultView.dispatchEvent(new Event('blur'));
  h.pad.buttons[0].pressed = false;
  assert.equal(h.emit('keydown', { key: 'Enter' }), false);
  h.guard.destroy();
  h.pad.buttons[0].pressed = true;
  assert.equal(h.emit('keydown', { key: 'Enter' }), false);
});

test('a canceled controller-owned pointer cannot suppress a later independent click', (t) => {
  const h = setup(t);
  h.pad.buttons[0].pressed = true;
  assert.equal(h.emit('pointerdown', { button: 0, pointerId: 7, pointerType: 'touch' }), true);
  assert.equal(h.emit('pointercancel', { button: -1, pointerId: 7, pointerType: 'touch' }), true);
  h.pad.buttons[0].pressed = false;
  assert.equal(
    h.emit('click', { button: 0, pointerType: 'touch', detail: 1, isTrusted: true }),
    false,
  );
});
