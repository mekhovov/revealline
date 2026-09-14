// Real solo host/navigation/state. DOM, layout and native dialog behavior are modeled browser
// boundaries; the browser QA pass covers the opaque presentation and focus ring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settle, soloPage } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

function frames(page, count) {
  for (let i = 0; i < count; i++) page.frame();
}

test('Pause offers a confirmed mission restart that replaces the attempt from tick zero', async (t) => {
  const page = await soloPage(t);
  page.$('start-button').click();
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
  page.$('start-button').click();
  page.key('Escape');
  page.key('Escape', false);
  page.frame(0);
  assert.equal(page.$('overlay-restart').hidden, false);
  page.$('start-button').click();
  assert.equal(page.$('game-overlay').hidden, true);
  assert.equal(
    page.$('overlay-restart').hidden,
    false,
    'the hidden overlay retains its menu state',
  );
  assert.deepEqual(page.errors, []);
});
