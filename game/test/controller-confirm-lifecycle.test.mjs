import test from 'node:test';
import assert from 'node:assert/strict';
import { createControllerConfirmLifecycle } from '../ui/controller-confirm-lifecycle.mjs';

function harness() {
  let time = 0,
    snapshot;
  const target = { id: 'sound' },
    nextTarget = { id: 'settings-close' },
    root = {};
  target.closest = () => target;
  nextTarget.closest = () => nextTarget;
  const current = { scope: 'menu', root, active: true };
  const calls = [],
    entries = [];
  let valid = true,
    captured = null,
    owned = false;
  const guard = {
    begin(element, metadata) {
      owned = true;
      calls.push(['begin', element, metadata]);
    },
    finish(reason) {
      owned = false;
      calls.push(['finish', reason]);
    },
    cancel(reason) {
      owned = false;
      calls.push(['cancel', reason]);
    },
    owned: () => owned,
  };
  const navigation = {
    beginConfirm(element = target) {
      captured = element;
      calls.push(['capture', element]);
      return valid ? element : null;
    },
    commitConfirm() {
      calls.push(['commit', captured]);
      captured = null;
    },
    cancelConfirm() {
      captured = null;
    },
    confirmCurrent: () => valid && captured !== null,
  };
  const lifecycle = createControllerConfirmLifecycle({
    document: { activeElement: target },
    readConfirm: () => snapshot,
    getContext: () => current,
    navigation,
    guard,
    now: () => time,
    onTrace: (entry) => entries.push(entry),
  });
  const state = (buttons = [], extras = {}) => {
    snapshot = {
      assigned: { index: 0, generation: 1 },
      buttons,
      timestamp: time,
      eligible: true,
      neutral: buttons.length === 0,
      ...extras,
    };
    return snapshot;
  };
  state();
  return {
    lifecycle,
    target,
    nextTarget,
    current,
    calls,
    entries,
    state,
    at: (value) => {
      time = value;
    },
    valid: (value) => {
      valid = value;
    },
    sample: (buttons = [], extras = {}) => lifecycle.sample(state(buttons, extras)),
    native: (type, element = target) =>
      lifecycle.beforeNativeActivation({ type, target: element, isTrusted: true }),
    commits: () => calls.filter(([name]) => name === 'commit'),
  };
}

test('native probes capture and release a whole tap between render frames', () => {
  const h = harness();
  h.state([0]);
  h.native('keydown');
  assert.equal(h.lifecycle.phase(), 'controller');
  assert.equal(h.commits().length, 0);
  h.at(40);
  h.state([]);
  h.native('keyup');
  assert.equal(h.commits().length, 1);
  assert.equal(h.commits()[0][1], h.target);
  h.sample();
  assert.equal(h.commits().length, 1);
});

test('a five-second hold and overlapping aliases release as one gesture', () => {
  const h = harness();
  h.sample([0]);
  h.at(10);
  h.sample([0, 2]);
  h.at(5000);
  h.sample([2]);
  assert.equal(h.commits().length, 0);
  h.at(5010);
  h.sample();
  assert.equal(h.commits().length, 1);
});

test('cross-alias echoes drain while deliberate original-button repeats are accepted', () => {
  const h = harness();
  h.sample([0]);
  h.at(20);
  h.sample();
  h.at(900);
  h.sample([2]);
  assert.equal(h.lifecycle.phase(), 'alias');
  h.at(920);
  h.sample();
  assert.equal(h.commits().length, 1);
  h.at(940);
  h.sample([0]);
  h.at(960);
  h.sample();
  assert.equal(h.commits().length, 2);
  h.at(2300);
  h.sample([2]);
  h.sample();
  assert.equal(h.commits().length, 3);
});

