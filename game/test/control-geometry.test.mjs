import test from 'node:test';
import assert from 'node:assert/strict';
import { captureControlGeometry } from '../playground/control-geometry.mjs';

function element(left, top, width = 44, height = 44, extra = {}) {
  return {
    rect: { left, top, right: left + width, bottom: top + height, width, height },
    disabled: false,
    textContent: 'Control',
    clientWidth: width - 2,
    clientHeight: height - 2,
    scrollWidth: width - 2,
    scrollHeight: height - 2,
    style: {
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      overflowX: 'visible',
      overflowY: 'visible',
    },
    getBoundingClientRect() {
      return this.rect;
    },
    getClientRects() {
      return this.rect.width && this.rect.height ? [this.rect] : [];
    },
    getAttribute(name) {
      return this.attributes?.[name] ?? null;
    },
    closest(selector) {
      assert.equal(selector, '[inert]');
      return this.inertAncestor || null;
    },
    ...extra,
  };
}
function environment() {
  const selectors = [
    '[data-move="up"]',
    '[data-move="left"]',
    '#stop-button',
    '[data-move="right"]',
    '[data-move="down"]',
    '#action-button',
    '#pickup-button',
    '#boost-button',
    '#pause-button',
    '#restart-button',
    '#sound-button',
  ];
  const elements = new Map(
    selectors.map((selector, index) => [selector, element(index * 50, 170)]),
  );
  elements.set('#arena-shell', element(0, 0, 600, 150));
  for (const selector of [
    '.play-controls',
    '.direction-controls',
    '.ability-buttons',
    '.utility-buttons',
  ])
    elements.set(selector, element(0, 170, 600, 140));
  const queries = [],
    lookups = [],
    document = {
      documentElement: { scrollWidth: 844, scrollHeight: 900 },
      querySelector(selector) {
        lookups.push(selector);
        return elements.get(selector) || null;
      },
    };
  const media = new Set([
    '(pointer: fine)',
    '(any-pointer: fine)',
    '(any-pointer: coarse)',
    '(hover: hover)',
  ]);
  const view = {
    innerWidth: 844,
    innerHeight: 390,
    devicePixelRatio: 2,
    scrollX: 0,
    scrollY: 120,
    visualViewport: { width: 844, height: 390, scale: 1, offsetLeft: 0, offsetTop: 0 },
    getComputedStyle(node) {
      return node.style;
    },
    matchMedia(query) {
      queries.push(query);
      return { matches: media.has(query) };
    },
  };
  const capture = () =>
    captureControlGeometry({
      document,
      view,
      requested: { width: 1280, height: 720 },
      displayScale: 0.5,
      capturedAt: '2026-09-12T12:00:00.000Z',
    });
  return { elements, document, view, capture, queries, lookups };
}

test('actual box intersections detect oversized children independently from their declared grid tracks', () => {
  const h = environment();
  for (const [selector, x, y] of [
    ['[data-move="up"]', 37, 170],
    ['[data-move="left"]', 0, 201],
    ['#stop-button', 37, 201],
    ['[data-move="right"]', 74, 201],
    ['[data-move="down"]', 37, 232],
  ])
    h.elements.set(selector, element(x, y));
  h.elements.get('.direction-controls').style = {
    display: 'grid',
    gridTemplateColumns: '34px 34px 34px',
    gridTemplateRows: '28px 28px 28px',
    columnGap: '3px',
    rowGap: '3px',
  };
  const result = h.capture();
  const horizontal = result.targetOverlaps.find(
    (pair) => pair.first === 'move-left' && pair.second === 'stop-button',
  );
  const vertical = result.targetOverlaps.find(
    (pair) => pair.first === 'move-up' && pair.second === 'stop-button',
  );
  assert.deepEqual(horizontal.intersection, { left: 37, top: 201, width: 7, height: 44 });
  assert.deepEqual(vertical.intersection, { left: 37, top: 201, width: 44, height: 13 });
  assert.equal(
    result.groups.find((group) => group.id === 'directions').layout.gridTemplateColumns,
    '34px 34px 34px',
  );
  assert.equal(result.summary.minimumWidth, 44);
  assert.ok(result.targetOverlaps.length > 0, 'Adequate sizes alone do not establish non-overlap.');
});

