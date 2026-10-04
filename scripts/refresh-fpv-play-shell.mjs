/** Share the game shell without expanding the admitted SIM package file count. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'acorn';
import { format, resolveConfig } from 'prettier';
import { projectEditionModuleIndentation } from './edition-code-indentation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('Use [--check].');
const read = (file) => readFile(path.join(root, file), 'utf8');
const source = await read('game/ui/mode-play-shell.mjs');
const tree = parse(source, { sourceType: 'module', ecmaVersion: 'latest' });
const exports = [];
const edits = [];
function inspect(node) {
  if (!node || typeof node !== 'object') return;
  if (
    ['ImportDeclaration', 'ImportExpression', 'MetaProperty', 'ExportDefaultDeclaration'].includes(
      node.type,
    )
  )
    throw new Error('The optional shell projection must remain dependency-free.');
  if (node.type === 'ExportNamedDeclaration') {
    if (!node.declaration || node.source)
      throw new Error('Only named shell declarations are supported.');
    const declaration = node.declaration;
    const names =
      declaration.type === 'VariableDeclaration'
        ? declaration.declarations.map((item) => item.id.name)
        : [declaration.id?.name];
    if (names.some((name) => !name)) throw new Error('Shell exports must be named.');
    exports.push(...names);
    edits.push([node.start, declaration.start]);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(inspect);
    else if (value && typeof value === 'object') inspect(value);
  }
}
inspect(tree);
if (!exports.includes('mountModePlayShell')) throw new Error('Missing canonical shell entry.');
let projected = source;
for (const [start, end] of edits.sort((a, b) => b[0] - a[0]))
  projected = projected.slice(0, start) + projected.slice(end);
const hash = createHash('sha256').update(source).digest('hex');
const jsBegin = '// BEGIN GENERATED SHARED MODE SHELL';
const jsEnd = '// END GENERATED SHARED MODE SHELL';
const formatted = await format(
  `${jsBegin}\n// Canonical source sha256: ${hash}\nconst sharedModeShell = (() => {\n${projected}\nreturn {${exports.join(',')}};\n})();\nexport const mountSimPlayShell = sharedModeShell.mountModePlayShell;\n${jsEnd}\n`,
  { ...(await resolveConfig(path.join(root, 'game/ui/mode-play-shell.mjs'))), parser: 'babel' },
);
const generated = projectEditionModuleIndentation(
  'flight-fullscreen.mjs',
  Buffer.from(formatted),
).toString();
async function replace(file, begin, end, body) {
  const old = await read(file);
  const first = old.indexOf(begin),
    last = old.indexOf(end);
  const next =
    first >= 0 && last >= first
      ? old.slice(0, first) + body.trimEnd() + old.slice(last + end.length)
      : old.trimEnd() + '\n\n' + body.trimEnd() + '\n';
  if (check && next !== old) throw new Error(`Shared shell projection differs: ${file}`);
  if (!check) await writeFile(path.join(root, file), next);
}
await replace('optional-practice/civilian-fpv/flight-fullscreen.mjs', jsBegin, jsEnd, generated);
const css = await read('game/ui/mode-play-shell.css');
if (/@import|url\(/.test(css)) throw new Error('Shared shell CSS must remain resource-free.');
const cssBegin = '/* BEGIN SHARED MODE SHELL */',
  cssEnd = '/* END SHARED MODE SHELL */';
await replace(
  'optional-practice/civilian-fpv/flight-fullscreen.css',
  cssBegin,
  cssEnd,
  `${cssBegin}\n${css.trim()}\n${cssEnd}`,
);
console.log(
  JSON.stringify({
    status: check ? 'verified-byte-identical' : 'refreshed',
    sourceSha256: hash,
    bytes: Buffer.byteLength(generated),
    packageSlotsAdded: 0,
  }),
);
