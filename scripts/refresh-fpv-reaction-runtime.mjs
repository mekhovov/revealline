/** Deterministic, checked source projection for the unchanged 104-file FPV pack.
 * Shared services keep their canonical source; this generated module merely
 * co-locates their isolated module scopes, as SIM already does for shared art. */
import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { format, resolveConfig } from 'prettier';
import { OPTIONAL_PACKAGE_POLICIES } from '../publishing/optional-package-policy.mjs';
import { REACTION_VOICE_PILOT } from '../game/audio/reactions/pilot.mjs';
import { ACTOR_VOICE_RECORDINGS } from '../game/audio/reactions/actors.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = 'optional-practice/civilian-fpv/world-reaction-runtime.mjs';
const native = 'optional-practice/civilian-fpv/';
const entries = [
  'world-audio.mjs',
  'world-hangar.mjs',
  'world-actor-editor.mjs',
  'world-progress.mjs',
  'world-hunt-reactions.mjs',
  'world-enemy-guide.mjs',
].map((file) => native + file);
const policy = OPTIONAL_PACKAGE_POLICIES['fpv-worlds'];
const external = new Set(policy.sharedFiles.filter((file) => file !== target));
const modules = new Map(),
  externals = new Map(),
  hashes = {},
  visiting = new Set();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const relative = (file) => {
  const result = path.posix.relative(path.posix.dirname(target), file);
  return result.startsWith('.') ? result : './' + result;
};
const resolve = (file, specifier) => {
  if (!specifier.startsWith('.')) throw new Error(`Nonrelative projection import: ${file}`);
  return path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
};
function names(declaration) {
  if (declaration.type === 'VariableDeclaration')
    return declaration.declarations.map((row) => {
      if (row.id.type !== 'Identifier') throw new Error('Projection requires named exports.');
      return row.id.name;
    });
  if (!declaration.id?.name) throw new Error('Projection requires named declarations.');
  return [declaration.id.name];
}
async function visit(file) {
  if (external.has(file)) {
    if (!externals.has(file)) externals.set(file, `external${externals.size}`);
    return externals.get(file);
  }
  if (modules.has(file)) return `modules[${JSON.stringify(file)}]`;
  if (visiting.has(file)) throw new Error(`Projection cannot duplicate cyclic state: ${file}`);
  visiting.add(file);
  let source = await readFile(path.join(root, file), 'utf8');
  hashes[file] = hash(source);
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const edits = [],
    exported = new Map();
  for (const node of tree.body) {
    if (node.type === 'ImportDeclaration') {
      const owner = await visit(resolve(file, node.source.value));
      const declarations = node.specifiers
        .map((item) =>
          item.type === 'ImportNamespaceSpecifier'
            ? `const ${item.local.name} = ${owner};`
            : `const ${item.local.name} = ${owner}[${JSON.stringify(item.type === 'ImportDefaultSpecifier' ? 'default' : item.imported.name)}];`,
        )
        .join('\n');
      edits.push([node.start, node.end, declarations]);
    } else if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        for (const name of names(node.declaration)) exported.set(name, name);
        edits.push([node.start, node.declaration.start, '']);
      } else {
        const owner = node.source ? await visit(resolve(file, node.source.value)) : null;
        for (const item of node.specifiers)
          exported.set(
            item.exported.name,
            owner ? `${owner}[${JSON.stringify(item.local.name)}]` : item.local.name,
          );
        edits.push([node.start, node.end, '']);
      }
    } else if (node.type.startsWith('Export'))
      throw new Error(`Unsupported projection export in ${file}`);
  }
  for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0]))
    source = source.slice(0, start) + replacement + source.slice(end);
  // Portraits are tiny original SVG assets. Embedding preserves the exact art
  // while leaving all existing package executable/file/byte limits unchanged.
  for (const match of [...source.matchAll(/new URL\('([^']+\.svg)', import\.meta\.url\)\.href/g)]) {
    const asset = resolve(file, match[1]);
    const bytes = await readFile(path.join(root, asset));
    hashes[asset] = hash(bytes);
    source = source.replace(
      match[0],
      JSON.stringify(`data:image/svg+xml;base64,${bytes.toString('base64')}`),
    );
  }
  source = source.replaceAll(
    'import.meta.url',
    `new URL(${JSON.stringify(relative(file))}, import.meta.url).href`,
  );
  visiting.delete(file);
  modules.set(file, { source, exported });
  return `modules[${JSON.stringify(file)}]`;
}
for (const entry of entries) await visit(entry);
const voiceLibrary = await visit('game/journey/reaction-voice-library.mjs');
const recordings = [
  ...REACTION_VOICE_PILOT,
  ...ACTOR_VOICE_RECORDINGS.filter((row) =>
    /\/actor-(lookout|patroller)-(notice|caught)-(en|uk)\.m4a$/.test('/' + row.file),
  ),
];
const clips = {};
for (const recording of recordings) {
  const file = 'game/audio/reactions/' + recording.file;
  const bytes = await readFile(path.join(root, file));
  if (bytes.length !== recording.bytes || hash(bytes) !== recording.sha256)
    throw new Error(`Reaction voice differs from pinned metadata: ${file}`);
  hashes[file] = hash(bytes);
  clips[recording.file] = { mime: recording.mime, base64: bytes.toString('base64') };
}
const exports = new Map();
for (const entry of entries)
  for (const name of modules.get(entry).exported.keys()) {
    if (exports.has(name)) throw new Error(`Ambiguous projection export: ${name}`);
    exports.set(name, `modules[${JSON.stringify(entry)}].${name}`);
  }
