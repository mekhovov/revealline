import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { projectEditionGuideScenario } from '../editions/selected-presentation.mjs';
import { createCompanyTheme } from '../company-campaigns/brands.mjs';
import { validateScenario } from '../content.mjs';
import {
  collectEditionEngineFiles,
  editionCodeDependencies,
  validateEditionCodeClosure,
} from '../../scripts/compile-edition.mjs';
import {
  EDITION_RUNTIME_ADAPTERS,
  projectEditionRuntimeImports,
  validateEditionHostRequests,
  editionMenuSceneResources,
  projectEditionMenuResourcePaths,
  projectEditionMenuScenes,
  projectEditionBrandIdentity,
  DEFAULT_GAME_WORDMARK,
} from '../../scripts/edition-runtime.mjs';
import { MENU_SCENES, resolveMenuScene } from '../ui/menu-scene-catalog.mjs';
import { selectOfflineCore } from '../../scripts/offline-core-closure.mjs';
import { fileURLToPath } from 'node:url';

const bytes = (text) => Buffer.from(text);
const droneAidLandingFiles = [
  'game/ui/art/menu-scenes/droneaid-main-background.png',
  'game/ui/art/menu-scenes/droneaid-wordmark-light.svg',
];
test('standalone branding projects only the image fallback to an approved selected logo', async () => {
  const original = await fs.readFile(new URL('../ui/brand-identity.mjs', import.meta.url));
  const catalog = JSON.parse(
    await fs.readFile(new URL('../editions/catalog.json', import.meta.url)),
  );
  for (const edition of catalog.editions) {
    const brand = catalog.brands.find((item) => item.id === edition.brandId);
    const logo = catalog.assets.find((item) => item.id === brand.logoAssetId);
    assert.ok(logo?.approved && logo.publication === 'public');
    const projected = projectEditionBrandIdentity(original, logo.path);
    const expected = path.posix.relative('game/ui', logo.path);
    const replacement = expected.startsWith('.') ? expected : './' + expected;
    assert.equal(
      projected.toString(),
      original
        .toString()
        .replace("'./art/identity/fpv-line/wordmark.png'", JSON.stringify(replacement)),
      'Default/edition mounting branches, labels, image-error fallback and cleanup remain exact',
    );
    assert.equal(
      new URL(replacement, 'https://test.invalid/game/ui/brand-identity.mjs').pathname,
      '/' + logo.path,
    );
    assert.equal(
      projected.includes(Buffer.from(DEFAULT_GAME_WORDMARK.slice('game/ui/'.length))),
      false,
    );
    assert.deepEqual(projectEditionBrandIdentity(original, logo.path), projected);
  }
  assert.match(original.toString(), /art\/identity\/fpv-line\/wordmark\.png/);
  assert.throws(
    () => projectEditionBrandIdentity(original, 'https://other.invalid/logo.png'),
    /local logo/,
  );
  assert.throws(
    () => projectEditionBrandIdentity(Buffer.from('export const changed = 1;'), 'game/logo.png'),
    /Unknown shared/,
  );
});
test('support page closure retains navigation without authoring sample media or manual fixtures', async () => {
  const files = await collectEditionEngineFiles({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    entries: ['game/controller-lab/index.html'],
  });
  for (const name of [
    'game/ui/support-input-entry.mjs',
    'game/ui/page-input-host.mjs',
    'game/ui/controller-confirm-guard.mjs',
    'game/ui/controller-confirm-lifecycle.mjs',
    'game/ui/authoring-input.css',
    'game/ui/controller-field-editor.css',
  ])
    assert.ok(files.has(name), `Missing support dependency: ${name}`);
  assert.ok(!files.has('game/ui/authoring-sources.mjs'));
  assert.deepEqual(
    [...files.keys()].filter(
      (name) =>
        name.startsWith('authoring/shared/samples/') ||
        name.startsWith('authoring/still-media/examples/') ||
        name.startsWith('game/test/'),
    ),
    [],
  );
  validateEditionCodeClosure(
    new Map([...files].map(([name, source]) => [name, projectEditionRuntimeImports(name, source)])),
  );
});
test('standalone and public offline menus retain every dynamically attached panel stylesheet', async () => {
  const modules = [
    'game/ui/controller-field-editor.mjs',
    'game/ui/soundtrack-panel.mjs',
    'game/ui/install-offline-panel.mjs',
  ];
  const files = await collectEditionEngineFiles({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    entries: modules,
  });
  for (const name of modules.map((name) => name.replace(/\.mjs$/, '.css')))
    assert.ok(files.has(name), `Missing dynamically attached edition stylesheet: ${name}`);
  const publicFiles = new Map(files);
  publicFiles.set(
    'game/index.html',
    bytes(modules.map((name) => `<script src="${name.slice(5)}"></script>`).join('')),
  );
  const selected = selectOfflineCore(
    [...publicFiles].map(([name, bytes]) => ({ name, bytes })),
    new Set(),
  );
  for (const name of modules.map((name) => name.replace(/\.mjs$/, '.css')))
    assert.ok(
      selected.retained.has(name),
      `Missing dynamically attached offline stylesheet: ${name}`,
    );
});
test('actual landing closure retains artwork motion, receiver loss and signal atlas offline', async () => {
  const files = await collectEditionEngineFiles({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    entries: ['game/ui/menu-scenes.mjs', 'game/ui/native-menus.mjs'],
  });
  const required = [
    ...['fpv', 'ukraine', 'retro', 'coupa'].flatMap((world) =>
      ['versus', 'versus-portrait', 'team', 'team-portrait'].map(
        (mode) => `game/ui/art/menu-scenes/${world}-${mode}.webp`,
      ),
    ),
    'game/ui/analog-signal.mjs',
    'game/ui/menu-scenes.css',
    'game/ui/menu-scene-motion.mjs',
    'game/ui/menu-signal-loss.mjs',
    'game/ui/native-menu.css',
    'game/ui/menu-retune.mjs',
    'game/ui/menu-retune.css',
    'game/ui/art/menu-scenes/analog-noise-atlas.png',
    ...droneAidLandingFiles,
  ];
  for (const name of required) assert.ok(files.has(name), `Missing edition dependency: ${name}`);
  validateEditionCodeClosure(
    new Map([...files].map(([name, source]) => [name, projectEditionRuntimeImports(name, source)])),
  );
  // Exercise the actual public offline selector separately: it discovers
  // literal imports and asset paths without the edition resource map.
  const publicFiles = new Map(files);
  publicFiles.set(
    'game/index.html',
    bytes(
      '<link rel="stylesheet" data-boot-href="ui/menu-scenes.css"><link rel="stylesheet" data-boot-href="ui/native-menu.css"><script src="ui/native-menus.mjs"></script>',
    ),
  );
  const selected = selectOfflineCore(
    [...publicFiles].map(([name, bytes]) => ({ name, bytes })),
    new Set(),
  );
  for (const name of required)
    assert.ok(selected.retained.has(name), `Missing offline dependency: ${name}`);
});
test('standalone menu projection preserves selected profile data and fallback without unrelated images', async () => {
  const original = await fs.readFile(new URL('../ui/menu-scene-catalog.mjs', import.meta.url));
  const catalog = JSON.parse(
    await fs.readFile(new URL('../editions/catalog.json', import.meta.url)),
  );
  for (const { id } of catalog.editions) {
    const selected = resolveMenuScene({ editionId: id });
    const projected = await import(
      `data:text/javascript;base64,${projectEditionMenuScenes(original, [id]).toString('base64')}`
    );
    assert.deepEqual(Object.keys(projected.MENU_SCENES).sort(), ['fpv', selected.id].sort());
    assert.deepEqual(projected.resolveMenuScene({ editionId: id }), selected);
    assert.deepEqual(projected.resolveMenuScene({ themeId: 'retro', editionId: id }), selected);
    assert.deepEqual(projected.resolveMenuScene({ editionId: 'unrecognized' }), MENU_SCENES.fpv);
    assert.equal(projected.menuSceneMode('team'), 'team');
    assert.deepEqual(projected.MENU_SCENE_COMPOSITIONS, {});
    assert.equal(
      projected.resolveMenuScene({ themeId: 'fpv', mode: 'versus' }),
      projected.MENU_SCENES.fpv,
    );
    const resources = editionMenuSceneResources([id]);
    assert.equal(
      resources.filter((name) => /\.(webp|png)$/.test(name)).length,
      3,
      'Selected background plus landscape/portrait fallback are retained.',
    );
    assert.ok(resources.includes(`game/ui/${selected.landscape.slice(2)}`));
    assert.ok(resources.includes('game/ui/art/menu-scenes/fpv-portrait.webp'));
    assert.ok(!resources.includes('game/ui/art/menu-scenes/retro.webp'));
    assert.ok(!resources.some((name) => /(?:fpv|ukraine|retro|coupa)-(versus|team)/.test(name)));
    assert.doesNotMatch(
      projectEditionMenuScenes(original, [id]).toString(),
      /(?:fpv|ukraine|retro|coupa)-(versus|team).*\.webp/,
    );
    if (selected.wordmark) assert.ok(resources.includes(`game/ui/${selected.wordmark.slice(2)}`));
  }
  assert.throws(
    () => projectEditionMenuScenes(bytes('export const noLookup = {};'), ['coupa-all']),
    /explicit profile lookup/,
  );
});
test('DroneAid aggregate originals are selected alone while campaigns keep their existing artwork', async () => {
  const catalog = JSON.parse(
    await fs.readFile(new URL('../editions/catalog.json', import.meta.url)),
  );
  const paths = [
    'game/ui/menu-scenes.mjs',
    'game/ui/art/menu-scenes/provenance.json',
    'game/ui/art/menu-scenes/analog-noise-atlas.png',
    'game/ui/art/menu-scenes/droneaid-nl-community.webp',
    ...Object.values(MENU_SCENES).flatMap((scene) =>
      [scene.landscape, scene.portrait, scene.wordmark]
        .filter(Boolean)
        .map((asset) => `game/ui/${asset.slice(2)}`),
    ),
  ];
  for (const { id } of catalog.editions) {
    const selected = new Set(projectEditionMenuResourcePaths(paths, [id]));
    const aggregate = resolveMenuScene({ editionId: id }).id === 'droneaid-nl-community';
    for (const file of droneAidLandingFiles)
      assert.equal(selected.has(file), aggregate, `${id}: ${file}`);
    assert.equal(selected.has('game/ui/art/menu-scenes/droneaid-nl-community.webp'), false);
    assert.ok(selected.has('game/ui/art/menu-scenes/analog-noise-atlas.png'));
    assert.ok(selected.has('game/ui/art/menu-scenes/provenance.json'));
    assert.ok(selected.has('game/ui/menu-scenes.mjs'));
    assert.ok(selected.has(`game/ui/${resolveMenuScene({ editionId: id }).landscape.slice(2)}`));
  }
  const aggregate = MENU_SCENES['droneaid-nl-community'];
  assert.equal(`game/ui/${aggregate.landscape.slice(2)}`, droneAidLandingFiles[0]);
  assert.equal(aggregate.portrait, aggregate.landscape);
  assert.equal(`game/ui/${aggregate.wordmark.slice(2)}`, droneAidLandingFiles[1]);
  const originals = [
    'authoring/library/droneaid-brand-kit-2026-09-29/background-original.png',
    'authoring/library/droneaid-brand-kit-2026-09-29/wordmark-dark.svg',
  ];
  for (const [index, file] of droneAidLandingFiles.entries()) {
    const runtime = await fs.readFile(new URL(`../../${file}`, import.meta.url));
    assert.deepEqual(
      runtime,
      await fs.readFile(new URL(`../../${originals[index]}`, import.meta.url)),
      'The provided original is retained without re-encoding or SVG edits.',
    );
  }
});
test('shared guide scenario projects selected appearance without changing a mechanic or recipe parameter', async () => {
  const source = JSON.parse(
      await fs.readFile(new URL('../content/scenarios/line-impact-demo.json', import.meta.url)),
    ),
    original = structuredClone(source),
    theme = createCompanyTheme('coupa');
  const projected = projectEditionGuideScenario(source, {
    theme,
    classes: [
      { id: 'scout', label: 'Connector', description: 'Shared practice class.', cooldown: 9999 },
    ],
  });
  assert.deepEqual(projected.level, original.level);
  assert.deepEqual(projected.settings, original.settings);
  assert.deepEqual(
    projected.classRecipes.map(({ label: _label, description: _description, ...recipe }) => recipe),
    original.classRecipes.map(({ label: _label, description: _description, ...recipe }) => recipe),
  );
  assert.deepEqual(projected.theme, theme);
  assert.deepEqual(projected.music, theme.soundtrack);
  assert.deepEqual(source, original);
  assert.equal(validateScenario(projected).valid, true);
  assert.ok(
    !JSON.stringify(projected).includes('FPV') &&
      !JSON.stringify(projected).includes('Orchard Circuit'),
  );
  const quiet = structuredClone(theme);
  delete quiet.soundtrack;
  assert.ok(
    !Object.hasOwn(
      projectEditionGuideScenario(source, { theme: quiet, classes: projected.classRecipes }),
      'music',
    ),
  );
  assert.throws(() => projectEditionGuideScenario(source, { theme, classes: [] }), /class labels/);
});
test('common host import projection closes over committed adapters without visiting historical registries', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'edition-runtime-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const originals = new Map([
    ['game/company.html', bytes('<html><script src="company-entry.mjs"></script></html>')],
    ['game/company-entry.mjs', bytes('export const canonical = "index.html";')],
    [
      'game/index.html',
      bytes(
        '<html><script src="app.mjs"></script><link rel="stylesheet" data-boot-href="ui/style.css"></html>',
      ),
    ],
    [
      'game/app.mjs',
      bytes(
        "import './content-design/route-loader.mjs'; export * from './runtime-library-sources.mjs'; import('./external-chapter-source.mjs'); import './replay-theater/examples.mjs';",
      ),
    ],
    ['game/ui/style.css', bytes('body{color:red}')],
    ['game/controller-lab/index.html', bytes('<html></html>')],
    ['game/replay-theater/index.html', bytes('<html></html>')],
    ['game/content/scenarios/line-impact-demo.json', bytes('{}')],
    ['game/editions/runtime-assets.json', bytes('[]')],
    ...Object.entries(EDITION_RUNTIME_ADAPTERS).flatMap(([request, adapter]) => [
      [request, bytes("import './MISSING_UNSELECTED_PRIVATE_SENTINEL.mjs';")],
      [adapter, bytes('export const selected = true;')],
    ]),
  ]);
  for (const [name, contents] of originals) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), contents);
  }
  const collected = await collectEditionEngineFiles({ root });
  for (const [request, adapter] of Object.entries(EDITION_RUNTIME_ADAPTERS)) {
    assert.ok(!collected.has(request));
    assert.ok(collected.has(adapter));
  }
  assert.ok(collected.has('game/index.html') && collected.has('game/ui/style.css'));
  assert.ok(
    collected.has('game/controller-lab/index.html') &&
      collected.has('game/replay-theater/index.html'),
  );
  assert.ok(collected.has('game/content/scenarios/line-impact-demo.json'));
  assert.deepEqual(
    collected.get('game/app.mjs'),
    originals.get('game/app.mjs'),
    'Collected source stays commit-verifiable.',
  );
  const projected = projectEditionRuntimeImports('game/app.mjs', collected.get('game/app.mjs'));
  assert.deepEqual(
    editionCodeDependencies('game/app.mjs', projected),
    Object.values(EDITION_RUNTIME_ADAPTERS).sort(),
  );
});

