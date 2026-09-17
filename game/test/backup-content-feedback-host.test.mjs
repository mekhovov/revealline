import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BACKUP_FORMAT } from '../backup.mjs';
import { emptyLibrary, loadLibrary, saveLibrary, updatePreferences } from '../library.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';

const campaign = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)));
const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
const profile = (page) => loadLibrary(page.storage, profileKey, { campaigns: [campaign] });
function noPackCancellation(page) {
  for (const id of ['content-select-status', 'shell-featured-status'])
    assert.doesNotMatch(
      page.$(id).textContent,
      /Pending pack launch cancelled|newer play choice/,
      `${id} must not classify backup work as a cancelled pack launch`,
    );
}
function storage() {
  const result = memoryStorage();
  assert.equal(saveLibrary(result, profileKey, emptyLibrary()).ok, true);
  return result;
}
function savesFromCollection(page) {
  page.$('shell-gallery').click();
  assert.equal(page.$('collection-dialog').open, true);
  page.$('collection-records').click();
  page.doc.querySelector('button[data-library-panel="saves"]').click();
  assert.equal(page.$('library-dialog').open, true);
  assert.equal(page.$('library-saves').hidden, false);
}
function importOwnedFile(page) {
  // Chooser/decoding is modeled; production onchange, transaction and adoption run.
  const body = JSON.stringify({
    format: BACKUP_FORMAT,
    library: updatePreferences(emptyLibrary(), { textSize: 'large' }),
    packs: emptyPackLibrary(),
    session: null,
  });
  page.$('save-file').files = [new Blob([body], { type: 'application/json' })];
  return page.$('save-file').onchange();
}
function returnHome(page) {
  page.doc.querySelector('button[data-close="library-dialog"]').click();
  page.doc.querySelector('button[data-close="collection-dialog"]').click();
  assert.equal(page.$('library-dialog').open, false);
  assert.equal(page.$('collection-dialog').open, false);
  assert.equal(page.$('shell-home').open, true);
}
function ready(page, size) {
  assert.equal(profile(page).library.preferences.textSize, size);
  assert.equal(page.doc.body.dataset.textSize, size);
  assert.equal(page.storage.getItem(sessionKey), null);
  page.frame(0);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.rendered.run.tick, 0);
}

// Actual Solo entry/journaled backup; finite DOM and storage. No native layout claim.
test('Collection file Import and Undo return Home without inventing a cancelled pack launch', async (t) => {
  const page = await soloPage(t, { campaign, storage: storage(), titleScreen: true });
  savesFromCollection(page);
  await importOwnedFile(page);
  assert.match(page.$('save-status').textContent, /Game data restored/);
  ready(page, 'large');
  noPackCancellation(page);
  returnHome(page);
  noPackCancellation(page);
  savesFromCollection(page);
  assert.equal(page.$('undo-backup').disabled, false);
  await page.$('undo-backup').onclick();
  assert.match(
    page.$('save-status').textContent,
    /Previous collection, packs and saved flight restored/,
  );
  ready(page, 'standard');
  noPackCancellation(page);
  returnHome(page);
  noPackCancellation(page);
  assert.deepEqual(page.errors, []);
});

test('blur during the actual held backup lock does not announce a pack cancellation or autoplay', async (t) => {
  let armed = false,
    release;
  const lockManager = {
    request(name, options, callback) {
      const work = callback ?? options;
      if (
        armed &&
        name === `${profileKey}.backup-lock` &&
        page.$('save-status').textContent === 'Saving the verified collection and saved flight…'
      ) {
        armed = false;
        return new Promise((resolve, reject) => {
          release = () =>
            Promise.resolve()
              .then(() => work({ name }))
              .then(resolve, reject);
        });
      }
      return Promise.resolve(work({ name }));
    },
  };
  const page = await soloPage(t, { campaign, storage: storage(), titleScreen: true, lockManager });
  savesFromCollection(page);
  armed = true;
  const pending = importOwnedFile(page);
  try {
    await settle(() => typeof release === 'function', 'The real backup commit must reach its lock');
    assert.equal(page.$('pack-select').disabled, true, 'Backup owns the content busy state');
    const before = new Map(page.storage.map);
    page.win.emit('blur');
    page.frame(0);
    assert.equal(page.rendered.paused, true);
    assert.equal(page.rendered.run.tick, 0);
    assert.deepEqual(page.storage.map, before, 'Blur cannot commit or rewrite the held backup');
    noPackCancellation(page);
  } finally {
    release?.();
    await pending;
  }
  assert.match(page.$('save-status').textContent, /Game data restored/);
  ready(page, 'large');
  noPackCancellation(page);
  returnHome(page);
  noPackCancellation(page);
  assert.deepEqual(page.errors, []);
});
