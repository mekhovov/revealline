import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchPreferences, TOUCH_PREFERENCES_KEY } from '../touch-preferences.mjs';
import { DEFAULT_TOUCH_CONTROLS } from '../touch-controls.mjs';
const memory = () => {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};
test('Solo choices are read unchanged by each new mode; no profile is written', () => {
  const storage = memory();
  const solo = createTouchPreferences({ storage });
  const settings = { mode: 'swipe', side: 'left', size: 'large', opacity: 0.7 };
  solo.set(settings);
  assert.deepEqual(createTouchPreferences({ storage }).snapshot(), settings);
  assert.deepEqual([...storage.values.keys()], [TOUCH_PREFERENCES_KEY]);
});
test('invalid storage is preserved; valid legacy touch settings are used until explicit change', () => {
  const storage = memory();
  storage.setItem(TOUCH_PREFERENCES_KEY, '{future}');
  const legacy = { ...DEFAULT_TOUCH_CONTROLS, mode: 'dpad' };
  const prefs = createTouchPreferences({ storage, legacy });
  assert.deepEqual(prefs.snapshot(), legacy);
  assert.equal(storage.getItem(TOUCH_PREFERENCES_KEY), '{future}');
  assert.throws(() => prefs.set({ ...legacy, mode: 'diagonal' }));
  assert.deepEqual(prefs.snapshot(), legacy);
});
test('denied writes retain session choice and expose truthful feedback', () => {
  const prefs = createTouchPreferences({
    storage: {
      getItem() {
        throw Error('denied');
      },
      setItem() {
        throw Error('denied');
      },
    },
  });
  prefs.set({ ...DEFAULT_TOUCH_CONTROLS, mode: 'swipe' });
  assert.equal(prefs.snapshot().mode, 'swipe');
  assert.match(prefs.warning(), /for this visit/);
});
test('external explicit choices notify once and terminal disposal stops observation', () => {
  const events = new EventTarget(),
    storage = memory(),
    changes = [];
  const prefs = createTouchPreferences({
    storage,
    eventTarget: events,
    onChange: (v) => changes.push(v),
  });
  storage.setItem(
    TOUCH_PREFERENCES_KEY,
    JSON.stringify({ ...DEFAULT_TOUCH_CONTROLS, size: 'large' }),
  );
  const event = new Event('storage');
  event.key = TOUCH_PREFERENCES_KEY;
  events.dispatchEvent(event);
  assert.equal(prefs.snapshot().size, 'large');
  assert.equal(changes.length, 1);
  prefs.destroy();
  events.dispatchEvent(event);
  assert.equal(changes.length, 1);
});

test('isolated practice can adjust this visit without writing the shared choice', () => {
  const storage = memory();
  const shared = { ...DEFAULT_TOUCH_CONTROLS, side: 'left' };
  storage.setItem(TOUCH_PREFERENCES_KEY, JSON.stringify(shared));
  const prefs = createTouchPreferences({ storage });
  prefs.set({ ...shared, mode: 'dpad' }, { persist: false });
  assert.equal(prefs.snapshot().mode, 'dpad');
  assert.equal(storage.getItem(TOUCH_PREFERENCES_KEY), JSON.stringify(shared));
  assert.deepEqual(createTouchPreferences({ storage }).snapshot(), shared);
});

test('legacy reconciliation applies before a shared choice, never over later explicit intent', () => {
  const storage = memory(),
    prefs = createTouchPreferences({ storage });
  const legacy = { ...DEFAULT_TOUCH_CONTROLS, side: 'left' };
  assert.equal(prefs.adoptLegacy(legacy), true);
  assert.equal(prefs.snapshot().side, 'left');
  assert.equal(storage.values.size, 0);
  prefs.set({ ...legacy, mode: 'swipe' });
  assert.equal(prefs.adoptLegacy(DEFAULT_TOUCH_CONTROLS), false);
  assert.equal(prefs.snapshot().mode, 'swipe');
  assert.equal(prefs.snapshot().side, 'left');
});