test('dynamic boot entry is explicit and unknown host JSON requests fail closed', () => {
  const known = "const appURL = new URL('./app.mjs', doc.currentScript.src).href; import(appURL);";
  assert.deepEqual(editionCodeDependencies('game/boot.mjs', bytes(known)), ['game/app.mjs']);
  assert.throws(
    () => editionCodeDependencies('game/other.mjs', bytes(known)),
    /Unresolved computed/,
  );
  assert.throws(
    () => editionCodeDependencies('game/boot.mjs', bytes('import(chosenPath);')),
    /Unresolved computed/,
  );
  assert.throws(
    () => editionCodeDependencies('game/boot.mjs', bytes(`// ${known}\nimport(appURL);`)),
    /Unresolved computed/,
  );
  validateEditionHostRequests(
    'game/app.mjs',
    bytes("getJSON('build-info.json'); getJSON('content/campaign.json');"),
  );
  for (const source of ["getJSON('content/private.json');", 'getJSON(chosenPath);'])
    assert.throws(
      () => validateEditionHostRequests('game/app.mjs', bytes(source)),
      /undeclared runtime JSON/,
    );
  assert.deepEqual(
    editionCodeDependencies(
      'game/replay-theater/index.html',
      bytes('<script src="../ui/direct-tool-launch.js" data-module="./app.mjs"></script>'),
    ),
    ['game/replay-theater/app.mjs', 'game/ui/direct-tool-launch.js'],
  );
  const tool =
    'const moduleURL = new URL(script.dataset.module, doc.baseURI).href; import(moduleURL);';
  assert.deepEqual(editionCodeDependencies('game/ui/direct-tool-launch.js', bytes(tool)), []);
  assert.throws(
    () => editionCodeDependencies('game/untrusted.js', bytes(tool)),
    /Unresolved computed/,
  );
  assert.throws(
    () =>
      editionCodeDependencies(
        'game/index.html',
        bytes('<script data-module="https://example.test/arbitrary.js"></script>'),
      ),
    /must be local/,
  );
});

