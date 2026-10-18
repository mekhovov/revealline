import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { parsers } from 'prettier/plugins/postcss';

// Finite selector/cascade check for this opt-in sheet, not browser layout or
// visibility qualification. Parse the actual markup and CSS; do not duplicate
// the affected production selectors or assume :is() has uniform specificity.
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await parsers.css.parse(
  await readFile(new URL('../ui/solo-text-scaling.css', import.meta.url), 'utf8'),
);
// The briefing owner uses data-kind selectors inside the legacy cascade layer,
// rather than [hidden] on every section. Include that actual rule as the lower
// layer so the regression observes the production ownership boundary.
const legacy = await parsers.css.parse(
  await readFile(new URL('../ui/device-controls.css', import.meta.url), 'utf8'),
);
const readerLayouts = await Promise.all(
  ['flight-information-details.css', 'mission-brief.css'].map(async (file) =>
    parsers.css.parse(await readFile(new URL(`../ui/${file}`, import.meta.url), 'utf8')),
  ),
);
const theme = await parsers.css.parse(
  await readFile(new URL('../ui/pixel-theme.css', import.meta.url), 'utf8'),
);
function descendants(nodes) {
  return nodes.flatMap((node) => [node, ...descendants(node.nodes ?? [])]);
}
const stateRules = descendants(legacy.nodes).filter(
  (rule) =>
    rule.type === 'css-rule' &&
    rule.raws.selector?.includes('.pause-secondary-groups') &&
    rule.nodes.some((node) => node.prop === 'display' && node.value.text === 'none'),
);
assert.equal(stateRules.length, 1, 'Use the actual legacy pause/briefing visibility owner.');
const headingRules = descendants(theme.nodes).filter(
  (rule) =>
    rule.type === 'css-rule' &&
    rule.raws.selector === '.game-shell .shell-dialog-heading' &&
    rule.nodes.some((node) => node.prop === 'position' && node.value.text === 'sticky'),
);
assert.equal(headingRules.length, 1, 'Use the actual theme sticky dialog heading owner.');
function elements(node) {
  return [node, ...(node.childNodes ?? []).flatMap(elements)].filter((item) => item.tagName);
}
const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
function setAttr(node, name, value) {
  node.attrs = node.attrs.filter((item) => item.name !== name);
  if (value !== null) node.attrs.push({ name, value });
}
function classed(node, name) {
  return (attr(node, 'class') ?? '').split(/\s+/).includes(name);
}
function matches(nodes, element) {
  if (!element?.tagName) return false;
  const index = nodes.findLastIndex((node) => node.type === 'selector-combinator');
  if (index >= 0) {
    if (!matches(nodes.slice(index + 1), element)) return false;
    const relation = nodes[index].value.trim();
    assert.ok(['', '>'].includes(relation), `Supported fixture relation: ${relation}`);
    for (let parent = element.parentNode; parent; parent = parent.parentNode) {
      if (matches(nodes.slice(0, index), parent)) return true;
      if (relation === '>') break;
    }
    return false;
  }
  return nodes.every((node) => {
    switch (node.type) {
      case 'selector-tag':
        return element.tagName === node.value;
      case 'selector-universal':
        return true;
      case 'selector-id':
        return attr(element, 'id') === node.value;
      case 'selector-class':
        return classed(element, node.value);
      case 'selector-attribute':
        assert.ok([undefined, '='].includes(node.operator));
        return node.operator === '='
          ? attr(element, node.attribute) === (node.raws?.unquoted ?? node.value)
          : attr(element, node.attribute) !== undefined;
      case 'selector-pseudo': {
        assert.ok([':is', ':where', ':not'].includes(node.value));
        const any = node.nodes.some((selector) => matches(selector.nodes, element));
        return node.value === ':not' ? !any : any;
      }
      default:
        assert.fail(`Unsupported fixture selector ${node.type}`);
    }
  });
}
function compare(a, b) {
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}
function specificity(nodes) {
  return nodes.reduce(
    (total, node) => {
      let value = [0, 0, 0];
      if (node.type === 'selector-id') value = [1, 0, 0];
      if (['selector-class', 'selector-attribute'].includes(node.type)) value = [0, 1, 0];
      if (node.type === 'selector-tag') value = [0, 0, 1];
      if (node.type === 'selector-pseudo' && node.value !== ':where')
        value = node.nodes
          .map((selector) => specificity(selector.nodes))
          .sort(compare)
          .at(-1);
      return total.map((count, index) => count + value[index]);
    },
    [0, 0, 0],
  );
}
function computed(element, property, width) {
  let winner = null;
  function visit(nodes, layer) {
    for (const rule of nodes) {
      if (rule.type === 'css-atrule') {
        if (rule.name === 'layer') {
          assert.equal(rule.params, 'legacy');
          visit(rule.nodes, layer);
        } else {
          assert.equal(rule.name, 'media');
          const limit = rule.params.value.match(/^\(max-width:\s*(\d+)px\)$/);
          assert.ok(limit, 'These finite sheets have only max-width breakpoints.');
          if (width <= Number(limit[1])) visit(rule.nodes, layer);
        }
      }
      if (rule.type !== 'css-rule') continue;
      const declaration = rule.nodes.find((node) => node.prop === property);
      if (!declaration) continue;
      for (const selector of rule.selector.nodes) {
        if (!matches(selector.nodes, element)) continue;
        const rank = [layer, ...specificity(selector.nodes)];
        if (!winner || compare(rank, winner.rank) >= 0)
          winner = { rank, value: declaration.value.text };
      }
    }
  }
  visit([...stateRules, ...headingRules, ...readerLayouts.flatMap((sheet) => sheet.nodes)], 0);
  visit(css.nodes, 1);
  return (
    winner?.value ??
    (property === 'display' && attr(element, 'hidden') !== undefined ? 'none' : undefined)
  );
}
function page() {
  const nodes = elements(parse(html));
  const byId = (id) => nodes.find((node) => attr(node, 'id') === id);
  const root = nodes.find((node) => node.tagName === 'html');
  const body = nodes.find((node) => node.tagName === 'body');
  assert.equal(attr(root, 'data-text-scaling'), 'solo');
  // mountGameShell adds this class before showing the actual overlays.
  setAttr(body, 'class', `${attr(body, 'class') ?? ''} game-shell`);
  setAttr(body, 'data-text-size', 'extra-large');
  setAttr(byId('game-overlay'), 'data-kind', 'pause');
  return { nodes, byId, root, body };
}

