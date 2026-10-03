import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolvePresentation,
  validateInterfaceTheme,
  BUILTIN_INTERFACE_THEMES,
  canvasInterfaceFonts,
  validateThemeFamily,
  BUILTIN_THEME_FAMILIES,
  getThemeFamily,
  validatePresentationCoverage,
  contrastRatio,
  applyResolvedPresentation,
} from '../presentation/theme-system.mjs';
import {
  createThemePreferences,
  THEME_PREFERENCES_KEY,
} from '../presentation/theme-preferences.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { createThemeCandidate } from '../presentation/theme-preview.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import {
  createMaterialSamples,
  createMaterialCloseUp,
  evaluateMaterialSemantics,
  MATERIAL_SAMPLE_CASES,
} from './fixtures/appearance-materials.mjs';

function memory() {
  const values = new Map(),
    writes = [];
  return {
    values,
    writes,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      writes.push(key);
      values.set(key, value);
    },
  };
}
test('rendered-material fixture uses matched native control pairs without replacing runtime paint', () => {
  const document = new Document(),
    container = document.createElement('section');
  createMaterialSamples(document, container);
  assert.equal(container.children.length, MATERIAL_SAMPLE_CASES.length);
  for (const spec of MATERIAL_SAMPLE_CASES) {
    const shown = container.querySelector(`#sample-${spec.id}`),
      twin = container.querySelector(`#sample-${spec.id}-twin`);
    assert.ok(shown && twin, spec.id);
    assert.equal(shown.tagName, twin.tagName);
    assert.equal(shown.dataset.uiAction, twin.dataset.uiAction);
    assert.equal(shown.dataset.uiSurface, twin.dataset.uiSurface);
    assert.equal(shown.dataset.state, twin.dataset.state);
    assert.equal(shown.dataset.readingTwin, 'false');
    assert.equal(twin.dataset.readingTwin, 'true');
    assert.equal(shown.disabled, twin.disabled);
    for (const attribute of ['aria-pressed', 'aria-busy'])
      assert.equal(shown.getAttribute(attribute), twin.getAttribute(attribute));
    for (const sample of [shown, twin])
      for (const property of [
        'background',
        'backgroundColor',
        'backgroundImage',
        'color',
        'borderImageSource',
      ])
        assert.ok(!sample.style[property], `${spec.id}: runtime owns ${property}`);
    if (spec.id === 'default')
      assert.equal(shown.dataset.state, undefined, 'the normal sample exercises native hover');
  }
  assert.equal(container.querySelector('#sample-input').type, 'text');
  assert.equal(container.querySelector('#sample-input-twin').value, '');
  assert.equal(
    container.querySelector('#sample-selected-hover').getAttribute('aria-pressed'),
    'true',
  );
  assert.equal(container.querySelector('#sample-selected-hover').dataset.state, 'hover');
  assert.equal(
    container.querySelector('#sample-selected-pressed').getAttribute('aria-pressed'),
    'true',
  );
  assert.equal(container.querySelector('#sample-selected-pressed').dataset.state, 'pressed');
  assert.equal(container.querySelector('#sample-danger-pressed').dataset.uiAction, 'danger');
  assert.equal(container.querySelector('#sample-danger-pressed').dataset.state, 'pressed');
  for (const id of ['sample-muted-panel', 'sample-muted-panel-twin'])
    assert.equal(container.querySelector(`#${id}`).querySelector('span').dataset.uiTone, 'muted');
  assert.equal(container.querySelector('#sample-disabled').disabled, true);
});
test('material semantic checks reject active disabled paint and a pressed danger recolored as selection', () => {
  const tokens = resolvePresentation({ familyId: 'industrial-workshop' }).tokens,
    samples = [false, true].flatMap((twin) => [
      {
        id: `sample-selected-disabled${twin ? '-twin' : ''}`,
        background: tokens.panel,
        foreground: tokens.muted,
        shadow: 'none',
        borderImage: 'none',
        finish: 'none',
      },
      {
        id: `sample-danger-pressed${twin ? '-twin' : ''}`,
        background: tokens.hazard,
        foreground: tokens.onHazard,
        borderImage: 'none',
      },
    ]);
  const report = evaluateMaterialSemantics(samples, tokens);
  assert.equal(report.status, 'passed');
  assert.equal(report.checks.length, 16);
  for (const [sampleId, property, value] of [
    ['sample-selected-disabled', 'background', tokens.selection],
    ['sample-selected-disabled-twin', 'foreground', tokens.onSelection],
    ['sample-selected-disabled', 'shadow', 'rgb(0, 0, 0) 0px 4px 0px'],
    ['sample-selected-disabled', 'finish', 'linear-gradient(white, black)'],
    ['sample-selected-disabled', 'borderImage', 'url("amber-frame.svg")'],
    ['sample-danger-pressed', 'background', tokens.selection],
    ['sample-danger-pressed-twin', 'borderImage', 'url("amber-frame.svg")'],
  ]) {
    const changed = samples.map((sample) =>
        sample.id === sampleId ? { ...sample, [property]: value } : sample,
      ),
      result = evaluateMaterialSemantics(changed, tokens);
    assert.equal(result.status, 'failed', `${sampleId}.${property}`);
    assert.ok(
      result.checks.some((check) => check.id === `${sampleId}.${property}` && !check.passed),
    );
  }
  assert.equal(
    evaluateMaterialSemantics(samples.slice(1), tokens).status,
    'failed',
    'missing samples fail closed',
  );
  const rgb = (color) =>
      color.replace(
        /^#(..)(..)(..)$/,
        (_, red, green, blue) =>
          `rgb(${parseInt(red, 16)}, ${parseInt(green, 16)}, ${parseInt(blue, 16)})`,
      ),
    computed = samples.map((sample) => ({
      ...sample,
      background: rgb(sample.background),
      foreground: rgb(sample.foreground),
    }));
  assert.equal(
    evaluateMaterialSemantics(computed, tokens).status,
    'passed',
    'browser RGB serialization matches hex tokens',
  );
  for (const options of [{ forcedColors: true }, { styled: false }]) {
    const skipped = evaluateMaterialSemantics(samples, tokens, options);
    assert.equal(skipped.status, 'skipped');
    assert.ok(skipped.reason);
    assert.deepEqual(skipped.checks, []);
  }
});
test('material close-up composes native player, Studio and tall-card surfaces without replacing paint', () => {
  const document = new Document(),
    container = document.createElement('section'),
    { studio } = createMaterialCloseUp(document, container);
  assert.ok(studio.className.includes('material-close-up-studio'));
  assert.equal(studio.dataset.uiSurface, 'panel');
  const controls = container.querySelectorAll('[data-close-up-control]');
  assert.equal(controls.length, 8);
  for (const control of controls) {
    assert.ok(['BUTTON', 'INPUT'].includes(control.tagName));
    for (const property of [
      'background',
      'backgroundImage',
      'color',
      'borderImageSource',
      'boxShadow',
    ])
      assert.ok(
        !control.style[property],
        `${control.dataset.closeUpControl}: runtime owns ${property}`,
      );
    assert.equal(
      control.dataset.materialSample,
      undefined,
      'close-ups do not alter the 19 contrast pairs',
    );
  }
  assert.equal(
    container.querySelector('[data-close-up-control="selected-card"]').getAttribute('aria-pressed'),
    'true',
  );
  assert.equal(container.querySelector('[data-close-up-control="studio-disabled"]').disabled, true);
});
test('danger pressed and disabled recipes retain their semantic pairs across themes and contrast preferences', () => {
  for (const family of BUILTIN_THEME_FAMILIES)
    for (const highContrast of [false, true]) {
      const resolved = resolvePresentation({
        familyId: family.id,
        accessibility: { highContrast },
      });
      assert.equal(
        resolved.components.danger.states.pressed.background,
        resolved.tokens.hazard,
        `${family.id}: hazard fill`,
      );
      assert.equal(
        resolved.components.danger.states.pressed.foreground,
        resolved.tokens.onHazard,
        `${family.id}: hazard foreground`,
      );
      for (const role of ['button', 'primary', 'danger']) {
        assert.equal(
          resolved.components[role].states.disabled.background,
          resolved.tokens.panel,
          `${family.id} ${role}: disabled fill`,
        );
        assert.equal(
          resolved.components[role].states.disabled.foreground,
          resolved.tokens.muted,
          `${family.id} ${role}: disabled foreground`,
        );
      }
    }
});
test('all production and future specimen interfaces validate and meet text contrast', () => {
  for (const theme of BUILTIN_INTERFACE_THEMES) {
    assert.equal(validateInterfaceTheme(theme).id, theme.id);
    for (const highContrast of [false, true]) {
      const view = resolvePresentation({ interfaceId: theme.id, accessibility: { highContrast } });
      const report = validatePresentationCoverage(view);
      assert.equal(report.valid, true, `${theme.id}: ${report.errors.join(', ')}`);
      assert.ok(Object.isFrozen(view.components.button.focus));
      assert.equal(view.materials.panel.fill, true);
    }
  }
  assert.equal(contrastRatio('#ffffff', '#000000'), 21);
});
test('accessibility wins over theme and compact density, while selection/focus remain independent', () => {
  const view = resolvePresentation({
    familyId: 'industrial-workshop',
    density: 'studio',
    accessibility: {
      highContrast: true,
      textFace: 'plain',
      textSize: 'large',
      reducedEffects: true,
    },
  });
  assert.equal(view.targetSize, 44);
  assert.equal(view.textured, false);
  assert.equal(view.fonts.display, view.fonts.ui);
  assert.equal(view.accessibility.reducedEffects, true);
  assert.equal(view.components.button.selection.cue, 'selected');
  assert.equal(view.components.button.focus.width, 3);
  assert.equal(resolvePresentation({ density: 'studio' }).targetSize, 32);
  assert.equal(
    resolvePresentation({ density: 'studio', accessibility: { coarsePointer: true } }).targetSize,
    44,
  );
});
test('ornaments Off removes frame wear and interface sampling never chooses SIM nearest filtering', () => {
  const detailed = resolvePresentation({ familyId: 'industrial-workshop' });
  const plain = resolvePresentation({ familyId: 'industrial-workshop', ornaments: 'off' });
  assert.notEqual(detailed.materials.panel.source, plain.materials.panel.source);
  assert.equal(plain.textured, false);
  assert.equal(detailed.sampling.interface, 'nearest');
  assert.equal(detailed.sampling.sim, 'mipmapped');
  assert.equal('course' in detailed, false);
  assert.equal('pictures' in detailed, false);
});
test('ornaments Off suppresses texture for every installed family without removing semantic state cues', () => {
  for (const family of BUILTIN_THEME_FAMILIES) {
    const plain = resolvePresentation({ familyId: family.id, ornaments: 'off' });
    const doc = new Document();
    const release = applyResolvedPresentation(doc.documentElement, plain);
    assert.equal(plain.textured, false, family.id);
    assert.equal(doc.documentElement.dataset.themeTexture, 'off', family.id);
    assert.equal(plain.components.button.selection.cue, 'selected');
    assert.equal(plain.components.button.focus.width, 3);
    assert.equal(validatePresentationCoverage(plain).valid, true, family.id);
    release();
  }
});

