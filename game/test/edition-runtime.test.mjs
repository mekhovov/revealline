import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
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
  EDITION_RUNTIME_RESOURCES,
  editionDemoResources,
  editionClassicPresentationResources,
  projectEditionRuntimeImports,
  projectEditionRuntimeIndentation,
  validateEditionHostRequests,
  editionMenuSceneResources,
  projectEditionMenuResourcePaths,
  projectEditionMenuScenes,
  projectEditionBrandIdentity,
  DEFAULT_GAME_WORDMARK,
} from '../../scripts/edition-runtime.mjs';
import { MENU_SCENES, resolveMenuScene } from '../ui/menu-scene-catalog.mjs';
import { CLASSIC_PRESENTATION } from '../snake/classic-presentation.mjs';
import { selectOfflineCore } from '../../scripts/offline-core-closure.mjs';
import { fileURLToPath } from 'node:url';

const bytes = (text) => Buffer.from(text);
const droneAidLandingFiles = [
  'game/ui/art/menu-scenes/droneaid-main-background.webp',
  'game/ui/art/menu-scenes/droneaid-wordmark-light.svg',
];

function lexicalSignature(source) {
  const tokens = [],
    comments = [];
  parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    allowHashBang: true,
    locations: true,
    onToken: ({ type, start, end, loc }) =>
      tokens.push([type.label, source.slice(start, end), loc.start.line, loc.end.line]),
    onComment: (block, _text, start, end, from, to) =>
      comments.push([block, source.slice(start, end), from.line, to.line]),
  });
  return { tokens, comments, lineBreaks: source.match(/\r\n|[\n\r\u2028\u2029]/g) ?? [] };
}

test('runtime indentation preserves executable tokens, comments, line breaks and literal values', async () => {
  const source = [
    '#!/usr/bin/env node',
    '  // Copyright stays exact, including   spaces.',
    '  export const template = String.raw`first',
    '    literal indentation ${(() => {',
    '      return "nested";',
    '    })()}',
    '    last`;',
    '  export const pattern = /[ \\t]+/g;',
    '  /* multiline comment',
    '     indentation remains exact */',
    '  const quoted = "escaped\\\n    string";',
    '  function lineReturn() {',
    '    return',
    '      9;',
    '  }',
    '  let a = 2, b = 3;',
    '  a',
    '    ++b;',
    '  export const observed = { template, quoted, asi: lineReturn(), a, b };',
    '  //# sourceURL=retained-runtime-fixture.mjs',
    '',
  ].join('\r\n');
  const projected = projectEditionRuntimeIndentation('game/runtime.mjs', bytes(source));
  assert.ok(projected.length < Buffer.byteLength(source));
  assert.deepEqual(lexicalSignature(projected.toString()), lexicalSignature(source));
  const load = (text) =>
    import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
  const before = await load(source),
    after = await load(projected);
  assert.deepEqual(after.observed, before.observed);
  assert.equal(after.observed.asi, undefined);
  assert.equal(after.pattern.source, before.pattern.source);
  assert.deepEqual(projectEditionRuntimeIndentation('game/runtime.mjs', projected), projected);
  for (const name of ['game/vendor/library.js', 'authoring/tool.mjs', 'game/content/project.json'])
    assert.deepEqual(projectEditionRuntimeIndentation(name, bytes(source)), bytes(source), name);
});

