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
