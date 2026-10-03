import {
  BUILTIN_THEME_FAMILIES,
  applyResolvedPresentation,
  resolvePresentation,
} from '../../presentation/theme-system.mjs';

export const MATERIAL_SAMPLE_CASES = Object.freeze([
  { id: 'panel', name: 'Panel reading surface', kind: 'section', label: 'Mission briefing' },
  {
    id: 'muted-panel',
    name: 'Muted panel helper',
    kind: 'section',
    muted: true,
    label: 'Progress is saved automatically',
  },
  { id: 'default', name: 'Default · also test real pointer hover', label: 'Choose mission' },
  { id: 'hover', name: 'Hover state', state: 'hover', label: 'Choose mission' },
  { id: 'pressed', name: 'Pressed state', state: 'pressed', label: 'Choose mission' },
  { id: 'selected', name: 'Selected state', selected: true, label: 'Selected mission' },
  {
    id: 'selected-hover',
    name: 'Selected + hover',
    selected: true,
    state: 'hover',
    label: 'Selected mission',
  },
  {
    id: 'selected-pressed',
    name: 'Selected + pressed',
    selected: true,
    state: 'pressed',
    label: 'Selected mission',
  },
  { id: 'primary', name: 'Primary action', role: 'primary', label: 'Start mission' },
  {
    id: 'primary-hover',
    name: 'Primary + hover',
    role: 'primary',
    state: 'hover',
    label: 'Start mission',
  },
  { id: 'danger', name: 'Destructive action', role: 'danger', label: 'Discard draft' },
  {
    id: 'danger-hover',
    name: 'Destructive + hover',
    role: 'danger',
    state: 'hover',
    label: 'Discard draft',
  },
  {
    id: 'danger-pressed',
    name: 'Destructive + pressed',
    role: 'danger',
    state: 'pressed',
    label: 'Discard draft',
  },
  { id: 'disabled', name: 'Disabled action', disabled: true, label: 'Unavailable' },
  {
    id: 'primary-disabled',
    name: 'Primary + disabled',
    role: 'primary',
    disabled: true,
    label: 'Unavailable',
  },
  {
    id: 'selected-disabled',
    name: 'Selected + disabled',
    selected: true,
    disabled: true,
    label: 'Selected mission',
  },
  {
    id: 'focus',
    name: 'Focus coexists with the material',
    state: 'focus',
    label: 'Choose mission',
  },
  { id: 'loading', name: 'Loading action', loading: true, label: 'Preparing mission' },
  { id: 'input', name: 'Native input', kind: 'input', label: 'Pilot callsign' },
]);

/** No inline paint: both samples use the same runtime semantic role and state. */
export function createMaterialSamples(document, container) {
  for (const spec of MATERIAL_SAMPLE_CASES) {
    const row = document.createElement('section'),
      heading = document.createElement('h2'),
      pair = document.createElement('div');
    row.className = 'material-sample-row';
    row.dataset.sampleCase = spec.id;
    heading.textContent = spec.name;
    pair.className = 'material-sample-pair';
    for (const twin of [false, true]) {
      const sample = document.createElement(spec.kind ?? 'button');
      sample.id = `sample-${spec.id}${twin ? '-twin' : ''}`;
      sample.dataset.materialSample = spec.id;
      sample.dataset.readingTwin = String(twin);
      if (spec.kind === 'section') sample.dataset.uiSurface = 'panel';
      else if (spec.kind === 'input') {
        sample.type = 'text';
        sample.value = twin ? '' : spec.label;
      } else {
        sample.type = 'button';
        if (spec.role) sample.dataset.uiAction = spec.role;
      }
      if (spec.kind !== 'input') {
        const label = document.createElement('span');
        label.textContent = spec.label;
        if (spec.muted) label.dataset.uiTone = 'muted';
        sample.append(label);
      }
      sample.setAttribute('aria-label', `${spec.name}${twin ? ' · blank reading twin' : ''}`);
      if (twin) sample.tabIndex = -1;
      if (spec.state) sample.dataset.state = spec.state;
      if (spec.selected) sample.setAttribute('aria-pressed', 'true');
      if (spec.disabled) sample.disabled = true;
      if (spec.loading) sample.setAttribute('aria-busy', 'true');
      pair.append(sample);
    }
    row.append(heading, pair);
    container.append(row);
  }
}