test('native winner survives router clear, changed scope, removed target and a long hold', () => {
  const h = harness();
  h.native('pointerdown');
  h.state([], { eligible: false });
  h.native('click');
  h.lifecycle.cancel('input-clear');
  h.current.scope = 'other-menu';
  h.current.root = {};
  h.valid(false);
  h.at(30);
  h.sample([0], { eligible: false });
  assert.equal(h.lifecycle.phase(), 'native');
  h.at(5030);
  h.sample([0], { eligible: false });
  h.sample([], { eligible: false });
  assert.equal(h.commits().length, 0);
  assert.equal(h.calls.filter(([name]) => name === 'capture').length, 0);
  assert.equal(h.lifecycle.owned(), false);
});

test('delayed Gamepad adopts the original target before the native click', () => {
  const h = harness();
  h.native('pointerdown');
  h.at(10);
  h.sample([7], { eligible: false });
  assert.equal(h.calls.find(([name]) => name === 'capture')[1], h.target);
  h.sample();
  assert.equal(h.commits().length, 1);
});

test('expired and unrelated native candidates do not win activation', () => {
  const h = harness();
  h.native('pointerdown');
  h.state([], { eligible: false });
  h.native('click', h.nextTarget);
  h.at(30);
  h.sample([0], { eligible: false });
  h.sample();
  assert.equal(h.commits().length, 1, 'unrelated click cannot mark original candidate activated');
  const expired = harness();
  expired.native('click');
  expired.at(251);
  expired.sample([0]);
  expired.sample();
  assert.equal(expired.commits().length, 1);
});

test('scope change and target removal cancel but own the entire remaining hold', () => {
  for (const change of [
    (h) => {
      h.current.scope = 'other';
    },
    (h) => h.valid(false),
  ]) {
    const h = harness();
    h.sample([0]);
    change(h);
    h.at(100);
    h.sample([0]);
    assert.equal(h.lifecycle.phase(), 'cancelled');
    h.at(5100);
    h.sample([0]);
    assert.equal(h.lifecycle.owned(), true);
    h.sample();
    assert.equal(h.lifecycle.owned(), false);
    assert.equal(h.commits().length, 0);
  }
});

test('hard loss, replacement and inactive document cannot commit stale holds or candidates', () => {
  const cases = [
    (h) => h.sample([], { assigned: null }),
    (h) => {
      h.current.active = false;
      h.sample([0]);
    },
    (h) => h.sample([0], { assigned: { index: 0, generation: 2 }, eligible: false }),
    (h) => h.lifecycle.cancel('blur', { hard: true }),
  ];
  for (const change of cases) {
    const h = harness();
    h.sample([0]);
    change(h);
    h.sample();
    assert.equal(h.commits().length, 0);
    assert.equal(h.lifecycle.owned(), false);
  }
});

test('neutral native input remains unowned; blocked controller cannot invent a press', () => {
  const h = harness();
  h.native('keydown');
  h.native('click');
  assert.equal(h.lifecycle.owned(), false);
  h.at(300);
  h.sample([0], { eligible: false });
  assert.equal(h.lifecycle.owned(), false);
  assert.equal(h.commits().length, 0);
});

test('invalid alias timing and trace callbacks are rejected', () => {
  for (const aliasEchoWindowMs of [-1, 5001, NaN])
    assert.throws(() => createControllerConfirmLifecycle({ aliasEchoWindowMs }), RangeError);
  assert.throws(() => createControllerConfirmLifecycle({ onTrace: true }), TypeError);
});

test('native winner survives its own same-scope focus change but yields to separate controller navigation', () => {
  const h = harness();
  h.current.focused = h.target;
  h.native('click');
  h.current.focused = h.nextTarget;
  h.at(30);
  h.sample([0], { eligible: false });
  h.at(5000);
  h.sample();
  assert.equal(h.commits().length, 0);
  const separate = harness();
  separate.native('click');
  separate.sample([], { neutral: false, eligible: false });
  separate.sample();
  separate.at(50);
  separate.sample([0]);
  separate.sample();
  assert.equal(separate.commits().length, 1);
});
