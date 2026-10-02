#!/usr/bin/env node
/** Bind a manual WebGL qualification harness to the current local source closure. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const fail = (message) => {
  throw new Error(message);
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const entries = ['world-assets.mjs', 'world-catalogue.mjs', 'world-model.mjs', 'radio-profile.mjs'];
async function main() {
  let output = 'dist/fpv-adventures-verification';
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) output = args[++i];
    else if (args[i] === '--help') {
      console.log(
        'Usage: node scripts/prepare-fpv-adventures-verification.mjs [--out dist/fpv-adventures-verification-NAME]\nCreates a fresh ignored fixture bound to current source bytes. Open its page and click Run checks. No Git writes, source copying or browser qualification occurs here.',
      );
      return;
    } else fail(`Unknown or incomplete option: ${args[i]}`);
  }
  if (!/^dist\/fpv-adventures-verification(?:-[a-z0-9-]{1,64})?$/.test(output))
    fail('Choose the default fixture directory or a named sibling.');
  const files = {},
    pending = entries.map((name) => 'optional-practice/civilian-fpv/' + name);
  const imports = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/g;
  let total = 0;
  while (pending.length) {
    const relative = pending.shift();
    if (files[relative]) continue;
    if (relative.startsWith('../') || path.isAbsolute(relative))
      fail('Import escaped the repository.');
    const absolute = path.join(ROOT, relative),
      stat = await fs.lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 ** 2)
      fail(`Unsafe or oversized module: ${relative}`);
    const bytes = await fs.readFile(absolute);
    if ((total += bytes.length) > 32 * 1024 ** 2 || Object.keys(files).length >= 80)
      fail('Source closure exceeds fixture budget.');
    files[relative] = { sha256: digest(bytes), bytes: bytes.length };
    for (const match of bytes.toString('utf8').matchAll(imports)) {
      if (!match[1].startsWith('.')) continue;
      const dependency = path.posix.normalize(
        path.posix.join(path.posix.dirname(relative), match[1]),
      );
      if (!/\.(?:mjs|js)$/.test(dependency)) fail(`Unexpected non-module import: ${dependency}`);
      pending.push(dependency);
    }
  }
  for (const name of [
    'fpv-adventures-browser-harness.html',
    'fpv-adventures-browser-harness.mjs',
  ]) {
    const relative = 'docs/evidence/' + name,
      bytes = await fs.readFile(path.join(ROOT, relative));
    files[relative] = { sha256: digest(bytes), bytes: bytes.length };
  }
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  if (git.status !== 0) fail('Cannot read source HEAD.');
  const manifest = {
    format: 'fpv-adventures-source.v1',
    preparedAt: new Date().toISOString(),
    sourceHead: git.stdout.trim(),
    sourceState:
      'Explicit file hashes bind current working-tree bytes; HEAD alone is not a clean-tree claim.',
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
  };
  const dist = path.join(ROOT, 'dist'),
    stat = await fs.lstat(dist).catch((e) => (e.code === 'ENOENT' ? null : Promise.reject(e)));
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink()))
    fail('dist must be a real directory.');
  if (!stat) await fs.mkdir(dist);
  const destination = path.join(ROOT, output);
  if (await fs.lstat(destination).catch((e) => (e.code === 'ENOENT' ? null : Promise.reject(e))))
    fail(
      `Fixture exists: ${output}. Select a fresh --out suffix; retain active runs and receipts.`,
    );
  await fs.mkdir(destination);
  for (const [source, target] of [
    ['fpv-adventures-browser-harness.html', 'index.html'],
    ['fpv-adventures-browser-harness.mjs', 'fpv-adventures-browser-harness.mjs'],
  ])
    await fs.copyFile(
      path.join(ROOT, 'docs/evidence', source),
      path.join(destination, target),
      fs.constants.COPYFILE_EXCL,
    );
  await fs.writeFile(
    path.join(destination, 'source.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    { flag: 'wx' },
  );
  console.log(
    JSON.stringify({
      prepared: true,
      sourceHead: manifest.sourceHead,
      files: Object.keys(files).length,
      hashedBytes: total,
      copiedRuntimeBytes: 0,
      url: `http://127.0.0.1:8789/${output}/index.html`,
    }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
