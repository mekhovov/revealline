import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountGlobalSettingsTools } from '../ui/global-settings-tools.mjs';
import { getLocale, setLocale, t as translate } from '../i18n/index.mjs';
import { attachProfileRecoveryView } from '../ui/profile-recovery.mjs';
import { mountModeSettings } from '../ui/mode-settings-view.mjs';
import { attachSettingsPanels } from '../ui/settings-panels.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));
function fixture(t, options = {}) {
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
    onOpen: () => {
      calls.opened++;
      options.onOpen?.({ settings });
    },
    onPresentationChange: options.onPresentationChange,
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

function responsiveFixture(t) {
  const h = fixture(t);
  h.doc.defaultView.innerWidth = 1280;
  const settings = mountModeSettings({
    root: h.settings,
    prefix: 'responsive-settings',
    groups: Object.fromEntries(Object.entries(h.panels).map(([name, panel]) => [name, [panel]])),
    attachPanels: attachSettingsPanels,
  });
  t.after(() => settings.destroy());
  settings.navigation.select(settings.tabs.extras.id);
  const opener = h.api.controls.about.querySelector('button'),
    rects = opener.getClientRects.bind(opener),
    focus = opener.focus.bind(opener);
  // This finite DOM has no stylesheet engine. Model the actual compact rule:
  // categories hide every panel, and native focus ignores a non-rendered opener.
  opener.getClientRects = () =>
    h.doc.defaultView.innerWidth <= 700 && h.settings.dataset.settingsView === 'categories'
      ? []
      : rects();
  opener.focus = (...args) => {
    if (opener.getClientRects().length) focus(...args);
  };
  const resize = () => {
    h.doc.defaultView.innerWidth = 316;
    h.doc.defaultView.emit('resize');
  };
  opener.focus();
  opener.click();
  return { ...h, navigation: settings.navigation, tab: settings.tabs.extras, opener, resize };
}

test('About Back reveals its current Settings panel after resizing while the child owns focus', async (t) => {
  const h = responsiveFixture(t),
    frame = h.api.root().querySelector('iframe');
  frame.focus();
  h.resize();
  assert.equal(h.settings.dataset.settingsView, 'categories');
  assert.equal(h.opener.getClientRects().length, 0);
  h.api.back();
  await settle();
  assert.equal(h.settings.dataset.settingsView, 'panel');
  assert.equal(h.doc.activeElement, h.opener);
  assert.ok(h.opener.getClientRects().length);
  assert.equal(h.opener.scrolled, 1);
  assert.equal(h.settings.open, true);
  assert.equal(frame.getAttribute('src'), null);
  assert.equal(h.calls.persist, 0);
  assert.equal(h.calls.readers, 0);
});

for (const unavailable of ['hidden', 'removed', 'disabled']) {
  test(`About Back returns to its category if the resized opener is ${unavailable}`, async (t) => {
    const h = responsiveFixture(t);
    h.resize();
    if (unavailable === 'removed') h.opener.remove();
    else h.opener[unavailable] = true;
    h.api.back();
    await settle();
    assert.equal(h.settings.dataset.settingsView, 'categories');
    assert.equal(h.doc.activeElement, h.tab);
    assert.equal(h.tab.scrolled, 1);
    assert.equal(h.settings.open, true);
  });
}

test('resized tool close retains a newer selected category instead of revealing the former opener', async (t) => {
  const h = responsiveFixture(t);
  h.navigation.select('responsive-settings-tab-controls');
  h.resize();
  h.api.back();
  await settle();
  assert.equal(h.navigation.selected(), 'responsive-settings-tab-controls');
  assert.equal(h.settings.dataset.settingsView, 'categories');
  assert.equal(h.doc.activeElement.id, 'responsive-settings-tab-controls');
  assert.equal(h.opener.getClientRects().length, 0);
});

for (const retired of ['visit', 'hidden page', 'unfocused page', 'disposed']) {
  test(`resized tool close cannot take focus after its ${retired} is retired`, async (t) => {
    const h = responsiveFixture(t),
      current = h.doc.createElement('button');
    h.resize();
    h.settings.append(current);
    current.focus();
    if (retired === 'visit') h.changeVisit();
    if (retired === 'hidden page') h.doc.hidden = true;
    if (retired === 'unfocused page') h.doc.hasFocus = () => false;
    if (retired === 'disposed') await h.api.dispose();
    else h.api.back();
    await settle();
    assert.equal(h.doc.activeElement, current);
    assert.equal(h.settings.dataset.settingsView, 'categories');
  });
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

test('About uses plain localized copy through its nested title and returns focus to the same Settings row', async (context) => {
  const previous = getLocale();
  context.after(() => setLocale(previous, { persist: false }));
  setLocale('en', { persist: false });
  const h = fixture(context),
    opener = h.api.controls.about.querySelector('button');
  assert.equal(opener.textContent, 'About & credits');
  opener.focus();
  opener.click();
  const dialog = h.api.root(),
    heading = h.doc.getElementById('test-tools-tool-title'),
    frame = dialog.querySelector('iframe'),
    back = h.doc.getElementById('test-tools-tool-back'),
    route = frame.src;
  assert.equal(route, 'https://game.invalid/site/about.html#versions');
  assert.equal(h.settings.open, true);
  assert.equal(h.doc.activeElement, back);
  for (const [locale, title] of [
    ['uk', 'Про гру й авторів'],
    ['en', 'About & credits'],
  ]) {
    setLocale(locale, { persist: false });
    assert.equal(opener.textContent, title);
    assert.equal(heading.textContent, title);
    assert.equal(frame.getAttribute('title'), title);
    assert.equal(frame.src, route);
    assert.equal(h.api.root(), dialog);
    assert.equal(h.doc.activeElement, back);
  }
  back.click();
  await settle();
  assert.equal(h.api.root(), null);
  assert.equal(h.settings.open, true);
  assert.equal(h.doc.activeElement, opener);
  assert.equal(frame.getAttribute('src'), null);
  const creator = h.api.controls.creatorTools.querySelector('button');
  creator.click();
  setLocale('uk', { persist: false });
  assert.equal(frame.getAttribute('title'), translate('interface:nativeMenu.creatorTools'));
  assert.equal(heading.textContent, translate('interface:nativeMenu.creatorTools'));
  assert.equal(h.calls.persist, 0);
  assert.equal(h.calls.readers, 0);
});

test('global tools notify committed native child opens, not rejected or already-open attempts', async (t) => {
  let presentations = 0;
  const h = fixture(t, {
    onPresentationChange: () => {
      presentations++;
      assert.equal(Boolean(h.api.root()?.open), true);
    },
  });
  const opener = h.api.controls.about.querySelector('button');
  opener.focus();
  opener.click();
  assert.equal(presentations, 1);
  opener.click();
  assert.equal(presentations, 1);
  h.api.back();
  opener.click();
  assert.equal(presentations, 2);
  h.api.back();
  h.settings.close();
  opener.click();
  assert.equal(presentations, 2);
  assert.equal(h.api.root(), null);
});

test('global tools forward committed Recovery presentation from the Data category', async (t) => {
  let presentations = 0;
  const h = fixture(t, { onPresentationChange: () => presentations++ });
  await h.doc.getElementById('profile-recovery-open').onclick();
  assert.equal(h.api.root()?.id, 'profile-recovery-dialog');
  assert.equal(presentations, 1);
  h.api.back();
  await settle();
  assert.equal(h.api.root(), null);
  assert.equal(presentations, 1);
});

test('global tools preserve a rejected pre-open owner without a presentation notification', (t) => {
  let presentations = 0;
  const h = fixture(t, {
    onOpen: ({ settings }) => settings.close(),
    onPresentationChange: () => presentations++,
  });
  h.api.controls.about.querySelector('button').click();
  assert.equal(h.api.root(), null);
  assert.equal(presentations, 0);
});

test('global tools notify a committed open even when native focus immediately returns to Settings', (t) => {
  let presentations = 0;
  const h = fixture(t, { onPresentationChange: () => presentations++ });
  const create = h.doc.createElement.bind(h.doc);
  h.doc.createElement = (tag) => {
    const node = create(tag);
    if (tag === 'dialog') {
      const show = node.showModal.bind(node);
      node.showModal = () => {
        show();
        node.close();
      };
    }
    return node;
  };
  h.api.controls.about.querySelector('button').click();
  assert.equal(h.api.root(), null);
  assert.equal(presentations, 1);
});