const computedColor = (value) => {
  const hex = /^#([\da-f]{6})$/i.exec(value ?? '');
  if (hex)
    return `rgb(${[0, 2, 4].map((offset) => parseInt(hex[1].slice(offset, offset + 2), 16)).join(',')})`;
  return String(value).toLowerCase().replace(/\s+/g, '');
};

/** Check computed paint, not merely resolver recipes or stylesheet text. */
export function evaluateMaterialSemantics(
  samples,
  tokens,
  { forcedColors = false, styled = true } = {},
) {
  if (forcedColors || !styled)
    return {
      status: 'skipped',
      reason: forcedColors
        ? 'System colors own this palette.'
        : 'Retained legacy adapter owns this paint.',
      checks: [],
    };
  const checks = [];
  for (const twin of [false, true]) {
    for (const [id, expected] of [
      [
        'selected-disabled',
        {
          background: tokens.panel,
          foreground: tokens.muted,
          shadow: 'none',
          borderImage: 'none',
          finish: 'none',
        },
      ],
      [
        'danger-pressed',
        { background: tokens.hazard, foreground: tokens.onHazard, borderImage: 'none' },
      ],
    ]) {
      const sampleId = `sample-${id}${twin ? '-twin' : ''}`,
        sample = samples.find((item) => item.id === sampleId);
      for (const [property, value] of Object.entries(expected)) {
        const actual = sample?.[property],
          color = property === 'background' || property === 'foreground';
        checks.push({
          id: `${sampleId}.${property}`,
          passed:
            actual !== undefined &&
            (color ? computedColor(actual) === computedColor(value) : actual === value),
          expected: value,
          actual: actual ?? null,
        });
      }
    }
  }
  return { status: checks.every((check) => check.passed) ? 'passed' : 'failed', checks };
}

