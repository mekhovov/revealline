const targets = 'button,a[href],input:not([type="hidden"]),select,textarea,summary';
export function controlName(node, doc) {
  const references = (node.getAttribute('aria-labelledby') || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => doc.getElementById(id)?.textContent?.trim())
    .filter(Boolean)
    .join(' ');
  if (references) return references;
  const explicit = node.getAttribute('aria-label')?.trim();
  if (explicit) return explicit;
  const labels = [...(node.labels || [])].map((label) => label.textContent.trim()).join(' ');
  if (labels) return labels;
  if (['BUTTON', 'A', 'SUMMARY'].includes(node.tagName)) return node.textContent.trim();
  if (node.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(node.type))
    return node.value.trim();
  return node.getAttribute('title')?.trim() || '';
}
export function measureMenuAccessibility(doc) {
  const win = doc.defaultView;
  const visible = (node) => node.getClientRects().length > 0 && !node.closest('[hidden],[inert]');
  const modal = [...doc.querySelectorAll('dialog[open]')].at(-1);
  const root = modal || doc.body;
  const controls = [...root.querySelectorAll(targets)].filter(visible).map((node) => {
    const rect = node.getBoundingClientRect(),
      style = win.getComputedStyle(node),
      icon = win.getComputedStyle(node, '::before');
    return {
      id: node.id || node.className || node.tagName,
      label: controlName(node, doc),
      tag: node.tagName,
      type: node.type,
      disabled: node.matches(':disabled,[aria-disabled="true"]'),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      clippedText:
        ['BUTTON', 'A', 'SUMMARY'].includes(node.tagName) &&
        node.scrollWidth > node.clientWidth + 2,
      color: style.color,
      background: style.backgroundColor,
      fontFamily: style.fontFamily,
      outline: { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor },
      selected: node.matches('[aria-selected="true"],[aria-current]:not([aria-current="false"])'),
      border: style.borderTopStyle,
      icon: node.hasAttribute('data-menu-icon')
        ? { mask: icon.maskImage, color: icon.backgroundColor, adjustment: icon.forcedColorAdjust }
        : null,
    };
  });
  const forced = win.matchMedia('(forced-colors: active)').matches;
  const checks = {
    'no horizontal document overflow':
      doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 2,
    'no horizontal modal overflow': !modal || modal.scrollWidth <= modal.clientWidth + 2,
    'controls stay within viewport': controls.every(
      (item) => item.left >= -2 && item.right <= win.innerWidth + 2,
    ),
    'button and link labels are not clipped': controls.every((item) => !item.clippedText),
    'buttons have 44px targets': controls
      .filter((item) => item.tag === 'BUTTON')
      .every((item) => item.height >= 44 && item.width >= 44),
    'controls have accessible names': controls.every((item) => !!item.label),
    ...(forced
      ? {
          'forced-color masks use system text': controls
            .filter((item) => item.icon)
            .every(
              (item) =>
                item.icon.mask !== 'none' &&
                item.icon.adjustment === 'none' &&
                item.icon.color === item.color,
            ),
          'selected states survive color substitution': controls
            .filter((item) => item.selected)
            .every((item) => item.border === 'double'),
        }
      : {}),
  };
  return {
    observedAt: new Date().toISOString(),
    href: win.location.href,
    locale: doc.documentElement.lang,
    viewport: {
      width: win.innerWidth,
      height: win.innerHeight,
      devicePixelRatio: win.devicePixelRatio,
      visualViewportScale: win.visualViewport?.scale ?? null,
    },
    fonts: [...doc.fonts].map((face) => ({ family: face.family, status: face.status })),
    forcedColors: forced,
    forcedColorsQualification: forced
      ? 'active browser rendering measured'
      : 'not qualified: media query inactive',
    zoomQualification:
      'Browser UI must record actual zoom; viewport dimensions alone do not prove 200%.',
    focused: doc.activeElement?.id || doc.activeElement?.className || doc.activeElement?.tagName,
    passed: Object.values(checks).every(Boolean),
    checks,
    controls,
  };
}
