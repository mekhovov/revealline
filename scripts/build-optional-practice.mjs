import path from 'node:path';
import { readFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { parse as parseHTML } from 'parse5';
import { createZip, offlineIcons } from './game-cli.mjs';
import { installPracticeWorker } from '../optional-practice/civilian-flight/worker-template.mjs';
import { installPracticeWorker as installPackageWorker } from '../optional-practice/worker-template.mjs';

import { buildOptionalLauncher } from './optional-launcher.mjs';
import { OPTIONAL_PACKAGE_POLICIES } from '../publishing/optional-package-policy.mjs';
export const OPTIONAL_PRACTICE_ROOT = OPTIONAL_PACKAGE_POLICIES['civilian-flight'].root;
export const OPTIONAL_PRACTICE_LIMITS = OPTIONAL_PACKAGE_POLICIES['civilian-flight'].limits;
const workers = new Map([
  ['optional-practice/civilian-flight/worker-template.mjs', installPracticeWorker],
  ['optional-practice/worker-template.mjs', installPackageWorker],
]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const requireValid = (condition, message) => {
  if (!condition) throw new Error(message);
};
async function ordinary(root, name, limits) {
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
    stat.isFile() && stat.size <= limits.bytes,
    'Optional practice dependency exceeds byte limit',
  );
  const bytes = await readFile(target);
  requireValid(bytes.length <= limits.bytes, 'Optional practice dependency grew during reading');
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
function staticImports(name, bytes, verifiedVendor = false) {
  if (!/\.(mjs|js)$/.test(name)) return [];
  const result = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (
      !verifiedVendor &&
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
function workerSource(files, revision, packageRoot, installWorker) {
  const pins = files.map((file) => ({
    ...file,
    path: path.posix.relative(packageRoot, file.path),
  }));
  return `// Generated exact optional-package cache.\n(${installWorker.toString()})(self, ${JSON.stringify(pins)}, ${JSON.stringify(revision)});\n`;
}

/** Bind a separately installed package to the final bytes of a containing build.
 * Shared modules must not use the standalone archive's projected byte hashes. */
export function buildBundledOptionalPractice(entries, { packageId = 'civilian-fpv' } = {}) {
  const policy =
    typeof packageId === 'string' && Object.hasOwn(OPTIONAL_PACKAGE_POLICIES, packageId)
      ? OPTIONAL_PACKAGE_POLICIES[packageId]
      : null;
  requireValid(policy, 'Optional package is not admitted by policy');
  const emitted = new Map(entries.map((entry) => [entry.name, entry.bytes]));
  requireValid(emitted.size === entries.length, 'Duplicate emitted optional dependency path');
  if (!emitted.has(policy.entry)) return null;
  const installWorker = workers.get(policy.template),
    vendorPins = new Map((policy.vendorPins ?? []).map((pin) => [pin.path, pin])),
    icons = new Map(
      offlineIcons([192, 512])
        .filter((entry) => entry.name.endsWith('.png'))
        .map((entry) => [entry.name, entry.bytes]),
    );
  requireValid(installWorker, 'Optional package worker is not registered');
  const allowed = new Set([
      ...policy.localFiles.map((name) => policy.root + name),
      ...policy.sharedFiles,
      ...icons.keys(),
    ]),
    selected = new Map(),
    pending = [...allowed];
  while (pending.length) {
    const name = pending.shift();
    if (selected.has(name)) continue;
    requireValid(allowed.has(name), `Optional practice dependency is not admitted: ${name}`);
    const bytes = emitted.get(name) ?? icons.get(name),
      icon = icons.get(name),
      vendor = vendorPins.get(name);
    requireValid(
      Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= policy.limits.bytes,
      `Bundled optional dependency is missing or exceeds byte limit: ${name}`,
    );
    requireValid(!icon || bytes.equals(icon), `Bundled optional icon differs: ${name}`);
    requireValid(
      !vendor || (bytes.length === vendor.bytes && hash(bytes) === vendor.sha256),
      `Optional vendor bytes differ from the reviewed dependency: ${name}`,
    );
    selected.set(name, bytes);
    pending.push(...staticImports(name, bytes, !!vendor), ...resourceReferences(name, bytes));
  }
  const files = [...selected]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) })),
    workerTemplateSha256 = hash(Buffer.from(installWorker.toString())),
    revision = hash(Buffer.from(JSON.stringify({ files, workerTemplateSha256 }))),
    worker = {
      name: `${policy.root}worker.js`,
      bytes: Buffer.from(workerSource(files, revision, policy.root, installWorker)),
    };
  requireValid(!emitted.has(worker.name), 'Bundled optional worker must be generated once');
  requireValid(
    files.length + 1 <= policy.limits.files &&
      files.reduce((total, file) => total + file.bytes, worker.bytes.length) <= policy.limits.bytes,
    'Complete bundled optional output exceeds package limits',
  );
  return {
    files,
    revision,
    entries: [
      ...[...icons]
        .filter(([name]) => !emitted.has(name))
        .map(([name, bytes]) => ({ name, bytes })),
      worker,
    ],
  };
}

/** Separate opt-in archive. Nothing is added to default build/core inventories.
 * Explicit shared-module admission prevents pulling an edition or authoring tree
 * into this package merely because a source file acquired another import. */
