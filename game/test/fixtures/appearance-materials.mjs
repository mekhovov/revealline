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
    samples = control('samples');
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
  let removeInner, removeOuter;
  function measure() {
    const rows = [...samples.querySelectorAll('[data-material-sample]')]
      .filter((sample) => !sample.closest('[data-sample-case]').hidden)
      .map((sample) => {
        const css = window.getComputedStyle(sample),
          rect = sample.getBoundingClientRect(),
          inset = 16;
        return {
          id: sample.id,
          case: sample.dataset.materialSample,
          twin: sample.dataset.readingTwin === 'true',
          nativeHover: sample.matches(':hover'),
          nativeActive: sample.matches(':active'),
          focused: document.activeElement === sample,
          foreground: window.getComputedStyle(sample.querySelector('span') ?? sample).color,
          background: css.backgroundColor,
          finish: css.backgroundImage,
          borderImage: css.borderImageSource,
          shadow: css.boxShadow,
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
    control('measurements').textContent = JSON.stringify(
      {
        family: family.value,
        outer: outer.value,
        ornaments: ornaments.value,
        highContrast: contrast.checked,
        reducedEffects: reduced.checked,
        forcedColors: window.matchMedia('(forced-colors: active)').matches,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
          scrollY: window.scrollY,
        },
        backdrop: window.getComputedStyle(control('backdrop'), '::before').backgroundImage,
        samples: rows,
      },
      null,
      2,
    );
  }
  function refresh() {
    removeInner?.();
    removeOuter?.();
    if (outer.value !== 'none')
      removeOuter = applyResolvedPresentation(
        outerSurface,
        resolvePresentation({ familyId: outer.value }),
      );
    else removeOuter = null;
    const resolved = resolvePresentation({
      familyId: family.value,
      ornaments: ornaments.value,
      accessibility: {
        highContrast: contrast.checked,
        reducedEffects: reduced.checked,
        textSize: large.checked ? 'large' : 'standard',
      },
    });
    removeInner = applyResolvedPresentation(surface, resolved);
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
