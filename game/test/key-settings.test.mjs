import test from 'node:test';
import assert from 'node:assert/strict';
import { attachKeySettings } from '../ui/key-settings.mjs';
import {
  KEY_BINDING_ACTIONS,
  KEY_BINDING_PRESETS,
  resolveKeyBindings,
  replaceKeyBinding,
} from '../key-bindings.mjs';

class Element {
  constructor(owner) {
    this.owner = owner;
    this.listeners = new Map();
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.textContent = '';
    this.value = '';
    this.open = true;
  }
  set innerHTML(_value) {
    throw new Error('Keyboard content must use safe DOM text.');
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  append(...children) {
    this.children.push(...children);
  }
  replaceChildren(...children) {
    this.children = [...children];
  }
  focus() {
    this.owner.activeElement = this;
  }
  emit(type, values = {}) {
    const event = {
      type,
      target: this,
      key: '',
      code: '',
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this.propagationStopped = true;
      },
      ...values,
    };
    for (const fn of this.listeners.get(type) || []) fn(event);
    return event;
  }
}
function setup(t, initial = null) {
  const prior = new Map(
    ['document', 'window'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const document = {},
    window = new Element(document);
  const nodes = Object.fromEntries(
    [
      'key-binding-list',
      'key-preset',
      'reset-key-bindings',
      'key-capture-status',
      'cancel-key-capture',
      'settings-dialog',
    ].map((id) => [id, new Element(document)]),
  );
  document.getElementById = (id) => nodes[id];
  document.createElement = () => new Element(document);
  nodes['key-preset'].options = ['default', 'left-hand', 'right-hand', 'custom'].map((value) => ({
    value,
    disabled: false,
  }));
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  let value = initial,
    changed = 0,
    response = { ok: true },
    failure = null;
  const writes = [];
  const api = attachKeySettings({
    getBindings: () => value,
    setBindings: (candidate) => {
      if (failure) throw failure;
      value = candidate;
      writes.push(candidate);
      return response;
    },
    onChanged: () => {
      changed++;
    },
  });
  const buttons = Object.fromEntries(
    nodes['key-binding-list'].children.map((row) => [
      row.children[1].dataset.keyAction,
      row.children[1],
    ]),
  );
  t.after(() => {
    api.destroy();
    for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return {
    api,
    nodes,
    buttons,
    document,
    window,
    writes,
    get value() {
      return value;
    },
    get changed() {
      return changed;
    },
    get status() {
      return nodes['key-capture-status'].textContent;
    },
    capture: (action) => buttons[action].emit('click'),
    key: (code, extra = {}) =>
      nodes['settings-dialog'].emit('keydown', { code, key: code, ...extra }),
    setResponse: (next) => {
      response = next;
    },
    setFailure: (next) => {
      failure = next;
    },
    replaceFromHost: (next) => {
      value = next;
      api.refresh();
    },
  };
}

test('mount exposes ten labelled controls and no initial write or input reset', (t) => {
  const h = setup(t);
  assert.deepEqual(Object.keys(h.buttons), KEY_BINDING_ACTIONS);
  assert.equal(h.writes.length, 0);
  assert.equal(h.changed, 0);
  assert.equal(h.nodes['key-preset'].value, 'default');
  assert.equal(h.nodes['key-preset'].options.find((o) => o.value === 'custom').disabled, true);
  assert.equal(h.nodes['key-capture-status'].getAttribute('role'), 'status');
  assert.equal(h.nodes['cancel-key-capture'].hidden, true);
  for (const button of Object.values(h.buttons)) {
    assert.equal(button.type, 'button');
    assert.match(button.getAttribute('aria-label'), /Change .+ Current keys:/);
  }
});
test('a physical-key capture applies the whole validated map once and preserves other actions', (t) => {
  const h = setup(t),
    before = resolveKeyBindings(null);
  h.capture('up');
  assert.equal(h.writes.length, 0);
  assert.equal(h.nodes['cancel-key-capture'].hidden, false);
  const event = h.key('KeyZ', { key: 'я' });
  assert.equal(event.defaultPrevented, true);
  assert.equal(h.writes.length, 1);
  assert.equal(h.changed, 1);
  assert.deepEqual(h.value.bindings.up, ['KeyZ']);
  for (const action of KEY_BINDING_ACTIONS.filter((a) => a !== 'up'))
    assert.deepEqual(h.value.bindings[action], before.bindings[action]);
  assert.equal(h.nodes['key-preset'].value, 'custom');
  assert.equal(h.document.activeElement, h.buttons.up);
  assert.match(h.status, /Move up changed to Z/);
});
test('duplicate, reserved, composition and modifier keys never reach the host', (t) => {
  const h = setup(t);
  h.capture('up');
  h.key('KeyD');
  assert.match(h.status, /already assigned/);
  for (const code of ['Enter', 'NumpadEnter', 'Space', 'F5']) {
    assert.equal(h.key(code).defaultPrevented, true);
    assert.match(h.status, /reserved/);
  }
  for (const extra of [
    { isComposing: true },
    { keyCode: 229 },
    { key: 'Dead' },
    { key: 'Process' },
  ]) {
    h.key('KeyZ', extra);
    assert.match(h.status, /composition/);
  }
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey']) {
    assert.equal(h.key('KeyZ', { [modifier]: true }).defaultPrevented, false);
    assert.match(h.status, /modifier combination/);
  }
  assert.equal(h.value, null);
  assert.equal(h.writes.length, 0);
  assert.equal(h.changed, 0);
  assert.equal(h.buttons.up.getAttribute('aria-pressed'), 'true');
});
test('pause alternate retains Escape; repeat capture cannot accidentally remap again', (t) => {
  const h = setup(t);
  h.capture('pause');
  h.key('KeyO', { repeat: true });
  assert.equal(h.writes.length, 0);
  h.key('KeyO');
  assert.deepEqual(h.value.bindings.pause, ['Escape', 'KeyO']);
  h.key('KeyT', { repeat: true });
  assert.equal(h.writes.length, 1);
  h.capture('boost');
  h.key('ShiftLeft', { key: 'Shift', shiftKey: true });
  assert.deepEqual(h.value.bindings.boost, ['ShiftLeft']);
});
test('Escape cancels without closing, while Tab cancels without trapping focus', (t) => {
  const h = setup(t);
  h.capture('up');
  const escape = h.key('Escape');
  assert.equal(escape.defaultPrevented, true);
  assert.equal(escape.propagationStopped, true);
  assert.equal(h.nodes['settings-dialog'].open, true);
  assert.equal(h.document.activeElement, h.buttons.up);
  assert.match(h.status, /unchanged.*cancelled/);
  h.capture('down');
  h.buttons.down.focus();
  const tab = h.key('Tab');
  assert.equal(tab.defaultPrevented, false);
  assert.equal(tab.propagationStopped, false);
  assert.equal(h.document.activeElement, h.buttons.down);
  assert.equal(h.nodes['cancel-key-capture'].hidden, true);
  assert.equal(h.writes.length, 0);
});
test('modified Escape shortcuts and IME cancellation retain native handling during capture', (t) => {
  const h = setup(t);
  h.capture('up');
  for (const extra of [
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { isComposing: true },
  ]) {
    const event = h.key('Escape', extra);
    assert.equal(event.defaultPrevented, false);
    assert.equal(event.propagationStopped, false);
    assert.equal(h.buttons.up.getAttribute('aria-pressed'), 'true');
    assert.equal(h.writes.length, 0);
  }
  assert.equal(h.key('Escape').defaultPrevented, true);
  assert.equal(h.buttons.up.getAttribute('aria-pressed'), 'false');
});
test('Cancel, native dialog cancellation, close and focus loss retain the previous map', (t) => {
  const h = setup(t);
  h.capture('left');
  h.nodes['cancel-key-capture'].emit('click');
  assert.equal(h.document.activeElement, h.buttons.left);
  h.capture('left');
  assert.equal(h.nodes['settings-dialog'].emit('cancel').defaultPrevented, true);
  for (const [target, type] of [
    [h.nodes['settings-dialog'], 'close'],
    [h.window, 'blur'],
  ]) {
    h.capture('left');
    target.emit(type);
    h.key('KeyZ');
    assert.equal(h.writes.length, 0);
    assert.equal(h.nodes['cancel-key-capture'].hidden, true);
  }
});
test('moving focus to another settings control cancels capture and preserves its native keys', (t) => {
  const h = setup(t);
  h.capture('up');
  h.nodes['settings-dialog'].emit('focusin', { target: h.buttons.up });
  assert.equal(h.buttons.up.getAttribute('aria-pressed'), 'true');
  h.nodes['settings-dialog'].emit('focusin', { target: h.nodes['cancel-key-capture'] });
  assert.equal(h.buttons.up.getAttribute('aria-pressed'), 'true');
  h.nodes['settings-dialog'].emit('focusin', { target: h.nodes['key-preset'] });
  assert.equal(h.key('ArrowDown').defaultPrevented, false);
  assert.equal(h.writes.length, 0);
  assert.equal(h.nodes['cancel-key-capture'].hidden, true);
});
test('preset selection during capture and reset apply the requested map, with Custom auto-detected', (t) => {
  const h = setup(t);
  h.capture('up');
  h.nodes['key-preset'].value = 'right-hand';
  h.nodes['key-preset'].emit('change');
  assert.deepEqual(h.value, KEY_BINDING_PRESETS['right-hand']);
  assert.equal(h.nodes['key-preset'].value, 'right-hand');
  assert.equal(h.nodes['cancel-key-capture'].hidden, true);
  h.nodes['reset-key-bindings'].emit('click');
  assert.equal(h.value, null);
  assert.equal(h.nodes['key-preset'].value, 'default');
  h.replaceFromHost(replaceKeyBinding(null, 'up', 'KeyZ'));
  assert.equal(h.nodes['key-preset'].value, 'custom');
  const equivalent = resolveKeyBindings(null);
  equivalent.bindings.up.reverse();
  h.replaceFromHost(equivalent);
  assert.equal(h.nodes['key-preset'].value, 'default');
  assert.equal(h.changed, 2);
});
test('session-only save retains applied map and warning; thrown validation preserves old map', (t) => {
  const h = setup(t);
  h.setFailure(new TypeError('Rejected by host validation'));
  h.capture('up');
  h.key('KeyZ');
  assert.equal(h.value, null);
  assert.equal(h.changed, 0);
  assert.match(h.status, /Rejected by host validation/);
  h.setFailure(null);
  h.setResponse({ ok: false, warning: 'Another tab owns saving. Session only.' });
  h.key('KeyZ');
  assert.deepEqual(h.value.bindings.up, ['KeyZ']);
  assert.equal(h.changed, 1);
  assert.match(h.status, /changed to Z.*Another tab owns saving. Session only/);
});
test('destroy cancels capture and removes event listeners without mutating preferences', (t) => {
  const h = setup(t);
  h.capture('up');
  h.api.destroy();
  h.key('KeyZ');
  h.nodes['reset-key-bindings'].emit('click');
  h.buttons.up.emit('click');
  h.api.refresh();
  assert.equal(h.writes.length, 0);
  assert.equal(h.changed, 0);
  assert.equal(h.nodes['key-binding-list'].children.length, 0);
  assert.equal(h.nodes['cancel-key-capture'].hidden, true);
  assert.equal(h.status, '');
});
