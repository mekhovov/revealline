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
  await readFile(path.join(root, 'docs/accessibility/text-scaling-duel-inventory.json'), 'utf8'),
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

test('Duel runtime-authored status and enemy statistics retain each responsive size at one factor', async (t) => {
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
        await readFile(path.join(root, 'game/couch/text-scaling.css'), 'utf8'),
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
              "html[data-text-scaling='versus'] body[data-text-size='extra-large'] " +
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

test('Duel entry and literal deferred closure preserve each baseline size and artwork exceptions', async () => {
  const html = await readFile(path.join(root, inventory.entry), 'utf8');
  assert.match(html, /data-text-scaling="versus"/);
  assert.match(html, /href="text-scaling.css"/);
  const other = await readFile(path.join(root, 'game/overflight/play.html'), 'utf8');
  assert.doesNotMatch(other, /data-text-scaling|href="text-scaling.css"/);
  const exceptions = new Set([
    'game/couch/couch.css font-size: 27px',
    'game/couch/couch.css font-size: 21px',
    'game/ui/journey-save-cue.css font-size: 1rem',
  ]);
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
  assert.equal(changed, 26);
  assert.deepEqual(seen, exceptions);
});

test('Duel enlarged layout binds actual native states and leaves hidden screens and board geometry to their owners', async () => {
  const sheet = await parsers.css.parse(
    await readFile(path.join(root, 'game/couch/text-scaling.css'), 'utf8'),
  );
  const rules = [];
  const visit = (nodes) => {
    for (const rule of nodes) {
      if (rule.type === 'css-atrule') visit(rule.nodes ?? []);
      if (rule.type !== 'css-rule') continue;
      rules.push(rule);
      assert.ok(
        rule.raws.selector.startsWith("html[data-text-scaling='versus']"),
        rule.raws.selector,
      );
      if (rule.nodes.some((node) => node.prop === 'display')) {
        if (
          /dialog|journey-chooser/.test(rule.raws.selector) &&
          !/journey-(?:cards|card|filter|search|footer|goal)/.test(rule.raws.selector)
        )
          assert.ok(rule.raws.selector.includes('[open]'));
        if (/race-options-panel|native-menu-utilities/.test(rule.raws.selector))
          assert.ok(rule.raws.selector.includes(':not([hidden])'));
      }
      assert.ok(rule.nodes.every((node) => node.prop !== 'transform'));
    }
  };
  visit(sheet.nodes);
  const declaration = (needle, prop) =>
    rules.find(
      (rule) =>
        rule.raws.selector.includes(needle) && rule.nodes.some((node) => node.prop === prop),
    );
  const grid = declaration('.pause-command-grid', 'grid-template-columns');
  assert.ok(
    normalize(grid.raws.selector).includes("[data-couch-status='paused'] #race-main:not([hidden])"),
  );
  assert.ok(normalize(grid.raws.selector).includes(':not([hidden])'));
  const pause = await parsers.css.parse(
    await readFile(path.join(root, 'game/ui/pause-menu.css'), 'utf8'),
  );
  const pauseGrids = pause.nodes.filter(
    (rule) =>
      rule.type === 'css-rule' &&
      rule.raws.selector.includes('.pause-command-grid') &&
      rule.nodes.some((node) => node.prop === 'grid-template-columns'),
  );
  assert.ok(pauseGrids.length > 0);
  assert.ok(pauseGrids.every((rule) => compare(rank(grid), rank(rule)) > 0));
  const footer = declaration('.continuous-result-actions', 'position');
  assert.ok(
    normalize(footer.raws.selector).includes(
      "[data-couch-status='finished'] #race-main:not([hidden])",
    ),
  );
  assert.equal(footer.nodes.find((node) => node.prop === 'position').value.text, 'static');
  const utility = declaration('.native-menu-utilities', 'grid-auto-flow');
  assert.equal(utility.nodes.find((node) => node.prop === 'grid-auto-flow').value.text, 'row');
  const settings = declaration('#race-options-panel.native-settings', 'display');
  assert.equal(settings.nodes.find((node) => node.prop === 'display').value.text, 'block');
  // The Duel settings owner is a hidden section, not Snake's open dialog.
  assert.ok(!settings.raws.selector.includes('[open]'));
});

test('Duel active and result-review layout contains the actual compact song and seat readout owners', async () => {
  const rulesOf = async (file) => {
    const collect = (nodes, media = '', layer = '') =>
      nodes.flatMap((rule) => {
        if (rule.type === 'css-atrule')
          return collect(
            rule.nodes ?? [],
            rule.name === 'media' ? rule.raws.params : media,
            rule.name === 'layer' ? rule.raws.params : layer,
          );
        return rule.type === 'css-rule' ? [{ rule, media, layer }] : [];
      });
    return collect((await parsers.css.parse(await readFile(path.join(root, file), 'utf8'))).nodes);
  };
  const originals = await rulesOf('game/couch/couch.css');
  const handheld = await rulesOf('game/ui/handheld-play.css');
  const enlarged = await rulesOf('game/couch/text-scaling.css');
  const value = (rule, property) => rule.nodes.find((node) => node.prop === property)?.value.text;
  const actualApp = originals.find(
    ({ rule }) => rule.raws.selector === 'body.race-focus #couch-app',
  );
  assert.equal(value(actualApp.rule, 'display'), 'grid');
  assert.equal(
    value(actualApp.rule, 'grid-template-columns'),
    undefined,
    'Original columns are implicit.',
  );
  const app = enlarged.find(
    ({ rule }) =>
      value(rule, 'grid-template-columns') === 'minmax(0, 1fr)' &&
      rule.raws.selector.endsWith('#couch-app'),
  );
  assert.ok(app);
  assert.equal(app.layer, '', 'The explicit column overrides the legacy implicit track.');
  assert.equal(value(app.rule, 'max-inline-size'), '100%');
  assert.ok(app.rule.raws.selector.includes('.race-focus'));
  assert.ok(
    !app.rule.raws.selector.includes('data-couch-status'),
    'Running and earned-board review share the real race-focus owner.',
  );
  const html = await readFile(path.join(root, 'game/couch/index.html'), 'utf8');
  assert.match(html, /<div class="racer-readouts">\s*<p id="racer-stats-0" class="racer-stats"/);
  const containment = enlarged.find(
    ({ rule }) =>
      rule.raws.selector.includes('.racer-readouts') && value(rule, 'min-inline-size') === '0',
  );
  for (const selector of ['.race-hud', '.race-boards', '.racer', '.racer-stats'])
    assert.ok(containment.rule.raws.selector.includes(selector));
  assert.equal(value(containment.rule, 'max-inline-size'), '100%');
  const stats = enlarged.find(
    ({ rule }) => rule.raws.selector.endsWith('.racer-stats') && value(rule, 'white-space'),
  );
  assert.equal(value(stats.rule, 'white-space'), 'normal');
  assert.equal(value(stats.rule, 'overflow-wrap'), 'anywhere');
  const compact = '#race-pause.compact-track-pause';
  const before = handheld.find(
    ({ rule }) => rule.raws.selector.includes(compact + '::after') && value(rule, 'white-space'),
  );
  assert.equal(value(before.rule, 'white-space'), 'nowrap');
  assert.equal(value(before.rule, 'overflow'), 'hidden');
  const caption = enlarged.find(({ rule }) => rule.raws.selector.endsWith(compact + '::after'));
  assert.equal(caption.layer, '');
  assert.equal(value(caption.rule, 'white-space'), 'normal');
  assert.equal(value(caption.rule, 'overflow'), 'visible');
  assert.equal(value(caption.rule, 'overflow-wrap'), 'anywhere');
  assert.equal(
    before.layer,
    'legacy',
    'Unlayered wrapping takes precedence over the shared compact rule.',
  );
  const button = enlarged.find(
    ({ rule }) => rule.raws.selector.endsWith(compact) && value(rule, 'flex-shrink'),
  );
  assert.equal(value(button.rule, 'flex-shrink'), '1');
  const narrow = enlarged.find(
    ({ rule }) => rule.raws.selector.endsWith(compact) && value(rule, 'flex-basis'),
  );
  assert.equal(narrow.media.replace(/\s/g, ''), '(max-width:700px)');
  assert.equal(value(narrow.rule, 'flex-basis'), '100%');
  assert.equal(value(narrow.rule, 'inline-size'), '100%');
  for (const { rule } of [app, containment, stats, caption, button, narrow]) {
    assert.ok(rule.raws.selector.includes("[data-text-scaling='versus']"));
    assert.ok(rule.raws.selector.includes("[data-text-size='extra-large']"));
    assert.ok(
      rule.nodes.every((node) => !['display', 'font-size', 'transform'].includes(node.prop)),
      'Retain hidden ownership, enlarged text, and bitmap geometry.',
    );
  }
  // This regression binds the intrinsic-size causes and real owners. Browser
  // review still measures overflow, readable wrapping and complete board fit.
});

test('live theme projection matches the Duel capability and keeps other hosts on Large', async (t) => {
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
    if (qualified) document.documentElement.dataset.textScaling = 'versus';
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