test('returning from a frozen page reads newer shared settings, but keeps isolated practice choices', () => {
  const storage = memory(),
    events = new EventTarget(),
    changes = [];
  const prefs = createTouchPreferences({
    storage,
    eventTarget: events,
    onChange: (v) => changes.push(v),
  });
  prefs.set({ ...DEFAULT_TOUCH_CONTROLS, mode: 'dpad' });
  storage.setItem(
    TOUCH_PREFERENCES_KEY,
    JSON.stringify({ ...DEFAULT_TOUCH_CONTROLS, mode: 'swipe' }),
  );
  const event = new Event('pageshow');
  event.persisted = true;
  events.dispatchEvent(event);
  assert.equal(prefs.snapshot().mode, 'swipe');
  const count = changes.length;
  events.dispatchEvent(event);
  assert.equal(changes.length, count, 'Duplicate restored state does not clear input twice');
  prefs.set({ ...DEFAULT_TOUCH_CONTROLS, mode: 'dpad' }, { persist: false });
  events.dispatchEvent(event);
  assert.equal(prefs.snapshot().mode, 'dpad');
  prefs.destroy();
});

test('silent writes retain pending touch intent across restore and Retry verifies the merged record', () => {
  const storage = memory(),
    events = new EventTarget();
  storage.setItem(TOUCH_PREFERENCES_KEY, JSON.stringify(DEFAULT_TOUCH_CONTROLS));
  const write = storage.setItem;
  storage.setItem = () => {};
  const prefs = createTouchPreferences({ storage, eventTarget: events });
  prefs.set({ ...prefs.snapshot(), mode: 'swipe' });
  assert.ok(prefs.warning(), 'An unconfirmed write must be visible, not silently accepted.');
  assert.equal(prefs.persistence().reason, 'unconfirmed');
  write(TOUCH_PREFERENCES_KEY, JSON.stringify({ ...DEFAULT_TOUCH_CONTROLS, size: 'large' }));
  const restored = new Event('pageshow');
  restored.persisted = true;
  events.dispatchEvent(restored);
  assert.deepEqual(prefs.snapshot(), { ...DEFAULT_TOUCH_CONTROLS, mode: 'swipe', size: 'large' });
  assert.equal(prefs.persistence().status, 'unsaved');
  storage.setItem = write;
  prefs.retry();
  assert.equal(prefs.persistence().status, 'saved');
  assert.equal(prefs.warning(), '');
  assert.deepEqual(JSON.parse(storage.getItem(TOUCH_PREFERENCES_KEY)), prefs.snapshot());
  prefs.destroy();
});

test('unreadable and future touch records keep their bytes through selection and Retry', () => {
  for (const raw of [
    '{broken',
    'null',
    'x'.repeat(513),
    JSON.stringify({ ...DEFAULT_TOUCH_CONTROLS, future: true }),
  ]) {
    let writes = 0;
    const prefs = createTouchPreferences({
      storage: {
        getItem: () => raw,
        setItem() {
          writes++;
        },
      },
      legacy: { ...DEFAULT_TOUCH_CONTROLS, side: 'left' },
    });
    prefs.set({ ...prefs.snapshot(), mode: 'swipe' });
    prefs.retry();
    assert.equal(writes, 0);
    assert.equal(prefs.persistence().reason, 'preserved');
    assert.deepEqual(prefs.snapshot(), { ...DEFAULT_TOUCH_CONTROLS, side: 'left', mode: 'swipe' });
    prefs.destroy();
  }
});

test('fresh read confirmation retains a peer field written during the first read', () => {
  const storage = memory();
  storage.setItem(TOUCH_PREFERENCES_KEY, JSON.stringify(DEFAULT_TOUCH_CONTROLS));
  const read = storage.getItem;
  let peer = null;
  storage.getItem = (key) => {
    const raw = read(key);
    const action = peer;
    peer = null;
    action?.();
    return raw;
  };
  const prefs = createTouchPreferences({ storage });
  peer = () =>
    storage.setItem(
      TOUCH_PREFERENCES_KEY,
      JSON.stringify({ ...DEFAULT_TOUCH_CONTROLS, size: 'large' }),
    );
  prefs.set({ ...prefs.snapshot(), mode: 'swipe' });
  assert.equal(prefs.persistence().status, 'saved');
  assert.deepEqual(JSON.parse(read(TOUCH_PREFERENCES_KEY)), {
    ...DEFAULT_TOUCH_CONTROLS,
    mode: 'swipe',
    size: 'large',
  });
  prefs.destroy();
});

