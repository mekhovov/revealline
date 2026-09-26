import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import {
  createEditionRuntimeCatalog,
  validateEditionRuntimeCatalog,
  resolveEditionSelection,
} from '../editions/model.mjs';
import { loadEditionBootstrap, mergeEditionProjects } from '../editions/bootstrap.mjs';
import {
  compileEdition,
  selectEditionClosure,
  validateEditionCodeClosure,
  editionCodeDependencies,
} from '../../scripts/compile-edition.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { companyPresentationIdentity } from '../company-session.mjs';
import { createCompanyTheme, createCompanyPresets } from '../company-campaigns/brands.mjs';
import { inspectImageDataUrl } from '../content.mjs';

const bytes = (value) => Buffer.from(JSON.stringify(value));
const digest = (value) => createHash('sha256').update(value).digest('hex');
function fixture() {
  const files = new Map(),
    sources = [],
    assets = [],
    brands = [],
    campaigns = [],
    editions = [];
  for (const id of ['coupa', 'droneaid']) {
    const project = createStarterProject(`${id}-source`);
    project.campaigns[0].id = `${id}-adventure`;
    project.packs[0].id = `${id}-pack`;
    project.packs[0].campaignIds = [`${id}-adventure`];
    project.missions[0].id = `${id}-mission`;
    project.campaigns[0].missionIds = [`${id}-mission`];
    const sourcePath = `game/content/${id}.json`,
      assetPath = `game/editions/assets/${id}.png`,
      payload = Buffer.from(`${id} approved picture`);
    files.set(sourcePath, bytes(project));
    files.set(assetPath, payload);
    sources.push(project);
    assets.push({
      id: `${id}-hero`,
      path: assetPath,
      sha256: digest(payload),
      bytes: payload.length,
      publication: 'public',
      approved: true,
      dependencies: [],
    });
    brands.push({
      format: 'revealline-brand-pack.v1',
      id,
      revision: 1,
      name: id,
      description: `${id} edition`,
      publication: 'public',
      themeId: `${id}-theme`,
      actorSetId: `${id}-actors`,
      logoAssetId: null,
      heroAssetId: `${id}-hero`,
      assetIds: [`${id}-hero`],
    });
    campaigns.push({
      id: `${id}-adventure`,
      revision: '1',
      name: `${id} adventure`,
      brandId: id,
      publication: 'public',
      sourcePath,
      assetIds: [],
      modes: ['solo'],
    });
    const boot = Object.fromEntries(
      ['campaign', 'themes', 'presets', 'classes', 'packs', 'archives'].map((key) => [
        key,
        `game/content/${id}/${key}.json`,
      ]),
    );
    const theme = { ...createCompanyTheme(id), id: `${id}-theme` },
      presets = createCompanyPresets(id);
    Object.values(presets.characters).forEach((body) => {
      body.src = null;
    });
    Object.entries(boot).forEach(([key, file]) =>
      files.set(
        file,
        bytes(
          key === 'campaign'
            ? { levels: [{ id: `${id}-mission` }] }
            : key === 'themes'
              ? { themes: [theme] }
              : key === 'presets'
                ? presets
                : {},
        ),
      ),
    );
    editions.push({
      format: 'revealline-edition.v1',
      id: `${id}-public`,
      revision: 1,
      name: `${id} public`,
      brandId: id,
      audience: 'everyone',
      campaignIds: [`${id}-adventure`],
      entryCampaignId: `${id}-adventure`,
      modes: ['solo'],
      publication: 'public',
      boot,
    });
  }
  return {
    catalog: createEditionRuntimeCatalog({
      brands,
      editions,
      campaigns,
      assets,
      defaultEditionId: 'coupa-public',
    }),
    files,
    sources,
  };
}

