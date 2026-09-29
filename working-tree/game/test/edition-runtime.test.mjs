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
  EDITION_RUNTIME_RESOURCES,
  editionDemoResources,
  projectEditionRuntimeImports,
  validateEditionHostRequests,
  editionMenuSceneResources,
  projectEditionMenuResourcePaths,
  projectEditionMenuScenes,
} from '../../scripts/edition-runtime.mjs';
import { MENU_SCENES, resolveMenuScene } from '../ui/menu-scene-catalog.mjs';
import { selectOfflineCore } from '../../scripts/offline-core-closure.mjs';
import { fileURLToPath } from 'node:url';

const bytes = (text) => Buffer.from(text);
const droneAidLandingFiles = [
  'game/ui/art/menu-scenes/droneaid-main-background.webp',
  'game/ui/art/menu-scenes/droneaid-wordmark-light.svg',
];
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
test('actual demo and landing closure retains clock, audio, Worker, frozen replays, artwork motion, receiver loss and signal atlas offline', async () => {
  const files = await collectEditionEngineFiles({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    entries: [
      'game/ui/demo-host.mjs',
      'game/demo-sources.mjs',
      'game/ui/menu-scenes.mjs',
      'game/ui/native-menus.mjs',
    ],
  });
  const catalog = JSON.parse(files.get('game/demo-data/catalog.json'));
  const recordings = catalog.clips.flatMap(({ replayURL, replayVariants = [] }) =>
    [replayURL, ...replayVariants].map((relative) => `game/${relative.slice(2)}`),
  );
  assert.equal(catalog.clips.length, 10);
  assert.equal(recordings.length, 20);
  assert.equal(new Set(recordings).size, 20);
  const required = [
    'game/demo-loading.mjs',
    'game/ui/demo-clock.mjs',
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
    ...recordings,
  ];
  for (const name of required) assert.ok(files.has(name), `Missing edition dependency: ${name}`);
  validateEditionCodeClosure(
    new Map([...files].map(([name, source]) => [name, projectEditionRuntimeImports(name, source)])),
  );
  // Exercise the actual public offline selector separately: it discovers
  // Worker URLs and JSON catalogue paths without the edition resource map.
  const publicFiles = new Map(files);
  publicFiles.set(
    'game/index.html',
    bytes(
      '<link rel="stylesheet" data-boot-href="ui/menu-scenes.css"><link rel="stylesheet" data-boot-href="ui/native-menu.css"><script src="ui/demo-host.mjs"></script><script src="demo-sources.mjs"></script><script src="ui/native-menus.mjs"></script>',
    ),
  );
  const selected = selectOfflineCore(
    [...publicFiles].map(([name, bytes]) => ({ name, bytes })),
    new Set(),
  );
  for (const name of required.filter((name) => !name.endsWith('variant-provenance.json')))
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
    const resources = editionMenuSceneResources([id]);
    assert.equal(
      resources.filter((name) => /\.(webp|png)$/.test(name)).length,
      3,
      'Selected background plus landscape/portrait fallback are retained.',
    );
    assert.ok(resources.includes(`game/ui/${selected.landscape.slice(2)}`));
    assert.ok(resources.includes('game/ui/art/menu-scenes/fpv-portrait.webp'));
    assert.ok(!resources.includes('game/ui/art/menu-scenes/retro.webp'));
    if (selected.wordmark) assert.ok(resources.includes(`game/ui/${selected.wordmark.slice(2)}`));
  }
  assert.throws(
    () => projectEditionMenuScenes(bytes('export const noLookup = {};'), ['coupa-all']),
    /explicit profile lookup/,
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
