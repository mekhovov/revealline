#!/usr/bin/env node
/** Prepare immutable, bounded browser evidence inputs; never fetch or change Git state. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BASELINE = 'cd2e6bc5dc0e8af7d1d30705632697cc97562dc1';
const ENTRY = 'optional-practice/civilian-fpv/';
const MAX_FILE = 6 * 1024 * 1024,
  MAX_TOTAL = 40 * 1024 * 1024,
  MAX_MODULES = 80;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => {
  throw Error(message);
};
function dependencies(source, owner) {
  const pending = [parse(source, { ecmaVersion: 'latest', sourceType: 'module' })],
    found = [];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== 'object') continue;
    let specifier;
    if (['ImportDeclaration', 'ExportAllDeclaration', 'ExportNamedDeclaration'].includes(node.type))
      specifier = node.source?.value;
    if (node.type === 'ImportExpression' && node.source.type === 'Literal')
      specifier = node.source.value;
    if (typeof specifier === 'string' && specifier.startsWith('.')) {
      const name = path.posix.normalize(path.posix.join(path.posix.dirname(owner), specifier));
      if (
        !/^(?:game|optional-practice)\/[a-zA-Z0-9_./-]+\.(?:mjs|js)$/.test(name) ||
        name.includes('..')
      )
        fail('Unsupported relative import: ' + name);
      found.push(name);
    }
    for (const value of Object.values(node))
      if (Array.isArray(value)) pending.push(...value);
      else if (value && typeof value === 'object') pending.push(value);
  }
  return found;
}
async function main() {
  let output = 'dist/fpv-coast-lighthouse-verification',
    candidate = '',
    verifyOnly = false;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) output = args[++i];
    else if (args[i] === '--candidate-base' && args[i + 1]) candidate = args[++i];
    else if (args[i] === '--verify-only') verifyOnly = true;
    else if (args[i] === '--help') {
      console.log(
        'Usage: node scripts/prepare-fpv-coast-lighthouse-verification.mjs [--out dist/fpv-coast-lighthouse-verification-NAME] [--candidate-base dist/PACKAGE] [--verify-only]\nPins baseline ' +
          BASELINE +
          '. Copies current candidate and import closure into unique URLs. Existing outputs never overwritten; no fetching or Git writes.',
      );
      return;
    } else fail('Unknown/incomplete option: ' + args[i]);
  }
  if (!/^dist\/fpv-coast-lighthouse-verification(?:-[a-z0-9-]{1,64})?$/.test(output))
    fail('Use a named dist/fpv-coast-lighthouse-verification directory.');
  if (candidate && !/^dist\/[a-zA-Z0-9_/-]+$/.test(candidate))
    fail('Candidate must be a prepared directory under dist.');
  const realRoot = await fs.realpath(ROOT),
    candidateRoot = await fs.realpath(path.join(ROOT, candidate));
  if (candidateRoot !== realRoot && !candidateRoot.startsWith(realRoot + path.sep))
    fail('Candidate leaves repository.');
  const trees = {},
    hashes = {};
  let total = 0;
  for (const side of ['before', 'after']) {
    const files = new Map(),
      pending = [
        'world-assets.mjs',
        'catalogue.mjs',
        'world-catalogue.mjs',
        'model.mjs',
        'world-model.mjs',
        'world-visuals.mjs',
      ].map((p) => ENTRY + p);
    while (pending.length) {
      const relative = pending.pop();
      if (files.has(relative)) continue;
      if (files.size >= MAX_MODULES) fail('Module bound exceeded.');
      let bytes;
      if (side === 'before') {
        const result = spawnSync('git', ['--no-pager', 'show', BASELINE + ':' + relative], {
          cwd: ROOT,
          encoding: null,
          maxBuffer: MAX_FILE,
          timeout: 10000,
        });
        if (result.status !== 0 || result.error)
          fail('Pinned local baseline unavailable: ' + relative + '; no fetch performed.');
        bytes = result.stdout;
      } else {
        const target = await fs.realpath(path.join(candidateRoot, relative));
        if (!target.startsWith(candidateRoot + path.sep))
          fail('Candidate symlink leaves selected root.');
        if ((await fs.stat(target)).size > MAX_FILE) fail('Source file exceeds bound.');
        bytes = await fs.readFile(target);
      }
      if (!bytes.length || bytes.length > MAX_FILE || (total += bytes.length) > MAX_TOTAL)
        fail('Fixture input size bound exceeded.');
      files.set(relative, bytes);
      pending.push(...dependencies(bytes.toString('utf8'), relative));
    }
    trees[side] = files;
    hashes[side] = Object.fromEntries([...files].map(([p, b]) => [p, sha(b)]));
  }
  const html = await fs.readFile(
    path.join(ROOT, 'docs/evidence/fpv-coast-lighthouse-harness.html'),
  );
  const manifest = {
    format: 'FPVCoastLighthouseFixture.v1',
    baseline: BASELINE,
    candidate: candidate || '.',
    files: hashes,
    harnessSha256: sha(html),
    scope:
      'Frozen source or packaged closures; actual procedural Coast renderer, five courses and one bounds, all presets, authored/Pixel/shared Themes, exact base geometry, closed lighthouse finish, actual imported Courtyard and fallback Quarry controls, bounded resource cycling. Static observations are not flight proofs or hardware-performance measurements.',
  };
  for (const [relative, expected] of Object.entries(hashes.after)) {
    if (sha(await fs.readFile(path.join(candidateRoot, relative))) !== expected)
      fail('Candidate changed during fixture preparation: ' + relative);
  }
  if (verifyOnly) {
    console.log(
      JSON.stringify({
        verified: true,
        writes: 0,
        baseline: BASELINE,
        modules: Object.fromEntries(Object.entries(trees).map(([s, t]) => [s, t.size])),
        bytes: total,
      }),
    );
    return;
  }
  const dist = path.join(ROOT, 'dist'),
    stat = await fs.lstat(dist).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
      return null;
    });
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink()))
    fail('dist must be a real directory.');
  if (!stat) await fs.mkdir(dist);
  const destination = path.join(ROOT, output);
  if (
    await fs.lstat(destination).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
      return null;
    })
  )
    fail('Preserve existing fixture; use a fresh --out.');
  await fs.mkdir(destination);
  for (const [side, files] of Object.entries(trees))
    for (const [relative, bytes] of files) {
      const file = path.join(destination, side, relative);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, bytes, { flag: 'wx' });
    }
  await fs.writeFile(path.join(destination, 'index.html'), html, { flag: 'wx' });
  await fs.writeFile(
    path.join(destination, 'fixture-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    { flag: 'wx' },
  );
  console.log(
    JSON.stringify({
      prepared: true,
      url: 'http://127.0.0.1:8834/' + output + '/index.html',
      modules: Object.fromEntries(Object.entries(trees).map(([s, t]) => [s, t.size])),
      bytes: total,
      note: 'Run through approved browser UI. Preparation alone is not visual verification.',
    }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
