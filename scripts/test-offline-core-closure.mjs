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

test('public community entries own their shared loader offline without opting into creator tools or company artwork', () => {
  const pages = [
    'game/communities/coupa/index.html',
    'game/communities/droneaid/index.html',
    'game/communities/droneaid-community/index.html',
  ];
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

test('essential WAV recipes are followed from the bank without pulling optional music into core', () => {
  const files = entries({
    'game/index.html': '<script type="module" src="ui/audio.mjs"></script>',
    'game/ui/audio.mjs': 'import { BANK } from "../audio/effects/bank.mjs";',
    'game/audio/effects/bank.mjs':
      'export const BANK = { warning: { file: "warning.wav" }, contact: { file: "contact.wav" } };',
    'game/audio/effects/warning.wav': 'essential warning PCM',
    'game/audio/effects/contact.wav': 'essential contact PCM',
    'game/audio/music/optional.mp3': 'optional music',
    'authoring/audio/original.wav': 'source recording, never shipped in core',
  });
  const result = selectOfflineCore(files, new Set());
  assert.ok(result.retained.has('game/audio/effects/warning.wav'));
  assert.ok(result.retained.has('game/audio/effects/contact.wav'));
  assert.ok(!result.retained.has('game/audio/music/optional.mp3'));
  assert.ok(!result.retained.has('authoring/audio/original.wav'));
});

test('radio redistribution license and source recordings remain available in every offline mode', () => {
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
    assert.equal(result.retained.size, 4, mode);
    assert.ok(!result.retained.has('authoring/audio/unrelated.wav'));
  }
});
