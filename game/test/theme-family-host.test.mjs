import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { THEME_PREFERENCES_KEY } from '../presentation/theme-system.mjs';
import { getLocale, setLocale, t as translate } from '../i18n/index.mjs';

const pad = () => ({
  index: 0,
  id: 'Theme selection controller',
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
});

test('Versus controller applies gallery choices without starting or replacing Ready', async (t) => {
  const previousLocale = getLocale();
  t.after(() => setLocale(previousLocale, { persist: false }));
  const storage = memoryStorage();
  const page = await couchPage(t, { storage, pads: [pad()] });
  page.join(0);
  page.focus('race-options');
  page.pulse(0, 0);
  page.focus('race-settings-tab-display');
  page.pulse(0, 0);
  page.frame();
  const before = page.checkpoint();
  const beforeWrites = storage.writes.length;
  const artwork = page.doc.querySelector('[data-theme-preference="arcadeArt"]');
  const caption = page.doc.getElementById('race-theme-family-heading');
  const gallery = page.doc.querySelector('.theme-gallery');
  assert.equal(caption.tagName, 'H4');
  assert.equal(gallery.getAttribute('aria-labelledby'), caption.id);
  assert.equal(page.doc.querySelector('[data-theme-preference="familyId"]'), null);
  for (const locale of ['uk', 'en']) {
    const follow = page.doc.getElementById('race-theme-card-follow-game');
    follow.focus();
    setLocale(locale, { persist: false });
    assert.equal(caption.textContent, translate('interface:workshop.familyId'));
    assert.equal(
      gallery.getAttribute('aria-description'),
      translate('interface:workshop.previewThemes'),
    );
    assert.equal(page.doc.activeElement, follow);
    assert.equal(follow.getAttribute('aria-pressed'), 'true');
  }
  const industrial = page.doc.getElementById('race-theme-card-industrial-workshop');
  industrial.focus();
  page.pulse(0, 0);
  assert.equal(JSON.parse(storage.getItem(THEME_PREFERENCES_KEY)).familyId, 'industrial-workshop');
  assert.equal(page.doc.activeElement, industrial, 'Applying a card keeps its focus.');
  assert.equal(industrial.getAttribute('aria-pressed'), 'true');
  assert.equal(page.doc.getElementById('race-theme-apply'), null);
  assert.equal(artwork.value, 'follow-game');
  for (const key of ['highContrast', 'opaqueHud']) {
    const toggle = page.doc.querySelector(`[data-theme-preference="${key}"]`);
    toggle.focus();
    page.pulse(0, 0);
    assert.equal(toggle.checked, true);
  }
  const saved = JSON.parse(storage.getItem(THEME_PREFERENCES_KEY));
  assert.equal(saved.familyId, 'industrial-workshop');
  assert.equal(saved.arcadeArt, 'follow-game');
  assert.equal(saved.highContrast, true);
  assert.equal(saved.opaqueHud, true);
  for (const id of ['legacy', 'follow-game']) {
    const card = page.doc.getElementById(`race-theme-card-${id}`);
    card.focus();
    assert.equal(card.matches('button[data-theme-preview]'), true);
    assert.ok(card.closest('[data-theme-controls]'));
    page.button(0, 0, true);
    page.frame();
    assert.equal(page.doc.activeElement, card, 'Controller recognizes the theme card.');
    page.button(0, 0, false);
    page.frame();
    assert.equal(JSON.parse(storage.getItem(THEME_PREFERENCES_KEY)).familyId, id);
    assert.equal(page.doc.activeElement, card, 'Controller card activation retains focus.');
  }
  assert.equal(page.state(), 'ready');
  assert.deepEqual(page.checkpoint(), before);
  assert.ok(
    storage.writes
      .slice(beforeWrites)
      .every(([key]) => [THEME_PREFERENCES_KEY, 'revealline.fpv.appearance.v1'].includes(key)),
  );
});
