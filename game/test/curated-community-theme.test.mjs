import {
  saveAcceptedAppearance,
  loadAcceptedAppearance,
  ACCEPTED_APPEARANCE_CONTEXT_KEY,
} from '../presentation/theme-system.mjs';
import { mountOptionalPracticePanel } from '../ui/optional-practice-panel.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { reviseStudioTheme, duplicateStudioSnapshot } from '../presentation/studio-session.mjs';
import {
  createThemeCandidate,
  unsupportedThemeAssignmentSlots,
} from '../presentation/theme-preview.mjs';
import {
  validateThemeCandidate,
  validateCuratedAppearanceInventory,
  saveAppearanceContext,
  loadAppearanceContext,
} from '../presentation/theme-candidate.mjs';
import {
  withStudioAppearanceTheme,
  withStudioAppearanceDefault,
} from '../../authoring/company-studio/model.mjs';
import {
  createCompanyWorkspaceFiles,
  companySourceDraft,
  companyDraftFiles,
} from '../../scripts/company-studio.mjs';
import {
  createEditionRuntimeCatalog,
  validateEditionRuntimeCatalog,
  resolveEditionAppearanceThemes,
} from '../editions/model.mjs';
import { compileEdition, selectEditionClosure } from '../../scripts/compile-edition.mjs';
import { editionPublicationAssets } from '../../publishing/edition-admission.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { selectedArcadeCollection } from '../presentation/industrial-arcade.mjs';
import { DEFAULT_THEME_PREFERENCES, THEME_PREFERENCES_KEY } from '../presentation/theme-system.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { appearanceLaunchURL } from '../fpv-entry.mjs';
import { mountSimAppearanceControls } from '../../optional-practice/civilian-fpv/sim-presentation.mjs';
import { exportRuntimeTheme, importRuntimeTheme } from '../presentation/runtime-transfer.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { loadRuntimeContentProvider } from '../runtime-content-provider.mjs';
import {
  captureEditionPresentation,
  validateRetainedPresentation,
} from '../editions/retained-presentation.mjs';
import { createThemeBootstrapSeed } from '../../scripts/refresh-theme-bootstrap.mjs';

const original = createDefaultThemeBundle();
const source = reviseStudioTheme(
  duplicateStudioSnapshot(original, { id: 'custom-river', name: 'River workshop' }),
  { tokens: { panel: '#253144', amber: '#fac769' } },
);
const candidate = createThemeCandidate(source, { familyId: 'dnipro-porcelain' });
const pin = { familyId: candidate.family.id, revision: candidate.family.revision };
function memory() {
  const values = new Map(),
    writes = [];
  return {
    values,
    writes,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
      writes.push(key);
    },
    removeItem: (key) => values.delete(key),
  };
}
function communities() {
  const a = createCompanyWorkspaceFiles({ brandId: 'north', name: 'North' });
  const b = createCompanyWorkspaceFiles({ brandId: 'south', name: 'South' });
  const catalog = createEditionRuntimeCatalog({
    brands: [...a.catalog.brands, ...b.catalog.brands],
    campaigns: [...a.catalog.campaigns, ...b.catalog.campaigns],
    editions: [...a.catalog.editions, ...b.catalog.editions],
    assets: [],
    defaultEditionId: a.catalog.defaultEditionId,
  });
  return { a, b, catalog, files: new Map([...a.files, ...b.files]) };
}

