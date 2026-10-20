import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parsers } from 'prettier/plugins/postcss';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createDisplayPreferences, DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { mountModePlayShell } from '../ui/mode-play-shell.mjs';
import {
  createContinuousPlayController,
  mountContinuousPlayControls,
} from '../ui/continuous-play.mjs';
import { mountEnemyStats } from '../ui/enemy-stats.mjs';

const compare = (a, b) => {
  for (let index = 0; index < a.length; index++)
    if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
};
const specificity = (nodes) =>
  nodes.reduce(
    (rank, node) => {
      let next = [0, 0, 0];
      if (node.type === 'selector-id') next[0] = 1;
      if (['selector-class', 'selector-attribute'].includes(node.type)) next[1] = 1;
      if (node.type === 'selector-tag') next[2] = 1;
      if (
        node.type === 'selector-pseudo' &&
        ![':where', ':is', ':not', ':has'].includes(node.value)
      )
        next[1] = 1;
      if (node.type === 'selector-pseudo' && [':is', ':not', ':has'].includes(node.value))
        next = node.nodes
          .map((selector) => specificity(selector.nodes))
          .sort(compare)
          .at(-1);
      return rank.map((value, index) => value + next[index]);
    },
    [0, 0, 0],
  );
const rank = (rule) =>
  rule.selector.nodes
    .map((selector) => specificity(selector.nodes))
    .sort(compare)
    .at(-1);
const rules = (sheet, property) =>
  sheet.nodes.filter(
    (rule) => rule.type === 'css-rule' && rule.nodes.some((node) => node.prop === property),
  );

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
          assert.match(declaration.value.text, /^calc\(.+ \* var\(--primary-text-scale, 1\)\)$/);
      }
    }
  };
  visit(sheet.nodes);
});

test('compact Snake utilities override the real landing column placement without changing its fallback', async () => {
  const base = await parsers.css.parse(
    await readFile(path.join(root, 'game/ui/mode-choice.css'), 'utf8'),
  );
  const extra = await parsers.css.parse(
    await readFile(path.join(root, 'game/snake/text-scaling.css'), 'utf8'),
  );
  const flowRules = (sheet) =>
    sheet.nodes.filter(
      (rule) =>
        rule.type === 'css-rule' &&
        rule.raws.selector.includes('.mode-play-utilities') &&
        rule.nodes.some((declaration) => declaration.prop === 'grid-auto-flow'),
    );
  const ordinary = flowRules(base),
    enlarged = flowRules(extra);
  assert.equal(ordinary.length, 1, 'Read the actual shared landing placement owner.');
  assert.equal(
    ordinary[0].nodes.find((node) => node.prop === 'grid-auto-flow').value.text,
    'column',
  );
  assert.equal(enlarged.length, 1);
  assert.equal(enlarged[0].nodes.find((node) => node.prop === 'grid-auto-flow').value.text, 'row');
  const selector = enlarged[0].raws.selector;
  assert.ok(selector.includes("html[data-text-scaling='snake']"));
  assert.ok(selector.includes("body[data-text-size='extra-large']"));
  assert.ok(selector.includes(':not([hidden])'));
  // This source regression binds the demonstrated placement conflict. The
  // actual 320px browser check qualifies geometry and full label visibility.
});

test('Snake pause reflow outranks the actual shared ID branch without changing its visibility owner', async (t) => {
  const document = new Document();
  const shell = mountModePlayShell({ document, idPrefix: 'snake' });
  t.after(() => shell.dispose());
  assert.equal(shell.elements.dialogs.pause.id, 'snake-pause-dialog');
  assert.ok(shell.elements.dialogs.pause.querySelector('.shared-pause-menu .pause-command-grid'));
  const base = await parsers.css.parse(
    await readFile(path.join(root, 'game/ui/pause-menu.css'), 'utf8'),
  );
  const extra = await parsers.css.parse(
    await readFile(path.join(root, 'game/snake/text-scaling.css'), 'utf8'),
  );
  const originalGrids = rules(base, 'grid-template-columns').filter(
    (rule) =>
      rule.raws.selector.includes('.pause-command-grid') &&
      !rule.raws.selector.startsWith("body[data-text-size='large']"),
  );
  assert.equal(originalGrids.length, 4);
  assert.ok(
    originalGrids.every((rule) => rank(rule)[0] === 1),
    'The unmatched ID alternative still raises :is() specificity.',
  );
  const enlarged = rules(extra, 'grid-template-columns').find((rule) =>
    rule.raws.selector.includes('.pause-command-grid'),
  );
  assert.ok(enlarged.raws.selector.includes('#snake-pause-dialog'));
  assert.ok(enlarged.raws.selector.includes(':not([hidden])'));
  assert.ok(originalGrids.every((rule) => compare(rank(enlarged), rank(rule)) > 0));
  const nowrap = rules(base, 'white-space').find((rule) =>
    rule.nodes.some((node) => node.prop === 'white-space' && node.value.text === 'nowrap'),
  );
  const wrapped = rules(extra, 'white-space').find((rule) =>
    rule.raws.selector.includes("[data-pause-group='missions']"),
  );
  assert.equal(wrapped.nodes.find((node) => node.prop === 'white-space').value.text, 'normal');
  assert.ok(compare(rank(wrapped), rank(nowrap)) > 0);
});