const lines = [
  '// Generated by scripts/refresh-fpv-reaction-runtime.mjs; edit canonical sources instead.',
  '// Native flight logic remains in its existing cores. No simulation clock or record recipe changes.',
  `const sourceHashes = ${JSON.stringify(hashes)};`,
  ...[...externals].map(
    ([file, name]) => `import * as ${name} from ${JSON.stringify(relative(file))};`,
  ),
  'const modules = Object.create(null);',
  ...[...modules].map(
    ([file, { source, exported }]) =>
      `modules[${JSON.stringify(file)}] = (() => {\n${source}\nreturn {${[...exported].map(([name, value]) => `${JSON.stringify(name)}: ${value}`).join(',')}};\n})();`,
  ),
  '// Exact source recordings; decoded only through the existing bounded voice cache.',
  '// prettier-ignore',
  `const packedClips = ${JSON.stringify(clips)};`,
  `async function packedRecording(url, {signal} = {}) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const file = new URL(url).pathname.split('/game/audio/reactions/')[1];
    const clip = packedClips[file];
    if (!clip) return new Response(null, {status:404});
    const bytes = Uint8Array.from(atob(clip.base64), character => character.charCodeAt(0));
    return new Response(bytes, {headers:{'content-type':clip.mime,'content-length':String(bytes.length)}});
  }`,
  ...[...exports].map(([name, owner]) =>
    name === 'mountWorldHuntReactions'
      ? `export function mountWorldHuntReactions(options) {
      const library = ${voiceLibrary}.createReactionVoiceLibrary({fetch:packedRecording});
      const mounted = ${owner}({...options, voiceLibrary:library});
      return {...mounted, dispose() {mounted.dispose(); library.close();}};
    }`
      : `export const ${name} = ${owner};`,
  ),
];
const generated = await format(lines.join('\n'), {
  ...(await resolveConfig(path.join(root, target))),
  filepath: path.join(root, target),
  parser: 'babel',
});
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('Use [--check].');
if (check) {
  if ((await readFile(path.join(root, target), 'utf8')) !== generated)
    throw new Error(
      'FPV reaction projection is stale; run scripts/refresh-fpv-reaction-runtime.mjs.',
    );
} else {
  // Preserve the last complete projection if storage fills during generation.
  const destination = path.join(root, target),
    temporary = `${destination}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, generated, { flag: 'wx' });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}
console.log(
  JSON.stringify({
    status: check ? 'verified-byte-identical' : 'refreshed',
    modules: modules.size,
    recordings: recordings.length,
    bytes: Buffer.byteLength(generated),
  }),
);