test('one edited candidate is reusable in two unrelated source drafts and exact offline publications', async () => {
  const f = communities();
  const originalSources = [...f.files].map(([name, bytes]) => [name, Buffer.from(bytes)]);
  let catalog = withStudioAppearanceTheme(f.catalog, candidate);
  for (const id of ['north', 'south'])
    catalog = withStudioAppearanceDefault(catalog, {
      scope: 'community',
      id,
      appearanceDefault: pin,
    });
  assert.equal(catalog.format, 'revealline-edition-catalog.v3');
  assert.deepEqual(catalog.appearanceThemes, [candidate]);
  assert.deepEqual(validateEditionRuntimeCatalog(catalog), catalog);
  const packet = companySourceDraft({ catalog, files: f.files });
  assert.deepEqual(companyDraftFiles(packet).catalog, catalog);
  f.files.set(
    'game/company.html',
    Buffer.from('<html><head><title>Game</title></head><body></body></html>'),
  );
  for (const id of ['north-public', 'south-public']) {
    const closure = selectEditionClosure(catalog, [id]);
    assert.deepEqual(closure.appearanceThemes, [candidate]);
    assert.equal(closure.brands.length, 1);
    assert.deepEqual(resolveEditionAppearanceThemes(closure, { editionIds: [id] }), [candidate]);
    const compiled = await compileEdition({
      catalog,
      files: f.files,
      editionIds: [id],
      enginePaths: ['game/company.html'],
    });
    const admitted = JSON.parse(compiled.files.get('edition-catalog.json'));
    assert.deepEqual(admitted.appearanceThemes, [candidate]);
    assert.deepEqual(editionPublicationAssets(admitted, compiled.files), []);
    const html = compiled.files.get('game/company.html').toString();
    assert.ok(html.includes(`data-appearance-family="${pin.familyId}"`));
    const seed = JSON.parse(decodeURIComponent(html.match(/data-appearance-seed="([^"]+)"/)[1]));
    assert.equal(seed.variables['--iw-panel'], '#253144');
    assert.equal(seed.familyId, candidate.family.id);
  }
  for (const [name, bytes] of originalSources) assert.deepEqual(f.files.get(name), bytes);
});

test('candidate admission excludes unrelated records, protects immutable identity and rejects missing or executable dependencies', () => {
  const f = communities();
  let catalog = withStudioAppearanceTheme(f.catalog, candidate);
  assert.deepEqual(selectEditionClosure(catalog, ['south-public']).appearanceThemes, []);
  catalog = withStudioAppearanceDefault(catalog, {
    scope: 'campaign',
    id: f.a.catalog.campaigns[0].id,
    appearanceDefault: pin,
  });
  assert.deepEqual(selectEditionClosure(catalog, ['north-public']).appearanceThemes, [candidate]);
  assert.deepEqual(selectEditionClosure(catalog, ['south-public']).appearanceThemes, []);
  for (const change of [
    (row) => {
      row.interfaceTheme.tokens.panel = '#111111';
    },
    (row) => {
      row.interfaceTheme.css = 'body{}';
    },
    (row) => {
      row.family.sim.revision = 'r999';
    },
    (row) => {
      row.basis.interfaceRevision = 'r999';
    },
  ]) {
    const bad = structuredClone(candidate);
    change(bad);
    assert.throws(() => validateThemeCandidate(bad));
  }
  const omitted = structuredClone(selectEditionClosure(catalog, ['north-public']));
  delete omitted.appearanceThemes;
  assert.throws(
    () => validateCuratedAppearanceInventory(omitted, { selectedOnly: true }),
    /unavailable/,
  );
  const missing = structuredClone(selectEditionClosure(catalog, ['north-public']));
  missing.appearanceThemes = [];
  assert.throws(
    () => validateCuratedAppearanceInventory(missing, { selectedOnly: true }),
    /unavailable/,
  );
  assert.throws(
    () =>
      validateCuratedAppearanceInventory({ ...catalog, appearanceThemes: [candidate, candidate] }),
    /Duplicate/,
  );
  let getter = false;
  assert.throws(() =>
    validateCuratedAppearanceInventory({
      get appearanceThemes() {
        getter = true;
        return [];
      },
    }),
  );
  assert.equal(getter, false);
  const revised = createThemeCandidate(
    reviseStudioTheme(source, { tokens: { panel: '#334455' } }),
    { familyId: 'dnipro-porcelain' },
  );
  assert.notEqual(revised.family.id, candidate.family.id);
  assert.deepEqual(withStudioAppearanceTheme(catalog, revised).appearanceThemes, [
    candidate,
    revised,
  ]);
});

test('normal shared host resolves the admitted custom identity and preserves personal override and exact installed artwork', async () => {
  const storage = memory(),
    document = new Document(),
    window = document.defaultView;
  const host = installThemeHost({
    document,
    window,
    getStorage: () => storage,
    prepareStyles: async () => {},
    appearanceThemes: [candidate],
    appearanceDefault: pin,
  });
  await host.ready;
  assert.equal(host.snapshot().familyId, pin.familyId);
  assert.equal(host.snapshot().tokens.panel, '#253144');
  assert.equal(host.snapshot().materialStyle, 'porcelain');
  assert.equal(selectedArcadeCollection(host.effectivePreferences()).id, 'dnipro-porcelain');
  assert.ok(
    host
      .availableFamilies()
      .some((row) => row.id === pin.familyId && row.name === 'River workshop'),
  );
  assert.equal(storage.writes.length, 0);
  host.set({ familyId: 'tryzub' });
  await host.ready;
  await host.setDefault(pin);
  assert.equal(host.snapshot().familyId, 'tryzub');
  host.set({ familyId: 'follow-game' });
  await host.ready;
  const before = host.snapshot();
  await host.setThemes([]);
  assert.notEqual(host.snapshot().familyId, before.familyId);
  assert.match(host.getWarning(), /unavailable/);
  assert.equal(JSON.parse(storage.getItem(THEME_PREFERENCES_KEY)).familyId, 'follow-game');
  await host.setThemes([candidate]);
  assert.equal(host.snapshot().familyId, pin.familyId);
  host.dispose();
});

test('compact export preserves edited candidate scope and unsupported selected source assets are rejected before assignment', async () => {
  assert.deepEqual(unsupportedThemeAssignmentSlots(source, original), []);
  const changed = structuredClone(source);
  changed.assets[0].description += ' edited';
  assert.ok(unsupportedThemeAssignmentSlots(changed, original).length > 0);
  const exported = await exportRuntimeTheme(source, new Map(), { familyId: 'dnipro-porcelain' });
  const imported = await importRuntimeTheme(exported);
  assert.deepEqual(imported.candidate, candidate);
  assert.equal(imported.candidate.interfaceTheme.tokens.panel, '#253144');
  assert.deepEqual(imported.candidate.family.sim, { id: 'dnipro-porcelain', revision: 'r1' });
});

test('custom SIM handoff carries only validated cosmetic context and follows independent personal and world overrides', () => {
  const sessionStorage = memory(),
    localStorage = memory(),
    document = new Document(),
    window = new Events();
  const href = appearanceLaunchURL(
    'https://example.test/optional-practice/fpv-worlds/index.html',
    { ...pin, appearanceThemes: [candidate] },
    { sessionStorage },
  );
  Object.assign(window, {
    location: new URL(href),
    sessionStorage,
    localStorage,
    matchMedia: () => ({ matches: false }),
  });
  const controls = mountSimAppearanceControls({ document, window, container: document.body });
  assert.equal(document.documentElement.dataset.interfaceTheme, pin.familyId);
  assert.equal(document.documentElement.style.getPropertyValue('--iw-panel'), '#253144');
  assert.equal(controls.resolve().appearance.collectionId, 'dnipro-porcelain');
  assert.match(
    document.getElementById('sim-appearance-interface').children[0].textContent,
    /River workshop/,
  );
  assert.deepEqual(localStorage.writes, ['revealline.fpv.appearance.v1']);
  controls.preferences.set({ world: 'dos' });
  assert.equal(controls.resolve().appearance.collectionId, 'dos');
  localStorage.setItem(
    THEME_PREFERENCES_KEY,
    JSON.stringify({ ...DEFAULT_THEME_PREFERENCES, familyId: 'tryzub' }),
  );
  window.emit('storage', {
    key: THEME_PREFERENCES_KEY,
    newValue: localStorage.getItem(THEME_PREFERENCES_KEY),
    storageArea: localStorage,
  });
  assert.equal(document.documentElement.dataset.interfaceTheme, 'tryzub');
  assert.equal(controls.resolve().appearance.collectionId, 'dos');
  controls.dispose();
  const now = 1000;
  saveAppearanceContext(sessionStorage, candidate, { now });
  assert.equal(loadAppearanceContext(sessionStorage, pin, { now: now + 30 * 60 * 1000 + 1 }), null);
  assert.equal(loadAppearanceContext(sessionStorage, { ...pin, revision: 'r2' }, { now }), null);
});

test('compiled first paint uses exact custom palette without preference writes and rejects arbitrary style injection', async () => {
  const script = await readFile(
    new URL('../presentation/theme-bootstrap.mjs', import.meta.url),
    'utf8',
  );
  function paint(seed, personal = 'follow-game') {
    const variables = new Map(),
      dataset = {
        appearanceFamily: pin.familyId,
        appearanceRevision: pin.revision,
        appearanceSeed: encodeURIComponent(JSON.stringify(seed)),
      };
    vm.runInNewContext(script, {
      document: {
        documentElement: {
          dataset,
          style: { setProperty: (key, value) => variables.set(key, value) },
        },
        querySelector: () => null,
      },
      location: { href: 'https://example.test/game/' },
      URL,
      localStorage: {
        getItem: (key) =>
          key === THEME_PREFERENCES_KEY
            ? JSON.stringify({ ...DEFAULT_THEME_PREFERENCES, familyId: personal })
            : null,
        setItem() {
          throw new Error('Unexpected preference write');
        },
      },
      matchMedia: () => ({ matches: false }),
    });
    return { dataset, variables };
  }
  const seed = createThemeBootstrapSeed(candidate);
  assert.equal(paint(seed).dataset.interfaceTheme, pin.familyId);
  assert.equal(paint(seed).variables.get('--iw-panel'), '#253144');
  assert.equal(paint(seed, 'tryzub').dataset.interfaceTheme, 'tryzub');
  const invalid = structuredClone(seed);
  invalid.variables['--rogue'] = 'url(https://evil.test)';
  assert.equal(paint(invalid).dataset.interfaceTheme, 'industrial-workshop');
});

test('retained custom presentation keeps exact curated bytes and late admission advances affected owner revisions', async () => {
  const f = await editionProviderFixture();
  const unresolved = structuredClone(f.catalog);
  unresolved.format = 'revealline-edition-catalog.v2';
  unresolved.brands[0].format = 'revealline-brand-pack.v2';
  unresolved.brands[0].appearanceDefault = pin;
  const registered = withStudioAppearanceTheme(unresolved, candidate);
  assert.equal(registered.brands[0].revision, unresolved.brands[0].revision + 1);
  assert.equal(registered.editions[0].revision, unresolved.editions[0].revision + 1);
  assert.deepEqual(
    withStudioAppearanceDefault(registered, {
      scope: 'community',
      id: 'sample',
      appearanceDefault: pin,
    }),
    registered,
  );
  for (const path of ['game/editions/catalog.json', 'edition-catalog.json'])
    f.files.set(path, registered);
  const provider = await loadRuntimeContentProvider({
    locationRef: { href: 'http://localhost/game/index.html?edition=sample-public' },
    documentRef: { documentElement: { dataset: {} } },
    fetcher: f.fetcher,
  });
  assert.deepEqual(provider.appearanceThemes, [candidate]);
  const snapshot = await captureEditionPresentation(provider.bootstrap);
  assert.deepEqual(snapshot.catalog.appearanceThemes, [candidate]);
  const read = await validateRetainedPresentation(snapshot, { edition: registered.editions[0] });
  assert.deepEqual(read.snapshot.catalog.appearanceThemes, [candidate]);
  const bad = structuredClone(snapshot);
  bad.catalog.appearanceThemes[0].interfaceTheme.tokens.panel = '#abcdef';
  await assert.rejects(validateRetainedPresentation(bad, { edition: registered.editions[0] }));
});

test('unavailable or expired custom SIM context uses authored world with retained intent while explicit world choice wins', () => {
  for (const blocked of [false, true, 'expired']) {
    const localStorage = memory(),
      document = new Document(),
      window = new Events();
    const sessionStorage =
      blocked === true
        ? {
            getItem() {
              throw new Error('Storage denied');
            },
          }
        : memory();
    if (blocked === 'expired')
      saveAppearanceContext(sessionStorage, candidate, { now: Date.now() - 31 * 60 * 1000 });
    Object.assign(window, {
      location: new URL(
        `https://example.test/optional-practice/civilian-fpv/?appearanceFamily=${pin.familyId}&appearanceRevision=r1`,
      ),
      sessionStorage,
      localStorage,
      matchMedia: () => ({ matches: false }),
    });
    const controls = mountSimAppearanceControls({ document, window, container: document.body });
    assert.equal(controls.resolve().appearance.collectionId, 'authored');
    assert.equal(controls.resolve().requested, pin.familyId);
    assert.ok(controls.resolve().fallbackReason);
    controls.preferences.set({ world: 'dos' });
    assert.equal(controls.resolve().appearance.collectionId, 'dos');
    assert.equal(controls.resolve().fallbackReason, null);
    controls.dispose();
  }
});

test('unfinished low-contrast candidate stays previewable but cannot be registered or published', () => {
  const invalidSource = reviseStudioTheme(source, {
    tokens: { panel: '#111111', text: '#111111' },
  });
  const draft = createThemeCandidate(invalidSource, { familyId: 'dnipro-porcelain' });
  assert.equal(validateThemeCandidate(draft).interfaceTheme.tokens.panel, '#111111');
  const f = communities();
  assert.throws(() => withStudioAppearanceTheme(f.catalog, draft), /not ready.*contrast/i);
  const catalog = structuredClone(f.catalog);
  catalog.format = 'revealline-edition-catalog.v3';
  catalog.appearanceThemes = [draft];
  catalog.brands[0].appearanceDefault = {
    familyId: draft.family.id,
    revision: draft.family.revision,
  };
  assert.throws(
    () => validateCuratedAppearanceInventory(catalog, { selectedOnly: true }),
    /not ready.*contrast/i,
  );
});

test('noopener optional launch transfers one bounded context to a separate tab without sharing session storage or preferences', async () => {
  const localStorage = memory(),
    document = new Document();
  document.defaultView.sessionStorage = memory();
  document.defaultView.localStorage = localStorage;
  const container = document.createElement('nav');
  document.body.append(container);
  const panel = mountOptionalPracticePanel({
    document,
    container,
    pause() {},
    href: 'https://example.test/game/index.html',
    getAppearanceDefault: () => ({ ...pin, appearanceThemes: [candidate] }),
    fetcher: async () =>
      new Response(
        JSON.stringify({
          format: 'revealline-optional-package-launchers.v1',
          packages: [
            {
              id: 'civilian-fpv',
              name: 'Academy',
              href: 'civilian-fpv/app/',
              version: 'v1.2.3',
              revision: '1',
            },
          ],
        }),
      ),
  });
  document.getElementById('shell-optional-practice').click();
  await waitFor(() => document.getElementById('optional-practice-dialog').querySelector('a'));
  const link = document.getElementById('optional-practice-dialog').querySelector('a');
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(localStorage.writes.length, 0);
  link.onclick();
  assert.equal(localStorage.writes.length, 1);
  assert.ok(localStorage.writes[0].startsWith('revealline.curated-appearance-context.v1.'));
  const targetDocument = new Document(),
    targetWindow = new Events();
  Object.assign(targetWindow, {
    location: new URL(link.href),
    sessionStorage: memory(),
    localStorage,
    matchMedia: () => ({ matches: false }),
  });
  const controls = mountSimAppearanceControls({
    document: targetDocument,
    window: targetWindow,
    container: targetDocument.body,
  });
  assert.equal(targetDocument.documentElement.dataset.interfaceTheme, pin.familyId);
  assert.equal(controls.resolve().appearance.collectionId, 'dnipro-porcelain');
  assert.equal(loadAppearanceContext(localStorage, pin, { consume: true }), null);
  assert.equal(loadAppearanceContext(targetWindow.sessionStorage, pin).family.id, pin.familyId);
  assert.equal(localStorage.getItem(THEME_PREFERENCES_KEY), null);
  controls.dispose();
  for (const key of ['localStorage', 'sessionStorage'])
    Object.defineProperty(document.defaultView, key, {
      get() {
        throw new Error('Storage denied');
      },
      configurable: true,
    });
  assert.doesNotThrow(() => link.onclick());
  assert.ok(link.href.includes(pin.familyId));
  panel.dispose();
  for (let index = 0; index < 3; index++) {
    const next = createThemeCandidate(
      reviseStudioTheme(source, { tokens: { panel: ['#253144', '#263245', '#273346'][index] } }),
      { familyId: 'dnipro-porcelain' },
    );
    appearanceLaunchURL(
      'https://example.test/optional-practice/civilian-fpv/',
      { familyId: next.family.id, revision: next.family.revision, appearanceThemes: [next] },
      { sessionStorage: memory(), localStorage },
    );
  }
  assert.equal(
    [...localStorage.values.keys()].filter((key) =>
      key.startsWith('revealline.curated-appearance-context.'),
    ).length,
    1,
  );
});

test('only atomic accepted custom context reaches auxiliary pages and expires with its first-paint seed', async () => {
  const session = memory(),
    local = memory(),
    document = new Document(),
    window = document.defaultView;
  window.sessionStorage = session;
  window.localStorage = local;
  const host = installThemeHost({
    document,
    window,
    appearanceThemes: [candidate],
    appearanceDefault: pin,
    prepareStyles: async () => {},
  });
  await host.ready;
  assert.equal(loadAcceptedAppearance(session).family.id, pin.familyId);
  const cached = session.getItem(ACCEPTED_APPEARANCE_CONTEXT_KEY);
  const next = createThemeCandidate(reviseStudioTheme(source, { tokens: { panel: '#263245' } }), {
    familyId: 'dnipro-porcelain',
  });
  document.fonts = {
    load: async () => {
      throw new Error('Font unavailable');
    },
  };
  await host.setThemes([candidate, next]);
  await host.setDefault({ familyId: next.family.id, revision: next.family.revision });
  assert.equal(session.getItem(ACCEPTED_APPEARANCE_CONTEXT_KEY), cached);
  host.dispose();
  const script = await readFile(
    new URL('../presentation/theme-bootstrap.mjs', import.meta.url),
    'utf8',
  );
  const dataset = {},
    variables = new Map();
  vm.runInNewContext(script, {
    document: {
      documentElement: {
        dataset,
        style: { setProperty: (key, value) => variables.set(key, value) },
      },
      currentScript: { dataset: { themeFollowContext: 'true' } },
      querySelector: () => null,
    },
    location: { href: 'https://example.test/game/downloads.html' },
    URL,
    sessionStorage: session,
    localStorage: local,
    matchMedia: () => ({ matches: false }),
  });
  assert.equal(dataset.interfaceTheme, pin.familyId);
  assert.equal(variables.get('--iw-panel'), '#253144');
  for (const [appearanceFamily, appearanceRevision, expected] of [
    ['tryzub', 'r1', 'tryzub'],
    [pin.familyId, 'r999', 'industrial-workshop'],
  ]) {
    const explicit = { appearanceFamily, appearanceRevision };
    vm.runInNewContext(script, {
      document: {
        documentElement: { dataset: explicit, style: { setProperty() {} } },
        currentScript: { dataset: { themeFollowContext: 'true' } },
        querySelector: () => null,
      },
      location: { href: 'https://example.test/game/downloads.html' },
      URL,
      sessionStorage: session,
      localStorage: local,
      matchMedia: () => ({ matches: false }),
    });
    assert.equal(explicit.interfaceTheme, expected);
  }
  const auxiliary = new Document();
  auxiliary.head = null;
  auxiliary.defaultView.sessionStorage = session;
  auxiliary.defaultView.localStorage = local;
  const previous = Object.fromEntries(
    ['document', 'window', 'sessionStorage'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  try {
    Object.defineProperties(globalThis, {
      document: { value: auxiliary, configurable: true },
      window: { value: auxiliary.defaultView, configurable: true },
      sessionStorage: { value: session, configurable: true },
    });
    await import(`../presentation/theme-entry.mjs?auxiliary=${Date.now()}`);
    const lease = installThemeHost({ document: auxiliary });
    await lease.ready;
    assert.equal(lease.snapshot().familyId, pin.familyId);
    lease.set({ familyId: 'tryzub' });
    await lease.ready;
    assert.equal(lease.snapshot().familyId, 'tryzub');
    assert.equal(loadAcceptedAppearance(session), null);
    lease.dispose();
  } finally {
    for (const [key, descriptor] of Object.entries(previous))
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  }
  saveAcceptedAppearance(session, candidate, { now: 1000 });
  assert.equal(loadAcceptedAppearance(session, { now: 1801001 }), null);
  const expiredDataset = {};
  vm.runInNewContext(script, {
    document: {
      documentElement: { dataset: expiredDataset, style: { setProperty() {} } },
      currentScript: { dataset: { themeFollowContext: 'true' } },
      querySelector: () => null,
    },
    location: { href: 'https://example.test/game/downloads.html' },
    URL,
    sessionStorage: session,
    localStorage: memory(),
    matchMedia: () => ({ matches: false }),
  });
  assert.equal(expiredDataset.interfaceTheme, 'industrial-workshop');
});
