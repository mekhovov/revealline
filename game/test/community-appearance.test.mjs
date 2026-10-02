import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAppearanceDefault,
  validateEditionRuntimeCatalog,
  resolveEditionSelection,
  resolveEditionAppearanceDefault,
  createEditionRuntimeCatalog,
  EDITION_FORMATS,
} from '../editions/model.mjs';
import {
  withStudioAppearanceDefault,
  validateStudioDraft,
} from '../../authoring/company-studio/model.mjs';
import {
  createCompanyWorkspaceFiles,
  companySourceDraft,
  companyDraftFiles,
} from '../../scripts/company-studio.mjs';
import { BUILTIN_THEME_FAMILIES } from '../presentation/theme-system.mjs';
import { loadRuntimeContentProvider } from '../runtime-content-provider.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { retainedEditionFixture } from './helpers/retained-edition-fixture.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { loadEditionToolProvider } from '../ui/edition-tool-provider.mjs';

test('appearance defaults are data-only immutable pins and preserve unavailable intent', () => {
  const pin = { familyId: 'future-local-theme', revision: 'r19' };
  assert.deepEqual(validateAppearanceDefault(pin), pin);
  assert.ok(Object.isFrozen(validateAppearanceDefault(pin)));
  for (const invalid of [
    null,
    { ...pin, css: 'body{}' },
    { ...pin, familyId: '../private' },
    { ...pin, revision: 'https://remote.test/theme' },
  ])
    assert.throws(() => validateAppearanceDefault(invalid));
  let ran = false;
  assert.throws(() =>
    validateAppearanceDefault({
      get familyId() {
        ran = true;
        return 'legacy';
      },
      revision: 'r1',
    }),
  );
  assert.equal(ran, false);
});

test('each installed family travels through an ordinary community draft without changing source or legacy identity', () => {
  const workspace = createCompanyWorkspaceFiles({
      brandId: 'theme-community',
      name: 'Theme community',
    }),
    original = JSON.stringify(workspace.catalog),
    campaignId = workspace.catalog.campaigns[0].id;
  for (const family of BUILTIN_THEME_FAMILIES) {
    const pin = { familyId: family.id, revision: family.revision };
    const community = withStudioAppearanceDefault(workspace.catalog, {
      scope: 'community',
      id: 'theme-community',
      appearanceDefault: pin,
    });
    assert.equal(community.format, EDITION_FORMATS.appearanceCatalog);
    assert.equal(community.brands[0].format, EDITION_FORMATS.appearanceBrand);
    assert.equal(community.brands[0].themeId, workspace.catalog.brands[0].themeId);
    assert.equal(community.brands[0].revision, workspace.catalog.brands[0].revision + 1);
    assert.deepEqual(resolveEditionAppearanceDefault(resolveEditionSelection(community)), pin);
    const campaign = withStudioAppearanceDefault(community, {
      scope: 'campaign',
      id: campaignId,
      appearanceDefault: { familyId: 'legacy', revision: 'r1' },
    });
    assert.deepEqual(resolveEditionAppearanceDefault(resolveEditionSelection(campaign)), {
      familyId: 'legacy',
      revision: 'r1',
    });
    assert.equal(campaign.campaigns[0].revision, workspace.catalog.campaigns[0].revision);
    const packet = companySourceDraft({ ...workspace, catalog: campaign });
    assert.deepEqual(validateStudioDraft(packet).catalog, campaign);
    const imported = companyDraftFiles(packet);
    assert.deepEqual(imported.catalog, campaign);
    assert.deepEqual(
      imported.files.get(campaign.campaigns[0].sourcePath),
      workspace.files.get(campaign.campaigns[0].sourcePath),
    );
    const inherited = withStudioAppearanceDefault(campaign, { scope: 'campaign', id: campaignId });
    assert.deepEqual(resolveEditionAppearanceDefault(resolveEditionSelection(inherited)), pin);
  }
  assert.equal(JSON.stringify(workspace.catalog), original);
  assert.throws(
    () =>
      withStudioAppearanceDefault(workspace.catalog, {
        scope: 'community',
        id: 'other',
        appearanceDefault: null,
      }),
    /registered/,
  );
  assert.throws(
    () =>
      withStudioAppearanceDefault(workspace.catalog, {
        scope: 'community',
        id: 'theme-community',
        appearanceDefault: { familyId: 'missing', revision: 'r1' },
      }),
    /unavailable/,
  );
});

