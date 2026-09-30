import test from 'node:test';
import assert from 'node:assert/strict';
import { attachDemoInput } from '../ui/demo-input.mjs';
import { KEY_BINDING_PRESETS } from '../key-bindings.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { DEFAULT_CONTROLLER_BINDINGS } from '../controller-bindings.mjs';

// A bounded event surface models the capture/target/bubble boundary. It does
// not claim browser PointerEvent, native keyboard or hardware qualification.
class Target {
  constructor(parent = null, dataset = {}, tagName = 'DIV') {
    this.parent = parent;
    this.dataset = dataset;
    this.listeners = new Map();
    this.captures = new Set();
    this.tagName = tagName;
  }
  addEventListener(type, fn, options = false) {
    const entries = this.listeners.get(type) ?? [];
    entries.push({ fn, capture: options === true || options?.capture === true });
    this.listeners.set(type, entries);
  }
  removeEventListener(type, fn, options = false) {
    const capture = options === true || options?.capture === true;
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter(
        (entry) => entry.fn !== fn || entry.capture !== capture,
      ),
    );
  }
  closest(selector) {
    if (selector.includes(','))
      return (
        selector
          .split(',')
          .map((part) => this.closest(part))
          .find(Boolean) ?? null
      );
    if (selector.toUpperCase() === this.tagName) return this;
    if (selector === '[data-demo-ui]' && Object.hasOwn(this.dataset, 'demoUi')) return this;
    if (selector === '[data-demo-action]' && this.dataset.demoAction) return this;
    if (selector === '[data-demo-move]' && this.dataset.demoMove) return this;
    if (selector === '[data-demo-exit]' && Object.hasOwn(this.dataset, 'demoExit')) return this;
    return this.parent?.closest(selector) ?? null;
  }
  emit(type, props = {}) {
    const event = {
      type,
      target: this,
      defaultPrevented: false,
      stopped: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopImmediatePropagation() {
        this.stopped = true;
      },
      ...props,
    };
    const path = [];
    for (let target = this; target; target = target.parent) path.push(target);
    for (const capture of [true, false]) {
      for (const target of capture ? [...path].reverse() : path) {
        for (const entry of target.listeners.get(type) ?? []) {
          if (event.stopped) return event;
          if (entry.capture === capture) entry.fn(event);
        }
      }
    }
    return event;
  }
  key(type, code, props = {}) {
    return this.emit(type, { code, key: code, repeat: false, ...props });
  }
  pointer(type, pointerId, clientX = 20, clientY = 20) {
    return this.emit(type, { pointerId, clientX, clientY, pointerType: 'touch', button: 0 });
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 320, height: 200 };
  }
  setPointerCapture(id) {
    this.captures.add(id);
  }
  hasPointerCapture(id) {
    return this.captures.has(id);
  }
  releasePointerCapture(id) {
    this.captures.delete(id);
    this.pointer('lostpointercapture', id);
  }
}

function fixture(
  t,
  {
    phase = 'practice',
    mode = 'swipe',
    tapMode = false,
    bindings = null,
    deferred = false,
    fromMenu = false,
    uiOwned = false,
    nativeConfirmOwned,
  } = {},
) {
  const win = new Target(),
    doc = new Target(),
    root = new Target(win),
    canvas = new Target(root);
  doc.defaultView = win;
  doc.hidden = false;
  root.ownerDocument = doc;
  const state = {
    phase,
    directions: [],
    pauses: 0,
    interruptions: 0,
    backs: 0,
    takeovers: [],
    firstActions: [],
    menus: [],
    uiOwned,
  };
  let completeTakeover = () => {};
  const input = attachDemoInput({
    root,
    canvas,
    active: () => state.phase !== 'inactive',
    watching: () => state.phase === 'watching',
    takeoverAvailable: () => state.phase === 'watching' || (fromMenu && state.phase === 'menu'),
    practice: () => state.phase === 'practice',
    busy: () => state.phase === 'loading',
    ownsUI: () => state.uiOwned,
    nativeConfirmOwned,
    getBindings: () => bindings,
    getTouchSettings: () => ({ mode }),
    tapMode: () => tapMode,
    takeover(intent) {
      state.takeovers.push(intent);
      state.phase = 'loading';
      input.clear();
      return new Promise((resolve) => {
        completeTakeover = () => {
          input.clear();
          state.phase = 'practice';
          if (intent.direction) state.directions.push(intent.direction);
          if (intent.action) state.firstActions.push(intent.action);
          resolve();
        };
        if (!deferred) completeTakeover();
      });
    },
    interrupt() {
      state.interruptions++;
      state.phase = 'menu';
      input.clear();
    },
    back() {
      state.backs++;
      state.phase = 'inactive';
      input.clear();
    },
    steer(direction) {
      state.directions.push(direction);
    },
    pause() {
      state.pauses++;
      input.clear();
    },
    menu(frame) {
      state.menus.push(frame);
    },
  });
  t.after(() => input.destroy());
  return {
    win,
    doc,
    root,
    canvas,
    input,
    state,
    completeTakeover: () => completeTakeover(),
    action: (action) => new Target(root, { demoAction: action }),
    move: (direction) => new Target(root, { demoMove: direction }),
  };
}

