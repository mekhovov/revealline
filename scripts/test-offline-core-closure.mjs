import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { selectOfflineCore } from './offline-core-closure.mjs';
import { COMMUNITY_ROUTES } from '../game/community-routes.mjs';

const entries = (values) =>
  Object.entries(values).map(([name, value]) => ({
    name,
    bytes: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)),
  }));

test('actual native menu imports and styles remain in each mode offline closure', async () => {
  const names = [
    'game/index.html',
    'game/boot.mjs',
    'game/app.mjs',
    'game/ui/game-shell.mjs',
    'game/ui/field-kit-surfaces.mjs',
    'game/ui/mode-choice.mjs',
    'game/ui/mode-choice-view.mjs',
    'game/ui/native-menus.mjs',
    'game/ui/native-menu.css',
    'game/ui/native-menu-icons.mjs',
    'game/ui/mode-settings-view.mjs',
    'game/ui/mode-settings-view.css',
    'game/ui/settings-panels.mjs',
    'game/ui/pause-menu.mjs',
    'game/ui/pause-menu.css',
    'game/ui/device-controls.css',
    'game/ui/handheld-play.css',
    'game/ui/touch-steering.css',
    'game/ui/mode-boot.css',
    'game/couch/index.html',
    'game/couch/couch.mjs',
    'game/couch/couch-shell.mjs',
    'game/couch/relay-rescue.html',
    'game/couch/relay-rescue.mjs',
    'game/snake/play.html',
    'game/snake/classic-app.mjs',
  ];
  const files = await Promise.all(
    names.map(async (name) => ({
      name,
      bytes: await readFile(new URL(`../${name}`, import.meta.url)),
    })),
  );
  for (const mode of ['solo', 'team', 'versus']) {
    const { retained } = selectOfflineCore(files, new Set(), { mode });
    for (const name of [
      'game/ui/mode-choice-view.mjs',
      'game/ui/mode-settings-view.mjs',
      'game/ui/native-menu-icons.mjs',
      'game/ui/pause-menu.css',
      'game/ui/touch-steering.css',
    ])
      assert.ok(retained.has(name), `${mode}: ${name}`);
    if (mode !== 'solo') {
      assert.ok(retained.has('game/ui/mode-boot.css'), `${mode} boot stylesheet`);
      assert.ok(retained.has('game/ui/pause-menu.mjs'), `${mode} Couch pause menu`);
    } else assert.ok(retained.has('game/ui/mode-settings-view.css'), 'Snake category stylesheet');
  }
});

test('native Overflight source stays in player core while its linked Studio remains optional', async () => {
  const player = (await readdir(new URL('../game/overflight/', import.meta.url)))
    .filter((name) => /\.(?:mjs|css|html)$/.test(name))
    .map((name) => `game/overflight/${name}`);
  const shared = [
    'game/ui/mode-play-shell.mjs',
    'game/ui/mode-play-shell.css',
    'game/ui/controller-navigation.mjs',
    'game/ui/audio.mjs',
    'game/ui/audio-master.mjs',
    'game/couch/couch-music-host.mjs',
    'game/presentation/theme-host.mjs',
    'game/presentation/theme-bootstrap.mjs',
    'game/presentation/host.mjs',
    'game/presentation/industrial-machinery.mjs',
    'game/presentation/overflight-field-kit-art.mjs',
    'game/presentation/overflight-motion.mjs',
    'game/hunt/actor-art.mjs',
    'game/vendor/phaser-4.2.1.min.js',
  ];
  const optional = [
    'game/studio/overflight.html',
    'game/studio/overflight.mjs',
    'game/studio/overflight.css',
    'authoring/library/overflight-field-kit-v1/manifest.json',
    'authoring/library/overflight-field-kit-v1/pickup-salvage-small.png',
  ];
  const files = await Promise.all(
    [...player, ...shared, ...optional].map(async (name) => ({
      name,
      bytes: await readFile(new URL(`../${name}`, import.meta.url)),
    })),
  );
  const core = selectOfflineCore(files, new Set());
  for (const name of [
    'game/overflight/play.html',
    'game/overflight/app.mjs',
    'game/overflight/core.mjs',
    'game/overflight/renderer.mjs',
    'game/overflight/atlas.mjs',
    'game/overflight/style.css',
    ...shared,
  ])
    assert.ok(core.retained.has(name), `${name} must not be hidden in tooling`);
  for (const name of optional) {
    assert.equal(core.retained.has(name), false, name);
    assert.ok(core.optional.includes(name), name);
  }
  assert.equal(core.references.get('game/overflight/app.mjs'), 'game/overflight/play.html');
  assert.equal(core.references.get('game/overflight/renderer.mjs'), 'game/overflight/app.mjs');
});

