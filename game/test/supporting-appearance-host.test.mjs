import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document } from './helpers/couch-dom.mjs';
import { attachFieldKitSurfaces } from '../ui/field-kit-surfaces.mjs';
import { MENU_STYLE_PREFERENCES_KEY } from '../menu-style-preferences.mjs';

test('supporting pages resolve the saved FPV Field Kit skin without writing preferences', () => {
  const stored = JSON.stringify({ palette: 'ukrainian', ornaments: 'rich' }),
    writes = [],
    storage = {
      getItem: (key) => (key === MENU_STYLE_PREFERENCES_KEY ? stored : null),
      setItem: (...entry) => writes.push(entry),
    },
    doc = new Document();
  doc.body.dataset.fieldKitPage = 'playground';
  const owner = attachFieldKitSurfaces({
    document: doc,
    window: doc.defaultView,
    getStorage: () => storage,
  });
  assert.equal(doc.body.dataset.menuPalette, 'field-kit');
  assert.equal(doc.body.dataset.menuOrnaments, 'rich');
  assert.equal(doc.body.dataset.uiSkin, 'fpv-field-kit');
  assert.deepEqual(writes, []);
  owner.destroy();
  assert.equal(doc.body.dataset.menuPalette, undefined);
  assert.equal(doc.body.dataset.menuOrnaments, undefined);
  assert.equal(doc.body.dataset.uiSkin, undefined);
});

test('supporting pages resolve Neon Arcade when no saved skin exists', () => {
  const doc = new Document();
  doc.body.dataset.fieldKitPage = 'recovery';
  const owner = attachFieldKitSurfaces({
    document: doc,
    window: doc.defaultView,
    getStorage: () => ({ getItem: () => null }),
  });
  assert.equal(doc.body.dataset.menuPalette, 'neon');
  assert.equal(doc.body.dataset.uiSkin, 'neon-arcade');
  owner.destroy();
});

test('Playground and profile recovery opt into the shared supporting skin', async () => {
  for (const [name, url, page] of [
    ['Playground', '../playground/index.html', 'playground'],
    ['Earlier profiles', '../profile-recovery.html', 'recovery'],
  ]) {
    const html = await readFile(new URL(url, import.meta.url), 'utf8');
    assert.match(html, new RegExp(`data-field-kit-page=["']${page}["']`), name);
    assert.match(html, /field-kit-surfaces\.css/, name);
    assert.match(
      html,
      /<script type="module" src="[^"']*field-kit-surfaces\.mjs"><\/script>/,
      name,
    );
  }
});
