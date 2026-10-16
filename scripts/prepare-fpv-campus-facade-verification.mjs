#!/usr/bin/env node
/** Prepare immutable, bounded browser evidence inputs; never fetch or change Git state. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DEFAULT_BASELINE = '287eec95c81687fb8a6d176f750f7c65a60e1fe3';
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
  let output = 'dist/fpv-campus-facade-verification',
    baseline = DEFAULT_BASELINE,
    candidate = '',
    reuseFrozen = '',
    verifyOnly = false;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) output = args[++i];
    else if (args[i] === '--baseline' && /^[a-f0-9]{40}$/.test(args[i + 1] ?? ''))
      baseline = args[++i];
    else if (args[i] === '--candidate-base' && args[i + 1]) candidate = args[++i];
    else if (args[i] === '--reuse-frozen' && args[i + 1]) reuseFrozen = args[++i];
    else if (args[i] === '--verify-only') verifyOnly = true;
    else if (args[i] === '--help') {
      console.log(
        'Usage: node scripts/prepare-fpv-campus-facade-verification.mjs [--out dist/fpv-campus-facade-verification-NAME] [--candidate-base dist/PACKAGE] [--baseline LOCAL_40_HEX_SHA] [--reuse-frozen dist/fpv-campus-facade-verification-NAME] [--verify-only]\nDefaults to baseline ' +
          DEFAULT_BASELINE +
          '. Copies current candidate and import closure into unique URLs. Existing outputs never overwritten; no fetching or Git writes.',
      );
      return;
    } else fail('Unknown/incomplete option: ' + args[i]);
  }
  if (!/^dist\/fpv-campus-facade-verification(?:-[a-z0-9-]{1,64})?$/.test(output))
    fail('Use a named dist/fpv-campus-facade-verification directory.');
  if (candidate && !/^dist\/[a-zA-Z0-9_/-]+$/.test(candidate))
    fail('Candidate must be a prepared directory under dist.');
  if (reuseFrozen && !/^dist\/fpv-campus-facade-verification-[a-z0-9-]{1,64}$/.test(reuseFrozen))
    fail('Reuse requires an existing immutable Campus fixture.');
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
        const result = spawnSync('git', ['--no-pager', 'show', baseline + ':' + relative], {
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
  const html = await fs.readFile(path.join(ROOT, 'docs/evidence/fpv-campus-facade-harness.html'));
  const manifest = {
    format: 'FPVCampusFacadeFixture.v1',
    baseline,
    candidate: candidate || '.',
    files: hashes,
    harnessSha256: sha(html),
    scope:
      'Frozen actual Campus procedural renderer; five courses, authored Pixel facade increment, strict shared/non-Pixel boundaries, existing closed geometry/roofs/skybridge. Frozen manual matrix inputs, not a qualification result, flight proof or hardware measurement.',
  };
  for (const [relative, expected] of Object.entries(hashes.after)) {
    if (sha(await fs.readFile(path.join(candidateRoot, relative))) !== expected)
      fail('Candidate changed during fixture preparation: ' + relative);
  }
  const reusable = new Map(),
    storage = { hardlinkedFiles: 0, writtenFiles: 0, hardlinkedBytes: 0, writtenBytes: 0 };
  if (reuseFrozen) {
    const referenceRoot = path.join(ROOT, reuseFrozen);
    if ((await fs.realpath(referenceRoot)) !== referenceRoot)
      fail('Reuse fixture must not be a symlink.');
    const reference = JSON.parse(
      await fs.readFile(path.join(referenceRoot, 'fixture-manifest.json')),
    );
    if (reference.format !== 'FPVCampusFacadeFixture.v1') fail('Unknown reuse fixture.');
    for (const side of ['before', 'after'])
      for (const [relative, expected] of Object.entries(reference.files[side])) {
        if (!trees.before.has(relative) && !trees.after.has(relative)) continue;
        const file = path.join(referenceRoot, side, relative),
          resolved = await fs.realpath(file);
        if (!resolved.startsWith(referenceRoot + path.sep))
          fail('Reuse file leaves frozen fixture.');
        const stat = await fs.stat(file);
        if (stat.size > MAX_FILE) fail('Reuse file exceeds bound.');
        const bytes = await fs.readFile(file);
        if (sha(bytes) !== expected) fail('Reuse fixture hash mismatch: ' + relative);
        for (const inputRoot of [ROOT, candidateRoot]) {
          const input = await fs.stat(path.join(inputRoot, relative));
          if (input.dev === stat.dev && input.ino === stat.ino)
            fail('Reuse file aliases mutable candidate/source input: ' + relative);
        }
        reusable.set(expected, { file, bytes });
      }
  }
  if (verifyOnly) {
    console.log(
      JSON.stringify({
        verified: true,
        writes: 0,
        baseline,
        modules: Object.fromEntries(Object.entries(trees).map(([s, t]) => [s, t.size])),
        bytes: total,
        reusableHashes: reusable.size,
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
      const existing = reusable.get(sha(bytes));
      if (existing && existing.bytes.equals(bytes)) {
        await fs.link(existing.file, file);
        storage.hardlinkedFiles++;
        storage.hardlinkedBytes += bytes.length;
      } else {
        await fs.writeFile(file, bytes, { flag: 'wx' });
        storage.writtenFiles++;
        storage.writtenBytes += bytes.length;
      }
      if (!(await fs.readFile(file)).equals(bytes)) fail('Frozen output differs: ' + relative);
    }
  manifest.storage = storage;
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
      storage,
      note: 'Run through approved browser UI. Preparation alone is not visual verification.',
    }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
