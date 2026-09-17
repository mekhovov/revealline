import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage } from './helpers/solo-dom.mjs';
import { attachFieldKitSurfaces } from '../ui/field-kit-surfaces.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { applyFieldKitCopy, fieldKitCopy } from '../ui/field-kit-copy.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { collectBuildFiles, validateBuildReferences } from '../../scripts/game-cli.mjs';

test('Workshop destinations ship their actual authoring runtime and return paths', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const files = await collectBuildFiles(root);
  for (const name of [
    'motion-lab',
    'still-media',
    'video-poster',
    'design-atlas',
    'asset-studio',
    'enemy-catalog',
  ]) {
    assert.ok(files.includes(`authoring/${name}/index.html`), name);
  }
  for (const name of [
    'app.js',
    'ability-presets.json',
    'collection-presets.json',
    'styles.css',
    'display-entry.mjs',
    'display.mjs',
    'preview-loop.mjs',
    'png-preview.mjs',
    'ability-labels.mjs',
  ])
    assert.ok(files.includes(`authoring/motion-lab/${name}`), name);
  assert.ok(!files.some((name) => /^authoring\/motion-lab\/test-/.test(name)));
  const refs = await validateBuildReferences(root, files);
  assert.ok(
    !refs.navigationWarnings.some((warning) => /motion-lab|round-09-reference-atlas/.test(warning)),
  );
  const motion = await readFile(
    new URL('../../authoring/motion-lab/index.html', import.meta.url),
    'utf8',
  );
  assert.match(motion, /href="\.\.\/\.\.\/game\/"/);
  assert.match(motion, /data-motion-text-size/);
  assert.match(motion, /<script type="module" src="\.\/display-entry\.mjs"><\/script>/);
  // Shared preferences own this control, including startup failure. The generic
  // body-only adapter must not install a second, independent change listener.
  assert.doesNotMatch(motion, /data-field-kit-text-size/);
});

test('settings categories keep the real controls and preferences without starting the flight', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  const controls = ['music-select', 'text-size', 'key-preset', 'storage-retention-button'].map(
    (id) => page.$(id),
  );
  page.$('shell-options').click();
  assert.equal(page.$('settings-dialog').open, true);
  for (const category of ['controls', 'audio', 'display', 'data']) {
    const tab = page.$(`settings-tab-${category}`);
    tab.click();
    assert.equal(tab.getAttribute('aria-selected'), 'true');
    assert.equal(page.$(`settings-panel-${category}`).hidden, false);
    assert.equal(
      [...page.doc.querySelectorAll('.field-kit-settings-panel')].filter((panel) => !panel.hidden)
        .length,
      1,
    );
  }
  page.$('settings-tab-display').click();
  const textSize = page.$('text-size');
  textSize.value = 'large';
  textSize.emit('change');
  assert.equal(page.doc.body.dataset.textSize, 'large');
  assert.ok([...page.storage.map.values()].some((value) => value.includes('"textSize":"large"')));
  for (const control of controls) assert.equal(page.$(control.id), control);
  page.frame(0);
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(page.errors, []);
});

test('leaving Controls cancels a pending physical-key capture through its native cancel action', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  page.$('shell-options').click();
  page.$('settings-tab-controls').click();
  page.$('keyboard-settings').open = true;
  page.$('key-binding-list').querySelector('button').click();
  assert.equal(page.$('cancel-key-capture').hidden, false);
  const before = [...page.storage.map];
  page.$('settings-tab-audio').click();
  assert.equal(page.$('cancel-key-capture').hidden, true);
  assert.equal(page.doc.activeElement.id, 'settings-tab-audio');
  assert.deepEqual([...page.storage.map], before);
});

test('settings tabs support arrow and end navigation without leaking the key to the game', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  page.$('shell-options').click();
  page.$('settings-tab-audio').focus();
  const right = page.$('settings-tab-audio').emit('keydown', { key: 'ArrowRight' });
  assert.equal(right.defaultPrevented, true);
  assert.equal(page.doc.activeElement.id, 'settings-tab-display');
  assert.equal(page.$('settings-panel-display').hidden, false);
  page.$('settings-tab-display').emit('keydown', { key: 'End' });
  assert.equal(page.doc.activeElement.id, 'settings-tab-data');
  page.frame(0);
  assert.equal(page.rendered.run.tick, 0);
});

test('data and collection shortcuts reuse the existing nested Library sections without changing saved data', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  page.$('shell-options').click();
  page.$('settings-tab-data').click();
  const snapshot = [...page.storage.map];
  page.$('settings-saves').click();
  assert.equal(page.$('library-dialog').open, true);
  assert.equal(page.$('library-saves').hidden, false);
  assert.equal(page.$('settings-dialog').open, true);
  page.$('library-dialog').close();
  page.$('settings-packs').click();
  assert.equal(page.$('library-packs').hidden, false);
  page.$('library-dialog').close();
  page.$('settings-dialog').close();
  page.$('shell-gallery').click();
  page.$('collection-records').click();
  assert.equal(page.$('library-scores').hidden, false);
  assert.equal(page.$('collection-dialog').open, true);
  assert.deepEqual([...page.storage.map], snapshot);
  page.frame(0);
  assert.equal(page.rendered.run.tick, 0);
});

test('supporting page text size remains presentation only and listeners are released', () => {
  const doc = new Document();
  const control = doc.createElement('select');
  control.setAttribute('data-field-kit-text-size', '');
  doc.body.append(control);
  const presentation = attachFieldKitSurfaces({ document: doc });
  control.value = 'large';
  control.emit('change');
  assert.equal(doc.body.dataset.textSize, 'large');
  presentation.destroy();
  control.value = 'standard';
  control.emit('change');
  assert.equal(doc.body.dataset.textSize, 'large');
});

test('surface copy has stable English fallback keys and preserves native controls', () => {
  assert.equal(fieldKitCopy('settings.display', 'en-GB'), 'Display & accessibility');
  assert.equal(fieldKitCopy('settings.display', 'uk-UA'), 'Display & accessibility');
  assert.equal(fieldKitCopy('future.missing'), null);
  assert.equal(fieldKitCopy('__proto__'), null);
  assert.equal(
    fieldKitCopy('title.continueDestination', 'uk-UA', { destination: 'Ґанок · Їжак' }),
    'Continue · Ґанок · Їжак',
  );
  assert.equal(
    fieldKitCopy('title.continueDestination', 'en', { destination: '<b>Flight</b>' }),
    'Continue · <b>Flight</b>',
  );
  const doc = new Document();
  const label = doc.createElement('label');
  const text = doc.createElement('span');
  text.setAttribute('data-field-kit-copy', 'display.textSize');
  const input = doc.createElement('select');
  input.value = 'large';
  label.append(text, input);
  doc.body.append(label);
  applyFieldKitCopy(doc, 'uk');
  assert.equal(text.textContent, 'Text size');
  assert.equal(label.children[1], input);
  assert.equal(input.value, 'large');
});
