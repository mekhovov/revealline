import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parsers } from 'prettier/plugins/postcss';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createDisplayPreferences, DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const inventory = JSON.parse(
  await readFile(path.join(root, 'docs/accessibility/text-scaling-snake-inventory.json'), 'utf8'),
);
const glyphs = new Set([
  'game/ui/touch-controls-view.css font: 54px/1.3 var(--fk-font-ui, sans-serif)',
  'game/ui/touch-controls-view.css font: bold 25px/1 var(--fk-font-ui, sans-serif)',
]);
const normalize = (text) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .trim();
const absolute = (value) =>
  /(?:\d(?:px|rem|vw|vh)|var\(--(?:fk-text|iw-text|native-action|handheld-|reaction-caption))/.test(
    value,
  );
function declarations(css) {
  return [...css.matchAll(/(?<![\w-])(font-size|font|line-height)\s*:\s*([^;{}]+);/g)]
    .filter(([, , value]) => absolute(value))
    .map(([, property, value]) => ({ property, value: normalize(value) }));
}

test('live theme projection matches the Snake capability and keeps other hosts on Large', async (t) => {
  for (const qualified of [true, false]) {
    const document = new Document(),
      window = new Events(),
      records = new Map([
        [
          DISPLAY_PREFERENCES_KEY,
          JSON.stringify({ textFace: 'plain', textSize: 'extra-large', reducedEffects: false }),
        ],
      ]),
      writes = [],
      storage = {
        getItem: (key) => records.get(key) ?? null,
        setItem: (key, value) => {
          writes.push(key);
          records.set(key, value);
        },
      };
    if (qualified) document.documentElement.dataset.textScaling = 'snake';
    const display = createDisplayPreferences({
      window,
      getStorage: () => storage,
      extraLarge: qualified,
    });
    const stop = display.subscribe((choice) => {
      document.body.dataset.textSize = choice.effectiveTextSize;
    });
    const host = installThemeHost({
      document,
      window,
      getStorage: () => storage,
      displayPreferences: display,
      prepareStyles: async () => {},
    });
    t.after(() => {
      host.dispose();
      stop();
      display.dispose();
    });
    await host.ready;
    assert.equal(
      document.documentElement.dataset.themeTextSize,
      qualified ? 'extra-large' : 'large',
    );
    assert.equal(
      document.documentElement.style.getPropertyValue('--iw-text-size'),
      qualified ? '16px' : '20px',
    );
    assert.deepEqual(writes, []);
    for (const textSize of ['standard', 'large', 'extra-large']) {
      display.set({ textSize });
      await host.ready;
      assert.equal(
        document.documentElement.dataset.themeTextSize,
        textSize === 'extra-large' && !qualified ? 'large' : textSize,
      );
      assert.equal(
        document.documentElement.style.getPropertyValue('--iw-text-size'),
        textSize === 'large' || (textSize === 'extra-large' && !qualified) ? '20px' : '16px',
      );
    }
    assert.ok(
      writes.every((key) => key === DISPLAY_PREFERENCES_KEY),
      'Only explicit display choices are written.',
    );
  }
});

test('Snake entry and recorded deferred style closure keep a single text factor and explicit glyph exceptions', async () => {
  const html = await readFile(path.join(root, inventory.entry), 'utf8');
  assert.match(html, /data-text-scaling="snake"/);
  assert.match(html, /href="text-scaling.css"/);
  const hub = await readFile(path.join(root, 'game/snake/index.html'), 'utf8');
  assert.doesNotMatch(hub, /data-text-scaling|href="text-scaling.css"/);
  const accepted = new Set(inventory.styles.map(({ path: file }) => file));
  accepted.add('game/snake/text-scaling.css');
  for (const [, href] of html.matchAll(/href="([^"?]+\.css)"/g))
    assert.ok(accepted.has(path.posix.normalize(`game/snake/${href}`)), `Inventory ${href}`);
  let count = 0;
  const seenGlyphs = new Set();
  for (const { path: file, absoluteDeclarations: baseline } of inventory.styles) {
    const css = await readFile(path.join(root, file), 'utf8');
    const current = declarations(css);
    assert.equal(current.length, baseline.length, `${file}: refresh the declaration inventory`);
    for (let index = 0; index < current.length; index++) {
      const { property, value } = current[index],
        before = baseline[index];
      const key = `${file} ${property}: ${value}`;
      if (glyphs.has(key)) {
        seenGlyphs.add(key);
        continue;
      }
      assert.ok(value.includes('--primary-text-scale'), `${file} ${property}: ${value}`);
      assert.equal(
        (value.match(/--primary-text-scale/g) ?? []).length,
        1,
        `${file}: no double multiplier`,
      );
      if (!before.alreadyWrapped) {
        const prior = normalize(before.value);
        const expected =
          property === 'font-size'
            ? `calc(${prior} * var(--primary-text-scale, 1))`
            : prior.replace(/(\d+(?:\.\d+)?(?:px|rem))/, 'calc($1 * var(--primary-text-scale, 1))');
        assert.equal(value, normalize(expected), `${file}: keep the Standard size and line height`);
        count++;
      }
    }
  }
  assert.equal(count, 41);
  assert.deepEqual(seenGlyphs, glyphs);
});

test('Snake reflow remains explicitly family-scoped and preserves hidden/open ownership', async () => {
  const sheet = await parsers.css.parse(
    await readFile(path.join(root, 'game/snake/text-scaling.css'), 'utf8'),
  );
  const visit = (nodes) => {
    for (const rule of nodes) {
      if (rule.type === 'css-atrule') visit(rule.nodes ?? []);
      if (rule.type !== 'css-rule') continue;
      const selector = rule.raws.selector;
      assert.ok(selector.startsWith("html[data-text-scaling='snake']"), selector);
      if (rule.nodes.some((declaration) => declaration.prop === 'display')) {
        // Settings layout and chooser structures are permanent containers;
        // stateful dialog/result/pause nodes must retain their visibility owner.
        if (/dialog|mode-play-home|mode-play-dialog|mode-settings-view\)\[open\]/.test(selector))
          assert.ok(selector.includes('[open]'), selector);
        if (/snake-result-primary|snake-result-overview|pause-command-grid/.test(selector))
          assert.ok(selector.includes(':not([hidden])'), selector);
      }
      for (const declaration of rule.nodes) {
        assert.notEqual(declaration.prop, 'transform', 'Text scaling cannot transform the board');
        if (declaration.prop === 'font-size')
          assert.equal(declaration.value.text, 'calc(1rem * var(--primary-text-scale, 1))');
      }
    }
  };
  visit(sheet.nodes);
});
