import test from 'node:test';
import assert from 'node:assert/strict';
import { attachLanguageControls, getLocale, setLocale } from '../i18n/index.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { TEAM_HUNT_ATTEMPT_KEY } from '../coop/hunt-attempts.mjs';
import { RUNNING_ENEMY_PREFERENCES_KEY } from '../hunt/running-enemy-preferences.mjs';

// Native game/menu owners with modeled DOM/input. These fixtures expose no
// playable media; real music queue/transport preservation has separate owner tests.
function ukrainian(t) {
  const previous = getLocale();
  setLocale('uk', { persist: false });
  t.after(() => setLocale(previous, { persist: false }));
}
function changeDisplayLanguage(p, prefix, language) {
  p.$(`${prefix}-settings-tab-display`).click();
  const panel = p.$(`${prefix}-settings-panel-display`),
    field = panel.querySelector('select[data-language-select]');
  assert.ok(field, 'The actual Display language control must be available.');
  field.focus();
  field.value = language;
  field.emit('change');
  assert.equal(getLocale(), language);
  assert.equal(
    p.doc.activeElement === field,
    true,
    `Keep language focus (#${p.doc.activeElement?.id ?? 'none'}).`,
  );
}

test('Versus first Pause after native Display language changes uses current music copy without changing either board', async (t) => {
  ukrainian(t);
  const p = await couchPage(t, {
    // The cached i18n module precedes this fixture's document. Mount the same
    // public boot owner that real DOMContentLoaded installs before interaction.
    beforeImport: ({ document }) => attachLanguageControls(document),
  });
  assert.equal(p.$('race-pause-next-song'), null, 'Before first Pause the shortcut is detached.');
  p.$('race-options').focus();
  p.$('race-options').click();
  changeDisplayLanguage(p, 'race', 'en');
  p.$('race-options-back').click();
  p.$('race-start').click();
  p.frame();
  p.key('ArrowDown');
  p.frames(12);
  p.key('ArrowDown', false);
  p.$('race-pause').click();
  p.frame(0);
  assert.equal(p.state(), 'paused');
  assert.ok(p.tick() > 0, 'Both real boards advanced before pausing.');
  const checkpoint = p.checkpoint(),
    shortcut = p.$('race-pause-next-song');
  assert.ok(shortcut);
  assert.equal(shortcut.textContent, 'Next song');
  assert.equal(shortcut.hidden, true, 'An unavailable native music transport stays hidden.');
  assert.equal(shortcut.disabled, true);
  const sound = p.$('race-quick-sound').getAttribute('aria-pressed');
  for (const [language, label] of [
    ['uk', 'Наступна композиція'],
    ['en', 'Next song'],
  ]) {
    p.$('race-options').focus();
    p.$('race-options').click();
    changeDisplayLanguage(p, 'race', language);
    p.$('race-options-back').click();
    p.frames(3, 0);
    assert.equal(p.$('race-pause-next-song') === shortcut, true);
    assert.equal(shortcut.textContent, label);
    assert.equal(
      p.doc.activeElement === p.$('race-options'),
      true,
      `Back keeps Settings focus (#${p.doc.activeElement?.id ?? 'none'}).`,
    );
    assert.equal(p.$('race-quick-sound').getAttribute('aria-pressed'), sound);
    assert.deepEqual(p.checkpoint(), checkpoint);
  }
});

test('Team first Pause after native Display language changes retains its actual paused hunt and checkpoint', async (t) => {
  ukrainian(t);
  const storage = memoryStorage({
    [RUNNING_ENEMY_PREFERENCES_KEY]: JSON.stringify({
      format: 'RunningEnemyPreferencesV1',
      enabled: true,
    }),
  });
  const p = await teamPage(t, {
    nativeFocus: true,
    nativeVisibility: true,
    beforeImport: ({ install }) => install('localStorage', { value: storage }),
  });
  assert.equal(p.$('coop-pause-next-song'), null);
  p.$('coop-settings-open').focus();
  p.$('coop-settings-open').click();
  changeDisplayLanguage(p, 'coop', 'en');
  p.$('coop-settings-close').click();
  p.$('coop-start').click();
  assert.equal(p.$('coop-menu').hidden, true);
  p.tick(240);
  p.$('coop-pause').click();
  const checkpoint = storage.getItem(TEAM_HUNT_ATTEMPT_KEY),
    clock = p.$('coop-clock').textContent,
    shortcut = p.$('coop-pause-next-song');
  assert.ok(checkpoint, 'An actual paused hunt retains a recoverable checkpoint.');
  assert.notEqual(clock, '0:00');
  assert.ok(shortcut);
  assert.equal(shortcut.textContent, 'Next song');
  assert.equal(shortcut.hidden, true);
  assert.equal(shortcut.disabled, true);
  const sound = p.$('coop-quick-sound').getAttribute('aria-pressed');
  for (const [language, label] of [
    ['uk', 'Наступна композиція'],
    ['en', 'Next song'],
  ]) {
    p.$('coop-settings-open').focus();
    p.$('coop-settings-open').click();
    changeDisplayLanguage(p, 'coop', language);
    p.$('coop-settings-close').click();
    p.tick(3);
    assert.equal(p.$('coop-pause-next-song') === shortcut, true);
    assert.equal(shortcut.textContent, label);
    assert.equal(
      p.doc.activeElement === p.$('coop-settings-open'),
      true,
      `Back keeps Team Settings focus (#${p.doc.activeElement?.id ?? 'none'}).`,
    );
    assert.equal(p.$('coop-quick-sound').getAttribute('aria-pressed'), sound);
    assert.equal(p.$('coop-clock').textContent, clock);
    assert.equal(storage.getItem(TEAM_HUNT_ATTEMPT_KEY), checkpoint);
  }
});
