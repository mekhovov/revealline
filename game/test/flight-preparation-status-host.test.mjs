import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';

const sessionKey = 'revealline.suspended.dev.v1';
const readyMessage = 'Flight assets ready. Press Resume to continue.';
async function restart(t) {
  const h = await soloPage(t, { titleScreen: true });
  h.$('shell-featured').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  h.$('pause-button').click();
  const original = JSON.parse(h.storage.getItem(sessionKey));
  assert.equal(original.format, 'xonix-session.v5');
  h.frame(0);
  const picture = structuredClone(h.rendered.backdrop.pin);
  h.$('overlay-restart').click();
  assert.equal(h.$('restart-dialog').open, true);
  h.$('restart-confirm').click();
  return { h, original, picture };
}

test('confirmed Restart clears completed preparation status before real victory', async (t) => {
  const { h, original, picture } = await restart(t);
  await settle(() => h.doc.body.dataset.flightState === 'running');
  const resumedStatus = h.$('flight-preparation-status').textContent;
  h.frame(0);
  assert.equal(h.rendered.run.tick, 0);
  assert.deepEqual(h.rendered.backdrop.pin, picture);
  assert.equal(
    h.doc.documentElement.dataset.presentationManifest,
    original.visualThemePin.presentation.sha256,
  );
  h.key('ArrowDown');
  for (let i = 0; i < 460; i++) h.frame();
  h.key('ArrowDown', false);
  h.frame(0);
  assert.equal(h.rendered.run.status, 'won', 'The actual opening mission reaches victory');
  assert.equal(resumedStatus, '', 'Readiness instruction retires when Restart starts flying');
  assert.equal(h.$('flight-preparation-status').textContent, '', 'Results retain no stale Resume');
  assert.deepEqual(h.errors, []);
});

test('ready preparation remains paused without focus and clears only after explicit Resume', async (t) => {
  const { h, original } = await restart(t);
  h.frame(0);
  h.doc.focused = false;
  await settle(() => h.$('flight-preparation-status').textContent === readyMessage);
  assert.equal(h.rendered.paused, true);
  assert.equal(h.rendered.run.tick, 0);
  const before = authoritativeCheckpoint(h.rendered.run);
  h.doc.focused = true;
  h.frame(0);
  assert.equal(h.rendered.paused, true, 'Returning focus does not grant resume authority');
  assert.equal(h.$('flight-preparation-status').textContent, readyMessage);
  h.$('start-button').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  h.frame(0);
  assert.deepEqual(authoritativeCheckpoint(h.rendered.run), before);
  assert.equal(h.$('flight-preparation-status').textContent, '');
  h.$('pause-button').click();
  const retained = JSON.parse(h.storage.getItem(sessionKey));
  assert.deepEqual(retained.presentationPins, original.presentationPins);
  assert.deepEqual(retained.visualThemePin, original.visualThemePin);
  assert.equal(verifyReplay(retained.replay).match, true);
  assert.deepEqual(h.errors, []);
});
