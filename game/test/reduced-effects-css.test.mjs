import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readCss = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('explicit reduced effects matches the Solo DOM motion contract without hiding state', async () => {
  const css = await readCss('../style.css');

  assert.match(css, /body\[data-effects='reduced'\] \*::before/);
  assert.match(css, /body\[data-effects='reduced'\] \*::after/);
  assert.match(css, /scroll-behavior:\s*auto !important/);
  assert.match(css, /transition:\s*none !important/);
  assert.match(css, /animation:\s*none !important/);
  assert.doesNotMatch(css, /body\[data-effects='reduced'\][^{]*\{[^}]*display:\s*none/s);
  assert.doesNotMatch(css, /body\[data-effects='reduced'\][^{]*\{[^}]*visibility:\s*hidden/s);
});

test('explicit reduced effects matches Versus and Team chrome without removing overlays', async () => {
  const css = await readCss('../couch/relay-rescue.css');

  assert.match(css, /body\[data-effects='reduced'\] \*::before/);
  assert.match(css, /body\[data-effects='reduced'\] \*::after/);
  assert.match(css, /body\[data-effects='reduced'\] \.overlay\s*\{\s*backdrop-filter:\s*none;/s);
  assert.doesNotMatch(css, /body\[data-effects='reduced'\] \.overlay\s*\{[^}]*display:\s*none/s);
});

test('explicit reduced effects disables smooth settings-panel scrolling', async () => {
  const css = await readCss('../ui/field-kit-surfaces.css');

  assert.match(
    css,
    /\.field-kit\[data-effects='reduced'\] \.field-kit-settings-panel\s*\{\s*scroll-behavior:\s*auto;/s,
  );
});
