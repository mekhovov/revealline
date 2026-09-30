import test from 'node:test';
import assert from 'node:assert/strict';
import { selectOfflineCore } from './offline-core-closure.mjs';

const entries = (values) =>
  Object.entries(values).map(([name, value]) => ({
    name,
    bytes: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)),
  }));

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
