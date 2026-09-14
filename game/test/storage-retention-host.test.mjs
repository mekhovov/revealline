import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';

const campaign = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)));

test('actual Settings keyboard/controller retention and Back preserve the paused flight and offline action', async (t) => {
  const h = await soloPage(t, { campaign });
  let requests = 0,
    retained = false,
    answer;
  globalThis.navigator.storage = {
    persisted: async () => retained,
    persist() {
      requests++;
      return new Promise((resolve) => {
        answer = resolve;
      });
    },
    get estimate() {
      throw new Error('Never infer retention from quota.');
    },
  };
  h.$('start-button').click();
  const down = h.$('touch-surface');
  down.emit('pointerdown', {
    pointerId: 1,
    pointerType: 'touch',
    button: 0,
    clientX: 100,
    clientY: 100,
  });
  down.emit('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 130 });
  down.emit('pointerup', { pointerId: 1, button: 0 });
  for (let i = 0; i < 30; i++) h.frame();
  assert.equal(h.rendered.run.player.cutting, true);
  h.$('settings-button').focus();
  h.$('settings-button').click();
  h.frame(0);
  await settle(() => h.$('storage-retention-status').textContent.includes('not enabled'));
  const checkpoint = authoritativeCheckpoint(h.rendered.run);
  const saved = h.storage.getItem('revealline.suspended.dev.v1');
  const writes = h.storage.writes.length;
  const offline = h.$('offline-status').textContent;
  const details = h.$('offline-details').textContent;
  assert.equal(h.rendered.paused, true);
  assert.equal(requests, 0, 'Opening Settings never asks permission.');

  // Keyboard arrows use the normal Settings dialog scope. Native Tab/Enter
  // and physical controllers remain separate browser/device qualification.
  const summary = h.$('offline-details').parentElement.querySelector('summary');
  summary.focus();
  summary.emit('keydown', { key: 'ArrowUp', code: 'ArrowUp' });
  assert.equal(h.doc.activeElement, h.$('storage-retention-button'));
  assert.ok(
    h
      .$('storage-retention-button')
      .getAttribute('aria-describedby')
      .includes('storage-retention-status'),
  );

  const pad = {
    index: 0,
    id: 'Retention menu',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  globalThis.navigator.getGamepads = () => [pad];
  const pulse = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    h.frame();
    pad.buttons[index] = { pressed: false, value: 0 };
    h.frame();
  };
  h.frame();
  // A neutral sample connects automatically; Confirm is now a real menu action.
  assert.equal(requests, 0);
  pulse(13);
  pulse(12); // Move away and back through the actual menu adapter.
  assert.equal(h.doc.activeElement, h.$('storage-retention-button'));
  pulse(0);
  assert.equal(requests, 1);
  assert.equal(h.doc.activeElement, h.$('storage-retention-button'));
  pulse(0);
  assert.equal(requests, 1, 'A second activation joins the pending request.');
  pulse(1);
  assert.equal(h.$('settings-dialog').open, false, 'Controller Back remains available.');
  const closedText = h.$('storage-retention-status').textContent;
  answer(false);
  await new Promise(setImmediate);
  assert.equal(h.$('storage-retention-status').textContent, closedText);
  assert.equal(h.storage.getItem('revealline.suspended.dev.v1'), saved);
  assert.equal(h.storage.writes.length, writes);

  h.$('settings-button').click();
  h.frame(0);
  await settle(() => h.$('storage-retention-status').textContent.includes('not enabled'));
  // Reopening Settings performs the existing pause save, refreshing savedAt.
  // Keep exact bytes/write counts around the retention action itself.
  const reopenedSave = h.storage.getItem('revealline.suspended.dev.v1');
  const reopenedWrites = h.storage.writes.length;
  const originalSession = JSON.parse(saved);
  assert.deepEqual(
    { ...JSON.parse(reopenedSave), savedAt: originalSession.savedAt },
    originalSession,
  );
  h.$('storage-retention-button').focus();
  h.frame();
  pulse(0);
  assert.equal(requests, 2);
  retained = true;
  answer(true);
  await settle(() => h.$('storage-retention-status').textContent.includes('Retention granted'));
  assert.equal(h.doc.activeElement, h.$('storage-retention-button'));
  assert.equal(h.$('offline-status').textContent, offline);
  assert.equal(h.$('offline-details').textContent, details);
  assert.equal(h.storage.getItem('revealline.suspended.dev.v1'), reopenedSave);
  assert.equal(h.storage.writes.length, reopenedWrites);
  assert.deepEqual(authoritativeCheckpoint(h.rendered.run), checkpoint);
  assert.equal(h.rendered.paused, true);
  pulse(1);
  h.frame();
  assert.equal(h.rendered.paused, true, 'Leaving Settings never resumes flight.');
  assert.deepEqual(h.errors, []);
});
