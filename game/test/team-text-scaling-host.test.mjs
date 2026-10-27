import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

for (const initial of ['standard', 'extra-large'])
  test(`Team ${initial}: actual native size/locale/peer changes preserve paused HUD and painter`, async (t) => {
    const locale = getLocale();
    t.after(() => setLocale(locale, { persist: false }));
    setLocale('en', { persist: false });
    const records = new Map([
      [
        DISPLAY_PREFERENCES_KEY,
        JSON.stringify({ textSize: initial, textFace: 'pixel', reducedEffects: true }),
      ],
      ['unrelated-progress', 'retained'],
    ]);
    let fail = false;
    const writes = [];
    const storage = {
      getItem: (key) => records.get(key) ?? null,
      setItem(key, value) {
        if (fail && key === DISPLAY_PREFERENCES_KEY) throw Error('Storage unavailable');
        writes.push(key);
        records.set(key, String(value));
      },
      removeItem: (key) => records.delete(key),
    };
    const f = await page(t, {
      capturePaint: true,
      stablePaintImages: true,
      beforeImport({ doc, install }) {
        doc.documentElement.dataset.textScaling = 'team';
        install('localStorage', { value: storage });
      },
    });
    const control = f.$('coop-text-size');
    assert.equal(control.value, initial);
    assert.equal(f.doc.body.dataset.textSize, initial);
    assert.equal(control.querySelector('[data-text-size-retained]').disabled, false);
    assert.equal(writes.filter((key) => key === DISPLAY_PREFERENCES_KEY).length, 0);
    f.$('coop-start').click();
    f.tick(5);
    f.$('coop-pause').click();
    f.tick();
    assert.equal(f.doc.body.dataset.coopPaused, 'true');
    const hud = () =>
      ['coop-clock', 'coop-coverage', 'coop-reserves'].map((id) => f.$(id).textContent);
    const before = hud(),
      paint = f.lastPaint,
      stored = new Map(records);
    f.$('coop-settings-open').click();
    const change = (id, value) => {
      f.$(id).value = value;
      f.$(id).emit('change');
      f.tick();
    };
    setLocale('uk', { persist: false });
    assert.equal(control.value, initial);
    assert.equal(records.get(DISPLAY_PREFERENCES_KEY), stored.get(DISPLAY_PREFERENCES_KEY));
    change('coop-text-face', 'plain');
    assert.equal(JSON.parse(records.get(DISPLAY_PREFERENCES_KEY)).textSize, initial);
    for (const size of ['extra-large', 'large', 'standard', 'extra-large']) {
      change('coop-text-size', size);
      assert.equal(f.doc.body.dataset.textSize, size);
      assert.equal(JSON.parse(records.get(DISPLAY_PREFERENCES_KEY)).textSize, size);
      assert.equal(f.doc.body.dataset.coopPaused, 'true');
    }
    const peer = JSON.stringify({ textSize: 'large', textFace: 'plain', reducedEffects: true });
    records.set(DISPLAY_PREFERENCES_KEY, peer);
    f.win.emit('storage', { key: DISPLAY_PREFERENCES_KEY, storageArea: storage, newValue: peer });
    f.tick();
    assert.equal(control.value, 'large');
    assert.equal(f.doc.body.dataset.textSize, 'large');
    control.focus();
    fail = true;
    change('coop-text-size', 'extra-large');
    assert.equal(f.doc.activeElement, control);
    assert.equal(records.get(DISPLAY_PREFERENCES_KEY), peer);
    assert.ok(f.$('coop-display-status').textContent);
    assert.equal(f.doc.body.dataset.textSize, 'extra-large');
    fail = false;
    change('coop-text-size', initial);
    change('coop-text-face', 'pixel');
    setLocale('en', { persist: false });
    f.tick(20);
    assert.deepEqual(hud(), before);
    assert.equal(
      f.lastPaint,
      paint,
      'Returning to the same display restores the complete paused command stream',
    );
    assert.deepEqual(
      [...records].filter(([key]) => key !== DISPLAY_PREFERENCES_KEY),
      [...stored].filter(([key]) => key !== DISPLAY_PREFERENCES_KEY),
    );
    f.$('coop-settings-close').click();
    f.tick(20);
    assert.equal(f.$('coop-options').open, false);
    assert.equal(f.doc.body.dataset.coopPaused, 'true');
    assert.deepEqual(hud(), before);
    assert.equal(f.lastPaint, paint);
  });