test('hidden pause sections remain hidden throughout briefing/pause visibility changes', () => {
  const { byId, root, body } = page();
  const sections = elements(byId('game-overlay')).filter((node) =>
    ['overlay-actions', 'pause-menu-section', 'pause-secondary-groups'].some((name) =>
      classed(node, name),
    ),
  );
  assert.ok(sections.length >= 5, 'Exercise actual action, mission, sound and config containers.');
  for (const width of [320, 844]) {
    for (const section of sections) {
      setAttr(section, 'hidden', '');
      assert.equal(computed(section, 'display', width), 'none');
      setAttr(section, 'hidden', null);
      assert.equal(computed(section, 'display', width), 'grid');
      setAttr(section, 'hidden', '');
      assert.equal(computed(section, 'display', width), 'none');
    }
  }
  for (const [owner, value] of [
    [body, 'large'],
    [root, 'unqualified'],
  ]) {
    setAttr(body, 'data-text-size', 'extra-large');
    setAttr(root, 'data-text-scaling', 'solo');
    setAttr(owner, owner === root ? 'data-text-scaling' : 'data-text-size', value);
    for (const section of sections) {
      setAttr(section, 'hidden', null);
      assert.equal(
        computed(section, 'display', 320),
        undefined,
        'No extra-large opt-in rule leaks.',
      );
    }
  }
});

test('all compact pause action variants win the cascade with a single column', () => {
  const { nodes } = page();
  const grids = nodes.filter((node) => classed(node, 'pause-action-grid'));
  assert.ok(grids.length >= 3, 'Use real mission, sound and config action grids.');
  for (const grid of grids) {
    for (const type of ['pause-action-grid', 'pause-command-grid']) {
      setAttr(grid, 'class', type);
      for (const group of [null, 'missions']) {
        setAttr(grid.parentNode, 'data-pause-group', group);
        assert.equal(computed(grid, 'grid-template-columns', 844), 'repeat(2, minmax(0, 1fr))');
        for (const width of [320, 390, 640])
          assert.equal(computed(grid, 'grid-template-columns', width), 'minmax(0, 1fr)');
      }
    }
  }
});

test('pause-only containers respect actual legacy briefing and result visibility ownership', () => {
  const { byId } = page();
  const overlay = byId('game-overlay');
  const within = elements(overlay);
  const sections = [
    ...within.filter((node) => classed(node, 'pause-secondary-groups')),
    ...within.filter((node) => classed(node, 'pause-menu-section')),
  ];
  for (const width of [320, 844]) {
    for (const kind of ['ready', 'pause', 'won', 'lost', 'ready']) {
      setAttr(overlay, 'data-kind', kind);
      for (const section of sections) {
        setAttr(section, 'hidden', null);
        const expected =
          kind === 'pause'
            ? 'grid'
            : kind === 'ready' && classed(section, 'pause-missions-section')
              ? undefined
              : 'none';
        assert.equal(
          computed(section, 'display', width),
          expected,
          `${kind}/${width}: ${attr(section, 'class')}`,
        );
      }
    }
  }
});