test('declared canonical navigation and data requests must exist in the artifact', () => {
  const files = new Map([
    ['game/company.html', bytes('<html></html>')],
    ['game/index.html', bytes('<html></html>')],
    [
      'runtime-dependencies.json',
      bytes(
        JSON.stringify({
          format: 'revealline-runtime-dependencies.v1',
          entry: 'game/company.html',
          canonicalEntry: 'game/index.html',
          resources: ['game/build-config.json'],
        }),
      ),
    ],
  ]);
  assert.throws(() => validateEditionCodeClosure(files), /missing a declared runtime resource/);
  files.set('game/build-config.json', bytes('{}'));
  validateEditionCodeClosure(files);
  files.delete('game/index.html');
  assert.throws(() => validateEditionCodeClosure(files), /game\/index.html/);
});

test('shared runtime media ledger binds current font licenses, shell textures and licensed soundtrack bytes', async () => {
  const ledger = JSON.parse(
    await fs.readFile(new URL('../editions/runtime-assets.json', import.meta.url)),
  );
  const root = new URL('../../', import.meta.url);
  for (const record of ledger) {
    const payload = await fs.readFile(new URL(record.path, root));
    assert.equal(payload.length, record.bytes, record.path);
    assert.equal(createHash('sha256').update(payload).digest('hex'), record.sha256, record.path);
    for (const dependency of record.dependencies)
      assert.ok(ledger.some((entry) => entry.id === dependency));
  }
  assert.ok(ledger.some((entry) => entry.path.endsWith('.mp3')));
});
