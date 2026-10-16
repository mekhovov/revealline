import test from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTER_DISPLAY_PREFERENCES_KEY as key } from '../encounter-display-preferences.mjs';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const encode = (showRemains) =>
  JSON.stringify({ format: 'EncounterDisplayPreferencesV1', showRemains });

test('ordinary Solo uses the global remains choice, ignores preview override and changes no paused state', async (t) => {
  const storage = memoryStorage({ [key]: encode(false) });
  const p = await soloPage(t, { storage, search: '?journey=legacy&preview-remains=show' });
  assert.equal(p.rendered.showCombatScrap, false);
  const before = authoritativeCheckpoint(p.rendered.run);
  p.$('enemy-remains').checked = true;
  p.$('enemy-remains').emit('change');
  p.frame(0);
  assert.equal(p.rendered.showCombatScrap, true);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  assert.equal(storage.getItem(key), encode(true));
  assert.deepEqual(p.errors, []);
});

test('Versus reads and changes global remains for both boards without starting either player', async (t) => {
  const storage = memoryStorage({ [key]: encode(false) });
  const p = await couchPage(t, { storage });
  assert.deepEqual(
    p.drawOptions.map((entry) => entry.showCombatScrap),
    [false, false],
  );
  const before = p.checkpoint();
  p.$('race-options').click();
  p.$('race-enemy-remains').focus();
  p.$('race-enemy-remains').checked = true;
  p.$('race-enemy-remains').emit('change');
  p.frame(0);
  assert.equal(p.doc.activeElement.id, 'race-enemy-remains');
  assert.deepEqual(
    p.drawOptions.map((entry) => entry.showCombatScrap),
    [true, true],
  );
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(storage.getItem(key), encode(true));
  p.$('race-options-back').click();
  assert.equal(p.doc.activeElement.id, 'race-options');
});

test('Team shares the preference without creating combat mechanics, starting or writing Solo data', async (t) => {
  const storage = memoryStorage({ [key]: encode(false), 'unrelated-player-data': 'preserved' });
  const p = await teamPage(t, {
    nativeFocus: true,
    nativeVisibility: true,
    beforeImport({ install }) {
      install('localStorage', { value: storage });
    },
  });
  const before = storage.writes.length;
  assert.equal(p.$('coop-enemy-remains').checked, false);
  p.$('coop-settings-open').focus();
  p.tap('Enter');
  p.$('coop-enemy-remains').focus();
  p.$('coop-enemy-remains').checked = true;
  p.$('coop-enemy-remains').emit('change');
  assert.equal(p.doc.activeElement.id, 'coop-enemy-remains');
  assert.equal(storage.getItem(key), encode(true));
  assert.equal(storage.getItem('unrelated-player-data'), 'preserved');
  assert.equal(storage.writes.length, before + 1);
  assert.equal(p.$('coop-options').open, true);
  p.$('coop-settings-close').click();
  assert.equal(p.doc.activeElement.id, 'coop-settings-open');
});
