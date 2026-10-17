import { activateHostAction } from './helpers/host-action.mjs';
import { nativeCaptureSession as nativeSession } from '../capture-presentation-session.mjs';
import { winCurrentOpening } from './helpers/solo-opening-win.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { ACTOR_SESSION_FORMAT } from '../sessions.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const sessionKey = 'revealline.suspended.dev.v1';
const readyMessage = 'Flight assets ready. Press Resume to continue.';
async function restart(t) {
  const h = await soloPage(t, { titleScreen: true, waitForPictures: false });
  await activateHostAction(h.$('shell-featured'));
  await settle(() => h.doc.body.dataset.flightState === 'running');
  assert.equal(h.doc.body.dataset.pictureState, 'ready');
  h.$('pause-button').click();
  const original = JSON.parse(h.storage.getItem(sessionKey));
  assert.equal(nativeSession(original).format, ACTOR_SESSION_FORMAT);
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
    nativeSession(original).visualThemePin.presentation.sha256,
  );
  winCurrentOpening(h);
  assert.equal(resumedStatus, '', 'Readiness instruction retires when Restart starts flying');
  assert.equal(h.$('flight-preparation-status').textContent, '', 'Results retain no stale Resume');
  assert.deepEqual(h.errors, []);
});

test('ready preparation remains paused without focus and clears only after explicit Resume', async (t) => {
  const { h, original } = await restart(t);
  h.frame(0);
  h.doc.focused = false;
  // Observe asset-only completion without delivering a new frame: a real
  // foreground-loss callback cancels this owner and is covered separately.
  await waitFor(() => h.$('flight-preparation-status').textContent === readyMessage, {
    timeoutMs: process.env.CI ? 20_000 : 5_000,
  });
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
  assert.deepEqual(
    nativeSession(retained).presentationPins,
    nativeSession(original).presentationPins,
  );
  assert.deepEqual(nativeSession(retained).visualThemePin, nativeSession(original).visualThemePin);
  assert.equal(verifyReplay(nativeSession(retained).replay).match, true);
  assert.deepEqual(h.errors, []);
});

test('cancelled asset preparation cannot publish readiness after its loader completes', async (t) => {
  let armed = false;
  let held = null;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  t.after(() => release());
  const h = await soloPage(t, {
    titleScreen: true,
    waitForPictures: false,
    fetchResponse: async (path, options) => {
      if (!armed || held || !options?.signal || !String(path).includes('/presentation/')) return;
      held = { path: String(path) };
      await gate;
      // Continue through the fixture's real byte reader and the loader's own
      // cancellation checks; no readiness or response state is synthesized.
    },
  });
  h.frame(0);
  const run = h.rendered.run;
  const actors = h.rendered.actorAppearance?.snapshot;
  const before = authoritativeCheckpoint(run);
  armed = true;
  const starting = activateHostAction(h.$('start-button'));
  await settle(() => held !== null, 'Start must enter its owned presentation loader');
  assert.match(h.$('flight-preparation-status').textContent, /Preparing/);
  h.$('flight-preparation-cancel').click();
  const cancelledMessage = h.$('flight-preparation-status').textContent;
  assert.match(cancelledMessage, /cancelled.*paused/i);
  h.doc.focused = false;
  h.win.emit('blur');
  release();
  await starting;
  h.frame(0);
  assert.equal(h.rendered.run === run, true, 'Late completion retains the current run');
  assert.equal(h.rendered.paused, true);
  assert.equal(
    h.rendered.actorAppearance?.snapshot === actors,
    true,
    'Cancelled stages are not adopted',
  );
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.ok(
    ['', cancelledMessage].includes(h.$('flight-preparation-status').textContent),
    'Lifecycle cleanup may clear cancellation feedback, but late assets cannot replace it',
  );
  assert.notEqual(h.$('flight-preparation-status').textContent, readyMessage);
  h.doc.focused = true;
  h.frame(0);
  assert.equal(h.rendered.paused, true, 'Focus does not revive a cancelled activation');
  await activateHostAction(h.$('shell-featured'));
  await settle(() => h.doc.body.dataset.flightState === 'running');
  h.frame(0);
  assert.equal(h.rendered.run.tick, 0, 'A fresh public title action starts without cancelled debt');
  assert.equal(h.$('flight-preparation-status').textContent, '');
  h.$('pause-button').click();
  assert.equal(
    verifyReplay(nativeSession(JSON.parse(h.storage.getItem(sessionKey))).replay).match,
    true,
  );
  assert.deepEqual(h.errors, []);
});
