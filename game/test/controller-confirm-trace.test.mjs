import test from 'node:test';
import assert from 'node:assert/strict';
import { attachControllerConfirmTrace } from '../ui/controller-confirm-trace.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

function fixture() {
  const listeners = new Map();
  const createElement = (tagName) => ({
    tagName,
    textContent: '',
    children: [],
    attributes: {},
    parentElement: null,
    append(...nodes) {
      for (const node of nodes) {
        node.remove();
        node.parentElement = this;
        this.children.push(node);
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    remove() {
      if (this.parentElement)
        this.parentElement.children = this.parentElement.children.filter((node) => node !== this);
      this.parentElement = null;
    },
  });
  const document = {
    body: createElement('body'),
    createElement,
    activeElement: { id: 'sound' },
    visibilityState: 'visible',
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };
  document.defaultView = document;
  return { document, listeners };
}

test('disabled trace records nothing and creates no UI', () => {
  const { document, listeners } = fixture();
  const trace = attachControllerConfirmTrace({ document, enabled: false });
  trace.record({ event: 'start', targetId: 'sound' });
  assert.deepEqual(trace.snapshot(), []);
  assert.equal(document.body.children.length, 0);
  assert.equal(listeners.size, 0);
  trace.destroy();
});

test('trace is bounded and stores only the diagnostic allowlist', () => {
  const trace = attachControllerConfirmTrace({ enabled: true, document: null, limit: 16 });
  for (let index = 0; index < 20; index++)
    trace.record({
      time: index,
      gamepadTimestamp: index * 2,
      event: 'start',
      phase: 'active',
      buttons: [0, 2],
      nativeEventType: 'click',
      targetId: 'sound',
      winner: 'gamepad',
      rawGamepads: [{ index: 0, id: 'Steam\nDeck', buttons: [0], secret: 'must not be stored' }],
      typedText: 'must not be stored',
    });
  const entries = trace.snapshot();
  assert.equal(entries.length, 16);
  assert.equal(entries[0].t, 4);
  assert.equal(entries[0].raw[0].id, 'Steam Deck');
  assert.equal(JSON.stringify(entries).includes('must not be stored'), false);
  assert.deepEqual(entries[0].buttons, [0, 2]);
});

test('held samples coalesce but retain changes, native order, timing and independent snapshots', () => {
  const trace = attachControllerConfirmTrace({ enabled: true, document: null });
  for (let index = 0; index < 300; index++)
    trace.record({
      event: 'confirm-sample',
      time: index * 17,
      gamepadTimestamp: index * 16,
      sampleSource: 'raf',
      buttons: [0],
      selectedGamepadIndex: 0,
      selectedGamepadIdentity: '0:Deck',
      selectedGamepadGeneration: 1,
      rawGamepads: [{ index: 0, id: 'Deck', timestamp: index * 16, buttons: [0] }],
      pollIntervalMs: index % 2 ? 16 : 17,
    });
  assert.equal(trace.snapshot().length, 1);
  assert.equal(trace.snapshot()[0].samples, 300);
  assert.equal(trace.snapshot()[0].since, 0);
  assert.equal(trace.snapshot()[0].t, 5083);
  assert.equal(trace.snapshot()[0].gp, 4784);
  trace.record({ event: 'native-observed', nativeEventType: 'click', time: 5100 });
  trace.record({ event: 'confirm-sample', buttons: [], time: 5117 });
  assert.equal(trace.snapshot().length, 3);
  const snapshot = trace.snapshot();
  snapshot[0].raw[0].buttons.push(9);
  snapshot[0].buttons.push(10);
  assert.deepEqual(trace.snapshot()[0].raw[0].buttons, [0]);
  assert.deepEqual(trace.snapshot()[0].buttons, [0]);
});

test('trace retains the selected high-index device and browser focus/fullscreen context', () => {
  const trace = attachControllerConfirmTrace({ enabled: true, document: null });
  trace.record({
    event: 'confirm-sample',
    selectedGamepadIndex: 31,
    rawGamepads: Array.from({ length: 32 }, (_, index) => ({
      index,
      buttonCount: 17,
      buttons: index === 31 ? [0] : [],
    })),
    hasFocus: false,
    fullscreen: true,
  });
  const [entry] = trace.snapshot();
  assert.equal(entry.raw.length, 32);
  assert.equal(entry.raw[31].index, 31);
  assert.equal(entry.raw[31].buttonCount, 17);
  assert.deepEqual(entry.raw[31].buttons, [0]);
  assert.equal(entry.hasFocus, false);
  assert.equal(entry.fullscreen, true);
});

test('temporary toggle follows active modal without adding navigation controls or moving focus', () => {
  const { document, listeners } = fixture();
  const modal = document.createElement('dialog');
  let host = document.body;
  const trace = attachControllerConfirmTrace({ document, version: 'v1', getHost: () => host });
  trace.setEnabled(true);
  assert.equal(trace.enabled, true);
  const panel = document.body.children[0];
  assert.equal(panel.tagName, 'aside');
  assert.deepEqual(
    panel.children.map((node) => node.tagName),
    ['div', 'div', 'pre'],
  );
  assert.equal(panel.children[0].textContent, 'Controller trace · v1');
  const focus = document.activeElement;
  host = modal;
  trace.syncHost();
  assert.equal(panel.parentElement, modal);
  assert.equal(document.activeElement, focus);
  assert.equal(document.body.children.length, 0);
  trace.syncHost(document.body);
  assert.equal(panel.parentElement, document.body);
  trace.record({ event: 'cancel', reason: 'blur' });
  trace.setEnabled(false);
  assert.equal(trace.enabled, false);
  assert.equal(document.body.children.length, 0);
  assert.equal(listeners.size, 0);
  assert.deepEqual(trace.snapshot(), []);
  trace.setEnabled(true);
  trace.destroy();
  trace.setEnabled(true);
  assert.equal(trace.enabled, false);
  assert.equal(listeners.size, 0);
});

test('native observations capture Confirm, pointer and focus context without typed text', () => {
  const { document, listeners } = fixture();
  const trace = attachControllerConfirmTrace({ document, enabled: true, now: () => 42 });
  listeners.get('keydown')({ type: 'keydown', code: 'KeyA', key: 'private typed text' });
  assert.deepEqual(trace.snapshot(), []);
  listeners.get('keydown')({
    type: 'keydown',
    code: 'Enter',
    key: 'Enter',
    target: { id: 'sound' },
    isTrusted: true,
  });
  listeners.get('pointerup')({
    type: 'pointerup',
    pointerType: 'touch',
    button: 0,
    target: { id: 'sound' },
  });
  listeners.get('focusin')({ type: 'focusin', target: { id: 'home' } });
  listeners.get('blur')({ type: 'blur' });
  const entries = trace.snapshot();
  assert.deepEqual(
    entries.map((entry) => entry.native),
    ['keydown', 'pointerup', 'focusin', 'blur'],
  );
  assert.equal(entries[0].trusted, true);
  assert.equal(entries[1].pointer, 'touch');
  assert.equal(entries[1].focus, 'sound');
  assert.equal(entries[2].target, 'home');
  assert.equal(JSON.stringify(entries).includes('private typed text'), false);
  trace.destroy();
});

test('trace UI follows live locale changes without clearing diagnostics', () => {
  const { document } = fixture();
  const previousLocale = getLocale();
  setLocale('en', { persist: false });
  const trace = attachControllerConfirmTrace({ document, enabled: true, version: 'v1' });
  const [title, , output] = document.body.children[0].children;
  assert.equal(title.textContent, 'Controller trace · v1');
  assert.equal(output.textContent, 'Waiting for Confirm input…');
  setLocale('uk', { persist: false });
  assert.equal(title.textContent, 'Трасування контролера · v1');
  assert.equal(output.textContent, 'Очікуємо натискання «Підтвердити»…');
  trace.record({ time: 1, event: 'start', phase: 'active', buttons: [0] });
  const diagnostic = output.textContent;
  setLocale('en', { persist: false });
  assert.equal(output.textContent, diagnostic);
  assert.equal(trace.snapshot().length, 1);
  trace.destroy();
  setLocale(previousLocale, { persist: false });
});

test('visible context preserves device identity and browser state across later native observations', () => {
  const { document } = fixture();
  const trace = attachControllerConfirmTrace({ document, enabled: true });
  trace.record({
    event: 'confirm-sample',
    selectedGamepadIndex: 4,
    selectedGamepadIdentity: '4:Steam Deck',
    selectedGamepadGeneration: 3,
    rawGamepads: [
      { index: 4, id: 'Steam Deck Controller', mapping: 'standard', buttonCount: 17, buttons: [0] },
    ],
    focusTargetId: 'sound',
    visibilityState: 'visible',
    hasFocus: true,
    fullscreen: true,
  });
  trace.record({
    event: 'native-observed',
    nativeEventType: 'click',
    isTrusted: true,
    defaultPrevented: false,
  });
  const [, context, output] = document.body.children[0].children;
  assert.match(context.textContent, /selected:4 identity:4:Steam Deck generation:3/);
  assert.match(context.textContent, /focus:sound hasFocus:true visibility:visible fullscreen:true/);
  assert.match(context.textContent, /4 Steam Deck Controller mapping:standard buttons:17/);
  assert.match(output.textContent, /native:click trusted:true prevented:false/);
  trace.record({
    event: 'native-consumed',
    nativeEventType: 'click',
    isTrusted: false,
    defaultPrevented: true,
  });
  assert.match(output.textContent, /native:click trusted:false prevented:true/);
  trace.record({
    event: 'confirm-sample',
    selectedGamepadIndex: null,
    selectedGamepadIdentity: null,
    rawGamepads: [],
    hasFocus: false,
    fullscreen: false,
  });
  assert.match(context.textContent, /selected:- identity:-/);
  assert.match(context.textContent, /hasFocus:false visibility:visible fullscreen:false/);
  assert.match(context.textContent, /devices:-$/);
  trace.destroy();
});