test('catalog validates generic brands, immutable selections and strict allowlist lookup', () => {
  const { catalog } = fixture();
  assert.equal(resolveEditionSelection(catalog).brand.id, 'coupa');
  assert.equal(
    resolveEditionSelection(catalog, { editionId: 'droneaid-public' }).campaign.id,
    'droneaid-adventure',
  );
  assert.throws(() => resolveEditionSelection(catalog, { editionId: 'unshipped' }), /not included/);
  assert.throws(
    () => resolveEditionSelection(catalog, { campaignId: 'droneaid-adventure' }),
    /not included/,
  );
  assert.ok(Object.isFrozen(catalog.editions[0].boot));
  const bad = structuredClone(catalog);
  bad.brands[0].script = 'https://invalid.test/run.js';
  assert.throws(() => validateEditionRuntimeCatalog(bad), /not supported/);
  let invoked = false;
  Object.defineProperty(bad, 'editions', {
    enumerable: true,
    get() {
      invoked = true;
      return [];
    },
  });
  assert.throws(() => validateEditionRuntimeCatalog(bad), /accessors/);
  assert.equal(invoked, false);
});

test('dependency closure rejects cycles, undeclared assets and cross-brand campaigns', () => {
  const { catalog } = fixture();
  const bad = structuredClone(catalog);
  bad.assets[0].dependencies = [bad.assets[0].id];
  assert.throws(() => validateEditionRuntimeCatalog(bad), /cycle/);
  bad.assets[0].dependencies = ['missing'];
  assert.throws(() => validateEditionRuntimeCatalog(bad), /missing/);
  bad.assets[0].dependencies = [];
  bad.editions[0].campaignIds.push('droneaid-adventure');
  assert.throws(() => validateEditionRuntimeCatalog(bad), /different/);
});

test('compilation excludes every omitted brand file and hashes exact selected media', async () => {
  const f = fixture();
  f.files.set('authoring/studio.json', bytes({ secret: 'do not publish' }));
  const options = { ...f, editionIds: ['coupa-public'] };
  const output = await compileEdition(options);
  assert.equal(output.runtimeCatalog.brands.length, 1);
  assert.equal(output.runtimeCatalog.brands[0].id, 'coupa');
  assert.ok(
    [...output.files.keys()].every(
      (name) => !name.includes('droneaid') && !name.includes('studio'),
    ),
  );
  assert.equal(JSON.parse(output.files.get('game/build-info.json')).editionId, 'coupa-public');
  assert.equal(output.manifest.catalogSha256, digest(output.files.get('edition-catalog.json')));
  f.files.set('game/editions/assets/coupa.png', Buffer.from('tampered'));
  await assert.rejects(compileEdition(options), /bytes differ/);
});

test('unselected restricted sources stay out, selected restricted and engine bypasses fail', async () => {
  const f = fixture(),
    catalog = structuredClone(f.catalog);
  catalog.publication = 'restricted';
  catalog.brands[1].publication = 'restricted';
  catalog.assets[1].publication = 'restricted';
  catalog.assets[1].approved = false;
  assert.equal(selectEditionClosure(catalog, ['coupa-public']).brands.length, 1);
  assert.throws(() => selectEditionClosure(catalog, ['droneaid-public']), /Restricted|approval/);
  await assert.rejects(
    compileEdition({
      ...f,
      catalog,
      editionIds: ['coupa-public'],
      enginePaths: ['game/content/droneaid.json'],
    }),
    /omitted/,
  );
  f.files.set('authoring/studio.json', bytes({ secret: 'sentinel' }));
  await assert.rejects(
    compileEdition({ ...f, editionIds: ['coupa-public'], enginePaths: ['authoring/studio.json'] }),
    /Source-only/,
  );
  await assert.rejects(
    compileEdition({
      ...f,
      editionIds: ['coupa-public'],
      enginePaths: ['game/company-campaigns/catalog.mjs'],
    }),
    /Build-time/,
  );
});

