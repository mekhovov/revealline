import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, SoloElement, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { emptyPackLibrary, installPack, preparePack, exportPackLibrary } from '../packs.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { emptyLibrary, exportLibrary, importLibrary } from '../library.mjs';

const PACKS = 'revealline.packs.dev.v1',
  PROFILE = 'revealline.library.dev.v1';
const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)));
const source = await read('../content/packs/homeward-skies.json');
// Presentation is outside this regression. Gameplay, roster and the real shipped
// mastery definition/route remain intact; no run status or award is injected.
source.visualOverrides = {};
source.levelVisuals = [];
const pack = (await preparePack(source)).pack;
const route = (await read('../replays/homeward-routes.json')).routes.find(
  (value) => value.id === 'homeward-01/immediate/specialty/fiber',
);
const packBytes = exportPackLibrary(installPack(emptyPackLibrary(), pack));
async function seed(memory) {
  const db = await new Promise((resolve, reject) => {
    const r = memory.indexedDB.open('revealline-assets-v1', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('assets');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readwrite');
    tx.objectStore('assets').put(packBytes, PACKS);
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
function action(element) {
  const handler = element.onclick;
  let pending;
  element.onclick = function (...args) {
    return (pending = handler.apply(this, args));
  };
  try {
    element.click();
  } finally {
    element.onclick = handler;
  }
  return Promise.resolve(pending);
}
async function winningFlight(t) {
  const show = SoloElement.prototype.showModal;
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    if (this.open) return;
    this.emit('beforetoggle', { oldState: 'closed', newState: 'open', bubbles: false });
    show.call(this);
  });
  const memory = memoryIndexedDB();
  await seed(memory);
  let refuse = false,
    uncertainLock = false,
    importGate = null;
  const h = await soloPage(t, {
    titleScreen: true,
    assetIndexedDB: memory.indexedDB,
    storage: memoryStorage({ [PROFILE]: exportLibrary(emptyLibrary()) }),
    lockManager: {
      request(name, options, callback) {
        const invoke = () => {
          if (refuse && name.endsWith('.backup-lock')) {
            refuse = false;
            if (uncertainLock) h.storage.setItem(`${PROFILE}.backup-lock`, 'unrecovered-owner');
            return Promise.reject(new Error('Deliberate backup write refusal'));
          }
          return Promise.resolve((callback ?? options)({ name }));
        };
        if (importGate && name.endsWith('.backup-lock')) {
          const gate = importGate;
          importGate = null;
          gate.enter();
          return gate.pending.then(invoke);
        }
        return invoke();
      },
    },
  });
  Object.assign(h.win, h.doc.defaultView);
  h.doc.defaultView = h.win;
  h.$('shell-workshop').click();
  h.$('shell-library').click();
  h.doc.querySelector('[data-library-panel="packs"]').click();
  const row = [...h.$('installed-packs').children].find(
    (value) => value.dataset.packId === pack.id,
  );
  await action(row.children.find((value) => value.dataset.packAction === 'play'));
  await settle(() => {
    h.frame(0);
    return h.rendered.run.levelId === route.levelId && !h.$('library-dialog').open;
  });
  h.change('class-select', 'fiber');
  await settle(() => {
    h.frame(0);
    return h.rendered.run.classId === 'fiber' && !h.$('start-button').disabled;
  });
  h.$('start-button').click();
  await settle(() => {
    h.frame(0);
    return h.doc.body.dataset.flightState === 'running';
  });
  const nativeTimer = globalThis.setTimeout,
    held = [];
  let hold = true;
  // Only delay the real replay verifier's cooperative host yield. Other host
  // timers, storage, menus and the verification implementation run unchanged.
  globalThis.setTimeout = function (callback, delay, ...args) {
    if (hold && delay === 0 && new Error().stack.includes('/replay.mjs:')) {
      held.push(() => callback(...args));
      return { unref() {} };
    }
    return nativeTimer(callback, delay, ...args);
  };
  t.after(() => {
    globalThis.setTimeout = nativeTimer;
  });
  const release = () => {
    hold = false;
    for (const callback of held.splice(0)) callback();
  };
  t.after(release);
  let direction = null,
    freshGesture = true;
  const tick = () => {
    // Hold ordinary keys between turns; explicitly press again after capture.
    if (freshGesture) {
      h.key(direction, false);
      h.key('ShiftLeft', false);
      h.key(direction);
      h.key('ShiftLeft');
      freshGesture = false;
    }
    h.frame();
    if (h.rendered.run.events.some((event) => event.type === 'capture.stopped'))
      freshGesture = true;
  };
  for (const segment of route.segments) {
    if (direction) h.key(direction, false);
    direction =
      'Arrow' + segment.input.direction[0].toUpperCase() + segment.input.direction.slice(1);
    freshGesture = true;
    for (let n = 0; n < segment.ticks && h.rendered.run.status !== 'won'; n++) tick();
  }
  // The host deliberately suppresses boost on its first resumed tick.
  for (let n = 0; n < 120 && h.rendered.run.status !== 'won'; n++) tick();
  h.key(direction, false);
  h.key('ShiftLeft', false);
  h.frame(0);
  assert.equal(
    h.rendered.run.status,
    'won',
    'Shipped route wins through ordinary keyboard frames.',
  );
  assert.equal(h.rendered.run.lives, route.expected.lives);
  assert.ok(held.length, 'The real verifier must be waiting at its host yield.');
  assert.match(h.$('mastery-overlay').textContent, /Checking/);
  t.diagnostic(`Legal host win tick=${h.rendered.run.tick}; held verifier yields=${held.length}`);
  const earned = importLibrary(h.storage.getItem(PROFILE));
  assert.equal(earned.masteries.length, 0);
  assert.equal(earned.gallery.length, 1);
  h.$('skip-celebration').click();
  h.$('library-button').click();
  t.diagnostic('Opened Library from won result.');
  h.doc.querySelector('[data-library-panel="packs"]').click();
  return {
    h,
    memory,
    release,
    holdImport() {
      let enter, releaseLock;
      const entered = new Promise((resolve) => {
        enter = resolve;
      });
      const pending = new Promise((resolve) => {
        releaseLock = resolve;
      });
      importGate = { enter, pending };
      let didEnter = false;
      entered.then(() => {
        didEnter = true;
      });
      return {
        get entered() {
          return didEnter;
        },
        release: releaseLock,
      };
    },
    refuse(uncertain = false) {
      refuse = true;
      uncertainLock = uncertain;
    },
    earned,
    checkpoint: authoritativeCheckpoint(h.rendered.run),
    run: h.rendered.run,
  };
}

for (const choice of [
  'keep',
  'close',
  'failed replacement',
  'uncertain replacement',
  'successful replacement',
])
  test(`backup pending optional seal: ${choice} respects completed flight ownership`, async (t) => {
    const f = await winningFlight(t),
      { h } = f;
    h.doc.querySelector('[data-library-panel="saves"]').click();
    h.$('save-json').value = JSON.stringify({
      format: 'xonix-backup.v1',
      library: emptyLibrary(),
      packs: emptyPackLibrary(),
      session: null,
    });
    h.$('import-save').focus();
    const pending = h.$('import-save').onclick();
    await settle(() => !h.$('library-operation-confirm').hidden);
    assert.equal(h.doc.activeElement === h.$('library-operation-cancel'), true);
    if (choice === 'failed replacement' || choice === 'uncertain replacement')
      f.refuse(choice === 'uncertain replacement');
    if (choice === 'close') h.$('library-dialog').close();
    else h.$(choice === 'keep' ? 'library-operation-cancel' : 'library-operation-confirm').click();
    await pending;
    if (choice.includes('replacement') && choice !== 'successful replacement')
      assert.match(h.$('save-status').textContent, /Deliberate backup write refusal/);
    if (choice !== 'successful replacement') {
      h.frame(0);
      assert.equal(h.rendered.run === f.run, true);
      assert.deepEqual(authoritativeCheckpoint(h.rendered.run), f.checkpoint);
      assert.deepEqual(importLibrary(h.storage.getItem(PROFILE)), f.earned);
    }
    f.release();
    if (choice === 'successful replacement' || choice === 'uncertain replacement') {
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(importLibrary(h.storage.getItem(PROFILE)).masteries.length, 0);
    } else {
      await settle(
        () => importLibrary(h.storage.getItem(PROFILE)).masteries.length === 1,
        'Keeping unchanged game data must preserve its real pending optional seal verification.',
      );
      assert.deepEqual(importLibrary(h.storage.getItem(PROFILE)).gallery, f.earned.gallery);
      assert.match(h.$('mastery-announcement').textContent, /earned and saved/);
    }
    assert.deepEqual(h.errors, []);
  });

test('a seal earned during backup review invalidates the Undo snapshot without replacing data', async (t) => {
  const f = await winningFlight(t),
    { h } = f;
  h.doc.querySelector('[data-library-panel="saves"]').click();
  h.$('save-json').value = JSON.stringify({
    format: 'xonix-backup.v1',
    library: emptyLibrary(),
    packs: emptyPackLibrary(),
    session: null,
  });
  h.$('import-save').focus();
  const pending = h.$('import-save').onclick();
  await settle(() => !h.$('library-operation-confirm').hidden);
  f.release();
  await settle(() => importLibrary(h.storage.getItem(PROFILE)).masteries.length === 1);
  const earned = importLibrary(h.storage.getItem(PROFILE));
  h.$('library-operation-confirm').click();
  await pending;
  assert.match(h.$('save-status').textContent, /Current game data changed during review/);
  assert.deepEqual(importLibrary(h.storage.getItem(PROFILE)), earned);
  assert.equal(h.rendered.run === f.run, true);
  assert.deepEqual(authoritativeCheckpoint(h.rendered.run), f.checkpoint);
  assert.equal(h.$('undo-backup').disabled, true);
  assert.deepEqual(h.errors, []);
});

for (const outcome of ['successful', 'refused', 'rolled back'])
  test(`a verified seal waits through ${outcome} accepted backup storage`, async (t) => {
    const f = await winningFlight(t),
      { h } = f;
    h.doc.querySelector('[data-library-panel="saves"]').click();
    h.$('save-json').value = JSON.stringify({
      format: 'xonix-backup.v1',
      library: emptyLibrary(),
      packs: emptyPackLibrary(),
      session: null,
    });
    h.$('import-save').focus();
    const pending = h.$('import-save').onclick();
    await settle(() => !h.$('library-operation-confirm').hidden);
    const gate = f.holdImport();
    t.after(gate.release);
    h.$('library-operation-confirm').click();
    await settle(() => gate.entered, 'Accepted backup must reach its controlled storage boundary.');
    f.release();
    await settle(() =>
      h
        .$('mastery-overlay')
        .textContent.includes('Goal checked. Waiting for game-data replacement'),
    );
    assert.deepEqual(importLibrary(h.storage.getItem(PROFILE)), f.earned);
    let afterWrite = false,
      restored = false;
    if (outcome === 'refused') f.refuse();
    if (outcome === 'rolled back') {
      const raw = h.storage.getItem(PROFILE),
        write = h.storage.setItem.bind(h.storage);
      t.mock.method(h.storage, 'setItem', (key, value) => {
        write(key, value);
        if (key !== PROFILE) return;
        if (!afterWrite) {
          afterWrite = true;
          assert.notEqual(value, raw, 'The incoming profile was actually written.');
          throw new Error('Injected failure after profile write');
        }
        if (value === raw) restored = true;
      });
    }
    gate.release();
    await pending;
    if (outcome !== 'successful') {
      if (outcome === 'rolled back') {
        assert.equal(afterWrite, true);
        assert.equal(
          restored,
          true,
          'The transaction restored exact old profile bytes before releasing awards.',
        );
        assert.match(
          h.$('save-status').textContent,
          /previous player data(?: and descriptor index)? (?:was|were) restored/,
        );
      }
      await settle(() => importLibrary(h.storage.getItem(PROFILE)).masteries.length === 1);
      assert.deepEqual(importLibrary(h.storage.getItem(PROFILE)).gallery, f.earned.gallery);
    } else {
      assert.equal(importLibrary(h.storage.getItem(PROFILE)).masteries.length, 0);
      assert.equal(importLibrary(h.storage.getItem(PROFILE)).gallery.length, 0);
    }
    assert.deepEqual(h.errors, []);
  });
