import { acceptGameDataReplacement } from './helpers/backup-preflight.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BACKUP_FORMAT } from '../backup.mjs';
import { emptyLibrary, loadLibrary, saveLibrary, updatePreferences } from '../library.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import {
  soloPage as rawSoloPage,
  SoloElement,
  memoryStorage,
  settle,
} from './helpers/solo-dom.mjs';

// Opening order belongs to the real modal owner. Model the native event at
// the DOM boundary rather than bypassing the owner's return-focus protection.
async function soloPage(t, options) {
  const show = SoloElement.prototype.showModal;
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    if (this.open) return;
    this.emit('beforetoggle', { oldState: 'closed', newState: 'open', bubbles: false });
    show.call(this);
  });
  return rawSoloPage(t, options);
}

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
async function importOwnedFile(page, { accept = true } = {}) {
  // Chooser/decoding is modeled; production onchange, transaction and adoption run.
  const body = JSON.stringify({
    format: BACKUP_FORMAT,
    library: updatePreferences(emptyLibrary(), { textSize: 'large' }),
    packs: emptyPackLibrary(),
    session: null,
  });
  page.$('save-file').files = [new Blob([body], { type: 'application/json' })];
  const pending = page.$('save-file').onchange();
  if (accept) await acceptGameDataReplacement(page);
  return pending;
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
  page.$('undo-backup').focus();
  await page.$('undo-backup').onclick();
  assert.equal(
    page.doc.activeElement === page.$('export-backup'),
    true,
    'Successful Undo restores focus to Export game data',
  );
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

for (const action of ['keep', 'escape', 'close', 'pagehide', 'changed storage']) {
  test(`backup replacement review: ${action} preserves current data and never commits implicitly`, async (t) => {
    // The Node host has a separate Window; bridge global listeners as browsers do.
    const listeners = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'addEventListener');
    Object.defineProperty(globalThis, 'addEventListener', {
      configurable: true,
      value: (...args) => listeners.push(args),
    });
    t.after(() =>
      previous
        ? Object.defineProperty(globalThis, 'addEventListener', previous)
        : delete globalThis.addEventListener,
    );
    const page = await soloPage(t, { campaign, storage: storage(), titleScreen: true });
    for (const args of listeners) page.win.addEventListener(...args);
    savesFromCollection(page);
    page.$('save-file').focus();
    const before = new Map(page.storage.map);
    const pending = importOwnedFile(page, { accept: false });
    await settle(() => !page.$('library-operation-confirm').hidden);
    assert.deepEqual(page.storage.map, before, 'Review must not write game data');
    assert.equal(page.doc.activeElement, page.$('library-operation-cancel'));
    assert.equal(page.$('library-operation-cancel').textContent, 'Keep current data');
    assert.match(page.$('save-status').textContent, /Undo will restore/);
    if (action === 'keep') page.$('library-operation-cancel').click();
    // DOM adapter omits the browser default Escape-to-dialog-cancel action.
    if (action === 'escape') page.$('library-dialog').emit('cancel');
    if (action === 'close') page.doc.querySelector('button[data-close="library-dialog"]').click();
    if (action === 'pagehide') page.win.emit('pagehide');
    if (action === 'changed storage') {
      page.storage.setItem(profileKey, 'changed by another page');
      before.set(profileKey, 'changed by another page');
      page.$('library-operation-confirm').click();
    }
    await pending;
    assert.deepEqual(page.storage.map, before);
    assert.equal(page.$('library-operation-confirm').hidden, true);
    assert.equal(page.$('undo-backup').disabled, true);
    if (action === 'changed storage')
      assert.match(page.$('save-status').textContent, /Current game data changed/);
    if (action === 'keep' || action === 'escape')
      assert.equal(page.doc.activeElement, page.$('save-file'));
    assert.deepEqual(page.errors, []);
  });
}

for (const choice of ['Back', 'Confirm']) {
  test(`modeled controller ${choice} routes the replacement decision through the current Library owner`, async (t) => {
    const page = await soloPage(t, { campaign, storage: storage(), titleScreen: true });
    savesFromCollection(page);
    page.$('save-file').focus();
    const pending = importOwnedFile(page, { accept: false });
    await settle(() => !page.$('library-operation-confirm').hidden);
    const prior = Object.getOwnPropertyDescriptor(performance, 'now');
    let now = 1000;
    Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
    t.after(() =>
      prior ? Object.defineProperty(performance, 'now', prior) : delete performance.now,
    );
    const pad = {
      index: 0,
      id: 'Backup review controller fixture',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    navigator.getGamepads = () => [pad];
    const frame = () => {
      now += 16;
      page.frame(16);
    };
    const pulse = (index) => {
      pad.buttons[index] = { pressed: true, value: 1 };
      frame();
      pad.buttons[index] = { pressed: false, value: 0 };
      frame();
    };
    frame();
    frame();
    assert.equal(page.doc.activeElement, page.$('library-operation-cancel'));
    if (choice === 'Confirm') {
      pulse(12);
      assert.equal(page.doc.activeElement, page.$('library-operation-confirm'));
      pulse(0);
    } else pulse(1);
    await pending;
    assert.equal(
      profile(page).library.preferences.textSize,
      choice === 'Confirm' ? 'large' : 'standard',
    );
    assert.equal(page.$('library-dialog').open, true);
    assert.equal(page.doc.activeElement, page.$('save-file'));
    assert.deepEqual(page.errors, []);
  });
}