test('transitive assets are copied once and a boot file cannot sneak in omitted levels', async () => {
  const f = fixture(),
    catalog = structuredClone(f.catalog);
  const font = Buffer.from('shared-font');
  f.files.set('game/editions/assets/font.woff2', font);
  catalog.assets.push({
    id: 'shared-font',
    path: 'game/editions/assets/font.woff2',
    sha256: digest(font),
    bytes: font.length,
    publication: 'public',
    approved: true,
    dependencies: [],
  });
  catalog.assets[0].dependencies.push('shared-font');
  const result = await compileEdition({ ...f, catalog, editionIds: ['coupa-public'] });
  assert.ok(result.files.has('game/editions/assets/font.woff2'));
  f.files.set(catalog.editions[0].boot.campaign, bytes({ levels: [{ id: 'droneaid-mission' }] }));
  await assert.rejects(compileEdition({ ...f, catalog, editionIds: ['coupa-public'] }), /outside/);
});

test('static dependency validation catches omitted imports and CSS images', () => {
  const files = new Map([['game/app.mjs', Buffer.from("import './missing.mjs';")]]);
  assert.throws(() => validateEditionCodeClosure(files), /missing.*dependency/);
  files.set('game/missing.mjs', Buffer.from('export const value=1;'));
  assert.doesNotThrow(() => validateEditionCodeClosure(files));
  files.set('game/theme.css', Buffer.from("body{background:url('./omitted.png')}"));
  assert.throws(() => validateEditionCodeClosure(files), /omitted/);
});

test('web editions reject external or computed code dependencies except the exact staged iOS bridge', () => {
  for (const code of [
    "import 'https://external.test/renderer.mjs';",
    "export * from '/shared/renderer.mjs';",
    "import('unregistered-package');",
    "import('./' + selectedCompany + '.mjs');",
  ])
    assert.throws(
      () => editionCodeDependencies('game/company-player.mjs', Buffer.from(code)),
      /must be local|computed edition import/,
    );
  const native = "import(new URL('../native/bridge.mjs', import.meta.url).href)";
  assert.deepEqual(editionCodeDependencies('game/platform.mjs', Buffer.from(native)), []);
  assert.throws(
    () => editionCodeDependencies('game/other.mjs', Buffer.from(native)),
    /computed edition import/,
  );
  assert.throws(
    () =>
      editionCodeDependencies(
        'game/platform.mjs',
        Buffer.from(native.replace('bridge.mjs', 'other.mjs')),
      ),
    /computed edition import/,
  );
  assert.throws(
    () =>
      editionCodeDependencies(
        'game/company.css',
        Buffer.from('body{background:url(https://external.test/image.png)}'),
      ),
    /must be local/,
  );
  assert.deepEqual(
    editionCodeDependencies('game/entry.mjs', Buffer.from("export * from './dependency.mjs';")),
    ['game/dependency.mjs'],
  );
});

test('bootstrap preserves optional default and fetches only selected sources', async () => {
  const f = fixture(),
    requested = [];
  const fetcher = async (url) => {
    requested.push(url);
    const name = new URL(url, 'https://example.test/').pathname.slice(1);
    const value = name === 'edition-catalog.json' ? bytes(f.catalog) : f.files.get(name);
    return new Response(value ?? '', { status: value ? 200 : 404 });
  };
  const loaded = await loadEditionBootstrap({
    fetcher,
    catalogURL: 'https://example.test/edition-catalog.json',
    editionId: 'coupa-public',
  });
  assert.equal(loaded.route.profileKey, 'journey-coupa-public');
  assert.equal(loaded.source.campaigns.length, 1);
  assert.ok(!requested.some((url) => url.includes('droneaid')));
  assert.equal(
    await loadEditionBootstrap({ fetcher: async () => new Response('', { status: 404 }) }),
    null,
  );
  await assert.rejects(
    loadEditionBootstrap({
      fetcher: async () => new Response('', { status: 404 }),
      editionId: 'coupa-public',
    }),
    /unavailable/,
  );
});