test('a newer reentrant choice cannot receive older write success and remains retryable', () => {
  const storage = memory();
  storage.setItem(TOUCH_PREFERENCES_KEY, JSON.stringify(DEFAULT_TOUCH_CONTROLS));
  const write = storage.setItem;
  let next = null,
    changes = 0;
  storage.setItem = (key, value) => {
    const action = next;
    next = null;
    action?.();
    write(key, value);
  };
  const prefs = createTouchPreferences({
    storage,
    onChange() {
      changes++;
    },
  });
  next = () => prefs.set({ ...prefs.snapshot(), side: 'left' });
  prefs.set({ ...prefs.snapshot(), mode: 'swipe' });
  assert.deepEqual(prefs.snapshot(), { ...DEFAULT_TOUCH_CONTROLS, mode: 'swipe', side: 'left' });
  assert.equal(prefs.persistence().reason, 'changed');
  assert.equal(prefs.persistence().status, 'unsaved');
  const before = changes;
  prefs.retry();
  assert.equal(prefs.persistence().status, 'saved');
  assert.equal(changes, before, 'Retry of accepted controls does not clear gameplay input again.');
  assert.deepEqual(JSON.parse(storage.getItem(TOUCH_PREFERENCES_KEY)), prefs.snapshot());
  prefs.destroy();
});

for (const [name, reason] of [
  ['QuotaExceededError', 'full'],
  ['SecurityError', 'blocked'],
  ['Error', 'unavailable'],
]) {
  test(`${name} keeps the selected control and reason until verified recovery`, () => {
    const storage = memory(),
      write = storage.setItem;
    storage.setItem = () => {
      throw Object.assign(Error('Unavailable'), { name });
    };
    const prefs = createTouchPreferences({ storage });
    prefs.set({ ...DEFAULT_TOUCH_CONTROLS, size: 'large' });
    assert.equal(prefs.persistence().reason, reason);
    assert.equal(prefs.persistence().canRetry, true);
    storage.setItem = write;
    prefs.retry();
    assert.equal(prefs.persistence().status, 'saved');
    assert.equal(prefs.persistence().reason, '');
    prefs.destroy();
  });
}

test('isolated choices and disposal cannot gain a write through Retry or restore', () => {
  const storage = memory(),
    events = new EventTarget();
  const prefs = createTouchPreferences({ storage, eventTarget: events });
  const notices = [];
  const stop = prefs.subscribe((status) => notices.push(status));
  assert.equal(notices[0].status, 'unchanged');
  prefs.set({ ...DEFAULT_TOUCH_CONTROLS, side: 'left' }, { persist: false });
  prefs.retry();
  assert.equal(prefs.persistence().status, 'session');
  assert.equal(prefs.persistence().canRetry, false);
  assert.equal(storage.values.size, 0);
  const before = notices.length;
  stop();
  prefs.destroy();
  prefs.set(DEFAULT_TOUCH_CONTROLS);
  prefs.retry();
  const restored = new Event('pageshow');
  restored.persisted = true;
  events.dispatchEvent(restored);
  assert.equal(storage.values.size, 0);
  assert.equal(notices.length, before);
});

test('observed removed storage retires Saved without writing on restore, and Retry confirms again', () => {
  const storage = memory(),
    events = new EventTarget();
  const prefs = createTouchPreferences({ storage, eventTarget: events });
  prefs.set({ ...DEFAULT_TOUCH_CONTROLS, mode: 'swipe' });
  assert.equal(prefs.persistence().status, 'saved');
  storage.values.delete(TOUCH_PREFERENCES_KEY);
  const restored = new Event('pageshow');
  restored.persisted = true;
  events.dispatchEvent(restored);
  assert.equal(prefs.snapshot().mode, 'swipe');
  assert.equal(prefs.persistence().status, 'unsaved');
  assert.equal(storage.values.size, 0, 'Restore is read-only.');
  prefs.retry();
  assert.equal(prefs.persistence().status, 'saved');
  assert.equal(JSON.parse(storage.getItem(TOUCH_PREFERENCES_KEY)).mode, 'swipe');
  prefs.destroy();
});

test('unchanged explicit selection rechecks storage and never reports Saved after a silent write', () => {
  const storage = memory();
  storage.setItem(TOUCH_PREFERENCES_KEY, JSON.stringify(DEFAULT_TOUCH_CONTROLS));
  const prefs = createTouchPreferences({ storage });
  storage.values.clear();
  storage.setItem = () => {};
  prefs.set(prefs.snapshot());
  assert.equal(prefs.persistence().status, 'unsaved');
  assert.equal(prefs.persistence().reason, 'unconfirmed');
  prefs.destroy();
});
