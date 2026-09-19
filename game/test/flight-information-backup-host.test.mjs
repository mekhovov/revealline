import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { emptyLibrary, saveLibrary, updatePreferences, loadLibrary } from '../library.mjs';
import { BACKUP_FORMAT } from '../backup.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { readFlightInformation } from '../ui/flight-information-host.mjs';

const campaign = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)));
const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
const info = (page) => readFlightInformation(page.$('run-message'));
function ticks(page, count = 12) {
  for (let i = 0; i < count; i++) page.frame();
}
function closeLibrary(page) {
  page.doc.querySelector('button[data-close="library-dialog"]').click();
  assert.equal(page.$('library-dialog').open, false);
}
function showDetails(page) {
  page.$('overlay-field-details').focus();
  page.$('overlay-field-details').click();
  assert.equal(page.$('flight-details-dialog').open, true);
  assert.match(page.$('flight-details-content').textContent, /Controls after Resume/);
  page.$('flight-details-read').click();
  assert.equal(page.$('flight-details-read').getAttribute('aria-pressed'), 'true');
  assert.equal(page.$('flight-details-reading-done').disabled, false);
}
async function closeDetails(page) {
  page.$('flight-details-reading-done').click();
  page.$('flight-details-back').click();
  await Promise.resolve();
  assert.equal(page.$('flight-details-dialog').open, false);
  assert.equal(page.doc.activeElement, page.$('overlay-field-details'));
}
async function restoreFlight(page, original) {
  closeLibrary(page);
  page.$('continue-saved').click();
  await settle(() => !page.$('continue-saved').disabled);
  page.frame(0);
  assert.equal(info(page).snapshot.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), original.replay.checkpoint);
}
async function assertLifecycle(page) {
  const before = authoritativeCheckpoint(page.rendered.run),
    owner = info(page).owner;
  showDetails(page);
  assert.doesNotThrow(() => page.win.emit('pagehide', { persisted: true }));
  assert.equal(page.$('flight-details-dialog').open, false);
  assert.doesNotThrow(() => page.win.emit('pageshow', { persisted: true }));
  ticks(page);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  assert.deepEqual(info(page).owner, owner);
  assert.equal(info(page).snapshot.paused, true);
  showDetails(page);
  assert.doesNotThrow(() => page.win.emit('pagehide', { persisted: false }));
  assert.equal(page.$('flight-details-dialog').open, false);
  assert.equal(info(page), null, 'Final disposal releases the presentation source');
  page.$('overlay-field-details').click();
  assert.equal(page.$('flight-details-dialog').open, false, 'Disposed presenter cannot reopen');
  assert.deepEqual(page.errors, []);
}
for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: actual backup import and Undo preserve the Details owner through both page lifecycles`, async (t) => {
    const storage = memoryStorage();
    saveLibrary(storage, profileKey, updatePreferences(emptyLibrary(), { turnPolicy }));
    const page = await soloPage(t, { campaign, storage });
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    ticks(page);
    page.$('library-button').click();
    const original = JSON.parse(storage.getItem(sessionKey));
    assert.equal(verifyReplay(original.replay).match, true);
    const library = loadLibrary(storage, profileKey, { campaigns: [campaign] }).library;
    page.$('save-json').value = JSON.stringify({
      format: BACKUP_FORMAT,
      library: updatePreferences(library, { textSize: 'large' }),
      packs: emptyPackLibrary(),
      session: original,
    });
    await page.$('import-save').onclick();
    assert.match(page.$('save-status').textContent, /Game data restored/);
    assert.equal(page.$('undo-backup').disabled, false);
    assert.equal(page.doc.body.dataset.textSize, 'large');
    assert.deepEqual(JSON.parse(storage.getItem(sessionKey)), original);
    await restoreFlight(page, original);
    showDetails(page);
    await closeDetails(page);
    page.$('library-button').click();
    await page.$('undo-backup').onclick();
    assert.match(
      page.$('save-status').textContent,
      /Previous collection, packs and saved flight restored/,
    );
    assert.equal(page.doc.body.dataset.textSize, 'standard');
    const undone = JSON.parse(storage.getItem(sessionKey));
    assert.deepEqual(undone.replay, original.replay);
    assert.deepEqual(undone.continuation, original.continuation);
    assert.equal(verifyReplay(undone.replay).match, true);
    await restoreFlight(page, original);
    await assertLifecycle(page);
  });
}

test('a real backup commit failure keeps Details and both page lifecycles usable', async (t) => {
  const storage = memoryStorage(),
    setItem = storage.setItem.bind(storage);
  const page = await soloPage(t, { campaign, storage });
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.$('library-button').click();
  const original = JSON.parse(storage.getItem(sessionKey));
  const rawProfile = storage.getItem(profileKey);
  const library = loadLibrary(storage, profileKey, { campaigns: [campaign] }).library;
  let rejected = 0;
  storage.setItem = (key, value) => {
    if (key === `${profileKey}.backup-lock`) {
      rejected++;
      throw new DOMException('Test backup marker capacity failure', 'QuotaExceededError');
    }
    setItem(key, value);
  };
  page.$('save-json').value = JSON.stringify({
    format: BACKUP_FORMAT,
    library: updatePreferences(library, { textSize: 'large' }),
    packs: emptyPackLibrary(),
    session: original,
  });
  await page.$('import-save').onclick();
  assert.equal(rejected, 1, 'The real commit reached storage, not just JSON validation');
  assert.match(page.$('save-status').textContent, /Test backup marker capacity failure/);
  assert.equal(storage.getItem(profileKey), rawProfile);
  const retained = JSON.parse(storage.getItem(sessionKey));
  // The existing import pause boundary refreshes savedAt before commit.
  // Verify every other stored field and replay, rather than treating that timestamp as damage.
  assert.deepEqual({ ...retained, savedAt: original.savedAt }, original);
  assert.equal(verifyReplay(retained.replay).match, true);
  assert.equal(page.$('import-save').disabled, false);
  storage.setItem = setItem;
  closeLibrary(page);
  await assertLifecycle(page);
});