test('edge touching is not overlap; hidden boxes are omitted and disabled boxes remain explicitly labeled', () => {
  const h = environment();
  h.elements.set('[data-move="up"]', element(0, 170));
  h.elements.set('[data-move="left"]', element(44, 170));
  h.elements.set('#stop-button', element(0, 170, 44, 44, { disabled: true }));
  h.elements.set(
    '[data-move="right"]',
    element(0, 170, 44, 44, { style: { display: 'block', visibility: 'hidden', opacity: '1' } }),
  );
  h.elements.set('[data-move="down"]', element(0, 170, 0, 0));
  const result = h.capture();
  assert.ok(
    !result.targetOverlaps.some((pair) => pair.first === 'move-up' && pair.second === 'move-left'),
  );
  assert.equal(
    result.targetOverlaps.find((pair) => pair.first === 'move-up' && pair.second === 'stop-button')
      .bothEnabled,
    false,
  );
  assert.ok(
    result.targetOverlaps.every(
      (pair) =>
        ![pair.first, pair.second].includes('move-right') &&
        ![pair.first, pair.second].includes('move-down'),
    ),
  );
  assert.equal(result.summary.visibleTargets, 9);
  assert.equal(result.summary.enabledVisibleTargets, 8);
});

test('child CSS coordinates and actual media remain distinct from requested viewport and outer scale', () => {
  const h = environment();
  h.elements.set('#action-button', element(1.25, 169.5, 43.75, 44));
  h.elements.set('#sound-button', element(2, 400));
  h.document.documentElement.scrollWidth = 900;
  const result = h.capture();
  assert.deepEqual(result.requested, { width: 1280, height: 720 });
  assert.equal(result.viewport.width, 844);
  assert.equal(result.viewport.height, 390);
  assert.equal(result.viewport.scrollY, 120);
  assert.equal(result.displayScale, 0.5);
  assert.equal(result.viewport.devicePixelRatio, 2);
  assert.equal(result.controls.find((control) => control.id === 'action-button').rect.width, 43.75);
  assert.ok(
    result.summary.below44.includes('action-button'),
    'Fractional sizes are not rounded up into acceptance.',
  );
  assert.equal(
    result.controls.find((control) => control.id === 'sound-button').insideViewport,
    false,
  );
  assert.equal(result.summary.horizontalPageOverflow, true);
  assert.equal(result.media.pointerFine, true);
  assert.equal(result.media.pointerCoarse, false);
  assert.equal(result.media.anyPointerCoarse, true);
  assert.equal(h.queries.length, 7);
});

test('arena overlap and approximate content overflow are reported without inventing hit testing or mutating DOM', () => {
  const h = environment();
  h.elements.set(
    '#action-button',
    element(100, 140, 44, 44, {
      textContent: '<b>Original label</b>',
      scrollWidth: 90,
      scrollHeight: 42,
      inertAncestor: {},
    }),
  );
  const target = h.elements.get('#action-button'),
    before = structuredClone(target.rect);
  const result = h.capture();
  assert.deepEqual(result.arenaOverlaps, [
    {
      id: 'action-button',
      enabled: false,
      intersection: { left: 100, top: 140, width: 44, height: 10 },
    },
  ]);
  const action = result.controls.find((control) => control.id === 'action-button');
  assert.equal(action.label, '<b>Original label</b>');
  assert.equal(action.content.exceedsClientWidth, true);
  assert.equal(action.content.exceedsClientHeight, false);
  action.rect.left = -100;
  action.layout.display = 'none';
  assert.deepEqual(target.rect, before);
  assert.equal(
    h.capture().controls.find((control) => control.id === 'action-button').rect.left,
    100,
  );
  assert.equal(
    h.lookups.length,
    32,
    'Each capture reads only the finite arena/group/target selector set.',
  );
});

test('missing or malformed geometry is bounded and never reports Infinity as a measured size', () => {
  const h = environment();
  for (const [selector, target] of h.elements)
    if (selector !== '#arena-shell' && !selector.startsWith('.')) target.rect.width = NaN;
  h.elements.delete('#sound-button');
  h.view.visualViewport = null;
  const result = h.capture();
  assert.equal(result.controls.length, 11);
  assert.equal(result.summary.presentTargets, 10);
  assert.equal(result.summary.visibleTargets, 0);
  assert.equal(result.summary.minimumWidth, null);
  assert.equal(result.summary.minimumHeight, null);
  assert.equal(result.viewport.visualViewport, null);
  assert.ok(!JSON.stringify(result).includes('Infinity'));
  h.elements.delete('#arena-shell');
  assert.throws(h.capture, /solo practice preview/);
});