test('enlarged Snake results release the actual nested scroll and sticky transition footer', async (t) => {
  const document = new Document();
  const shell = mountModePlayShell({ document, idPrefix: 'snake' });
  const dialog = shell.elements.dialogs.results;
  const footer = dialog.querySelector('footer');
  footer.classList.add('snake-result-actions', 'continuous-result-actions');
  const controller = createContinuousPlayController();
  const controls = mountContinuousPlayControls({ document, parent: footer, controller });
  t.after(() => {
    controls.dispose();
    controller.dispose();
    shell.dispose();
  });
  assert.equal(dialog.id, 'snake-results-dialog');
  assert.equal(footer.parentElement, dialog);
  assert.ok(dialog.querySelector('.mode-play-content'));
  const base = await parsers.css.parse(
    await readFile(path.join(root, 'game/snake/classic.css'), 'utf8'),
  );
  const runtime = await parsers.css.parse(
    document.getElementById('continuous-play-style').textContent,
  );
  const extra = await parsers.css.parse(
    await readFile(path.join(root, 'game/snake/text-scaling.css'), 'utf8'),
  );
  const originalContent = rules(base, 'overflow').find(
    (rule) => rule.raws.selector === '#snake-results-dialog > .mode-play-content',
  );
  const enlargedContent = rules(extra, 'overflow').find(
    (rule) =>
      rule.raws.selector.includes('#snake-results-dialog[open]') &&
      rule.raws.selector.includes('> .mode-play-content'),
  );
  assert.equal(originalContent.nodes.find((node) => node.prop === 'overflow').value.text, 'auto');
  assert.equal(
    enlargedContent.nodes.find((node) => node.prop === 'overflow').value.text,
    'visible',
  );
  assert.equal(enlargedContent.nodes.find((node) => node.prop === 'flex').value.text, 'none');
  assert.ok(compare(rank(enlargedContent), rank(originalContent)) > 0);
  const sticky = rules(runtime, 'position').find(
    (rule) => rule.raws.selector === '.continuous-result-actions',
  );
  const flowing = rules(extra, 'position').find(
    (rule) =>
      rule.raws.selector.includes('#snake-results-dialog[open]') &&
      rule.raws.selector.includes('.continuous-result-actions'),
  );
  assert.equal(sticky.nodes.find((node) => node.prop === 'position').value.text, 'sticky');
  assert.equal(flowing.nodes.find((node) => node.prop === 'position').value.text, 'static');
  assert.ok(compare(rank(flowing), rank(sticky)) > 0);
  assert.ok(flowing.raws.selector.includes(':not([hidden])'));
  for (const rule of [enlargedContent, flowing]) {
    assert.ok(rule.raws.selector.includes("html[data-text-scaling='snake']"));
    assert.ok(rule.raws.selector.includes("body[data-text-size='extra-large']"));
  }
  const outer = rules(extra, 'overflow').find((rule) =>
    rule.raws.selector.endsWith('dialog[open]'),
  );
  assert.equal(outer.nodes.find((node) => node.prop === 'overflow').value.text, 'auto');
  // These are the executed stylesheet owners and actual shell hierarchy. Browser
  // review must separately verify focus visibility and wheel/keyboard scrolling.
});

test('Snake runtime-authored status and enemy statistics retain each responsive size at one factor', async (t) => {
  const document = new Document();
  const parent = document.createElement('section');
  document.body.append(parent);
  const controller = createContinuousPlayController();
  const controls = mountContinuousPlayControls({ document, parent, controller });
  const totals = {
    total: 0,
    byGame: {},
    byFamily: {},
    run: { total: 0, byFamily: {} },
    durable: true,
  };
  const stats = mountEnemyStats({
    document,
    container: parent,
    stats: { subscribe: () => () => {}, totals: () => totals },
    variant: 'hud',
  });
  t.after(() => {
    stats.dispose();
    controls.dispose();
    controller.dispose();
  });
  const fonts = (nodes, media = '') =>
    nodes.flatMap((rule) => {
      if (rule.type === 'css-atrule')
        return fonts(rule.nodes ?? [], rule.raws.params.replace(/\s+/g, ''));
      if (rule.type !== 'css-rule') return [];
      return rule.nodes
        .filter((node) => node.prop === 'font-size' && absolute(node.value.text))
        .map((node) => ({ rule, media, value: node.value.text }));
    });
  const extra = fonts(
    (
      await parsers.css.parse(
        await readFile(path.join(root, 'game/snake/text-scaling.css'), 'utf8'),
      )
    ).nodes,
  );
  const compact = (text) => text.replace(/[\s'"]/g, '').replace(/(?<![\d])0\./g, '.');
  let count = 0;
  for (const { styleId, absoluteCount } of inventory.runtimeStyles) {
    const original = fonts(
      (await parsers.css.parse(document.getElementById(styleId).textContent)).nodes,
    );
    assert.equal(original.length, absoluteCount);
    for (const before of original) {
      const match = extra.find(
        (after) =>
          after.media === before.media &&
          compact(after.rule.raws.selector) ===
            compact(
              "html[data-text-scaling='snake'] body[data-text-size='extra-large'] " +
                before.rule.raws.selector,
            ),
      );
      assert.ok(match, `${styleId}: ${before.rule.raws.selector} ${before.media}`);
      assert.equal(
        compact(match.value),
        compact(`calc(${before.value} * var(--primary-text-scale, 1))`),
      );
      assert.ok(compare(rank(match.rule), rank(before.rule)) > 0);
      count++;
    }
  }
  assert.equal(count, 6);
});