/** Native-size composition. Only layout is supplied by the fixture stylesheet. */
export function createMaterialCloseUp(document, container) {
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const action = (label, role, sample) => {
    const node = element('button', label);
    node.type = 'button';
    node.dataset.closeUpControl = sample;
    if (role) node.dataset.uiAction = role;
    return node;
  };
  container.append(
    element('h2', 'Material close-up'),
    element(
      'p',
      'Inspect at native scale: compact Studio controls, player targets, recessed fields and tall cards. Large text and coarse pointers expand the compact targets.',
    ),
  );
  const layout = element('div', '', 'material-close-up-layout'),
    player = element('section', '', 'material-close-up-panel'),
    studio = element('section', '', 'material-close-up-panel material-close-up-studio'),
    cards = element('div', '', 'theme-gallery material-close-up-cards');
  player.dataset.uiSurface = studio.dataset.uiSurface = 'panel';
  player.dataset.closeUpSurface = 'player-panel';
  studio.dataset.closeUpSurface = 'studio-panel';
  const playerHeader = element('header', '', 'material-close-up-header');
  playerHeader.dataset.uiSurface = 'toolbar';
  playerHeader.append(element('h3', 'Flight deck'), element('span', 'Player · 44 px targets'));
  const well = element('section', '', 'material-close-up-well');
  well.dataset.uiSurface = 'inset';
  well.append(
    element('strong', 'First return'),
    element('p', 'Return to safe ground to secure the line. Progress is saved automatically.'),
  );
  const playerActions = element('div', '', 'material-close-up-actions');
  playerActions.append(
    action('Choose mission', null, 'player-default'),
    action('Launch flight', 'primary', 'player-primary'),
  );
  player.append(playerHeader, well, playerActions);
  const studioHeader = element('header', '', 'material-close-up-header');
  studioHeader.dataset.uiSurface = 'toolbar';
  studioHeader.append(
    element('h3', 'Creator inspector'),
    element('span', 'Studio · 32 px targets'),
  );
  const input = element('input');
  input.type = 'text';
  input.value = 'Workshop checkpoint';
  input.setAttribute('aria-label', 'Preview asset name');
  input.dataset.closeUpControl = 'studio-input';
  const studioActions = element('div', '', 'material-close-up-actions');
  studioActions.append(
    action('Preview', null, 'studio-default'),
    action('Save', 'primary', 'studio-primary'),
  );
  const disabled = action('Unavailable', null, 'studio-disabled');
  disabled.disabled = true;
  disabled.setAttribute('aria-pressed', 'true');
  studioActions.append(disabled);
  studio.append(studioHeader, input, studioActions);
  for (const selected of [false, true]) {
    const card = action('', null, selected ? 'selected-card' : 'default-card');
    card.className = 'theme-preview-card material-close-up-card';
    card.setAttribute('aria-pressed', String(selected));
    const caption = element('span', selected ? 'SELECTED ROUTE' : 'MISSION 04');
    caption.dataset.uiTone = 'muted';
    card.append(
      caption,
      element('strong', selected ? 'Across the long valley' : 'Between the towers'),
      element(
        'span',
        'A tall, two-line card tests material scale without stretching the edge lighting.',
      ),
      element('small', selected ? 'Selected ✓ · Ready to fly' : 'Explore · 3 objectives'),
    );
    cards.append(card);
  }
  layout.append(player, studio, cards);
  container.append(layout);
  return { studio };
}

