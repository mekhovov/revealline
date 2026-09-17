import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { emptyLibrary, updatePreferences, saveLibrary, loadLibrary } from '../library.mjs';
import { BACKUP_FORMAT } from '../backup.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';

const campaign = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)));
const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
const profile = (storage) => loadLibrary(storage, profileKey, { campaigns: [campaign] });
const slotWrites = (storage) => storage.writes.filter(([key]) => key === sessionKey).length;
function initialStorage(patch = {}) {
  const storage = memoryStorage();
  assert.equal(saveLibrary(storage, profileKey, updatePreferences(emptyLibrary(), patch)).ok, true);
  return storage;
}
function size(page, expected) {
  assert.equal(page.$('text-size').value, expected, 'Settings reflects the adopted preference');
  assert.equal(page.doc.body.dataset.textSize, expected, 'Presentation receives that same value');
}
function ticks(page, count) {
  for (let i = 0; i < count; i++) page.frame();
}
function startCut(page) {
  page.$('start-button').click();
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  ticks(page, 13);
  assert.equal(page.rendered.paused, false);
  assert.equal(page.rendered.run.player.cutting, true);
  return page.rendered.run;
}
function openSettings(page) {
  page.$('settings-button').click();
  page.frame(0);
  assert.equal(page.$('settings-dialog').open, true);
  assert.equal(page.rendered.paused, true);
}
function closeSettings(page) {
  page.doc.querySelector('button[data-close="settings-dialog"]').click();
  assert.equal(page.$('settings-dialog').open, false);
}
function snapshot(page) {
  return {
    run: page.rendered.run,
    checkpoint: authoritativeCheckpoint(page.rendered.run),
    slot: page.storage.getItem(sessionKey),
    writes: slotWrites(page.storage),
    selection: ['pack-select', 'campaign-select', 'level-select', 'difficulty-select'].map(
      (id) => page.$(id).value,
    ),
  };
}
function assertPausedUnchanged(page, before) {
  // Execute the actual host render, so this never passes using only a stale
  // BoardPainter observer reference after the host replaced its private run.
  page.frame(0);
  assert.strictEqual(page.rendered.run, before.run);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before.checkpoint);
  assert.equal(page.storage.getItem(sessionKey), before.slot);
  assert.equal(slotWrites(page.storage), before.writes);
  assert.deepEqual(snapshot(page).selection, before.selection);
}

