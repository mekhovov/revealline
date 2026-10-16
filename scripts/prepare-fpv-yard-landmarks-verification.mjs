import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const baseline = 'b43b0ce12d97475a2fbdc9e43b9a53af5d6ff9a0';
const out = new URL('../dist/fpv-yard-landmarks-verification/', import.meta.url);
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
console.log('Open docs/evidence/fpv-yard-landmarks-harness.html through the local server.');
