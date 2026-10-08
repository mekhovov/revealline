import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountGlobalSettingsTools } from '../ui/global-settings-tools.mjs';
import { attachProfileRecoveryView } from '../ui/profile-recovery.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));
function fixture(t) {
  const doc = new Document(),
    win = new Events();
  win.location = new URL('https://game.invalid/game/couch/');
  win.navigator = {
    storage: {
      persisted: async () => false,
      persist: async () => {
        calls.persist++;
        return true;
      },
    },
  };
  const settings = doc.createElement('dialog');
  settings.id = 'other-mode-settings';
  doc.body.append(settings);
  settings.showModal();
  const panels = Object.fromEntries(
    ['controls', 'data', 'content', 'extras'].map((name) => {
      const panel = doc.createElement('section');
      settings.append(panel);
      return [name, panel];
    }),
  );
  const originalOffline = doc.createElement('button');
  panels.content.append(originalOffline);
  let visit = 1;
  const calls = { readers: 0, readerCloses: 0, persist: 0, opened: 0, loads: 0 };
  const api = mountGlobalSettingsTools({
    document: doc,
    window: win,
    settingsRoot: settings,
    panels,
    prefix: 'test-tools',
    currentVersion: 'v0.142.4',
    packaged: false,
    resolveSourceVersion: async () => 'v0.142.4',
    existing: { offlineTools: originalOffline },
    offlinePanel: { root: () => null, frameFocused: () => false },
    getSettingsOpen: () => settings.open,
    getOwner: () => visit,
    isOwnerCurrent: (owner) => owner === visit,
    onOpen: () => calls.opened++,
    coreURL: new URL('https://game.invalid/game/'),
    loadRecovery: () => {
      calls.loads++;
      return {
        createReader() {
          calls.readers++;
          return {
            discover: async () => ({ channels: [], diagnostics: [] }),
            close: async () => {
              calls.readerCloses++;
            },
          };
        },
        attachView: attachProfileRecoveryView,
      };
    },
  });
  t.after(() => api.dispose());
  return {
    doc,
    win,
    settings,
    panels,
    api,
    calls,
    originalOffline,
    changeVisit() {
      visit++;
    },
  };
}

test('global tools reuse the existing offline owner and lazily open real recovery above a non-Solo parent', async (t) => {
  const h = fixture(t);
  assert.equal(h.calls.loads, 0);
  assert.equal(h.api.controls.offlineTools, h.originalOffline);
  assert.equal(h.doc.querySelectorAll('[data-global-tool="offlineTools"]').length, 0);
  const opener = h.doc.getElementById('profile-recovery-open');
  opener.focus();
  assert.equal(await opener.onclick(), true);
  assert.equal(h.settings.open, true);
  assert.equal(h.api.root().id, 'profile-recovery-dialog');
  assert.equal(h.calls.readers, 1);
  const find = h.doc.getElementById('profile-recovery-find');
  assert.equal(find.disabled, false);
  await find.onclick();
  assert.equal(h.api.back(), true);
  await settle();
  assert.equal(h.api.root(), null);
  assert.equal(h.settings.open, true);
  assert.equal(h.doc.activeElement, opener);
  assert.equal(h.calls.readerCloses, 1);
});

test('closing a stale recovery visit does not steal the new Settings focus', async (t) => {
  const h = fixture(t),
    opener = h.doc.getElementById('profile-recovery-open');
  await opener.onclick();
  h.changeVisit();
  const current = h.originalOffline;
  current.focus();
  h.api.back();
  await settle();
  assert.equal(h.doc.activeElement, current);
  assert.equal(h.calls.readerCloses, 1);
});

test('retention invokes the browser only on an explicit action and keeps its real feedback', async (t) => {
  const h = fixture(t);
  h.api.refresh();
  await settle();
  assert.equal(h.calls.persist, 0);
  const row = h.api.controls.storageRetention;
  row.querySelector('button').click();
  await settle();
  assert.equal(h.calls.persist, 1);
  assert.match(row.textContent, /protected|retained|backups/i);
  assert.equal(h.settings.open, true);
});

test('nested controller practice retains its Settings parent and releases the child when Back is used', async (t) => {
  const h = fixture(t),
    opener = h.api.controls.controllerTools.querySelector('button');
  opener.focus();
  opener.click();
  const dialog = h.api.root(),
    frame = dialog.querySelector('iframe');
  assert.equal(h.settings.open, true);
  assert.equal(frame.src, 'https://game.invalid/game/controller-lab/');
  frame.focus();
  assert.equal(h.api.frameFocused(), true);
  h.api.back();
  await settle();
  assert.equal(h.api.root(), null);
  assert.equal(frame.getAttribute('src'), null);
  assert.equal(h.doc.activeElement, opener);
  assert.equal(h.calls.readers, 0);
  assert.equal(h.calls.persist, 0);
});

test('unclaimed Escape crosses the tool frame boundary while an inner modal keeps its own Back', async (t) => {
  const h = fixture(t),
    opener = h.api.controls.controllerTools.querySelector('button');
  opener.focus();
  opener.click();
  const frame = h.api.root().querySelector('iframe'),
    childDocument = new Document(),
    childWindow = new Events();
  childWindow.location = new URL(frame.src);
  frame.contentWindow = childWindow;
  frame.contentDocument = childDocument;
  frame.emit('load');
  frame.focus();
  const inner = childDocument.createElement('dialog');
  childDocument.body.append(inner);
  inner.showModal();
  assert.equal(childWindow.emit('keydown', { key: 'Escape' }).defaultPrevented, false);
  assert.ok(h.api.root(), 'The child modal gets its native Escape first.');
  inner.close();
  assert.equal(childWindow.emit('keydown', { key: 'Escape' }).defaultPrevented, true);
  assert.equal(h.api.root(), null);
  assert.equal(h.doc.activeElement, opener);
  assert.equal(
    childWindow.emit('keydown', { key: 'Escape' }).defaultPrevented,
    false,
    'Closing releases the old child key listener.',
  );
});
