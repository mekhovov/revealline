import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pages = [
  ['icon review', '../assets/field-kit/icons/review.html'],
  ['sprite review', '../assets/field-kit/sprites/review.html'],
];

test('Field Kit asset reviews consume the shared read-only UI skin', async () => {
  for (const [name, path] of pages) {
    const html = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(html, /class="field-kit field-kit-support"/, name);
    assert.match(html, /data-field-kit-page="asset-review"/, name);
    assert.match(html, /field-kit-surfaces\.css/, name);
    assert.match(html, /field-kit-surfaces\.mjs/, name);
    assert.match(html, /background:\s*var\(--fk-bg, #070b12\)/, name);
    assert.match(html, /color:\s*var\(--fk-text, #f3f0db\)/, name);
  }
});

test('asset review controls keep accessible targets and specimen geometry', async () => {
  const [icons, sprites] = await Promise.all(
    pages.map(([, path]) => readFile(new URL(path, import.meta.url), 'utf8')),
  );
  assert.match(icons, /button,\s*summary\s*{\s*min-height:\s*44px/s);
  assert.match(icons, /canvas\s*{\s*image-rendering:\s*pixelated/s);
  assert.match(sprites, /summary\s*{[^}]*min-height:\s*44px/s);
  assert.match(sprites, /\.big img\s*{\s*width:\s*192px;\s*height:\s*192px/s);
  assert.match(sprites, /\.native img\s*{\s*image-rendering:\s*pixelated/s);
});