test('practice handoff requires every observed keyboard key to become neutral before fresh steering', (t) => {
  const f = fixture(t);
  f.canvas.key('keydown', 'ArrowRight');
  f.canvas.key('keydown', 'ShiftLeft');
  assert.equal(f.input.controls().boost, true);
  f.input.clear();
  assert.ok(!f.input.controls().boost);
  f.canvas.key('keydown', 'ArrowUp');
  f.canvas.key('keyup', 'ArrowRight');
  f.canvas.key('keyup', 'ShiftLeft');
  f.canvas.key('keydown', 'KeyD');
  f.canvas.key('keyup', 'ArrowUp');
  f.canvas.key('keydown', 'KeyD', { repeat: true });
  assert.deepEqual(f.state.directions, ['right'], 'A newer held key also delays the neutral gate.');
  f.canvas.key('keyup', 'KeyD');
  f.canvas.key('keydown', 'KeyW');
  assert.deepEqual(f.state.directions, ['right', 'up']);
});

for (const lifecycle of ['blur', 'hidden']) {
  test(`${lifecycle}: an unobservable outside key release cannot permanently block practice`, (t) => {
    const f = fixture(t);
    f.canvas.key('keydown', 'ArrowRight');
    f.input.clear();
    if (lifecycle === 'blur') f.win.emit('blur');
    else {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
      f.doc.hidden = false;
    }
    // The old key was released outside this page, so no corresponding keyup arrives.
    f.canvas.key('keydown', 'ArrowDown');
    assert.deepEqual(f.state.directions, ['right', 'down']);
    f.canvas.key('keydown', 'ArrowRight', { repeat: true });
    assert.deepEqual(
      f.state.directions,
      ['right', 'down'],
      'A returning auto-repeat is not a fresh gesture.',
    );
  });
}

for (const [code, action, field] of [
  ['KeyE', 'ability', 'action'],
  ['KeyR', 'pickup', 'pickup'],
]) {
  test(`${action}: a quick keyboard or pointer impulse survives release until consumed once`, (t) => {
    const f = fixture(t),
      button = f.action(action);
    f.canvas.key('keydown', code);
    f.canvas.key('keyup', code);
    assert.equal(f.input.controls()[field], true);
    assert.ok(!f.input.controls()[field]);
    button.pointer('pointerdown', 11);
    f.win.pointer('pointerup', 11);
    assert.equal(f.input.controls()[field], true);
    assert.ok(!f.input.controls()[field]);
    f.input.controller({ flight: { [field]: true } });
    f.input.controller({ flight: {} });
    assert.equal(
      f.input.controls()[field],
      true,
      'A controller edge also survives a no-tick frame.',
    );
    assert.ok(!f.input.controls()[field]);
  });
}

test('releasing either Boost key or a separate touch cannot release another physical Boost owner', (t) => {
  const f = fixture(t),
    boost = f.action('boost');
  f.canvas.key('keydown', 'ShiftLeft');
  f.canvas.key('keydown', 'ShiftRight');
  f.canvas.key('keyup', 'ShiftLeft');
  assert.equal(f.input.controls().boost, true);
  boost.pointer('pointerdown', 11);
  f.win.pointer('pointerup', 99);
  assert.equal(f.input.controls().boost, true);
  f.win.pointer('pointerup', 11);
  assert.equal(
    f.input.controls().boost,
    true,
    'Pointer retirement leaves the keyboard owner active.',
  );
  f.canvas.key('keyup', 'ShiftRight');
  assert.ok(!f.input.controls().boost);
});

test('tap-steering toggles pointer Boost while keyboard Boost stays Hold, and lifecycle clear retires the latch', (t) => {
  const f = fixture(t, { tapMode: true }),
    boost = f.action('boost');
  f.canvas.key('keydown', 'ShiftLeft');
  assert.equal(f.input.controls().boost, true);
  f.canvas.key('keyup', 'ShiftLeft');
  assert.ok(!f.input.controls().boost, 'Tap steering does not change the bound keyboard gesture.');
  boost.pointer('pointerdown', 11);
  f.win.pointer('pointerup', 11);
  assert.equal(f.input.controls().boost, true);
  assert.equal(f.input.controls().boost, true, 'The toggle survives repeated simulation samples.');
  boost.pointer('pointerdown', 12);
  f.win.pointer('pointerup', 12);
  assert.ok(!f.input.controls().boost);
  boost.pointer('pointerdown', 13);
  f.win.pointer('pointerup', 13);
  f.input.clear();
  assert.ok(!f.input.controls().boost, 'Pause/handoff/capture-stop clear the local latch.');
  boost.pointer('pointerdown', 14);
  f.win.pointer('pointerup', 14);
  f.win.emit('blur');
  assert.ok(!f.input.controls().boost);
});