test('all admitted engine JavaScript retains lexical and line-termination parity when compacted', async () => {
  const engine = await collectEditionEngineFiles({
    root: fileURLToPath(new URL('../../', import.meta.url)),
  });
  let savedBytes = 0;
  for (const [name, original] of engine) {
    const projected = projectEditionRuntimeIndentation(name, original);
    savedBytes += original.length - projected.length;
    if (projected.equals(original)) continue;
    assert.deepEqual(
      lexicalSignature(projected.toString()),
      lexicalSignature(original.toString()),
      name,
    );
  }
  assert.ok(savedBytes > 300947, 'Runtime-only compaction recovers the observed edition overrun');
});
test('standalone branding projects only the image fallback to an approved selected logo', async () => {
  const original = await fs.readFile(new URL('../ui/brand-identity.mjs', import.meta.url));
  const catalog = JSON.parse(
    await fs.readFile(new URL('../editions/catalog.json', import.meta.url)),
  );
  for (const edition of catalog.editions) {
    const brand = catalog.brands.find((item) => item.id === edition.brandId);
    const logo = catalog.assets.find((item) => item.id === brand.logoAssetId);
    assert.ok(brand, edition.id);
    if (!brand.logoAssetId) {
      assert.equal(logo, undefined);
      assert.deepEqual(
        projectEditionRuntimeImports('game/ui/brand-identity.mjs', original),
        original,
      );
      assert.match(original.toString(), /art\/identity\/fpv-line\/wordmark\.png/);
      continue;
    }
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
test('edition recording inventory follows validated catalogue additions and runtime variants', async () => {
  const catalog = JSON.parse(
    await fs.readFile(new URL('../demo-data/catalog.json', import.meta.url)),
  );
  assert.deepEqual(
    EDITION_RUNTIME_RESOURCES['game/demo-catalog.mjs'],
    editionDemoResources(catalog),
  );
  const additional = structuredClone(catalog.clips[0]);
  additional.id = 'additional-reviewed-scene';
  additional.replayURL = './demo-data/additional-reviewed-scene.replay.json';
  additional.replayVariants = [
    './demo-data/additional-reviewed-scene.chromium-macos.replay.json',
    './demo-data/additional-reviewed-scene.second-runtime.replay.json',
  ];
  catalog.clips.push(additional);
  const paths = editionDemoResources(catalog);
  for (const relative of [additional.replayURL, ...additional.replayVariants])
    assert.ok(paths.includes(`game/${relative.slice(2)}`));
  assert.equal(new Set(paths).size, paths.length);
  for (const invalid of [
    'https://example.com/scene.replay.json',
    './demo-data/../private.replay.json',
    './demo-data/scene.replay.json?unreviewed=1',
  ]) {
    additional.replayVariants[0] = invalid;
    assert.throws(() => editionDemoResources(catalog), /bundled relative URLs/);
  }
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
test('the shared Snake launcher delivers both pages, current match modules and exact original artwork offline', async () => {
  const files = await collectEditionEngineFiles({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    entries: ['game/ui/mode-choice.mjs'],
  });
  const projected = new Map(
    [...files].map(([name, source]) => [name, projectEditionRuntimeImports(name, source)]),
  );
  validateEditionCodeClosure(projected);
  const offline = selectOfflineCore(
    [...projected].map(([name, bytes]) => ({ name, bytes })),
    new Set(),
  );
  for (const name of [
    'game/snake/index.html',
    'game/snake/hub.mjs',
    'game/snake/hub.css',
    'game/snake/play.html',
    'game/snake/classic-app.mjs',
    'game/snake/classic.css',
    'game/snake/classic-match.mjs',
    'game/snake/classic-core-v2.mjs',
    'game/snake/classic-catalogue-v2.mjs',
    'game/snake/classic-setup.mjs',
    'game/snake/classic-records.mjs',
    'game/snake/classic-presentation.mjs',
    'game/presentation/industrial-workshop.css',
    'game/ui/optional-practice-panel.css',
    ...editionClassicPresentationResources(),
  ]) {
    assert.ok(files.has(name), `Missing edition Snake resource: ${name}`);
    assert.ok(offline.retained.has(name), `Missing offline Snake resource: ${name}`);
  }
  assert.equal(editionClassicPresentationResources().length, 2);
  for (const asset of CLASSIC_PRESENTATION.assets) {
    const name = `game/presentation/compiled/assets/${asset.sha256}.png`;
    const payload = files.get(name);
    assert.equal(payload.length, asset.bytes);
    assert.equal(createHash('sha256').update(payload).digest('hex'), asset.sha256);
  }
});

test('actual company host closure retains explicit Demo dependencies and preserves optional artwork', async () => {
  const files = await collectEditionEngineFiles({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    entries: ['game/company.html'],
  });
  const catalog = JSON.parse(files.get('game/demo-data/catalog.json'));
  const recordings = catalog.clips.flatMap(({ replayURL, replayVariants = [] }) =>
    [replayURL, ...replayVariants].map((relative) => `game/${relative.slice(2)}`),
  );
  assert.deepEqual(
    catalog,
    JSON.parse(await fs.readFile(new URL('../demo-data/catalog.json', import.meta.url))),
  );
  assert.ok(catalog.clips.length > 0);
  assert.equal(new Set(recordings).size, recordings.length);
  const required = [
    ...['fpv', 'ukraine', 'retro', 'coupa'].flatMap((world) =>
      ['versus', 'versus-portrait', 'team', 'team-portrait'].map(
        (mode) => `game/ui/art/menu-scenes/${world}-${mode}.webp`,
      ),
    ),
    'game/ui/analog-signal.mjs',
    'game/demo-loading.mjs',
    'game/ui/demo-clock.mjs',
    'game/ui/demo-journey-picture.mjs',
    'game/ui/demo-audio.mjs',
    'game/ui/signal-reception.mjs',
    'game/ui/music-credit.mjs',
    'game/soundtrack.mjs',
    'game/demo-bot-worker.mjs',
    'game/demo-data/catalog.json',
    'game/demo-data/variant-provenance.json',
    'game/ui/menu-scenes.css',
    'game/ui/menu-scene-motion.mjs',
    'game/ui/menu-signal-loss.mjs',
    'game/ui/native-menu.css',
    'game/ui/menu-retune.mjs',
    'game/ui/menu-retune.css',
    'game/ui/art/menu-scenes/analog-noise-atlas.png',
    ...droneAidLandingFiles,
  ];
  for (const name of [...required, ...recordings])
    assert.ok(files.has(name), `Missing edition dependency: ${name}`);
  validateEditionCodeClosure(
    new Map([...files].map(([name, source]) => [name, projectEditionRuntimeImports(name, source)])),
  );
  // Exercise the actual public offline selector separately: it discovers
  // literal imports and asset paths without the edition resource map.
  const publicFiles = new Map(files);
  publicFiles.set(
    'game/index.html',
    bytes(
      '<link rel="stylesheet" data-boot-href="ui/menu-scenes.css"><link rel="stylesheet" data-boot-href="ui/native-menu.css"><script src="app.mjs"></script><script src="ui/native-menus.mjs"></script>',
    ),
  );
  const selected = selectOfflineCore(
    [...publicFiles].map(([name, bytes]) => ({ name, bytes })),
    new Set(),
  );
  const optional = new Set(selected.optional);
  for (const name of required) {
    if (name === 'game/demo-data/variant-provenance.json') {
      assert.ok(
        optional.has(name),
        'Recording provenance remains packaged without a runtime fetch',
      );
    } else if (/\.(?:png|webp)$/.test(name)) {
      assert.ok(!selected.retained.has(name), `Decorative raster entered startup cache: ${name}`);
      assert.ok(optional.has(name), `Missing optional menu artwork: ${name}`);
      assert.deepEqual(publicFiles.get(name), files.get(name), `Menu artwork changed: ${name}`);
    } else {
      assert.ok(selected.retained.has(name), `Missing offline executable/style/logo: ${name}`);
    }
  }
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
    assert.deepEqual(
      Object.keys(projected.MENU_SCENES).sort(),
      [...new Set(['fpv', selected.id])].sort(),
    );
    assert.deepEqual(projected.resolveMenuScene({ editionId: id }), selected);
    assert.deepEqual(projected.resolveMenuScene({ themeId: 'retro', editionId: id }), selected);
    assert.deepEqual(projected.resolveMenuScene({ editionId: 'unrecognized' }), selected);
    assert.deepEqual(projected.resolveMenuScene(), selected);
    assert.equal(projected.MENU_SCENES.fpv, projected.MENU_SCENES[selected.id]);
    assert.ok(Object.isFrozen(projected.MENU_SCENES));
    assert.equal(projected.menuSceneMode('team'), 'team');
    assert.deepEqual(projected.MENU_SCENE_COMPOSITIONS, {});
    assert.equal(
      projected.resolveMenuScene({ themeId: 'fpv', mode: 'versus' }),
      projected.MENU_SCENES.fpv,
    );
    const resources = editionMenuSceneResources([id]);
    const expectedRaster = [
      ...new Set(
        [selected].flatMap((scene) =>
          [scene.landscape, scene.portrait, scene.wordmark]
            .filter((asset) => asset && /\.(webp|png)$/.test(asset))
            .map((asset) => 'game/ui/' + asset.slice(2)),
        ),
      ),
    ].sort();
    assert.deepEqual(
      resources.filter((name) => /\.(webp|png)$/.test(name)).sort(),
      expectedRaster,
      'The selected scene is also the fallback, with each original retained exactly once.',
    );
    assert.ok(resources.includes(`game/ui/${selected.landscape.slice(2)}`));
    assert.equal(
      resources.includes('game/ui/art/menu-scenes/fpv-portrait.webp'),
      selected.id === 'fpv',
    );
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
test('multi-edition menu builds retain their neutral FPV fallback and every selected scene', async () => {
  const original = await fs.readFile(new URL('../ui/menu-scene-catalog.mjs', import.meta.url));
  const ids = ['coupa-all', 'droneaid-nl-community'];
  const projected = await import(
    `data:text/javascript;base64,${projectEditionMenuScenes(original, ids).toString('base64')}`
  );
  assert.deepEqual(projected.resolveMenuScene(), MENU_SCENES.fpv);
  assert.deepEqual(projected.resolveMenuScene({ editionId: 'unrecognized' }), MENU_SCENES.fpv);
  const resources = editionMenuSceneResources(ids);
  assert.ok(resources.includes('game/ui/art/menu-scenes/fpv.webp'));
  assert.ok(resources.includes('game/ui/art/menu-scenes/fpv-portrait.webp'));
  for (const id of ids) {
    const selected = resolveMenuScene({ editionId: id });
    assert.deepEqual(projected.resolveMenuScene({ editionId: id }), selected);
    assert.ok(resources.includes(`game/ui/${selected.landscape.slice(2)}`));
    assert.ok(resources.includes(`game/ui/${selected.portrait.slice(2)}`));
  }
  assert.deepEqual(
    projectEditionMenuScenes(original, ids),
    projectEditionMenuScenes(original, ids),
  );
});
test('DroneAid aggregate uses only its lossless derivative while retaining original source files', async () => {
  const catalog = JSON.parse(
    await fs.readFile(new URL('../editions/catalog.json', import.meta.url)),
  );
  const paths = [
    'game/ui/menu-scenes.mjs',
    'game/ui/art/menu-scenes/provenance.json',
    'game/ui/art/menu-scenes/analog-noise-atlas.png',
    'game/ui/art/menu-scenes/droneaid-nl-community.webp',
    'game/ui/art/menu-scenes/droneaid-main-background.png',
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
    assert.equal(selected.has('game/ui/art/menu-scenes/droneaid-main-background.png'), false);
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
  const retainedOriginals = [
    'game/ui/art/menu-scenes/droneaid-main-background.png',
    droneAidLandingFiles[1],
  ];
  for (const [index, file] of retainedOriginals.entries()) {
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
