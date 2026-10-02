#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const local = (name) =>
  /^(?:authoring|optional-practice|game)\/[A-Za-z0-9_./-]+$/.test(name) &&
  !name.split('/').includes('..');
/** Closed local import/stylesheet graph. This does not bundle the game or copy media libraries. */
export function acceptanceDependencies(name, bytes) {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    references = [];
  if (/\.m?js$/.test(name)) {
    const pending = [parse(source, { ecmaVersion: 'latest', sourceType: 'module' })];
    while (pending.length) {
      const node = pending.pop();
      if (!node || typeof node !== 'object') continue;
      if (node.type === 'ImportExpression' && node.source.type !== 'Literal')
        throw new Error('Unsupported computed fixture import. Use a literal local dependency.');
      const value = [
        'ImportDeclaration',
        'ExportNamedDeclaration',
        'ExportAllDeclaration',
      ].includes(node.type)
        ? node.source?.value
        : node.type === 'ImportExpression' && node.source.type === 'Literal'
          ? node.source.value
          : null;
      if (typeof value === 'string') references.push(value);
      for (const child of Object.values(node))
        if (Array.isArray(child)) pending.push(...child);
        else if (child && typeof child === 'object') pending.push(child);
    }
  } else if (name.endsWith('.html')) {
    for (const match of source.matchAll(
      /<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/g,
    ))
      references.push(match[1]);
  } else if (name.endsWith('.css')) {
    for (const match of source.matchAll(/@import\s+([^;]+);/g)) {
      const quoted = match[1].match(/^["']([^"']+)["']/);
      if (quoted) references.push(quoted[1]);
      else if (!/^url\(/.test(match[1])) throw new Error('Unsupported fixture stylesheet import.');
    }
    for (const match of source.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g))
      if (!match[1].startsWith('data:')) references.push(match[1]);
  }
  return [
    ...new Set(
      references.map((specifier) => {
        if (!specifier.startsWith('.') || /[?#]/.test(specifier))
          throw new Error(`Unsupported fixture dependency: ${specifier}`);
        const result = path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier));
        if (!local(result)) throw new Error(`Fixture dependency escapes local source: ${result}`);
        return result;
      }),
    ),
  ];
}
export async function prepareAcceptance({
  name = 'current',
  verifyOnly = false,
  sourceRoot = root,
} = {}) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name))
    throw new TypeError('Use a short lowercase snapshot name.');
  const realRoot = await fs.realpath(sourceRoot),
    files = new Map(),
    pending = ['authoring/fpv-worlds/acceptance.html'];
  let total = 0;
  while (pending.length) {
    const name = pending.pop();
    if (files.has(name)) continue;
    if (!local(name) || files.size >= 128)
      throw new Error('Acceptance dependency count/path exceeds its bound.');
    const target = await fs.realpath(path.join(realRoot, name));
    if (!target.startsWith(realRoot + path.sep))
      throw new Error('Acceptance source symlink escapes repository.');
    if ((await fs.stat(target)).size > 6 * 1024 * 1024)
      throw new Error('Acceptance source file exceeds 6 MiB.');
    const bytes = await fs.readFile(target);
    total += bytes.length;
    if (total > 32 * 1024 * 1024) throw new Error('Acceptance source exceeds 32 MiB.');
    files.set(name, bytes);
    if (/\.(?:m?js|html|css)$/.test(name)) pending.push(...acceptanceDependencies(name, bytes));
  }
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: realRoot,
    encoding: 'utf8',
  }).trim();
  const dirty =
    execFileSync('git', ['status', '--porcelain', '--', ...files.keys()], {
      cwd: realRoot,
      encoding: 'utf8',
    }).trim().length > 0;
  const manifest = {
    format: 'SIMAppearanceSource.v1',
    revision,
    includesWorkingTreeChanges: dirty,
    files: [...files]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha(bytes) })),
    note: 'Immutable source snapshot for authoring-only browser checks. Original files, physics and installed packages are unchanged.',
  };
  if (verifyOnly) return { verified: true, files: files.size, bytes: total, writes: 0, revision };
  const dist = path.join(realRoot, 'dist');
  await fs.mkdir(dist, { recursive: true });
  if ((await fs.lstat(dist)).isSymbolicLink()) throw new Error('dist must not be a symlink.');
  const destination = path.join(dist, `sim-appearance-acceptance-${name}`);
  await fs.mkdir(destination, { recursive: false });
  for (const [name, bytes] of files) {
    const target = path.join(destination, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { flag: 'wx' });
  }
  const manifestBytes = JSON.stringify(manifest, null, 2) + '\n';
  await fs.writeFile(path.join(destination, 'source-manifest.json'), manifestBytes, { flag: 'wx' });
  return {
    prepared: true,
    files: files.size,
    bytes: total,
    revision,
    sourceSha256: sha(manifestBytes),
    entry: `dist/sim-appearance-acceptance-${name}/authoring/fpv-worlds/acceptance.html`,
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    let name = 'current',
      verifyOnly = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--name' && args[i + 1]) name = args[++i];
      else if (args[i] === '--verify-only') verifyOnly = true;
      else
        throw new Error(
          'Usage: node scripts/prepare-sim-appearance-acceptance.mjs [--name UNIQUE-NAME] [--verify-only]',
        );
    }
    console.log(JSON.stringify(await prepareAcceptance({ name, verifyOnly }), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
