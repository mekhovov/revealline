import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { activateHostAction } from './helpers/host-action.mjs';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { TOUCH_PREFERENCES_KEY } from '../touch-preferences.mjs';

// Locale changes correctly translate units and decimal punctuation. Preserve
// the visible numeric progress, without claiming access to Team's hidden replay.
const teamProgress = (f) =>
  ['coop-clock', 'coop-coverage', 'coop-reserves'].map((id) =>
    [...f.$(id).textContent.matchAll(/\d+(?:[.,]\d+)?/g)].map(([value]) =>
      Number(value.replace(',', '.')),
    ),
  );

for (const mode of ['versus', 'team'])
  test(`${mode}: live touch copy translates every field and seat without replacing focused controls or saving`, async (context) => {
    const previous = getLocale();
    context.after(() => setLocale(previous, { persist: false }));
    setLocale('en', { persist: false });
    const storage = memoryStorage(),
      f =
        mode === 'versus'
          ? await couchPage(context, { storage })
          : await teamPage(context, {
              beforeImport: ({ install }) => install('localStorage', { value: storage }),
            }),
      prefix = mode === 'versus' ? 'race' : 'coop';
    await activateHostAction(f.$(`${prefix}-start`));
    if (mode === 'versus') f.frames(3);
    else f.tick(3);
    f.$(`${prefix}-pause`).click();
    if (mode === 'versus') f.frame(0);
    else f.tick();
    f.$(mode === 'versus' ? 'race-options' : 'coop-settings-open').click();
    f.$(`${prefix}-settings-tab-controls`).click();
    const fields = Object.fromEntries(
      [...f.doc.querySelectorAll('[data-touch-setting]')].map((node) => [
        node.dataset.touchSetting,
        node,
      ]),
    );
    for (const [key, value] of Object.entries({ mode: 'swipe', size: 'large', opacity: '0.65' })) {
      fields[key].value = value;
      fields[key].emit('change');
    }
    fields.mode.focus();
    const saved = storage.getItem(TOUCH_PREFERENCES_KEY),
      writes = storage.writes.length,
      paused = mode === 'versus' ? f.checkpoint() : teamProgress(f);
    assert.ok(saved);
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.ok(fields.mode.parentElement.textContent.startsWith(t('interface:steering')));
      assert.ok(fields.size.parentElement.textContent.startsWith(t('interface:controlSize')));
      assert.ok(fields.opacity.parentElement.textContent.startsWith(t('interface:visibility')));
      assert.deepEqual(
        [...fields.mode.options].map((option) => option.textContent),
        ['floatingStick', 'swipe', 'directionPad'].map((key) => t(`interface:${key}`)),
      );
      assert.deepEqual(
        [...fields.size.options].map((option) => option.textContent),
        ['regular', 'large'].map((key) => t(`interface:${key}`)),
      );
      assert.deepEqual(
        [...f.doc.querySelectorAll('.touch-surface')].map((node) =>
          node.getAttribute('aria-label'),
        ),
        locale === 'uk'
          ? ['Зона керування гравця 1', 'Зона керування гравця 2']
          : ['Player 1 steering area', 'Player 2 steering area'],
      );
      for (const [key, value] of Object.entries({
        mode: 'swipe',
        size: 'large',
        opacity: '0.65',
      })) {
        assert.equal(f.doc.querySelector(`[data-touch-setting="${key}"]`), fields[key]);
        assert.equal(fields[key].value, value);
      }
      assert.equal(f.doc.activeElement, fields.mode);
      assert.equal(storage.getItem(TOUCH_PREFERENCES_KEY), saved);
      assert.equal(storage.writes.length, writes);
      if (mode === 'versus') {
        f.frames(3, 0);
        assert.deepEqual(f.checkpoint(), paused);
      } else {
        f.tick(3);
        assert.deepEqual(teamProgress(f), paused);
      }
    }
  });
