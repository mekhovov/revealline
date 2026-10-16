import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document } from './helpers/couch-dom.mjs';
import { mountCouch } from './helpers/mount-html.mjs';
import { prepareNativeMenus } from '../ui/native-menus.mjs';

for (const [mode, file, rootId, soundId, prefix, secondary] of [
  ['solo', '../index.html', 'shell-home', 'shell-sound', 'settings', null],
  [
    'team',
    '../couch/relay-rescue.html',
    'coop-menu',
    'coop-quick-sound',
    'coop-settings',
    'coop-hunt-save',
  ],
  [
    'versus',
    '../couch/index.html',
    'race-main',
    'race-quick-sound',
    'race-settings',
    'race-journey-save',
  ],
]) {
  test(`${mode} retains real controls in settings and separates sound from primary play`, async () => {
    const document = new Document();
    document.defaultView.location = new URL(
      `https://example.test/game/${mode === 'solo' ? '' : mode === 'team' ? 'couch/relay-rescue.html' : 'couch/'}`,
    );
    mountCouch(document, await readFile(new URL(file, import.meta.url), 'utf8'));
    const sound = document.getElementById(soundId),
      root = document.getElementById(rootId),
      savedParent = sound.parentNode,
      recovery = secondary && document.getElementById(secondary);
    let toggles = 0;
    sound.addEventListener('click', () => toggles++);
    const menu = prepareNativeMenus({ document, mode });
    assert.ok(menu);
    assert.equal(sound.parentNode.className, 'native-menu-utilities');
    assert.equal(
      sound.parentNode.hidden,
      false,
      'Sound remains reachable without fullscreen support.',
    );
    assert.equal(root.querySelector('.native-menu-actions').contains(sound), false);
    assert.equal(menu.panels.extras.querySelectorAll('.game-mode-destinations').length, 1);
    assert.equal(root.querySelector('.game-mode-destinations'), null);
    if (recovery) assert.equal(recovery.parentNode.id, `${prefix}-panel-data`);
    sound.click();
    assert.equal(toggles, 1, 'Moving controls preserves their original behavior.');
    menu.destroy();
    assert.equal(sound.parentNode, savedParent, 'Disposal restores the existing host structure.');
  });
}