test('Solo startup graph retains boot styles and production assets while mode hosts stay separate', () => {
  const files = entries({
    'game/index.html':
      '<link rel="stylesheet" data-boot-href="style.css"><script src="boot.mjs"></script><a href="../authoring/tool.html">Tool</a>',
    'game/boot.mjs': 'const url = new URL("./app.mjs", import.meta.url); import(url);',
    'game/app.mjs': 'import "./shared.mjs";',
    'game/shared.mjs': 'export const ready = true;',
    'game/style.css': '@font-face {src: url("font.woff2")}',
    'game/font.woff2': 'font',
    'game/couch/index.html': '<script src="launcher.js" data-module="./couch.mjs"></script>',
    'game/couch/launcher.js': 'globalThis.boot = true;',
    'game/couch/couch.mjs': 'import "../shared.mjs";',
    'authoring/motion-lab/presets.json': {
      characters: { src: '../library/player.png' },
    },
    'authoring/library/player.png': 'runtime body',
    'authoring/library/editor-reference.png': 'unused editor reference',
    'authoring/tool.html': '<script src="tool.mjs"></script>',
    'authoring/tool.mjs': 'export const tool = true;',
    'game/presentation/compiled/studio.json': { editable: true },
    'game/presentation/compiled/manifest.json': {
      files: [{ path: 'studio.json' }],
    },
    'game/presentation/compiled/runtime.json': { compiled: true },
    'game/presentation/visual-themes.json': { themes: [] },
  });
  const result = selectOfflineCore(files, new Set());
  for (const name of [
    'game/style.css',
    'game/font.woff2',
    'game/app.mjs',
    'game/shared.mjs',
    'authoring/library/player.png',
    'game/presentation/compiled/runtime.json',
    'game/presentation/visual-themes.json',
  ])
    assert(result.retained.has(name), name);
  const versus = selectOfflineCore(files, new Set(), { mode: 'versus' });
  assert(versus.retained.has('game/couch/couch.mjs'));
  assert(!result.retained.has('game/couch/couch.mjs'));
  assert.deepEqual(result.optional.sort(), [
    'authoring/library/editor-reference.png',
    'authoring/tool.html',
    'authoring/tool.mjs',
    'game/couch/couch.mjs',
    'game/couch/index.html',
    'game/couch/launcher.js',
    'game/presentation/compiled/manifest.json',
    'game/presentation/compiled/studio.json',
  ]);
});

test('catalogue references never pull selected chapter or soundtrack bytes back into core', () => {
  const files = entries({
    'game/index.html': '',
    'game/content/catalog.json': {
      chapter: 'packs/one.json',
      soundtrack: 'music/one.mp3',
    },
    'game/content/packs/one.json': { art: '../chapter.png' },
    'game/content/chapter.png': 'chapter original',
    'game/content/music/one.mp3': 'recording',
  });
  const excluded = new Set([
    'game/content/packs/one.json',
    'game/content/chapter.png',
    'game/content/music/one.mp3',
  ]);
  const result = selectOfflineCore(files, excluded);
  assert(result.retained.has('game/content/catalog.json'));
  for (const name of excluded) assert(!result.retained.has(name));
  assert.equal(result.optional.length, 0);
});

