import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const visible = (element) => !element.hidden && !element.closest('[hidden],[inert]');

test('Versus Pause exposes the shared player actions and retries with one deliberate action', async (t) => {
  const page = await couchPage(t, { nativeKeyboard: true });
  page.$('race-start').click();
  page.frame();
  page.$('race-pause').click();
  page.frame();

  assert.equal(page.doc.body.dataset.couchStatus, 'paused');
  assert.deepEqual(
    ['race-start', 'race-retry', 'race-chapters', 'race-help', 'race-options', 'race-home'].map(
      (id) => [id, visible(page.$(id)), page.$(id).textContent.trim()],
    ),
    [
      ['race-start', true, 'Resume race →'],
      ['race-retry', true, 'Retry race'],
      ['race-chapters', true, 'Missions'],
      ['race-help', true, 'How to play'],
      ['race-options', true, 'Settings'],
      ['race-home', true, 'Home'],
    ],
  );
  assert.equal(page.$('race-optional-setup').hidden, true);

  const paused = page.checkpoint(),
    pausedRuns = [...page.renders];
  page.$('race-retry').click();
  await waitFor(() => {
    page.frame();
    return page.state() === 'running';
  });
  assert.notEqual(page.renders[0], pausedRuns[0]);
  assert.notEqual(page.renders[1], pausedRuns[1]);
  assert.deepEqual(page.checkpoint(), paused, 'Retry retains the accepted deterministic setup.');
  page.$('race-pause').click();
  page.frame();
  const retried = page.checkpoint();

  page.$('race-home').click();
  assert.equal(page.$('race-leave-panel').hidden, false);
  assert.equal(page.$('race-leave-title').textContent, 'Return to Solo?');
  page.$('race-leave-back').click();
  assert.equal(page.doc.activeElement.id, 'race-home');
  assert.deepEqual(page.checkpoint(), retried);
});

test('Team Pause puts Help, Settings, Sound and Home in the direct shared hierarchy', async (t) => {
  const stored = new Map();
  const page = await teamPage(t, {
    nativeFocus: true,
    capturePaint: true,
    beforeImport({ install }) {
      install('localStorage', {
        value: {
          getItem: (key) => stored.get(key) ?? null,
          setItem: (key, value) => stored.set(key, String(value)),
          removeItem: (key) => stored.delete(key),
        },
      });
    },
  });
  assert.equal(page.$('coop-optional-setup').open, false, 'Quick-start setup stays collapsed.');
  assert.equal(page.doc.activeElement.id, 'coop-start', 'Quick Start retains initial focus.');
  page.$('coop-start').click();
  page.tick(3);
  page.$('coop-pause').click();

  const core = page.$('coop-pause-core');
  assert.equal(core.hidden, false);
  assert.deepEqual(
    core.children.map((element) => element.id),
    ['coop-help', 'coop-settings-open', 'coop-quick-sound', 'coop-home-paused'],
  );
  assert.equal(page.$('coop-quick-sound').parentNode, core);
  for (const id of [
    'coop-resume',
    'coop-retry',
    'coop-discovery-paused',
    'coop-settings-open',
    'coop-quick-sound',
  ])
    assert.equal(visible(page.$(id)), true, `${id} is visible from Pause.`);
  assert.equal(page.$('coop-help-toggle').textContent.trim(), 'How to play and controls');
  assert.equal(page.$('coop-home-paused').textContent, 'Home');

  const paused = page.$('coop-clock').textContent;
  page.$('coop-quick-sound').click();
  page.tick(120);
  assert.equal(page.$('coop-quick-sound').parentNode, core);
  assert.equal(page.$('coop-quick-sound').textContent, 'Sound: on');
  assert.equal(page.$('coop-quick-sound').getAttribute('aria-pressed'), 'true');
  assert.equal(page.$('coop-clock').textContent, paused, 'Sound changes cannot resume Team play.');

  page.$('coop-settings-open').click();
  assert.equal(page.$('coop-options').open, true);
  page.$('coop-settings-close').click();
  assert.equal(page.doc.activeElement.id, 'coop-settings-open');
  assert.equal(page.$('coop-clock').textContent, paused);

  page.$('coop-home-paused').click();
  assert.equal(page.$('coop-discard-dialog').open, true);
  assert.equal(page.$('coop-discard-confirm').textContent, 'Discard and leave');
  page.$('coop-discard-stay').click();
  assert.equal(page.doc.activeElement.id, 'coop-home-paused');
  assert.equal(page.$('coop-clock').textContent, paused);
});
