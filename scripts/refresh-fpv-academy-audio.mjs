/** Deterministic projection of canonical flight sound into an already admitted
 * Academy module. Keeps the 72-file package bound and isolates module state. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { format, resolveConfig } from 'prettier';
import { OPTIONAL_PACKAGE_POLICIES } from '../publishing/optional-package-policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = 'optional-practice/civilian-fpv/sim-presentation.mjs';
const entry = 'optional-practice/civilian-fpv/world-audio.mjs';
const begin = '// BEGIN GENERATED ACADEMY SHARED AUDIO';
const end = '// END GENERATED ACADEMY SHARED AUDIO';
const included = new Set([
  entry,
  'game/ui/audio-output.mjs',
  'game/ui/audio-master.mjs',
  'game/audio-preferences.mjs',
  'game/ui/encounter-audio.mjs',
  'game/ui/movement-audio.mjs',
  'game/ui/dialogue-channel.mjs',
]);
// Localization already belongs to Academy. No art, recordings, voice library or
// unrelated runtime may quietly enter this narrow generated audio closure.
const external = new Set(['game/i18n/index.mjs']);
const policy = OPTIONAL_PACKAGE_POLICIES['civilian-fpv'];
if (!policy.localFiles.includes(path.posix.basename(target)))
  throw new Error('The Academy audio projection must use an existing package slot.');
for (const file of external)
  if (!policy.sharedFiles.includes(file))
    throw new Error(`Unadmitted Academy audio external: ${file}`);
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('Use [--check].');
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
  if (!specifier.startsWith('.')) throw new Error(`Nonrelative audio projection import: ${file}`);
  return path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
};
function names(declaration) {
  if (declaration.type === 'VariableDeclaration')
    return declaration.declarations.map((row) => {
      if (row.id.type !== 'Identifier') throw new Error('Audio projection requires named exports.');
      return row.id.name;
    });
  if (!declaration.id?.name) throw new Error('Audio projection requires named declarations.');
  return [declaration.id.name];
}
function checkStatic(node, file) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'ImportExpression' || node.type === 'MetaProperty')
    throw new Error(`Audio projection cannot relocate dynamic imports or module URLs: ${file}`);
  for (const value of Object.values(node))
    if (Array.isArray(value)) value.forEach((child) => checkStatic(child, file));
    else if (value && typeof value === 'object') checkStatic(value, file);
}
async function visit(file) {
  if (external.has(file)) {
    if (!externals.has(file)) externals.set(file, `academyAudioExternal${externals.size}`);
    return externals.get(file);
  }
  if (!included.has(file)) throw new Error(`Unexpected Academy audio dependency: ${file}`);
  if (modules.has(file)) return `modules[${JSON.stringify(file)}]`;
  if (visiting.has(file))
    throw new Error(`Audio projection cannot duplicate cyclic state: ${file}`);
  visiting.add(file);
  let source = await readFile(path.join(root, file), 'utf8');
  hashes[file] = hash(source);
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  checkStatic(tree, file);
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
      throw new Error(`Unsupported audio projection export: ${file}`);
  }
  for (const [start, finish, replacement] of edits.sort((a, b) => b[0] - a[0]))
    source = source.slice(0, start) + replacement + source.slice(finish);
  visiting.delete(file);
  modules.set(file, { source, exported });
  return `modules[${JSON.stringify(file)}]`;
}
await visit(entry);
if (modules.size !== included.size) throw new Error('The canonical Academy audio closure changed.');
if (!modules.get(entry).exported.has('createWorldAudio'))
  throw new Error('Missing canonical flight audio factory.');
const projected = [
  begin,
  '// Generated by scripts/refresh-fpv-academy-audio.mjs; edit canonical audio sources instead.',
  '// No new package files, recordings, gameplay clocks or simulation state.',
  ...[...externals].map(
    ([file, name]) => `import * as ${name} from ${JSON.stringify(relative(file))};`,
  ),
  'export const createSimFlightAudio = (() => {',
  `const sourceHashes = Object.freeze(${JSON.stringify(hashes)});`,
  'const modules = Object.create(null);',
  ...[...modules].map(
    ([file, { source, exported }]) =>
      `modules[${JSON.stringify(file)}] = (() => {\n${source}\nreturn {${[...exported].map(([name, value]) => `${JSON.stringify(name)}: ${value}`).join(',')}};\n})();`,
  ),
  `return modules[${JSON.stringify(entry)}].createWorldAudio;`,
  '})();',
  end,
].join('\n');
const generated = await format(projected, {
  ...(await resolveConfig(path.join(root, target))),
  filepath: path.join(root, target),
  parser: 'babel',
});
// Read only after generation so concurrent manual edits outside our markers are
// preserved. A broken/duplicate marker pair must never overwrite native code.
const current = await readFile(path.join(root, target), 'utf8');
const starts = current.split(begin).length - 1,
  finishes = current.split(end).length - 1;
let output;
if (!starts && !finishes) output = current.trimEnd() + '\n\n' + generated;
else {
  if (starts !== 1 || finishes !== 1 || current.indexOf(end) < current.indexOf(begin))
    throw new Error(
      'Academy audio projection markers are malformed; native source was not changed.',
    );
  const start = current.indexOf(begin),
    finish = current.indexOf(end) + end.length;
  output = current.slice(0, start) + generated.trimEnd() + current.slice(finish);
}
if (check) {
  if (current !== output)
    throw new Error(
      'Academy audio projection is stale; run scripts/refresh-fpv-academy-audio.mjs.',
    );
} else await writeFile(path.join(root, target), output);
console.log(
  JSON.stringify({
    status: check ? 'verified-byte-identical' : 'refreshed',
    modules: modules.size,
    externalModules: externals.size,
    bytes: Buffer.byteLength(generated),
    target,
  }),
);
