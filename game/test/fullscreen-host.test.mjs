import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';

test('screen help pauses the actual flight, retains score and saved replay, and requires explicit Resume', async (t) => {
  const page = await soloPage(t);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running', 'Flight starts');
  page.frame();
  const before = authoritativeCheckpoint(page.rendered.run);
  // Restoring a saved flight can open Pause before the next HUD paint.
  page.$('time').textContent = 'stale clock';
  page.$('score').textContent = 'stale score';
  page.$('shell-fullscreen').click();
  assert.equal(page.$('fullscreen-dialog').open, true);
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  assert.equal(page.$('pause-summary').hidden, false);
  assert.match(page.$('pause-stats').textContent, /Revealed .*Time .*Score/);
  assert.doesNotMatch(page.$('pause-stats').textContent, /stale/);
  assert.ok(
    page
      .$('pause-stats')
      .textContent.endsWith(`Score ${String(page.rendered.run.score).padStart(5, '0')}`),
  );
  assert.equal(page.$('pause-status').textContent, page.$('run-message').textContent);
  page.doc.querySelector('[data-close="fullscreen-dialog"]').click();
  page.frame();
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  const saved = JSON.parse(page.storage.getItem('revealline.suspended.dev.v1'));
  assert.equal(verifyReplay(saved.replay).match, true);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running', 'Explicit Resume');
  assert.deepEqual(page.errors, []);
});

test('controller Back closes screen help without closing Settings or resuming the flight', async (t) => {
  const pad = {
    index: 0,
    id: 'Standard controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const page = await soloPage(t, { readPads: () => [pad] });
  const press = (index) => {
    pad.buttons.forEach((b) => {
      b.pressed = false;
    });
    page.frame();
    page.frame();
    pad.buttons[index].pressed = true;
    page.frame();
  };
  press(0);
  page.$('settings-button').click();
  page.$('settings-fullscreen').click();
  page.$('fullscreen-dialog').querySelector('button').focus();
  assert.equal(page.$('fullscreen-dialog').open, true);
  press(1);
  assert.equal(page.$('fullscreen-dialog').open, false);
  assert.equal(page.$('settings-dialog').open, true);
  assert.notEqual(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(page.errors, []);
});
