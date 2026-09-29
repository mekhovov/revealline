import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { SOLO_RADIO_PROFILE_KEY } from '../ui/solo-radio-input.mjs';

test('actual Solo host captures a raw radio axis, saves separately, flies, and pauses on loss', async (t) => {
  const pad = {
    index: 0,
    id: 'TX15',
    connected: true,
    mapping: '',
    axes: [0, 0, -1, 0, 0, 0, 0, 0],
    buttons: Array.from({ length: 24 }, () => ({ value: 0, pressed: false })),
  };
  const page = await soloPage(t, {
    readPads: () => [pad],
    initialReadyTimeoutMs: 30000,
    browserSetup: ({ window, globals }) => {
      window.localStorage = globals.localStorage;
    },
  });
  page.frame();
  page.$('settings-button').click();
  page.$('settings-tab-controls').click();
  page.frame();
  const root = page.$('controller-settings-root');
  const control = (name) => root.querySelector(`[data-controller-action="${name}"]`);
  assert.ok(control('join1').parentNode.hidden);
  control('configure').click();
  const selects = root.querySelector('.multiplayer-controllers').querySelectorAll('select');
  selects[2].value = 'flight:right';
  selects[3].value = 'axis';
  control('released').click();
  pad.axes[0] = 1;
  page.frame();
  control('capture').click();
  root.querySelector('.multiplayer-controllers').querySelector('input[type="checkbox"]').checked =
    true;
  control('apply').click();
  assert.ok(page.storage.getItem(SOLO_RADIO_PROFILE_KEY));
  assert.equal(page.storage.getItem('revealline.couch-controller-profiles.v1'), null);
  pad.axes[0] = 0;
  page.frame();
  page.frame();
  page.$('settings-dialog').querySelector('button[aria-label="Close settings"]').click();
  page.$('start-button').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Solo starts after radio mapping',
  );
  page.frame();
  page.frame();
  const x = page.rendered.run.player.x;
  pad.axes[0] = 1;
  for (let i = 0; i < 20; i++) page.frame();
  assert.ok(page.rendered.run.player.x > x, 'raw radio drives Solo craft');
  pad.connected = false;
  page.frame();
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  assert.deepEqual(page.errors, []);
});
