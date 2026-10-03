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
  {
    id: 'selected-loading',
    name: 'Selected + loading',
    selected: true,
    loading: true,
    label: 'Preparing mission',
  },
  {
    id: 'selected-focus',
    name: 'Selected + focus',
    selected: true,
    state: 'focus',
    label: 'Selected mission',
  },
  {
    id: 'danger-focus',
    name: 'Destructive + focus',
    role: 'danger',
    state: 'focus',
    label: 'Discard draft',
  },
  {
    id: 'loading-focus',
    name: 'Loading + focus',
    loading: true,
    state: 'focus',
    label: 'Preparing mission',
  },
  {
    id: 'loading-disabled',
    name: 'Loading + disabled',
    loading: true,
    disabled: true,
    label: 'Preparing mission',
  },
  { id: 'input', name: 'Native input', kind: 'input', label: 'Pilot callsign' },
  {
    id: 'input-hover',
    name: 'Native input + hover',
    kind: 'input',
    state: 'hover',
    label: 'Pilot callsign',
  },
  {
    id: 'input-disabled',
    name: 'Native input + disabled',
    kind: 'input',
    disabled: true,
    label: 'Pilot callsign',
  },
  {
    id: 'input-invalid',
    name: 'Native input + validation error',
    kind: 'input',
    invalid: true,
    label: 'Name already used',
  },
  {
    id: 'input-invalid-focus',
    name: 'Validation error + focus',
    kind: 'input',
    invalid: true,
    state: 'focus',
    label: 'Name already used',
  },
  { id: 'select', name: 'Native select', kind: 'select', label: 'Balanced detail' },
  {
    id: 'select-hover',
    name: 'Native select + hover',
    kind: 'select',
    state: 'hover',
    label: 'Balanced detail',
  },
  {
    id: 'select-focus',
    name: 'Native select + focus',
    kind: 'select',
    state: 'focus',
    label: 'Balanced detail',
  },
  {
    id: 'select-disabled',
    name: 'Native select + disabled',
    kind: 'select',
    disabled: true,
    label: 'Balanced detail',
  },
  {
    id: 'checkbox',
    name: 'Native checkbox',
    kind: 'label',
    inputType: 'checkbox',
    label: 'Show telemetry',
  },
  {
    id: 'checkbox-checked',
    name: 'Checked checkbox',
    kind: 'label',
    inputType: 'checkbox',
    checked: true,
    label: 'Show telemetry',
  },
  {
    id: 'checkbox-focus',
    name: 'Checked checkbox + focus',
    kind: 'label',
    inputType: 'checkbox',
    checked: true,
    state: 'focus',
    label: 'Show telemetry',
  },
  {
    id: 'checkbox-disabled',
    name: 'Checked checkbox + disabled',
    kind: 'label',
    inputType: 'checkbox',
    checked: true,
    disabled: true,
    label: 'Show telemetry',
  },
  {
    id: 'radio-checked',
    name: 'Selected radio',
    kind: 'label',
    inputType: 'radio',
    checked: true,
    label: 'Balanced detail',
  },
  {
    id: 'radio-focus',
    name: 'Selected radio + focus',
    kind: 'label',
    inputType: 'radio',
    checked: true,
    state: 'focus',
    label: 'Balanced detail',
  },
  {
    id: 'switch',
    name: 'Native switch',
    kind: 'label',
    inputType: 'checkbox',
    switch: true,
    checked: true,
    label: 'Opaque HUD',
  },
  { id: 'range', name: 'Native range', kind: 'label', inputType: 'range', label: 'Music level' },
  {
    id: 'range-disabled',
    name: 'Native range + disabled',
    kind: 'label',
    inputType: 'range',
    disabled: true,
    label: 'Music level',
  },
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
      let nativeControl = sample;
      sample.id = `sample-${spec.id}${twin ? '-twin' : ''}`;
      sample.dataset.materialSample = spec.id;
      sample.dataset.readingTwin = String(twin);
      if (spec.kind === 'section') sample.dataset.uiSurface = 'panel';
      else if (spec.kind === 'input') {
        sample.type = 'text';
        sample.value = twin ? '' : spec.label;
      } else if (spec.kind === 'select') {
        const option = document.createElement('option');
        option.textContent = twin ? '\u00a0' : spec.label;
        sample.append(option);
      } else if (spec.kind === 'label') {
        nativeControl = document.createElement('input');
        nativeControl.type = spec.inputType;
        nativeControl.setAttribute('type', spec.inputType);
        nativeControl.checked = spec.checked ?? false;
        nativeControl.setAttribute('aria-label', spec.label);
        if (spec.switch) nativeControl.setAttribute('role', 'switch');
        if (spec.inputType === 'range') {
          nativeControl.min = '0';
          nativeControl.max = '100';
          nativeControl.value = '62';
        }
        sample.dataset.nativeControl = spec.inputType;
        sample.append(nativeControl);
      } else {
        sample.type = 'button';
        if (spec.role) sample.dataset.uiAction = spec.role;
      }
      if (!['input', 'select'].includes(spec.kind)) {
        const label = document.createElement('span');
        label.textContent = spec.label;
        if (spec.muted) label.dataset.uiTone = 'muted';
        sample.append(label);
      }
      sample.setAttribute('aria-label', `${spec.name}${twin ? ' · blank reading twin' : ''}`);
      if (twin) nativeControl.tabIndex = -1;
      if (spec.state) nativeControl.dataset.state = sample.dataset.state = spec.state;
      if (spec.selected) sample.setAttribute('aria-pressed', 'true');
      if (spec.disabled) nativeControl.disabled = true;
      if (spec.invalid) nativeControl.setAttribute('aria-invalid', 'true');
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

