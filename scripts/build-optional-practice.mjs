import path from 'node:path';
import { readFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { parse as parseHTML } from 'parse5';
import { createZip, offlineIcons } from './game-cli.mjs';
import { installPracticeWorker } from '../optional-practice/civilian-flight/worker-template.mjs';

export const OPTIONAL_PRACTICE_ROOT = 'optional-practice/civilian-flight/';
export const OPTIONAL_PRACTICE_LIMITS = Object.freeze({ files: 64, bytes: 8 * 1024 * 1024 });
const shared = new Set([
  'game/data-json.mjs',
  'game/key-bindings.mjs',
  'game/i18n/index.mjs',
  'game/i18n/bootstrap.mjs',
  'game/i18n/catalogs.mjs',
  'game/vendor/i18next-26.4.2.min.js',
  'game/vendor/I18NEXT-LICENSE.txt',
]);
const optionalFiles = [
  'index.html',
  'app.mjs',
  'model.mjs',
  'input.mjs',
  'catalogue.mjs',
  'copy.mjs',
  'offline.mjs',
  'style.css',
  'app.webmanifest',
  'README.md',
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const requireValid = (condition, message) => {
  if (!condition) throw new Error(message);
};
async function ordinary(root, name) {
  let target = root;
  for (const part of name.split('/')) {
    target = path.join(target, part);
    requireValid(
      !(await lstat(target)).isSymbolicLink(),
      'Optional practice rejects symlink dependencies',
    );
  }
  const stat = await lstat(target);
  requireValid(
    stat.isFile() && stat.size <= OPTIONAL_PRACTICE_LIMITS.bytes,
    'Optional practice dependency exceeds byte limit',
  );
  const bytes = await readFile(target);
  requireValid(
    bytes.length <= OPTIONAL_PRACTICE_LIMITS.bytes,
    'Optional practice dependency grew during reading',
  );
  return bytes;
}
function resourceReferences(name, bytes) {
  const references = [];
  if (name.endsWith('.webmanifest'))
    references.push(...(JSON.parse(bytes.toString('utf8')).icons ?? []).map((icon) => icon.src));
  if (name.endsWith('.html')) {
    const visit = (node) => {
      for (const attribute of node.attrs ?? [])
        if (['src', 'href'].includes(attribute.name)) references.push(attribute.value);
      for (const child of node.childNodes ?? []) visit(child);
    };
    visit(parseHTML(bytes.toString('utf8')));
  }
  if (name.endsWith('.css'))
    for (const match of bytes.toString('utf8').matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g))
      references.push(match[1]);
  return references
    .filter((reference) => !reference.startsWith('#'))
    .map((reference) => {
      requireValid(
        !/^(?:[a-z]+:|\/)/i.test(reference) && !/[?#\\]/.test(reference),
        'Optional practice resource references must be explicit local files',
      );
      return path.posix.normalize(path.posix.join(path.posix.dirname(name), reference));
    });
}
function staticImports(name, bytes) {
  if (!/\.(mjs|js)$/.test(name)) return [];
  const result = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'CallExpression' &&
      (node.callee?.name === 'fetch' || node.callee?.property?.name === 'fetch')
    )
      throw new Error(
        'Optional practice network requests belong only to its generated verified worker',
      );
    if (
      [
        'ImportDeclaration',
        'ExportNamedDeclaration',
        'ExportAllDeclaration',
        'ImportExpression',
      ].includes(node.type) &&
      node.source
    ) {
      requireValid(
        typeof node.source.value === 'string' && /^\.\.?\//.test(node.source.value),
        'Optional practice permits only explicit relative module dependencies',
      );
      result.push(
        path.posix.normalize(path.posix.join(path.posix.dirname(name), node.source.value)),
      );
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(parse(bytes.toString('utf8'), { sourceType: 'module', ecmaVersion: 'latest' }));
  return result;
}
function workerSource(files, revision) {
  const pins = files.map((file) => ({
    ...file,
    path: path.posix.relative(OPTIONAL_PRACTICE_ROOT, file.path),
  }));
  return `// Generated exact optional-package cache.\n(${installPracticeWorker.toString()})(self, ${JSON.stringify(pins)}, ${JSON.stringify(revision)});\n`;
}

/** Separate opt-in archive. Nothing is added to default build/core inventories.
 * Explicit shared-module admission prevents pulling an edition or authoring tree
 * into this package merely because a source file acquired another import. */
export async function buildOptionalPractice(root, { engineCommit = null, engineTree = null } = {}) {
  requireValid(
    (engineCommit === null && engineTree === null) ||
      (/^[a-f0-9]{40}$/.test(engineCommit) && /^[a-f0-9]{40}$/.test(engineTree)),
    'Frozen optional packages require exact commit and tree together',
  );
  const entries = new Map();
  const generatedIcons = new Map(
    offlineIcons([192, 512])
      .filter((entry) => entry.name.endsWith('.png'))
      .map((entry) => [OPTIONAL_PRACTICE_ROOT + entry.name, entry.bytes]),
  );
  const allowed = new Set([
    ...optionalFiles.map((name) => OPTIONAL_PRACTICE_ROOT + name),
    ...shared,
    ...generatedIcons.keys(),
  ]);
  const pending = [...allowed];
  while (pending.length) {
    const name = pending.shift();
    if (entries.has(name)) continue;
    requireValid(allowed.has(name), `Optional practice dependency is not admitted: ${name}`);
    let bytes;
    if (name === 'game/i18n/catalogs.mjs') {
      const locales = {};
      for (const locale of ['en', 'uk']) {
        const errors = JSON.parse(await ordinary(root, `game/locales/${locale}/errors.json`));
        locales[locale] = {
          errors: Object.fromEntries(
            Object.entries(errors).filter(([key]) => key.startsWith('dataJson.')),
          ),
        };
      }
      bytes = Buffer.from(
        `// Selected optional-practice validator messages only.\nglobalThis.RevealLineTranslations=${JSON.stringify(locales)};\n`,
      );
    } else bytes = generatedIcons.get(name) ?? (await ordinary(root, name));
    entries.set(name, bytes);
    pending.push(...staticImports(name, bytes));
    pending.push(...resourceReferences(name, bytes));
  }
  const files = [...entries]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) }));
  requireValid(
    files.length <= OPTIONAL_PRACTICE_LIMITS.files &&
      files.reduce((total, file) => total + file.bytes, 0) <= OPTIONAL_PRACTICE_LIMITS.bytes,
    'Optional practice exceeds unchanged package limits',
  );
  const workerTemplateSha256 = hash(Buffer.from(installPracticeWorker.toString()));
  const revision = hash(
    Buffer.from(JSON.stringify({ files, workerTemplateSha256, engineCommit, engineTree })),
  );
  entries.set(`${OPTIONAL_PRACTICE_ROOT}worker.js`, Buffer.from(workerSource(files, revision)));
  const manifest = {
    format: 'revealline-optional-practice-package.v1',
    id: 'civilian-flight',
    revision,
    classification: 'public',
    workerTemplateSha256,
    engineCommit,
    engineTree,
    qualification: engineCommit ? 'requires-release-qualification' : 'development-only',
    entry: `${OPTIONAL_PRACTICE_ROOT}index.html`,
    locales: ['en', 'uk'],
    core: false,
    limits: OPTIONAL_PRACTICE_LIMITS,
    files: [...entries]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) })),
  };
  entries.set('optional-package.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  const ordered = [...entries]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, bytes]) => ({ name, bytes }));
  requireValid(
    ordered.length <= OPTIONAL_PRACTICE_LIMITS.files &&
      ordered.reduce((total, file) => total + file.bytes.length, 0) <=
        OPTIONAL_PRACTICE_LIMITS.bytes,
    'Complete optional output exceeds package limits',
  );
  return { manifest, entries: ordered, zip: createZip(ordered) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [output, engineCommit = null, engineTree = null] = process.argv.slice(2);
  if (!output)
    throw new Error(
      'Usage: node scripts/build-optional-practice.mjs <new-output-directory> [engine-commit engine-tree]',
    );
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = await buildOptionalPractice(root, { engineCommit, engineTree });
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output, { recursive: false });
  for (const entry of result.entries) {
    const target = path.join(output, entry.name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, entry.bytes);
  }
  await writeFile(path.join(output, 'civilian-flight.zip'), result.zip);
  process.stdout.write(
    `Optional practice: ${result.entries.length} files, ${result.zip.length} archive bytes; ${result.manifest.qualification}.\n`,
  );
}