test('project merging rejects mismatched or conflicting immutable gameplay', () => {
  const f = fixture(),
    selection = resolveEditionSelection(f.catalog);
  assert.throws(() => mergeEditionProjects(selection, [f.sources[1]]), /identity/);
  const project = mergeEditionProjects(selection, [f.sources[0]]);
  assert.equal(project.id, 'edition-coupa-public');
  assert.ok(Object.isFrozen(project));
  const leaked = structuredClone(f.sources[0]);
  leaked.missions.push({ ...structuredClone(leaked.missions[0]), id: 'unselected-mission' });
  assert.throws(() => mergeEditionProjects(selection, [leaked]), /omitted missions/);
  const history = structuredClone(f.sources[0]);
  history.maps.push({ ...structuredClone(history.maps[0]), revision: 'unused-history' });
  assert.throws(() => mergeEditionProjects(selection, [history]), /map history/);
});

test('hub and compiled edition share progress and presentation pins including transitive and edition assets', async () => {
  const f = fixture(),
    catalog = structuredClone(f.catalog);
  for (const id of ['edition-only', 'shared-dependency']) {
    const payload = Buffer.from(id),
      assetPath = `game/editions/assets/${id}.png`;
    f.files.set(assetPath, payload);
    catalog.assets.push({
      id,
      path: assetPath,
      sha256: digest(payload),
      bytes: payload.length,
      publication: 'public',
      approved: true,
      dependencies: [],
    });
  }
  catalog.editions[0].assetIds = ['edition-only'];
  catalog.assets[0].dependencies = ['shared-dependency'];
  const compile = await compileEdition({ ...f, catalog, editionIds: ['coupa-public'] });
  const load = (registry, files) =>
    loadEditionBootstrap({
      fetcher: async (url) =>
        new Response(
          new URL(url).pathname === '/edition-catalog.json'
            ? bytes(registry)
            : files.get(new URL(url).pathname.slice(1)),
        ),
      catalogURL: 'https://example.test/edition-catalog.json',
      editionId: 'coupa-public',
    });
  const hub = await load(catalog, f.files),
    standalone = await load(compile.runtimeCatalog, compile.files);
  assert.equal(hub.route.profileKey, standalone.route.profileKey);
  assert.equal(hub.route.sessionKey, standalone.route.sessionKey);
  const pin = await companyPresentationIdentity(hub);
  assert.equal(pin, await companyPresentationIdentity(standalone));
  for (const id of ['edition-only', 'shared-dependency']) {
    const changed = structuredClone(catalog);
    changed.assets.find((entry) => entry.id === id).sha256 = 'ab'.repeat(32);
    assert.notEqual(pin, await companyPresentationIdentity(await load(changed, f.files)), id);
  }
});

