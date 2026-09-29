import path from 'node:path';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { validateDemoCatalog } from '../game/demo-catalog.mjs';
import {
  MENU_SCENES,
  MENU_SCENE_COMPOSITIONS,
  resolveMenuScene,
} from '../game/ui/menu-scene-catalog.mjs';

export const DEFAULT_GAME_WORDMARK = 'game/ui/art/identity/fpv-line/wordmark.png';

/** Standalone company chrome already uses its selected brand. Keep the shared
 * helper's image fallback local to that same approved logo instead of shipping
 * an otherwise unused default-game wordmark. Source/default-game bytes stay put. */
export function projectEditionBrandIdentity(bytes, logoPath) {
  if (!/^game\/[A-Za-z0-9_.\/-]+$/.test(logoPath) || logoPath.split('/').includes('..'))
    throw new Error('Edition branding needs an approved local logo path.');
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const declarations = tree.body.flatMap((node) => (node.declaration ?? node).declarations ?? []);
  const declaration = declarations.find((node) => node.id?.name === 'GAME_WORDMARK_URL');
  const url = declaration?.init?.object;
  const literal = url?.arguments?.[0];
  if (
    declaration?.init?.type !== 'MemberExpression' ||
    declaration.init.property?.name !== 'href' ||
    url?.type !== 'NewExpression' ||
    url.callee?.name !== 'URL' ||
    literal?.type !== 'Literal' ||
    literal.value !== './art/identity/fpv-line/wordmark.png'
  )
    throw new Error('Unknown shared brand image fallback.');
  const relative = path.posix.relative('game/ui', logoPath);
  const target = relative.startsWith('.') ? relative : './' + relative;
  return Buffer.from(
    source.slice(0, literal.start) + JSON.stringify(target) + source.slice(literal.end),
  );
}

/** Resolve only the reviewed catalogue's bounded local recording paths. Keep
 * this build inventory derived from the same data the runtime will select. */
export function editionDemoResources(source) {
  const catalog = validateDemoCatalog(source);
  return [
    'game/demo-data/catalog.json',
    'game/demo-data/variant-provenance.json',
    ...new Set(
      catalog.clips.flatMap(({ replayURL, replayVariants = [] }) =>
        [replayURL, ...replayVariants].map((relative) => `game/${relative.slice(2)}`),
      ),
    ),
  ];
}

function sceneAssets(scene) {
  return [scene.landscape, scene.portrait, scene.wordmark]
    .filter(Boolean)
    .map((asset) => `game/ui/${asset.slice(2)}`);
}

export function editionMenuSceneResources(editionIds) {
  const scenes = [
    MENU_SCENES.fpv,
    ...editionIds.map((editionId) => resolveMenuScene({ editionId })),
  ];
  return [...new Set(scenes.flatMap(sceneAssets)), 'game/ui/art/menu-scenes/provenance.json'];
}

/** Keep selected scene originals in any admitted image format. The receiver
 * atlas is shared presentation, not artwork belonging to one scene. */
export function projectEditionMenuResourcePaths(paths, editionIds) {
  const selected = new Set(editionMenuSceneResources(editionIds));
  return paths.filter(
    (name) =>
      !/^game\/ui\/art\/menu-scenes\/[^/]+\.(?:webp|png|svg)$/.test(name) ||
      name === 'game/ui/art/menu-scenes/analog-noise-atlas.png' ||
      selected.has(name),
  );
}

// Project only the public profile lookup. Preserve original scene data and
// resolver code, including timing, fallback behavior and source provenance.
export function projectEditionMenuScenes(bytes, editionIds) {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const declarations = tree.body.flatMap((node) => (node.declaration ?? node).declarations ?? []);
  const declaration = declarations.find((node) => node.id?.name === 'MENU_SCENES');
  const compositions = declarations.find((node) => node.id?.name === 'MENU_SCENE_COMPOSITIONS');
  if (!declaration?.init) throw new Error('Menu scene catalog lacks its explicit profile lookup.');
  if (!compositions?.init)
    throw new Error('Menu scene catalog lacks its explicit composition lookup.');
  const ids = [
    ...new Set(['fpv', ...editionIds.map((editionId) => resolveMenuScene({ editionId }).id)]),
  ];
  const { start, end } = declaration.init;
  const edits = [
    {
      start,
      end,
      text: `Object.freeze(Object.fromEntries(Object.entries(${source.slice(start, end)}).filter(([id]) => ${JSON.stringify(ids)}.includes(id))))`,
    },
    { start: compositions.init.start, end: compositions.init.end, text: 'Object.freeze({})' },
  ];
  let projected = source;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    projected = projected.slice(0, edit.start) + edit.text + projected.slice(edit.end);
  return Buffer.from(projected);
}

// These are release-owned adapters, not content-supplied scripts. Original
// historical registries never enter either the player or selected-source ZIP.
export const EDITION_RUNTIME_ADAPTERS = Object.freeze({
  'game/content-design/route-loader.mjs': 'game/editions/standalone/route-loader.mjs',
  'game/runtime-library-sources.mjs': 'game/editions/standalone/library-sources.mjs',
  'game/external-chapter-source.mjs': 'game/editions/standalone/external-chapters.mjs',
  'game/replay-theater/examples.mjs': 'game/editions/standalone/replay-examples.mjs',
});

