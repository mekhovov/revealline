#!/usr/bin/env node
/** Run a deterministic subset of the Node test suite on an isolated CI runner. */
import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
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
  const usage =
    'Usage: run-test-shard.mjs --shard INDEX/TOTAL [--root PATH] [--timings FILE] [--list]';
  if (![2, 4, 6].includes(values.length) || values[0] !== '--shard') throw new Error(usage);
  const options = new Map();
  for (let offset = 2; offset < values.length; offset += 2) {
    const option = values[offset];
    if (!['--root', '--timings'].includes(option) || !values[offset + 1] || options.has(option))
      throw new Error(usage);
    options.set(option, values[offset + 1]);
  }
  const match = /^(\d+)\/(\d+)$/.exec(values[1] ?? '');
  if (!match) throw new Error('Shard must be INDEX/TOTAL.');
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(total) || index < 1 || index > total)
    throw new Error('Shard index must be between 1 and TOTAL.');
  return {
    index,
    total,
    list,
    root: path.resolve(options.get('--root') ?? defaultRoot),
    timings: options.has('--timings') ? path.resolve(options.get('--timings')) : null,
  };
}

async function timedPartition(files, total, filename) {
  // Timing data is only a scheduling hint. It never supplies the test inventory,
  // skips a test, reuses a passing verdict, or changes the selected source root.
  if (!(await fs.lstat(filename)).isFile())
    throw new Error('Timing manifest must be a regular file.');
  // Recheck after open, without blocking if the path was replaced with a FIFO
  // or following a replacement symlink between the two operations.
  const handle = await fs.open(
    filename,
    constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW,
  );
  let bytes;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 5 * 1024 * 1024)
      throw new Error('Timing manifest must be a regular file no larger than 5 MiB.');
    const buffer = Buffer.alloc(stat.size + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset !== stat.size) throw new Error('Timing manifest changed while being read.');
    bytes = buffer.subarray(0, offset);
  } finally {
    await handle.close();
  }
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (
    manifest?.schemaVersion !== 1 ||
    typeof manifest.sourceRevision !== 'string' ||
    !/^[a-f0-9]{40}$/.test(manifest.sourceRevision ?? '') ||
    typeof manifest.nodeVersion !== 'string' ||
    !/^v?\d+\.\d+\.\d+$/.test(manifest.nodeVersion) ||
    !manifest.durationsMs ||
    typeof manifest.durationsMs !== 'object' ||
    Array.isArray(manifest.durationsMs)
  )
    throw new Error('Invalid timing manifest identity or durationsMs.');
  const durations = new Map(Object.entries(manifest.durationsMs));
  if (!durations.size) throw new Error('Timing manifest must contain measured file durations.');
  for (const [name, duration] of durations) {
    if (
      !directories.some((directory) => name.startsWith(`${directory}/`)) ||
      name.split('/').some((segment) => !segment || segment === '.' || segment === '..') ||
      name.includes('\\') ||
      !isTest(name) ||
      typeof duration !== 'number' ||
      !Number.isFinite(duration) ||
      duration <= 0
    )
      throw new Error(`Invalid measured test duration: ${name}`);
  }
  // Ignore removed files; use the median observed duration for new/unmeasured
  // files. Every discovered file is still assigned, even with an old profile.
  const observed = files
    .filter((file) => durations.has(file))
    .map((file) => durations.get(file))
    .sort((a, b) => a - b);
  if (!observed.length) throw new Error('Timing manifest has no files in the selected source.');
  const fallback = observed[Math.floor(observed.length / 2)];
  const durationOf = (file) => durations.get(file) ?? fallback;
  const lexical = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const ordered = [...files].sort((a, b) => durationOf(b) - durationOf(a) || lexical(a, b));
  const bins = Array.from({ length: Math.min(total, files.length) }, () => ({
    files: [],
    load: 0,
  }));
  for (const file of ordered) {
    const target = bins.reduce((best, bin) =>
      bin.load < best.load || (bin.load === best.load && bin.files.length < best.files.length)
        ? bin
        : best,
    );
    target.files.push(file);
    target.load += durationOf(file);
    if (!Number.isFinite(target.load)) throw new Error('Timing manifest total duration overflow.');
  }
  const assigned = bins.flatMap((bin) => bin.files);
  if (assigned.length !== files.length || new Set(assigned).size !== files.length)
    throw new Error('Timing partition must include every discovered test exactly once.');
  return bins.map((bin) => bin.files);
}

const { index, total, list, root, timings } = argumentsFor(process.argv.slice(2));
if (!(await fs.stat(root)).isDirectory()) throw new Error('Test root must be a directory.');
const files = (await Promise.all(directories.map((directory) => collect(directory)))).flat().sort();
const selected = timings
  ? ((await timedPartition(files, total, timings))[index - 1] ?? [])
  : files.filter((_, fileIndex) => fileIndex % total === index - 1);
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
