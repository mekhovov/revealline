import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { canvasTextFonts } from '../text-face.mjs';

const fonts = new URL('../ui/fonts/', import.meta.url);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('Tiny5 keeps its exact vendored provenance, license and Ukrainian glyph metadata', async () => {
  const provenance = JSON.parse(await readFile(new URL('provenance.json', fonts), 'utf8'));
  assert.equal(provenance.family, 'Tiny5');
  assert.equal(provenance.designer, 'Stefan Schmidt');
  assert.equal(provenance.license, 'SIL Open Font License 1.1');
  assert.equal(provenance.unmodified, true);
  for (const record of provenance.files) {
    const bytes = await readFile(new URL(record.file, fonts));
    assert.equal(bytes.length, record.bytes, record.file);
    assert.equal(digest(bytes), record.sha256, record.file);
  }
  const metadata = await readFile(new URL('METADATA.pb', fonts), 'utf8');
  assert.match(metadata, /subsets: "cyrillic"/);
  assert.match(metadata, /subsets: "cyrillic-ext"/);
  assert.match(metadata, /post_script_name: "Tiny5-Regular"/);
  assert.match(await readFile(new URL('OFL.txt', fonts), 'utf8'), /SIL OPEN FONT LICENSE/);
});

test('the shared shell self-hosts Tiny5 and Plain remains a complete accessibility override', async () => {
  const css = await readFile(new URL('../ui/field-kit-fonts.css', import.meta.url), 'utf8');
  assert.match(css, /font-family: 'Reveal Line Pixel'/);
  assert.match(css, /url\('\.\/fonts\/Tiny5-Regular\.ttf'\)/);
  assert.doesNotMatch(css, /https?:\/\//);
  const tokens = await readFile(new URL('../ui/field-kit-tokens.css', import.meta.url), 'utf8');
  assert.match(tokens, /--fk-font-pixel: 'Reveal Line Pixel'/);
  assert.match(tokens, /--fk-font-display: var\(--fk-font-pixel\)/);
  assert.match(tokens, /--pixel-font: var\(--fk-font-pixel\)/);
  assert.match(
    tokens,
    /body\.field-kit:not\(\[data-text-face='plain'\]\)[\s\S]*--fk-font-display: var\(--fk-font-pixel\)/,
  );
  assert.match(
    tokens,
    /\[data-text-face='plain'\][\s\S]*--fk-font-pixel:[\s\S]*system-ui[\s\S]*!important/,
  );
});

test('pixel canvas labels use Tiny5 while counters and Plain keep readable independent faces', () => {
  const theme = { ui: 'Theme UI', numeric: 'Theme Numeric' };
  assert.deepEqual(canvasTextFonts('pixel', theme), {
    ui: "'Reveal Line Pixel', 'Field Kit UI', system-ui, sans-serif",
    numeric: 'Theme Numeric',
  });
  assert.deepEqual(canvasTextFonts('pixel'), {
    ui: "'Reveal Line Pixel', 'Field Kit UI', system-ui, sans-serif",
    numeric: "'Field Kit Mono', ui-monospace, monospace",
  });
  assert.deepEqual(canvasTextFonts('plain', theme), {
    ui: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    numeric: 'ui-monospace, "SFMono-Regular", Consolas, monospace',
  });
});
