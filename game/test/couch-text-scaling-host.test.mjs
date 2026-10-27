import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

// Actual native Duel entry, display owner and two simulations. The finite DOM
// observes handlers and painter options; browser review owns layout geometry.
for (const initial of ['standard', 'extra-large']) {
  test(`Duel ${initial}: native text controls preserve both paused boards and storage ownership`, async (t) => {
    const locale = getLocale();
    t.after(() => setLocale(locale, { persist: false }));
    setLocale('en', { persist: false });
    const records = new Map([
      [
        DISPLAY_PREFERENCES_KEY,
        JSON.stringify({ textSize: initial, textFace: 'pixel', reducedEffects: false }),
      ],
      ['unrelated-progress', 'retained'],
    ]);
    let fail = false;
    const writes = [];
    const storage = {
      getItem: (key) => records.get(key) ?? null,
      setItem(key, value) {
        if (fail && key === DISPLAY_PREFERENCES_KEY) throw new Error('Storage unavailable');
        writes.push(key);
        records.set(key, String(value));
      },
      removeItem: (key) => records.delete(key),
    };
    const page = await couchPage(t, {
      storage,
      beforeImport: ({ document }) => {
        document.documentElement.dataset.textScaling = 'versus';
      },
    });
    const control = page.$('race-text-size');
    assert.equal(control.value, initial);
    assert.equal(page.doc.body.dataset.textSize, initial);
    assert.equal(control.querySelector('[data-text-size-retained]').disabled, false);
    assert.equal(writes.filter((key) => key === DISPLAY_PREFERENCES_KEY).length, 0);
    page.$('race-start').click();
    page.frames(5);
    page.$('race-pause').click();
    page.frame(0);
    assert.equal(page.doc.body.dataset.couchStatus, 'paused');
    const before = page.checkpoint();
    const stored = new Map(records);
    const sizes = page.renders.map((run) => [run.level.cols, run.level.rows]);
    page.$('race-options').click();
    const change = (id, value) => {
      page.$(id).value = value;
      page.$(id).emit('change');
      page.frame(0);
    };
    setLocale('uk', { persist: false });
    assert.equal(control.value, initial);
    assert.equal(records.get(DISPLAY_PREFERENCES_KEY), stored.get(DISPLAY_PREFERENCES_KEY));
    change('race-text-face', 'plain');
    assert.equal(JSON.parse(records.get(DISPLAY_PREFERENCES_KEY)).textSize, initial);
    for (const size of ['extra-large', 'large', 'standard', 'extra-large']) {
      change('race-text-size', size);
      assert.equal(page.doc.body.dataset.textSize, size);
      assert.equal(JSON.parse(records.get(DISPLAY_PREFERENCES_KEY)).textSize, size);
      assert.deepEqual(
        page.drawOptions.map((value) => value.textScale),
        [size === 'extra-large' ? 2 : 1, size === 'extra-large' ? 2 : 1],
      );
      assert.deepEqual(page.checkpoint(), before);
      assert.deepEqual(
        page.renders.map((run) => [run.level.cols, run.level.rows]),
        sizes,
      );
    }
    const external = JSON.stringify({
      textSize: 'large',
      textFace: 'plain',
      reducedEffects: false,
    });
    records.set(DISPLAY_PREFERENCES_KEY, external);
    page.win.emit('storage', {
      key: DISPLAY_PREFERENCES_KEY,
      storageArea: storage,
      newValue: external,
    });
    page.frame(0);
    assert.equal(control.value, 'large');
    assert.equal(page.doc.body.dataset.textSize, 'large');
    control.focus();
    fail = true;
    change('race-text-size', 'extra-large');
    assert.equal(page.doc.body.dataset.textSize, 'extra-large');
    assert.equal(records.get(DISPLAY_PREFERENCES_KEY), external);
    assert.ok(page.$('race-display-status').textContent);
    assert.equal(page.doc.activeElement, control);
    assert.deepEqual(page.checkpoint(), before);
    assert.deepEqual(
      [...records].filter(([key]) => key !== DISPLAY_PREFERENCES_KEY),
      [...stored].filter(([key]) => key !== DISPLAY_PREFERENCES_KEY),
    );
    page.$('race-options-back').click();
    page.frame(0);
    assert.equal(page.doc.body.dataset.couchStatus, 'paused');
    assert.deepEqual(page.checkpoint(), before);
  });
}