test('ordinary and earned results give enlarged copy the full reading width', () => {
  const { byId } = page();
  const overlay = byId('game-overlay'),
    reading = byId('overlay-reading');
  const card = byId('overlay-reading-unit'),
    picture = byId('result-picture');
  setAttr(overlay, 'data-kind', 'won');
  for (const earned of [null, 'true']) {
    setAttr(card, 'data-earned-result-layout', earned);
    for (const width of [320, 390, 844, 1280]) {
      assert.equal(computed(reading, 'display', width), 'flex');
      assert.equal(computed(reading, 'flex-direction', width), 'column');
      for (const node of reading.childNodes.filter((child) => child.tagName)) {
        assert.equal(computed(node, 'grid-column', width), 'auto');
        assert.equal(computed(node, 'grid-row', width), 'auto');
        assert.equal(computed(node, 'max-inline-size', width), '100%');
      }
      setAttr(picture, 'hidden', '');
      assert.equal(computed(picture, 'display', width), 'none');
      setAttr(picture, 'hidden', null);
      assert.equal(computed(picture, 'inline-size', width), '100%');
    }
  }
});

test('enlarged Field details and Mission brief retain useful readers outside header flex pressure', () => {
  const { byId, root, body } = page();
  const details = byId('flight-details-dialog'),
    brief = byId('shell-missions'),
    slot = byId('shell-brief-content'),
    briefUnit = byId('mission-brief-unit');
  setAttr(details, 'open', '');
  setAttr(brief, 'open', '');
  setAttr(brief, 'data-view', 'brief');
  setAttr(slot, 'hidden', null);
  // mountGameShell moves the existing reader into this slot for direct briefing.
  briefUnit.parentNode.childNodes = briefUnit.parentNode.childNodes.filter(
    (node) => node !== briefUnit,
  );
  briefUnit.parentNode = slot;
  slot.childNodes.push(briefUnit);
  const heading = elements(brief).find((node) => classed(node, 'shell-dialog-heading')),
    actions = elements(brief).find((node) => classed(node, 'shell-mission-actions'));
  for (const width of [320, 390, 844, 1280]) {
    for (const dialog of [details, brief]) {
      assert.equal(computed(dialog, 'display', width), 'block');
      assert.equal(computed(dialog, 'block-size', width), 'auto');
      assert.equal(computed(dialog, 'overflow', width), 'auto');
    }
    for (const unit of [byId('flight-details-unit'), briefUnit, slot])
      assert.equal(computed(unit, 'display', width), 'block');
    for (const reader of [byId('flight-details-reading'), byId('mission-brief-reading')]) {
      assert.equal(computed(reader, 'flex', width), 'none');
      assert.equal(computed(reader, 'min-block-size', width), '16rem');
      assert.equal(
        computed(reader, 'block-size', width),
        'clamp(16rem, calc(var(--dialog-viewport-height, 100dvh) * 0.6), 32rem)',
      );
      assert.equal(computed(reader, 'overflow', width), 'auto');
    }
    assert.equal(computed(heading, 'grid-template-columns', width), 'minmax(0, 1fr)');
    assert.equal(computed(heading, 'position', width), 'static');
    assert.equal(computed(actions, 'inline-size', width), '100%');
    setAttr(slot, 'hidden', '');
    assert.equal(computed(slot, 'display', width), 'none');
    setAttr(slot, 'hidden', null);
    setAttr(brief, 'data-view', 'catalogue');
    assert.equal(computed(heading, 'position', width), 'sticky');
    setAttr(brief, 'data-view', 'brief');
  }
  for (const [owner, name, value] of [
    [body, 'data-text-size', 'large'],
    [root, 'data-text-scaling', 'unqualified'],
  ]) {
    setAttr(body, 'data-text-size', 'extra-large');
    setAttr(root, 'data-text-scaling', 'solo');
    setAttr(owner, name, value);
    assert.equal(computed(details, 'display', 320), 'flex');
    assert.equal(computed(brief, 'display', 320), 'flex');
    assert.equal(computed(byId('flight-details-reading'), 'min-height', 320), '64px');
    assert.equal(computed(byId('flight-details-reading'), 'min-block-size', 320), undefined);
    assert.equal(computed(heading, 'position', 320), 'sticky');
  }
});