// Actual app, native control handlers, core, recorder and persistence functions.
// DOM, Phaser drawing and browser storage are modeled; no layout/pixel claim.
test('startup adopts persisted Large and a deliberate Standard change survives an actual app reload', async (t) => {
  const storage = initialStorage({ textSize: 'large' });
  let dispose;
  const lifetime = { after: (callback) => (dispose = callback) };
  t.after(async () => dispose?.());
  const before = new Map(storage.map),
    writes = storage.writes.length;
  const page = await soloPage(lifetime, { campaign, storage });
  size(page, 'large');
  assert.deepEqual(storage.map, before, 'Startup reads the persisted value without rewriting it');
  assert.equal(storage.writes.length, writes);
  openSettings(page);
  const ready = snapshot(page);
  page.change('text-size', 'standard');
  size(page, 'standard');
  assert.equal(profile(storage).library.preferences.textSize, 'standard');
  assertPausedUnchanged(page, ready);
  assert.deepEqual(page.errors, []);
  const close = dispose;
  dispose = null;
  await close();
  const afterClose = new Map(storage.map),
    afterWrites = storage.writes.length;
  const reloaded = await soloPage(lifetime, { campaign, storage });
  size(reloaded, 'standard');
  assert.deepEqual(storage.map, afterClose);
  assert.equal(storage.writes.length, afterWrites);
  assert.deepEqual(reloaded.errors, []);
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: changing text size in Settings preserves the paused live cut and its recorded continuation`, async (t) => {
    const page = await soloPage(t, { campaign, storage: initialStorage({ turnPolicy }) });
    const run = startCut(page),
      liveCheckpoint = authoritativeCheckpoint(run);
    openSettings(page);
    // Opening Settings is the existing pause/save boundary. Size-only changes
    // begin after it and must not perform another attempt write or input step.
    const before = snapshot(page),
      original = JSON.parse(before.slot),
      library = profile(page.storage).library;
    assert.deepEqual(before.checkpoint, liveCheckpoint);
    assert.equal(verifyReplay(original.replay).match, true);
    for (const value of ['large', 'standard', 'large']) {
      const padReads = page.padReads;
      page.change('text-size', value);
      size(page, value);
      assert.equal(page.padReads, padReads, 'A setting change does not poll controller input');
      assert.deepEqual(
        profile(page.storage).library,
        updatePreferences(library, { textSize: value }),
        'Only the text preference changes in the stored library',
      );
      assertPausedUnchanged(page, before);
    }
    const pausedY = run.player.y;
    closeSettings(page);
    page.$('start-button').click();
    page.frame(0);
    assert.strictEqual(page.rendered.run, run);
    assert.equal(page.rendered.paused, false);
    assert.deepEqual(authoritativeCheckpoint(run), before.checkpoint);
    ticks(page, 12); // Explicit Resume continues the saved direction; no fresh key.
    assert.equal(run.tick, original.replay.ticks + 12);
    assert.ok(run.player.y > pausedY, 'Resume retains the deliberate downward direction');
    page.$('pause-button').click();
    page.frame(0);
    const continued = JSON.parse(page.storage.getItem(sessionKey));
    assert.equal(continued.runId, original.runId);
    assert.equal(continued.campaignKey, original.campaignKey);
    assert.equal(run.turnPolicy, turnPolicy);
    assert.equal(continued.continuation.direction, 'down');
    assert.deepEqual(continued.replay.segments, [
      { ...original.replay.segments[0], ticks: original.replay.ticks + 12 },
    ]);
    assert.deepEqual(continued.replay.checkpoint, authoritativeCheckpoint(run));
    assert.equal(verifyReplay(continued.replay).match, true);
    size(page, 'large');
    assert.deepEqual(page.errors, []);
  });
}

test('a failed preference write keeps the selected session size and old stored bytes until a later successful save', async (t) => {
  const storage = initialStorage(),
    setItem = storage.setItem.bind(storage);
  let rejectProfile = false,
    rejectedWrites = 0;
  storage.setItem = (key, value) => {
    if (rejectProfile && key === profileKey) {
      rejectedWrites++;
      throw new DOMException('Storage is full', 'QuotaExceededError');
    }
    setItem(key, value);
  };
  const page = await soloPage(t, { campaign, storage });
  startCut(page);
  openSettings(page);
  const before = snapshot(page),
    raw = storage.getItem(profileKey);
  rejectProfile = true;
  page.change('text-size', 'large');
  assert.equal(rejectedWrites, 1);
  size(page, 'large');
  assert.equal(storage.getItem(profileKey), raw);
  assert.equal(profile(storage).library.preferences.textSize, 'standard');
  assert.equal(page.$('save-warning').hidden, false);
  assert.match(page.$('save-warning').textContent, /save|storage|quota|export/i);
  assertPausedUnchanged(page, before);
  rejectProfile = false;
  page.$('settings-grid').click(); // Saves an unrelated setting from actual session state.
  assert.equal(profile(storage).library.preferences.textSize, 'large');
  assert.equal(profile(storage).library.preferences.showGrid, true);
  size(page, 'large');
  assertPausedUnchanged(page, before);
  assert.deepEqual(page.errors, []);
});

test('an unrelated host preference change applies the actual merged stored size before an explicit override', async (t) => {
  const storage = initialStorage(),
    page = await soloPage(t, { campaign, storage });
  startCut(page);
  openSettings(page);
  const before = snapshot(page),
    current = profile(storage);
  const remote = saveLibrary(
    storage,
    profileKey,
    updatePreferences(current.library, { textSize: 'large' }),
    null,
    { baseline: current.library, generation: current.generation },
  );
  assert.equal(remote.ok, true);
  // The existing host has not adopted the modeled remote save yet.
  size(page, 'standard');
  page.$('settings-grid').click();
  size(page, 'large');
  assert.equal(profile(storage).library.preferences.textSize, 'large');
  assert.equal(profile(storage).library.preferences.showGrid, true);
  assertPausedUnchanged(page, before);
  page.change('text-size', 'standard');
  size(page, 'standard');
  assert.equal(profile(storage).library.preferences.textSize, 'standard');
  assertPausedUnchanged(page, before);
  assert.deepEqual(page.errors, []);
});

test('actual complete-backup import and Undo adopt text size while preserving the verified suspended flight', async (t) => {
  const page = await soloPage(t, { campaign, storage: initialStorage() });
  startCut(page);
  page.$('library-button').click();
  page.frame(0);
  assert.equal(page.$('library-dialog').open, true);
  assert.equal(page.rendered.paused, true);
  const original = JSON.parse(page.storage.getItem(sessionKey)),
    library = profile(page.storage).library;
  assert.equal(verifyReplay(original.replay).match, true);
  page.$('save-json').value = JSON.stringify({
    format: BACKUP_FORMAT,
    library: updatePreferences(library, { textSize: 'large' }),
    packs: emptyPackLibrary(),
    session: original,
  });
  page.$('import-save').click();
  await settle(() => !page.$('import-save').disabled);
  assert.match(page.$('save-status').textContent, /Game data restored/);
  size(page, 'large');
  for (const id of ['content-select-status', 'shell-featured-status'])
    assert.doesNotMatch(page.$(id).textContent, /Pending pack launch cancelled|newer play choice/);
  assert.equal(profile(page.storage).library.preferences.textSize, 'large');
  assert.deepEqual(JSON.parse(page.storage.getItem(sessionKey)), original);
  assert.equal(page.$('undo-backup').disabled, false);
  page.frame(0);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.rendered.run.tick, 0, 'Backup replacement prepares Ready without autoplay');
  page.$('undo-backup').click();
  await settle(() => !page.$('import-save').disabled);
  assert.match(
    page.$('save-status').textContent,
    /Previous collection, packs and saved flight restored/,
  );
  size(page, 'standard');
  for (const id of ['content-select-status', 'shell-featured-status'])
    assert.doesNotMatch(page.$(id).textContent, /Pending pack launch cancelled|newer play choice/);
  assert.equal(profile(page.storage).library.preferences.textSize, 'standard');
  const restored = JSON.parse(page.storage.getItem(sessionKey));
  assert.equal(restored.runId, original.runId);
  assert.equal(restored.campaignKey, original.campaignKey);
  assert.deepEqual(restored.replay, original.replay);
  assert.deepEqual(restored.continuation, original.continuation);
  assert.equal(verifyReplay(restored.replay).match, true);
  page.frame(0);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(page.errors, []);
});
