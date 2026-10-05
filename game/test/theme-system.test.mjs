import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePresentation,
  validateInterfaceTheme,
  BUILTIN_INTERFACE_THEMES,
  canvasInterfaceFonts,
  validateThemeFamily,
  BUILTIN_THEME_FAMILIES,
  validatePresentationCoverage,
  contrastRatio,
  applyResolvedPresentation,
} from '../presentation/theme-system.mjs';
import {
  createThemePreferences,
  THEME_PREFERENCES_KEY,
} from '../presentation/theme-preferences.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

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
  assert.equal(canvasInterfaceFonts(resolvePresentation()), null);
  const resolved = resolvePresentation({ familyId: 'industrial-workshop' });
  const fonts = canvasInterfaceFonts(resolved);
  assert.deepEqual(fonts, { ui: resolved.fonts.ui, numeric: resolved.fonts.mono });
  assert.equal(canvasInterfaceFonts(resolved), fonts);
  assert.equal(Object.isFrozen(fonts), true);
});
