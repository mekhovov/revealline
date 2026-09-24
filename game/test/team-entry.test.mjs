import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { Events } from './helpers/couch-dom.mjs';

const scriptURL = new URL('../couch/team-entry.js', import.meta.url);
const source = await readFile(scriptURL, 'utf8');

// Execute the actual classic entry before the Arena control is parsed. The
// finite event boundary models capture/bubbling, not native loading or BFCache.
function page(t) {
  const host = new Events(),
    document = new Events(),
    forbidden = [];
  document.parentNode = host;
  host.document = document;
  host.addEventListener = host.addEventListener.bind(host);
  host.removeEventListener = host.removeEventListener.bind(host);
  const deny = (name) => {
    forbidden.push(name);
    throw new Error(`Entry intent tracking must not access ${name}.`);
  };
  for (const name of ['localStorage', 'sessionStorage', 'indexedDB', 'location', 'history']) {
    Object.defineProperty(host, name, {
      configurable: true,
      get: () => deny(name),
      set: () => deny(name),
    });
  }
  Object.defineProperty(document, 'cookie', {
    get: () => deny('document.cookie'),
    set: () => deny('document.cookie'),
  });
  document.write = () => deny('document.write');
  host.open = () => deny('window.open');
  host.fetch = () => deny('fetch');
  host.setTimeout = () => deny('setTimeout');
  const context = vm.createContext(host);
  vm.runInContext(source, context, { filename: scriptURL.pathname, timeout: 1000 });
  assert.ok(Object.isFrozen(host.RevealLineTeamEntry));
  t.after(() =>
    assert.deepEqual(forbidden, [], 'Tracking has no storage, navigation or network side effects.'),
  );
  return {
    host,
    document,
    take: () => host.RevealLineTeamEntry.take(),
    field(id = 'coop-level', value = 'first-connection') {
      const field = new Events();
      field.parentNode = document;
      field.id = id;
      field.value = value;
      return field;
    },
    listenerCounts() {
      return {
        input: document.captureListeners.get('input')?.size ?? 0,
        change: document.captureListeners.get('change')?.size ?? 0,
        pointerdown: document.captureListeners.get('pointerdown')?.size ?? 0,
        click: document.captureListeners.get('click')?.size ?? 0,
        keydown: document.captureListeners.get('keydown')?.size ?? 0,
        pagehide: host.listeners.get('pagehide')?.size ?? 0,
      };
    },
  };
}
const listening = { input: 1, change: 1, pointerdown: 1, click: 1, keydown: 1, pagehide: 1 };
const retired = { input: 0, change: 0, pointerdown: 0, click: 0, keydown: 0, pagehide: 0 };

test('the early classic entry starts before controls exist and reports untouched intent without a default choice', (t) => {
  const p = page(t);
  assert.deepEqual(p.listenerCounts(), listening);
  const intent = p.take();
  assert.equal(intent.claimed, false);
  assert.equal(intent.changed, false);
  assert.equal(intent.value, undefined);
  assert.equal(intent.difficulty.changed, false);
  assert.equal(intent.difficulty.value, undefined);
  assert.ok(Object.isFrozen(intent.difficulty));
  assert.ok(Object.isFrozen(intent));
  assert.deepEqual(p.listenerCounts(), retired);
  assert.equal(p.take(), null);
});

for (const type of ['input', 'change']) {
  test(`a native ${type} is captured before module readiness even when the control stops bubbling`, (t) => {
    const p = page(t),
      arena = p.field();
    arena.addEventListener(type, (event) => event.stopPropagation());
    arena.value = 'relay-yard';
    const event = arena.emit(type);
    assert.equal(event.defaultPrevented, false, 'Tracking cannot cancel native control behavior.');
    assert.equal(arena.value, 'relay-yard');
    const intent = p.take();
    assert.equal(intent.claimed, true);
    assert.equal(intent.changed, true);
    assert.equal(intent.value, 'relay-yard');
    assert.deepEqual(p.listenerCounts(), retired);
  });
}

test('a deliberate return to the original markup default remains explicit intent', (t) => {
  const p = page(t),
    arena = p.field();
  arena.value = 'relay-yard';
  arena.emit('input');
  arena.emit('change');
  arena.value = 'first-connection';
  arena.emit('input');
  arena.emit('change');
  const intent = p.take();
  assert.equal(intent.claimed, true);
  assert.equal(intent.changed, true);
  assert.equal(intent.value, 'first-connection');
});