test('click-only assistive Boost toggles without a release event and preserves independent keyboard Hold', (t) => {
  const f = fixture(t),
    boost = f.action('boost');
  boost.emit('click', { detail: 0 });
  assert.equal(f.input.controls().boost, true);
  assert.equal(f.input.controls().boost, true);
  boost.emit('click', { detail: 0 });
  assert.ok(!f.input.controls().boost);
  f.canvas.key('keydown', 'ShiftRight');
  boost.emit('click', { detail: 0 });
  boost.emit('click', { detail: 0 });
  assert.equal(f.input.controls().boost, true);
  f.canvas.key('keyup', 'ShiftRight');
  assert.ok(!f.input.controls().boost);
  boost.emit('click', { detail: 0 });
  f.input.clear();
  assert.ok(!f.input.controls().boost);
});

test('cancelling the active touch Boost toggle clears it while an unrelated finger cannot', (t) => {
  const f = fixture(t, { tapMode: true }),
    boost = f.action('boost');
  boost.pointer('pointerdown', 11);
  assert.equal(f.input.controls().boost, true);
  f.win.pointer('pointercancel', 99);
  assert.equal(f.input.controls().boost, true);
  f.win.pointer('pointercancel', 11);
  assert.ok(!f.input.controls().boost);
});

for (const mode of ['stick', 'swipe']) {
  test(`${mode}: capture failure, outside release, cancellation and stale moves preserve one touch owner`, (t) => {
    const f = fixture(t, { mode });
    f.canvas.setPointerCapture = () => {
      throw new Error('Capture unavailable');
    };
    f.canvas.pointer('pointerdown', 11);
    f.canvas.pointer('pointermove', 11, 50, 20);
    assert.deepEqual(f.state.directions, ['right']);
    f.win.pointer('pointerup', 99);
    f.win.pointer('pointerup', 11);
    f.canvas.pointer('pointerup', 11);
    f.canvas.pointer('pointermove', 11, 50, 60);
    assert.deepEqual(f.state.directions, ['right']);
    assert.equal(f.state.pauses, 0, 'Ordinary release preserves flight, even outside the arena.');
    f.canvas.pointer('pointerdown', 22);
    f.win.pointer('pointercancel', 11);
    f.canvas.pointer('pointermove', 22, 20, 60);
    assert.deepEqual(f.state.directions, ['right', 'down']);
    f.win.pointer('pointercancel', 22);
    f.canvas.pointer('pointercancel', 22);
    f.canvas.pointer('lostpointercapture', 22);
    f.canvas.pointer('pointermove', 22, 80, 60);
    assert.equal(f.state.pauses, 1, 'Only cancellation of the owned gesture pauses once.');
    assert.deepEqual(f.state.directions, ['right', 'down']);
  });
}

test('deliberate clear retires a captured steering finger before late capture notifications', (t) => {
  const f = fixture(t);
  f.canvas.pointer('pointerdown', 41);
  assert.equal(f.canvas.captures.size, 1);
  f.input.clear();
  assert.equal(f.canvas.captures.size, 0);
  f.canvas.pointer('lostpointercapture', 41);
  f.canvas.pointer('pointercancel', 41);
  f.canvas.pointer('pointermove', 41, 100, 20);
  assert.deepEqual(f.state.directions, []);
  assert.equal(f.state.pauses, 0);
});

test('a fresh configured keyboard direction takes over once, survives async clear, and never leaks to ordinary input', (t) => {
  const f = fixture(t, {
    phase: 'watching',
    bindings: KEY_BINDING_PRESETS['right-hand'],
    deferred: true,
  });
  let ordinaryInputs = 0;
  f.canvas.addEventListener('keydown', () => ordinaryInputs++);
  assert.equal(f.canvas.key('keydown', 'KeyL', { key: 'д' }).defaultPrevented, true);
  assert.deepEqual(f.state.takeovers, [{ direction: 'right' }]);
  assert.equal(ordinaryInputs, 0);
  assert.equal(f.state.phase, 'loading');
  f.canvas.key('keydown', 'KeyL', { repeat: true });
  f.canvas.key('keyup', 'KeyL');
  f.canvas.key('keydown', 'KeyI');
  f.input.clear();
  f.completeTakeover();
  assert.deepEqual(f.state.directions, ['right']);
  assert.equal(f.state.takeovers.length, 1);
  assert.equal(f.state.interruptions, 0);
  f.canvas.key('keydown', 'KeyI', { repeat: true });
  assert.deepEqual(f.state.directions, ['right']);
  f.canvas.key('keyup', 'KeyI');
  f.canvas.key('keydown', 'KeyI');
  assert.deepEqual(f.state.directions, ['right', 'up']);
});

