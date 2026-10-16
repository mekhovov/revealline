/** Keep readable world visuals separate from their admitted lexical projection. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { format, resolveConfig } from 'prettier';
import { projectEditionModuleIndentation } from './edition-code-indentation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)),
  source = 'optional-practice/civilian-fpv/world-visuals-source.mjs',
  target = 'optional-practice/civilian-fpv/world-visuals.mjs',
  check = process.argv.includes('--check');
if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('Use [--check].');
const bytes = await fs.readFile(path.join(root, source)),
  formatted = await format(bytes.toString('utf8'), {
    ...(await resolveConfig(path.join(root, source))),
    parser: 'babel',
  }),
  generated = projectEditionModuleIndentation(target, Buffer.from(formatted));
if (check) {
  if (!generated.equals(await fs.readFile(path.join(root, target))))
    throw new Error('World visuals projection differs. Run refresh-fpv-world-visuals.mjs.');
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
