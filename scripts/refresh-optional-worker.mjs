/** Keep readable worker source separate from its admitted lexical projection. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { format, resolveConfig } from 'prettier';
import { projectEditionModuleIndentation } from './edition-code-indentation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)),
  source = 'optional-practice/worker-source.mjs',
  target = 'optional-practice/worker-template.mjs',
  check = process.argv.includes('--check');
if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('Use [--check].');
const bytes = await fs.readFile(path.join(root, source)),
  formatted = await format(bytes.toString('utf8'), {
    ...(await resolveConfig(path.join(root, source))),
    parser: 'babel',
  }),
  tree = parse(formatted, { sourceType: 'module', ecmaVersion: 'latest' });
if (
  tree.body.length !== 1 ||
  tree.body[0].type !== 'ExportNamedDeclaration' ||
  tree.body[0].declaration?.type !== 'FunctionDeclaration' ||
  tree.body[0].declaration.id.name !== 'installPracticeWorker'
)
  throw new Error('The generated worker must remain one self-contained installer.');
function inspect(node) {
  if (!node || typeof node !== 'object') return;
  if (['ImportDeclaration', 'ImportExpression', 'MetaProperty'].includes(node.type))
    throw new Error('The serialized worker cannot import external code.');
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(inspect);
    else if (value && typeof value === 'object') inspect(value);
  }
}
inspect(tree);
const generated = projectEditionModuleIndentation(target, Buffer.from(formatted));
if (check) {
  if (!generated.equals(await fs.readFile(path.join(root, target))))
    throw new Error('Optional worker projection differs. Run refresh-optional-worker.mjs.');
} else await fs.writeFile(path.join(root, target), generated);
console.log(
  JSON.stringify({
    status: check ? 'verified-byte-identical' : 'refreshed',
    source,
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: generated.length,
    packageSlotsAdded: 0,
  }),
);
