import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const cueFrame = (page, ms) => page.frame(ms, { preserveStartCue: true });

test('Versus starts over prepared boards without advancing either simulation before Go', async (t) => {
  const page = await couchPage(t);
  assert.equal(page.$('race-start-cue').hidden, true);
  page.$('race-start').click();
  await waitFor(() => !page.$('race-start-cue').hidden);

  assert.equal(page.$('race-start-cue-label').textContent, '3');
  assert.equal(page.tick(), 0);
  cueFrame(page, 0);
  cueFrame(page, 699);
  assert.equal(page.$('race-start-cue-label').textContent, '3');
  assert.equal(page.tick(), 0);
  cueFrame(page, 1);
  assert.equal(page.$('race-start-cue-label').textContent, '2');
  cueFrame(page, 700);
  assert.equal(page.$('race-start-cue-label').textContent, '1');
  const beforeX = page.renders[0].player.x;
  page.key('KeyD');
  cueFrame(page, 700);
  assert.equal(page.$('race-start-cue-label').textContent, 'GO');
  assert.equal(page.tick(), 0, 'Go is the first frame that may release play, not elapsed play');
  cueFrame(page, 1000 / 120);
  assert.equal(page.tick(), 1);
  assert.equal(
    page.renders[0].player.x,
    beforeX,
    'Direction held before Go is cleared with the launch gesture.',
  );
  page.key('KeyD', false);
  page.key('KeyD');
  cueFrame(page, 1000 / 120);
  assert.ok(
    page.renders[0].player.x > beforeX,
    'A fresh direction after Go remains immediate gameplay input.',
  );
  page.key('KeyD', false);
});

test('Versus Retry uses the short cue and held launch input cannot advance the replacement', async (t) => {
  const page = await couchPage(t);
  page.$('race-start').click();
  await waitFor(() => !page.$('race-start-cue').hidden);
  page.frame();
  assert.ok(page.tick() > 0);

  page.$('race-pause').click();
  page.frame(0);
  assert.equal(page.state(), 'paused');
  page.$('race-retry').click();
  await waitFor(() => !page.$('race-start-cue').hidden);
  assert.equal(page.$('race-start-cue').dataset.kind, 'retry');
  assert.equal(page.$('race-start-cue-label').textContent, 'READY');
  cueFrame(page, 0);
  assert.equal(page.tick(), 0);

  // A second activation while the cue owns the boards cannot create or advance a race.
  page.$('race-retry').click();
  cueFrame(page, 599);
  assert.equal(page.$('race-start-cue-label').textContent, 'READY');
  assert.equal(page.tick(), 0);
  cueFrame(page, 1);
  assert.equal(page.$('race-start-cue-label').textContent, 'GO');
  assert.equal(page.tick(), 0);
});

test('a backgrounded mission cue stays with its exact attempt and cannot leak into Retry', async (t) => {
  const page = await couchPage(t);
  page.$('race-start').click();
  await waitFor(() => !page.$('race-start-cue').hidden);
  assert.equal(page.$('race-start-cue').dataset.kind, 'mission');
  cueFrame(page, 0);
  assert.equal(page.tick(), 0);
  cueFrame(page, 700);
  assert.equal(page.$('race-start-cue-label').textContent, '2');

  page.doc.focused = false;
  page.win.emit('blur');
  page.doc.body.focus();
  page.doc.focused = true;
  page.frame(0);
  assert.equal(page.state(), 'paused');
  page.$('race-start').click();
  await waitFor(() => !page.$('race-start-cue').hidden);
  assert.equal(page.$('race-start-cue').dataset.kind, 'mission');
  assert.equal(page.$('race-start-cue-label').textContent, '3');
  assert.equal(page.tick(), 0);

  page.$('race-pause').click();
  page.frame(0);
  assert.equal(page.state(), 'paused');
  page.$('race-retry').click();
  await waitFor(() => !page.$('race-start-cue').hidden);
  assert.equal(page.$('race-start-cue').dataset.kind, 'retry');
  assert.equal(page.$('race-start-cue-label').textContent, 'READY');
  assert.equal(page.tick(), 0);
});