function mount(document, window) {
  const control = (id) => document.getElementById(`specimen-${id}`),
    family = control('family'),
    outer = control('outer'),
    cases = control('case'),
    ornaments = control('ornaments'),
    contrast = control('high-contrast'),
    reduced = control('reduced-effects'),
    large = control('large-text'),
    surface = control('inner-scope'),
    outerSurface = control('outer-scope'),
    samples = control('samples'),
    closeUp = control('close-up');
  for (const theme of BUILTIN_THEME_FAMILIES) {
    for (const select of [family, outer]) {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.name;
      select.append(option);
    }
  }
  for (const spec of MATERIAL_SAMPLE_CASES) {
    const option = document.createElement('option');
    option.value = spec.id;
    option.textContent = spec.name;
    cases.append(option);
  }
  family.value = 'industrial-workshop';
  createMaterialSamples(document, samples);
  const { studio } = createMaterialCloseUp(document, closeUp);
  let removeInner, removeOuter, removeStudio, resolved;
  const paint = (sample) => {
    const css = window.getComputedStyle(sample);
    return {
      id: sample.id,
      foreground: window.getComputedStyle(sample.querySelector('span') ?? sample).color,
      background: css.backgroundColor,
      finish: css.backgroundImage,
      borderImage: css.borderImageSource,
      shadow: css.boxShadow,
    };
  };
  function measure() {
    const rows = [...samples.querySelectorAll('[data-material-sample]')]
      .filter((sample) => !sample.closest('[data-sample-case]').hidden)
      .map((sample) => {
        const css = window.getComputedStyle(sample),
          rect = sample.getBoundingClientRect(),
          inset = 16;
        return {
          ...paint(sample),
          case: sample.dataset.materialSample,
          twin: sample.dataset.readingTwin === 'true',
          nativeHover: sample.matches(':hover'),
          nativeActive: sample.matches(':active'),
          focused: document.activeElement === sample,
          outline: css.outline,
          transition: css.transition,
          transform: css.transform,
          opacity: css.opacity,
          rectangle: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          readingRectangle: {
            x: rect.x + inset,
            y: rect.y + inset,
            width: rect.width - inset * 2,
            height: rect.height - inset * 2,
          },
          documentReadingRectangle: {
            x: rect.x + window.scrollX + inset,
            y: rect.y + window.scrollY + inset,
            width: rect.width - inset * 2,
            height: rect.height - inset * 2,
          },
        };
      });
    const forcedColors = window.matchMedia('(forced-colors: active)').matches,
      semantics = evaluateMaterialSemantics(
        ['selected-disabled', 'danger-pressed'].flatMap((id) =>
          [false, true].map((twin) =>
            paint(document.getElementById(`sample-${id}${twin ? '-twin' : ''}`)),
          ),
        ),
        resolved.tokens,
        { forcedColors, styled: surface.dataset.themeStyled === 'true' },
      );
    control('semantic-status').textContent =
      `Semantic state checks: ${semantics.status}${semantics.reason ? ` · ${semantics.reason}` : ` · ${semantics.checks.filter((check) => !check.passed).length} failures`}`;
    control('semantic-status').dataset.result = semantics.status;
    control('measurements').textContent = JSON.stringify(
      {
        family: family.value,
        outer: outer.value,
        ornaments: ornaments.value,
        highContrast: contrast.checked,
        reducedEffects: reduced.checked,
        forcedColors,
        semantics,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
          scrollY: window.scrollY,
        },
        backdrop: window.getComputedStyle(control('backdrop'), '::before').backgroundImage,
        closeUp: closeUp.hidden
          ? null
          : [...closeUp.querySelectorAll('[data-close-up-control], [data-close-up-surface]')].map(
              (node) => {
                const rect = node.getBoundingClientRect(),
                  css = window.getComputedStyle(node);
                return {
                  specimen: node.dataset.closeUpControl ?? node.dataset.closeUpSurface,
                  ...paint(node),
                  density: node.closest('[data-theme-density]')?.dataset.themeDensity,
                  minTarget: css.getPropertyValue('--iw-target').trim(),
                  rectangle: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                };
              },
            ),
        samples: rows,
      },
      null,
      2,
    );
  }
  function refresh() {
    removeStudio?.();
    removeInner?.();
    removeOuter?.();
    if (outer.value !== 'none')
      removeOuter = applyResolvedPresentation(
        outerSurface,
        resolvePresentation({ familyId: outer.value }),
      );
    else removeOuter = null;
    const presentationOptions = {
      familyId: family.value,
      ornaments: ornaments.value,
      accessibility: {
        highContrast: contrast.checked,
        reducedEffects: reduced.checked,
        textSize: large.checked ? 'large' : 'standard',
        coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      },
    };
    resolved = resolvePresentation(presentationOptions);
    removeInner = applyResolvedPresentation(surface, resolved);
    removeStudio = applyResolvedPresentation(
      studio,
      resolvePresentation({ ...presentationOptions, density: 'studio' }),
    );
    closeUp.hidden = cases.value !== 'close-up';
    samples.hidden = cases.value === 'close-up';
    for (const row of samples.children)
      row.hidden = cases.value !== 'all' && row.dataset.sampleCase !== cases.value;
    control('description').textContent =
      `${resolved.familyId} · ${resolved.materialStyle} · ${resolved.textured ? 'textured' : 'quiet'} · ${resolved.surface}`;
    window.requestAnimationFrame(measure);
  }
  for (const input of [family, outer, cases, ornaments, contrast, reduced, large])
    input.addEventListener('change', refresh);
  control('measure').addEventListener('click', measure);
  for (const event of [
    'pointerover',
    'pointerout',
    'pointerdown',
    'pointerup',
    'focusin',
    'focusout',
  ])
    samples.addEventListener(event, () => window.setTimeout(measure, 200));
  window.addEventListener('resize', measure);
  window.addEventListener('scroll', measure);
  refresh();
  document.fonts?.ready.then(measure);
}

if (globalThis.document?.getElementById('specimen-family'))
  mount(globalThis.document, globalThis.window);