for (const hasPointerId of [true, false]) {
  test(`Back exits watching on pointerdown and consumes its trailing ${hasPointerId ? 'PointerEvent' : 'MouseEvent'} click after Home restores`, (t) => {
    const f = fixture(t, { phase: 'watching' }),
      header = new Target(f.root, { demoUi: '' }),
      button = new Target(header, { demoExit: '' }, 'BUTTON'),
      label = new Target(button),
      home = new Target(f.win);
    let activations = 0;
    home.addEventListener('click', () => activations++);
    const down = label.pointer('pointerdown', 11);
    assert.equal(down.defaultPrevented, true);
    assert.equal(f.state.backs, 1);
    assert.equal(f.state.interruptions, 0);
    assert.equal(f.state.phase, 'inactive');
    home.pointer('pointerup', 11);
    const click = home.emit('click', { detail: 1, ...(hasPointerId ? { pointerId: 11 } : {}) });
    assert.equal(click.defaultPrevented, true);
    assert.equal(activations, 0, 'Closing the dialog cannot activate the restored Home control.');
    home.pointer('pointerdown', 11);
    home.pointer('pointerup', 11);
    home.emit('click', { detail: 1, ...(hasPointerId ? { pointerId: 11 } : {}) });
    assert.equal(activations, 1, 'A new deliberate Home gesture is not suppressed.');
    assert.deepEqual(f.state.directions, []);
  });
}

for (const [code, key] of [
  ['Enter', 'Enter'],
  ['NumpadEnter', 'Enter'],
  ['Space', ' '],
]) {
  for (const phase of ['watching', 'loading', 'practice'])
    test(`Back inside Demo UI exits ${phase} on ${code} and consumes repeats, release and click after focus moves Home`, async (t) => {
      const f = fixture(t, { phase }),
        header = new Target(f.root, { demoUi: '' }),
        button = new Target(header, { demoExit: '' }, 'BUTTON'),
        label = new Target(button),
        home = new Target(f.win);
      let activations = 0;
      home.addEventListener('click', () => activations++);
      assert.equal(label.key('keydown', code, { key }).defaultPrevented, true);
      assert.equal(f.state.backs, 1);
      assert.equal(f.state.interruptions, 0);
      assert.equal(home.key('keydown', code, { key, repeat: true }).defaultPrevented, true);
      assert.equal(home.key('keyup', code, { key }).defaultPrevented, true);
      assert.equal(home.emit('click', { detail: 0 }).defaultPrevented, true);
      assert.equal(activations, 0);
      assert.equal(f.state.backs, 1);
      await Promise.resolve();
      home.key('keydown', code, { key });
      home.key('keyup', code, { key });
      home.emit('click', { detail: 0 });
      assert.equal(activations, 1, 'A separate keyboard activation still reaches Home.');
      assert.deepEqual(f.state.directions, []);
    });
}

test('Back reports only an actual fresh unmodified native activation to the Confirm owner', (t) => {
  const probes = [],
    f = fixture(t, {
      phase: 'watching',
      nativeConfirmOwned: (event) => {
        probes.push(event);
        return false;
      },
    }),
    button = new Target(new Target(f.root, { demoUi: '' }), { demoExit: '' }, 'BUTTON');
  button.key('keydown', 'Enter', { repeat: true });
  assert.equal(f.state.backs, 0, 'an already-held key cannot exit');
  assert.equal(probes.length, 0, 'an ignored repeat cannot become a native winner');
  button.key('keyup', 'Enter');
  button.key('keydown', 'Enter', { shiftKey: true });
  assert.equal(f.state.backs, 1, 'modified keyboard behavior remains native');
  assert.equal(probes.length, 0, 'modified keys are not controller Confirm echoes');
});

test('teardown removes keyboard, pointer and lifecycle observers', (t) => {
  const f = fixture(t);
  f.input.destroy();
  for (const target of [f.win, f.doc, f.root, f.canvas])
    assert.equal([...target.listeners.values()].flat().length, 0);
  f.canvas.key('keydown', 'ArrowDown');
  f.canvas.pointer('pointerdown', 11);
  f.canvas.pointer('pointermove', 11, 100, 20);
  assert.deepEqual(f.state.directions, []);
});

for (const hasPointerId of [true, false]) {
  test(`${hasPointerId ? 'PointerEvent' : 'MouseEvent'} click: another finger cannot duplicate the first play action`, (t) => {
    const f = fixture(t, { phase: 'watching' }),
      button = f.action('ability');
    let activations = 0;
    button.addEventListener('click', () => activations++);
    button.pointer('pointerdown', 11);
    f.canvas.pointer('pointerdown', 22);
    button.pointer('pointerup', 11);
    button.emit('click', { detail: 1, ...(hasPointerId ? { pointerId: 11 } : {}) });
    assert.deepEqual(f.state.takeovers, [{ action: 'ability' }]);
    assert.deepEqual(f.state.firstActions, ['ability']);
    assert.equal(f.state.interruptions, 0);
    assert.equal(activations, 0);
  });
}

