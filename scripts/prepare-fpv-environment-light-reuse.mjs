#!/usr/bin/env node
// Freeze a bounded real-WebGL comparison. Identical files are hardlinked, never recopied.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { acceptanceDependencies } from './prepare-sim-appearance-acceptance.mjs';
const root = fileURLToPath(new URL('../', import.meta.url)),
  [baseline, candidate, out] = process.argv.slice(2),
  hash = (value) => createHash('sha256').update(value).digest('hex');
if (
  ![baseline, candidate].every((s) => /^[a-f0-9]{40}$/.test(s ?? '')) ||
  !out?.startsWith('/tmp/fpv-environment-light-')
)
  throw Error(
    'Usage: node scripts/prepare-fpv-environment-light-reuse.mjs BASELINE_SHA CANDIDATE_SHA /tmp/fpv-environment-light-NAME',
  );
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 8 * 1024 * 1024 }),
  manifest = {
    format: 'fpv-environment-light-browser-fixture.v1',
    baseline,
    candidate,
    variants: {},
    harness: {},
  },
  written = new Map();
await fs.mkdir(out, { recursive: false });
let uniqueBytes = 0;
for (const [variant, revision] of Object.entries({ baseline, candidate })) {
  const pending = [
      'optional-practice/civilian-fpv/world-assets.mjs',
      'optional-practice/civilian-fpv/world-catalogue.mjs',
      'optional-practice/civilian-fpv/world-model.mjs',
    ],
    files = {};
  while (pending.length) {
    const name = pending.pop();
    if (files[name]) continue;
    const bytes = git('show', revision + ':' + name),
      sha256 = hash(bytes);
    if (
      Object.keys(files).length >= 96 ||
      bytes.length > 8 * 1024 * 1024 ||
      uniqueBytes > 32 * 1024 * 1024
    )
      throw Error('Fixture exceeded bounded closure');
    const target = path.join(out, variant, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    if (written.has(sha256)) await fs.link(written.get(sha256), target);
    else {
      await fs.writeFile(target, bytes, { flag: 'wx' });
      written.set(sha256, target);
      uniqueBytes += bytes.length;
    }
    files[name] = { bytes: bytes.length, sha256 };
    if (/\.m?js$/.test(name)) pending.push(...acceptanceDependencies(name, bytes));
  }
  manifest.variants[variant] = {
    revision,
    tree: git('rev-parse', revision + '^{tree}')
      .toString()
      .trim(),
    files,
  };
}
for (const [name, source] of [
  ['index.html', 'fpv-environment-light-reuse-browser.html'],
  ['runner.html', 'fpv-environment-light-reuse-runner.html'],
]) {
  const bytes = await fs.readFile(path.join(root, 'docs/evidence', source));
  manifest.harness[name] = { bytes: bytes.length, sha256: hash(bytes) };
  await fs.writeFile(path.join(out, name), bytes, { flag: 'wx' });
}
for (const variant of ['baseline', 'candidate'])
  await fs.link(path.join(out, 'runner.html'), path.join(out, variant, 'runner.html'));
manifest.uniqueSourceBytes = uniqueBytes;
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify(
    {
      out,
      baseline,
      candidate,
      uniqueBytes,
      files: Object.fromEntries(
        Object.entries(manifest.variants).map(([v, r]) => [v, Object.keys(r.files).length]),
      ),
    },
    null,
    2,
  ),
);
