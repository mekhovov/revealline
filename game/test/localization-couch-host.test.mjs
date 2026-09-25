import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { getLocale, setLocale, t } from '../i18n/index.mjs';

test('Couch language changes translate the lobby and paused help without changing the match', async (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const f = await couchPage(context);
  const summary = f.$('race-summary').textContent;
  const selected = f.$('race-level').value;
  const selectedTheme = f.$('race-theme').value;
  const start = f.$('race-start');
  start.focus();
  const before = f.checkpoint();
  setLocale('uk', { persist: false });
  assert.match(f.$('race-summary').textContent, /Одні перегони/);
  assert.match(f.$('race-format-note').textContent, /не змінюють ваш прогрес одиночної гри/);
  assert.match(f.$('race-format-help').textContent, /перемагає той/);
  assert.equal(f.$('race-level').value, selected);
  assert.equal(f.$('race-theme').value, selectedTheme);
  assert.equal(f.doc.activeElement, start);
  assert.deepEqual(f.checkpoint(), before);
  setLocale('en', { persist: false });
  assert.equal(f.$('race-summary').textContent, summary);
  start.click();
  f.frame();
  f.$('race-pause').click();
  f.frame(0);
  assert.equal(f.state(), t('common:status.paused'));
  const checkpoint = f.checkpoint();
  f.$('race-options').click();
  const focused = f.doc.activeElement;
  for (const value of ['uk', 'en', 'uk']) {
    setLocale(value, { persist: false });
    f.frames(3, 0);
    assert.deepEqual(f.checkpoint(), checkpoint);
    assert.equal(f.state(), t('common:status.paused'));
    assert.equal(f.doc.activeElement, focused);
  }
});

test('controller edits the lobby and Settings language selectors without starting either board', async (context) => {
  const { attachLanguageControls } = await import('../i18n/index.mjs');
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const pad = {
    index: 0,
    id: 'Test pad',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ value: 0, pressed: false })),
  };
  const f = await couchPage(context, { pads: [pad] });
  attachLanguageControls(f.doc);
  const lobby = f.$('race-language-select');
  const settings = f.$('race-settings-language-select');
  assert.ok(f.$('race-main').contains(lobby));
  assert.ok(f.$('race-settings-panel-display').contains(settings));
  const checkpoint = f.checkpoint();
  f.join(0);
  f.focus(lobby.id);
  f.pulse(0, 0);
  assert.equal(lobby.getAttribute('data-controller-editing'), 'true');
  f.pulse(0, 13);
  f.pulse(0, 0);
  assert.equal(getLocale(), 'uk');
  assert.equal(f.doc.activeElement, lobby);
  assert.equal(lobby.value, 'uk');
  assert.equal(settings.value, 'uk');
  assert.deepEqual(f.checkpoint(), checkpoint);
  f.$('race-options').click();
  f.$('race-settings-tab-display').click();
  f.frame(0);
  f.focus(settings.id);
  f.pulse(0, 0);
  assert.equal(settings.getAttribute('data-controller-editing'), 'true');
  f.pulse(0, 12);
  f.pulse(0, 0);
  assert.equal(getLocale(), 'en');
  assert.equal(f.doc.activeElement, settings);
  assert.equal(lobby.value, 'en');
  assert.equal(settings.value, 'en');
  assert.deepEqual(f.checkpoint(), checkpoint);
});