// Inspect the shared stylesheet itself: palette validation cannot catch a
// repeating border image painted over an otherwise accessible token pair.
function surfaceRules() {
  const css = readFileSync(
    new URL('../presentation/industrial-workshop.css', import.meta.url),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.trim(),
    properties: Object.fromEntries(
      body
        .split(';')
        .map((declaration) => declaration.trim().match(/^([\w-]+):\s*([\s\S]*)$/))
        .filter(Boolean)
        .map(([, property, value]) => [property, value.trim()]),
    ),
  }));
}

test('shared material layers preserve semantic state colors and reset at every presentation scope', () => {
  const rules = surfaceRules();
  const defaults = rules.find((rule) => rule.selector === '[data-theme-family]');
  for (const role of ['panel', 'control', 'active', 'inset', 'toolbar', 'thumb'])
    assert.equal(defaults.properties[`--ui-${role}-finish`], 'none');
  for (const frame of ['panel', 'raised', 'primary'])
    assert.equal(defaults.properties[`--ui-${frame}-frame`], 'none');
  assert.equal(defaults.properties['--ui-hover-face'], 'initial');
  assert.equal(defaults.properties['--ui-hover-ink'], 'initial');
  const panels = rules.find(
    (rule) => rule.selector.includes('.overlay-card') && rule.properties.border,
  );
  const actions = rules.find(
    (rule) => rule.properties['--ui-action-fill'] && rule.properties.padding,
  );
  const inputs = rules.find((rule) => rule.selector.endsWith(':where(input, select, textarea)'));
  for (const [rule, finish, base] of [
    [panels, 'panel', '--iw-panel'],
    [actions, 'control', '--ui-action-fill'],
    [inputs, 'inset', '--iw-input'],
  ]) {
    assert.ok(rule);
    assert.ok(rule.properties.background.startsWith(`var(--ui-${finish}-finish, none),`));
    assert.ok(
      rule.properties.background.includes(`var(${base}`),
      'texture overlays the semantic state, not a fixed pigment',
    );
    assert.match(rule.properties.border, /solid var\(/);
  }
  for (const state of ['hover', 'pressed']) {
    const rule = rules.find((item) =>
      item.properties.background?.includes(`var(--ui-action-${state}-fill)`),
    );
    assert.equal(rule.properties.color, `var(--ui-action-${state}-ink)`);
    assert.ok(rule.selector.includes(`:${state === 'pressed' ? 'active' : 'hover'}`));
    assert.ok(
      rule.selector.includes(`[data-state='${state}']`),
      'fixture and actual pointer share one rule',
    );
    assert.ok(rule.selector.includes(":not(:disabled, [aria-disabled='true'])"));
  }
  const selected = rules.find(
    (rule) =>
      rule.selector.includes("[aria-pressed='true']") && rule.properties['--ui-action-fill'],
  );
  assert.equal(selected.properties.color, 'var(--ui-action-ink)');
  assert.ok(selected.properties.background.endsWith('var(--ui-action-fill)'));
  assert.match(selected.properties['border-color'], /--iw-focus/);
  const disabled = rules.find(
    (rule) => rule.properties.cursor === 'not-allowed' && rule.properties.opacity,
  );
  assert.doesNotMatch(
    disabled.properties.background,
    /finish|gradient|url\(/,
    'disabled information remains quiet',
  );
  assert.equal(disabled.properties['border-image'], 'none');
  assert.ok(
    rules.some(
      (rule) => rule.selector.includes(':focus-visible') && /3px/.test(rule.properties.outline),
    ),
  );
  const flat = rules.find((rule) => rule.selector === "[data-theme-surface='flat']");
  for (const role of ['panel', 'action', 'hover', 'pressed', 'selected', 'gallery']) {
    assert.equal(flat.properties[`--ui-${role}-depth`], 'none');
    assert.equal(
      defaults.properties[`--ui-${role}-depth`],
      role === 'gallery' ? 'none' : 'initial',
    );
  }
  assert.ok(
    !rules.some((rule) => rule.selector.startsWith("[data-theme-surface='flat'] ")),
    'flat parent scopes cannot suppress nested beveled specimens',
  );
  const forced = rules.find((rule) => rule.selector === '[data-theme-family][data-theme-material]');
  for (const role of ['panel', 'control', 'active', 'inset', 'toolbar', 'thumb'])
    assert.equal(forced.properties[`--ui-${role}-finish`], 'none');
  const reduced = rules.find(
    (rule) =>
      rule.selector.startsWith("[data-theme-motion='reduced']") &&
      rule.properties.transition === 'none' &&
      rule.selector.includes('button'),
  );
  assert.ok(reduced, 'actual native controls respect the game motion override');
});

test('authored and retained Industrial identities keep their own material capability for scoped recipes', () => {
  const candidate = createThemeCandidate(createDefaultThemeBundle(), {
    familyId: 'industrial-workshop',
  });
  const authored = resolvePresentation({
    themeFamily: candidate.family,
    interfaceTheme: candidate.interfaceTheme,
  });
  assert.notEqual(authored.familyId, 'industrial-workshop');
  assert.equal(authored.materialStyle, 'steel');
  const doc = new Document();
  applyResolvedPresentation(doc.documentElement, authored);
  assert.equal(doc.documentElement.dataset.themeMaterial, 'steel');
  const retained = resolvePresentation({
    themeFamily: getThemeFamily('industrial-workshop', 'r1'),
  });
  assert.equal(retained.materialStyle, 'industrial-workshop');
});

test('decorative face recipes require their own enabled texture and contrast scope', () => {
  const recipes = surfaceRules().filter((rule) =>
    Object.entries(rule.properties).some(
      ([name, value]) => /^--ui-.*-finish$/.test(name) && value !== 'none',
    ),
  );
  assert.ok(recipes.length >= 10, 'each material family declares its own face treatment');
  for (const recipe of recipes) {
    assert.ok(recipe.selector.includes("[data-theme-texture='on']"), recipe.selector);
    assert.ok(recipe.selector.includes("[data-theme-contrast='normal']"), recipe.selector);
    assert.doesNotMatch(
      recipe.selector,
      /\.menu-scene|\bbutton\b/,
      'finish belongs to a presentation scope, never an ancestor descendant selector',
    );
    assert.equal(recipe.properties.animation, undefined, 'material grain is static');
  }
  const industrial = recipes.find((recipe) => recipe.properties['--ui-hover-face']);
  assert.equal(industrial.properties['--ui-hover-face'], 'var(--iw-accent)');
  assert.equal(industrial.properties['--ui-hover-ink'], 'var(--iw-on-accent)');
});

test('gallery and nested backdrops consume their nearest scope material while retaining palette and focus cues', () => {
  const rules = surfaceRules();
  const card = rules.find((rule) => rule.selector === '.theme-gallery .theme-preview-card');
  assert.equal(card.properties['border-image'], 'var(--ui-raised-frame, none)');
  assert.equal(card.properties['box-shadow'], 'var(--ui-gallery-depth, none)');
  assert.ok(card.properties.background.startsWith('var(--ui-control-finish, none),'));
  const hover = rules.find((rule) => rule.selector.includes('.theme-preview-card:hover:not('));
  for (const excluded of [
    "[aria-pressed='true']",
    ':disabled',
    ':active',
    "[data-state='pressed']",
  ])
    assert.ok(hover.selector.includes(excluded), `gallery hover excludes ${excluded}`);
  assert.equal(hover.properties.color, 'var(--ui-action-hover-ink)');
  assert.equal(
    hover.properties.background,
    'var(--ui-control-finish, none), var(--ui-action-hover-fill)',
  );
  const selected = rules.find(
      (rule) => rule.selector === ".theme-gallery .theme-preview-card[aria-pressed='true']",
    ),
    pressed = rules.find((rule) => rule.selector.includes('.theme-preview-card:is(:active,'));
  assert.ok(pressed.selector.includes("[data-state='pressed']"));
  assert.ok(pressed.selector.includes(":not(:disabled, [aria-disabled='true'])"));
  assert.equal(pressed.properties.color, 'var(--ui-action-pressed-ink)');
  assert.equal(
    pressed.properties.background,
    'var(--ui-active-finish, none), var(--ui-action-pressed-fill)',
  );
  assert.ok(rules.indexOf(pressed) > rules.indexOf(selected), 'pressed paint wins over selection');
  const swatches = rules.find((rule) => rule.selector === '.theme-preview-swatches');
  assert.equal(swatches.properties.display, 'grid');
  assert.equal(swatches.properties.gap, '0');
  const accent = rules.find(
    (rule) =>
      rule.selector === "[data-theme-styled='true'] .menu-scene[data-backdrop='interface']::before",
  );
  const defaults = rules.find((rule) => rule.selector === '[data-theme-family]');
  assert.equal(accent.properties['background-repeat'], 'var(--ui-scene-repeat)');
  assert.equal(defaults.properties['--ui-scene-repeat'], 'no-repeat');
  assert.match(defaults.properties['--ui-scene-inset'], /auto auto$/);
  assert.match(defaults.properties['--ui-scene-width'], /min\(/);
  assert.equal(defaults.properties['--ui-scene-motif'], 'none');
  const off = rules.find((rule) => rule.selector === "[data-theme-texture='off']");
  assert.equal(off.properties['--ui-scene-motif'], 'none');
});
test('interface validation rejects executable styles, unknown fields and missing provenance', () => {
  const source = structuredClone(BUILTIN_INTERFACE_THEMES[1]);
  assert.throws(() => validateInterfaceTheme({ ...source, css: 'body{}' }));
  assert.throws(() =>
    validateInterfaceTheme({ ...source, fonts: { ...source.fonts, ui: 'url(evil)' } }),
  );
  assert.throws(() =>
    validateInterfaceTheme({ ...source, tokens: { ...source.tokens, text: 'red' } }),
  );
  assert.throws(() => validateInterfaceTheme({ ...source, provenance: {} }));
});
test('DOM application keeps controls and focus, restores only its owned styles', () => {
  const doc = new Document(),
    root = doc.documentElement;
  const button = doc.createElement('button');
  doc.body.append(button);
  button.focus();
  root.style.setProperty('--iw-panel', '#123456');
  const release = applyResolvedPresentation(
    root,
    resolvePresentation({ familyId: 'industrial-workshop' }),
  );
  assert.equal(doc.activeElement, button);
  assert.equal(root.dataset.interfaceTheme, 'industrial-workshop');
  root.style.setProperty('--iw-text', '#fedcba');
  release();
  assert.equal(root.style.getPropertyValue('--iw-panel'), '#123456');
  assert.equal(root.style.getPropertyValue('--iw-text'), '#fedcba');
  assert.equal(root.dataset.interfaceTheme, undefined);
});
test('custom interface identity retains its material recipe and restores the prior DOM lease', () => {
  const source = BUILTIN_INTERFACE_THEMES.find((theme) => theme.id === 'dnipro-porcelain');
  const doc = new Document();
  doc.documentElement.dataset.themeMaterial = 'steel';
  const view = resolvePresentation({
    interfaceTheme: { ...source, id: 'candidate-river-club', name: 'River Club' },
  });
  const release = applyResolvedPresentation(doc.documentElement, view);
  assert.equal(view.interfaceId, 'candidate-river-club');
  assert.equal(view.materialStyle, 'porcelain');
  assert.equal(doc.documentElement.dataset.interfaceTheme, 'candidate-river-club');
  assert.equal(doc.documentElement.dataset.themeMaterial, 'porcelain');
  release();
  assert.equal(doc.documentElement.dataset.interfaceTheme, undefined);
  assert.equal(doc.documentElement.dataset.themeMaterial, 'steel');
});
test('new theme preferences preserve defaults and do not touch legacy state on read', () => {
  const storage = memory();
  const legacyMenu = JSON.stringify({ palette: 'ukrainian', ornaments: 'off' });
  storage.values.set('revealline.menu-style.v1', legacyMenu);
  const prefs = createThemePreferences({ getStorage: () => storage });
  assert.equal(prefs.snapshot().familyId, 'legacy');
  assert.deepEqual(storage.writes, []);
  prefs.set({ familyId: 'industrial-workshop' });
  assert.deepEqual(storage.writes, [THEME_PREFERENCES_KEY]);
  assert.equal(storage.values.get('revealline.menu-style.v1'), legacyMenu);
  assert.equal(prefs.snapshot().arcadeArt, 'authored');
  prefs.set({ familyId: 'windows-classic' });
  assert.equal(prefs.snapshot().familyId, 'windows-classic');
  prefs.dispose();
});
test('failed/session-only saving retains local intent instead of stale cross-tab state', () => {
  const storage = memory(),
    win = new Events();
  const prefs = createThemePreferences({
    window: win,
    getStorage: () => storage,
    writable: () => false,
  });
  prefs.set({ familyId: 'industrial-workshop' });
  const value = JSON.stringify({
    familyId: 'legacy',
    arcadeArt: 'authored',
    highContrast: false,
    opaqueHud: false,
  });
  storage.values.set(THEME_PREFERENCES_KEY, value);
  win.emit('storage', { key: THEME_PREFERENCES_KEY, newValue: value, storageArea: storage });
  assert.equal(prefs.snapshot().familyId, 'industrial-workshop');
  assert.match(prefs.getWarning(), /session/);
  prefs.dispose();
});
test('theme host applies only latest prepared selection and a failed load retains the accepted presentation', async () => {
  const doc = new Document(),
    win = new Events(),
    storage = memory();
  let finish;
  const loading = new Promise((resolve) => {
    finish = resolve;
  });
  const host = installThemeHost({
    document: doc,
    window: win,
    getStorage: () => storage,
    prepareStyles: () => loading,
  });
  host.set({ familyId: 'industrial-workshop' });
  host.setInterface('dos');
  assert.equal(host.snapshot(), null);
  finish();
  await host.ready;
  assert.equal(host.snapshot().interfaceId, 'dos');
  assert.equal(host.snapshot().familyId, 'industrial-workshop');
  await host.setInterface(null);
  assert.equal(host.snapshot().interfaceId, 'industrial-workshop');
  host.dispose();
  assert.equal(doc.documentElement.dataset.interfaceTheme, undefined);
});
test('theme host recovers from stylesheet failure without applying a partial theme', async () => {
  const doc = new Document(),
    storage = memory();
  let fail = true;
  const host = installThemeHost({
    document: doc,
    window: new Events(),
    getStorage: () => storage,
    prepareStyles: () =>
      fail ? Promise.reject(new Error('Offline missing sheet')) : Promise.resolve(),
  });
  const statuses = [];
  const stopStatus = host.subscribeStatus((message) => statuses.push(message));
  host.set({ familyId: 'industrial-workshop' });
  await host.ready;
  assert.equal(host.snapshot(), null);
  assert.match(host.getWarning(), /Offline/);
  assert.match(statuses.at(-1), /Offline/);
  fail = false;
  await host.refresh();
  assert.equal(host.snapshot().interfaceId, 'industrial-workshop');
  assert.equal(statuses.at(-1), '');
  stopStatus();
  host.dispose();
});

test('family documents pin independent revisions and reject mutable or unexpected references', () => {
  for (const family of BUILTIN_THEME_FAMILIES) {
    assert.deepEqual(validateThemeFamily(family), family);
    assert.ok(Object.isFrozen(validateThemeFamily(family).interface));
  }
  const family = structuredClone(BUILTIN_THEME_FAMILIES[1]);
  assert.throws(() =>
    validateThemeFamily({ ...family, sim: { id: 'industrial-workshop', revision: 'latest' } }),
  );
  assert.throws(() => validateThemeFamily({ ...family, physics: { gravity: 0 } }));
  const custom = { ...family, id: 'custom-family', revision: 'r2' };
  const view = resolvePresentation({ themeFamily: custom });
  assert.equal(view.familyId, 'custom-family');
  assert.equal(view.familyRevision, 'r2');
  assert.throws(
    () =>
      resolvePresentation({
        themeFamily: { ...custom, interface: { ...custom.interface, revision: 'r99' } },
      }),
    /Interface revision unavailable/,
  );
});
test('DOS uses a mono stack before the Plain accessibility override', () => {
  const view = resolvePresentation({ interfaceId: 'dos' });
  assert.equal(view.fonts.ui, view.fonts.mono);
  assert.equal(view.surface, 'flat');
  assert.notEqual(
    resolvePresentation({ interfaceId: 'dos', accessibility: { textFace: 'plain' } }).fonts.ui,
    view.fonts.ui,
  );
});

test('Canvas consumes interface fonts independently from authored arcade artwork', () => {
  assert.equal(
    canvasInterfaceFonts(resolvePresentation({ themeFamily: getThemeFamily('legacy', 'r1') })),
    null,
  );
  assert.ok(
    canvasInterfaceFonts(resolvePresentation({ familyId: 'legacy' })),
    'Current Classic Field Kit consumes its declared typography.',
  );
  const resolved = resolvePresentation({ familyId: 'industrial-workshop' });
  const fonts = canvasInterfaceFonts(resolved);
  assert.deepEqual(fonts, { ui: resolved.fonts.ui, numeric: resolved.fonts.mono });
  assert.equal(canvasInterfaceFonts(resolved), fonts);
  assert.equal(Object.isFrozen(fonts), true);
});