test('public community entries own their shared loader offline without opting into creator tools or company artwork', () => {
  const pages = COMMUNITY_ROUTES.map(({ slug }) => `game/communities/${slug}/index.html`);
  const files = entries({
    'game/index.html': '<script src="boot.mjs"></script>',
    'game/boot.mjs': 'import "./app.mjs";',
    'game/app.mjs': 'export const ready = true;',
    'game/communities/index.html':
      '<link rel="stylesheet" href="directory.css"><a href="coupa/">Coupa</a>',
    ...Object.fromEntries(
      pages.map((name) => [name, '<script type="module" src="../entry.mjs"></script>']),
    ),
    'game/communities/entry.mjs':
      'import "../community-routes.mjs"; const host = new URL("../index.html", import.meta.url);',
    'game/community-routes.mjs': 'export const shared = "index.html";',
    'game/communities/directory.css': 'body { color: white; }',
    'game/community/index.html': '<script src="redirect.mjs"></script>',
    'game/community/redirect.mjs':
      'const destination = new URL("../communities/index.html", import.meta.url);',
    'game/community/store.html': '<script src="page.mjs"></script>',
    'game/community/page.mjs': 'export const marketplace = true;',
    'game/community/moderation.html': '<script src="moderation-page.mjs"></script>',
    'game/community/moderation-page.mjs': 'export const moderation = true;',
    'game/communities/drafts/notes.html': '<p>Not a public entry</p>',
    'game/editions/assets/company.png': 'original artwork',
  });
  const result = selectOfflineCore(files, new Set(['game/editions/assets/company.png']));
  for (const name of [
    'game/index.html',
    'game/communities/index.html',
    ...pages,
    'game/communities/entry.mjs',
    'game/community-routes.mjs',
    'game/communities/directory.css',
    'game/community/index.html',
    'game/community/redirect.mjs',
  ])
    assert.ok(result.retained.has(name), name);
  assert.ok(pages.includes(result.references.get('game/communities/entry.mjs')));
  for (const name of [
    'game/community/store.html',
    'game/community/page.mjs',
    'game/community/moderation.html',
    'game/community/moderation-page.mjs',
    'game/communities/drafts/notes.html',
  ])
    assert.ok(result.optional.includes(name), name);
  assert.ok(!result.retained.has('game/editions/assets/company.png'));
  assert.ok(!result.optional.includes('game/editions/assets/company.png'));
});

test('decorative menu rasters and the icon source stay optional without dropping runtime or install icons', () => {
  const originals = {
    'game/index.html':
      '<link rel="stylesheet" href="./ui/menu-scenes.css"><script type="module" src="./ui/menu-scene-catalog.mjs"></script>',
    'game/couch/index.html': '<script type="module" src="../ui/menu-scene-catalog.mjs"></script>',
    'game/couch/relay-rescue.html':
      '<script type="module" src="../ui/menu-scene-catalog.mjs"></script>',
    'game/ui/menu-scene-catalog.mjs':
      'export const background = "./art/menu-scenes/fpv-team.webp";',
    'game/ui/menu-scenes.css':
      '.menu { background: #080e18 url("./art/menu-scenes/analog-noise-atlas.png"); }',
    'game/ui/art/menu-scenes/fpv-team.webp': 'original scene',
    'game/ui/art/menu-scenes/analog-noise-atlas.png': 'original atlas',
    'game/ui/art/menu-scenes/renderer.mjs': 'export const renderer = true;',
    'game/ui/art/menu-scenes/wordmark.svg': '<svg/>',
    'game/ui/art/identity/fpv-line/icon-master.png': 'original install master',
    'game/ui/art/identity/fpv-line/icon-192.png': 'shipped install derivative',
    'game/ui/fonts/menu.woff2': 'font',
    'icons/icon-192.png': 'installed icon',
  };
  const files = entries(originals);
  const before = files.map(({ name, bytes }) => [name, Buffer.from(bytes)]);
  const optional = [
    'game/ui/art/menu-scenes/fpv-team.webp',
    'game/ui/art/menu-scenes/analog-noise-atlas.png',
    'game/ui/art/identity/fpv-line/icon-master.png',
  ];
  for (const mode of ['solo', 'versus', 'team']) {
    const result = selectOfflineCore(files, new Set(), { mode });
    for (const name of optional) {
      assert(!result.retained.has(name), name);
      assert(result.optional.includes(name), name);
    }
    for (const name of [
      'game/ui/menu-scene-catalog.mjs',
      'game/ui/art/menu-scenes/renderer.mjs',
      'game/ui/art/menu-scenes/wordmark.svg',
      'game/ui/art/identity/fpv-line/icon-192.png',
      'game/ui/fonts/menu.woff2',
      'icons/icon-192.png',
    ])
      assert(result.retained.has(name), name);
  }
  assert.deepEqual(
    files.map(({ name, bytes }) => [name, bytes]),
    before,
    'Selection must not modify or remove any shipped original.',
  );
});