for (const [code, action] of [
  ['KeyE', 'ability'],
  ['KeyR', 'pickup'],
  ['ShiftLeft', 'boost'],
  ['KeyG', 'hangar'],
]) {
  test(`fresh keyboard ${action} takes over with exactly one retained semantic action`, (t) => {
    const f = fixture(t, { phase: 'watching', deferred: true });
    f.canvas.key('keydown', code);
    f.canvas.key('keyup', code);
    f.completeTakeover();
    assert.deepEqual(f.state.takeovers, [{ action }]);
    assert.deepEqual(f.state.firstActions, [action]);
    assert.ok(
      !Object.values(f.input.controls()).some(Boolean),
      'The physical input ledger cannot replay the first action.',
    );
  });
}

test('keyboard auto-repeat, held entry keys, IME and modified shortcuts cannot take over', (t) => {
  const f = fixture(t, { phase: 'inactive' });
  f.canvas.key('keydown', 'ArrowRight');
  f.input.clear();
  f.state.phase = 'watching';
  f.canvas.key('keydown', 'ArrowRight', { repeat: true });
  f.canvas.key('keydown', 'ArrowDown', { repeat: true });
  f.canvas.key('keydown', 'KeyW', { isComposing: true });
  f.canvas.key('keydown', 'KeyA', { ctrlKey: true });
  assert.deepEqual(f.state.takeovers, []);
});

for (const mode of ['stick', 'swipe']) {
  test(`${mode}: watch touch waits for a recognized direction and forwards it once`, (t) => {
    const f = fixture(t, { phase: 'watching', mode, deferred: true });
    f.canvas.pointer('pointermove', 11, 25, 20);
    f.canvas.pointer('pointerdown', 11);
    f.canvas.pointer('pointermove', 11, 24, 20);
    assert.deepEqual(
      f.state.takeovers,
      [],
      'Neither hover nor sub-threshold drift starts practice.',
    );
    f.canvas.pointer('pointermove', 11, 20, 55);
    assert.deepEqual(f.state.takeovers, [{ direction: 'down' }]);
    assert.equal(f.canvas.captures.size, 0, 'Fork preparation clears the gesture owner.');
    f.canvas.pointer('pointermove', 11, 75, 55);
    f.win.pointer('pointerup', 11);
    f.completeTakeover();
    assert.deepEqual(f.state.directions, ['down']);
    assert.equal(f.state.pauses, 0);
  });
}

test('a deliberate canvas tap takes over without inventing a direction; cancellation and dragging do not', (t) => {
  const f = fixture(t, { phase: 'watching', mode: 'dpad' });
  f.canvas.pointer('pointerdown', 11);
  f.win.pointer('pointercancel', 11);
  f.canvas.pointer('pointerdown', 12);
  f.canvas.pointer('pointermove', 12, 70, 20);
  f.canvas.pointer('pointerup', 12, 70, 20);
  assert.deepEqual(f.state.takeovers, []);
  f.canvas.pointer('pointerdown', 13);
  f.canvas.pointer('pointerup', 13);
  assert.deepEqual(f.state.takeovers, [{}]);
  assert.deepEqual(f.state.directions, []);
});

for (const activation of ['pointer', 'assistive']) {
  test(`${activation}: explicit movement and action buttons take over once`, (t) => {
    const f = fixture(t, { phase: 'watching' });
    const button = f.move('left');
    if (activation === 'pointer') {
      button.pointer('pointerdown', 11);
      button.pointer('pointerup', 11);
      button.emit('click', { pointerId: 11, detail: 1 });
    } else button.emit('click', { detail: 0 });
    assert.deepEqual(f.state.takeovers, [{ direction: 'left' }]);
    assert.deepEqual(f.state.directions, ['left']);
  });
}

test('fullscreen, next and menu buttons activate normally through pointer, keyboard and assistive clicks', (t) => {
  const f = fixture(t, { phase: 'watching' }),
    controls = new Target(f.root, { demoUi: '' });
  for (const name of ['fullscreen', 'next', 'menu']) {
    const button = new Target(controls, { name }, 'BUTTON');
    let activations = 0;
    button.addEventListener('click', () => activations++);
    assert.equal(button.pointer('pointerdown', 11).defaultPrevented, false);
    button.pointer('pointerup', 11);
    button.emit('click', { pointerId: 11, detail: 1 });
    assert.equal(button.key('keydown', 'Enter', { key: 'Enter' }).defaultPrevented, false);
    button.key('keyup', 'Enter');
    button.emit('click', { detail: 0 });
    assert.equal(button.key('keydown', 'Space', { key: ' ' }).defaultPrevented, false);
    button.key('keyup', 'Space');
    button.emit('click', { detail: 0 });
    assert.equal(activations, 3);
  }
  assert.deepEqual(f.state.takeovers, []);
  assert.equal(f.state.interruptions, 0);
});

