import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document } from './helpers/couch-dom.mjs';
import { attachFieldKitSurfaces } from '../ui/field-kit-surfaces.mjs';
import { MENU_STYLE_PREFERENCES_KEY } from '../menu-style-preferences.mjs';

const iconReviewURL = new URL('../assets/field-kit/icons/review.html', import.meta.url);

test('the icon review opts into the shared read-only UI skin', async () => {
  const html = await readFile(iconReviewURL, 'utf8');
  assert.match(html, /class="field-kit field-kit-support"/);
  assert.match(html, /data-field-kit-page="asset-review"/);
  assert.match(html, /field-kit-compiled\.css/);
  assert.match(html, /field-kit-surfaces\.css/);
  assert.match(html, /field-kit-surfaces\.mjs/);
  assert.match(html, /background:\s*var\(--fk-bg, #070b12\)/);
  assert.match(html, /color:\s*var\(--fk-text, #f3f0db\)/);
});

test('the icon review keeps accessible targets and exact pixel specimens', async () => {
  const html = await readFile(iconReviewURL, 'utf8');
  assert.match(html, /button,\s*summary\s*{\s*min-height:\s*44px/s);
  assert.match(html, /canvas\s*{\s*image-rendering:\s*pixelated/s);
});

test('the icon review host resolves saved appearance without writing preferences', () => {
  const stored = JSON.stringify({ palette: 'ukrainian', ornaments: 'rich' });
  const writes = [];
  const storage = {
    getItem: (key) => (key === MENU_STYLE_PREFERENCES_KEY ? stored : null),
    setItem: (...entry) => writes.push(entry),
  };
  const document = new Document();
  document.body.dataset.fieldKitPage = 'asset-review';
  const owner = attachFieldKitSurfaces({
    document,
    window: document.defaultView,
    getStorage: () => storage,
  });
  assert.equal(document.body.dataset.menuPalette, 'field-kit');
  assert.equal(document.body.dataset.menuOrnaments, 'rich');
  assert.equal(document.body.dataset.uiSkin, 'fpv-field-kit');
  assert.deepEqual(writes, []);
  owner.destroy();
});
