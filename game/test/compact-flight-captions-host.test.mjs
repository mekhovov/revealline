import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

test('actual Solo host separates a manual-action flight from warning-card space through Pause and Resume', async (t) => {
  const page = await soloPage(t);
  assert.equal(page.doc.body.dataset.arenaChrome, 'full');
  assert.equal(page.doc.body.dataset.fieldCaptions, 'notices');
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  assert.equal(
    page.$('action-button').hidden,
    false,
    'The authored manual action remains available',
  );
  const before = authoritativeCheckpoint(page.rendered.run);
  page.key('Escape');
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  assert.equal(page.doc.body.dataset.fieldCaptions, 'notices');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  page.key('Escape', false);
  page.$('start-button').click();
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.equal(page.doc.body.dataset.fieldCaptions, 'notices');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  assert.deepEqual(page.errors, []);
});
