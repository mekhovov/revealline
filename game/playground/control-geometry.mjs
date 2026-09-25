import { t } from '../i18n/index.mjs';
const TARGETS = [
  ['move-up', '[data-move="up"]'],
  ['move-left', '[data-move="left"]'],
  ['stop-button', '#stop-button'],
  ['move-right', '[data-move="right"]'],
  ['move-down', '[data-move="down"]'],
  ['action-button', '#action-button'],
  ['pickup-button', '#pickup-button'],
  ['boost-button', '#boost-button'],
  ['pause-button', '#pause-button'],
  ['restart-button', '#restart-button'],
  ['sound-button', '#sound-button'],
];
const GROUPS = [
  ['flight', '.play-controls'],
  ['directions', '.direction-controls'],
  ['actions', '.ability-buttons'],
  ['utilities', '.utility-buttons'],
];
const MEDIA = {
  pointerFine: '(pointer: fine)',
  pointerCoarse: '(pointer: coarse)',
  pointerNone: '(pointer: none)',
  anyPointerFine: '(any-pointer: fine)',
  anyPointerCoarse: '(any-pointer: coarse)',
  hover: '(hover: hover)',
  anyHover: '(any-hover: hover)',
};
const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const text = (value, max = 160) => (typeof value === 'string' ? value.slice(0, max) : '');
function rectangle(element) {
  if (!element) return null;
  const source = element.getBoundingClientRect();
  const result = Object.fromEntries(
    ['left', 'top', 'right', 'bottom', 'width', 'height'].map((key) => [key, finite(source[key])]),
  );
  return Object.values(result).every((value) => value !== null) &&
    result.width >= 0 &&
    result.height >= 0
    ? result
    : null;
}
function intersection(a, b) {
  if (!a || !b) return null;
  const left = Math.max(a.left, b.left),
    top = Math.max(a.top, b.top),
    width = Math.min(a.right, b.right) - left,
    height = Math.min(a.bottom, b.bottom) - top;
  return width > 0 && height > 0 ? { left, top, width, height } : null;
}
function layout(style) {
  return Object.fromEntries(
    [
      'display',
      'position',
      'boxSizing',
      'gridTemplateColumns',
      'gridTemplateRows',
      'columnGap',
      'rowGap',
      'flexDirection',
      'flexWrap',
      'overflowX',
      'overflowY',
    ].map((key) => [key, text(style[key], 512)]),
  );
}

/** Read only finite, named solo UI surfaces. No selectors, code or commands come
 * from the caller or preview configuration; no input/run/storage state is changed. */
