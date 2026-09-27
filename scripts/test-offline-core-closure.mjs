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
    'authoring/motion-lab/presets.json': { characters: { src: '../library/player.png' } },
    'authoring/library/player.png': 'runtime body',
    'authoring/library/editor-reference.png': 'unused editor reference',
    'authoring/tool.html': '<script src="tool.mjs"></script>',
    'authoring/tool.mjs': 'export const tool = true;',
    'game/presentation/compiled/studio.json': { editable: true },
    'game/presentation/compiled/manifest.json': { files: [{ path: 'studio.json' }] },
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
    'game/content/catalog.json': { chapter: 'packs/one.json', soundtrack: 'music/one.mp3' },
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