test('canonical provider resolves selected campaign appearance and retains its edition admission boundary', async () => {
  const fixture = await editionProviderFixture(),
    catalog = structuredClone(fixture.catalog),
    source = JSON.stringify(fixture.source);
  catalog.brands[0].appearanceDefault = { familyId: 'tryzub', revision: 'r1' };
  catalog.format = EDITION_FORMATS.appearanceCatalog;
  catalog.brands[0].format = EDITION_FORMATS.appearanceBrand;
  catalog.campaigns[0].appearanceDefault = { familyId: 'dnipro-porcelain', revision: 'r1' };
  fixture.files.set('game/editions/catalog.json', validateEditionRuntimeCatalog(catalog));
  const provider = await loadRuntimeContentProvider({
    locationRef: { href: 'http://localhost/game/?edition=sample-public' },
    documentRef: { documentElement: { dataset: {} } },
    fetcher: fixture.fetcher,
    verifyAssets: async () => {},
  });
  assert.deepEqual(provider.appearanceDefault, catalog.campaigns[0].appearanceDefault);
  assert.deepEqual(
    provider.appearanceDefaultFor(catalog.campaigns[0].id),
    provider.appearanceDefault,
  );
  assert.throws(() => provider.appearanceDefaultFor('another-community'), /not included/);
  assert.equal(provider.selection.brand.themeId, catalog.brands[0].themeId);
  assert.equal(JSON.stringify(fixture.source), source);
  assert.throws(() => provider.href({ edition: 'another-community' }), /another company/);
  await assert.rejects(
    loadRuntimeContentProvider({
      locationRef: { href: 'http://localhost/game/?edition=another-community' },
      documentRef: { documentElement: { dataset: { editionId: 'sample-public' } } },
      fetcher: fixture.fetcher,
    }),
    /another audience/,
  );
});

test('v1 documents remain exact and reject new appearance fields until explicitly upgraded', () => {
  const source = createCompanyWorkspaceFiles({
    brandId: 'old-community',
    name: 'Old community',
  }).catalog;
  assert.equal(source.format, EDITION_FORMATS.catalog);
  assert.equal(source.brands[0].format, EDITION_FORMATS.brand);
  assert.deepEqual(validateEditionRuntimeCatalog(JSON.stringify(source)), source);
  const undeclared = structuredClone(source);
  undeclared.campaigns[0].appearanceDefault = { familyId: 'tryzub', revision: 'r1' };
  assert.throws(() => validateEditionRuntimeCatalog(undeclared), /catalog v2/);
  undeclared.brands[0].appearanceDefault = { familyId: 'tryzub', revision: 'r1' };
  assert.throws(() => validateEditionRuntimeCatalog(undeclared), /brand pack v2/);
});

