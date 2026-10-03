import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'acorn';
import LZString from 'lz-string';
import { compactContentRegistry } from './localization.mjs';
import { projectEditionModuleIndentation } from './edition-code-indentation.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const codecPath = 'game/vendor/lz-string-1.5.0.min.js';
const licensePath = 'game/vendor/LZ-STRING-LICENSE.txt';
const codecHash = '95f4d1cbf099f57161b664bc048426ec3df92637801a4c79116e83315aa787e7';
const licenseHash = '433fc9dfe659dbfb1e91eed8351f13651e97bfa3ac6d03394c3d63f61d4bbc80';
// Explicit core-reachable UI, presentation and media/storage runtime modules.
// Keep gameplay implementations, recipes and byte-pinned artwork outside this
// allowlist; reuse Company's verified whitespace projection without raising caps.
const defaultRuntimeHosts = new Set([
  'game/app.mjs',
  'game/content.mjs',
  'game/creator/media-intake.mjs',
  'game/downloads.mjs',
  'game/external-chapter-host.mjs',
  'game/external-chapter-install.mjs',
  'game/external-chapter-source.mjs',
  'game/first-flight.mjs',
  'game/hunt/destruction.mjs',
  'game/journey/profile.mjs',
  'game/library.mjs',
  'game/managed-media-store.mjs',
  'game/offline.mjs',
  'game/packs.mjs',
  'game/presentation/host.mjs',
  'game/presentation/icons.mjs',
  'game/presentation/industrial-arcade.mjs',
  'game/presentation/model.mjs',
  'game/presentation/page.mjs',
  'game/presentation/pixel-art.mjs',
  'game/presentation/release-pictures.mjs',
  'game/presentation/session-release-pictures.mjs',
  'game/presentation/theme-bootstrap.mjs',
  'game/presentation/theme-host.mjs',
  'game/presentation/theme-system.mjs',
  'game/profile-channel-reader.mjs',
  'game/profile-shared-media.mjs',
  'game/replay-theater/app.mjs',
  'game/snake/classic-app.mjs',
  'game/snake/classic-records.mjs',
  'game/soundtrack.mjs',
  'game/story-media-store.mjs',
  'game/ui/actor-presentation.mjs',
  'game/ui/audio.mjs',
  'game/ui/classic-view.mjs',
  'game/ui/combat-presentation.mjs',
  'game/ui/combat-view.mjs',
  'game/ui/contextual-reactions.mjs',
  'game/ui/controller-confirm-guard.mjs',
  'game/ui/controller-field-editor.mjs',
  'game/ui/controller-navigation.mjs',
  'game/ui/controller-reading.mjs',
  'game/ui/controller-router.mjs',
  'game/ui/controller-settings.mjs',
  'game/ui/demo-host.mjs',
  'game/ui/demo-input.mjs',
  'game/ui/demo-picture.mjs',
  'game/ui/edition-expedition.mjs',
  'game/ui/edition-lessons.mjs',
  'game/ui/edition-mastery.mjs',
  'game/ui/edition-rewards.mjs',
  'game/ui/edition-solo.mjs',
  'game/ui/enemy-body-assets.mjs',
  'game/ui/enemy-guide.mjs',
  'game/ui/feedback-director.mjs',
  'game/ui/flight-information-bridge.mjs',
  'game/ui/flight-information-details.mjs',
  'game/ui/flight-pictures.mjs',
  'game/ui/game-shell.mjs',
  'game/ui/input.mjs',
  'game/ui/install-offline-panel.mjs',
  'game/ui/library-panel.mjs',
  'game/ui/menu-scene-motion.mjs',
  'game/ui/menu-scenes.mjs',
  'game/ui/mission-library-chooser.mjs',
  'game/ui/mission-picker.mjs',
  'game/ui/mode-play-shell.mjs',
  'game/ui/native-menus.mjs',
  'game/ui/optional-chapters-panel.mjs',
  'game/ui/optional-practice-panel.mjs',
  'game/ui/page-input-host.mjs',
  'game/ui/presentation-image.mjs',
  'game/ui/profile-recovery.mjs',
  'game/ui/profile-transfer-panel.mjs',
  'game/ui/quick-music-controls.mjs',
  'game/ui/render.mjs',
  'game/ui/reward-media.mjs',
  'game/ui/scene-art.mjs',
  'game/ui/signal-reception.mjs',
  'game/ui/soundtrack-panel.mjs',
  'game/ui/soundtrack-player.mjs',
  'game/ui/victory-story.mjs',
  'game/video-poster.mjs',
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
  let messages, groups, records, packedSource = false;
  if ([messagesNode, groupsNode, recordsNode].every((node) => node?.type === 'ArrayExpression')) {
    [messages, groups, records] = [messagesNode, groupsNode, recordsNode].map((node) =>
      JSON.parse(source.slice(node.start, node.end)),
    );
  } else {
    const packedNode = tree.body[1]?.declarations?.[0]?.init;
    const payloadNode = packedNode?.arguments?.[0];
    const payload =
      packedNode?.type === 'CallExpression' &&
      packedNode.callee?.type === 'MemberExpression' &&
      packedNode.callee.object?.name === 'JSON' &&
      packedNode.callee.property?.name === 'parse' &&
      payloadNode?.type === 'CallExpression' &&
      payloadNode.callee?.name === 'decode' &&
      payloadNode.arguments?.length === 1 &&
      payloadNode.arguments[0]?.type === 'Literal' &&
      typeof payloadNode.arguments[0].value === 'string'
        ? payloadNode.arguments[0].value
        : null;
    const decoded = payload && LZString.decompressFromBase64(payload);
    let packed;
    try {
      packed = decoded && JSON.parse(decoded);
    } catch {}
    if (!Array.isArray(packed) || packed.length !== 3 || !packed.every(Array.isArray))
      throw new Error('Unknown generated content registry tuples.');
    [messages, groups, records] = packed;
    const encodedIdentities = source.match(/const identities = Array\.from\(atob\(("(?:[^"\\]|\\.)*")\)/)?.[1];
    if (records.every(Number.isInteger)) {
      if (!encodedIdentities) throw new Error('Unknown generated content registry identities.');
      const identities = Buffer.from(JSON.parse(encodedIdentities), 'base64').toString('hex').match(/.{16}/g) || [];
      if (identities.length !== records.length || !identities.every((identity) => /^[a-f0-9]{16}$/.test(identity)))
        throw new Error('Invalid generated content registry identities.');
      records = records.map((index, row) => [identities[row], index]);
    }
    if (!records.every(([identity, index]) => typeof identity === 'string' && Number.isInteger(index) && index >= 0 && index < groups.length))
      throw new Error('Invalid generated content registry records.');
    const registry = Object.fromEntries(
      records.map(([identity, index]) => [
        identity,
        { fields: Object.fromEntries(groups[index].map(([field, message]) => [field, messages[message]])) },
      ]),
    );
    if (compactContentRegistry(registry) !== source)
      throw new Error('Generated content registry wrapper changed.');
    packedSource = true;
  }
  const expected =
    '// Generated from explicitly registered first-party content.\n' +
    `const messages = ${JSON.stringify(messages)};\n` +
    `const groups = ${JSON.stringify(groups)}.map(entries => ({fields: Object.fromEntries(entries.map(([field, index]) => [field, messages[index]]))}));\n` +
    `export default Object.fromEntries(${JSON.stringify(records)}.map(([identity, index]) => [identity, groups[index]]));\n`;
  if (!packedSource && source !== expected) throw new Error('Generated content registry wrapper changed.');
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
    if (defaultRuntimeHosts.has(host.name))
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
