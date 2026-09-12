import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { releaseInputs } from '../core/index.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { loadLibrary } from '../library.mjs';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';

const campaign = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)));
const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';

// Actual app handlers and profile/session APIs run inside the shared Node browser
// boundary. No CSS layout, OS media preference or physical-device claim.
test('Settings and arena assists synchronize, persist across app reload, and release latched steering', async (t) => {
  const storage = memoryStorage();
  let dispose = null;
  const lifetime = {
    after(callback) {
      dispose = callback;
    },
  };
  t.after(async () => {
    await dispose?.();
  });
  const page = await soloPage(lifetime, { campaign, storage });
  const checks = (host, reduced, tap) => {
    for (const id of ['reduced-effects', 'settings-reduced-effects'])
      assert.equal(host.$(id).checked, reduced, id);
    for (const id of ['tap-steering', 'settings-tap-steering'])
      assert.equal(host.$(id).checked, tap, id);
  };
  const preferences = () => loadLibrary(storage, profileKey).library.preferences;
  const tick = (host, count) => {
    for (let i = 0; i < count; i++) host.frame();
  };
  checks(page, false, false);
  page.$('reduced-effects').click();
  page.$('tap-steering').click();
  checks(page, true, true);
  assert.equal(preferences().reducedEffects, true);
  assert.equal(preferences().tapSteering, true);
  page.$('start-button').click();
  const down = page.doc.querySelector('[data-move="down"]');
  down.emit('pointerdown', { pointerId: 1, button: 0 });
  down.emit('pointerup', { pointerId: 1, button: 0 });
  tick(page, 30);
  const run = page.rendered.run;
  assert.equal(run.player.cutting, true);
  assert.ok(run.player.speed > 0, 'A released direction tap still moves with Tap steering on.');
  assert.equal(page.rendered.reduced, true);
  const neutral = structuredClone(run);
  releaseInputs(neutral); // Detached public release oracle, never supplied to the host.
  const raw = storage.getItem(sessionKey);
  const writes = storage.writes.filter(([key]) => key === sessionKey).length;
  page.$('tap-steering').click();
  checks(page, true, false);
  page.frame(0);
  assert.strictEqual(page.rendered.run, run);
  assert.equal(page.rendered.paused, false);
  assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(neutral));
  const position = [run.player.x, run.player.y],
    tickBefore = run.tick;
  tick(page, 12);
  assert.equal(run.tick, tickBefore + 12, 'Changing Tap steering does not pause simulation.');
  assert.deepEqual([run.player.x, run.player.y], position, 'The old tap latch cannot move again.');
  assert.equal(storage.getItem(sessionKey), raw);
  assert.equal(storage.writes.filter(([key]) => key === sessionKey).length, writes);

  page.$('settings-button').click();
  page.frame(0);
  assert.equal(page.$('settings-dialog').open, true);
  assert.equal(page.rendered.paused, true, 'Opening Settings performs the ordinary pause first.');
  const pausedBytes = storage.getItem(sessionKey);
  const pausedCheckpoint = authoritativeCheckpoint(run);
  assert.equal(verifyReplay(JSON.parse(pausedBytes).replay).match, true);
  page.$('settings-tap-steering').click();
  page.$('settings-reduced-effects').click();
  checks(page, false, true);
  assert.equal(preferences().tapSteering, true);
  assert.equal(preferences().reducedEffects, false);
  page.frame(0);
  assert.equal(
    page.rendered.reduced,
    false,
    'The renderer reads the synchronized effective control.',
  );
  page.$('settings-reduced-effects').click();
  checks(page, true, true);
  assert.equal(preferences().reducedEffects, true);
  assert.deepEqual(authoritativeCheckpoint(run), pausedCheckpoint);
  assert.equal(
    storage.getItem(sessionKey),
    pausedBytes,
    'Settings edits do not resave the paused attempt.',
  );
  page.doc.querySelector('button[data-close="settings-dialog"]').click();
  assert.equal(page.$('settings-dialog').open, false);
  assert.deepEqual(page.errors, []);

  // A fresh actual app import observes the same stored preference bytes after
  // the old page releases its writer lease and database connection.
  const closeFirst = dispose;
  dispose = null;
  await closeFirst();
  // Existing pagehide may refresh savedAt; the replay and attempt identity stay
  // exact. This lifecycle save is separate from setting-only edits above.
  const afterPageHide = storage.getItem(sessionKey);
  assert.deepEqual(JSON.parse(afterPageHide).replay, JSON.parse(pausedBytes).replay);
  assert.equal(JSON.parse(afterPageHide).runId, JSON.parse(pausedBytes).runId);
  const reloaded = await soloPage(lifetime, { campaign, storage });
  checks(reloaded, true, true);
  assert.equal(reloaded.rendered.reduced, true);
  assert.equal(storage.getItem(sessionKey), afterPageHide);
  reloaded.$('settings-button').click();
  checks(reloaded, true, true);
  reloaded.$('settings-tap-steering').click();
  reloaded.$('settings-reduced-effects').click();
  checks(reloaded, false, false);
  assert.equal(preferences().tapSteering, false);
  assert.equal(preferences().reducedEffects, false);
  assert.deepEqual(reloaded.errors, []);
});
