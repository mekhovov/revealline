import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { getLocale, setLocale, attachLanguageControls } from '../i18n/index.mjs';

test('Team controller can change language in the lobby and Settings without starting an attempt', async (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const f = await page(context);
  attachLanguageControls(f.doc);
  const lobby = f.$('coop-language-select');
  const settings = f.$('coop-settings-language-select');
  assert.ok(f.$('coop-menu').contains(lobby));
  assert.ok(f.$('coop-settings-panel-display').contains(settings));
  const pad = {
    index: 0,
    id: 'Test controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  };
  f.pads.push(pad);
  const pulse = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    f.tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    f.tick();
  };
  f.tick(2);
  pulse(0);
  lobby.focus();
  pulse(0);
  assert.equal(lobby.getAttribute('data-controller-editing'), 'true');
  pulse(13);
  pulse(0);
  assert.equal(getLocale(), 'uk');
  assert.equal(f.doc.activeElement, lobby);
  assert.equal(settings.value, 'uk');
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-overlay').hidden, true);
  f.$('coop-settings-open').click();
  f.$('coop-settings-tab-display').click();
  f.tick();
  settings.focus();
  pulse(0);
  assert.equal(settings.getAttribute('data-controller-editing'), 'true');
  pulse(12);
  pulse(0);
  assert.equal(getLocale(), 'en');
  assert.equal(f.doc.activeElement, settings);
  assert.equal(lobby.value, 'en');
  assert.equal(f.$('coop-menu').hidden, false);
});
