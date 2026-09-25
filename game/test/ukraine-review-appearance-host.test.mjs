import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pages = [
  ['role presentations', '../../authoring/library/ukraine-role-presentations/index.html'],
  ['wide variants', '../../authoring/library/ukraine-role-wide-variants/index.html'],
];

test('Ukrainian role reviews consume the shared read-only UI skin', async () => {
  for (const [name, path] of pages) {
    const html = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(html, /class="field-kit field-kit-support"/, name);
    assert.match(html, /data-field-kit-page="ukraine-role-review"/, name);
    assert.match(html, /field-kit-surfaces\.css/, name);
    assert.match(html, /field-kit-surfaces\.mjs/, name);
    assert.match(html, /var\(--fk-(?:bg|line|cyan)/, name);
  }
});

test('Ukrainian review controls and fixed comparison canvases keep their contracts', async () => {
  const [roles, variants] = await Promise.all(
    pages.map(([, path]) => readFile(new URL(path, import.meta.url), 'utf8')),
  );
  assert.match(roles, /button,\s*select\s*{[^}]*min-height:\s*44px/s);
  assert.match(roles, /canvas\s*{[^}]*width:\s*600px;[^}]*height:\s*190px/s);
  assert.match(roles, /image-rendering:\s*pixelated/);
  assert.match(variants, /select,\s*button\s*{[^}]*min-height:\s*44px/s);
  assert.match(variants, /canvas\s*{[^}]*width:\s*780px;[^}]*height:\s*215px/s);
});