for (const code of ['KeyP', 'KeyX']) {
  test(`${code} opens the watching menu while Escape exits`, (t) => {
    const f = fixture(t, { phase: 'watching' });
    f.canvas.key('keydown', code);
    assert.equal(f.state.interruptions, 1);
    assert.deepEqual(f.state.takeovers, []);
    f.canvas.key('keydown', 'Escape');
    assert.equal(f.state.backs, 1);
  });
}

test('controller menu/back remain separate from gameplay takeover and pending preparation cannot navigate', (t) => {
  const f = fixture(t, { phase: 'watching', deferred: true });
  f.input.controller({ ui: { menu: true } });
  assert.equal(f.state.interruptions, 1);
  f.state.phase = 'watching';
  f.input.controller({ ui: { back: true } });
  assert.equal(f.state.backs, 1);
  f.state.phase = 'watching';
  f.input.controller({ flight: { direction: 'up', boost: true } });
  assert.deepEqual(f.state.takeovers, [{ direction: 'up', action: 'boost' }]);
  f.input.controller({ ui: { confirm: true, direction: 'down' } });
  assert.deepEqual(f.state.menus, []);
  f.completeTakeover();
  assert.deepEqual(f.state.directions, ['up']);
  assert.deepEqual(f.state.firstActions, ['boost']);
});

