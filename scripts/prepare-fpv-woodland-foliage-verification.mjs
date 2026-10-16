import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Only the changed module needs a baseline copy. Its unchanged dependencies are
// served from the same checkout; the harness compares original and batched trees.
const root = fileURLToPath(new URL('../', import.meta.url));
const baseline = 'a8c808a26447dcea17c82852cb07b24d3059d2cb';
const source = execFileSync(
  'git',
  ['show', `${baseline}:optional-practice/civilian-fpv/world-visuals.mjs`],
  { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 },
).replace(/(from\s+['"])\.\//g, '$1/optional-practice/civilian-fpv/');
const out = new URL('../dist/fpv-woodland-foliage-verification/', import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL('before.mjs', out), source);
console.log('Serve the checkout and open docs/evidence/fpv-woodland-foliage-harness.html');
