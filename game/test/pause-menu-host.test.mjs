// Real solo host/navigation/state. DOM, layout and native dialog behavior are modeled browser
// boundaries; the browser QA pass covers the opaque presentation and focus ring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settle, soloPage } from './helpers/solo-dom.mjs';
import { openMissionLibrary } from './helpers/library-selection.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

function frames(page, count) {
  for (let i = 0; i < count; i++) page.frame();
}

test('Pause offers a confirmed mission restart that replaces the attempt from tick zero', async (t) => {
  const page = await soloPage(t);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  frames(page, 24);
  page.key('ArrowDown', false);
  page.key('Escape');
  page.key('Escape', false);
  page.frame(0);

  const pausedRun = page.rendered.run;
  const pausedCheckpoint = authoritativeCheckpoint(pausedRun);
  assert.equal(page.$('game-overlay').dataset.kind, 'pause');
  assert.equal(page.$('overlay-restart').hidden, false);
  assert.equal(page.doc.activeElement, page.$('start-button'), 'Resume remains the default action');

  page.$('overlay-restart').click();
  assert.equal(page.$('restart-dialog').open, true);
  assert.equal(
    page.doc.activeElement,
    page.$('restart-cancel'),
    'the confirmation starts on its safe action',
  );
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), pausedCheckpoint);

  page.$('restart-cancel').click();
  assert.equal(page.$('restart-dialog').open, false);
  assert.equal(
    page.doc.activeElement,
    page.$('overlay-restart'),
    'cancelling returns focus to the pause-menu command',
  );
  assert.equal(page.rendered.run, pausedRun);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), pausedCheckpoint);

  page.$('overlay-restart').click();
  page.$('restart-confirm').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'The fresh attempt resumes after its picture is ready.',
  );
  page.frame(0);
  assert.equal(page.$('restart-dialog').open, false);
  assert.notEqual(page.rendered.run, pausedRun);
  assert.equal(page.rendered.paused, false);
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(page.errors, []);
});

test('Restart is limited to Pause and does not leak into briefings or result menus', async (t) => {
  const page = await soloPage(t);
  assert.equal(page.$('game-overlay').dataset.kind, 'ready');
  assert.equal(page.$('overlay-restart').hidden, true);
  assert.equal(page.$('pause-mission-info').hidden, false);
  assert.equal(page.$('pause-mission-info').open, true, 'ready brief remains directly available');
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('Escape');
  page.key('Escape', false);
  page.frame(0);
  assert.equal(page.$('overlay-restart').hidden, false);
  assert.equal(page.$('pause-mission-info').hidden, false);
  assert.equal(page.$('pause-mission-info').open, false, 'Pause details start collapsed');
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  assert.equal(page.$('game-overlay').hidden, true);
  assert.equal(
    page.$('overlay-restart').hidden,
    false,
    'the hidden overlay retains its menu state',
  );
  assert.deepEqual(page.errors, []);
});

test('Pause owns Sound, Missions, Help and Settings and each child restores its exact opener', async (t) => {
  const page = await soloPage(t);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('Escape');
  page.key('Escape', false);
  page.frame(0);

  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run);
  const initialSoundState = page.$('overlay-sound').getAttribute('aria-pressed');
  page.$('overlay-sound').click();
  assert.notEqual(page.$('overlay-sound').getAttribute('aria-pressed'), initialSoundState);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  for (const [opener, dialog] of [
    ['overlay-help', 'help-dialog'],
    ['overlay-settings', 'settings-dialog'],
  ]) {
    page.$(opener).focus();
    page.$(opener).click();
    assert.equal(page.$(dialog).open, true);
    page.$(dialog).querySelector('[data-close]').click();
    await Promise.resolve();
    assert.equal(page.$(dialog).open, false);
    assert.equal(page.doc.activeElement, page.$(opener));
    assert.equal(page.rendered.paused, true);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  }

  await openMissionLibrary(page, 'overlay-missions');
  page.$('journey-back').click();
  await Promise.resolve();
  assert.equal(page.doc.activeElement, page.$('overlay-missions'));
  assert.equal(page.rendered.paused, true);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('Solo shell tools opened during flight return focus inside the Pause menu', async (t) => {
  const page = await soloPage(t);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');

  for (const [shellAction, dialog, pauseAction] of [
    ['shell-settings', 'settings-dialog', 'overlay-settings'],
    ['help-button', 'help-dialog', 'overlay-help'],
  ]) {
    const run = page.rendered.run,
      checkpoint = authoritativeCheckpoint(run);
    page.$(shellAction).focus();
    page.$(shellAction).click();
    assert.equal(page.$(dialog).open, true);
    assert.equal(page.rendered.paused, true);
    assert.equal(page.$('game-overlay').dataset.kind, 'pause');
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);

    page.$(dialog).querySelector('[data-close]').click();
    await Promise.resolve();
    assert.equal(page.$(dialog).open, false);
    assert.equal(
      page.doc.activeElement,
      page.$(pauseAction),
      'the newly installed Pause menu owns the return focus',
    );
    assert.equal(page.rendered.paused, true);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);

    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
  }
  assert.deepEqual(page.errors, []);
});