export function captureControlGeometry({
  document: doc,
  view,
  requested,
  displayScale,
  capturedAt = new Date().toISOString(),
}) {
  const arenaElement = doc?.querySelector('#arena-shell');
  if (!arenaElement || !view)
    throw new Error(t("tools:loadASoloPracticePreviewBeforeCapturingControlGeometry"));
  const viewport = {
    width: finite(view.innerWidth),
    height: finite(view.innerHeight),
    devicePixelRatio: finite(view.devicePixelRatio),
    scrollX: finite(view.scrollX),
    scrollY: finite(view.scrollY),
    documentScrollWidth: finite(doc.documentElement.scrollWidth),
    documentScrollHeight: finite(doc.documentElement.scrollHeight),
    visualViewport: view.visualViewport
      ? {
          width: finite(view.visualViewport.width),
          height: finite(view.visualViewport.height),
          scale: finite(view.visualViewport.scale),
          offsetLeft: finite(view.visualViewport.offsetLeft),
          offsetTop: finite(view.visualViewport.offsetTop),
        }
      : null,
  };
  const controls = TARGETS.map(([id, selector]) => {
    const element = doc.querySelector(selector);
    if (!element) return { id, present: false };
    const style = view.getComputedStyle(element),
      rect = rectangle(element);
    const rendered =
      !!rect &&
      rect.width > 0 &&
      rect.height > 0 &&
      element.getClientRects().length > 0 &&
      style.display !== 'none';
    const visible =
      rendered && !['hidden', 'collapse'].includes(style.visibility) && style.opacity !== '0';
    const enabled =
      !element.disabled &&
      element.getAttribute('aria-disabled') !== 'true' &&
      !element.closest('[inert]');
    const clientWidth = finite(element.clientWidth),
      clientHeight = finite(element.clientHeight),
      scrollWidth = finite(element.scrollWidth),
      scrollHeight = finite(element.scrollHeight);
    return {
      id,
      present: true,
      label: text(element.getAttribute('aria-label') || element.textContent.trim()),
      rect,
      rendered,
      visible,
      enabled,
      insideViewport:
        visible &&
        viewport.width !== null &&
        viewport.height !== null &&
        rect.left >= 0 &&
        rect.top >= 0 &&
        rect.right <= viewport.width &&
        rect.bottom <= viewport.height,
      layout: layout(style),
      content: {
        clientWidth,
        clientHeight,
        scrollWidth,
        scrollHeight,
        exceedsClientWidth:
          clientWidth !== null && scrollWidth !== null && scrollWidth > clientWidth + 1,
        exceedsClientHeight:
          clientHeight !== null && scrollHeight !== null && scrollHeight > clientHeight + 1,
        whiteSpace: text(style.whiteSpace),
        fontSize: text(style.fontSize),
        lineHeight: text(style.lineHeight),
      },
    };
  });
  const groups = GROUPS.map(([id, selector]) => {
    const element = doc.querySelector(selector);
    return {
      id,
      present: !!element,
      rect: rectangle(element),
      ...(element ? { layout: layout(view.getComputedStyle(element)) } : {}),
    };
  });
  const arena = rectangle(arenaElement),
    targetOverlaps = [],
    arenaOverlaps = [];
  const visible = controls.filter((control) => control.visible);
  for (let i = 0; i < visible.length; i++) {
    const first = visible[i],
      boardIntersection = intersection(first.rect, arena);
    if (boardIntersection)
      arenaOverlaps.push({ id: first.id, enabled: first.enabled, intersection: boardIntersection });
    for (const second of visible.slice(i + 1)) {
      const shared = intersection(first.rect, second.rect);
      if (shared)
        targetOverlaps.push({
          first: first.id,
          second: second.id,
          bothEnabled: first.enabled && second.enabled,
          intersection: shared,
        });
    }
  }
  return {
    format: 'revealline-control-geometry.v1',
    capturedAt: text(capturedAt, 40),
    units: t("tools:childViewportCssPixelsOuterPreviewDisplayScaleIsReported"),
    requested: { width: finite(requested?.width), height: finite(requested?.height) },
    displayScale: finite(displayScale),
    viewport,
    media: Object.fromEntries(
      Object.entries(MEDIA).map(([key, query]) => [key, !!view.matchMedia(query).matches]),
    ),
    arena,
    groups,
    controls,
    targetOverlaps,
    arenaOverlaps,
    summary: {
      expectedTargets: TARGETS.length,
      presentTargets: controls.filter((control) => control.present).length,
      visibleTargets: visible.length,
      enabledVisibleTargets: visible.filter((control) => control.enabled).length,
      minimumWidth: visible.length
        ? Math.min(...visible.map((control) => control.rect.width))
        : null,
      minimumHeight: visible.length
        ? Math.min(...visible.map((control) => control.rect.height))
        : null,
      below44: visible
        .filter((control) => control.rect.width < 44 || control.rect.height < 44)
        .map((control) => control.id),
      horizontalPageOverflow:
        viewport.width !== null && viewport.documentScrollWidth !== null
          ? viewport.documentScrollWidth > viewport.width
          : null,
    },
    limits: [
      t("tools:snapshotOnlyCaptureAgainAfterResizingScrollingOrPreviewActivity"),
      t("tools:visibilityReflectsLayoutAndThisElementSComputedStyleIt"),
      t("tools:intersectionsCompareVisibleBorderBoxesIncludingOffscreenBoxesEdgeTouching"),
      t("tools:contentScrollClientDimensionsAreApproximateOverflowIndicatorsNotGlyph"),
      t("tools:pointerMediaAndViewportDataDescribeThisBrowserResizingAlone"),
    ],
  };
}
