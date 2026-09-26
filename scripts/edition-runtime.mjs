import path from 'node:path';
import { parse } from 'acorn';

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
