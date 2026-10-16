#!/usr/bin/env node
/** Prepare immutable, bounded browser evidence inputs; never fetch or change Git state. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
let ROOT = fileURLToPath(new URL('../', import.meta.url));
const DEFAULT_BASELINE = 'cf0b62e53d352c620f1793a3539c251e8932674b';
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
  let output = 'dist/fpv-flight-presentation-verification',
    candidate = '',
    candidateRevision = null,
    baseline = DEFAULT_BASELINE,
    verifyOnly = false;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) output = args[++i];
    else if (args[i] === '--candidate-base' && args[i + 1]) candidate = args[++i];
    else if (args[i] === '--candidate-ref' && args[i + 1]) candidateRevision = args[++i];
    else if (args[i] === '--source-root' && args[i + 1]) ROOT = path.resolve(args[++i]);
    else if (args[i] === '--baseline' && args[i + 1]) baseline = args[++i];
    else if (args[i] === '--verify-only') verifyOnly = true;
    else if (args[i] === '--help') {
      console.log(
        'Usage: node scripts/prepare-fpv-flight-presentation-verification.mjs [--out dist/fpv-flight-presentation-verification-NAME] [--candidate-base dist/PACKAGE | --candidate-ref LOCAL_REVISION] [--baseline LOCAL_REVISION] [--source-root CHECKOUT] [--verify-only]\nDefault baseline ' +
          DEFAULT_BASELINE +
          '. Copies current candidate and import closure into unique URLs. Existing outputs never overwritten; no fetching or Git writes.',
      );
      return;
    } else fail('Unknown/incomplete option: ' + args[i]);
  }
  const resolveRevision = (name) => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,159}$/.test(name))
      fail('Use a bounded local Git revision.');
    const result = spawnSync(
      'git',
      ['rev-parse', '--verify', '--end-of-options', name + '^{commit}'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 10000,
      },
    );
    if (result.status !== 0 || !/^[0-9a-f]{40}$/.test(result.stdout.trim()))
      fail('Revision must resolve to a local commit; no fetch performed.');
    return result.stdout.trim();
  };
  const BASELINE = resolveRevision(baseline);
  if (candidate && candidateRevision) fail('Choose either --candidate-base or --candidate-ref.');
  if (candidateRevision) candidateRevision = resolveRevision(candidateRevision);
  if (!/^dist\/fpv-flight-presentation-verification(?:-[a-z0-9-]{1,64})?$/.test(output))
    fail('Use a named dist/fpv-flight-presentation-verification directory.');
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
      if (side === 'before' || candidateRevision) {
        const revision = side === 'before' ? BASELINE : candidateRevision;
        const result = spawnSync('git', ['--no-pager', 'show', revision + ':' + relative], {
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
    new URL('../docs/evidence/fpv-flight-presentation-browser-harness.html', import.meta.url),
  );
  const manifest = {
    format: 'FPVFlightPresentationFixture.v1',
    baseline: BASELINE,
    candidate: candidateRevision ? 'git:' + candidateRevision : candidate || '.',
    changedSupportingFiles: Object.keys(hashes.after).filter(
      (relative) =>
        !['world-visuals.mjs', 'renderer.mjs'].some((name) => relative === ENTRY + name) &&
        hashes.after[relative] !== hashes.before[relative],
    ),
    files: hashes,
    harnessSha256: sha(html),
    scope:
      'Frozen unmodified production renderers and model factories; actual built-in GLB loading, close-up drone and near-field Container Yard views, other-world geometry/material comparison, bounded resource cycling. Static camera fixtures; no physical-device, sustained FPS or flight acceptance qualification.',
  };
  for (const [relative, expected] of candidateRevision ? [] : Object.entries(hashes.after)) {
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
      url: 'http://127.0.0.1:8789/' + output + '/index.html',
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
