import test from 'node:test';
import assert from 'node:assert/strict';
import { offlineStartupRoutes } from './offline-startup.mjs';

test('startup guards follow the static entry graph without requiring tools, media or another mode', () => {
  const sources = {
    'game/index.html':
      '<script src="boot.mjs" defer></script><link rel="stylesheet" data-boot-href="style.css"><a href="downloads.html">Downloads</a><img src="picture.png">',
    'game/boot.mjs':
      'const appURL = new URL("./app.mjs", document.currentScript.src); import(appURL);',
    'game/app.mjs': 'import { game } from "./core.mjs"; import("./tool.mjs");',
    'game/core.mjs': 'export { game } from "./rules.mjs";',
    'game/rules.mjs': 'export const game = true;',
    'game/style.css': 'body { color: white }',
    'game/tool.mjs': 'export const tool = true;',
    'game/picture.png': 'picture',
    'game/downloads.html': '<script type="module" src="downloads.mjs"></script>',
    'game/downloads.mjs': 'import "./core.mjs";',
    'game/couch/index.html': '<script src="couch.mjs"></script>',
    'game/couch/couch.mjs': 'export const couch = true;',
    'app/index.html': '<script src="app.mjs"></script>',
    'app/app.mjs': 'export const launcher = true;',
  };
  const entries = Object.entries(sources).map(([name, source]) => ({
    name,
    bytes: Buffer.from(source),
  }));
  const files = entries
    .filter(({ name }) => !name.startsWith('game/couch/'))
    .map(({ name }) => ({ path: name }));
  const routes = offlineStartupRoutes(entries, files);
  assert.deepEqual(routes, [
    {
      path: 'game/index.html',
      files: [
        'game/app.mjs',
        'game/boot.mjs',
        'game/core.mjs',
        'game/index.html',
        'game/rules.mjs',
        'game/style.css',
      ],
    },
    {
      path: 'game/downloads.html',
      files: ['game/core.mjs', 'game/downloads.html', 'game/downloads.mjs', 'game/rules.mjs'],
    },
  ]);
});

test('nested mode guards resolve local imports and terminate cycles', () => {
  const entries = [
    [
      'game/overflight/play.html',
      '<script data-module="./app.mjs"></script><script src="https://external.invalid/m.js"></script>',
    ],
    ['game/overflight/app.mjs', 'import "../shared.mjs";'],
    ['game/shared.mjs', 'export * from "./overflight/app.mjs";'],
  ].map(([name, source]) => ({ name, bytes: Buffer.from(source) }));
  assert.deepEqual(
    offlineStartupRoutes(
      entries,
      entries.map(({ name }) => ({ path: name })),
    ),
    [
      {
        path: 'game/overflight/play.html',
        files: ['game/overflight/app.mjs', 'game/overflight/play.html', 'game/shared.mjs'],
      },
    ],
  );
});
