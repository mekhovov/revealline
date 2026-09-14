import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { emptyLibrary, updatePreferences, saveLibrary, loadLibrary } from '../library.mjs';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';

const campaign = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)));
const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
function storageWith(patch = {}) {
  const storage = memoryStorage();
  assert.equal(saveLibrary(storage, profileKey, updatePreferences(emptyLibrary(), patch)).ok, true);
  return storage;
}
function face(page, expected) {
  assert.equal(page.$('text-face').value, expected);
  assert.equal(page.doc.body.dataset.textFace, expected);
}

// Actual host/input/core/persistence; modeled DOM and drawing, not a layout audit.
for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: changing font preserves a paused cut, independent text size and saved direction`, async (t) => {
    const storage = storageWith({ turnPolicy, textSize: 'large' });
    const page = await soloPage(t, { campaign, storage });
    page.$('start-button').click();
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    for (let i = 0; i < 13; i++) page.frame();
    const run = page.rendered.run;
    assert.equal(run.player.cutting, true);
    page.$('settings-button').click();
    page.$('settings-tab-display').click();
    assert.equal(page.$('settings-panel-display').hidden, false);
    page.frame(0);
    const checkpoint = authoritativeCheckpoint(run),
      slot = storage.getItem(sessionKey);
    const library = loadLibrary(storage, profileKey).library;
    for (const textFace of ['plain', 'pixel', 'plain']) {
      const padReads = page.padReads;
      const writes = storage.writes.filter(([key]) => key === sessionKey).length;
      page.change('text-face', textFace);
      face(page, textFace);
      assert.equal(page.doc.body.dataset.textSize, 'large');
      assert.equal(page.padReads, padReads);
      page.frame(0);
      assert.equal(page.rendered.paused, true);
      assert.strictEqual(page.rendered.run, run);
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      assert.equal(storage.getItem(sessionKey), slot);
      assert.equal(storage.writes.filter(([key]) => key === sessionKey).length, writes);
      assert.deepEqual(
        loadLibrary(storage, profileKey).library,
        updatePreferences(library, { textFace }),
      );
    }
    page.doc.querySelector('button[data-close="settings-dialog"]').click();
    const y = run.player.y;
    page.$('start-button').click();
    for (let i = 0; i < 12; i++) page.frame();
    assert.ok(run.player.y > y);
    page.$('pause-button').click();
    page.frame(0);
    const continued = JSON.parse(storage.getItem(sessionKey));
    assert.equal(continued.runId, JSON.parse(slot).runId);
    assert.equal(verifyReplay(continued.replay).match, true);
    assert.deepEqual(page.errors, []);
  });
}

test('persisted Plain is adopted without a startup write; a denied change is session-only', async (t) => {
  const storage = storageWith({ textFace: 'plain', textSize: 'large' });
  const before = new Map(storage.map),
    writes = storage.writes.length;
  const page = await soloPage(t, { campaign, storage });
  face(page, 'plain');
  assert.deepEqual(storage.map, before);
  assert.equal(storage.writes.length, writes);
  page.$('settings-button').click();
  page.$('settings-tab-display').click();
  assert.equal(page.$('settings-panel-display').hidden, false);
  page.frame(0);
  const old = storage.getItem(profileKey),
    slot = storage.getItem(sessionKey);
  const write = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === profileKey) throw new DOMException('Full storage', 'QuotaExceededError');
    write(key, value);
  };
  page.change('text-face', 'pixel');
  face(page, 'pixel');
  assert.equal(storage.getItem(profileKey), old);
  assert.equal(storage.getItem(sessionKey), slot);
  assert.equal(page.$('save-warning').hidden, false);
  assert.match(page.$('save-warning').textContent, /storage|save|quota|export/i);
  storage.setItem = write;
  page.change('text-size', 'standard');
  assert.equal(loadLibrary(storage, profileKey).library.preferences.textFace, 'pixel');
  assert.equal(page.doc.body.dataset.textSize, 'standard');
  assert.deepEqual(page.errors, []);
});
