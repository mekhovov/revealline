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