test('unrelated setup controls and similar IDs do not manufacture arena intent', (t) => {
  const p = page(t);
  for (const id of ['coop-difficulty', 'coop-pack-file', 'coop-level-description', '']) {
    const field = p.field(id, 'relay-yard');
    field.emit('input');
    field.emit('change');
    field.emit('pointerdown', { button: 0, isPrimary: true });
    field.emit('click', { button: 0 });
    field.emit('keydown', { key: 'ArrowDown' });
  }
  const intent = p.take();
  assert.equal(intent.claimed, false);
  assert.equal(intent.changed, false);
  assert.equal(intent.value, undefined);
});

test('unrelated later events do not replace the last actual arena choice', (t) => {
  const p = page(t),
    arena = p.field('coop-level', 'relay-yard'),
    difficulty = p.field('coop-difficulty', 'expert');
  arena.emit('change');
  difficulty.emit('input');
  difficulty.emit('change');
  const intent = p.take();
  assert.equal(intent.claimed, true);
  assert.equal(intent.changed, true);
  assert.equal(intent.value, 'relay-yard');
});

test('consumption returns the recorded event value once and prevents later native changes from mutating it', (t) => {
  const p = page(t),
    arena = p.field('coop-level', 'relay-yard');
  arena.emit('input');
  arena.value = 'first-connection';
  const intent = p.take();
  assert.equal(intent.claimed, true);
  assert.equal(intent.changed, true);
  assert.equal(
    intent.value,
    'relay-yard',
    'An unreported property change is not a native input event.',
  );
  arena.emit('change');
  assert.equal(intent.value, 'relay-yard');
  assert.ok(Object.isFrozen(intent));
  assert.equal(p.take(), null);
  assert.deepEqual(p.listenerCounts(), retired);
});

test('persisted pagehide preserves pending arena intent through modeled restoration', (t) => {
  const p = page(t),
    arena = p.field('coop-level', 'relay-yard');
  arena.emit('change');
  p.host.emit('pagehide', { persisted: true });
  assert.deepEqual(p.listenerCounts(), listening);
  p.host.emit('pageshow', { persisted: true });
  const intent = p.take();
  assert.equal(intent.claimed, true);
  assert.equal(intent.changed, true);
  assert.equal(intent.value, 'relay-yard');
  assert.deepEqual(p.listenerCounts(), retired);
});

test('a newer native choice after persisted restoration supersedes the retained one before consumption', (t) => {
  const p = page(t),
    arena = p.field('coop-level', 'relay-yard');
  arena.emit('input');
  p.host.emit('pagehide', { persisted: true });
  p.host.emit('pageshow', { persisted: true });
  arena.value = 'first-connection';
  arena.emit('change');
  const intent = p.take();
  assert.equal(intent.claimed, true);
  assert.equal(intent.changed, true);
  assert.equal(intent.value, 'first-connection');
});

for (const hadInput of [false, true]) {
  test(`terminal pagehide retires ${hadInput ? 'captured' : 'untouched'} intent and removes all tracker listeners`, (t) => {
    const p = page(t),
      arena = p.field('coop-level', 'relay-yard');
    if (hadInput) arena.emit('input');
    p.host.emit('pagehide', { persisted: false });
    assert.deepEqual(p.listenerCounts(), retired);
    p.host.emit('pageshow', { persisted: false });
    arena.value = 'first-connection';
    arena.emit('change');
    assert.equal(p.take(), null);
    p.host.emit('pagehide', { persisted: false });
    assert.deepEqual(p.listenerCounts(), retired);
  });
}

