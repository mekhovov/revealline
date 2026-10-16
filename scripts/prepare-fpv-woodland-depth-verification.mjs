import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const baseline = '3d04f9ab04980a8c51d3c28512ace7e024ebae51';
const out = new URL('../dist/fpv-woodland-depth-verification/', import.meta.url);
await mkdir(out, { recursive: true });
for (const [source, target] of [
  ['world-visuals.mjs', 'before.mjs'],
  ['world-assets.mjs', 'before-assets.mjs'],
]) {
  const text = execFileSync(
    'git',
    ['show', `${baseline}:optional-practice/civilian-fpv/${source}`],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  ).replace(/(from\s+['"])\.\//g, '$1/optional-practice/civilian-fpv/');
  await writeFile(new URL(target, out), text);
}
console.log('Open docs/evidence/fpv-woodland-depth-harness.html through the local server.');
