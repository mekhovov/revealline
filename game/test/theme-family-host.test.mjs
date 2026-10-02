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

test('Versus controller commits and cancels family controls without starting or replacing Ready', async (t) => {
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
  const family = page.doc.querySelector('[data-theme-preference="familyId"]');
  const artwork = page.doc.querySelector('[data-theme-preference="arcadeArt"]');
  assert.ok(family?.id, 'Dynamic native controls have stable host-prefixed identities.');
  const caption = page.doc.getElementById(family.getAttribute('aria-labelledby'));
  assert.equal(caption.tagName, 'SPAN');
  for (const locale of ['uk', 'en']) {
    family.focus();
    setLocale(locale, { persist: false });
    assert.equal(caption.textContent, translate('interface:workshop.familyId'));
    assert.equal(
      page.doc.querySelector('.theme-gallery').getAttribute('aria-label'),
      translate('interface:workshop.previewThemes'),
    );
    assert.equal(page.doc.activeElement, family);
    assert.equal(family.value, 'follow-game');
  }
  assert.equal(family.closest('[hidden],[inert]')?.id ?? null, null);
  family.focus();
  page.pulse(0, 0);
  assert.equal(page.editors().length, 1, 'Controller opens the actual family select editor.');
  page.pulse(0, 13);
  page.pulse(0, 1);
  assert.equal(page.editors().length, 0);
  assert.equal(family.value, 'follow-game');
  assert.equal(
    storage.getItem(THEME_PREFERENCES_KEY),
    null,
    'Cancelling never writes preferences.',
  );
  family.focus();
  page.pulse(0, 0);
  page.pulse(0, 13); // Existing appearance
  page.pulse(0, 13); // Industrial Workshop
  page.pulse(0, 0);
  assert.equal(family.value, 'industrial-workshop');
  assert.equal(storage.getItem(THEME_PREFERENCES_KEY), null, 'Previewing is read-only.');
  page.focus('race-theme-apply');
  page.pulse(0, 0);
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
  family.focus();
  const nativeArrow = family.emit('keydown', {
    key: 'ArrowDown',
    code: 'ArrowDown',
    repeat: false,
  });
  assert.equal(
    nativeArrow.defaultPrevented,
    false,
    'Keyboard arrows remain owned by the native select.',
  );
  assert.equal(page.doc.activeElement.id, family.id);
  family.emit('keyup', { key: 'ArrowDown', code: 'ArrowDown' });
  assert.equal(page.state(), 'ready');
  assert.deepEqual(page.checkpoint(), before);
  assert.ok(
    storage.writes
      .slice(beforeWrites)
      .every(([key]) => [THEME_PREFERENCES_KEY, 'revealline.fpv.appearance.v1'].includes(key)),
  );
});