test('compiled first-paint and error shell uses only the selected brand and escapes HTML text', async () => {
  const f = fixture(),
    catalog = structuredClone(f.catalog);
  catalog.brands[0].name = `Coupa & <script>"brand"</script> '$&'`;
  catalog.brands[0].description = `Connect </p><img src=x onerror=alert(1)> & grow`;
  catalog.brands[0].logoAssetId = 'coupa-hero';
  catalog.editions[0].name = `Mission <b>one</b> & "two"`;
  f.files.set(
    catalog.editions[0].boot.themes,
    bytes({
      themes: [
        {
          ...createCompanyTheme('coupa'),
          id: 'coupa-theme',
          palette: {
            ...createCompanyTheme('coupa').palette,
            ink: '#123456',
            grid: '#234567',
            accent: '#abcdef',
          },
        },
      ],
    }),
  );
  const sourceHTML =
    '<!doctype html><html lang="en"><head><title>Reveal / Line</title><meta name="theme-color" content="#000000"></head><body><span id="brand-name">Reveal / Line</span><h1 id="home-title">Choose a company</h1><p id="brand-description">Neutral</p><span id="footer-brand">Default footer</span><img id="brand-logo" hidden alt="Default"><img id="home-art" hidden alt="Default"><a id="all-worlds" href="../index.html">All worlds</a></body></html>';
  f.files.set('game/company.html', Buffer.from(sourceHTML));
  const result = await compileEdition({
    ...f,
    catalog,
    editionIds: ['coupa-public'],
    enginePaths: ['game/company.html'],
  });
  const html = result.files.get('game/company.html').toString();
  assert.match(html, /<html data-edition-id="coupa-public" lang="en">/);
  assert.match(
    html,
    /<h1 id="home-title">Mission &lt;b&gt;one&lt;\/b&gt; &amp; &quot;two&quot;<\/h1>/,
  );
  assert.match(
    html,
    /Coupa &amp; &lt;script&gt;&quot;brand&quot;&lt;\/script&gt; &#39;\$&amp;&#39;/,
  );
  assert.match(html, /Connect &lt;\/p&gt;&lt;img src=x onerror=alert\(1\)&gt; &amp; grow/);
  assert.equal((html.match(/src="\.\.\/game\/editions\/assets\/coupa\.png"/g) ?? []).length, 2);
  assert.match(html, /<meta name="theme-color" content="#123456">/);
  for (const token of ['--ink:#123456', '--grid:#234567', '--accent:#abcdef', '--panel:#234567'])
    assert.ok(html.includes(token));
  assert.ok(!html.includes('<script>') && !html.includes('x}body{') && !html.includes('--unsafe:'));
  assert.ok(
    !html.includes('id="all-worlds"') &&
      !html.includes('droneaid') &&
      !html.includes('Choose a company'),
  );
  assert.equal(
    f.files.get('game/company.html').toString(),
    sourceHTML,
    'The shared source shell must remain unbranded.',
  );
  const unsafe = JSON.parse(f.files.get(catalog.editions[0].boot.themes));
  unsafe.themes[0].palette.ink = '</style><script>bad()</script>';
  f.files.set(catalog.editions[0].boot.themes, bytes(unsafe));
  await assert.rejects(
    compileEdition({
      ...f,
      catalog,
      editionIds: ['coupa-public'],
      enginePaths: ['game/company.html'],
    }),
    /Invalid edition theme/,
  );
});

test('edition admission rejects mismatched themes and artwork outside the selected brand closure', async () => {
  const f = fixture(),
    boot = f.catalog.editions[0].boot;
  const originalTheme = JSON.parse(f.files.get(boot.themes));
  const compile = () => compileEdition({ ...f, editionIds: ['coupa-public'] });
  for (const theme of [
    { ...originalTheme.themes[0], id: 'droneaid-theme' },
    { ...originalTheme.themes[0], family: 'fpv' },
    { ...originalTheme.themes[0], player: 'unshipped-body' },
  ]) {
    f.files.set(boot.themes, bytes({ themes: [theme] }));
    await assert.rejects(compile(), /selected brand|selected presets/);
  }
  f.files.set(boot.themes, bytes({ themes: [...originalTheme.themes, originalTheme.themes[0]] }));
  await assert.rejects(compile(), /exactly one/);
  f.files.set(boot.themes, bytes(originalTheme));
  const presets = JSON.parse(f.files.get(boot.presets));
  for (const src of [
    '../../game/editions/assets/droneaid.png',
    '../../../outside.png',
    'https://external.test/logo.png',
    '../../game/editions/assets/coupa.png?tracking=1',
    '../../game/editions/assets/%63oupa.png',
  ]) {
    presets.characters['coupa-flower'].src = src;
    f.files.set(boot.presets, bytes(presets));
    await assert.rejects(compile(), /selected approved asset closure|local relative path/);
  }
  presets.characters['coupa-flower'].src = '../../game/editions/assets/coupa.png';
  f.files.set(boot.presets, bytes(presets));
  assert.ok((await compile()).files.has('game/editions/assets/coupa.png'));
  // The source hub performs the same admission before activating a renderer.
  presets.characters['coupa-flower'].src = '../../game/editions/assets/droneaid.png';
  f.files.set(boot.presets, bytes(presets));
  await assert.rejects(
    loadEditionBootstrap({
      catalogURL: 'https://example.test/edition-catalog.json',
      editionId: 'coupa-public',
      fetcher: async (url) =>
        new Response(
          new URL(url).pathname === '/edition-catalog.json'
            ? bytes(f.catalog)
            : f.files.get(new URL(url).pathname.slice(1)),
        ),
    }),
    /selected approved asset closure/,
  );
});