test('compiled entry hints use campaign over community and scope legacy brand styles away from themed chrome', async () => {
  const workspace = createCompanyWorkspaceFiles({
    brandId: 'compiled-theme',
    name: 'Compiled theme',
  });
  workspace.files.set(
    'game/company.html',
    Buffer.from(
      '<!doctype html><html><head><title>Game</title></head><body><h1 id="boot-title">Game</h1></body></html>',
    ),
  );
  const community = withStudioAppearanceDefault(workspace.catalog, {
    scope: 'community',
    id: 'compiled-theme',
    appearanceDefault: { familyId: 'tryzub', revision: 'r1' },
  });
  const campaign = withStudioAppearanceDefault(community, {
    scope: 'campaign',
    id: community.campaigns[0].id,
    appearanceDefault: { familyId: 'dnipro-porcelain', revision: 'r1' },
  });
  for (const [catalog, expected] of [
    [community, 'tryzub'],
    [campaign, 'dnipro-porcelain'],
  ]) {
    const compiled = await compileEdition({
      catalog,
      files: workspace.files,
      editionIds: [catalog.defaultEditionId],
      enginePaths: ['game/company.html'],
    });
    const html = compiled.files.get('game/company.html').toString();
    assert.ok(html.includes(`data-appearance-family="${expected}"`));
    assert.match(html, /data-appearance-revision="r1"/);
    assert.match(html, /html\[data-edition-id\]:not\(\[data-theme-styled="true"\]\) body\{--fk-bg/);
    assert.doesNotMatch(html, /html\[data-edition-id\] body\{--fk-bg/);
    assert.equal(
      JSON.parse(compiled.files.get('edition-catalog.json')).format,
      EDITION_FORMATS.appearanceCatalog,
    );
  }
});

test('the same complete appearance is portable across unrelated community drafts without merging their content', () => {
  const north = createCompanyWorkspaceFiles({ brandId: 'north-makers', name: 'North makers' }),
    south = createCompanyWorkspaceFiles({ brandId: 'south-makers', name: 'South makers' }),
    source = createEditionRuntimeCatalog({
      brands: [...north.catalog.brands, ...south.catalog.brands],
      editions: [...north.catalog.editions, ...south.catalog.editions],
      campaigns: [...north.catalog.campaigns, ...south.catalog.campaigns],
      assets: [...north.catalog.assets, ...south.catalog.assets],
      defaultEditionId: north.catalog.defaultEditionId,
    }),
    pin = { familyId: 'tryzub', revision: 'r1' };
  const first = withStudioAppearanceDefault(source, {
    scope: 'community',
    id: 'north-makers',
    appearanceDefault: pin,
  });
  assert.deepEqual(
    first.brands.find((row) => row.id === 'south-makers'),
    source.brands.find((row) => row.id === 'south-makers'),
  );
  assert.deepEqual(
    first.editions.find((row) => row.brandId === 'south-makers'),
    source.editions.find((row) => row.brandId === 'south-makers'),
  );
  const both = withStudioAppearanceDefault(first, {
    scope: 'community',
    id: 'south-makers',
    appearanceDefault: pin,
  });
  for (const edition of both.editions) {
    const selection = resolveEditionSelection(both, { editionId: edition.id });
    assert.deepEqual(resolveEditionAppearanceDefault(selection), pin);
    assert.ok(selection.campaigns.every((row) => row.brandId === selection.brand.id));
    assert.equal(
      selection.brand.themeId,
      source.brands.find((row) => row.id === selection.brand.id).themeId,
    );
  }
  assert.deepEqual(both.campaigns, source.campaigns);
  assert.deepEqual(both.assets, source.assets);
});

test('upgrading current defaults preserves exact v1 retained presentation bytes and identity', async () => {
  const fixture = await retainedEditionFixture(),
    before = Buffer.from(fixture.binary.get(fixture.descriptor.path)),
    next = withStudioAppearanceDefault(fixture.catalog, {
      scope: 'community',
      id: 'sample',
      appearanceDefault: { familyId: 'vyshyvanka', revision: 'r1' },
    });
  for (const path of ['game/editions/catalog.json', 'edition-catalog.json'])
    fixture.files.set(path, next);
  assert.equal((await fixture.load()).appearanceDefault.familyId, 'vyshyvanka');
  const retained = await fixture.load(fixture.descriptor.id);
  assert.equal(retained.authoredPresentationSha256, fixture.original.authoredPresentationSha256);
  assert.equal(retained.catalog.format, EDITION_FORMATS.catalog);
  assert.equal(retained.appearanceDefault, null);
  assert.deepEqual(fixture.binary.get(fixture.descriptor.path), before);
  assert.deepEqual(
    next.editions[0].presentationHistory,
    fixture.catalog.editions[0].presentationHistory,
  );
});

test('edition tools share family authority and keep high contrast and plain type above legacy branding', async () => {
  const fixture = await editionProviderFixture(),
    doc = new Document(),
    win = doc.defaultView;
  win.location = new URL('http://localhost/game/controller-lab/?edition=sample-public');
  const provider = await loadRuntimeContentProvider({
    locationRef: { href: 'http://localhost/game/?edition=sample-public' },
    documentRef: doc,
    fetcher: fixture.fetcher,
    verifyAssets: async () => {},
  });
  const host = installThemeHost({
    document: doc,
    window: win,
    getStorage: () => null,
    prepareStyles: async () => {},
  });
  await loadEditionToolProvider({
    documentRef: doc,
    locationRef: win.location,
    windowRef: win,
    loadProvider: async () => provider,
  });
  host.set({ familyId: 'legacy' });
  await host.ready;
  assert.equal(
    doc.documentElement.style.getPropertyValue('--fk-text'),
    provider.theme.palette.paper,
  );
  host.set({ highContrast: true });
  await host.ready;
  assert.equal(doc.documentElement.style.getPropertyValue('--fk-text'), '');
  assert.equal(doc.documentElement.style.getPropertyValue('--iw-text'), '#ffffff');
  host.set({ highContrast: false });
  doc.body.dataset.textFace = 'plain';
  await host.refresh();
  assert.notEqual(
    doc.body.style.getPropertyValue('--fk-font-ui'),
    'var(--brand-font, system-ui, sans-serif)',
  );
  host.set({ familyId: 'tryzub' });
  await host.ready;
  assert.equal(doc.documentElement.style.getPropertyValue('--fk-text'), '');
  assert.equal(doc.documentElement.style.getPropertyValue('--iw-text'), '#e8e4d8');
  win.emit('pagehide', {});
  host.dispose();
});