/** The first shadow is the progress rail, above the material relief. Checking
 * computed paint catches invalid shadow lists such as `inset …, none`. */
const hasVisibleLoadingRail = (sample) => {
  const firstShadow = String(sample?.shadow ?? '').split(/,(?![^()]*\))/)[0],
    lengths = [...firstShadow.matchAll(/(-?[\d.]+)px/g)].map((match) => Number(match[1])),
    color = firstShadow.match(/(?:rgba?|color)\([^)]*\)|#[\da-f]{6,8}/i)?.[0],
    rail = Number(sample?.loadingRail);
  return (
    /\binset\b/.test(firstShadow) &&
    Number.isFinite(rail) &&
    rail >= 3 &&
    lengths.length >= 3 &&
    lengths[0] === 0 &&
    lengths[1] === -rail &&
    lengths[2] === 0 &&
    (lengths[3] ?? 0) === 0 &&
    color !== undefined &&
    computedColor(color) === computedColor(sample.foreground)
  );
};

/** Validation stays on the field boundary while focus remains an independent cue. */
export function evaluateControlStateSemantics(
  samples,
  tokens,
  { forcedColors = false, styled = true } = {},
) {
  if (forcedColors || !styled) return { status: 'skipped', checks: [] };
  const checks = [];
  for (const twin of [false, true]) {
    for (const id of [
      'input-invalid',
      'input-invalid-focus',
      'input-disabled',
      'select-disabled',
    ]) {
      const sampleId = `sample-${id}${twin ? '-twin' : ''}`,
        sample = samples.find((item) => item.id === sampleId),
        invalid = id.startsWith('input-invalid'),
        expected = invalid
          ? { foreground: tokens.inputText, background: tokens.input, borderColor: tokens.hazard }
          : { foreground: tokens.muted, background: tokens.panel, finish: 'none', shadow: 'none' };
      for (const [property, value] of Object.entries(expected)) {
        const actual = sample?.[property],
          color = ['foreground', 'background', 'borderColor'].includes(property);
        checks.push({
          id: `${sampleId}.${property}`,
          expected: value,
          actual: actual ?? null,
          passed:
            actual !== undefined &&
            (color ? computedColor(actual) === computedColor(value) : actual === value),
        });
      }
      if (id.endsWith('-focus')) {
        checks.push({
          id: `${sampleId}.focus-visible`,
          expected: 'at least 2px solid independent focus ring',
          actual: sample?.outline ?? null,
          passed: sample?.outlineStyle === 'solid' && parseFloat(sample.outlineWidth) >= 2,
        });
      }
    }
  }
  // Existing synthetic field-only callers stay useful; when a capture includes
  // loading controls, require every loading combination and its reading twin.
  if (samples.some((sample) => /sample-(?:selected-)?loading/.test(sample.id))) {
    for (const twin of [false, true]) {
      for (const id of ['loading', 'selected-loading', 'loading-focus', 'loading-disabled']) {
        const sampleId = `sample-${id}${twin ? '-twin' : ''}`,
          sample = samples.find((item) => item.id === sampleId),
          disabled = id === 'loading-disabled';
        checks.push({
          id: `${sampleId}.loading-rail`,
          expected: disabled
            ? 'no loading rail on a disabled action'
            : 'visible foreground progress rail above relief',
          actual: sample?.shadow ?? null,
          passed: disabled ? sample?.shadow === 'none' : hasVisibleLoadingRail(sample),
        });
        if (id === 'loading-focus') {
          checks.push({
            id: `${sampleId}.focus-visible`,
            expected: 'at least 2px solid independent focus ring',
            actual: sample?.outline ?? null,
            passed: sample?.outlineStyle === 'solid' && parseFloat(sample.outlineWidth) >= 2,
          });
        }
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

/** Each tile is an independent runtime lease; these controls remain fully native. */
export function createMaterialGallery(document, container) {
  return BUILTIN_THEME_FAMILIES.map((family) => {
    const tile = document.createElement('section'),
      heading = document.createElement('h2'),
      panel = document.createElement('section'),
      actions = document.createElement('div'),
      states = document.createElement('div'),
      label = document.createElement('label'),
      select = document.createElement('select'),
      checkLabel = document.createElement('label'),
      checkbox = document.createElement('input');
    tile.className = 'material-gallery-tile';
    tile.dataset.galleryFamily = family.id;
    heading.textContent = family.name;
    panel.dataset.uiSurface = 'panel';
    panel.className = 'material-gallery-panel';
    actions.className = states.className = 'material-gallery-actions';
    for (const [text, role] of [
      ['Choose mission', null],
      ['Launch', 'primary'],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.dataset.galleryControl = role ?? 'default';
      if (role) button.dataset.uiAction = role;
      actions.append(button);
    }
    for (const [text, state] of [
      ['Hover', 'hover'],
      ['Pressed', 'pressed'],
      ['Focus', 'focus'],
      ['Loading', 'loading'],
      ['Disabled', 'disabled'],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.dataset.galleryControl = state;
      if (state === 'disabled') button.disabled = true;
      else if (state === 'loading') button.setAttribute('aria-busy', 'true');
      else button.dataset.state = state;
      states.append(button);
    }
    const selectCaption = document.createElement('span');
    selectCaption.textContent = 'Terrain detail';
    label.append(selectCaption);
    select.setAttribute('aria-label', `${family.name} terrain detail`);
    select.dataset.galleryControl = 'select';
    for (const text of ['Balanced', 'Detailed']) {
      const option = document.createElement('option');
      option.textContent = text;
      select.append(option);
    }
    label.append(select);
    checkbox.type = 'checkbox';
    checkbox.setAttribute('type', 'checkbox');
    checkbox.checked = true;
    checkbox.dataset.galleryControl = 'checkbox';
    const checkCaption = document.createElement('span');
    checkCaption.textContent = 'Show telemetry';
    checkLabel.append(checkbox, checkCaption);
    panel.append(actions, states, label, checkLabel);
    tile.append(heading, panel);
    container.append(tile);
    return { family, tile };
  });
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
    closeUp = control('close-up'),
    gallery = control('gallery');
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
  const galleryTiles = createMaterialGallery(document, gallery);
  let removeInner, removeOuter, removeStudio, resolved;
  let removeGallery = [];
  const paint = (sample) => {
    const css = window.getComputedStyle(sample);
    return {
      id: sample.id,
      foreground: window.getComputedStyle(sample.querySelector('span') ?? sample).color,
      background: css.backgroundColor,
      finish: css.backgroundImage,
      borderImage: css.borderImageSource,
      shadow: css.boxShadow,
      loadingRail: parseFloat(css.getPropertyValue('--ui-loading-rail')),
      borderColor: css.borderColor,
      outline: css.outline,
      outlineStyle: css.outlineStyle,
      outlineWidth: css.outlineWidth,
    };
  };
  function measure() {
    const rows = [...samples.querySelectorAll('[data-material-sample]')]
      .filter((sample) => !sample.closest('[data-sample-case]').hidden)
      .map((sample) => {
        const css = window.getComputedStyle(sample),
          rect = sample.getBoundingClientRect(),
          inset = 16,
          input = sample.matches('input, select') ? sample : sample.querySelector('input, select'),
          caption = sample.matches('label[data-native-control]')
            ? sample.querySelector('span')
            : null,
          captionRect = caption?.getBoundingClientRect(),
          readingRectangle = captionRect
            ? {
                x: captionRect.x,
                y: captionRect.y,
                width: captionRect.width,
                height: captionRect.height,
              }
            : {
                x: rect.x + inset,
                y: rect.y + inset,
                width: Math.max(0, rect.width - inset - (sample.matches('select') ? 32 : inset)),
                height: Math.max(0, rect.height - inset * 2),
              };
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
          translate: css.translate,
          opacity: css.opacity,
          minimum:
            (input ?? sample).disabled || (input ?? sample).getAttribute('aria-disabled') === 'true'
              ? 3
              : 4.5,
          nativeControl: input
            ? (() => {
                const inputCss = window.getComputedStyle(input);
                return {
                  tag: input.tagName,
                  type: input.type,
                  disabled: input.disabled,
                  checked: input.checked,
                  invalid: input.getAttribute('aria-invalid'),
                  foreground: inputCss.color,
                  background: inputCss.backgroundColor,
                  borderColor: inputCss.borderColor,
                  outline: inputCss.outline,
                  shadow: inputCss.boxShadow,
                };
              })()
            : null,
          rectangle: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          readingRectangle,
          documentReadingRectangle: {
            ...readingRectangle,
            x: readingRectangle.x + window.scrollX,
            y: readingRectangle.y + window.scrollY,
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
      ),
      controlSemantics = evaluateControlStateSemantics(
        [...samples.querySelectorAll('[data-material-sample]')].map(paint),
        resolved.tokens,
        { forcedColors, styled: surface.dataset.themeStyled === 'true' },
      );
    control('semantic-status').textContent =
      `Action semantics: ${semantics.status} · Field semantics: ${controlSemantics.status}${semantics.reason ? ` · ${semantics.reason}` : ` · ${[...semantics.checks, ...controlSemantics.checks].filter((check) => !check.passed).length} failures`}`;
    control('semantic-status').dataset.result = [
      semantics.status,
      controlSemantics.status,
    ].includes('failed')
      ? 'failed'
      : semantics.status;
    control('measurements').textContent = JSON.stringify(
      {
        family: family.value,
        outer: outer.value,
        ornaments: ornaments.value,
        highContrast: contrast.checked,
        reducedEffects: reduced.checked,
        forcedColors,
        semantics,
        controlSemantics,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
          scrollY: window.scrollY,
        },
        backdrop: window.getComputedStyle(control('backdrop'), '::before').backgroundImage,
        gallery: gallery.hidden
          ? null
          : galleryTiles.map(({ family, tile }) => ({
              family: family.id,
              styled: tile.dataset.themeStyled,
              material: tile.dataset.themeMaterial,
              controls: [...tile.querySelectorAll('[data-gallery-control]')].map((node) => ({
                control: node.dataset.galleryControl,
                ...paint(node),
                outline: window.getComputedStyle(node).outline,
              })),
            })),
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
    for (const remove of removeGallery) remove();
    removeGallery = [];
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
    gallery.hidden = cases.value !== 'gallery';
    samples.hidden = ['close-up', 'gallery'].includes(cases.value);
    if (!gallery.hidden)
      removeGallery = galleryTiles.map(({ family: tileFamily, tile }) =>
        applyResolvedPresentation(
          tile,
          resolvePresentation({ ...presentationOptions, familyId: tileFamily.id }),
        ),
      );
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
