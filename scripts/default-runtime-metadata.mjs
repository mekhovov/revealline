import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'acorn';
import LZString from 'lz-string';
import { projectEditionModuleIndentation } from './edition-code-indentation.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const codecPath = 'game/vendor/lz-string-1.5.0.min.js';
const licensePath = 'game/vendor/LZ-STRING-LICENSE.txt';
const codecHash = '95f4d1cbf099f57161b664bc048426ec3df92637801a4c79116e83315aa787e7';
const licenseHash = '433fc9dfe659dbfb1e91eed8351f13651e97bfa3ac6d03394c3d63f61d4bbc80';
// Explicit UI hosts only. The merged mode/content additions exceeded the core
// cache budget; reuse Company's verified whitespace projection instead of
// changing authored content, artwork, recipes or admission limits.
const defaultUIHosts = new Set([
  'game/app.mjs',
  'game/couch/relay-rescue.mjs',
  'game/couch/couch.mjs',
  'game/ui/soundtrack-panel.mjs',
  'game/ui/library-panel.mjs',
  'game/ui/soundtrack-player.mjs',
  'game/couch/coop-view.mjs',
  'game/ui/optional-chapters-panel.mjs',
  'game/ui/render.mjs',
  'game/ui/controller-navigation.mjs',
  'game/snake/classic-app.mjs',
  'game/ui/mission-library-chooser.mjs',
  'game/ui/actor-presentation.mjs',
  'game/ui/edition-rewards.mjs',
  'game/ui/audio.mjs',
  'game/ui/still-media-panel.mjs',
  'game/studio/studio.mjs',
  'game/ui/classic-view.mjs',
  'game/couch/couch-installed-chapters.mjs',
  'game/ui/demo-host.mjs',
  'game/ui/still-story-panel.mjs',
]);

/** Encode only the existing generated data tuples, never execute source. The
 * exact known wrapper is required so a future generator change cannot silently
 * discard code. Every identity, field, translation and array order is retained. */
export function projectDefaultContentRegistry(bytes, { codec, license }) {
  if (hash(codec) !== codecHash || hash(license) !== licenseHash)
    throw new Error('Default content registry needs the pinned localization codec and license.');
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const messagesNode = tree.body[0]?.declarations?.[0]?.init;
  const groupsNode = tree.body[1]?.declarations?.[0]?.init?.callee?.object;
  const recordsNode = tree.body[2]?.declaration?.arguments?.[0]?.callee?.object;
  if (![messagesNode, groupsNode, recordsNode].every((node) => node?.type === 'ArrayExpression'))
    throw new Error('Unknown generated content registry tuples.');
  const [messages, groups, records] = [messagesNode, groupsNode, recordsNode].map((node) =>
    JSON.parse(source.slice(node.start, node.end)),
  );
  const expected =
    '// Generated from explicitly registered first-party content.\n' +
    `const messages = ${JSON.stringify(messages)};\n` +
    `const groups = ${JSON.stringify(groups)}.map(entries => ({fields: Object.fromEntries(entries.map(([field, index]) => [field, messages[index]]))}));\n` +
    `export default Object.fromEntries(${JSON.stringify(records)}.map(([identity, index]) => [identity, groups[index]]));\n`;
  if (source !== expected) throw new Error('Generated content registry wrapper changed.');
  const original = JSON.stringify([messages, groups, records]);
  const encoded = LZString.compressToBase64(original);
  if (LZString.decompressFromBase64(encoded) !== original)
    throw new Error('Content registry encoding failed its exact data round trip.');
  const projected =
    `// Distribution-only content registry; source sha256 ${hash(bytes)}.\n` +
    `/* lz-string 1.5.0\n${license.toString('utf8')}*/\n` +
    'const decode = (function(module, define, angular) {\n' +
    codec.toString('utf8') +
    '\nreturn LZString.decompressFromBase64;\n})();\n' +
    `const [messages, fieldGroups, records] = JSON.parse(decode(${JSON.stringify(encoded)}));\n` +
    'const groups = fieldGroups.map(entries => ({fields: Object.fromEntries(entries.map(([field, index]) => [field, messages[index]]))}));\n' +
    'export default Object.fromEntries(records.map(([identity, index]) => [identity, groups[index]]));\n';
  parse(projected, { ecmaVersion: 'latest', sourceType: 'module' });
  return Buffer.from(projected);
}

/** Applied after normal source validation and before generating final transport
 * hashes. Never compact byte-pinned recovery catalogs, mission bodies or artwork.
 * Canonical repository files and authoring exports retain their original bytes. */
export async function projectDefaultRuntimeMetadata(root, entries) {
  // Distribution copies only; the projector checks exact AST, tokens, comments
  // and line terminators. Its source-map/vendor exclusions remain authoritative.
  for (const host of entries)
    if (defaultUIHosts.has(host.name))
      host.bytes = projectEditionModuleIndentation(host.name, host.bytes);
  const registry = entries.find((entry) => entry.name === 'game/i18n/content-registry.mjs');
  if (registry) {
    const [codec, license] = await Promise.all([
      readFile(path.join(root, codecPath)),
      readFile(path.join(root, licensePath)),
    ]);
    registry.bytes = projectDefaultContentRegistry(registry.bytes, { codec, license });
  }
  const index = entries.find((entry) => entry.name === 'game/content/mission-library-index.json');
  if (index) {
    const value = JSON.parse(index.bytes);
    if (value.format !== 'revealline-mission-library-index.v1' || !Array.isArray(value.missions))
      throw new Error('Unknown mission-library transport metadata.');
    index.bytes = Buffer.from(JSON.stringify(value) + '\n');
  }
}