test('effect bank and metadata stay core while WAV bodies remain an optional hosted pack', () => {
  const files = entries({
    'game/index.html': '<script type="module" src="ui/audio.mjs"></script>',
    'game/ui/audio.mjs': 'import { BANK } from "../audio/effects/bank.mjs";',
    'game/audio/effects/bank.mjs':
      'export const BANK = { warning: { file: "warning.wav" }, contact: { file: "contact.wav" } };',
    'game/audio/effects/warning.wav': 'essential warning PCM',
    'game/audio/effects/contact.wav': 'essential contact PCM',
    'game/audio/effects/licenses.html': '<h1>Recorded effect licences</h1>',
    'game/audio/effects/edgetx-source.json': { originals: [] },
    'game/audio/music/optional.mp3': 'optional music',
    'authoring/audio/original.wav': 'source recording, never shipped in core',
  });
  const result = selectOfflineCore(files, new Set());
  assert.ok(result.retained.has('game/audio/effects/bank.mjs'));
  assert.ok(result.retained.has('game/audio/effects/licenses.html'));
  assert.ok(result.retained.has('game/audio/effects/edgetx-source.json'));
  assert.ok(!result.retained.has('game/audio/effects/warning.wav'));
  assert.ok(!result.retained.has('game/audio/effects/contact.wav'));
  assert.ok(result.optional.includes('game/audio/effects/warning.wav'));
  assert.ok(result.optional.includes('game/audio/effects/contact.wav'));
  assert.ok(!result.retained.has('game/audio/music/optional.mp3'));
  assert.ok(!result.retained.has('authoring/audio/original.wav'));
});

test('radio redistribution metadata stays core while source recordings remain selectable', () => {
  const files = entries({
    'game/audio/effects/licenses.html': '<h1>GPL-2.0</h1>',
    'game/audio/effects/edgetx-source.json': JSON.stringify({
      originals: [{ local: 'edgetx-armed-source-en.wav' }, { local: 'edgetx-armed-source-uk.wav' }],
    }),
    'game/audio/effects/edgetx-armed-source-en.wav': 'English source',
    'game/audio/effects/edgetx-armed-source-uk.wav': 'Ukrainian source',
    'authoring/audio/unrelated.wav': 'optional production recording',
  });
  for (const mode of ['solo', 'versus', 'team']) {
    const result = selectOfflineCore(files, new Set(), { mode });
    assert.equal(result.retained.size, 2, mode);
    assert.ok(result.retained.has('game/audio/effects/licenses.html'));
    assert.ok(result.retained.has('game/audio/effects/edgetx-source.json'));
    assert.ok(result.optional.includes('game/audio/effects/edgetx-armed-source-en.wav'));
    assert.ok(result.optional.includes('game/audio/effects/edgetx-armed-source-uk.wav'));
    assert.ok(!result.retained.has('authoring/audio/unrelated.wav'));
  }
});
