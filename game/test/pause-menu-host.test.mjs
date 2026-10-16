// Real solo host/navigation/state. DOM, layout and native dialog behavior are modeled browser
// boundaries; the browser QA pass covers the opaque presentation and focus ring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settle, soloPage } from './helpers/solo-dom.mjs';
import { openMissionLibrary } from './helpers/library-selection.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { waitFor } from './helpers/wait-for.mjs';

function frames(page, count) {
  for (let i = 0; i < count; i++) page.frame();
}

function pausePage(t) {
  return soloPage(t, { initialReadyTimeoutMs: 30000 });
}

test('Pause offers a confirmed mission restart that replaces the attempt from tick zero', async (t) => {
  const page = await pausePage(t);
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
  const page = await pausePage(t);
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

test('Pause owns the compact action set and each child restores its exact opener', async (t) => {
  const page = await pausePage(t);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('Escape');
  page.key('Escape', false);
  page.frame(0);

  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run);
  assert.equal(page.$('overlay-help'), null, 'How to play is not duplicated in Pause');
  assert.equal(page.$('shell-help').closest('[role="tabpanel"]')?.id, 'settings-panel-extras');
  assert.equal(page.doc.querySelector('.shell-bar #shell-fullscreen'), null);
  assert.deepEqual(
    [...page.$('overlay-restart').parentElement.children].map((item) => item.id),
    [
      'overlay-restart',
      'journey-skip',
      'overlay-random-level',
      'overlay-missions',
      'copy-level-link',
      'played-level-link',
      'level-link-status',
      'pause-mission-info',
    ],
    'mission controls and link feedback keep row-major document order',
  );
  assert.deepEqual(
    [...page.$('pause-sound-heading').parentElement.parentElement.children].map(
      (item) => item.className,
    ),
    ['pause-menu-section pause-sound-section', 'pause-menu-section pause-options-section'],
    'sound precedes config in the compact utility row',
  );
  assert.equal(page.$('pause-config-heading').textContent, 'Config');
  for (const id of [
    'start-button',
    'overlay-restart',
    'journey-skip',
    'overlay-random-level',
    'overlay-missions',
    'pause-mission-info-toggle',
    'overlay-sound',
    'overlay-next-song',
    'overlay-settings',
    'overlay-menu',
  ])
    assert.equal(page.$(id).hidden, false, `${id} belongs to Pause`);
  assert.equal(page.$('overlay-fullscreen').hidden, true, 'unsupported fullscreen stays hidden');
  assert.equal(
    page.$('game-overlay').querySelector('.quick-music-controls'),
    null,
    'Pause has no separate music Play/Pause transport',
  );
  assert.equal(page.doc.activeElement, page.$('start-button'));
  const initialSoundState = page.$('overlay-sound').getAttribute('aria-pressed');
  page.$('overlay-sound').click();
  assert.notEqual(page.$('overlay-sound').getAttribute('aria-pressed'), initialSoundState);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  for (const [opener, dialog] of [['overlay-settings', 'settings-dialog']]) {
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
  const page = await pausePage(t);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');

  for (const [shellAction, dialog, pauseAction] of [
    ['shell-settings', 'settings-dialog', 'overlay-settings'],
    ['help-button', 'help-dialog', 'start-button'],
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

test('Classic Skip resolves universally, cancels on Back or Resume, and adopts without awarding a clear', async (t) => {
  const page = await pausePage(t);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  frames(page, 12);
  page.key('ArrowDown', false);
  page.$('pause-button').click();

  const original = page.rendered.run,
    checkpoint = authoritativeCheckpoint(original);
  page.$('journey-skip').click();
  await waitFor(() => page.$('journey-skip').textContent === 'Confirm skip', {
    timeoutMs: 30000,
  });
  assert.equal(page.rendered.run, original);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.match(
    page.$('run-message').textContent,
    /No clear, picture, medal, mastery, reward or unlock/,
  );

  page.key('Escape');
  await settle(() => page.doc.body.dataset.flightState === 'running');
  assert.equal(page.rendered.run, original);
  assert.equal(page.$('journey-skip').textContent, 'Skip mission');

  page.$('pause-button').click();
  page.$('journey-skip').click();
  await waitFor(() => page.$('journey-skip').textContent === 'Confirm skip', {
    timeoutMs: 30000,
  });
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  assert.equal(page.rendered.run, original);
  assert.equal(page.$('journey-skip').textContent, 'Skip mission');

  page.$('pause-button').click();
  page.$('journey-skip').click();
  await waitFor(() => page.$('journey-skip').textContent === 'Confirm skip', {
    timeoutMs: 30000,
  });
  page.$('journey-skip').click();
  await waitFor(
    () => {
      page.frame(0);
      return (
        (page.doc.body.dataset.flightState === 'running' && page.rendered.run !== original) ||
        page.$('flight-preparation-status').dataset.state === 'error'
      );
    },
    { timeoutMs: 30000 },
  );
  assert.notEqual(
    page.$('flight-preparation-status').dataset.state,
    'error',
    page.$('flight-preparation-status').textContent,
  );
  const raw = page.storage.getItem('revealline.library.dev.v1'),
    saved = raw ? JSON.parse(raw) : null,
    clears = saved
      ? Object.values(saved.campaigns).flatMap((entry) => Object.keys(entry.clears))
      : [];
  assert.deepEqual(clears, []);
  assert.notEqual(page.rendered.run.levelId, original.levelId);
  assert.deepEqual(authoritativeCheckpoint(original), checkpoint);
  assert.deepEqual(page.errors, []);
});
