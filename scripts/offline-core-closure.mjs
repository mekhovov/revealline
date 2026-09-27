import path from 'node:path';
import { parse as parseModule } from 'acorn';
import { parse as parseHTML } from 'parse5';

const PLAY_ENTRIES = [
  'game/index.html',
  'game/replay-theater/index.html',
  'game/downloads.html',
  'game/profile-recovery.html',
  'credits.html',
  'privacy.html',
];
const MODE_ENTRIES = { versus: ['game/couch/index.html'], team: ['game/couch/relay-rescue.html'] };
// These are conditional source-v1 library adapters. Published Solo navigation
// has exact metadata views and never executes their imports.
const PUBLISHED_SOLO_BOUNDARIES = new Set([
  'game/couch/index.html',
  'game/couch/relay-rescue.html',
  'game/couch/couch.mjs',
  'game/couch/relay-rescue.mjs',
  'game/content-design/versus-host.mjs',
  'game/mission-library/remote-team.mjs',
  'game/mission-library/spatial-next-editions.mjs',
]);

/** Resolve local file references, never external addresses or speculative URLs. */
function targets(value, owner, byPath) {
  if (typeof value !== 'string' || /^(?:[a-z]+:|\/|#)/i.test(value)) return [];
  const clean = value.split(/[?#]/)[0];
  if (!/\.(?:m?js|json|css|html|png|webp|jpe?g|svg|woff2?|ttf)$/i.test(clean)) return [];
  return [
    ...new Set([
      path.posix.normalize(path.posix.join(path.posix.dirname(owner), clean)),
      path.posix.normalize(path.posix.join('game', clean)),
      path.posix.normalize(clean),
    ]),
  ].filter((candidate) => byPath.has(candidate));
}

function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((item) => walk(item, visit));
    else if (child && typeof child === 'object') walk(child, visit);
  }
}

/** Derive each mode's runtime closure from its entry points and shared production
 * assets. Published Solo uses metadata for other modes and historical editions;
 * their conditional legacy host imports stay in separately approved packages. */
export function selectOfflineCore(entries, excluded, { mode = 'solo' } = {}) {
  const byPath = new Map(entries.map((entry) => [entry.name, entry]));
  const retained = new Set(),
    references = new Map(),
    pending = [];
  const add = (name, owner = '<entry>') => {
    if (
      byPath.has(name) &&
      !excluded.has(name) &&
      !retained.has(name) &&
      !(mode === 'solo' && PUBLISHED_SOLO_BOUNDARIES.has(name))
    ) {
      retained.add(name);
      references.set(name, owner);
      pending.push(name);
    }
  };
  (MODE_ENTRIES[mode] || PLAY_ENTRIES).forEach((name) => add(name));
  for (const entry of entries) {
    const name = entry.name;
    // Immutable compiled presentation metadata includes player-selected actor
    // themes, restore/backup pins and replay rendering. Keep its exact closure.
    if (
      // Studio's editable document is 4 MiB and has no gameplay caller. Runtime
      // modules follow imports; immutable runtime manifests/assets remain seeded
      // because presentation paths are assembled from content hashes at runtime.
      /^game\/presentation\/compiled\/(?:runtime(?:\.[a-f0-9]{64})?\.json|theme\.css|assets\/)/.test(
        name,
      ) ||
      // Saved visual pins resolve this relative to their compiled base URL.
      name === 'game/presentation/visual-themes.json' ||
      name.startsWith('game/content/') ||
      name === 'game/content-design/themes.json' ||
      // The publisher injects this script after selecting the offline closure.
      name === 'game/ui/install-entry.mjs' ||
      name === 'authoring/motion-lab/presets.json' ||
      name.startsWith('game/content-design/runtime/') ||
      name.startsWith('app/') ||
      name.startsWith('icons/') ||
      name === 'manifest.webmanifest' ||
      name === 'game/build-info.json' ||
      /^game\/i18n\/.*\.(?:mjs|json)$/.test(name) ||
      /^game\/assets\//.test(name) ||
      /^game\/ui\/(?:art|fonts)\//.test(name) ||
      /(?:LICENSE|OFL)(?:[.-]|$)/.test(path.posix.basename(name)) ||
      /^vendor\//.test(name)
    )
      add(name);
  }
  while (pending.length) {
    const name = pending.pop(),
      source = byPath.get(name).bytes.toString();
    const reference = (value) =>
      targets(value, name, byPath).forEach((target) => add(target, name));
    if ((name.endsWith('.mjs') || name.endsWith('.js')) && !name.includes('/vendor/')) {
      const ast = parseModule(source, { ecmaVersion: 'latest', sourceType: 'module' });
      // Literal imports plus registered JSON/asset paths used by fetch helpers.
      walk(ast, (node) => {
        if (node.type === 'Literal') reference(node.value);
      });
    } else if (name.endsWith('.json')) {
      const value = JSON.parse(source);
      walk(value, (node) =>
        Object.values(node).forEach((item) => {
          if (typeof item === 'string') reference(item);
        }),
      );
    } else if (name.endsWith('.html')) {
      const document = parseHTML(source);
      const visit = (node) => {
        const attrs = Object.fromEntries(
          (node.attrs || []).map(({ name, value }) => [name, value]),
        );
        if (['script', 'img', 'source'].includes(node.tagName)) reference(attrs.src);
        if (node.tagName === 'script') reference(attrs['data-module']);
        if (
          node.tagName === 'link' &&
          ['stylesheet', 'modulepreload', 'preload', 'icon'].includes(attrs.rel)
        )
          reference(attrs.href || attrs['data-boot-href']);
        // Navigational links are optional destinations, not startup dependencies.
        for (const child of node.childNodes || []) visit(child);
      };
      visit(document);
    } else if (name.endsWith('.css')) {
      for (const match of source.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g))
        reference(match[1]);
    }
  }
  const optional = entries
    .filter(
      (entry) =>
        !excluded.has(entry.name) &&
        !retained.has(entry.name) &&
        !entry.name.startsWith('game/locales/') &&
        entry.name !== '_headers',
    )
    .map((entry) => entry.name);
  return { retained, optional, references };
}