export const EDITION_RUNTIME_PAGES = Object.freeze([
  'game/controller-lab/index.html',
  'game/replay-theater/index.html',
]);

// Non-import fetch/navigation dependencies of the shared host. Boot JSON and
// edition media are supplied separately by the validated selected catalog.
export const EDITION_RUNTIME_RESOURCES = Object.freeze({
  'game/company-entry.mjs': ['game/index.html'],
  'game/index.html': EDITION_RUNTIME_PAGES,
  'game/app.mjs': ['game/content/scenarios/line-impact-demo.json'],
  'game/demo-bot-player.mjs': ['game/demo-bot-worker.mjs'],
  'game/demo-catalog.mjs': editionDemoResources(
    readFileSync(new URL('../game/demo-data/catalog.json', import.meta.url), 'utf8'),
  ),
  'game/ui/native-menus.mjs': ['game/ui/native-menu.css'],
  'game/ui/controller-field-editor.mjs': ['game/ui/controller-field-editor.css'],
  'game/ui/soundtrack-panel.mjs': ['game/ui/soundtrack-panel.css'],
  'game/ui/install-offline-panel.mjs': ['game/ui/install-offline-panel.css'],
  'game/vendor/qrcodegen-1.8.0.mjs': [
    'game/vendor/QRCODEGEN-LICENSE.txt',
    'game/vendor/qrcodegen-1.8.0.json',
  ],
  'game/ui/brand-identity.mjs': ['game/ui/art/identity/fpv-line/wordmark.png'],
  'game/ui/menu-scenes.mjs': [
    'game/ui/menu-scenes.css',
    'game/ui/art/menu-scenes/analog-noise-atlas.png',
  ],
  'game/ui/page-input-host.mjs': ['game/ui/authoring-input.css'],
  'game/ui/authoring-sources.mjs': [
    'game/ui/authoring-input.css',
    'authoring/shared/samples/dawn-signal.png',
    'authoring/shared/samples/dawn-signal.mp4',
    'authoring/still-media/examples/dawn-signal/Dawn-Signal-originals.rlmedia',
    'authoring/still-media/examples/dawn-signal/Dawn-Signal-stories.rlstory',
  ],
  'game/ui/menu-scene-catalog.mjs': [
    ...new Set(Object.values(MENU_SCENES).flatMap(sceneAssets)),
    ...Object.values(MENU_SCENE_COMPOSITIONS).flatMap((modes) =>
      Object.values(modes).flatMap(sceneAssets),
    ),
    'game/ui/art/menu-scenes/provenance.json',
  ],
  'game/content/soundtrack-catalogue.mjs': [
    'game/audio/soundtracks/d4147214e221be28f19d6c6c38afc8d3cf0289a0dc6ac579b26574a0c571bc58.mp3',
  ],
});
export const EDITION_RUNTIME_ASSET_LEDGER = 'game/editions/runtime-assets.json';

// Every literal JSON request in the common host has a reviewed source. Provider
// boot/index requests are resolved from selected data before the default branch.
export const EDITION_HOST_JSON_REQUESTS = Object.freeze({
  'content/campaign.json': 'provider.boot.campaign',
  'content/themes.json': 'provider.boot.themes',
  '../authoring/motion-lab/presets.json': 'provider.boot.presets',
  'content/classes.json': 'provider.boot.classes',
  'content/packs/catalog.json': 'provider.boot.packs',
  'content/packs/archive-catalog.json': 'provider.boot.archives',
  'content-design/themes.json': 'provider.themes',
  'content/mission-library-index.json': 'provider.missionIndex',
  'content/journey-campaign-pins.json': 'default-game-only',
  'build-info.json': 'generated',
  'build-config.json': 'generated',
  'content/scenarios/line-impact-demo.json': 'shared-mechanics-selected-presentation',
});

export function validateEditionHostRequests(name, bytes) {
  if (name !== 'game/app.mjs') return;
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && node.callee?.name === 'getJSON') {
      const request = node.arguments[0]?.value;
      if (typeof request !== 'string' || !Object.hasOwn(EDITION_HOST_JSON_REQUESTS, request))
        throw new Error('Shared host has an undeclared runtime JSON request.');
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(parse(new TextDecoder().decode(bytes), { ecmaVersion: 'latest', sourceType: 'module' }));
}

export function projectEditionRuntimeImports(name, bytes) {
  if (!/\.(?:mjs|js)$/.test(name)) return bytes;
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    edits = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (
      [
        'ImportDeclaration',
        'ExportNamedDeclaration',
        'ExportAllDeclaration',
        'ImportExpression',
      ].includes(node.type) &&
      typeof node.source?.value === 'string' &&
      /^\.\.?\//.test(node.source.value)
    ) {
      const dependency = path.posix.normalize(
        path.posix.join(path.posix.dirname(name), node.source.value),
      );
      const adapter = EDITION_RUNTIME_ADAPTERS[dependency];
      if (adapter) {
        let relative = path.posix.relative(path.posix.dirname(name), adapter);
        if (!relative.startsWith('.')) relative = `./${relative}`;
        edits.push({
          start: node.source.start,
          end: node.source.end,
          text: JSON.stringify(relative),
        });
      }
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true }));
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  return Buffer.from(output);
}