for (const channel of ['analog', 'dpad', 'ability', 'pickup', 'boost', 'hangar']) {
  test(`real controller router: ${channel} takes over only after join/neutral and a fresh deliberate edge`, (t) => {
    const f = fixture(t, { phase: 'watching' });
    const pad = {
      index: 0,
      id: 'demo-pad',
      mapping: 'standard',
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    const router = createControllerRouter({
      readPads: () => [pad],
      eventTarget: f.win,
      autoJoin: true,
    });
    t.after(() => router.destroy());
    const buttons = { dpad: 15, ability: 0, pickup: 2, boost: 5, hangar: 3 };
    const set = (down) => {
      if (channel === 'analog') pad.axes[0] = down ? 0.8 : 0;
      else pad.buttons[buttons[channel]] = { pressed: down, value: down ? 1 : 0 };
    };
    const sample = () => f.input.controller(router.sample({ scope: 'flight' }));
    set(true);
    sample();
    sample();
    assert.deepEqual(f.state.takeovers, [], 'Held discovery cannot play.');
    set(false);
    sample();
    sample();
    if (channel === 'analog') {
      pad.axes[0] = 0.1;
      sample();
    }
    assert.deepEqual(f.state.takeovers, [], 'Join and stick drift cannot play.');
    set(true);
    sample();
    assert.deepEqual(f.state.takeovers, [
      channel === 'analog' || channel === 'dpad' ? { direction: 'right' } : { action: channel },
    ]);
  });
}

test('controller disconnect/reconnect and held controls do not interrupt watching or auto-takeover', (t) => {
  const f = fixture(t, { phase: 'watching' });
  for (const code of ['disconnected', 'joined', 'waiting-neutral'])
    f.input.controller({
      status: { code },
      disconnected: code === 'disconnected',
      flight: { direction: 'left', action: true },
    });
  f.input.controller({
    status: { code: 'connected' },
    flight: { direction: 'left', action: true },
  });
  assert.deepEqual(f.state.takeovers, []);
  assert.equal(f.state.interruptions, 0);
  assert.equal(f.state.pauses, 0);
  f.input.controller({ status: { code: 'connected' }, flight: {} });
  f.input.controller({ status: { code: 'connected' }, flight: { direction: 'left' } });
  assert.deepEqual(f.state.takeovers, [{ direction: 'left' }]);
});

test('spectator menu canvas gameplay keys take over; owned UI and lifecycle suspension do not', (t) => {
  const f = fixture(t, { phase: 'menu', fromMenu: true });
  const button = new Target(f.root, { demoUi: '' }, 'BUTTON');
  button.key('keydown', 'ArrowDown');
  button.key('keyup', 'ArrowDown');
  assert.deepEqual(f.state.takeovers, []);
  f.canvas.key('keydown', 'ArrowDown');
  assert.deepEqual(f.state.takeovers, [{ direction: 'down' }]);
  const suspended = fixture(t, { phase: 'suspended', fromMenu: true });
  suspended.canvas.key('keydown', 'ArrowDown');
  suspended.canvas.pointer('pointerdown', 11);
  suspended.canvas.pointer('pointermove', 11, 80, 20);
  suspended.input.controller({ flight: { direction: 'down' } });
  assert.deepEqual(suspended.state.takeovers, []);
});

for (const phase of ['watching', 'practice'])
  test(`${phase}: audio controls and source links keep native activation and editing`, (t) => {
    const f = fixture(t, { phase }),
      audio = new Target(f.root, { demoUi: '' });
    for (const tagName of ['BUTTON', 'INPUT', 'SELECT', 'SUMMARY', 'A']) {
      const control = new Target(audio, {}, tagName);
      assert.equal(control.pointer('pointerdown', 11).defaultPrevented, false);
      control.pointer('pointerup', 11);
      assert.equal(control.emit('click', { detail: 1, pointerId: 11 }).defaultPrevented, false);
      for (const [code, key] of [
        ['Enter', 'Enter'],
        ['Space', ' '],
        ['ArrowDown', 'ArrowDown'],
        ['KeyB', 'b'],
        ['KeyN', 'n'],
      ]) {
        assert.equal(control.key('keydown', code, { key }).defaultPrevented, false);
        control.key('keyup', code, { key });
      }
    }
    assert.deepEqual(f.state.takeovers, []);
    assert.deepEqual(f.state.directions, []);
    assert.equal(f.state.pauses, 0);
    assert.equal(f.state.interruptions, 0);
    assert.equal(f.state.backs, 0);
    assert.ok(!f.input.controls().action);
  });

test('focused audio UI owns controller navigation until a new gameplay edge after leaving it', (t) => {
  const f = fixture(t, { phase: 'watching', uiOwned: true });
  f.input.controller({ status: { code: 'connected' }, flight: {}, ui: {} });
  f.input.controller({
    status: { code: 'connected' },
    flight: { direction: 'left', action: true },
    ui: { down: true },
  });
  assert.deepEqual(f.state.takeovers, []);
  assert.deepEqual(f.state.menus.at(-1), { down: true });
  f.state.uiOwned = false;
  f.input.controller({
    status: { code: 'connected' },
    flight: { direction: 'left', action: true },
  });
  assert.deepEqual(
    f.state.takeovers,
    [],
    'The controller hold from UI navigation cannot take over',
  );
  f.input.controller({ status: { code: 'connected' }, flight: {} });
  f.input.controller({ status: { code: 'connected' }, flight: { direction: 'left' } });
  assert.deepEqual(f.state.takeovers, [{ direction: 'left' }]);
});

test('practice audio focus retires held keyboard and multi-touch actions before the next frame', (t) => {
  const f = fixture(t),
    audio = new Target(f.root, { demoUi: '' }, 'INPUT');
  f.canvas.key('keydown', 'ShiftLeft');
  f.canvas.key('keydown', 'Space');
  f.action('boost').pointer('pointerdown', 11);
  f.action('pickup').pointer('pointerdown', 12);
  assert.ok(f.input.controls().boost);
  f.state.uiOwned = true;
  audio.emit('focusin');
  assert.deepEqual(f.input.controls(), { boost: false, action: false, pickup: false });
  assert.equal(f.state.pauses, 0, 'Adjusting audio does not pause practice');
  f.state.uiOwned = false;
  f.canvas.key('keydown', 'ArrowRight');
  assert.deepEqual(f.state.directions, [], 'All prior held keys must become neutral');
  f.canvas.key('keyup', 'ArrowRight');
  f.canvas.key('keyup', 'ShiftLeft');
  f.canvas.key('keyup', 'Space');
  f.win.pointer('pointercancel', 11);
  f.win.pointer('pointerup', 12);
  assert.equal(f.state.pauses, 0, 'Retired pointer ownership cannot cancel a newer UI action');
  const controls = f.input.controls();
  assert.ok(!controls.boost && !controls.action && !controls.pickup);
  f.canvas.key('keydown', 'ShiftLeft');
  assert.ok(f.input.controls().boost, 'A newly pressed gameplay key still works');
});

test('audio ownership clears queued practice impulses even before a focus or controller event', (t) => {
  const f = fixture(t, { tapMode: true });
  f.action('ability').pointer('pointerdown', 11);
  f.action('boost').pointer('pointerdown', 12);
  f.state.uiOwned = true;
  assert.deepEqual(f.input.controls(), { boost: false, action: false, pickup: false });
  f.state.uiOwned = false;
  const controls = f.input.controls();
  assert.ok(!controls.action && !controls.boost && !controls.pickup);
});

test('touching audio UI retires a held practice action even when the browser keeps canvas focus', (t) => {
  const f = fixture(t),
    audio = new Target(f.root, { demoUi: '' }, 'BUTTON');
  f.action('boost').pointer('pointerdown', 11);
  assert.ok(f.input.controls().boost);
  assert.equal(audio.pointer('pointerdown', 12).defaultPrevented, false);
  assert.equal(f.state.uiOwned, false, 'The native button is allowed to keep prior canvas focus');
  assert.ok(!f.input.controls().boost);
  audio.pointer('pointerup', 12);
  assert.equal(audio.emit('click', { pointerId: 12, detail: 1 }).defaultPrevented, false);
  assert.equal(f.state.pauses, 0);
  f.action('boost').pointer('pointerdown', 13);
  assert.ok(f.input.controls().boost);
});

test('held controller boost cannot return from audio navigation as a practice action', (t) => {
  const f = fixture(t);
  f.input.controller({ flight: { boost: true } });
  assert.ok(f.input.controls().boost);
  f.state.uiOwned = true;
  f.input.controller({ flight: {}, ui: { right: true } });
  assert.deepEqual(f.state.menus.at(-1), { right: true });
  f.state.uiOwned = false;
  f.input.controller({ flight: { boost: true } });
  assert.ok(!f.input.controls().boost, 'Hold from the previous flight scope is neutralized');
  f.input.controller({ flight: {} });
  f.input.controller({ flight: { boost: true } });
  assert.ok(f.input.controls().boost);
});

for (const [button, semantic] of [
  [1, 'back'],
  [9, 'menu'],
]) {
  test(`spectator router preserves configured ${semantic} with flight input and no duplicate gameplay action`, (t) => {
    const f = fixture(t, { phase: 'watching' });
    const pad = {
      index: 0,
      id: 'demo-pad',
      mapping: 'standard',
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    const router = createControllerRouter({
      readPads: () => [pad],
      eventTarget: f.win,
      autoJoin: true,
    });
    t.after(() => router.destroy());
    const sample = () => {
      const frame = router.sample({ scope: 'flight', spectator: true });
      f.input.controller(frame);
      return frame;
    };
    sample();
    sample();
    pad.buttons[button] = { pressed: true, value: 1 };
    const frame = sample();
    assert.equal(frame.ui[semantic], true);
    assert.ok(!Object.values(frame.flight).some(Boolean));
    assert.equal(f.state[semantic === 'back' ? 'backs' : 'interruptions'], 1);
    assert.deepEqual(f.state.takeovers, []);
    assert.equal(sample().ui[semantic], false, 'Held buttons cannot repeat the transition.');
  });
}

test('spectator Back follows remapped menu binding, while ordinary flight retains its original pickup', (t) => {
  const pad = {
    index: 0,
    id: 'demo-pad',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const bindings = structuredClone(DEFAULT_CONTROLLER_BINDINGS);
  bindings.menu.buttons.back = 2;
  const router = createControllerRouter({
    readPads: () => [pad],
    eventTarget: null,
    autoJoin: true,
    bindings,
  });
  t.after(() => router.destroy());
  router.sample({ scope: 'flight', spectator: true });
  router.sample({ scope: 'flight', spectator: true });
  pad.buttons[2] = { pressed: true, value: 1 };
  const spectator = router.sample({ scope: 'flight', spectator: true });
  assert.equal(spectator.ui.back, true);
  assert.equal(spectator.flight.pickup, false);
  pad.buttons[2] = { pressed: false, value: 0 };
  router.sample({ scope: 'flight' });
  pad.buttons[2] = { pressed: true, value: 1 };
  const ordinary = router.sample({ scope: 'flight' });
  assert.equal(ordinary.flight.pickup, true);
  assert.equal(ordinary.ui.back, false);
});

for (const boostMode of ['hold', 'toggle']) {
  test(`spectator ${boostMode} Boost joins once from a fresh physical edge despite ineligible gameplay Boost`, (t) => {
    const f = fixture(t, { phase: 'watching', deferred: true });
    const pad = {
      index: 0,
      id: 'demo-pad',
      mapping: 'standard',
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    const router = createControllerRouter({
      readPads: () => [pad],
      eventTarget: f.win,
      autoJoin: true,
      boostMode,
    });
    t.after(() => router.destroy());
    const press = (down) => {
      pad.buttons[5] = { pressed: down, value: down ? 1 : 0 };
    };
    const sample = () => {
      const frame = router.sample({
        scope: 'flight',
        spectator: true,
        toggleBoostEligible: false,
      });
      f.input.controller(frame);
      assert.equal(router.boostState().latched, false, 'Spectating cannot arm a gameplay latch.');
      return frame;
    };
    press(true);
    assert.equal(sample().flight.boost, false);
    press(false);
    sample();
    sample();
    pad.connected = false;
    assert.equal(sample().disconnected, true);
    pad.connected = true;
    press(true);
    assert.equal(sample().flight.boost, false);
    assert.equal(sample().flight.boost, false);
    assert.deepEqual(f.state.takeovers, [], 'Held discovery/reconnection cannot join practice.');
    press(false);
    sample();
    sample();
    press(true);
    assert.equal(sample().flight.boost, true);
    assert.equal(sample().flight.boost, false, 'A held Boost is not another spectator gesture.');
    assert.deepEqual(f.state.takeovers, [{ action: 'boost' }]);
    press(false);
    sample();
    f.completeTakeover();
    assert.deepEqual(f.state.firstActions, ['boost']);
    assert.ok(!f.input.controls().boost, 'Host-owned first intent does not leak into input holds.');

    // After the normal neutral boundary, gameplay still follows its selected
    // Hold/Toggle policy instead of inheriting a spectator-created latch.
    const flight = () => router.sample({ scope: 'flight', toggleBoostEligible: true });
    assert.equal(flight().flight.boost, false);
    press(true);
    assert.equal(flight().flight.boost, true);
    press(false);
    assert.equal(flight().flight.boost, boostMode === 'toggle');
  });
}
