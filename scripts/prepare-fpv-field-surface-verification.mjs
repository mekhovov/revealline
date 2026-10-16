import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const out = new URL('../dist/fpv-field-surface-verification/', import.meta.url);
await mkdir(out, { recursive: true });
const source = execFileSync(
  'git',
  [
    'show',
    'b43b0ce12d97475a2fbdc9e43b9a53af5d6ff9a0:optional-practice/civilian-fpv/world-visuals.mjs',
  ],
  { encoding: 'utf8', maxBuffer: 1024 * 1024 },
).replace(/(from\s+['"])\.\//g, '$1/optional-practice/civilian-fpv/');
await writeFile(new URL('before.mjs', out), source);