test('consuming the tracker removes only its own listeners and cannot be revived by page lifecycle events', (t) => {
  const p = page(t),
    arena = p.field('coop-level', 'relay-yard');
  let inputs = 0,
    changes = 0,
    departures = 0;
  p.document.addEventListener('input', () => inputs++, true);
  p.document.addEventListener('change', () => changes++, true);
  p.host.addEventListener('pagehide', () => departures++);
  arena.emit('input');
  assert.equal(p.take().value, 'relay-yard');
  assert.deepEqual(
    p.listenerCounts(),
    { ...retired, input: 1, change: 1, pagehide: 1 },
    'Only the unrelated sentinel listeners remain.',
  );
  arena.emit('input');
  arena.emit('change');
  p.host.emit('pagehide', { persisted: true });
  p.host.emit('pageshow', { persisted: true });
  p.host.emit('pagehide', { persisted: false });
  assert.equal(inputs, 2);
  assert.equal(changes, 1);
  assert.equal(departures, 2);
  assert.equal(p.take(), null);
});

test('primary pointer activation and an assistive primary click claim Arena without inventing a value change', (t) => {
  for (const [type, details] of [
    ['pointerdown', { button: 0, isPrimary: true }],
    ['pointerdown', { button: 0 }],
    ['click', { button: 0, detail: 0 }],
  ]) {
    const p = page(t),
      arena = p.field();
    arena.addEventListener(type, (event) => event.stopPropagation());
    const event = arena.emit(type, details);
    assert.equal(event.defaultPrevented, false);
    // Native selection may finish after pointer/key handling. Claim-only
    // intent lets the host read this live value; it must not capture the old one.
    arena.value = 'relay-yard';
    const intent = p.take();
    assert.equal(intent.claimed, true, type);
    assert.equal(intent.changed, false, type);
    assert.equal(intent.value, undefined, type);
    assert.equal(arena.value, 'relay-yard');
    assert.ok(Object.isFrozen(intent));
    assert.deepEqual(p.listenerCounts(), retired);
  }
});

test('native select navigation, activation and unmodified printable keys claim Arena without cancelling their default action', (t) => {
  const keys = [
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'Enter',
    ' ',
    'Spacebar',
    'a',
    '7',
    'é',
  ];
  const gestures = [
    ...keys.map((key) => ({ key })),
    { key: 'A', shiftKey: true },
    { key: 'F4' },
    { key: 'ArrowDown', altKey: true },
    { key: 'ArrowUp', altKey: true },
  ];
  for (const gesture of gestures) {
    const p = page(t),
      arena = p.field();
    const event = arena.emit('keydown', gesture);
    const intent = p.take();
    assert.equal(event.defaultPrevented, false, JSON.stringify(gesture));
    assert.equal(intent.claimed, true, JSON.stringify(gesture));
    assert.equal(intent.changed, false, JSON.stringify(gesture));
    assert.equal(intent.value, undefined, JSON.stringify(gesture));
  }
});

test('focus, exit keys, secondary pointers, shortcuts and composition do not claim Arena', (t) => {
  const ignored = [
    ['focus', {}],
    ['focusin', {}],
    ['pointerdown', { button: 1, isPrimary: true }],
    ['pointerdown', { button: 2, isPrimary: true }],
    ['pointerdown', { button: 0, isPrimary: false }],
    ['click', { button: 1 }],
    ['click', { button: 2 }],
    ['keydown', { key: 'Tab' }],
    ['keydown', { key: 'Escape' }],
    ['keydown', { key: 'Shift' }],
    ['keydown', { key: 'F4', altKey: true }],
    ['keydown', { key: 'F4', ctrlKey: true }],
    ['keydown', { key: 'F4', metaKey: true }],
    ['keydown', { key: 'a', ctrlKey: true }],
    ['keydown', { key: 'a', metaKey: true }],
    ['keydown', { key: 'ArrowDown', ctrlKey: true }],
    ['keydown', { key: 'ArrowUp', metaKey: true }],
    ['keydown', { key: 'a', altKey: true }],
    ['keydown', { key: 'ArrowLeft', altKey: true }],
    ['keydown', { key: 'Home', altKey: true }],
    ['keydown', { key: 'Enter', altKey: true }],
    ['keydown', { key: 'a', isComposing: true }],
    ['keydown', { key: 'ArrowDown', isComposing: true }],
  ];
  for (const [type, details] of ignored) {
    const p = page(t),
      arena = p.field();
    const event = arena.emit(type, details);
    const intent = p.take();
    const label = `${type} ${JSON.stringify(details)}`;
    assert.equal(event.defaultPrevented, false, label);
    assert.equal(intent.claimed, false, label);
    assert.equal(intent.changed, false, label);
    assert.equal(intent.value, undefined, label);
  }
});

