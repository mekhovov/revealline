// Authored regressions; automated execution remains explicitly waived.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountReviewMotionPreferences } from '../../authoring/industrial-art-review/motion-preferences.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';

function fixture({ shared = false, system = false } = {}) {
  const window = new EventTarget(),
    media = Object.assign(new EventTarget(), { matches: system }),
    checkbox = { checked: false },
    notice = { textContent: '' },
    writes = [];
  let locale = 'en',
    stored = JSON.stringify({ textFace: 'pixel', textSize: 'standard', reducedEffects: shared });
  window.localStorage = {
    getItem(key) {
      assert.equal(key, DISPLAY_PREFERENCES_KEY);
      return stored;
    },
    setItem(...args) {
      writes.push(args);
    },
  };
  window.matchMedia = () => media;
  const motion = mountReviewMotionPreferences({
    window,
    checkbox,
    notice,
    getLocale: () => locale,
  });
  return {
    motion,
    checkbox,
    notice,
    writes,
    media,
    locale(value) {
      locale = value;
      motion.refresh();
    },
    shared(value, { notify = true } = {}) {
      stored = JSON.stringify({ textFace: 'pixel', textSize: 'standard', reducedEffects: value });
      if (notify)
        window.dispatchEvent(
          Object.assign(new Event('storage'), {
            key: DISPLAY_PREFERENCES_KEY,
            storageArea: window.localStorage,
            newValue: stored,
          }),
        );
    },
    system(value, { notify = true } = {}) {
      media.matches = value;
      if (notify) media.dispatchEvent(new Event('change'));
    },
    restore() {
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    },
  };
}

test('review starts reduced from the shared setting without changing the local checkbox or storage', () => {
  const f = fixture({ shared: true });
  assert.equal(f.motion.reducedEffects(), true);
  assert.equal(f.checkbox.checked, false);
  assert.match(f.notice.textContent, /shared game setting/);
  f.locale('uk');
  assert.match(f.notice.textContent, /Спільні налаштування гри/);
  f.checkbox.checked = true;
  f.shared(false);
  assert.equal(f.motion.reducedEffects(), true, 'Local review choice survives a cross-tab change');
  f.checkbox.checked = false;
  assert.equal(f.motion.reducedEffects(), false);
  assert.match(f.notice.textContent, /лише в цьому перегляді/);
  assert.deepEqual(f.writes, []);
  f.motion.dispose();
});

test('live OS policy caps review motion and destruction even when the local checkbox is off', () => {
  const f = fixture();
  assert.equal(f.motion.reducedEffects(), false);
  f.system(true);
  assert.equal(f.motion.reducedEffects(), true);
  assert.equal(f.checkbox.checked, false);
  assert.match(f.notice.textContent, /system requires reduced motion/);
  f.locale('uk');
  assert.match(f.notice.textContent, /Система вимагає зменшення руху/);
  f.system(false);
  assert.equal(f.motion.reducedEffects(), false);
  f.shared(true);
  assert.equal(f.motion.reducedEffects(), true);
  assert.deepEqual(f.writes, []);
  f.motion.dispose();
});

test('review catches missed policy changes after BFCache restoration and releases its subscriptions', () => {
  const f = fixture();
  f.system(true, { notify: false });
  f.restore();
  assert.equal(f.motion.reducedEffects(), true);
  f.shared(true, { notify: false });
  f.system(false, { notify: false });
  f.restore();
  assert.equal(f.motion.reducedEffects(), true);
  assert.match(f.notice.textContent, /shared game setting/);
  const before = f.notice.textContent;
  f.motion.dispose();
  f.shared(false);
  f.system(false);
  f.restore();
  assert.equal(f.notice.textContent, before);
  assert.deepEqual(f.writes, []);
});
