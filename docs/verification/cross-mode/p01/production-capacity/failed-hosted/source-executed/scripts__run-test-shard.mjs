#!/usr/bin/env node
/** Run a deterministic subset of the Node test suite on an isolated CI runner. */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directories = [
  'scripts',
  'game',
  'authoring/motion-lab',
  'platforms/desktop/test',
  'platforms/ios/test',
];
const isTest = (file) => /(?:^|\/)(?:test-[^/]+|[^/]+\.test)\.mjs$/.test(file);

async function collect(directory, files = []) {
  const absolute = path.join(root, directory);
  let entries;
  try {
    entries = await fs.readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return files;
    throw error;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) await collect(relative, files);
    else if (entry.isFile() && isTest(relative)) files.push(relative);
  }
  return files;
}

function argumentsFor(argv) {
  const list = argv.at(-1) === '--list';
  const values = list ? argv.slice(0, -1) : argv;
  if (
    ![2, 4].includes(values.length) ||
    values[0] !== '--shard' ||
    (values.length === 4 && (values[2] !== '--root' || !values[3]))
  )
    throw new Error('Usage: run-test-shard.mjs --shard INDEX/TOTAL [--root PATH] [--list]');
  const match = /^(\d+)\/(\d+)$/.exec(values[1] ?? '');
  if (!match) throw new Error('Shard must be INDEX/TOTAL.');
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(total) || index < 1 || index > total)
    throw new Error('Shard index must be between 1 and TOTAL.');
  return { index, total, list, root: path.resolve(values[3] ?? defaultRoot) };
}

const { index, total, list, root } = argumentsFor(process.argv.slice(2));
if (!(await fs.stat(root)).isDirectory()) throw new Error('Test root must be a directory.');
const files = (await Promise.all(directories.map((directory) => collect(directory)))).flat().sort();
const selected = files.filter((_, fileIndex) => fileIndex % total === index - 1);
if (!selected.length) throw new Error(`Shard ${index}/${total} has no test files.`);
console.log(`Running ${selected.length}/${files.length} test files in shard ${index}/${total}.`);
if (list) {
  process.stdout.write(`${selected.join('\n')}\n`);
  process.exit(0);
}
const result = spawnSync(process.execPath, ['--test', ...selected], {
  cwd: root,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
