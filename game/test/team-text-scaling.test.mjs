import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parsers } from 'prettier/plugins/postcss';
import { Document, Events } from './helpers/couch-dom.mjs';
import {
  createContinuousPlayController,
  mountContinuousPlayControls,
} from '../ui/continuous-play.mjs';
import { createDisplayPreferences, DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
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
const root = path.resolve(import.meta.dirname, '../..');
const inventory = JSON.parse(
  await readFile(path.join(root, 'docs/accessibility/text-scaling-team-inventory.json'), 'utf8'),
);
inventory.runtimeStyles = [
  { styleId: 'continuous-play-style', absoluteCount: 1 },
  { styleId: 'enemy-stats-shared-style', absoluteCount: 5 },
];
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

test('Team runtime-authored status and enemy statistics retain each responsive size at one factor', async (t) => {
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
        await readFile(path.join(root, 'game/couch/team-text-scaling.css'), 'utf8'),
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
              "html[data-text-scaling='team'] body[data-text-size='extra-large'] " +
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

test('Team entry and literal deferred closure preserve each baseline size and artwork exceptions', async () => {
  const html = await readFile(path.join(root, inventory.entry), 'utf8');
  assert.match(html, /data-text-scaling="team"/);
  assert.match(html, /href="team-text-scaling.css"/);
  const other = await readFile(path.join(root, 'game/overflight/play.html'), 'utf8');
  assert.doesNotMatch(other, /data-text-scaling|href="team-text-scaling.css"/);
  const exceptions = new Set(['game/ui/journey-save-cue.css font-size: 1rem']);
  const seen = new Set();
  let changed = 0;
  for (const { path: file, absoluteDeclarations: baseline } of inventory.styles) {
    const current = declarations(await readFile(path.join(root, file), 'utf8'));
    assert.equal(current.length, baseline.length, `${file}: refresh the inventory`);
    for (let index = 0; index < current.length; index++) {
      const { property, value } = current[index],
        before = baseline[index];
      const key = `${file} ${property}: ${value}`;
      if (exceptions.has(key)) {
        seen.add(key);
        continue;
      }
      assert.equal(
        (value.match(/--primary-text-scale/g) ?? []).length,
        1,
        `${file} ${property}: ${value}`,
      );
      if (!before.alreadyWrapped) {
        assert.equal(value, normalize(`calc(${before.value} * var(--primary-text-scale, 1))`));
        changed++;
      } else assert.equal(value, normalize(before.value));
    }
  }
  assert.equal(changed, 45);
  assert.deepEqual(seen, exceptions);
});

test('live theme projection matches the Team capability and keeps other hosts on Large', async (t) => {
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
    if (qualified) document.documentElement.dataset.textScaling = 'team';
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

test('Team reflow preserves its real div overlay, modal settings and hidden preview ownership', async () => {
  const sheet = await parsers.css.parse(
    await readFile(path.join(root, 'game/couch/team-text-scaling.css'), 'utf8'),
  );
  const rules = [];
  const walk = (nodes) => {
    for (const rule of nodes) {
      if (rule.type === 'css-atrule') walk(rule.nodes ?? []);
      if (rule.type !== 'css-rule') continue;
      rules.push(rule);
      assert.ok(rule.raws.selector.startsWith("html[data-text-scaling='team']"));
      assert.ok(rule.nodes.every((node) => node.prop !== 'transform'));
      if (
        rule.nodes.some((node) => node.prop === 'display') &&
        /#coop-options|dialog\[open\]/.test(rule.raws.selector)
      )
        assert.ok(rule.raws.selector.includes('[open]'));
    }
  };
  walk(sheet.nodes);
  const find = (selector, prop) =>
    rules.find(
      (rule) =>
        rule.raws.selector.includes(selector) && rule.nodes.some((node) => node.prop === prop),
    );
  const overlay = find('#coop-overlay:not([hidden])', 'overflow');
  assert.equal(overlay.nodes.find((node) => node.prop === 'overflow').value.text, 'auto');
  assert.ok(!overlay.raws.selector.includes('[open]'), 'The overlay is a hidden div, not a dialog');
  const settings = find('#coop-options.native-settings[open]', 'overflow');
  assert.equal(settings.nodes.find((node) => node.prop === 'overflow').value.text, 'auto');
  const grid = find('.pause-command-grid', 'grid-template-columns');
  assert.ok(
    normalize(grid.raws.selector).includes("[data-coop-paused='true'] #coop-overlay:not([hidden])"),
  );
  const shared = await parsers.css.parse(
    await readFile(path.join(root, 'game/ui/pause-menu.css'), 'utf8'),
  );
  const ordinary = shared.nodes.filter(
    (rule) =>
      rule.type === 'css-rule' &&
      rule.raws.selector.includes('.pause-command-grid') &&
      rule.nodes.some((node) => node.prop === 'grid-template-columns'),
  );
  assert.ok(ordinary.length > 0);
  assert.ok(ordinary.every((rule) => compare(rank(grid), rank(rule)) > 0));
  const footer = find('.continuous-result-actions', 'position');
  assert.ok(footer.raws.selector.includes(':not([hidden])'));
  assert.equal(footer.nodes.find((node) => node.prop === 'position').value.text, 'static');
  const utility = find('.native-menu-utilities', 'grid-auto-flow');
  assert.equal(utility.nodes.find((node) => node.prop === 'grid-auto-flow').value.text, 'row');
  const entry = await readFile(path.join(root, 'game/couch/relay-rescue.html'), 'utf8');
  assert.match(entry, /<div class="setup coop-arena-choice">/);
  assert.ok(find('#coop-menu .setup', 'grid-template-columns'));
  const handheld = await parsers.css.parse(
    await readFile(path.join(root, 'game/ui/handheld-play.css'), 'utf8'),
  );
  const legacy = [];
  const collect = (nodes) => {
    for (const rule of nodes) {
      if (rule.type === 'css-atrule') collect(rule.nodes ?? []);
      if (rule.type === 'css-rule') legacy.push(rule);
    }
  };
  collect(handheld.nodes);
  const value = (rule, prop) => rule.nodes.find((node) => node.prop === prop)?.value.text;
  assert.ok(
    legacy.some(
      (rule) =>
        rule.raws.selector.endsWith('.board-footer') && value(rule, 'display') === 'contents',
    ),
    'The actual compact footer releases its box while its Pause floats.',
  );
  assert.ok(
    legacy.some(
      (rule) => rule.raws.selector.endsWith('#coop-pause') && value(rule, 'position') === 'fixed',
    ),
  );
  const flowingFooter = find('.board-footer:not([hidden])', 'display');
  assert.ok(flowingFooter.raws.selector.includes(':has(#coop-overlay[hidden])'));
  assert.equal(value(flowingFooter, 'display'), 'flex');
  assert.equal(value(find('#coop-pause.compact-track-pause', 'position'), 'position'), 'static');
  const caption = find('#coop-pause.compact-track-pause::after', 'white-space');
  assert.equal(value(caption, 'white-space'), 'normal');
  assert.equal(value(caption, 'overflow-wrap'), 'anywhere');
  assert.equal(value(caption, 'overflow'), 'visible');
  assert.equal(value(find('.hud', 'margin-inline-end'), 'margin-inline-end'), '0');
  assert.equal(value(find('.hud .team-status', 'padding-inline-end'), 'padding-inline-end'), '0');
  assert.ok(
    find('.coop-board-slot,', 'min-block-size'),
    'The actual slot keeps space when its arena-wrap is display:contents.',
  );
  const help = find('#coop-help-reading', 'block-size');
  assert.equal(help.nodes.find((node) => node.prop === 'overflow').value.text, 'auto');
  for (const selector of ['#coop-earned-picture[open]', '#coop-discovery-dialog[open]'])
    assert.ok(find(selector, 'block-size'));
});
