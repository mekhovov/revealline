import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { TEAM_HUNT_ATTEMPT_KEY } from '../coop/hunt-attempts.mjs';
import { RUNNING_ENEMY_PREFERENCES_KEY } from '../hunt/running-enemy-preferences.mjs';

test('a saved Team hunt continues through Data settings using the existing verified restore', async (t) => {
  const storage = memoryStorage({
    [RUNNING_ENEMY_PREFERENCES_KEY]: JSON.stringify({
      format: 'RunningEnemyPreferencesV1',
      enabled: true,
    }),
  });
  const beforeImport = ({ install }) => install('localStorage', { value: storage });
  let saved;
  await t.test('save an actual paused hunt', async (t) => {
    const f = await page(t, { beforeImport, nativeFocus: true });
    f.$('coop-start').click();
    f.tick(24);
    f.$('coop-pause').click();
    saved = storage.getItem(TEAM_HUNT_ATTEMPT_KEY);
    assert.ok(saved, 'The production host records the current hunt on pause.');
  });
  await t.test('continue the saved attempt from the new Data location', async (t) => {
    const f = await page(t, { beforeImport, nativeFocus: true });
    const container = f.$('coop-hunt-save');
    assert.equal(container.parentNode.id, 'coop-settings-panel-data');
    f.$('coop-settings-open').click();
    f.$('coop-settings-tab-data').click();
    assert.equal(f.$('coop-options').open, true);
    const resume = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Continue saved Team hunt',
    );
    assert.ok(resume);
    assert.equal(
      resume.disabled,
      false,
      'Moving the control into Settings must not disable Continue.',
    );
    resume.focus();
    await resume.onclick();
    assert.equal(f.$('coop-options').open, false, container.textContent);
    assert.equal(f.$('coop-menu').hidden, true, container.textContent);
    assert.equal(f.$('coop-play').hidden, false);
    assert.equal(f.$('coop-pause').disabled, false);
    assert.ok(storage.getItem(TEAM_HUNT_ATTEMPT_KEY));
  });
});
