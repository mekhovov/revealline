import { readFile, writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { DEMO_SHELL } from '../game/ui/demo-shell.mjs';

// Native entries mount this template directly. Solo retains pre-rendered markup
// for first paint and its existing accessibility fixtures, generated from it.
const target = new URL('../game/index.html', import.meta.url);
const before = await readFile(target, 'utf8');
const pattern = /    <dialog id="demo-dialog"[\s\S]*?    <\/dialog>\n/;
if (!pattern.test(before)) throw new Error('Solo demo shell not found.');
const after = await format(before.replace(pattern, DEMO_SHELL), {
  ...(await resolveConfig(target.pathname)),
  parser: 'html',
});
if (process.argv.includes('--check')) {
  if (before !== after) throw new Error('Run node scripts/refresh-demo-shell.mjs.');
} else await writeFile(target, after);
