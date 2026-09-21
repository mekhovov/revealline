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
