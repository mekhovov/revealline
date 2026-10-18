import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareNativeMenus } from '../ui/native-menus.mjs';
import { attachSettingsPanels } from '../ui/settings-panels.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { GLOBAL_SETTINGS } from '../ui/global-settings-view.mjs';
import { attachLanguageControls, getLocale, setLocale } from '../i18n/index.mjs';
import { MENU_ANIMATION_KEY } from '../ui/menu-animation-preferences.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { mountCouch } from './helpers/mount-html.mjs';

const modes = [
  ['solo', '../index.html', 'settings', '', 'settings-dialog'],
  ['team', '../couch/relay-rescue.html', 'coop-settings', 'coop-', 'coop-options'],
  ['versus', '../couch/index.html', 'race-settings', 'race-', 'race-options-panel'],
];

for (const entry of modes)
  test(`${entry[0]} keeps its actual menu-motion checkbox and offers a localized save Retry`, async (t) => {
    const original = getLocale();
    t.after(() => setLocale(original));
    const f = await fixture(...entry),
      win = f.document.defaultView,
      input = f.document.getElementById(`${f.prefix}-background-animation`);
    t.after(() => f.menu.destroy());
    let stored = 'on',
      working = false;
    win.localStorage = {
      getItem: (key) => (key === MENU_ANIMATION_KEY ? stored : null),
      setItem(key, value) {
        if (!working) throw new DOMException('Modeled full storage', 'QuotaExceededError');
        if (key === MENU_ANIMATION_KEY) stored = value;
      },
    };
    f.menu.refreshGlobalSettings();
    if (f.root.tagName === 'DIALOG') f.root.showModal();
    else f.root.hidden = false;
    f.menu.panels.accessibility.hidden = false;
    const status = f.document.getElementById(`${input.id}-save-status`),
      retry = f.document.getElementById(`${input.id}-save-retry`);
    assert.equal(status.hidden, true);
    input.checked = false;
    input.emit('change');
    assert.equal(input.checked, false);
    assert.equal(stored, 'on');
    assert.match(status.textContent, /Session only.*storage is full/);
    assert.equal(retry.hidden, false);
    assert.equal(status.closest('[data-global-setting]').dataset.globalSetting, 'menuAnimation');
    retry.focus();
    setLocale('uk');
    assert.match(status.textContent, /Лише в цьому сеансі.*заповнене/);
    assert.equal(f.document.activeElement, retry);
    working = true;
    retry.click();
    assert.equal(stored, 'off');
    assert.equal(status.textContent, 'Збережено');
    assert.equal(retry.hidden, true);
    assert.equal(f.document.activeElement, input);
    assert.equal(f.document.getElementById(input.id), input);
    assert.match(input.getAttribute('aria-describedby'), new RegExp(status.id));
  });

async function fixture(mode, file, prefix, fieldPrefix, settingsId) {
  const document = new Document();
  document.defaultView.location = new URL('https://example.test/game/');
  document.defaultView.innerWidth = 390;
  mountCouch(document, await readFile(new URL(file, import.meta.url), 'utf8'));
  attachLanguageControls(document);
  const root = document.getElementById(settingsId);
  // The theme provider owns this section and its listeners. Adoption must not
  // reconstruct it or infer a replacement appearance preference.
  const appearance = document.createElement('section'),
    theme = document.createElement('button');
  appearance.className = 'theme-family-controls';
  theme.textContent = 'Existing theme';
  appearance.append(theme);
  root.querySelector(`#${prefix}-panel-display`).append(appearance);
  const originalFaceParent = document.getElementById(`${fieldPrefix}text-face`).parentNode;
  const menu = prepareNativeMenus({ document, mode });
  return { document, root, menu, appearance, theme, prefix, fieldPrefix, originalFaceParent };
}

