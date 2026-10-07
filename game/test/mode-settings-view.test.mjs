import test from 'node:test';
import assert from 'node:assert/strict';
import { mountModeSettings } from '../ui/mode-settings-view.mjs';
import { attachSettingsPanels, settingsTabOwnsKey } from '../ui/settings-panels.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { Document } from './helpers/couch-dom.mjs';

function fixture(width = 390) {
  const document = new Document(),
    root = document.createElement('dialog'),
    content = document.createElement('div'),
    footer = document.createElement('footer'),
    close = document.createElement('button'),
    gameplay = document.createElement('button'),
    sound = document.createElement('input'),
    language = document.createElement('select');
  document.defaultView.innerWidth = width;
  close.dataset.settingsBack = '';
  close.textContent = 'Back';
  gameplay.id = 'existing-gameplay';
  sound.id = 'existing-sound';
  sound.type = 'range';
  sound.value = '0.7';
  language.id = 'existing-language';
  content.append(gameplay, sound, language);
  footer.append(close);
  root.append(content, footer);
  document.body.append(root);
  root.showModal();
  return { document, root, content, footer, close, gameplay, sound, language };
}

function mount(f) {
  return mountModeSettings({
    ...f,
    prefix: 'shared-mode-settings',
    groups: { gameplay: [f.gameplay], audio: [f.sound], display: [f.language] },
    attachPanels: attachSettingsPanels,
  });
}

test('optional settings preserve real preferences and handlers, omit unavailable categories and restore ownership', () => {
  const f = fixture();
  let changes = 0;
  f.sound.addEventListener('change', () => changes++);
  const settings = mount(f);
  assert.deepEqual(Object.keys(settings.tabs), ['gameplay', 'audio', 'display']);
  assert.equal(f.document.getElementById('existing-sound'), f.sound);
  assert.equal(f.sound.parentNode, settings.panels.audio);
  assert.equal(f.sound.value, '0.7');
  f.sound.emit('change');
  assert.equal(changes, 1);
  assert.equal(f.footer.parentNode, f.root, 'The host still owns its Back footer.');
  settings.destroy();
  assert.deepEqual(f.content.children, [f.gameplay, f.sound, f.language]);
  assert.equal(f.root.classList.contains('native-settings'), false);
  assert.equal(f.root.getAttribute('data-settings-view'), null);
  f.sound.emit('change');
  assert.equal(changes, 2, 'Disposal does not retire host preference handlers.');
});

test('compact keyboard categories localize in place and Back exits the section before the dialog', () => {
  const f = fixture(),
    settings = mount(f);
  settings.navigation.focusCategories();
  assert.equal(
    settingsTabOwnsKey({ key: 'ArrowDown', target: settings.tabs.gameplay }, f.root),
    true,
  );
  settings.tabs.gameplay.emit('keydown', { key: 'ArrowDown' });
  assert.equal(f.document.activeElement, settings.tabs.audio);
  settings.tabs.audio.click();
  assert.equal(f.root.dataset.settingsView, 'panel');
  assert.equal(f.document.activeElement, f.sound);
  settings.refresh('uk-UA');
  assert.equal(settings.tabs.audio.textContent, 'Звук');
  assert.equal(settings.tabs.display.textContent, 'Екран і мова');
  assert.equal(settings.navigation.selected(), settings.tabs.audio.id);
  assert.equal(f.document.activeElement, f.sound, 'Language changes preserve the active field.');
  let closed = 0;
  f.close.addEventListener('click', () => closed++);
  f.close.click();
  assert.equal(f.root.dataset.settingsView, 'categories');
  assert.equal(f.document.activeElement, settings.tabs.audio);
  assert.equal(closed, 0, 'The provider consumes category Back before the host closes.');
  f.close.click();
  assert.equal(closed, 1);
  settings.destroy();
});

test('the existing controller adapter traverses optional categories, confirms a panel and returns to its category', () => {
  const f = fixture(),
    settings = mount(f);
  // The fixture has no stylesheet engine; model the shared compact view rules.
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
  let closed = 0;
  const controller = attachControllerNavigation({
    document: f.document,
    getRoot: () => f.root,
    getScope: () => 'settings',
    getDefaultFocus: () => settings.navigation.primary(),
    onBack: () => closed++,
  });
  controller.sync();
  settings.navigation.focusCategories();
  controller.handle({ direction: 'down' });
  assert.equal(f.document.activeElement, settings.tabs.audio);
  controller.handle({ confirm: true });
  assert.equal(f.root.dataset.settingsView, 'panel');
  assert.equal(f.document.activeElement, f.sound);
  controller.handle({ back: true });
  assert.equal(closed, 0);
  assert.equal(f.document.activeElement, settings.tabs.audio);
  controller.handle({ back: true });
  assert.equal(closed, 1);
  controller.destroy();
  settings.destroy();
});