test('approved original-derived install icons ship both square sizes and the selected font only', async () => {
  const catalog = validateEditionRuntimeCatalog(
    await fs.readFile(new URL('../editions/catalog.json', import.meta.url), 'utf8'),
  );
  for (const editionId of ['coupa-adventure', 'droneaid-community']) {
    const selected = selectEditionClosure(catalog, [editionId]);
    const edition = selected.editions[0],
      brand = selected.brands[0];
    const paths = new Set([
      ...selected.assets.map((asset) => asset.path),
      ...Object.values(edition.boot),
      ...selected.campaigns.flatMap((campaign) => [
        campaign.sourcePath,
        ...(campaign.lessonPath ? [campaign.lessonPath] : []),
      ]),
    ]);
    const files = new Map(
      await Promise.all(
        [...paths].map(async (path) => [
          path,
          await fs.readFile(new URL(`../../${path}`, import.meta.url)),
        ]),
      ),
    );
    files.set(
      'game/company.html',
      Buffer.from(
        '<!doctype html><html lang="en"><head><title>Game</title></head><body></body></html>',
      ),
    );
    const result = await compileEdition({
      catalog,
      editionIds: [editionId],
      files,
      enginePaths: ['game/company.html'],
      version: '0.132.1',
      offline: { basePath: '/revealline/' },
    });
    const manifest = JSON.parse(result.files.get('app/manifest.webmanifest'));
    assert.deepEqual(
      manifest.icons.map((icon) => icon.sizes),
      ['192x192', '512x512'],
    );
    assert.ok(manifest.icons.every((icon) => icon.type === 'image/png' && icon.purpose === 'any'));
    for (const icon of manifest.icons) {
      const data = result.files.get(`app/${icon.src.slice(2)}`);
      const header = inspectImageDataUrl(`data:image/png;base64,${data.toString('base64')}`);
      assert.equal(header.valid, true);
      assert.equal(`${header.width}x${header.height}`, icon.sizes);
      const asset = selected.assets.find((asset) => asset.sha256 === digest(data));
      assert.equal(asset.bytes, data.length);
      assert.equal(asset.derivative.kind, 'square-install-icon');
      assert.equal(asset.derivative.paddingRatio, 0.12);
      assert.equal(
        asset.derivative.sourceSha256,
        selected.assets.find((source) => source.id === asset.derivative.sourceAssetId).sha256,
      );
    }
    const font = selected.assets.find((asset) => asset.id === brand.fontAssetId);
    assert.deepEqual(result.files.get('app/font.ttf'), files.get(font.path));
    assert.ok(result.files.get('game/company.html').toString().includes(`url("../${font.path}")`));
    assert.ok(
      result.files.get('app/index.html').toString().includes('font-family:"Company Brand"'),
    );
    assert.ok(
      ![...result.files.keys()].some((path) =>
        path.includes(`/assets/${brand.id === 'coupa' ? 'droneaid' : 'coupa'}/`),
      ),
    );
  }
  const bad = structuredClone(catalog),
    brand = bad.brands[0],
    primary = bad.assets.find((asset) => asset.id === brand.iconAssetId);
  primary.dependencies = [primary.derivative.sourceAssetId];
  assert.throws(() => validateEditionRuntimeCatalog(bad), /192 pixel derivative/);
  const wrongSource = structuredClone(catalog);
  wrongSource.assets.find(
    (asset) => asset.id === wrongSource.brands[0].iconAssetId,
  ).derivative.sourceSha256 = 'ab'.repeat(32);
  assert.throws(() => validateEditionRuntimeCatalog(wrongSource), /derivative|source hash/);
  const wrongFont = structuredClone(catalog);
  wrongFont.brands[0].fontAssetId = wrongFont.brands[0].logoAssetId;
  assert.throws(() => validateEditionRuntimeCatalog(wrongFont), /declared font/);
});