for (const entry of modes) {
  test(`${entry[0]} adopts the complete common inventory without replacing preference owners`, async () => {
    const f = await fixture(...entry),
      face = f.document.getElementById(`${f.fieldPrefix}text-face`),
      originalFaceParent = f.originalFaceParent,
      originalAppearanceParent = f.appearance.parentNode;
    let applied = 0;
    f.theme.addEventListener('click', () => applied++);
    face.value = 'plain';
    const registry = f.menu.refreshGlobalSettings();
    assert.deepEqual(registry.missing(), []);
    for (const { key } of GLOBAL_SETTINGS.filter(({ required }) => required)) {
      assert.equal(f.root.querySelectorAll(`[data-global-setting="${key}"]`).length, 1, key);
    }
    assert.equal(f.document.getElementById(`${f.fieldPrefix}text-face`), face);
    assert.equal(face.closest('[data-global-setting]').dataset.globalSetting, 'textFace');
    assert.equal(face.value, 'plain');
    assert.equal(f.appearance.closest('[data-global-setting]').dataset.globalSetting, 'appearance');
    f.theme.click();
    assert.equal(applied, 1);
    face.focus();
    const tool = f.document.createElement('button');
    tool.textContent = 'Shared menu sounds';
    f.menu.panels.audio.append(tool);
    f.menu.refreshGlobalSettings({ controls: { audioCues: tool } });
    assert.equal(f.document.activeElement, face, 'Late tools preserve the active preference.');
    assert.equal(f.root.querySelectorAll('[data-global-setting="appearance"]').length, 1);
    assert.equal(tool.closest('[data-global-setting]').dataset.globalSetting, 'audioCues');
    f.menu.destroy();
    assert.equal(face.parentNode, originalFaceParent);
    assert.equal(f.appearance.parentNode, originalAppearanceParent);
    f.theme.click();
    assert.equal(applied, 2, 'Teardown leaves the host-owned theme listener intact.');
  });
}

test('native aliases retire only redundant actions, retaining their listeners and distinct music actions', async () => {
  const solo = await fixture(...modes[0]),
    alias = solo.document.getElementById('shell-music');
  let toggles = 0;
  alias.addEventListener('click', () => toggles++);
  solo.menu.refreshGlobalSettings();
  assert.equal(alias.hidden, true);
  assert.equal(solo.document.getElementById('music-preview').hidden, false);
  assert.equal(solo.document.getElementById('soundtrack-open').hidden, false);
  solo.menu.destroy();
  assert.equal(alias.hidden, false);
  alias.click();
  assert.equal(toggles, 1);
  const team = await fixture(...modes[1]);
  team.menu.refreshGlobalSettings();
  assert.equal(team.document.getElementById('coop-offline').hidden, true);
  assert.equal(team.document.getElementById('coop-offline-main').hidden, false);
  assert.equal(team.document.getElementById('coop-more-catalogue').hidden, true);
  assert.equal(team.document.getElementById('coop-catalogue').hidden, false);
  team.menu.destroy();
});

test('isolated Solo courses keep their home sound action when common Settings are adopted', async () => {
  const f = await fixture(...modes[0]),
    sound = f.document.getElementById('shell-music');
  // The shell moves this existing action back to its home in isolated lessons.
  f.menu.actions.append(sound);
  f.menu.refreshGlobalSettings();
  assert.equal(sound.hidden, false);
  assert.equal(sound.parentNode, f.menu.actions);
  f.menu.destroy();
});

test('native common rows remain reachable through controller categories and return to the category on Back', async () => {
  const f = await fixture(...modes[1]);
  f.menu.refreshGlobalSettings();
  const settings = attachSettingsPanels({ root: f.root, document: f.document });
  f.root.showModal();
  const computedStyle = f.document.defaultView.getComputedStyle;
  f.document.defaultView.getComputedStyle = (element) => {
    const style = computedStyle(element);
    if (
      (element.classList.contains('field-kit-settings-panel') &&
        f.root.dataset.settingsView === 'categories') ||
      (element.classList.contains('field-kit-settings-tabs') &&
        f.root.dataset.settingsView === 'panel')
    )
      style.display = 'none';
    return style;
  };
  const controller = attachControllerNavigation({
    document: f.document,
    getRoot: () => f.root,
    getScope: () => 'settings',
    getDefaultFocus: () => settings.primary(),
  });
  controller.sync();
  settings.focusCategories();
  f.document.getElementById('coop-settings-tab-audio').focus();
  controller.handle({ confirm: true });
  const mute = f.document.getElementById('coop-audio');
  assert.equal(f.document.activeElement, mute);
  controller.handle({ direction: 'down' });
  assert.equal(f.document.activeElement, f.document.getElementById('coop-master-volume'));
  controller.handle({ back: true });
  assert.equal(f.document.activeElement.id, 'coop-settings-tab-audio');
  controller.destroy();
  settings.destroy();
  f.menu.destroy();
});