test('a later claim gesture does not discard an already recorded input value', (t) => {
  const p = page(t),
    arena = p.field('coop-level', 'relay-yard');
  arena.emit('input');
  arena.value = 'first-connection';
  arena.emit('pointerdown', { button: 0, isPrimary: true });
  arena.emit('keydown', { key: 'Enter' });
  const intent = p.take();
  assert.equal(intent.claimed, true);
  assert.equal(intent.changed, true);
  assert.equal(intent.value, 'relay-yard');
});

test('claim-only intent survives persisted departure and stays distinct from an input change', (t) => {
  const p = page(t),
    arena = p.field();
  arena.emit('keydown', { key: 'ArrowDown' });
  p.host.emit('pagehide', { persisted: true });
  assert.deepEqual(p.listenerCounts(), listening);
  p.host.emit('pageshow', { persisted: true });
  const intent = p.take();
  assert.equal(intent.claimed, true);
  assert.equal(intent.changed, false);
  assert.equal(intent.value, undefined);
  assert.deepEqual(p.listenerCounts(), retired);
});

test('terminal departure retires claim-only intent and all five document listeners', (t) => {
  const p = page(t),
    arena = p.field();
  arena.emit('click', { button: 0 });
  p.host.emit('pagehide', { persisted: false });
  assert.deepEqual(p.listenerCounts(), retired);
  for (const [type, details] of [
    ['pointerdown', { button: 0, isPrimary: true }],
    ['click', { button: 0 }],
    ['keydown', { key: 'ArrowDown' }],
  ])
    arena.emit(type, details);
  assert.equal(p.take(), null);
});

for (const type of ['input', 'change'])
  test(`early difficulty ${type} owns only the reported preset and stays immutable after take`, (t) => {
    const p = page(t),
      difficulty = p.field('coop-difficulty', 'expert');
    difficulty.addEventListener(type, (event) => event.stopPropagation());
    assert.equal(difficulty.emit(type).defaultPrevented, false);
    difficulty.value = 'standard';
    const intent = p.take();
    assert.equal(intent.claimed, false);
    assert.equal(intent.changed, false);
    assert.equal(intent.value, undefined);
    assert.equal(intent.difficulty.changed, true);
    assert.equal(intent.difficulty.value, 'expert');
    assert.ok(Object.isFrozen(intent.difficulty));
    difficulty.emit('change');
    assert.equal(intent.difficulty.value, 'expert');
    assert.deepEqual(p.listenerCounts(), retired);
    assert.equal(p.take(), null);
  });

test('an explicit Standard edit survives persisted restoration independently of Arena ownership', (t) => {
  const p = page(t),
    difficulty = p.field('coop-difficulty', 'expert'),
    arena = p.field('coop-level', 'relay-yard');
  difficulty.emit('input');
  arena.emit('change');
  p.host.emit('pagehide', { persisted: true });
  p.host.emit('pageshow', { persisted: true });
  difficulty.value = 'standard';
  difficulty.emit('change');
  const intent = p.take();
  assert.equal(intent.value, 'relay-yard');
  assert.equal(intent.difficulty.changed, true);
  assert.equal(intent.difficulty.value, 'standard');
});

test('opening or cancelling Difficulty never manufactures a saved edit', (t) => {
  const p = page(t),
    difficulty = p.field('coop-difficulty', 'standard');
  difficulty.emit('focusin');
  difficulty.emit('pointerdown', { button: 0, isPrimary: true });
  difficulty.emit('click', { button: 0 });
  difficulty.emit('keydown', { key: 'ArrowDown' });
  difficulty.emit('keydown', { key: 'Escape' });
  const intent = p.take();
  assert.equal(intent.claimed, false);
  assert.equal(intent.difficulty.changed, false);
  assert.equal(intent.difficulty.value, undefined);
});

test('terminal departure also retires pending difficulty intent', (t) => {
  const p = page(t),
    difficulty = p.field('coop-difficulty', 'expert');
  difficulty.emit('input');
  p.host.emit('pagehide', { persisted: false });
  p.host.emit('pageshow', { persisted: false });
  difficulty.value = 'gentle';
  difficulty.emit('change');
  assert.equal(p.take(), null);
  assert.deepEqual(p.listenerCounts(), retired);
});