export async function buildOptionalPractice(
  root,
  { engineCommit = null, engineTree = null, basePath = '/', packageId = 'civilian-flight' } = {},
) {
  const policy =
    typeof packageId === 'string' && Object.hasOwn(OPTIONAL_PACKAGE_POLICIES, packageId)
      ? OPTIONAL_PACKAGE_POLICIES[packageId]
      : null;
  requireValid(policy, 'Optional package is not admitted by policy');
  const { root: packageRoot, limits } = policy,
    installWorker = workers.get(policy.template),
    vendorPins = new Map((policy.vendorPins ?? []).map((pin) => [pin.path, pin]));
  requireValid(installWorker, 'Optional package worker is not registered');
  requireValid(
    (engineCommit === null && engineTree === null) ||
      (/^[a-f0-9]{40}$/.test(engineCommit) && /^[a-f0-9]{40}$/.test(engineTree)),
    'Frozen optional packages require exact commit and tree together',
  );
  const entries = new Map(),
    inputs = new Map();
  const readInput = async (name) => {
    const bytes = await ordinary(root, name, limits);
    inputs.set(name, bytes);
    return bytes;
  };
  const template = await readInput(policy.template);
  requireValid(
    template.equals(await readFile(new URL('../' + policy.template, import.meta.url))),
    'Optional worker template differs from the loaded builder',
  );
  const generatedIcons = new Map(
    offlineIcons([192, 512])
      .filter((entry) => entry.name.endsWith('.png'))
      .map((entry) => [packageRoot + entry.name, entry.bytes]),
  );
  const allowed = new Set([
    ...policy.localFiles.map((name) => packageRoot + name),
    ...policy.sharedFiles,
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
        const errors = JSON.parse(await readInput(`game/locales/${locale}/errors.json`));
        locales[locale] = {
          errors: Object.fromEntries(
            Object.entries(errors).filter(([key]) => key.startsWith('dataJson.')),
          ),
        };
        for (const [namespace, keys] of Object.entries(policy.localeKeys ?? {})) {
          const source = JSON.parse(await readInput(`game/locales/${locale}/${namespace}.json`));
          requireValid(
            keys.every((key) => typeof source[key] === 'string'),
            'Optional locale projection is incomplete',
          );
          locales[locale][namespace] = Object.fromEntries(keys.map((key) => [key, source[key]]));
        }
      }
      bytes = Buffer.from(
        `// Selected optional-practice validator messages only.\nglobalThis.RevealLineTranslations=${JSON.stringify(locales)};\n`,
      );
    } else bytes = generatedIcons.get(name) ?? (await readInput(name));
    const vendor = vendorPins.get(name);
    requireValid(
      !vendor || (bytes.length === vendor.bytes && hash(bytes) === vendor.sha256),
      `Optional vendor bytes differ from the reviewed dependency: ${name}`,
    );
    entries.set(name, bytes);
    pending.push(...staticImports(name, bytes, !!vendor));
    pending.push(...resourceReferences(name, bytes));
  }
  let installation;
  if (engineCommit) {
    const launcherTemplate = await readInput(policy.launcherTemplate);
    requireValid(
      launcherTemplate.equals(
        await readFile(new URL('../' + policy.launcherTemplate, import.meta.url)),
      ),
      'Optional launcher template differs from the loaded builder',
    );
    installation = buildOptionalLauncher({
      packageId,
      basePath,
      entries,
      contextSource: inputs.get('optional-practice/install-context.mjs'),
      installWorker,
    });
  }
  const files = [...entries]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) }));
  requireValid(
    files.length <= limits.files &&
      files.reduce((total, file) => total + file.bytes, 0) <= limits.bytes,
    'Optional practice exceeds unchanged package limits',
  );
  const workerTemplateSha256 = hash(Buffer.from(installWorker.toString()));
  const revision = hash(
    Buffer.from(JSON.stringify({ files, workerTemplateSha256, engineCommit, engineTree })),
  );
  entries.set(
    `${packageRoot}worker.js`,
    Buffer.from(workerSource(files, revision, packageRoot, installWorker)),
  );
  const manifest = {
    format: 'revealline-optional-practice-package.v1',
    id: packageId,
    revision,
    classification: 'public',
    workerTemplateSha256,
    engineCommit,
    engineTree,
    qualification: engineCommit ? 'requires-release-qualification' : 'development-only',
    entry: policy.entry,
    locales: ['en', 'uk'],
    core: false,
    limits,
    ...(installation ? { installation } : {}),
    files: [...entries]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) })),
  };
  entries.set('optional-package.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  const ordered = [...entries]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, bytes]) => ({ name, bytes }));
  requireValid(
    ordered.length <= limits.files &&
      ordered.reduce((total, file) => total + file.bytes.length, 0) <= limits.bytes,
    'Complete optional output exceeds package limits',
  );
  return { manifest, entries: ordered, zip: createZip(ordered), inputs };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2),
    packageFlag = args.indexOf('--package');
  let packageId = 'civilian-flight';
  if (packageFlag >= 0) {
    if (packageFlag !== args.length - 2 || !args[packageFlag + 1])
      throw new Error('Optional package flag requires one trailing package ID.');
    packageId = args[packageFlag + 1];
    args.splice(packageFlag, 2);
  }
  const [output, engineCommit = null, engineTree = null] = args;
  if (!output || ![1, 3].includes(args.length))
    throw new Error(
      'Usage: node scripts/build-optional-practice.mjs <new-output-directory> [engine-commit engine-tree] [--package PACKAGE_ID]',
    );
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = await buildOptionalPractice(root, { engineCommit, engineTree, packageId });
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output, { recursive: false });
  for (const entry of result.entries) {
    const target = path.join(output, entry.name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, entry.bytes);
  }
  await writeFile(path.join(output, `${packageId}.zip`), result.zip);
  process.stdout.write(
    `Optional practice: ${result.entries.length} files, ${result.zip.length} archive bytes; ${result.manifest.qualification}.\n`,
  );
}
